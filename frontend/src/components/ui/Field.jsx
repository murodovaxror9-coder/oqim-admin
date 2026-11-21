import { useId } from 'react'

export function Field({ label, hint, error, children, className = '' }) {
  const id = useId()
  const child = typeof children === 'function' ? children({ id, invalid: Boolean(error) }) : children
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-ink">
          {label}
        </label>
      )}
      {child}
      {error ? (
        <p className="mt-1 text-[12px] font-medium text-late-ink">{error}</p>
      ) : (
        hint && <p className="mt-1 text-[12px] text-muted">{hint}</p>
      )}
    </div>
  )
}

export function Input({ id, invalid, className = '', ...props }) {
  return <input id={id} aria-invalid={invalid || undefined} className={`field ${className}`} {...props} />
}

export function Select({ id, invalid, className = '', children, ...props }) {
  return (
    <select id={id} aria-invalid={invalid || undefined} className={`field pr-8 ${className}`} {...props}>
      {children}
    </select>
  )
}

export function Textarea({ id, invalid, className = '', ...props }) {
  return <textarea id={id} aria-invalid={invalid || undefined} className={`field h-auto py-2 ${className}`} rows={3} {...props} />
}

export function Toggle({ checked, onChange, label, disabled, description }) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-pale'}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
      {(label || description) && (
        <span>
          {label && <span className="block font-semibold text-ink">{label}</span>}
          {description && <span className="block text-[13px] text-muted">{description}</span>}
        </span>
      )}
    </label>
  )
}
