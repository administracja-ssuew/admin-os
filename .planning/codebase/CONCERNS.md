# CONCERNS.md
> Generated: 2026-04-04 | Focus: concerns

---

## Security Concerns

### [HIGH] Client-side-only authorization guards on sensitive routes

The `/scores` page (`app/scores/page.tsx`, lines 78–91) and `/executive` page (`app/executive/page.tsx`, lines 28–54) perform authorization checks entirely in client-side React `useEffect` hooks. The pattern fetches the session, checks `system_role` in the `users` table, and conditionally renders content. There is no server-side protection (middleware or server component auth gate). A user with a valid session token who manipulates the client bundle or simply removes the redirect in dev tools would receive the component tree.

- Files: `app/scores/page.tsx`, `app/executive/page.tsx`
- Fix approach: Add Next.js middleware (`middleware.ts`) to verify the session and role server-side for `/scores`, `/executive`, `/users`, and other admin-only routes. Alternatively use server components with `cookies()` to validate the session before rendering.

---

### [HIGH] Notification API endpoint accepts unauthenticated POST requests

`app/api/notifications/route.ts` (lines 25–38) only requires a token if one is provided (`if (token) { ... }`) but does not reject the request when no token is present. An unauthenticated caller can POST any `type`/`payload` combination and trigger email sends to all admins and arbitrary `user_id` insertions into the `notifications` table.

- Files: `app/api/notifications/route.ts`
- Current state: `callerUserId` is set to `null` if no token; execution continues to the `switch` block regardless.
- Fix approach: Return `401` immediately when no valid session token is present. The `external_submission` type needs special treatment since it is called from the public `/wniosek` page — that path should have its own internal API key or a separate unauthenticated endpoint scoped only to that operation.

---

### [HIGH] Notification INSERT policy allows any authenticated user to notify any other user

`supabase/migrations/20260403_create_notifications.sql` (line 32):
```sql
CREATE POLICY "Authenticated can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);
```
Any logged-in member can insert a notification for any `user_id` they choose. Combined with the open POST endpoint above, this is a vector for notification spam or social engineering inside the org.

- Files: `supabase/migrations/20260403_create_notifications.sql`
- Fix approach: Restrict INSERT to service role only (via `SUPABASE_SERVICE_ROLE_KEY` in API routes), or tighten the policy to `WITH CHECK (user_id = auth.uid())` for self-notifications and use service role for system-generated notifications.

---

### [HIGH] Cron endpoint secret is optional — endpoint is publicly accessible without it

`app/api/notifications/deadline-check/route.ts` (lines 13–19): The `CRON_SECRET` guard is wrapped in `if (cronSecret)`. If the env var is not set, the endpoint is open to the entire internet without authentication. Any external actor can trigger mass deadline reminder emails and notification inserts.

- Files: `app/api/notifications/deadline-check/route.ts`
- Fix approach: Invert the logic — require the secret unconditionally and reject if missing or non-matching.

---

### [MEDIUM] Role lookup via email instead of user ID

Multiple files (`components/AuthGuard.tsx` line 38, `hooks/useCurrentUser.ts` line 28, `app/users/page.tsx` line 35, `app/executive/page.tsx` line 33, `app/scores/page.tsx` line 82, `components/Sidebar.jsx` line 28) look up the `users` table using `session.user.email` as the key rather than `session.user.id`. If the same email address is registered in both `auth.users` and `public.users` with different UUIDs (e.g. after a data migration), the lookup could return data for the wrong record. Email-based lookups also bypass foreign-key integrity.

- Fix approach: Align `public.users.id` to match `auth.users.id` (or add a foreign key), then perform all lookups by `id`.

---

### [MEDIUM] Public file uploads with no server-side MIME validation

`components/FileUpload.tsx` validates only file size (client-side). The `accept` prop is a browser hint only and can be bypassed. Files are uploaded directly from the browser to Supabase Storage using the anon key. No server-side MIME type check or malware scan is performed.

- Files: `components/FileUpload.tsx`
- Fix approach: Add a server-side upload route that validates content type, file signature (magic bytes), and size before proxying to storage.

