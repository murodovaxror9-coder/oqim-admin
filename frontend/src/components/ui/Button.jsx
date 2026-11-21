import { Icon } from './Icon.jsx'

const VARIANTS = {
  primary:
    'bg-brand text-white shadow-[0_1px_2px_rgb(16_16_24/0.12),inset_0_1px_0_rgb(255_255_255/0.12)] hover:bg-brand-dark hover:shadow-glow disabled:bg-pale disabled:shadow-none',
  secondary: 'bg-surface text-ink border border-rule shadow-[0_1px_2px_rgb(16_16_24/0.05)] hover:bg-mist hover:border-pale disabled:text-dim',
  ghost: 'text-muted hover:bg-mist hover:text-ink disabled:text-dim',
  danger: 'bg-surface text-late-ink border border-late/25 shadow-[0_1px_2px_rgb(16_16_24/0.05)] hover:bg-late-bg disabled:text-dim',
  dangerSolid: 'bg-late text-white shadow-[0_1px_2px_rgb(16_16_24/0.12)] hover:bg-late-ink hover:shadow-[0_8px_24px_-6px_rgb(229_72_77/0.5)] disabled:bg-pale',
}

const SIZES = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-[10px]',
  icon: 'h-9 w-9 justify-center rounded-[10px]',
}

export function Button({ variant = 'secondary', size = 'md', icon, loading, children, className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center font-medium whitespace-nowrap transition-all duration-200 hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      ) : (
        icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />
      )}
      {children}
    </button>
  )
}
