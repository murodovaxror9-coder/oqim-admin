import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { db } from '../db/index.js'
import { audit } from '../lib/audit.js'
import { ADMIN_ROLES, normalizePhone } from '../lib/auth.js'
import { HttpError, conflict, notFound } from '../lib/http.js'
import { route } from '../lib/openapi.js'
import { IdParams, PinResult, StaffCreate, StaffData, StaffMember, StaffUpdate } from '../schemas.js'
import { taskStats, todayRange } from '../services/reports.js'

// Rollar va huquqlar jadvali (TZ dagi matritsa)
const ROLES_MATRIX = [
  ['take_orders', { waiter: 'yes', cook: 'no', cashier: 'no', admin: 'yes', owner: 'yes' }],
  ['kitchen_queue', { waiter: 'no', cook: 'own_station', cashier: 'no', admin: 'yes', owner: 'yes' }],
  ['cancel_item', { waiter: 'with_approval', cook: 'no', cashier: 'no', admin: 'yes', owner: 'yes' }],
  ['stoplist', { waiter: 'no', cook: 'own_station', cashier: 'no', admin: 'yes', owner: 'yes' }],
  ['accept_payment', { waiter: 'no', cook: 'no', cashier: 'yes', admin: 'yes', owner: 'yes' }],
  ['discount', { waiter: 'no', cook: 'no', cashier: 'with_approval', admin: 'yes', owner: 'yes' }],
  ['cash_out', { waiter: 'no', cook: 'no', cashier: 'with_approval', admin: 'yes', owner: 'yes' }],
  ['menu_prices', { waiter: 'no', cook: 'no', cashier: 'no', admin: 'yes', owner: 'yes' }],
  ['reports', { waiter: 'own_results', cook: 'own_results', cashier: 'own_shift', admin: 'yes', owner: 'yes' }],
  ['staff', { waiter: 'no', cook: 'no', cashier: 'no', admin: 'yes', owner: 'yes' }],
  ['rules_settings', { waiter: 'no', cook: 'no', cashier: 'no', admin: 'no', owner: 'yes' }],
  ['audit', { waiter: 'no', cook: 'no', cashier: 'no', admin: 'yes', owner: 'yes' }],
].map(([permission, values]) => ({ permission, values }))

const newPin = () => String(crypto.randomInt(1000, 10000))

function staffView(row, now = Date.now()) {
  const { start } = todayRange(now)
  const stats = row.role === 'waiter' ? taskStats(start, now, row.id) : null
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    role: row.role,
    post: row.post,
    shiftStart: row.shift_start,
    onShift: Boolean(row.shift_started_at),
    shiftStartedAt: row.shift_started_at,
    blocked: Boolean(row.blocked),
    tables: db.prepare('SELECT number FROM tables WHERE waiter_id = ? AND active = 1 ORDER BY number').all(row.id).map((t) => t.number),
    today: { tasks: stats?.count ?? 0, avgSeconds: stats?.avgSeconds ?? null, latePercent: stats?.latePercent ?? 0 },
  }
}

const getUser = (id) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  if (!row) throw notFound('user_not_found')
  return row
}

// Administrator faqat ofitsiant, kassir va oshpazni boshqaradi; egani va boshqa adminni faqat ega
function checkManage(actor, role) {
  if (actor.role !== 'owner' && ADMIN_ROLES.includes(role)) {
    throw new HttpError(403, 'forbidden', "Administratorni faqat ega boshqaradi")
  }
}

const phoneOf = (value) => {
  const phone = normalizePhone(value)
  if (!phone) throw new HttpError(400, 'bad_phone', "Telefon raqam noto'g'ri")
  return phone
}

function checkPhone(phone, exceptId = 0) {
  if (db.prepare('SELECT 1 FROM users WHERE phone = ? AND id != ?').get(phone, exceptId)) {
    throw conflict('phone_taken', "Bu raqam boshqa xodimda bor")
  }
}

route(
  'get',
  '/staff',
  { tag: 'Xodimlar', summary: 'Xodimlar va rollar jadvali', operationId: 'staff', roles: ADMIN_ROLES, response: StaffData },
  () => ({
    users: db
      .prepare("SELECT * FROM users ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'waiter' THEN 2 WHEN 'cashier' THEN 3 ELSE 4 END, id")
      .all()
      .map((row) => staffView(row)),
    roles: ROLES_MATRIX,
  }),
)

