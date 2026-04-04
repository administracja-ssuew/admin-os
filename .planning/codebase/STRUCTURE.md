# STRUCTURE.md
> Generated: 2026-04-04 | Focus: arch

## Directory Layout

```
admin-os/
├── app/                    # Next.js App Router — all pages and API routes
│   ├── api/                # Server-side Route Handlers (thin API layer)
│   │   ├── cred/           # Proxy to external CRED system
│   │   └── notifications/  # Notification dispatch + deadline cron
│   ├── brainstorm/         # Admin-only brainstorm board
│   ├── calendar/           # Calendar view (meetings overlay)
│   ├── cases/              # Case registry (Rejestr Spraw)
│   ├── cred/               # CRED system UI (wraps external API)
│   ├── documents/          # Document management
│   ├── executive/          # Admin-only executive panel (Panel Kierownictwa)
│   ├── knowledge/          # Knowledge base articles
│   ├── login/              # Auth page (login/register/reset)
│   ├── meetings/           # Meetings management
│   ├── my-department/      # User's own department view (Moja Podkomisja)
│   ├── pending/            # Pending items view
│   ├── scores/             # Superadmin-only member scoring system
│   ├── tasks/              # Task board (Zadania)
│   ├── users/              # Admin-only user/HR management
│   ├── wniosek/            # Public external intake form (no auth)
│   │   └── status/         # Public case status lookup
│   ├── globals.css         # Global Tailwind CSS
│   ├── layout.tsx          # Root layout — wraps app in AuthGuard + Toaster
│   └── page.tsx            # Dashboard (/)
├── components/             # Shared React components
├── hooks/                  # Custom React hooks (data fetching)
├── lib/                    # Utility modules (Supabase client, email, audit)
├── types/                  # TypeScript type definitions
├── supabase/
│   └── migrations/         # SQL migration files (run manually in Supabase dashboard)
├── public/                 # Static assets (favicon, images)
├── .planning/              # GSD planning documents (not committed per workflow)
│   └── codebase/           # Codebase analysis documents
├── next.config.ts          # Next.js configuration (minimal, no overrides)
├── tsconfig.json           # TypeScript config; path alias @/* → ./*
├── package.json            # Dependencies and scripts
├── postcss.config.mjs      # PostCSS for Tailwind v4
├── eslint.config.mjs       # ESLint configuration
└── .env.local              # Environment variables (not committed)
```

---

## Directory Purposes

**`app/`:**
- Purpose: All Next.js App Router routes — pages and server-side API handlers
- Contains: One `page.tsx` per route segment; one `route.ts` per API endpoint; shared `layout.tsx` and `globals.css` at the root
- Key files: `app/layout.tsx` (root layout), `app/page.tsx` (dashboard)

**`app/api/`:**
- Purpose: Server-side HTTP handlers; used only where client-side Supabase calls are insufficient (notification fan-out, external CRED proxy, cron endpoint)
- Contains: `app/api/notifications/route.ts`, `app/api/notifications/deadline-check/route.ts`, `app/api/cred/route.ts`
- Pattern: Each file exports named HTTP method functions (`GET`, `POST`) per Next.js App Router convention

**`components/`:**
- Purpose: Shared UI components reused across multiple pages
- Key files:
  - `AuthGuard.tsx` — application-wide auth and role gate
  - `Sidebar.jsx` — navigation sidebar with role-conditional links and dark mode toggle
  - `NotificationBell.tsx` — in-app notification dropdown with Realtime subscription
  - `SkeletonLoader.tsx` — loading placeholder skeletons
  - `EmptyState.tsx` — empty list placeholder component
  - `FileUpload.tsx` — Supabase Storage file upload widget
  - `FilterBar.tsx` — reusable filter/search bar
  - `GlobalSearch.tsx` — Cmd+K global search (cases + tasks)
  - `ConfirmDialog.tsx` — reusable confirm/cancel modal

