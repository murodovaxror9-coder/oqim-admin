import { z } from 'zod'

export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message ?? code)
    this.status = status
    this.code = code
    this.details = details
  }
}

export const notFound = (code = 'not_found') => new HttpError(404, code, 'Topilmadi')
export const conflict = (code, message) => new HttpError(409, code, message)
export const badRequest = (code, message) => new HttpError(400, code, message)

// So'rovni zod sxema bilan tekshiradi; natija req.valid ichida
export function validate({ params, query, body }) {
  return (req, res, next) => {
    try {
      req.valid = {
        params: params ? params.parse(req.params) : req.params,
        query: query ? query.parse(req.query) : req.query,
        body: body ? body.parse(req.body ?? {}) : req.body,
      }
      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
        next(new HttpError(400, 'validation', "Ma'lumot noto'g'ri", issues))
        return
      }
      next(error)
    }
  }
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, next) {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details } })
    return
  }
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'bad_json', message: "JSON noto'g'ri" } })
    return
  }
  console.error(error)
  res.status(500).json({ error: { code: 'internal', message: 'Serverda xato' } })
}
