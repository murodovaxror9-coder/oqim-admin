import './setup.js'
import assert from 'node:assert/strict'
import { after, beforeEach, describe, test } from 'node:test'
import { db } from '../src/db/index.js'
import { audit } from '../src/lib/audit.js'
import { MINUTE, SECOND } from '../src/lib/time.js'
import { runEscalation } from '../src/services/escalation.js'
import { addItems, chooseWaiter, completeTask, consumeBatch, createTask, openOrder, startBatch } from '../src/services/operations.js'
import { clearOperations, menuId, seed, startShifts, tableId, userId } from './helpers.js'

seed()
const T0 = Date.parse('2026-11-21T08:00:00Z') // 13:00 Toshkent

const task = (id) => db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
const exceptionsFor = (taskId) => db.prepare("SELECT * FROM exceptions WHERE task_id = ? AND type = 'task_late'").all(taskId)

beforeEach(() => clearOperations())
after(() => db.close())

describe('Yordam qoidasi', () => {
  test("3 ta ochiq ishi bo'lgan ofitsiantning yangi ishi bo'shroq hamkasbiga o'tadi", () => {
    startShifts(T0)
    const jasur = userId('Jasur Karimov')
    for (const n of [1, 2, 3]) createTask({ tableId: tableId(n), type: 'call', at: T0, waiterId: jasur })

    const id = createTask({ tableId: tableId(4), type: 'call', at: T0 })
    const created = task(id)
    assert.notEqual(created.waiter_id, jasur)
    assert.equal(created.helped_from, jasur)
  })

  test("2 ta ochiq ish bo'lsa ish o'zida qoladi", () => {
    startShifts(T0)
    const jasur = userId('Jasur Karimov')
    for (const n of [1, 2]) createTask({ tableId: tableId(n), type: 'call', at: T0, waiterId: jasur })

    const created = task(createTask({ tableId: tableId(4), type: 'call', at: T0 }))
    assert.equal(created.waiter_id, jasur)
    assert.equal(created.helped_from, null)
  })

  test("farq helpMinDiff dan kam bo'lsa yordam berilmaydi", () => {
    startShifts(T0)
    const [jasur, malika, sardor] = ['Jasur Karimov', 'Malika Rahimova', 'Sardor Aliyev'].map(userId)
    for (const n of [1, 2, 3]) createTask({ tableId: tableId(n), type: 'call', at: T0, waiterId: jasur })
    for (const n of [5, 6]) createTask({ tableId: tableId(n), type: 'call', at: T0, waiterId: malika })
    for (const n of [8, 9]) createTask({ tableId: tableId(n), type: 'call', at: T0, waiterId: sardor })

    assert.deepEqual(chooseWaiter(jasur), { waiterId: jasur, helpedFrom: null })
  })

  test("stol ofitsianti smenada bo'lmasa ish eng bo'sh ofitsiantga tushadi", () => {
    startShifts(T0, ['Malika Rahimova', 'Sardor Aliyev'])
    const sardor = userId('Sardor Aliyev')
    createTask({ tableId: tableId(5), type: 'call', at: T0, waiterId: userId('Malika Rahimova') })

    const created = task(createTask({ tableId: tableId(1), type: 'call', at: T0 }))
    assert.equal(created.waiter_id, sardor)
  })
})

describe('Eskalatsiya', () => {
  test("muddat o'tmaguncha istisno yo'q, o'tgach administratorga, 2 baravarda egaga", () => {
    startShifts(T0)
    const id = createTask({ tableId: tableId(1), type: 'take', at: T0 }) // 3:00

    runEscalation(T0 + 180 * SECOND)
    assert.equal(exceptionsFor(id).length, 0)

    runEscalation(T0 + 181 * SECOND)
    let [exception] = exceptionsFor(id)
    assert.equal(exception.status, 'open')
    assert.equal(JSON.parse(exception.payload).level, 'admin')

    runEscalation(T0 + 361 * SECOND)
    ;[exception] = exceptionsFor(id)
    assert.equal(JSON.parse(exception.payload).level, 'owner')
    assert.equal(exceptionsFor(id).length, 1, 'istisno takrorlanmaydi')
  })

  test("vazifa bajarilsa kechikish istisnosi o'zi yopiladi", () => {
    startShifts(T0)
    const id = createTask({ tableId: tableId(1), type: 'call', at: T0 })
    runEscalation(T0 + 2 * MINUTE)
    completeTask(id, T0 + 3 * MINUTE)
    const [exception] = exceptionsFor(id)
    assert.equal(exception.status, 'resolved')
    assert.equal(JSON.parse(exception.resolution).action, 'task_done')
  })
})

