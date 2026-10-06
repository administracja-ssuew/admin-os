import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const ids = {
  admin: '20000000-0000-0000-0000-000000000001',
  member: '20000000-0000-0000-0000-000000000002',
  pending: '20000000-0000-0000-0000-000000000003',
  inactive: '20000000-0000-0000-0000-000000000004',
}
const emails = { admin: 'admin@example.org', member: 'member@example.org', pending: 'pending@example.org', inactive: 'inactive@example.org' }
const migration = () => readFile(new URL('../supabase/migrations/20261006_enforce_rls_cleanup.sql', import.meta.url), 'utf8')

// Schemat odwzorowuje produkcję z 2026-10-06 w zakresie, którego dotyczy migracja
const fixture = `
  CREATE ROLE anon; CREATE ROLE authenticated;
  CREATE SCHEMA auth; CREATE SCHEMA storage;
  CREATE FUNCTION auth.email() RETURNS text LANGUAGE sql AS
    $$ SELECT nullif(current_setting('request.jwt.claim.email', true), '') $$;
  GRANT USAGE ON SCHEMA auth, storage, public TO anon, authenticated;
  CREATE TABLE storage.objects (id serial, bucket_id text);
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Wgrywanie dla zalogowanych" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'adminos-files');
  CREATE POLICY "Odczyt dla wszystkich" ON storage.objects FOR SELECT USING (bucket_id = 'adminos-files');
  CREATE PUBLICATION supabase_realtime;

  CREATE TABLE public.users (id uuid PRIMARY KEY, email varchar UNIQUE, system_role varchar, department_id uuid);
  INSERT INTO public.users VALUES
    ('${ids.admin}', '${emails.admin}', 'admin', null), ('${ids.member}', '${emails.member}', 'member', null),
    ('${ids.pending}', '${emails.pending}', 'pending', null), ('${ids.inactive}', '${emails.inactive}', 'inactive', null);
  CREATE TABLE public.tasks (id serial PRIMARY KEY, title text, owner_id uuid);
  INSERT INTO public.tasks (title) VALUES ('Istniejące zadanie');
  CREATE TABLE public.cases (id serial PRIMARY KEY, title text, owner_id uuid, case_number text,
    CONSTRAINT cases_case_number_key UNIQUE (case_number), CONSTRAINT cases_case_number_unique UNIQUE (case_number));
  ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Authenticated users can read cases" ON public.cases FOR SELECT TO authenticated USING (true);
  INSERT INTO public.cases (title, owner_id, case_number) VALUES ('Sprawa członka', '${ids.member}', 'WNI/1'), ('Cudza sprawa', '${ids.admin}', 'WNI/2');
  CREATE TABLE public.department_notes (id serial PRIMARY KEY, department_id uuid,
    CONSTRAINT department_notes_department_id_key UNIQUE (department_id), CONSTRAINT department_notes_dept_unique UNIQUE (department_id));
  CREATE TABLE public.archive_folders (id serial PRIMARY KEY, title text);
  ALTER TABLE public.archive_folders ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Authenticated users can read archive folders" ON public.archive_folders FOR SELECT TO authenticated USING (true);
  INSERT INTO public.archive_folders (title) VALUES ('Teczka');
  CREATE TABLE public.audit_log (id serial PRIMARY KEY, action text);
  ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
  CREATE TABLE public.brainstorm_cards (id serial PRIMARY KEY, author_id uuid);
  ALTER TABLE public.brainstorm_cards ENABLE ROW LEVEL SECURITY;
  CREATE TABLE public.meeting_protocols (id serial PRIMARY KEY);
  ALTER TABLE public.meeting_protocols ENABLE ROW LEVEL SECURITY;
  CREATE TABLE public.notifications (id serial PRIMARY KEY, user_id uuid);
  ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
  CREATE POLICY service_role_insert_only ON public.notifications FOR INSERT WITH CHECK (false);
  INSERT INTO public.notifications (user_id) VALUES ('${ids.member}'), ('${ids.admin}');
  CREATE TABLE public.reports (id serial PRIMARY KEY, submitted_by uuid);
  ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
  CREATE TABLE public.case_comments (id serial PRIMARY KEY); CREATE TABLE public.assets (id serial PRIMARY KEY);
  CREATE TABLE public.equipment_loans (id serial PRIMARY KEY); CREATE TABLE public.grants_radar (id serial PRIMARY KEY);
  CREATE TABLE public.petitions (id serial PRIMARY KEY); CREATE TABLE public.documents (id serial PRIMARY KEY);
  CREATE TABLE public.meetings (id serial PRIMARY KEY); CREATE TABLE public.departments (id serial PRIMARY KEY, name text);
  INSERT INTO public.departments (name) VALUES ('Pion');
  CREATE TABLE public.projects (id serial PRIMARY KEY); CREATE TABLE public.profiles (id serial PRIMARY KEY);
  CREATE TABLE public.decisions (id serial PRIMARY KEY, title text); INSERT INTO public.decisions (title) VALUES ('Uchwała');
  CREATE TABLE public.board_notes (id serial PRIMARY KEY);
  CREATE TABLE public.board_polls (id serial PRIMARY KEY); CREATE TABLE public.risks (id serial PRIMARY KEY);
  CREATE TABLE public.notification_preferences (id serial PRIMARY KEY); CREATE TABLE public.meeting_votes (id serial PRIMARY KEY);
  GRANT ALL ON ALL TABLES IN SCHEMA public, storage TO anon, authenticated;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public, storage TO anon, authenticated;

  CREATE FUNCTION public.generate_case_number() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
  CREATE FUNCTION public.update_member_scores_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
  CREATE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN NEW; END $$;
  CREATE FUNCTION public.has_scores_access() RETURNS boolean LANGUAGE sql AS 'SELECT true';
  CREATE FUNCTION public.is_scores_admin() RETURNS boolean LANGUAGE sql AS 'SELECT false';
  CREATE FUNCTION public.list_scores_access() RETURNS SETOF uuid LANGUAGE sql AS 'SELECT NULL::uuid WHERE false';
  CREATE FUNCTION public.set_score_limit(member_id uuid, new_limit integer) RETURNS void LANGUAGE sql AS 'SELECT';
`

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
  await db.exec(await migration())
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
    await assert.rejects(fresh.exec(await migration()), /public\.risks zawiera 1 wierszy/)
    await fresh.exec('ROLLBACK')
    assert.equal(Number((await fresh.query('SELECT count(*) AS n FROM public.risks')).rows[0].n), 1)
    assert.equal((await fresh.query(`SELECT relrowsecurity FROM pg_class WHERE oid = 'public.users'::regclass`)).rows[0].relrowsecurity, false)
  } finally {
    await fresh.close()
  }
})
