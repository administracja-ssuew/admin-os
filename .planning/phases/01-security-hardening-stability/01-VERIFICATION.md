---
phase: 01-security-hardening-stability
verified: 2026-04-04T00:00:00Z
status: gaps_found
score: 9/11 must-haves verified
gaps:
  - truth: "Visiting /scores as a non-superadmin authenticated user redirects to / with toast 'Brak dostępu do tej strony'"
    status: failed
    reason: "lib/supabase.ts creates a browser client without @supabase/ssr — sessions are stored in localStorage, not HTTP cookies. The Server Component guard in app/scores/page.tsx reads cookies and finds none, so ALL authenticated users (including superadmins) are redirected to /login. The role-based guard (non-superadmin -> /?toast=access_denied) never executes."
    artifacts:
      - path: "app/scores/page.tsx"
        issue: "Cookie lookup always fails because Supabase uses localStorage — the guard degrades to redirect('/login') for everyone"
      - path: "lib/supabase.ts"
        issue: "createClient without cookie adapter — no auth cookies are set by the browser"
    missing:
      - "Either install @supabase/ssr and replace lib/supabase.ts with a cookie-based client, OR use a different auth verification approach (e.g. pass session via props from a layout that has the session)"
      - "Until fixed, /scores is functionally unreachable for ALL users (including superadmins)"
  - truth: "Visiting /executive as a non-admin/superadmin authenticated user redirects to / with toast 'Brak dostępu do tej strony'"
    status: failed
    reason: "Same root cause as /scores: lib/supabase.ts does not set HTTP cookies, so the Server Component cookie lookup always returns null and redirects to /login regardless of role."
    artifacts:
      - path: "app/executive/page.tsx"
        issue: "Cookie lookup always fails — same localStorage-vs-cookie mismatch as /scores"
    missing:
      - "Fix requires cookie-based Supabase session storage (@supabase/ssr or equivalent)"
      - "Until fixed, /executive is functionally unreachable for ALL users"
human_verification:
  - test: "Apply the two DB migrations to the linked Supabase project and verify they execute without errors"
    expected: "supabase db push succeeds; UNIQUE constraints and trigger are visible in Supabase dashboard"
    why_human: "supabase db push requires a linked project — not runnable in this environment"
  - test: "Submit the /wniosek form and confirm case_number is assigned by the DB (not client-generated)"
    expected: "The success view shows a case number like WNI/2026/1000; no Math.random pattern visible"
    why_human: "Requires live Supabase DB with migration applied"
  - test: "Log in as superadmin and navigate to /scores"
    expected: "Page renders (currently expected to redirect to /login due to localStorage issue)"
    why_human: "Behavioral test requires real browser session"
---

# Phase 01: Security Hardening & Stability Verification Report

**Phase Goal:** Fix all known security vulnerabilities and data integrity issues before any new feature ships.
**Verified:** 2026-04-04
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SUPABASE_SERVICE_ROLE_KEY absence causes 500 (not silent fallback) on POST /api/notifications | VERIFIED | `app/api/notifications/route.ts` lines 18-21: `if (!supabaseServiceKey) return Response.json({error: ...}, {status: 500})` |
| 2 | SUPABASE_SERVICE_ROLE_KEY absence causes 500 on GET /api/notifications/deadline-check | VERIFIED | `app/api/notifications/deadline-check/route.ts` lines 9-12: same guard pattern |
| 3 | CRON_SECRET absence causes 500 on GET /api/notifications/deadline-check | VERIFIED | Lines 14-17: `if (!cronSecret) return Response.json({error: 'CRON_SECRET is not configured'}, {status: 500})` |
| 4 | .env.local.example documents SUPABASE_SERVICE_ROLE_KEY and EXTERNAL_NOTIFICATIONS_SECRET and CRON_SECRET | VERIFIED | All three vars present at lines 17, 22, 27 |
| 5 | POST /api/notifications/external accepts external_submission with correct x-external-secret | VERIFIED | `app/api/notifications/external/route.ts` full implementation exists and is wired |
| 6 | /wniosek form calls notifyExternalSubmission Server Action (not direct endpoint call) | VERIFIED | `app/wniosek/page.tsx` line 9 imports, line 148 calls; no `sendNotification` for external_submission |
| 7 | POST /api/notifications returns 401 when Authorization header is absent | VERIFIED | `app/api/notifications/route.ts` lines 25-27: `if (!token) return new Response('Unauthorized', {status: 401})` |
| 8 | POST /api/notifications returns 401 when token is invalid | VERIFIED | Lines 32-34: `if (!user) return new Response('Unauthorized', {status: 401})` |
| 9 | Visiting /scores without a session redirects to /login server-side | VERIFIED (code path exists) | `app/scores/page.tsx` has guard; but see gap — ALL users hit this path due to localStorage |
| 10 | Visiting /scores as non-superadmin redirects to /?toast=access_denied | FAILED | Role check code exists but is unreachable — cookie is never set by lib/supabase.ts (localStorage-only client) |
| 11 | Visiting /executive as non-admin redirects to /?toast=access_denied | FAILED | Same root cause as truth 10 |

