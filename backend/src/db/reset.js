import fs from 'node:fs'
import { config } from '../config.js'

// Bazani butunlay o'chiradi; keyingi ishga tushishda boshlang'ich ma'lumotlar qayta yoziladi
for (const suffix of ['', '-wal', '-shm']) {
  const file = `${config.dbFile}${suffix}`
  if (fs.existsSync(file)) fs.rmSync(file)
}
console.log(`Baza o'chirildi: ${config.dbFile}`)
