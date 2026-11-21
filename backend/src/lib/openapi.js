import { Router } from 'express'
import { z } from 'zod'
import { ErrorBody } from '../schemas.js'
import { requireAuth, requireRole } from './auth.js'
import { validate } from './http.js'

// Bitta joyda: marshrut, tekshiruv va Swagger hujjati. Har bir route() chaqiruvi ikkalasini ham yaratadi.

export const apiRouter = Router()
const operations = []

export function route(method, path, spec, handler) {
  const middlewares = []
  if (spec.auth !== false) middlewares.push(requireAuth)
  if (spec.roles) middlewares.push(requireRole(...spec.roles))
  if (spec.params || spec.query || spec.body) middlewares.push(validate(spec))
  apiRouter[method](path, ...middlewares, async (req, res) => {
    const result = await handler(req, res)
    if (result !== undefined && !res.headersSent) res.status(spec.status ?? 200).json(result)
  })
  operations.push({ method, path, spec })
}

const ERRORS = {
  400: "Ma'lumot noto'g'ri",
  401: 'Tizimga kirilmagan',
  403: "Huquq yo'q",
  404: 'Topilmadi',
  409: 'Holat ziddiyati',
}

class SchemaCollector {
  constructor() {
    this.schemas = {}
  }

  // zod → JSON Schema; $defs dagi nomli sxemalar components.schemas ga ko'chiriladi
  convert(schema, io = 'output') {
    const json = z.toJSONSchema(schema, { io, unrepresentable: 'any' })
    const rename = new Map()
    for (const [name, def] of Object.entries(json.$defs ?? {})) {
      let target = name
      const existing = this.schemas[name]
      if (existing && JSON.stringify(existing) !== JSON.stringify(def)) target = `${name}${io === 'input' ? 'Input' : ''}`
      rename.set(name, target)
    }
    const fix = (node) => {
      if (Array.isArray(node)) return node.map(fix)
      if (!node || typeof node !== 'object') return node
      const out = {}
      for (const [key, value] of Object.entries(node)) {
        if (key === '$ref' && typeof value === 'string' && value.startsWith('#/$defs/')) {
          const name = value.slice(8)
          out.$ref = `#/components/schemas/${rename.get(name) ?? name}`
        } else if (key !== '$defs' && key !== '$schema') out[key] = fix(value)
      }
      return out
    }
    for (const [name, def] of Object.entries(json.$defs ?? {})) this.schemas[rename.get(name)] = fix(def)
    return fix(json)
  }
}

function parametersOf(collector, schema, location) {
  if (!schema) return []
  const json = collector.convert(schema, 'input')
  return Object.entries(json.properties ?? {}).map(([name, prop]) => ({
    name,
    in: location,
    required: location === 'path' || (json.required ?? []).includes(name) && prop.default === undefined,
    schema: prop,
    ...(prop.description ? { description: prop.description } : {}),
  }))
}

export function buildDocument({ servers }) {
  const collector = new SchemaCollector()
  const errorRef = collector.convert(ErrorBody)
  const paths = {}
  for (const { method, path, spec } of operations) {
    const openPath = `/api${path.replace(/:(\w+)/g, '{$1}')}`
    const responses = {}
    const ok = spec.status ?? 200
    if (spec.response) {
      responses[ok] = { description: spec.responseDescription ?? 'OK', content: { 'application/json': { schema: collector.convert(spec.response) } } }
    } else if (spec.produces) {
      responses[ok] = { description: spec.responseDescription ?? 'Fayl', content: { [spec.produces]: { schema: { type: 'string' } } } }
    } else {
      responses[ok] = { description: 'OK' }
    }
    const errorCodes = new Set([400, ...(spec.auth === false ? [] : [401, 403]), ...(spec.errors ?? [])])
    if (!spec.params && !spec.query && !spec.body) errorCodes.delete(400)
    for (const code of [...errorCodes].sort()) {
      responses[code] = { description: ERRORS[code] ?? 'Xato', content: { 'application/json': { schema: errorRef } } }
    }
    paths[openPath] ??= {}
    paths[openPath][method] = {
      tags: [spec.tag],
      summary: spec.summary,
      ...(spec.description ? { description: spec.description } : {}),
      operationId: spec.operationId,
      ...(spec.auth === false ? { security: [] } : {}),
      parameters: [...parametersOf(collector, spec.params, 'path'), ...parametersOf(collector, spec.query, 'query')],
      ...(spec.body
        ? { requestBody: { required: true, content: { 'application/json': { schema: collector.convert(spec.body, 'input') } } } }
        : {}),
      responses,
      ...(spec.roles ? { 'x-roles': spec.roles } : {}),
    }
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Oqim admin API',
      version: '1.0.0',
      description: [
        'Oqim restoran tizimining administrator paneli uchun API.',
        '',
        '**Kirish:** `POST /api/auth/login` telefon va 4 xonali PIN bilan. Javobdagi `token` ni yuqoridagi **Authorize** tugmasiga kiriting.',
        '',
        'Vaqtlar ms (Unix epoch), pul so\'mda. Restoran vaqt mintaqasi Asia/Tashkent (UTC+5).',
        'Xatolar bir xil ko\'rinishda: `{ "error": { "code", "message", "details" } }`.',
      ].join('\n'),
    },
    servers,
    tags: [
      { name: 'Kirish', description: 'Kirish va umumiy holat' },
      { name: 'Bugun', description: 'Bugungi ko\'rsatkichlar' },
      { name: 'Jonli zal', description: 'Stollar, vazifalar navbati, buyurtmani ko\'chirish' },
      { name: 'Istisnolar', description: 'Kechikishlar, bekor qilish, qozon, bronlar: qaror kerak bo\'lgan holatlar' },
      { name: 'Hisobotlar' },
      { name: 'Menyu' },
      { name: 'Zal va stollar' },
      { name: 'Bron' },
      { name: 'Prognoz' },
      { name: 'Xodimlar' },
      { name: 'Sozlamalar' },
      { name: 'Audit' },
    ],
    paths,
    components: {
      securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: Object.fromEntries(Object.entries(collector.schemas).sort(([a], [b]) => a.localeCompare(b))),
    },
    security: [{ bearer: [] }],
  }
}
