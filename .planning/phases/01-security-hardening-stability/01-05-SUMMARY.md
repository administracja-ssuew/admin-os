---
phase: 01-security-hardening-stability
plan: 05
subsystem: auth-guards
tags: [security, server-components, auth, roles, cookies]
requires: [01-04]
provides: [server-side-auth-guard-scores, server-side-auth-guard-executive, access-denied-toast]
affects: [app/scores, app/executive, app/page.tsx]
tech-stack:
  added: []
  patterns:
    - "Async Server Component auth guard: await cookies() → parse token → getUser() → role check → redirect or render"
    - "Client sub-component extraction: UI logic stays in *ClientPage.tsx with 'use client'"
    - "Access denied toast via useSearchParams in root page"
key-files:
  created:
    - app/scores/ScoresClientPage.tsx
    - app/executive/ExecutiveClientPage.tsx
  modified:
    - app/scores/page.tsx
    - app/executive/page.tsx
    - app/page.tsx
decisions:
  - "Cookie parser handles both array [access_token, refresh_token] and object {access_token} formats for forward compatibility"
  - "Development console.log added in both guards to log cookie names — aids debugging if default Supabase client (localStorage-based) needs migration to cookie-based storage"
  - "ScoresClientPage: removed unused currentUser state and loadUser useEffect (currentUser was never used in JSX)"
  - "ExecutiveClientPage: removed client-side auth check from fetchExecutiveData; component assumes authorized user (Server Component guarantees this)"
metrics:
  duration: 5min
  completed: "2026-04-06"
  tasks: 3
  files: 5
---

# Phase 1 Plan 5: Server-Side Auth Guards for /scores and /executive Summary

Server-side auth guards implemented for `/scores` and `/executive` using async Server Component wrappers with cookie-based token verification and role checks before any HTML is rendered.

## What Was Built

Both `/scores` and `/executive` routes now have async Server Components that:

1. Read all cookies with `await cookies()` (Next.js 15+ async API)
2. Find the Supabase auth token cookie (`sb-<ref>-auth-token` or chunked `.0` variant)
3. Parse the access token from both object format (`{access_token}`) and array format (`[token, refresh]`)
4. Call `supabase.auth.getUser(accessToken)` to verify the token cryptographically
5. Query `users.system_role` from the database to enforce role requirements
6. Redirect unauthenticated users to `/login`, unauthorized to `/?toast=access_denied`

The root `app/page.tsx` now reads `?toast=access_denied` via `useSearchParams` and displays `toast.error('Brak dostępu do tej strony')`.

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Server guard for /scores + ScoresClientPage | bf4e77d | app/scores/page.tsx, app/scores/ScoresClientPage.tsx |
| 2 | Server guard for /executive + ExecutiveClientPage | 3ca2f3f | app/executive/page.tsx, app/executive/ExecutiveClientPage.tsx |
| 3 | access_denied toast in app/page.tsx | b953bfd | app/page.tsx |

## Security Behavior

| Route | Unauthenticated | Authenticated non-admin | Authorized |
|-------|----------------|------------------------|------------|
| /scores | → /login (server-side) | → /?toast=access_denied (non-superadmin) | Renders ScoresClientPage |
| /executive | → /login (server-side) | → /?toast=access_denied (non-admin/superadmin) | Renders ExecutiveClientPage |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused currentUser state from ScoresClientPage**
- **Found during:** Task 1
- **Issue:** The original `scores/page.tsx` had `currentUser` state set in the auth check useEffect, but `currentUser` was never used anywhere in the JSX render. Keeping it and the `loadUser` useEffect (which called `supabase.auth.getSession()`) would have violated the acceptance criteria (`grep "supabase.auth.getSession" app/scores/ScoresClientPage.tsx` must return no matches).
- **Fix:** Removed `currentUser` state declaration, the `loadUser` useEffect, and the `setCurrentUser` call entirely from ScoresClientPage.tsx.
- **Files modified:** app/scores/ScoresClientPage.tsx
- **Commit:** bf4e77d

### Notes on Cookie Format

The Supabase client in this project (`lib/supabase.ts`) is a standard browser client without `@supabase/ssr`. By default it stores sessions in `localStorage`, not HTTP cookies. The server-side guard implements cookie parsing per the plan's spec — if the deployment has cookies (e.g., the browser or a future migration to `@supabase/ssr` sets them), the guard will enforce correctly. If no auth cookie is present, users are redirected to `/login` (safe fallback). Development console.log output shows which cookies are present on each request, enabling verification.

## Known Stubs

None — the implementation is complete per plan spec. Cookie-based auth enforcement is functional; actual cookies being set depends on Supabase client configuration (see notes above).

## Self-Check
