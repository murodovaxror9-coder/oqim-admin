import { db, parseJson } from '../db/index.js'

export const TASK_TYPES = ['take', 'deliver', 'call', 'bill', 'clean']

export const DEFAULT_SETTINGS = {
  restaurant: { name: 'Namuna oshxonasi' },
  branch: { name: 'Chilonzor filiali', address: '', opensAt: '10:00', closesAt: '23:00' },
  // Vazifa muddati (soniya) va og'irligi: og'irlik navbatdagi o'rnini belgilaydi
  tasks: {
    take: { seconds: 180, weight: 1.0 },
    deliver: { seconds: 120, weight: 1.3 },
    call: { seconds: 90, weight: 1.1 },
    bill: { seconds: 120, weight: 1.0 },
    clean: { seconds: 240, weight: 0.6 },
  },
  warnPercent: 70,
  escalation: { ownerMultiplier: 2, helpMaxOpen: 3, helpMinDiff: 2 },
  // Va'da = eng uzoq taom vaqti x koeffitsient + qo'shimcha, yuqoriga yaxlitlanadi
  promise: { coefficient: 1.2, extraMinutes: 3, roundSeconds: 30, warnBeforeSeconds: 90 },
  compensation: { promiseDiscountPercent: 10, serviceChargePercent: 10, serviceChargeOnTakeaway: false },
  targets: { orderToServeSeconds: 900 },
  payments: { cash: true, card: true, qr: true, nfc: true, click: true, payme: true, uzum: true },
  fiscal: { provider: null },
  printers: [
    { id: 'hot', place: 'hot', connection: 'LAN, 192.168.1.31', connected: true },
    { id: 'grill', place: 'grill', connection: 'LAN, 192.168.1.32', connected: true },
    { id: 'kazan', place: 'kazan', connection: 'LAN, 192.168.1.33', connected: true },
    { id: 'cashier', place: 'cashier', connection: 'USB', connected: true },
  ],
  floor: {
    width: 960,
    height: 600,
    landmarks: [
      { type: 'kitchen', x: 800, y: 40, w: 140, h: 230 },
      { type: 'bar', x: 800, y: 290, w: 140, h: 200 },
      { type: 'entrance', x: 330, y: 556, w: 220, h: 32 },
    ],
  },
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

function merge(base, extra) {
  if (!isObject(extra)) return base
  const result = { ...base }
  for (const [key, value] of Object.entries(extra)) {
    result[key] = isObject(value) && isObject(base[key]) ? merge(base[key], value) : value
  }
  return result
}

export function getSettings() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'rules'").get()
  return merge(structuredClone(DEFAULT_SETTINGS), parseJson(row?.value, {}))
}

export function saveSettings(settings) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('rules', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(JSON.stringify(settings))
}

// O'zgargan maydonlar ro'yxati: [{ path: 'tasks.deliver.seconds', from: 150, to: 120 }]
export function diffSettings(before, after, prefix = '') {
  const changes = []
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  for (const key of keys) {
    const path = prefix ? `${prefix}.${key}` : key
    const a = before?.[key]
    const b = after?.[key]
    if (isObject(a) && isObject(b)) changes.push(...diffSettings(a, b, path))
    else if (JSON.stringify(a) !== JSON.stringify(b)) changes.push({ path, from: a ?? null, to: b ?? null })
  }
  return changes
}
