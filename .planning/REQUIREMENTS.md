# Requirements: Admin OS — System Zarządzania Samorządem

**Defined:** 2026-04-04
**Core Value:** Jeden centralny panel, w którym każdy członek samorządu wie co ma zrobić, a każdy zasób — umowa, wniosek, grant — jest zawsze pod ręką i śledzony.

---

## v1 Requirements

### Security (Bezpieczeństwo)

- [ ] **SEC-01**: Trasy `/scores` i `/executive` są chronione server-side (nie tylko client-side AuthGuard)
- [x] **SEC-02**: Endpoint `/api/notifications` wymaga uwierzytelnionego Bearer tokenu (sesji użytkownika)
- [x] **SEC-03**: Publiczne przesyłanie formularza `/wniosek` korzysta z dedykowanego endpointu `/api/notifications/external` z własnym sekretem (nie z sesją użytkownika)
- [x] **SEC-04**: Polityka RLS na tabeli `notifications` ogranicza INSERT wyłącznie do service role
- [x] **SEC-05**: `CRON_SECRET` jest wymagany (nie opcjonalny) dla endpointu `deadline-check`
- [x] **SEC-06**: Zmienna `SUPABASE_SERVICE_ROLE_KEY` w trasie API nie ma fallbacku na klucz anonimowy

### Stability (Stabilność)

- [x] **STAB-01**: Numery spraw (`case_number`) generowane server-side z unikalnym constraintem w bazie
- [x] **STAB-02**: Tabela `department_notes` posiada constraint `UNIQUE(department_id)`, zapis używa UPSERT
- [x] **STAB-03**: Kanał Realtime w `NotificationBell` jest poprawnie czyszczony przy odmontowaniu komponentu
- [x] **STAB-04**: Błędy mutacji są widoczne dla użytkownika (brak cichych błędów w operacjach CRUD)

### Refactor (Refaktor)

- [x] **REF-01**: `my-department/page.tsx` podzielony na dedykowane hooki danych (`useLogisticsData`, `useArchivingData`, `useGrantsData`)
- [x] **REF-02**: Każda podkomisja ma własne komponenty panelu (`LogisticsPanel`, `ArchivingPanel`, `GrantsPanel`)
- [x] **REF-03**: `page.tsx` jest cienkim orkiestratorem (~80 linii) — bez bezpośredniej logiki biznesowej
- [x] **REF-04**: Routing podkomisji używa kolumny `dept_type` (enum) zamiast dopasowania po nazwie string
- [x] **REF-05**: Zdefiniowane interfejsy TypeScript dla wszystkich nowych modułów w `types/index.ts` (EquipmentLoan, Grant, EligibilityCriterion, MeetingProtocol)

### Logistics (Logistyka)

- [x] **LOG-01**: Formularz umowy wypożyczenia zawiera pola: telefon pożyczkobiorcy, organizacja, źródło wypożyczenia, kaucja
- [x] **LOG-02**: Przeterminowane wypożyczenia (status "Wypożyczone" po dacie zwrotu) są wizualnie wyróżnione
- [x] **LOG-03**: Zasoby biurowe mają pola: ilość, minimalna ilość (próg niskiego stanu), jednostka (szt/ryza/komplet)
- [x] **LOG-04**: Zasób z ilością poniżej progu jest automatycznie oznaczany statusem `low_stock`
- [x] **LOG-05**: Zmiana statusu wypożyczenia jest rejestrowana w audit logu (`logAudit`)

### Archiving (Archiwizacja)

- [ ] **ARCH-01**: Strona `/meetings` posiada edytor protokołu wypełniany z szablonu (pola: tytuł, data, uczestnicy, porządek obrad, ustalenia, akcje)
- [ ] **ARCH-02**: Do protokołu można dołączyć plik (upload do Supabase Storage)
- [ ] **ARCH-03**: Protokół można zablokować (status `finalized`) — po zablokowaniu edycja jest niemożliwa
- [ ] **ARCH-04**: Widok Kanban spraw (`cases`) w module Archiwizacji pokazuje wyłącznie sprawy przypisane do bieżącej podkomisji
- [ ] **ARCH-05**: Foldery archiwum posiadają typ (`folder_type`): ogólny lub raport projektowy (dla Rady Projektów)
- [ ] **ARCH-06**: Zmiana statusu folderu archiwum jest rejestrowana w audit logu

### Grants (Granty)

- [ ] **GRANT-01**: Każdy grant posiada listę kryteriów kwalifikowalności (JSONB) z trzema stanami: spełnione / niespełnione / w weryfikacji
- [ ] **GRANT-02**: Widok grantu pokazuje podsumowanie kwalifikowalności: "X/N kryteriów spełnionych"
- [ ] **GRANT-03**: Termin grantu wyświetla odliczanie ("7 dni", "1 dzień", "po terminie")
- [ ] **GRANT-04**: Właściciel grantu jest wybierany z listy użytkowników (nie pole tekstowe)
- [ ] **GRANT-05**: Grant zawiera pola: URL aplikacji, data złożenia, oczekiwana data decyzji
- [ ] **GRANT-06**: Patronaty honorowe (type=PATRONAT) posiadają dedykowane pola: nazwa wydarzenia, data, tożsamość patrona
- [ ] **GRANT-07**: Zmiana statusu grantu jest rejestrowana w audit logu

