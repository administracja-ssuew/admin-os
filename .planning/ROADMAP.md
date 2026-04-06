# ROADMAP: Admin OS — System Zarządzania Samorządem

**Milestone:** v1.0 — Release Ready
**Generated:** 2026-04-04

---

## Phases

### Phase 1: Security Hardening & Stability
**Goal:** Fix all known security vulnerabilities and data integrity issues before any new feature ships.
**Requirements:** SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, STAB-01, STAB-02, STAB-03, STAB-04
**Why now:** Four confirmed vulnerabilities exist in the current codebase. Any release without closing them is a reputational and data integrity risk. Sequencing within this phase is non-negotiable — adding auth to `/api/notifications` before splitting the public endpoint silently kills all public form notifications with no error visible to the user; tightening RLS before confirming `SUPABASE_SERVICE_ROLE_KEY` causes notification DB writes to fail silently while emails still send.

#### Plans
1. Verify environment secrets — confirm `SUPABASE_SERVICE_ROLE_KEY` is present in all environments and remove the `|| NEXT_PUBLIC_SUPABASE_ANON_KEY` fallback in the notifications API route; confirm `CRON_SECRET` is set and make it unconditionally required in `deadline-check` (SEC-05, SEC-06)
2. Split notifications endpoint — create `/api/notifications/external` with its own dedicated secret scoped only to the `external_submission` type (used by the public `/wniosek` form); update `/wniosek/page.tsx` to call the new endpoint via a Server Action so the secret never reaches the browser (SEC-03)
3. Add auth to main notifications endpoint — after the external endpoint is live, require a valid Bearer session token on `POST /api/notifications`; return 401 immediately when absent (SEC-02)
4. Fix RLS on notifications table — after service key is verified, replace the permissive `WITH CHECK (true)` INSERT policy with service-role-only INSERT; update all server-side callers to use the service role client (SEC-04)
5. Add server-side guards to `/scores` and `/executive` — implement route-level Server Component auth checks using `cookies()` + `supabase.auth.getUser()`; verify Supabase cookie format from installed library source before implementing the parser; add toast feedback in root page for access-denied redirects (SEC-01)
6. Fix data integrity issues — generate `case_number` server-side with uniqueness enforcement (STAB-01); add `UNIQUE(department_id)` constraint to `department_notes` and switch insert to upsert (STAB-02); fix the unreachable `NotificationBell` Realtime cleanup so unsubscribe actually runs on unmount (STAB-03); audit mutation handlers in `my-department` and `users` for silent errors and surface all failures via toast (STAB-04)

---

### Phase 2: My-Department Refactor
**Goal:** Decompose the 1300-line monolith into per-subcommittee data hooks and panel components, reducing `page.tsx` to a thin orchestrator.
**Requirements:** REF-01, REF-02, REF-03, REF-04, REF-05
**Why now:** All three subcommittee feature phases (Logistics, Archiving, Grants) depend on clean component boundaries. Adding features to the monolith compounds prop-drilling and creates waterfall query problems. Hooks must be extracted before JSX components — wrong order produces either 15-deep prop drilling or triplicated Supabase queries.

#### Plans
1. Add `dept_type` enum migration — add a `dept_type` enum column (`logistics`, `archiving`, `grants`) to the `departments` table; backfill existing rows; update routing logic in `page.tsx` to use this column instead of `deptName.includes(...)` string matching (REF-04)
2. Extract data hooks — create `useLogisticsData`, `useArchivingData`, and `useGrantsData` in `hooks/`; each hook owns its Supabase queries for its domain; parallelize independent queries with `Promise.all` (REF-01)
3. Extract panel components — create `LogisticsPanel`, `ArchivingPanel`, and `GrantsPanel` in `components/subcommittees/`; each receives data and callbacks from its hook; no business logic in JSX (REF-02)
4. Thin out `page.tsx` — rewrite `my-department/page.tsx` as a tab orchestrator that mounts the correct panel based on `dept_type`; target ~80 lines; no direct Supabase calls remain in the file (REF-03)
5. Define TypeScript interfaces — add `EquipmentLoan`, `Grant`, `EligibilityCriterion`, and `MeetingProtocol` interfaces to `types/index.ts`; replace `any[]` state in all affected hooks and components (REF-05)

---

### Phase 3: Logistics Module
**Goal:** Complete the Logistics subcommittee with full loan contract fields, overdue detection, and office asset inventory with low-stock tracking.
**Requirements:** LOG-01, LOG-02, LOG-03, LOG-04, LOG-05
**Why now:** Logistics has the most straightforward additions — schema columns and UI wiring on an already-built table. No new tables required. This is a good first feature phase to validate the new component structure from Phase 2 at low risk before the more complex Archiving and Grants modules.

**Plans:** 3 plans

Plans:
- [x] 03-01-PLAN.md — Migracja SQL: rozszerzenie equipment_loans (borrower_phone/org/source) i assets (quantity/min_quantity/unit)
- [x] 03-02-PLAN.md — Aktualizacja types/index.ts i useLogisticsData z logiką low stock
- [x] 03-03-PLAN.md — UI: formularz umów, overdue badge, AssetInventory, audit logAudit()

---

### Phase 4: Archiving Module
**Goal:** Complete the Archiving subcommittee with a functional meeting minutes editor, project report folder types, and a department-scoped case Kanban.
**Requirements:** ARCH-01, ARCH-02, ARCH-03, ARCH-04, ARCH-05, ARCH-06
**Why now:** The `/meetings` route is currently a dead link from the Archiving section — a visible gap to any user. Case Kanban reuses the existing `useCases` hook with a department filter and adds no new infrastructure. All patterns (FileUpload, slide-over drawer, RLS migration) are established.

