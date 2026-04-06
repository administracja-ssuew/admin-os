# Phase 1: Security Hardening & Stability - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Close 4 confirmed security vulnerabilities (SEC-01 through SEC-06) and 4 data integrity defects (STAB-01 through STAB-04) in the existing codebase. All changes are surgical modifications to existing files — no new npm packages, no new routes (except the external notifications endpoint). Plans must execute in strict sequential order as documented in ROADMAP.md.

</domain>

<decisions>
## Implementation Decisions

### SEC-01: Server-Side Auth Guard
- **D-01:** Use **Server Component wrapper** (not proxy.ts) for `/scores` and `/executive`. The outer `page.tsx` becomes an async Server Component that reads cookies, creates a Supabase client, and verifies `users.system_role === 'superadmin'` via DB query before rendering. The existing `'use client'` UI code moves to a sub-component (e.g., `ScoresClientPage`, `ExecutiveClientPage`).
- **D-02:** Auth failure behavior: redirect to `/` **with a Polish toast** message `'Brak dostępu do tej strony'`. No separate error page. Unauthenticated users redirect to `/login`; authenticated non-superadmin users redirect to `/` with toast.

### SEC-03: External Notifications Endpoint Secret
- **D-03:** Use a **new dedicated env var `EXTERNAL_NOTIFICATIONS_SECRET`** (not CRON_SECRET). Must be documented in `.env.local.example` and added to all environments (local, staging, production). Rotating it must not affect CRON_SECRET or vice versa.

### SEC-06: Missing Service Key Behavior
- **D-04:** When `SUPABASE_SERVICE_ROLE_KEY` is absent, **fail at request time** (throw/return 500 on the specific API call). Do not throw on module load — app should still start in environments where the key isn't set locally. The `.env.local.example` file must document that this key is required in production.

### STAB-01: case_number Generation
- **D-05:** Generate `case_number` via a **Postgres sequence + trigger** (not API route logic). Migration adds a DB sequence; the trigger fires on INSERT and sets `case_number` automatically. The API route inserts without supplying `case_number`. This eliminates the race condition window that exists in the current client-side approach.

### STAB-04: Mutation Error Coverage and Message Format
- **D-06:** Fix silent errors **only in the confirmed-broken files**: `app/users/page.tsx` and `app/my-department/page.tsx`. Do not attempt to audit all mutation handlers in Phase 1.
- **D-07:** Use **operation-specific Polish error messages** (not a generic fallback). Each mutation handler gets a tailored message, e.g.: `'Nie udało się zaktualizować roli'`, `'Nie udało się usunąć użytkownika'`, `'Nie udało się zapisać notatki'`. Surface via `react-hot-toast` (already installed as `toast.error(...)`).

### Claude's Discretion
- Exact cookie parsing approach for Server Component auth guard (research provides a pattern — follow it)
- RLS migration file naming convention (follow existing migration date-prefix pattern in `supabase/migrations/`)
- Exact error message wording for each mutation (follow Polish UI conventions, keep messages concise)
- STAB-02 (department_notes UPSERT) and STAB-03 (Realtime cleanup) — no user-specific preferences; implement as documented in ROADMAP and RESEARCH

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Next.js 16 — Breaking Changes (CRITICAL)
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` — proxy.ts (renamed middleware), export named `proxy` not `middleware`
- `node_modules/next/dist/docs/` — read relevant sections before writing any Next.js code; APIs differ from training data

### Phase Research
- `.planning/phases/01-security-hardening-stability/01-RESEARCH.md` — Confirmed code locations, patterns for all 10 requirements, critical sequencing rules

### Existing Code Locations (from RESEARCH.md)
- `app/api/notifications/route.ts` line 13 — SEC-06 dangerous fallback location
- `app/api/notifications/deadline-check/route.ts` lines 7 and 14–19 — SEC-05, SEC-06 locations
- `app/wniosek/page.tsx` lines 120–121 — STAB-01 client-side case_number generation
- `app/my-department/page.tsx` lines 108–110 — STAB-02 race condition
- `components/NotificationBell.tsx` lines 17–38 — STAB-03 Realtime cleanup bug
- `app/users/page.tsx` — STAB-04 silent error location
- `lib/notify.ts` `sendNotification()` — SEC-03 call site to update after endpoint split

### Project Conventions
- `.planning/codebase/CONVENTIONS.md` — naming, import order, TypeScript patterns
- `.planning/codebase/ARCHITECTURE.md` — system structure

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `react-hot-toast` (installed ^2.6.0): Use `toast.error(...)` for STAB-04 mutation error surfacing — no new package needed
- `supabase` client from `lib/supabase.ts`: Existing anon-key client; server-side guards need a new `createClient` call with cookie-based session
- `logAudit()` from `lib/audit.ts`: Already used for audit logging — no changes needed for SEC-04 (RLS handles this at DB level)

### Established Patterns
- API routes: `route.ts` in `app/api/[name]/` — follow for new `app/api/notifications/external/route.ts`
- Relative imports only (no `@/` alias despite it being in tsconfig)
- Error handling: `toast.error(...)` from `react-hot-toast` is the established pattern for user-facing errors

### Integration Points
- `/wniosek/page.tsx` → must update to call `/api/notifications/external` after SEC-03 endpoint is live
- `app/scores/page.tsx` and `app/executive/page.tsx` → outer wrapper becomes Server Component; inner UI moves to sub-component
- `supabase/migrations/` → SEC-04 RLS fix, STAB-01 sequence, STAB-02 UNIQUE constraint all need new migration files

</code_context>

<specifics>
## Specific Ideas

- The toast message for unauthorized access: `'Brak dostępu do tej strony'`
- Operation-specific error messages should be in Polish, concise, and follow the pattern `'Nie udało się [verb] [object]'`
- `.env.local.example` must document both `EXTERNAL_NOTIFICATIONS_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` (with a note that the service key is required in production)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-security-hardening-stability*
*Context gathered: 2026-04-04*
