// Gorizontal chiziqlar ro'yxati: nom, chiziq, qiymat. Bitta seriya — legenda kerak emas.
export function BarList({ items, formatValue = String, max: maxProp }) {
  const max = maxProp ?? Math.max(1, ...items.map((item) => item.value))
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate font-medium text-ink">{item.label}</span>
            <span className="flex shrink-0 items-baseline gap-2">
              <span className="num text-[15px] text-ink">{formatValue(item.value)}</span>
              {item.note && <span className="text-muted">{item.note}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-tint">
            <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.max(1.5, (item.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

// Qozon zaxirasi: to'ldirish holatga qarab rang oladi, izi shu rampning och pog'onasi
export function Meter({ value, max, warn, label }) {
  const ratio = Math.min(1, value / Math.max(max, 1))
  const tone = value === 0 ? 'late' : value <= warn ? 'warn' : 'ok'
  const fill = { ok: 'bg-ok', warn: 'bg-warn', late: 'bg-late' }[tone]
  const track = { ok: 'bg-ok-bg', warn: 'bg-warn-bg', late: 'bg-late-bg' }[tone]
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label} className={`h-2 rounded-full ${track}`}>
      <div className={`h-2 rounded-full ${fill}`} style={{ width: `${Math.max(value ? 3 : 0, ratio * 100)}%` }} />
    </div>
  )
}
