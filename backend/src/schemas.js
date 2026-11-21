import { z } from 'zod'
import { isDate } from './lib/time.js'

z.config(z.locales.uz())

// Hamma so'rov va javob sxemalari: tekshiruv ham, Swagger hujjati ham shulardan

const ms = (description = 'Vaqt, ms (Unix epoch)') => z.number().int().meta({ description })
const id = z.coerce.number().int().positive()
const money = z.number().int().meta({ description: "So'm" })

export const IdParams = z.object({ id })
export const DateString = z.string().refine(isDate, 'Sana YYYY-MM-DD ko\'rinishida').meta({ example: '2026-11-19' })
const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Vaqt HH:MM ko\'rinishida').meta({ example: '18:30' })

export const Role = z.enum(['owner', 'admin', 'waiter', 'cashier', 'cook']).meta({ id: 'Role' })
export const TaskType = z.enum(['take', 'deliver', 'call', 'bill', 'clean']).meta({ id: 'TaskType' })
export const Level = z.enum(['calm', 'warn', 'late']).meta({ id: 'Level', description: 'calm — vaqt bor, warn — muddatning 70%i o\'tdi, late — kechikdi' })
export const Station = z.enum(['hot', 'grill', 'kazan', 'cold', 'bar']).meta({ id: 'Station' })
export const PaymentMethod = z.enum(['cash', 'card', 'click', 'payme', 'uzum', 'nfc']).meta({ id: 'PaymentMethod' })

const Ref = z.object({ id: z.number().int(), name: z.string() }).meta({ id: 'UserRef' })

export const ErrorBody = z
  .object({
    error: z.object({
      code: z.string().meta({ example: 'validation' }),
      message: z.string(),
      details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
    }),
  })
  .meta({ id: 'Error' })

export const Ok = z.object({ ok: z.literal(true) }).meta({ id: 'Ok' })

// --- Auth ---

export const LoginBody = z
  .object({
    phone: z.string().min(9).meta({ example: '+998901112233' }),
    pin: z.string().regex(/^\d{4}$/, 'PIN 4 ta raqam').meta({ example: '1111' }),
  })
  .meta({ id: 'LoginBody' })

export const User = z
  .object({ id: z.number().int(), name: z.string(), role: Role, phone: z.string() })
  .meta({ id: 'User' })

export const LoginResult = z.object({ token: z.string(), user: User }).meta({ id: 'LoginResult' })

export const DemoInfo = z
  .object({
    demoMode: z.boolean(),
    logins: z.array(z.object({ role: Role, name: z.string(), phone: z.string(), pin: z.string() })),
  })
  .meta({ id: 'DemoInfo' })

export const Status = z
  .object({
    serverTime: ms(),
    demoMode: z.boolean(),
    restaurant: z.string(),
    branch: z.string(),
    openExceptions: z.number().int(),
    lateTasks: z.number().int(),
    fiscal: z.object({ provider: z.string().nullable(), connected: z.boolean() }),
    printers: z.object({ total: z.number().int(), offline: z.number().int() }),
  })
  .meta({ id: 'Status' })

// --- Zal ---

export const Task = z
  .object({
    id: z.number().int(),
    type: TaskType,
    tableId: z.number().int(),
    tableNumber: z.number().int(),
    orderId: z.number().int().nullable(),
    waiter: Ref.nullable(),
    helpedFrom: Ref.nullable().meta({ description: 'Yordam qoidasi bilan kimdan olindi' }),
    createdAt: ms(),
    elapsedSeconds: z.number().int(),
    slaSeconds: z.number().int(),
    level: Level,
    priority: z.number().meta({ description: '(kutish / muddat + 0,15) × og\'irlik' }),
    ownerAlert: z.boolean(),
  })
  .meta({ id: 'Task' })

