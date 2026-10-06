import test from 'node:test'
import assert from 'node:assert/strict'
import { sendEmail } from '../lib/email.ts'
import { notificationEmailTemplate } from '../lib/email-templates.ts'

const env = { MAIL_GAS_URL: 'https://script.google.com/macros/s/X/exec', MAIL_GAS_TOKEN: 'secret' }

test('without mailer configuration e-mail is skipped, not failed', async () => {
  let called = false
  const result = await sendEmail({ to: 'a@example.org', subject: 'S', html: '<p>x</p>' }, { env: {}, fetch: async () => { called = true } })
  assert.deepEqual(result, { success: false, skipped: true })
  assert.equal(called, false)
})

test('posts token, recipients, prefixed subject and wrapped html to Apps Script', async () => {
  let request
  const fetchStub = async (url, init) => { request = { url, init }; return new Response(JSON.stringify({ ok: true })) }
  const result = await sendEmail({ to: 'a@example.org', subject: 'Nowe zadanie', html: '<p>Treść</p>' }, { env, fetch: fetchStub })
  assert.equal(result.success, true)
  assert.equal(request.url, env.MAIL_GAS_URL)
  const body = JSON.parse(request.init.body)
  assert.equal(body.token, 'secret')
  assert.deepEqual(body.to, ['a@example.org'])
  assert.equal(body.subject, '[AdminOS] Nowe zadanie')
  assert.match(body.html, /<p>Treść<\/p>/)
  assert.match(body.html, /AdminOS/)
})

test('Apps Script errors and network failures are reported without throwing', async () => {
  const rejected = await sendEmail({ to: 'a@example.org', subject: 'S', html: 'x' }, { env, fetch: async () => new Response(JSON.stringify({ ok: false, error: 'quota' })) })
  assert.deepEqual(rejected, { success: false, error: 'quota' })
  const offline = await sendEmail({ to: 'a@example.org', subject: 'S', html: 'x' }, { env, fetch: async () => { throw new Error('offline') } })
  assert.equal(offline.success, false)
})

test('notification template escapes text and links to the app', () => {
  const tpl = notificationEmailTemplate('Nowe <zadanie>', 'Treść & więcej', '/tasks?task=1')
  assert.equal(tpl.subject, 'Nowe <zadanie>')
  assert.match(tpl.html, /Nowe &lt;zadanie&gt;/)
  assert.match(tpl.html, /Treść &amp; więcej/)
  assert.match(tpl.html, /href="[^"]*\/tasks\?task=1"/)
})
