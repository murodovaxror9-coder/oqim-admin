import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { FloorMap } from '../components/hall/FloorMap.jsx'
import { Badge, LEVEL_TONE } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Card, PageHeader } from '../components/ui/Card.jsx'
import { Select } from '../components/ui/Field.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { QueryState } from '../components/ui/States.jsx'
import { useT } from '../i18n/index.js'
import { api } from '../lib/api.js'
import { formatDuration, formatMoney } from '../lib/format.js'
import { localTime } from '../lib/time.js'
import { useAction } from '../lib/useAction.js'
import { useNow } from '../lib/useNow.js'

export function HallPage() {
  const { t } = useT()
  const now = useNow()
  const [selectedId, setSelectedId] = useState(null)
  const query = useQuery({ queryKey: ['hall'], queryFn: () => api.get('/hall'), refetchInterval: 5_000 })

  // Server va brauzer soati farqi: taymerlar server vaqti bo'yicha sanaladi
  const skew = query.data ? query.data.serverTime - query.dataUpdatedAt : 0
  const elapsedOf = (task) => Math.max(0, (now + skew - task.createdAt) / 1000)
  const levelOf = (task) => {
    const ratio = elapsedOf(task) / task.slaSeconds
    return ratio > 1 ? 'late' : ratio >= 0.7 ? 'warn' : 'calm'
  }

  return (
    <>
      <PageHeader
        title={t('hall.title')}
        subtitle={query.data && t('hall.summary', { busy: query.data.summary.busy, free: query.data.summary.free, guests: query.data.summary.guests })}
      />
      <QueryState query={query} rows={3}>
        {(hall) => {
          const selected = hall.tables.find((table) => table.id === selectedId)
          return (
            <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
              <div className="space-y-6">
                <Card bodyClassName="p-4">
                  <FloorMap hall={hall} selectedId={selectedId} onSelect={setSelectedId} elapsedOf={elapsedOf} />
                  <Legend />
                </Card>
                {selected ? (
                  <TablePanel table={selected} hall={hall} elapsedOf={elapsedOf} levelOf={levelOf} now={now + skew} onClose={() => setSelectedId(null)} />
                ) : (
                  <p className="rounded-xl border border-dashed border-rule px-5 py-4 text-center text-muted">{t('hall.selectTable')}</p>
                )}
              </div>

              <div className="space-y-6">
                <Card title={t('hall.queue')} subtitle={t('hall.queueHint')} bodyClassName="p-2">
                  {hall.queue.length ? (
                    <ol className="max-h-[520px] overflow-y-auto">
                      {hall.queue.map((task, index) => {
                        const level = levelOf(task)
                        return (
                          <li key={task.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedId(task.tableId)}
                              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-mist ${task.tableId === selectedId ? 'bg-tint' : ''}`}
                            >
                              <span className="num w-5 text-[14px] text-muted">{index + 1}</span>
                              <span className="min-w-0 flex-1">
                                <span className="block font-semibold">
                                  {t('common.table', { n: task.tableNumber })} · {t(`task.${task.type}`)}
                                </span>
                                <span className="block truncate text-[12px] text-muted">
                                  {task.waiter?.name ?? '—'}
                                  {task.helpedFrom && ` · ${t('hall.helpedFrom', { name: task.helpedFrom.name })}`}
                                </span>
                              </span>
                              <Badge tone={LEVEL_TONE[level]}>
                                <span className="num text-[15px]">{formatDuration(elapsedOf(task))}</span>
                              </Badge>
                            </button>
                          </li>
                        )
                      })}
                    </ol>
                  ) : (
                    <p className="px-3 py-6 text-center text-muted">{t('hall.queueEmpty')}</p>
                  )}
                </Card>

                <Card title={t('hall.waiters')} bodyClassName="p-0">
                  <ul>
                    {hall.waiters
                      .filter((w) => w.onShift)
                      .map((waiter) => (
                        <li key={waiter.id} className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-0">
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold">{waiter.name}</span>
                            <span className="block text-[12px] text-muted">{t('hall.tablesOf', { list: waiter.tables.join(', ') || '—' })}</span>
                          </span>
                          {waiter.lateTasks > 0 && (
                            <Badge tone="late">
                              <Icon name="clock" size={14} />
                              <span className="num text-[14px]">{waiter.lateTasks}</span>
                            </Badge>
                          )}
                          <Badge tone={waiter.overloaded ? 'warn' : 'neutral'}>
                            {waiter.overloaded ? t('hall.overloaded') : t('hall.openTasks', { n: waiter.openTasks })}
                            {waiter.overloaded && <span className="num text-[14px]">· {waiter.openTasks}</span>}
                          </Badge>
                        </li>
                      ))}
                  </ul>
                </Card>

                <KitchenCard kitchen={hall.kitchen} />
              </div>
            </div>
          )
        }}
      </QueryState>
    </>
  )
}

function Legend() {
  const { t } = useT()
  const items = [
    ['#ffffff', '#d4d4d8', t('tableStatus.free')],
    ['#eef0ff', '#4f46e5', t('level.calm')],
    ['#fff7e6', '#f59e0b', t('level.warn')],
    ['#fff0f0', '#e5484d', t('level.late')],
    ['#f5f3ff', '#a78bfa', t('tableStatus.held')],
    ['#f6f6f7', '#a1a1aa', t('tableStatus.cleaning')],
  ]
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 px-1 text-[12px] text-muted" aria-label={t('hall.legend')}>
      {items.map(([fill, stroke, label]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className="h-3.5 w-5 rounded" style={{ background: fill, border: `2px solid ${stroke}` }} aria-hidden />
          {label}
        </li>
      ))}
    </ul>
  )
}

function KitchenCard({ kitchen }) {
  const { t } = useT()
  const stations = [...new Set(kitchen.map((row) => row.station))]
  return (
    <Card title={t('hall.kitchen')} bodyClassName="p-0">
      {stations.length ? (
        <ul>
          {stations.map((station) => {
            const qty = (status) => kitchen.find((row) => row.station === station && row.status === status)?.qty ?? 0
            return (
              <li key={station} className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-0">
                <span className="font-semibold">{t(`station.${station}`)}</span>
                <span className="text-[13px] text-muted">
                  {t('hall.kitchenLine', { cooking: qty('cooking'), queued: qty('queued'), ready: qty('ready') })}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="px-5 py-4 text-muted">{t('common.noData')}</p>
      )}
    </Card>
  )
}

function TablePanel({ table, hall, elapsedOf, levelOf, now, onClose }) {
  const { t, lang } = useT()
  const [moveTo, setMoveTo] = useState('')
  const [assign, setAssign] = useState({})
  const order = table.order
  const freeTables = hall.tables.filter((other) => other.status === 'free' && other.id !== table.id)
  const waiters = hall.waiters.filter((w) => w.onShift)

  const move = useAction(({ orderId, tableId }) => api.post(`/orders/${orderId}/move`, { tableId }), {
    invalidate: ['hall'],
    success: (data, vars) => t('hall.moved', { n: hall.tables.find((x) => x.id === vars.tableId)?.number }),
    onSuccess: () => setMoveTo(''),
  })
  const reassign = useAction(({ taskId, waiterId }) => api.post(`/tasks/${taskId}/reassign`, { waiterId }), {
    invalidate: ['hall', 'exceptions'],
    success: (data, vars) => t('hall.reassigned', { name: waiters.find((w) => w.id === vars.waiterId)?.name }),
  })

  const promiseLeft = order?.promiseAt ? (order.promiseAt - now) / 1000 : null

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          {t('common.table', { n: table.number })}
          <Badge tone={table.level === 'calm' ? 'brand' : LEVEL_TONE[table.level]}>{t(`tableStatus.${table.status}`)}</Badge>
          {order?.source === 'qr' && <Badge>{t('hall.viaQr')}</Badge>}
        </span>
      }
      subtitle={`${t('hall.waiter', { name: table.waiter?.name ?? '—' })} · ${t('hall.seats', { n: table.seats })}`}
      actions={<Button size="icon" variant="ghost" icon="x" onClick={onClose} aria-label={t('common.close')} />}
    >
      {table.booking && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-[#f5f3ff] px-3 py-2 text-[13px] font-medium text-[#5b21b6]">
          <Icon name="bookings" size={16} />
          {t('hall.booking', { name: table.booking.guestName, n: table.booking.guests, time: localTime(table.booking.startsAt) })}
          {table.booking.note && ` · ${table.booking.note}`}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-muted">{t('hall.order')}</h3>
          {order ? (
            <>
              <p className="text-[13px] text-muted">
                {t('common.guests', { n: order.guests })} · {t('hall.seatedFor', { t: formatDuration((now - order.openedAt) / 1000) })}
              </p>
              {order.promiseAt && (
                <p
                  className={`mt-2 rounded-lg px-3 py-2 text-[13px] font-semibold ${
                    order.promiseBroken ? 'bg-late-bg text-late-ink' : order.servedAt ? 'bg-ok-bg text-ok-ink' : promiseLeft < 90 ? 'bg-warn-bg text-warn-ink' : 'bg-tint text-brand'
                  }`}
                >
                  {t('hall.promise')} {localTime(order.promiseAt)} ·{' '}
                  {order.promiseBroken
                    ? t('hall.promiseBroken', { p: Math.round((order.discount * 100) / Math.max(1, order.subtotal + order.serviceCharge)) })
                    : order.servedAt
                      ? t('hall.promiseServed')
                      : t('hall.promiseLeft', { t: formatDuration(Math.max(0, promiseLeft)) })}
                </p>
              )}
              <ul className="mt-3 divide-y divide-line">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-2">
                    <span className="num w-7 text-[15px] text-muted">{item.qty}×</span>
                    <span className={`flex-1 ${item.status === 'cancelled' ? 'text-muted line-through' : ''}`}>
                      {lang === 'ru' ? item.nameRu : item.nameUz}
                      {item.cancelRequested && item.status !== 'cancelled' && (
                        <span className="ml-2 text-[12px] font-semibold text-warn-ink">{t('hall.cancelRequested')}</span>
                      )}
                    </span>
                    <Badge tone={item.status === 'ready' ? 'warn' : item.status === 'served' ? 'ok' : item.status === 'cooking' ? 'brand' : 'neutral'}>
                      {t(`itemStatus.${item.status}`)}
                      {item.status === 'cooking' && item.readyAt && <span className="num text-[13px]">{localTime(item.readyAt)}</span>}
                    </Badge>
                  </li>
                ))}
              </ul>
              {order.items.length > 0 && (
                <dl className="mt-3 space-y-1 border-t border-line pt-3 text-[13px]">
                  <Row label={t('hall.subtotal')} value={formatMoney(order.subtotal, lang)} />
                  <Row label={t('hall.service')} value={formatMoney(order.serviceCharge, lang)} />
                  {order.discount > 0 && <Row label={t('hall.discount')} value={`−${formatMoney(order.discount, lang)}`} />}
                  <Row label={t('hall.total')} value={formatMoney(order.total, lang)} strong />
                </dl>
              )}
            </>
          ) : (
            <p className="text-muted">{t('hall.noOrder')}</p>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-[13px] font-semibold text-muted">{t('hall.tasks')}</h3>
            {table.tasks.length ? (
              <ul className="space-y-3">
                {table.tasks.map((task) => {
                  const level = levelOf(task)
                  const choice = assign[task.id] ?? ''
                  return (
                    <li key={task.id} className="rounded-lg border border-line p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{t(`task.${task.type}`)}</span>
                        <Badge tone={LEVEL_TONE[level]}>
                          {t(`level.${level}`)}
                          <span className="num text-[15px]">{formatDuration(elapsedOf(task))}</span>
                        </Badge>
                      </div>
                      <p className="mt-1 text-[12px] text-muted">
                        {task.waiter?.name}
                        {task.ownerAlert && ` · ${t('hall.ownerAlert')}`}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <Select
                          aria-label={t('hall.chooseWaiter')}
                          className="h-8 text-[13px]"
                          value={choice}
                          onChange={(e) => setAssign((s) => ({ ...s, [task.id]: e.target.value }))}
                        >
                          <option value="">{t('hall.chooseWaiter')}</option>
                          {waiters
                            .filter((w) => w.id !== task.waiter?.id)
                            .map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.name} ({t('hall.openTasks', { n: w.openTasks })})
                              </option>
                            ))}
                        </Select>
                        <Button
                          size="sm"
                          disabled={!choice}
                          loading={reassign.isPending && reassign.variables?.taskId === task.id}
                          onClick={() => reassign.mutate({ taskId: task.id, waiterId: Number(choice) })}
                        >
                          {t('hall.reassign')}
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-muted">{t('hall.noTasks')}</p>
            )}
          </div>

          {order && (
            <div>
              <h3 className="mb-2 text-[13px] font-semibold text-muted">{t('hall.move')}</h3>
              <div className="flex gap-2">
                <Select aria-label={t('hall.moveTo')} value={moveTo} onChange={(e) => setMoveTo(e.target.value)} disabled={!freeTables.length}>
                  <option value="">{freeTables.length ? t('hall.moveTo') : t('hall.noFreeTables')}</option>
                  {freeTables.map((other) => (
                    <option key={other.id} value={other.id}>
                      {t('common.table', { n: other.number })} · {t('hall.seats', { n: other.seats })}
                    </option>
                  ))}
                </Select>
                <Button icon="move" disabled={!moveTo} loading={move.isPending} onClick={() => move.mutate({ orderId: order.id, tableId: Number(moveTo) })}>
                  {t('hall.moveButton')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function Row({ label, value, strong }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? 'pt-1 text-[14px] font-semibold' : 'text-muted'}`}>
      <dt>{label}</dt>
      <dd className="num text-[15px]">{value}</dd>
    </div>
  )
}
