// Tugmali tanlov (tablar, davr tanlash)
export function Segmented({ options, value, onChange, label, size = 'md' }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-lg border border-rule bg-white p-1">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`flex items-center gap-2 rounded-md font-semibold transition-colors ${size === 'sm' ? 'h-7 px-2.5 text-[13px]' : 'h-8 px-3.5 text-sm'} ${
              active ? 'bg-navy text-white' : 'text-muted hover:bg-mist hover:text-ink'
            }`}
          >
            {option.label}
            {option.count != null && (
              <span className={`num rounded-full px-1.5 text-[13px] ${active ? 'bg-white/15' : 'bg-mist'}`}>{option.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
