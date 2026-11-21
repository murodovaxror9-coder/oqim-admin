import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { levelOf, priorityOf, promiseMs, roundMoney } from '../src/services/rules.js'

describe('levelOf: vazifa rangi', () => {
  const sla = 120 // 2:00
  test("70% gacha — tinch", () => {
    assert.equal(levelOf(0, sla, 70), 'calm')
    assert.equal(levelOf(83_000, sla, 70), 'calm')
  })
  test("70% dan — sariq (chegara kiradi)", () => {
    assert.equal(levelOf(84_000, sla, 70), 'warn')
    assert.equal(levelOf(120_000, sla, 70), 'warn')
  })
  test("muddat o'tsa — qizil", () => {
    assert.equal(levelOf(120_001, sla, 70), 'late')
  })
  test('sariq chegarasi sozlamadan olinadi', () => {
    assert.equal(levelOf(60_000, sla, 50), 'warn')
    assert.equal(levelOf(60_000, sla, 90), 'calm')
  })
})

describe('priorityOf: navbat', () => {
  test('(kutish / muddat + 0,15) × og\'irlik', () => {
    assert.equal(priorityOf(0, 100, 1), 0.15)
    assert.ok(Math.abs(priorityOf(50_000, 100, 2) - 1.3) < 1e-9)
  })
  test("og'ir vazifa bir xil kutishda oldinga chiqadi", () => {
    assert.ok(priorityOf(60_000, 120, 1.3) > priorityOf(60_000, 120, 1.0))
  })
  test("vazifa hech qachon 0 bo'lmaydi — yangisi ham navbatda", () => {
    assert.ok(priorityOf(0, 240, 0.6) > 0)
  })
})

describe("promiseMs: mehmonga va'da", () => {
  const promise = { coefficient: 1.2, extraMinutes: 3, roundSeconds: 30 }
  test('14 daqiqalik taom → 20:00 (README misoli)', () => {
    // 14 × 1,2 + 3 = 19,8 daq = 1188 s → 1200 s
    assert.equal(promiseMs(14, promise), 20 * 60_000)
  })
  test('30 soniyaga yuqoriga yaxlitlanadi', () => {
    // 10 × 1,2 + 3 = 15 daq = 900 s — aniq, yaxlitlash shart emas
    assert.equal(promiseMs(10, promise), 900_000)
    // 1 × 1,2 + 3 = 4,2 daq = 252 s → 270 s
    assert.equal(promiseMs(1, promise), 270_000)
  })
})

describe("roundMoney: so'm 100 ga yaxlitlanadi", () => {
  test('yaxlitlash', () => {
    assert.equal(roundMoney(12_349), 12_300)
    assert.equal(roundMoney(12_350), 12_400)
    assert.equal(roundMoney(0), 0)
  })
})
