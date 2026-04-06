---
phase: 04-archiving-module
plan: "02"
subsystem: archiving
tags: [meetings, protocol-editor, supabase, drawer, modal, typescript]
dependency_graph:
  requires: [04-01]
  provides: [meetings-protocols-page, protocol-list, protocol-create-modal, protocol-edit-drawer]
  affects: [app/meetings/page.tsx]
tech_stack:
  added: []
  patterns: [useCallback for data fetching, controlled form state, drawer pattern, toast.loading/success/error with id]
key_files:
  created: []
  modified:
    - app/meetings/page.tsx
decisions:
  - "Replaced entire meetings page (old meetings table) with meeting_protocols editor — per D-01 (full page, not slide-over)"
  - "Used SkeletonLoader (variant=card) for loading state — component already existed in codebase"
  - "Drawer overlay uses backdrop div with onClick close, matching established pattern"
metrics:
  duration: 10min
  completed: "2026-04-06"
  tasks: 1
  files: 1
---

# Phase 04 Plan 02: Meetings Protocol Editor Summary

Complete rebuild of `/meetings` page from a meeting scheduler into a full protocol editor backed by the `meeting_protocols` Supabase table.

## What Was Built

### `app/meetings/page.tsx` (full rewrite)

#### useState inventory

| State | Type | Purpose |
|-------|------|---------|
| `protocols` | `MeetingProtocol[]` | List of all protocols from DB |
| `loading` | `boolean` | Initial data load indicator |
| `isModalOpen` | `boolean` | Controls "Nowy protokół" modal visibility |
| `isSubmitting` | `boolean` | Disables submit button during create mutation |
| `form` | `typeof EMPTY_FORM` | New protocol form state (6 fields) |
| `selectedProtocol` | `MeetingProtocol \| null` | Protocol open in the drawer |
| `isDrawerOpen` | `boolean` | Controls drawer visibility |
| `editForm` | `typeof EMPTY_FORM` | Edit form state inside drawer |

#### Supabase queries

| Operation | Query |
|-----------|-------|
| Fetch all | `supabase.from('meeting_protocols').select('*').order('date', { ascending: false })` |
| Create | `supabase.from('meeting_protocols').insert([{ ...form, protocol_status: 'draft', created_by: user.id }])` |
| Update | `supabase.from('meeting_protocols').update({ ...editForm, updated_at: new Date().toISOString() }).eq('id', selectedProtocol.id)` |

#### Form fields (6 template fields per D-02)

1. **Tytuł** — `<input type="text">`
2. **Data** — `<input type="date">`
3. **Uczestnicy** — `<textarea rows={3}>`
4. **Porządek obrad** — `<textarea rows={3}>`
5. **Ustalenia** — `<textarea rows={3}>`
6. **Akcje** — `<textarea rows={3}>`

All drawer fields have `disabled={isFinalized}` — per D-03 (finalized = fully locked).

#### Status badges

- `draft`: grey badge "Szkic" (`bg-slate-100 text-slate-600`)
- `finalized`: blue badge "Zablokowany" with `Lock` icon (`bg-blue-100 text-blue-700`)

## States / Handlers for 04-03 Extension

The following will be extended in plan 04-03 (file upload + protocol locking):

- `selectedProtocol` — will gain file_url/file_name display
- `handleSaveEdit` — will remain; 04-03 adds `handleFinalize` handler
- Drawer footer — 04-03 adds "Zablokuj protokół" button (visible only for draft)
- `editForm` — unchanged; locking sets `protocol_status: 'finalized'` via separate mutation

## Deviations from Plan

None — plan executed exactly as written.

## Commits

- `c9bcdd5`: feat(04-02): rebuild /meetings as meeting protocol editor

## TypeScript Verification

`npx tsc --noEmit` shows 0 errors in `app/meetings/page.tsx`. Two pre-existing errors in unrelated files (`app/scores/ScoresClientPage.tsx`, `app/wniosek/page.tsx`) are out of scope.

## Self-Check: PASSED

- [x] `app/meetings/page.tsx` exists and contains `from('meeting_protocols')` (3 occurrences)
- [x] `protocol_status` referenced 5 times (badge rendering + finalized check + insert)
- [x] `isDrawerOpen` state used for drawer visibility control
- [x] `disabled={isFinalized}` on all 6 edit fields in drawer
- [x] `protocol_status: 'draft'` set on insert
- [x] Commit c9bcdd5 confirmed in git log