describe("Va'da", () => {
  test("eng uzoq taom bo'yicha hisoblanadi va buzilsa 10% chegirma o'zi qo'llanadi", () => {
    startShifts(T0)
    const orderId = openOrder({ tableId: tableId(2), guests: 2, at: T0 })
    addItems(orderId, [{ menuItemId: menuId('Kabob'), qty: 1 }, { menuItemId: menuId('Non'), qty: 1 }], T0)

    let order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
    assert.equal(order.promise_at, T0 + 20 * MINUTE) // 14 × 1,2 + 3 = 19,8 → 20:00
    assert.equal(order.subtotal, 73_000)
    assert.equal(order.service_charge, 7_300)
    assert.equal(order.discount, 0)

    runEscalation(T0 + 20 * MINUTE + SECOND)
    order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
    assert.equal(order.promise_broken, 1)
    assert.equal(order.discount, 8_000) // (73 000 + 7 300) × 10% = 8 030 → 8 000
    assert.equal(order.total, 73_000 + 7_300 - 8_000)

    const exception = db.prepare("SELECT * FROM exceptions WHERE order_id = ? AND type = 'promise_broken'").get(orderId)
    assert.equal(exception.status, 'resolved', "ma'lumot uchun, qaror kutmaydi")
  })

  test("taom va'da vaqtida yetkazilsa chegirma yo'q", () => {
    startShifts(T0)
    const orderId = openOrder({ tableId: tableId(3), guests: 1, at: T0 })
    addItems(orderId, [{ menuItemId: menuId('Kabob'), qty: 1 }], T0)
    db.prepare('UPDATE orders SET served_at = ? WHERE id = ?').run(T0 + 15 * MINUTE, orderId)

    runEscalation(T0 + 25 * MINUTE)
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
    assert.equal(order.promise_broken, 0)
    assert.equal(order.discount, 0)
  })
})

describe('Qozon', () => {
  test("qozon tugasa taom stop-listga tushadi, yangi qozon tayyor bo'lgach qaytadi", () => {
    const somsa = menuId('Somsa') // partiya 30, 35 daqiqa
    startBatch(somsa, null, T0)
    consumeBatch(somsa, 30, T0 + 40 * MINUTE)

    let item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(somsa)
    assert.equal(item.available, 0)
    assert.equal(item.stop_reason, 'batch_empty')

    startBatch(somsa, null, T0 + 41 * MINUTE)
    runEscalation(T0 + 41 * MINUTE + 35 * MINUTE)
    item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(somsa)
    assert.equal(item.available, 1)
    assert.equal(item.stop_reason, null)
  })

  test("qo'lda stop-listga qo'yilgan taom qozon tufayli qaytmaydi", () => {
    const mastava = menuId('Mastava') // seed'da qo'lda to'xtatilgan
    startBatch(mastava, null, T0)
    runEscalation(T0 + 60 * MINUTE)
    const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(mastava)
    assert.equal(item.available, 0)
    assert.equal(item.stop_reason, 'manual')
  })
})

describe('Audit jurnali', () => {
  test("yozuvni o'zgartirib ham, o'chirib ham bo'lmaydi", () => {
    audit({ kind: 'system', category: 'auth', action: 'test.event', at: T0 })
    const row = db.prepare("SELECT id FROM audit_log WHERE action = 'test.event'").get()
    assert.throws(() => db.prepare("UPDATE audit_log SET action = 'x' WHERE id = ?").run(row.id), /faqat yoziladi/)
    assert.throws(() => db.prepare('DELETE FROM audit_log WHERE id = ?').run(row.id), /faqat yoziladi/)
  })
})
