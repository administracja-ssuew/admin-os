---
phase: 03-logistics-module
plan: 02
subsystem: database, api
tags: [typescript, supabase, hooks, logistics, types]

# Dependency graph
requires:
  - phase: 03-01
    provides: DB schema with quantity/min_quantity/unit columns in assets and borrower_phone/borrower_org/loan_source in equipment_loans

provides:
  - TypeScript interfaces reflecting updated DB schema (Asset, EquipmentLoan)
  - lowStockAssets computed in hook (no DB trigger)
  - Type-safe explicit column selects for assets query

affects: [03-03, LogisticsPanel, any component using useLogisticsData]

# Tech tracking
tech-stack:
  added: []
  patterns: [Application-side low_stock logic (D-05) — filter in hook rather than DB trigger]

key-files:
  created: []
  modified:
    - types/index.ts
    - hooks/useLogisticsData.ts

key-decisions:
  - "lowStockAssets computed from assets state in hook body (quantity < min_quantity && min_quantity > 0) — no DB trigger per D-05"
  - "Explicit column list in assets select — TypeScript sees new fields quantity/min_quantity/unit"
  - "No deposit_* fields added to EquipmentLoan per D-01"
  - "min_quantity > 0 guard prevents false alerts when min_quantity not yet set"

patterns-established:
  - "Application-side derivation: lowStockAssets = assets.filter(...) computed at every render from state"

requirements-completed: [LOG-01, LOG-03, LOG-04]

# Metrics
duration: 10min
completed: 2026-04-06
---

# Phase 03 Plan 02: TypeScript Interfaces and Hook Low-Stock Logic

**Asset and EquipmentLoan interfaces extended with new fields; lowStockAssets computed client-side in useLogisticsData hook without DB trigger.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-06T11:00:00Z
- **Completed:** 2026-04-06T11:08:38Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Extended `Asset` interface: added `quantity: number`, `min_quantity: number`, `unit: 'szt' | 'ryza' | 'opak' | 'komplet'`
- Extended `EquipmentLoan` interface: added `borrower_phone`, `borrower_org`, `loan_source` (all `string | null`); no deposit_* fields
- Updated `useLogisticsData` hook: explicit column select, `lowStockAssets` exported in result interface, computed in hook body

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend Asset and EquipmentLoan interfaces** - `c19cc91` (feat)
2. **Task 2: Add lowStockAssets to useLogisticsData hook** - `83841a6` (feat)

## Files Created/Modified

- `/c/Users/Mikołaj/Downloads/admin-os/admin-os/types/index.ts` - Added quantity/min_quantity/unit to Asset; added borrower_phone/borrower_org/loan_source to EquipmentLoan
- `/c/Users/Mikołaj/Downloads/admin-os/admin-os/hooks/useLogisticsData.ts` - Explicit column select; UseLogisticsDataResult extended with lowStockAssets; computed filter logic

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all fields are wired to real DB columns defined in the 03-01 migration.

## Verification

```
grep -n "lowStockAssets" hooks/useLogisticsData.ts
# 29: lowStockAssets: Asset[]   // per D-05: obliczane w hooku
# 73: const lowStockAssets = assets.filter(a => a.quantity < a.min_quantity && a.min_quantity > 0)
# 75: return { assets, loans, reports, members, lowStockAssets, loading, refetch: fetchData }

grep "deposit" types/index.ts
# (no output — deposit fields absent from EquipmentLoan)

grep -A5 "interface EquipmentLoan" types/index.ts
# borrower_phone: string | null
# borrower_org: string | null
# loan_source: string | null
```

TypeScript: zero errors in logistics files (pre-existing errors in unrelated files: app/meetings/page.tsx, app/scores/, app/wniosek/).
