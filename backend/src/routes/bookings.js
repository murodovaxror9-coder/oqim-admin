import { db } from '../db/index.js'
import { audit } from '../lib/audit.js'
import { ADMIN_ROLES, normalizePhone } from '../lib/auth.js'
import { HttpError, conflict, notFound } from '../lib/http.js'
import { route } from '../lib/openapi.js'
import { MINUTE, atLocal, dayEnd, dayStart, localDate, localTime } from '../lib/time.js'
import {
  Booking,
  BookingCreate,
  BookingUpdate,
  BookingsData,
  DateQuery,
  IdParams,
  Ok,
  SeatBody,
  WaitlistCreate,
  WaitlistEntry,
} from '../schemas.js'
import { openOrder } from '../services/operations.js'

const LATE_MS = 15 * MINUTE

const SELECT = 'SELECT b.*, t.number AS table_number FROM bookings b JOIN tables t ON t.id = b.table_id'

function bookingView(row, now = Date.now()) {
  return {
    id: row.id,
    tableId: row.table_id,
    tableNumber: row.table_number,
    guestName: row.guest_name,
    phone: row.phone,
    guests: row.guests,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    note: row.note,
    status: row.status,
    late: row.status === 'booked' && now - row.starts_at > LATE_MS,
  }
}

const waitView = (row) => ({
  id: row.id,
  guestName: row.guest_name,
  phone: row.phone,
  guests: row.guests,
  quotedMinutes: row.quoted_minutes,
  tableId: row.table_id,
  tableNumber: row.table_number ?? null,
  createdAt: row.created_at,
  status: row.status,
})

const getBooking = (id) => {
  const row = db.prepare(`${SELECT} WHERE b.id = ?`).get(id)
  if (!row) throw notFound('booking_not_found')
  return row
}

const phoneOrNull = (value) => {
  if (!value) return null
  const phone = normalizePhone(value)
  if (!phone) throw new HttpError(400, 'bad_phone', "Telefon raqam noto'g'ri")
  return phone
}

// Bir stolga vaqti kesishadigan ikki bron bo'lmaydi; mehmon soni stol sig'imidan oshmaydi
function checkSlot({ tableId, guests, startsAt, endsAt }, exceptId = 0) {
  const table = db.prepare('SELECT * FROM tables WHERE id = ? AND active = 1').get(tableId)
  if (!table) throw new HttpError(400, 'table_not_found', 'Stol topilmadi')
  if (guests > table.seats) throw new HttpError(400, 'too_many_guests', `${table.number}-stol ${table.seats} kishilik`)
  const overlap = db
    .prepare("SELECT guest_name, starts_at FROM bookings WHERE table_id = ? AND status = 'booked' AND id != ? AND starts_at < ? AND ends_at > ?")
    .get(tableId, exceptId, endsAt, startsAt)
  if (overlap) {
    throw conflict('booking_overlap', `${table.number}-stol bu vaqtda band: ${overlap.guest_name}, ${localTime(overlap.starts_at)}`)
  }
}

route(
  'get',
  '/bookings',
  {
    tag: 'Bron',
    summary: 'Kun bronlari va kutish navbati',
    description: 'Standart: bugun. Kutish navbati faqat bugun uchun qaytadi.',
    operationId: 'bookings',
    roles: ADMIN_ROLES,
    query: DateQuery,
    response: BookingsData,
  },
  (req) => {
    const now = Date.now()
    const date = req.valid.query.date ?? localDate(now)
    const bookings = db
      .prepare(`${SELECT} WHERE b.starts_at >= ? AND b.starts_at < ? ORDER BY b.starts_at, t.number`)
      .all(dayStart(date), dayEnd(date))
      .map((row) => bookingView(row, now))
    const waitlist =
      date === localDate(now)
        ? db
            .prepare(
              `SELECT w.*, t.number AS table_number FROM waitlist w LEFT JOIN tables t ON t.id = w.table_id
               WHERE w.status = 'waiting' AND w.created_at >= ? ORDER BY w.created_at`,
            )
            .all(dayStart(date))
            .map(waitView)
        : []
    const tables = db
      .prepare(
        `SELECT t.id, t.number, t.seats, z.name AS zone,
          EXISTS (SELECT 1 FROM orders o WHERE o.table_id = t.id AND o.status = 'open') AS busy
         FROM tables t JOIN zones z ON z.id = t.zone_id WHERE t.active = 1 ORDER BY t.number`,
      )
      .all()
      .map((t) => ({ ...t, busy: Boolean(t.busy) }))
    return { date, bookings, waitlist, tables }
  },
)

