import QRCode from 'qrcode'
import { config } from '../config.js'
import { db } from '../db/index.js'
import { newQrToken } from '../db/seed.js'
import { audit } from '../lib/audit.js'
import { ADMIN_ROLES } from '../lib/auth.js'
import { HttpError, conflict, notFound } from '../lib/http.js'
import { route } from '../lib/openapi.js'
import {
  IdParams,
  LayoutBody,
  Ok,
  QrList,
  TableCreate,
  TableItem,
  TableUpdate,
  TableWaiterBody,
  TablesData,
  ZoneBody,
} from '../schemas.js'
import { setTableWaiter } from '../services/operations.js'
import { getSettings } from '../services/settings.js'

const COLUMNS = { number: 'number', zoneId: 'zone_id', seats: 'seats', shape: 'shape', x: 'x', y: 'y', w: 'w', h: 'h', waiterId: 'waiter_id' }
const qrUrl = (token) => `${config.guestBaseUrl}/${token}`

function tableView(row) {
  return {
    id: row.id,
    number: row.number,
    zoneId: row.zone_id,
    seats: row.seats,
    shape: row.shape,
    x: row.x,
    y: row.y,
    w: row.w,
    h: row.h,
    waiter: row.waiter_id ? { id: row.waiter_id, name: row.waiter_name } : null,
    qrUrl: qrUrl(row.qr_token),
    busy: Boolean(row.busy),
  }
}

const SELECT = `SELECT t.*, u.name AS waiter_name,
  EXISTS (SELECT 1 FROM orders o WHERE o.table_id = t.id AND o.status = 'open') AS busy
  FROM tables t LEFT JOIN users u ON u.id = t.waiter_id`

const getTable = (id) => {
  const row = db.prepare(`${SELECT} WHERE t.id = ? AND t.active = 1`).get(id)
  if (!row) throw notFound('table_not_found')
  return row
}

function checkRefs({ zoneId, waiterId, number }, exceptId = null) {
  if (zoneId !== undefined && !db.prepare('SELECT 1 FROM zones WHERE id = ?').get(zoneId)) {
    throw new HttpError(400, 'zone_not_found', 'Zona topilmadi')
  }
  if (waiterId && db.prepare('SELECT role FROM users WHERE id = ?').get(waiterId)?.role !== 'waiter') {
    throw new HttpError(400, 'waiter_not_found', 'Ofitsiant topilmadi')
  }
  if (number !== undefined && db.prepare('SELECT 1 FROM tables WHERE number = ? AND active = 1 AND id != ?').get(number, exceptId ?? 0)) {
    throw conflict('table_number_taken', `${number}-stol allaqachon bor`)
  }
}

function checkBounds(table) {
  const { floor } = getSettings()
  if (table.x + table.w > floor.width || table.y + table.h > floor.height) {
    throw new HttpError(400, 'out_of_floor', 'Stol zal chegarasidan chiqib ketdi')
  }
}

route(
  'get',
  '/tables',
  { tag: 'Zal va stollar', summary: 'Zonalar, stollar va zal o\'lchami', operationId: 'tables', roles: ADMIN_ROLES, response: TablesData },
  () => ({
    zones: db.prepare('SELECT id, name, sort FROM zones ORDER BY sort, id').all(),
    tables: db.prepare(`${SELECT} WHERE t.active = 1 ORDER BY t.number`).all().map(tableView),
    floor: getSettings().floor,
    waiters: db.prepare("SELECT id, name FROM users WHERE role = 'waiter' AND blocked = 0 ORDER BY id").all(),
  }),
)

