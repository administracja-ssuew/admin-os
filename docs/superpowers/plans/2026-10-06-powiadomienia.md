# Powiadomienia — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dzwoneczek i e-maile (przez Google Apps Script) dla zdarzeń z tabeli w specyfikacji, generowane wyłącznie po stronie serwera na podstawie danych z bazy.

**Architecture:** Przeglądarka wysyła tylko `{event, id}` do `POST /api/notifications`. Route ładuje rekord i autora z bazy, czyste funkcje `lib/notifications/resolve.ts` wyznaczają odbiorców i treść, `lib/notifications/dispatch.ts` deduplikuje, zapisuje wpisy w `notifications` i wysyła e-maile przez `lib/email.ts` → Apps Script. Nowy wniosek wywołuje dispatch bezpośrednio z server action, terminy — codzienny Vercel Cron.

**Tech Stack:** Next.js 16.2.1 (App Router, route handlers, server actions), Supabase JS 2.100.1 (service role na serwerze), Node test runner (`node --test`, import plików `.ts`), Google Apps Script (`MailApp`).

**Spec:** `docs/superpowers/specs/2026-10-06-powiadomienia-design.md`

## Global Constraints

- Katalog roboczy: `.worktrees/panel-updates` (gałąź `changes/requested-panel-updates`, wdrożenie przez push na `master`).
- Po każdym zadaniu: `npm run typecheck`, `npm test`; przed wdrożeniem także `npm run build` z `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=public-anon-key`. Lint zmienionych plików nie może mieć więcej błędów niż przed zmianą.
- Klient nie przekazuje e-maili, tytułów ani treści powiadomień — tylko `event` i `id`.
- Odbiorca nigdy nie jest autorem zmiany (poza `account_approved`, gdzie autor to zarząd, a odbiorca to zatwierdzona osoba).
- E-mail tylko dla: `task_assigned`, `task_rejected`, `deadline_tomorrow`, `deadline_overdue`, `external_submission`, `case_assigned`, `account_pending`, `account_approved`.
- Deduplikacja: ten sam `user_id` + `type` + `link` w ciągu 10 minut; dla `deadline_overdue`, `account_pending`, `account_approved` — kiedykolwiek.
- Daty terminów w strefie `Europe/Warsaw`; cron `0 5 * * *` (UTC).
- Brak `MAIL_GAS_URL`/`MAIL_GAS_TOKEN` → e-mail pomijany (log ostrzegawczy), wpis w dzwoneczku zapisany.
- Linki: `/tasks?task=<id>`, `/cases?case=<id>`, `/users`.
- Teksty interfejsu i e-maili po polsku; komentarze w kodzie po polsku, jak w reszcie projektu.
- Identyfikator osoby w powiadomieniach to `public.users.id` (nie `auth.uid()`).

## Review Focus

- Zdarzenie wywołane wielokrotnie (podwójne kliknięcie, odświeżenie, złośliwe pętle) → jedno powiadomienie na 10 minut — test w Task 3.
- Osoba bez adresu e-mail albo brak konfiguracji poczty → wpis w dzwoneczku jest zapisany, route odpowiada 200 — testy w Task 1 i Task 3.
- Przypomnienie wieczorem/po północy (UTC vs Warszawa, np. 2026-10-06T22:30Z to już 7 października w Warszawie) → poprawny dzień — test w Task 2.
- Osoba oczekująca wywołuje `account_pending` z cudzym `id` albo członek wywołuje `task_reviewed` → 403 bez wysyłki — testy w Task 2.
- Przydzielenie zadania samemu sobie, komentarz prowadzącego we własnej sprawie → brak powiadomienia — testy w Task 2.

---

### Task 1: Wysyłka e-maili przez Google Apps Script

**Files:**
- Create: `scripts/gas/mailer.gs`
- Modify: `lib/email.ts` (całość), `lib/email-templates.ts` (zostaje szablon potwierdzenia dla wnioskodawcy + nowy szablon ogólny), `package.json`, `package-lock.json` (usunięcie `resend`), `.env.local.example`
- Test: `tests/email.test.mjs`

**Interfaces:**
- Produces: `sendEmail({ to, subject, html }, deps?) => Promise<{ success: boolean; skipped?: boolean; error?: string }>` gdzie `deps = { fetch?: typeof fetch; env?: Record<string, string | undefined> }`; `APP_URL: string`; `notificationEmailTemplate(title: string, body: string, link: string) => { subject: string; html: string }`; `externalSubmissionConfirmationTemplate(caseNumber, title)` bez zmian.

- [ ] **Step 1: Write the failing test**

`tests/email.test.mjs`:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/email.test.mjs`
Expected: FAIL — `sendEmail` przyjmuje jeden argument i woła Resend; brak `notificationEmailTemplate`.

- [ ] **Step 3: Write minimal implementation**

`lib/email.ts` (całość):
```ts
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
}

interface SendEmailDeps {
  fetch?: typeof fetch
  env?: Record<string, string | undefined>
}

export type SendEmailResult = { success: boolean; skipped?: boolean; error?: string }

/**
 * Wysyłka przez Google Apps Script (scripts/gas/mailer.gs) — bez Resend i konfiguracji DNS.
 * Brak MAIL_GAS_URL/MAIL_GAS_TOKEN oznacza pominięcie e-maila, nie błąd aplikacji.
 */