**Score:** 9/11 truths verified (2 failed due to same root cause)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/api/notifications/route.ts` | Service key guard + mandatory auth | VERIFIED | Lines 18-34: guards present and ordered correctly before any DB call |
| `app/api/notifications/deadline-check/route.ts` | Service key + CRON_SECRET guards, Authorization header auth | VERIFIED | Lines 9-23: all guards present; uses `authorization` header not query param |
| `.env.local.example` | Documents SUPABASE_SERVICE_ROLE_KEY, EXTERNAL_NOTIFICATIONS_SECRET, CRON_SECRET | VERIFIED | All three present with Polish explanatory comments |
| `app/api/notifications/external/route.ts` | Dedicated external endpoint | VERIFIED | x-external-secret check, type guard for external_submission, service key guard |
| `app/actions/notifyExternalSubmission.ts` | Server Action with 'use server' | VERIFIED | Line 1: `'use server'`; reads EXTERNAL_NOTIFICATIONS_SECRET server-side only |
| `app/wniosek/page.tsx` | Uses notifyExternalSubmission; case_number from DB | VERIFIED | Imports notifyExternalSubmission; no Math.random for real case_number; `.select('case_number')` on INSERT |
| `app/scores/page.tsx` | Server Component (no 'use client') | VERIFIED (code) | No 'use client' directive; `await cookies()` present; role check present |
| `app/scores/ScoresClientPage.tsx` | Client Component with 'use client' | VERIFIED | Line 1: `'use client'`; no auth check useEffect |
| `app/executive/page.tsx` | Server Component with role check for admin+superadmin | VERIFIED (code) | `allowedRoles = ['admin', 'superadmin']`; but functionally broken (see gaps) |
| `app/executive/ExecutiveClientPage.tsx` | Client Component with 'use client' | VERIFIED | Line 1: `'use client'` |
| `app/page.tsx` | Shows access_denied toast on ?toast=access_denied | VERIFIED | Lines 20-24: `useSearchParams` + `toast.error('Brak dostępu do tej strony')` |
| `supabase/migrations/20260404_fix_notifications_rls.sql` | RLS migration with WITH CHECK (false) | VERIFIED (file) | DROP POLICY IF EXISTS + CREATE POLICY with WITH CHECK (false) present |
| `supabase/migrations/20260404_stab_data_integrity.sql` | Sequence, trigger, UNIQUE constraints | VERIFIED (file) | All four elements present: CREATE SEQUENCE, generate_case_number(), TRIGGER, two UNIQUE constraints |
| `components/NotificationBell.tsx` | Channel hoisted, return () => cleanup | VERIFIED | Lines 17-43: `let channel` at useEffect scope; `return () => { if (channel) supabase.removeChannel(channel) }` |
| `app/my-department/page.tsx` | UPSERT for department_notes; Polish error toasts | VERIFIED | Lines 108-116: `.upsert({...}, {onConflict: 'department_id', ignoreDuplicates: true})`; lines 150-165: error toasts |
| `app/users/page.tsx` | Polish error toasts on handleSaveUser and handleSuspendUser | VERIFIED | Lines 68-70: `'Nie udało się zaktualizować profilu użytkownika'`; lines 82-84: `'Nie udało się zawiesić konta'` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/api/notifications/route.ts` | SUPABASE_SERVICE_ROLE_KEY | request-time guard (throw if missing) | VERIFIED | `if (!supabaseServiceKey)` at line 19 |
| `app/api/notifications/deadline-check/route.ts` | CRON_SECRET | Authorization Bearer header check | VERIFIED | `if (!cronSecret)` at line 15; header check at line 21 |
| `app/wniosek/page.tsx` | `app/actions/notifyExternalSubmission.ts` | Server Action call | VERIFIED | Import line 9, call line 148 |
| `app/actions/notifyExternalSubmission.ts` | `app/api/notifications/external/route.ts` | fetch with x-external-secret header | VERIFIED | Line 24: `'x-external-secret': secret` |
| `app/api/notifications/external/route.ts` | EXTERNAL_NOTIFICATIONS_SECRET | header check at request start | VERIFIED | Lines 15-27: secret read and verified before any operation |
| `app/api/notifications/route.ts` | `supabase.auth.getUser(token)` | Bearer token validation before any DB op | VERIFIED | Line 31: `getUser(token)`; both 401 returns before any `from(` call |
| `app/scores/page.tsx` | `supabase.from('users').select('system_role')` | Server Component role check | PARTIAL | Code exists (lines 65-73) but cookie prerequisite fails — lib/supabase.ts uses localStorage |
| `app/executive/page.tsx` | `supabase.from('users').select('system_role')` | Server Component role check | PARTIAL | Same issue — code correct, prerequisite (cookies) never satisfied |
| `components/NotificationBell.tsx` | `supabase.removeChannel(channel)` | cleanup from useEffect | VERIFIED | Lines 40-42: `return () => { if (channel) supabase.removeChannel(channel) }` |
| `app/my-department/page.tsx` | `department_notes` | upsert with onConflict: 'department_id' | VERIFIED | Lines 108-116: correct UPSERT pattern |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `app/wniosek/page.tsx` | `insertedCase.case_number` | DB INSERT with `.select('case_number').single()` (DB trigger sets it) | Yes (pending migration apply) | FLOWING (code correct; needs DB migration applied) |
| `app/my-department/page.tsx` | `workspaceNote` | UPSERT → `.select('content').single()` | Yes | FLOWING |
| `components/NotificationBell.tsx` | `notifications` | `supabase.from('notifications').select('*')` with Realtime subscription | Yes | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — cannot run server or connect to live DB in this environment. Key behaviors verified through static analysis only.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SEC-01 | 01-05 | /scores and /executive protected server-side | PARTIAL | Code implemented correctly; functionally broken because Supabase uses localStorage not cookies — guard always redirects to /login for all users |
| SEC-02 | 01-03 | /api/notifications requires authenticated Bearer token | SATISFIED | Both 401 guards present before any DB call; lib/notify.ts updated to early-return when no session |
| SEC-03 | 01-02 | /wniosek uses /api/notifications/external with own secret | SATISFIED | Server Action pattern implemented; EXTERNAL_NOTIFICATIONS_SECRET never in browser bundle |
| SEC-04 | 01-04 | RLS on notifications table restricts INSERT to service role | SATISFIED (pending DB apply) | Migration file correct with WITH CHECK (false); not yet applied to DB (project not linked) |
| SEC-05 | 01-01 | CRON_SECRET is unconditionally required for deadline-check | SATISFIED | `if (!cronSecret)` guard returns 500; Authorization header used (not query param) |
| SEC-06 | 01-01 | SUPABASE_SERVICE_ROLE_KEY has no anon key fallback | SATISFIED | No `||` fallback anywhere in either notification route |
| STAB-01 | 01-06 | case_number generated server-side with UNIQUE constraint | SATISFIED (pending DB apply) | Migration file has sequence + trigger + UNIQUE; /wniosek reads from INSERT response |
| STAB-02 | 01-06 | department_notes has UNIQUE(department_id), uses UPSERT | SATISFIED (pending DB apply) | Migration file has constraint; my-department uses onConflict: 'department_id' |
| STAB-03 | 01-06 | NotificationBell Realtime channel cleaned up on unmount | SATISFIED | channel hoisted to useEffect scope; cleanup returned from useEffect directly |
| STAB-04 | 01-06 | Mutation errors visible to user (no silent failures) | SATISFIED | Polish-language error toasts in all 5 targeted handlers across users/page.tsx and my-department/page.tsx |

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `lib/supabase.ts` | `createClient` without `@supabase/ssr` cookie adapter — sessions stored in localStorage only | BLOCKER | SEC-01 guard in /scores and /executive always redirects to /login; role-based protection does not function |
| `app/scores/page.tsx` | Development `console.log` left in production code path | INFO | Leaks cookie names to server logs in non-development builds (minor) |
| `app/executive/page.tsx` | Same console.log | INFO | Same as above |
| `supabase/migrations/20260404_fix_notifications_rls.sql` | Migration not applied — `supabase db push` not linked | WARNING | SEC-04 RLS change not live in database until manually applied |
| `supabase/migrations/20260404_stab_data_integrity.sql` | Migration not applied | WARNING | STAB-01 and STAB-02 sequence/trigger/constraints not live; /wniosek will fail on INSERT (case_number not generated by trigger) until applied |

