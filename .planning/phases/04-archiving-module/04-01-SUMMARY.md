---
phase: 04-archiving-module
plan: "01"
subsystem: archiving
tags: [database, migration, types, meeting-protocols, archive-folders]
dependency_graph:
  requires: []
  provides: [meeting_protocols table, folder_type enum, MeetingProtocol interface, FolderType type]
  affects: [types/index.ts, supabase/migrations]
tech_stack:
  added: []
  patterns: [IF NOT EXISTS DDL guards, RLS dual-role policies, DO $$ BEGIN enum guard]
key_files:
  created:
    - supabase/migrations/20260406_archiving_module.sql
  modified:
    - types/index.ts
decisions:
  - "Added RLS policies for both service_role and authenticated role — mutations in this project use anon key client (not service role), so authenticated INSERT/UPDATE policies required"
  - "FolderType defined as union type (not enum import) to match project pattern for TypeScript types"
  - "MeetingProtocol fully replaced — old interface based on meeting_id/content was wrong abstraction; new table is standalone, not joined to meetings"
metrics:
  duration: 8min
  completed: "2026-04-06"
  tasks: 2
  files: 2
---

# Phase 04 Plan 01: Archiving Module Foundation Summary

SQL migration and TypeScript types establishing the data foundation for the entire archiving module.

## What Was Built

### SQL Migration (`supabase/migrations/20260406_archiving_module.sql`)

New table `meeting_protocols` with fields:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, gen_random_uuid() |
| title | text NOT NULL | Protocol title |
| date | date NOT NULL | Meeting date |
| participants | text NOT NULL DEFAULT '' | Participant list |
| agenda | text NOT NULL DEFAULT '' | Agenda items |
| findings | text NOT NULL DEFAULT '' | Meeting findings |
| actions | text NOT NULL DEFAULT '' | Action items |
| protocol_status | protocol_status NOT NULL DEFAULT 'draft' | draft or finalized |
| file_url | text | Optional uploaded file URL |
| file_name | text | Optional uploaded file name |
| created_by | uuid REFERENCES auth.users(id) | Author FK |
| created_at | timestamptz NOT NULL DEFAULT now() | |
| updated_at | timestamptz NOT NULL DEFAULT now() | |

New enums created:
- `protocol_status`: `'draft'`, `'finalized'`
- `folder_type`: `'general'`, `'project_report'`

RLS policies on `meeting_protocols`:
- SELECT: authenticated users
- INSERT: service_role + authenticated users
- UPDATE: service_role + authenticated users

Existing table change:
- `archive_folders`: added `folder_type folder_type NOT NULL DEFAULT 'general'`

### TypeScript Changes (`types/index.ts`)

**Added** `FolderType` union type:
```typescript
export type FolderType = 'general' | 'project_report'
```

**Extended** `ArchiveFolder` with `folder_type: FolderType` field.

**Replaced** `MeetingProtocol` interface — old version was tied to `meeting_id` (join-based); new version is standalone:
- Old fields removed: `meeting_id`, `content`, `status`
- New fields: `title`, `date`, `participants`, `agenda`, `findings`, `actions`, `protocol_status`, `file_url`, `file_name`, `created_by`, `updated_at`

## Migration Status

Migration file is created and ready. It has NOT been applied to the database yet — requires manual execution via Supabase Dashboard SQL Editor or `supabase db push`.

## Deviations from Plan

None — plan executed exactly as written.

## Commits

- `809485c`: feat(04-01): add archiving module SQL migration
- `6e5030d`: feat(04-01): update TypeScript types for archiving module

## TypeScript Verification

`npx tsc --noEmit` shows 3 pre-existing errors in unrelated files (`app/meetings/page.tsx`, `app/scores/ScoresClientPage.tsx`, `app/wniosek/page.tsx`) — none caused by this plan's changes.

## Self-Check: PASSED

- [x] `supabase/migrations/20260406_archiving_module.sql` exists and contains `CREATE TABLE IF NOT EXISTS meeting_protocols`
- [x] `types/index.ts` contains `FolderType`, `folder_type: FolderType`, `participants: string`
- [x] Commits 809485c and 6e5030d confirmed in git log