export async function sendEmail({ to, subject, html }: SendEmailParams, deps: SendEmailDeps = {}): Promise<SendEmailResult> {
  const env = deps.env ?? process.env
  const doFetch = deps.fetch ?? fetch
  const url = env.MAIL_GAS_URL
  const token = env.MAIL_GAS_TOKEN
  if (!url || !token) {
    console.warn('E-mail pominięty: brak MAIL_GAS_URL lub MAIL_GAS_TOKEN')
    return { success: false, skipped: true }
  }
  try {
    const res = await doFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, to: Array.isArray(to) ? to : [to], subject: `[AdminOS] ${subject}`, html: wrapInTemplate(html) }),
    })
    const data = await res.json().catch(() => null)
    if (!data?.ok) {
      const error = data?.error ?? `HTTP ${res.status}`
      console.error('Email send error:', error)
      return { success: false, error }
    }
    return { success: true }
  } catch (err) {
    console.error('Email send exception:', err)
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

function wrapInTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f1f5f9;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#0f172a;padding:20px 24px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;color:#3b82f6;font-size:20px;font-weight:800;letter-spacing:1px;">AdminOS</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Komisja Weryfikacyjna</p>
    </div>
    <div style="background:#ffffff;padding:24px;border:1px solid #e2e8f0;border-top:none;">
      ${content}
    </div>
    <div style="padding:16px 24px;text-align:center;background:#f8fafc;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">
        Wiadomość wygenerowana automatycznie przez system AdminOS.
        <br><a href="${APP_URL}" style="color:#3b82f6;text-decoration:none;">Przejdź do systemu</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

export { APP_URL }
```

`lib/email-templates.ts` — na razie bez usuwania istniejących szablonów (używa ich jeszcze stary route; usunięcie w Task 6, Step 3). Dodaj na końcu:
```ts
const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Jeden szablon dla wszystkich powiadomień: tytuł, opis i przycisk do konkretnego miejsca. */
export function notificationEmailTemplate(title: string, body: string, link: string) {
  return {
    subject: title,
    html: `
      <h2 style="margin:0 0 12px;color:#1e293b;font-size:18px;">${escapeHtml(title)}</h2>
      <p style="margin:0 0 12px;color:#475569;font-size:14px;line-height:1.6;">${escapeHtml(body)}</p>
      <a href="${APP_URL}${link}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#3b82f6;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
        Otwórz w AdminOS
      </a>
    `,
  }
}
```

`scripts/gas/mailer.gs`:
```js
// AdminOS — wysyłka e-maili. Wklej do projektu Google Apps Script, w Ustawieniach projektu
// dodaj właściwość skryptu TOKEN (ta sama wartość co MAIL_GAS_TOKEN w Vercel), a potem
// Wdróż → Nowe wdrożenie → Aplikacja internetowa: „Wykonaj jako: ja”, „Kto ma dostęp: każdy”.
// Adres wdrożenia (…/exec) wpisz w Vercel jako MAIL_GAS_URL.
function doPost(e) {
  var token = PropertiesService.getScriptProperties().getProperty('TOKEN')
  var body
  try {
    body = JSON.parse(e.postData.contents)
  } catch (err) {
    return json({ ok: false, error: 'bad json' })
  }
  if (!token || !body || body.token !== token) return json({ ok: false, error: 'unauthorized' })
  var to = [].concat(body.to || []).filter(function (a) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(a)) })
  if (!to.length || !body.subject || !body.html) return json({ ok: false, error: 'missing fields' })
  if (to.length > 50) return json({ ok: false, error: 'too many recipients' })
  if (MailApp.getRemainingDailyQuota() < to.length) return json({ ok: false, error: 'quota' })
  MailApp.sendEmail({ to: to.join(','), subject: String(body.subject).slice(0, 250), htmlBody: String(body.html), name: 'AdminOS' })
  return json({ ok: true, remaining: MailApp.getRemainingDailyQuota() })
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}
```

`.env.local.example` — zastąp blok Resend oraz `EXTERNAL_NOTIFICATIONS_SECRET`:
```
# E-mail przez Google Apps Script (scripts/gas/mailer.gs) — tylko serwer
MAIL_GAS_URL=https://script.google.com/macros/s/YOUR_MAILER_ID/exec
MAIL_GAS_TOKEN=your_random_token_min_32_chars
```

Usuń zależność: `npm uninstall resend`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/email.test.mjs && npm run typecheck && npm test`
Expected: PASS (stary route nadal kompiluje się, bo `sendEmail` przyjmuje te same pola, a drugi argument jest opcjonalny).

- [ ] **Step 5: Commit**

```bash
git add lib/email.ts lib/email-templates.ts scripts/gas/mailer.gs tests/email.test.mjs package.json package-lock.json .env.local.example
git commit -m "Send e-mail through Google Apps Script instead of Resend"
```

---

### Task 2: Zdarzenia i reguły odbiorców (czyste funkcje)

**Files:**
- Create: `lib/notifications/events.ts`, `lib/notifications/resolve.ts`
- Test: `tests/notifications-resolve.test.mjs`

**Interfaces:**
- Produces (events.ts):
  - `type ClientEvent = 'task_assigned' | 'task_reviewed' | 'case_assigned' | 'case_status_changed' | 'case_comment' | 'account_pending' | 'account_approved'`
  - `type NotificationType = 'task_assigned' | 'task_approved' | 'task_rejected' | 'deadline_tomorrow' | 'deadline_overdue' | 'external_submission' | 'case_assigned' | 'case_status_changed' | 'case_comment' | 'account_pending' | 'account_approved'`
  - `parseEventRequest(body: unknown): { event: ClientEvent; id: string } | null`
  - `taskLink(id: string): string`, `caseLink(id: string): string`, `USERS_LINK = '/users'`
  - `EMAIL_TYPES: ReadonlySet<NotificationType>`, `DEDUPE_FOREVER: ReadonlySet<NotificationType>`
  - `isActiveMember(role: string | null | undefined): boolean`, `isBoard(role): boolean`
- Produces (resolve.ts):
  - `interface Person { id: string; email: string | null; first_name: string; last_name: string; system_role: string }`
  - `interface TaskRecord { id: string; title: string; owner_id: string | null; deadline: string | null; status: string; verification_status: string | null; verification_feedback: string | null }`
  - `interface CaseRecord { id: string; case_number: string; title: string; owner_id: string | null; status: string }`
  - `interface Outgoing { userId: string; email: string | null; type: NotificationType; title: string; body: string; link: string; sendEmail: boolean }`
  - `type Resolution = { ok: true; notifications: Outgoing[] } | { ok: false; status: 403 | 404; reason: string }`
  - `resolveTaskAssigned(actor: Person, task: TaskRecord | null, owner: Person | null): Resolution`
  - `resolveTaskReviewed(actor, task, owner): Resolution`
  - `resolveCaseAssigned(actor, kase: CaseRecord | null, owner): Resolution`
  - `resolveCaseStatusChanged(actor, kase, owner): Resolution`
  - `resolveCaseComment(actor, kase, owner, hasRecentComment: boolean): Resolution`
  - `resolveAccountPending(actor: Person, targetId: string, board: Person[]): Resolution`
  - `resolveAccountApproved(actor: Person, target: Person | null): Resolution`
  - `resolveExternalSubmission(kase: { id: string; case_number: string; title: string }, board: Person[]): Outgoing[]`
  - `resolveDeadlines(tasks: Array<TaskRecord & { owner: Person | null }>, today: string): Outgoing[]`
  - `warsawDate(now: Date): string` (YYYY-MM-DD), `addDays(date: string, days: number): string`

- [ ] **Step 1: Write the failing test**

`tests/notifications-resolve.test.mjs`:
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseEventRequest } from '../lib/notifications/events.ts'
import {
  resolveTaskAssigned, resolveTaskReviewed, resolveCaseAssigned, resolveCaseStatusChanged, resolveCaseComment,
  resolveAccountPending, resolveAccountApproved, resolveExternalSubmission, resolveDeadlines, warsawDate, addDays,
} from '../lib/notifications/resolve.ts'

const person = (id, role = 'member', extra = {}) => ({ id, email: `${id}@example.org`, first_name: id.toUpperCase(), last_name: 'Nowak', system_role: role, ...extra })
const anna = person('anna'), jan = person('jan'), boss = person('boss', 'admin'), newbie = person('newbie', 'pending')
const task = { id: 't1', title: 'Raport', owner_id: 'jan', deadline: '2026-10-07', status: 'to_do', verification_status: null, verification_feedback: null }
const kase = { id: 'c1', case_number: 'WNI/2026/0001', title: 'Remont', owner_id: 'jan', status: 'in_progress' }

test('event requests accept only known events with an id', () => {
  assert.deepEqual(parseEventRequest({ event: 'task_assigned', id: 'x' }), { event: 'task_assigned', id: 'x' })
  assert.equal(parseEventRequest({ event: 'external_submission', id: 'x' }), null)
  assert.equal(parseEventRequest({ event: 'task_assigned' }), null)
  assert.equal(parseEventRequest({ event: 'task_assigned', id: 'x', title: 'spoof' })?.title, undefined)
  assert.equal(parseEventRequest(null), null)
})

