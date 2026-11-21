import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { db } from '../db/index.js'
import { HttpError } from './http.js'

export const ADMIN_ROLES = ['owner', 'admin']

export function signToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn })
}

export function requireAuth(req, res, next) {
  const header = req.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    next(new HttpError(401, 'unauthorized', 'Avval tizimga kiring'))
    return
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret)
    const user = db.prepare('SELECT id, name, role, blocked FROM users WHERE id = ?').get(Number(payload.sub))
    if (!user || user.blocked) {
      next(new HttpError(401, 'unauthorized', 'Avval tizimga kiring'))
      return
    }
    req.user = { id: user.id, name: user.name, role: user.role }
    next()
  } catch {
    next(new HttpError(401, 'unauthorized', 'Sessiya tugagan, qayta kiring'))
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (roles.includes(req.user?.role)) {
      next()
      return
    }
    next(new HttpError(403, 'forbidden', "Bu amal uchun huquq yo'q"))
  }
}

// Telefon raqamni +998XXXXXXXXX ko'rinishiga keltiradi
export function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.length === 9) return `+998${digits}`
  if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`
  return null
}
