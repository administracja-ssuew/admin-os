# STACK.md
> Generated: 2026-04-04 | Focus: tech

## Languages

**Primary:**
- TypeScript 5.x — all application code in `app/`, `components/`, `hooks/`, `lib/`, `types/`
- TSConfig target: `ES2017`, strict mode enabled, `moduleResolution: bundler`

**Secondary:**
- JavaScript (JSX) — `components/Sidebar.jsx` is the single `.jsx` file in the codebase; all other components use `.tsx`

## Runtime

**Environment:**
- Node.js (version not pinned; no `.nvmrc` or `.node-version` present)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 16.2.1 — App Router, React Server Components, built-in API Routes via `app/api/`
- React 19.2.4 — UI rendering
- React DOM 19.2.4

**Build/Dev:**
- `next dev` — local development server
- `next build` / `next start` — production build and server
- TypeScript compiler runs via `next` plugin (`noEmit: true`; Next.js handles transpilation)
- Incremental TypeScript builds enabled (`tsconfig.tsbuildinfo`)

## Frontend Libraries

**UI Icons:**
- `lucide-react` ^0.577.0 — used throughout all components and pages for icons

**Toast Notifications:**
- `react-hot-toast` ^2.6.0 — global `<Toaster position="bottom-right" />` mounted in `app/layout.tsx`

**Fonts:**
- `next/font/google` — `Inter` loaded with `subsets: ['latin']`, applied via `inter.className` on `<body>`

## Styling

**Framework:** Tailwind CSS ^4 (v4 alpha/RC series)

**Integration:**
- PostCSS plugin: `@tailwindcss/postcss` ^4 (configured in `postcss.config.mjs`)
- CSS entry: `app/globals.css` uses `@import "tailwindcss"` (v4 syntax, not `@tailwind` directives)
- Dark mode: custom variant `@custom-variant dark (&:where(.dark, .dark *))` — class-based, toggled via `document.documentElement.classList` in `components/Sidebar.jsx`
- Custom utilities defined in `@layer components`: `.softly-lifted` (shadow), `.custom-scrollbar`
- All styling via Tailwind utility classes inline in JSX; no CSS Modules or styled-components

## Backend / API Layer

**Pattern:** Next.js Route Handlers (App Router) in `app/api/`

**Routes:**
- `app/api/cred/route.ts` — proxy to external Google Apps Script CRED API; handles auth, RBAC, and audit logging
- `app/api/notifications/route.ts` — POST handler: creates in-app notifications in Supabase and sends emails via Resend
- `app/api/notifications/deadline-check/route.ts` — GET handler: cron-style endpoint that scans tasks with tomorrow's deadline and fires notifications

**No separate backend process** — all server logic runs as Next.js Route Handlers.

## Database and Data Access

**Database:** Supabase (PostgreSQL hosted)

**Client:** `@supabase/supabase-js` ^2.99.3

**Client initialization:** `lib/supabase.ts` — single exported `supabase` singleton using anon key (public, browser-safe)

**Server-side usage:** API routes instantiate a new `createClient` per request, optionally using `SUPABASE_SERVICE_ROLE_KEY` for elevated access (deadline-check cron, notifications route)

**ORM:** None — raw Supabase query builder (`.from().select().eq()` etc.)

**Key tables referenced in code:**
- `users` — system roles, departments, profile data
- `tasks` — task tracking with deadlines, checklists, attachments
- `cases` — case registry
- `notifications` — in-app notification inbox
- `audit_log` — mutation history
- `departments`, `projects`, `meetings`, `documents`, `knowledge` (inferred from type definitions in `types/index.ts`)

## Authentication / Authorization

**Provider:** Supabase Auth (email/password assumed; no OAuth providers detected in code)

**Session management:** `supabase.auth.getSession()` called client-side; `supabase.auth.getUser(token)` called server-side in API routes using Bearer token from `Authorization` header

**Authorization guard:** `components/AuthGuard.tsx` wraps all routes in `app/layout.tsx`
- Routes: public (`/login`, `/wniosek/*`), authenticated, admin-only (`/executive`, `/users`)
- Roles: `pending`, `active`, `inactive`, `admin`, `superadmin` — stored in `users.system_role`
- Pending accounts poll every 15 seconds waiting for approval

**API-level RBAC:** `app/api/cred/route.ts` verifies `system_role` in `users` table before allowing mutation actions

## Build Tooling

**Bundler:** Next.js built-in (webpack/Turbopack under the hood)
**Transpiler:** Next.js TypeScript pipeline (`tsconfig.json` `noEmit: true`)
**Linter:** ESLint ^9 with `eslint-config-next` 16.2.1 (core-web-vitals + typescript rules), configured in `eslint.config.mjs`
**No formatter config detected** (no `.prettierrc`, `biome.json`, etc.)

## Path Aliases

Configured in `tsconfig.json`:
- `@/*` → `./*` (project root)

## Notable Scripts (`package.json`)

```json
"dev":   "next dev"
"build": "next build"
"start": "next start"
"lint":  "eslint"
```

No test runner script present — no testing framework detected.

---

*Stack analysis: 2026-04-04*
