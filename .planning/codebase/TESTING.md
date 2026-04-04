# TESTING.md
> Generated: 2026-04-04 | Focus: quality

## Test Framework

**No test framework is installed or configured.**

Inspection of `package.json` confirms zero test dependencies:
- No Jest, Vitest, Playwright, Cypress, or any testing library in `dependencies` or `devDependencies`
- No `jest.config.*`, `vitest.config.*`, or `playwright.config.*` files exist
- No test script defined in `package.json` (`scripts` contains only `dev`, `build`, `start`, `lint`)

There are **zero test files** (`.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`) anywhere in the project source tree.

---

## Test Coverage

**Overall coverage: 0%**

No production code is tested. This applies to:
- All pages under `app/` (21 files)
- All components under `components/` (8 files)
- All custom hooks under `hooks/` (4 files)
- All library utilities under `lib/` (5 files)
- All API routes under `app/api/` (3 files)
- All type definitions in `types/index.ts`

---

## What Is Not Tested (Full Inventory)

### Critical paths with no tests

**Authentication (`components/AuthGuard.tsx`, `app/login/page.tsx`):**
- Login/register/password reset flows
- Role-based access control (`ADMIN_ROUTES` guard)
- Pending account polling behavior

**Data hooks (`hooks/`):**
- `useCurrentUser` — session loading and user resolution
- `useTasks` — parallel data fetching and realtime subscription teardown
- `useCases` — realtime channel lifecycle
- `useUsers` — role filtering

**Business logic (`lib/`):**
- `lib/audit.ts` — `logAudit()` Supabase insert behavior
- `lib/notify.ts` — `sendNotification()` fetch with auth token, fire-and-forget error handling
- `lib/email.ts` — `sendEmail()` Resend API call, HTML template wrapping
- `lib/email-templates.ts` — template output for each notification type

**API routes (`app/api/`):**
- `POST /api/notifications` — all 5 notification type handlers (`task_assigned`, `case_status_changed`, `case_comment`, `new_meeting`, `external_submission`)
- `GET /api/notifications/deadline-check` — deadline scanning and notification dispatch
- `GET/POST /api/cred` — credential management

**Public intake form (`app/wniosek/page.tsx`):**
- Form validation (`fieldErrors` logic)
- Honeypot spam detection (`website` field check)
- Case number generation pattern

**Components:**
- `SkeletonLoader` — variant switching (`card`, `table-row`, `kanban-column`)
- `EmptyState` — conditional rendering of action button
- `ConfirmDialog` — variant styling (`danger` vs `warning`), open/close behavior
- `NotificationBell` — unread count, mark-as-read, realtime subscription
- `FilterBar`, `GlobalSearch`, `FileUpload` — all untested

---

## CI/CD

No CI/CD pipeline configuration exists in the repository. There are no:
- GitHub Actions workflow files (`.github/workflows/`)
- CircleCI, GitLab CI, or similar config files
- Automated test execution on push or pull request

---

## Recommendations for Adding Tests

If tests are introduced, the following setup is recommended based on the existing stack (Next.js 16, React 19, TypeScript):

**Recommended framework:** Vitest + React Testing Library
```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event jsdom
```

**Suggested `vitest.config.ts` placement:** Project root alongside `next.config.ts`

**Suggested test file location:** Co-located with source files using `.test.ts` / `.test.tsx` suffix:
```
hooks/useCurrentUser.test.ts
lib/notify.test.ts
lib/email.test.ts
components/SkeletonLoader.test.tsx
components/EmptyState.test.tsx
```

**Highest-value tests to write first (by risk):**

1. `lib/notify.ts` — `sendNotification()` should be testable by mocking `fetch`
2. `lib/audit.ts` — `logAudit()` should be testable by mocking Supabase client
3. `lib/email-templates.ts` — pure functions returning HTML strings, zero dependencies, trivially testable
4. `components/EmptyState.tsx` — stateless presentational component, simple to snapshot-test
5. `components/ConfirmDialog.tsx` — modal open/close and variant rendering
6. Public form validation in `app/wniosek/page.tsx` — field error logic is self-contained
7. `POST /api/notifications` route — switch/case dispatch logic benefits from unit testing each branch
