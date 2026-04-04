# FEATURES.md
> Generated: 2026-04-04 | Focus: features | Mode: subsequent milestone

## Key Finding: More Exists Than Requirements Imply

The `my-department/page.tsx` monolith already contains working implementations of: asset inventory, loan register, loan demand bar chart, logistics reports, grants radar with drawer + filters, archive folders with file upload, and petition register. The "missing features" are **gaps within existing modules**, not net-new systems.

---

## Baseline: What Already Exists

### Logistics (Logistyka) — Already Built
- Asset/inventory cards: `assets` table with `name`, `asset_type`, `status`, `location`, `notes`
- Status states: `available`, `low_stock`, `maintenance`
- Asset types: Artykuły biurowe, Sprzęt IT, Meble, Audio-Video, Inne
- Loan register (`equipment_loans`): `agreement_number`, `item_category`, `borrower_name`, `issue_date`, `return_date`, `status` (Wypożyczone / Zwrócone)
- Loan toggle (Wypożyczone → Zwrócone one-click)
- Demand bar chart: groups loans by `issue_date` month, pure CSS bars (no library)
- Logistics reports (`reports` table): title, content, status pipeline
- Summary stats: total assets, active loans, maintenance count

### Grants (Granty) — Already Built
- Grant radar (`grants_radar`): `signature`, `name`, `organizer`, `type` (DOTACJA / PATRONAT), `max_amount`, `scope`, `deadline`, `status` (RADAR / W TOKU / ARCHIWUM), `decision`, `drive_link`, `description`, `notes`
- Grant table with search + 2-dimension filter (status + type)
- Grant detail drawer (slide-over panel)
- Summary stats: count, accepted count, total amount (PLN)

### Archiving (Archiwizacja) — Already Built
- Archive folders (`archive_folders`): `title`, `status` (W przygotowaniu / Przekazane do Archiwum), `notes`, `attachments` JSONB
- File upload to Supabase Storage with Polish char sanitization
- Petition/letter register (`petitions`): `title`, `recipient`, `submission_date`, `status`, `attachments` JSONB
- Detail drawer with attachment list
- Link to `/meetings` (labeled "Generator Protokołów" — dead link, no actual protocol creation)

### Knowledge Base — Already Built
- `knowledge_articles`: `id`, `title`, `content`, `category`, `drive_link`, `updated_at`
- Left-sidebar navigation grouped by category
- Full CRUD for admins
- Plaintext textarea editor
- Search by title

---

## Module 1: Logistics (Logistyka)

### What's Missing (Table Stakes)

| Feature | Complexity | Notes |
|---------|------------|-------|
| Loan contract: borrower contact, loan source, deposit info | Low | `borrower_phone`, `borrower_org`, `loan_source`, `deposit_required`, `deposit_amount` fields |
| Overdue loan detection + visual highlight | Low | Date comparison `return_date < today && status = 'Wypożyczone'` |
| Asset `quantity` field for consumables (paper, envelopes) | Low | `quantity`, `min_quantity`, `unit` columns on `assets` |
| Low-stock threshold flag | Low | Auto-flag when `quantity < min_quantity` |
| Audit trail on loan status changes | Low | Call existing `logAudit()` on `toggleLoanStatus` |

### Differentiators (Nice to Have)

| Feature | Complexity | V1? |
|---------|------------|-----|
| Overdue notification via existing pipeline | Medium | No |
| Demand chart category breakdown | Medium | No — current chart functional |
| CSV export of loan history | Medium | No |

### Anti-Features (Do NOT Build in v1)

- QR code / barcode scanning — overkill for 10-30 users
- Multi-location warehouse management — single location
- Automated inventory reordering — no procurement system

### Schema Additions