---

### [MEDIUM] External credential proxy forwards all query params without filtering

`app/api/cred/route.ts` (lines 76–85): For read-only actions, all `searchParams` from the caller are passed directly to the external `CRED_API_URL`:
```typescript
const params = Object.fromEntries(searchParams.entries())
const qs = new URLSearchParams({ ...params, token: credToken!, autor: user.email! }).toString()
const res = await fetch(`${credApiUrl}?${qs}`)
```
A caller can inject arbitrary query parameters into the upstream API call, potentially manipulating the upstream system's behavior (parameter pollution / SSRF-adjacent).

- Files: `app/api/cred/route.ts`
- Fix approach: Whitelist the allowed query parameters explicitly before forwarding.

---

### [MEDIUM] `dangerouslySetInnerHTML` used in knowledge page

`app/knowledge/page.tsx` (lines 282–287) injects a CSS snippet via `dangerouslySetInnerHTML`. While the content is a hard-coded string literal and not user-controlled, the pattern sets a precedent and will fail code audits. If this pattern is ever copied with dynamic content it becomes an XSS sink.

- Files: `app/knowledge/page.tsx`
- Fix approach: Move the stripe CSS to `globals.css` or a Tailwind plugin.

---

### [LOW] `approveDecision` allows self-approval

`app/executive/page.tsx` (lines 88–100): The comment says "Zatwierdzający nie powinien być tą samą osobą co autor", but the check is not enforced. Any admin can approve their own decision draft.

- Files: `app/executive/page.tsx`
- Fix approach: Add a check `if (currentUser.id === dec.author_id) return toast.error(...)` before executing the update.

---

## Performance Concerns

### [HIGH] `fetchDepartmentData` issues many sequential Supabase queries on mount

`app/my-department/page.tsx` (lines 85–137): The function fires up to 8 separate database queries in sequence depending on the department name. Queries include: user profile, department members, tasks, department notes, grants, assets, equipment loans, reports, archive folders, and petitions. All are sequential `await` calls — not batched with `Promise.all`. This causes waterfall loading on every page visit and every action that calls `fetchDepartmentData()` again (e.g., every status update at line 151 calls `fetchDepartmentData()`).

- Files: `app/my-department/page.tsx`
- Fix approach: Parallelize independent queries with `Promise.all`. Avoid re-fetching the entire page on each mutation; update local state optimistically or refetch only the changed subset.

---

### [HIGH] `fetchExecutiveData` and `fetchData` called on every mutation

`app/executive/page.tsx`: Both `handleDraftDecision` (line 82) and `approveDecision` (line 99) call `fetchExecutiveData()` on success, which re-fetches all confidential cases and all decisions. `app/users/page.tsx`: `handleSaveUser`, `handleSuspendUser` (lines 66, 78) call `fetchData()`, which re-fetches all users and departments.

- Files: `app/executive/page.tsx`, `app/users/page.tsx`
- Fix approach: Apply optimistic updates or targeted refetches instead of full re-fetches.

---

### [MEDIUM] Dashboard issues 9+ parallel Supabase queries with no caching

`app/page.tsx` (lines 49–100): The dashboard fires at minimum 8 `supabase.from()` calls on mount, including count queries and data queries. None are cached. Each visit triggers a full round-trip to Supabase for all statistics.

- Files: `app/page.tsx`
- Fix approach: Use React `cache()` or SWR/React Query for dashboard stats. Consider a single Supabase RPC that aggregates counts server-side.

---

### [MEDIUM] Cases page fetches all cases with no server-side filtering

`app/cases/page.tsx` (line 73): `supabase.from('cases').select('*, users(...), departments(...)').order('created_at', { ascending: false })` fetches ALL cases from the database; filtering is done client-side. Pagination is client-side only (`PAGE_SIZE = 20` at line 43, applied in-memory). As the cases table grows this will cause large payloads.

- Files: `app/cases/page.tsx`
- Fix approach: Move filtering (status, type, department, date range, owner, search) and pagination to server-side Supabase query params.