test('task assignment notifies the owner by bell and e-mail, never the actor', () => {
  const r = resolveTaskAssigned(anna, task, jan)
  assert.equal(r.ok, true)
  assert.deepEqual(r.notifications.map(n => [n.userId, n.type, n.link, n.sendEmail]), [['jan', 'task_assigned', '/tasks?task=t1', true]])
  assert.match(r.notifications[0].body, /ANNA Nowak/)
  assert.deepEqual(resolveTaskAssigned(jan, task, jan), { ok: true, notifications: [] })
  assert.deepEqual(resolveTaskAssigned(anna, { ...task, owner_id: null }, null), { ok: true, notifications: [] })
  assert.equal(resolveTaskAssigned(anna, null, null).status, 404)
  assert.equal(resolveTaskAssigned(newbie, task, jan).status, 403)
})

test('review: only the board; corrections are e-mailed, approval is bell only', () => {
  assert.equal(resolveTaskReviewed(anna, { ...task, verification_status: 'approved' }, jan).status, 403)
  const ok = resolveTaskReviewed(boss, { ...task, verification_status: 'approved' }, jan)
  assert.deepEqual(ok.notifications.map(n => [n.type, n.sendEmail]), [['task_approved', false]])
  const fix = resolveTaskReviewed(boss, { ...task, verification_status: 'rejected', verification_feedback: 'Dodaj źródła' }, jan)
  assert.deepEqual(fix.notifications.map(n => [n.type, n.sendEmail]), [['task_rejected', true]])
  assert.match(fix.notifications[0].body, /Dodaj źródła/)
  assert.equal(resolveTaskReviewed(boss, task, jan).status, 403, 'brak oceny w bazie')
})

test('cases: new owner by e-mail; status and comments by bell; never the actor', () => {
  assert.deepEqual(resolveCaseAssigned(anna, kase, jan).notifications.map(n => [n.type, n.link, n.sendEmail]), [['case_assigned', '/cases?case=c1', true]])
  assert.deepEqual(resolveCaseAssigned(jan, kase, jan).notifications, [])
  const status = resolveCaseStatusChanged(anna, kase, jan)
  assert.deepEqual(status.notifications.map(n => [n.type, n.sendEmail]), [['case_status_changed', false]])
  assert.match(status.notifications[0].body, /W toku/)
  assert.deepEqual(resolveCaseComment(anna, kase, jan, true).notifications.map(n => n.type), ['case_comment'])
  assert.equal(resolveCaseComment(anna, kase, jan, false).status, 403, 'brak świeżego komentarza autora')
  assert.deepEqual(resolveCaseComment(jan, kase, jan, true).notifications, [])
})

test('accounts: pending person notifies the board about itself only; approval needs the board', () => {
  const pending = resolveAccountPending(newbie, 'newbie', [boss, person('chief', 'superadmin')])
  assert.deepEqual(pending.notifications.map(n => [n.userId, n.type, n.link, n.sendEmail]), [['boss', 'account_pending', '/users', true], ['chief', 'account_pending', '/users', true]])
  assert.equal(resolveAccountPending(newbie, 'boss', [boss]).status, 403)
  assert.equal(resolveAccountPending(anna, 'anna', [boss]).status, 403, 'konto już aktywne')
  assert.equal(resolveAccountApproved(anna, jan).status, 403)
  assert.equal(resolveAccountApproved(boss, newbie).status, 403, 'konto nadal oczekuje')
  assert.deepEqual(resolveAccountApproved(boss, jan).notifications.map(n => [n.userId, n.type, n.sendEmail]), [['jan', 'account_approved', true]])
})

test('external submission goes to the whole board', () => {
  const out = resolveExternalSubmission({ id: 'c9', case_number: 'WNI/2026/0009', title: 'Grant' }, [boss])
  assert.deepEqual(out.map(n => [n.userId, n.type, n.link, n.sendEmail]), [['boss', 'external_submission', '/cases?case=c9', true]])
})

test('deadlines: tomorrow and first overdue day, only open tasks with an owner', () => {
  const today = '2026-10-06'
  const tasks = [
    { ...task, id: 'a', deadline: '2026-10-07', owner: jan },
    { ...task, id: 'b', deadline: '2026-10-05', owner: jan },
    { ...task, id: 'c', deadline: '2026-10-04', owner: jan },
    { ...task, id: 'd', deadline: '2026-10-07', status: 'done', owner: jan },
    { ...task, id: 'e', deadline: '2026-10-07', owner_id: null, owner: null },
  ]
  assert.deepEqual(resolveDeadlines(tasks, today).map(n => [n.link, n.type, n.sendEmail]), [['/tasks?task=a', 'deadline_tomorrow', true], ['/tasks?task=b', 'deadline_overdue', true]])
})

test('dates are computed in Warsaw time', () => {
  assert.equal(warsawDate(new Date('2026-10-06T22:30:00Z')), '2026-10-07')
  assert.equal(warsawDate(new Date('2026-12-31T22:59:00Z')), '2026-12-31')
  assert.equal(addDays('2026-10-31', 1), '2026-11-01')
  assert.equal(addDays('2026-01-01', -1), '2025-12-31')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/notifications-resolve.test.mjs`
Expected: FAIL — `Cannot find module '../lib/notifications/events.ts'`.

- [ ] **Step 3: Write minimal implementation**

`lib/notifications/events.ts`:
```ts
export const CLIENT_EVENTS = ['task_assigned', 'task_reviewed', 'case_assigned', 'case_status_changed', 'case_comment', 'account_pending', 'account_approved'] as const
export type ClientEvent = typeof CLIENT_EVENTS[number]

export type NotificationType =
  | 'task_assigned' | 'task_approved' | 'task_rejected' | 'deadline_tomorrow' | 'deadline_overdue'
  | 'external_submission' | 'case_assigned' | 'case_status_changed' | 'case_comment'
  | 'account_pending' | 'account_approved'

/** Zdarzenia, które poza dzwoneczkiem wysyłają e-mail (wymagają działania). */
export const EMAIL_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  'task_assigned', 'task_rejected', 'deadline_tomorrow', 'deadline_overdue', 'external_submission',
  'case_assigned', 'account_pending', 'account_approved',
])

/** Powiadomienia wysyłane najwyżej raz (bez okna 10 minut). */
export const DEDUPE_FOREVER: ReadonlySet<NotificationType> = new Set<NotificationType>(['deadline_overdue', 'account_pending', 'account_approved'])

export const taskLink = (id: string) => `/tasks?task=${encodeURIComponent(id)}`
export const caseLink = (id: string) => `/cases?case=${encodeURIComponent(id)}`
export const USERS_LINK = '/users'

export const isActiveMember = (role: string | null | undefined) => ['member', 'active', 'admin', 'superadmin'].includes(role ?? '')
export const isBoard = (role: string | null | undefined) => role === 'admin' || role === 'superadmin'