const OrderItem = z.object({
  id: z.number().int(),
  nameUz: z.string(),
  nameRu: z.string(),
  qty: z.number().int(),
  price: money,
  status: z.enum(['queued', 'cooking', 'ready', 'served', 'cancelled']),
  wave: z.number().int(),
  readyAt: ms().nullable(),
  cancelRequested: z.boolean(),
})

export const HallTable = z
  .object({
    id: z.number().int(),
    number: z.number().int(),
    zoneId: z.number().int(),
    seats: z.number().int(),
    shape: z.enum(['rect', 'round']),
    x: z.number().int(),
    y: z.number().int(),
    w: z.number().int(),
    h: z.number().int(),
    waiter: Ref.nullable(),
    status: z.enum(['free', 'held', 'ordering', 'waiting', 'eating', 'bill', 'cleaning']),
    level: Level,
    tasks: z.array(Task),
    booking: z
      .object({ id: z.number().int(), guestName: z.string(), guests: z.number().int(), startsAt: ms(), note: z.string().nullable() })
      .nullable(),
    order: z
      .object({
        id: z.number().int(),
        guests: z.number().int(),
        source: z.string(),
        openedAt: ms(),
        orderedAt: ms().nullable(),
        servedAt: ms().nullable(),
        billAt: ms().nullable(),
        promiseAt: ms().nullable(),
        promiseBroken: z.boolean(),
        subtotal: money,
        serviceCharge: money,
        discount: money,
        total: money,
        items: z.array(OrderItem),
      })
      .nullable(),
  })
  .meta({ id: 'HallTable' })

const Floor = z
  .object({
    width: z.number().int(),
    height: z.number().int(),
    landmarks: z.array(z.object({ type: z.string(), x: z.number(), y: z.number(), w: z.number(), h: z.number() })),
  })
  .meta({ id: 'Floor' })

const Zone = z.object({ id: z.number().int(), name: z.string(), sort: z.number().int() }).meta({ id: 'Zone' })

export const Hall = z
  .object({
    serverTime: ms(),
    floor: Floor,
    zones: z.array(Zone),
    tables: z.array(HallTable),
    queue: z.array(Task).meta({ description: 'Ochiq vazifalar, navbat tartibida' }),
    waiters: z.array(
      z.object({
        id: z.number().int(),
        name: z.string(),
        onShift: z.boolean(),
        tables: z.array(z.number().int()),
        openTasks: z.number().int(),
        lateTasks: z.number().int(),
        overloaded: z.boolean(),
      }),
    ),
    kitchen: z.array(z.object({ station: Station, status: z.string(), qty: z.number().int() })),
    summary: z.object({
      tables: z.number().int(),
      busy: z.number().int(),
      free: z.number().int(),
      guests: z.number().int(),
      lateTasks: z.number().int(),
      warnTasks: z.number().int(),
    }),
  })
  .meta({ id: 'Hall' })

export const MoveOrderBody = z.object({ tableId: z.number().int().positive() }).meta({ id: 'MoveOrderBody' })
export const ReassignBody = z.object({ waiterId: z.number().int().positive() }).meta({ id: 'ReassignBody' })

// --- Bugun ---

const Totals = z
  .object({
    revenue: money,
    orders: z.number().int(),
    guests: z.number().int(),
    avgCheck: money,
    discounts: money,
    serviceCharge: money,
    promiseBroken: z.number().int(),
    promiseKeptPercent: z.number().nullable(),
    avgServeSeconds: z.number().int().nullable().meta({ description: 'Buyurtmadan asosiy taom dasturxonga yetguncha' }),
  })
  .meta({ id: 'SalesTotals' })

const TaskStats = z
  .object({
    count: z.number().int(),
    late: z.number().int(),
    latePercent: z.number(),
    avgSeconds: z.number().int().nullable(),
    byType: z.array(
      z.object({
        type: TaskType,
        count: z.number().int(),
        avgSeconds: z.number().int().nullable(),
        slaSeconds: z.number().int(),
        latePercent: z.number(),
      }),
    ),
  })
  .meta({ id: 'TaskStats' })