route(
  'post',
  '/tables',
  { tag: 'Zal va stollar', summary: "Stol qo'shish", operationId: 'createTable', roles: ADMIN_ROLES, body: TableCreate, response: TableItem, status: 201, errors: [409] },
  (req) => {
    const body = req.valid.body
    checkRefs(body)
    checkBounds(body)
    const keys = Object.keys(COLUMNS)
    const id = Number(
      db
        .prepare(`INSERT INTO tables (${keys.map((k) => COLUMNS[k]).join(', ')}, qr_token) VALUES (${keys.map(() => '?').join(', ')}, ?)`)
        .run(...keys.map((k) => body[k] ?? null), newQrToken()).lastInsertRowid,
    )
    audit({ actor: req.user, category: 'tables', action: 'table.created', target: { type: 'table', number: body.number }, params: { seats: body.seats } })
    return tableView(getTable(id))
  },
)

route(
  'patch',
  '/tables/:id',
  { tag: 'Zal va stollar', summary: 'Stolni tahrirlash', operationId: 'updateTable', roles: ADMIN_ROLES, params: IdParams, body: TableUpdate, response: TableItem, errors: [404, 409] },
  (req) => {
    const row = getTable(req.valid.params.id)
    const body = req.valid.body
    checkRefs(body, row.id)
    checkBounds({ x: body.x ?? row.x, y: body.y ?? row.y, w: body.w ?? row.w, h: body.h ?? row.h })
    const keys = Object.keys(body).filter((k) => COLUMNS[k] && k !== 'waiterId')
    if (keys.length) db.prepare(`UPDATE tables SET ${keys.map((k) => `${COLUMNS[k]} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => body[k]), row.id)
    if (body.waiterId !== undefined && body.waiterId !== row.waiter_id) db.transaction(() => setTableWaiter(row.id, body.waiterId, req.user))()
    if (keys.length) audit({ actor: req.user, category: 'tables', action: 'table.updated', target: { type: 'table', number: body.number ?? row.number }, params: { fields: keys } })
    return tableView(getTable(row.id))
  },
)

route(
  'delete',
  '/tables/:id',
  { tag: 'Zal va stollar', summary: "Stolni olib tashlash", description: "Ochiq buyurtmasi bor stolni olib bo'lmaydi.", operationId: 'deleteTable', roles: ADMIN_ROLES, params: IdParams, response: Ok, errors: [404, 409] },
  (req) => {
    const row = getTable(req.valid.params.id)
    if (row.busy) throw conflict('table_busy', 'Stolda ochiq buyurtma bor')
    if (db.prepare("SELECT 1 FROM bookings WHERE table_id = ? AND status = 'booked' AND ends_at > ?").get(row.id, Date.now())) {
      throw conflict('table_booked', 'Stolga bron bor. Avval bronni boshqa stolga o\'tkazing')
    }
    db.prepare('UPDATE tables SET active = 0 WHERE id = ?').run(row.id)
    audit({ actor: req.user, category: 'tables', action: 'table.deleted', target: { type: 'table', number: row.number } })
    return { ok: true }
  },
)

route(
  'put',
  '/tables/layout',
  { tag: 'Zal va stollar', summary: 'Zal xaritasidagi joylashuvni saqlash', operationId: 'saveLayout', roles: ADMIN_ROLES, body: LayoutBody, response: Ok, errors: [404] },
  (req) => {
    db.transaction(() => {
      for (const item of req.valid.body.tables) {
        getTable(item.id)
        checkBounds(item)
        db.prepare('UPDATE tables SET x = ?, y = ?, w = ?, h = ? WHERE id = ?').run(item.x, item.y, item.w, item.h, item.id)
      }
    })()
    audit({ actor: req.user, category: 'tables', action: 'table.layout_saved', params: { count: req.valid.body.tables.length } })
    return { ok: true }
  },
)

route(
  'patch',
  '/tables/:id/waiter',
  {
    tag: 'Zal va stollar',
    summary: 'Stolga ofitsiant biriktirish',
    description: "Stoldagi ochiq vazifalar ham yangi ofitsiantga o'tadi.",
    operationId: 'setTableWaiter',
    roles: ADMIN_ROLES,
    params: IdParams,
    body: TableWaiterBody,
    response: TableItem,
    errors: [404],
  },
  (req) => {
    db.transaction(() => setTableWaiter(req.valid.params.id, req.valid.body.waiterId, req.user))()
    return tableView(getTable(req.valid.params.id))
  },
)

