# PITFALLS.md
> Generated: 2026-04-04 | Focus: pitfalls | Mode: subsequent milestone

## Overview

13 specific pitfalls grounded in the actual codebase. All findings verified directly in code.

---

## CRITICAL

### P1 — RLS tightening breaks silently if `SUPABASE_SERVICE_ROLE_KEY` missing

**What goes wrong:** `app/api/notifications/route.ts` line 13 falls back to anon key when service role key is absent. Tightening the notifications RLS policy will cause in-app notification creation to fail silently — emails still send via Resend, but no DB record is written. No error is surfaced to the user.

**Warning signs:** Notification bell shows 0 items after events that should trigger notifications. Email arrives but nothing appears in-app.

**Prevention:** Before changing RLS, verify `SUPABASE_SERVICE_ROLE_KEY` is present in all environments (local `.env.local`, Vercel/production). Remove the `|| NEXT_PUBLIC_SUPABASE_ANON_KEY` fallback in the route — fail loudly if the service key is missing.

**Phase:** Security hardening (Phase 1)

---

### P2 — New subcommittee tables default to open (no RLS)

**What goes wrong:** Supabase tables are fully open until `ENABLE ROW LEVEL SECURITY` is explicitly called in a migration. Every new table for Logistics, Archiving, Grants will be publicly readable/writable by any authenticated user until policies are added.

**Warning signs:** Any authenticated user can read/modify another subcommittee's data.

**Prevention:** Every migration file must include the template:
```sql
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_own_dept" ON new_table FOR ALL USING (department_id = get_user_department());
```
Make this a mandatory checklist item before merging any migration.

**Phase:** Every feature phase that adds new tables

---

### P3 — Monolith decomposition breaks shared fetch state

**What goes wrong:** `fetchDepartmentData` in `my-department/page.tsx` mixes auth context, routing state, and business data for all three subcommittees. Splitting JSX before splitting data fetching leads to either 15-deep prop drilling or triplicated waterfall queries hitting Supabase independently.

**Warning signs:** After extraction, subcommittee components need the same data and either re-fetch it (N+1) or receive it as props 4+ levels deep.

**Prevention:** Extract data hooks first (`useLogisticsData`, `useArchivingData`, `useGrantsData`), then extract JSX components that consume them. Never extract UI before extracting the data layer.

**Phase:** My-Department refactor (before adding new subcommittee features)

---

### P4 — `department_notes` race condition → `.single()` failure

**What goes wrong:** `department_notes` table has no `UNIQUE(department_id)` constraint. Concurrent saves (e.g. two admins editing simultaneously) create duplicate rows. Next `.single()` call throws `PGRST116` (multiple rows), page silently shows blank workspace note.

**Warning signs:** Workspace notes occasionally appear blank after concurrent edits. Supabase logs show `PGRST116` errors.

**Prevention:** Add `UNIQUE(department_id)` constraint in a migration before release. Use `UPSERT` (`ON CONFLICT DO UPDATE`) for all note saves.

**Phase:** Security + stability phase (data integrity)

---

### P5 — Securing `/api/notifications` breaks public form submissions

**What goes wrong:** The public `/wniosek` form has no user session. It currently relies on the unauthenticated POST to `/api/notifications` to send admin alerts and applicant confirmations. Adding Bearer token auth to this endpoint silently kills all public form notifications.

**Warning signs:** After securing the endpoint, submitting a case produces no admin notification and no applicant confirmation — no error visible to the user.

**Prevention:** Before adding auth to `/api/notifications`, split it: create a separate `/api/notifications/external` endpoint (with its own secret, not user session) specifically for public form submissions. Then add full auth to the main endpoint.

**Phase:** Security hardening — must be sequenced correctly

---

## MODERATE

### P6 — `any` types cascade into new feature code

**What goes wrong:** With 60+ `any` usages in existing hooks, new feature code that imports or extends existing types will inherit the `any` propagation. Grant, Asset, EquipmentLoan types will be implicitly `any` if not explicitly defined before feature development.