---

### [MEDIUM] Realtime channels opened without cleanup guards

`app/cases/page.tsx` (lines 63–69) opens a Postgres realtime channel inside `useEffect`, but the cleanup function only runs on unmount. If `fetchData()` throws, the channel still subscribes. In development, React strict mode mounts twice, which can create duplicate channels.

- Files: `app/cases/page.tsx`, `components/NotificationBell.tsx` (lines 22–38)
- Fix approach: Track channel references and ensure exactly-once subscription. Use the cleanup return from `init()` in `NotificationBell` (currently unreachable because `init` is async — the inner `return () => {}` is never returned to `useEffect`).

---

### [LOW] `my-department` page uses full string-match on department name for feature toggling

`app/my-department/page.tsx` (lines 112–133): Feature sections (grants, logistics, archive) are conditionally fetched based on `deptName.includes('dotacj')`, `.includes('logistyk')`, etc. This is fragile — a department renamed or with a spelling variation silently disables the feature for that team. It also means the features cannot be enabled for multiple departments without renaming them.

- Files: `app/my-department/page.tsx`
- Fix approach: Store a `department_type` or feature flags enum column in the `departments` table.

---

## Technical Debt

### [HIGH] Pervasive use of `any` types throughout the codebase

Approximately 60+ occurrences of `any` were found across page components. Key examples:
- `app/calendar/page.tsx` lines 10, 46: `useState<any[]>`
- `app/executive/page.tsx` lines 11–17: all state typed as `any`
- `app/meetings/page.tsx` lines 11–13, 21: `any[]` for all data state
- `app/my-department/page.tsx` lines 14–62: 15+ `any`-typed state variables
- `app/scores/page.tsx` lines 66, 112, 137: `any` in auth check and row update

This defeats TypeScript's static analysis. The `types/index.ts` file defines proper interfaces (`Case`, `Task`, `Meeting`, etc.) that are partially unused in the pages that need them most.

- Fix approach: Replace `any[]` with the defined types from `types/index.ts`. Extend `types/index.ts` for missing entities (grants, assets, loans, decisions).

---

### [HIGH] `Sidebar.jsx` is JavaScript (not TypeScript)

`components/Sidebar.jsx` is the only non-TypeScript source file. It has no type checking, uses implicit `any` for all props, and imports TypeScript modules without benefit of type inference.

- Files: `components/Sidebar.jsx`
- Fix approach: Rename to `Sidebar.tsx` and add proper prop types. Notably, `userRole` state at line 12 is typed as `null` with no union — it should be `SystemRole | null`.

---

### [MEDIUM] `scores` page accessible only via direct URL — security by obscurity

`app/scores/page.tsx` (line 479): "Ta strona nie jest indeksowana w nawigacji. Dostęp tylko przez bezpośredni URL." The `/scores` route relies on not being linked rather than on actual access control enforced at the routing layer. The client-side auth check is the only guard (see Security concern above).

- Files: `app/scores/page.tsx`
- Fix approach: Add to middleware-level route protection. Expose the link in the sidebar conditionally when `isSuperAdmin`.

---

### [MEDIUM] Three hardcoded "Work In Progress" knowledge base entries

`app/knowledge/page.tsx` (lines 22–27): Three article stubs (`wipTabs`) are hardcoded directly in component source. These appear in production UI with locked icons and "Prace Robocze" status. They must be updated by a code deployment rather than by an admin through the UI.

- Files: `app/knowledge/page.tsx`
- Fix approach: Store WIP articles in the `knowledge_articles` table with a `status = 'wip'` column. Query and render them like regular articles.

---

### [MEDIUM] Case number generation has collision risk

`app/wniosek/page.tsx` (lines 119–122): Case numbers are generated client-side as `WNI/{year}/{random 4-digit}`, giving 9000 possible values per year. There is no uniqueness check against existing case numbers before insert, and no database-level unique constraint mentioned for `case_number`. At ~100 cases/year the collision probability is negligible; at scale or after bulk imports it becomes a real risk.

