import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { PageHeader } from '../components/ui/Card.jsx'
import { Select } from '../components/ui/Field.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { Segmented } from '../components/ui/Segmented.jsx'
import { Empty, QueryState } from '../components/ui/States.jsx'
import { useT } from '../i18n/index.js'
import { api } from '../lib/api.js'
import { formatDuration, formatMoney } from '../lib/format.js'
import { localTime } from '../lib/time.js'
import { useAction } from '../lib/useAction.js'
import { useNow } from '../lib/useNow.js'

const ICONS = { task_late: 'clock', batch_low: 'pot', cancel_request: 'x', booking_late: 'bookings', promise_broken: 'info' }

export function ExceptionsPage() {
  const { t } = useT()
  const [status, setStatus] = useState('open')
  const query = useQuery({
    queryKey: ['exceptions', status],
    queryFn: () => api.get(`/exceptions?status=${status}`),
    refetchInterval: 5_000,
  })
  const waiters = useQuery({ queryKey: ['hall'], queryFn: () => api.get('/hall'), select: (hall) => hall.waiters.filter((w) => w.onShift) })

  return (
    <>
      <PageHeader
        title={t('exceptions.title')}
        subtitle={t('exceptions.subtitle')}
        actions={
          <Segmented
            label={t('exceptions.title')}
            value={status}
            onChange={setStatus}
            options={[
              { value: 'open', label: t('exceptions.open'), count: query.data?.counts.open },
              { value: 'resolved', label: t('exceptions.resolved'), count: query.data?.counts.resolvedToday },
            ]}
          />
        }
      />
      <QueryState query={query} rows={3}>
        {(data) =>
          data.items.length ? (
            <ul className="grid gap-4 xl:grid-cols-2">
              {data.items.map((item) => (
                <ExceptionCard key={item.id} item={item} waiters={waiters.data ?? []} fetchedAt={query.dataUpdatedAt} />
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-line bg-white">
              <Empty title={status === 'open' ? t('exceptions.empty') : t('exceptions.emptyResolved')} />
            </div>
          )
        }
      </QueryState>
    </>
  )
}

function ExceptionCard({ item, waiters, fetchedAt }) {
  const { t, lang } = useT()
  const now = useNow()
  const p = item.payload
  const [waiterId, setWaiterId] = useState(p.suggestedWaiterId ? String(p.suggestedWaiterId) : '')
  const resolve = useAction((body) => api.post(`/exceptions/${item.id}/resolve`, body), {
    invalidate: ['exceptions', 'hall', 'today', 'menu', 'bookings'],
    success: t('exceptions.done'),
  })
  const reopen = useAction(() => api.post(`/exceptions/${item.id}/reopen`), {
    invalidate: ['exceptions', 'hall', 'today', 'menu', 'bookings'],
    success: t('exceptions.reopened'),
  })

  const table = item.table ? t('common.table', { n: item.table.number }) : ''
  const itemName = item.menuItem ? (lang === 'ru' ? item.menuItem.nameRu : item.menuItem.nameUz) : ''
  const open = item.status === 'open'
  const liveWait = item.task && !item.task.done ? item.task.waitSeconds + Math.max(0, now - fetchedAt) / 1000 : item.task?.waitSeconds

  const values = {
    table,
    task: p.taskType ? t(`task.${p.taskType}`) : '',
    item: itemName,
    n: p.stock ?? p.guests ?? p.qty ?? '',
    waiter: p.waiterName ?? item.task?.waiterName ?? '—',
    wait: formatDuration(liveWait),
    sla: formatDuration(p.slaSeconds),
    min: p.cookMinutes ?? '',
    reason: p.reason ? t(`exceptions.reasons.${p.reason}`) : '—',
    status: p.itemStatus ? t(`itemStatus.${p.itemStatus}`).toLowerCase() : '—',
    amount: formatMoney(p.amount ?? p.discount, lang),
    name: p.guestName ?? '',
    time: p.startsAt ? localTime(p.startsAt) : '',
    p: p.percent ?? '',
  }
  const level = item.type === 'task_late' ? (p.level === 'owner' ? 'late' : 'warn') : item.type === 'promise_broken' ? 'late' : item.type === 'batch_low' ? 'warn' : 'brand'
  const tone = open ? level : 'neutral'
  const accent = { late: 'border-l-late', warn: 'border-l-warn', brand: 'border-l-brand', neutral: 'border-l-pale' }[tone]

  return (
    <li className={`rounded-xl border border-l-4 border-line bg-white p-5 ${accent}`}>
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${open ? 'bg-mist text-ink' : 'bg-mist text-muted'}`}>
          <Icon name={ICONS[item.type]} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={tone === 'brand' ? 'brand' : tone}>{t(`exceptions.typeNames.${item.type}`)}</Badge>
            {p.level === 'owner' && open && <Badge tone="late">{t('exceptions.ownerLevel')}</Badge>}
            <span className="text-[12px] text-muted">
              {localTime(item.createdAt)} · {t('exceptions.waitingFor', { t: formatDuration((now - item.createdAt) / 1000) })}
            </span>
          </div>
          <h2 className="mt-1.5 text-[16px] leading-snug font-bold">{t(`exceptions.titles.${item.type}`, values)}</h2>
          <p className="mt-1 text-[14px] text-muted">{t(`exceptions.bodies.${item.type}`, values)}</p>

          {open && item.actions.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {item.actions.map((action, index) => {
                if (action === 'reassign') {
                  return (
                    <div key={action} className="flex w-full flex-wrap gap-2 sm:w-auto">
                      <Select aria-label={t('hall.chooseWaiter')} className="h-9 sm:w-72" value={waiterId} onChange={(e) => setWaiterId(e.target.value)}>
                        <option value="">{t('hall.chooseWaiter')}</option>
                        {waiters
                          .filter((w) => w.id !== p.waiterId)
                          .map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name} ({t('hall.openTasks', { n: w.openTasks })})
                            </option>
                          ))}
                      </Select>
                      <Button
                        variant="primary"
                        disabled={!waiterId}
                        loading={resolve.isPending && resolve.variables?.action === action}
                        onClick={() => resolve.mutate({ action, waiterId: Number(waiterId) })}
                      >
                        {t(`exceptions.actions.${action}`)}
                      </Button>
                    </div>
                  )
                }
                return (
                  <Button
                    key={action}
                    variant={index === 0 ? (action === 'approve' ? 'dangerSolid' : 'primary') : 'secondary'}
                    loading={resolve.isPending && resolve.variables?.action === action}
                    disabled={resolve.isPending}
                    onClick={() => resolve.mutate({ action })}
                  >
                    {t(`exceptions.actions.${action}`)}
                  </Button>
                )
              })}
            </div>
          )}

          {!open && item.resolution && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-mist px-3 py-2">
              <p className="text-[13px]">
                <span className="font-semibold text-ok-ink">
                  <Icon name="check" size={16} className="mr-1 inline" />
                  {t(`exceptions.decisions.${item.resolution.action}`, { name: item.resolution.waiterName ?? '' })}
                </span>
                <span className="text-muted">
                  {' · '}
                  {t('exceptions.resolvedBy', { name: item.resolvedBy?.name ?? t('common.system'), time: localTime(item.resolvedAt) })}
                </span>
              </p>
              {item.canReopen && (
                <Button size="sm" variant="ghost" icon="undo" loading={reopen.isPending} onClick={() => reopen.mutate()}>
                  {t('exceptions.reopen')}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
