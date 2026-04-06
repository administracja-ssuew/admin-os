---
phase: 02-my-department-refactor
plan: "02"
subsystem: ui
tags: [react, hooks, supabase, typescript, next.js]

# Dependency graph
requires:
  - phase: 02-01
    provides: "DeptType enum and domain types (Asset, EquipmentLoan, Grant, ArchiveFolder, Petition) in types/index.ts"
provides:
  - "useLogisticsData(departmentId) — fetches assets, equipment_loans, reports, members for logistics subcommittee"
  - "useArchivingData(departmentId) — fetches archive_folders, petitions, members for archiving subcommittee"
  - "useGrantsData(departmentId) — fetches grants_radar, members for grants subcommittee"
affects:
  - 02-03-panels
  - app/my-department/page.tsx

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Data hook with departmentId guard: early return + setLoading(false) when undefined"
    - "Promise.all for parallel Supabase queries inside useCallback"
    - "useCallback + useEffect([fetchCallback]) for stable refetch reference"

key-files:
  created:
    - hooks/useLogisticsData.ts
    - hooks/useArchivingData.ts
    - hooks/useGrantsData.ts
  modified: []

key-decisions:
  - "grants_radar queries are not filtered by department_id — table is global and serves entire grants subcommittee"
  - "Promise.all used for parallel queries (per REF-01 decision from CONTEXT.md)"
  - "DeptMember interface defined locally in each hook (not exported from types/index.ts) to keep hooks self-contained"

patterns-established:
  - "Data hook pattern: useCallback(fetchData) + useEffect([fetchData]) + early return on missing departmentId"
  - "All hook result interfaces exported for use by panel components in plan 02-03"

requirements-completed: [REF-01]

# Metrics
duration: 8min
completed: 2026-04-06
---

# Phase 2 Plan 02: Data Hooks Extraction Summary

**Three typed Supabase data hooks extracted from page.tsx: useLogisticsData, useArchivingData, useGrantsData — each with departmentId guard, Promise.all parallelism, and stable refetch via useCallback**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-06T10:24:36Z
- **Completed:** 2026-04-06T10:32:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created `useLogisticsData(departmentId)` fetching assets, equipment_loans, logistics reports, and dept members in parallel
- Created `useArchivingData(departmentId)` fetching archive_folders, petitions, and dept members in parallel
- Created `useGrantsData(departmentId)` fetching grants_radar (global, not dept-filtered) and dept members in parallel
- All hooks follow established pattern from useTasks.ts: useCallback + useEffect + typed result interface

## Task Commits

Each task was committed atomically:

1. **Task 1: Utwórz useLogisticsData i useArchivingData** - `5ab1997` (feat)
2. **Task 2: Utwórz useGrantsData** - `b01b4b4` (feat)

**Plan metadata:** `[docs commit hash]` (docs: complete plan)

## Files Created/Modified
- `hooks/useLogisticsData.ts` - Supabase data hook for logistics subcommittee (assets, equipment_loans, reports, members) — 72 lines
- `hooks/useArchivingData.ts` - Supabase data hook for archiving subcommittee (archive_folders, petitions, members) — 53 lines
- `hooks/useGrantsData.ts` - Supabase data hook for grants subcommittee (grants_radar global, members) — 53 lines

## Decisions Made
- grants_radar is not filtered by department_id — this matches existing page.tsx behavior; the table is intended for the entire grants subcommittee globally
- DeptMember interface kept local to each hook file (not exported from types/index.ts) as it is a simple projection not needing a canonical location yet
- Promise.all used for all independent queries as per REF-01 decision captured in CONTEXT.md

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Pre-existing TypeScript errors in unrelated files (meetings/page.tsx, scores/ScoresClientPage.tsx, wniosek/page.tsx) were out of scope and left untouched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 3 data hooks are ready to be consumed by panel components in plan 02-03
- Each hook exports its result interface for typed props passing
- page.tsx still contains the original direct supabase calls — those will be replaced in plan 02-04 or 02-05 when page.tsx is refactored to use these hooks

---
*Phase: 02-my-department-refactor*
*Completed: 2026-04-06*
