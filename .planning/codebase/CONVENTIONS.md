# CONVENTIONS.md
> Generated: 2026-04-04 | Focus: quality

## Language and TypeScript Usage

**TypeScript version:** ^5 with `strict: true` in `tsconfig.json`

**Key compiler settings:**
- `target`: ES2017
- `strict`: true (full strict mode — no implicit `any`, strict null checks, etc.)
- `moduleResolution`: bundler
- `isolatedModules`: true
- `jsx`: react-jsx

**Type annotation patterns:**
- All function return types are inferred — explicit return types are not used on component functions
- Interface-first for object shapes: `interface UseTasksResult { ... }` in `hooks/useTasks.ts`
- `type` aliases used for union types: `type SystemRole = 'pending' | 'active' | 'inactive' | 'admin' | 'superadmin'` in `types/index.ts`
- `any` is used in some places (e.g., `projects: any[]` in `hooks/useTasks.ts`, `editForm: any` in `app/tasks/page.tsx`) — avoid where possible
- Nullability handled with `| null` in type definitions, not `undefined` (e.g., `department_id: string | null`)
- Type assertions with `as` are used when Supabase returns untyped data: `setCases(data as Case[])`
- Import types with `import type { ... }` — enforced consistently across all files

**All types are centralized in `types/index.ts`.** Do not define local entity types in page or component files.

---

## Naming Conventions

**Files:**
- Pages: `page.tsx` inside named route directories (`app/tasks/page.tsx`, `app/wniosek/status/page.tsx`)
- Components: PascalCase filename = `AuthGuard.tsx`, `SkeletonLoader.tsx`, `ConfirmDialog.tsx`
- Hooks: camelCase with `use` prefix = `useCurrentUser.ts`, `useTasks.ts`, `useCases.ts`
- Lib utilities: camelCase = `audit.ts`, `notify.ts`, `email.ts`, `email-templates.ts`
- API routes: `route.ts` inside `app/api/[name]/` directories

**Components:**
- Default export, PascalCase name matching filename: `export default function AuthGuard(...)`
- Page components named `[Route]Page`: `DashboardPage`, `TasksPage`, `LoginPage`, `PublicIntakePage`

**Functions:**
- Event handlers: `handle` prefix — `handleSubmit`, `handleFileUpload`, `handleLogout`
- Data fetchers: `fetch` prefix — `fetchData`, `fetchDashboardData`, `fetchCases`, `fetchNotifications`
- Boolean flags: `is` or `has` prefix — `isAdmin`, `isOpen`, `isSubmitting`, `isDrawerOpen`, `isSuperAdmin`
- Async operations: plain verbs — `saveTaskEdit`, `deleteTask`, `markAsRead`, `claimTask`

**Variables:**
- camelCase throughout
- State setters follow React convention: `[value, setValue]` — `[loading, setLoading]`, `[isOpen, setIsOpen]`
- Constants (non-exported): SCREAMING_SNAKE_CASE — `ADMIN_ROUTES`, `PUBLIC_ROUTES`, `MONTH_NAMES`

**Types and Interfaces:**
- Interfaces: PascalCase with descriptive noun — `AppUser`, `CaseAttachment`, `ChecklistItem`
- Hook result interfaces: `Use[HookName]Result` — `UseCurrentUserResult`, `UseTasksResult`, `UseCasesResult`
- Type unions: descriptive noun + Type suffix — `SystemRole`, `CaseStatus`, `TaskPriority`, `NotificationType`
- Props interfaces: `[ComponentName]Props` — `SkeletonLoaderProps`, `EmptyStateProps`, `ConfirmDialogProps`

---

## Import Organization

