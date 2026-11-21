import { db } from '../db/index.js'

const insert = db.prepare(
  'INSERT INTO audit_log (at, actor_id, actor_kind, category, action, target, params, is_demo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
)

// Jurnalga yozuv: kim (actor yoki tizim), qaysi toifa, qanday amal, nimaga, tafsilotlar.
// Matn tarjimasi frontendda: bu yerda faqat kodlar va parametrlar saqlanadi.
export function audit({ actor = null, kind, category, action, target = {}, params = {}, at = Date.now(), demo = false }) {
  insert.run(
    at,
    actor?.id ?? null,
    actor ? 'user' : (kind ?? 'system'),
    category,
    action,
    JSON.stringify(target),
    JSON.stringify(params),
    demo ? 1 : 0,
  )
}
