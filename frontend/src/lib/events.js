import { formatDate, formatDuration, formatMoney } from './format.js'
import { localTime } from './time.js'

// Audit yozuvini o'qiladigan gapga aylantiradi. Backend faqat kod va parametr saqlaydi.
export function describeEvent(event, t, lang) {
  const { action, target = {}, params = {} } = event
  const item = (lang === 'ru' ? target.nameRu : target.nameUz) ?? params.item ?? ''
  // Stolga bog'lanmagan yozuvda (masalan, qozon) o'rniga taom nomi
  const table = target.number != null ? t('common.table', { n: target.number }) : item
  const role = (r) => (r ? t(`roles.${r}`) : '')
  const values = {
    table,
    item,
    name: target.name ?? '',
    guest: params.guest ?? '',
    n: params.n ?? params.guests ?? params.count ?? '',
    amount: params.amount != null ? formatMoney(params.amount, lang) : '',
    reason: params.reason === 'supplies' ? t('events.reasonSupplies') : params.reason ? t(`exceptions.reasons.${params.reason}`) : '',
    task: params.taskType ? t(`task.${params.taskType}`) : '',
    waiter: params.waiter ?? '',
    time: params.at ? localTime(params.at) : params.seconds != null ? formatDuration(params.seconds) : '',
    from: action === 'menu.price_changed' ? formatMoney(params.from, lang) : action === 'staff.role_changed' ? role(params.from) : (params.from ?? t('events.noWaiter')),
    to: action === 'menu.price_changed' ? formatMoney(params.to, lang) : action === 'staff.role_changed' ? role(params.to) : action === 'order.moved' ? params.to : (params.to ?? t('events.noWaiter')),
    size: params.size ?? '',
    cook: params.cookMinutes ?? '',
    date: target.date ? formatDate(target.date, lang) : '',
    type: params.type ? t(`exceptions.typeNames.${params.type}`) : '',
    decision: params.decision
      ? t(`exceptions.decisions.${params.decision}`, { name: params.waiter ?? '' })
      : '',
    role: role(params.role),
    printer: target.id ? t(`settings.printer.${target.id}`) : '',
    changes: (params.changes ?? [])
      .map((c) => {
        const label = t(`settingsPaths.${c.path}`)
        return `${label.startsWith('settingsPaths.') ? c.path : label} ${formatValue(c.from)} → ${formatValue(c.to)}`
      })
      .join('; '),
    action,
  }
  const key = `events.${action}`
  const text = t(key, values)
  return text === key ? t('events.unknown', values) : text
}

const formatValue = (value) => {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