- Files: `app/wniosek/page.tsx`
- Fix approach: Generate the case number inside a Supabase database function or API route that checks for uniqueness, or use a sequential counter with `SELECT MAX`.

---

### [MEDIUM] Audit log only covers `cred` API mutations — most data changes are unlogged

`lib/audit.ts` and `app/api/cred/route.ts`: The `logAudit` function exists and is called from the `/api/cred` route (line 61) and `app/cases/page.tsx`. However, no audit entries are created for: user role changes (`app/users/page.tsx`), task status changes, decision approvals (`app/executive/page.tsx`), knowledge article edits/deletions, or score entries. The audit log gives an incomplete picture of system activity.

- Files: `lib/audit.ts`, `app/users/page.tsx`, `app/executive/page.tsx`
- Fix approach: Call `logAudit` in every mutation handler that changes security-relevant data (role, status, deletion).

---

### [LOW] `app/my-department/page.tsx` is a 1000+ line monolith

The file contains logic for grants, assets, equipment loans, reports, archive folders, petitions, tasks, and department notes all in a single component. State management is handled by 30+ `useState` calls. This makes the file difficult to maintain and test.

- Files: `app/my-department/page.tsx`
- Fix approach: Extract each feature section (Grants, Logistics, Archive/Petitions) into its own sub-component or page, sharing data via context or props.

---

### [LOW] Notification preferences table exists in schema but is never read

`supabase/migrations/20260403_create_notifications.sql` (lines 36–55) defines `notification_preferences` with per-type email opt-out columns. No code in `app/api/notifications/route.ts` or `app/api/notifications/deadline-check/route.ts` checks these preferences before sending emails. All notifications are always sent regardless of user settings.

- Files: `app/api/notifications/route.ts`, `app/api/notifications/deadline-check/route.ts`
- Fix approach: Before calling `sendEmail`, query `notification_preferences` for the target user and skip if the relevant flag is `false`.

---

## Scalability Concerns

### [MEDIUM] `personal_limit` column constrained to max 20 at DB level

`supabase/migrations/20260404_create_member_scores.sql` (line 2):
```sql
personal_limit INTEGER DEFAULT 20 CHECK (personal_limit > 0 AND personal_limit <= 20)
```
The scoring system's maximum limit is a hard database constraint. Changing it requires a migration. The scores page (`app/scores/page.tsx` line 191) also validates `newLimit > 20` client-side.

- Fix approach: Make the upper bound a system configuration value (a `settings` table row or env var) rather than a compiled constraint.

---

### [LOW] No pagination on notifications fetch

`components/NotificationBell.tsx` (line 57): `.limit(20)` is applied but there is no "load more" or cursor-based pagination. Old notifications beyond 20 are silently dropped. As activity increases, important notifications may never be seen.

- Files: `components/NotificationBell.tsx`
- Fix approach: Add pagination or a "Mark all / view all" route with server-side pagination.

---

### [LOW] No cleanup of old notifications

There is no TTL, archival, or deletion policy for the `notifications` table. The table will grow unboundedly with no purge mechanism.

- Fix approach: Add a Supabase scheduled function or cron job to delete `is_read = true AND created_at < NOW() - INTERVAL '30 days'`.

---

## Error Handling Gaps

### [HIGH] Supabase errors silently ignored in most mutation handlers

Multiple mutation handlers check for `error` but never log it to an observability system. The only output is a `toast.error('Błąd')` message. Examples:
- `app/users/page.tsx` line 67: `else toast.error('Błąd zapisu')`
- `app/my-department/page.tsx` line 178: `else { toast.error('Błąd zapisu raportu') }`
- `app/executive/page.tsx` line 99: `toast.error('Błąd autoryzacji')`

There is no error monitoring service (Sentry, etc.) to capture these failures for investigation.

- Fix approach: Integrate an error monitoring service. At minimum, add `console.error(error)` with the raw Supabase error object so it appears in server/client logs.

---

### [MEDIUM] `fetchDepartmentData` and `fetchData` have no error handling

