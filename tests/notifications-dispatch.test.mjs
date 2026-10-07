import test from 'node:test'
import assert from 'node:assert/strict'
import { dispatch, DEDUPE_WINDOW_MS } from '../lib/notifications/dispatch.ts'

function memoryStore(existing = []) {
  const rows = [...existing]
  return {
    rows,
    async exists(userId, type, link, since) {
      return rows.some(r => r.userId === userId && r.type === type && r.link === link && (!since || r.createdAt >= since))
    },
    async insert(item) { rows.push({ ...item, createdAt: new Date() }) },
  }
}
const item = (over = {}) => ({ userId: 'jan', email: 'jan@example.org', type: 'task_assigned', title: 'T', body: 'B', link: '/tasks?task=1', sendEmail: true, ...over })
const okSend = () => { const sent = []; return { sent, send: async msg => { sent.push(msg); return { success: true } } } }

test('stores the notification and e-mails only when the type requires it', async () => {
  const store = memoryStore(); const mail = okSend()
  const res = await dispatch(store, [item(), item({ userId: 'ola', type: 'case_comment', link: '/cases?case=1', sendEmail: false })], { send: mail.send })
  assert.deepEqual(res, { inserted: 2, skipped: 0, emailed: 1, emailFailed: 0 })
  assert.equal(mail.sent.length, 1)
  assert.equal(mail.sent[0].to, 'jan@example.org')
  assert.match(mail.sent[0].html, /\/tasks\?task=1/)
})

test('the same notification within 10 minutes is sent once', async () => {
  const now = new Date('2026-10-06T10:00:00Z')
  const store = memoryStore([{ ...item(), createdAt: new Date(now.getTime() - DEDUPE_WINDOW_MS + 1000) }])
  const mail = okSend()
  const res = await dispatch(store, [item(), item()], { now, send: mail.send })
  assert.deepEqual(res, { inserted: 0, skipped: 2, emailed: 0, emailFailed: 0 })
  const later = await dispatch(memoryStore([{ ...item(), createdAt: new Date(now.getTime() - DEDUPE_WINDOW_MS - 1000) }]), [item()], { now, send: mail.send })
  assert.equal(later.inserted, 1)
})

test('one-time notifications are never repeated', async () => {
  const store = memoryStore([{ ...item({ type: 'deadline_overdue' }), createdAt: new Date('2025-01-01') }])
  const res = await dispatch(store, [item({ type: 'deadline_overdue' })], { send: okSend().send })
  assert.equal(res.skipped, 1)
})

test('missing e-mail or mail failure keeps the bell notification', async () => {
  const store = memoryStore()
  const res = await dispatch(store, [item({ email: null }), item({ userId: 'ola', email: 'ola@example.org' })], { send: async () => ({ success: false, error: 'quota' }) })
  assert.deepEqual(res, { inserted: 2, skipped: 0, emailed: 0, emailFailed: 1 })
  assert.equal(store.rows.length, 2)
})

test('duplicates inside one batch are collapsed', async () => {
  const store = memoryStore()
  const res = await dispatch(store, [item(), item()], { send: okSend().send })
  assert.equal(res.inserted, 1)
  assert.equal(res.skipped, 1)
})