const WaiterStats = z
  .object({
    id: z.number().int(),
    name: z.string(),
    tasks: z.number().int(),
    avgSeconds: z.number().int().nullable(),
    lateCount: z.number().int(),
    latePercent: z.number(),
    orders: z.number().int(),
    revenue: money,
  })
  .meta({ id: 'WaiterStats' })

const TopItem = z
  .object({ id: z.number().int(), nameUz: z.string(), nameRu: z.string(), qty: z.number().int(), revenue: money })
  .meta({ id: 'TopItem' })

export const AuditEntry = z
  .object({
    id: z.number().int(),
    at: ms(),
    actor: z.object({ id: z.number().int(), name: z.string(), role: Role.optional() }).nullable(),
    actorKind: z.enum(['user', 'system', 'guest']),
    category: z.string(),
    action: z.string().meta({ description: 'Amal kodi, masalan exception.resolved. Matni frontendda tarjima qilinadi' }),
    target: z.record(z.string(), z.any()),
    params: z.record(z.string(), z.any()),
  })
  .meta({ id: 'AuditEntry' })

export const Today = z
  .object({
    date: z.string(),
    serverTime: ms(),
    today: Totals,
    lastWeek: Totals.meta({ description: "O'tgan haftaning shu kuni, aynan shu soatgacha" }),
    tasks: TaskStats,
    targets: z.object({ orderToServeSeconds: z.number().int() }),
    hourly: z.array(z.object({ hour: z.number().int(), revenue: money.nullable(), lastWeek: money })),
    live: z.object({
      tables: z.number().int(),
      busy: z.number().int(),
      free: z.number().int(),
      guests: z.number().int(),
      lateTasks: z.number().int(),
      warnTasks: z.number().int(),
      openExceptions: z.number().int(),
      exceptionsByType: z.array(z.object({ type: z.string(), n: z.number().int() })),
    }),
    waiters: z.array(WaiterStats.extend({ openTasks: z.number().int(), onShift: z.boolean() })),
    batches: z.array(
      z.object({
        menuItemId: z.number().int(),
        nameUz: z.string(),
        nameRu: z.string(),
        stock: z.number().int(),
        warn: z.number().int().nullable(),
        size: z.number().int(),
        available: z.boolean(),
        stopReason: z.string().nullable(),
        nextReadyAt: ms().nullable(),
      }),
    ),
    bookings: z.array(
      z.object({
        id: z.number().int(),
        guestName: z.string(),
        guests: z.number().int(),
        startsAt: ms(),
        note: z.string().nullable(),
        tableNumber: z.number().int(),
      }),
    ),
    topItems: z.array(TopItem),
    events: z.array(AuditEntry),
  })
  .meta({ id: 'Today' })

// --- Istisnolar ---

export const ExceptionType = z
  .enum(['task_late', 'batch_low', 'cancel_request', 'booking_late', 'promise_broken'])
  .meta({ id: 'ExceptionType' })

export const ExceptionItem = z
  .object({
    id: z.number().int(),
    type: ExceptionType,
    status: z.enum(['open', 'resolved']),
    createdAt: ms(),
    resolvedAt: ms().nullable(),
    resolvedBy: Ref.nullable(),
    resolution: z.object({ action: z.string(), waiterName: z.string().nullable() }).nullable(),
    table: z.object({ id: z.number().int(), number: z.number().int() }).nullable(),
    menuItem: z.object({ id: z.number().int(), nameUz: z.string(), nameRu: z.string() }).nullable(),
    task: z
      .object({ id: z.number().int(), waitSeconds: z.number().int(), done: z.boolean(), waiterName: z.string().nullable() })
      .nullable(),
    payload: z.record(z.string(), z.any()),
    actions: z.array(z.string()).meta({ description: 'Shu istisno uchun mumkin bo\'lgan qarorlar' }),
    canReopen: z.boolean(),
  })
  .meta({ id: 'Exception' })

