// Har test fayli o'z vaqtinchalik bazasida ishlaydi. Bu fayl boshqa importlardan OLDIN chaqirilishi kerak.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oqim-test-'))
process.env.DB_FILE = path.join(dir, 'test.db')
process.env.DEMO_MODE = 'false'
process.env.JWT_SECRET = 'test-secret'
process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }))
