import { db } from '../db/index.js'
import { audit } from '../lib/audit.js'
import { ADMIN_ROLES } from '../lib/auth.js'
import { HttpError, conflict, notFound } from '../lib/http.js'
import { route } from '../lib/openapi.js'
import { dayStart, localDate } from '../lib/time.js'
import {
  AvailabilityBody,
  BatchBody,
  Category,
  CategoryBody,
  IdParams,
  Menu,
  MenuItem,
  MenuItemCreate,
  MenuItemUpdate,
  Ok,
} from '../schemas.js'
import { batchStock, startBatch } from '../services/operations.js'

const COLUMNS = {
  categoryId: 'category_id',
  nameUz: 'name_uz',
  nameRu: 'name_ru',
  price: 'price',
  prepMinutes: 'prep_minutes',
  station: 'station',
  wave: 'wave',
  unit: 'unit',
  batchSize: 'batch_size',
  batchWarn: 'batch_warn',
  batchCookMinutes: 'batch_cook_minutes',
  ikpu: 'ikpu',
  sort: 'sort',
}

function itemView(row, now = Date.now()) {
  const sold = db
    .prepare(
      `SELECT COALESCE(SUM(oi.qty), 0) AS n FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE oi.menu_item_id = ? AND oi.status != 'cancelled' AND o.opened_at >= ?`,
    )
    .get(row.id, dayStart(localDate(now))).n
  return {
    id: row.id,
    categoryId: row.category_id,
    nameUz: row.name_uz,
    nameRu: row.name_ru,
    price: row.price,
    prepMinutes: row.prep_minutes,
    station: row.station,
    wave: row.wave,
    unit: row.unit,
    batchSize: row.batch_size,
    batchWarn: row.batch_warn,
    batchCookMinutes: row.batch_cook_minutes,
    batchStock: row.batch_size ? batchStock(row.id, now) : null,
    ikpu: row.ikpu,
    available: Boolean(row.available),
    stopReason: row.stop_reason,
    soldToday: sold,
    sort: row.sort,
  }
}

const getItem = (id) => {
  const row = db.prepare('SELECT * FROM menu_items WHERE id = ? AND archived = 0').get(id)
  if (!row) throw notFound('menu_item_not_found')
  return row
}

const categoryView = (row) => ({
  id: row.id,
  nameUz: row.name_uz,
  nameRu: row.name_ru,
  sort: row.sort,
  items: db.prepare('SELECT COUNT(*) AS n FROM menu_items WHERE category_id = ? AND archived = 0').get(row.id).n,
})

function checkCategory(id) {
  if (id !== undefined && !db.prepare('SELECT 1 FROM categories WHERE id = ?').get(id)) {
    throw new HttpError(400, 'category_not_found', 'Kategoriya topilmadi')
  }
}

function checkBatch(item) {
  if (item.batchSize && item.batchWarn !== null && item.batchWarn !== undefined && item.batchWarn >= item.batchSize) {
    throw new HttpError(400, 'batch_warn', "Ogohlantirish chegarasi qozon hajmidan kichik bo'lsin")
  }
}

route(
  'get',
  '/menu',
  { tag: 'Menyu', summary: 'Kategoriyalar va taomlar', operationId: 'menu', roles: ADMIN_ROLES, response: Menu },
  () => ({
    categories: db.prepare('SELECT * FROM categories ORDER BY sort, id').all().map(categoryView),
    items: db.prepare('SELECT * FROM menu_items WHERE archived = 0 ORDER BY sort, id').all().map((row) => itemView(row)),
  }),
)

route(
  'post',
  '/menu/categories',
  { tag: 'Menyu', summary: "Kategoriya qo'shish", operationId: 'createCategory', roles: ADMIN_ROLES, body: CategoryBody, response: Category, status: 201 },
  (req) => {
    const { nameUz, nameRu, sort } = req.valid.body
    const next = sort ?? db.prepare('SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM categories').get().n
    const id = Number(db.prepare('INSERT INTO categories (name_uz, name_ru, sort) VALUES (?, ?, ?)').run(nameUz, nameRu, next).lastInsertRowid)
    audit({ actor: req.user, category: 'menu', action: 'menu.category_created', target: { type: 'category', name: nameUz } })
    return categoryView(db.prepare('SELECT * FROM categories WHERE id = ?').get(id))
  },
)

route(
  'patch',
  '/menu/categories/:id',
  { tag: 'Menyu', summary: 'Kategoriyani tahrirlash', operationId: 'updateCategory', roles: ADMIN_ROLES, params: IdParams, body: CategoryBody.partial(), response: Category, errors: [404] },
  (req) => {
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.valid.params.id)
    if (!row) throw notFound('category_not_found')
    const { nameUz = row.name_uz, nameRu = row.name_ru, sort = row.sort } = req.valid.body
    db.prepare('UPDATE categories SET name_uz = ?, name_ru = ?, sort = ? WHERE id = ?').run(nameUz, nameRu, sort, row.id)
    return categoryView(db.prepare('SELECT * FROM categories WHERE id = ?').get(row.id))
  },
)

