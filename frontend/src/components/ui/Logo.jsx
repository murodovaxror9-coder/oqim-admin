import { useId } from 'react'

// Oqim belgisi: gradient kvadrat ichida uzilgan "O" halqa — oqim yo'nalishi va harakatdagi nuqta
export function LogoMark({ size = 32, animated = false, className = '' }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#818cf8" />
          <stop offset="0.55" stopColor="#6366f1" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id={`${id}-gloss`} x1="20" y1="0" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill={`url(#${id}-bg)`} />
      <rect x="1" y="1" width="38" height="20" rx="11" fill={`url(#${id}-gloss)`} />
      <path d="M27.8 13.2A10 10 0 1 0 30 20" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <path d="M24.5 17.4A4.6 4.6 0 1 0 24.6 20" fill="none" stroke="#c7d2fe" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="30" cy="20" r="2.9" fill="#fde68a">
        {animated && <animate attributeName="r" values="2.9;3.6;2.9" dur="2.4s" repeatCount="indefinite" />}
      </circle>
    </svg>
  )
}

export function Logo({ className = '', size = 32 }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className="text-[19px] font-semibold tracking-[-0.035em]">Oqim</span>
    </span>
  )
}
