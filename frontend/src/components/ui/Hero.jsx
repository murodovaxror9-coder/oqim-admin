import { useT } from '../../i18n/index.js'
import { formatNumber } from '../../lib/format.js'
import { useCountUp } from '../../lib/useCountUp.js'
import { Delta } from './Stat.jsx'

function CountUp({ value, format = formatNumber }) {
  return format(useCountUp(value))
}

// Sahifaning asosiy raqami uchun to'q rangli "hero" kartochka (Bugun, Hisobotlar, Prognoz).
// value son bo'lsa sanab chiqadi; stats — ichki kichik kartochkalar.
export function HeroCard({ eyebrow, live = false, value, formatValue, unit, delta, deltaGoodWhenUp = true, note, stats = [], children, className = '' }) {
  const { lang } = useT()
  const cols = stats.length >= 4 ? 'sm:grid-cols-4' : stats.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
  return (
    <section
      className={`group relative isolate overflow-hidden rounded-[20px] bg-[#0c0b1d] p-6 text-white shadow-[0_24px_60px_-20px_rgb(49_46_129/0.65)] ring-1 ring-white/10 ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute -top-24 -left-16 h-72 w-72 animate-[count-glow_6s_ease-in-out_infinite] rounded-full bg-indigo-600/50 blur-[80px]" />
        <div className="absolute -right-20 -bottom-28 h-80 w-80 animate-[count-glow_7s_ease-in-out_infinite_-3s] rounded-full bg-violet-600/40 blur-[90px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.05)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_top_right,black_20%,transparent_70%)] bg-[size:28px_28px]" />
      </div>
      <p className="flex items-center gap-2 text-[13px] font-medium text-white/60">
        {live ? (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
        ) : (
          <span className="h-2 w-2 rounded-full bg-indigo-300" />
        )}
        {eyebrow}
      </p>
      <p className="num mt-3 bg-gradient-to-br from-white via-white to-indigo-200 bg-clip-text text-[44px] leading-none font-semibold tracking-[-0.04em] text-transparent sm:text-[60px]">
        {typeof value === 'number' ? <CountUp value={value} format={formatValue} /> : value}
        {unit !== false && (
          <span className="ml-2 text-[18px] font-medium tracking-normal text-white/50 sm:text-[22px]">{unit ?? (lang === 'ru' ? 'сум' : "so'm")}</span>
        )}
      </p>
      {(delta != null || note) && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
          {delta != null && (
            <span className="rounded-lg bg-white px-2 py-0.5" style={{ '--color-ok-ink': '#0d7a6d', '--color-late-ink': '#b42318', '--color-muted': '#66666f' }}>
              <Delta value={delta} goodWhenUp={deltaGoodWhenUp} />
            </span>
          )}
          {note && <span className="text-[13px] text-white/55">{note}</span>}
        </div>
      )}
      {stats.length > 0 && (
        <dl className={`mt-6 grid grid-cols-2 gap-3 ${cols}`}>
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 backdrop-blur-sm transition-colors hover:bg-white/[0.08]">
              <dt className="text-[12px] text-white/55">{stat.label}</dt>
              <dd className={`num text-[24px] leading-tight sm:text-[28px] ${stat.tone === 'late' ? 'text-[#ff8a7a]' : stat.tone === 'warn' ? 'text-amber-300' : ''}`}>{stat.value}</dd>
              {stat.sub && <dd className="text-[12px] text-white/50">{stat.sub}</dd>}
            </div>
          ))}
        </dl>
      )}
      {children && <div className="mt-5 flex flex-wrap gap-2">{children}</div>}
    </section>
  )
}
