import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { fixture, ids, migration } from './fixtures/supabase.mjs'

const MIGRATION = '20261007_notifications_dedupe.sql'
let db

// Wywołanie tak jak przez PostgREST z kluczem service role (albo innej roli)
async function insertOnce(role, { userId = ids.member, type = 'task_assigned', link = '/tasks?task=1', since = 'window' } = {}) {
  await db.exec('RESET ROLE')
  await db.exec(`SET ROLE ${role}`)
  try {
    const sinceSql = since === 'window' ? "now() - interval '10 minutes'" : since === null ? 'NULL' : `'${since}'::timestamptz`
    const { rows } = await db.query(
      `SELECT public.insert_notification_once($1, $2, 'Tytuł', 'Treść', $3, ${sinceSql}) AS inserted`, [userId, type, link])
    return rows[0].inserted
  } finally {
    await db.exec('RESET ROLE')
  }
}
const rowsFor = async (type, link) =>
  Number((await db.query('SELECT count(*) AS n FROM public.notifications WHERE type = $1 AND link = $2', [type, link])).rows[0].n)

before(async () => {
  db = new PGlite()
  await db.exec(fixture)
  await db.exec(await migration('20261006_enforce_rls_cleanup.sql'))
  await db.exec(await migration(MIGRATION))
  await db.exec(await migration(MIGRATION)) // migracja jest idempotentna
})
after(async () => { await db?.close() })

test('the first call inserts, an identical call within the window is skipped', async () => {
  assert.equal(await insertOnce('service_role'), true)
  assert.equal(await insertOnce('service_role'), false)
  assert.equal(await rowsFor('task_assigned', '/tasks?task=1'), 1)
})

test('outside the window the same notification is stored again', async () => {
  await db.query(`INSERT INTO public.notifications (user_id, type, title, link, created_at)
    VALUES ($1, 'case_comment', 'Stary', '/cases?case=1', now() - interval '11 minutes')`, [ids.member])
  assert.equal(await insertOnce('service_role', { type: 'case_comment', link: '/cases?case=1' }), true)
  assert.equal(await rowsFor('case_comment', '/cases?case=1'), 2)
})

test('without a window (p_since NULL) a notification is never repeated', async () => {
  await db.query(`INSERT INTO public.notifications (user_id, type, title, link, created_at)
    VALUES ($1, 'deadline_overdue', 'Dawno', '/tasks?task=7', '2025-01-01')`, [ids.member])
  assert.equal(await insertOnce('service_role', { type: 'deadline_overdue', link: '/tasks?task=7', since: null }), false)
  assert.equal(await rowsFor('deadline_overdue', '/tasks?task=7'), 1)
})

test('a different link or recipient is a different notification', async () => {
  assert.equal(await insertOnce('service_role', { type: 'account_pending', link: '/users?user=a', since: null }), true)
  assert.equal(await insertOnce('service_role', { type: 'account_pending', link: '/users?user=b', since: null }), true)
  assert.equal(await insertOnce('service_role', { userId: ids.admin, type: 'account_pending', link: '/users?user=a', since: null }), true)
  assert.equal(await insertOnce('service_role', { type: 'account_pending', link: '/users?user=a', since: null }), false)
})

test('only the server (service role) may call the function', async () => {
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(insertOnce(role, { link: `/tasks?task=${role}` }), /permission denied/, role)
  }
  assert.equal(Number((await db.query(`SELECT count(*) AS n FROM public.notifications WHERE link IN ('/tasks?task=anon', '/tasks?task=authenticated')`)).rows[0].n), 0)
  const { rows } = await db.query(`SELECT has_function_privilege('service_role', 'public.insert_notification_once(uuid, text, text, text, text, timestamptz)', 'EXECUTE') AS ok`)
  assert.equal(rows[0].ok, true)
})

test('the bell table is published for Realtime', async () => {
  const { rows } = await db.query(`SELECT count(*) AS n FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'`)
  assert.equal(Number(rows[0].n), 1)
})
