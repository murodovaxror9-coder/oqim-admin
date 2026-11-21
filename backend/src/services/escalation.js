import { db, parseJson, transaction } from '../db/index.js'
import { audit } from '../lib/audit.js'
import { MINUTE } from '../lib/time.js'
import { createException } from './exceptions.js'
import { batchStock, createTask, leastBusyWaiter, recalcOrder } from './operations.js'
import { getSettings } from './settings.js'

const BOOKING_LATE_MS = 15 * MINUTE

// Har 5 soniyada ishlaydi: oshxona holati, kechikishlar, va'dalar, qozon, bronlar
export const runEscalation = transaction((now = Date.now()) => {
  const settings = getSettings()
  advanceKitchen(now)
  checkTasks(now, settings)
  checkPromises(now, settings)
  checkBatches(now)
  checkBookings(now)
})

function advanceKitchen(now) {
  db.prepare("UPDATE order_items SET status = 'cooking' WHERE status = 'queued' AND start_at <= ?").run(now)
  const ready = db
    .prepare(
      `SELECT DISTINCT oi.order_id, o.table_id, o.is_demo FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE oi.status = 'cooking' AND oi.ready_at <= ? AND o.status = 'open'`,
    )
    .all(now)
  db.prepare("UPDATE order_items SET status = 'ready' WHERE status = 'cooking' AND ready_at <= ?").run(now)
  for (const row of ready) {
    const open = db
      .prepare("SELECT id FROM tasks WHERE order_id = ? AND type = 'deliver' AND done_at IS NULL")
      .get(row.order_id)
    if (!open) createTask({ tableId: row.table_id, orderId: row.order_id, type: 'deliver', at: now, demo: row.is_demo === 1 })
  }
}

function checkTasks(now, settings) {
  const tasks = db
    .prepare(
      `SELECT t.*, tb.number AS table_number, u.name AS waiter_name FROM tasks t
       JOIN tables tb ON tb.id = t.table_id LEFT JOIN users u ON u.id = t.waiter_id
       WHERE t.done_at IS NULL`,
    )
    .all()
  for (const task of tasks) {
    const elapsed = now - task.created_at
    const sla = task.sla_seconds * 1000
    const demo = task.is_demo === 1
    const target = { type: 'table', number: task.table_number }
    if (elapsed > sla && !task.admin_alert_at) {
      db.prepare('UPDATE tasks SET admin_alert_at = ? WHERE id = ?').run(now, task.id)
      const helper = leastBusyWaiter(task.waiter_id)
      createException({
        type: 'task_late',
        tableId: task.table_id,
        taskId: task.id,
        orderId: task.order_id,
        payload: {
          taskType: task.type,
          level: 'admin',
          waiterId: task.waiter_id,
          waiterName: task.waiter_name,
          slaSeconds: task.sla_seconds,
          suggestedWaiterId: helper?.id ?? null,
          suggestedWaiterName: helper?.name ?? null,
        },
        at: now,
        demo,
      })
      audit({
        kind: 'system',
        category: 'escalation',
        action: 'escalation.admin',
        target,
        params: { taskType: task.type, waiter: task.waiter_name, seconds: Math.round(elapsed / 1000) },
        at: now,
        demo,
      })
    }
    if (elapsed > sla * settings.escalation.ownerMultiplier && !task.owner_alert_at) {
      db.prepare('UPDATE tasks SET owner_alert_at = ? WHERE id = ?').run(now, task.id)
      const row = db.prepare("SELECT id, payload FROM exceptions WHERE task_id = ? AND status = 'open'").get(task.id)
      if (row) {
        const payload = { ...parseJson(row.payload, {}), level: 'owner' }
        db.prepare('UPDATE exceptions SET payload = ? WHERE id = ?').run(JSON.stringify(payload), row.id)
      }
      audit({
        kind: 'system',
        category: 'escalation',
        action: 'escalation.owner',
        target,
        params: { taskType: task.type, waiter: task.waiter_name, seconds: Math.round(elapsed / 1000) },
        at: now,
        demo,
      })
    }
  }
}