**`hooks/`:**
- Purpose: Encapsulate Supabase data fetching and Realtime subscriptions
- Key files:
  - `useCurrentUser.ts` — resolves authenticated user's full `AppUser` record; exposes `isAdmin`, `isSuperAdmin`
  - `useCases.ts` — fetches all cases with relations; Realtime subscription on `cases` table
  - `useTasks.ts` — fetches all tasks with relations; Realtime subscription on `tasks` table
  - `useUsers.ts` — fetches all users; used in admin panels

**`lib/`:**
- Purpose: Infrastructure utilities — not React, not UI
- Key files:
  - `supabase.ts` — singleton Supabase client (anon key); imported everywhere on the client
  - `notify.ts` — `sendNotification(type, payload)` — posts to `/api/notifications` with current user's Bearer token
  - `email.ts` — `sendEmail()` wrapper around Resend SDK; wraps content in branded HTML template
  - `email-templates.ts` — HTML template builders for each notification type
  - `audit.ts` — `logAudit()` — inserts into `audit_log` Supabase table

**`types/`:**
- Purpose: Shared TypeScript type definitions for all domain entities
- Key files: `types/index.ts` — single file containing all types: `AppUser`, `SystemRole`, `Case`, `Task`, `Meeting`, `Document`, `KnowledgeArticle`, `Department`, `Decision`, `AuditLogEntry`, `Notification`, `NotificationPreference`

**`supabase/migrations/`:**
- Purpose: SQL DDL scripts for Supabase schema; run manually in Supabase SQL Editor (not automated migration runner)
- Generated: No — manually authored
- Committed: Yes
- Key files:
  - `20260331_create_brainstorm_cards.sql`
  - `20260331_create_reports.sql`
  - `20260403_create_audit_log.sql`
  - `20260403_create_notifications.sql`
  - `20260404_create_member_scores.sql`

---

## Key Configuration Files

| File | Purpose |
|------|---------|
| `next.config.ts` | Next.js config — minimal, no custom options |
| `tsconfig.json` | TypeScript; `@/*` maps to `./*` (project root) |
| `postcss.config.mjs` | Enables `@tailwindcss/postcss` (Tailwind v4) |
| `eslint.config.mjs` | ESLint with `eslint-config-next` |
| `.env.local` | Runtime secrets — see `.env.local.example` for required keys |
| `.env.local.example` | Documents required environment variables |

**Required environment variables (from `.env.local.example`):**
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase public anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key for server-side API routes
- `RESEND_API_KEY` — Resend email API key
- `NOTIFICATION_FROM_EMAIL` — Sender address for email notifications
- `NEXT_PUBLIC_APP_URL` — Public URL of the app (used in email links)
- `CRED_TOKEN` — Auth token for external CRED API
- `CRED_API_URL` — URL of external CRED system
- `CRON_SECRET` — Optional secret to protect the deadline-check cron endpoint

---

## Route Structure

| Route | File | Auth | Role |
|-------|------|------|------|
| `/` | `app/page.tsx` | Required | Any active |
| `/login` | `app/login/page.tsx` | Public | — |
| `/wniosek` | `app/wniosek/page.tsx` | Public | — |
| `/wniosek/status` | `app/wniosek/status/page.tsx` | Public | — |
| `/brainstorm` | `app/brainstorm/page.tsx` | Required | admin, superadmin |
| `/calendar` | `app/calendar/page.tsx` | Required | Any active |
| `/cases` | `app/cases/page.tsx` | Required | Any active |
| `/cred` | `app/cred/page.tsx` | Required | Any active |
| `/documents` | `app/documents/page.tsx` | Required | Any active |
| `/executive` | `app/executive/page.tsx` | Required | admin, superadmin |
| `/knowledge` | `app/knowledge/page.tsx` | Required | Any active |
| `/meetings` | `app/meetings/page.tsx` | Required | Any active |
| `/my-department` | `app/my-department/page.tsx` | Required | Any active |
| `/pending` | `app/pending/page.tsx` | Required | Any active |
| `/scores` | `app/scores/page.tsx` | Required | superadmin |
| `/tasks` | `app/tasks/page.tsx` | Required | Any active |
| `/users` | `app/users/page.tsx` | Required | admin, superadmin |
| `POST /api/notifications` | `app/api/notifications/route.ts` | Bearer token | Any authenticated |
| `GET /api/notifications/deadline-check` | `app/api/notifications/deadline-check/route.ts` | CRON_SECRET | Cron job |
| `GET /api/cred` | `app/api/cred/route.ts` | Bearer token | Any authenticated (write: admin+) |

