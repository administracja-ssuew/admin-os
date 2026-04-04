# ARCHITECTURE.md
> Generated: 2026-04-04 | Focus: architecture | Mode: subsequent milestone

## Critical Version Finding

**`middleware.ts` is renamed to `proxy.ts` in Next.js 16.** The exported function must be `proxy`, not `middleware`. This directly affects the security fix for `/scores` and `/executive`. Verify the actual Next.js version in `package.json` before writing any middleware/proxy file.

The existing `AuthGuard.tsx` client-side guard cannot enforce server-side role checks. Role enforcement for protected routes requires server-side checks in the route handler / page component using `createServerClient` from `@supabase/ssr` — NOT in the proxy layer (proxy can only check cookie presence).

---

## Component Decomposition Strategy

### Current State

`app/my-department/page.tsx` is ~1300 lines with 3 render branches selected by `department.name` string-matching. One `fetchDepartmentData` function mixes auth, routing context, and business data for all three subcommittees.

### Target Structure

```
app/my-department/
  page.tsx                     (~80 lines — tab orchestrator only)

components/subcommittees/
  logistics/
    LogisticsPanel.tsx          (tab container)
    LoanRegister.tsx            (loan CRUD table)
    EquipmentDemandChart.tsx    (chart component)
    AssetInventory.tsx          (assets table)
    useLogisticsData.ts         (data hook)
  archiving/
    ArchivingPanel.tsx
    ArchiveFolders.tsx
    CaseKanban.tsx
    useArchivingData.ts
  grants/
    GrantsPanel.tsx
    GrantsRadar.tsx
    EligibilityChecklist.tsx
    useGrantsData.ts
```

### Decomposition Order (CRITICAL)

**Extract hooks BEFORE extracting JSX components.** Wrong order causes either 15-deep prop drilling or triplicated waterfall queries.

1. Extract `useLogisticsData()`, `useArchivingData()`, `useGrantsData()` hooks
2. Each hook owns its own Supabase queries and mutations
3. Only then extract JSX into panel components that consume the hooks
4. `page.tsx` becomes a thin orchestrator with a tab/section selector

### Department Type vs Name Matching

Replace `department.name === "Logistyka"` string matching with a `department_type` enum:

```sql
ALTER TABLE departments ADD COLUMN dept_type text
  CHECK (dept_type IN ('logistics', 'archiving', 'grants', 'other')) DEFAULT 'other';
```

This prevents features silently disappearing when departments are renamed.

---

## Supabase Schema Pattern for New Modules

### Pattern: Dedicated Tables Per Domain

The existing codebase confirms this pattern: `grants_radar`, `assets`, `equipment_loans`, `archive_folders`, `petitions` are all separate tables. **Do NOT use generic tables with type discriminators** — the existing code structure and RLS patterns are per-table.

### New Tables Required

```sql
-- Meeting protocols (Archiving)
CREATE TABLE meeting_protocols (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id      uuid REFERENCES meetings(id) ON DELETE CASCADE,
  created_by      uuid REFERENCES users(id),
  content         text,                    -- template-filled text
  file_url        text,                    -- uploaded file URL
  file_name       text,
  protocol_type   text CHECK (protocol_type IN ('template','upload','both')) DEFAULT 'template',
  status          text CHECK (status IN ('draft','finalized')) DEFAULT 'draft',
  created_at      timestamptz DEFAULT now(),
  finalized_at    timestamptz
);
ALTER TABLE meeting_protocols ENABLE ROW LEVEL SECURITY;

-- Honorary patronages (Grants — distinct enough for own table)
-- OR: add nullable patronage columns to grants_radar (recommended for v1 — avoids JOIN in radar view)
```

### Schema Additions to Existing Tables

