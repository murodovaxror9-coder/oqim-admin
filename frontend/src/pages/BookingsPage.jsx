import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Card, PageHeader } from '../components/ui/Card.jsx'
import { Field, Input, Select, Textarea } from '../components/ui/Field.jsx'
import { ConfirmDialog, Modal } from '../components/ui/Modal.jsx'
import { Segmented } from '../components/ui/Segmented.jsx'
import { Empty, QueryState } from '../components/ui/States.jsx'
import { errorText, useT } from '../i18n/index.js'
import { api } from '../lib/api.js'
import { formatDate, formatDuration, formatPhone } from '../lib/format.js'
import { HOUR, MINUTE, addDays, dayStart, localDate, localTime } from '../lib/time.js'
import { useAction } from '../lib/useAction.js'
import { useNow } from '../lib/useNow.js'

const START_HOUR = 10
const END_HOUR = 24
const STATUS_TONE = { booked: 'brand', seated: 'ok', cancelled: 'neutral', no_show: 'late' }

export function BookingsPage() {
  const { t, lang } = useT()
  const today = localDate()
  const [date, setDate] = useState(today)
  const [view, setView] = useState('timeline')
  const [editing, setEditing] = useState(null)
  const query = useQuery({
    queryKey: ['bookings', date],
    queryFn: () => api.get(`/bookings?date=${date}`),
    placeholderData: keepPreviousData,
    refetchInterval: 20_000,
  })

  const dayLabel = date === today ? t('common.today') : date === addDays(today, 1) ? t('common.tomorrow') : date === addDays(today, -1) ? t('common.yesterday') : null

  return (
    <>
      <PageHeader
        title={t('bookings.title')}
        subtitle={
          query.data &&
          t('bookings.stats', {
            n: query.data.bookings.filter((b) => b.status !== 'cancelled').length,
            g: query.data.bookings.filter((b) => b.status !== 'cancelled').reduce((s, b) => s + b.guests, 0),
          })
        }
        actions={
          <Button variant="primary" icon="plus" onClick={() => setEditing({ date })}>
            {t('bookings.add')}
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button size="icon" icon="left" aria-label={t('common.prevDay')} onClick={() => setDate(addDays(date, -1))} />
          <Input type="date" className="h-9 w-40" aria-label={t('bookings.date')} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <Button size="icon" icon="right" aria-label={t('common.nextDay')} onClick={() => setDate(addDays(date, 1))} />
        </div>
        <span className="font-semibold">
          {dayLabel && `${dayLabel}, `}
          {formatDate(date, lang, { weekday: true })}
        </span>
        {date !== today && (
          <Button size="sm" variant="ghost" onClick={() => setDate(today)}>
            {t('common.today')}
          </Button>
        )}
        <div className="ml-auto">
          <Segmented
            size="sm"
            label={t('bookings.title')}
            value={view}
            onChange={setView}
            options={[
              { value: 'timeline', label: t('bookings.timeline') },
              { value: 'list', label: t('bookings.list') },
            ]}
          />
        </div>
      </div>

      <QueryState query={query} rows={4}>
        {(data) => (
          <div className={`grid gap-6 xl:grid-cols-[1fr_340px] ${query.isPlaceholderData ? 'opacity-60' : ''}`}>
            <div className="min-w-0">
              {view === 'timeline' ? (
                <Timeline data={data} date={date} onOpen={setEditing} />
              ) : (
                <BookingList bookings={data.bookings} onOpen={setEditing} />
              )}
            </div>
            {date === today ? <Waitlist data={data} /> : <div />}
          </div>
        )}
      </QueryState>

      {query.data && <BookingModal booking={editing} tables={query.data.tables} onClose={() => setEditing(null)} />}
    </>
  )
}

function Timeline({ data, date, onOpen }) {
  const { t } = useT()
  const now = useNow(30_000)
  const start = dayStart(date) + START_HOUR * HOUR
  const span = (END_HOUR - START_HOUR) * HOUR
  const pct = (ts) => Math.min(100, Math.max(0, ((ts - start) / span) * 100))
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
  const nowPct = now > start && now < start + span ? pct(now) : null

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <div className="min-w-[820px]">
        <div className="flex border-b border-line text-[11px] text-muted">
          <div className="w-28 shrink-0 px-4 py-2 font-semibold">{t('bookings.table')}</div>
          <div className="relative flex-1">
            {hours.map((hour) => (
              <span key={hour} className="num absolute top-2 -translate-x-1/2 text-[13px]" style={{ left: `${pct(start + (hour - START_HOUR) * HOUR)}%` }}>
                {hour}
              </span>
            ))}
          </div>
        </div>
        {data.tables.map((table) => {
          const rows = data.bookings.filter((b) => b.tableId === table.id && b.status !== 'cancelled')
          return (
            <div key={table.id} className="flex border-b border-line last:border-0">
              <div className="w-28 shrink-0 px-4 py-3">
                <p className="font-semibold">{t('common.table', { n: table.number })}</p>
                <p className="text-[12px] text-muted">{t('bookings.seatsOf', { n: table.seats })}</p>
              </div>
              <div className="relative h-16 flex-1">
                {hours.map((hour) => (
                  <span key={hour} className="absolute inset-y-0 border-l border-grid" style={{ left: `${pct(start + (hour - START_HOUR) * HOUR)}%` }} />
                ))}
                {nowPct != null && <span className="absolute inset-y-0 z-10 w-0.5 bg-late" style={{ left: `${nowPct}%` }} aria-hidden />}
                {rows.map((booking) => {
                  const left = pct(booking.startsAt)
                  const width = Math.max(4, pct(booking.endsAt) - left)
                  const tone =
                    booking.late
                      ? 'border-late bg-late-bg text-late-ink'
                      : booking.status === 'seated'
                        ? 'border-ok bg-ok-bg text-ok-ink'
                        : booking.status === 'no_show'
                          ? 'border-pale bg-mist text-muted line-through'
                          : 'border-brand bg-tint text-ink'
                  return (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => onOpen(booking)}
                      className={`absolute top-2 bottom-2 overflow-hidden rounded-md border-l-4 px-2 text-left text-[12px] leading-tight hover:brightness-95 ${tone}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${booking.guestName}, ${localTime(booking.startsAt)}–${localTime(booking.endsAt)}`}
                    >
                      <span className="block truncate font-semibold">{booking.guestName}</span>
                      <span className="block truncate">
                        <span className="num text-[13px]">{localTime(booking.startsAt)}</span> · {t('common.people', { n: booking.guests })}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BookingList({ bookings, onOpen }) {
  const { t } = useT()
  if (!bookings.length) {
    return (
      <div className="rounded-xl border border-line bg-white">
        <Empty icon="bookings" title={t('bookings.empty')} />
      </div>
    )
  }
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-white">
      {bookings.map((b) => (
        <li key={b.id}>
          <button type="button" onClick={() => onOpen(b)} className="flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-mist/60">
            <span className="num w-24 shrink-0 text-[18px]">
              {localTime(b.startsAt)}–{localTime(b.endsAt)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">
                {b.guestName} · {t('common.people', { n: b.guests })}
              </span>
              <span className="block truncate text-[13px] text-muted">
                {t('common.table', { n: b.tableNumber })}
                {b.phone && ` · ${formatPhone(b.phone)}`}
                {b.note && ` · ${b.note}`}
              </span>
            </span>
            <Badge tone={b.late ? 'late' : STATUS_TONE[b.status]}>{b.late ? t('bookings.late') : t(`bookings.status.${b.status}`)}</Badge>
          </button>
        </li>
      ))}
    </ul>
  )
}

function Waitlist({ data }) {
  const { t } = useT()
  const now = useNow(15_000)
  const [form, setForm] = useState({ guestName: '', guests: 2, quotedMinutes: 15, phone: '' })
  const [seatChoice, setSeatChoice] = useState({})
  const add = useAction((body) => api.post('/waitlist', body), {
    invalidate: ['bookings'],
    success: t('bookings.added'),
    onSuccess: () => setForm({ guestName: '', guests: 2, quotedMinutes: 15, phone: '' }),
  })
  const seat = useAction(({ id, tableId }) => api.post(`/waitlist/${id}/seat`, { tableId }), {
    invalidate: ['bookings', 'hall', 'today'],
    success: t('bookings.seated'),
  })
  const remove = useAction((id) => api.post(`/waitlist/${id}/remove`), { invalidate: ['bookings'], success: t('bookings.removed') })
  const free = data.tables.filter((table) => !table.busy)

  return (
    <Card title={t('bookings.waitlist')} bodyClassName="p-0">
      {data.waitlist.length ? (
        <ul className="divide-y divide-line">
          {data.waitlist.map((entry) => {
            const waited = (now - entry.createdAt) / 1000
            const overdue = waited - entry.quotedMinutes * 60
            const choice = seatChoice[entry.id] ?? (entry.tableId && free.some((f) => f.id === entry.tableId) ? String(entry.tableId) : '')
            return (
              <li key={entry.id} className="px-5 py-4">
                <p className="font-semibold">
                  {entry.guestName} · {t('common.people', { n: entry.guests })}
                </p>
                <p className="text-[13px] text-muted">
                  {t('bookings.waitingFor', { t: formatDuration(waited) })} · {t('bookings.quoted', { n: entry.quotedMinutes })}
                </p>
                {overdue > 0 && (
                  <Badge tone="late" className="mt-1.5">
                    {t('bookings.overdue', { t: formatDuration(overdue) })}
                  </Badge>
                )}
                <div className="mt-3 flex gap-2">
                  <Select
                    className="h-8 text-[13px]"
                    aria-label={t('bookings.pickTable')}
                    value={choice}
                    onChange={(e) => setSeatChoice((s) => ({ ...s, [entry.id]: e.target.value }))}
                  >
                    <option value="">{t('bookings.pickTable')}</option>
                    {free
                      .filter((table) => table.seats >= entry.guests)
                      .map((table) => (
                        <option key={table.id} value={table.id}>
                          {t('common.table', { n: table.number })} · {t('bookings.seatsOf', { n: table.seats })}
                        </option>
                      ))}
                  </Select>
                  <Button size="sm" variant="primary" disabled={!choice} loading={seat.isPending && seat.variables?.id === entry.id} onClick={() => seat.mutate({ id: entry.id, tableId: Number(choice) })}>
                    {t('bookings.seat')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(entry.id)}>
                    {t('bookings.left')}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="px-5 py-4 text-muted">{t('bookings.waitlistEmpty')}</p>
      )}
      <form
        className="grid grid-cols-2 gap-3 border-t border-line bg-mist/50 px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!form.guestName.trim()) return
          add.mutate({ guestName: form.guestName.trim(), guests: Number(form.guests), quotedMinutes: Number(form.quotedMinutes), phone: form.phone || null })
        }}
      >
        <Field label={t('bookings.guestName')} className="col-span-2">
          {(p) => <Input {...p} className="h-9" value={form.guestName} onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))} />}
        </Field>
        <Field label={t('bookings.guests')}>
          {(p) => <Input {...p} className="h-9" type="number" min="1" max="60" value={form.guests} onChange={(e) => setForm((f) => ({ ...f, guests: e.target.value }))} />}
        </Field>
        <Field label={t('bookings.quotedMinutes')}>
          {(p) => <Input {...p} className="h-9" type="number" min="1" max="180" value={form.quotedMinutes} onChange={(e) => setForm((f) => ({ ...f, quotedMinutes: e.target.value }))} />}
        </Field>
        <Button type="submit" icon="plus" className="col-span-2 justify-center" loading={add.isPending} disabled={!form.guestName.trim()}>
          {t('bookings.waitlistAdd')}
        </Button>
      </form>
    </Card>
  )
}

const EMPTY = { tableId: '', guestName: '', phone: '', guests: 2, date: '', time: '19:00', durationMinutes: 90, note: '' }

function BookingModal({ booking, tables, onClose }) {
  const { t, lang } = useT()
  const open = Boolean(booking)
  const isNew = open && !booking.id
  const editable = isNew || booking?.status === 'booked'
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [loadedFor, setLoadedFor] = useState(undefined)

  const key = open ? (booking.id ?? `new-${booking.date}`) : undefined
  if (key !== loadedFor) {
    setLoadedFor(key)
    setErrors({})
    if (open) {
      setForm(
        booking.id
          ? {
              tableId: String(booking.tableId),
              guestName: booking.guestName,
              phone: booking.phone ?? '',
              guests: booking.guests,
              date: localDate(booking.startsAt),
              time: localTime(booking.startsAt),
              durationMinutes: Math.round((booking.endsAt - booking.startsAt) / MINUTE),
              note: booking.note ?? '',
            }
          : { ...EMPTY, date: booking.date, tableId: String(tables[0]?.id ?? '') },
      )
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const save = useAction((body) => (isNew ? api.post('/bookings', body) : api.patch(`/bookings/${booking.id}`, body)), {
    invalidate: ['bookings', 'today', 'hall'],
    success: isNew ? t('bookings.created') : t('bookings.updated'),
    onSuccess: onClose,
  })
  const seat = useAction(() => api.post(`/bookings/${booking.id}/seat`), { invalidate: ['bookings', 'hall', 'today'], success: t('bookings.seated'), onSuccess: onClose })
  const cancel = useAction(() => api.post(`/bookings/${booking.id}/cancel`), {
    invalidate: ['bookings', 'hall', 'today'],
    success: t('bookings.cancelled'),
    onSuccess: () => {
      setConfirmCancel(false)
      onClose()
    },
  })

  function submit(event) {
    event.preventDefault()
    const next = {}
    if (!form.guestName.trim()) next.guestName = t('common.required')
    if (!form.tableId) next.tableId = t('common.required')
    const table = tables.find((x) => x.id === Number(form.tableId))
    if (table && Number(form.guests) > table.seats) next.guests = t('errors.too_many_guests')
    setErrors(next)
    if (Object.keys(next).length) return
    save.mutate({
      tableId: Number(form.tableId),
      guestName: form.guestName.trim(),
      phone: form.phone.trim() || null,
      guests: Number(form.guests),
      date: form.date,
      time: form.time,
      durationMinutes: Number(form.durationMinutes),
      note: form.note.trim() || null,
    })
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={isNew ? t('bookings.addTitle') : t('bookings.editTitle')}
        width="max-w-xl"
        footer={
          <>
            {!isNew && booking?.status === 'booked' && (
              <>
                <Button variant="danger" className="mr-auto" onClick={() => setConfirmCancel(true)}>
                  {t('bookings.cancel')}
                </Button>
                <Button loading={seat.isPending} onClick={() => seat.mutate()}>
                  {t('bookings.seat')}
                </Button>
              </>
            )}
            {editable ? (
              <Button variant="primary" type="submit" form="booking-form" loading={save.isPending}>
                {t('common.save')}
              </Button>
            ) : (
              <Button onClick={onClose}>{t('common.close')}</Button>
            )}
          </>
        }
      >
        {!isNew && booking && booking.status !== 'booked' && (
          <p className="mb-4">
            <Badge tone={STATUS_TONE[booking.status]}>{t(`bookings.status.${booking.status}`)}</Badge>
          </p>
        )}
        <form id="booking-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <fieldset disabled={!editable} className="contents">
            <Field label={t('bookings.guestName')} error={errors.guestName}>
              {(p) => <Input {...p} value={form.guestName} onChange={set('guestName')} />}
            </Field>
            <Field label={t('bookings.phone')} hint={t('common.optional')}>
              {(p) => <Input {...p} type="tel" placeholder="+998 90 123 45 67" value={form.phone} onChange={set('phone')} />}
            </Field>
            <Field label={t('bookings.date')}>{(p) => <Input {...p} type="date" value={form.date} onChange={set('date')} />}</Field>
            <Field label={t('bookings.time')}>{(p) => <Input {...p} type="time" step="900" value={form.time} onChange={set('time')} />}</Field>
            <Field label={t('bookings.guests')} error={errors.guests}>
              {(p) => <Input {...p} type="number" min="1" max="60" value={form.guests} onChange={set('guests')} />}
            </Field>
            <Field label={t('bookings.duration')}>
              {(p) => <Input {...p} type="number" min="15" max="720" step="15" value={form.durationMinutes} onChange={set('durationMinutes')} />}
            </Field>
            <Field label={t('bookings.table')} error={errors.tableId} className="sm:col-span-2">
              {(p) => (
                <Select {...p} value={form.tableId} onChange={set('tableId')}>
                  {tables.map((table) => (
                    <option key={table.id} value={table.id}>
                      {t('common.table', { n: table.number })} · {t('bookings.seatsOf', { n: table.seats })} · {table.zone}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('bookings.note')} className="sm:col-span-2">
              {(p) => <Textarea {...p} placeholder={t('bookings.notePlaceholder')} value={form.note} onChange={set('note')} />}
            </Field>
          </fieldset>
          {save.isError && <p className="text-[13px] font-medium text-late-ink sm:col-span-2">{errorText(t, save.error)}</p>}
        </form>
      </Modal>
      <ConfirmDialog
        open={confirmCancel}
        danger
        title={t('bookings.cancelTitle', { name: booking?.guestName ?? '' })}
        text={booking ? `${formatDate(localDate(booking.startsAt ?? Date.now()), lang)} · ${booking.startsAt ? localTime(booking.startsAt) : ''}` : ''}
        confirmLabel={t('bookings.cancel')}
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate()}
        onClose={() => setConfirmCancel(false)}
      />
    </>
  )
}
