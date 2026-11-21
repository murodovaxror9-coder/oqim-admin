import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Card, PageHeader } from '../components/ui/Card.jsx'
import { Field, Input, Toggle } from '../components/ui/Field.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { QueryState } from '../components/ui/States.jsx'
import { errorText, useT } from '../i18n/index.js'
import { api } from '../lib/api.js'
import { formatDuration } from '../lib/format.js'
import { useAction } from '../lib/useAction.js'
import { useAuth } from '../store/auth.js'
import { toast } from '../store/toast.js'

const TASKS = ['take', 'deliver', 'call', 'bill', 'clean']
const PAYMENTS = ['cash', 'card', 'qr', 'click', 'payme', 'uzum', 'nfc']

// Brauzerda ham xuddi backenddagi formula: ko'rsatish uchun
const promiseSeconds = (prep, promise) => Math.ceil((prep * 60 * promise.coefficient + promise.extraMinutes * 60) / promise.roundSeconds) * promise.roundSeconds

export function SettingsPage() {
  const { t } = useT()
  const query = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/settings') })
  return (
    <>
      <PageHeader title={t('settings.title')} />
      <QueryState query={query} rows={5}>
        {(data) => <SettingsForm key={JSON.stringify(data)} initial={data} />}
      </QueryState>
    </>
  )
}

