---
phase: 01-security-hardening-stability
plan: 02
subsystem: api
tags: [nextjs, server-action, notifications, security, env-vars]

# Dependency graph
requires:
  - phase: 01-01
    provides: EXTERNAL_NOTIFICATIONS_SECRET env var documented in .env.local.example
provides:
  - Dedicated /api/notifications/external endpoint protected by x-external-secret header
  - Server Action notifyExternalSubmission that reads secret server-side
  - /wniosek form triggering notifications without exposing secrets to browser bundle
affects: [01-03, 01-04, any plan touching /api/notifications or /wniosek]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Action pattern: 'use server' keeps env secrets out of browser bundle"
    - "Dedicated endpoint per caller type: external unauthenticated callers get own endpoint with shared-secret auth"

key-files:
  created:
    - app/api/notifications/external/route.ts
    - app/actions/notifyExternalSubmission.ts
  modified:
    - app/wniosek/page.tsx
    - .env.local.example

key-decisions:
  - "Used Server Action (not NEXT_PUBLIC_ env var) to keep EXTERNAL_NOTIFICATIONS_SECRET out of browser JS bundle"
  - "New /api/notifications/external endpoint rejects all types except external_submission (type guard)"
  - "NEXT_PUBLIC_APP_URL used as baseUrl fallback to localhost:3000 for Server Action fetch"

patterns-established:
  - "Server Action pattern: client component calls 'use server' action, action calls internal API with secret — secret never exposed"
  - "Endpoint type guard: each dedicated endpoint validates type at entry point, returns 400 on mismatch"

requirements-completed: [SEC-03]

# Metrics
duration: 2min
completed: 2026-04-06
---

# Phase 1 Plan 2: External Notifications Endpoint Summary

**Dedicated `/api/notifications/external` endpoint with x-external-secret auth + Server Action wrapper keeps `EXTERNAL_NOTIFICATIONS_SECRET` out of browser JS bundle**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-06T01:42:18Z
- **Completed:** 2026-04-06T01:44:08Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `app/api/notifications/external/route.ts` — dedicated endpoint for public form submissions, validates `x-external-secret` header, rejects non-`external_submission` types with 400
- Created `app/actions/notifyExternalSubmission.ts` — `'use server'` action reads `EXTERNAL_NOTIFICATIONS_SECRET` server-side and calls the external endpoint
- Updated `app/wniosek/page.tsx` — replaced `sendNotification()` call with Server Action; removed `sendNotification` import entirely
- Added `NEXT_PUBLIC_APP_URL` to `.env.local.example` for Server Action internal fetch base URL

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /api/notifications/external/route.ts** - `f844604` (feat)
2. **Task 2: Create Server Action and update /wniosek/page.tsx** - `cfc0515` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `app/api/notifications/external/route.ts` - Secret-protected endpoint for external_submission notifications; returns 401 on wrong secret, 400 on wrong type
- `app/actions/notifyExternalSubmission.ts` - Server Action with `'use server'`; reads `EXTERNAL_NOTIFICATIONS_SECRET` server-side, calls external endpoint
- `app/wniosek/page.tsx` - Replaced `sendNotification('external_submission', ...)` with `notifyExternalSubmission(...)` Server Action call
- `.env.local.example` - Added `NEXT_PUBLIC_APP_URL` variable documentation

## Decisions Made

- Used a Next.js Server Action to bridge the `'use client'` form and the secret-protected API — this prevents `EXTERNAL_NOTIFICATIONS_SECRET` from ever needing a `NEXT_PUBLIC_` prefix
- `/api/notifications/external` is a dedicated endpoint (not a flag on the main endpoint) — this makes it possible to add session-based auth to the main endpoint in Plan 03 without affecting the public form flow
- `NEXT_PUBLIC_APP_URL` fallback to `http://localhost:3000` ensures dev environment works without additional config

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — `EXTERNAL_NOTIFICATIONS_SECRET` was already documented in `.env.local.example` by Plan 01. `NEXT_PUBLIC_APP_URL` was added in this plan.

## Next Phase Readiness

- `/api/notifications/external` is isolated from the main endpoint — Plan 03 can now safely add session/token auth to `POST /api/notifications` without breaking the public `/wniosek` form
- Server Action pattern established — reusable for other server-side secret operations

## Self-Check: PASSED

- FOUND: app/api/notifications/external/route.ts
- FOUND: app/actions/notifyExternalSubmission.ts
- FOUND commit f844604 (Task 1)
- FOUND commit cfc0515 (Task 2)

---
*Phase: 01-security-hardening-stability*
*Completed: 2026-04-06*
