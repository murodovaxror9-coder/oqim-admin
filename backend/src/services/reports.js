import { db } from '../db/index.js'
import { DAY, addDays, dayEnd, dayStart, localDate, localHour } from '../lib/time.js'
import { getSettings } from './settings.js'

// Hisobotlar: tushum, xizmat tezligi, ofitsiantlar, taomlar, to'lov usullari

export function salesTotals(from, to) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue, COALESCE(SUM(guests), 0) AS guests,
              COALESCE(SUM(discount), 0) AS discounts, COALESCE(SUM(service_charge), 0) AS serviceCharge,
              COALESCE(SUM(promise_broken), 0) AS promiseBroken
       FROM orders WHERE status = 'paid' AND paid_at >= ? AND paid_at < ?`,
    )
    .get(from, to)
  const serve = db
    .prepare(
      `SELECT AVG(served_at - ordered_at) AS avgServe, COUNT(*) AS n FROM orders
       WHERE served_at IS NOT NULL AND ordered_at IS NOT NULL AND served_at >= ? AND served_at < ?`,
    )
    .get(from, to)
  return {
    revenue: row.revenue,
    orders: row.orders,
    guests: row.guests,
    avgCheck: row.orders ? Math.round(row.revenue / row.orders / 100) * 100 : 0,
    discounts: row.discounts,
    serviceCharge: row.serviceCharge,
    promiseBroken: row.promiseBroken,
    promiseKeptPercent: row.orders ? round1(100 - (row.promiseBroken / row.orders) * 100) : null,
    avgServeSeconds: serve.n ? Math.round(serve.avgServe / 1000) : null,
  }
}

export function taskStats(from, to, waiterId = null) {
  const settings = getSettings()
  const rows = db
    .prepare(
      `SELECT type, COUNT(*) AS count, AVG(done_at - created_at) AS avgMs,
              SUM(CASE WHEN done_at - created_at > sla_seconds * 1000 THEN 1 ELSE 0 END) AS late
       FROM tasks WHERE done_at IS NOT NULL AND created_at >= ? AND created_at < ? ${waiterId ? 'AND waiter_id = ?' : ''}
       GROUP BY type`,
    )
    .all(...[from, to, waiterId].filter((value) => value !== null))
  const byType = Object.keys(settings.tasks).map((type) => {
    const row = rows.find((r) => r.type === type)
    return {
      type,
      count: row?.count ?? 0,
      avgSeconds: row ? Math.round(row.avgMs / 1000) : null,
      slaSeconds: settings.tasks[type].seconds,
      latePercent: row?.count ? round1((row.late / row.count) * 100) : 0,
    }
  })
  const count = rows.reduce((sum, r) => sum + r.count, 0)
  const late = rows.reduce((sum, r) => sum + r.late, 0)
  const avgMs = count ? rows.reduce((sum, r) => sum + r.avgMs * r.count, 0) / count : null
  return { count, late, latePercent: count ? round1((late / count) * 100) : 0, avgSeconds: avgMs ? Math.round(avgMs / 1000) : null, byType }
}

export function waiterStats(from, to) {
  const waiters = db.prepare("SELECT id, name FROM users WHERE role = 'waiter' ORDER BY id").all()
  return waiters.map((waiter) => {
    const tasks = taskStats(from, to, waiter.id)
    const sales = db
      .prepare(
        `SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue FROM orders
         WHERE status = 'paid' AND waiter_id = ? AND paid_at >= ? AND paid_at < ?`,
      )
      .get(waiter.id, from, to)
    return {
      id: waiter.id,
      name: waiter.name,
      tasks: tasks.count,
      avgSeconds: tasks.avgSeconds,
      lateCount: tasks.late,
      latePercent: tasks.latePercent,
      orders: sales.orders,
      revenue: sales.revenue,
    }
  })
}

export function topItems(from, to, limit = 10) {
  return db
    .prepare(
      `SELECT m.id, m.name_uz AS nameUz, m.name_ru AS nameRu, SUM(oi.qty) AS qty, SUM(oi.qty * oi.price) AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN menu_items m ON m.id = oi.menu_item_id
       WHERE o.status = 'paid' AND o.paid_at >= ? AND o.paid_at < ? AND oi.status != 'cancelled'
       GROUP BY m.id ORDER BY revenue DESC LIMIT ?`,
    )
    .all(from, to, limit)
}

export function hourlyRevenue(from, to) {
  const rows = db.prepare("SELECT paid_at, total FROM orders WHERE status = 'paid' AND paid_at >= ? AND paid_at < ?").all(from, to)
  const hours = new Map()
  for (const row of rows) {
    const hour = localHour(row.paid_at)
    const entry = hours.get(hour) ?? { revenue: 0, orders: 0 }
    entry.revenue += row.total
    entry.orders += 1
    hours.set(hour, entry)
  }
  return hours
}

export function getReport({ from, to }) {
  const start = dayStart(from)
  const end = dayEnd(to)
  const days = Math.round((end - start) / DAY)
  const prevStart = start - days * DAY

  const daily = []
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const totals = salesTotals(dayStart(date), dayEnd(date))
    daily.push({ date, revenue: totals.revenue, orders: totals.orders, guests: totals.guests, avgServeSeconds: totals.avgServeSeconds })
  }

  const hours = hourlyRevenue(start, end)
  const byHour = []
  for (let hour = 10; hour <= 23; hour += 1) {
    const entry = hours.get(hour) ?? { revenue: 0, orders: 0 }
    byHour.push({ hour, revenue: Math.round(entry.revenue / days), orders: round1(entry.orders / days) })
  }

  const payments = db
    .prepare(
      `SELECT payment_method AS method, COUNT(*) AS count, SUM(total) AS amount FROM orders
       WHERE status = 'paid' AND paid_at >= ? AND paid_at < ? GROUP BY payment_method ORDER BY amount DESC`,
    )
    .all(start, end)

  const sources = db
    .prepare(
      `SELECT source, COUNT(*) AS count FROM orders WHERE status = 'paid' AND paid_at >= ? AND paid_at < ? GROUP BY source`,
    )
    .all(start, end)

  return {
    from,
    to,
    days,
    totals: salesTotals(start, end),
    previous: salesTotals(prevStart, start),
    tasks: taskStats(start, end),
    daily,
    byHour,
    waiters: waiterStats(start, end),
    topItems: topItems(start, end),
    payments,
    sources,
  }
}

export function reportCsv({ from, to }) {
  const rows = db
    .prepare(
      `SELECT o.id, o.paid_at, tb.number, u.name, o.guests, o.source, o.subtotal, o.service_charge, o.discount, o.total,
              o.payment_method, o.promise_broken, o.ordered_at, o.served_at
       FROM orders o JOIN tables tb ON tb.id = o.table_id LEFT JOIN users u ON u.id = o.waiter_id
       WHERE o.status = 'paid' AND o.paid_at >= ? AND o.paid_at < ? ORDER BY o.paid_at`,
    )
    .all(dayStart(from), dayEnd(to))
  const header = ['ID', 'Sana', 'Vaqt', 'Stol', 'Ofitsiant', 'Mehmon', 'Manba', 'Summa', 'Xizmat haqi', 'Chegirma', 'Jami', "To'lov", "Va'da buzilgan", 'Xizmat (soniya)']
  const lines = rows.map((row) => {
    const iso = new Date(row.paid_at + 5 * 3600 * 1000).toISOString()
    return [
      row.id,
      iso.slice(0, 10),
      iso.slice(11, 16),
      row.number,
      row.name ?? '',
      row.guests,
      row.source,
      row.subtotal,
      row.service_charge,
      row.discount,
      row.total,
      row.payment_method ?? '',
      row.promise_broken ? 'ha' : "yo'q",
      row.served_at && row.ordered_at ? Math.round((row.served_at - row.ordered_at) / 1000) : '',
    ]
  })
  return `﻿${[header, ...lines].map((line) => line.map(csvCell).join(';')).join('\r\n')}`
}

export const csvCell = (value) => {
  const text = String(value ?? '')
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export const round1 = (value) => Math.round(value * 10) / 10

export const todayRange = (now = Date.now()) => {
  const date = localDate(now)
  return { date, start: dayStart(date), end: dayEnd(date) }
}
