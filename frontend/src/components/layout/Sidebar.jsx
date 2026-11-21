import { NavLink } from 'react-router'
import { useT } from '../../i18n/index.js'
import { Icon } from '../ui/Icon.jsx'
import { Logo } from '../ui/Logo.jsx'
import { NAV } from './nav.js'

export { Logo }

export function Sidebar({ status, onNavigate }) {
  const { t } = useT()
  return (
    <nav className="flex h-full flex-col border-r border-line bg-white text-muted" aria-label={t('app.panel')}>
      <div className="px-5 pt-5 pb-6 text-ink">
        <Logo />
        <p className="mt-0.5 pl-10 text-[12px] text-dim">{t('app.panel')}</p>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {NAV.map((section) => (
          <div key={section.group}>
            <p className="mb-1.5 px-3 text-[11px] font-medium tracking-[0.06em] text-dim uppercase">{t(`nav.${section.group}`)}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.key}>
                  {item.disabled ? (
                    <span className="flex items-center gap-3 rounded-[10px] px-3 py-2 text-dim/70" aria-disabled>
                      <Icon name={item.icon} size={18} />
                      <span className="flex-1">{t(`nav.${item.key}`)}</span>
                      <span className="rounded-md bg-mist px-1.5 text-[11px] font-medium">{t('nav.stage2')}</span>
                    </span>
                  ) : (
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 rounded-[10px] px-3 py-2 font-medium transition-colors ${
                          isActive ? 'bg-tint text-brand shadow-[inset_0_0_0_1px_rgb(79_70_229/0.12)]' : 'hover:bg-mist hover:text-ink'
                        }`
                      }
                    >
                      <Icon name={item.icon} size={18} className="transition-transform duration-200 group-hover:scale-110" />
                      <span className="flex-1 transition-transform duration-200 group-hover:translate-x-0.5">{t(`nav.${item.key}`)}</span>
                      {item.badge === 'exceptions' && status?.openExceptions > 0 && (
                        <span className="num min-w-5 rounded-full bg-late px-1.5 text-center text-[12px] leading-5 font-semibold text-white">
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
