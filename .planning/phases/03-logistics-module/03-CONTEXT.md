# Phase 3: Logistics Module - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous)

<domain>
## Phase Boundary

Dwa osobne byty w module Logistyki:
1. **Rejestr umów użyczenia** — formalne wypożyczenia sprzętu (głośniki, projektory): kto, kiedy, co, do tabeli retrospektywnej i wykresu trendu. Pola: borrower_name, borrower_phone, borrower_org, item_name, loan_date, return_date, return_date, loan_source. BEZ pól kaucji (deposit_required, deposit_amount).
2. **Inwentarz materiałów biurowych** — kartki, taśmy, koperty: stan bieżący (quantity, min_quantity, unit) z badgem "Niski stan" gdy quantity < min_quantity.

</domain>

<decisions>
## Implementation Decisions

### Rejestr umów użyczenia (LOG-01, LOG-02)
- **D-01:** Pola formularza: borrower_name, borrower_phone, borrower_org, item_name, loan_date, return_date, loan_source — BEZ kaucji (deposit_required, deposit_amount usunięte z zakresu)
- **D-02:** Przeterminowane wypożyczenia (status "Wypożyczone" + return_date w przeszłości): czerwony badge/row highlight w tabeli — bez zmiany schematu DB
- **D-03:** Tabela retrospektywna + prosty wykres trendu (ile wypożyczeń w czasie) w LogisticsPanel

### Inwentarz materiałów biurowych (LOG-03, LOG-04)
- **D-04:** Jednostki: dropdown z opcjami szt, ryza, opak, komplet (nie free text)
- **D-05:** Low stock logika: obliczana w hooku (quantity < min_quantity) — bez DB trigger. Badge "Niski stan" przy nazwie zasobu.
- **D-06:** Kolumna `low_stock` w tabeli assets: wyliczana lub obliczana po stronie aplikacji

### Audit (LOG-05)
- **D-07:** `logAudit()` wywoływane w LogisticsPanel przy każdej zmianie statusu wypożyczenia

### Claude's Discretion
- Dokładna wizualizacja wykresu trendu (biblioteka lub inline)
- Kolejność kolumn w tabelach
- Stany puste

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `hooks/useLogisticsData.ts` — już istnieje (Faza 2), do rozszerzenia o nowe pola
- `components/subcommittees/LogisticsPanel.tsx` — już istnieje (Faza 2), do rozszerzenia
- `lib/audit.ts` — `logAudit()` gotowa
- `components/SkeletonLoader.tsx`, `components/EmptyState.tsx`
- Wzorzec toast.error/success z react-hot-toast

### Established Patterns
- Mutacje Supabase bezpośrednio w panelach
- Fetchowanie w hookach (Promise.all)
- Typy w types/index.ts (EquipmentLoan, Asset już zdefiniowane w Fazie 2)

### Integration Points
- `supabase/migrations/` — nowe kolumny w equipment_loans i assets
- `types/index.ts` — aktualizacja EquipmentLoan (usuń deposit_*), Asset (dodaj min_quantity, unit)

</code_context>

<specifics>
## Specific Ideas

- "Umowy użyczenia" to rejestr kto kiedy co wziął — dane do tabeli retrospektywnej i trendu
- Materiały biurowe to stan magazynowy — nie wypożyczanie, tylko śledzenie stanu
- BEZ pól kaucji

</specifics>

<deferred>
## Deferred Ideas

- Pola kaucji (deposit_required, deposit_amount) — wykluczone przez użytkownika
- Wykres popytu per kategoria → v2 (ANA-01)

</deferred>

---

*Phase: 03-logistics-module*
*Context gathered: 2026-04-04 via smart discuss (autonomous)*
