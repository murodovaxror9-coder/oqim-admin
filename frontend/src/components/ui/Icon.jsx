// 20px chiziqli ikonkalar: hammasi bir xil qalinlikda
const PATHS = {
  today: 'M3 10.5 10 4l7 6.5M5 9v7h4v-4h2v4h4V9',
  hall: 'M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z',
  exceptions: 'M10 3 2.5 16h15L10 3zM10 8v4M10 14.2v.3',
  reports: 'M3 17h14M5 14V9M9 14V5M13 14v-6M17 14v-3',
  menu: 'M4 3.5h9a2 2 0 0 1 2 2V17H6a2 2 0 0 1-2-2V3.5zM4 14.5a2 2 0 0 1 2-2h9M7 7h5',
  tables: 'M3 7h14M5 7v9M15 7v9M7 4h6',
  bookings: 'M4 5h12v12H4zM4 9h12M8 3v4M12 3v4',
  forecast: 'M3 15l4-5 3 3 6-8M12 5h4v4',
  staff: 'M7.5 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 17c0-3 2.5-5 5.5-5s5.5 2 5.5 5M13 4a3 3 0 0 1 0 5.5M15 12c2 .6 3 2.4 3 5',
  settings: 'M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM10 2v2.2M10 15.8V18M2 10h2.2M15.8 10H18M4.3 4.3l1.6 1.6M14.1 14.1l1.6 1.6M4.3 15.7l1.6-1.6M14.1 5.9l1.6-1.6',
  audit: 'M5 3h10v14H5zM8 7h4M8 10h4M8 13h2',
  stock: 'M3 6.5 10 3l7 3.5v7L10 17l-7-3.5zM3 6.5 10 10l7-3.5M10 10v7',
  logout: 'M8 4H4v12h4M13 6l4 4-4 4M17 10H8',
  left: 'M12 4l-6 6 6 6',
  right: 'M8 4l6 6-6 6',
  down: 'M5 8l5 5 5-5',
  plus: 'M10 4v12M4 10h12',
  x: 'M5 5l10 10M15 5 5 15',
  check: 'M4 10.5l4 4 8-9',
  clock: 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM10 6v4l3 2',
  search: 'M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM13.5 13.5 17 17',
  download: 'M10 3v10M6 9l4 4 4-4M4 17h12',
  print: 'M6 8V3h8v5M6 14H4V8h12v6h-2M6 12h8v5H6z',
  qr: 'M3 3h5v5H3zM12 3h5v5h-5zM3 12h5v5H3zM12 12h2v2h-2zM15 15h2v2h-2zM12 16h1M16 12h1',
  move: 'M10 3v14M3 10h14M10 3 8 5M10 3l2 2M10 17l-2-2M10 17l2-2M3 10l2-2M3 10l2 2M17 10l-2-2M17 10l-2 2',
  user: 'M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 17c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5',
  pot: 'M3 8h14v5a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8zM1.5 8h17M7 5c0-1 1-1 1-2M11 5c0-1 1-1 1-2',
  bell: 'M5 14V9a5 5 0 0 1 10 0v5l1.5 2h-13L5 14zM8.5 17.5a1.5 1.5 0 0 0 3 0',
  undo: 'M7 5 3 9l4 4M3 9h9a5 5 0 0 1 0 10h-2',
  lock: 'M5 9h10v8H5zM7 9V6a3 3 0 0 1 6 0v3',
  key: 'M7 13a4 4 0 1 1 3.5-6H18v3h-2v2h-3v-2h-2.5A4 4 0 0 1 7 13z',
  edit: 'M4 16h3l9-9-3-3-9 9v3zM11.5 5.5l3 3',
  trash: 'M4 6h12M8 6V4h4v2M6 6l1 11h6l1-11',
  menuBars: 'M3 6h14M3 10h14M3 14h14',
  info: 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM10 9v4.5M10 6.5v.3',
  printer: 'M6 8V3h8v5M6 14H4V8h12v6h-2M6 12h8v5H6z',
}

export function Icon({ name, size = 20, className = '', strokeWidth = 1.6, title }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      <path d={PATHS[name] ?? PATHS.info} />
    </svg>
  )
}