export const ExceptionList = z
  .object({ items: z.array(ExceptionItem), counts: z.object({ open: z.number().int(), resolvedToday: z.number().int() }) })
  .meta({ id: 'ExceptionList' })

export const ExceptionQuery = z.object({ status: z.enum(['open', 'resolved']).default('open') })

export const ResolveBody = z
  .object({
    action: z.enum(['reassign', 'remind', 'new_batch', 'dismiss', 'approve', 'reject', 'release', 'wait']),
    waiterId: z.number().int().positive().optional().meta({ description: 'reassign uchun; berilmasa tavsiya etilgan ofitsiant' }),
  })
  .meta({ id: 'ResolveBody' })

// --- Hisobotlar ---

export const RangeQuery = z
  .object({ from: DateString.optional(), to: DateString.optional() })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: "'from' sanasi 'to' dan keyin bo'lmasin", path: ['from'] })

export const Report = z
  .object({
    from: z.string(),
    to: z.string(),
    days: z.number().int(),
    totals: Totals,
    previous: Totals.meta({ description: 'Oldingi shuncha kunlik davr' }),
    tasks: TaskStats,
    daily: z.array(
      z.object({
        date: z.string(),
        revenue: money,
        orders: z.number().int(),
        guests: z.number().int(),
        avgServeSeconds: z.number().int().nullable(),
      }),
    ),
    byHour: z.array(z.object({ hour: z.number().int(), revenue: money, orders: z.number() })),
    waiters: z.array(WaiterStats),
    topItems: z.array(TopItem),
    payments: z.array(z.object({ method: PaymentMethod, count: z.number().int(), amount: money })),
    sources: z.array(z.object({ source: z.string(), count: z.number().int() })),
  })
  .meta({ id: 'Report' })

// --- Menyu ---

export const Category = z
  .object({ id: z.number().int(), nameUz: z.string(), nameRu: z.string(), sort: z.number().int(), items: z.number().int() })
  .meta({ id: 'Category' })

export const MenuItem = z
  .object({
    id: z.number().int(),
    categoryId: z.number().int(),
    nameUz: z.string(),
    nameRu: z.string(),
    price: money,
    prepMinutes: z.number().int(),
    station: Station,
    wave: z.number().int().meta({ description: '1 — darhol (ichimlik, salat), 2 — asosiy taom' }),
    unit: z.string(),
    batchSize: z.number().int().nullable(),
    batchWarn: z.number().int().nullable(),
    batchCookMinutes: z.number().int().nullable(),
    batchStock: z.number().int().nullable(),
    ikpu: z.string().nullable(),
    available: z.boolean(),
    stopReason: z.enum(['manual', 'batch_empty']).nullable(),
    soldToday: z.number().int(),
    sort: z.number().int(),
  })
  .meta({ id: 'MenuItem' })

export const Menu = z.object({ categories: z.array(Category), items: z.array(MenuItem) }).meta({ id: 'Menu' })

export const CategoryBody = z
  .object({ nameUz: z.string().trim().min(1).max(60), nameRu: z.string().trim().min(1).max(60), sort: z.number().int().optional() })
  .meta({ id: 'CategoryBody' })

const MenuItemFields = {
  categoryId: z.number().int().positive(),
  nameUz: z.string().trim().min(1).max(80),
  nameRu: z.string().trim().min(1).max(80),
  price: z.number().int().min(0).max(100_000_000),
  prepMinutes: z.number().int().min(0).max(240),
  station: Station,
  wave: z.union([z.literal(1), z.literal(2)]),
  unit: z.string().trim().min(1).max(20),
  batchSize: z.number().int().positive().nullable(),
  batchWarn: z.number().int().min(0).nullable(),
  batchCookMinutes: z.number().int().positive().nullable(),
  ikpu: z.string().regex(/^\d{17}$/, 'IKPU 17 ta raqam').nullable(),
  sort: z.number().int(),
}

