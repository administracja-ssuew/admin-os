import test from 'node:test'
import assert from 'node:assert/strict'
import { parseEventRequest } from '../lib/notifications/events.ts'
import {
  resolveTaskAssigned, resolveTaskReviewed, resolveCaseAssigned, resolveCaseStatusChanged, resolveCaseComment,
  resolveAccountPending, resolveAccountApproved, resolveExternalSubmission, resolveDeadlines, warsawDate, addDays,
} from '../lib/notifications/resolve.ts'
import { dispatch } from '../lib/notifications/dispatch.ts'

const person = (id, role = 'member', extra = {}) => ({ id, email: `${id}@example.org`, first_name: id.toUpperCase(), last_name: 'Nowak', system_role: role, ...extra })
const anna = person('anna'), jan = person('jan'), boss = person('boss', 'admin'), newbie = person('newbie', 'pending')
const task = { id: 't1', title: 'Raport', owner_id: 'jan', deadline: '2026-10-07', status: 'to_do', verification_status: null, verification_feedback: null }
const kase = { id: 'c1', case_number: 'WNI/2026/0001', title: 'Remont', owner_id: 'jan', status: 'in_progress' }

test('event requests accept only known events with an id', () => {
  assert.deepEqual(parseEventRequest({ event: 'task_assigned', id: 'x' }), { event: 'task_assigned', id: 'x' })
  assert.equal(parseEventRequest({ event: 'external_submission', id: 'x' }), null)
  assert.equal(parseEventRequest({ event: 'task_assigned' }), null)
  assert.equal(parseEventRequest({ event: 'task_assigned', id: 'x', title: 'spoof' })?.title, undefined)
  assert.equal(parseEventRequest(null), null)
})

test('task assignment notifies the owner by bell and e-mail, never the actor', () => {
  const r = resolveTaskAssigned(anna, task, jan)
  assert.equal(r.ok, true)
  assert.deepEqual(r.notifications.map(n => [n.userId, n.type, n.link, n.sendEmail]), [['jan', 'task_assigned', '/tasks?task=t1', true]])
  assert.match(r.notifications[0].body, /ANNA Nowak/)
  assert.deepEqual(resolveTaskAssigned(jan, task, jan), { ok: true, notifications: [] })
  assert.deepEqual(resolveTaskAssigned(anna, { ...task, owner_id: null }, null), { ok: true, notifications: [] })
  assert.equal(resolveTaskAssigned(anna, null, null).status, 404)
  assert.equal(resolveTaskAssigned(newbie, task, jan).status, 403)
})

test('review: only the board; corrections are e-mailed, approval is bell only', () => {
  assert.equal(resolveTaskReviewed(anna, { ...task, verification_status: 'approved' }, jan).status, 403)
  const ok = resolveTaskReviewed(boss, { ...task, verification_status: 'approved' }, jan)
  assert.deepEqual(ok.notifications.map(n => [n.type, n.sendEmail]), [['task_approved', false]])
  const fix = resolveTaskReviewed(boss, { ...task, verification_status: 'rejected', verification_feedback: 'Dodaj źródła' }, jan)
  assert.deepEqual(fix.notifications.map(n => [n.type, n.sendEmail]), [['task_rejected', true]])
  assert.match(fix.notifications[0].body, /Dodaj źródła/)
  assert.equal(resolveTaskReviewed(boss, task, jan).status, 403, 'brak oceny w bazie')
})

test('cases: new owner by e-mail; status and comments by bell; never the actor', () => {
  assert.deepEqual(resolveCaseAssigned(anna, kase, jan).notifications.map(n => [n.type, n.link, n.sendEmail]), [['case_assigned', '/cases?case=c1', true]])
  assert.deepEqual(resolveCaseAssigned(jan, kase, jan).notifications, [])
  const status = resolveCaseStatusChanged(anna, kase, jan)
  assert.deepEqual(status.notifications.map(n => [n.type, n.sendEmail]), [['case_status_changed', false]])
  assert.match(status.notifications[0].body, /W toku/)
  assert.deepEqual(resolveCaseComment(anna, kase, jan, true).notifications.map(n => n.type), ['case_comment'])
  assert.equal(resolveCaseComment(anna, kase, jan, false).status, 403, 'brak świeżego komentarza autora')
  assert.deepEqual(resolveCaseComment(jan, kase, jan, true).notifications, [])
})