`app/my-department/page.tsx` (lines 85–138) and `app/users/page.tsx` (lines 30–44): Both functions use `await supabase.from(...)` without checking `error` on individual queries. If a query fails (permissions, network), the function silently sets state to empty and `setLoading(false)` — leaving the user with an empty UI and no error message.

- Fix approach: Destructure `{ data, error }` from each query and surface failures with a toast or error state.

---

### [MEDIUM] `useCurrentUser` hook has no error handling

`hooks/useCurrentUser.ts` (lines 22–36): If `supabase.auth.getSession()` or the `users` query throws, the error is unhandled and `loading` remains `true` indefinitely (no `finally` block). Components that depend on this hook will be stuck in loading state.

- Files: `hooks/useCurrentUser.ts`
- Fix approach: Add a `try/catch` with `setLoading(false)` in the `finally` clause.

---

### [LOW] No React Error Boundary anywhere in the component tree

`app/layout.tsx` wraps all pages in `AuthGuard` but there is no `ErrorBoundary` component. An unhandled render error in any page component will crash the entire application with the default React error screen.

- Fix approach: Add an `ErrorBoundary` wrapper in `app/layout.tsx` or at the page level.

---

## Data Integrity Concerns

### [MEDIUM] Attachments stored as JSONB array — no referential integrity

`types/index.ts` (lines 21–27): `Case.attachments` is typed as `CaseAttachment[]`, stored as a JSONB column in Postgres. File metadata (name, URL) lives in the JSON blob; the actual files live in Supabase Storage. Deleting a case does not automatically delete the storage objects. Orphaned files will accumulate silently.

- Fix approach: Create a separate `case_attachments` table with a foreign key to `cases`, and use a Postgres trigger or storage lifecycle rule to clean up objects on case deletion.

---

### [MEDIUM] `department_notes` row auto-created on page load without a uniqueness guarantee

`app/my-department/page.tsx` (lines 108–110):
```typescript
const { data: note } = await supabase.from('department_notes').select('content').eq('department_id', userDept.id).single()
if (note) setWorkspaceNote(note.content)
else await supabase.from('department_notes').insert([{ department_id: userDept.id, content: '' }])
```
If two users in the same department load the page simultaneously, both may find no note row and both may attempt an insert. Without a UNIQUE constraint on `department_id`, duplicate rows are created and only one will be read by `.single()` (which will throw on multiple rows).

- Files: `app/my-department/page.tsx`
- Fix approach: Add `UNIQUE(department_id)` to the `department_notes` table and use `upsert` instead of insert.

---

### [LOW] `member_scores` `personal_limit` is duplicated between `users` and score calculation

`app/scores/page.tsx` (lines 141–153): `getTotal` and `getPercent` read `member.personal_limit` from the members list fetched at page load. If a superadmin updates the limit (via `saveLimit`, line 195) but does not reload the members list, subsequent calculations for ranking use the stale value from `rows[userId].limitInput` rather than the updated `member.personal_limit`.

- Files: `app/scores/page.tsx`
- Fix approach: After `saveLimit` succeeds, ensure `member.personal_limit` in the `members` state array is also updated (it is partially done on line 197 but the `rows` state `limitInput` and the member's `personal_limit` can desync if the page is not refreshed).

---

## Dependency Concerns

### [LOW] `member` system role is inconsistently named

`types/index.ts` (line 2): `SystemRole = 'pending' | 'active' | 'inactive' | 'admin' | 'superadmin'` — `'member'` is not in the union. However `app/users/page.tsx` (line 87) maps `pending → member` in `openEditor` and stores `member` in the database. `app/users/page.tsx` (line 113) filters active users by `['active', 'member', 'admin', 'superadmin']`. The `member` role leaks into the database but is not part of the canonical type definition, causing `any`-typed workarounds.

- Files: `types/index.ts`, `app/users/page.tsx`
- Fix approach: Add `'member'` to `SystemRole`, or standardize on `'active'` and remove all `'member'` handling.

---

*Concerns audit: 2026-04-04*