export const MenuItemCreate = z
  .object({
    ...MenuItemFields,
    unit: MenuItemFields.unit.default('portion'),
    wave: MenuItemFields.wave.default(2),
    batchSize: MenuItemFields.batchSize.default(null),
    batchWarn: MenuItemFields.batchWarn.default(null),
    batchCookMinutes: MenuItemFields.batchCookMinutes.default(null),
    ikpu: MenuItemFields.ikpu.default(null),
    sort: MenuItemFields.sort.optional(),
  })
  .meta({ id: 'MenuItemCreate' })

export const MenuItemUpdate = z.object(MenuItemFields).partial().meta({ id: 'MenuItemUpdate' })

export const AvailabilityBody = z.object({ available: z.boolean() }).meta({ id: 'AvailabilityBody' })
export const BatchBody = z.object({ menuItemId: z.number().int().positive() }).meta({ id: 'BatchBody' })

// --- Stollar ---

export const TableItem = z
  .object({
    id: z.number().int(),
    number: z.number().int(),
    zoneId: z.number().int(),
    seats: z.number().int(),
    shape: z.enum(['rect', 'round']),
    x: z.number().int(),
    y: z.number().int(),
    w: z.number().int(),
    h: z.number().int(),
    waiter: Ref.nullable(),
    qrUrl: z.string(),
    busy: z.boolean(),
  })
  .meta({ id: 'TableItem' })

export const TablesData = z
  .object({ zones: z.array(Zone), tables: z.array(TableItem), floor: Floor, waiters: z.array(Ref) })
  .meta({ id: 'TablesData' })

const TableFields = {
  number: z.number().int().min(1).max(999),
  zoneId: z.number().int().positive(),
  seats: z.number().int().min(1).max(40),
  shape: z.enum(['rect', 'round']),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(40).max(600),
  h: z.number().int().min(40).max(600),
  waiterId: z.number().int().positive().nullable(),
}
export const TableCreate = z
  .object({ ...TableFields, shape: TableFields.shape.default('rect'), waiterId: TableFields.waiterId.default(null) })
  .meta({ id: 'TableCreate' })
export const TableUpdate = z.object(TableFields).partial().meta({ id: 'TableUpdate' })
export const LayoutBody = z
  .object({
    tables: z.array(z.object({ id: z.number().int().positive(), x: z.number().int().min(0), y: z.number().int().min(0), w: z.number().int().min(40), h: z.number().int().min(40) })),
  })
  .meta({ id: 'LayoutBody' })
export const TableWaiterBody = z.object({ waiterId: z.number().int().positive().nullable() }).meta({ id: 'TableWaiterBody' })
export const ZoneBody = z.object({ name: z.string().trim().min(1).max(40), sort: z.number().int().optional() }).meta({ id: 'ZoneBody' })
export const QrList = z
  .object({ items: z.array(z.object({ tableId: z.number().int(), number: z.number().int(), url: z.string(), svg: z.string() })) })
  .meta({ id: 'QrList' })

// --- Bronlar ---

export const Booking = z
  .object({
    id: z.number().int(),
    tableId: z.number().int(),
    tableNumber: z.number().int(),
    guestName: z.string(),
    phone: z.string().nullable(),
    guests: z.number().int(),
    startsAt: ms(),
    endsAt: ms(),
    note: z.string().nullable(),
    status: z.enum(['booked', 'seated', 'cancelled', 'no_show']),
    late: z.boolean(),
  })
  .meta({ id: 'Booking' })

export const WaitlistEntry = z
  .object({
    id: z.number().int(),
    guestName: z.string(),
    phone: z.string().nullable(),
    guests: z.number().int(),
    quotedMinutes: z.number().int(),
    tableId: z.number().int().nullable(),
    tableNumber: z.number().int().nullable(),
    createdAt: ms(),
    status: z.enum(['waiting', 'seated', 'left']),
  })
  .meta({ id: 'WaitlistEntry' })

