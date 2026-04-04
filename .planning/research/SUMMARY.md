# Project Research Summary

**Project:** Admin OS — System Zarządzania Samorządem
**Domain:** Internal administrative tooling for local government (10–30 users)
**Researched:** 2026-04-04
**Confidence:** HIGH

---

## Key Findings (Most Influential for Roadmap)

1. **Security must ship before any new feature.** Four concrete vulnerabilities exist in the current codebase: client-only role guards on `/scores` and `/executive`, unauthenticated POST to `/api/notifications`, overly permissive RLS INSERT on the `notifications` table, and an optional cron secret. Any release without fixing these is a reputational and data integrity risk.

2. **The monolith must be refactored before subcommittee features are added.** `my-department/page.tsx` is ~1300 lines with all three subcommittee UIs mixed together. Attempting to add features to this file will compound technical debt and create prop-drilling or N+1 query problems. The correct order: extract data hooks first, then JSX components.

3. **Most "missing features" are gaps within existing modules, not net-new systems.** Logistics, Grants, Archiving, and Knowledge Base UIs are already partially built. The work is additions (schema columns, wiring existing components) rather than greenfield development — phases will be shorter than they appear.

4. **Grant eligibility criteria is the largest functional gap.** The "analiza kwalifikowalności" requirement has zero implementation — no UI, no schema fields. This is also the feature most likely to require a medium-complexity UI pattern (criteria checklist with met/unmet/pending states).

5. **Security sequencing is non-negotiable.** Fixing `/api/notifications` auth must be split into two phases: first create `/api/notifications/external` for the unauthenticated public `/wniosek` form, then add session auth to the main endpoint. Reversing this order silently kills all public form notifications with no error visible to the user.

---

## Executive Summary

Admin OS is a brownfield internal administrative tool for a local government body with 10–30 users. The system is built on a locked stack (Next.js 15 App Router, Supabase, TypeScript, Tailwind CSS, Resend) and has significant working functionality across authentication, case management, notifications, and subcommittee modules. The research consensus is clear: the system is close to release-ready, but has concrete security vulnerabilities that must be fixed before any new feature ships, and a monolithic component that must be refactored before new subcommittee work can proceed cleanly.

The recommended approach is a security-first, refactor-second, feature-third sequence. Security hardening (four specific fixes with known solutions) is Phase 1. Monolith decomposition into per-subcommittee hooks and components is Phase 2 — this is the prerequisite for all module work. Feature development then proceeds module by module: Logistics additions (contract fields, overdue detection), Archiving (meeting minutes, case kanban), Grants (eligibility criteria, patronage fields), and Knowledge Base (article types, template downloads, markdown rendering). Each phase adds schema migrations, and every migration must include RLS policies from day one.

The key risk is sequencing errors in the security phase — specifically, adding authentication to `/api/notifications` before splitting off the public endpoint, or tightening RLS before confirming `SUPABASE_SERVICE_ROLE_KEY` is present in all environments. Both failures are silent (no error surfaced to the user) and could pass a manual test while breaking production. These must be treated as ordered steps, not independent tasks.

---

## Key Findings

### Recommended Stack

The stack is locked and should not change. Next.js 15 App Router + Supabase is the correct foundation for an internal tool of this scale, and the codebase is intentionally lean. The only new dependency approved for v1 is `react-markdown` (~5KB) to replace `dangerouslySetInnerHTML` in the Knowledge Base. Chart libraries (Recharts, Chart.js, Tremor) are explicitly deferred — the existing pure CSS bar chart is sufficient for v1. `@supabase/ssr` is worth evaluating for a cleaner server-side auth API but requires refactoring existing auth helper calls and is not required for the security fixes described in STACK.md.

**Core technologies:**
- **Next.js 15 App Router:** Framework — locked, breaking changes at 16 (middleware renamed to proxy.ts)
- **Supabase:** Auth + database + storage + realtime — all modules use direct Supabase calls
- **@supabase/auth-helpers-nextjs:** Server component auth — `createServerComponentClient` is the correct API for server-side guards without `@supabase/ssr`
- **TypeScript 5.x:** Language — 60+ `any` usages must be resolved before new modules add more
- **Tailwind CSS 3.x:** Styling — all new UI must match existing patterns
- **Resend:** Email delivery — already integrated, reuse existing pipeline for new notifications
- **react-markdown:** Approved new dependency for KB article rendering (~5KB, replaces `dangerouslySetInnerHTML`)

### Expected Features

The "missing features" are additions to existing, partially-built modules. All four modules (Logistics, Archiving, Grants, Knowledge Base) have working UI and database tables. The gaps are specific fields, specific UI components, and one entirely absent feature (grant eligibility criteria).

