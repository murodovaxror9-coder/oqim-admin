import bcrypt from 'bcryptjs'
import { config } from '../config.js'
import { db } from '../db/index.js'
import { DEMO_LOGINS } from '../db/seed.js'
import { audit } from '../lib/audit.js'
import { ADMIN_ROLES, normalizePhone, signToken } from '../lib/auth.js'
import { HttpError } from '../lib/http.js'
import { route } from '../lib/openapi.js'
import { DemoInfo, LoginBody, LoginResult, Status, User } from '../schemas.js'
import { getSettings } from '../services/settings.js'

const ATTEMPTS = new Map()
const WINDOW_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 5

function checkAttempts(key, now) {
  const entry = ATTEMPTS.get(key)
  if (entry && now - entry.first < WINDOW_MS && entry.count >= MAX_ATTEMPTS) {
    const wait = Math.ceil((entry.first + WINDOW_MS - now) / 60000)
    throw new HttpError(429, 'too_many_attempts', `Juda ko'p urinish. ${wait} daqiqadan keyin qayta urining`)
  }
}

function failAttempt(key, now) {
  const entry = ATTEMPTS.get(key)
  if (!entry || now - entry.first >= WINDOW_MS) ATTEMPTS.set(key, { first: now, count: 1 })
  else entry.count += 1
}

route(
  'post',
  '/auth/login',
  {
    tag: 'Kirish',
    summary: 'Telefon va PIN bilan kirish',
    description: "Panelga faqat ega va administrator kira oladi. 5 marta noto'g'ri PIN dan keyin 5 daqiqa kutiladi.",
    operationId: 'login',
    auth: false,
    body: LoginBody,
    response: LoginResult,
    errors: [401, 403],
  },
  (req) => {
    const now = Date.now()
    const phone = normalizePhone(req.valid.body.phone)
    if (!phone) throw new HttpError(400, 'bad_phone', "Telefon raqam noto'g'ri")
    checkAttempts(phone, now)
    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone)
    if (!user || !bcrypt.compareSync(req.valid.body.pin, user.pin_hash)) {
      failAttempt(phone, now)
      throw new HttpError(401, 'bad_credentials', "Telefon yoki PIN noto'g'ri")
    }
    if (user.blocked) throw new HttpError(403, 'blocked', 'Hisob bloklangan')
    if (!ADMIN_ROLES.includes(user.role)) throw new HttpError(403, 'not_admin', 'Panelga faqat ega va administrator kiradi')
    ATTEMPTS.delete(phone)
    audit({ actor: user, category: 'auth', action: 'auth.login', target: { type: 'user', name: user.name }, at: now })
    return { token: signToken(user), user: { id: user.id, name: user.name, role: user.role, phone: user.phone } }
  },
)

route(
  'get',
  '/auth/me',
  { tag: 'Kirish', summary: 'Joriy foydalanuvchi', operationId: 'me', response: User },
  (req) => {
    const user = db.prepare('SELECT id, name, role, phone FROM users WHERE id = ?').get(req.user.id)
    return user
  },
)

route(
  'get',
  '/auth/demo',
  {
    tag: 'Kirish',
    summary: "Demo kirish ma'lumotlari",
    description: "DEMO_MODE yoqilgan bo'lsa kirish sahifasida ko'rsatiladigan telefon va PIN.",
    operationId: 'demoLogins',
    auth: false,
    response: DemoInfo,
  },
  () => ({ demoMode: config.demoMode, logins: config.demoMode ? DEMO_LOGINS : [] }),
)

route(
  'get',
  '/status',
  { tag: 'Kirish', summary: 'Yuqori paneldagi holat', operationId: 'status', roles: ADMIN_ROLES, response: Status },
  () => {
    const settings = getSettings()
    const now = Date.now()
    const openExceptions = db.prepare("SELECT COUNT(*) AS n FROM exceptions WHERE status = 'open'").get().n
    const lateTasks = db
      .prepare('SELECT COUNT(*) AS n FROM tasks WHERE done_at IS NULL AND ? - created_at > sla_seconds * 1000')
      .get(now).n
    return {
      serverTime: now,
      demoMode: config.demoMode,
      restaurant: settings.restaurant.name,
      branch: settings.branch.name,
      openExceptions,
      lateTasks,
      fiscal: { provider: settings.fiscal.provider, connected: Boolean(settings.fiscal.provider) },
      printers: { total: settings.printers.length, offline: settings.printers.filter((p) => !p.connected).length },
    }
  },
)
