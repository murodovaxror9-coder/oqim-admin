import { db } from '../src/db/index.js'
import { seedIfEmpty } from '../src/db/seed.js'

export function seed() {
  seedIfEmpty()
}

export const userId = (name) => db.prepare('SELECT id FROM users WHERE name = ?').get(name).id
export const tableId = (number) => db.prepare('SELECT id FROM tables WHERE number = ?').get(number).id
export const menuId = (nameUz) => db.prepare('SELECT id FROM menu_items WHERE name_uz = ?').get(nameUz).id

export function startShifts(at, names = ['Jasur Karimov', 'Malika Rahimova', 'Sardor Aliyev']) {
  for (const name of names) db.prepare('UPDATE users SET shift_started_at = ? WHERE name = ?').run(at, name)
}

// Testlar orasida operativ jadvallarni tozalash (audit_log demo bo'lmagan yozuvlari o'chmaydi — bu ataylab)
export function clearOperations() {
  db.exec(`
    DELETE FROM exceptions;
    DELETE FROM tasks;
    DELETE FROM order_items;
    DELETE FROM orders;
    DELETE FROM batches;
    UPDATE menu_items SET available = 1, stop_reason = NULL WHERE stop_reason = 'batch_empty';
    UPDATE users SET shift_started_at = NULL;
  `)
}
