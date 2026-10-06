import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { emails, fixture, migration } from './fixtures/supabase.mjs'

let db
async function as(who) {
  await db.exec('RESET ROLE')
  await db.query("SELECT set_config('request.jwt.claim.email', $1, false)", [who === 'anon' ? '' : emails[who]])
  await db.exec(`SET ROLE ${who === 'anon' ? 'anon' : 'authenticated'}`)
}
const status = (nr, email) => db.query('SELECT * FROM public.public_request_status($1, $2)', [nr, email]).then(r => r.rows)

async function prepare(target, extraSql = '') {
  await target.exec(fixture)
  await target.exec(`
    INSERT INTO public.cases (title, case_number, source, status, description) VALUES
      ('Wniosek A', 'WNI/2026/0007', 'Formularz Zewnętrzny', 'in_progress', E'[E-mail: Jan.Kowalski@example.org | Tel: 600]\\n\\nTreść wniosku:\\nx'),
      ('Wniosek B', 'WNI/2026/0008', 'Formularz Zewnętrzny', 'new', E'[E-mail: anna@example.org]\\n\\nTreść'),
      ('Wewnętrzna', 'WNI/2026/0009', 'Wewnętrzna', 'new', E'[E-mail: anna@example.org]');
    INSERT INTO public.reports (title, content) VALUES ('thn', 'tntnt');
    ${extraSql}`)
  await target.exec(await migration('20261006_enforce_rls_cleanup.sql'))
}

before(async () => {
  db = new PGlite()
  await prepare(db)
  await db.exec(await migration('20261006_status_private_files_retire_modules.sql'))
})
after(async () => { await db?.close() })

test('request status needs the case number and the e-mail given in the request', async () => {
  await as('anon')
  assert.deepEqual((await status(' wni/2026/0007 ', 'jan.kowalski@EXAMPLE.org')).map(r => [r.case_number, r.status]), [['WNI/2026/0007', 'in_progress']])
  assert.equal((await status('WNI/2026/0008', 'anna@example.org')).length, 1)
  assert.equal((await status('WNI/2026/0007', 'anna@example.org')).length, 0, 'cudzy e-mail')
  assert.equal((await status('WNI/2026/0007', '')).length, 0, 'brak e-maila')
  assert.equal((await status('WNI/2026/0009', 'anna@example.org')).length, 0, 'sprawa wewnętrzna')
  assert.equal(Object.keys((await status('WNI/2026/0008', 'anna@example.org'))[0]).sort().join(','), 'case_number,closed_at,created_at,status')
  assert.equal(Number((await db.query('SELECT count(*) AS n FROM public.cases')).rows[0].n), 0, 'tabela nadal zamknięta dla anon')
})

test('stored files are readable only by active members; the bucket is private', async () => {
  await db.exec(`RESET ROLE; INSERT INTO storage.objects (bucket_id, name) VALUES ('adminos-files', 'tasks/x/plik.pdf')`)
  for (const who of ['anon', 'pending']) {
    await as(who)
    assert.equal(Number((await db.query('SELECT count(*) AS n FROM storage.objects')).rows[0].n), 0, who)
  }
  await as('member')
  assert.equal(Number((await db.query('SELECT count(*) AS n FROM storage.objects')).rows[0].n), 1)
  await db.exec('RESET ROLE')
  assert.deepEqual((await db.query(`SELECT public, file_size_limit FROM storage.buckets WHERE id = 'adminos-files'`)).rows, [{ public: false, file_size_limit: 26214400 }])
})

test('subcommittee tables are gone', async () => {
  await db.exec('RESET ROLE')
  for (const t of ['reports', 'petitions', 'assets', 'equipment_loans', 'grants_radar'])
    assert.equal((await db.query(`SELECT to_regclass('public.${t}') AS r`)).rows[0].r, null, t)
})

test('the migration stops when a removed module still holds real data', async () => {
  for (const extra of [`INSERT INTO public.reports (title, content) VALUES ('Zepsuty namiot', 'opis')`, 'INSERT INTO public.petitions DEFAULT VALUES']) {
    const fresh = new PGlite()
    try {
      await prepare(fresh, extra)
      await assert.rejects(fresh.exec(await migration('20261006_status_private_files_retire_modules.sql')), /przerwano/)
      await fresh.exec('ROLLBACK')
      assert.notEqual((await fresh.query(`SELECT to_regclass('public.reports') AS r`)).rows[0].r, null)
      assert.equal((await fresh.query(`SELECT public FROM storage.buckets`)).rows[0].public, true, 'nic nie zmieniono')
    } finally {
      await fresh.close()
    }
  }
})
