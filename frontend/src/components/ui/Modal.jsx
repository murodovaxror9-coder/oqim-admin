import { useEffect, useRef } from 'react'
import { useT } from '../../i18n/index.js'
import { Button } from './Button.jsx'
import { Icon } from './Icon.jsx'

// <dialog> asosida: fokus ichida qoladi, Esc yopadi
export function Modal({ open, onClose, title, children, footer, width = 'max-w-lg' }) {
  const ref = useRef(null)
  const { t } = useT()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => event.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-32px)] ${width} rounded-2xl border border-line bg-white p-0 text-ink shadow-2xl backdrop:bg-navy/45`}
    >
      {open && (
        <div className="flex max-h-[calc(100vh-48px)] flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
            <h2 className="text-lg font-bold">{title}</h2>
            <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-mist hover:text-ink" aria-label={t('common.close')}>
              <Icon name="x" />
            </button>
          </header>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line bg-mist/60 px-6 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}

export function ConfirmDialog({ open, title, text, confirmLabel, danger, loading, onConfirm, onClose }) {
  const { t } = useT()
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-md"
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant={danger ? 'dangerSolid' : 'primary'} loading={loading} onClick={onConfirm}>
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </>
      }
    >
      <p className="text-muted">{text}</p>
    </Modal>
  )
}
