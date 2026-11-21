import { db, parseJson } from '../db/index.js'
import { audit } from '../lib/audit.js'
import { ADMIN_ROLES } from '../lib/auth.js'
import { HttpError, notFound } from '../lib/http.js'
import { route } from '../lib/openapi.js'
import { csvCell } from '../services/reports.js'
import { AuditList, AuditQuery, PrinterParams, PrinterTest, Settings } from '../schemas.js'
import { diffSettings, getSettings, saveSettings } from '../services/settings.js'
import { dayEnd, dayStart } from '../lib/time.js'

route(
  'get',
  '/settings',
  { tag: 'Sozlamalar', summary: 'Qoidalar va sozlamalar', operationId: 'settings', roles: ADMIN_ROLES, response: Settings },
  () => getSettings(),
)

route(
  'put',
  '/settings',
  {
    tag: 'Sozlamalar',
    summary: 'Sozlamalarni saqlash (faqat ega)',
    description: "Har bir o'zgargan maydon audit jurnaliga eski va yangi qiymati bilan yoziladi.",
    operationId: 'saveSettings',
    roles: ['owner'],
    body: Settings,
    response: Settings,
  },
  (req) => {
    const before = getSettings()
    const after = req.valid.body
    if (after.escalation.helpMinDiff >= after.escalation.helpMaxOpen + 1) {
      throw new HttpError(400, 'help_rule', "Yordam qoidasi: farq ochiq ishlar chegarasidan katta bo'lmasin")
    }
    const changes = diffSettings(before, after)
    saveSettings(after)
    if (changes.length) audit({ actor: req.user, category: 'settings', action: 'settings.changed', params: { changes } })
    return getSettings()
  },
)

route(
  'post',
  '/settings/printers/:id/test',
  { tag: 'Sozlamalar', summary: 'Printerga sinov cheki', operationId: 'testPrinter', roles: ADMIN_ROLES, params: PrinterParams, response: PrinterTest, errors: [404] },
  (req) => {
    const printer = getSettings().printers.find((p) => p.id === req.valid.params.id)
    if (!printer) throw notFound('printer_not_found')
    const at = Date.now()
    audit({ actor: req.user, category: 'settings', action: 'printer.tested', target: { type: 'printer', id: printer.id }, params: { ok: printer.connected } })
    return { ok: printer.connected, printer: printer.id, at }
  },
)

// --- Audit jurnali ---

function auditWhere(query) {
  const where = []
  const args = []
  if (query.from) {
    where.push('a.at >= ?')
    args.push(dayStart(query.from))
  }
  if (query.to) {
    where.push('a.at < ?')
    args.push(dayEnd(query.to))
  }
  if (query.category) {
    where.push('a.category = ?')
    args.push(query.category)
  }
  if (query.actorId) {
    where.push('a.actor_id = ?')
    args.push(query.actorId)
  }
  if (query.q) {
    where.push("(a.action LIKE ? OR a.target LIKE ? OR a.params LIKE ? OR COALESCE(u.name, '') LIKE ?)")
    const like = `%${query.q.replace(/[%_]/g, '')}%`
    args.push(like, like, like, like)
  }
  where.push('a.at <= ?')
  args.push(Date.now())
  return { sql: `WHERE ${where.join(' AND ')}`, args }
}

const menuNames = () => new Map(db.prepare('SELECT id, name_uz, name_ru FROM menu_items').all().map((m) => [m.id, m]))

function entryView(row, names) {
  const target = parseJson(row.target)
  if (target.type === 'menu_item' && names.has(target.id)) {
    target.nameUz = names.get(target.id).name_uz
    target.nameRu = names.get(target.id).name_ru
  }
  return {
    id: row.id,
    at: row.at,
    actor: row.actor_id ? { id: row.actor_id, name: row.actor_name, role: row.actor_role } : null,
    actorKind: row.actor_kind,
    category: row.category,
    action: row.action,
    target,
    params: parseJson(row.params),
  }
}

const FROM = 'FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id'

route(
  'get',
  '/audit',
  {
    tag: 'Audit',
    summary: 'Audit jurnali',
    description: "Jurnal faqat yoziladi: yozuvni o'zgartirib ham, o'chirib ham bo'lmaydi (bazada trigger bilan himoyalangan).",
    operationId: 'audit',
    roles: ADMIN_ROLES,
    query: AuditQuery,
    response: AuditList,
  },
  (req) => {
    const query = req.valid.query
    const { sql, args } = auditWhere(query)
    const total = db.prepare(`SELECT COUNT(*) AS n ${FROM} ${sql}`).get(...args).n
    const names = menuNames()
    const items = db
      .prepare(`SELECT a.*, u.name AS actor_name, u.role AS actor_role ${FROM} ${sql} ORDER BY a.at DESC, a.id DESC LIMIT ? OFFSET ?`)
      .all(...args, query.pageSize, (query.page - 1) * query.pageSize)
      .map((row) => entryView(row, names))
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      categories: db.prepare('SELECT DISTINCT category FROM audit_log ORDER BY category').all().map((r) => r.category),
      actors: db.prepare('SELECT DISTINCT u.id, u.name FROM audit_log a JOIN users u ON u.id = a.actor_id ORDER BY u.name').all(),
    }
  },
)

route(
  'get',
  '/audit/export',
  { tag: 'Audit', summary: 'Jurnalni CSV qilib yuklab olish', operationId: 'auditExport', roles: ADMIN_ROLES, query: AuditQuery, produces: 'text/csv' },
  (req, res) => {
    const { sql, args } = auditWhere(req.valid.query)
    const names = menuNames()
    const rows = db
      .prepare(`SELECT a.*, u.name AS actor_name, u.role AS actor_role ${FROM} ${sql} ORDER BY a.at DESC LIMIT 20000`)
      .all(...args)
      .map((row) => entryView(row, names))
    const lines = rows.map((r) => {
      const iso = new Date(r.at + 5 * 3600 * 1000).toISOString()
      return [iso.slice(0, 10), iso.slice(11, 19), r.actor?.name ?? r.actorKind, r.category, r.action, JSON.stringify(r.target), JSON.stringify(r.params)]
    })
    const header = ['Sana', 'Vaqt', 'Kim', 'Toifa', 'Amal', 'Obyekt', 'Tafsilot']
    res.set('Content-Type', 'text/csv; charset=utf-8')
    res.set('Content-Disposition', 'attachment; filename="oqim-audit.csv"')
    res.send(`﻿${[header, ...lines].map((line) => line.map(csvCell).join(';')).join('\r\n')}`)
  },
)
