# Phase 1: Security Hardening & Stability — Research

**Researched:** 2026-04-04
**Domain:** Next.js 16 API route hardening, Supabase RLS, server-side auth guards, data integrity
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | `/scores` i `/executive` chronione server-side (nie tylko client-side AuthGuard) | Next.js 16 `proxy.ts` + Server Component async guard pattern confirmed in local docs |
| SEC-02 | `/api/notifications` wymaga uwierzytelnionego Bearer tokenu | Route handler pattern confirmed in existing codebase (cred/route.ts precedent) |
| SEC-03 | Publiczne `/wniosek` korzysta z `/api/notifications/external` z własnym sekretem | Splitting pattern documented; `sendNotification` in `lib/notify.ts` confirmed as call site to update |
| SEC-04 | RLS na `notifications` ogranicza INSERT do service role | SQL pattern confirmed; prerequisite is SEC-06 (service key must exist before tightening) |
| SEC-05 | `CRON_SECRET` wymagany (nie opcjonalny) w `deadline-check` | Code location confirmed: `app/api/notifications/deadline-check/route.ts` lines 14-19 |
| SEC-06 | `SUPABASE_SERVICE_ROLE_KEY` bez fallbacku na klucz anonimowy | Code location confirmed: `app/api/notifications/route.ts` line 13 AND `deadline-check/route.ts` line 7 |
| STAB-01 | `case_number` generowany server-side z unikalnym constraintem | Client-side generation confirmed at `app/wniosek/page.tsx` lines 120-121; migration needed |
| STAB-02 | `department_notes` ma `UNIQUE(department_id)`, zapis używa UPSERT | Race condition confirmed in `app/my-department/page.tsx` lines 108-110; migration needed |
| STAB-03 | Realtime cleanup w `NotificationBell` działa poprawnie przy odmontowaniu | Bug confirmed in `components/NotificationBell.tsx` lines 17-38: async `init()` returns cleanup to itself, not to `useEffect` |
| STAB-04 | Błędy mutacji widoczne dla użytkownika (brak cichych błędów w CRUD) | Silent error pattern confirmed in `app/users/page.tsx` and `app/my-department/page.tsx` |
</phase_requirements>

---

## Summary

This phase closes four confirmed security vulnerabilities and four data-integrity defects in the current codebase. All fixes are surgical — they modify existing files rather than building new infrastructure. No new npm packages are required. The most dangerous risk in this phase is sequencing: specific tasks MUST run in a fixed order because a wrong order produces silent failures with no error visible to the user or in logs.

The single most important prerequisite is confirming that `SUPABASE_SERVICE_ROLE_KEY` is present in the production environment. Local `.env.local` does NOT have this key, which means the production check is unverified. All RLS hardening must be blocked until this is confirmed. The `.env.local.example` also does not document this key, which is itself a bug.

**Primary recommendation:** Execute plans in strict sequential order as documented in the ROADMAP. Do not parallelize tasks within this phase — each plan has a dependency on the one before it.

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **This is NOT standard Next.js.** Next.js 16.2.1 is installed (not 15). Breaking changes apply.
- **Read `node_modules/next/dist/docs/` before writing any code.** Do not rely on training data for Next.js APIs.
- **Middleware is renamed to `proxy.ts`** — the file must be named `proxy.ts`, and the export must be named `proxy` (not `middleware`). Confirmed in local docs at `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
- **`cookies()` is async** in this version — must be `await cookies()`. Confirmed in local docs.
- **`@supabase/auth-helpers-nextjs` is NOT installed** — `package.json` contains only `@supabase/supabase-js` ^2.99.3. The pre-existing research doc referenced `createServerComponentClient` from this package but it is not available. Server-side auth must use `createClient` from `@supabase/supabase-js` with manual cookie handling OR a `proxy.ts` guard.
- **No test framework installed** — `package.json` has no test script; no test files found. Nyquist validation applies but all tests are Wave 0 gaps.

---

## Standard Stack

### Core (all already installed — no new dependencies needed for Phase 1)

| Library | Version | Purpose | Role in Phase 1 |
|---------|---------|---------|-----------------|
| Next.js | 16.2.1 | Framework — App Router, Route Handlers | `proxy.ts` for server guards, Route Handlers for API |
| `@supabase/supabase-js` | ^2.99.3 | Supabase client (only Supabase package installed) | `createClient` with service key in API routes; cookie-based server guard |
| `react-hot-toast` | ^2.6.0 | Toast notifications | Surfacing mutation errors (STAB-04) |
| TypeScript | ^5 | Language | All new files must be `.ts` or `.tsx` |
| Tailwind CSS | ^4 | Styling | No changes needed for this phase |

### Critical Installation Note

`@supabase/auth-helpers-nextjs` (which provides `createServerComponentClient`) is NOT in `package.json`. The pre-existing STACK.md research referenced it incorrectly.

**Two valid approaches for server-side auth guards (SEC-01):**

**Option A — `proxy.ts` guard (recommended for route protection):**
```typescript
// proxy.ts (NOT middleware.ts — renamed in Next.js 16)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function proxy(req: NextRequest) {
  // Only read cookie — no DB queries in proxy (performance rule from Next.js docs)
  const sessionCookie = req.cookies.get('sb-<project-ref>-auth-token')
  // ... validate and redirect
}

