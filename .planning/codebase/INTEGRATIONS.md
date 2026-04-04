# INTEGRATIONS.md
> Generated: 2026-04-04 | Focus: tech

## APIs & External Services

### Supabase
- **Purpose:** Primary database (PostgreSQL), authentication, and real-time storage
- **SDK:** `@supabase/supabase-js` ^2.99.3
- **Client file:** `lib/supabase.ts`
- **Auth:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser-safe, public)
- **Server elevated access:** `SUPABASE_SERVICE_ROLE_KEY` (server-only, used in `app/api/notifications/route.ts` and `app/api/notifications/deadline-check/route.ts`)
- **Usage pattern:** Singleton client exported from `lib/supabase.ts` for client components; fresh `createClient` per API route handler for server-side requests

### Resend (Email)
- **Purpose:** Transactional email delivery for notifications (task assignments, case status changes, meeting invites, deadline reminders, external submission confirmations)
- **SDK:** `resend` ^6.10.0
- **Integration file:** `lib/email.ts`
- **Auth:** `RESEND_API_KEY` (server-only)
- **From address:** Configurable via `NOTIFICATION_FROM_EMAIL` env var; defaults to `AdminOS <system@komisja.pl>`
- **Email templates:** `lib/email-templates.ts` — provides `taskAssignedTemplate`, `caseStatusChangeTemplate`, `newMeetingTemplate`, `caseCommentTemplate`, `externalSubmissionAdminTemplate`, `externalSubmissionConfirmationTemplate`, `deadlineReminderTemplate`
- **HTML wrapping:** All outgoing emails are wrapped in a branded HTML shell by `wrapInTemplate()` in `lib/email.ts`

### CRED API (Google Apps Script)
- **Purpose:** External case registry system (CRED = likely an acronym for an internal document tracking system); the app proxies all CRED read/write operations through `app/api/cred/route.ts`
- **Protocol:** HTTP GET to a Google Apps Script web app URL with query parameters
- **Auth:** Bearer token in `Authorization` header (verified against Supabase session), plus `CRED_TOKEN` appended to every outgoing request as a query parameter
- **Endpoints used:**
  - Read actions: `getList`, (others — not enumerated in code beyond `MUTATION_ACTIONS`)
  - Mutation actions: `setStatus`, `setOwner`, `setSLA`, `addNote` — require `admin` or `superadmin` role
- **Audit logging:** All successful mutations are written to `audit_log` table via `lib/audit.ts`

## Data Storage

**Database:**
- Supabase (hosted PostgreSQL)
- Connection: `NEXT_PUBLIC_SUPABASE_URL`
- Client: `@supabase/supabase-js` — no ORM, raw query builder

**File Storage:**
- Supabase Storage is referenced structurally (attachments on `Task` and `Case` types have `url` fields), but no direct `supabase.storage` calls were found in the explored source files. Upload UI exists at `components/FileUpload.tsx`.

**Caching:**
- None detected — no Redis, in-memory cache, or CDN cache configuration present

## Authentication & Identity

**Auth Provider:** Supabase Auth
- Implementation: `supabase.auth.getSession()` client-side; Bearer token passed in `Authorization` header to API routes
- Guard component: `components/AuthGuard.tsx` wraps the entire app via `app/layout.tsx`
- Role system: custom `system_role` column on `users` table (`pending` | `active` | `inactive` | `admin` | `superadmin`)
- No OAuth/social login detected in source

## Monitoring & Observability

**Error Tracking:** None detected (no Sentry, Datadog, etc.)

**Logs:**
- `console.error()` used for email send failures (`lib/email.ts`), audit log errors (`lib/audit.ts`), notification errors (`app/api/notifications/route.ts`), deadline check errors
- No structured logging framework

**Audit Trail:**
- `lib/audit.ts` writes to `audit_log` Supabase table for CRED mutations; fields: `user_id`, `action`, `entity_type`, `entity_id`, `old_value`, `new_value`

## CI/CD & Deployment

**Hosting:** Vercel (strongly implied — `public/vercel.svg` present; deadline-check route comment says "Wywołać jako cron (np. Vercel Cron Job co 24h)")

**CI Pipeline:** Not detected (no `.github/workflows/`, no CI config files)

**Cron jobs:** `app/api/notifications/deadline-check` is designed as a Vercel Cron Job endpoint (no `vercel.json` with cron config was found in the file listing, but the endpoint accepts an optional `?secret=` query parameter for verification)

## Environment Variables

All variables referenced across the codebase:

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public (browser + server) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (browser + server) | Supabase anonymous key for client-side queries |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Elevated Supabase access for server-side API routes (falls back to anon key if absent) |
| `RESEND_API_KEY` | Server-only | Resend email service authentication |
| `NOTIFICATION_FROM_EMAIL` | Server-only | From address for outgoing emails; defaults to `AdminOS <system@komisja.pl>` |
| `NEXT_PUBLIC_APP_URL` | Public | Base URL used in email template links; defaults to `http://localhost:3000` |
| `CRED_API_URL` | Server-only | Google Apps Script endpoint URL for the CRED system |
| `CRED_TOKEN` | Server-only | Auth token appended to all CRED API requests |
| `CRON_SECRET` | Server-only | Optional secret to protect `/api/notifications/deadline-check` from unauthorized invocation |
| `REACT_EDITOR` | Dev only | Editor hint for React error overlay (set to `code` in `.env.local.example`) |

**Example file:** `.env.local.example` (committed) — documents `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `CRED_API_URL`, `CRED_TOKEN`

**Secrets location:** `.env.local` (not committed; listed in `.gitignore`)

## Webhooks & Callbacks

**Incoming webhooks:** None detected

**Outgoing calls:**
- `lib/email.ts` → Resend API (via `resend` SDK)
- `app/api/cred/route.ts` → Google Apps Script CRED endpoint (plain `fetch`)
- `lib/notify.ts` → internal `/api/notifications` endpoint (via `fetch` with Bearer token)

## Feature Flags / A/B Testing

None detected.

---

*Integration audit: 2026-04-04*