```sql
-- equipment_loans
ALTER TABLE equipment_loans
  ADD COLUMN borrower_phone text,
  ADD COLUMN borrower_org text,
  ADD COLUMN loan_source text CHECK (loan_source IN ('Własny', 'Użyczony od zewnętrznego')),
  ADD COLUMN deposit_required boolean DEFAULT false,
  ADD COLUMN deposit_amount numeric(10,2);

-- assets
ALTER TABLE assets
  ADD COLUMN quantity integer DEFAULT 1,
  ADD COLUMN min_quantity integer DEFAULT 1,
  ADD COLUMN unit text DEFAULT 'szt';

-- grants_radar
ALTER TABLE grants_radar
  ADD COLUMN eligibility_criteria jsonb DEFAULT '[]',
  ADD COLUMN event_name text,
  ADD COLUMN event_date date,
  ADD COLUMN patron_identity text,
  ADD COLUMN application_url text,
  ADD COLUMN applied_at date,
  ADD COLUMN result_expected_at date;

-- archive_folders
ALTER TABLE archive_folders
  ADD COLUMN folder_type text CHECK (folder_type IN ('general','project_report')) DEFAULT 'general';

-- knowledge_articles
ALTER TABLE knowledge_articles
  ADD COLUMN article_type text DEFAULT 'guide' CHECK (article_type IN ('guide','template','regulation')),
  ADD COLUMN file_url text,
  ADD COLUMN file_name text,
  ADD COLUMN updated_by uuid REFERENCES users(id);

-- departments (for type-safe subcommittee routing)
ALTER TABLE departments
  ADD COLUMN dept_type text CHECK (dept_type IN ('logistics','archiving','grants','other')) DEFAULT 'other';
```

### RLS Template for Every New Table

Every new migration MUST include this:

```sql
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- Members can read their department's data
CREATE POLICY "dept_read" ON new_table FOR SELECT
  USING (department_id IN (
    SELECT id FROM departments WHERE id = (
      SELECT department_id FROM users WHERE id = auth.uid()
    )
  ));

-- Members can insert/update/delete their own department's data
CREATE POLICY "dept_write" ON new_table FOR ALL
  USING (department_id IN (
    SELECT id FROM departments WHERE id = (
      SELECT department_id FROM users WHERE id = auth.uid()
    )
  ));
```

---

## File Upload Pattern

### Existing Infrastructure

`FileUpload.tsx` component and `adminos-files` Supabase Storage bucket already exist. The component takes a `bucketPath` prop (confirmed in Polish char sanitization code).

### Pattern for New Modules

```typescript
// Meeting minutes upload
<FileUpload
  bucketPath={`meeting-minutes/${departmentId}/${meetingId}`}
  onUpload={(url, name) => handleProtocolUpload(url, name)}
  accept=".pdf,.doc,.docx"
/>

// Knowledge templates
<FileUpload
  bucketPath={`knowledge-templates/${articleId}`}
  onUpload={(url, name) => updateArticleFile(url, name)}
  accept=".pdf,.doc,.docx,.xlsx"
/>
```

### MIME Validation Gap

Current gap: no server-side MIME validation. Minimum fix for v1:
- Client-side `accept` attribute on file input (already done via `FileUpload.tsx`)
- Add client-side MIME type check before upload: `if (!ALLOWED_TYPES.includes(file.type)) return`
- Full server-side validation via Supabase Edge Function is v2 scope

---

## Server-Side Auth Pattern

### Current Problem

`/scores` and `/executive` are protected by `AuthGuard.tsx` (client-side only). Any user who knows the URL can potentially access the route before the client-side guard fires.

### Fix Pattern (Without `@supabase/ssr`)

Since `@supabase/ssr` is not installed, the fix uses server components with `createRouteHandlerClient`:

```typescript
// app/scores/page.tsx — convert to server component
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

  return <ScoresContent /> // Client component with the actual UI
}
```

Check actual Next.js version and installed `@supabase/*` packages before writing auth fix code — APIs differ between versions.

---

## Demand Chart Architecture

### Current Implementation

The demand chart in `my-department/page.tsx` uses **pure CSS bars** (no charting library). Groups loans by `issue_date` month. No external dependency.

### Recommendation

Keep the pure CSS approach for v1 — it works, has zero dependency weight, and matches the existing codebase style. Avoid adding Recharts/Chart.js unless the chart complexity genuinely requires it.

Enhancement needed: group by `item_category` as well as month (stacked or grouped bars). This is achievable with the same pure CSS technique using a double `reduce`:

```typescript
const chartData = loans.reduce((acc, loan) => {
  const month = loan.issue_date.slice(0, 7) // YYYY-MM
  const category = loan.item_category
  if (!acc[month]) acc[month] = {}
  acc[month][category] = (acc[month][category] || 0) + 1
  return acc
}, {} as Record<string, Record<string, number>>)
```

---

## Case Kanban for Archiving Subcommittee

The `useCases` hook and cases table already exist. The archiving Kanban is a filtered view of the existing cases system:

```typescript
// Filter cases assigned to current user's department
const { cases } = useCases()
const deptCases = cases.filter(c => c.assigned_department_id === currentUser.department_id)
```

No new table required. The existing Kanban UI component (if one exists) can be reused. If not, a simple column layout with drag-less status toggles is sufficient for v1.

---
*Research completed: 2026-04-04*
