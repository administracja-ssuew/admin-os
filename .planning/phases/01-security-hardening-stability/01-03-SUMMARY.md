---
phase: 01-security-hardening-stability
plan: "03"
subsystem: api-auth
tags:
  - security
  - notifications
  - bearer-auth
  - SEC-02
dependency_graph:
  requires:
    - 01-01
    - 01-02
  provides:
    - authenticated-notifications-endpoint
  affects:
    - app/api/notifications/route.ts
    - lib/notify.ts
tech_stack:
  added: []
  patterns:
    - Unconditional Bearer token guard at route entry point
    - Fail-fast auth before any DB operation
key_files:
  created: []
  modified:
    - app/api/notifications/route.ts
    - lib/notify.ts
decisions:
  - POST /api/notifications now requires a valid Bearer session token — missing or invalid token returns 401 before any DB operation
  - lib/notify.ts updated to early-return when no session token is available, rather than silently omitting the Authorization header
metrics:
  duration: "3min"
  completed_date: "2026-04-06"
  tasks_completed: 1
  files_modified: 2
---

# Phase 01 Plan 03: Mandatory Auth on POST /api/notifications Summary

**One-liner:** Closes SEC-02 — unconditional Bearer token validation added to POST /api/notifications, rejecting unauthenticated requests with 401 before any DB operation.

## What Was Built

POST /api/notifications now enforces Bearer session token authentication at the start of the handler:
1. Missing token → 401 immediately (before any DB call)
2. Invalid/expired token → 401 after `supabaseAnon.auth.getUser(token)` check
3. Valid token → handler proceeds with `callerUserId = user.id` (always a string, no null)

The old conditional `if (token) { ... }` block that only validated when a token happened to be present has been removed. Both 401 guards appear before any `supabase.from(` call.

## Key Changes

### `app/api/notifications/route.ts`
- Removed: `let callerUserId: string | null = null` and `if (token) { ... }` conditional block
- Removed: `void callerUserId` suppression comment
- Added: `if (!token) return new Response('Unauthorized', { status: 401 })`
- Added: `const { data: { user } } = await supabaseAnon.auth.getUser(token)` followed by `if (!user) return new Response('Unauthorized', { status: 401 })`
- `callerUserId` is now `const callerUserId = user.id` (always a string)

### `lib/notify.ts`
- Added early-return guard: when no active session token exists, logs error and returns instead of sending a request without Authorization header (which would now fail with 401)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed lib/notify.ts omitting Authorization header when no session**
- **Found during:** Task 1 (reviewing the caller before implementing the mandatory check)
- **Issue:** `lib/notify.ts` used `...(token ? { Authorization: \`Bearer ${token}\` } : {})` — silently sending requests without auth header when there's no session. After making auth mandatory, this would silently fail with 401 for unauthenticated callers.
- **Fix:** Added `if (!token) { console.error(...); return }` early-return — makes the failure explicit and logs it, consistent with the non-blocking notification pattern already in place.
- **Files modified:** `lib/notify.ts`
- **Commit:** 99845ea (same commit as main task)

## Verification Results

```
grep -n "if (!token)|if (!user)|Unauthorized" route.ts
25: if (!token) {
26:   return new Response('Unauthorized', { status: 401 })
32: if (!user) {
33:   return new Response('Unauthorized', { status: 401 })

grep -n "if (token)" route.ts  → no matches

grep -c "status: 401" route.ts → 2
```

TypeScript: No errors in modified files.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 99845ea | feat(01-03): add mandatory Bearer auth to POST /api/notifications (SEC-02) |

## Known Stubs

None — authentication guard is fully functional.

## Self-Check: PASSED
- `app/api/notifications/route.ts` exists with both 401 guards
- `lib/notify.ts` updated with early-return guard
- Commit `99845ea` verified in git log
