import { useT } from '../../i18n/index.js'

// Zal xaritasining asosi: devor, oshxona, bar, kirish. Stollar children sifatida chiziladi.
export function FloorBase({ floor, children, svgRef, className = '', ...props }) {
  const { t } = useT()
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${floor.width} ${floor.height}`}
      className={`h-auto w-full select-none ${className}`}
      role="img"
      {...props}
    >
      <defs>
        <pattern id="floor-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="#f1f1f4" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="0" y="0" width={floor.width} height={floor.height} rx="14" fill="url(#floor-grid)" stroke="#e2e2e6" strokeWidth="2" />
      {floor.landmarks.map((mark) => (
        <g key={mark.type}>
          <rect
            x={mark.x}
            y={mark.y}
            width={mark.w}
            height={mark.h}
            rx="8"
            fill={mark.type === 'entrance' ? '#ffffff' : '#f6f6f7'}
            stroke="#d4d4d8"
            strokeDasharray={mark.type === 'entrance' ? '6 5' : undefined}
          />
          <text
            x={mark.x + mark.w / 2}
            y={mark.y + mark.h / 2}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-muted text-[14px] font-semibold"
          >
            {t(`landmark.${mark.type}`)}
          </text>
        </g>
      ))}
      {children}
    </svg>
  )
}
