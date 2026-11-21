import { NavLink } from 'react-router'
import { useT } from '../../i18n/index.js'
import { Icon } from '../ui/Icon.jsx'
import { Logo } from '../ui/Logo.jsx'
import { NAV } from './nav.js'

export { Logo }

export function Sidebar({ status, onNavigate, onSearch }) {
  const { t } = useT()
  return (
    <nav className="flex h-full flex-col bg-mist text-muted" aria-label={t('app.panel')}>
      <div className="px-5 pt-5 pb-5 text-ink">
        <Logo />
        <p className="mt-0.5 pl-[42px] text-[12px] text-dim">{t('app.panel')}</p>
      </div>

      <div className="px-3 pb-4">
        <button
          type="button"
          onClick={onSearch}
          className="group flex h-9 w-full items-center gap-2.5 rounded-[10px] border border-line bg-surface px-3 text-[13px] text-dim shadow-card transition-all hover:border-pale hover:text-muted"
        >
          <Icon name="search" size={16} />
          <span className="flex-1 text-left">{t('palette.search')}</span>
          <kbd className="rounded-md border border-line bg-mist px-1.5 font-sans text-[11px] font-medium">Ctrl K</kbd>
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {NAV.map((section) => (
          <div key={section.group}>
            <p className="mb-1.5 px-3 text-[11px] font-medium tracking-[0.08em] text-dim uppercase">{t(`nav.${section.group}`)}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.key}>
                  {item.disabled ? (
                    <span className="flex items-center gap-3 rounded-[10px] px-3 py-2 text-dim/70" aria-disabled>
                      <Icon name={item.icon} size={18} />
                      <span className="flex-1">{t(`nav.${item.key}`)}</span>
                      <span className="rounded-md border border-line px-1.5 text-[11px] font-medium">{t('nav.stage2')}</span>
                    </span>
                  ) : (
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        `group relative flex items-center gap-3 rounded-[10px] px-3 py-2 font-medium transition-all duration-200 ${
                          isActive
                            ? 'bg-surface text-ink shadow-card ring-1 ring-line'
                            : 'hover:bg-surface/60 hover:text-ink'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute top-1/2 -left-3 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-indigo-400 to-violet-500" aria-hidden />
                          )}
                          <Icon
                            name={item.icon}
                            size={18}
                            className={`transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-brand' : ''}`}
                          />
                          <span className="flex-1 transition-transform duration-200 group-hover:translate-x-0.5">{t(`nav.${item.key}`)}</span>
                          {item.badge === 'exceptions' && status?.openExceptions > 0 && (
                            <span className="num min-w-5 rounded-full bg-late px-1.5 text-center text-[12px] leading-5 font-semibold text-white shadow-[0_0_12px_rgb(229_72_77/0.5)]">
                              {status.openExceptions}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="m-3 rounded-xl border border-line bg-surface p-3 shadow-card">
        <div className="flex items-center gap-2 text-[12px] font-medium text-ink">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
          </span>
          {t('palette.online')}
        </div>
        <p className="mt-0.5 truncate text-[12px] text-dim">{status?.restaurant ?? '…'}</p>
      </div>
    </nav>
  )
}
