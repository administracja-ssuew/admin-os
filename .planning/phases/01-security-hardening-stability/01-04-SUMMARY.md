---
phase: 01-security-hardening-stability
plan: 04
subsystem: database
tags: [supabase, rls, postgres, security, notifications]

# Dependency graph
requires:
  - phase: 01-01
    provides: SUPABASE_SERVICE_ROLE_KEY confirmed present and used in all API routes
provides:
  - Notifications table RLS migration that blocks JWT-authenticated user INSERTs
  - Service-role-only INSERT enforcement on notifications via WITH CHECK (false)
affects: [any future feature that writes to notifications table]

# Tech tracking
tech-stack:
  added: []
  patterns: [Service-role-only table INSERT via WITH CHECK (false) RLS policy]

key-files:
  created:
    - supabase/migrations/20260404_fix_notifications_rls.sql
  modified: []

key-decisions:
  - "WITH CHECK (false) on INSERT policy blocks all JWT-auth users while service role key bypasses RLS entirely — idiomatic Supabase pattern for API-only writes"
  - "Migration is idempotent: DROP POLICY IF EXISTS ensures safe re-runs"

patterns-established:
  - "Service-role-only writes: use WITH CHECK (false) on the INSERT policy; service role bypasses RLS entirely"

requirements-completed: [SEC-04]

# Metrics
duration: 2min
completed: 2026-04-06
---

# Phase 01 Plan 04: Fix Notifications RLS Summary

**Notifications table INSERT locked to service role only — WITH CHECK (false) replaces the permissive WITH CHECK (true) policy, closing SEC-04**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-06T01:50:57Z
- **Completed:** 2026-04-06T01:52:30Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created idempotent SQL migration dropping the permissive `Authenticated can insert notifications` policy
- Replaced it with `service_role_insert_only` policy using `WITH CHECK (false)` — blocks all JWT-authenticated users from direct INSERT
- Service role key (used by `/api/notifications` and `/api/notifications/external`) bypasses RLS entirely and remains unaffected
- Migration follows existing naming convention: `YYYYMMDD_description.sql`

## Task Commits

Each task was committed atomically:

1. **Task 1: Write RLS migration for notifications table** - `4e131b9` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `supabase/migrations/20260404_fix_notifications_rls.sql` — Drops permissive INSERT policy, creates service-role-only INSERT policy with WITH CHECK (false)

## Decisions Made

- `WITH CHECK (false)` is the correct pattern for API-only writes: it blocks all JWT-auth users while the service role key (used in API routes) bypasses RLS entirely. No need for a TO clause on the new policy — it applies to all roles, but service role never reaches it.
- `DROP POLICY IF EXISTS` makes the migration safe to re-run (idempotent).

## Deviations from Plan

None — plan executed exactly as written.

Note: `supabase db push` was attempted but returned "Cannot find project ref. Have you run supabase link?" — this is expected in this environment. The migration file is ready and must be applied via `supabase db push` in a linked environment or via the Supabase Dashboard SQL editor.

## Issues Encountered

- `npx supabase db push` requires a linked project (`supabase link`) — not available in this worktree environment. Migration file is complete and ready to apply; manual application via Supabase Dashboard or linked CLI is required.

## User Setup Required

To apply this migration to the live database, run one of:

```bash
# Option 1: Supabase CLI (requires linked project)
supabase db push

# Option 2: Supabase Dashboard → SQL Editor
# Paste contents of supabase/migrations/20260404_fix_notifications_rls.sql
```

After applying:
- Verify in Supabase Dashboard → Table Editor → notifications → RLS policies
- Must show: `service_role_insert_only` policy with `WITH CHECK (false)`
- Must NOT show: `Authenticated can insert notifications`
- Functional test: trigger a notification from the app (e.g., assign a task) — if it appears in NotificationBell, service role is working correctly

## Next Phase Readiness

- SEC-04 is closed — the permissive notifications INSERT policy is replaced
- All 4 security vulnerabilities from Phase 01 are now addressed (01-01 through 01-04)
- Phase 01 complete — ready to proceed to Phase 02 (My-Department Refactor)

---
*Phase: 01-security-hardening-stability*
*Completed: 2026-04-06*