test('accounts: pending person notifies the board about itself only; approval needs the board', () => {
  const pending = resolveAccountPending(newbie, 'newbie', [boss, person('chief', 'superadmin')])
  assert.deepEqual(pending.notifications.map(n => [n.userId, n.type, n.link, n.sendEmail]), [['boss', 'account_pending', '/users?user=newbie', true], ['chief', 'account_pending', '/users?user=newbie', true]])
  assert.equal(resolveAccountPending(newbie, 'boss', [boss]).status, 403)
  assert.equal(resolveAccountPending(anna, 'anna', [boss]).status, 403, 'konto już aktywne')
  assert.equal(resolveAccountApproved(anna, jan).status, 403)
  assert.equal(resolveAccountApproved(boss, newbie).status, 403, 'konto nadal oczekuje')
  assert.deepEqual(resolveAccountApproved(boss, jan).notifications.map(n => [n.userId, n.type, n.sendEmail]), [['jan', 'account_approved', true]])
})

test('every new pending account reaches the board, not only the first one ever', async () => {
  const rows = []
  const store = {
    async insertOnce(item, since) {
      if (rows.some(r => r.userId === item.userId && r.type === item.type && r.link === item.link && (!since || r.createdAt >= since))) return false
      rows.push({ ...item, createdAt: new Date() })
      return true
    },
  }
  const send = async () => ({ success: true })
  const alice = person('alice', 'pending'), carol = person('carol', 'pending')
  const first = await dispatch(store, resolveAccountPending(alice, 'alice', [boss]).notifications, { send })
  const second = await dispatch(store, resolveAccountPending(carol, 'carol', [boss]).notifications, { send })
  assert.equal(first.inserted, 1)
  assert.equal(second.inserted, 1, 'drugie konto także trafia do zarządu')
  assert.equal(second.emailed, 1)
  const again = await dispatch(store, resolveAccountPending(alice, 'alice', [boss]).notifications, { send })
  assert.equal(again.skipped, 1, 'to samo konto zgłoszone ponownie — bez powtórki')
})

test('external submission goes to the whole board', () => {
  const out = resolveExternalSubmission({ id: 'c9', case_number: 'WNI/2026/0009', title: 'Grant' }, [boss])
  assert.deepEqual(out.map(n => [n.userId, n.type, n.link, n.sendEmail]), [['boss', 'external_submission', '/cases?case=c9', true]])
})

test('deadlines: tomorrow and first overdue day, only open tasks with an owner', () => {
  const today = '2026-10-06'
  const tasks = [
    { ...task, id: 'a', deadline: '2026-10-07', owner: jan },
    { ...task, id: 'b', deadline: '2026-10-05', owner: jan },
    { ...task, id: 'c', deadline: '2026-10-04', owner: jan },
    { ...task, id: 'd', deadline: '2026-10-07', status: 'done', owner: jan },
    { ...task, id: 'e', deadline: '2026-10-07', owner_id: null, owner: null },
  ]
  assert.deepEqual(resolveDeadlines(tasks, today).map(n => [n.link, n.type, n.sendEmail]), [['/tasks?task=a', 'deadline_tomorrow', true], ['/tasks?task=b', 'deadline_overdue', true]])
})

test('dates are computed in Warsaw time', () => {
  assert.equal(warsawDate(new Date('2026-10-06T22:30:00Z')), '2026-10-07')
  assert.equal(warsawDate(new Date('2026-12-31T22:59:00Z')), '2026-12-31')
  assert.equal(addDays('2026-10-31', 1), '2026-11-01')
  assert.equal(addDays('2026-01-01', -1), '2025-12-31')
})
