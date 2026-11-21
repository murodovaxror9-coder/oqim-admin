import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { FloorBase } from '../components/hall/FloorBase.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Card, PageHeader } from '../components/ui/Card.jsx'
import { Field, Input, Select } from '../components/ui/Field.jsx'
import { ConfirmDialog, Modal } from '../components/ui/Modal.jsx'
import { Loader, QueryState } from '../components/ui/States.jsx'
import { useT } from '../i18n/index.js'
import { api } from '../lib/api.js'
import { useAction } from '../lib/useAction.js'

const GRID = 10
const snap = (value) => Math.round(value / GRID) * GRID

export function TablesPage() {
  const { t } = useT()
  const query = useQuery({ queryKey: ['tables'], queryFn: () => api.get('/tables') })
  const [layout, setLayout] = useState({})
  const [selectedId, setSelectedId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [zonesOpen, setZonesOpen] = useState(false)

  const saveLayout = useAction(
    () => api.put('/tables/layout', { tables: Object.entries(layout).map(([id, pos]) => ({ id: Number(id), ...pos })) }),
    { invalidate: ['tables', 'hall'], success: t('tables.layoutSaved'), onSuccess: () => setLayout({}) },
  )
  const dirty = Object.keys(layout).length > 0

  return (
    <>
      <PageHeader
        title={t('tables.title')}
        subtitle={query.data && t('tables.stats', { n: query.data.tables.length, s: query.data.tables.reduce((sum, x) => sum + x.seats, 0) })}
        actions={
          <>
            <Button icon="hall" onClick={() => setZonesOpen(true)}>
              {t('tables.zones')}
            </Button>
            <Button icon="qr" onClick={() => setQrOpen(true)}>
              {t('tables.qrCodes')}
            </Button>
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              {t('tables.add')}
            </Button>
          </>
        }
      />
      <QueryState query={query} rows={3}>
        {(data) => {
          const tables = data.tables.map((table) => ({ ...table, ...layout[table.id] }))
          const selected = tables.find((table) => table.id === selectedId)
          return (
            <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
              <Card
                bodyClassName="p-4"
                title={t('tables.title')}
                subtitle={t('tables.dragHint')}
                actions={
                  dirty && (
                    <>
                      <Badge tone="warn">{t('tables.unsaved')}</Badge>
                      <Button size="sm" onClick={() => setLayout({})}>
                        {t('common.cancel')}
                      </Button>
                      <Button size="sm" variant="primary" loading={saveLayout.isPending} onClick={() => saveLayout.mutate()}>
                        {t('tables.saveLayout')}
                      </Button>
                    </>
                  )
                }
              >
                <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:thin]">
                  <div className="min-w-[640px] md:min-w-0">
                    <FloorEditor
                      floor={data.floor}
                      tables={tables}
                      selectedId={selectedId}
                      onSelect={setSelectedId}
                      onMove={(id, pos) => setLayout((current) => ({ ...current, [id]: pos }))}
                    />
                  </div>
                </div>
              </Card>
              <div>
                {selected ? (
                  <TableForm key={selected.id} table={selected} data={data} onDone={() => setSelectedId(null)} />
                ) : (
                  <p className="rounded-xl border border-dashed border-rule px-5 py-8 text-center text-muted">{t('tables.selectHint')}</p>
                )}
              </div>
            </div>
          )
        }}
      </QueryState>
      {query.data && (
        <>
          <Modal open={creating} onClose={() => setCreating(false)} title={t('tables.addTitle')}>
            {creating && <TableForm data={query.data} onDone={() => setCreating(false)} bare />}
          </Modal>
          <ZonesModal open={zonesOpen} data={query.data} onClose={() => setZonesOpen(false)} />
        </>
      )}
      <QrModal open={qrOpen} onClose={() => setQrOpen(false)} />
    </>
  )
}

