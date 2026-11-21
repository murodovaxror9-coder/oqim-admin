import { db } from '../db/index.js'
import { audit } from '../lib/audit.js'
import { HttpError, conflict, notFound } from '../lib/http.js'
import { MINUTE } from '../lib/time.js'
import { promiseMs, roundMoney } from './rules.js'
import { getSettings } from './settings.js'

// Zal, buyurtma va vazifalar ustidagi amallar. Ofitsiant ilovasi, kassa va demo simulyatsiya
// shu funksiyalar orqali ishlaydi, shuning uchun qoidalar bitta joyda.

const q = {
  table: db.prepare('SELECT * FROM tables WHERE id = ?'),
  order: db.prepare('SELECT * FROM orders WHERE id = ?'),
  openOrderForTable: db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'open' LIMIT 1"),
  task: db.prepare('SELECT * FROM tasks WHERE id = ?'),
  user: db.prepare('SELECT id, name, role FROM users WHERE id = ?'),
  waitersOnShift: db.prepare(
    "SELECT id, name FROM users WHERE role = 'waiter' AND blocked = 0 AND shift_started_at IS NOT NULL ORDER BY id",
  ),
  openCounts: db.prepare('SELECT waiter_id, COUNT(*) AS n FROM tasks WHERE done_at IS NULL GROUP BY waiter_id'),
  insertTask: db.prepare(
    'INSERT INTO tasks (order_id, table_id, waiter_id, helped_from, type, sla_seconds, created_at, is_demo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ),
  menuItem: db.prepare('SELECT * FROM menu_items WHERE id = ?'),
  insertItem: db.prepare(
    'INSERT INTO order_items (order_id, menu_item_id, qty, price, status, start_at, ready_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ),
}

export function openTaskCounts() {
  return new Map(q.openCounts.all().map((row) => [row.waiter_id, row.n]))
}

export function waitersOnShift() {
  return q.waitersOnShift.all()
}

// Eng kam ochiq ishi bor ofitsiant (excludeId dan tashqari)
export function leastBusyWaiter(excludeId = null) {
  const counts = openTaskCounts()
  let best = null
  for (const waiter of waitersOnShift()) {
    if (waiter.id === excludeId) continue
    const n = counts.get(waiter.id) ?? 0
    if (!best || n < best.openTasks) best = { ...waiter, openTasks: n }
  }
  return best
}

// Yordam qoidasi: ofitsiantda helpMaxOpen ta ochiq ish bo'lsa va boshqasida
// kamida helpMinDiff ta kam bo'lsa, yangi ish o'shanga beriladi
export function chooseWaiter(waiterId, settings = getSettings()) {
  const onShift = waitersOnShift()
  if (!onShift.length) return { waiterId, helpedFrom: null }
  if (!onShift.some((waiter) => waiter.id === waiterId)) {
    return { waiterId: leastBusyWaiter()?.id ?? waiterId, helpedFrom: null }
  }
  const counts = openTaskCounts()
  const own = counts.get(waiterId) ?? 0
  const { helpMaxOpen, helpMinDiff } = settings.escalation
  if (own < helpMaxOpen) return { waiterId, helpedFrom: null }
  let best = null
  for (const waiter of onShift) {
    if (waiter.id === waiterId) continue
    const n = counts.get(waiter.id) ?? 0
    if (own - n >= helpMinDiff && (!best || n < best.n)) best = { id: waiter.id, n }
  }
  return best ? { waiterId: best.id, helpedFrom: waiterId } : { waiterId, helpedFrom: null }
}

export function createTask({ tableId, orderId = null, type, at = Date.now(), demo = false, waiterId }) {
  const settings = getSettings()
  const table = q.table.get(tableId)
  if (!table) throw notFound('table_not_found')
  let assigned = { waiterId: waiterId ?? null, helpedFrom: null }
  if (waiterId === undefined) assigned = chooseWaiter(table.waiter_id, settings)
  const result = q.insertTask.run(
    orderId,
    tableId,
    assigned.waiterId,
    assigned.helpedFrom,
    type,
    settings.tasks[type].seconds,
    at,
    demo ? 1 : 0,
  )
  return Number(result.lastInsertRowid)
}

export function completeTask(taskId, at = Date.now()) {
  const task = q.task.get(taskId)
  if (!task) throw notFound('task_not_found')
  if (task.done_at) return task
  db.prepare('UPDATE tasks SET done_at = ? WHERE id = ?').run(at, taskId)
  // Shu vazifa uchun ochilgan kechikish istisnosi o'zi yopiladi
  db.prepare(
    "UPDATE exceptions SET status = 'resolved', resolved_at = ?, resolution = ? WHERE task_id = ? AND status = 'open'",
  ).run(at, JSON.stringify({ action: 'task_done' }), taskId)
  return { ...task, done_at: at }
}

export function reassignTask(taskId, waiterId, actor, at = Date.now()) {
  const task = q.task.get(taskId)
  if (!task) throw notFound('task_not_found')
  if (task.done_at) throw conflict('task_done', 'Vazifa allaqachon bajarilgan')
  const waiter = q.user.get(waiterId)
  if (!waiter || waiter.role !== 'waiter') throw new HttpError(400, 'waiter_not_found', 'Ofitsiant topilmadi')
  if (task.waiter_id === waiterId) return task
  const from = task.waiter_id ? q.user.get(task.waiter_id) : null
  db.prepare('UPDATE tasks SET waiter_id = ?, helped_from = ? WHERE id = ?').run(waiterId, task.waiter_id, taskId)
  const table = q.table.get(task.table_id)
  audit({
    actor,
    category: 'escalation',
    action: 'task.reassigned',
    target: { type: 'table', number: table.number },
    params: { taskType: task.type, from: from?.name ?? null, to: waiter.name },
    at,
    demo: task.is_demo === 1,
  })
  return { ...task, waiter_id: waiterId }
}

export function openOrder({ tableId, guests, at = Date.now(), source = 'staff', demo = false, eatMinutes = null, waiterId }) {
  const table = q.table.get(tableId)
  if (!table || !table.active) throw notFound('table_not_found')
  if (q.openOrderForTable.get(tableId)) throw conflict('table_busy', 'Stol band')
  const result = db
    .prepare(
      'INSERT INTO orders (table_id, waiter_id, guests, source, status, opened_at, eat_minutes, is_demo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(tableId, table.waiter_id, guests, source, 'open', at, eatMinutes, demo ? 1 : 0)
  const orderId = Number(result.lastInsertRowid)
  createTask({ tableId, orderId, type: 'take', at, demo, waiterId })
  return orderId
}

// Taomlar ikki to'lqinda: 1-to'lqin (ichimlik, salat) darhol, asosiy taomlar
// shunday boshlanadiki, hammasi bir vaqtda tayyor bo'ladi
export function addItems(orderId, items, at = Date.now()) {
  const order = q.order.get(orderId)
  if (!order) throw notFound('order_not_found')
  const settings = getSettings()
  const rows = items.map(({ menuItemId, qty }) => {
    const item = q.menuItem.get(menuItemId)
    if (!item) throw notFound('menu_item_not_found')
    return { item, qty }
  })
  const mainMax = Math.max(0, ...rows.filter((row) => row.item.wave === 2).map((row) => row.item.prep_minutes))
  for (const { item, qty } of rows) {
    const prepMs = item.prep_minutes * MINUTE
    const startAt = item.wave === 2 ? at + (mainMax * MINUTE - prepMs) : at
    q.insertItem.run(orderId, item.id, qty, item.price, startAt <= at ? 'cooking' : 'queued', startAt, startAt + prepMs)
  }
  if (!order.ordered_at) {
    const maxPrep = Math.max(...rows.map((row) => row.item.prep_minutes))
    db.prepare('UPDATE orders SET ordered_at = ?, promise_at = ? WHERE id = ?').run(
      at,
      at + promiseMs(maxPrep, settings.promise),
      orderId,
    )
  }
  recalcOrder(orderId)
}

export function recalcOrder(orderId) {
  const settings = getSettings()
  const order = q.order.get(orderId)
  if (!order || order.status !== 'open') return
  const { subtotal } = db
    .prepare("SELECT COALESCE(SUM(qty * price), 0) AS subtotal FROM order_items WHERE order_id = ? AND status != 'cancelled'")
    .get(orderId)
  const service = roundMoney((subtotal * settings.compensation.serviceChargePercent) / 100)
  const discount = order.promise_broken
    ? roundMoney(((subtotal + service) * settings.compensation.promiseDiscountPercent) / 100)
    : 0
  db.prepare('UPDATE orders SET subtotal = ?, service_charge = ?, discount = ?, total = ? WHERE id = ?').run(
    subtotal,
    service,
    discount,
    subtotal + service - discount,
    orderId,
  )
}

// Tayyor taomlar dasturxonga yetdi. Asosiy taomlarning hammasi yetganda served_at qo'yiladi.
export function deliverReady(orderId, at = Date.now()) {
  const delivered = db
    .prepare("SELECT * FROM order_items WHERE order_id = ? AND status IN ('cooking', 'ready') AND ready_at <= ?")
    .all(orderId, at)
  db.prepare(
    "UPDATE order_items SET status = 'served' WHERE order_id = ? AND status IN ('cooking', 'ready') AND ready_at <= ?",
  ).run(orderId, at)
  const pendingMain = db
    .prepare(
      `SELECT COUNT(*) AS n FROM order_items oi JOIN menu_items m ON m.id = oi.menu_item_id
       WHERE oi.order_id = ? AND m.wave = 2 AND oi.status IN ('queued', 'cooking', 'ready')`,
    )
    .get(orderId).n
  if (pendingMain === 0) {
    db.prepare('UPDATE orders SET served_at = COALESCE(served_at, ?) WHERE id = ?').run(at, orderId)
  }
  for (const row of delivered) consumeBatch(row.menu_item_id, row.qty, at)
  return delivered
}

export function requestBill(orderId, at = Date.now(), demo = false) {
  const order = q.order.get(orderId)
  if (!order) throw notFound('order_not_found')
  db.prepare('UPDATE orders SET bill_at = COALESCE(bill_at, ?) WHERE id = ?').run(at, orderId)
  return createTask({ tableId: order.table_id, orderId, type: 'bill', at, demo })
}

export function payOrder(orderId, method, at = Date.now(), demo = false) {
  const order = q.order.get(orderId)
  if (!order) throw notFound('order_not_found')
  if (order.status !== 'open') throw conflict('order_closed', 'Buyurtma yopilgan')
  recalcOrder(orderId)
  db.prepare("UPDATE orders SET status = 'paid', paid_at = ?, payment_method = ? WHERE id = ?").run(at, method, orderId)
  const openTasks = db.prepare('SELECT id FROM tasks WHERE order_id = ? AND done_at IS NULL').all(orderId)
  for (const task of openTasks) completeTask(task.id, at)
  createTask({ tableId: order.table_id, orderId, type: 'clean', at, demo })
}

export function moveOrder(orderId, tableId, actor, at = Date.now()) {
  const order = q.order.get(orderId)
  if (!order || order.status !== 'open') throw notFound('order_not_found')
  const target = q.table.get(tableId)
  if (!target || !target.active) throw notFound('table_not_found')
  if (q.openOrderForTable.get(tableId)) throw conflict('table_busy', 'Stol band')
  const from = q.table.get(order.table_id)
  db.prepare('UPDATE orders SET table_id = ? WHERE id = ?').run(tableId, orderId)
  db.prepare('UPDATE tasks SET table_id = ? WHERE order_id = ? AND done_at IS NULL').run(tableId, orderId)
  db.prepare("UPDATE exceptions SET table_id = ? WHERE order_id = ? AND status = 'open'").run(tableId, orderId)
  audit({
    actor,
    category: 'order',
    action: 'order.moved',
    target: { type: 'table', number: from.number },
    params: { to: target.number },
    at,
    demo: order.is_demo === 1,
  })
}

export function setTableWaiter(tableId, waiterId, actor, at = Date.now()) {
  const table = q.table.get(tableId)
  if (!table || !table.active) throw notFound('table_not_found')
  const waiter = waiterId ? q.user.get(waiterId) : null
  if (waiterId && (!waiter || waiter.role !== 'waiter')) throw new HttpError(400, 'waiter_not_found', 'Ofitsiant topilmadi')
  const previous = table.waiter_id ? q.user.get(table.waiter_id) : null
  db.prepare('UPDATE tables SET waiter_id = ? WHERE id = ?').run(waiterId, tableId)
  if (waiterId) {
    db.prepare('UPDATE tasks SET waiter_id = ?, helped_from = NULL WHERE table_id = ? AND done_at IS NULL').run(
      waiterId,
      tableId,
    )
    db.prepare("UPDATE orders SET waiter_id = ? WHERE table_id = ? AND status = 'open'").run(waiterId, tableId)
  }
  audit({
    actor,
    category: 'tables',
    action: 'table.waiter_changed',
    target: { type: 'table', number: table.number },
    params: { from: previous?.name ?? null, to: waiter?.name ?? null },
    at,
  })
}

// --- Partiyali taomlar (qozon) ---

export function batchStock(menuItemId, at = Date.now()) {
  return db
    .prepare('SELECT COALESCE(SUM(remaining), 0) AS n FROM batches WHERE menu_item_id = ? AND ready_at <= ?')
    .get(menuItemId, at).n
}

export function startBatch(menuItemId, actor, at = Date.now(), demo = false) {
  const item = q.menuItem.get(menuItemId)
  if (!item?.batch_size) throw new HttpError(400, 'not_batch_item', 'Bu taom partiyalab pishmaydi')
  const cook = item.batch_cook_minutes ?? 40
  const result = db
    .prepare('INSERT INTO batches (menu_item_id, size, remaining, started_at, ready_at, is_demo) VALUES (?, ?, ?, ?, ?, ?)')
    .run(menuItemId, item.batch_size, item.batch_size, at, at + cook * MINUTE, demo ? 1 : 0)
  audit({
    actor,
    category: 'kitchen',
    action: 'batch.started',
    target: { type: 'menu_item', id: item.id },
    params: { size: item.batch_size, cookMinutes: cook },
    at,
    demo,
  })
  return Number(result.lastInsertRowid)
}

// Sotilgan porsiyalar qozondan ayriladi; qozon tugasa taom o'zi stop-listga tushadi
export function consumeBatch(menuItemId, qty, at = Date.now()) {
  const item = q.menuItem.get(menuItemId)
  if (!item?.batch_size) return
  let left = qty
  const batches = db
    .prepare('SELECT * FROM batches WHERE menu_item_id = ? AND ready_at <= ? AND remaining > 0 ORDER BY ready_at')
    .all(menuItemId, at)
  for (const batch of batches) {
    if (left <= 0) break
    const take = Math.min(batch.remaining, left)
    db.prepare('UPDATE batches SET remaining = remaining - ? WHERE id = ?').run(take, batch.id)
    left -= take
  }
  if (batchStock(menuItemId, at) === 0 && item.available) {
    db.prepare("UPDATE menu_items SET available = 0, stop_reason = 'batch_empty' WHERE id = ?").run(menuItemId)
    audit({ kind: 'system', category: 'menu', action: 'menu.stoplist_auto', target: { type: 'menu_item', id: item.id }, at })
  }
}
