---
phase: 04-archiving-module
plan: 05
subsystem: archiving
tags: [badge, audit-log, folder-type, archiving]
dependency_graph:
  requires: [04-04, lib/audit.ts, types/index.ts]
  provides: [ARCH-05, ARCH-06]
  affects: [components/subcommittees/ArchivingPanel.tsx]
tech_stack:
  added: []
  patterns: [logAudit pattern from LOG-05, conditional Tailwind badge classes]
key_files:
  created: []
  modified:
    - components/subcommittees/ArchivingPanel.tsx
decisions:
  - "Badge szary dla 'general', niebieski dla 'project_report' per D-05"
  - "logAudit wywolany z entityType='archive_folder' i action='STATUS_CHANGED' per D-06"
  - "useArchivingData uzywa select('*') — folder_type zwracane automatycznie bez zmian"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-06"
  tasks_completed: 1
  files_modified: 1
---

# Phase 04 Plan 05: Folder Type Badge and Audit Log Summary

**One-liner:** Folder type badge (gray=general, blue=project_report) with logAudit on status change using entityType='archive_folder'.

## What Was Built

### ARCH-05: Typy folderów z badge (D-05)

- `getFolderTypeBadge(folderType: FolderType)` helper added before JSX return
- General folder: gray badge — `bg-slate-100 text-slate-600` (dark: `bg-slate-700 text-slate-300`)
- Project report folder: blue badge — `bg-blue-100 text-blue-700` (dark: `bg-blue-900/30 text-blue-400`)
- Badge rendered on each folder card via `{getFolderTypeBadge(folder.folder_type ?? 'general')}`
- `folder_type` select added to "Nowa Teczka Archiwalna" modal with options: Ogolna / Raport projektowy
- `archiveForm` state extended with `folder_type: 'general' as FolderType`
- Form reset after submit correctly sets `folder_type` back to `'general'`

### ARCH-06: Audit log przy zmianie statusu (D-06)

- `logAudit` imported from `../../lib/audit`
- `FolderType` added to `import type` block
- `updateArchiveStatus` updated to:
  1. Return early if no `currentUser`
  2. Find current folder to capture `oldStatus` before update
  3. Call `logAudit({ userId, action: 'STATUS_CHANGED', entityType: 'archive_folder', entityId, oldValue: { status: oldStatus }, newValue: { status: newStatus } })`
- Follows exact same pattern as LOG-05 from Phase 3

### useArchivingData (hooks/useArchivingData.ts)

- No changes needed — already uses `select('*')` which returns `folder_type` column automatically after migration in 04-01
- Type `ArchiveFolder[]` already includes `folder_type: FolderType` from types/index.ts

## Verification Results

- `grep "logAudit" ArchivingPanel.tsx` — 2 matches (import + call)
- `grep "folder_type" ArchivingPanel.tsx` — 5 matches (state, reset, badge render, select value, onChange)
- `grep "entityType.*archive_folder" ArchivingPanel.tsx` — 1 match
- `grep "Raport projektowy" ArchivingPanel.tsx` — 2 matches (badge label + select option)
- `npx tsc --noEmit` — 0 errors in modified files (2 pre-existing errors in unrelated files: app/scores, app/wniosek)

## Phase 4 Completion Confirmation

All 6 requirements of Phase 4 (Archiving Module) are satisfied:

| Req   | Description                                   | Status    | Plan  |
|-------|-----------------------------------------------|-----------|-------|
| ARCH-01 | Typy folderów w typach TypeScript           | DONE      | 04-01 |
| ARCH-02 | Edytor protokolow na /meetings              | DONE      | 04-02 |
| ARCH-03 | Upload pliku + blokowanie protokolu         | DONE      | 04-03 |
| ARCH-04 | Kanban spraw w zakladce ArchivingPanel      | DONE      | 04-04 |
| ARCH-05 | Badge folder_type na kartach folderow       | DONE      | 04-05 |
| ARCH-06 | logAudit() przy zmianie statusu folderu     | DONE      | 04-05 |

**Faza 4 jest kompletna.**

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit  | Description                                         |
|------|---------|-----------------------------------------------------|
| 1    | 62670dd | feat(04-05): add folder_type badge and audit log on status change |

## Self-Check: PASSED
