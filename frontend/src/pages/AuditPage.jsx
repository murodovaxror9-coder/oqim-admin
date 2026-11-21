import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { PageHeader } from '../components/ui/Card.jsx'
import { Input, Select } from '../components/ui/Field.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { Empty, QueryState } from '../components/ui/States.jsx'
import { errorText, useT } from '../i18n/index.js'
import { api, qs } from '../lib/api.js'
import { describeEvent } from '../lib/events.js'
import { formatDate } from '../lib/format.js'
import { localDate, localTimeSec } from '../lib/time.js'
import { toast } from '../store/toast.js'

const PAGE_SIZE = 50
const EMPTY = { from: '', to: '', category: '', actorId: '', q: '' }

export function AuditPage() {
  const { t, lang } = useT()
  const [filters, setFilters] = useState(EMPTY)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  // Qidiruv yozish tugagach yuboriladi
  useEffect(() => {
    const id = setTimeout(() => {
      setFilters((f) => (f.q === search ? f : { ...f, q: search }))
      setPage(1)
    }, 350)
    return () => clearTimeout(id)
  }, [search])

  const params = { ...filters, page, pageSize: PAGE_SIZE }
  const query = useQuery({ queryKey: ['audit', params], queryFn: () => api.get(`/audit${qs(params)}`), placeholderData: keepPreviousData, refetchInterval: 20_000 })
  const set = (key) => (e) => {
    setFilters((f) => ({ ...f, [key]: e.target.value }))
    setPage(1)
  }
  const active = Object.values({ ...filters, q: search }).some(Boolean)

  async function exportCsv() {
    setExporting(true)
    try {
      await api.download(`/audit/export${qs(filters)}`, 'oqim-audit.csv')
    } catch (error) {
      toast(errorText(t, error), 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHeader
        title={t('audit.title')}
        subtitle={
          <span className="flex items-center gap-1.5">
            <Icon name="lock" size={16} />
            {t('audit.subtitle')}
          </span>
        }
        actions={
          <Button icon="download" loading={exporting} onClick={exportCsv}>
            {t('common.export')}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="relative w-full sm:w-64">
          <Icon name="search" size={18} className="absolute top-2.5 left-3 text-muted" />
          <Input className="pl-9" placeholder={t('audit.search')} aria-label={t('audit.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <Select aria-label={t('audit.category')} className="w-auto min-w-40" value={filters.category} onChange={set('category')}>
          <option value="">{t('audit.category')}: {t('common.all')}</option>
          {query.data?.categories.map((category) => (
            <option key={category} value={category}>
              {t(`audit.categories.${category}`)}
            </option>
          ))}
        </Select>
        <Select aria-label={t('audit.actor')} className="w-auto min-w-40" value={filters.actorId} onChange={set('actorId')}>
          <option value="">{t('audit.actor')}: {t('common.all')}</option>
          {query.data?.actors.map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.name}
            </option>
          ))}
        </Select>
        <Input type="date" aria-label={t('common.from')} className="w-40" value={filters.from} max={filters.to || localDate()} onChange={set('from')} />
        <Input type="date" aria-label={t('common.to')} className="w-40" value={filters.to} min={filters.from} max={localDate()} onChange={set('to')} />
        {active && (
          <Button
            variant="ghost"
            icon="x"
            onClick={() => {
              setFilters(EMPTY)
              setSearch('')
              setPage(1)
            }}
          >
            {t('audit.reset')}
          </Button>
        )}
      </div>

      <QueryState query={query} rows={6}>
        {(data) => {
          const from = data.total ? (data.page - 1) * data.pageSize + 1 : 0
          const to = Math.min(data.total, data.page * data.pageSize)
          let lastDate = null
          return (
            <div className={`overflow-hidden rounded-xl border border-line bg-white ${query.isPlaceholderData ? 'opacity-60' : ''}`}>
              {data.items.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left">
                    <thead className="text-[12px] text-muted">
                      <tr className="border-b border-line">
                        <th className="w-28 px-5 py-3 font-semibold">{t('audit.colTime')}</th>
                        <th className="px-3 py-3 font-semibold">{t('audit.colAction')}</th>
                        <th className="w-52 px-3 py-3 font-semibold">{t('audit.colActor')}</th>
                        <th className="w-36 px-5 py-3 font-semibold">{t('audit.colCategory')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.flatMap((event) => {
                        const date = localDate(event.at)
                        const rows = []
                        if (date !== lastDate) {
                          lastDate = date
                          rows.push(
                            <tr key={`d-${date}`} className="bg-mist">
                              <td colSpan={4} className="px-5 py-1.5 text-[12px] font-bold text-muted">
                                {formatDate(date, lang, { weekday: true, year: true })}
                              </td>
                            </tr>,
                          )
                        }
                        rows.push(
                          <tr key={event.id} className="border-b border-line last:border-0">
                            <td className="num px-5 py-2.5 text-[15px] text-muted">{localTimeSec(event.at)}</td>
                            <td className="px-3 py-2.5">{describeEvent(event, t, lang)}</td>
                            <td className="px-3 py-2.5 text-[13px]">
                              {event.actor ? (
                                <>
                                  <span className="font-semibold">{event.actor.name}</span>
                                  {event.actor.role && <span className="text-muted"> · {t(`roles.${event.actor.role}`)}</span>}
                                </>
                              ) : (
                                <span className="text-muted">{event.actorKind === 'guest' ? t('audit.guest') : t('common.system')}</span>
                              )}
                            </td>
                            <td className="px-5 py-2.5">
                              <Badge>{t(`audit.categories.${event.category}`)}</Badge>
                            </td>
                          </tr>,
                        )
                        return rows
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty icon="search" title={t('audit.empty')} />
              )}
              <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-[13px] text-muted">
                <span>{t('audit.page', { from, to, total: data.total })}</span>
                <div className="flex gap-2">
                  <Button size="icon" icon="left" aria-label={t('common.prevPage')} disabled={page <= 1} onClick={() => setPage((p) => p - 1)} />
                  <Button size="icon" icon="right" aria-label={t('common.nextPage')} disabled={to >= data.total} onClick={() => setPage((p) => p + 1)} />
                </div>
              </div>
            </div>
          )
        }}
      </QueryState>
    </>
  )
}
