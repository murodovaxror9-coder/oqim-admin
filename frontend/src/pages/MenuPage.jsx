import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { PageHeader } from '../components/ui/Card.jsx'
import { Field, Input, Select, Toggle } from '../components/ui/Field.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { ConfirmDialog, Modal } from '../components/ui/Modal.jsx'
import { Empty, QueryState } from '../components/ui/States.jsx'
import { errorText, useT } from '../i18n/index.js'
import { api } from '../lib/api.js'
import { formatMoney } from '../lib/format.js'
import { useAction } from '../lib/useAction.js'

const STATIONS = ['hot', 'grill', 'kazan', 'cold', 'bar']
const UNITS = ['portion', 'skewer', 'piece', 'pot', 'jug', 'glass']

export function MenuPage() {
  const { t, lang } = useT()
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const query = useQuery({ queryKey: ['menu'], queryFn: () => api.get('/menu'), refetchInterval: 30_000 })
  const name = (item) => (lang === 'ru' ? item.nameRu : item.nameUz)

  const availability = useAction(({ id, available }) => api.patch(`/menu/items/${id}/availability`, { available }), {
    invalidate: ['menu', 'today'],
    success: (data) => t(data.available ? 'menu.backOnSale' : 'menu.stopped', { name: name(data) }),
  })
  const batch = useAction((menuItemId) => api.post('/batches', { menuItemId }), {
    invalidate: ['menu', 'today', 'exceptions'],
    success: (data) => t('menu.batchStarted', { name: name(data) }),
  })

  const items = useMemo(() => {
    if (!query.data) return []
    const needle = search.trim().toLowerCase()
    return query.data.items.filter(
      (item) =>
        (category === 'all' || item.categoryId === Number(category)) &&
        (!needle || item.nameUz.toLowerCase().includes(needle) || item.nameRu.toLowerCase().includes(needle)),
    )
  }, [query.data, category, search])

  return (
    <>
      <PageHeader
        title={t('menu.title')}
        subtitle={query.data && t('menu.stats', { n: query.data.items.length, s: query.data.items.filter((i) => !i.available).length })}
        actions={
          <>
            <Button icon="edit" onClick={() => setCategoriesOpen(true)}>
              {t('menu.categories')}
            </Button>
            <Button variant="primary" icon="plus" onClick={() => setEditing({})}>
              {t('menu.add')}
            </Button>
          </>
        }
      />
      <QueryState query={query} rows={5}>
        {(data) => (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap gap-1.5">
                {[{ id: 'all', nameUz: t('menu.allCategories'), nameRu: t('menu.allCategories') }, ...data.categories].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(String(cat.id))}
                    aria-pressed={category === String(cat.id)}
                    className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
                      category === String(cat.id) ? 'bg-navy text-white' : 'border border-rule bg-surface text-muted hover:text-ink'
                    }`}
                  >
                    {name(cat)}
                  </button>
                ))}
              </div>
              <label className="relative ml-auto w-full sm:w-64">
                <Icon name="search" size={18} className="absolute top-2.5 left-3 text-muted" />
                <Input className="pl-9" placeholder={t('menu.search')} aria-label={t('menu.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
            </div>

            <div className="overflow-x-auto rounded-xl border border-line bg-surface">
              {items.length ? (
                <table className="w-full min-w-[820px] text-left">
                  <thead className="text-[12px] text-muted">
                    <tr className="border-b border-line">
                      <th className="px-5 py-3 font-semibold">{t('menu.colName')}</th>
                      <th className="px-3 py-3 text-right font-semibold">{t('menu.colPrice')}</th>
                      <th className="px-3 py-3 font-semibold">{t('menu.colPrep')}</th>
                      <th className="px-3 py-3 font-semibold">{t('menu.colStation')}</th>
                      <th className="px-3 py-3 font-semibold">{t('menu.colStock')}</th>
                      <th className="px-3 py-3 text-right font-semibold">{t('menu.colSold')}</th>
                      <th className="px-3 py-3 font-semibold">{t('menu.colSale')}</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-line last:border-0 hover:bg-mist/50">
                        <td className="px-5 py-3">
                          <span className="block font-semibold">{name(item)}</span>
                          <span className="block text-[12px] text-muted">
                            {lang === 'ru' ? item.nameUz : item.nameRu} · {item.wave === 1 ? t('menu.wave1') : t('menu.wave2')}
                          </span>
                        </td>
                        <td className="num px-3 py-3 text-right text-[16px]">{formatMoney(item.price, lang)}</td>
                        <td className="num px-3 py-3 text-[16px]">{t('menu.perMinute', { n: item.prepMinutes })}</td>
                        <td className="px-3 py-3 text-[13px]">{t(`station.${item.station}`)}</td>
                        <td className="px-3 py-3">
                          {item.batchSize ? (
                            <span className="flex items-center gap-2">
                              <Badge tone={item.batchStock === 0 ? 'late' : item.batchStock <= item.batchWarn ? 'warn' : 'ok'}>
                                <span className="num text-[14px]">
                                  {item.batchStock}/{item.batchSize}
                                </span>
                              </Badge>
                              {item.stopReason !== 'manual' && (
                                <Button size="sm" variant="ghost" icon="pot" loading={batch.isPending && batch.variables === item.id} onClick={() => batch.mutate(item.id)}>
                                  {t('menu.newBatch')}
                                </Button>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="num px-3 py-3 text-right text-[16px]">{item.soldToday}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <Toggle
                              checked={item.available}
                              disabled={availability.isPending && availability.variables?.id === item.id}
                              onChange={(available) => availability.mutate({ id: item.id, available })}
                            />
                            {!item.available && (
                              <Badge tone={item.stopReason === 'batch_empty' ? 'late' : 'neutral'}>
                                {item.stopReason === 'batch_empty' ? t('menu.stopAuto') : t('menu.stopManual')}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditing(item)}>
                            {t('common.edit')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <Empty icon="search" title={t('menu.emptySearch')} />
              )}
            </div>

            <ItemModal item={editing} categories={data.categories} onClose={() => setEditing(null)} />
            <CategoriesModal open={categoriesOpen} categories={data.categories} onClose={() => setCategoriesOpen(false)} />
          </>
        )}
      </QueryState>
    </>
  )
}

const EMPTY = {
  nameUz: '',
  nameRu: '',
  categoryId: '',
  price: '',
  prepMinutes: '',
  station: 'hot',
  wave: 2,
  unit: 'portion',
  batch: false,
  batchSize: '',
  batchWarn: '',
  batchCookMinutes: '',
  ikpu: '',
}

function ItemModal({ item, categories, onClose }) {
  const { t, lang } = useT()
  const open = Boolean(item)
  const isNew = open && !item.id
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [lastId, setLastId] = useState(undefined)

  // Modal ochilganda forma taomdan to'ldiriladi
  if (open && lastId !== (item.id ?? 'new')) {
    setLastId(item.id ?? 'new')
    setErrors({})
    setForm(
      item.id
        ? {
            ...EMPTY,
            ...item,
            price: String(item.price),
            prepMinutes: String(item.prepMinutes),
            batch: Boolean(item.batchSize),
            batchSize: item.batchSize ?? '',
            batchWarn: item.batchWarn ?? '',
            batchCookMinutes: item.batchCookMinutes ?? '',
            ikpu: item.ikpu ?? '',
          }
        : { ...EMPTY, categoryId: String(categories[0]?.id ?? '') },
    )
  }
  if (!open && lastId !== undefined) setLastId(undefined)

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event?.target ? event.target.value : event }))
  const close = () => onClose()

  const save = useAction((body) => (isNew ? api.post('/menu/items', body) : api.patch(`/menu/items/${item.id}`, body)), {
    invalidate: ['menu', 'today'],
    success: isNew ? t('menu.created') : t('menu.updated'),
    onSuccess: close,
  })
  const archive = useAction(() => api.delete(`/menu/items/${item.id}`), {
    invalidate: ['menu'],
    success: t('common.saved'),
    onSuccess: () => {
      setConfirmArchive(false)
      close()
    },
  })

  function submit(event) {
    event.preventDefault()
    const next = {}
    if (!form.nameUz.trim()) next.nameUz = t('common.required')
    if (!form.nameRu.trim()) next.nameRu = t('common.required')
    if (form.price === '' || Number(form.price) < 0) next.price = t('common.required')
    if (form.prepMinutes === '') next.prepMinutes = t('common.required')
    if (form.ikpu && !/^\d{17}$/.test(form.ikpu)) next.ikpu = t('menu.ikpuHint')
    if (form.batch) {
      if (!Number(form.batchSize)) next.batchSize = t('common.required')
      if (form.batchWarn === '') next.batchWarn = t('common.required')
      else if (Number(form.batchWarn) >= Number(form.batchSize)) next.batchWarn = t('errors.batch_warn')
      if (!Number(form.batchCookMinutes)) next.batchCookMinutes = t('common.required')
    }
    setErrors(next)
    if (Object.keys(next).length) return
    save.mutate({
      nameUz: form.nameUz.trim(),
      nameRu: form.nameRu.trim(),
      categoryId: Number(form.categoryId),
      price: Number(form.price),
      prepMinutes: Number(form.prepMinutes),
      station: form.station,
      wave: Number(form.wave),
      unit: form.unit,
      batchSize: form.batch ? Number(form.batchSize) : null,
      batchWarn: form.batch ? Number(form.batchWarn) : null,
      batchCookMinutes: form.batch ? Number(form.batchCookMinutes) : null,
      ikpu: form.ikpu || null,
    })
  }

  return (
    <>
      <Modal
        open={open}
        onClose={close}
        title={isNew ? t('menu.addTitle') : t('menu.editTitle')}
        width="max-w-2xl"
        footer={
          <>
            {!isNew && (
              <Button variant="danger" icon="trash" className="mr-auto" onClick={() => setConfirmArchive(true)}>
                {t('menu.archive')}
              </Button>
            )}
            <Button onClick={close}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" form="menu-item-form" loading={save.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="menu-item-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label={t('menu.nameUz')} error={errors.nameUz}>
            {(p) => <Input {...p} value={form.nameUz} onChange={set('nameUz')} />}
          </Field>
          <Field label={t('menu.nameRu')} error={errors.nameRu}>
            {(p) => <Input {...p} value={form.nameRu} onChange={set('nameRu')} />}
          </Field>
          <Field label={t('menu.category')}>
            {(p) => (
              <Select {...p} value={form.categoryId} onChange={set('categoryId')}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {lang === 'ru' ? c.nameRu : c.nameUz}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('menu.price')} error={errors.price}>
            {(p) => <Input {...p} type="number" min="0" step="500" inputMode="numeric" value={form.price} onChange={set('price')} />}
          </Field>
          <Field label={t('menu.prepMinutes')} error={errors.prepMinutes}>
            {(p) => <Input {...p} type="number" min="0" max="240" value={form.prepMinutes} onChange={set('prepMinutes')} />}
          </Field>
          <Field label={t('menu.station')}>
            {(p) => (
              <Select {...p} value={form.station} onChange={set('station')}>
                {STATIONS.map((s) => (
                  <option key={s} value={s}>
                    {t(`station.${s}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('menu.wave')} hint={t('menu.waveHint')}>
            {(p) => (
              <Select {...p} value={form.wave} onChange={set('wave')}>
                <option value={1}>{t('menu.wave1')}</option>
                <option value={2}>{t('menu.wave2')}</option>
              </Select>
            )}
          </Field>
          <Field label={t('menu.unit')}>
            {(p) => (
              <Select {...p} value={form.unit} onChange={set('unit')}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {t(`unit.${u}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('menu.ikpu')} hint={t('menu.ikpuHint')} error={errors.ikpu} className="sm:col-span-2">
            {(p) => <Input {...p} inputMode="numeric" maxLength={17} className="num text-[16px]" value={form.ikpu} onChange={set('ikpu')} />}
          </Field>
          <div className="rounded-xl bg-mist p-4 sm:col-span-2">
            <Toggle checked={form.batch} onChange={set('batch')} label={t('menu.batch')} description={t('menu.batchHint')} />
            {form.batch && (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Field label={t('menu.batchSize')} error={errors.batchSize}>
                  {(p) => <Input {...p} type="number" min="1" value={form.batchSize} onChange={set('batchSize')} />}
                </Field>
                <Field label={t('menu.batchWarn')} error={errors.batchWarn}>
                  {(p) => <Input {...p} type="number" min="0" value={form.batchWarn} onChange={set('batchWarn')} />}
                </Field>
                <Field label={t('menu.batchCook')} error={errors.batchCookMinutes}>
                  {(p) => <Input {...p} type="number" min="1" value={form.batchCookMinutes} onChange={set('batchCookMinutes')} />}
                </Field>
              </div>
            )}
          </div>
          {save.isError && <p className="text-[13px] font-medium text-late-ink sm:col-span-2">{errorText(t, save.error)}</p>}
        </form>
      </Modal>
      <ConfirmDialog
        open={confirmArchive}
        danger
        title={t('menu.archiveTitle', { name: item ? (lang === 'ru' ? item.nameRu : item.nameUz) : '' })}
        text={t('menu.archiveText')}
        confirmLabel={t('menu.archive')}
        loading={archive.isPending}
        onConfirm={() => archive.mutate()}
        onClose={() => setConfirmArchive(false)}
      />
    </>
  )
}

function CategoriesModal({ open, categories, onClose }) {
  const { t } = useT()
  const [draft, setDraft] = useState({ nameUz: '', nameRu: '' })
  const add = useAction((body) => api.post('/menu/categories', body), {
    invalidate: ['menu'],
    success: t('common.saved'),
    onSuccess: () => setDraft({ nameUz: '', nameRu: '' }),
  })
  const remove = useAction((id) => api.delete(`/menu/categories/${id}`), { invalidate: ['menu'], success: t('common.saved') })
  const rename = useAction(({ id, ...body }) => api.patch(`/menu/categories/${id}`, body), { invalidate: ['menu'] })

  return (
    <Modal open={open} onClose={onClose} title={t('menu.categoryManage')} width="max-w-xl">
      <ul className="divide-y divide-line">
        {categories.map((cat) => (
          <li key={cat.id} className="flex items-center gap-2 py-2.5">
            <Input
              aria-label={t('menu.nameUz')}
              defaultValue={cat.nameUz}
              className="h-9"
              onBlur={(e) => e.target.value.trim() && e.target.value !== cat.nameUz && rename.mutate({ id: cat.id, nameUz: e.target.value.trim() })}
            />
            <Input
              aria-label={t('menu.nameRu')}
              defaultValue={cat.nameRu}
              className="h-9"
              onBlur={(e) => e.target.value.trim() && e.target.value !== cat.nameRu && rename.mutate({ id: cat.id, nameRu: e.target.value.trim() })}
            />
            <span className="w-20 shrink-0 text-right text-[12px] text-muted">{t('menu.categoryItems', { n: cat.items })}</span>
            <Button
              size="icon"
              variant="ghost"
              icon="trash"
              aria-label={t('common.delete')}
              disabled={cat.items > 0}
              loading={remove.isPending && remove.variables === cat.id}
              onClick={() => remove.mutate(cat.id)}
            />
          </li>
        ))}
      </ul>
      <form
        className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (draft.nameUz.trim() && draft.nameRu.trim()) add.mutate({ nameUz: draft.nameUz.trim(), nameRu: draft.nameRu.trim() })
        }}
      >
        <Input className="h-9 flex-1" placeholder={t('menu.nameUz')} aria-label={t('menu.nameUz')} value={draft.nameUz} onChange={(e) => setDraft((d) => ({ ...d, nameUz: e.target.value }))} />
        <Input className="h-9 flex-1" placeholder={t('menu.nameRu')} aria-label={t('menu.nameRu')} value={draft.nameRu} onChange={(e) => setDraft((d) => ({ ...d, nameRu: e.target.value }))} />
        <Button type="submit" variant="primary" icon="plus" loading={add.isPending} disabled={!draft.nameUz.trim() || !draft.nameRu.trim()}>
          {t('menu.categoryAdd')}
        </Button>
      </form>
    </Modal>
  )
}
