// Restoran vaqti: Asia/Tashkent (UTC+5). Brauzer qaysi mintaqada bo'lmasin, vaqt Toshkent bo'yicha ko'rsatiladi.
export const TZ_OFFSET_MS = 5 * 60 * 60 * 1000
export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

const shifted = (ts) => new Date(ts + TZ_OFFSET_MS)

export const localDate = (ts = Date.now()) => shifted(ts).toISOString().slice(0, 10)
export const localTime = (ts) => shifted(ts).toISOString().slice(11, 16)
export const localTimeSec = (ts) => shifted(ts).toISOString().slice(11, 19)
export const dayStart = (date) => Date.parse(`${date}T00:00:00Z`) - TZ_OFFSET_MS
export const addDays = (date, days) => localDate(dayStart(date) + days * DAY + HOUR)
export const weekday = (date) => new Date(`${date}T12:00:00Z`).getUTCDay()
