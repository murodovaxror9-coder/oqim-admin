import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useT } from '../../i18n/index.js'
import { useAuth } from '../../store/auth.js'
import { useLang } from '../../store/lang.js'
import { useTheme } from '../../store/theme.js'
import { Icon } from '../ui/Icon.jsx'
import { NAV } from './nav.js'

// Ctrl+K / Cmd+K: sahifa va amallarni klaviatura bilan tez topish
export function CommandPalette({ open, onClose }) {
  const { t } = useT()
  const navigate = useNavigate()
  const { lang, setLang } = useLang()
  const { theme, toggle } = useTheme()
  const logout = useAuth((s) => s.logout)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const items = useMemo(() => {
    const pages = NAV.flatMap((section) => section.items)
      .filter((item) => !item.disabled)
      .map((item) => ({ id: item.key, group: 'pages', icon: item.icon, label: t(`nav.${item.key}`), run: () => navigate(item.to) }))
    const actions = [
      { id: 'theme', group: 'actions', icon: theme === 'dark' ? 'sun' : 'moon', label: t(theme === 'dark' ? 'palette.themeLight' : 'palette.themeDark'), run: toggle },
      { id: 'lang', group: 'actions', icon: 'globe', label: t(lang === 'uz' ? 'palette.langRu' : 'palette.langUz'), run: () => setLang(lang === 'uz' ? 'ru' : 'uz') },
      {
        id: 'logout',
        group: 'actions',
        icon: 'logout',
        label: t('palette.logout'),
        run: () => {
          logout()
          navigate('/login')
        },
      },
    ]
    const q = query.trim().toLowerCase()
    return [...pages, ...actions].filter((item) => !q || item.label.toLowerCase().includes(q))
  }, [query, t, theme, lang, navigate, toggle, setLang, logout])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => setActive(0), [query])

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  function run(item) {
    onClose()
    item.run()
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => Math.min(i + 1, items.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter' && items[active]) {
      event.preventDefault()
      run(items[active])
    } else if (event.key === 'Escape') {
      onClose()
    }
  }

  let lastGroup = null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label={t('palette.search')}>
      <button type="button" className="animate-[fade-in_0.15s_ease-out] absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-label={t('palette.close')} />
      <div className="animate-[pop-in_0.18s_cubic-bezier(0.22,1,0.36,1)] relative w-full max-w-[560px] overflow-hidden rounded-2xl border border-line bg-surface/95 shadow-pop backdrop-blur-2xl">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Icon name="search" size={18} className="text-dim" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('palette.placeholder')}
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-dim"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
          />
          <kbd className="rounded-md border border-line bg-mist px-1.5 text-[11px] font-medium text-dim">Esc</kbd>
        </div>
        <ul ref={listRef} id="palette-list" role="listbox" className="max-h-[360px] overflow-y-auto p-2">
          {items.length === 0 && <li className="px-3 py-10 text-center text-muted">{t('palette.empty')}</li>}
          {items.map((item, index) => {
            const header = item.group !== lastGroup
            lastGroup = item.group
            const isActive = index === active
            return (
              <li key={item.id} role="presentation">
                {header && <p className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-[0.08em] text-dim uppercase">{t(`palette.${item.group}`)}</p>}
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  data-active={isActive}
                  onMouseMove={() => setActive(index)}
                  onClick={() => run(item)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${isActive ? 'bg-tint text-ink' : 'text-muted'}`}
                >
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-lg border transition-colors ${isActive ? 'border-brand/30 bg-brand text-white shadow-glow' : 'border-line bg-mist'}`}
                  >
                    <Icon name={item.icon} size={16} />
                  </span>
                  <span className="flex-1 font-medium">{item.label}</span>
                  {isActive && <Icon name="enter" size={16} className="text-dim" />}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-[12px] text-dim">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-line bg-mist px-1">↑</kbd>
            <kbd className="rounded border border-line bg-mist px-1">↓</kbd>
            {t('palette.navigate')}
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-line bg-mist px-1">↵</kbd>
            {t('palette.open')}
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <Icon name="command" size={14} />K
          </span>
        </div>
      </div>
    </div>
  )
}
