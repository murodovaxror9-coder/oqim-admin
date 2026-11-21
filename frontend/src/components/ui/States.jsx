import { errorText, useT } from '../../i18n/index.js'
import { Button } from './Button.jsx'
import { Icon } from './Icon.jsx'

export function Loader({ rows = 3, className = '' }) {
  const { t } = useT()
  return (
    <div className={`space-y-3 ${className}`} role="status" aria-label={t('common.loading')}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-white/70" />
      ))}
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  const { t } = useT()
  return (
    <div className="rounded-xl border border-late/20 bg-late-bg/60 p-6 text-late-ink" role="alert">
      <div className="flex items-start gap-3">
        <Icon name="exceptions" />
        <div>
          <p className="font-semibold">{t('common.loadError')}</p>
          <p className="mt-1 text-[13px]">{errorText(t, error)}</p>
          {onRetry && (
            <Button size="sm" className="mt-3" onClick={onRetry}>
              {t('common.retry')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function Empty({ icon = 'check', title, children }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-tint text-brand">
        <Icon name={icon} />
      </span>
      <p className="max-w-sm font-semibold text-ink">{title}</p>
      {children && <div className="mt-2 max-w-sm text-[13px] text-muted">{children}</div>}
    </div>
  )
}

// So'rov holati: yuklanmoqda / xato / tayyor
export function QueryState({ query, rows, children }) {
  if (query.isPending) return <Loader rows={rows} />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  return children(query.data)
}