**Must have (table stakes for v1):**
- Server-side role guards on `/scores` and `/executive` (security prerequisite)
- Authenticated `/api/notifications` with split external endpoint (security prerequisite)
- Tightened RLS on notifications table (security prerequisite)
- Monolith decomposition into per-subcommittee hooks + components (refactor prerequisite)
- Loan contract additional fields: borrower phone, org, loan source, deposit info
- Overdue loan detection and visual highlight (pure UI, no new infrastructure)
- Asset quantity tracking for consumables (schema migration only)
- Meeting minutes: template editor + file upload on `/meetings` (currently a dead link)
- Grant eligibility criteria checklist (entirely absent — JSONB on grants_radar)
- Knowledge Base article types and template file downloads

**Should have (differentiators, defer to late v1 or post-v1):**
- Patronage-specific fields (event name, date, patron identity) — notes field is a workaround until volume justifies it
- Overdue loan notifications via existing cron pipeline
- Markdown rendering in Knowledge Base (content is readable as plaintext now)
- Demand chart category breakdown (current chart is functional)

**Defer to v2+:**
- CSV export of loan history
- Server-side MIME validation via Supabase Edge Function
- Template download counter
- QR/barcode scanning for assets
- Grant deadline notifications via cron (external dependency on cron platform)

### Architecture Approach

The current architecture is direct Supabase calls from hooks and components — no abstraction layer, no ORM, no state management library. This pattern is correct for the scale and should be preserved in all new modules. The critical structural change is decomposing `my-department/page.tsx` (~1300 lines, 3 subcommittee render branches) into per-subcommittee data hooks (`useLogisticsData`, `useArchivingData`, `useGrantsData`) and panel components. Data hooks must be extracted before JSX components — wrong order produces either 15-deep prop drilling or triplicated Supabase waterfall queries. The `department.name` string-matching for subcommittee routing must be replaced with a `dept_type` enum column to prevent features silently disappearing when departments are renamed.

**Major components after refactor:**
1. `app/my-department/page.tsx` — thin tab orchestrator (~80 lines)
2. `components/subcommittees/logistics/` — `useLogisticsData`, `LogisticsPanel`, `LoanRegister`, `AssetInventory`, `EquipmentDemandChart`
3. `components/subcommittees/archiving/` — `useArchivingData`, `ArchivingPanel`, `ArchiveFolders`, `CaseKanban`
4. `components/subcommittees/grants/` — `useGrantsData`, `GrantsPanel`, `GrantsRadar`, `EligibilityChecklist`
5. `app/meetings/` — meeting minutes template editor + file upload (fixes dead link from archiving module)

**Shared infrastructure to reuse (not reinvent):**
- `FileUpload.tsx` + `adminos-files` bucket — wire to meeting minutes, knowledge templates
- `logAudit()` — call on every status change (loan toggles, grant status, archive changes)
- JSONB attachments pattern — reuse for meeting protocols and knowledge templates
- Slide-over drawer component — reuse for meeting protocol detail
- Polish char file sanitizer — use on all new file uploads
- JSONB checklist pattern (`Task.checklists`) — adapt for grant eligibility criteria

### Critical Pitfalls

1. **Tightening RLS before verifying `SUPABASE_SERVICE_ROLE_KEY` (P1, CRITICAL)** — The API route falls back to the anon key silently. Tightening the `notifications` INSERT policy while the service key is missing means notification DB records are never written, but emails still send — the bug is invisible. Prevention: confirm the service key in all environments and remove the `|| NEXT_PUBLIC_SUPABASE_ANON_KEY` fallback before any RLS change.

2. **Adding auth to `/api/notifications` before splitting the public endpoint (P5, CRITICAL)** — The public `/wniosek` form has no user session. Securing the main endpoint first kills all public form notifications silently. Prevention: create `/api/notifications/external` with its own secret first, then add session auth to the main endpoint.

3. **Extracting JSX before extracting data hooks from the monolith (P3, CRITICAL)** — `fetchDepartmentData` mixes auth, routing, and business data for all three subcommittees. Splitting UI components first leads to either 15-deep prop drilling or triplicated Supabase queries. Prevention: hooks first, JSX second, always.

4. **New tables without RLS policies (P2, CRITICAL)** — Supabase tables are fully open until `ENABLE ROW LEVEL SECURITY` is explicitly called. Every migration for Logistics, Archiving, and Grants tables must include RLS + policies as a mandatory checklist item before merge.

5. **`dangerouslySetInnerHTML` spreading to Knowledge Base (P13, MINOR but high-impact)** — The knowledge page already uses this pattern. Adding admin-editable content with the same rendering approach enables stored XSS by any admin. Prevention: install `react-markdown`, render Markdown content safely, never trust raw HTML from the database.

---

## Implications for Roadmap