**Order (observed pattern):**
1. React hooks (`import { useState, useEffect } from 'react'`)
2. Next.js utilities (`import { useRouter } from 'next/navigation'`, `import Link from 'next/link'`)
3. Supabase client (`import { supabase } from '../../lib/supabase'`)
4. Internal hooks (`import { useCurrentUser } from '../../hooks/useCurrentUser'`)
5. Internal components (`import Sidebar from '../../components/Sidebar'`)
6. Internal lib utilities (`import { logAudit } from '../../lib/audit'`)
7. External packages (`import { Loader2, Bell } from 'lucide-react'`, `import toast from 'react-hot-toast'`)
8. Type imports (`import type { Task, AppUser } from '../../types'`) — always last, always `import type`

**Path style:** Relative paths only. The `@/*` alias is configured in `tsconfig.json` but is **not used** in practice — all imports use relative paths (`../../lib/supabase`, `../components/Sidebar`).

**No barrel files (`index.ts`)** in components or hooks — every file is imported directly.

---

## Component Patterns

**Client components:**
- All interactive components begin with `'use client'` directive as the very first line
- Server components are not explicitly declared; the `app/layout.tsx` has no directive (server by default), but most other files are client components

**Component structure (standard order):**
1. `'use client'` directive
2. Imports
3. Module-level constants (e.g., `ADMIN_ROUTES`, `MONTH_NAMES`)
4. Local helper interfaces (only for component-specific types not in `types/index.ts`)
5. Small pure helper functions (e.g., `getScoreColor`, `getMedalIcon`, `SkeletonPulse`)
6. Default export function (the main component)
7. State declarations with `useState`
8. Derived values (e.g., `const unreadCount = notifications.filter(n => !n.is_read).length`)
9. `useEffect` blocks
10. Handler/async functions
11. Inline sub-components defined inside the parent (e.g., `StatCard` defined inside `DashboardPage`)
12. Return JSX

**Props pattern:**
- Props defined as a named interface directly above the component: `interface EmptyStateProps { ... }`
- Default values via destructuring: `{ variant = 'card', count = 3 }`
- `children` typed as `React.ReactNode`

**Inline sub-components:** Small presentational components are sometimes defined inside the parent page function (e.g., `StatCard` in `app/page.tsx`, `SuccessView` in `app/wniosek/page.tsx`). For reusable components, use a separate file in `components/`.

**Conditional rendering patterns:**
- Loading: `{loading ? <SkeletonLoader /> : <content />}`
- Empty state: `{items.length > 0 ? items.map(...) : <EmptyState ... />}`
- Auth guard: early return with inline JSX
- Optional rendering: `{condition && <Component />}`

---

## State Management

**No global state library** — state is managed locally via `useState` and passed down via props, or fetched via custom hooks.

**Custom hooks for data fetching:** All Supabase reads are wrapped in custom hooks in `hooks/`:
- `useCurrentUser()` → `{ user, loading, isAdmin, isSuperAdmin }`
- `useTasks()` → `{ tasks, users, departments, projects, cases, loading, refetch }`
- `useCases()` → `{ cases, loading, refetch }`
- `useUsers()` → `{ users, loading, refetch }`

Hooks expose a `refetch` function (a `useCallback`-memoized async function) to allow manual refresh after mutations.

**Realtime subscriptions:** Hooks and some pages use Supabase realtime channels to auto-refetch on DB changes:
```typescript
const channel = supabase
  .channel('tasks-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
    fetchData()
  })
  .subscribe()
return () => { supabase.removeChannel(channel) }
```

**Mutation pattern:** Pages do their own mutations (insert/update/delete) directly via `supabase` client — mutations are NOT abstracted into hooks.

---

## API Call Patterns

**Direct Supabase client calls** are the primary data access pattern. No API abstraction layer exists.

**Read pattern:**
```typescript
const { data } = await supabase
  .from('table')
  .select('*, relation(field1, field2)')
  .eq('column', value)
  .order('created_at', { ascending: false })
if (data) setState(data as Type[])
```

