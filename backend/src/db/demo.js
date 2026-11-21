import { db, transaction } from './index.js'
import { createRandom } from '../lib/random.js'
import { DAY, HOUR, MINUTE, SECOND, addDays, atLocal, dayStart, localDate, localHour, localWeekday } from '../lib/time.js'
import { createException } from '../services/exceptions.js'
import { recalcOrder } from '../services/operations.js'
import { promiseMs, roundMoney } from '../services/rules.js'
import { getSettings } from '../services/settings.js'

// Demo rejim: o'tgan 35 kunlik tarix, bugungi jonli zal, bronlar va jurnal hozirgi vaqtga qarab qayta quriladi.
// Hamma demo yozuvlar is_demo = 1 bilan belgilanadi va keyingi ishga tushishda tozalanadi.

const HISTORY_DAYS = 35
export const WAITER_SPEED = { 'Jasur Karimov': 65, 'Malika Rahimova': 58, 'Sardor Aliyev': 100 }
export const HOUR_DEMAND = { 10: 0.35, 11: 0.6, 12: 1, 13: 1, 14: 0.7, 15: 0.4, 16: 0.35, 17: 0.45, 18: 0.75, 19: 1, 20: 0.95, 21: 0.6, 22: 0.3 }
const WEEKDAY_DEMAND = [1.15, 0.85, 0.85, 0.9, 0.95, 1.1, 1.25]
const TASK_FACTOR = { take: 1.4, deliver: 0.9, call: 0.8, bill: 1.1, clean: 1.6 }
const PAYMENTS = [['cash', 32], ['card', 30], ['click', 12], ['payme', 12], ['uzum', 6], ['nfc', 8]]

const ceilTo = (ts, step) => Math.ceil(ts / step) * step

function lookups() {
  const users = new Map(db.prepare('SELECT id, name, role, shift_start FROM users').all().map((u) => [u.name, u]))
  const menu = new Map(db.prepare('SELECT * FROM menu_items').all().map((m) => [m.name_uz, m]))
  const tables = new Map(db.prepare('SELECT * FROM tables WHERE active = 1').all().map((t) => [t.number, t]))
  const waiterName = new Map([...users.values()].map((u) => [u.id, u.name]))
  return { users, menu, tables, waiterName }
}

