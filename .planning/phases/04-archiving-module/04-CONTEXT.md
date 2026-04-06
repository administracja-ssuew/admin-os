# Phase 4: Archiving Module - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous)

<domain>
## Phase Boundary

Dokończyć moduł Archiwizacji: edytor protokołów posiedzeń na /meetings, upload pliku do protokołu, blokowanie protokołu, Kanban spraw w ArchivingPanel (zakładka), typy folderów archiwum z badge, audit log.

</domain>

<decisions>
## Implementation Decisions

### Protokoły posiedzeń (ARCH-01, ARCH-02, ARCH-03)
- **D-01:** Edytor na stronie `/meetings` (istniejąca trasa) jako pełna strona — nie slide-over
- **D-02:** Stałe sekcje szablonu: tytuł, data, uczestnicy, porządek obrad, ustalenia, akcje
- **D-03:** Po zablokowaniu: formularz disabled + badge "Zablokowany", przycisk znika — bez możliwości odblokowania

### Kanban i foldery (ARCH-04, ARCH-05, ARCH-06)
- **D-04:** Kanban spraw — osobna zakładka "Sprawy" w ArchivingPanel (obok zakładki folderów)
- **D-05:** Typy folderów: kolorowy badge (ogólny = szary, raport projektowy = niebieski)
- **D-06:** `logAudit()` przy zmianie statusu folderu — ten sam wzorzec co LOG-05

### Claude's Discretion
- Wizualizacja Kanban (kolumny statusów z useCases)
- Obsługa upload pliku (FileUpload.tsx jeśli istnieje, inaczej input type=file)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `hooks/useCases.ts` — gotowy hook do Kanban (filtrowanie po departamencie)
- `components/subcommittees/ArchivingPanel.tsx` — do rozszerzenia o zakładki
- `lib/audit.ts` — logAudit()
- `app/meetings/page.tsx` — martwa strona do zastąpienia

### Established Patterns
- logAudit() z LOG-05 (Faza 3)
- Mutacje Supabase w panelach
- Toast błędów po polsku

</code_context>

<deferred>
## Deferred Ideas
- Odblokowanie protokołu przez admina — wykluczone
</deferred>

---
*Phase: 04-archiving-module*
*Context gathered: 2026-04-09 via smart discuss (autonomous)*
