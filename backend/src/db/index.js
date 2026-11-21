import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { config } from '../config.js'

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true })

// Node.js'ning o'rnatilgan SQLite drayveri (node:sqlite) — native kompilyatsiya talab qilmaydi.
// better-sqlite3 bilan mos bo'lishi uchun pragma() va transaction() qo'shilgan.
export const db = new DatabaseSync(config.dbFile)

db.pragma = (statement) => db.exec(`PRAGMA ${statement}`)

let depth = 0
db.transaction =
  (fn) =>
  (...args) => {
    const savepoint = `sp_${depth}`
    db.exec(depth === 0 ? 'BEGIN' : `SAVEPOINT ${savepoint}`)
    depth += 1
    try {
      const result = fn(...args)
      depth -= 1
      db.exec(depth === 0 ? 'COMMIT' : `RELEASE ${savepoint}`)
      return result
    } catch (error) {
      depth -= 1
      db.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`)
      throw error
    }
  }

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.exec(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))

export const transaction = (fn) => db.transaction(fn)

export function parseJson(value, fallback = {}) {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}
