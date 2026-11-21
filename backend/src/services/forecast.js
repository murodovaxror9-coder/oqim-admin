import { db } from '../db/index.js'
import { audit } from '../lib/audit.js'
import { conflict, notFound } from '../lib/http.js'
import { addDays, dayEnd, dayStart, localDate, localHour } from '../lib/time.js'
import { round1 } from './reports.js'

// Prognoz: o'tgan 4 ta shu hafta kunining o'rtachasi. Qozon rejasi talabdan oldin tayyor bo'lishi uchun tuziladi.

const OPEN_HOUR = 10
const CLOSE_HOUR = 23
const ORDERS_PER_WAITER_HOUR = 4

function basisDates(date, today) {
  const dates = []
  let cursor = addDays(date, -7)
  while (dates.length < 4 && cursor >= addDays(today, -60)) {
    if (cursor < today) dates.push(cursor)
    cursor = addDays(cursor, -7)
  }
  return dates
}

function hourlyOf(dates) {
  const hours = new Map()
  for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour += 1) hours.set(hour, { orders: 0, guests: 0, revenue: 0 })
  const items = new Map()
  for (const date of dates) {
    const orders = db
      .prepare("SELECT id, opened_at, guests, total FROM orders WHERE status = 'paid' AND opened_at >= ? AND opened_at < ?")
      .all(dayStart(date), dayEnd(date))
    for (const order of orders) {
      const entry = hours.get(localHour(order.opened_at))
      if (!entry) continue
      entry.orders += 1
      entry.guests += order.guests
      entry.revenue += order.total
    }
    const sold = db
      .prepare(
        `SELECT oi.menu_item_id, o.opened_at, oi.qty FROM order_items oi JOIN orders o ON o.id = oi.order_id
         JOIN menu_items m ON m.id = oi.menu_item_id
         WHERE m.batch_size IS NOT NULL AND o.status = 'paid' AND oi.status != 'cancelled' AND o.opened_at >= ? AND o.opened_at < ?`,
      )
      .all(dayStart(date), dayEnd(date))
    for (const row of sold) {
      const perHour = items.get(row.menu_item_id) ?? new Map()
      const hour = localHour(row.opened_at)
      perHour.set(hour, (perHour.get(hour) ?? 0) + row.qty)
      items.set(row.menu_item_id, perHour)
    }
  }
  return { hours, items }
}

// Qozon rejasi: har qozon zaxira ogohlantirish chegarasiga yetguncha yangisi tayyor bo'lishi kerak
function planBatches(item, perHour, days) {
  const plan = []
  let capacity = 0
  let demand = 0
  for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour += 1) {
    const need = (perHour?.get(hour) ?? 0) / days
    while (capacity - (demand + need) < (item.batch_warn ?? 0) && demand + need > 0) {
      const readyMinutes = Math.max(OPEN_HOUR * 60 - 15, hour * 60 - 15)
      const startMinutes = readyMinutes - (item.batch_cook_minutes ?? 40)
      plan.push({ startTime: hhmm(startMinutes), readyTime: hhmm(readyMinutes), portions: item.batch_size })
      capacity += item.batch_size
    }
    demand += need
  }
  return { plan, demand: Math.round(demand) }
}

const hhmm = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