### Knowledge Base (Baza Wiedzy)

- [ ] **KB-01**: Artykuły posiadają typ: przewodnik / szablon / regulacja
- [ ] **KB-02**: Do artykułu-szablonu można dołączyć plik do pobrania (upload do Supabase Storage)
- [ ] **KB-03**: Treść artykułów jest renderowana jako Markdown (zamiast `dangerouslySetInnerHTML`)
- [ ] **KB-04**: Każdy artykuł pokazuje autora ostatniej edycji (`updated_by`)

### UX & Polish

- [ ] **UX-01**: Ekran ładowania posiada animację/wskaźnik postępu i pasuje wizualnie do systemu
- [ ] **UX-02**: Tabele nowych modułów posiadają skeleton loadery podczas ładowania danych
- [ ] **UX-03**: Stany puste (zero rekordów) wyświetlają czytelny komunikat z akcją do wykonania

---

## v2 Requirements

### Notifications (Powiadomienia)

- **NOTF-01**: Powiadomienie email/in-app gdy wypożyczenie jest przeterminowane (via cron)
- **NOTF-02**: Powiadomienie email/in-app gdy zbliża się termin grantu
- **NOTF-03**: Powiadomienie preferencje użytkownika sprawdzane przed wysłaniem emaila (pole `notification_preferences` już istnieje w schemacie)

### Analytics

- **ANA-01**: Wykres popytu na sprzęt z podziałem na kategorie (zamiast zsumowanych słupków)
- **ANA-02**: Statystyki Grantów: wskaźnik akceptacji według typu
- **ANA-03**: Licznik pobrań szablonów w Bazie Wiedzy

### Export / Integration

- **EXP-01**: Eksport CSV rejestru wypożyczeń
- **EXP-02**: Walidacja MIME plików po stronie serwera (Supabase Edge Function)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Natywna aplikacja mobilna | Zakres to web |
| Publiczna strona internetowa | Narzędzie wewnętrzne |
| Automatyczne pobieranie danych grantów z zewnętrznych baz | Poza zakresem v1 — wpis ręczny |
| Skanowanie QR/kodów kreskowych dla zasobów | Overkill dla 10–30 użytkowników |
| Wielomiejscowe zarządzanie magazynem | Jeden lokal |
| OCR / automatyczne parsowanie dokumentów | Za wysoka złożoność |
| Integracja z zewnętrznym systemem archiwalnym | Brak dostępnego API |
| Historia wersji protokołów | Zakres v2+ |
| System zatwierdzania przed publikacją artykułów KB | Tylko adminowie edytują — nie potrzebny workflow |
| Generowanie PDF wniosków | Zbyt skomplikowane dla v1 |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Pending |
| SEC-02 | Phase 1 | Complete |
| SEC-03 | Phase 1 | Complete |
| SEC-04 | Phase 1 | Complete |
| SEC-05 | Phase 1 | Complete |
| SEC-06 | Phase 1 | Complete |
| STAB-01 | Phase 1 | Complete |
| STAB-02 | Phase 1 | Complete |
| STAB-03 | Phase 1 | Complete |
| STAB-04 | Phase 1 | Complete |
| REF-01 | Phase 2 | Complete |
| REF-02 | Phase 2 | Complete |
| REF-03 | Phase 2 | Complete |
| REF-04 | Phase 2 | Complete |
| REF-05 | Phase 2 | Complete |
| LOG-01 | Phase 3 | Complete |
| LOG-02 | Phase 3 | Pending |
| LOG-03 | Phase 3 | Complete |
| LOG-04 | Phase 3 | Complete |
| LOG-05 | Phase 3 | Pending |
| ARCH-01 | Phase 4 | Pending |
| ARCH-02 | Phase 4 | Pending |
| ARCH-03 | Phase 4 | Pending |
| ARCH-04 | Phase 4 | Pending |
| ARCH-05 | Phase 4 | Pending |
| ARCH-06 | Phase 4 | Pending |
| GRANT-01 | Phase 5 | Pending |
| GRANT-02 | Phase 5 | Pending |
| GRANT-03 | Phase 5 | Pending |
| GRANT-04 | Phase 5 | Pending |
| GRANT-05 | Phase 5 | Pending |
| GRANT-06 | Phase 5 | Pending |
| GRANT-07 | Phase 5 | Pending |
| KB-01 | Phase 6 | Pending |
| KB-02 | Phase 6 | Pending |
| KB-03 | Phase 6 | Pending |
| KB-04 | Phase 6 | Pending |
| UX-01 | Phase 7 | Pending |
| UX-02 | Phase 7 | Pending |
| UX-03 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 38
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-04*
*Last updated: 2026-04-04 after initialization*
