import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ColumnChart } from '../components/charts/ColumnChart.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Card, PageHeader } from '../components/ui/Card.jsx'
import { Input } from '../components/ui/Field.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { StatTile } from '../components/ui/Stat.jsx'
import { QueryState } from '../components/ui/States.jsx'
import { useT } from '../i18n/index.js'
import { api } from '../lib/api.js'
import { formatCompact, formatDate, formatDateTime, formatNumber, weekdayName } from '../lib/format.js'
import { addDays, localDate, weekday } from '../lib/time.js'
import { useAction } from '../lib/useAction.js'

export function ForecastPage() {
  const { t, lang } = useT()
  const today = localDate()
  const [date, setDate] = useState(today)
  const query = useQuery({ queryKey: ['forecast', date], queryFn: () => api.get(`/forecast?date=${date}`), placeholderData: keepPreviousData })
  const confirm = useAction(() => api.post('/forecast/plans/confirm', { date }), { invalidate: ['forecast'], success: t('forecast.confirmedToast') })

  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i))

  return (
    <>
      <PageHeader title={t('forecast.title')} subtitle={formatDate(date, lang, { weekday: true })} />
      <div className="mb-6 flex flex-wrap gap-1.5" role="tablist" aria-label={t('forecast.title')}>
        {days.map((day) => (
          <button
            key={day}
            type="button"
            role="tab"
            aria-selected={day === date}
            onClick={() => setDate(day)}
            className={`rounded-lg px-3 py-2 text-left ${day === date ? 'bg-navy text-white' : 'border border-rule bg-surface hover:bg-mist'}`}
          >
            <span className={`block text-[12px] ${day === date ? 'text-dim' : 'text-muted'}`}>
              {day === today ? t('common.today') : day === addDays(today, 1) ? t('common.tomorrow') : weekdayName(weekday(day), lang)}
            </span>
            <span className="block font-semibold">{formatDate(day, lang)}</span>
          </button>
        ))}
      </div>

      <QueryState query={query} rows={4}>
        {(data) => {
          const wd = weekdayName(weekday(data.date), lang)
          const short = data.totals.waitersPeak - data.totals.waitersScheduled
          return (
            <div className={`space-y-6 ${query.isPlaceholderData ? 'opacity-60' : ''}`}>
              <p className="flex items-center gap-2 text-[13px] text-muted">
                <Icon name="info" size={16} />
                {data.basis.length
                  ? `${t('forecast.basis', { n: data.basis.length, weekday: wd })}: ${data.basis.map((b) => formatDate(b.date, lang)).join(', ')}`
                  : t('forecast.basisNone')}
              </p>

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatTile
                  label={t('forecast.revenue')}
                  value={formatCompact(data.totals.revenue, lang)}
                  sub={t('forecast.range', { min: formatCompact(data.totals.revenueMin, lang), max: formatCompact(data.totals.revenueMax, lang) })}
                />
                <StatTile label={t('forecast.orders')} value={formatNumber(data.totals.orders)} sub={`${t('forecast.guests')}: ${formatNumber(data.totals.guests)}`} />
                <StatTile label={t('forecast.peak')} value={`${data.totals.peakHour}:00`} />
                <StatTile
                  label={t('forecast.staffing')}
                  value={`${data.totals.waitersPeak} / ${data.totals.waitersScheduled}`}
                  tone={short > 0 ? 'warn' : undefined}
                  sub={short > 0 ? t('forecast.staffingShort', { n: short }) : t('forecast.staffingValue', { need: data.totals.waitersPeak, have: data.totals.waitersScheduled })}
                />
              </div>

              <Card title={t('forecast.hourly')}>
                <ColumnChart
                  title={t('forecast.hourly')}
                  data={data.hourly.map((h) => ({
                    key: h.hour,
                    label: `${h.hour}`,
                    tooltipTitle: `${h.hour}:00–${h.hour + 1}:00 · ${h.waitersNeeded} ${t('forecast.waitersNeeded')}`,
                    value: h.orders,
                  }))}
                  highlightKey={data.totals.peakHour}
                  mainLabel={t('forecast.orders')}
                  formatValue={(v) => String(v).replace('.', ',')}
                  formatAxis={(v) => String(v)}
                  height={220}
                />
              </Card>

              <Card
                title={t('forecast.batch')}
                subtitle={t('forecast.batchHint')}
                actions={
                  data.confirmed ? (
                    <Badge tone="ok">
                      <Icon name="check" size={14} />
                      {t('forecast.confirmed')}
                    </Badge>
                  ) : data.editable ? (
                    <Button variant="primary" icon="check" loading={confirm.isPending} onClick={() => confirm.mutate()} disabled={!data.items.some((i) => i.plans.length)}>
                      {t('forecast.confirm')}
                    </Button>
                  ) : (
                    <Badge>{t('forecast.pastDay')}</Badge>
                  )
                }
              >
                {!data.confirmed && data.editable && <p className="mb-4 text-[13px] text-muted">{t('forecast.confirmHint')}</p>}
                <div className="grid gap-6 lg:grid-cols-3">
                  {data.items.map((item) => (
                    <BatchPlan key={item.menuItemId} item={item} editable={data.editable && !data.confirmed} />
                  ))}
                </div>
              </Card>
            </div>
          )
        }}
      </QueryState>
    </>
  )
}