---

## Naming Conventions

**Files:**
- Page files: `page.tsx` (one per directory, required by App Router)
- API files: `route.ts` (one per directory, required by App Router)
- Components: PascalCase — e.g., `AuthGuard.tsx`, `NotificationBell.tsx`
- Hooks: camelCase prefixed with `use` — e.g., `useCases.ts`, `useCurrentUser.ts`
- Lib utilities: camelCase — e.g., `supabase.ts`, `email-templates.ts`
- One component has `.jsx` extension: `components/Sidebar.jsx` (all others are `.tsx`)

**Directories:**
- Route segments: kebab-case or single word — e.g., `my-department/`, `deadline-check/`
- Feature directories match their URL segment exactly

---

## Where to Add New Code

**New authenticated page:**
- Create `app/<route-name>/page.tsx` with `'use client'` at the top
- Import `Sidebar` from `components/Sidebar.jsx` and wrap content in flex layout matching other pages
- Use existing hooks from `hooks/` or query `lib/supabase.ts` directly

**New admin-only page:**
- Create page as above; add route path to `ADMIN_ROUTES` array in `components/AuthGuard.tsx`
- Check role in page using `useCurrentUser()` hook for additional UI-level gating

**New API route:**
- Create `app/api/<name>/route.ts`; export `GET` or `POST` function
- For authenticated routes: verify Bearer token via `supabase.auth.getUser(token)`
- For service-role operations: create a new Supabase client with `SUPABASE_SERVICE_ROLE_KEY`

**New notification type:**
- Add type to `NotificationType` union in `types/index.ts`
- Add template function in `lib/email-templates.ts`
- Add `case` block in `app/api/notifications/route.ts`
- Call `sendNotification(type, payload)` from the relevant page

**New domain entity (Supabase table):**
- Write SQL migration in `supabase/migrations/<date>_<name>.sql`; include RLS policies
- Add TypeScript interface to `types/index.ts`
- Create hook in `hooks/use<Entity>.ts` following the pattern in `hooks/useCases.ts`

**Shared UI component:**
- Place in `components/` as PascalCase `.tsx` file
- Export as default export

**Utilities / helpers:**
- Non-React, non-UI utilities go in `lib/`
- React hooks go in `hooks/`

---

## Where Business Logic Lives

Most business logic is **co-located with page components** (`app/*/page.tsx`). There is no dedicated service layer. The exceptions:

- **Notification orchestration:** `app/api/notifications/route.ts` — decides who gets notified and how
- **Audit logging:** `lib/audit.ts` — `logAudit()` called after significant mutations
- **Email rendering:** `lib/email-templates.ts` — per-event HTML template builders
- **External CRED proxy:** `app/api/cred/route.ts` — role check, proxy call, audit write

---

## Where Data Models Are Defined

- **TypeScript types:** `types/index.ts` — single source of truth for all domain types
- **Database schema:** `supabase/migrations/*.sql` — DDL and RLS policies
- **No ORM schema files** — Supabase uses raw SQL migrations; TypeScript types are maintained manually in sync with the database

---

## Special Directories

**`.planning/`:**
- Purpose: GSD workflow planning documents
- Generated: By GSD commands (map-codebase, plan-phase, etc.)
- Committed: Depends on project workflow

**`.next/`:**
- Purpose: Next.js build output and cache
- Generated: Yes — by `next build` / `next dev`
- Committed: No (in `.gitignore`)

**`public/`:**
- Purpose: Static assets served at the root URL
- Contains: `favicon.ico`, any images or fonts not loaded via CDN
