// Farq belgisi: yo'nalish va yaxshi/yomon alohida. Rang yolg'iz emas, yonida o'q va matn bor.
export function Delta({ value, goodWhenUp = true, suffix = '%', label }) {
  if (value == null || Number.isNaN(value)) return null
  const up = value > 0
  const flat = value === 0
  const good = flat ? null : up === goodWhenUp
  const color = flat ? 'text-muted' : good ? 'text-ok-ink' : 'text-late-ink'
  return (
    <span className={`inline-flex items-center gap-1 text-[13px] font-semibold ${color}`}>
      <span aria-hidden>{flat ? '→' : up ? '↑' : '↓'}</span>
      <span className="num text-[13px]">
        {up ? '+' : ''}
        {String(value).replace('.', ',')}
        {suffix}
      </span>
      {label && <span className="font-medium text-muted">{label}</span>}
    </span>
  )
}

export function StatTile({ label, value, sub, delta, tone, className = '' }) {
  const toneClass = tone === 'late' ? 'border-late/25 bg-late-bg/60' : tone === 'warn' ? 'border-warn/30 bg-warn-bg/60' : 'border-line bg-surface'
  return (
    <div className={`hover-lift rounded-2xl border p-5 shadow-card ${toneClass} ${className}`}>
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <p className="num mt-2 text-[28px] leading-none font-semibold text-ink">{value}</p>
      {(delta || sub) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted">
          {delta}
          {sub && <span>{sub}</span>}
        </div>
      )}
    </div>
  )
}
