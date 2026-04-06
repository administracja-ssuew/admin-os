---
phase: 02-my-department-refactor
plan: "01"
subsystem: database
tags: [supabase, postgres, typescript, migrations, enums]

# Dependency graph
requires: []
provides:
  - dept_type_enum Postgres enum ('logistics' | 'archiving' | 'grants') in departments table
  - DeptType TypeScript union type in types/index.ts
  - Department interface updated with dept_type field
  - EquipmentLoan, Asset, Grant, ArchiveFolder, Petition, EligibilityCriterion, MeetingProtocol interfaces
affects:
  - 02-02 (useLogisticsData hook imports EquipmentLoan, Asset)
  - 02-03 (useArchivingData hook imports ArchiveFolder, Petition)
  - 02-04 (useGrantsData hook imports Grant, EligibilityCriterion)
  - 04 (my-department page.tsx uses department.dept_type instead of deptName.includes())

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "dept_type enum backfill: DO $$ BEGIN / EXCEPTION WHEN duplicate_object THEN NULL idiom for idempotent type creation"
    - "Domain types in types/index.ts — one file, all shared interfaces, no per-feature type files"

key-files:
  created:
    - supabase/migrations/20260404_add_dept_type_enum.sql
  modified:
    - types/index.ts

key-decisions:
  - "dept_type column is nullable — generic departments (no subcommittee) are allowed to have NULL"
  - "Backfill heuristics match page.tsx lines 118-139 exactly — same Polish name fragments preserved"
  - "DeptType placed at top of Phase 2 section so Department interface update references it before downstream types"

patterns-established:
  - "New type blocks in types/index.ts are separated by comment banners (─── SECTION NAME)"

requirements-completed:
  - REF-04
  - REF-05

# Metrics
duration: 2min
completed: 2026-04-06
---

# Phase 2 Plan 01: DB Migration + Domain Types Summary

**dept_type_enum Postgres column on departments with Polish-name backfill, plus 9 new TypeScript interfaces (EquipmentLoan, Grant, ArchiveFolder, Petition, EligibilityCriterion, MeetingProtocol, Asset and supporting union types) exported from types/index.ts**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-06T10:20:23Z
- **Completed:** 2026-04-06T10:22:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created idempotent Supabase migration: CREATE TYPE dept_type_enum, ADD COLUMN dept_type (nullable), three backfill UPDATEs matching existing page.tsx heuristics, and an index
- Extended types/index.ts: updated Department interface with dept_type field; added DeptType, Asset, EquipmentLoan, Grant, ArchiveFolder, Petition, EligibilityCriterion, MeetingProtocol and all supporting union types
- Zero TypeScript errors introduced in types/index.ts (npx tsc --noEmit clean for that file)

## Task Commits

Each task was committed atomically:

1. **Task 1: Migracja SQL — enum dept_type + backfill** - `da69f46` (feat)
2. **Task 2: Rozszerz types/index.ts o interfejsy domenowe** - `b9af373` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `supabase/migrations/20260404_add_dept_type_enum.sql` - Idempotent migration: enum type, column, backfill, index
- `types/index.ts` - Department.dept_type added; DeptType, EquipmentLoan, Grant, ArchiveFolder, Petition, EligibilityCriterion, MeetingProtocol, Asset appended

## Decisions Made

- dept_type is nullable — generic departments that don't belong to any subcommittee should remain NULL
- Backfill uses the same Polish string fragments as page.tsx (dotacj, logistyk, logitech, archiwizacj, bieżąc) to ensure identical routing behavior
- DeptType union defined before the appended domain types so the Department interface update (earlier in the file) can forward-reference it; TypeScript resolves all exports at module level, so order is fine

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `app/meetings/page.tsx`, `app/scores/ScoresClientPage.tsx`, and `app/wniosek/page.tsx` surfaced during verification but are out of scope (not caused by this plan's changes). Logged to deferred-items per deviation scope rules.

## Known Stubs

None — this plan creates migration SQL and type definitions only. No UI rendering paths.

## User Setup Required

The migration file must be applied to the Supabase project before plans 02-02 through 02-04 can query dept_type:

```bash
supabase db push
```

or run `supabase/migrations/20260404_add_dept_type_enum.sql` directly in the Supabase SQL editor.

## Next Phase Readiness

- types/index.ts ready for import in plan 02-02 (useLogisticsData), 02-03 (useArchivingData), 02-04 (useGrantsData)
- Migration ready to push; dept_type column will populate via backfill on first run
- Department interface updated — any component importing Department will now have dept_type typed

---
*Phase: 02-my-department-refactor*
*Completed: 2026-04-06*
