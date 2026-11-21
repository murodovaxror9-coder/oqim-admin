import { db, parseJson } from '../db/index.js'
import { DAY, HOUR } from '../lib/time.js'
import { getHall } from './hall.js'
import { batchStock } from './operations.js'
import { hourlyRevenue, salesTotals, taskStats, todayRange, topItems, waiterStats } from './reports.js'
import { getSettings } from './settings.js'

// "Bugun" ekrani: bugungi raqamlar o'tgan haftaning shu kuni bilan, aynan shu soatgacha solishtiriladi
export function getToday(now = Date.now()) {
  const settings = getSettings()
  const { date, start, end } = todayRange(now)
  const weekAgo = start - 7 * DAY
  const hall = getHall(now)

  const today = salesTotals(start, now)
  const lastWeek = salesTotals(weekAgo, now - 7 * DAY)
  const tasks = taskStats(start, now)

  const hoursToday = hourlyRevenue(start, end)
  const hoursPrev = hourlyRevenue(weekAgo, weekAgo + DAY)
  const currentHour = Math.floor((now - start) / HOUR)
  const hourly = []
  for (let hour = 10; hour <= 23; hour += 1) {
    hourly.push({
      hour,
      revenue: hour <= currentHour ? (hoursToday.get(hour)?.revenue ?? 0) : null,
      lastWeek: hoursPrev.get(hour)?.revenue ?? 0,
    })
  }

  const batches = db
    .prepare('SELECT id, name_uz, name_ru, batch_size, batch_warn, available, stop_reason FROM menu_items WHERE batch_size IS NOT NULL AND archived = 0')
    .all()
    .map((item) => {
      const cooking = db
        .prepare('SELECT ready_at FROM batches WHERE menu_item_id = ? AND ready_at > ? ORDER BY ready_at LIMIT 1')
        .get(item.id, now)
      return {
        menuItemId: item.id,
        nameUz: item.name_uz,
        nameRu: item.name_ru,
        stock: batchStock(item.id, now),
        warn: item.batch_warn,
        size: item.batch_size,
        available: Boolean(item.available),
        stopReason: item.stop_reason,
        nextReadyAt: cooking?.ready_at ?? null,
      }
    })

  const bookings = db
    .prepare(
      `SELECT b.id, b.guest_name, b.guests, b.starts_at, b.note, t.number FROM bookings b JOIN tables t ON t.id = b.table_id
       WHERE b.status = 'booked' AND b.starts_at >= ? AND b.starts_at < ? ORDER BY b.starts_at LIMIT 4`,
    )
    .all(now - 15 * 60 * 1000, end)
    .map((b) => ({ id: b.id, guestName: b.guest_name, guests: b.guests, startsAt: b.starts_at, note: b.note, tableNumber: b.number }))

  const events = db
    .prepare(
      `SELECT a.*, u.name AS actor_name FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
       WHERE a.at <= ? ORDER BY a.at DESC, a.id DESC LIMIT 6`,
    )
    .all(now)
    .map((row) => ({
      id: row.id,
      at: row.at,
      actor: row.actor_id ? { id: row.actor_id, name: row.actor_name } : null,
      actorKind: row.actor_kind,
      category: row.category,
      action: row.action,
      target: withMenuName(parseJson(row.target)),
      params: parseJson(row.params),
    }))

  const openExceptions = db.prepare("SELECT type, COUNT(*) AS n FROM exceptions WHERE status = 'open' GROUP BY type").all()

  return {
    date,
    serverTime: now,
    today,
    lastWeek,
    tasks,
    targets: settings.targets,
    hourly,
    live: { ...hall.summary, openExceptions: openExceptions.reduce((sum, row) => sum + row.n, 0), exceptionsByType: openExceptions },
    waiters: waiterStats(start, now).map((waiter) => ({
      ...waiter,
      openTasks: hall.waiters.find((w) => w.id === waiter.id)?.openTasks ?? 0,
      onShift: hall.waiters.find((w) => w.id === waiter.id)?.onShift ?? false,
    })),
    batches,
    bookings,
    topItems: topItems(start, now, 5),
    events,
  }
}

// Jurnal yozuvidagi taomga nom qo'shiladi (frontend tarjima uchun)
function withMenuName(target) {
  if (target.type !== 'menu_item') return target
  const item = db.prepare('SELECT name_uz, name_ru FROM menu_items WHERE id = ?').get(target.id)
  return item ? { ...target, nameUz: item.name_uz, nameRu: item.name_ru } : target
}
