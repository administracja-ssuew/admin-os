---
phase: 01-security-hardening-stability
plan: 01
subsystem: api
tags: [supabase, security, environment, cron, notifications]

# Dependency graph
requires: []
provides:
  - Hardened POST /api/notifications — fails loudly (500) when SUPABASE_SERVICE_ROLE_KEY is absent
  - Hardened GET /api/notifications/deadline-check — fails loudly (500) when either key is absent; CRON_SECRET unconditionally required
  - Authorization header-based cron auth (replaces insecure query param pattern)
  - .env.local.example documents all required server-side secrets
affects:
  - 01-02 (RLS hardening — depends on service key being correctly enforced)
  - 01-03 (notifications auth — builds on this hardened base)
  - 01-04 (RLS INSERT policy — depends on route hardening)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-at-request-time pattern: read env vars inside handlers, not at module scope (D-04)"
    - "Authorization: Bearer header for cron secrets (not query params — avoids server log exposure)"
    - "Split supabase clients: supabaseService for DB writes, supabaseAnon for user token verification"

key-files:
  created:
    - .env.local.example
  modified:
    - app/api/notifications/route.ts
    - app/api/notifications/deadline-check/route.ts

key-decisions:
  - "Env var guards placed inside handlers (not module scope) so app can still start without the key — fail at request time per D-04"
  - "CRON_SECRET now unconditionally required — the optional if (cronSecret) pattern was a security hole (silent pass-through)"
  - "Switched cron auth from ?secret= query param to Authorization: Bearer header — query params appear in server access logs (SEC-05)"
  - "Service role and anon clients split explicitly — supabaseService for DB writes, supabaseAnon only for user token verification"

patterns-established:
  - "Pattern: API route env var guards — read inside handler, return 500 JSON with descriptive error if absent"
  - "Pattern: Cron endpoint auth — Authorization: Bearer $SECRET header, not query param"

requirements-completed: [SEC-06, SEC-05]

# Metrics
duration: 7min
completed: 2026-04-06
---

# Phase 01 Plan 01: Security Hardening — Remove Service Key Fallbacks Summary

**Removed dangerous `|| NEXT_PUBLIC_SUPABASE_ANON_KEY` fallbacks from both notification API routes and made `CRON_SECRET` unconditionally required, ensuring both routes fail loudly (500) at request time when production secrets are absent.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-06T01:31:31Z
- **Completed:** 2026-04-06T01:38:37Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Removed the `SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY` silent fallback from both notification routes — the app was silently using the public anon key when the service role key was missing
- Made `CRON_SECRET` unconditionally required in deadline-check route — the old `if (cronSecret)` guard allowed anyone to call the endpoint if the env var was not set
- Switched cron auth from `?secret=` query param to `Authorization: Bearer` header — query params appear in server access logs, exposing the secret (SEC-05)
- Documented all three required server-side secrets (`SUPABASE_SERVICE_ROLE_KEY`, `EXTERNAL_NOTIFICATIONS_SECRET`, `CRON_SECRET`) in `.env.local.example`

## Task Commits

1. **Task 1: Harden notifications/route.ts** - `a73892e` (fix)
2. **Task 2: Harden deadline-check/route.ts** - `7cb11b9` (fix)
3. **Task 3: Document env vars in .env.local.example** - `0ea5e03` (chore)

## Files Created/Modified

- `app/api/notifications/route.ts` — Removed module-level service key fallback; added per-request guard; split into `supabaseService` (DB writes) and `supabaseAnon` (token verification) clients; removed `getSupabase()` helper
- `app/api/notifications/deadline-check/route.ts` — Removed module-level supabase client; added mandatory `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` guards; switched from `?secret=` query param to `Authorization: Bearer` header
- `.env.local.example` — Created with all required env vars documented with Polish comments

## Decisions Made

- **Fail at request time (not module load):** Env var guards placed inside handlers so the Next.js app can still start and serve other routes when the key is absent. Only the affected endpoints return 500.
- **CRON_SECRET unconditional:** The old `if (cronSecret)` pattern was a security hole — if the env var was not set, the cron endpoint was open to everyone. Now absence returns 500 immediately.
- **Authorization header for cron:** Secrets in query params appear in server access logs (Vercel, nginx, etc.). `Authorization: Bearer` header avoids this. Vercel Cron supports custom headers.
- **Split supabase clients in notifications/route.ts:** `supabaseService` (service role) for all DB operations, `supabaseAnon` only for user token verification via `auth.getUser()`.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all changes are functional with no placeholder data.

## Self-Check: PASSED

- FOUND: `app/api/notifications/route.ts`
- FOUND: `app/api/notifications/deadline-check/route.ts`
- FOUND: `.env.local.example`
- FOUND: `.planning/phases/01-security-hardening-stability/01-01-SUMMARY.md`
- FOUND commit: `a73892e` (fix notifications/route.ts)
- FOUND commit: `7cb11b9` (fix deadline-check/route.ts)
- FOUND commit: `0ea5e03` (chore .env.local.example)