### Phase 1: Security Hardening and Stability
**Rationale:** Four confirmed vulnerabilities must be fixed before any new feature ships. Sequencing within this phase is non-negotiable (see PITFALLS P5 — wrong order breaks public form notifications silently). This phase also fixes data integrity issues (`department_notes` race condition, `case_number` collision) that compound as usage grows.
**Delivers:** A system safe to release publicly. All known auth, RLS, and API vulnerabilities closed.
**Addresses:** Server-side guards on `/scores` and `/executive`; split + secure `/api/notifications`; tighten notifications RLS; require `CRON_SECRET`; fix `case_number` uniqueness; fix `department_notes` upsert; cleanup Realtime channel leak in `NotificationBell`.
**Avoids:** P1 (silent RLS failure), P5 (broken public form notifications), P8 (case number collision).
**Research flag:** None — all fixes have detailed, verified implementation patterns in STACK.md and ARCHITECTURE.md.

### Phase 2: Monolith Refactor and TypeScript Baseline
**Rationale:** The ~1300-line `my-department/page.tsx` monolith is the prerequisite for all subcommittee feature work. Adding features to the monolith accelerates debt. TypeScript `any` cleanup must precede new module type definitions. The `dept_type` enum migration also belongs here.
**Delivers:** Clean component boundaries. Per-subcommittee data hooks. `page.tsx` reduced to ~80-line orchestrator. TypeScript interfaces defined for all new module types before feature development begins.
**Addresses:** Monolith decomposition; `dept_type` enum column on `departments`; `types/index.ts` additions for `EquipmentLoan`, `Grant`, `MeetingProtocol`, etc.
**Avoids:** P3 (prop drilling / waterfall queries), P6 (`any` cascading into feature code), P7 (department name string-matching breaking features on rename).
**Research flag:** None — decomposition strategy and hook extraction order are fully documented in ARCHITECTURE.md.

### Phase 3: Logistics Module Completion
**Rationale:** Logistics has the most straightforward additions — schema columns and UI wiring on an already-built table. No new tables required. Overdue detection is pure date math. This is a good early feature phase to validate the new component structure from Phase 2.
**Delivers:** Loan contracts with full contact and deposit information. Overdue loan visual highlight. Asset quantity tracking for consumables with low-stock threshold flags. Audit trail on loan status changes.
**Addresses:** `equipment_loans` schema additions (borrower_phone, borrower_org, loan_source, deposit_required, deposit_amount); `assets` schema additions (quantity, min_quantity, unit); overdue highlight UI; `logAudit()` on `toggleLoanStatus`.
**Avoids:** P11 (overdue state not modeled in schema).
**Research flag:** None — standard CRUD additions with known patterns.

### Phase 4: Archiving Module Completion
**Rationale:** Meeting minutes is currently a dead link from the archiving section — a visible gap to any user. The case Kanban reuses existing `useCases` hook with a department filter (no new table). The `/meetings` route already exists with a `findings` text field and `protocol_status` — it needs template UI and file upload wiring.
**Delivers:** Functional meeting minutes editor (template + file upload). Project report archiving with `folder_type` column. Case Kanban filtered to current department. Audit on archive folder status changes.
**Addresses:** `meeting_protocols` table creation with RLS; `archive_folders.folder_type` column; `FileUpload.tsx` wired to meeting minutes; case Kanban filtered view.
**Avoids:** P2 (new table without RLS — `meeting_protocols` requires RLS policies).
**Research flag:** None — `FileUpload.tsx` and slide-over drawer patterns are established.

### Phase 5: Grants Module Completion
**Rationale:** Grant eligibility criteria is the largest functional gap and the only entirely absent feature. The JSONB checklist pattern is established in `Task.checklists` — it needs to be adapted for eligibility criteria with met/unmet/pending states. Patronage-specific fields are low-complexity nullable column additions.
**Delivers:** Eligibility criteria checklist per grant with summary badge. Patronage-specific fields (event name, event date, patron identity). Deadline countdown badges. Grant owner picker functional. Application URL and applied/result date fields. Audit on grant status changes.
**Addresses:** `grants_radar` schema additions (eligibility_criteria JSONB, patronage fields, application tracking fields); `EligibilityChecklist` component; deadline badge UI.
**Avoids:** P12 (grant status transitions without guards — add DB CHECK constraints here).
**Research flag:** None — JSONB checklist pattern documented; all new fields are additive to existing table.

### Phase 6: Knowledge Base Completion
**Rationale:** Knowledge Base additions are lightweight but include the one security-sensitive change (`dangerouslySetInnerHTML` replacement). Installing `react-markdown` and switching the article reader is the smallest intervention with the highest security benefit. Template file uploads reuse `FileUpload.tsx`.
**Delivers:** Article type classification (guide / template / regulation). Template file downloads via Supabase Storage. Markdown rendering replacing `dangerouslySetInnerHTML`. `updated_by` attribution on articles.
**Addresses:** `knowledge_articles` schema additions (article_type, file_url, file_name, updated_by); `react-markdown` install; article reader component update.
**Avoids:** P13 (stored XSS via `dangerouslySetInnerHTML`).
**Research flag:** None — react-markdown is the approved solution with no API uncertainty.

