import { localDate, localTime } from './time.js'

const group = (value) => String(Math.round(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

export const formatNumber = (value) => (value == null ? '—' : `${value < 0 ? '−' : ''}${group(value)}`)

export function formatMoney(value, lang = 'uz') {
  if (value == null) return '—'
  return `${formatNumber(value)} ${lang === 'ru' ? 'сум' : "so'm"}`
}

// O'q va kichik yozuvlar uchun: 4,2 mln / 850 ming
export function formatCompact(value, lang = 'uz') {
  if (value == null) return '—'
  const abs = Math.abs(value)
  const units = lang === 'ru' ? ['млрд', 'млн', 'тыс'] : ['mlrd', 'mln', 'ming']
  const fmt = (n) => String(Math.round(n * 10) / 10).replace('.', ',')
  if (abs >= 1e9) return `${fmt(value / 1e9)} ${units[0]}`
  if (abs >= 1e6) return `${fmt(value / 1e6)} ${units[1]}`
  if (abs >= 1e3) return `${fmt(value / 1e3)} ${units[2]}`
  return String(value)
}

// 237 → "3:57"
export function formatDuration(seconds) {
  if (seconds == null) return '—'
  const sign = seconds < 0 ? '−' : ''
  const s = Math.abs(Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rest = String(s % 60).padStart(2, '0')
  return h ? `${sign}${h}:${String(m).padStart(2, '0')}:${rest}` : `${sign}${m}:${rest}`
}

export const formatTime = (ts) => (ts ? localTime(ts) : '—')

const MONTHS = {
  uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
}
const WEEKDAYS = {
  uz: ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'],
  ru: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
}

// "2026-11-19" → "19-noyabr" / "19 ноября"
export function formatDate(date, lang = 'uz', { weekday = false, year = false } = {}) {
  if (!date) return '—'
  const [y, m, d] = date.split('-').map(Number)
  const day = lang === 'ru' ? `${d} ${MONTHS.ru[m - 1]}` : `${d}-${MONTHS.uz[m - 1]}`
  const wd = WEEKDAYS[lang][new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${day}${year ? ` ${y}` : ''}${weekday ? `, ${wd}` : ''}`
}

export const weekdayName = (index, lang = 'uz') => WEEKDAYS[lang][index]

export function formatDateTime(ts, lang = 'uz') {
  if (!ts) return '—'
  return `${formatDate(localDate(ts), lang)}, ${localTime(ts)}`
}

export function formatPhone(phone) {
  const m = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(phone ?? '')
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : (phone ?? '—')
}

export function percentChange(current, previous) {
  if (!previous || current == null) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}
