# ARCHITECTURE.md
> Generated: 2026-04-04 | Focus: arch

## Pattern Overview

**Overall:** Full-stack monolith — Next.js App Router application with Supabase as the backend-as-a-service. All frontend and backend code lives in a single repository. No microservices.

**Key Characteristics:**
- React Server Components and Client Components coexist; most pages are `'use client'` and fetch data directly from Supabase on the client side
- Business logic is primarily in page components; shared utilities live in `lib/` and `hooks/`
- The API layer (`app/api/`) is thin — used only for notification dispatch and CRED proxy, not for general CRUD
- Supabase Row Level Security (RLS) enforces data access rules at the database level, reducing the need for server-side guards in most routes

---

## Layers

**Authentication / Session Layer:**
- Purpose: Gate all protected routes; resolve current user identity and role
- Location: `components/AuthGuard.tsx`
- Contains: Session check via `supabase.auth.getSession()`, role lookup in `users` table, redirect to `/login`, polling for pending accounts
- Depends on: `lib/supabase.ts`, Next.js router
- Used by: `app/layout.tsx` (wraps the entire app)

**Data Access Layer (Client-side):**
- Purpose: Fetch and subscribe to Supabase tables directly from browser
- Location: `hooks/useCases.ts`, `hooks/useTasks.ts`, `hooks/useUsers.ts`, `hooks/useCurrentUser.ts`
- Contains: `useEffect`-based fetchers with Supabase Realtime subscriptions (`postgres_changes`)
- Depends on: `lib/supabase.ts`, `types/index.ts`
- Used by: Page components throughout `app/`

**Presentation Layer:**
- Purpose: Render UI; call data hooks; call notification helper on mutations
- Location: All `app/*/page.tsx` files
- Contains: Full page components; `'use client'` directive; local state with `useState`/`useEffect`; direct Supabase calls for mutations (insert/update/delete)
- Depends on: `hooks/`, `lib/supabase.ts`, `lib/notify.ts`, `components/`, `types/`

**Notification Layer:**
- Purpose: Fan out in-app and email notifications for system events
- Location: `lib/notify.ts` (client helper), `app/api/notifications/route.ts` (server handler), `lib/email.ts`, `lib/email-templates.ts`
- Contains: `sendNotification()` posts to `/api/notifications` with a Bearer token; the route handler writes to the `notifications` table and calls Resend
- Depends on: Resend API (`RESEND_API_KEY`), Supabase service role key

**API Proxy Layer:**
- Purpose: Wrap external/legacy CRED system; expose server-side cron endpoint
- Location: `app/api/cred/route.ts`, `app/api/notifications/deadline-check/route.ts`
- Contains: Token-authenticated GET handlers; role checks for write operations; audit logging via `lib/audit.ts`

**Audit / Observability Layer:**
- Purpose: Record all significant mutations to `audit_log` table
- Location: `lib/audit.ts`
- Contains: `logAudit()` — inserts into `audit_log` with old/new JSONB values
- Used by: `app/api/cred/route.ts`; can be called from any server-side context

---

## Data Flow

**Standard Authenticated Page Flow:**

1. Browser requests any protected route
2. `app/layout.tsx` renders `AuthGuard` around `children`
3. `AuthGuard` calls `supabase.auth.getSession()`; if no session, redirects to `/login`
4. If session exists, looks up `users.system_role` by email
5. `active` role → renders `children`; `pending`/`inactive` → shows waiting screen; admin-only routes blocked for non-admins
6. Page component mounts; calls custom hook (e.g., `useCases()`) which queries Supabase and subscribes to Realtime
7. User performs action (create/update/delete) → page calls `supabase.from(...).insert/update/delete` directly
8. Optionally calls `sendNotification()` from `lib/notify.ts` → hits `POST /api/notifications` → writes in-app row + sends email via Resend

**Public External Submission Flow (`/wniosek`):**

1. No auth required — `AuthGuard` bypasses public routes
2. External user fills form; client validates; inserts into `cases` table with `source = 'Formularz Zewnętrzny'`
3. `sendNotification('external_submission', ...)` fires → admins receive in-app + email notification; submitter receives confirmation email
4. Case number generated client-side (`WNI/YYYY/NNNN`)

**Deadline Reminder Flow:**

1. External cron (Vercel Cron or equivalent) calls `GET /api/notifications/deadline-check?secret=...`
2. Handler queries tasks with `deadline = tomorrow` and `status != done`
3. For each: inserts `deadline_reminder` notification row; sends email via Resend

**State Management:**