export const config = {
  matcher: ['/scores', '/executive'],
}
```

**Option B — Server Component guard (for per-page role checks):**
```typescript
// app/scores/page.tsx — convert to async Server Component for auth check
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function ScoresPage() {
  const cookieStore = await cookies()  // async in Next.js 16
  // Parse Supabase session from cookie manually, then check role
  // Render client component after guard passes
}
```

**Recommendation: Use Option B (Server Component guard) for this phase.** Reason: `proxy.ts` cannot do database lookups (too slow, runs on every route including prefetches) and the role check requires querying the `users` table. Server Component guards are the correct location for role-based access per Next.js 16 docs.

---

## Architecture Patterns

### Pattern 1: Server Component Auth Guard (for SEC-01)

The current auth pattern for `/scores` and `/executive` is client-side only — a `useEffect` checks the session after hydration. This provides no protection at render time.

**Current pattern (insecure):**
```typescript
// app/scores/page.tsx line 78-92 — current code
useEffect(() => {
  const check = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: userData } = await supabase.from('users').select('*').eq('email', session.user.email).single()
    if (!userData || userData.system_role !== 'superadmin') { router.push('/'); return }
    // ...
  }
  check()
}, [])
```

**Target pattern (SEC-01):**
```typescript
// app/scores/page.tsx — convert wrapper to async Server Component
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

