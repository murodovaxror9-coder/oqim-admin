import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { db, transaction } from './index.js'
import { DEFAULT_SETTINGS, saveSettings } from '../services/settings.js'

// Demo kirish ma'lumotlari: kirish sahifasida ko'rsatiladi (faqat DEMO_MODE da)
export const DEMO_LOGINS = [
  { role: 'owner', name: 'Bahodir Tursunov', phone: '+998901112233', pin: '1111' },
  { role: 'admin', name: 'Dilnoza Yusupova', phone: '+998902223344', pin: '2222' },
]

const USERS = [
  { name: 'Bahodir Tursunov', phone: '+998901112233', role: 'owner', pin: '1111', post: null, shift: null },
  { name: 'Dilnoza Yusupova', phone: '+998902223344', role: 'admin', pin: '2222', post: null, shift: '09:00' },
  { name: 'Jasur Karimov', phone: '+998903334455', role: 'waiter', pin: '3101', post: null, shift: '10:00' },
  { name: 'Malika Rahimova', phone: '+998904445566', role: 'waiter', pin: '3102', post: null, shift: '10:00' },
  { name: 'Sardor Aliyev', phone: '+998905556677', role: 'waiter', pin: '3103', post: null, shift: '11:00' },
  { name: 'Shahlo Nazarova', phone: '+998906667788', role: 'cashier', pin: '4101', post: 'Kassa 1', shift: '10:00' },
  { name: 'Rustam Qodirov', phone: '+998907778899', role: 'cook', pin: '5101', post: 'hot', shift: '09:00' },
  { name: 'Akmal Ergashev', phone: '+998908889900', role: 'cook', pin: '5102', post: 'kazan', shift: '08:00' },
  { name: 'Javlon Saidov', phone: '+998909990011', role: 'cook', pin: '5103', post: 'grill', shift: null },
]

const ZONES = ['Asosiy zal', 'Ayvon']

// [raqam, zona, o'rin, shakl, x, y, w, h, ofitsiant]
const TABLES = [
  [1, 0, 4, 'rect', 60, 60, 120, 84, 'Jasur Karimov'],
  [2, 0, 4, 'rect', 230, 60, 120, 84, 'Jasur Karimov'],
  [3, 0, 4, 'rect', 400, 60, 120, 84, 'Jasur Karimov'],
  [4, 0, 6, 'rect', 570, 60, 160, 84, 'Jasur Karimov'],
  [5, 0, 2, 'round', 70, 220, 96, 96, 'Malika Rahimova'],
  [6, 0, 2, 'round', 240, 220, 96, 96, 'Malika Rahimova'],
  [7, 0, 6, 'rect', 420, 222, 180, 92, 'Jasur Karimov'],
  [8, 1, 4, 'rect', 60, 400, 120, 84, 'Sardor Aliyev'],
  [9, 1, 4, 'rect', 230, 400, 120, 84, 'Sardor Aliyev'],
  [10, 1, 8, 'rect', 420, 392, 260, 100, 'Sardor Aliyev'],
]

const CATEGORIES = [
  ['Asosiy taomlar', 'Основные блюда'],
  ['Mangal', 'Мангал'],
  ['Gazaklar', 'Закуски'],
  ['Ichimliklar', 'Напитки'],
]

// [kategoriya, uz, ru, narx, tayyorlash daqiqasi, sex, to'lqin, birlik, partiya, ogohlantirish, qozon daqiqasi]
const MENU = [
  [0, 'Osh', 'Плов', 42000, 2, 'kazan', 2, 'portion', 40, 8, 40],
  [0, 'Mastava', 'Мастава', 28000, 2, 'kazan', 2, 'portion', 24, 6, 50],
  [0, "Lag'mon", 'Лагман', 38000, 8, 'hot', 2, 'portion'],
  [0, 'Manti', 'Манты', 36000, 10, 'hot', 2, 'portion'],
  [1, 'Kabob', 'Кабоб', 68000, 14, 'grill', 2, 'portion'],
  [1, "Mol go'shti shashlik", 'Шашлык из говядины', 24000, 12, 'grill', 2, 'skewer'],
  [1, 'Tovuq shashlik', 'Шашлык из курицы', 19000, 12, 'grill', 2, 'skewer'],
  [1, 'Jaz', 'Жаз', 28000, 14, 'grill', 2, 'portion'],
  [2, 'Somsa', 'Самса', 10000, 2, 'kazan', 1, 'piece', 30, 6, 35],
  [2, 'Achchiq-chuchuk', 'Ачичук', 16000, 2, 'cold', 1, 'portion'],
  [2, 'Suzma', 'Сузьма', 9000, 1, 'cold', 1, 'portion'],
  [2, 'Non', 'Лепёшка', 5000, 1, 'kazan', 1, 'piece'],
  [3, "Ko'k choy", 'Зелёный чай', 7000, 2, 'bar', 1, 'pot'],
  [3, 'Qora choy', 'Чёрный чай', 7000, 2, 'bar', 1, 'pot'],
  [3, 'Limonad', 'Лимонад', 18000, 4, 'bar', 1, 'jug'],
  [3, 'Kompot', 'Компот', 14000, 1, 'bar', 1, 'jug'],
  [3, 'Ayron', 'Айран', 8000, 1, 'bar', 1, 'glass'],
]

export const newQrToken = () => crypto.randomBytes(9).toString('base64url')

export const seedIfEmpty = transaction(() => {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) return false
  const now = Date.now()
  saveSettings(DEFAULT_SETTINGS)

  const userIds = new Map()
  const insertUser = db.prepare(
    'INSERT INTO users (name, phone, role, pin_hash, post, shift_start, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
  for (const user of USERS) {
    const result = insertUser.run(user.name, user.phone, user.role, bcrypt.hashSync(user.pin, 8), user.post, user.shift, now)
    userIds.set(user.name, Number(result.lastInsertRowid))
  }

  const zoneIds = ZONES.map((name, sort) => Number(db.prepare('INSERT INTO zones (name, sort) VALUES (?, ?)').run(name, sort).lastInsertRowid))
  const insertTable = db.prepare(
    'INSERT INTO tables (number, zone_id, seats, shape, x, y, w, h, waiter_id, qr_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
  for (const [number, zone, seats, shape, x, y, w, h, waiter] of TABLES) {
    insertTable.run(number, zoneIds[zone], seats, shape, x, y, w, h, userIds.get(waiter), newQrToken())
  }

  const categoryIds = CATEGORIES.map(([uz, ru], sort) =>
    Number(db.prepare('INSERT INTO categories (name_uz, name_ru, sort) VALUES (?, ?, ?)').run(uz, ru, sort).lastInsertRowid),
  )
  const insertItem = db.prepare(
    `INSERT INTO menu_items (category_id, name_uz, name_ru, price, prep_minutes, station, wave, unit,
      batch_size, batch_warn, batch_cook_minutes, ikpu, available, stop_reason, sort)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  MENU.forEach(([category, uz, ru, price, prep, station, wave, unit, size, warn, cook], index) => {
    const stopped = uz === 'Mastava'
    insertItem.run(
      categoryIds[category],
      uz,
      ru,
      price,
      prep,
      station,
      wave,
      unit,
      size ?? null,
      warn ?? null,
      cook ?? null,
      `0${String(1012001001 + index * 1000).padStart(16, '0')}`.slice(0, 17),
      stopped ? 0 : 1,
      stopped ? 'manual' : null,
      index,
    )
  })
  return true
})