const stmts = () => ({
  order: db.prepare(
    `INSERT INTO orders (table_id, waiter_id, guests, source, status, opened_at, ordered_at, served_at, bill_at, paid_at,
      promise_at, promise_broken, subtotal, service_charge, discount, total, payment_method, eat_minutes, is_demo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
  ),
  item: db.prepare(
    `INSERT INTO order_items (order_id, menu_item_id, qty, price, status, start_at, ready_at, cancel_requested_at, cancel_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ),
  task: db.prepare(
    `INSERT INTO tasks (order_id, table_id, waiter_id, type, sla_seconds, created_at, done_at, admin_alert_at, owner_alert_at, is_demo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
  ),
  audit: db.prepare(
    `INSERT INTO audit_log (at, actor_id, actor_kind, category, action, target, params, is_demo) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
  ),
})

function clearDemo() {
  db.prepare('DELETE FROM exceptions WHERE is_demo = 1').run()
  db.prepare('DELETE FROM tasks WHERE is_demo = 1').run()
  db.prepare('DELETE FROM orders WHERE is_demo = 1').run()
  db.prepare('DELETE FROM batches WHERE is_demo = 1').run()
  db.prepare('DELETE FROM bookings WHERE is_demo = 1').run()
  db.prepare('DELETE FROM waitlist WHERE is_demo = 1').run()
  db.prepare('DELETE FROM audit_log WHERE is_demo = 1').run()
  db.prepare("DELETE FROM batch_plans WHERE status = 'proposed'").run()
  db.prepare("UPDATE menu_items SET available = 1, stop_reason = NULL WHERE stop_reason = 'batch_empty'").run()
}

function startShifts(now, users) {
  const today = localDate(now)
  db.prepare('UPDATE users SET shift_started_at = NULL').run()
  for (const user of users.values()) {
    if (!user.shift_start || user.role === 'owner') continue
    let start = atLocal(today, user.shift_start)
    if (start > now) start = now - 2 * HOUR
    db.prepare('UPDATE users SET shift_started_at = ? WHERE id = ?').run(start, user.id)
  }
}

// --- Tarix: har stol uchun ketma-ket tashriflar ---

function pickItems(rnd, guests, hour, menu) {
  const lunch = hour >= 11 && hour <= 15
  const mains = [
    ['Osh', lunch ? 3.2 : 1.1],
    ['Mastava', lunch ? 1 : 0.5],
    ["Lag'mon", 2],
    ['Manti', 1.5],
    ['Kabob', 0.8],
    ["Mol go'shti shashlik", 2],
    ['Tovuq shashlik', 1.4],
    ['Jaz', 0.8],
  ]
  const counts = new Map()
  const add = (name, qty) => counts.set(name, (counts.get(name) ?? 0) + qty)
  for (let i = 0; i < guests; i += 1) {
    const name = rnd.weighted(mains)
    add(name, name.includes('shashlik') ? 2 : 1)
  }
  add('Non', Math.ceil(guests / 2))
  add(rnd.chance(0.6) ? "Ko'k choy" : 'Qora choy', Math.ceil(guests / 2))
  if (rnd.chance(0.6)) add('Achchiq-chuchuk', 1)
  if (rnd.chance(0.3)) add('Suzma', 1)
  if (rnd.chance(0.4)) add('Somsa', guests)
  if (rnd.chance(0.25)) add('Limonad', 1)
  if (rnd.chance(0.2)) add('Kompot', 1)
  if (rnd.chance(0.2)) add('Ayron', Math.max(1, Math.floor(guests / 2)))
  return [...counts].map(([name, qty]) => ({ item: menu.get(name), qty }))
}

function simulateVisit({ rnd, table, arrival, ctx, settings }) {
  const speed = WAITER_SPEED[ctx.waiterName.get(table.waiter_id)] ?? 80
  const latency = (type) => {
    let seconds = rnd.around(speed * TASK_FACTOR[type], 0.45)
    if (rnd.chance(0.05)) seconds *= 2.4
    return Math.round(seconds) * SECOND
  }
  const tasks = []
  const task = (type, created) => {
    const done = created + latency(type)
    tasks.push({ type, created, done })
    return done
  }

  const guests = Math.min(table.seats, rnd.weighted([[1, 1], [2, 4], [3, 3], [4, 3], [5, 1.5], [6, 1], [7, 0.5], [8, 0.4]]))
  const orderedAt = task('take', arrival)
  const items = pickItems(rnd, guests, localHour(arrival), ctx.menu)
  const maxPrep = Math.max(...items.map(({ item }) => item.prep_minutes))
  const mainMax = Math.max(2, ...items.filter(({ item }) => item.wave === 2).map(({ item }) => item.prep_minutes))
  const promiseAt = orderedAt + promiseMs(maxPrep, settings.promise)
  const delay = rnd.chance(0.06) ? rnd.int(5, 12) * MINUTE : 0
  const firstReady = orderedAt + rnd.int(2, 4) * MINUTE
  const mainReady = orderedAt + Math.max(2 * MINUTE, Math.round(mainMax * MINUTE * rnd.around(0.92, 0.12))) + delay
  task('deliver', firstReady)
  const servedAt = task('deliver', mainReady)
  const eatMinutes = rnd.int(28, 60) + guests * 3
  const billAt = servedAt + eatMinutes * MINUTE
  const calls = rnd.weighted([[0, 5], [1, 4], [2, 1]])
  for (let i = 0; i < calls; i += 1) task('call', servedAt + rnd.int(3, eatMinutes - 2) * MINUTE)
  const billDone = task('bill', billAt)
  const paidAt = billDone + rnd.int(30, 150) * SECOND
  const cleanDone = task('clean', paidAt)

  const subtotal = items.reduce((sum, { item, qty }) => sum + item.price * qty, 0)
  const service = roundMoney((subtotal * settings.compensation.serviceChargePercent) / 100)
  const broken = servedAt > promiseAt
  const discount = broken ? roundMoney(((subtotal + service) * settings.compensation.promiseDiscountPercent) / 100) : 0
  return {
    end: cleanDone + MINUTE,
    write(st) {
      const orderId = Number(
        st.order.run(
          table.id,
          table.waiter_id,
          guests,
          rnd.chance(0.15) ? 'qr' : 'staff',
          'paid',
          arrival,
          orderedAt,
          servedAt,
          billAt,
          paidAt,
          promiseAt,
          broken ? 1 : 0,
          subtotal,
          service,
          discount,
          subtotal + service - discount,
          rnd.weighted(PAYMENTS),
          eatMinutes,
        ).lastInsertRowid,
      )
      for (const { item, qty } of items) {
        const start = item.wave === 2 ? mainReady - item.prep_minutes * MINUTE : orderedAt
        const ready = item.wave === 2 ? mainReady : firstReady
        st.item.run(orderId, item.id, qty, item.price, 'served', start, ready, null, null)
      }
      for (const t of tasks) {
        const sla = settings.tasks[t.type].seconds * SECOND
        const took = t.done - t.created
        st.task.run(
          orderId,
          table.id,
          table.waiter_id,
          t.type,
          sla / SECOND,
          t.created,
          t.done,
          took > sla ? t.created + sla : null,
          took > sla * settings.escalation.ownerMultiplier ? t.created + sla * settings.escalation.ownerMultiplier : null,
        )
      }
    },
  }
}

function generateHistory(now, ctx, liveStart, settings) {
  const st = stmts()
  const today = localDate(now)
  for (let offset = HISTORY_DAYS; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset)
    const weekday = localWeekday(dayStart(date) + 12 * HOUR)
    const rnd = createRandom(`oqim-${date}`)
    const dayFactor = WEEKDAY_DEMAND[weekday] * rnd.around(1, 0.12)
    for (const table of ctx.tables.values()) {
      const limit = offset === 0 ? (liveStart.get(table.number) ?? now - 2 * MINUTE) : Infinity
      let t = atLocal(date, '10:00') + rnd.int(0, 25) * MINUTE
      const close = atLocal(date, '22:30')
      while (t < close) {
        const demand = (HOUR_DEMAND[localHour(t)] ?? 0.2) * dayFactor
        t += Math.round(rnd.around(42 / Math.max(demand, 0.15), 0.6) * MINUTE)
        if (t >= close) break
        const visit = simulateVisit({ rnd, table, arrival: t, ctx, settings })
        if (visit.end > limit) break
        visit.write(st)
        t = visit.end
      }
    }
  }
}

