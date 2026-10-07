import test from 'node:test'
import assert from 'node:assert/strict'
import { dispatch, DEDUPE_WINDOW_MS } from '../lib/notifications/dispatch.ts'

// Odwzorowuje public.insert_notification_once: sprawdzenie i zapis jako jedna operacja
function memoryStore(existing = []) {
  const rows = [...existing]
  return {
    rows,
    async insertOnce(item, since) {
      if (rows.some(r => r.userId === item.userId && r.type === item.type && r.link === item.link && (!since || r.createdAt >= since))) return false
      rows.push({ ...item, createdAt: new Date() })
      return true
    },
  }
}
const item = (over = {}) => ({ userId: 'jan', email: 'jan@example.org', type: 'task_assigned', title: 'T', body: 'B', link: '/tasks?task=1', sendEmail: true, ...over })
const okSend = () => { const sent = []; return { sent, send: async msg => { sent.push(msg); return { success: true } } } }

test('stores the notification and e-mails only when the type requires it', async () => {
  const store = memoryStore(); const mail = okSend()
  const res = await dispatch(store, [item(), item({ userId: 'ola', type: 'case_comment', link: '/cases?case=1', sendEmail: false })], { send: mail.send })
  assert.deepEqual(res, { inserted: 2, skipped: 0, emailed: 1, emailFailed: 0, failed: 0 })
  assert.equal(mail.sent.length, 1)
  assert.equal(mail.sent[0].to, 'jan@example.org')
  assert.match(mail.sent[0].html, /\/tasks\?task=1/)
})

test('the same notification within 10 minutes is sent once', async () => {
  const now = new Date('2026-10-06T10:00:00Z')
  const store = memoryStore([{ ...item(), createdAt: new Date(now.getTime() - DEDUPE_WINDOW_MS + 1000) }])
  const mail = okSend()
  const res = await dispatch(store, [item(), item()], { now, send: mail.send })
  assert.deepEqual(res, { inserted: 0, skipped: 2, emailed: 0, emailFailed: 0, failed: 0 })
  assert.equal(mail.sent.length, 0)
  const later = await dispatch(memoryStore([{ ...item(), createdAt: new Date(now.getTime() - DEDUPE_WINDOW_MS - 1000) }]), [item()], { now, send: mail.send })
  assert.equal(later.inserted, 1)
})

test('one-time notifications are never repeated', async () => {
  const store = memoryStore([{ ...item({ type: 'deadline_overdue' }), createdAt: new Date('2025-01-01') }])
  const mail = okSend()
  const res = await dispatch(store, [item({ type: 'deadline_overdue' })], { send: mail.send })
  assert.equal(res.skipped, 1)
  assert.equal(mail.sent.length, 0)
})

test('missing e-mail or mail failure keeps the bell notification', async () => {
  const store = memoryStore()
  const res = await dispatch(store, [item({ email: null }), item({ userId: 'ola', email: 'ola@example.org' })], { send: async () => ({ success: false, error: 'quota' }) })
  assert.deepEqual(res, { inserted: 2, skipped: 0, emailed: 0, emailFailed: 1, failed: 0 })
  assert.equal(store.rows.length, 2)
})

test('duplicates inside one batch are collapsed', async () => {
  const store = memoryStore()
  const res = await dispatch(store, [item(), item()], { send: okSend().send })
  assert.equal(res.inserted, 1)
  assert.equal(res.skipped, 1)
})

test('a database error for one recipient does not stop the rest of the batch', async () => {
  const store = memoryStore()
  const flaky = {
    async insertOnce(entry, since) {
      if (entry.userId === 'jan') throw new Error('connection reset')
      return store.insertOnce(entry, since)
    },
  }
  const mail = okSend()
  const errors = []
  const original = console.error
  console.error = (...args) => errors.push(args)
  try {
    const res = await dispatch(flaky, [item(), item({ userId: 'ola', email: 'ola@example.org' })], { send: mail.send })
    assert.deepEqual(res, { inserted: 1, skipped: 0, emailed: 1, emailFailed: 0, failed: 1 })
  } finally {
    console.error = original
  }
  assert.deepEqual(store.rows.map(r => r.userId), ['ola'])
  assert.deepEqual(mail.sent.map(m => m.to), ['ola@example.org'])
  assert.equal(errors.length, 1)
})
