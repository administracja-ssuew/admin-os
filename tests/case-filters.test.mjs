import test from 'node:test'
import assert from 'node:assert/strict'
import { matchesCaseFilters } from '../lib/case-filters.ts'

const item = { case_number: 'SPR/2026/12', cred_signature: 'CRED/ABC/7', status: 'in_progress', created_at: '2026-09-21T23:59:59Z', title: 'Remont' }
test('search covers both signatures, trims input and ignores letter case', () => {
  assert.equal(matchesCaseFilters(item, { search: ' spr/2026/12 ' }), true)
  assert.equal(matchesCaseFilters(item, { search: 'cred/abc' }), true)
  assert.equal(matchesCaseFilters(item, { search: 'Remont' }), false)
  assert.equal(matchesCaseFilters({ ...item, cred_signature: null }, { search: 'CRED' }), false)
})
test('upper date bound includes the entire selected day', () => {
  assert.equal(matchesCaseFilters(item, { date_to: '2026-09-21' }), true)
  assert.equal(matchesCaseFilters(item, { date_to: '2026-09-20' }), false)
})
test('signature, status and date combine; empty filters return all cases', () => {
  assert.equal(matchesCaseFilters(item, { search: '12', status: 'in_progress', date_to: '2026-09-21' }), true)
  assert.equal(matchesCaseFilters(item, { search: '12', status: 'closed', date_to: '2026-09-21' }), false)
  assert.equal(matchesCaseFilters(item, { search: '', status: '', date_to: '' }), true)
})
