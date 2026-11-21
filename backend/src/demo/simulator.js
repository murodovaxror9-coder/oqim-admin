import { db, transaction } from '../db/index.js'
import { HOUR_DEMAND, WAITER_SPEED } from '../db/demo.js'
import { createRandom } from '../lib/random.js'
import { MINUTE, SECOND, localHour } from '../lib/time.js'
import { resolveException } from '../services/exceptions.js'
import { addItems, completeTask, createTask, deliverReady, openOrder, payOrder, requestBill } from '../services/operations.js'
import { priorityOf } from '../services/rules.js'
import { getSettings } from '../services/settings.js'

// Demo simulyatsiya: ofitsiantlar vazifalarni o'z tezligida bajaradi, mehmonlar keladi,
// taom buyuradi, ofitsiantni chaqiradi va hisob so'raydi. Admin panel shu "jonli" zalni kuzatadi.

const TICK_MS = 10 * SECOND
const rnd = createRandom()
const protectedTasks = new Map()
const busyUntil = new Map()
const TASK_FACTOR = { take: 1.4, deliver: 0.9, call: 0.8, bill: 1.1, clean: 1.6 }
const METHODS = [['cash', 32], ['card', 30], ['click', 12], ['payme', 12], ['uzum', 6], ['nfc', 8]]

export function protectTasks(list) {
  for (const { id, until } of list) protectedTasks.set(id, until)
}

const isProtected = (taskId, now) => (protectedTasks.get(taskId) ?? 0) > now

function randomItems(guests) {
  const menu = db.prepare('SELECT id, name_uz, wave FROM menu_items WHERE available = 1 AND archived = 0').all()
  const mains = menu.filter((item) => item.wave === 2)
  const starters = menu.filter((item) => item.wave === 1)
  const picks = new Map()
  const add = (id, qty) => picks.set(id, (picks.get(id) ?? 0) + qty)
  for (let i = 0; i < guests; i += 1) add(rnd.pick(mains).id, 1)
  for (let i = 0; i < Math.ceil(guests / 2) + 1; i += 1) add(rnd.pick(starters).id, 1)
  return [...picks].map(([menuItemId, qty]) => ({ menuItemId, qty }))
}

function workWaiters(now, settings) {
  const waiters = db
    .prepare("SELECT id, name FROM users WHERE role = 'waiter' AND blocked = 0 AND shift_started_at IS NOT NULL")
    .all()
  for (const waiter of waiters) {
    if ((busyUntil.get(waiter.id) ?? 0) > now) continue
    const tasks = db.prepare('SELECT * FROM tasks WHERE waiter_id = ? AND done_at IS NULL').all(waiter.id)
    const next = tasks
      .filter((task) => !isProtected(task.id, now))
      .map((task) => ({
        task,
        priority: priorityOf(now - task.created_at, task.sla_seconds, settings.tasks[task.type].weight),
      }))
      .sort((a, b) => b.priority - a.priority)[0]?.task
    if (!next) continue
    const reaction = rnd.around((WAITER_SPEED[waiter.name] ?? 80) * TASK_FACTOR[next.type], 0.4) * SECOND
    if (now - next.created_at < reaction) continue
    finishTask(next, now)
    busyUntil.set(waiter.id, now + rnd.int(15, 35) * SECOND)
  }
}

function finishTask(task, now) {
  const order = task.order_id ? db.prepare('SELECT * FROM orders WHERE id = ?').get(task.order_id) : null
  if (task.type === 'take' && order?.status === 'open') {
    const hasItems = db.prepare('SELECT COUNT(*) AS n FROM order_items WHERE order_id = ?').get(order.id).n > 0
    const items = hasItems ? randomItems(1).slice(0, 1) : randomItems(order.guests)
    addItems(order.id, items, now)
  }
  if (task.type === 'deliver' && order) deliverReady(order.id, now)
  if (task.type === 'bill' && order?.status === 'open') {
    payOrder(order.id, rnd.weighted(METHODS), now, task.is_demo === 1)
    return
  }
  completeTask(task.id, now)
}

function guests(now) {
  const eating = db
    .prepare(
      `SELECT o.* FROM orders o WHERE o.status = 'open' AND o.served_at IS NOT NULL AND o.bill_at IS NULL`,
    )
    .all()
  for (const order of eating) {
    if (now - order.served_at > (order.eat_minutes ?? 40) * MINUTE) {
      requestBill(order.id, now, order.is_demo === 1)
      continue
    }
    const calling = db.prepare("SELECT 1 FROM tasks WHERE order_id = ? AND type = 'call' AND done_at IS NULL").get(order.id)
    if (!calling && rnd.chance(0.012)) createTask({ tableId: order.table_id, orderId: order.id, type: 'call', at: now, demo: true })
  }

  // Yangi mehmonlar: bo'sh, tozalangan va yaqin bron qilinmagan stollarga
  const demand = HOUR_DEMAND[localHour(now)] ?? 0.15
  const free = db
    .prepare(
      `SELECT t.* FROM tables t WHERE t.active = 1
       AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.table_id = t.id AND o.status = 'open')
       AND NOT EXISTS (SELECT 1 FROM tasks k WHERE k.table_id = t.id AND k.type = 'clean' AND k.done_at IS NULL)
       AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.table_id = t.id AND b.status = 'booked' AND b.starts_at < ? AND b.ends_at > ?)`,
    )
    .all(now + 45 * MINUTE, now)
  for (const table of free) {
    if (!rnd.chance(0.01 * demand)) continue
    openOrder({
      tableId: table.id,
      guests: rnd.int(1, table.seats),
      at: now,
      demo: true,
      eatMinutes: rnd.int(30, 60),
    })
  }

  // Bron vaqti kelganda mehmon o'tiradi (stol bo'sh bo'lsa)
  const arriving = db
    .prepare("SELECT * FROM bookings WHERE status = 'booked' AND starts_at <= ? AND starts_at > ?")
    .all(now + 2 * MINUTE, now - 10 * MINUTE)
  for (const booking of arriving) {
    const busy = db.prepare("SELECT 1 FROM orders WHERE table_id = ? AND status = 'open'").get(booking.table_id)
    if (busy || !rnd.chance(0.3)) continue
    openOrder({ tableId: booking.table_id, guests: booking.guests, at: now, demo: true, eatMinutes: rnd.int(45, 80) })
    db.prepare("UPDATE bookings SET status = 'seated' WHERE id = ?").run(booking.id)
  }
}

// Oshpaz qozon tugayotganini 10 daqiqada admin hal qilmasa o'zi yangi qozon qo'yadi
function cooks(now) {
  const cook = db.prepare("SELECT id, name, role FROM users WHERE role = 'cook' AND post = 'kazan' AND blocked = 0").get()
  if (!cook) return
  const stale = db
    .prepare("SELECT id FROM exceptions WHERE type = 'batch_low' AND status = 'open' AND created_at < ?")
    .all(now - 10 * MINUTE)
  for (const row of stale) resolveException(row.id, { action: 'new_batch' }, cook, now)
}

const tick = transaction((now) => {
  const settings = getSettings()
  workWaiters(now, settings)
  guests(now)
  cooks(now)
})

export function startSimulator() {
  const timer = setInterval(() => {
    try {
      tick(Date.now())
    } catch (error) {
      console.error('[simulator]', error.message)
    }
  }, TICK_MS)
  timer.unref()
  return () => clearInterval(timer)
}