export const BookingsData = z
  .object({
    date: z.string(),
    bookings: z.array(Booking),
    waitlist: z.array(WaitlistEntry),
    tables: z.array(z.object({ id: z.number().int(), number: z.number().int(), seats: z.number().int(), zone: z.string(), busy: z.boolean() })),
  })
  .meta({ id: 'BookingsData' })

export const DateQuery = z.object({ date: DateString.optional() })

export const BookingCreate = z
  .object({
    tableId: z.number().int().positive(),
    guestName: z.string().trim().min(1).max(60),
    phone: z.string().trim().max(20).nullable().default(null),
    guests: z.number().int().min(1).max(60),
    date: DateString,
    time: Time,
    durationMinutes: z.number().int().min(15).max(720).default(90),
    note: z.string().trim().max(300).nullable().default(null),
  })
  .meta({ id: 'BookingCreate' })

export const BookingUpdate = z
  .object({
    tableId: z.number().int().positive(),
    guestName: z.string().trim().min(1).max(60),
    phone: z.string().trim().max(20).nullable(),
    guests: z.number().int().min(1).max(60),
    date: DateString,
    time: Time,
    durationMinutes: z.number().int().min(15).max(720),
    note: z.string().trim().max(300).nullable(),
  })
  .partial()
  .meta({ id: 'BookingUpdate' })

export const WaitlistCreate = z
  .object({
    guestName: z.string().trim().min(1).max(60),
    phone: z.string().trim().max(20).nullable().default(null),
    guests: z.number().int().min(1).max(60),
    quotedMinutes: z.number().int().min(1).max(180),
  })
  .meta({ id: 'WaitlistCreate' })

export const SeatBody = z.object({ tableId: z.number().int().positive() }).meta({ id: 'SeatBody' })

// --- Prognoz ---

export const Forecast = z
  .object({
    date: z.string(),
    basis: z.array(z.object({ date: z.string(), orders: z.number().int(), revenue: money })).meta({ description: 'Prognoz asosidagi kunlar' }),
    totals: z.object({
      revenue: money,
      revenueMin: money,
      revenueMax: money,
      orders: z.number().int(),
      guests: z.number().int(),
      peakHour: z.number().int(),
      waitersScheduled: z.number().int(),
      waitersPeak: z.number().int(),
    }),
    hourly: z.array(
      z.object({ hour: z.number().int(), orders: z.number(), guests: z.number(), revenue: money, waitersNeeded: z.number().int() }),
    ),
    items: z.array(
      z.object({
        menuItemId: z.number().int(),
        nameUz: z.string(),
        nameRu: z.string(),
        batchSize: z.number().int(),
        cookMinutes: z.number().int().nullable(),
        expectedPortions: z.number().int(),
        plannedPortions: z.number().int(),
        hourly: z.array(z.object({ hour: z.number().int(), portions: z.number() })),
        plans: z.array(
          z.object({
            id: z.number().int(),
            startTime: z.string(),
            readyTime: z.string(),
            batches: z.number().int(),
            portions: z.number().int(),
            status: z.enum(['proposed', 'confirmed']),
            confirmedAt: ms().nullable(),
            confirmedBy: z.string().nullable(),
          }),
        ),
      }),
    ),
    confirmed: z.boolean(),
    editable: z.boolean(),
  })
  .meta({ id: 'Forecast' })

export const PlanUpdate = z
  .object({ startTime: Time.optional(), batches: z.number().int().min(0).max(10).optional() })
  .meta({ id: 'PlanUpdate' })
export const ConfirmBody = z.object({ date: DateString }).meta({ id: 'ConfirmBody' })

// --- Xodimlar ---

