import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { BarList } from '../components/charts/BarList.jsx'
import { ColumnChart } from '../components/charts/ColumnChart.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Card, PageHeader } from '../components/ui/Card.jsx'
import { Input } from '../components/ui/Field.jsx'
import { Segmented } from '../components/ui/Segmented.jsx'
import { Delta, StatTile } from '../components/ui/Stat.jsx'
import { QueryState } from '../components/ui/States.jsx'
import { errorText, useT } from '../i18n/index.js'
import { api, qs } from '../lib/api.js'
import { formatCompact, formatDate, formatDuration, formatMoney, formatNumber, percentChange } from '../lib/format.js'
import { addDays, localDate } from '../lib/time.js'
import { toast } from '../store/toast.js'
import { useCardTable } from '../lib/useCardTable.js'

const PRESETS = { today: 0, d7: 6, d30: 29, d90: 89 }

export function ReportsPage() {
  const { t, lang } = useT()
  const tasksTable = useCardTable()
  const waitersTable = useCardTable()
  const today = localDate()
  const [preset, setPreset] = useState('d7')
  const [range, setRange] = useState({ from: addDays(today, -6), to: today })
  const [exporting, setExporting] = useState(false)
  const query = useQuery({
    queryKey: ['reports', range],
    queryFn: () => api.get(`/reports${qs(range)}`),
    placeholderData: keepPreviousData,
  })

  const choosePreset = (value) => {
    setPreset(value)
    if (value !== 'custom') setRange({ from: addDays(today, -PRESETS[value]), to: today })
  }

  async function exportCsv() {
    setExporting(true)
    try {
      await api.download(`/reports/export${qs(range)}`, 'oqim-hisobot.csv')
    } catch (error) {
      toast(errorText(t, error), 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHeader
        title={t('reports.title')}
        subtitle={`${formatDate(range.from, lang, { year: true })} — ${formatDate(range.to, lang, { year: true })}`}
        actions={
          <Button icon="download" loading={exporting} onClick={exportCsv}>
            {t('common.export')}
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented
          label={t('reports.custom')}
          value={preset}
          onChange={choosePreset}
          options={[...Object.keys(PRESETS).map((key) => ({ value: key, label: t(`reports.presets.${key}`) })), { value: 'custom', label: t('reports.custom') }]}
        />
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              aria-label={t('common.from')}
              className="h-9 w-40"
              value={range.from}
              max={range.to}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))}
            />
            <span className="text-muted">—</span>
            <Input
              type="date"
              aria-label={t('common.to')}
              className="h-9 w-40"
              value={range.to}
              min={range.from}
              max={today}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))}
            />
          </div>
        )}
      </div>

      <QueryState query={query} rows={4}>
        {(data) => {
          const vs = t('reports.vsPrevious', { n: data.days })
          const paymentsTotal = data.payments.reduce((sum, p) => sum + p.amount, 0)
          const sourcesTotal = data.sources.reduce((sum, s) => sum + s.count, 0)
          return (
            <div className={`space-y-6 ${query.isPlaceholderData ? 'opacity-60' : ''}`}>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
                <StatTile label={t('reports.revenue')} value={formatCompact(data.totals.revenue, lang)} delta={<Delta value={percentChange(data.totals.revenue, data.previous.revenue)} />} sub={vs} />
                <StatTile label={t('reports.orders')} value={formatNumber(data.totals.orders)} delta={<Delta value={percentChange(data.totals.orders, data.previous.orders)} />} />
                <StatTile label={t('reports.avgCheck')} value={formatCompact(data.totals.avgCheck, lang)} delta={<Delta value={percentChange(data.totals.avgCheck, data.previous.avgCheck)} />} />
                <StatTile label={t('reports.guests')} value={formatNumber(data.totals.guests)} delta={<Delta value={percentChange(data.totals.guests, data.previous.guests)} />} />
                <StatTile
                  label={t('reports.serve')}
                  value={formatDuration(data.totals.avgServeSeconds)}
                  delta={<Delta value={percentChange(data.totals.avgServeSeconds, data.previous.avgServeSeconds)} goodWhenUp={false} />}
                />
                <StatTile
                  label={t('reports.promiseKept')}
                  value={data.totals.promiseKeptPercent == null ? '—' : `${String(data.totals.promiseKeptPercent).replace('.', ',')}%`}
                  sub={`${t('reports.discounts')}: ${formatCompact(data.totals.discounts, lang)}`}
                />
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <Card title={t('reports.daily')}>
                  <ColumnChart
                    title={t('reports.colDate')}
                    data={data.daily.map((d) => ({
                      key: d.date,
                      label: d.date.slice(8),
                      tooltipTitle: formatDate(d.date, lang, { weekday: true }),
                      value: d.revenue,
                    }))}
                    mainLabel={t('reports.revenue')}
                    labelEvery={data.daily.length > 31 ? 7 : data.daily.length > 14 ? 2 : 1}
                    formatValue={(v) => formatMoney(v, lang)}
                    formatAxis={(v) => formatCompact(v, lang)}
                  />
                </Card>
                <Card title={t('reports.byHour')} subtitle={t('reports.perDay')}>
                  <ColumnChart
                    title={t('reports.byHour')}
                    data={data.byHour.map((h) => ({ key: h.hour, label: `${h.hour}`, tooltipTitle: `${h.hour}:00–${h.hour + 1}:00`, value: h.revenue }))}
                    mainLabel={t('reports.revenue')}
                    formatValue={(v) => formatMoney(v, lang)}
                    formatAxis={(v) => formatCompact(v, lang)}
                  />
                </Card>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <Card title={t('reports.tasks')} bodyClassName="overflow-x-auto">
                  <table ref={tasksTable} className="rtable w-full text-left">
                    <thead className="text-[12px] text-muted">
                      <tr className="border-b border-line">
                        <th className="px-5 py-2.5 font-semibold">{t('reports.colType')}</th>
                        <th className="px-3 py-2.5 text-right font-semibold">{t('reports.colCount')}</th>
                        <th className="px-3 py-2.5 text-right font-semibold">{t('reports.colAvg')}</th>
                        <th className="px-3 py-2.5 text-right font-semibold">{t('reports.colSla')}</th>
                        <th className="px-5 py-2.5 text-right font-semibold">{t('reports.colLate')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tasks.byType.map((row) => (
                        <tr key={row.type} className="border-b border-line last:border-0">
                          <td className="px-5 py-3 font-semibold">{t(`task.${row.type}`)}</td>
                          <td className="num px-3 py-3 text-right text-[16px]">{formatNumber(row.count)}</td>
                          <td className={`num px-3 py-3 text-right text-[16px] ${row.avgSeconds > row.slaSeconds ? 'text-late-ink' : ''}`}>{formatDuration(row.avgSeconds)}</td>
                          <td className="num px-3 py-3 text-right text-[16px] text-muted">{formatDuration(row.slaSeconds)}</td>
                          <td className="px-5 py-3 text-right">
                            <Badge tone={row.latePercent > 15 ? 'late' : row.latePercent > 8 ? 'warn' : 'ok'}>
                              <span className="num text-[14px]">{String(row.latePercent).replace('.', ',')}%</span>
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>

                <Card title={t('reports.waiters')} bodyClassName="overflow-x-auto">
                  <table ref={waitersTable} className="rtable w-full text-left">
                    <thead className="text-[12px] text-muted">
                      <tr className="border-b border-line">
                        <th className="px-5 py-2.5 font-semibold">{t('reports.colWaiter')}</th>
                        <th className="px-3 py-2.5 text-right font-semibold">{t('reports.colTasks')}</th>
                        <th className="px-3 py-2.5 text-right font-semibold">{t('reports.colAvg')}</th>
                        <th className="px-3 py-2.5 text-right font-semibold">{t('reports.colLate')}</th>
                        <th className="px-5 py-2.5 text-right font-semibold">{t('reports.colRevenue')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.waiters.map((w) => (
                        <tr key={w.id} className="border-b border-line last:border-0">
                          <td className="px-5 py-3 font-semibold">{w.name}</td>
                          <td className="num px-3 py-3 text-right text-[16px]">{formatNumber(w.tasks)}</td>
                          <td className="num px-3 py-3 text-right text-[16px]">{formatDuration(w.avgSeconds)}</td>
                          <td className="px-3 py-3 text-right">
                            <Badge tone={w.latePercent > 15 ? 'late' : w.latePercent > 8 ? 'warn' : 'ok'}>
                              <span className="num text-[14px]">{String(w.latePercent).replace('.', ',')}%</span>
                            </Badge>
                          </td>
                          <td className="num px-5 py-3 text-right text-[16px]">{formatCompact(w.revenue, lang)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>

              <div className="grid gap-6 xl:grid-cols-3">
                <Card title={t('reports.top')} className="xl:col-span-1">
                  <BarList
                    items={data.topItems.map((item) => ({
                      key: item.id,
                      label: lang === 'ru' ? item.nameRu : item.nameUz,
                      value: item.revenue,
                      note: `× ${formatNumber(item.qty)}`,
                    }))}
                    formatValue={(v) => formatCompact(v, lang)}
                  />
                </Card>
                <Card title={t('reports.payments')}>
                  <BarList
                    items={data.payments.map((p) => ({
                      key: p.method,
                      label: t(`payment.${p.method}`),
                      value: p.amount,
                      note: `${Math.round((p.amount / Math.max(paymentsTotal, 1)) * 100)}%`,
                    }))}
                    formatValue={(v) => formatCompact(v, lang)}
                  />
                </Card>
                <Card title={t('reports.sources')}>
                  <BarList
                    items={data.sources.map((s) => ({
                      key: s.source,
                      label: t(`reports.source.${s.source}`),
                      value: s.count,
                      note: `${Math.round((s.count / Math.max(sourcesTotal, 1)) * 100)}%`,
                    }))}
                    formatValue={formatNumber}
                  />
                </Card>
              </div>
            </div>
          )
        }}
      </QueryState>
    </>
  )
}
