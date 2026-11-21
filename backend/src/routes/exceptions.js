import { db } from '../db/index.js'
import { ADMIN_ROLES } from '../lib/auth.js'
import { route } from '../lib/openapi.js'
import { localDate, dayStart } from '../lib/time.js'
import { ExceptionItem, ExceptionList, ExceptionQuery, IdParams, ResolveBody } from '../schemas.js'
import { listExceptions, reopenException, resolveException } from '../services/exceptions.js'

route(
  'get',
  '/exceptions',
  {
    tag: 'Istisnolar',
    summary: "Ochiq yoki bugun hal qilingan istisnolar",
    description: [
      'Turlar va qarorlar:',
      '- `task_late` — vazifa kechikdi: `reassign` (boshqa ofitsiantga), `remind` (eslatish)',
      '- `batch_low` — qozonda kam qoldi: `new_batch` (yangi qozon), `dismiss`',
      '- `cancel_request` — taomni bekor qilish so\'rovi: `approve`, `reject`',
      '- `booking_late` — bron mehmoni 15 daqiqa kechikdi: `release` (stolni bo\'shatish), `wait`',
      "- `promise_broken` — va'da buzildi, chegirma o'zi qo'llangan (faqat ma'lumot)",
    ].join('\n'),
    operationId: 'listExceptions',
    roles: ADMIN_ROLES,
    query: ExceptionQuery,
    response: ExceptionList,
  },
  (req) => {
    const now = Date.now()
    const since = dayStart(localDate(now))
    const items = listExceptions({ status: req.valid.query.status, since }, now)
    const counts = {
      open: db.prepare("SELECT COUNT(*) AS n FROM exceptions WHERE status = 'open'").get().n,
      resolvedToday: db.prepare("SELECT COUNT(*) AS n FROM exceptions WHERE status = 'resolved' AND created_at >= ?").get(since).n,
    }
    return { items, counts }
  },
)

route(
  'post',
  '/exceptions/:id/resolve',
  {
    tag: 'Istisnolar',
    summary: 'Qaror qabul qilish',
    operationId: 'resolveException',
    roles: ADMIN_ROLES,
    params: IdParams,
    body: ResolveBody,
    response: ExceptionItem,
    errors: [404, 409],
  },
  (req) => resolveException(req.valid.params.id, req.valid.body, req.user),
)

route(
  'post',
  '/exceptions/:id/reopen',
  {
    tag: 'Istisnolar',
    summary: 'Qarorni qaytarish',
    description: "Avvalgi holat tiklanadi (ofitsiant, taom holati, bron) va istisno yana ochiladi.",
    operationId: 'reopenException',
    roles: ADMIN_ROLES,
    params: IdParams,
    response: ExceptionItem,
    errors: [404, 409],
  },
  (req) => reopenException(req.valid.params.id, req.user),
)