function FloorEditor({ floor, tables, selectedId, onSelect, onMove }) {
  const { t } = useT()
  const svgRef = useRef(null)
  const drag = useRef(null)

  const toFloor = (event) => {
    const point = svgRef.current.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    return point.matrixTransform(svgRef.current.getScreenCTM().inverse())
  }

  const onPointerDown = (event, table) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const p = toFloor(event)
    drag.current = { id: table.id, dx: p.x - table.x, dy: p.y - table.y, w: table.w, h: table.h, moved: false }
    onSelect(table.id)
  }
  const onPointerMove = (event) => {
    if (!drag.current) return
    const p = toFloor(event)
    const { id, dx, dy, w, h } = drag.current
    const x = Math.min(Math.max(0, snap(p.x - dx)), floor.width - w)
    const y = Math.min(Math.max(0, snap(p.y - dy)), floor.height - h)
    drag.current.moved = true
    onMove(id, { x, y, w, h })
  }
  const onPointerUp = () => {
    drag.current = null
  }

  // Klaviatura bilan ham siljitish mumkin: strelkalar 10px
  const onKeyDown = (event, table) => {
    const step = { ArrowLeft: [-GRID, 0], ArrowRight: [GRID, 0], ArrowUp: [0, -GRID], ArrowDown: [0, GRID] }[event.key]
    if (!step) return
    event.preventDefault()
    onMove(table.id, {
      x: Math.min(Math.max(0, table.x + step[0]), floor.width - table.w),
      y: Math.min(Math.max(0, table.y + step[1]), floor.height - table.h),
      w: table.w,
      h: table.h,
    })
  }

  return (
    <FloorBase floor={floor} svgRef={svgRef} aria-label={t('tables.title')} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      {tables.map((table) => {
        const selected = table.id === selectedId
        const cx = table.x + table.w / 2
        const cy = table.y + table.h / 2
        return (
          <g
            key={table.id}
            role="button"
            tabIndex={0}
            aria-label={t('common.table', { n: table.number })}
            onPointerDown={(e) => onPointerDown(e, table)}
            onKeyDown={(e) => onKeyDown(e, table)}
            onFocus={() => onSelect(table.id)}
            className="cursor-grab touch-none outline-none active:cursor-grabbing"
          >
            {table.shape === 'round' ? (
              <ellipse cx={cx} cy={cy} rx={table.w / 2} ry={table.h / 2} fill={selected ? 'var(--color-tint)' : 'var(--color-surface)'} stroke={selected ? 'var(--color-brand)' : 'var(--color-dim)'} strokeWidth="2" />
            ) : (
              <rect x={table.x} y={table.y} width={table.w} height={table.h} rx="10" fill={selected ? 'var(--color-tint)' : 'var(--color-surface)'} stroke={selected ? 'var(--color-brand)' : 'var(--color-dim)'} strokeWidth="2" />
            )}
            <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="central" className="pointer-events-none fill-ink font-num text-[24px] font-semibold">
              {table.number}
            </text>
            <text x={cx} y={cy + 16} textAnchor="middle" dominantBaseline="central" className="pointer-events-none fill-muted text-[11px] font-semibold">
              {t('hall.seats', { n: table.seats })}
            </text>
          </g>
        )
      })}
    </FloorBase>
  )
}

