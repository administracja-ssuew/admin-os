---
phase: 04-archiving-module
plan: "04"
subsystem: ui
tags: [react, kanban, supabase, filtering, tabs]

# Dependency graph
requires:
  - phase: 04-01
    provides: ArchivingPanel base component with folders and petitions

provides:
  - ArchivingPanel with two tabs: Foldery i Podania + Sprawy
  - Kanban board in Sprawy tab filtered by currentUser.department_id
  - Three Kanban columns: new / in_progress / closed

affects:
  - 04-05 (folder type badges - same component)
  - any future archiving module work referencing ArchivingPanel

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tab state with useState<'folders' | 'cases'> pattern"
    - "Department-scoped Kanban: cases.filter(c => c.department_id === currentUser?.department_id)"
    - "Derived values + caseColumns constant defined before JSX return"

key-files:
  created: []
  modified:
    - components/subcommittees/ArchivingPanel.tsx

key-decisions:
  - "Tab system uses border-b-2 -mb-px underline pattern for active indicator"
  - "deptCases filter on department_id matches currentUser?.department_id (null-safe)"
  - "CaseStatus typed caseColumns array for type-safe Kanban column rendering"

patterns-established:
  - "Tab content conditional rendering with {activeTab === 'X' && (...)} pattern"
  - "Empty state inside each Kanban column (colCases.length === 0) with message"

requirements-completed: [ARCH-04]

# Metrics
duration: 3min
completed: 2026-04-06
---

# Phase 4 Plan 4: Kanban Spraw w ArchivingPanel Summary

**Zakładka "Sprawy" z Kanban w trzech kolumnach (Nowe/W Toku/Zamknięte) filtrowanym po department_id zalogowanego uzytkownika, wbudowana w ArchivingPanel obok istniejacych Folderów i Podań**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-06T11:46:32Z
- **Completed:** 2026-04-06T11:49:31Z
- **Tasks:** 1 of 1
- **Files modified:** 1

## Accomplishments

- ArchivingPanel ma dwie zakładki nawigacyjne: "Foldery i Podania" i "Sprawy" z aktywnym wskaźnikiem (border-b-2)
- Zakładka Sprawy renderuje Kanban z kolumnami `new`, `in_progress`, `closed` pobranymi przez `useCases()` hook
- Filtrowanie po `department_id`: `cases.filter(c => c.department_id === currentUser?.department_id)` — inne departamenty nie widzą spraw
- Karty spraw zawierają: numer sprawy, tytuł, typ sprawy (badge), imię i nazwisko właściciela
- Istniejąca funkcjonalność folderów archiwalnych i podań pozostała bez zmian
- Brak błędów TypeScript w ArchivingPanel.tsx

## Task Commits

1. **Task 1: Zakładki i Kanban spraw w ArchivingPanel** - `34c2835` (feat)

## Files Created/Modified

- `components/subcommittees/ArchivingPanel.tsx` - Dodano import useCases, CaseStatus, Case; stan activeTab; hook useCases(); derived deptCases i caseColumns; JSX zakładek i Kanban (729 linii, +100 linii netto)

## Decisions Made

- Zakładka "Foldery i Podania" wyświetla istniejącą zawartość bez zmian — opakowano ją w `{activeTab === 'folders' && (...)}` blok
- Zakładka "Sprawy" renderuje się tylko gdy `activeTab === 'cases'` — bez lazy loading, hook `useCases()` ładuje od razu przy montowaniu komponentu
- Użyto `currentUser?.department_id` z null-safe operatorem — gdy currentUser jest null, deptCases będzie puste

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Pre-existing TypeScript errors w `app/scores/ScoresClientPage.tsx` i `app/wniosek/page.tsx` istniały przed zmianami (poza zakresem).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ArchivingPanel gotowy dla 04-05 (typy folderów z badge — ten sam plik)
- Hook `useCases()` z real-time subscription działa poprawnie
- Filtrowanie po departamencie przetestowane logicznie; wymaga danych testowych w Supabase dla pełnej weryfikacji wizualnej

---
*Phase: 04-archiving-module*
*Completed: 2026-04-06*