route(
  'post',
  '/tables/:id/qr',
  {
    tag: 'Zal va stollar',
    summary: 'QR kodni yangilash',
    description: "Eski QR ishlamay qoladi. Stolga yangisini chop etib qo'yish kerak.",
    operationId: 'regenerateQr',
    roles: ADMIN_ROLES,
    params: IdParams,
    response: TableItem,
    errors: [404],
  },
  (req) => {
    const row = getTable(req.valid.params.id)
    db.prepare('UPDATE tables SET qr_token = ? WHERE id = ?').run(newQrToken(), row.id)
    audit({ actor: req.user, category: 'tables', action: 'table.qr_regenerated', target: { type: 'table', number: row.number } })
    return tableView(getTable(row.id))
  },
)

route(
  'get',
  '/tables/qr',
  { tag: 'Zal va stollar', summary: 'Hamma stollarning QR kodlari (SVG)', operationId: 'qrCodes', roles: ADMIN_ROLES, response: QrList },
  async () => {
    const rows = db.prepare('SELECT id, number, qr_token FROM tables WHERE active = 1 ORDER BY number').all()
    const items = await Promise.all(
      rows.map(async (row) => ({
        tableId: row.id,
        number: row.number,
        url: qrUrl(row.qr_token),
        svg: await QRCode.toString(qrUrl(row.qr_token), { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0B1A33', light: '#FFFFFF' } }),
      })),
    )
    return { items }
  },
)

route(
  'post',
  '/zones',
  { tag: 'Zal va stollar', summary: "Zona qo'shish", operationId: 'createZone', roles: ADMIN_ROLES, body: ZoneBody, response: Ok, status: 201 },
  (req) => {
    const sort = req.valid.body.sort ?? db.prepare('SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM zones').get().n
    db.prepare('INSERT INTO zones (name, sort) VALUES (?, ?)').run(req.valid.body.name, sort)
    audit({ actor: req.user, category: 'tables', action: 'zone.created', target: { type: 'zone', name: req.valid.body.name } })
    return { ok: true }
  },
)

route(
  'patch',
  '/zones/:id',
  { tag: 'Zal va stollar', summary: 'Zonani tahrirlash', operationId: 'updateZone', roles: ADMIN_ROLES, params: IdParams, body: ZoneBody.partial(), response: Ok, errors: [404] },
  (req) => {
    const zone = db.prepare('SELECT * FROM zones WHERE id = ?').get(req.valid.params.id)
    if (!zone) throw notFound('zone_not_found')
    db.prepare('UPDATE zones SET name = ?, sort = ? WHERE id = ?').run(req.valid.body.name ?? zone.name, req.valid.body.sort ?? zone.sort, zone.id)
    return { ok: true }
  },
)

route(
  'delete',
  '/zones/:id',
  { tag: 'Zal va stollar', summary: "Bo'sh zonani o'chirish", operationId: 'deleteZone', roles: ADMIN_ROLES, params: IdParams, response: Ok, errors: [404, 409] },
  (req) => {
    const zone = db.prepare('SELECT * FROM zones WHERE id = ?').get(req.valid.params.id)
    if (!zone) throw notFound('zone_not_found')
    if (db.prepare('SELECT 1 FROM tables WHERE zone_id = ? AND active = 1').get(zone.id)) {
      throw conflict('zone_not_empty', "Zonada stollar bor")
    }
    if (db.prepare('SELECT COUNT(*) AS n FROM zones').get().n === 1) throw conflict('last_zone', 'Kamida bitta zona qolishi kerak')
    db.prepare('UPDATE tables SET zone_id = (SELECT MIN(id) FROM zones WHERE id != ?) WHERE zone_id = ?').run(zone.id, zone.id)
    db.prepare('DELETE FROM zones WHERE id = ?').run(zone.id)
    audit({ actor: req.user, category: 'tables', action: 'zone.deleted', target: { type: 'zone', name: zone.name } })
    return { ok: true }
  },
)
