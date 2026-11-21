import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ColumnChart } from '../components/charts/ColumnChart.jsx'
import { Meter } from '../components/charts/BarList.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Card, PageHeader } from '../components/ui/Card.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { Delta, StatTile } from '../components/ui/Stat.jsx'
import { QueryState } from '../components/ui/States.jsx'
import { useT } from '../i18n/index.js'
import { api } from '../lib/api.js'
import { describeEvent } from '../lib/events.js'
import { formatCompact, formatDate, formatDuration, formatMoney, formatNumber, percentChange, weekdayName } from '../lib/format.js'
import { localTime, weekday } from '../lib/time.js'
import { useAction } from '../lib/useAction.js'
import { useCountUp } from '../lib/useCountUp.js'

function CountUp({ value }) {
  return formatNumber(useCountUp(value))
}

export function TodayPage() {
  const { t, lang } = useT()
  const query = useQuery({ queryKey: ['today'], queryFn: () => api.get('/dashboard/today'), refetchInterval: 15_000 })
  const startBatch = useAction((menuItemId) => api.post('/batches', { menuItemId }), {
    invalidate: ['today', 'menu', 'exceptions'],
    success: (data) => t('today.batchStarted', { name: lang === 'ru' ? data.nameRu : data.nameUz }),
  })

  return (
    <>
      <PageHeader
        title={t('today.title')}
        subtitle={query.data ? formatDate(query.data.date, lang, { weekday: true }) : ' '}
      />
      <QueryState query={query} rows={4}>
        {(data) => {
          const wd = weekdayName(weekday(data.date), lang)
          const serveTarget = data.targets.orderToServeSeconds
          const serveLate = data.today.avgServeSeconds != null && data.today.avgServeSeconds > serveTarget
          return (
            <div className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-[1.25fr_2fr]">
                <section className="group relative isolate overflow-hidden rounded-[20px] bg-[#0c0b1d] p-6 text-white shadow-[0_24px_60px_-20px_rgb(49_46_129/0.65)] ring-1 ring-white/10">
                  <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
                    <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-indigo-600/50 blur-[80px] animate-[count-glow_6s_ease-in-out_infinite]" />
                    <div className="absolute -right-20 -bottom-28 h-80 w-80 rounded-full bg-violet-600/40 blur-[90px] animate-[count-glow_7s_ease-in-out_infinite_-3s]" />
                    <div className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.05)_1px,transparent_1px)] bg-[size:28px_28px] [mask-image:radial-gradient(ellipse_at_top_right,black_20%,transparent_70%)]" />
                  </div>
                  <p className="flex items-center gap-2 text-[13px] font-medium text-white/60">
                    <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
                    {t('today.revenue')}
                  </p>
                  <p className="num mt-3 bg-gradient-to-br from-white via-white to-indigo-200 bg-clip-text text-[60px] leading-none font-semibold tracking-[-0.04em] text-transparent">
                    <CountUp value={data.today.revenue} />
                    <span className="ml-2 text-[22px] font-medium tracking-normal text-white/50">{lang === 'ru' ? 'сум' : "so'm"}</span>
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span
                      className="rounded-lg bg-white px-2 py-0.5"
                      style={{ '--color-ok-ink': '#0d7a6d', '--color-late-ink': '#b42318', '--color-muted': '#66666f' }}
                    >
                      <Delta value={percentChange(data.today.revenue, data.lastWeek.revenue)} />
                    </span>
                    <span className="text-[13px] text-white/55">
                      {t('today.vsLastWeek', { weekday: wd, value: formatMoney(data.lastWeek.revenue, lang) })}
                    </span>
                  </div>
                  <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ['busy', `${data.live.busy}/${data.live.tables}`],
                      ['guestsNow', data.live.guests],
                      ['lateNow', data.live.lateTasks],
                      ['openExceptions', data.live.openExceptions],
                    ].map(([key, value]) => (
                      <div key={key} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 backdrop-blur-sm transition-colors hover:bg-white/[0.08]">
                        <dt className="text-[12px] text-white/55">{t(`today.${key}`)}</dt>
                        <dd className={`num text-[28px] leading-tight ${key === 'lateNow' && value > 0 ? 'text-[#ff8a7a]' : ''}`}>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link to="/hall" className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-[#0c0b1d] shadow-[0_8px_20px_-6px_rgb(255_255_255/0.4)] transition-all hover:-translate-y-px hover:shadow-[0_10px_28px_-6px_rgb(165_180_252/0.7)]">
                      <Icon name="hall" size={16} />
                      {t('nav.hall')}
                    </Link>
                    {data.live.openExceptions > 0 && (
                      <Link
                        to="/exceptions"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[13px] font-semibold ring-1 ring-white/15 transition-all hover:-translate-y-px hover:bg-white/15"
                      >
                        <Icon name="exceptions" size={16} />
                        {t('topbar.exceptions', { n: data.live.openExceptions })}
                      </Link>
                    )}
                  </div>
                </section>

                <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                  <StatTile
                    label={t('today.orders')}
                    value={formatNumber(data.today.orders)}
                    delta={<Delta value={percentChange(data.today.orders, data.lastWeek.orders)} />}
                  />
                  <StatTile
                    label={t('today.avgCheck')}
                    value={formatCompact(data.today.avgCheck, lang)}
                    delta={<Delta value={percentChange(data.today.avgCheck, data.lastWeek.avgCheck)} />}
                  />
                  <StatTile
                    label={t('today.guests')}
                    value={formatNumber(data.today.guests)}
                    delta={<Delta value={percentChange(data.today.guests, data.lastWeek.guests)} />}
                  />
                  <StatTile
                    label={t('today.serve')}
                    value={formatDuration(data.today.avgServeSeconds)}
                    tone={serveLate ? 'warn' : undefined}
                    sub={t('today.target', { v: formatDuration(serveTarget) })}
                  />
                  <StatTile
                    label={t('today.lateTasks')}
                    value={`${String(data.tasks.latePercent).replace('.', ',')}%`}
                    tone={data.tasks.latePercent > 15 ? 'late' : undefined}
                    sub={t('today.lateOf', { n: data.tasks.count, late: data.tasks.late })}
                  />
                  <StatTile
                    label={t('today.promiseKept')}
                    value={data.today.promiseKeptPercent == null ? '—' : `${String(data.today.promiseKeptPercent).replace('.', ',')}%`}
                    sub={data.today.promiseBroken ? t('today.promiseBroken', { n: data.today.promiseBroken }) : undefined}
                  />
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
                <Card title={t('today.hourly')}>
                  <ColumnChart
                    title={t('today.hourly')}
                    data={data.hourly.map((h) => ({
                      key: h.hour,
                      label: `${h.hour}`,
                      tooltipTitle: `${String(h.hour).padStart(2, '0')}:00–${String(h.hour + 1).padStart(2, '0')}:00`,
                      value: h.revenue,
                      compare: h.lastWeek,
                    }))}
                    mainLabel={t('today.seriesToday')}
                    compareLabel={t('today.seriesLastWeek', { weekday: wd })}
                    formatValue={(v) => formatMoney(v, lang)}
                    formatAxis={(v) => formatCompact(v, lang)}
                  />
                </Card>

                <Card title={t('today.batches')}>
                  <ul className="space-y-5">
                    {data.batches.map((batch) => {
                      const name = lang === 'ru' ? batch.nameRu : batch.nameUz
                      return (
                        <li key={batch.menuItemId}>
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2 font-semibold">
                              <Icon name="pot" size={18} className="text-muted" />
                              {name}
                            </span>
                            {batch.stopReason === 'manual' ? (
                              <Badge>{t('today.stopManual')}</Badge>
                            ) : batch.stock === 0 ? (
                              <Badge tone="late">{t('today.stopAuto')}</Badge>
                            ) : (
                              <span className="num text-[16px]">
                                {batch.stock}
                                <span className="text-muted">/{batch.size}</span>
                              </span>
                            )}
                          </div>
                          {batch.stopReason !== 'manual' && <Meter value={batch.stock} max={batch.size} warn={batch.warn} label={name} />}
                          <div className="mt-1.5 flex items-center justify-between gap-2 text-[13px] text-muted">
                            <span>
                              {batch.nextReadyAt
                                ? t('today.nextReady', { time: localTime(batch.nextReadyAt) })
                                : batch.stopReason !== 'manual' && t('today.left', { n: batch.stock })}
                            </span>
                            {batch.stopReason !== 'manual' && !batch.nextReadyAt && batch.stock <= batch.warn && (
                              <Button size="sm" variant="primary" loading={startBatch.isPending && startBatch.variables === batch.menuItemId} onClick={() => startBatch.mutate(batch.menuItemId)}>
                                {t('today.newBatch')}
                              </Button>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </Card>
              </div>

              <Card title={t('today.waiters')} bodyClassName="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                  <thead className="text-[12px] text-muted">
                    <tr className="border-b border-line">
                      <th className="px-5 py-2.5 font-semibold">{t('today.colWaiter')}</th>
                      <th className="px-3 py-2.5 text-right font-semibold">{t('today.colTasks')}</th>
                      <th className="px-3 py-2.5 text-right font-semibold">{t('today.colAvg')}</th>
                      <th className="px-3 py-2.5 text-right font-semibold">{t('today.colLate')}</th>
                      <th className="px-3 py-2.5 text-right font-semibold">{t('today.colOpen')}</th>
                      <th className="px-5 py-2.5 text-right font-semibold">{t('today.colRevenue')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.waiters.map((w) => (
                      <tr key={w.id} className="border-b border-line last:border-0">
                        <td className="px-5 py-3">
                          <span className="font-semibold">{w.name}</span>
                          {!w.onShift && <span className="ml-2 text-[12px] text-muted">{t('today.offShift')}</span>}
                        </td>
                        <td className="num px-3 py-3 text-right text-[16px]">{w.tasks}</td>
                        <td className="num px-3 py-3 text-right text-[16px]">{formatDuration(w.avgSeconds)}</td>
                        <td className="px-3 py-3 text-right">
                          <Badge tone={w.latePercent > 15 ? 'late' : w.latePercent > 8 ? 'warn' : 'ok'}>
                            <span className="num text-[14px]">{String(w.latePercent).replace('.', ',')}%</span>
                          </Badge>
                        </td>
                        <td className="num px-3 py-3 text-right text-[16px]">{w.openTasks}</td>
                        <td className="num px-5 py-3 text-right text-[16px]">{formatMoney(w.revenue, lang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <div className="grid gap-6 lg:grid-cols-3">
                <Card title={t('today.bookings')} actions={<Link to="/bookings" className="text-[13px] font-semibold text-brand hover:underline">{t('nav.bookings')}</Link>}>
                  {data.bookings.length ? (
                    <ul className="space-y-3">
                      {data.bookings.map((b) => (
                        <li key={b.id} className="flex items-start gap-3">
                          <span className="num w-12 shrink-0 text-[18px] text-ink">{localTime(b.startsAt)}</span>
                          <span className="min-w-0">
                            <span className="block font-semibold">
                              {b.guestName} · {t('common.people', { n: b.guests })}
                            </span>
                            <span className="block text-[13px] text-muted">
                              {t('common.table', { n: b.tableNumber })}
                              {b.note && ` · ${b.note}`}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted">{t('today.noBookings')}</p>
                  )}
                </Card>

                <Card title={t('today.top')}>
                  {data.topItems.length ? (
                    <ol className="space-y-2.5">
                      {data.topItems.map((item) => (
                        <li key={item.id} className="flex items-baseline justify-between gap-3">
                          <span className="font-medium">{lang === 'ru' ? item.nameRu : item.nameUz}</span>
                          <span className="flex items-baseline gap-3">
                            <span className="num text-[15px] text-muted">× {item.qty}</span>
                            <span className="num w-24 text-right text-[15px]">{formatCompact(item.revenue, lang)}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-muted">{t('today.noSales')}</p>
                  )}
                </Card>

                <Card title={t('today.events')} actions={<Link to="/audit" className="text-[13px] font-semibold text-brand hover:underline">{t('today.allEvents')}</Link>}>
                  <ul className="space-y-3">
                    {data.events.map((event) => (
                      <li key={event.id} className="flex gap-3 text-[13px]">
                        <span className="num w-11 shrink-0 text-[14px] text-muted">{localTime(event.at)}</span>
                        <span className="min-w-0">
                          <span className="block text-ink">{describeEvent(event, t, lang)}</span>
                          <span className="block text-muted">{event.actor?.name ?? (event.actorKind === 'guest' ? t('audit.guest') : t('common.system'))}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </div>
          )
        }}
      </QueryState>
    </>
  )
}