route(
  'delete',
  '/menu/categories/:id',
  { tag: 'Menyu', summary: "Bo'sh kategoriyani o'chirish", operationId: 'deleteCategory', roles: ADMIN_ROLES, params: IdParams, response: Ok, errors: [404, 409] },
  (req) => {
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.valid.params.id)
    if (!row) throw notFound('category_not_found')
    if (db.prepare('SELECT 1 FROM menu_items WHERE category_id = ? LIMIT 1').get(row.id)) {
      throw conflict('category_not_empty', "Kategoriyada taomlar bor. Avval ularni boshqa kategoriyaga o'tkazing")
    }
    db.prepare('DELETE FROM categories WHERE id = ?').run(row.id)
    audit({ actor: req.user, category: 'menu', action: 'menu.category_deleted', target: { type: 'category', name: row.name_uz } })
    return { ok: true }
  },
)

route(
  'post',
  '/menu/items',
  { tag: 'Menyu', summary: "Taom qo'shish", operationId: 'createMenuItem', roles: ADMIN_ROLES, body: MenuItemCreate, response: MenuItem, status: 201 },
  (req) => {
    const body = req.valid.body
    checkCategory(body.categoryId)
    checkBatch(body)
    const sort = body.sort ?? db.prepare('SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM menu_items').get().n
    const keys = Object.keys(COLUMNS)
    const values = keys.map((key) => (key === 'sort' ? sort : body[key] ?? null))
    const id = Number(
      db.prepare(`INSERT INTO menu_items (${keys.map((k) => COLUMNS[k]).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).run(...values)
        .lastInsertRowid,
    )
    audit({ actor: req.user, category: 'menu', action: 'menu.item_created', target: { type: 'menu_item', id }, params: { price: body.price } })
    return itemView(getItem(id))
  },
)

route(
  'patch',
  '/menu/items/:id',
  { tag: 'Menyu', summary: 'Taomni tahrirlash', operationId: 'updateMenuItem', roles: ADMIN_ROLES, params: IdParams, body: MenuItemUpdate, response: MenuItem, errors: [404] },
  (req) => {
    const row = getItem(req.valid.params.id)
    const body = req.valid.body
    checkCategory(body.categoryId)
    const current = itemView(row)
    checkBatch({ ...current, ...body })
    const keys = Object.keys(body).filter((key) => COLUMNS[key])
    if (keys.length) {
      db.prepare(`UPDATE menu_items SET ${keys.map((k) => `${COLUMNS[k]} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => body[k]), row.id)
    }
    if (body.price !== undefined && body.price !== row.price) {
      audit({ actor: req.user, category: 'menu', action: 'menu.price_changed', target: { type: 'menu_item', id: row.id }, params: { from: row.price, to: body.price } })
    } else if (keys.length) {
      audit({ actor: req.user, category: 'menu', action: 'menu.item_updated', target: { type: 'menu_item', id: row.id }, params: { fields: keys } })
    }
    return itemView(getItem(row.id))
  },
)

route(
  'patch',
  '/menu/items/:id/availability',
  {
    tag: 'Menyu',
    summary: 'Stop-listga qo\'yish yoki sotuvga qaytarish',
    operationId: 'setAvailability',
    roles: ADMIN_ROLES,
    params: IdParams,
    body: AvailabilityBody,
    response: MenuItem,
    errors: [404],
  },
  (req) => {
    const row = getItem(req.valid.params.id)
    const { available } = req.valid.body
    db.prepare('UPDATE menu_items SET available = ?, stop_reason = ? WHERE id = ?').run(available ? 1 : 0, available ? null : 'manual', row.id)
    audit({
      actor: req.user,
      category: 'menu',
      action: available ? 'menu.back_on_sale' : 'menu.stoplist',
      target: { type: 'menu_item', id: row.id },
      params: { reason: 'manual' },
    })
    return itemView(getItem(row.id))
  },
)

route(
  'delete',
  '/menu/items/:id',
  {
    tag: 'Menyu',
    summary: 'Taomni arxivlash',
    description: "Taom o'chirilmaydi, arxivga o'tadi: eski buyurtmalar va hisobotlar buzilmaydi.",
    operationId: 'archiveMenuItem',
    roles: ADMIN_ROLES,
    params: IdParams,
    response: Ok,
    errors: [404],
  },
  (req) => {
    const row = getItem(req.valid.params.id)
    db.prepare('UPDATE menu_items SET archived = 1, available = 0 WHERE id = ?').run(row.id)
    audit({ actor: req.user, category: 'menu', action: 'menu.item_archived', target: { type: 'menu_item', id: row.id } })
    return { ok: true }
  },
)

route(
  'post',
  '/batches',
  {
    tag: 'Menyu',
    summary: "Yangi qozon qo'yish",
    description: 'Partiyalab pishadigan taom (osh, mastava, somsa) uchun. Pishish vaqti taom sozlamasidan olinadi.',
    operationId: 'startBatch',
    roles: ADMIN_ROLES,
    body: BatchBody,
    response: MenuItem,
    status: 201,
    errors: [404],
  },
  (req) => {
    getItem(req.valid.body.menuItemId)
    db.transaction(() => startBatch(req.valid.body.menuItemId, req.user))()
    return itemView(getItem(req.valid.body.menuItemId))
  },
)
