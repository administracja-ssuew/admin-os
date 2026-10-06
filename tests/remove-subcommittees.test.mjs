import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { fixture, ids, migration } from './fixtures/supabase.mjs'

async function prepare(extraSql = '') {
  const db = new PGlite()
  await db.exec(fixture)
  await db.exec(`
    ALTER TABLE public.department_notes ADD COLUMN content text;
    ALTER TABLE public.tasks ADD COLUMN department_id int REFERENCES public.departments(id);
    ALTER TABLE public.cases ADD COLUMN department_id int REFERENCES public.departments(id);
    UPDATE public.users SET department_id = gen_random_uuid() WHERE id = '${ids.member}';
    INSERT INTO public.department_notes (department_id, content) VALUES (gen_random_uuid(), '');
    ${extraSql}`)
  await db.exec(await migration('20261006_enforce_rls_cleanup.sql'))
  return db
}
const exists = async (db, sql) => Boolean((await db.query(`SELECT (${sql}) IS NOT NULL AS e`)).rows[0].e)

test('subcommittees are removed with their assignments; other data stays', async () => {
  const db = await prepare()
  try {
    await db.exec(await migration('20261006_remove_subcommittees.sql'))
    assert.equal(await exists(db, "to_regclass('public.departments')"), false)
    assert.equal(await exists(db, "to_regclass('public.department_notes')"), false)
    for (const t of ['users', 'tasks', 'cases']) {
      const cols = (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${t}' AND column_name = 'department_id'`)).rows
      assert.equal(cols.length, 0, t)
    }
    assert.equal(Number((await db.query('SELECT count(*) AS n FROM public.users')).rows[0].n), 4)
    assert.equal(Number((await db.query('SELECT count(*) AS n FROM public.tasks')).rows[0].n), 1)
  } finally {
    await db.close()
  }
})

test('the migration stops when a task, case or note still uses a subcommittee', async () => {
  for (const extra of [
    'UPDATE public.tasks SET department_id = 1',
    `INSERT INTO public.cases (title, case_number, department_id) VALUES ('x', 'WNI/X', 1)`,
    `UPDATE public.department_notes SET content = 'ważne'`,
  ]) {
    const db = await prepare(extra)
    try {
      await assert.rejects(db.exec(await migration('20261006_remove_subcommittees.sql')), /przerwano/)
      await db.exec('ROLLBACK')
      assert.equal(await exists(db, "to_regclass('public.departments')"), true, extra)
    } finally {
      await db.close()
    }
  }
})
