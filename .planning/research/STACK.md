# STACK.md
> Generated: 2026-04-04 | Focus: stack + security | Mode: subsequent milestone

## Current Stack (Locked)

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 15.x (verify in package.json — breaking changes at 16) |
| Runtime | Node.js | 20+ |
| Database/Auth/Storage | Supabase | latest |
| Supabase client | @supabase/supabase-js | 2.x |
| Auth helpers | @supabase/auth-helpers-nextjs | installed (verify) |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.x |
| Email | Resend | latest |
| Package manager | npm |  |

**Do NOT add new heavy dependencies.** The codebase is intentionally lean. New features should reuse existing patterns.

---

## Security Hardening Patterns

### Problem 1: Client-Side Only Auth on `/scores` and `/executive`

**Current:** `AuthGuard.tsx` wraps the app but role checks happen client-side after hydration. Protected routes are accessible by URL until the client guard fires.

**Fix Pattern (without installing `@supabase/ssr`):**

```typescript
// app/scores/page.tsx — server component guard
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function ScoresPage() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (user?.role !== 'superadmin') redirect('/dashboard')

  // Render the actual UI as a client component below
  return <ScoresClientPage />
}
```

**IMPORTANT:** Check actual Next.js version in `package.json`. If Next.js 16+, `middleware.ts` is renamed `proxy.ts` and the export must be `proxy`, not `middleware`.

**Confidence:** HIGH — `@supabase/auth-helpers-nextjs` `createServerComponentClient` is the correct API for Next.js App Router without `@supabase/ssr`.

---

### Problem 2: Unauthenticated POST to `/api/notifications`

**Current:** Any client (or external actor) can POST to `/api/notifications` without a bearer token.

**Fix — Two-Phase Approach (order matters):**

Phase A (do first): Create `/api/notifications/external` with its own secret for public form (`/wniosek`) submissions:
```typescript
// app/api/notifications/external/route.ts
const EXTERNAL_SECRET = process.env.EXTERNAL_NOTIFICATIONS_SECRET
if (request.headers.get('x-external-secret') !== EXTERNAL_SECRET) {
  return new Response('Unauthorized', { status: 401 })
}
```

Phase B (do second, after Phase A is live): Add user session auth to main `/api/notifications`:
```typescript
const authHeader = request.headers.get('authorization')
const token = authHeader?.replace('Bearer ', '')
const { data: { user } } = await supabase.auth.getUser(token)
if (!user) return new Response('Unauthorized', { status: 401 })
```

**Do NOT do Phase B before Phase A** — the public `/wniosek` form has no session and will silently lose all notifications.

---

### Problem 3: Overly Permissive RLS on `notifications`

**Current:** INSERT policy allows any authenticated user to insert notifications for any `user_id`.

**Fix:**
```sql
-- Drop the permissive policy
DROP POLICY IF EXISTS "users_can_insert_notifications" ON notifications;

-- Only service role can insert (notifications created via API route with service key)
CREATE POLICY "service_role_only_insert" ON notifications
  FOR INSERT WITH CHECK (false); -- Blocked for all JWT users; service key bypasses RLS

-- Users can only read their own notifications
CREATE POLICY "users_read_own" ON notifications
  FOR SELECT USING (user_id = auth.uid());

-- Users can update (mark read) their own notifications
CREATE POLICY "users_update_own" ON notifications
  FOR UPDATE USING (user_id = auth.uid());
```

**Prerequisite:** Verify `SUPABASE_SERVICE_ROLE_KEY` is present in all environments before tightening. The API route fallback to anon key must be removed:
```typescript
// BEFORE (dangerous fallback):
const supabaseAdmin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

// AFTER (fail loudly):
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
const supabaseAdmin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY)
```

---

### Problem 4: Cron Secret Optional

**Fix:**
```typescript
// app/api/notifications/deadline-check/route.ts
const CRON_SECRET = process.env.CRON_SECRET
if (!CRON_SECRET) throw new Error('Missing CRON_SECRET env var')
if (request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
  return new Response('Unauthorized', { status: 401 })
}
```

---

## Chart Library Recommendation

**Recommendation: Keep the existing pure CSS bar chart for v1.**

The current demand chart uses pure CSS bars with a `reduce` over loan data. It works, has zero dependency weight, and is consistent with the codebase's lean approach.

**If chart complexity grows beyond what CSS bars handle** (e.g., stacked categories, tooltips, date range axis), evaluate:

| Library | Bundle Size | Pros | Cons |
|---------|------------|------|------|
| **Recharts** | ~160KB | React-native, good docs, Tailwind-compatible | Largest bundle |
| **Chart.js + react-chartjs-2** | ~60KB | Smallest, most features | Imperative API |
| **Tremor** | ~40KB | Tailwind-native, admin-UI focused | Limited customization |

For this project's scale (10-30 users, internal tool), Tremor is the best fit if a library becomes necessary — its admin-UI components match the existing aesthetic. But v1 does not need it.

---

## TypeScript Fixes

**60+ `any` usages must be addressed before new modules add more.**

Priority types to define in `types/index.ts` before feature development:

```typescript
// New module types
interface EquipmentLoan {
  id: string
  agreement_number: string
  item_category: string
  borrower_name: string
  borrower_phone?: string
  borrower_org?: string
  loan_source?: 'Własny' | 'Użyczony od zewnętrznego'
  issue_date: string
  return_date: string
  status: 'Wypożyczone' | 'Zwrócone'
  deposit_required?: boolean
  deposit_amount?: number
  department_id: string
}

interface Grant {
  id: string
  signature?: string
  name: string
  organizer: string
  type: 'DOTACJA' | 'PATRONAT'
  max_amount?: number
  deadline: string
  status: 'RADAR' | 'W TOKU' | 'ARCHIWUM'
  decision: 'OCZEKUJE' | 'ZAAKCEPTOWANE' | 'ODRZUCONE'
  eligibility_criteria: EligibilityCriterion[]
  // patronat fields
  event_name?: string
  event_date?: string
  patron_identity?: string
}

interface EligibilityCriterion {
  id: string
  label: string
  status: 'met' | 'unmet' | 'pending'
}

interface MeetingProtocol {
  id: string
  meeting_id: string
  created_by: string
  content?: string
  file_url?: string
  file_name?: string
  protocol_type: 'template' | 'upload' | 'both'
  status: 'draft' | 'finalized'
  created_at: string
  finalized_at?: string
}
```

---

## Dependency Decisions

| Dependency | Decision | Rationale |
|------------|----------|-----------|
| `react-markdown` | ADD | ~5KB, zero risk, unlocks step-by-step formatting in KB |
| Recharts / Chart.js | SKIP v1 | Pure CSS chart is sufficient; add only if requirements grow |
| TipTap / Quill WYSIWYG | SKIP | Textarea + react-markdown is sufficient and consistent |
| `@supabase/ssr` | EVALUATE | Better server-side auth API; requires refactoring existing auth helpers calls |
| DOMPurify | CONSIDER | Needed if `dangerouslySetInnerHTML` is kept; better to switch to react-markdown |

---
*Research completed: 2026-04-04*