**Prevention:** Define TypeScript interfaces in `types/index.ts` for every new module (EquipmentLoan, OfficeSupply, Grant, Patronage, MeetingMinutes) before writing any feature code.

**Phase:** Start of each new module phase

---

### P7 — Department name string-matching silently disables features

**What goes wrong:** Some features use department name strings (e.g. `dept.name === "Logistyka"`) to determine which subcommittee UI to render. If an admin renames a department, features silently disappear.

**Prevention:** Use `department_type` enum column (`logistics | archiving | grants`) instead of name-matching. Add the column in a migration.

**Phase:** My-Department refactor

---

### P8 — `case_number` collision under concurrent submissions

**What goes wrong:** Case numbers are generated client-side with `Math.random()`. Under concurrent submissions, two cases can receive the same number. No DB uniqueness constraint catches this.

**Prevention:** Generate `case_number` server-side using a DB sequence or trigger. Add `UNIQUE` constraint on the column.

**Phase:** Security + stability phase

---

### P9 — Full re-fetch after every mutation compounds as features grow

**What goes wrong:** `fetchDepartmentData` re-fires after every insert/update/delete, issuing multiple sequential queries. With 3 subcommittee sections each with their own tables, this becomes a 9-12 query waterfall on every mutation.

**Prevention:** Extract per-subcommittee hooks with independent refetch. Use Supabase Realtime subscriptions for live updates instead of manual refetch where possible.

**Phase:** My-Department refactor

---

## MINOR

### P10 — Realtime channel leak in `NotificationBell`

**What goes wrong:** The `useEffect` in `NotificationBell` uses async setup. If the component unmounts before the channel subscription resolves, the cleanup function runs before the channel is assigned, leaving a dangling subscription.

**Prevention:** Store channel ref in `useRef`, always call `supabase.removeChannel()` in cleanup regardless of async state.

**Phase:** Stability / UX polish phase

---

### P11 — Equipment loan overdue state not modeled

**What goes wrong:** If the loan schema has no `status` or `overdue` computed field, overdue loans are invisible — the demand chart will show equipment as "available" when it's actually late.

**Prevention:** Include `return_date`, `actual_return_date`, and a computed `is_overdue` flag in the schema from day one. Add a DB view or computed column rather than calculating in UI.

**Phase:** Logistics module

---

### P12 — Grant status/decision fields have no invalid-state guards

**What goes wrong:** Grant statuses (draft → submitted → approved/rejected) have no enforced transitions. A grant can be marked "approved" without going through "submitted", creating inconsistent data.

**Prevention:** Use a DB `CHECK` constraint or trigger to enforce valid status transitions. Define the state machine in `types/index.ts`.

**Phase:** Grants module

---

### P13 — `dangerouslySetInnerHTML` pattern spreading to Knowledge Base editor

**What goes wrong:** The knowledge page already uses `dangerouslySetInnerHTML`. If the new admin editing panel stores raw HTML and renders it the same way, any admin who can edit articles can inject scripts (stored XSS).

**Prevention:** Use a sanitization library (DOMPurify) on all HTML before rendering. Better: store content as Markdown, render with a safe Markdown renderer (react-markdown). Never trust HTML from the database without sanitization.

**Phase:** Knowledge Base module

---

## Key Sequencing Warning

Security hardening must follow this order — wrong order silently breaks public functionality:

1. Create `/api/notifications/external` endpoint for public form
2. Add auth to main `/api/notifications` endpoint
3. Fix RLS on `notifications` table
4. Verify `SUPABASE_SERVICE_ROLE_KEY` in all environments

---

## Open Questions

- Is `SUPABASE_SERVICE_ROLE_KEY` confirmed present in the production environment? This is the highest-risk unknown.
- Does the deployment platform support cron jobs for `deadline-check`? The cron secret must be made required before go-live.

---
*Research completed: 2026-04-04*
