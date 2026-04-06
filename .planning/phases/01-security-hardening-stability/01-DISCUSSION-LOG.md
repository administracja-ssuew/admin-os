# Phase 1: Security Hardening & Stability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 01-security-hardening-stability
**Areas discussed:** Auth guard approach, Auth failure behavior, STAB-04 error coverage scope, Missing service key behavior, case_number generation, Toast error messages, External secret naming

---

## Auth Guard Approach (SEC-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Server Component wrapper | Outer page.tsx becomes async Server Component — verifies session + superadmin role via DB before rendering. Exact role enforcement. UI code moves to ScoresClientPage sub-component. | ✓ |
| proxy.ts guard | Edge middleware intercepts requests — faster, but can only check if a session cookie exists (not the role). Would pass through non-superadmin authenticated users. | |

**User's choice:** Server Component wrapper
**Notes:** Research confirmed proxy.ts cannot do DB queries (performance constraint), so role-based access requires Server Component approach.

---

## Auth Failure Behavior (SEC-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Silent redirect to / | User is quietly sent to the dashboard. No message. | |
| Redirect to / with a toast | Redirect to dashboard + Polish error toast: 'Brak dostępu do tej strony'. Consistent with STAB-04 error visibility goal. | ✓ |
| Dedicated 'Brak dostępu' page | Separate error page explaining the user lacks permissions. More explicit but adds a new page. | |

**User's choice:** Redirect to / with toast message `'Brak dostępu do tej strony'`
**Notes:** Unauthenticated users → `/login`, authenticated non-superadmin → `/` with toast.

---

## STAB-04 Error Coverage Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Only confirmed-broken files | Fix users/page.tsx and my-department/page.tsx — the two files research confirmed have silent errors. Surgical, low risk. | ✓ |
| All mutation handlers in the app | Audit every .insert(), .update(), .delete() call across all pages. More comprehensive but higher scope. | |

**User's choice:** Only confirmed-broken files (users/page.tsx, my-department/page.tsx)
**Notes:** Keeping Phase 1 surgical. Broader audit could be Phase 2+ if needed.

---

## Missing Service Key Behavior (SEC-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Fail at request time | Throw/500 when the API route is called without the key. App can still start. | ✓ |
| Fail at startup | Throw on module load — app won't start without the key. Breaks local dev if key not set. | |

**User's choice:** Fail at request time
**Notes:** Allows local dev without the service key; production will always have it.

---

## case_number Generation Approach (STAB-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Postgres sequence + trigger | DB-level sequence auto-increments atomically. No race condition. Migration adds sequence + trigger. | ✓ |
| API route handler logic | Query MAX(case_number) + 1 before insert. Has race condition window under concurrent load. | |

**User's choice:** Postgres sequence + trigger
**Notes:** Current bug is client-side generation at wniosek/page.tsx lines 120-121. Sequence+trigger is the clean fix.

---

## Toast Error Message Format (STAB-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Operation-specific Polish messages | Each mutation has a tailored message: 'Nie udało się zaktualizować roli', etc. | ✓ |
| Generic fallback message | 'Wystąpił błąd. Spróbuj ponownie.' for all mutations. | |

**User's choice:** Operation-specific Polish messages
**Notes:** Polish UI convention. Pattern: `'Nie udało się [verb] [object]'`

---

## External Secret Naming (SEC-03)

| Option | Description | Selected |
|--------|-------------|----------|
| New dedicated var: EXTERNAL_NOTIFICATIONS_SECRET | Clear purpose, can be rotated independently of CRON_SECRET. | ✓ |
| Reuse CRON_SECRET | One fewer env var, but couples two unrelated systems. | |

**User's choice:** EXTERNAL_NOTIFICATIONS_SECRET
**Notes:** Must be added to .env.local.example and all environments.

---

## Claude's Discretion

- Exact cookie parsing approach for Server Component auth guard
- RLS migration file naming (follow existing date-prefix pattern)
- Exact wording of operation-specific error messages
- STAB-02 and STAB-03 implementation details (no preferences expressed)
