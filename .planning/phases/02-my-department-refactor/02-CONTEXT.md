# Phase 2: My-Department Refactor - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous)

<domain>
## Phase Boundary

Rozłożyć monolityczny my-department/page.tsx (~1300 linii) na dedykowane hooki danych i komponenty paneli per-podkomisja. Zredukować page.tsx do cienkiego orkiestratora (~80 linii). Nie dodawać nowych funkcji — tylko restrukturyzacja.

</domain>

<decisions>
## Implementation Decisions

### Struktura katalogów
- Komponenty paneli: `components/subcommittees/` — płaski katalog (LogisticsPanel.tsx, ArchivingPanel.tsx, GrantsPanel.tsx)
- Hooki danych: `hooks/` obok istniejących (useLogisticsData.ts, useArchivingData.ts, useGrantsData.ts)
- Typy domenowe: `types/index.ts` — zgodnie z konwencją projektu

### Interfejs hooków
- Każdy hook zwraca: dane + mutacje + loading/error — np. `{ loans, isLoading, error, addLoan, updateLoan }`
- Early return `{ data: [], isLoading: false }` gdy dept_type nie pasuje do podkomisji hooka
- `Promise.all` dla niezależnych zapytań wewnątrz hooka (per REF-01)

### Routing w page.tsx
- `switch(department.dept_type)` po enum z DB — zero string matching
- Nieznany dept_type: polski komunikat `'Nieznany typ podkomisji'` + info kontaktowy
- Wszystkie 3 hooki zawsze montowane bezwarunkowo — każdy sam sprawdza dept_type (Rules of Hooks)

### Claude's Discretion
- Dokładna struktura props każdego panelu (dane + callbacki)
- Obsługa stanów loading/error wewnątrz paneli
- Nazwy mutacji w hookach

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `hooks/useTasks.ts`, `hooks/useCases.ts`, `hooks/useCurrentUser.ts` — wzorce do replikacji dla nowych hooków
- `types/index.ts` — istniejący plik z typami (AppUser, Case, Task itd.) — dodać EquipmentLoan, Grant, EligibilityCriterion, MeetingProtocol
- `components/SkeletonLoader.tsx`, `components/EmptyState.tsx` — gotowe do użycia w panelach

### Established Patterns
- Hooki: `useEffect` + `useState` + bezpośrednie zapytania Supabase (brak React Query)
- Importy: ścieżki względne (nie `@/`)
- Typy: `interface` dla kształtów obiektów, `type` dla unii
- Błędy mutacji: `toast.error(...)` z react-hot-toast

### Integration Points
- `app/my-department/page.tsx` — główny plik do przebudowy
- `supabase/migrations/` — migracja dept_type enum (Plan 02-01)
- `components/subcommittees/` — nowy katalog do stworzenia

</code_context>

<specifics>
## Specific Ideas

- page.tsx ma docelowo ≤100 linii (target z ROADMAP: ~80)
- dept_type enum: 'logistics' | 'archiving' | 'grants'
- Komunikat dla nieznanego dept_type po polsku

</specifics>

<deferred>
## Deferred Ideas

Brak — faza skupiona na refaktorze.

</deferred>

---

*Phase: 02-my-department-refactor*
*Context gathered: 2026-04-04 via smart discuss (autonomous)*
