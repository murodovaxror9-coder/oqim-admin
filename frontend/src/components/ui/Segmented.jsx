// Tugmali tanlov (tablar, davr tanlash)
export function Segmented({ options, value, onChange, label, size = 'md' }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-xl bg-sunken p-1">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`flex items-center gap-2 rounded-lg font-medium transition-all ${size === 'sm' ? 'h-7 px-2.5 text-[13px]' : 'h-8 px-3.5 text-sm'} ${
              active ? 'bg-surface text-ink shadow-[0_1px_3px_rgb(16_16_24/0.1)]' : 'text-muted hover:text-ink'
            }`}
          >
            {option.label}
            {option.count != null && (
              <span className={`num rounded-full px-1.5 text-[12px] ${active ? 'bg-tint text-brand' : 'bg-surface/70'}`}>{option.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
