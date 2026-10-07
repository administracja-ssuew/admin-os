import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeCaseNumber, contactEmailFromDescription } from '../lib/request-status.ts'

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
test('contact e-mail is read from the description written by the form', () => {
  assert.equal(contactEmailFromDescription('[E-mail: jan@example.org | Tel: 600]\n\nTreść'), 'jan@example.org')
  assert.equal(contactEmailFromDescription('[E-mail: anna@example.org]\n\nTreść'), 'anna@example.org')
  assert.equal(contactEmailFromDescription('Opis bez nagłówka'), null)
  assert.equal(contactEmailFromDescription(null), null)
})