```sql
ALTER TABLE equipment_loans
  ADD COLUMN borrower_phone text,
  ADD COLUMN borrower_org text,
  ADD COLUMN loan_source text CHECK (loan_source IN ('Własny', 'Użyczony od zewnętrznego')),
  ADD COLUMN deposit_required boolean DEFAULT false,
  ADD COLUMN deposit_amount numeric(10,2);

ALTER TABLE assets
  ADD COLUMN quantity integer DEFAULT 1,
  ADD COLUMN min_quantity integer DEFAULT 1,
  ADD COLUMN unit text DEFAULT 'szt';
```

---

## Module 2: Archiving (Archiwizacja)

### What's Missing (Table Stakes)

| Feature | Complexity | Notes |
|---------|------------|-------|
| Meeting minutes template editor on `/meetings` | Medium | `meetings` table has `findings` text + `protocol_status` but no template UI |
| Meeting minutes file upload | Low | Wire existing `FileUpload.tsx` to meetings |
| Minutes linked to meeting record | Low | FK from `meeting_protocols` to `meetings` |
| Case Kanban for archiving subcommittee | Medium | Filter `useCases` by `department_id` — no new table |
| Project report archiving (for Rada Projektów) | Low | Add `folder_type` column to `archive_folders` |
| Audit on archive folder status changes | Low | Call `logAudit()` on status change |

### Template vs Upload Decision

**Both** (per PROJECT.md):
- **Template path:** Textarea pre-filled with protocol template. Saves to `meeting_protocols` table. `finalized` status locks it.
- **Upload path:** `FileUpload.tsx` wired to upload file + store URL.

Do NOT use WYSIWYG editor — textarea is consistent with existing knowledge base editor.

### Schema Additions

```sql
CREATE TABLE meeting_protocols (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id      uuid REFERENCES meetings(id) ON DELETE CASCADE,
  created_by      uuid REFERENCES users(id),
  content         text,
  file_url        text,
  file_name       text,
  protocol_type   text CHECK (protocol_type IN ('template','upload','both')) DEFAULT 'template',
  status          text CHECK (status IN ('draft','finalized')) DEFAULT 'draft',
  created_at      timestamptz DEFAULT now(),
  finalized_at    timestamptz
);

ALTER TABLE archive_folders
  ADD COLUMN folder_type text CHECK (folder_type IN ('general','project_report')) DEFAULT 'general';
```

---

## Module 3: Grants (Granty)

### What's Missing — CRITICAL

**Eligibility criteria analysis is entirely absent.** `grants_radar` has no criteria fields. The "analiza kwalifikowalności" requirement has zero implementation. This is the most significant gap.

### What's Missing (Table Stakes)

| Feature | Complexity | Notes |
|---------|------------|-------|
| **Eligibility criteria checklist** | Medium | JSONB array on `grants_radar` — same pattern as `Task.checklists` |
| Deadline countdown / urgency indicator | Low | "7 days left" badge from date math |
| Patronage-specific fields (event, date, patron) | Low | Add nullable columns to `grants_radar` |
| Grant owner as user picker | Low | `owner_id` FK exists but form uses empty string |
| Application URL field | Low | Direct link to application portal |
| Applied/result dates | Low | When submitted, when decision expected |

### Eligibility Analysis UI Pattern

Standard pattern: **criteria checklist** per grant.

```typescript
// JSONB structure — same as Task.checklists
eligibility_criteria: [
  { id: 'crit-1', label: 'Organizacja non-profit', status: 'met' },
  { id: 'crit-2', label: 'Budżet < 50 000 PLN', status: 'unmet' },
  { id: 'crit-3', label: 'Działalność > 2 lata', status: 'pending' }
]
```

Summary badge: "8/10 kryteriów spełnionych." No new table — stored as JSONB on `grants_radar`.

### Patronage vs Grant Fields

| Field | Dotacja | Patronat |
|-------|---------|---------|
| max_amount | Required | — |
| scope | Yes | — |
| event_name | — | Required |
| event_date | — | Required |
| patron_identity | — | Required |
| eligibility_criteria | Yes | Simplified |

