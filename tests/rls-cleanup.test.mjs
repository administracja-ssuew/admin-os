import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { emails, fixture, ids, migration } from './fixtures/supabase.mjs'

let db
async function as(who) {
  await db.exec('RESET ROLE')
  await db.query("SELECT set_config('request.jwt.claim.email', $1, false)", [who === 'anon' ? '' : emails[who]])
  await db.exec(`SET ROLE ${who === 'anon' ? 'anon' : 'authenticated'}`)
}
const count = async sql => Number(Object.values((await db.query(sql)).rows[0])[0])
const affected = async sql => (await db.query(sql)).affectedRows

before(async () => {
  db = new PGlite()
  await db.exec(fixture)
  await db.exec(await migration('20261006_enforce_rls_cleanup.sql'))
})
after(async () => { await db?.close() })

test('anonymous requests cannot read or change any application table', async () => {
  await as('anon')
  assert.equal(await count('SELECT count(*) FROM public.users'), 0)
  assert.equal(await count('SELECT count(*) FROM public.tasks'), 0)
  assert.equal(await count('SELECT count(*) FROM public.cases'), 0)
  assert.equal(await affected(`UPDATE public.users SET system_role = 'superadmin'`), 0)
  await assert.rejects(db.query(`INSERT INTO public.tasks (title) VALUES ('x')`))
})

test('pending and inactive accounts see only their own profile', async () => {
  for (const who of ['pending', 'inactive']) {
    await as(who)
    assert.deepEqual((await db.query('SELECT email FROM public.users')).rows, [{ email: emails[who] }])
    assert.equal(await count('SELECT count(*) FROM public.tasks'), 0)
    assert.equal(await count('SELECT count(*) FROM public.cases'), 0)
    assert.equal(await count('SELECT count(*) FROM public.archive_folders'), 0)
    assert.equal(await affected(`UPDATE public.users SET system_role = 'superadmin' WHERE id = '${ids[who]}'`), 0)
    await assert.rejects(db.query(`INSERT INTO public.tasks (title) VALUES ('x')`))
  }
})

test('members work on shared data but cannot change roles or reach board data', async () => {
  await as('member')
  assert.equal(await count('SELECT count(*) FROM public.users'), 4)
  assert.equal(await affected(`UPDATE public.users SET system_role = 'superadmin' WHERE id = '${ids.member}'`), 0)
  assert.equal(await affected(`UPDATE public.users SET system_role = 'inactive' WHERE id = '${ids.admin}'`), 0)
  await db.query(`INSERT INTO public.tasks (title) VALUES ('Nowe zadanie')`)
  assert.equal(await count('SELECT count(*) FROM public.tasks'), 2)
  assert.equal(await count('SELECT count(*) FROM public.archive_folders'), 1)
  assert.equal(await count('SELECT count(*) FROM public.departments'), 1)
  assert.equal(await affected(`UPDATE public.departments SET name = 'x'`), 0)
  assert.equal(await affected(`UPDATE public.cases SET title = 'Zmiana' WHERE owner_id = '${ids.member}'`), 1)
  assert.equal(await affected(`UPDATE public.cases SET title = 'Zmiana' WHERE owner_id = '${ids.admin}'`), 0)
  assert.equal(await affected('DELETE FROM public.cases'), 0)
  assert.equal(await count('SELECT count(*) FROM public.decisions'), 0)
  assert.equal(await count('SELECT count(*) FROM public.audit_log'), 0)
  await db.query(`INSERT INTO public.audit_log (action) VALUES ('test')`)
  assert.equal(await count('SELECT count(*) FROM public.notifications'), 1)
  await assert.rejects(db.query(`INSERT INTO public.notifications (user_id) VALUES ('${ids.member}')`))
})

test('admins manage roles and board data', async () => {
  await as('admin')
  assert.equal(await affected(`UPDATE public.users SET system_role = 'member' WHERE id = '${ids.pending}'`), 1)
  assert.equal(await count('SELECT count(*) FROM public.decisions'), 1)
  assert.equal(await count('SELECT count(*) FROM public.audit_log'), 1)
  assert.equal(await affected(`UPDATE public.departments SET name = 'Pion 2'`), 1)
  await as('pending') // właśnie zatwierdzony
  assert.equal(await count('SELECT count(*) FROM public.tasks'), 2)
  await db.exec(`RESET ROLE; UPDATE public.users SET system_role = 'pending' WHERE id = '${ids.pending}'`)
})

test('storage writes require an active member; public read is unchanged', async () => {
  await as('pending')
  await assert.rejects(db.query(`INSERT INTO storage.objects (bucket_id) VALUES ('adminos-files')`))
  await as('member')
  await db.query(`INSERT INTO storage.objects (bucket_id) VALUES ('adminos-files')`)
  await as('anon')
  assert.equal(await count('SELECT count(*) FROM storage.objects'), 1)
})

test('structure is cleaned up: empty tables, duplicates, function rights, realtime', async () => {
  await db.exec('RESET ROLE')
  for (const t of ['board_polls', 'risks', 'notification_preferences', 'meeting_votes'])
    assert.equal(await count(`SELECT count(*) FROM pg_class WHERE oid = to_regclass('public.${t}')`), 0, t)
  assert.equal(await count(`SELECT count(*) FROM pg_constraint WHERE conname IN ('cases_case_number_unique', 'department_notes_dept_unique')`), 0)
  assert.equal(await count(`SELECT count(*) FROM pg_constraint WHERE conname IN ('cases_case_number_key', 'department_notes_department_id_key')`), 2)
  assert.equal(await count(`SELECT count(*) FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename IN ('cases', 'tasks')`), 2)
  assert.equal(await count(`SELECT count(*) FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND NOT c.relrowsecurity`), 0)
  assert.equal(await count(`SELECT has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE')::int`), 0)
  assert.equal(await count(`SELECT has_function_privilege('anon', 'public.has_scores_access()', 'EXECUTE')::int`), 0)
  assert.equal(await count(`SELECT has_function_privilege('authenticated', 'public.has_scores_access()', 'EXECUTE')::int`), 1)
})

test('the migration refuses to drop a table that holds data', async () => {
  const fresh = new PGlite()
  try {
    await fresh.exec(fixture)
    await fresh.exec('INSERT INTO public.risks DEFAULT VALUES')
    await assert.rejects(fresh.exec(await migration('20261006_enforce_rls_cleanup.sql')), /public\.risks zawiera 1 wierszy/)
    await fresh.exec('ROLLBACK')
    assert.equal(Number((await fresh.query('SELECT count(*) AS n FROM public.risks')).rows[0].n), 1)
    assert.equal((await fresh.query(`SELECT relrowsecurity FROM pg_class WHERE oid = 'public.users'::regclass`)).rows[0].relrowsecurity, false)
  } finally {
    await fresh.close()
  }
})