/** Z przeglądarki przyjmujemy wyłącznie nazwę zdarzenia i identyfikator rekordu. */
export function parseEventRequest(body: unknown): { event: ClientEvent; id: string } | null {
  if (!body || typeof body !== 'object') return null
  const { event, id } = body as Record<string, unknown>
  if (typeof event !== 'string' || !(CLIENT_EVENTS as readonly string[]).includes(event)) return null
  if (typeof id !== 'string' || !id.trim() || id.length > 100) return null
  return { event: event as ClientEvent, id: id.trim() }
}
```

`lib/notifications/resolve.ts`:
```ts
import { EMAIL_TYPES, USERS_LINK, caseLink, isActiveMember, isBoard, taskLink, type NotificationType } from './events'

export interface Person { id: string; email: string | null; first_name: string; last_name: string; system_role: string }
export interface TaskRecord { id: string; title: string; owner_id: string | null; deadline: string | null; status: string; verification_status: string | null; verification_feedback: string | null }
export interface CaseRecord { id: string; case_number: string; title: string; owner_id: string | null; status: string }
export interface Outgoing { userId: string; email: string | null; type: NotificationType; title: string; body: string; link: string; sendEmail: boolean }
export type Resolution = { ok: true; notifications: Outgoing[] } | { ok: false; status: 403 | 404; reason: string }

const CASE_STATUS: Record<string, string> = { new: 'Nowa', in_progress: 'W toku', closed: 'Zamknięta' }
const name = (p: Person) => `${p.first_name} ${p.last_name}`.trim()
const deny = (status: 403 | 404, reason: string): Resolution => ({ ok: false, status, reason })
const none: Resolution = { ok: true, notifications: [] }

function to(recipient: Person, type: NotificationType, title: string, body: string, link: string): Outgoing {
  return { userId: recipient.id, email: recipient.email, type, title, body, link, sendEmail: EMAIL_TYPES.has(type) }
}

/** Odbiorca istnieje i nie jest autorem zmiany. */
const recipientOf = (actor: Person, owner: Person | null) => (owner && owner.id !== actor.id ? owner : null)

export function resolveTaskAssigned(actor: Person, task: TaskRecord | null, owner: Person | null): Resolution {
  if (!isActiveMember(actor.system_role)) return deny(403, 'Brak uprawnień')
  if (!task) return deny(404, 'Nie ma takiego zadania')
  const recipient = recipientOf(actor, owner)
  if (!recipient) return none
  return { ok: true, notifications: [to(recipient, 'task_assigned', 'Przydzielono Ci zadanie', `${name(actor)} przydzielił(a) Ci zadanie „${task.title}”.`, taskLink(task.id))] }
}

export function resolveTaskReviewed(actor: Person, task: TaskRecord | null, owner: Person | null): Resolution {
  if (!isBoard(actor.system_role)) return deny(403, 'Ocenia wyłącznie zarząd')
  if (!task) return deny(404, 'Nie ma takiego zadania')
  if (task.verification_status !== 'approved' && task.verification_status !== 'rejected') return deny(403, 'Zadanie nie zostało ocenione')
  const recipient = recipientOf(actor, owner)
  if (!recipient) return none
  if (task.verification_status === 'approved') {
    return { ok: true, notifications: [to(recipient, 'task_approved', 'Zadanie zatwierdzone', `${name(actor)} zatwierdził(a) zadanie „${task.title}”.`, taskLink(task.id))] }
  }
  const feedback = task.verification_feedback ? ` Uwagi: ${task.verification_feedback}` : ''
  return { ok: true, notifications: [to(recipient, 'task_rejected', 'Zadanie wymaga poprawek', `${name(actor)} odesłał(a) zadanie „${task.title}” do poprawek.${feedback}`, taskLink(task.id))] }
}

export function resolveCaseAssigned(actor: Person, kase: CaseRecord | null, owner: Person | null): Resolution {
  if (!isActiveMember(actor.system_role)) return deny(403, 'Brak uprawnień')
  if (!kase) return deny(404, 'Nie ma takiej sprawy')
  const recipient = recipientOf(actor, owner)
  if (!recipient) return none
  return { ok: true, notifications: [to(recipient, 'case_assigned', `Prowadzisz sprawę ${kase.case_number}`, `${name(actor)} przypisał(a) Ci sprawę „${kase.title}”.`, caseLink(kase.id))] }
}

export function resolveCaseStatusChanged(actor: Person, kase: CaseRecord | null, owner: Person | null): Resolution {
  if (!isActiveMember(actor.system_role)) return deny(403, 'Brak uprawnień')
  if (!kase) return deny(404, 'Nie ma takiej sprawy')
  const recipient = recipientOf(actor, owner)
  if (!recipient) return none
  const status = CASE_STATUS[kase.status] ?? kase.status
  return { ok: true, notifications: [to(recipient, 'case_status_changed', `Zmiana statusu: ${kase.case_number}`, `${name(actor)} zmienił(a) status sprawy „${kase.title}” na: ${status}.`, caseLink(kase.id))] }
}

export function resolveCaseComment(actor: Person, kase: CaseRecord | null, owner: Person | null, hasRecentComment: boolean): Resolution {
  if (!isActiveMember(actor.system_role)) return deny(403, 'Brak uprawnień')
  if (!kase) return deny(404, 'Nie ma takiej sprawy')
  if (!hasRecentComment) return deny(403, 'Brak nowego komentarza')
  const recipient = recipientOf(actor, owner)
  if (!recipient) return none
  return { ok: true, notifications: [to(recipient, 'case_comment', `Nowy komentarz: ${kase.case_number}`, `${name(actor)} skomentował(a) sprawę „${kase.title}”.`, caseLink(kase.id))] }
}

export function resolveAccountPending(actor: Person, targetId: string, board: Person[]): Resolution {
  if (actor.id !== targetId || actor.system_role !== 'pending') return deny(403, 'Można zgłosić tylko własne oczekujące konto')
  const who = actor.email ?? name(actor)
  return { ok: true, notifications: board.map(b => to(b, 'account_pending', 'Nowe konto czeka na weryfikację', `${who} zarejestrował(a) się i czeka na zatwierdzenie w Kadrach.`, USERS_LINK)) }
}

export function resolveAccountApproved(actor: Person, target: Person | null): Resolution {
  if (!isBoard(actor.system_role)) return deny(403, 'Zatwierdza wyłącznie zarząd')
  if (!target) return deny(404, 'Nie ma takiego konta')
  if (!isActiveMember(target.system_role)) return deny(403, 'Konto nie jest aktywne')
  return { ok: true, notifications: [to(target, 'account_approved', 'Twoje konto zostało zatwierdzone', 'Masz już dostęp do AdminOS. Zaloguj się, aby zacząć.', '/')] }
}

export function resolveExternalSubmission(kase: { id: string; case_number: string; title: string }, board: Person[]): Outgoing[] {
  return board.map(b => to(b, 'external_submission', `Nowy wniosek: ${kase.case_number}`, `Z formularza wpłynął wniosek „${kase.title}”.`, caseLink(kase.id)))
}