**Mutation with toast feedback:**
```typescript
const toastId = toast.loading('Loading message...')
const { error } = await supabase.from('table').update({ field: value }).eq('id', id)
if (!error) { toast.success('Success message', { id: toastId }); refetch() }
else toast.error('Error message', { id: toastId })
```

**Internal API routes** (under `app/api/`) use the Next.js Route Handler pattern:
```typescript
export async function POST(request: Request) {
  try {
    const body = await request.json()
    // ... logic
    return Response.json({ success: true })
  } catch (err) {
    console.error('Error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Notification calls** go through `lib/notify.ts` `sendNotification()`, which POSTs to `/api/notifications` with the auth token. Notifications are fire-and-forget (errors are caught and logged but not re-thrown).

**Error ignored pattern:** Supabase data calls frequently ignore `error` from the response and only check `data`:
```typescript
const { data } = await supabase.from(...).select(...)
if (data) setItems(data)
// error silently ignored
```

---

## Error Handling

**User-facing errors:**
- Mutations use `react-hot-toast` for success/error feedback: `toast.success(...)`, `toast.error(...)`
- Forms set local `errorMsg` state for display: `setErrorMsg('...')`
- Field-level validation errors stored in `fieldErrors: Record<string, string>`

**Logging:**
- `console.error(...)` used in catch blocks and for lib-level errors (audit log, email, notifications)
- No structured logging framework — plain `console.error` only
- Errors from lib functions are logged but not propagated to callers (fire-and-forget pattern)

**Defensive checks:**
- `cancelled` flag pattern in `useEffect` to prevent state updates after unmount (see `hooks/useCurrentUser.ts`)
- Optional chaining used extensively: `session?.user?.email`, `task.deadline?.substring(5)`
- Nullish coalescing for fallbacks: `userData?.system_role ?? 'pending'`, `activeCases || 0`

**No error boundaries** are present in the codebase.

---

## Formatting and Linting

**ESLint:** Configured in `eslint.config.mjs` using flat config format.
- Extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- No additional custom rules beyond Next.js defaults
- Run via: `npm run lint` (invokes `eslint` with no explicit path — defaults to project root)

**Prettier:** Not configured. No `.prettierrc`, `.prettierignore`, or prettier dependency present.

**Observed formatting style (from source):**
- 2-space indentation
- Single quotes for strings
- No semicolons at line ends (semicolons omitted consistently)
- Template literals for string interpolation
- Arrow functions for callbacks and short handlers
- Trailing commas in multi-line arrays/objects
- Opening braces on same line (`if (x) {`)
- Short one-liner if blocks on single line when inside event handlers: `if (!error) { toast.success(...); fetchData() }`

---

## Tailwind CSS Conventions

**Tailwind v4** is used. All styling is via utility classes — no CSS modules, no styled-components.

**Dark mode:** `dark:` variants used throughout. Dark mode class is set on `<html>` in `app/layout.tsx`: `<html lang="pl" className="dark">` — always dark mode enabled.

**Design system patterns observed:**
- Card containers: `bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5`
- Primary button: `px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors`
- Danger button: `bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg`
- Status badge: `px-2 py-1 rounded-full text-xs font-bold`
- Loading spinner: `<Loader2 className="animate-spin" />`
- Page layout: `<div className="flex min-h-screen bg-slate-50 dark:bg-slate-900"><Sidebar /><div className="flex-1 ml-64 p-8">`

**Icons:** `lucide-react` is the only icon library. Icons are imported by name and sized via the `size` prop.

---

## Comments

**Language:** Polish (codebase uses Polish for UI text, comments, and some variable names)

**Comment style:**
- Section separators in `types/index.ts`: `// ─── SECTION NAME ────`
- Inline explanations for non-obvious logic in Polish
- `// plik: path/to/file` breadcrumb comments at the top of some files
- No JSDoc/TSDoc annotations anywhere in the codebase
- Emoji occasionally used in comments for visual markers (🛑, 🔒, ✅)