// Va'da buzilsa chegirma o'zi qo'llanadi va ma'lumot uchun istisno yoziladi
function checkPromises(now, settings) {
  const broken = db
    .prepare(
      `SELECT o.*, tb.number AS table_number FROM orders o JOIN tables tb ON tb.id = o.table_id
       WHERE o.status = 'open' AND o.served_at IS NULL AND o.promise_broken = 0 AND o.promise_at IS NOT NULL AND o.promise_at < ?`,
    )
    .all(now)
  for (const order of broken) {
    db.prepare('UPDATE orders SET promise_broken = 1 WHERE id = ?').run(order.id)
    recalcOrder(order.id)
    const { discount } = db.prepare('SELECT discount FROM orders WHERE id = ?').get(order.id)
    const demo = order.is_demo === 1
    createException({
      type: 'promise_broken',
      tableId: order.table_id,
      orderId: order.id,
      payload: { discount, percent: settings.compensation.promiseDiscountPercent, promiseAt: order.promise_at },
      at: now,
      demo,
      resolved: { action: 'auto_discount' },
    })
    audit({
      kind: 'system',
      category: 'compensation',
      action: 'compensation.applied',
      target: { type: 'table', number: order.table_number },
      params: { amount: discount, percent: settings.compensation.promiseDiscountPercent },
      at: now,
      demo,
    })
  }
}

function checkBatches(now) {
  const items = db.prepare('SELECT * FROM menu_items WHERE batch_size IS NOT NULL AND archived = 0').all()
  for (const item of items) {
    const stock = batchStock(item.id, now)
    const cooking = db.prepare('SELECT COUNT(*) AS n FROM batches WHERE menu_item_id = ? AND ready_at > ?').get(item.id, now).n
    if (item.stop_reason === 'batch_empty' && stock > 0) {
      db.prepare('UPDATE menu_items SET available = 1, stop_reason = NULL WHERE id = ?').run(item.id)
      audit({ kind: 'system', category: 'menu', action: 'menu.back_auto', target: { type: 'menu_item', id: item.id }, at: now })
    }
    if (item.stop_reason === 'manual') continue
    const open = db.prepare("SELECT id FROM exceptions WHERE type = 'batch_low' AND menu_item_id = ? AND status = 'open'").get(item.id)
    if (!open && !cooking && stock <= (item.batch_warn ?? 0)) {
      const demo = Boolean(db.prepare('SELECT 1 FROM batches WHERE menu_item_id = ? AND is_demo = 1 LIMIT 1').get(item.id))
      createException({
        type: 'batch_low',
        menuItemId: item.id,
        payload: { stock, warn: item.batch_warn, size: item.batch_size, cookMinutes: item.batch_cook_minutes },
        at: now,
        demo,
      })
    }
    // Yangi qozon qo'yilgan bo'lsa ogohlantirish o'z-o'zidan yopiladi
    if (open && cooking) {
      db.prepare("UPDATE exceptions SET status = 'resolved', resolved_at = ?, resolution = ? WHERE id = ?").run(
        now,
        JSON.stringify({ action: 'task_done' }),
        open.id,
      )
    }
  }
}

function checkBookings(now) {
  const late = db
    .prepare(
      `SELECT b.* FROM bookings b WHERE b.status = 'booked' AND b.starts_at + ? < ?
       AND NOT EXISTS (SELECT 1 FROM exceptions e WHERE e.type = 'booking_late' AND e.booking_id = b.id)`,
    )
    .all(BOOKING_LATE_MS, now)
  for (const booking of late) {
    createException({
      type: 'booking_late',
      tableId: booking.table_id,
      bookingId: booking.id,
      payload: { guestName: booking.guest_name, guests: booking.guests, startsAt: booking.starts_at },
      at: now,
      demo: booking.is_demo === 1,
    })
  }
}