export function resolveDeadlines(tasks: Array<TaskRecord & { owner: Person | null }>, today: string): Outgoing[] {
  const tomorrow = addDays(today, 1)
  const yesterday = addDays(today, -1)
  const out: Outgoing[] = []
  for (const t of tasks) {
    if (!t.owner || t.status === 'done' || !t.deadline) continue
    const day = t.deadline.slice(0, 10)
    if (day === tomorrow) out.push(to(t.owner, 'deadline_tomorrow', 'Termin zadania jutro', `Zadanie „${t.title}” ma termin jutro.`, taskLink(t.id)))
    if (day === yesterday) out.push(to(t.owner, 'deadline_overdue', 'Zadanie po terminie', `Termin zadania „${t.title}” minął wczoraj.`, taskLink(t.id)))
  }
  return out
}

/** Dzień kalendarzowy w Warszawie (YYYY-MM-DD). */
export function warsawDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/notifications-resolve.test.mjs && npm run typecheck`
Expected: PASS (8 testów).

- [ ] **Step 5: Commit**

```bash
git add lib/notifications/events.ts lib/notifications/resolve.ts tests/notifications-resolve.test.mjs
git commit -m "Add notification events and recipient rules"
```

---

### Task 3: Wysyłka powiadomień z deduplikacją

**Files:**
- Create: `lib/notifications/dispatch.ts`
- Test: `tests/notifications-dispatch.test.mjs`

**Interfaces:**
- Consumes: `Outgoing` (Task 2), `DEDUPE_FOREVER` (Task 2), `sendEmail`, `notificationEmailTemplate` (Task 1)
- Produces:
  - `interface NotificationStore { exists(userId: string, type: string, link: string, since: Date | null): Promise<boolean>; insert(item: Outgoing): Promise<void> }`
  - `supabaseStore(db: SupabaseClient): NotificationStore`
  - `dispatch(store: NotificationStore, items: Outgoing[], deps?: { now?: Date; send?: typeof sendEmail }): Promise<{ inserted: number; skipped: number; emailed: number; emailFailed: number }>`
  - `DEDUPE_WINDOW_MS = 10 * 60 * 1000`

- [ ] **Step 1: Write the failing test**

`tests/notifications-dispatch.test.mjs`:
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { dispatch, DEDUPE_WINDOW_MS } from '../lib/notifications/dispatch.ts'

function memoryStore(existing = []) {
  const rows = [...existing]
  return {
    rows,
    async exists(userId, type, link, since) {
      return rows.some(r => r.userId === userId && r.type === type && r.link === link && (!since || r.createdAt >= since))
    },
    async insert(item) { rows.push({ ...item, createdAt: new Date() }) },
  }
}
const item = (over = {}) => ({ userId: 'jan', email: 'jan@example.org', type: 'task_assigned', title: 'T', body: 'B', link: '/tasks?task=1', sendEmail: true, ...over })
const okSend = () => { const sent = []; return { sent, send: async msg => { sent.push(msg); return { success: true } } } }

test('stores the notification and e-mails only when the type requires it', async () => {
  const store = memoryStore(); const mail = okSend()
  const res = await dispatch(store, [item(), item({ userId: 'ola', type: 'case_comment', link: '/cases?case=1', sendEmail: false })], { send: mail.send })
  assert.deepEqual(res, { inserted: 2, skipped: 0, emailed: 1, emailFailed: 0 })
  assert.equal(mail.sent.length, 1)
  assert.equal(mail.sent[0].to, 'jan@example.org')
  assert.match(mail.sent[0].html, /\/tasks\?task=1/)
})

test('the same notification within 10 minutes is sent once', async () => {
  const now = new Date('2026-10-06T10:00:00Z')
  const store = memoryStore([{ ...item(), createdAt: new Date(now.getTime() - DEDUPE_WINDOW_MS + 1000) }])
  const mail = okSend()
  const res = await dispatch(store, [item(), item()], { now, send: mail.send })
  assert.deepEqual(res, { inserted: 0, skipped: 2, emailed: 0, emailFailed: 0 })
  const later = await dispatch(memoryStore([{ ...item(), createdAt: new Date(now.getTime() - DEDUPE_WINDOW_MS - 1000) }]), [item()], { now, send: mail.send })
  assert.equal(later.inserted, 1)
})

test('one-time notifications are never repeated', async () => {
  const store = memoryStore([{ ...item({ type: 'deadline_overdue' }), createdAt: new Date('2025-01-01') }])
  const res = await dispatch(store, [item({ type: 'deadline_overdue' })], { send: okSend().send })
  assert.equal(res.skipped, 1)
})

test('missing e-mail or mail failure keeps the bell notification', async () => {
  const store = memoryStore()
  const res = await dispatch(store, [item({ email: null }), item({ userId: 'ola', email: 'ola@example.org' })], { send: async () => ({ success: false, error: 'quota' }) })
  assert.deepEqual(res, { inserted: 2, skipped: 0, emailed: 0, emailFailed: 1 })
  assert.equal(store.rows.length, 2)
})

test('duplicates inside one batch are collapsed', async () => {
  const store = memoryStore()
  const res = await dispatch(store, [item(), item()], { send: okSend().send })
  assert.equal(res.inserted, 1)
  assert.equal(res.skipped, 1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/notifications-dispatch.test.mjs`
Expected: FAIL — `Cannot find module '../lib/notifications/dispatch.ts'`.

- [ ] **Step 3: Write minimal implementation**

`lib/notifications/dispatch.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '../email'
import { notificationEmailTemplate } from '../email-templates'
import { DEDUPE_FOREVER } from './events'
import type { Outgoing } from './resolve'

export const DEDUPE_WINDOW_MS = 10 * 60 * 1000

export interface NotificationStore {
  exists(userId: string, type: string, link: string, since: Date | null): Promise<boolean>
  insert(item: Outgoing): Promise<void>
}

/** Magazyn w tabeli notifications (klient z service role). */
export function supabaseStore(db: SupabaseClient): NotificationStore {
  return {
    async exists(userId, type, link, since) {
      let query = db.from('notifications').select('id').eq('user_id', userId).eq('type', type).eq('link', link).limit(1)
      if (since) query = query.gte('created_at', since.toISOString())
      const { data, error } = await query
      if (error) throw error
      return (data?.length ?? 0) > 0
    },
    async insert(item) {
      const { error } = await db.from('notifications').insert([{ user_id: item.userId, type: item.type, title: item.title, body: item.body, link: item.link }])
      if (error) throw error
    },
  }
}

export async function dispatch(
  store: NotificationStore,
  items: Outgoing[],
  deps: { now?: Date; send?: typeof sendEmail } = {}
): Promise<{ inserted: number; skipped: number; emailed: number; emailFailed: number }> {
  const now = deps.now ?? new Date()
  const send = deps.send ?? sendEmail
  const result = { inserted: 0, skipped: 0, emailed: 0, emailFailed: 0 }
  const seen = new Set<string>()

  for (const item of items) {
    const key = `${item.userId}|${item.type}|${item.link}`
    const since = DEDUPE_FOREVER.has(item.type) ? null : new Date(now.getTime() - DEDUPE_WINDOW_MS)
    if (seen.has(key) || await store.exists(item.userId, item.type, item.link, since)) {
      result.skipped++
      continue
    }
    seen.add(key)
    await store.insert(item)
    result.inserted++

    if (item.sendEmail && item.email) {
      const tpl = notificationEmailTemplate(item.title, item.body, item.link)
      const sent = await send({ to: item.email, subject: tpl.subject, html: tpl.html })
      if (sent.success) result.emailed++
      else if (!sent.skipped) result.emailFailed++
    }
  }
  return result
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/notifications-dispatch.test.mjs && npm run typecheck`
Expected: PASS (5 testów).

