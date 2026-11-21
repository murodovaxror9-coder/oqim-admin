import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useT } from '../../i18n/index.js'
import { localTime } from '../../lib/time.js'
import { useNow } from '../../lib/useNow.js'
import { useAuth } from '../../store/auth.js'
import { useLang } from '../../store/lang.js'
import { Icon } from '../ui/Icon.jsx'

function Chip({ tone, icon, children, to }) {
  const tones = {
    late: 'bg-late-bg text-late-ink',
    warn: 'bg-warn-bg text-warn-ink',
    ok: 'bg-ok-bg text-ok-ink',
    neutral: 'bg-mist text-muted',
    brand: 'bg-tint text-brand',
  }
  const className = `inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium whitespace-nowrap ring-1 ring-current/10 ring-inset ${tones[tone]}`
  const content = (
    <>
      <Icon name={icon} size={16} />
      {children}
    </>
  )
  return to ? (
    <Link to={to} className={`${className} hover:brightness-95`}>
      {content}
    </Link>
  ) : (
    <span className={className}>{content}</span>
  )
}

export function Topbar({ status, onMenu }) {
  const { t } = useT()
  const now = useNow(15000)
  const { lang, setLang } = useLang()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (event) => !menuRef.current?.contains(event.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white/80 px-4 backdrop-blur-xl backdrop-saturate-150 lg:px-8">
      <button type="button" onClick={onMenu} className="rounded-lg p-2 text-muted hover:bg-mist lg:hidden" aria-label={t('nav.openMenu')}>
        <Icon name="menuBars" />
      </button>
      <div className="min-w-0">
        <p className="truncate font-semibold tracking-[-0.01em] text-ink">{status?.restaurant ?? '…'}</p>
        <p className="truncate text-[12px] text-muted">
          {status?.branch} · <span className="num text-[14px]">{localTime(now)}</span>
        </p>
      </div>

      <div className="ml-auto hidden flex-wrap items-center justify-end gap-2 md:flex">
        {status &&
          (status.lateTasks > 0 ? (
            <Chip tone="late" icon="clock" to="/hall">
              {t('topbar.late', { n: status.lateTasks })}
            </Chip>
          ) : (
            <Chip tone="ok" icon="check">
              {t('topbar.calm')}
            </Chip>
          ))}
        {status?.openExceptions > 0 && (
          <Chip tone="warn" icon="exceptions" to="/exceptions">
            {t('topbar.exceptions', { n: status.openExceptions })}
          </Chip>
        )}
        {status && !status.fiscal.connected && (
          <Chip tone="neutral" icon="info" to="/settings">
            {t('topbar.fiscalOff')}
          </Chip>
        )}
        {status?.printers.offline > 0 && (
          <Chip tone="warn" icon="printer" to="/settings">
            {t('topbar.printersOff', { n: status.printers.offline })}
          </Chip>
        )}
        {status?.demoMode && (
          <Chip tone="brand" icon="info">
            {t('topbar.demo')}
          </Chip>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2 md:ml-2">
        <div className="flex rounded-[10px] bg-[#ededf0] p-0.5" role="group" aria-label={t('topbar.language')}>
          {['uz', 'ru'].map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              aria-pressed={lang === code}
              className={`h-7 rounded-lg px-2.5 text-[12px] font-semibold uppercase transition-all ${lang === code ? 'bg-white text-ink shadow-[0_1px_3px_rgb(16_16_24/0.1)]' : 'text-muted hover:text-ink'}`}
            >
              {code}
            </button>
          ))}
        </div>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex items-center gap-2 rounded-lg py-1 pr-2 pl-1 hover:bg-mist"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-indigo-400 to-brand text-[12px] font-semibold text-white">
              {user?.name?.split(' ').map((part) => part[0]).join('').slice(0, 2)}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-[13px] leading-tight font-semibold">{user?.name}</span>
              <span className="block text-[12px] leading-tight text-muted">{t(`roles.${user?.role}`)}</span>
            </span>
            <Icon name="down" size={16} className="text-muted" />
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl border border-line bg-white p-1 shadow-pop">
              <button
                type="button"
                onClick={() => {
                  logout()
                  navigate('/login')
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold text-late-ink hover:bg-late-bg"
              >
                <Icon name="logout" size={18} />
                {t('topbar.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
