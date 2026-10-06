import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeCaseNumber } from '../lib/request-status.ts'

test('case numbers are normalized to WNI/YYYY/NNNN', () => {
  assert.equal(normalizeCaseNumber('WNI/2026/0007'), 'WNI/2026/0007')
  assert.equal(normalizeCaseNumber(' wni/2026/7 '), 'WNI/2026/0007')
  assert.equal(normalizeCaseNumber('WNI 2026 12'), 'WNI/2026/0012')
  assert.equal(normalizeCaseNumber('2026-123'), 'WNI/2026/0123')
  assert.equal(normalizeCaseNumber('wni/2026/1234'), 'WNI/2026/1234')
})
test('unrecognized input is only trimmed and uppercased', () => {
  assert.equal(normalizeCaseNumber(' abc '), 'ABC')
  assert.equal(normalizeCaseNumber('WNI/2026/12345'), 'WNI/2026/12345')
})