- [ ] **Step 5: Commit**

```bash
git add lib/notifications/dispatch.ts tests/notifications-dispatch.test.mjs
git commit -m "Add notification dispatch with de-duplication"
```

---

### Task 4: Route `POST /api/notifications` i klient `notify(event, id)`

**Files:**
- Modify: `app/api/notifications/route.ts` (całość), `lib/notify.ts` (całość)
- Test: ręcznie po wdrożeniu (Task 8); logika przetestowana w Task 2–3

**Interfaces:**
- Consumes: `parseEventRequest`, `isBoard` (Task 2), wszystkie `resolve*` (Task 2), `dispatch`, `supabaseStore` (Task 3)
- Produces: `notify(event: ClientEvent, id: string): Promise<void>` (przeglądarka, „wyślij i zapomnij”); `loadPerson(db, id)`, `loadBoard(db)` eksportowane z `lib/notifications/load.ts` do użycia w Task 6–7:
  - `loadPersonById(db: SupabaseClient, id: string | null): Promise<Person | null>`
  - `loadPersonByEmail(db: SupabaseClient, email: string): Promise<Person | null>`
  - `loadBoard(db: SupabaseClient): Promise<Person[]>`
  - `serviceClient(): SupabaseClient | null`

- [ ] **Step 1: Create the loaders**

`lib/notifications/load.ts`:
```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Person } from './resolve'

const PERSON = 'id, email, first_name, last_name, system_role'

/** Klient z service role — tylko na serwerze. Null, gdy brak klucza. */
export function serviceClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } })
}

export async function loadPersonById(db: SupabaseClient, id: string | null): Promise<Person | null> {
  if (!id) return null
  const { data } = await db.from('users').select(PERSON).eq('id', id).maybeSingle()
  return (data as Person | null) ?? null
}

export async function loadPersonByEmail(db: SupabaseClient, email: string): Promise<Person | null> {
  const { data } = await db.from('users').select(PERSON).eq('email', email).maybeSingle()
  return (data as Person | null) ?? null
}

export async function loadBoard(db: SupabaseClient): Promise<Person[]> {
  const { data } = await db.from('users').select(PERSON).in('system_role', ['admin', 'superadmin'])
  return (data as Person[] | null) ?? []
}
```

- [ ] **Step 2: Rewrite the route**

`app/api/notifications/route.ts` (całość):
```ts
import { createClient } from '@supabase/supabase-js'
import { parseEventRequest } from '../../../lib/notifications/events'
import { loadBoard, loadPersonByEmail, loadPersonById, serviceClient } from '../../../lib/notifications/load'
import { dispatch, supabaseStore } from '../../../lib/notifications/dispatch'
import {
  resolveAccountApproved, resolveAccountPending, resolveCaseAssigned, resolveCaseComment, resolveCaseStatusChanged,
  resolveTaskAssigned, resolveTaskReviewed, type CaseRecord, type Resolution, type TaskRecord,
} from '../../../lib/notifications/resolve'

const TASK = 'id, title, owner_id, deadline, status, verification_status, verification_feedback'
const CASE = 'id, case_number, title, owner_id, status'

// POST /api/notifications  { event, id } — treść i odbiorców ustala serwer na podstawie bazy
export async function POST(request: Request) {
  const db = serviceClient()
  if (!db) return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' }, { status: 500 })

  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return new Response('Unauthorized', { status: 401 })
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const { data: { user } } = await anon.auth.getUser(token)
  if (!user?.email) return new Response('Unauthorized', { status: 401 })

  const req = parseEventRequest(await request.json().catch(() => null))
  if (!req) return Response.json({ error: 'Nieprawidłowe zdarzenie' }, { status: 400 })

  const actor = await loadPersonByEmail(db, user.email)
  if (!actor) return Response.json({ error: 'Brak profilu' }, { status: 403 })

  try {
    let resolution: Resolution
    switch (req.event) {
      case 'task_assigned':
      case 'task_reviewed': {
        const { data } = await db.from('tasks').select(TASK).eq('id', req.id).maybeSingle()
        const task = data as TaskRecord | null
        const owner = await loadPersonById(db, task?.owner_id ?? null)
        resolution = req.event === 'task_assigned' ? resolveTaskAssigned(actor, task, owner) : resolveTaskReviewed(actor, task, owner)
        break
      }
      case 'case_assigned':
      case 'case_status_changed':
      case 'case_comment': {
        const { data } = await db.from('cases').select(CASE).eq('id', req.id).maybeSingle()
        const kase = data as CaseRecord | null
        const owner = await loadPersonById(db, kase?.owner_id ?? null)
        if (req.event === 'case_assigned') resolution = resolveCaseAssigned(actor, kase, owner)
        else if (req.event === 'case_status_changed') resolution = resolveCaseStatusChanged(actor, kase, owner)
        else {
          const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
          const { data: comments } = await db.from('case_comments').select('id').eq('case_id', req.id).eq('user_id', actor.id).gte('created_at', since).limit(1)
          resolution = resolveCaseComment(actor, kase, owner, (comments?.length ?? 0) > 0)
        }
        break
      }
      case 'account_pending':
        resolution = resolveAccountPending(actor, req.id, await loadBoard(db))
        break
      case 'account_approved':
        resolution = resolveAccountApproved(actor, await loadPersonById(db, req.id))
        break
      default:
        return Response.json({ error: 'Nieobsługiwane zdarzenie' }, { status: 400 })
    }

    if (!resolution.ok) return Response.json({ error: resolution.reason }, { status: resolution.status })
    const result = await dispatch(supabaseStore(db), resolution.notifications)
    return Response.json({ success: true, ...result })
  } catch (err) {
    console.error('Notification error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Rewrite the browser helper**

`lib/notify.ts` (całość):
```ts
import { supabase } from './supabase'
import type { ClientEvent } from './notifications/events'

/** Zgłasza zdarzenie; serwer sam ustala odbiorców i treść. Błąd nie przerywa akcji użytkownika. */
export async function notify(event: ClientEvent, id: string | null | undefined) {
  if (!id) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ event, id }),
    })
  } catch (err) {
    console.error('Notification failed:', err)
  }
}
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck`
Expected: błędy wyłącznie w miejscach używających `sendNotification` (`app/tasks/page.tsx`, `app/cases/page.tsx`) — poprawiane w Task 5. Nie commituj osobno; Task 4 i Task 5 trafiają do jednego commita.

---

### Task 5: Podpięcie zdarzeń w aplikacji

**Files:**
- Modify: `app/tasks/page.tsx` (ocena ~L55-73, dodanie ~L215-240, edycja `saveTaskEdit` ~L141-156), `app/cases/page.tsx` (status ~L118-140, `reassignCase` ~L144-156, komentarz ~L170-188, dodanie sprawy ~L236-252), `app/users/page.tsx` (`handleSaveUser`), `components/AuthGuard.tsx` (`checkUser`)

**Interfaces:**
- Consumes: `notify(event, id)` (Task 4)

- [ ] **Step 1: Tasks**

W `app/tasks/page.tsx` zamień import `sendNotification` na `import { notify } from '../../lib/notify'` i:

Ocena zadania — zastąp cały blok `sendNotification('task_feedback', {...})` (wraz z warunkiem `if (selectedTask.owner_id)`) wywołaniem:
```ts
      notify('task_reviewed', selectedTask.id)