// --- Bugungi jonli zal ---

function buildLive(now, ctx, settings) {
  const st = stmts()
  const T = now
  const { menu, tables, users } = ctx
  const sla = (type) => settings.tasks[type].seconds
  const protect = []

  const order = ({ table, guests, opened, ordered = null, served = null, bill = null, paid = null, method = null, source = 'staff' }) => {
    const tb = tables.get(table)
    const maxPrep = ordered ? null : null
    const id = Number(
      st.order.run(tb.id, tb.waiter_id, guests, source, 'open', opened, ordered, served, bill, null, null, 0, 0, 0, 0, 0, null, 45)
        .lastInsertRowid,
    )
    return { id, tb, maxPrep, paid, method }
  }
  const items = (o, list) => {
    let maxPrep = 0
    const ids = {}
    for (const [name, qty, status, start, ready, cancelAt = null, reason = null] of list) {
      const m = menu.get(name)
      maxPrep = Math.max(maxPrep, m.prep_minutes)
      ids[name] = Number(st.item.run(o.id, m.id, qty, m.price, status, start, ready, cancelAt, reason).lastInsertRowid)
    }
    return { ids, maxPrep }
  }
  const setPromise = (o, ordered, maxPrep) => {
    db.prepare('UPDATE orders SET promise_at = ? WHERE id = ?').run(ordered + promiseMs(maxPrep, settings.promise), o.id)
  }
  const task = (o, type, created, done = null, keepMs = 60 * SECOND) => {
    const id = Number(st.task.run(o.id, o.tb.id, o.tb.waiter_id, type, sla(type), created, done, null, null).lastInsertRowid)
    if (!done) protect.push({ id, until: T + keepMs })
    return id
  }
  const close = (o) => {
    recalcOrder(o.id)
    if (o.paid) db.prepare("UPDATE orders SET status = 'paid', paid_at = ?, payment_method = ? WHERE id = ?").run(o.paid, o.method, o.id)
  }

  // 1-stol: to'langan, yig'ishtirish kutilmoqda
  const o1 = order({ table: 1, guests: 3, opened: T - 58 * MINUTE, ordered: T - 55 * MINUTE, served: T - 38 * MINUTE, bill: T - 6 * MINUTE, paid: T - 55 * SECOND, method: 'card' })
  const r1 = items(o1, [
    ['Osh', 2, 'served', T - 55 * MINUTE, T - 53 * MINUTE],
    ["Lag'mon", 1, 'served', T - 55 * MINUTE, T - 41 * MINUTE],
    ['Non', 2, 'served', T - 55 * MINUTE, T - 52 * MINUTE],
    ["Ko'k choy", 1, 'served', T - 55 * MINUTE, T - 52 * MINUTE],
    ['Achchiq-chuchuk', 1, 'served', T - 55 * MINUTE, T - 52 * MINUTE],
  ])
  setPromise(o1, T - 55 * MINUTE, r1.maxPrep)
  task(o1, 'take', T - 58 * MINUTE, T - 55 * MINUTE)
  task(o1, 'deliver', T - 52 * MINUTE, T - 51 * MINUTE)
  task(o1, 'deliver', T - 40 * MINUTE, T - 38 * MINUTE)
  task(o1, 'bill', T - 6 * MINUTE, T - 4 * MINUTE)
  task(o1, 'clean', T - 55 * SECOND)
  close(o1)

  // 2-stol: mehmonlar endi o'tirdi
  const o2 = order({ table: 2, guests: 2, opened: T - 135 * SECOND })
  task(o2, 'take', T - 135 * SECOND)
  close(o2)

  // 3-stol: asosiy taomlar tayyor, olib borish kerak
  const ord3 = T - (15 * MINUTE + 20 * SECOND)
  const o3 = order({ table: 3, guests: 4, opened: T - 17 * MINUTE, ordered: ord3 })
  const r3 = items(o3, [
    ["Ko'k choy", 2, 'served', ord3, ord3 + 2 * MINUTE],
    ['Achchiq-chuchuk', 1, 'served', ord3, ord3 + 2 * MINUTE],
    ['Non', 2, 'served', ord3, ord3 + 2 * MINUTE],
    ['Kabob', 1, 'ready', ord3, T - 80 * SECOND],
    ["Mol go'shti shashlik", 4, 'ready', ord3 + 2 * MINUTE, T - 80 * SECOND],
  ])
  setPromise(o3, ord3, r3.maxPrep)
  task(o3, 'take', T - 17 * MINUTE, ord3)
  task(o3, 'deliver', ord3 + 2 * MINUTE, ord3 + 3 * MINUTE)
  task(o3, 'deliver', T - 80 * SECOND)
  close(o3)

  // 4-stol: hisob so'radi
  const o4 = order({ table: 4, guests: 5, opened: T - 52 * MINUTE, ordered: T - 49 * MINUTE, served: T - 33 * MINUTE, bill: T - 20 * SECOND })
  const r4 = items(o4, [
    ['Manti', 3, 'served', T - 47 * MINUTE, T - 37 * MINUTE],
    ["Lag'mon", 2, 'served', T - 45 * MINUTE, T - 37 * MINUTE],
    ['Somsa', 5, 'served', T - 49 * MINUTE, T - 47 * MINUTE],
    ['Qora choy', 2, 'served', T - 49 * MINUTE, T - 47 * MINUTE],
    ['Limonad', 1, 'served', T - 49 * MINUTE, T - 45 * MINUTE],
  ])
  setPromise(o4, T - 49 * MINUTE, r4.maxPrep)
  task(o4, 'take', T - 52 * MINUTE, T - 49 * MINUTE)
  task(o4, 'deliver', T - 46 * MINUTE, T - 45 * MINUTE)
  task(o4, 'deliver', T - 36 * MINUTE, T - 33 * MINUTE)
  task(o4, 'bill', T - 20 * SECOND)
  close(o4)

  // 5-stol: Malika, chaqiruv va taomni bekor qilish so'rovi
  const ord5 = T - 6 * MINUTE
  const o5 = order({ table: 5, guests: 2, opened: T - 9 * MINUTE, ordered: ord5 })
  const r5 = items(o5, [
    ["Ko'k choy", 1, 'served', ord5, ord5 + 2 * MINUTE],
    ["Lag'mon", 1, 'queued', ord5 + 6 * MINUTE, ord5 + 14 * MINUTE],
    ['Kabob', 1, 'cooking', ord5, ord5 + 14 * MINUTE, T - 60 * SECOND, 'guest_wait'],
  ])
  setPromise(o5, ord5, r5.maxPrep)
  task(o5, 'take', T - 9 * MINUTE, ord5)
  task(o5, 'deliver', ord5 + 2 * MINUTE, ord5 + 3 * MINUTE)
  task(o5, 'call', T - 40 * SECOND)
  close(o5)
  createException({
    type: 'cancel_request',
    tableId: o5.tb.id,
    orderId: o5.id,
    orderItemId: r5.ids.Kabob,
    menuItemId: menu.get('Kabob').id,
    payload: { qty: 1, reason: 'guest_wait', itemStatus: 'cooking', waiterName: 'Malika Rahimova', amount: menu.get('Kabob').price },
    at: T - 60 * SECOND,
    demo: true,
  })

  // 8-stol: mangal kechikdi, va'da buzildi (chegirmani dvigatel qo'llaydi)
  const ord8 = T - 25 * MINUTE
  const o8 = order({ table: 8, guests: 4, opened: T - 28 * MINUTE, ordered: ord8 })
  const r8 = items(o8, [
    ['Non', 2, 'served', ord8, ord8 + 2 * MINUTE],
    ['Qora choy', 2, 'served', ord8, ord8 + 2 * MINUTE],
    ["Mol go'shti shashlik", 4, 'served', ord8 + 2 * MINUTE, T - 11 * MINUTE],
    ['Jaz', 2, 'cooking', ord8, T + 2 * MINUTE],
  ])
  setPromise(o8, ord8, r8.maxPrep)
  task(o8, 'take', T - 28 * MINUTE, ord8)
  task(o8, 'deliver', ord8 + 2 * MINUTE, ord8 + 4 * MINUTE)
  task(o8, 'deliver', T - 11 * MINUTE, T - 10 * MINUTE)
  task(o8, 'call', T - 70 * SECOND)
  task(o8, 'take', T - 15 * SECOND)
  close(o8)

  // 9-stol: hisob 4 daqiqadan beri kutilmoqda, egaga xabar boradi
  const o9 = order({ table: 9, guests: 4, opened: T - 65 * MINUTE, ordered: T - 62 * MINUTE, served: T - 45 * MINUTE, bill: T - 250 * SECOND })
  const r9 = items(o9, [
    ['Osh', 3, 'served', T - 62 * MINUTE, T - 60 * MINUTE],
    ["Mol go'shti shashlik", 4, 'served', T - 59 * MINUTE, T - 47 * MINUTE],
    ['Non', 2, 'served', T - 62 * MINUTE, T - 60 * MINUTE],
    ["Ko'k choy", 2, 'served', T - 62 * MINUTE, T - 60 * MINUTE],
    ['Kompot', 1, 'served', T - 62 * MINUTE, T - 61 * MINUTE],
  ])
  setPromise(o9, T - 62 * MINUTE, r9.maxPrep)
  task(o9, 'take', T - 65 * MINUTE, T - 62 * MINUTE)
  task(o9, 'deliver', T - 59 * MINUTE, T - 58 * MINUTE)
  task(o9, 'deliver', T - 46 * MINUTE, T - 45 * MINUTE)
  task(o9, 'bill', T - 250 * SECOND, null, 4 * MINUTE)
  close(o9)

  // 10-stol: katta davra, taom tayyor va chaqiruv
  const ord10 = T - (14 * MINUTE + 45 * SECOND)
  const o10 = order({ table: 10, guests: 7, opened: T - 18 * MINUTE, ordered: ord10 })
  const r10 = items(o10, [
    ["Ko'k choy", 3, 'served', ord10, ord10 + 2 * MINUTE],
    ['Achchiq-chuchuk', 2, 'served', ord10, ord10 + 2 * MINUTE],
    ['Somsa', 7, 'served', ord10, ord10 + 2 * MINUTE],
    ['Kabob', 2, 'ready', ord10, T - 45 * SECOND],
    ["Lag'mon", 3, 'ready', ord10 + 6 * MINUTE, T - 45 * SECOND],
    ['Manti', 2, 'ready', ord10 + 4 * MINUTE, T - 45 * SECOND],
  ])
  setPromise(o10, ord10, r10.maxPrep)
  task(o10, 'take', T - 18 * MINUTE, ord10)
  task(o10, 'deliver', ord10 + 3 * MINUTE, ord10 + 4 * MINUTE)
  task(o10, 'deliver', T - 45 * SECOND)
  task(o10, 'call', T - 20 * SECOND)
  close(o10)

  // Qozonlar: osh 6 porsiya qoldi, somsa yetarli
  const batch = db.prepare('INSERT INTO batches (menu_item_id, size, remaining, started_at, ready_at, is_demo) VALUES (?, ?, ?, ?, ?, 1)')
  const osh = menu.get('Osh')
  batch.run(osh.id, 40, 0, T - 5 * HOUR, T - 4 * HOUR - 20 * MINUTE)
  batch.run(osh.id, 40, 6, T - 2 * HOUR - 10 * MINUTE, T - 90 * MINUTE)
  const somsa = menu.get('Somsa')
  batch.run(somsa.id, 30, 17, T - 95 * MINUTE, T - 60 * MINUTE)

  // Bronlar
  const today = localDate(T)
  const booking = db.prepare(
    `INSERT INTO bookings (table_id, guest_name, phone, guests, starts_at, ends_at, note, status, created_at, is_demo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
  )
  const half = 30 * MINUTE
  const add = (table, name, phone, guests, start, minutes, note, status = 'booked') =>
    booking.run(tables.get(table).id, name, phone, guests, start, start + minutes * MINUTE, note, status, T - 2 * DAY)
  add(8, 'Farhod', '+998931234501', 4, Math.floor((T - 25 * MINUTE) / half) * half, 90, null, 'seated')
  add(7, 'Aziza', '+998941234502', 6, ceilTo(T + 18 * MINUTE, 5 * MINUTE), 90, "Tug'ilgan kun, tortni o'zlari olib keladi")
  add(9, 'Ofis tushligi', '+998951234503', 4, ceilTo(T + 45 * MINUTE, half), 60, null)
  add(6, 'Nodira', '+998971234504', 2, ceilTo(T + 3 * HOUR, half), 90, null)
  add(4, 'Kamola', '+998981234505', 5, ceilTo(T + 3.5 * HOUR, half), 120, 'Bolalar stuli kerak')
  add(10, 'Banket', '+998991234506', 8, ceilTo(T + 4 * HOUR, half), 180, 'Oldindan buyurtma: 12 × Manti')
  add(2, 'Rustam aka', '+998901234507', 4, ceilTo(T + 5 * HOUR, half), 90, null)
  add(5, 'Laylo', '+998911234508', 2, ceilTo(T + DAY + 2 * HOUR, half), 90, null)

  const wait = db.prepare(
    'INSERT INTO waitlist (guest_name, phone, guests, quoted_minutes, table_id, status, created_at, is_demo) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
  )
  wait.run('Sherzod', '+998901234510', 4, 12, tables.get(4).id, 'waiting', T - 5 * MINUTE)
  wait.run('Dilshod', '+998901234511', 4, 18, null, 'waiting', T - 2 * MINUTE)

  // Bugun hal qilingan istisnolar
  const admin = users.get('Dilnoza Yusupova')
  const resolved = (type, table, minutesAgo, payload, resolution, menuName = null, byAdmin = true) => {
    const id = createException({
      type,
      tableId: table ? tables.get(table).id : null,
      menuItemId: menuName ? menu.get(menuName).id : null,
      payload,
      at: T - minutesAgo * MINUTE,
      demo: true,
      resolved: resolution,
    })
    db.prepare('UPDATE exceptions SET resolved_at = ?, resolved_by = ? WHERE id = ?').run(
      T - (minutesAgo - 2) * MINUTE,
      byAdmin ? admin.id : null,
      id,
    )
  }
  resolved('task_late', 3, 72, { taskType: 'deliver', level: 'admin', waiterName: 'Jasur Karimov', slaSeconds: 120 }, { action: 'reassign', waiterName: 'Malika Rahimova' })
  resolved('cancel_request', 6, 125, { qty: 1, reason: 'wrong_order', waiterName: 'Malika Rahimova', amount: 38000 }, { action: 'approve' }, "Lag'mon")
  resolved('promise_broken', 4, 160, { discount: 21700, percent: 10 }, { action: 'auto_discount' }, null, false)
  resolved('task_late', 10, 35, { taskType: 'call', level: 'admin', waiterName: 'Sardor Aliyev', slaSeconds: 90 }, { action: 'task_done' }, null, false)

  writeAudit(T, today, ctx)
  return protect
}

function writeAudit(T, today, { users, menu }) {
  const st = stmts()
  const log = (at, actor, category, action, target = {}, params = {}, kind = 'user') =>
    st.audit.run(at, actor?.id ?? null, actor ? 'user' : kind, category, action, JSON.stringify(target), JSON.stringify(params))
  const u = (name) => users.get(name)
  const shiftAt = (name) => Math.min(atLocal(today, u(name).shift_start), T - 2 * HOUR)

  for (const name of ['Dilnoza Yusupova', 'Jasur Karimov', 'Malika Rahimova', 'Sardor Aliyev', 'Shahlo Nazarova', 'Rustam Qodirov', 'Akmal Ergashev']) {
    log(shiftAt(name), u(name), 'shift', 'shift.started', { type: 'user', name }, {})
  }
  log(shiftAt('Shahlo Nazarova') + 4 * MINUTE, u('Shahlo Nazarova'), 'cash', 'cash.opened', { type: 'cashbox', name: 'Kassa 1' }, { amount: 500000 })
  log(T - 4 * HOUR, u('Bahodir Tursunov'), 'settings', 'settings.changed', {}, { changes: [{ path: 'tasks.deliver.seconds', from: 150, to: 120 }] })
  log(T - 3 * HOUR, u('Shahlo Nazarova'), 'cash', 'cash.out', { type: 'cashbox', name: 'Kassa 1' }, { amount: 50000, reason: 'supplies' })
  log(T - 140 * MINUTE, u('Dilnoza Yusupova'), 'menu', 'menu.stoplist', { type: 'menu_item', id: menu.get('Mastava').id }, { reason: 'manual' })
  log(T - 123 * MINUTE, u('Dilnoza Yusupova'), 'cancel', 'exception.resolved', { type: 'table', number: 6 }, { type: 'cancel_request', decision: 'approve' })
  log(T - 70 * MINUTE, u('Dilnoza Yusupova'), 'escalation', 'exception.resolved', { type: 'table', number: 3 }, { type: 'task_late', decision: 'reassign', waiter: 'Malika Rahimova' })
  log(T - 158 * MINUTE, null, 'compensation', 'compensation.applied', { type: 'table', number: 4 }, { amount: 21700, percent: 10 }, 'system')
  log(T - 25 * MINUTE, null, 'order', 'order.qr_created', { type: 'table', number: 3 }, { items: 5 }, 'guest')
  log(T - 80 * SECOND, null, 'kitchen', 'kitchen.ready', { type: 'table', number: 3 }, { count: 2 }, 'system')
  log(T - 45 * SECOND, null, 'kitchen', 'kitchen.ready', { type: 'table', number: 10 }, { count: 3 }, 'system')
  log(T - 60 * SECOND, null, 'cancel', 'cancel.requested', { type: 'table', number: 5 }, { item: 'Kabob', reason: 'guest_wait' }, 'system')
}

export const refreshDemo = transaction((now = Date.now()) => {
  const ctx = lookups()
  const settings = getSettings()
  clearDemo()
  startShifts(now, ctx.users)
  db.prepare("UPDATE menu_items SET available = 0, stop_reason = 'manual' WHERE name_uz = 'Mastava'").run()
  // Jonli buyurtmalar boshlangan vaqtdan oldin stolda tarix tugaydi
  const liveStart = new Map([
    [1, now - 60 * MINUTE], [2, now - 5 * MINUTE], [3, now - 19 * MINUTE], [4, now - 54 * MINUTE], [5, now - 11 * MINUTE],
    [6, now - 3 * MINUTE], [7, now - 3 * MINUTE], [8, now - 30 * MINUTE], [9, now - 67 * MINUTE], [10, now - 20 * MINUTE],
  ])
  generateHistory(now, ctx, liveStart, settings)
  return buildLive(now, ctx, settings)
})
