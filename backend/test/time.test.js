import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addDays, atLocal, dayEnd, dayStart, localDate, localHour, localTime, localWeekday } from '../src/lib/time.js'

test("Toshkent vaqti UTC+5: yarim tundan keyin sana almashadi", () => {
  // 2026-11-20 19:30 UTC = 2026-11-21 00:30 Toshkent
  const ts = Date.parse('2026-11-20T19:30:00Z')
  assert.equal(localDate(ts), '2026-11-21')
  assert.equal(localTime(ts), '00:30')
  assert.equal(localHour(ts), 0)
  assert.equal(localWeekday(ts), 6) // shanba
})

test('kun chegaralari mahalliy vaqtda', () => {
  assert.equal(dayStart('2026-11-21'), Date.parse('2026-11-20T19:00:00Z'))
  assert.ok(dayEnd('2026-11-21') > dayStart('2026-11-21'))
  assert.equal(localDate(dayStart('2026-11-21')), '2026-11-21')
  assert.equal(localDate(dayEnd('2026-11-21') - 1), '2026-11-21')
})

test('atLocal va addDays', () => {
  assert.equal(localTime(atLocal('2026-11-21', '18:45')), '18:45')
  assert.equal(addDays('2026-11-30', 1), '2026-12-01')
  assert.equal(addDays('2026-01-01', -1), '2025-12-31')
})