```

Dodawanie zadania — insert ma zwracać id:
```ts
    const { data: created, error } = await supabase.from('tasks').insert([{
      title: formData.title, description: formData.description, owner_id: formData.owner_id || null,
      project_id: formData.project_id || null, case_id: formData.case_id || null, deadline: formData.deadline || null, priority: formData.priority,
      status: formData.status, checklists: [], attachments: [], completion_percentage: 0,
      is_zarzad: boardMode === 'zarzad',
    }]).select('id').single()
```
i w gałęzi sukcesu zastąp blok „Powiadomienie do assignee” (`if (formData.owner_id) { const assignee = ...; sendNotification(...) }`) linią:
```ts
      if (formData.owner_id) notify('task_assigned', created?.id)
```

Edycja zadania (`saveTaskEdit`) — po `toast.success('Zaktualizowano zadanie', ...)` dodaj:
```ts
      if ((editForm.owner_id || null) !== (selectedTask.owner_id || null) && editForm.owner_id) notify('task_assigned', selectedTask.id)
```

- [ ] **Step 2: Cases**

W `app/cases/page.tsx` zamień import na `import { notify } from '../../lib/notify'` i:
- Zmiana statusu: zastąp warunek z `sendNotification('case_status_changed', ...)` jedną linią `notify('case_status_changed', selectedCase.id)`.
- `reassignCase`: po `toast.success('Sprawa przepisana')` dodaj `if (newOwnerId) notify('case_assigned', selectedCase.id)`.
- Komentarz: zastąp warunek z `sendNotification('case_comment', ...)` linią `notify('case_comment', selectedCase.id)`.
- Dodawanie sprawy: insert zwraca id (`.insert([...]).select('id').single()` → `{ data: created, error }`), a po sukcesie: `if (formData.owner_id && formData.owner_id !== currentUser?.id) notify('case_assigned', created?.id)`.
- Usuń nieużywane już zmienne `owner` z tych bloków.

- [ ] **Step 3: Users (zatwierdzenie konta)**

W `app/users/page.tsx` w `handleSaveUser`, w gałęzi sukcesu, po bloku `logAudit` dodaj:
```ts
      const wasBlocked = selectedUser.system_role === 'pending' || selectedUser.system_role === 'inactive'
      if (wasBlocked && ['member', 'admin', 'superadmin'].includes(editForm.system_role)) notify('account_approved', selectedUser.id)