**Plans:** 4/5 plans executed

Plans:
- [x] 04-01-PLAN.md — Migracja SQL: tabela meeting_protocols + kolumna folder_type; aktualizacja types/index.ts
- [x] 04-02-PLAN.md — Edytor protokołów na /meetings: lista + formularz tworzenia + drawer edycji
- [ ] 04-03-PLAN.md — Upload pliku do protokołu + przycisk "Zablokuj protokół" (finalizacja)
- [x] 04-04-PLAN.md — Kanban spraw w ArchivingPanel: zakładka "Sprawy" z useCases filtrowanym po dept
- [x] 04-05-PLAN.md — Typy folderów (badge ogólny/raport projektowy) + audit log przy zmianie statusu

---

### Phase 5: Grants Module
**Goal:** Complete the Grants subcommittee with eligibility criteria checklists, patronage-specific fields, deadline countdowns, and full application tracking.
**Requirements:** GRANT-01, GRANT-02, GRANT-03, GRANT-04, GRANT-05, GRANT-06, GRANT-07
**Why now:** Grant eligibility criteria is the largest functional gap — zero implementation exists. The JSONB checklist pattern is established in `Task.checklists` and can be adapted. All other grant additions are nullable column extensions on the existing `grants_radar` table.

#### Plans
1. Extend `grants_radar` schema — migration adding: `eligibility_criteria` (JSONB array of `{label, state: met|unmet|pending}`), `owner_id` (uuid FK to users), `application_url` (text), `applied_at` (date), `decision_expected_at` (date), `patronage_event_name` (text), `patronage_event_date` (date), `patron_identity` (text), `grant_type` enum (`GRANT`/`PATRONAT`); include DB CHECK constraints on status transitions (GRANT-01, GRANT-04, GRANT-05, GRANT-06)
2. Eligibility checklist component — build `EligibilityChecklist` in `components/subcommittees/grants/`; renders criteria as a checklist with three-state toggle (met/unmet/pending); updates `eligibility_criteria` JSONB in place (GRANT-01)
3. Eligibility summary + deadline badges — add a summary badge "X/N kryteriów spełnionych" to the grant card/detail view; add deadline countdown badge ("7 dni", "1 dzień", "po terminie") computed from `deadline` field (GRANT-02, GRANT-03)
4. Grant owner picker + application tracking fields — replace any text input for owner with a `<select>` populated from `useUsers`; surface `application_url`, `applied_at`, `decision_expected_at` in the grant form and detail view (GRANT-04, GRANT-05)
5. Patronage fields + audit — show patronage-specific fields (`patronage_event_name`, `patronage_event_date`, `patron_identity`) conditionally when `grant_type = PATRONAT`; call `logAudit()` on every grant status change (GRANT-06, GRANT-07)

---

### Phase 6: Knowledge Base
**Goal:** Complete the Knowledge Base with article type classification, template file downloads, safe Markdown rendering, and last-editor attribution.
**Requirements:** KB-01, KB-02, KB-03, KB-04
**Why now:** Knowledge Base additions are the lightest feature phase, but contain the one security-sensitive UI change — replacing `dangerouslySetInnerHTML` with `react-markdown`. This should not be rushed into an earlier phase and should not be the final act before release so there is time to catch any rendering regressions.

#### Plans
1. Extend `knowledge_articles` schema — migration adding `article_type` enum (`guide`, `template`, `regulation`), `file_url` (text), `file_name` (text), `updated_by` (uuid FK to users); backfill existing articles with a default type (KB-01, KB-02, KB-04)
2. Install `react-markdown` and replace unsafe rendering — install `react-markdown` (~5 KB); replace `dangerouslySetInnerHTML` in the article reader component with `<ReactMarkdown>`; also move the hardcoded CSS stripe snippet in `knowledge/page.tsx` to `globals.css` (KB-03)
3. Article type UI + template downloads — surface `article_type` as a badge on article cards and in the detail view; add a download button for articles where `file_url` is set, pointing to the Supabase Storage URL (KB-01, KB-02)
4. Last-editor attribution + admin file upload — display `updated_by` user name on each article; wire `FileUpload.tsx` to allow admins to attach a template file when creating or editing an article (KB-04, KB-02)

---

### Phase 7: UX Polish
**Goal:** Improve perceived quality with a redesigned loading screen, skeleton loaders for all new module tables, and empty states across all modules.
**Requirements:** UX-01, UX-02, UX-03
**Why now:** Polish does not affect functionality and should never block feature delivery. This is the final pass before release — all functional modules are complete, making it safe to focus on visual consistency without regressions.

#### Plans
1. Loading screen redesign — replace the current loading screen with one that includes the system visual identity (logo/name) and a visible progress indicator; ensure it matches the Tailwind dark/light theme (UX-01)
2. Skeleton loaders for new modules — add `SkeletonLoader` usage to `LoanRegister`, `AssetInventory`, `ArchivingPanel` (meeting minutes list, case Kanban), `GrantsPanel`, and the Knowledge Base article list for the loading state of each (UX-02)
3. Empty states for all modules — add `EmptyState` with a descriptive message and a primary action button (e.g. "Dodaj wypożyczenie", "Dodaj grant") to each new module table when it has zero records (UX-03)

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security Hardening & Stability | 6/6 | Complete   | 2026-04-06 |
| 2. My-Department Refactor | 4/5 | In Progress|  |
| 3. Logistics Module | 3/3 | Complete | 2026-04-06 |
| 4. Archiving Module | 4/5 | In Progress|  |
| 5. Grants Module | 0/5 | Not started | - |
| 6. Knowledge Base | 0/4 | Not started | - |
| 7. UX Polish | 0/3 | Not started | - |