function BatchPlan({ item, editable }) {
  const { t, lang } = useT()
  const update = useAction(({ id, ...body }) => api.patch(`/forecast/plans/${id}`, body), { invalidate: ['forecast'], success: t('forecast.planSaved') })
  const missing = item.expectedPortions - item.plannedPortions
  const maxPortions = Math.max(1, ...item.hourly.map((h) => h.portions))
  const confirmedPlan = item.plans.find((plan) => plan.status === 'confirmed')

  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <Icon name="pot" size={18} className="text-muted" />
          {lang === 'ru' ? item.nameRu : item.nameUz}
        </h3>
        {missing > 0 && <Badge tone="warn">{t('forecast.short', { n: missing })}</Badge>}
      </div>
      <p className="mt-1 text-[13px] text-muted">
        {t('forecast.expected', { n: item.expectedPortions })} · {t('forecast.planned', { n: item.plannedPortions })}
      </p>

      {/* Soatma-soat talab: kichik ustunlar, bitta seriya */}
      <div className="mt-3 flex h-12 items-end gap-[2px]" aria-hidden>
        {item.hourly.map((h) => (
          <span key={h.hour} className="flex-1 rounded-t-[3px] bg-sky" style={{ height: `${Math.max(2, (h.portions / maxPortions) * 100)}%` }} title={`${h.hour}:00 · ${h.portions}`} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>{item.hourly[0]?.hour}:00</span>
        <span>{item.hourly[item.hourly.length - 1]?.hour + 1}:00</span>
      </div>

      {item.plans.length ? (
        <table className="mt-4 w-full text-[13px]">
          <thead className="text-left text-[12px] text-muted">
            <tr>
              <th className="pb-1 font-semibold">{t('forecast.start')}</th>
              <th className="pb-1 font-semibold">{t('forecast.ready')}</th>
              <th className="pb-1 text-right font-semibold">{t('forecast.batches')}</th>
            </tr>
          </thead>
          <tbody>
            {item.plans.map((plan) => (
              <tr key={plan.id} className="border-t border-line">
                <td className="py-1.5">
                  {editable ? (
                    <Input
                      type="time"
                      step="300"
                      className="num h-8 w-[104px] px-2 text-[15px]"
                      aria-label={t('forecast.start')}
                      defaultValue={plan.startTime}
                      onBlur={(e) => e.target.value && e.target.value !== plan.startTime && update.mutate({ id: plan.id, startTime: e.target.value })}
                    />
                  ) : (
                    <span className="num text-[16px]">{plan.startTime}</span>
                  )}
                </td>
                <td className="num py-1.5 text-[16px] text-muted">{plan.readyTime}</td>
                <td className="py-1.5 text-right">
                  {editable ? (
                    <Input
                      type="number"
                      min="0"
                      max="10"
                      className="num ml-auto h-8 w-16 px-2 text-right text-[15px]"
                      aria-label={t('forecast.batches')}
                      defaultValue={plan.batches}
                      onBlur={(e) => e.target.value !== '' && Number(e.target.value) !== plan.batches && update.mutate({ id: plan.id, batches: Number(e.target.value) })}
                    />
                  ) : (
                    <span className="num text-[16px]">{plan.batches}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-4 text-[13px] text-muted">{t('forecast.noPlan')}</p>
      )}
      {confirmedPlan?.confirmedBy && (
        <p className="mt-3 text-[12px] text-muted">
          {t('forecast.confirmedBy', { name: confirmedPlan.confirmedBy, time: formatDateTime(confirmedPlan.confirmedAt, lang) })}
        </p>
      )}
    </div>
  )
}