```
oraz import `import { notify } from '../../lib/notify'`.

- [ ] **Step 4: AuthGuard (nowe konto)**

W `components/AuthGuard.tsx` w `checkUser` pobieraj też id (`.select('id, system_role')`) i w gałęzi oczekującej:
```ts
    if (role === 'pending' || role === 'inactive') {
      setStatus('pending')
      // Zarząd dostaje informację raz na konto (deduplikacja po stronie serwera)
      if (role === 'pending' && userData?.id) notify('account_pending', userData.id)
    } else {
```
oraz import `import { notify } from '../lib/notify'`.

- [ ] **Step 5: Verify and commit (Task 4 + 5)**

Run: `npm run typecheck && npm test && grep -rn "sendNotification" app components lib`
Expected: typecheck i testy PASS; grep bez wyników.

```bash
git add app/api/notifications/route.ts lib/notify.ts lib/notifications/load.ts app/tasks/page.tsx app/cases/page.tsx app/users/page.tsx components/AuthGuard.tsx
git commit -m "Notify through server-resolved events instead of client payloads"
```

---

### Task 6: Nowy wniosek z formularza — powiadomienie z serwera

**Files:**
- Modify: `app/actions/externalCase.ts` (`submitExternalCase`), `lib/request-status.ts`, `app/wniosek/page.tsx` (usunięcie `notifyExternalSubmission`), `lib/email-templates.ts` (usunięcie starych szablonów, jeśli zostały w Task 1)
- Delete: `app/actions/notifyExternalSubmission.ts`, `app/api/notifications/external/route.ts`
- Test: `tests/request-status.test.mjs`

**Interfaces:**
- Consumes: `resolveExternalSubmission` (Task 2), `dispatch`, `supabaseStore` (Task 3), `loadBoard` (Task 4), `sendEmail`, `externalSubmissionConfirmationTemplate` (Task 1)
- Produces: `contactEmailFromDescription(description: string | null): string | null` w `lib/request-status.ts`

- [ ] **Step 1: Write the failing test** (dopisz do `tests/request-status.test.mjs`, rozszerz import o `contactEmailFromDescription`)

```js
test('contact e-mail is read from the description written by the form', () => {
  assert.equal(contactEmailFromDescription('[E-mail: jan@example.org | Tel: 600]\n\nTreść'), 'jan@example.org')
  assert.equal(contactEmailFromDescription('[E-mail: anna@example.org]\n\nTreść'), 'anna@example.org')
  assert.equal(contactEmailFromDescription('Opis bez nagłówka'), null)
  assert.equal(contactEmailFromDescription(null), null)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/request-status.test.mjs`
Expected: FAIL — `contactEmailFromDescription is not a function`.

- [ ] **Step 3: Implement**

`lib/request-status.ts` — dopisz:
```ts
/** E-mail wnioskodawcy z nagłówka opisu zapisywanego przez formularz: "[E-mail: adres | Tel: …]". */
export function contactEmailFromDescription(description: string | null): string | null {
  const match = description?.match(/^\[E-mail: ([^\]\s|]+)/)
  return match ? match[1] : null
}
```

`app/actions/externalCase.ts` — dodaj importy:
```ts
import { contactEmailFromDescription } from '../../lib/request-status'
import { resolveExternalSubmission } from '../../lib/notifications/resolve'
import { dispatch, supabaseStore } from '../../lib/notifications/dispatch'
import { loadBoard } from '../../lib/notifications/load'
import { sendEmail } from '../../lib/email'
import { externalSubmissionConfirmationTemplate } from '../../lib/email-templates'
```
i w `submitExternalCase` zmień `.select('case_number')` na `.select('id, case_number, title, description')`, a po `if (error) return { error: error.message }` przed `return`:
```ts
  // Powiadomienia nie mogą zablokować przyjęcia wniosku
  try {
    await dispatch(supabaseStore(supabase), resolveExternalSubmission(data, await loadBoard(supabase)))
    const contact = contactEmailFromDescription(data.description)
    if (contact) {
      const tpl = externalSubmissionConfirmationTemplate(data.case_number, data.title)
      await sendEmail({ to: contact, subject: tpl.subject, html: tpl.html })
    }
  } catch (err) {
    console.error('External submission notification failed:', err)
  }
```

`app/wniosek/page.tsx` — usuń import `notifyExternalSubmission` i wywołanie `notifyExternalSubmission({...}).catch(...)` w gałęzi sukcesu.

Usuń pliki: `git rm app/actions/notifyExternalSubmission.ts app/api/notifications/external/route.ts`.
W `lib/email-templates.ts` usuń szablony inne niż `externalSubmissionConfirmationTemplate` i `notificationEmailTemplate`. W `.env.local.example` usuń `EXTERNAL_NOTIFICATIONS_SECRET`.

- [ ] **Step 4: Run tests**

Run: `npm test && npm run typecheck && grep -rn "EXTERNAL_NOTIFICATIONS_SECRET\|notifyExternalSubmission" app lib .env.local.example`
Expected: PASS; grep bez wyników.

- [ ] **Step 5: Commit**

```bash
git add -A app/actions app/api/notifications app/wniosek/page.tsx lib/request-status.ts lib/email-templates.ts tests/request-status.test.mjs .env.local.example
git commit -m "Notify the board about new requests directly from the submission"
```

---

### Task 7: Codzienne przypomnienia o terminach (Vercel Cron)

**Files:**
- Modify: `app/api/notifications/deadline-check/route.ts` (całość)
- Create: `vercel.json`

**Interfaces:**
- Consumes: `resolveDeadlines`, `warsawDate`, `addDays` (Task 2), `dispatch`, `supabaseStore` (Task 3), `serviceClient` (Task 4)

- [ ] **Step 1: Rewrite the route**

`app/api/notifications/deadline-check/route.ts` (całość):
```ts
import { serviceClient } from '../../../../lib/notifications/load'
import { dispatch, supabaseStore } from '../../../../lib/notifications/dispatch'
import { addDays, resolveDeadlines, warsawDate, type Person, type TaskRecord } from '../../../../lib/notifications/resolve'

// GET /api/notifications/deadline-check — Vercel Cron (vercel.json), nagłówek Authorization: Bearer $CRON_SECRET
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return Response.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  if (!db) return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' }, { status: 500 })

  try {
    const today = warsawDate(new Date())
    const { data, error } = await db
      .from('tasks')
      .select('id, title, owner_id, deadline, status, verification_status, verification_feedback, owner:users!tasks_owner_id_fkey(id, email, first_name, last_name, system_role)')
      .in('deadline', [addDays(today, 1), addDays(today, -1)])
      .neq('status', 'done')
      .not('owner_id', 'is', null)
    if (error) throw error

    const tasks = (data ?? []) as unknown as Array<TaskRecord & { owner: Person | null }>
    const result = await dispatch(supabaseStore(db), resolveDeadlines(tasks, today))
    return Response.json({ success: true, today, ...result })
  } catch (err) {
    console.error('Deadline check error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

`vercel.json`:
```json
{
  "crons": [
    { "path": "/api/notifications/deadline-check", "schedule": "0 5 * * *" }
  ]
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/api/notifications/deadline-check/route.ts vercel.json
git commit -m "Run deadline reminders daily through Vercel Cron"
```

---

### Task 8: Dzwoneczek, linki do rekordów, wdrożenie i odbiór

**Files:**
- Modify: `components/NotificationBell.tsx`, `app/tasks/page.tsx` (`fetchData`), `app/cases/page.tsx` (`fetchData`), `types/index.ts` (`NotificationType`), `docs/CHANGE_REQUESTS.md`, `docs/VALIDATION.md`

**Interfaces:**
- Consumes: `NotificationType` z `lib/notifications/events.ts` (Task 2), linki `taskLink`/`caseLink` (Task 2)

- [ ] **Step 1: Bell uses the profile id**

W `components/NotificationBell.tsx` w `init` zastąp pobranie `session.user.id` profilem:
```ts
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.email) return
      // Powiadomienia są zapisane pod public.users.id (może różnić się od auth.uid())
      const { data: profile } = await supabase.from('users').select('id').eq('email', session.user.email).maybeSingle()
      if (!profile) return
      const uid = profile.id
      setUserId(uid)
      fetchNotifications(uid)

      channel = supabase
        .channel('notifications-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () => {
          fetchNotifications(uid)
        })
        .subscribe()
```

W `types/index.ts` zastąp lokalną definicję `NotificationType` re-eksportem:
```ts
export type { NotificationType } from '../lib/notifications/events'
```

- [ ] **Step 2: Deep links open the record**

`app/tasks/page.tsx`, na końcu `fetchData` po `setLoading(false)`:
```ts
    // Link z powiadomienia: /tasks?task=<id> otwiera szczegóły zadania
    const wanted = new URLSearchParams(window.location.search).get('task')
    if (wanted && tasksData) {
      const found = tasksData.find((t: Task) => t.id === wanted)
      if (found) { setSelectedTask(found); setFeedbackText(found.verification_feedback || ''); setIsDrawerOpen(true) }
      window.history.replaceState(null, '', '/tasks')
    }
```

`app/cases/page.tsx`, na końcu `fetchData` po `setLoading(false)`:
```ts
    // Link z powiadomienia: /cases?case=<id> otwiera szczegóły sprawy
    const wanted = new URLSearchParams(window.location.search).get('case')
    if (wanted && casesRes.data) {
      const found = (casesRes.data as Case[]).find(c => c.id === wanted)
      if (found) openCaseDetails(found)
      window.history.replaceState(null, '', '/cases')
    }
```

- [ ] **Step 3: Full verification**

Run:
```bash
npm run typecheck && npm test
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=public-anon-key npm run build
```
Expected: PASS; lint zmienionych plików bez nowych błędów względem bazowego commita.

- [ ] **Step 4: Docs and commit**

`docs/CHANGE_REQUESTS.md` — punkt „Powiadomienia” zastąp opisem wdrożenia (zdarzenia, Apps Script, cron, zmienne). `docs/VALIDATION.md` — wynik testów i weryfikacji produkcyjnej.

```bash
git add components/NotificationBell.tsx app/tasks/page.tsx app/cases/page.tsx types/index.ts docs
git commit -m "Open notified records from the bell and document notifications"
git push origin HEAD HEAD:master
```

- [ ] **Step 5: Production acceptance (po wdrożeniu Vercel)**

1. `npm run sb -- db query --linked "select type, count(*) from notifications where created_at > now() - interval '1 hour' group by 1"` — stan wyjściowy.
2. Zalogowany jako administracja@ przez REST: `POST https://admin-os-lake.vercel.app/api/notifications` z `{"event":"task_assigned","id":"<zadanie z właścicielem innym niż admin>"}` → 200, `inserted: 1`; drugie wywołanie → `skipped: 1`.
3. `{"event":"task_reviewed","id":"<zadanie bez oceny>"}` → 403; `{"event":"external_submission","id":"x"}` → 400.
4. Usuń wpisy testowe: `delete from notifications where created_at > '<czas testu>' and link like '/tasks?task=<id>'`.
5. Po ustawieniu przez użytkownika `MAIL_GAS_URL`, `MAIL_GAS_TOKEN`, `CRON_SECRET`: wywołaj deadline-check z nagłówkiem `Authorization: Bearer $CRON_SECRET` → 200 z liczbami; sprawdź skrzynkę.