function SettingsForm({ initial }) {
  const { t } = useT()
  const isOwner = useAuth((s) => s.user?.role === 'owner')
  const [form, setForm] = useState(initial)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)

  // Ichki maydonni yo'l bo'yicha yangilash: update('tasks.take.seconds', 180)
  const update = (path, value) =>
    setForm((current) => {
      const next = structuredClone(current)
      const keys = path.split('.')
      let node = next
      for (const key of keys.slice(0, -1)) node = node[key]
      node[keys[keys.length - 1]] = value
      return next
    })
  const numberInput = (path, props = {}) => {
    const value = path.split('.').reduce((node, key) => node[key], form)
    return (p) => (
      <Input
        {...p}
        type="number"
        className="num text-[16px]"
        value={value}
        onChange={(e) => update(path, e.target.value === '' ? '' : Number(e.target.value))}
        {...props}
      />
    )
  }

  const save = useAction((body) => api.put('/settings', body), { invalidate: ['settings', 'hall', 'today'], success: t('settings.saved') })
  const test = useAction((id) => api.post(`/settings/printers/${id}/test`), {
    onSuccess: (data) => toast(t(data.ok ? 'settings.printerOk' : 'settings.printerFail', { name: t(`settings.printer.${data.printer}`) }), data.ok ? 'ok' : 'error'),
  })

  const numbers = [
    ...TASKS.flatMap((task) => [form.tasks[task].seconds, form.tasks[task].weight]),
    form.warnPercent,
    ...Object.values(form.escalation),
    ...Object.values(form.promise),
    form.compensation.promiseDiscountPercent,
    form.compensation.serviceChargePercent,
    form.targets.orderToServeSeconds,
  ]
  const hasEmpty = numbers.some((value) => value === '' || Number.isNaN(value))
  const example = form.promise.coefficient !== '' ? promiseSeconds(14, form.promise) : null

  return (
    <div className="pb-24">
      {!isOwner && (
        <p className="mb-6 flex items-center gap-2 rounded-xl bg-tint px-4 py-3 font-medium text-brand">
          <Icon name="lock" size={18} />
          {t('settings.ownerOnly')}
        </p>
      )}
      <fieldset disabled={!isOwner} className="grid gap-6 xl:grid-cols-2">
        <Card title={t('settings.restaurant')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('settings.restaurantName')}>{(p) => <Input {...p} value={form.restaurant.name} onChange={(e) => update('restaurant.name', e.target.value)} />}</Field>
            <Field label={t('settings.branchName')}>{(p) => <Input {...p} value={form.branch.name} onChange={(e) => update('branch.name', e.target.value)} />}</Field>
            <Field label={t('settings.address')} className="sm:col-span-2">
              {(p) => <Input {...p} value={form.branch.address} onChange={(e) => update('branch.address', e.target.value)} />}
            </Field>
            <Field label={t('settings.opens')}>{(p) => <Input {...p} type="time" value={form.branch.opensAt} onChange={(e) => update('branch.opensAt', e.target.value)} />}</Field>
            <Field label={t('settings.closes')}>{(p) => <Input {...p} type="time" value={form.branch.closesAt} onChange={(e) => update('branch.closesAt', e.target.value)} />}</Field>
          </div>
        </Card>

        <Card title={t('settings.tasks')} subtitle={t('settings.tasksHint', { p: form.warnPercent })}>
          <table className="w-full">
            <thead className="text-left text-[12px] text-muted">
              <tr>
                <th className="pb-2 font-semibold">{t('settings.colTask')}</th>
                <th className="pb-2 font-semibold">{t('settings.colSeconds')}</th>
                <th className="pb-2 font-semibold">{t('settings.colWeight')}</th>
              </tr>
            </thead>
            <tbody>
              {TASKS.map((task) => (
                <tr key={task} className="border-t border-line">
                  <td className="py-2 pr-3 font-semibold">{t(`task.${task}`)}</td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="15"
                        max="3600"
                        step="5"
                        aria-label={`${t(`task.${task}`)}: ${t('settings.colSeconds')}`}
                        className="num h-9 w-24 text-[16px]"
                        value={form.tasks[task].seconds}
                        onChange={(e) => update(`tasks.${task}.seconds`, e.target.value === '' ? '' : Number(e.target.value))}
                      />
                      <span className="num text-[14px] text-muted">{formatDuration(form.tasks[task].seconds || 0)}</span>
                    </div>
                  </td>
                  <td className="py-2">
                    <Input
                      type="number"
                      min="0.1"
                      max="5"
                      step="0.1"
                      aria-label={`${t(`task.${task}`)}: ${t('settings.colWeight')}`}
                      className="num h-9 w-20 text-[16px]"
                      value={form.tasks[task].weight}
                      onChange={(e) => update(`tasks.${task}.weight`, e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[12px] text-muted">{t('settings.weightHint')}</p>
        </Card>

        <Card title={t('settings.escalation')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('settings.warnPercent')}>{numberInput('warnPercent', { min: 30, max: 95 })}</Field>
            <Field label={t('settings.ownerMultiplier')}>{numberInput('escalation.ownerMultiplier', { min: 1.2, max: 5, step: 0.1 })}</Field>
            <Field label={t('settings.helpMaxOpen')}>{numberInput('escalation.helpMaxOpen', { min: 1, max: 10 })}</Field>
            <Field label={t('settings.helpMinDiff')}>{numberInput('escalation.helpMinDiff', { min: 1, max: 10 })}</Field>
          </div>
          <p className="mt-4 rounded-lg bg-mist px-3 py-2 text-[13px] text-muted">
            {t('settings.helpHint', { max: form.escalation.helpMaxOpen, diff: form.escalation.helpMinDiff })}
          </p>
        </Card>

        <Card title={t('settings.promise')} subtitle={t('settings.promiseHint')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('settings.coefficient')}>{numberInput('promise.coefficient', { min: 1, max: 3, step: 0.05 })}</Field>
            <Field label={t('settings.extraMinutes')}>{numberInput('promise.extraMinutes', { min: 0, max: 30 })}</Field>
            <Field label={t('settings.roundSeconds')}>{numberInput('promise.roundSeconds', { min: 10, max: 300, step: 10 })}</Field>
            <Field label={t('settings.warnBefore')}>{numberInput('promise.warnBeforeSeconds', { min: 0, max: 600, step: 10 })}</Field>
          </div>
          {example != null && !Number.isNaN(example) && (
            <p className="mt-4 rounded-lg bg-tint px-3 py-2 text-[13px] font-medium text-brand">
              {t('settings.example', { prep: 14, promise: formatDuration(example) })}
            </p>
          )}
        </Card>

        <Card title={t('settings.compensation')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('settings.discount')}>{numberInput('compensation.promiseDiscountPercent', { min: 0, max: 50 })}</Field>
            <Field label={t('settings.service')}>{numberInput('compensation.serviceChargePercent', { min: 0, max: 30 })}</Field>
            <div className="sm:col-span-2">
              <Toggle
                checked={form.compensation.serviceChargeOnTakeaway}
                onChange={(v) => update('compensation.serviceChargeOnTakeaway', v)}
                label={t('settings.serviceTakeaway')}
                disabled={!isOwner}
              />
            </div>
            <Field label={`${t('settings.targets')}: ${t('settings.serveTarget')}`} className="sm:col-span-2">
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  min="1"
                  max="120"
                  className="num w-32 text-[16px]"
                  value={form.targets.orderToServeSeconds === '' ? '' : Math.round(form.targets.orderToServeSeconds / 60)}
                  onChange={(e) => update('targets.orderToServeSeconds', e.target.value === '' ? '' : Number(e.target.value) * 60)}
                />
              )}
            </Field>
          </div>
        </Card>

        <Card title={t('settings.payments')}>
          <div className="grid gap-3 sm:grid-cols-2">
            {PAYMENTS.map((method) => (
              <Toggle key={method} checked={form.payments[method]} onChange={(v) => update(`payments.${method}`, v)} label={t(`payment.${method}`)} disabled={!isOwner} />
            ))}
          </div>
        </Card>

        <Card title={t('settings.fiscal')}>
          <div className="flex items-start gap-3">
            <Badge tone={form.fiscal.provider ? 'ok' : 'neutral'}>{form.fiscal.provider ?? t('settings.fiscalNone')}</Badge>
          </div>
          <p className="mt-3 text-[13px] text-muted">{t('settings.fiscalHint')}</p>
        </Card>

      </fieldset>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title={t('settings.printers')} bodyClassName="p-0">
          <ul>
            {form.printers.map((printer) => (
              <li key={printer.id} className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-0">
                <Icon name="printer" className="text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t(`settings.printer.${printer.id}`)}</span>
                  <span className="block text-[12px] text-muted">{printer.connection}</span>
                </span>
                <Badge tone={printer.connected ? 'ok' : 'late'} dot>
                  {printer.connected ? t('settings.connected') : t('settings.disconnected')}
                </Badge>
                <Button size="sm" loading={test.isPending && test.variables === printer.id} onClick={() => test.mutate(printer.id)}>
                  {t('settings.printerTest')}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {isOwner && dirty && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur lg:right-2 lg:bottom-2 lg:left-[265px] lg:rounded-b-[20px]">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-4 py-3 lg:px-8">
            <span className="flex items-center gap-2 font-semibold text-warn-ink">
              <Icon name="info" size={18} />
              {t('settings.unsaved')}
            </span>
            {save.isError && <span className="text-[13px] text-late-ink">{errorText(t, save.error)}</span>}
            <div className="ml-auto flex gap-2">
              <Button onClick={() => setForm(initial)}>{t('settings.reset')}</Button>
              <Button variant="primary" loading={save.isPending} disabled={Boolean(hasEmpty)} onClick={() => save.mutate(form)}>
                {t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
