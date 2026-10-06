import test from 'node:test'
import assert from 'node:assert/strict'
import { isUrgentTask, isVisibleOnBoard, localDateString, sortTasksForOverview } from '../lib/dashboard.ts'

const task = { status: 'to_do', deadline: null, owner_id: null, department_id: null, is_zarzad: false }

test('local date string uses the local calendar day, not UTC', () => {
  assert.equal(localDateString(new Date(2026, 9, 6, 0, 30)), '2026-10-06')
  assert.equal(localDateString(new Date(2026, 11, 31, 23, 59)), '2026-12-31')
})

test('urgent covers deadlines today, tomorrow and overdue open tasks', () => {
  const today = '2026-10-06'
  assert.equal(isUrgentTask({ ...task, deadline: '2026-10-06' }, today), true)
  assert.equal(isUrgentTask({ ...task, deadline: '2026-10-07' }, today), true)
  assert.equal(isUrgentTask({ ...task, deadline: '2026-09-30' }, today), true)
  assert.equal(isUrgentTask({ ...task, deadline: '2026-10-08' }, today), false)
  assert.equal(isUrgentTask({ ...task, deadline: '2026-10-06', status: 'done' }, today), false)
  assert.equal(isUrgentTask(task, today), false)
})

test('tomorrow rolls over month and year boundaries', () => {
  assert.equal(isUrgentTask({ ...task, deadline: '2027-01-01' }, '2026-12-31'), true)
  assert.equal(isUrgentTask({ ...task, deadline: '2026-11-01' }, '2026-10-31'), true)
  assert.equal(isUrgentTask({ ...task, deadline: '2026-11-02' }, '2026-10-31'), false)
})

test('board visibility matches the general task board', () => {
  const me = { id: 'u1', department_id: 'd1' }
  assert.equal(isVisibleOnBoard({ ...task, is_zarzad: true, owner_id: 'u1' }, me, true), false)
  assert.equal(isVisibleOnBoard({ ...task, owner_id: 'u2', department_id: 'd2' }, me, true), true)
  assert.equal(isVisibleOnBoard({ ...task, owner_id: 'u2', department_id: 'd2' }, me, false), false)
  assert.equal(isVisibleOnBoard({ ...task, owner_id: 'u1' }, me, false), true)
  assert.equal(isVisibleOnBoard({ ...task, department_id: 'd1' }, me, false), true)
  assert.equal(isVisibleOnBoard(task, me, false), true)
  assert.equal(isVisibleOnBoard(task, null, false), true)
})

test('overview lists open tasks first, then by nearest deadline', () => {
  const sorted = sortTasksForOverview([
    { ...task, id: 'a', status: 'done', deadline: '2026-01-01' },
    { ...task, id: 'b', deadline: null },
    { ...task, id: 'c', status: 'in_progress', deadline: '2026-10-09' },
    { ...task, id: 'd', deadline: '2026-10-07' },
  ])
  assert.deepEqual(sorted.map(t => t.id), ['d', 'c', 'b', 'a'])
})
