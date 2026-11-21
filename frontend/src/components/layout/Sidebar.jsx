import { NavLink } from 'react-router'
import { useT } from '../../i18n/index.js'
import { Icon } from '../ui/Icon.jsx'
import { NAV } from './nav.js'

export function Logo({ className = '' }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#1e4fc2" />
        <path d="M7 19c3-5 6-5 9 0s6 5 9 0" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        <path d="M7 13c3-5 6-5 9 0s6 5 9 0" fill="none" stroke="#8fb0ff" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="text-[19px] font-extrabold tracking-[-0.02em]">Oqim</span>
    </span>
  )
}

export function Sidebar({ status, onNavigate }) {
  const { t } = useT()
  return (
    <nav className="flex h-full flex-col bg-navy text-pale" aria-label={t('app.panel')}>
      <div className="px-5 pt-5 pb-6 text-white">
        <Logo />
        <p className="mt-1 pl-10 text-[12px] text-dim">{t('app.panel')}</p>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {NAV.map((section) => (
          <div key={section.group}>
            <p className="mb-1.5 px-3 text-[12px] font-semibold text-dim/80">{t(`nav.${section.group}`)}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.key}>
                  {item.disabled ? (
                    <span className="flex items-center gap-3 rounded-lg px-3 py-2 text-dim/50" aria-disabled>
                      <Icon name={item.icon} />
                      <span className="flex-1">{t(`nav.${item.key}`)}</span>
                      <span className="rounded border border-track px-1.5 text-[11px]">{t('nav.stage2')}</span>
                    </span>
                  ) : (
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2 font-semibold transition-colors ${
                          isActive ? 'bg-brand text-white' : 'hover:bg-deep hover:text-white'
                        }`
                      }
                    >
                      <Icon name={item.icon} />
                      <span className="flex-1">{t(`nav.${item.key}`)}</span>
                      {item.badge === 'exceptions' && status?.openExceptions > 0 && (
                        <span className="num min-w-6 rounded-full bg-late px-1.5 text-center text-[14px] leading-5 text-white">
                          {status.openExceptions}
                        </span>
                      )}
                    </NavLink>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}
