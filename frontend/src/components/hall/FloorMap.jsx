import { useT } from '../../i18n/index.js'
import { formatDuration } from '../../lib/format.js'
import { FloorBase } from './FloorBase.jsx'

const STYLE = {
  free: { fill: '#ffffff', stroke: '#c9d4e3', text: '#44566f' },
  held: { fill: '#f6f3ff', stroke: '#8a6fd1', text: '#4b3a8c', dash: '6 4' },
  cleaning: { fill: '#f2f5f5', stroke: '#a9b8cc', text: '#44566f', dash: '4 4' },
  calm: { fill: '#e8eefb', stroke: '#1e4fc2', text: '#0f2240' },
  warn: { fill: '#fff1d6', stroke: '#e89400', text: '#7a4a00' },
  late: { fill: '#fde8e4', stroke: '#c93322', text: '#9e2015' },
}

export function styleOf(table) {
  if (table.tasks.length && table.level !== 'calm') return STYLE[table.level]
  if (table.status === 'free' || table.status === 'held' || table.status === 'cleaning') return STYLE[table.status]
  return STYLE.calm
}

export function FloorMap({ hall, selectedId, onSelect, elapsedOf }) {
  const { t } = useT()
  return (
    <FloorBase floor={hall.floor} aria-label={t('hall.title')}>
      {hall.tables.map((table) => {
        const style = styleOf(table)
        const top = table.tasks[0]
        const selected = table.id === selectedId
        const cx = table.x + table.w / 2
        const cy = table.y + table.h / 2
        const label = `${t('common.table', { n: table.number })}, ${t(`tableStatus.${table.status}`)}${top ? `, ${t(`task.${top.type}`)} ${formatDuration(elapsedOf(top))}` : ''}`
        return (
          <g
            key={table.id}
            role="button"
            tabIndex={0}
            aria-label={label}
            aria-pressed={selected}
            onClick={() => onSelect(table.id)}
            onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && (event.preventDefault(), onSelect(table.id))}
            className="cursor-pointer outline-none [&:focus-visible>.ring]:opacity-100"
          >
            <rect
              className="ring opacity-0"
              x={table.x - 6}
              y={table.y - 6}
              width={table.w + 12}
              height={table.h + 12}
              rx={table.shape === 'round' ? (table.w + 12) / 2 : 14}
              fill="none"
              stroke="#1e4fc2"
              strokeWidth="2"
              style={{ opacity: selected ? 1 : undefined }}
            />
            {table.shape === 'round' ? (
              <ellipse
                cx={cx}
                cy={cy}
                rx={table.w / 2}
                ry={table.h / 2}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth="2"
                strokeDasharray={style.dash}
                className={table.level === 'late' ? 'pulse-late' : ''}
              />
            ) : (
              <rect
                x={table.x}
                y={table.y}
                width={table.w}
                height={table.h}
                rx="10"
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth="2"
                strokeDasharray={style.dash}
                className={table.level === 'late' ? 'pulse-late' : ''}
              />
            )}
            <text x={cx} y={cy - (top ? 16 : 6)} textAnchor="middle" dominantBaseline="central" fill={style.text} className="font-num text-[30px] font-semibold">
              {table.number}
            </text>
            <text x={cx} y={cy + (top ? 8 : 20)} textAnchor="middle" dominantBaseline="central" fill={style.text} className="text-[13px] font-semibold">
              {table.order ? t('common.guests', { n: table.order.guests }) : t(`tableStatus.${table.status}`)}
            </text>
            {top && (
              <text x={cx} y={cy + 27} textAnchor="middle" dominantBaseline="central" fill={style.text} className="font-num text-[17px] font-semibold">
                {t(`task.${top.type}`)} {formatDuration(elapsedOf(top))}
              </text>
            )}
            {table.tasks.length > 1 && (
              <g>
                <circle cx={table.x + table.w - 4} cy={table.y + 4} r="11" fill={style.stroke} stroke="white" strokeWidth="2" />
                <text x={table.x + table.w - 4} y={table.y + 4} textAnchor="middle" dominantBaseline="central" fill="white" className="font-num text-[13px] font-semibold">
                  {table.tasks.length}
                </text>
              </g>
            )}
          </g>
        )
      })}
    </FloorBase>
  )
}
