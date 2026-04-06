# Phase 5: Grants Module - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all recommended defaults accepted

<domain>
## Phase Boundary

Dokończyć moduł Grantów: kryteria kwalifikowalności (JSONB checklist trzy-stanowy), podsumowanie X/N, odliczanie terminu, picker właściciela grantu z listy użytkowników, pola śledzenia aplikacji, pola patronatu (warunkowo), audit log.

</domain>

<decisions>
## Implementation Decisions

### Kryteria kwalifikowalności (GRANT-01, GRANT-02)
- **D-01:** Checklist JSONB: trzy stany — met/unmet/pending — toggle cykliczny kliknięciem
- **D-02:** Podsumowanie: badge "X/N kryteriów spełnionych" na karcie/widoku grantu
- **D-03:** Komponent EligibilityChecklist w components/subcommittees/grants/

### Deadline i właściciel (GRANT-03, GRANT-04)
- **D-04:** Odliczanie terminu: badge obliczany z pola `deadline` — "7 dni", "1 dzień", "po terminie" (czerwony gdy po terminie)
- **D-05:** Właściciel grantu: `<select>` z useUsers lub istniejącym hookiem users — nie free text

### Pola aplikacji i patronatu (GRANT-05, GRANT-06, GRANT-07)
- **D-06:** application_url, applied_at, decision_expected_at — widoczne zawsze w formularzu grantu
- **D-07:** Pola patronatu (patronage_event_name, patronage_event_date, patron_identity) — widoczne warunkowo gdy grant_type = 'PATRONAT'
- **D-08:** logAudit() przy każdej zmianie statusu grantu

### Claude's Discretion
- Organizacja zakładek/sekcji w GrantsPanel
- Wizualizacja kolumn Kanban vs lista dla grantów

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- hooks/useGrantsData.ts — już istnieje (Faza 2), do rozszerzenia
- components/subcommittees/GrantsPanel.tsx — do rozszerzenia
- lib/audit.ts — logAudit()
- Wzorzec JSONB checklist: Task.checklists jako precedens (useTasks.ts)

### Established Patterns
- logAudit() — wzorzec z LOG-05 i ARCH-06
- Badge kolory: czerwony=problem, amber=ostrzeżenie, zielony=ok
- Mutacje Supabase w panelach, fetch w hookach

</code_context>

<deferred>
## Deferred Ideas
- Automatyczne pobieranie danych grantów z zewnętrznych baz — out of scope v1
</deferred>

---
*Phase: 05-grants-module*
*Context gathered: 2026-04-09 via smart discuss (autonomous)*