route(
  'post',
  '/bookings',
  { tag: 'Bron', summary: 'Bron qilish', operationId: 'createBooking', roles: ADMIN_ROLES, body: BookingCreate, response: Booking, status: 201, errors: [409] },
  (req) => {
    const body = req.valid.body
    const startsAt = atLocal(body.date, body.time)
    const endsAt = startsAt + body.durationMinutes * MINUTE
    checkSlot({ tableId: body.tableId, guests: body.guests, startsAt, endsAt })
    const id = Number(
      db
        .prepare(
          'INSERT INTO bookings (table_id, guest_name, phone, guests, starts_at, ends_at, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(body.tableId, body.guestName, phoneOrNull(body.phone), body.guests, startsAt, endsAt, body.note, Date.now()).lastInsertRowid,
    )
    const row = getBooking(id)
    audit({
      actor: req.user,
      category: 'bookings',
      action: 'booking.created',
      target: { type: 'table', number: row.table_number },
      params: { guest: body.guestName, guests: body.guests, at: startsAt },
    })
    return bookingView(row)
  },
)

route(
  'patch',
  '/bookings/:id',
  { tag: 'Bron', summary: "Bronni o'zgartirish", operationId: 'updateBooking', roles: ADMIN_ROLES, params: IdParams, body: BookingUpdate, response: Booking, errors: [404, 409] },
  (req) => {
    const row = getBooking(req.valid.params.id)
    if (row.status !== 'booked') throw conflict('booking_closed', "Bu bronni o'zgartirib bo'lmaydi")
    const body = req.valid.body
    const date = body.date ?? localDate(row.starts_at)
    const time = body.time ?? localTime(row.starts_at)
    const duration = body.durationMinutes ?? Math.round((row.ends_at - row.starts_at) / MINUTE)
    const startsAt = atLocal(date, time)
    const next = {
      tableId: body.tableId ?? row.table_id,
      guests: body.guests ?? row.guests,
      startsAt,
      endsAt: startsAt + duration * MINUTE,
    }
    checkSlot(next, row.id)
    db.prepare('UPDATE bookings SET table_id = ?, guest_name = ?, phone = ?, guests = ?, starts_at = ?, ends_at = ?, note = ? WHERE id = ?').run(
      next.tableId,
      body.guestName ?? row.guest_name,
      body.phone !== undefined ? phoneOrNull(body.phone) : row.phone,
      next.guests,
      next.startsAt,
      next.endsAt,
      body.note !== undefined ? body.note : row.note,
      row.id,
    )
    const updated = getBooking(row.id)
    audit({ actor: req.user, category: 'bookings', action: 'booking.updated', target: { type: 'table', number: updated.table_number }, params: { guest: updated.guest_name, at: updated.starts_at } })
    return bookingView(updated)
  },
)

route(
  'post',
  '/bookings/:id/seat',
  {
    tag: 'Bron',
    summary: "Mehmonni o'tqazish",
    description: 'Stolda buyurtma ochiladi va ofitsiantga buyurtma olish vazifasi tushadi.',
    operationId: 'seatBooking',
    roles: ADMIN_ROLES,
    params: IdParams,
    response: Booking,
    errors: [404, 409],
  },
  (req) => {
    const row = getBooking(req.valid.params.id)
    if (row.status !== 'booked') throw conflict('booking_closed', 'Bron allaqachon yopilgan')
    db.transaction(() => {
      openOrder({ tableId: row.table_id, guests: row.guests })
      db.prepare("UPDATE bookings SET status = 'seated' WHERE id = ?").run(row.id)
      db.prepare("UPDATE exceptions SET status = 'resolved', resolved_at = ?, resolution = ? WHERE booking_id = ? AND status = 'open'").run(
        Date.now(),
        JSON.stringify({ action: 'task_done' }),
        row.id,
      )
    })()
    audit({ actor: req.user, category: 'bookings', action: 'booking.seated', target: { type: 'table', number: row.table_number }, params: { guest: row.guest_name, guests: row.guests } })
    return bookingView(getBooking(row.id))
  },
)

route(
  'post',
  '/bookings/:id/cancel',
  { tag: 'Bron', summary: 'Bronni bekor qilish', operationId: 'cancelBooking', roles: ADMIN_ROLES, params: IdParams, response: Booking, errors: [404, 409] },
  (req) => {
    const row = getBooking(req.valid.params.id)
    if (row.status !== 'booked') throw conflict('booking_closed', 'Bron allaqachon yopilgan')
    db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(row.id)
    audit({ actor: req.user, category: 'bookings', action: 'booking.cancelled', target: { type: 'table', number: row.table_number }, params: { guest: row.guest_name } })
    return bookingView(getBooking(row.id))
  },
)

route(
  'post',
  '/waitlist',
  { tag: 'Bron', summary: "Kutish navbatiga qo'shish", operationId: 'addWaitlist', roles: ADMIN_ROLES, body: WaitlistCreate, response: WaitlistEntry, status: 201 },
  (req) => {
    const body = req.valid.body
    const id = Number(
      db
        .prepare('INSERT INTO waitlist (guest_name, phone, guests, quoted_minutes, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(body.guestName, phoneOrNull(body.phone), body.guests, body.quotedMinutes, Date.now()).lastInsertRowid,
    )
    audit({ actor: req.user, category: 'bookings', action: 'waitlist.added', params: { guest: body.guestName, guests: body.guests, minutes: body.quotedMinutes } })
    return waitView(db.prepare('SELECT * FROM waitlist WHERE id = ?').get(id))
  },
)

route(
  'post',
  '/waitlist/:id/seat',
  { tag: 'Bron', summary: "Navbatdagi mehmonni stolga o'tqazish", operationId: 'seatWaitlist', roles: ADMIN_ROLES, params: IdParams, body: SeatBody, response: Ok, errors: [404, 409] },
  (req) => {
    const entry = db.prepare("SELECT * FROM waitlist WHERE id = ? AND status = 'waiting'").get(req.valid.params.id)
    if (!entry) throw notFound('waitlist_not_found')
    const table = db.prepare('SELECT * FROM tables WHERE id = ? AND active = 1').get(req.valid.body.tableId)
    if (!table) throw notFound('table_not_found')
    if (entry.guests > table.seats) throw new HttpError(400, 'too_many_guests', `${table.number}-stol ${table.seats} kishilik`)
    db.transaction(() => {
      openOrder({ tableId: table.id, guests: entry.guests })
      db.prepare("UPDATE waitlist SET status = 'seated', table_id = ? WHERE id = ?").run(table.id, entry.id)
    })()
    audit({ actor: req.user, category: 'bookings', action: 'waitlist.seated', target: { type: 'table', number: table.number }, params: { guest: entry.guest_name } })
    return { ok: true }
  },
)

route(
  'post',
  '/waitlist/:id/remove',
  { tag: 'Bron', summary: 'Navbatdan chiqarish (mehmon ketdi)', operationId: 'removeWaitlist', roles: ADMIN_ROLES, params: IdParams, response: Ok, errors: [404] },
  (req) => {
    const entry = db.prepare("SELECT * FROM waitlist WHERE id = ? AND status = 'waiting'").get(req.valid.params.id)
    if (!entry) throw notFound('waitlist_not_found')
    db.prepare("UPDATE waitlist SET status = 'left' WHERE id = ?").run(entry.id)
    audit({ actor: req.user, category: 'bookings', action: 'waitlist.left', params: { guest: entry.guest_name } })
    return { ok: true }
  },
)
