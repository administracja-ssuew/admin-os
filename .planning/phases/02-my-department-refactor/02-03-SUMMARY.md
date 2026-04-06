---
phase: 02-my-department-refactor
plan: "03"
subsystem: my-department
tags: [react, components, refactor, supabase, typescript]
dependency_graph:
  requires:
    - 02-02 (hooks: useLogisticsData, useArchivingData, useGrantsData)
    - types/index.ts (Asset, EquipmentLoan, Grant, ArchiveFolder, Petition, AppUser)
  provides:
    - components/subcommittees/LogisticsPanel.tsx → LogisticsPanel
    - components/subcommittees/ArchivingPanel.tsx → ArchivingPanel
    - components/subcommittees/GrantsPanel.tsx → GrantsPanel
  affects:
    - app/my-department/page.tsx (plan 04 will import these panels)
tech_stack:
  added: []
  patterns:
    - "'use client' panels that accept all data via props"
    - "onRefetch callback instead of fetchDepartmentData"
    - "supabase mutations only (insert/update/delete) — no selects in panels"
    - "logAudit for delete operations (deleteAsset, deleteLoan, deleteGrant)"
key_files:
  created:
    - components/subcommittees/LogisticsPanel.tsx
    - components/subcommittees/ArchivingPanel.tsx
    - components/subcommittees/GrantsPanel.tsx
  modified: []
decisions:
  - "LogisticsReport interface kept local to LogisticsPanel (not exported to types/index.ts) — plan 02 hook uses local copy; unification deferred to plan 04 if needed"
  - "ArchivingPanel: deleteArchiveFolder/deletePetition call onRefetch directly without ConfirmDialog — mirrors original page.tsx behavior using browser confirm(); no regression"
  - "Petition status values aligned with types/index.ts PetitionStatus: 'Złożone' | 'Rozpatrzone' | 'Odrzucone' (original page.tsx had 'Zaakceptowane' — corrected to match type)"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-04"
  tasks_completed: 2
  files_created: 3
---

# Phase 02 Plan 03: Subcommittee Panel Components Summary

Three isolated UI panel components extracted from the 1320-line `app/my-department/page.tsx` into `components/subcommittees/`.

## What Was Built

**LogisticsPanel** (`components/subcommittees/LogisticsPanel.tsx`, ~370 lines):
- Asset cards with status selector and admin delete
- Equipment loans table with status toggle (Wypożyczone/Zwrócone)
- Timeline bar chart (loans per month)
- Logistics reports list with status management
- Three modals: add asset, add loan, submit report
- ConfirmDialog for asset/loan deletion with logAudit

**ArchivingPanel** (`components/subcommittees/ArchivingPanel.tsx`, ~420 lines):
- "Systemy i Operacje" quick-links panel (Generator Protokołów, CRA)
- Petition register table with click-to-open drawer
- Archive folders grid with status selector
- Side drawers for folder and petition detail + file management
- File upload with full odpolszczacz (Polish→ASCII normalizer) → Supabase storage `adminos-files`
- Two modals: new folder, new petition

**GrantsPanel** (`components/subcommittees/GrantsPanel.tsx`, ~580 lines):
- Statistics row: total count, accepted count, total amount
- Grants radar table with search + status/type filters
- Grants drawer with status/decision inline selectors + full detail view
- New grant/patronat modal (all fields including owner select)
- ConfirmDialog for deletion with logAudit

## Architecture

All three panels follow the same contract:
- `'use client'` directive
- Props: `data arrays` + `members` + `currentUser: AppUser | null` + `isAdmin: boolean` + `onRefetch: () => Promise<void>`
- No `supabase.from(...).select()` inside panels — pure UI + mutations
- Mutations end with `await onRefetch()` instead of `fetchDepartmentData()`
- Zero `any` in props interfaces — all typed from `types/index.ts`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Petition status values corrected**
- **Found during:** Task 1, ArchivingPanel implementation
- **Issue:** Original `page.tsx` used `'Zaakceptowane'` in the petition drawer select, but `types/index.ts` defines `PetitionStatus = 'Złożone' | 'Rozpatrzone' | 'Odrzucone'`
- **Fix:** Updated ArchivingPanel petition drawer select to use `'Rozpatrzone'` (matching the type definition)
- **Files modified:** `components/subcommittees/ArchivingPanel.tsx`
- **Commit:** c2ae05a (included in task 1 commit)

## Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| Task 1 | LogisticsPanel + ArchivingPanel | `0d091d8` | 2 files, 1364 lines |
| Task 2 | GrantsPanel | `c2ae05a` | 1 file, 578 lines |

## Known Stubs

None — all panels render real data passed via props. Mutations write to live Supabase tables.

## Self-Check: PASSED
