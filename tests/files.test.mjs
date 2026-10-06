import test from 'node:test'
import assert from 'node:assert/strict'
import { externalFileError, sanitizeFileName, storagePath } from '../lib/files.ts'

const base = 'https://mutflmihoxndxefuxsno.supabase.co/storage/v1/object'

test('stored public and signed URLs resolve to the object path', () => {
  assert.equal(storagePath(`${base}/public/adminos-files/tasks/abc/Umowa_2026.pdf`), 'tasks/abc/Umowa_2026.pdf')
  assert.equal(storagePath(`${base}/sign/adminos-files/cases/x/plik.pdf?token=abc`), 'cases/x/plik.pdf')
  assert.equal(storagePath(`${base}/public/adminos-files/aikb/a%20b.pdf`), 'aikb/a b.pdf')
})
test('bare paths pass through; external links are not storage objects', () => {
  assert.equal(storagePath('wnioski/1/plik.pdf'), 'wnioski/1/plik.pdf')
  assert.equal(storagePath('https://drive.google.com/file/d/1'), null)
  assert.equal(storagePath(`${base}/public/inny-bucket/plik.pdf`), null)
  assert.equal(storagePath(''), null)
})
test('file names are made storage-safe', () => {
  assert.equal(sanitizeFileName('Zażółć gęślą jaźń.pdf'), 'Zazolc_gesla_jazn.pdf')
})
test('public form accepts only allowed types up to 10 MB', () => {
  assert.equal(externalFileError('skan.PDF', 1024), null)
  assert.equal(externalFileError('skrypt.exe', 1024), 'Niedozwolony typ pliku')
  assert.equal(externalFileError('duzy.pdf', 11 * 1024 * 1024), 'Plik przekracza limit 10 MB')
  assert.equal(externalFileError('pusty.pdf', 0), 'Plik przekracza limit 10 MB')
})