export default async function ScoresPage() {
  const cookieStore = await cookies()  // async required in Next.js 16
  // Supabase stores session in cookies; parse access token
  // createClient with anon key + setSession from cookie
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  // ... session verification and role check before rendering
  // If check fails: redirect('/login') or redirect('/')
  return <ScoresClientPage />  // actual UI as 'use client' subcomponent
}
```

**Important:** The existing page components are `'use client'`. The guard wrapper must be a Server Component (no `'use client'` directive). The `'use client'` UI code moves into a new sub-component (e.g., `ScoresClientPage`).

### Pattern 2: Split Notifications Endpoint (SEC-02, SEC-03)

**Current state:** A single `/api/notifications` endpoint handles all types including `external_submission`. The public `/wniosek` form calls it without a session token (no token available — user is not logged in). The `lib/notify.ts` `sendNotification()` function includes the token only `if (token)` — meaning the external submission call sends with no auth header.

**Target state (two-endpoint model):**

```
POST /api/notifications          ← authenticated (Bearer session token required, returns 401 if absent)
POST /api/notifications/external ← secret-key protected (x-external-secret header, handles external_submission only)
```

**New file to create:** `app/api/notifications/external/route.ts`

```typescript
// app/api/notifications/external/route.ts
export async function POST(request: Request) {
  const secret = process.env.EXTERNAL_NOTIFICATIONS_SECRET
  if (!secret) throw new Error('Missing EXTERNAL_NOTIFICATIONS_SECRET')
  if (request.headers.get('x-external-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 })
  }
  // handle external_submission type only — reject all other types
  const { type, payload } = await request.json()
  if (type !== 'external_submission') {
    return Response.json({ error: 'Invalid type for external endpoint' }, { status: 400 })
  }
  // ... same external_submission logic as current notifications/route.ts
}
```

**`lib/wniosek-notify.ts` (or update wniosek/page.tsx directly):** The `/wniosek` page currently calls `sendNotification('external_submission', ...)` from `lib/notify.ts`. After the split, it must call `/api/notifications/external` with the `x-external-secret` header instead. The secret value comes from an env var baked into the build — this is fine since the value is not a user session secret.

**Sequencing rule:** The external endpoint MUST be live and tested before adding auth to the main endpoint. Wrong order = silent loss of all public form notifications.

### Pattern 3: API Route Auth Hardening (SEC-02)

After the external endpoint is live:

```typescript
// app/api/notifications/route.ts — add at start of POST handler
const authHeader = request.headers.get('authorization')
const token = authHeader?.replace('Bearer ', '')
if (!token) {
  return new Response('Unauthorized', { status: 401 })
}
const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const { data: { user } } = await supabase.auth.getUser(token)
if (!user) {
  return new Response('Unauthorized', { status: 401 })
}
```

### Pattern 4: RLS Policy Fix (SEC-04)

**Current migration (permissive):**
```sql
-- supabase/migrations/20260403_create_notifications.sql line 31-33
CREATE POLICY "Authenticated can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);
```

**Target migration (service-role only INSERT):**
```sql
-- supabase/migrations/<date>_fix_notifications_rls.sql
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON notifications;

CREATE POLICY "service_role_insert_only" ON notifications
  FOR INSERT
  WITH CHECK (false);
-- Service role key bypasses RLS entirely — this policy blocks all JWT-authenticated users from inserting
```

**Prerequisite:** `SUPABASE_SERVICE_ROLE_KEY` must be confirmed present in all environments BEFORE this migration is applied. The notifications API route already creates a service-role client for inserts (when the key is available). Tightening RLS while the key is missing causes silent failures.

### Pattern 5: Service Key Hardening (SEC-06)

**Two locations with the dangerous fallback:**

1. `app/api/notifications/route.ts` line 13:
   ```typescript
   // BEFORE (dangerous):
   const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

   // AFTER (fail loudly):
   const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
   if (!supabaseServiceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
   ```

2. `app/api/notifications/deadline-check/route.ts` line 7:
   ```typescript
   // BEFORE (dangerous):
   process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

   // AFTER (fail loudly):
   // Same pattern as above
   ```

### Pattern 6: CRON_SECRET Hardening (SEC-05)

**Current code (`deadline-check/route.ts` lines 14-19):**
```typescript
const cronSecret = process.env.CRON_SECRET
if (cronSecret) {  // BUG: if not set, endpoint is open to everyone
  const { searchParams } = new URL(request.url)
  if (searchParams.get('secret') !== cronSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
```

**Target code:**
```typescript
const cronSecret = process.env.CRON_SECRET
if (!cronSecret) throw new Error('CRON_SECRET is not configured')
// Switch to Authorization header (Bearer) — more standard than query param
const authHeader = request.headers.get('authorization')
if (authHeader !== `Bearer ${cronSecret}`) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}
```

Note: Switching from query param `?secret=` to `Authorization: Bearer` header is more secure (secrets in query strings appear in server logs). The Vercel Cron configuration must be updated to send the header, not the query param.

### Pattern 7: Case Number Server-Side Generation (STAB-01)

**Current client-side generation (`app/wniosek/page.tsx` lines 120-121):**
```typescript
const randomNum = Math.floor(1000 + Math.random() * 9000)
const newCaseNumber = `WNI/${currentYear}/${randomNum}`
// Then: supabase.from('cases').insert([{ ..., case_number: newCaseNumber }])
```

**Target approach:** Move generation to an API route or Supabase database function.

**Option A — API route approach (recommended, no new DB function needed):**
```typescript
// In app/api/notifications/external/route.ts (or a new /api/cases/route.ts):
// Generate case number server-side using sequential counter
const { data: lastCase } = await supabase
  .from('cases')
  .select('case_number')
  .like('case_number', `WNI/${year}/%`)
  .order('created_at', { ascending: false })
  .limit(1)
  .single()

const lastNum = lastCase ? parseInt(lastCase.case_number.split('/')[2]) : 0
const nextNum = String(lastNum + 1).padStart(4, '0')
const caseNumber = `WNI/${year}/${nextNum}`
```

**Option B — Supabase DB function:** Create a `generate_case_number()` function using `SELECT MAX` with `FOR UPDATE` to prevent race conditions. More robust but requires a migration.

**Database constraint (always required regardless of option):**
```sql
-- supabase/migrations/<date>_add_case_number_unique.sql
ALTER TABLE cases ADD CONSTRAINT cases_case_number_unique UNIQUE (case_number);
```

Without the UNIQUE constraint, even a server-side generator can produce duplicates under concurrent load.

### Pattern 8: Department Notes Race Condition Fix (STAB-02)

**Current code (`app/my-department/page.tsx` lines 108-110):**
```typescript
const { data: note } = await supabase.from('department_notes').select('content').eq('department_id', userDept.id).single()
if (note) setWorkspaceNote(note.content)
else await supabase.from('department_notes').insert([{ department_id: userDept.id, content: '' }])
```

**Target code:**
```typescript
// After migration adds UNIQUE(department_id):
const { data: note } = await supabase
  .from('department_notes')
  .upsert({ department_id: userDept.id, content: '' }, { onConflict: 'department_id', ignoreDuplicates: true })
  .select('content')
  .single()
if (note) setWorkspaceNote(note.content)
```

**Migration required:**
```sql
ALTER TABLE department_notes ADD CONSTRAINT department_notes_dept_unique UNIQUE (department_id);
```

### Pattern 9: NotificationBell Realtime Cleanup Fix (STAB-03)

**Current bug (`components/NotificationBell.tsx` lines 17-38):**
```typescript
useEffect(() => {
  const init = async () => {
    // ...
    const channel = supabase.channel(...).subscribe()
    return () => { supabase.removeChannel(channel) }  // BUG: this return is inside init(), not useEffect
  }
  init()  // BUG: init() returns a Promise; the cleanup function is returned from init(), not from useEffect
}, [])
```

The cleanup `() => { supabase.removeChannel(channel) }` is returned from the async `init()` function, not from the `useEffect` callback. React ignores it. The channel is never removed on unmount.

**Target code:**
```typescript
useEffect(() => {
  let channel: ReturnType<typeof supabase.channel> | null = null

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id) return
    setUserId(session.user.id)
    fetchNotifications(session.user.id)

    channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` }, () => {
        fetchNotifications(session.user.id)
      })
      .subscribe()
  }

  init()

  return () => {
    if (channel) supabase.removeChannel(channel)  // cleanup is now correctly returned from useEffect
  }
}, [])
```

### Pattern 10: Surface Mutation Errors (STAB-04)

**Current silent error pattern (example from `app/my-department/page.tsx`):**
```typescript
const { data } = await supabase.from('department_notes').update({ content }).eq(...)
// error is never checked
```

**Target pattern (consistent with existing codebase convention in `components/CONVENTIONS.md`):**
```typescript
const toastId = toast.loading('Zapisywanie...')
const { error } = await supabase.from('department_notes').update({ content }).eq(...)
if (!error) {
  toast.success('Zapisano', { id: toastId })
} else {
  console.error('Save error:', error)  // logs for debugging
  toast.error('Błąd zapisu', { id: toastId })  // visible to user
}
```

The audit scope for STAB-04 targets: `app/my-department/page.tsx` mutation handlers and `app/users/page.tsx` mutation handlers.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Service role Supabase client | Custom auth token handling | `createClient(url, SUPABASE_SERVICE_ROLE_KEY)` — service key bypasses RLS by design | Single line, tested, documented |
| Server-side session validation | Manual JWT parsing | `supabase.auth.getUser(token)` in route handlers | Handles expiry, rotation, signature verification |
| Route-level auth | Custom middleware filter logic | Async Server Component wrapper with `redirect()` | Correct pattern for role checks that need DB queries |
| Case number uniqueness | Application-level retry loop | `UNIQUE` constraint + handle `23505` error | DB constraint is atomic; application retry is not |
| RLS policy for service role | Separate auth layer | `WITH CHECK (false)` on INSERT; service key bypasses RLS entirely | Supabase built-in mechanism |

---

## Common Pitfalls

### Pitfall 1: Tightening RLS Before Confirming Service Key (CRITICAL)
**What goes wrong:** If `SUPABASE_SERVICE_ROLE_KEY` is not set in an environment and RLS is tightened to service-role-only INSERT, notification DB records silently fail to write. Emails still send via Resend (separate code path), so the bug is invisible — users receive emails but nothing appears in the notification bell.
**Why it happens:** The current fallback `|| NEXT_PUBLIC_SUPABASE_ANON_KEY` silently downgrades to anon access, which will be blocked by the new policy.
**How to avoid:** Confirm `SUPABASE_SERVICE_ROLE_KEY` is present in ALL environments (local, staging, production) before running the RLS migration. Remove the fallback first as a standalone task.
**Warning signs:** Notification bell shows 0 items after events that should create notifications. Check Supabase logs for INSERT policy violations.

### Pitfall 2: Adding Auth to Main Endpoint Before External Endpoint is Live (CRITICAL)
**What goes wrong:** `/wniosek` submits without a session token. If the main endpoint returns 401 for missing token first, all public form submissions silently lose their admin notifications and confirmation emails. No error is shown to the submitter.
**Why it happens:** `lib/notify.ts` `sendNotification()` is fire-and-forget — errors are caught and logged but never surfaced to the user.
**How to avoid:** Create, deploy, and test `/api/notifications/external` first. Update `/wniosek` to use the new endpoint. THEN add auth to the main endpoint.
**Warning signs:** Post-hardening, submit a test case via `/wniosek` and verify admins receive in-app notifications and the submitter receives a confirmation email.

### Pitfall 3: Naming the Proxy File `middleware.ts` (CRITICAL)
**What goes wrong:** `middleware.ts` is deprecated in Next.js 16. The file is silently ignored. Auth guards never run. Routes appear protected but are actually open.
**Why it happens:** Training data and most documentation references `middleware.ts` — this is the renamed API.
**How to avoid:** Create `proxy.ts` at the project root. Export `proxy` function (named export) or default export. Confirmed in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.

### Pitfall 4: Using `cookies()` Without `await` (MEDIUM)
**What goes wrong:** `cookies()` is async in Next.js 16. Using it without `await` returns a Promise, not the cookie store. Cookie reads silently return undefined.
**How to avoid:** Always `const cookieStore = await cookies()`. Confirmed in `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`.

### Pitfall 5: NotificationBell Cleanup Returns Inside async init (MEDIUM)
**What goes wrong:** The cleanup function returned from the async `init()` is ignored by React. This is the current bug in STAB-03. Replicating the pattern when fixing it perpetuates the leak.
**How to avoid:** Declare `channel` in the outer `useEffect` scope with `let channel = null`. The cleanup must be returned directly from the `useEffect` callback, not from the inner async function.

### Pitfall 6: CRON_SECRET in Query Param (LOW)
**What goes wrong:** Query parameters appear in server access logs, Vercel function logs, and any proxy logs. A secret in `?secret=...` can leak to log aggregators.
**How to avoid:** Use `Authorization: Bearer <secret>` header for the cron secret. Update the Vercel Cron (or equivalent) job configuration to send the header.

### Pitfall 7: Missing UNIQUE Constraint on case_number (MEDIUM)
**What goes wrong:** Moving case number generation to the server reduces (but does not eliminate) collision risk. Without a UNIQUE constraint, a race condition between two concurrent submissions can still produce duplicate case numbers. The application code will not detect this.
**How to avoid:** The migration adding `UNIQUE(case_number)` is mandatory alongside any server-side generation logic. Handle the `23505` (unique constraint violation) PostgreSQL error code in the API route and generate a new number on conflict.

---

## Runtime State Inventory

> This phase modifies env var requirements and Supabase RLS. Check for runtime state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `notifications` table rows exist (any current data unaffected by RLS change — SELECT/UPDATE policies unchanged) | No migration of data needed |
| Live service config | Vercel Cron job (if configured) passes `?secret=` query param — plan switches to `Authorization` header | Update Vercel Cron config after code deploy |
| OS-registered state | None found | None |
| Secrets/env vars | `SUPABASE_SERVICE_ROLE_KEY` NOT in local `.env.local` (only 5 vars set: REACT_EDITOR, SUPABASE_URL, ANON_KEY, CRED_API_URL, CRED_TOKEN); `CRON_SECRET` NOT in `.env.local`; `RESEND_API_KEY` NOT in `.env.local`; `EXTERNAL_NOTIFICATIONS_SECRET` is new (does not exist anywhere yet) | Verify service key in production before RLS change; add EXTERNAL_NOTIFICATIONS_SECRET to all environments; add CRON_SECRET if missing |
| Build artifacts | None | None |

**Critical finding:** `SUPABASE_SERVICE_ROLE_KEY` is missing from local `.env.local`. It may or may not be present in production (Vercel environment variables). **Plan 1 (verify secrets) must check production environment, not just local.** Without the service key, the notifications route currently uses the anon key as fallback — tightening RLS without confirming the key is present will break notifications in any environment where the key is absent.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All code | Yes | v24.11.0 | — |
| Next.js 16.2.1 | All code | Yes | 16.2.1 | — |
| `@supabase/supabase-js` | All server auth | Yes | ^2.99.3 | — |
| `SUPABASE_SERVICE_ROLE_KEY` | SEC-04, SEC-06 | Unknown (not in local .env) | — | Do not tighten RLS until confirmed |
| `CRON_SECRET` | SEC-05 | Not in local .env | — | Set before deploying hardened endpoint |
| `RESEND_API_KEY` | Notifications (existing) | Not in local .env | — | Email already broken locally; confirm in production |
| `EXTERNAL_NOTIFICATIONS_SECRET` | SEC-03 (new env var) | Does not exist yet | — | Must be created and set in all environments |
| Supabase project (production) | All DB operations | Assumed yes | — | — |

**Missing dependencies with no fallback:**
- `SUPABASE_SERVICE_ROLE_KEY` in production — Plan 1 must verify this before proceeding to Plans 4 and 5
- `EXTERNAL_NOTIFICATIONS_SECRET` — new env var; must be generated and added to all environments before Plan 2 is deployed

**Missing dependencies with fallback (local dev only):**
- `CRON_SECRET` — not in local .env but Plan 5 makes it required; add to local .env before testing
- `RESEND_API_KEY` — not in local .env; emails already do not send locally (not a Phase 1 regression)

---

## Validation Architecture

> `nyquist_validation: true` in `.planning/config.json` — section required.

### Test Framework

No test framework is installed. `package.json` has no test script and no test dependencies.

| Property | Value |
|----------|-------|
| Framework | None installed |
| Config file | None — Wave 0 gap |
| Quick run command | N/A until framework installed |
| Full suite command | N/A until framework installed |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | `/scores` returns 401/redirect without session | manual smoke | — | ❌ Wave 0 |
| SEC-01 | `/executive` returns 401/redirect without session | manual smoke | — | ❌ Wave 0 |
| SEC-02 | `POST /api/notifications` returns 401 without Bearer token | manual smoke (curl) | `curl -X POST http://localhost:3000/api/notifications -H "Content-Type: application/json" -d '{"type":"task_assigned","payload":{}}'` | ❌ Wave 0 |
| SEC-03 | `POST /api/notifications/external` with wrong secret returns 401 | manual smoke (curl) | `curl -X POST http://localhost:3000/api/notifications/external` | ❌ Wave 0 |
| SEC-03 | `/wniosek` form submission still triggers notifications | manual E2E | — | ❌ Wave 0 |
| SEC-04 | Authenticated user cannot INSERT into notifications via anon client | manual (Supabase SQL) | Direct SQL test in Supabase dashboard | ❌ Wave 0 |
| SEC-05 | `GET /api/notifications/deadline-check` without secret returns 401 | manual smoke (curl) | `curl http://localhost:3000/api/notifications/deadline-check` | ❌ Wave 0 |
| SEC-06 | Missing `SUPABASE_SERVICE_ROLE_KEY` causes server startup error, not silent fallback | manual — unset env var and run `next dev` | — | ❌ Wave 0 |
| STAB-01 | Two concurrent `/wniosek` submissions produce unique `case_number` values | manual — not easily automated without framework | — | ❌ Wave 0 |
| STAB-02 | Two concurrent page loads in same department don't produce duplicate `department_notes` rows | manual smoke | — | ❌ Wave 0 |
| STAB-03 | `NotificationBell` unmount removes Supabase Realtime channel | manual (React DevTools / Supabase Realtime dashboard) | — | ❌ Wave 0 |
| STAB-04 | Failed mutation in `my-department` shows toast error, not silent failure | manual — trigger an intentional DB error | — | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Manual curl/browser smoke test of the specific endpoint or UI change
- **Per wave merge:** Full manual walkthrough of all six plans in sequence
- **Phase gate:** All 10 requirements verified before `/gsd:verify-work`

### Wave 0 Gaps

Since no test framework is installed, ALL tests are manual. The phase plan should note this explicitly. If a test framework is desired, the Wave 0 setup would be:

- [ ] Install test framework (Vitest recommended for Next.js 16 compatibility): `npm install -D vitest @vitejs/plugin-react`
- [ ] Create `vitest.config.ts`
- [ ] Create `tests/` directory

However, given the nature of Phase 1 (API route auth, RLS policies, React cleanup bugs), most tests are inherently integration or E2E — a unit test framework alone is insufficient. Manual smoke testing with curl + browser + Supabase SQL editor is the practical approach for this phase.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` + `export default function middleware()` | `proxy.ts` + `export function proxy()` | Next.js 16 | Must use new name — `middleware.ts` is silently deprecated |
| `cookies()` as sync | `cookies()` as async (`await cookies()`) | Next.js 15+ | Any server component reading cookies must use `await` |
| `@supabase/auth-helpers-nextjs` `createServerComponentClient` | `createClient` from `@supabase/supabase-js` + manual cookie handling | auth-helpers-nextjs not installed | Server guards must extract Supabase session from cookies manually |

**Deprecated/outdated:**
- `middleware.ts` file name: renamed to `proxy.ts` in Next.js 16. Confirmed in local docs.
- `createServerComponentClient` from `@supabase/auth-helpers-nextjs`: package not installed; do not add it.
- Sync `cookies()`: now async. Using without `await` returns a Promise, silently breaking cookie reads.

---

## Open Questions

1. **Is `SUPABASE_SERVICE_ROLE_KEY` set in the production (Vercel) environment?**
   - What we know: It is NOT in local `.env.local`. The `.env.local.example` does not even document it.
   - What's unclear: Whether it was set directly in Vercel's environment variables dashboard.
   - Recommendation: Plan 1 must include an explicit verification step — check Vercel dashboard or make a test API call that would fail if the key is missing. Do not proceed to Plans 4 or 5 without confirmation.

2. **What is the exact Supabase cookie name for session storage?**
   - What we know: Supabase stores the session in browser cookies. The `proxy.ts` guard would need to read the cookie by name to avoid DB queries. The cookie name follows the pattern `sb-<project-ref>-auth-token`.
   - What's unclear: The exact project ref for this deployment (not in any committed file).
   - Recommendation: For the Server Component guard pattern (recommended), this is moot — Server Components use `cookies()` to get all cookies and pass them to a new Supabase client. The cookie name matters only if building a proxy.ts guard.

3. **Is Vercel Cron configured for `deadline-check`?**
   - What we know: The endpoint exists. Comments say "Vercel Cron". No `vercel.json` with cron config was found in the repo.
   - What's unclear: Whether a cron job is configured in Vercel's dashboard.
   - Recommendation: Plan 5 (CRON_SECRET hardening) should note that if no cron is configured, the endpoint is currently unused. Making it require auth (correct) is safe regardless. The `CRON_SECRET` should still be set.

4. **How does Supabase session work in Server Components without `auth-helpers-nextjs`?**
   - What we know: `@supabase/auth-helpers-nextjs` provides `createServerComponentClient({ cookies })` as a convenience. It is not installed.
   - What's unclear: The exact cookie-reading pattern using only `@supabase/supabase-js`.
   - Recommendation: The standard `@supabase/supabase-js` `createClient` accepts a `cookies` option in its auth config. Alternatively, the planner should look at the Supabase documentation for the exact pattern with the installed package version (2.99.3). The Server Component guard for SEC-01 needs this pattern verified before coding.

---

## Code Examples

### Verified: Current Vulnerable Code Locations

**SEC-06 — Dangerous fallback (2 locations):**
```typescript
// app/api/notifications/route.ts line 13
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// app/api/notifications/deadline-check/route.ts line 7
process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
```

**SEC-05 — Optional cron secret (deadline-check/route.ts lines 14-19):**
```typescript
const cronSecret = process.env.CRON_SECRET
if (cronSecret) {  // if not set, no auth check runs at all
  if (searchParams.get('secret') !== cronSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
```

**SEC-02 — Unauthenticated POST accepted (notifications/route.ts lines 26-37):**
```typescript
const token = authHeader?.replace('Bearer ', '')
const supabase = getSupabase(token)  // uses service key when no token
let callerUserId: string | null = null
if (token) {
  // verify only if token present — but execution continues without token
  const { data: { user } } = await supabase.auth.getUser(token)
  callerUserId = user?.id ?? null
}
// No 401 return — continues to switch(type)
```

**STAB-03 — Unreachable cleanup (NotificationBell.tsx lines 17-38):**
```typescript
useEffect(() => {
  const init = async () => {
    // ...
    const channel = supabase.channel(...).subscribe()
    return () => { supabase.removeChannel(channel) }  // returned from init(), not useEffect
  }
  init()  // cleanup from init() is a Promise's resolved value — React never sees it
}, [])
```

**STAB-01 — Client-side case number generation (wniosek/page.tsx lines 119-121):**
```typescript
const currentYear = new Date().getFullYear()
const randomNum = Math.floor(1000 + Math.random() * 9000)
const newCaseNumber = `WNI/${currentYear}/${randomNum}`
// No uniqueness check, no server validation
```

---

## Sources

### Primary (HIGH confidence — verified by reading actual source files)

- `app/api/notifications/route.ts` — SEC-02, SEC-06: verified the dangerous fallback and missing 401 return
- `app/api/notifications/deadline-check/route.ts` — SEC-05, SEC-06: verified the optional guard and fallback
- `app/scores/page.tsx` — SEC-01: verified client-side only auth check in useEffect
- `app/executive/page.tsx` — SEC-01: verified client-side only auth check in fetchExecutiveData
- `components/NotificationBell.tsx` — STAB-03: confirmed async init cleanup bug
- `app/wniosek/page.tsx` — STAB-01: confirmed client-side case number generation
- `supabase/migrations/20260403_create_notifications.sql` — SEC-04: confirmed permissive INSERT policy
- `package.json` — confirmed Next.js 16.2.1, confirmed `@supabase/auth-helpers-nextjs` NOT installed
- `.env.local` — confirmed `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY` not in local env
- `lib/notify.ts` — confirmed `sendNotification` call path for SEC-03 analysis

### Secondary (HIGH confidence — verified from local Next.js docs)

- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` — confirmed `middleware.ts` is deprecated, renamed to `proxy.ts`; confirmed export name is `proxy`
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md` — confirmed Server Component guard pattern; confirmed Proxy should not do DB queries
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` — confirmed `cookies()` is async in Next.js 16

### Tertiary (MEDIUM confidence — pre-existing project research)

- `.planning/research/STACK.md` — security fix patterns (verified against source code; note: `createServerComponentClient` reference is incorrect since package not installed)
- `.planning/research/PITFALLS.md` — pitfall analysis (all 5 critical pitfalls for Phase 1 are source-code-verified)
- `.planning/codebase/CONCERNS.md` — all HIGH security concerns verified against actual source files
- `.planning/codebase/CONVENTIONS.md` — toast error pattern, mutation handler conventions

---

## Metadata

**Confidence breakdown:**
- Current vulnerabilities: HIGH — all read from actual source code
- Fix patterns: HIGH for API route patterns; MEDIUM for Server Component guard (auth-helpers not installed adds uncertainty)
- Next.js 16 API changes: HIGH — verified from local docs
- Production environment state: LOW — `SUPABASE_SERVICE_ROLE_KEY` presence in production is unconfirmed

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable stack, no moving parts — Next.js 16 and Supabase APIs stable)
