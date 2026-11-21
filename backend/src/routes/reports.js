import { ADMIN_ROLES } from '../lib/auth.js'
import { route } from '../lib/openapi.js'
import { addDays, localDate } from '../lib/time.js'
import { RangeQuery, Report } from '../schemas.js'
import { getReport, reportCsv } from '../services/reports.js'

const MAX_DAYS = 92

function range(query) {
  const today = localDate()
  const to = query.to ?? today
  const from = query.from ?? addDays(to, -6)
  const limit = addDays(to, -(MAX_DAYS - 1))
  return { from: from < limit ? limit : from, to }
}

route(
  'get',
  '/reports',
  {
    tag: 'Hisobotlar',
    summary: 'Davr hisoboti',
    description: "Standart: oxirgi 7 kun. Eng ko'pi 92 kun. Oldingi shuncha kunlik davr bilan solishtiriladi.",
    operationId: 'report',
    roles: ADMIN_ROLES,
    query: RangeQuery,
    response: Report,
  },
  (req) => getReport(range(req.valid.query)),
)

route(
  'get',
  '/reports/export',
  {
    tag: 'Hisobotlar',
    summary: 'Buyurtmalarni CSV qilib yuklab olish',
    description: 'Excel uchun: UTF-8 BOM, ajratuvchi `;`.',
    operationId: 'reportExport',
    roles: ADMIN_ROLES,
    query: RangeQuery,
    produces: 'text/csv',
  },
  (req, res) => {
    const { from, to } = range(req.valid.query)
    res.set('Content-Type', 'text/csv; charset=utf-8')
    res.set('Content-Disposition', `attachment; filename="oqim-hisobot-${from}_${to}.csv"`)
    res.send(reportCsv({ from, to }))
  },
)
