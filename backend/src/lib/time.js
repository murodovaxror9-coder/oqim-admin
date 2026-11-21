// Restoran vaqti: Asia/Tashkent, UTC+5, yozgi vaqt yo'q
export const TZ_OFFSET_MS = 5 * 60 * 60 * 1000
export const SECOND = 1000
export const MINUTE = 60 * SECOND
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

const shifted = (ts) => new Date(ts + TZ_OFFSET_MS)

// "2026-11-19"
export function localDate(ts = Date.now()) {
  return shifted(ts).toISOString().slice(0, 10)
}

export function localHour(ts) {
  return shifted(ts).getUTCHours()
}

// "12:42"
export function localTime(ts) {
  return shifted(ts).toISOString().slice(11, 16)
}

// 0 = yakshanba ... 6 = shanba
export function localWeekday(ts) {
  return shifted(ts).getUTCDay()
}

export function dayStart(date) {
  return Date.parse(`${date}T00:00:00Z`) - TZ_OFFSET_MS
}

export function dayEnd(date) {
  return dayStart(date) + DAY
}

export function atLocal(date, hhmm) {
  const [hours, minutes] = hhmm.split(':').map(Number)
  return dayStart(date) + hours * HOUR + minutes * MINUTE
}

export function addDays(date, days) {
  return localDate(dayStart(date) + days * DAY)
}

export function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}
