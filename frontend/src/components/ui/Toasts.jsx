import { useToasts } from '../../store/toast.js'
import { Icon } from './Icon.jsx'

export function Toasts() {
  const { items, dismiss } = useToasts()
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(380px,calc(100%-32px))] flex-col gap-2" aria-live="polite">
      {items.map((item) => (
        <div
          key={item.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
            item.tone === 'error' ? 'bg-late text-white' : 'bg-navy text-white'
          }`}
        >
          <Icon name={item.tone === 'error' ? 'exceptions' : 'check'} size={18} className="mt-0.5" />
          <span className="flex-1">{item.message}</span>
          <button type="button" onClick={() => dismiss(item.id)} className="opacity-70 hover:opacity-100" aria-label="×">
            <Icon name="x" size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