function TableForm({ table, data, onDone, bare }) {
  const { t } = useT()
  const isNew = !table
  const [form, setForm] = useState(() => ({
    number: table?.number ?? Math.max(0, ...data.tables.map((x) => x.number)) + 1,
    seats: table?.seats ?? 4,
    zoneId: table?.zoneId ?? data.zones[0]?.id,
    shape: table?.shape ?? 'rect',
    waiterId: table?.waiter?.id ?? '',
    w: table?.w ?? 120,
    h: table?.h ?? 84,
  }))
  const [confirm, setConfirm] = useState(null)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const body = () => ({
    number: Number(form.number),
    seats: Number(form.seats),
    zoneId: Number(form.zoneId),
    shape: form.shape,
    w: Number(form.w),
    h: Number(form.h),
    waiterId: form.waiterId ? Number(form.waiterId) : null,
  })
  const save = useAction(
    () => (isNew ? api.post('/tables', { ...body(), x: 20, y: 20 }) : api.patch(`/tables/${table.id}`, body())),
    { invalidate: ['tables', 'hall'], success: isNew ? t('tables.created') : t('tables.updated'), onSuccess: () => isNew && onDone() },
  )
  const remove = useAction(() => api.delete(`/tables/${table.id}`), {
    invalidate: ['tables', 'hall'],
    success: t('tables.deleted'),
    onSuccess: () => {
      setConfirm(null)
      onDone()
    },
  })
  const regenerate = useAction(() => api.post(`/tables/${table.id}/qr`), {
    invalidate: ['tables', 'qr'],
    success: t('tables.qrRegenerated'),
    onSuccess: () => setConfirm(null),
  })

  const fields = (
    <form
      className="grid grid-cols-2 gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
    >
      <Field label={t('tables.number')}>{(p) => <Input {...p} type="number" min="1" value={form.number} onChange={set('number')} />}</Field>
      <Field label={t('tables.seats')}>{(p) => <Input {...p} type="number" min="1" max="40" value={form.seats} onChange={set('seats')} />}</Field>
      <Field label={t('tables.zone')}>
        {(p) => (
          <Select {...p} value={form.zoneId} onChange={set('zoneId')}>
            {data.zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={t('tables.shape')}>
        {(p) => (
          <Select {...p} value={form.shape} onChange={set('shape')}>
            <option value="rect">{t('tables.rect')}</option>
            <option value="round">{t('tables.round')}</option>
          </Select>
        )}
      </Field>
      <Field label={t('tables.width')}>{(p) => <Input {...p} type="number" min="40" max="600" step="10" value={form.w} onChange={set('w')} />}</Field>
      <Field label={t('tables.height')}>{(p) => <Input {...p} type="number" min="40" max="600" step="10" value={form.h} onChange={set('h')} />}</Field>
      <Field label={t('tables.waiter')} className="col-span-2">
        {(p) => (
          <Select {...p} value={form.waiterId} onChange={set('waiterId')}>
            <option value="">{t('tables.noWaiter')}</option>
            {data.waiters.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="col-span-2 flex flex-wrap gap-2">
        <Button type="submit" variant="primary" loading={save.isPending}>
          {t('common.save')}
        </Button>
        {bare && <Button onClick={onDone}>{t('common.cancel')}</Button>}
      </div>
    </form>
  )

  if (bare) return fields

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {t('tables.editTitle', { n: table.number })}
          {table.busy && <Badge tone="brand">{t('tables.busy')}</Badge>}
        </span>
      }
      actions={<Button size="icon" variant="ghost" icon="x" aria-label={t('common.close')} onClick={onDone} />}
    >
      {fields}
      <div className="mt-6 space-y-3 border-t border-line pt-5">
        <p className="truncate text-[12px] text-muted" title={table.qrUrl}>
          QR: {table.qrUrl}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon="qr" onClick={() => setConfirm('qr')}>
            {t('tables.qrRegenerate')}
          </Button>
          <Button size="sm" variant="danger" icon="trash" disabled={table.busy} onClick={() => setConfirm('delete')}>
            {t('tables.delete')}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirm === 'qr'}
        title={t('tables.qrRegenerateTitle', { n: table.number })}
        text={t('tables.qrRegenerateText')}
        loading={regenerate.isPending}
        onConfirm={() => regenerate.mutate()}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        danger
        title={t('tables.deleteTitle', { n: table.number })}
        text={t('tables.deleteText')}
        confirmLabel={t('tables.delete')}
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setConfirm(null)}
      />
    </Card>
  )
}

function ZonesModal({ open, data, onClose }) {
  const { t } = useT()
  const [name, setName] = useState('')
  const add = useAction((body) => api.post('/zones', body), { invalidate: ['tables'], success: t('common.saved'), onSuccess: () => setName('') })
  const rename = useAction(({ id, name: value }) => api.patch(`/zones/${id}`, { name: value }), { invalidate: ['tables'] })
  const remove = useAction((id) => api.delete(`/zones/${id}`), { invalidate: ['tables'], success: t('common.saved') })
  return (
    <Modal open={open} onClose={onClose} title={t('tables.zones')}>
      <ul className="divide-y divide-line">
        {data.zones.map((zone) => {
          const count = data.tables.filter((x) => x.zoneId === zone.id).length
          return (
            <li key={zone.id} className="flex items-center gap-2 py-2.5">
              <Input
                aria-label={t('tables.zoneName')}
                defaultValue={zone.name}
                className="h-9"
                onBlur={(e) => e.target.value.trim() && e.target.value !== zone.name && rename.mutate({ id: zone.id, name: e.target.value.trim() })}
              />
              <span className="w-20 shrink-0 text-right text-[12px] text-muted">{t('tables.zoneTables', { n: count })}</span>
              <Button size="icon" variant="ghost" icon="trash" aria-label={t('common.delete')} disabled={count > 0} onClick={() => remove.mutate(zone.id)} />
            </li>
          )
        })}
      </ul>
      <form
        className="mt-4 flex gap-2 border-t border-line pt-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) add.mutate({ name: name.trim() })
        }}
      >
        <Input className="h-9" placeholder={t('tables.zoneName')} aria-label={t('tables.zoneName')} value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" variant="primary" icon="plus" loading={add.isPending} disabled={!name.trim()}>
          {t('tables.zoneAdd')}
        </Button>
      </form>
    </Modal>
  )
}

function QrModal({ open, onClose }) {
  const { t } = useT()
  const query = useQuery({ queryKey: ['qr'], queryFn: () => api.get('/tables/qr'), enabled: open })

  function print() {
    const cards = query.data.items
      .map(
        (item) =>
          `<div class="card"><div class="qr">${item.svg}</div><p class="n">${t('common.table', { n: item.number })}</p><p class="s">${t('tables.qrScan')}</p></div>`,
      )
      .join('')
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${t('tables.qrTitle')}</title><style>
      body{font-family:Inter,system-ui,sans-serif;margin:24px;color:#18181b}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
      .card{border:1px solid #e2e2e6;border-radius:12px;padding:16px;text-align:center;break-inside:avoid}
      .qr svg{width:160px;height:160px}.n{font-size:22px;font-weight:800;margin:8px 0 4px}.s{font-size:12px;color:#66666f;margin:0}
    </style></head><body><div class="grid">${cards}</div><script>window.onload=()=>window.print()<\/script></body></html>`)
    win.document.close()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('tables.qrTitle')}
      width="max-w-3xl"
      footer={
        <>
          <Button onClick={onClose}>{t('common.close')}</Button>
          <Button variant="primary" icon="print" disabled={!query.data} onClick={print}>
            {t('common.print')}
          </Button>
        </>
      }
    >
      {query.isPending ? (
        <Loader rows={2} />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {query.data?.items.map((item) => (
            <li key={item.tableId} className="rounded-xl border border-line p-3 text-center">
              <div className="mx-auto w-32 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: item.svg }} />
              <p className="mt-2 font-semibold">{t('common.table', { n: item.number })}</p>
              <p className="truncate text-[11px] text-muted">{item.url}</p>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
