import test from 'node:test'
import assert from 'node:assert/strict'
import { decodeLegacyNote } from '../lib/cred-notes.ts'

test('decodes notes saved URL-encoded by the old client', () => {
  assert.equal(decodeLegacyNote('Ala%20ma%20kota'), 'Ala ma kota')
  assert.equal(decodeLegacyNote('Pismo%20wys%C5%82ane%2C%20czekamy'), 'Pismo wysłane, czekamy')
})
test('leaves plain notes untouched, including literal percent signs', () => {
  assert.equal(decodeLegacyNote('Ala ma kota'), 'Ala ma kota')
  assert.equal(decodeLegacyNote('Budżet wykonany w 100%'), 'Budżet wykonany w 100%')
  assert.equal(decodeLegacyNote('Wzrost o 20%20 osób'), 'Wzrost o 20%20 osób')
  assert.equal(decodeLegacyNote('100%'), '100%')
})
test('returns malformed encodings unchanged', () => {
  assert.equal(decodeLegacyNote('%E0%A4%A'), '%E0%A4%A')
  assert.equal(decodeLegacyNote(''), '')
})
