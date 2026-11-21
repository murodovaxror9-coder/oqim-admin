import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Card, PageHeader } from '../components/ui/Card.jsx'
import { Field, Input, Select } from '../components/ui/Field.jsx'
import { ConfirmDialog, Modal } from '../components/ui/Modal.jsx'
import { Segmented } from '../components/ui/Segmented.jsx'
import { StatTile } from '../components/ui/Stat.jsx'
import { QueryState } from '../components/ui/States.jsx'
import { errorText, useT } from '../i18n/index.js'
import { api } from '../lib/api.js'
import { formatDuration, formatPhone } from '../lib/format.js'
import { localTime } from '../lib/time.js'
import { useAction } from '../lib/useAction.js'
import { useAuth } from '../store/auth.js'
import { useCardTable } from '../lib/useCardTable.js'

const ROLE_ORDER = ['waiter', 'cook', 'cashier', 'admin', 'owner']
const POSTS = { cook: ['hot', 'grill', 'kazan', 'cold', 'bar'] }

export function StaffPage() {
  const { t } = useT()
  const [tab, setTab] = useState('people')
  const [editing, setEditing] = useState(null)
  const [pin, setPin] = useState(null)
  const query = useQuery({ queryKey: ['staff'], queryFn: () => api.get('/staff'), refetchInterval: 30_000 })

  return (
    <>
      <PageHeader
        title={t('staff.title')}
        actions={
          <>
            <Segmented
              label={t('staff.title')}
              value={tab}
              onChange={setTab}
              options={[
                { value: 'people', label: t('staff.tabPeople') },
                { value: 'roles', label: t('staff.tabRoles') },
              ]}
            />
            <Button variant="primary" icon="plus" onClick={() => setEditing({})}>
              {t('staff.add')}
            </Button>
          </>
        }
      />
      <QueryState query={query} rows={5}>
        {(data) =>
          tab === 'people' ? (
            <>
              <Summary users={data.users} />
              <People users={data.users} onEdit={setEditing} onPin={setPin} />
            </>
          ) : (
            <RolesMatrix roles={data.roles} />
          )
        }
      </QueryState>
      <StaffModal user={editing} onClose={() => setEditing(null)} onPin={setPin} />
      <Modal
        open={Boolean(pin)}
        onClose={() => setPin(null)}
        title={t('staff.pinTitle')}
        width="max-w-sm"
        footer={
          <Button variant="primary" onClick={() => setPin(null)}>
            {t('common.close')}
          </Button>
        }
      >
        {pin && (
          <div className="text-center">
            <p className="font-semibold">{pin.name}</p>
            <p className="num my-4 text-[56px] leading-none tracking-[0.3em] text-ink">{pin.pin}</p>
            <p className="text-[13px] text-muted">{t('staff.pinHint')}</p>
          </div>
        )}
      </Modal>
    </>
  )
}

function Summary({ users }) {
  const { t } = useT()
  const active = users.filter((u) => !u.blocked)
  const onShift = active.filter((u) => u.onShift)
  const waiters = active.filter((u) => u.role === 'waiter')
  const waitersOn = waiters.filter((u) => u.onShift)
  const blocked = users.length - active.length
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatTile label={t('staff.sumTotal')} value={users.length} />
      <StatTile label={t('staff.sumOnShift')} value={onShift.length} sub={t('staff.sumOf', { n: active.length })} />
      <StatTile
        label={t('staff.sumWaiters')}
        value={waitersOn.length}
        sub={t('staff.sumOf', { n: waiters.length })}
        tone={waiters.length > 0 && waitersOn.length === 0 ? 'warn' : undefined}
      />
      <StatTile label={t('staff.sumBlocked')} value={blocked} />
    </div>
  )
}