- No global state library (no Redux, Zustand, Context for data)
- Each page manages its own `useState` for local UI state
- Realtime subscriptions in `useCases` and `useTasks` update component state automatically on database changes
- Dark mode preference persisted in `localStorage`; toggled via direct DOM class manipulation in `components/Sidebar.jsx`

---

## Key Abstractions

**`supabase` singleton:**
- Purpose: Single Supabase client instance shared across all client code
- Location: `lib/supabase.ts`
- Pattern: `createClient(url, anonKey)` — uses public anon key on client; API routes create fresh clients with service role key or user token

**`AuthGuard` component:**
- Purpose: Application-wide authentication and role enforcement
- Location: `components/AuthGuard.tsx`
- Pattern: Wraps `app/layout.tsx`; maintains `status` state (`loading | pending | active | unauthenticated`); also enforces `ADMIN_ROUTES`
- Roles: `pending`, `active`, `inactive`, `admin`, `superadmin` — defined in `types/index.ts` as `SystemRole`

**Custom hooks:**
- `hooks/useCurrentUser.ts` — resolves logged-in user's `AppUser` record; exposes `isAdmin`, `isSuperAdmin` booleans
- `hooks/useCases.ts` — fetches all cases with relations; subscribes to Realtime on `cases` table
- `hooks/useTasks.ts` — same pattern for tasks
- `hooks/useUsers.ts` — fetches all `AppUser` records

**Type definitions:**
- Location: `types/index.ts`
- Contains: All domain types: `AppUser`, `Case`, `Task`, `Meeting`, `Document`, `KnowledgeArticle`, `Department`, `Decision`, `AuditLogEntry`, `Notification`, `NotificationPreference`

---

## Entry Points

**Root Layout:**
- Location: `app/layout.tsx`
- Triggers: Every page load
- Responsibilities: Applies global CSS, `Inter` font, wraps content in `AuthGuard`, mounts `Toaster` (react-hot-toast)

**Dashboard:**
- Location: `app/page.tsx`
- Triggers: Authenticated users at `/`
- Responsibilities: Aggregate stats from `cases`, `tasks`, `meetings`; activity chart; urgent tasks panel; today's tasks; week deadlines

**Login:**
- Location: `app/login/page.tsx`
- Triggers: Unauthenticated access or explicit navigation
- Responsibilities: Supabase email/password login, registration, password reset, new-password flow

**Public Intake Form:**
- Location: `app/wniosek/page.tsx`
- Triggers: Anyone at `/wniosek`
- Responsibilities: External case submission; file upload to Supabase Storage; notification dispatch; honeypot spam protection

---

## Authentication Flow

1. User visits any route → `AuthGuard` checks `supabase.auth.getSession()`
2. **No session:** redirect to `/login`
3. **Session present:** query `users` table by email → read `system_role`
4. **`pending` or `inactive`:** show blocking screen; poll every 15 seconds for status change
5. **`active`, `admin`, `superadmin`:** render requested page
6. **Admin-only route** (`/executive`, `/users`) accessed by non-admin: show access-denied screen
7. Login page: `supabase.auth.signInWithPassword()` → on success router pushes to `/`
8. Registration: `supabase.auth.signUp()` → user must confirm email, then wait for admin to set `system_role = 'active'`
9. Password reset: `supabase.auth.resetPasswordForEmail()` → email link redirects to `/login` with `type=recovery` hash → `PASSWORD_RECOVERY` event → new-password form

---

## Error Handling

**Strategy:** Local, ad-hoc per component. No global error boundary.

**Patterns:**
- Supabase calls check the returned `error` object; errors shown via `react-hot-toast` (`toast.error(...)`) or local `errorMsg` state
- Notification calls (`sendNotification`) are fire-and-forget; failures are logged with `console.error` but do not block the user action
- API routes return `Response.json({ error: '...' }, { status: NNN })`
- `lib/audit.ts` logs `console.error` on failure but does not throw

---

## Cross-Cutting Concerns

**Logging:** `console.error` only; no structured logging library

**Validation:** Client-side only; inline in form submit handlers (e.g., `/wniosek/page.tsx` `validate()` function); honeypot spam protection on public form

**Authorization:**
- Route-level: `AuthGuard` in `components/AuthGuard.tsx`
- API-level: Manual token verification in `app/api/cred/route.ts` and `app/api/notifications/route.ts`
- Database-level: Supabase RLS policies on all tables (see `supabase/migrations/`)

**Realtime:** Supabase Realtime channels subscribed in `useCases.ts`, `useTasks.ts`, `NotificationBell.tsx` — auto-refresh UI on database changes without polling

**Dark Mode:** Tailwind CSS `dark:` classes; toggled by adding/removing `dark` class on `document.documentElement`; persisted in `localStorage`
