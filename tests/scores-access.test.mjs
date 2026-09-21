import { before, beforeEach, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

let db
const owner = '00000000-0000-0000-0000-000000000001'
const viewer = '00000000-0000-0000-0000-000000000002'
const superadmin = '00000000-0000-0000-0000-000000000003'
const unverified = '00000000-0000-0000-0000-000000000004'
const member = '10000000-0000-0000-0000-000000000002'
const migration = async name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
async function asUser(id, role = 'authenticated') {
  await db.exec('RESET ROLE')
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id ?? ''])
  await db.exec(`SET ROLE ${role}`)
}
async function scalar(sql) { return Object.values((await db.query(sql)).rows[0])[0] }

before(async () => {
  db = new PGlite()
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    CREATE TABLE public.users (id uuid PRIMARY KEY, email text, system_role text);
    INSERT INTO auth.users VALUES
      ('${owner}', 'administracja@samorzad.ue.wroc.pl', now()),
      ('${viewer}', 'viewer@example.org', now()),
      ('${superadmin}', 'superadmin@example.org', now()),
      ('${unverified}', 'unverified@example.org', null);
    INSERT INTO public.users VALUES
      ('10000000-0000-0000-0000-000000000001', 'administracja@samorzad.ue.wroc.pl', 'active'),
      ('${member}', 'viewer@example.org', 'active'),
      ('10000000-0000-0000-0000-000000000003', 'superadmin@example.org', 'superadmin');
    GRANT SELECT, UPDATE ON public.users TO authenticated;
    CREATE TABLE public.cases (id uuid DEFAULT gen_random_uuid(), case_type text NOT NULL DEFAULT 'Administracyjna');
    CREATE TABLE public.meeting_votes (id integer);
    CREATE TABLE public.knowledge_articles (id integer);
    GRANT ALL ON public.meeting_votes, public.knowledge_articles TO anon, authenticated;
    INSERT INTO public.meeting_votes VALUES (1);
    INSERT INTO public.knowledge_articles VALUES (1);
    INSERT INTO public.cases(case_type) VALUES ('Historyczna');
  `)
  await db.exec(await migration('20260404_create_member_scores.sql'))
  await db.exec(`GRANT ALL ON public.member_scores TO authenticated;
    INSERT INTO public.member_scores(user_id, year, month, activity_points) VALUES ('${member}', 2026, 9, 5);`)
  await db.exec(await migration('20260921_scores_access.sql'))
  await db.exec(await migration('20260921_retire_categories_knowledge_voting.sql'))
})
beforeEach(async () => {
  await db.exec(`RESET ROLE; TRUNCATE public.scores_access;
    UPDATE public.users SET system_role = 'active', email = 'viewer@example.org' WHERE id = '${member}';`)
})
after(async () => { await db?.close() })

test('verified owner has access regardless of system role and can edit scores and limits', async () => {
  await asUser(owner)
  assert.equal(await scalar('SELECT public.is_scores_admin()'), true)
  assert.equal(await scalar('SELECT public.has_scores_access()'), true)
  assert.equal(await scalar('SELECT count(*)::int FROM public.member_scores'), 1)
  await db.exec(`UPDATE public.member_scores SET activity_points = 6 WHERE user_id = '${member}'`)
  await db.exec(`SELECT public.set_score_limit('${member}', 18)`)
  assert.equal(await scalar(`SELECT personal_limit FROM public.users WHERE id = '${member}'`), 18)
  await assert.rejects(db.exec(`SELECT public.set_score_limit('${member}', 21)`), /Limit musi/)
})
test('superadmin role alone gives no access', async () => {
  await asUser(superadmin)
  assert.equal(await scalar('SELECT public.has_scores_access()'), false)
  assert.equal(await scalar('SELECT count(*)::int FROM public.member_scores'), 0)
  await assert.rejects(db.exec('SELECT * FROM public.list_scores_access()'), /Brak uprawnień/)
})
test('grant persists and revocation blocks the next read in the same session', async () => {
  await asUser(owner)
  await db.exec(`INSERT INTO public.scores_access(user_id) VALUES ('${viewer}')`)
  await asUser(viewer)
  assert.equal(await scalar('SELECT public.has_scores_access()'), true)
  assert.equal(await scalar('SELECT count(*)::int FROM public.member_scores'), 1)
  await asUser(owner)
  await db.exec(`DELETE FROM public.scores_access WHERE user_id = '${viewer}'`)
  await asUser(viewer)
  assert.equal(await scalar('SELECT public.has_scores_access()'), false)
  assert.equal(await scalar('SELECT count(*)::int FROM public.member_scores'), 0)
})
test('viewer cannot edit scores, limits or access grants', async () => {
  await asUser(owner)
  await db.exec(`INSERT INTO public.scores_access(user_id) VALUES ('${viewer}')`)
  await asUser(viewer)
  assert.equal((await db.query('UPDATE public.member_scores SET activity_points = 1 RETURNING id')).rows.length, 0)
  await assert.rejects(db.exec(`INSERT INTO public.member_scores(user_id, year, month) VALUES ('${member}', 2026, 10)`), /row-level security/)
  await assert.rejects(db.exec(`INSERT INTO public.scores_access(user_id) VALUES ('${superadmin}')`), /row-level security/)
  assert.equal((await db.query('DELETE FROM public.scores_access RETURNING user_id')).rows.length, 0)
  await assert.rejects(db.exec(`SELECT public.set_score_limit('${member}', 10)`), /Brak uprawnień/)
  await assert.rejects(db.exec(`UPDATE public.users SET personal_limit = 10 WHERE id = '${member}'`), /Brak uprawnień/)
  assert.equal(await scalar('SELECT count(*)::int FROM public.scores_access'), 0)
})
test('editing a public profile email cannot impersonate the access administrator', async () => {
  await asUser(viewer)
  await db.exec(`UPDATE public.users SET email = 'administracja@samorzad.ue.wroc.pl' WHERE id = '${member}'`)
  assert.equal(await scalar('SELECT public.is_scores_admin()'), false)
  await assert.rejects(db.exec(`INSERT INTO public.scores_access(user_id) VALUES ('${viewer}')`), /row-level security/)
})
test('inactive or unverified users cannot use a grant', async () => {
  await asUser(owner)
  await db.exec(`INSERT INTO public.scores_access(user_id) VALUES ('${viewer}'), ('${unverified}')`)
  await db.exec(`UPDATE public.users SET system_role = 'inactive' WHERE id = '${member}'`)
  await asUser(viewer)
  assert.equal(await scalar('SELECT public.has_scores_access()'), false)
  await asUser(unverified)
  assert.equal(await scalar('SELECT public.has_scores_access()'), false)
})
test('access management lists auth IDs rather than unrelated profile IDs', async () => {
  await asUser(owner)
  const rows = (await db.query('SELECT * FROM public.list_scores_access()')).rows
  assert.equal(rows.find(row => row.email === 'viewer@example.org').user_id, viewer)
  assert.equal(rows.some(row => row.user_id === owner), false)
  assert.equal(rows.some(row => row.user_id === unverified), false)
})
test('anonymous requests cannot read scores or call permission functions', async () => {
  await asUser(null, 'anon')
  await assert.rejects(db.exec('SELECT * FROM public.member_scores'), /permission denied/)
  await assert.rejects(db.exec('SELECT public.has_scores_access()'), /permission denied/)
  await assert.rejects(db.exec('SELECT * FROM public.scores_access'), /permission denied/)
})
test('retired modules are inaccessible to browser roles, historical records remain', async () => {
  for (const role of ['anon', 'authenticated']) {
    await asUser(viewer, role)
    for (const table of ['knowledge_articles', 'meeting_votes']) {
      await assert.rejects(db.exec(`SELECT * FROM public.${table}`), /permission denied/)
      await assert.rejects(db.exec(`INSERT INTO public.${table} VALUES (2)`), /permission denied/)
    }
  }
  await db.exec('RESET ROLE')
  assert.equal(await scalar('SELECT count(*)::int FROM public.meeting_votes'), 1)
  assert.equal(await scalar('SELECT count(*)::int FROM public.knowledge_articles'), 1)
})
test('new cases need no category; historical categories are preserved', async () => {
  const result = await db.query('INSERT INTO public.cases DEFAULT VALUES RETURNING case_type')
  assert.equal(result.rows[0].case_type, null)
  assert.equal(await scalar("SELECT count(*)::int FROM public.cases WHERE case_type = 'Historyczna'"), 1)
})