export const StaffMember = z
  .object({
    id: z.number().int(),
    name: z.string(),
    phone: z.string(),
    role: Role,
    post: z.string().nullable(),
    shiftStart: z.string().nullable(),
    onShift: z.boolean(),
    shiftStartedAt: ms().nullable(),
    blocked: z.boolean(),
    tables: z.array(z.number().int()),
    today: z.object({ tasks: z.number().int(), avgSeconds: z.number().int().nullable(), latePercent: z.number() }),
  })
  .meta({ id: 'StaffMember' })

export const StaffData = z
  .object({
    users: z.array(StaffMember),
    roles: z.array(
      z.object({
        permission: z.string(),
        values: z.record(z.string(), z.enum(['yes', 'no', 'own_station', 'with_approval', 'own_results', 'own_shift'])),
      }),
    ),
  })
  .meta({ id: 'StaffData' })

export const StaffCreate = z
  .object({
    name: z.string().trim().min(2).max(60),
    phone: z.string().min(9),
    role: Role,
    post: z.string().trim().max(40).nullable().default(null),
    shiftStart: Time.nullable().default(null),
  })
  .meta({ id: 'StaffCreate' })

export const StaffUpdate = z
  .object({
    name: z.string().trim().min(2).max(60),
    phone: z.string().min(9),
    role: Role,
    post: z.string().trim().max(40).nullable(),
    shiftStart: Time.nullable(),
  })
  .partial()
  .meta({ id: 'StaffUpdate' })

export const PinResult = z
  .object({ user: StaffMember, pin: z.string().meta({ description: 'Yangi PIN faqat bir marta ko\'rsatiladi' }) })
  .meta({ id: 'PinResult' })

// --- Sozlamalar ---

const TaskRule = z.object({ seconds: z.number().int().min(15).max(3600), weight: z.number().min(0.1).max(5) })

export const Settings = z
  .object({
    restaurant: z.object({ name: z.string().trim().min(1).max(80) }),
    branch: z.object({ name: z.string().trim().min(1).max(80), address: z.string().max(200), opensAt: Time, closesAt: Time }),
    tasks: z.object({ take: TaskRule, deliver: TaskRule, call: TaskRule, bill: TaskRule, clean: TaskRule }),
    warnPercent: z.number().int().min(30).max(95),
    escalation: z.object({
      ownerMultiplier: z.number().min(1.2).max(5),
      helpMaxOpen: z.number().int().min(1).max(10),
      helpMinDiff: z.number().int().min(1).max(10),
    }),
    promise: z.object({
      coefficient: z.number().min(1).max(3),
      extraMinutes: z.number().int().min(0).max(30),
      roundSeconds: z.number().int().min(10).max(300),
      warnBeforeSeconds: z.number().int().min(0).max(600),
    }),
    compensation: z.object({
      promiseDiscountPercent: z.number().int().min(0).max(50),
      serviceChargePercent: z.number().int().min(0).max(30),
      serviceChargeOnTakeaway: z.boolean(),
    }),
    targets: z.object({ orderToServeSeconds: z.number().int().min(60).max(7200) }),
    payments: z.object({
      cash: z.boolean(),
      card: z.boolean(),
      qr: z.boolean(),
      nfc: z.boolean(),
      click: z.boolean(),
      payme: z.boolean(),
      uzum: z.boolean(),
    }),
    fiscal: z.object({ provider: z.string().nullable() }),
    printers: z.array(z.object({ id: z.string(), place: z.string(), connection: z.string(), connected: z.boolean() })),
    floor: Floor,
  })
  .meta({ id: 'Settings' })

export const PrinterTest = z.object({ ok: z.boolean(), printer: z.string(), at: ms() }).meta({ id: 'PrinterTest' })
export const PrinterParams = z.object({ id: z.string() })

// --- Jurnal ---

export const AuditQuery = z.object({
  from: DateString.optional(),
  to: DateString.optional(),
  category: z.string().optional(),
  actorId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(200).default(50),
})

export const AuditList = z
  .object({
    items: z.array(AuditEntry),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
    categories: z.array(z.string()),
    actors: z.array(Ref),
  })
  .meta({ id: 'AuditList' })