route(
  'post',
  '/staff',
  {
    tag: 'Xodimlar',
    summary: "Xodim qo'shish",
    description: "PIN avtomatik yaratiladi va javobda bir marta ko'rsatiladi. Xodimga SMS yoki og'zaki yetkaziladi.",
    operationId: 'createStaff',
    roles: ADMIN_ROLES,
    body: StaffCreate,
    response: PinResult,
    status: 201,
    errors: [409],
  },
  (req) => {
    const body = req.valid.body
    checkManage(req.user, body.role)
    const phone = phoneOf(body.phone)
    checkPhone(phone)
    const pin = newPin()
    const id = Number(
      db
        .prepare('INSERT INTO users (name, phone, role, pin_hash, post, shift_start, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(body.name, phone, body.role, bcrypt.hashSync(pin, 8), body.post, body.shiftStart, Date.now()).lastInsertRowid,
    )
    audit({ actor: req.user, category: 'staff', action: 'staff.created', target: { type: 'user', name: body.name }, params: { role: body.role } })
    return { user: staffView(getUser(id)), pin }
  },
)

route(
  'patch',
  '/staff/:id',
  { tag: 'Xodimlar', summary: 'Xodimni tahrirlash', operationId: 'updateStaff', roles: ADMIN_ROLES, params: IdParams, body: StaffUpdate, response: StaffMember, errors: [404, 409] },
  (req) => {
    const row = getUser(req.valid.params.id)
    const body = req.valid.body
    checkManage(req.user, row.role)
    if (body.role) checkManage(req.user, body.role)
    if (row.id === req.user.id && body.role && body.role !== row.role) throw conflict('own_role', "O'z rolingizni o'zgartirib bo'lmaydi")
    if (row.role === 'waiter' && body.role && body.role !== 'waiter') {
      const tables = db.prepare('SELECT COUNT(*) AS n FROM tables WHERE waiter_id = ? AND active = 1').get(row.id).n
      if (tables) throw conflict('waiter_has_tables', 'Avval stollarni boshqa ofitsiantga biriktiring')
    }
    const phone = body.phone ? phoneOf(body.phone) : row.phone
    checkPhone(phone, row.id)
    db.prepare('UPDATE users SET name = ?, phone = ?, role = ?, post = ?, shift_start = ? WHERE id = ?').run(
      body.name ?? row.name,
      phone,
      body.role ?? row.role,
      body.post !== undefined ? body.post : row.post,
      body.shiftStart !== undefined ? body.shiftStart : row.shift_start,
      row.id,
    )
    const changed = Object.keys(body)
    audit({
      actor: req.user,
      category: 'staff',
      action: body.role && body.role !== row.role ? 'staff.role_changed' : 'staff.updated',
      target: { type: 'user', name: body.name ?? row.name },
      params: body.role && body.role !== row.role ? { from: row.role, to: body.role } : { fields: changed },
    })
    return staffView(getUser(row.id))
  },
)

function setBlocked(req, blocked) {
  const row = getUser(req.valid.params.id)
  checkManage(req.user, row.role)
  if (row.id === req.user.id) throw conflict('own_account', "O'zingizni bloklab bo'lmaydi")
  if (blocked && row.role === 'waiter' && db.prepare('SELECT 1 FROM tasks WHERE waiter_id = ? AND done_at IS NULL').get(row.id)) {
    throw conflict('has_open_tasks', 'Xodimda ochiq vazifalar bor. Avval ularni boshqaga bering')
  }
  db.prepare('UPDATE users SET blocked = ?, shift_started_at = CASE WHEN ? THEN NULL ELSE shift_started_at END WHERE id = ?').run(
    blocked ? 1 : 0,
    blocked ? 1 : 0,
    row.id,
  )
  audit({ actor: req.user, category: 'staff', action: blocked ? 'staff.blocked' : 'staff.unblocked', target: { type: 'user', name: row.name } })
  return staffView(getUser(row.id))
}

route(
  'post',
  '/staff/:id/block',
  {
    tag: 'Xodimlar',
    summary: 'Xodimni bloklash',
    description: "Bloklangan xodim tizimga kira olmaydi. Ochiq vazifasi bor ofitsiantni bloklab bo'lmaydi.",
    operationId: 'blockStaff',
    roles: ADMIN_ROLES,
    params: IdParams,
    response: StaffMember,
    errors: [404, 409],
  },
  (req) => setBlocked(req, true),
)

route(
  'post',
  '/staff/:id/unblock',
  { tag: 'Xodimlar', summary: 'Blokdan chiqarish', operationId: 'unblockStaff', roles: ADMIN_ROLES, params: IdParams, response: StaffMember, errors: [404, 409] },
  (req) => setBlocked(req, false),
)

route(
  'post',
  '/staff/:id/reset-pin',
  { tag: 'Xodimlar', summary: 'Yangi PIN berish', operationId: 'resetPin', roles: ADMIN_ROLES, params: IdParams, response: PinResult, errors: [404] },
  (req) => {
    const row = getUser(req.valid.params.id)
    checkManage(req.user, row.role)
    const pin = newPin()
    db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(bcrypt.hashSync(pin, 8), row.id)
    audit({ actor: req.user, category: 'staff', action: 'staff.pin_reset', target: { type: 'user', name: row.name } })
    return { user: staffView(getUser(row.id)), pin }
  },
)
