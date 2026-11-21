import { db } from '../db/index.js'
import { MINUTE } from '../lib/time.js'
import { levelOf, priorityOf } from './rules.js'
import { getSettings } from './settings.js'

const HELD_BEFORE_MS = 30 * MINUTE
const LEVEL_RANK = { calm: 0, warn: 1, late: 2 }

export function taskView(task, now, settings) {
  const elapsed = now - task.created_at
  return {
    id: task.id,
    type: task.type,
    tableId: task.table_id,
    tableNumber: task.table_number,
    orderId: task.order_id,
    waiter: task.waiter_id ? { id: task.waiter_id, name: task.waiter_name } : null,
    helpedFrom: task.helped_from ? { id: task.helped_from, name: task.helped_from_name } : null,
    createdAt: task.created_at,
    elapsedSeconds: Math.round(elapsed / 1000),
    slaSeconds: task.sla_seconds,
    level: levelOf(elapsed, task.sla_seconds, settings.warnPercent),
    priority: Number(priorityOf(elapsed, task.sla_seconds, settings.tasks[task.type].weight).toFixed(3)),
    ownerAlert: Boolean(task.owner_alert_at),
  }
}

export function openTasks(now = Date.now(), settings = getSettings()) {
  return db
    .prepare(
      `SELECT t.*, tb.number AS table_number, u.name AS waiter_name, h.name AS helped_from_name
       FROM tasks t JOIN tables tb ON tb.id = t.table_id
       LEFT JOIN users u ON u.id = t.waiter_id LEFT JOIN users h ON h.id = t.helped_from
       WHERE t.done_at IS NULL`,
    )
    .all()
    .map((task) => taskView(task, now, settings))
    .sort((a, b) => b.priority - a.priority)
}

export function getHall(now = Date.now()) {
  const settings = getSettings()
  const tasks = openTasks(now, settings)
  const zones = db.prepare('SELECT id, name, sort FROM zones ORDER BY sort, id').all()
  const tables = db
    .prepare(
      `SELECT t.*, u.name AS waiter_name FROM tables t LEFT JOIN users u ON u.id = t.waiter_id
       WHERE t.active = 1 ORDER BY t.number`,
    )
    .all()
  const orders = new Map(
    db.prepare("SELECT * FROM orders WHERE status = 'open'").all().map((order) => [order.table_id, order]),
  )
  const itemsOf = db.prepare(
    `SELECT oi.id, oi.qty, oi.price, oi.status, oi.ready_at, oi.cancel_requested_at, m.name_uz, m.name_ru, m.wave
     FROM order_items oi JOIN menu_items m ON m.id = oi.menu_item_id WHERE oi.order_id = ? ORDER BY m.wave, oi.id`,
  )
  const bookings = db
    .prepare("SELECT * FROM bookings WHERE status = 'booked' AND ends_at > ? AND starts_at < ? ORDER BY starts_at")
    .all(now, now + 6 * 60 * MINUTE)

  const tableViews = tables.map((table) => {
    const order = orders.get(table.id)
    const own = tasks.filter((task) => task.tableId === table.id)
    const booking = bookings.find((b) => b.table_id === table.id) ?? null
    let status = 'free'
    if (order) {
      if (order.bill_at) status = 'bill'
      else if (!order.ordered_at) status = 'ordering'
      else if (!order.served_at) status = 'waiting'
      else status = 'eating'
    } else if (own.some((task) => task.type === 'clean')) status = 'cleaning'
    else if (booking && booking.starts_at - now <= HELD_BEFORE_MS) status = 'held'
    const level = own.reduce((worst, task) => (LEVEL_RANK[task.level] > LEVEL_RANK[worst] ? task.level : worst), 'calm')
    return {
      id: table.id,
      number: table.number,
      zoneId: table.zone_id,
      seats: table.seats,
      shape: table.shape,
      x: table.x,
      y: table.y,
      w: table.w,
      h: table.h,
      waiter: table.waiter_id ? { id: table.waiter_id, name: table.waiter_name } : null,
      status,
      level,
      tasks: own,
      booking: booking
        ? { id: booking.id, guestName: booking.guest_name, guests: booking.guests, startsAt: booking.starts_at, note: booking.note }
        : null,
      order: order
        ? {
            id: order.id,
            guests: order.guests,
            source: order.source,
            openedAt: order.opened_at,
            orderedAt: order.ordered_at,
            servedAt: order.served_at,
            billAt: order.bill_at,
            promiseAt: order.promise_at,
            promiseBroken: Boolean(order.promise_broken),
            subtotal: order.subtotal,
            serviceCharge: order.service_charge,
            discount: order.discount,
            total: order.total,
            items: itemsOf.all(order.id).map((item) => ({
              id: item.id,
              nameUz: item.name_uz,
              nameRu: item.name_ru,
              qty: item.qty,
              price: item.price,
              status: item.status,
              wave: item.wave,
              readyAt: item.ready_at,
              cancelRequested: Boolean(item.cancel_requested_at),
            })),
          }
        : null,
    }
  })

  const counts = new Map()
  for (const task of tasks) {
    if (!task.waiter) continue
    const entry = counts.get(task.waiter.id) ?? { open: 0, late: 0 }
    entry.open += 1
    if (task.level === 'late') entry.late += 1
    counts.set(task.waiter.id, entry)
  }
  const waiters = db
    .prepare("SELECT id, name, shift_started_at FROM users WHERE role = 'waiter' AND blocked = 0 ORDER BY id")
    .all()
    .map((waiter) => ({
      id: waiter.id,
      name: waiter.name,
      onShift: Boolean(waiter.shift_started_at),
      tables: tables.filter((table) => table.waiter_id === waiter.id).map((table) => table.number),
      openTasks: counts.get(waiter.id)?.open ?? 0,
      lateTasks: counts.get(waiter.id)?.late ?? 0,
      overloaded: (counts.get(waiter.id)?.open ?? 0) >= settings.escalation.helpMaxOpen,
    }))

  const kitchen = db
    .prepare(
      `SELECT m.station, oi.status, SUM(oi.qty) AS qty FROM order_items oi
       JOIN menu_items m ON m.id = oi.menu_item_id JOIN orders o ON o.id = oi.order_id
       WHERE o.status = 'open' AND oi.status IN ('queued', 'cooking', 'ready') GROUP BY m.station, oi.status`,
    )
    .all()

  return {
    serverTime: now,
    floor: settings.floor,
    zones,
    tables: tableViews,
    queue: tasks,
    waiters,
    kitchen,
    summary: {
      tables: tableViews.length,
      busy: tableViews.filter((table) => table.order).length,
      free: tableViews.filter((table) => table.status === 'free').length,
      guests: tableViews.reduce((sum, table) => sum + (table.order?.guests ?? 0), 0),
      lateTasks: tasks.filter((task) => task.level === 'late').length,
      warnTasks: tasks.filter((task) => task.level === 'warn').length,
    },
  }
}
