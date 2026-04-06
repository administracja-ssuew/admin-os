---
phase: 01-security-hardening-stability
plan: 06
subsystem: database
tags: [postgres, supabase, realtime, toast, race-condition, upsert, sequence, trigger]

# Dependency graph
requires:
  - phase: 01-security-hardening-stability
    provides: Plans 01-05 security and notification infrastructure already in place
provides:
  - Postgres sequence + trigger for atomic server-side case_number generation
  - UNIQUE(case_number) constraint on cases table
  - UNIQUE(department_id) constraint on department_notes table
  - UPSERT for department_notes in my-department page
  - Fixed NotificationBell Realtime channel cleanup (unmount safety)
  - Polish error toasts on all targeted mutation handlers
affects: [02-my-department-refactor, any plan touching cases, notifications, or department_notes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Postgres sequence + BEFORE INSERT trigger pattern for server-side ID generation
    - Supabase UPSERT with onConflict + ignoreDuplicates for idempotent row initialization
    - useEffect channel hoisting pattern for async Realtime cleanup
    - Operation-specific Polish error toast pattern for mutation handlers

key-files:
  created:
    - supabase/migrations/20260404_stab_data_integrity.sql
  modified:
    - app/wniosek/page.tsx
    - app/my-department/page.tsx
    - components/NotificationBell.tsx
    - app/users/page.tsx

key-decisions:
  - "case_number generated via Postgres sequence + BEFORE INSERT trigger — eliminates client-side race condition (D-05)"
  - "Supabase db push not linked — migration file ready but must be applied manually to project"
  - "UPSERT with ignoreDuplicates: true preserves existing workspace note content on page load"
  - "NotificationBell channel hoisted to useEffect outer scope — cleanup returned directly from useEffect (not from inner async init)"

patterns-established:
  - "Mutation error pattern: const { error } = await ...; if (error) { console.error(...); toast.error('Nie udało się ...') }"
  - "useEffect Realtime pattern: let channel = null outside init(); return () => { if (channel) removeChannel(channel) } after init()"

requirements-completed: [STAB-01, STAB-02, STAB-03, STAB-04]

# Metrics
duration: 15min
completed: 2026-04-06
---

# Phase 1 Plan 06: Data Integrity and Stability Fixes Summary

**Postgres sequence + trigger for atomic case_number generation, UPSERT for department_notes, NotificationBell Realtime channel cleanup fix, and Polish error toasts on all targeted mutation handlers**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-06T08:00:00Z
- **Completed:** 2026-04-06T08:15:00Z
- **Tasks:** 5
- **Files modified:** 4 (plus 1 created)

## Accomplishments

- Created migration with Postgres sequence + BEFORE INSERT trigger on cases — case_number is now generated server-side atomically, eliminating the client-side random number race condition
- Added UNIQUE(case_number) on cases and UNIQUE(department_id) on department_notes — both with safe DO/EXCEPTION blocks
- /wniosek now reads case_number from the DB INSERT response (.select('case_number').single()) — Plan 02's notifyExternalSubmission call preserved and updated
- Replaced select-then-insert race condition in my-department with a single UPSERT (onConflict: 'department_id', ignoreDuplicates: true)
- Fixed NotificationBell: channel variable hoisted to useEffect scope so React's cleanup runs removeChannel on unmount
- Added operation-specific Polish error toasts to 5 handlers across users/page.tsx and my-department/page.tsx

## Task Commits

Each task was committed atomically:

1. **Task 1: Data integrity migration (STAB-01, STAB-02)** - `c3bfd04` (feat)
2. **Task 2: Remove client-side case_number in /wniosek (STAB-01)** - `71cdfb9` (feat)
3. **Task 3: department_notes UPSERT in my-department (STAB-02)** - `9c7e7a6` (feat)
4. **Task 4: NotificationBell Realtime cleanup (STAB-03)** - `8060b4b` (fix)
5. **Task 5: Polish error toasts in users and my-department (STAB-04)** - `eeedf82` (fix)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `supabase/migrations/20260404_stab_data_integrity.sql` - Sequence, trigger function, BEFORE INSERT trigger on cases, UNIQUE(case_number) on cases, UNIQUE(department_id) on department_notes
- `app/wniosek/page.tsx` - Removed client-side case_number generation; reads DB-returned value via .select('case_number')
- `app/my-department/page.tsx` - UPSERT for department_notes; Polish error toasts in handleSaveNote, updateDeptTaskStatus, updateTaskAssignee
- `components/NotificationBell.tsx` - Channel hoisted to useEffect scope; cleanup returned from useEffect directly
- `app/users/page.tsx` - Polish error toasts in handleSaveUser ('Nie udało się zaktualizować profilu użytkownika') and handleSuspendUser ('Nie udało się zawiesić konta')

## Decisions Made

- Used `ignoreDuplicates: true` in UPSERT to preserve existing workspace note content on page load — prevents overwriting a saved note when user navigates back to the page
- Migration uses `DO $$ BEGIN ... EXCEPTION WHEN duplicate_table THEN NULL; END $$` blocks to make constraint additions idempotent (safe to re-run)
- `supabase db push` attempted but project not linked — migration is file-ready and must be applied manually

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- `supabase db push` returned "Cannot find project ref. Have you run supabase link?" — project is not linked to Supabase cloud. Migration file was created correctly; it must be applied via `supabase db push` after linking or via the Supabase dashboard SQL editor. Documented in plan summary.

## User Setup Required

The migration file `supabase/migrations/20260404_stab_data_integrity.sql` must be applied to the database before the application changes take effect:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Or apply the SQL manually in the Supabase dashboard SQL editor.

**Note:** The UNIQUE constraints will fail if duplicate case_number values or duplicate department_id values already exist. Verify first:
```sql
SELECT case_number, COUNT(*) FROM cases GROUP BY case_number HAVING COUNT(*) > 1;
SELECT department_id, COUNT(*) FROM department_notes GROUP BY department_id HAVING COUNT(*) > 1;
```

## Next Phase Readiness

- All 10 Phase 1 requirements (SEC-01 through SEC-06, STAB-01 through STAB-04) are now addressed across Plans 01–06
- Phase 1 is complete — ready to proceed to Phase 2 (My-Department Refactor)
- The migration must be applied to the database before deploying the app changes

## Self-Check: PASSED

---
*Phase: 01-security-hardening-stability*
*Completed: 2026-04-06*
