import { db, parseJson, transaction } from '../db/index.js'
import { audit } from '../lib/audit.js'
import { HttpError, conflict, notFound } from '../lib/http.js'
import { recalcOrder, reassignTask, startBatch } from './operations.js'

// Istisno turlari va ularga mumkin bo'lgan qarorlar
export const EXCEPTION_ACTIONS = {
  task_late: ['reassign', 'remind'],
  batch_low: ['new_batch', 'dismiss'],
  cancel_request: ['approve', 'reject'],
  booking_late: ['release', 'wait'],
  promise_broken: [],
}

const CATEGORY = {
  task_late: 'escalation',
  batch_low: 'kitchen',
  cancel_request: 'cancel',
  booking_late: 'bookings',
  promise_broken: 'compensation',
}

export function createException({
  type,
  tableId = null,
  taskId = null,
  orderId = null,
  orderItemId = null,
  menuItemId = null,
  bookingId = null,
  payload = {},
  at = Date.now(),
  demo = false,
  resolved = null,
}) {
  const result = db
    .prepare(
      `INSERT INTO exceptions (type, status, table_id, task_id, order_id, order_item_id, menu_item_id, booking_id,
        payload, created_at, resolved_at, resolution, is_demo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      type,
      resolved ? 'resolved' : 'open',
      tableId,
      taskId,
      orderId,
      orderItemId,
      menuItemId,
      bookingId,
      JSON.stringify(payload),
      at,
      resolved ? at : null,
      resolved ? JSON.stringify(resolved) : null,
      demo ? 1 : 0,
    )
  return Number(result.lastInsertRowid)
}

const SELECT = `
  SELECT e.*, tb.number AS table_number, m.name_uz AS item_name_uz, m.name_ru AS item_name_ru,
         u.name AS resolved_by_name, t.created_at AS task_created_at, t.done_at AS task_done_at,
         t.waiter_id AS task_waiter_id, w.name AS task_waiter_name
  FROM exceptions e
  LEFT JOIN tables tb ON tb.id = e.table_id
  LEFT JOIN menu_items m ON m.id = e.menu_item_id
  LEFT JOIN users u ON u.id = e.resolved_by
  LEFT JOIN tasks t ON t.id = e.task_id
  LEFT JOIN users w ON w.id = t.waiter_id`

export function toApi(row, at = Date.now()) {
  const payload = parseJson(row.payload, {})
  const resolution = parseJson(row.resolution, null)
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by ? { id: row.resolved_by, name: row.resolved_by_name } : null,
    resolution: resolution ? { action: resolution.action, waiterName: resolution.waiterName ?? null } : null,
    table: row.table_id ? { id: row.table_id, number: row.table_number } : null,
    menuItem: row.menu_item_id ? { id: row.menu_item_id, nameUz: row.item_name_uz, nameRu: row.item_name_ru } : null,
    task: row.task_id
      ? {
          id: row.task_id,
          waitSeconds: Math.round(((row.task_done_at ?? at) - row.task_created_at) / 1000),
          done: Boolean(row.task_done_at),
          waiterName: row.task_waiter_name,
        }
      : null,
    payload,
    actions: row.status === 'open' ? EXCEPTION_ACTIONS[row.type] ?? [] : [],
    canReopen: canReopen(row, resolution),
  }
}

// Qaytarish faqat bog'langan narsa hali mavjud va o'zgartirish mumkin bo'lsa
function canReopen(row, resolution) {
  if (row.status !== 'resolved' || !resolution) return false
  if (['task_done', 'auto_discount'].includes(resolution.action)) return false
  if (row.type === 'task_late') return Boolean(row.task_id) && !row.task_done_at
  if (row.type === 'cancel_request') return Boolean(row.order_item_id)
  if (row.type === 'booking_late') return Boolean(row.booking_id)
  if (row.type === 'batch_low') return resolution.action === 'dismiss' || Boolean(resolution.batchId)
  return true
}

export function listExceptions({ status, since }, at = Date.now()) {
  const rows = status === 'open'
    ? db.prepare(`${SELECT} WHERE e.status = 'open' ORDER BY e.created_at DESC`).all()
    : db.prepare(`${SELECT} WHERE e.status = 'resolved' AND e.created_at >= ? ORDER BY e.resolved_at DESC`).all(since)
  return rows.map((row) => toApi(row, at))
}

export function getException(id, at = Date.now()) {
  const row = db.prepare(`${SELECT} WHERE e.id = ?`).get(id)
  return row ? toApi(row, at) : null
}

function targetOf(row) {
  if (row.table_id) {
    const table = db.prepare('SELECT number FROM tables WHERE id = ?').get(row.table_id)
    return { type: 'table', number: table.number }
  }
  if (row.menu_item_id) return { type: 'menu_item', id: row.menu_item_id }
  return {}
}

export function resolveException(id, { action, waiterId }, actor, at = Date.now()) {
  const run = transaction(() => {
    const row = db.prepare('SELECT * FROM exceptions WHERE id = ?').get(id)
    if (!row) throw notFound('exception_not_found')
    if (row.status !== 'open') throw conflict('already_resolved', 'Istisno allaqachon hal qilingan')
    if (!(EXCEPTION_ACTIONS[row.type] ?? []).includes(action)) {
      throw new HttpError(400, 'bad_action', "Bu istisno uchun bunday qaror yo'q")
    }
    const payload = parseJson(row.payload, {})
    const resolution = { action }

    if (row.type === 'task_late' && action === 'reassign') {
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(row.task_id)
      const target = waiterId ?? payload.suggestedWaiterId
      if (!target) throw new HttpError(400, 'waiter_required', 'Ofitsiantni tanlang')
      if (task && !task.done_at) {
        resolution.prevWaiterId = task.waiter_id
        reassignTask(task.id, target, actor, at)
      }
      resolution.waiterName = db.prepare('SELECT name FROM users WHERE id = ?').get(target)?.name ?? null
    }
    if (row.type === 'batch_low' && action === 'new_batch') {
      resolution.batchId = startBatch(row.menu_item_id, actor, at, row.is_demo === 1)
    }
    if (row.type === 'cancel_request') {
      const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(row.order_item_id)
      if (item) {
        resolution.prevStatus = item.status
        if (action === 'approve') {
          db.prepare("UPDATE order_items SET status = 'cancelled' WHERE id = ?").run(item.id)
          recalcOrder(item.order_id)
        } else {
          db.prepare('UPDATE order_items SET cancel_requested_at = NULL, cancel_reason = NULL WHERE id = ?').run(item.id)
        }
      }
    }
    if (row.type === 'booking_late' && action === 'release') {
      const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(row.booking_id)
      if (booking) {
        resolution.prevStatus = booking.status
        db.prepare("UPDATE bookings SET status = 'no_show' WHERE id = ?").run(booking.id)
      }
    }

    db.prepare("UPDATE exceptions SET status = 'resolved', resolved_at = ?, resolved_by = ?, resolution = ? WHERE id = ?").run(
      at,
      actor.id,
      JSON.stringify(resolution),
      id,
    )
    audit({
      actor,
      category: CATEGORY[row.type] ?? 'escalation',
      action: 'exception.resolved',
      target: targetOf(row),
      params: { type: row.type, decision: action, waiter: resolution.waiterName ?? null },
      at,
      demo: row.is_demo === 1,
    })
  })
  run()
  return getException(id, at)
}

// Qarorni qaytarish: avvalgi holat tiklanadi va istisno yana ochiladi
export function reopenException(id, actor, at = Date.now()) {
  const run = transaction(() => {
    const row = db.prepare('SELECT * FROM exceptions WHERE id = ?').get(id)
    if (!row) throw notFound('exception_not_found')
    if (row.status !== 'resolved') throw conflict('not_resolved', 'Istisno hali ochiq')
    const resolution = parseJson(row.resolution, {})
    if (!resolution.action || ['task_done', 'auto_discount'].includes(resolution.action)) {
      throw conflict('cannot_reopen', 'Bu qarorni qaytarib bo\'lmaydi')
    }
    if (resolution.action === 'reassign' && resolution.prevWaiterId) {
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(row.task_id)
      if (task && !task.done_at) reassignTask(task.id, resolution.prevWaiterId, actor, at)
    }
    if (resolution.action === 'new_batch' && resolution.batchId) {
      const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(resolution.batchId)
      if (batch && batch.ready_at > at) db.prepare('DELETE FROM batches WHERE id = ?').run(batch.id)
      else if (batch) throw conflict('batch_ready', 'Qozon allaqachon pishgan')
    }
    if (row.type === 'cancel_request' && resolution.prevStatus) {
      const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(row.order_item_id)
      if (item) {
        db.prepare('UPDATE order_items SET status = ?, cancel_requested_at = COALESCE(cancel_requested_at, ?) WHERE id = ?').run(
          resolution.prevStatus,
          row.created_at,
          item.id,
        )
        recalcOrder(item.order_id)
      }
    }
    if (resolution.action === 'release' && resolution.prevStatus) {
      db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(resolution.prevStatus, row.booking_id)
    }
    db.prepare("UPDATE exceptions SET status = 'open', resolved_at = NULL, resolved_by = NULL, resolution = NULL WHERE id = ?").run(id)
    audit({
      actor,
      category: CATEGORY[row.type] ?? 'escalation',
      action: 'exception.reopened',
      target: targetOf(row),
      params: { type: row.type, decision: resolution.action },
      at,
      demo: row.is_demo === 1,
    })
  })
  run()
  return getException(id, at)
}
