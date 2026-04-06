---
phase: 03-logistics-module
plan: "03"
subsystem: logistics-ui
tags: [logistics, ui, forms, audit, overdue, inventory]
dependency_graph:
  requires: [03-02]
  provides: [logistics-ui-complete]
  affects: [components/subcommittees/LogisticsPanel.tsx, components/subcommittees/AssetInventory.tsx]
tech_stack:
  added: []
  patterns: [logAudit-on-status-change, overdue-detection-client-side, read-only-sub-component]
key_files:
  created:
    - components/subcommittees/AssetInventory.tsx
  modified:
    - components/subcommittees/LogisticsPanel.tsx
decisions:
  - "lowStockAssets prop added to LogisticsPanelProps — caller spreads hook result which already includes it"
  - "AssetInventory is read-only — no Supabase mutations inside the component"
  - "isOverdue() computed on render — no extra state needed"
metrics:
  duration: "~20 min"
  completed: "2026-04-06"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 2
---

# Phase 03 Plan 03: Logistics UI Extensions Summary

Formularz umów użyczenia rozszerzony o pola borrower_phone, borrower_org, loan_source (bez kaucji). Czerwony badge "Przeterminowane" dla wypożyczeń z datą zwrotu w przeszłości. Nowy komponent AssetInventory z tabelą quantity/unit i badge "Niski stan". logAudit() wywołany przy zmianie statusu wypożyczenia z oldValue/newValue.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Extend LogisticsPanel: loan form fields, overdue badge, audit | 1f77c21 | components/subcommittees/LogisticsPanel.tsx |
| 2 | Create AssetInventory component | 7e2921e | components/subcommittees/AssetInventory.tsx |

## Task 3 — Checkpoint (Awaiting Human Verification)

Task 3 is a `checkpoint:human-verify`. Auto mode is not active. Execution paused for human verification of the running app.

## Changes Made

### LogisticsPanel.tsx

**Props interface:**
- Added `lowStockAssets: Asset[]` to `LogisticsPanelProps`
- Added `lowStockAssets` to destructured component params

**loanForm state:**
- Added `borrower_phone: ''`, `borrower_org: ''`, `loan_source: ''` to initial state
- Same fields added to reset in `handleAddLoan`

**toggleLoanStatus:**
- Wrapped update in `{ error }` destructuring
- Added `toast.loading()` / `toast.success()` / `toast.error()` feedback
- Added `logAudit()` call with `oldValue: { status: currentStatus }` and `newValue: { status: newStatus }` on success

**Overdue detection:**
```typescript
const today = new Date().toISOString().split('T')[0]
const isOverdue = (loan: EquipmentLoan) =>
  loan.status === 'Wypożyczone' && loan.return_date !== null && loan.return_date < today
```
- Row gets `bg-red-50 dark:bg-red-900/10` when overdue
- Badge "Przeterminowane" rendered next to borrower_name

**Modal form fields (after borrower_name):**
- `<input type="tel">` for Telefon pożyczkobiorcy → borrower_phone
- `<input type="text">` for Organizacja → borrower_org
- `<select>` for Źródło wypożyczenia (wewnętrzne/zewnętrzne) → loan_source

**AssetInventory render:**
```tsx
<AssetInventory assets={assets} lowStockAssets={lowStockAssets} />
```
Placed before the Reports section.

### AssetInventory.tsx (new)

Read-only component. Props: `{ assets: Asset[], lowStockAssets: Asset[] }`.

Filters to `officeAssets` = assets with `asset_type === 'Artykuły biurowe'` OR `min_quantity > 0`.

Table columns: Nazwa | Ilość | Jed. | Status

Status badge logic:
- `quantity < min_quantity && min_quantity > 0` → amber "Niski stan"
- Otherwise → green "OK"

Header badge shows `{lowStockAssets.length} niski stan` when any exist.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `grep -n "deposit" components/subcommittees/LogisticsPanel.tsx` → no results (confirmed)
- `grep -n "logAudit" components/subcommittees/LogisticsPanel.tsx` → 4 occurrences (import + DELETE asset + UPDATE_STATUS + DELETE loan)
- `grep -n "Przeterminowane" components/subcommittees/LogisticsPanel.tsx` → 1 occurrence
- TypeScript: no errors in modified files (pre-existing errors in unrelated files: meetings/page.tsx, scores/ScoresClientPage.tsx, wniosek/page.tsx — out of scope)

## Known Stubs

None.

## Self-Check: PASSED

- `components/subcommittees/LogisticsPanel.tsx` — modified, committed 1f77c21
- `components/subcommittees/AssetInventory.tsx` — created, committed 7e2921e