### Phase 7: UX Polish and Loading States
**Rationale:** Skeleton loaders, empty states, and the loading screen visual are deferred here as they do not affect functionality but improve perceived quality. This is the final phase before release.
**Delivers:** Improved loading screen with visual identity and progress indicator. Skeleton loaders for all new module tables. Empty states for zero-data conditions across all modules.
**Avoids:** None critical — polish only.
**Research flag:** None — standard UI patterns.

### Phase Ordering Rationale

- Security before features — a vulnerability-free release is the baseline requirement (PROJECT.md: "security-first constraint")
- Refactor before feature additions — monolith decomposition is the structural prerequisite for clean module development; adding features to the monolith compounds debt
- Logistics before Archiving/Grants — simplest additions, validates the new component structure with lowest risk
- Knowledge Base near-last — lowest user impact gap, but contains the one security-sensitive UI change (`dangerouslySetInnerHTML`) that should not be rushed
- UX polish last — never blocks functionality

### Research Flags

Phases with standard patterns (skip `/gsd:research-phase`):
- **Phase 1 (Security):** All fixes have detailed, verified patterns in STACK.md and ARCHITECTURE.md
- **Phase 2 (Refactor):** Hook extraction strategy and component boundaries are fully specified in ARCHITECTURE.md
- **Phase 3 (Logistics):** Additive schema + CRUD, no new patterns
- **Phase 4 (Archiving):** FileUpload.tsx wiring and table creation follow established patterns
- **Phase 5 (Grants):** JSONB checklist adapts existing Task.checklists pattern
- **Phase 6 (KB):** react-markdown is a drop-in replacement, no API uncertainty
- **Phase 7 (Polish):** Standard UI patterns

No phases require deeper research before planning — all implementation patterns are verified against the actual codebase.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Stack is locked. All security fix APIs (`createServerComponentClient`, RLS SQL) verified against installed packages |
| Features | HIGH | Research read actual source code — gaps identified by direct code inspection, not inference |
| Architecture | HIGH | Component decomposition strategy grounded in existing codebase conventions; hook-first order is non-negotiable |
| Pitfalls | HIGH | All 13 pitfalls are code-verified, not speculative. Silent failure modes are explicitly documented with warning signs |

**Overall confidence:** HIGH

### Gaps to Address

- **`SUPABASE_SERVICE_ROLE_KEY` in production:** Unconfirmed. This is the highest-risk unknown. Must be verified before Phase 1 RLS changes are deployed. Confirmation should be the first task of Phase 1.
- **Next.js actual version:** STACK.md notes that middleware is renamed to `proxy.ts` in Next.js 16. The actual version in `package.json` must be checked before writing any middleware/proxy file. This affects the server-side auth guard implementation.
- **Cron platform availability:** `deadline-check` endpoint exists but it is unknown whether the deployment platform supports scheduled cron jobs. This affects whether grant deadline notifications can ship in v1.
- **`@supabase/ssr` vs `@supabase/auth-helpers-nextjs`:** Current auth helpers are installed; `@supabase/ssr` offers a cleaner server API but requires refactoring existing calls. The decision to evaluate (not adopt) `@supabase/ssr` is already made — validate this remains correct if Next.js version turns out to be 16+.

---

## Sources

### Primary (HIGH confidence — verified against actual codebase)
- `app/my-department/page.tsx` — monolith structure, all three subcommittee implementations, shared fetch pattern
- `app/api/notifications/route.ts` — unauthenticated POST, service key fallback
- Supabase schema (tables: `grants_radar`, `assets`, `equipment_loans`, `archive_folders`, `petitions`, `knowledge_articles`, `notifications`, `department_notes`) — verified via research
- `components/FileUpload.tsx` — upload component API and bucket path prop
- `lib/audit.ts` — `logAudit()` function existence confirmed

### Secondary (MEDIUM confidence — package-level verification)
- `@supabase/auth-helpers-nextjs` — `createServerComponentClient` API confirmed as correct for Next.js App Router without `@supabase/ssr`
- `react-markdown` — ~5KB size estimate, drop-in for content rendering

### Tertiary (LOW confidence — requires validation during Phase 1)
- `SUPABASE_SERVICE_ROLE_KEY` presence in production — unconfirmed, must verify
- Next.js exact version — not checked against `package.json` during research
- Cron platform support for `deadline-check` — unknown deployment environment

---
*Research completed: 2026-04-04*
*Ready for roadmap: yes*