Keep one table. Add nullable patronat-specific columns. Show/hide by `type` in form logic.

### Schema Additions

```sql
ALTER TABLE grants_radar
  ADD COLUMN eligibility_criteria jsonb DEFAULT '[]',
  ADD COLUMN event_name text,
  ADD COLUMN event_date date,
  ADD COLUMN patron_identity text,
  ADD COLUMN application_url text,
  ADD COLUMN applied_at date,
  ADD COLUMN result_expected_at date;
```

---

## Module 4: Knowledge Base (Baza Wiedzy)

### What's Missing

| Feature | Complexity | Notes |
|---------|------------|-------|
| Downloadable template files | Medium | `FileUpload.tsx` wired to articles + `file_url` column |
| Article type (guide / template / regulation) | Low | `article_type` column — filter/display in sidebar |
| Markdown rendering for content | Low | `react-markdown` install + 5-line change in reader |
| `updated_by` FK | Low | Trust signal: "last edited by X" |

### WYSIWYG vs Markdown

**Use Markdown rendering. No WYSIWYG editor.**

`react-markdown` is ~5KB. Editor textarea stays as-is. Replace `<div className="whitespace-pre-wrap">` with `<ReactMarkdown>` in article reader only.

### Schema Additions

```sql
ALTER TABLE knowledge_articles
  ADD COLUMN article_type text DEFAULT 'guide' CHECK (article_type IN ('guide','template','regulation')),
  ADD COLUMN file_url text,
  ADD COLUMN file_name text,
  ADD COLUMN updated_by uuid REFERENCES users(id);
```

---

## Cross-Module Shared Patterns

Reuse these — do not reinvent:

| Pattern | Location | Use For |
|---------|----------|---------|
| JSONB attachments `{id, name, url, added_at}` | `archive_folders.attachments` | Knowledge templates, meeting protocols |
| Polish char file sanitizer | `my-department/page.tsx handleAiKBUpload` | All new file uploads |
| `ConfirmDialog` | `components/ConfirmDialog.tsx` | All delete operations |
| `logAudit()` | `lib/audit.ts` | Loan toggles, grant status changes, archive changes |
| Status badge (colored border spans) | All existing tables | New status columns |
| Slide-over drawer | Grant drawer, petition drawer | Meeting protocol detail |
| JSONB checklist `{id, text, completed}` | `Task.checklists` | Grant eligibility criteria |

---

## MVP Prioritization

### Must Ship (v1)

1. **Monolith component split** — prerequisite for all other work
2. **Loan contract additional fields** — real-world AV loans untrackable without borrower contact + source
3. **Overdue loan highlight** — zero new infrastructure, high operational value
4. **Meeting minutes: template editor + upload** — currently a dead link
5. **Grant eligibility criteria checklist** — "analiza kwalifikowalności" entirely absent
6. **Knowledge article_type + template file upload** — core missing feature

### Defer to Post-v1

- Markdown rendering (content readable as plaintext now)
- Grant deadline notification via cron
- Template download counter
- Patronat-specific fields (notes field sufficient until volume justifies it)
- Demand chart category breakdown (current chart functional)

---

## Feature Dependency Map

```
Monolith refactor → prerequisite for all subcommittee module work

Logistics:
  Overdue highlight     → no dependencies (pure UI date comparison)
  Asset quantity fields → schema migration only
  Overdue notification  → requires sendNotification integration

Archiving:
  Minutes template UI   → changes to /meetings page (separate route)
  Minutes upload        → FileUpload.tsx wiring (component exists)
  Case kanban           → filter useCases by department_id

Grants:
  Eligibility UI        → schema addition (jsonb column)
  Deadline countdown    → no dependencies (pure UI date math)

Knowledge:
  Markdown rendering    → react-markdown install only
  Template file upload  → FileUpload.tsx + schema addition
```

---
*Research completed: 2026-04-04*