export function getForecast(date, now = Date.now()) {
  const today = localDate(now)
  const dates = basisDates(date, today)
  const days = Math.max(dates.length, 1)
  const { hours, items } = hourlyOf(dates)

  const hourly = [...hours].map(([hour, entry]) => {
    const orders = entry.orders / days
    return {
      hour,
      orders: round1(orders),
      guests: round1(entry.guests / days),
      revenue: Math.round(entry.revenue / days / 1000) * 1000,
      waitersNeeded: orders ? Math.max(1, Math.ceil(orders / ORDERS_PER_WAITER_HOUR)) : 0,
    }
  })
  const basis = dates.map((d) => {
    const row = db
      .prepare("SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue FROM orders WHERE status = 'paid' AND opened_at >= ? AND opened_at < ?")
      .get(dayStart(d), dayEnd(d))
    return { date: d, orders: row.orders, revenue: row.revenue }
  })
  const revenues = basis.map((b) => b.revenue)
  const waitersScheduled = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'waiter' AND blocked = 0 AND shift_start IS NOT NULL").get().n

  const batchItems = db.prepare('SELECT * FROM menu_items WHERE batch_size IS NOT NULL AND archived = 0 ORDER BY sort').all()
  let plans = db.prepare('SELECT * FROM batch_plans WHERE date = ? ORDER BY start_time').all(date)
  if (!plans.length && date >= today) {
    const insert = db.prepare('INSERT INTO batch_plans (date, menu_item_id, start_time, batches) VALUES (?, ?, ?, 1)')
    for (const item of batchItems) {
      for (const batch of planBatches(item, items.get(item.id), days).plan) insert.run(date, item.id, batch.startTime)
    }
    plans = db.prepare('SELECT * FROM batch_plans WHERE date = ? ORDER BY start_time').all(date)
  }
  const confirmer = db.prepare('SELECT name FROM users WHERE id = ?')

  return {
    date,
    basis,
    totals: {
      revenue: Math.round(revenues.reduce((a, b) => a + b, 0) / days / 1000) * 1000,
      revenueMin: revenues.length ? Math.min(...revenues) : 0,
      revenueMax: revenues.length ? Math.max(...revenues) : 0,
      orders: Math.round(hourly.reduce((sum, h) => sum + h.orders, 0)),
      guests: Math.round(hourly.reduce((sum, h) => sum + h.guests, 0)),
      peakHour: hourly.reduce((best, h) => (h.orders > best.orders ? h : best), hourly[0]).hour,
      waitersScheduled,
      waitersPeak: Math.max(...hourly.map((h) => h.waitersNeeded)),
    },
    hourly,
    items: batchItems.map((item) => {
      const result = planBatches(item, items.get(item.id), days)
      const rows = plans.filter((plan) => plan.menu_item_id === item.id)
      return {
        menuItemId: item.id,
        nameUz: item.name_uz,
        nameRu: item.name_ru,
        batchSize: item.batch_size,
        cookMinutes: item.batch_cook_minutes,
        expectedPortions: result.demand,
        plannedPortions: rows.reduce((sum, row) => sum + row.batches * item.batch_size, 0),
        hourly: hourly.map((h) => ({ hour: h.hour, portions: round1((items.get(item.id)?.get(h.hour) ?? 0) / days) })),
        plans: rows.map((row) => {
          const [hours_, minutes] = row.start_time.split(':').map(Number)
          return {
            id: row.id,
            startTime: row.start_time,
            readyTime: hhmm(hours_ * 60 + minutes + (item.batch_cook_minutes ?? 40)),
            batches: row.batches,
            portions: row.batches * item.batch_size,
            status: row.status,
            confirmedAt: row.confirmed_at,
            confirmedBy: row.confirmed_by ? confirmer.get(row.confirmed_by)?.name : null,
          }
        }),
      }
    }),
    confirmed: plans.length > 0 && plans.every((plan) => plan.status === 'confirmed'),
    editable: date >= today,
  }
}

export function updatePlan(id, { startTime, batches }) {
  const plan = db.prepare('SELECT * FROM batch_plans WHERE id = ?').get(id)
  if (!plan) throw notFound('plan_not_found')
  if (plan.status === 'confirmed') throw conflict('plan_confirmed', 'Reja tasdiqlangan')
  db.prepare('UPDATE batch_plans SET start_time = ?, batches = ? WHERE id = ?').run(
    startTime ?? plan.start_time,
    batches ?? plan.batches,
    id,
  )
}

export function confirmPlans(date, actor, now = Date.now()) {
  const rows = db.prepare("SELECT * FROM batch_plans WHERE date = ? AND status = 'proposed'").all(date)
  if (!rows.length) throw conflict('nothing_to_confirm', 'Tasdiqlanadigan reja yo\'q')
  db.prepare("UPDATE batch_plans SET status = 'confirmed', confirmed_at = ?, confirmed_by = ? WHERE date = ? AND status = 'proposed'").run(
    now,
    actor.id,
    date,
  )
  audit({
    actor,
    category: 'kitchen',
    action: 'forecast.confirmed',
    target: { type: 'date', date },
    params: { batches: rows.reduce((sum, row) => sum + row.batches, 0) },
    at: now,
  })
}