function People({ users, onEdit, onPin }) {
  const { t } = useT()
  const staffTable = useCardTable()
  const me = useAuth((s) => s.user)
  const [confirm, setConfirm] = useState(null)
  const block = useAction(({ id, blocked }) => api.post(`/staff/${id}/${blocked ? 'block' : 'unblock'}`), {
    invalidate: ['staff', 'hall'],
    success: (data) => t(data.blocked ? 'staff.blockedToast' : 'staff.unblockedToast', { name: data.name }),
    onSuccess: () => setConfirm(null),
  })
  const reset = useAction((id) => api.post(`/staff/${id}/reset-pin`), {
    invalidate: ['staff'],
    onSuccess: (data) => {
      setConfirm(null)
      onPin({ name: data.user.name, pin: data.pin })
    },
  })
  const canManage = (user) => me?.role === 'owner' || !['owner', 'admin'].includes(user.role)

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table ref={staffTable} className="rtable w-full min-w-[880px] text-left">
          <thead className="text-[12px] text-muted">
            <tr className="border-b border-line">
              <th className="px-5 py-3 font-semibold">{t('staff.colName')}</th>
              <th className="px-3 py-3 font-semibold">{t('staff.colRole')}</th>
              <th className="px-3 py-3 font-semibold">{t('staff.colPhone')}</th>
              <th className="px-3 py-3 font-semibold">{t('staff.colShift')}</th>
              <th className="px-3 py-3 font-semibold">{t('staff.colToday')}</th>
              <th className="px-5 py-3 text-right font-semibold">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className={`border-b border-line last:border-0 ${user.blocked ? 'bg-mist/60' : ''}`}>
                <td className="px-5 py-3">
                  <span className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-tint text-[13px] font-semibold text-brand">
                      {user.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                    </span>
                    <span>
                      <span className={`block font-semibold ${user.blocked ? 'text-muted line-through' : ''}`}>{user.name}</span>
                      <span className="block text-[12px] text-muted">
                        {[
                          user.post && (POSTS.cook.includes(user.post) ? t(`station.${user.post}`) : user.post),
                          user.tables.length > 0 && t('staff.tables', { list: user.tables.join(', ') }),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="px-3 py-3">
                  <Badge tone={user.role === 'owner' ? 'dark' : user.role === 'admin' ? 'brand' : 'neutral'}>{t(`roles.${user.role}`)}</Badge>
                </td>
                <td className="num px-3 py-3 text-[15px]">{formatPhone(user.phone)}</td>
                <td className="px-3 py-3 text-[13px]">
                  {user.blocked ? (
                    <Badge tone="late">{t('staff.blocked')}</Badge>
                  ) : user.onShift ? (
                    <Badge tone="ok" dot>
                      {t('staff.onShift', { time: localTime(user.shiftStartedAt) })}
                    </Badge>
                  ) : user.shiftStart ? (
                    <span className="text-muted">
                      {t('staff.offShift')} · <span className="num text-[14px]">{user.shiftStart}</span>
                    </span>
                  ) : (
                    <span className="text-muted">{user.role === 'owner' ? '—' : t('staff.dayOff')}</span>
                  )}
                </td>
                <td className="px-3 py-3 text-[13px] text-muted">
                  {user.role === 'waiter' && user.today.tasks > 0
                    ? t('staff.todayStats', {
                        n: user.today.tasks,
                        avg: formatDuration(user.today.avgSeconds),
                        late: String(user.today.latePercent).replace('.', ','),
                      })
                    : '—'}
                </td>
                <td className="px-5 py-3">
                  {canManage(user) && (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" icon="edit" onClick={() => onEdit(user)}>
                        {t('common.edit')}
                      </Button>
                      <Button size="sm" variant="ghost" icon="key" onClick={() => setConfirm({ type: 'pin', user })}>
                        {t('staff.resetPin')}
                      </Button>
                      {user.id !== me?.id &&
                        (user.blocked ? (
                          <Button size="sm" variant="ghost" icon="lock" onClick={() => block.mutate({ id: user.id, blocked: false })}>
                            {t('staff.unblock')}
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" icon="lock" onClick={() => setConfirm({ type: 'block', user })}>
                            {t('staff.block')}
                          </Button>
                        ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={confirm?.type === 'block'}
        danger
        title={t('staff.blockTitle', { name: confirm?.user.name })}
        text={t('staff.blockText')}
        confirmLabel={t('staff.block')}
        loading={block.isPending}
        onConfirm={() => block.mutate({ id: confirm.user.id, blocked: true })}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.type === 'pin'}
        title={t('staff.resetTitle', { name: confirm?.user.name })}
        text={t('staff.resetText')}
        confirmLabel={t('staff.resetPin')}
        loading={reset.isPending}
        onConfirm={() => reset.mutate(confirm.user.id)}
        onClose={() => setConfirm(null)}
      />
    </>
  )
}

function RolesMatrix({ roles }) {
  const { t } = useT()
  const tone = { yes: 'ok', no: null, own_station: 'brand', with_approval: 'warn', own_results: 'brand', own_shift: 'brand' }
  return (
    <Card title={t('staff.roleMatrix')} bodyClassName="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left">
        <thead className="text-[12px] text-muted">
          <tr className="border-b border-line">
            <th className="px-5 py-3 font-semibold">{t('staff.permission')}</th>
            {ROLE_ORDER.map((role) => (
              <th key={role} className="px-3 py-3 text-center font-semibold">
                {t(`roles.${role}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roles.map((row) => (
            <tr key={row.permission} className="border-b border-line last:border-0">
              <td className="px-5 py-3 font-medium">{t(`staff.permissions.${row.permission}`)}</td>
              {ROLE_ORDER.map((role) => {
                const value = row.values[role]
                return (
                  <td key={role} className="px-3 py-3 text-center">
                    {tone[value] ? <Badge tone={tone[value]}>{t(`staff.values.${value}`)}</Badge> : <span className="text-dim">—</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

const EMPTY = { name: '', phone: '', role: 'waiter', post: '', shiftStart: '10:00' }

function StaffModal({ user, onClose, onPin }) {
  const { t } = useT()
  const me = useAuth((s) => s.user)
  const open = Boolean(user)
  const isNew = open && !user.id
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [loadedFor, setLoadedFor] = useState(undefined)
  const key = open ? (user.id ?? 'new') : undefined
  if (key !== loadedFor) {
    setLoadedFor(key)
    setErrors({})
    if (open) setForm(user.id ? { name: user.name, phone: formatPhone(user.phone), role: user.role, post: user.post ?? '', shiftStart: user.shiftStart ?? '' } : EMPTY)
  }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const roles = ROLE_ORDER.filter((role) => me?.role === 'owner' || !['owner', 'admin'].includes(role))

  const save = useAction((body) => (isNew ? api.post('/staff', body) : api.patch(`/staff/${user.id}`, body)), {
    invalidate: ['staff', 'hall', 'tables'],
    success: isNew ? t('staff.created') : t('staff.updated'),
    onSuccess: (data) => {
      onClose()
      if (data.pin) onPin({ name: data.user.name, pin: data.pin })
    },
  })

  function submit(event) {
    event.preventDefault()
    const next = {}
    if (form.name.trim().length < 2) next.name = t('common.required')
    if (form.phone.replace(/\D/g, '').length < 9) next.phone = t('errors.bad_phone')
    setErrors(next)
    if (Object.keys(next).length) return
    save.mutate({ name: form.name.trim(), phone: form.phone, role: form.role, post: form.post || null, shiftStart: form.shiftStart || null })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? t('staff.addTitle') : t('staff.editTitle')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" form="staff-form" loading={save.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="staff-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label={t('staff.name')} error={errors.name} className="sm:col-span-2">
          {(p) => <Input {...p} value={form.name} onChange={set('name')} />}
        </Field>
        <Field label={t('staff.phone')} error={errors.phone}>
          {(p) => <Input {...p} type="tel" placeholder="+998 90 123 45 67" value={form.phone} onChange={set('phone')} />}
        </Field>
        <Field label={t('staff.role')} hint={me?.role !== 'owner' ? t('staff.adminOnlyOwner') : undefined}>
          {(p) => (
            <Select {...p} value={form.role} onChange={set('role')} disabled={!isNew && user?.id === me?.id}>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {t(`roles.${role}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('staff.post')} hint={t('common.optional')}>
          {(p) =>
            form.role === 'cook' ? (
              <Select {...p} value={form.post} onChange={set('post')}>
                <option value="">—</option>
                {POSTS.cook.map((post) => (
                  <option key={post} value={post}>
                    {t(`station.${post}`)}
                  </option>
                ))}
              </Select>
            ) : (
              <Input {...p} value={form.post} onChange={set('post')} />
            )
          }
        </Field>
        <Field label={t('staff.shiftStart')} hint={t('common.optional')}>
          {(p) => <Input {...p} type="time" value={form.shiftStart} onChange={set('shiftStart')} />}
        </Field>
        {save.isError && <p className="text-[13px] font-medium text-late-ink sm:col-span-2">{errorText(t, save.error)}</p>}
      </form>
    </Modal>
  )
}
