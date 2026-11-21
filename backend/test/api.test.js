import './setup.js'
import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { createApp } from '../src/app.js'
import { db } from '../src/db/index.js'
import { seed } from './helpers.js'

seed()
let server
let base

before(async () => {
  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}/api`
})
after(() => {
  server.close()
  db.close()
})

async function call(method, path, { body, token } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  })
  const text = await res.text()
  let data = text
  try {
    data = JSON.parse(text)
  } catch {}
  return { status: res.status, data }
}

const login = async (phone, pin) => (await call('POST', '/auth/login', { body: { phone, pin } })).data.token

describe('Kirish', () => {
  test("ega to'g'ri PIN bilan kiradi", async () => {
    const res = await call('POST', '/auth/login', { body: { phone: '+998 90 111 22 33', pin: '1111' } })
    assert.equal(res.status, 200)
    assert.equal(res.data.user.role, 'owner')
    assert.ok(res.data.token)
  })

  test("noto'g'ri PIN — 401", async () => {
    const res = await call('POST', '/auth/login', { body: { phone: '+998902223344', pin: '9999' } })
    assert.equal(res.status, 401)
  })

  test("ofitsiant panelga kira olmaydi — 403", async () => {
    const res = await call('POST', '/auth/login', { body: { phone: '+998903334455', pin: '3101' } })
    assert.equal(res.status, 403)
  })

  test("5 marta xato PIN dan keyin to'g'ri PIN ham vaqtincha qabul qilinmaydi", async () => {
    const phone = '+998902223344'
    for (let i = 0; i < 5; i++) await call('POST', '/auth/login', { body: { phone, pin: '0000' } })
    const res = await call('POST', '/auth/login', { body: { phone, pin: '2222' } })
    assert.equal(res.status, 429)
  })
})

describe('Himoya', () => {
  test('tokensiz — 401', async () => {
    assert.equal((await call('GET', '/hall')).status, 401)
  })

  test("buzilgan token — 401", async () => {
    assert.equal((await call('GET', '/hall', { token: 'abc.def.ghi' })).status, 401)
  })

  test('health va OpenAPI ochiq', async () => {
    assert.equal((await call('GET', '/health')).status, 200)
    const doc = await call('GET', '/openapi.json')
    assert.equal(doc.status, 200)
    assert.ok(doc.data.paths['/api/auth/login'] || doc.data.paths['/auth/login'])
  })
})

describe('Sozlamalar', () => {
  test("ega saqlaydi, o'zgarish audit jurnaliga eski va yangi qiymati bilan yoziladi", async () => {
    const token = await login('+998901112233', '1111')
    const current = (await call('GET', '/settings', { token })).data
    const next = structuredClone(current)
    next.tasks.deliver.seconds = 150
    const res = await call('PUT', '/settings', { token, body: next })
    assert.equal(res.status, 200)
    assert.equal(res.data.tasks.deliver.seconds, 150)

    const row = db.prepare("SELECT params FROM audit_log WHERE action = 'settings.changed' ORDER BY id DESC").get()
    assert.deepEqual(JSON.parse(row.params).changes, [{ path: 'tasks.deliver.seconds', from: 120, to: 150 }])
  })

  test('noto\'g\'ri qiymat — 400', async () => {
    const token = await login('+998901112233', '1111')
    const current = (await call('GET', '/settings', { token })).data
    const res = await call('PUT', '/settings', { token, body: { ...current, warnPercent: 'ko\'p' } })
    assert.equal(res.status, 400)
  })
})

describe('Ish sahifalari', () => {
  test('zal, bugun va istisnolar javob beradi', async () => {
    const token = await login('+998901112233', '1111')
    for (const path of ['/hall', '/dashboard/today', '/exceptions', '/menu', '/staff']) {
      const res = await call('GET', path, { token })
      assert.equal(res.status, 200, path)
    }
  })
})
