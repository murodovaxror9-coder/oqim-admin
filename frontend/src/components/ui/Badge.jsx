const TONES = {
  neutral: 'bg-mist text-muted',
  brand: 'bg-tint text-brand',
  ok: 'bg-ok-bg text-ok-ink',
  warn: 'bg-warn-bg text-warn-ink',
  late: 'bg-late-bg text-late-ink',
  dark: 'bg-navy text-white',
}

export function Badge({ tone = 'neutral', children, className = '', dot = false }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${TONES[tone]} ${className}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}

// Daraja belgisi: rang yolg'iz qolmaydi, yonida doim matn bor
export const LEVEL_TONE = { calm: 'ok', warn: 'warn', late: 'late' }
