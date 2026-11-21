import { Icon } from './Icon.jsx'

const VARIANTS = {
  primary: 'bg-brand text-white hover:bg-brand-dark disabled:bg-dim',
  secondary: 'bg-white text-ink border border-rule hover:border-dim hover:bg-mist disabled:text-dim',
  ghost: 'text-muted hover:bg-tint hover:text-brand disabled:text-dim',
  danger: 'bg-white text-late-ink border border-late/30 hover:bg-late-bg disabled:text-dim',
  dangerSolid: 'bg-late text-white hover:bg-late-ink disabled:bg-dim',
}

const SIZES = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  icon: 'h-9 w-9 justify-center rounded-lg',
}

export function Button({ variant = 'secondary', size = 'md', icon, loading, children, className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center font-semibold whitespace-nowrap transition-colors ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
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