---

## Human Verification Required

### 1. Apply DB Migrations

**Test:** Run `supabase link --project-ref <ref> && supabase db push` or paste both SQL files into Supabase Dashboard SQL Editor
**Expected:** Both migrations succeed; supabase dashboard shows `service_role_insert_only` policy on notifications; `cases_case_number_seq` sequence visible; `cases_case_number_unique` and `department_notes_dept_unique` constraints visible
**Why human:** `supabase db push` requires linked project — not available in this environment

### 2. Test /wniosek form end-to-end

**Test:** Submit the public form at /wniosek with valid data (after applying the migration)
**Expected:** Success view shows a case number in WNI/YYYY/NNNN format generated by the DB trigger; notification email sent to admins; no Math.random pattern in the number
**Why human:** Requires live Supabase DB with migration applied and email service configured

### 3. Verify SEC-01 is actually broken in browser

**Test:** Log in as any user, navigate to /scores in same browser session
**Expected (current state):** Redirected to /login (guard broken — no cookie found)
**Expected (desired state):** Superadmins see the scores UI
**Why human:** Confirms the localStorage-vs-cookie diagnosis before planning the fix

---

## Gaps Summary

Two observable truths from SEC-01 fail due to a shared root cause: `lib/supabase.ts` creates a standard browser Supabase client that stores sessions in localStorage rather than HTTP cookies. The server-side guards in `app/scores/page.tsx` and `app/executive/page.tsx` correctly look for a Supabase auth cookie (`sb-*-auth-token`), but because the client never writes one, `authCookie` is always null and every request — including authenticated superadmins — is redirected to `/login`.

The plan specification acknowledged this limitation in the Plan 05 SUMMARY under "Notes on Cookie Format." The implementation is structurally correct (no `'use client'`, uses `await cookies()`, role check logic is sound), but it is **functionally inert** for the existing Supabase client configuration.

The two DB migrations (SEC-04 for RLS and STAB-01/STAB-02 for data integrity) are complete as files but have not been applied to the live database. These are blocked on environment setup (`supabase link`), not on code correctness. The migration files themselves are correctly written and idempotent.

All other 8 requirements (SEC-02, SEC-03, SEC-05, SEC-06, STAB-03, STAB-04 fully; SEC-04 and STAB-01/STAB-02 pending DB apply) are verified in the codebase.

---

_Verified: 2026-04-04_
_Verifier: Claude (gsd-verifier)_
