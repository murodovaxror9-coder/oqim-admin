import { useState } from 'react'
import { useT } from '../../i18n/index.js'
import { Icon } from '../ui/Icon.jsx'
import { columnPath, niceTicks, useWidth } from './useWidth.js'

const MAIN = '#1e4fc2'
const COMPARE = '#8a6fd1'
const GRID = '#e4e9ef'
const AXIS = '#c9d4e3'

/**
 * Ustunli grafik, ixtiyoriy taqqoslash chizig'i bilan (masalan: bugun va o'tgan hafta).
 * data: [{ key, label, value, compare }]
 */
export function ColumnChart({
  data,
  mainLabel,
  compareLabel,
  height = 240,
  formatValue = String,
  formatAxis = String,
  title,
  labelEvery = 1,
  highlightKey,
}) {
  const { t } = useT()
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const [asTable, setAsTable] = useState(false)
  const hasCompare = compareLabel && data.some((d) => d.compare != null)

  const pad = { top: 12, right: 8, bottom: 26, left: 66 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const max = Math.max(1, ...data.map((d) => Math.max(d.value ?? 0, hasCompare ? (d.compare ?? 0) : 0)))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1]
  const band = innerW / Math.max(data.length, 1)
  const barW = Math.min(24, band * 0.62)
  const y = (v) => pad.top + innerH - (v / top) * innerH
  const cx = (i) => pad.left + band * i + band / 2

  const linePoints = hasCompare
    ? data.map((d, i) => (d.compare != null ? `${cx(i)},${y(d.compare)}` : null)).filter(Boolean).join(' ')
    : ''

  const active = hover != null ? data[hover] : null

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-[13px] text-muted">
          {hasCompare && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-[3px]" style={{ background: MAIN }} aria-hidden />
                {mainLabel}
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="18" height="10" aria-hidden>
                  <line x1="0" y1="5" x2="18" y2="5" stroke={COMPARE} strokeWidth="2" />
                  <circle cx="9" cy="5" r="3.5" fill={COMPARE} stroke="white" strokeWidth="1.5" />
                </svg>
                {compareLabel}
              </span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold text-muted hover:bg-mist hover:text-ink"
        >
          <Icon name={asTable ? 'reports' : 'audit'} size={16} />
          {asTable ? t('common.showChart') : t('common.showTable')}
        </button>
      </div>

      {asTable ? (
        <div className="max-h-[320px] overflow-auto rounded-lg border border-line">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-mist text-left text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">{title}</th>
                <th className="px-3 py-2 text-right font-semibold">{mainLabel}</th>
                {hasCompare && <th className="px-3 py-2 text-right font-semibold">{compareLabel}</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.key} className="border-t border-line">
                  <td className="px-3 py-1.5">{d.label}</td>
                  <td className="num px-3 py-1.5 text-right text-[15px]">{d.value == null ? '—' : formatValue(d.value)}</td>
                  {hasCompare && <td className="num px-3 py-1.5 text-right text-[15px]">{d.compare == null ? '—' : formatValue(d.compare)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative w-full min-w-0 overflow-hidden">
          <svg width={width} height={height} role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? AXIS : GRID} strokeWidth="1" />
                <text x={pad.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                  {formatAxis(tick)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const h = d.value ? (d.value / top) * innerH : 0
              const dim = hover != null && hover !== i
              const highlighted = highlightKey != null && d.key === highlightKey
              return (
                <g key={d.key}>
                  {d.value > 0 && (
                    <path
                      d={columnPath(cx(i) - barW / 2, y(d.value), barW, h)}
                      fill={MAIN}
                      opacity={dim ? 0.45 : highlighted || highlightKey == null ? 1 : 0.75}
                    />
                  )}
                  {i % labelEvery === 0 && (
                    <text x={cx(i)} y={height - 8} textAnchor="middle" className="fill-muted text-[11px]">
                      {d.label}
                    </text>
                  )}
                </g>
              )
            })}
            {hasCompare && (
              <>
                <polyline points={linePoints} fill="none" stroke={COMPARE} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {data.map((d, i) =>
                  d.compare != null && (hover === i || data.length <= 16) ? (
                    <circle key={d.key} cx={cx(i)} cy={y(d.compare)} r={hover === i ? 5 : 4} fill={COMPARE} stroke="white" strokeWidth="2" />
                  ) : null,
                )}
              </>
            )}
            {hover != null && <line x1={cx(hover)} x2={cx(hover)} y1={pad.top} y2={pad.top + innerH} stroke={AXIS} strokeWidth="1" />}
            {data.map((d, i) => (
              <rect
                key={d.key}
                x={pad.left + band * i}
                y={pad.top}
                width={band}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={-1}
              />
            ))}
          </svg>
          {active && (
            <div
              className="pointer-events-none absolute z-10 min-w-[150px] rounded-lg bg-navy px-3 py-2 text-[12px] text-white shadow-lg"
              style={{
                left: Math.min(Math.max(cx(hover) - 75, 0), width - 170),
                top: Math.max(0, y(Math.max(active.value ?? 0, active.compare ?? 0)) - 64),
              }}
            >
              <p className="mb-1 font-semibold text-white/70">{active.tooltipTitle ?? active.label}</p>
              <p className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ background: MAIN }} />
                  {mainLabel}
                </span>
                <span className="num text-[14px]">{active.value == null ? '—' : formatValue(active.value)}</span>
              </p>
              {hasCompare && (
                <p className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: COMPARE }} />
                    {compareLabel}
                  </span>
                  <span className="num text-[14px]">{active.compare == null ? '—' : formatValue(active.compare)}</span>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
