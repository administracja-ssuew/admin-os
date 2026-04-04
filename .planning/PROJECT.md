# Admin OS — System Zarządzania Samorządem

## What This Is

System administracyjny dla samorządu lokalnego (10–30 użytkowników), obsługujący zarządzanie wnioskami, podkomisjami, wiedzą organizacyjną i zasobami. Zbudowany na Next.js 15 + Supabase, obejmuje trzy podkomisje (Logistykę, Archiwizację i Granty) z dedykowanymi modułami do śledzenia wypożyczeń, dokumentów i dofinansowań. System jest gotowy do wydania po zabezpieczeniu i uzupełnieniu brakujących funkcji.

## Core Value

Jeden centralny panel, w którym każdy członek samorządu wie co ma zrobić, a każdy zasób — umowa, wniosek, grant — jest zawsze pod ręką i śledzony.

## Requirements

### Validated

- ✓ Logowanie i autoryzacja oparta na rolach (superadmin / admin / member) — existing
- ✓ Składanie i śledzenie wniosków (/wniosek z walidacją i statusami) — existing
- ✓ Dashboard z przeglądem aktywności — existing
- ✓ Powiadomienia in-app + email (Resend) — existing
- ✓ Strona Mojej Podkomisji (podstawowa struktura) — existing
- ✓ Baza wiedzy (podstawowa, artykuły hardcoded) — existing
- ✓ System motywacyjny / punkty (/scores, tylko superadmin) — existing
- ✓ Panel wykonawczy (/executive) — existing
- ✓ Kanban zadań (hook useTasks) — existing
- ✓ Audit log mutacji — existing
- ✓ Proxy do systemu CRED — existing

### Active

**Bezpieczeństwo i stabilność (Priorytet 1 — musi być przed wydaniem):**
- [ ] Server-side auth guards — zastąpić client-only sprawdzanie ról na `/scores` i `/executive`
- [ ] Naprawa zbyt permisywnej polityki RLS INSERT na `notifications`
- [ ] Uwierzytelnienie endpointu POST `/api/notifications` (dziś nieautoryzowany)
- [ ] Zabezpieczenie endpointu `deadline-check` (opcjonalny cron secret musi być wymagany)
- [ ] Eliminacja `any` w TypeScript (60+ miejsc) — priorytet w hookach i API
- [ ] Naprawa cichych błędów w mutacjach — każda operacja musi dawać feedback
- [ ] Naprawa potencjalnej kolizji numerów spraw (`case_number`)
- [ ] Cleanup kanału Realtime w `NotificationBell` (wyciek subskrypcji)

**Moja Podkomisja — Logistyka:**
- [ ] Rejestr umów wypożyczenia (sprzęt AV, pożyczkobiorca, daty, źródło wypożyczenia)
- [ ] Automatyczny wykres popytu na sprzęt (z danych umów, filtr czasowy)
- [ ] Inwentarz materiałów biurowych (papier, koperty, itp. — stan bieżący + historia)

**Moja Podkomisja — Archiwizacja i Sprawy Bieżące:**
- [ ] Widok Kanban wniosków przypisanych do tej podkomisji
- [ ] Archiwizacja dokumentów projektowych (raporty dla Rady Projektów)
- [ ] Widok rejestru spraw (review przypisanych spraw)
- [ ] Protokoły z posiedzeń — tworzenie z szablonu (edytor w systemie) + upload pliku

**Moja Podkomisja — Granty:**
- [ ] Rejestr grantów (nazwa, kwota, termin, kryteria kwalifikacji, status aplikacji)
- [ ] Rejestr patronatów honorowych + analiza kwalifikowalności
- [ ] Pełny panel analityczny w module Mojej Podkomisji

**Baza wiedzy:**
- [ ] Przewodniki krok po kroku (jak wypełnić wniosek, napisać protokół, złożyć pismo)
- [ ] Szablony dokumentów (wnioski, umowy, protokoły) — do pobrania/użycia
- [ ] Panel edycji dla superadmina (zarządzanie artykułami i szablonami w UI)

**UX i refaktor:**
- [ ] Przebudowa ekranu ładowania (wizualna identyfikacja + wskaźnik postępu)
- [ ] Rozbicie monolitu `my-department/page.tsx` (1000+ linii) na komponenty podkomisji
- [ ] Poprawa skeleton loaderów i pustych stanów

### Out of Scope

- Natywna aplikacja mobilna — zakres to web
- Publiczna strona internetowa samorządu — to narzędzie wewnętrzne
- Automatyczne pobieranie danych z zewnętrznych baz grantów — ręczny wpis na start
- Samodzielne zatwierdzanie decyzji przez autora — blokada self-approval (tech debt, nie priorytet v1)

## Context

Projekt brownfield — kod istnieje, ma działające funkcje ale wymaga zabezpieczenia przed wydaniem. Stack: Next.js 15 App Router (głównie `'use client'`), Supabase (auth/db/storage/realtime), TypeScript, Tailwind CSS. Resend do emaili.

Zidentyfikowane luki bezpieczeństwa (z audytu kodu):
- `/scores` i `/executive` chronione wyłącznie po stronie klienta
- Endpoint `/api/notifications` przyjmuje POST bez weryfikacji nadawcy
- Polityka RLS na `notifications` pozwala wstawić powiadomienie do dowolnego user_id
- Brak weryfikacji MIME przy uploadach

My-department page to monolityczny plik 1000+ linii — trzy podkomisje (Logistyka, Archiwizacja, Granty) mają być osobnymi sekcjami z własnymi komponentami i tabelami DB.

Użytkownicy: 10–30 osób w samorządzie lokalnym, różne role. UI w języku polskim.

## Constraints

- **Tech stack**: Next.js 15 + Supabase — locked, bez zmiany frameworka
- **Język UI**: Polski — wszystkie nowe elementy po polsku
- **Security-first**: Żadna nowa funkcja nie może obniżyć poziomu bezpieczeństwa
- **Brownfield**: Zachować istniejącą architekturę i konwencje (hooks, direct Supabase calls)
- **Brak testów**: System nie ma testów — nowe moduły nie muszą ich mieć w v1, ale nie mogą łamać istniejących

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Security przed nowymi funkcjami | Wydanie z lukami to ryzyko reputacyjne | — Pending |
| Podkomisje jako sekcje w My-Department | Jedna strona z tabami/sekcjami, nie osobne routes | — Pending |
| Rejestr grantów: manual input | Brak zewnętrznego API do integracji na v1 | — Pending |
| Protokoły: edytor + upload | Oba flow — template editor i file upload | — Pending |
| Baza wiedzy: admin-editable | Superadmin edytuje w UI, nie hardcoded | — Pending |

## Evolution

Ten dokument ewoluuje przy przejściach faz i kamieniach milowych.

**Po każdym przejściu fazy:**
1. Wymagania unieważnione? → Przenieś do Out of Scope z powodem
2. Wymagania potwierdzone? → Przenieś do Validated z numerem fazy
3. Nowe wymagania? → Dodaj do Active
4. Decyzje do zalogowania? → Dodaj do Key Decisions
5. "What This Is" nadal aktualne? → Zaktualizuj jeśli się zdezaktualizowało

**Po każdym milestone:**
1. Pełny przegląd wszystkich sekcji
2. Sprawdzenie Core Value — nadal właściwy priorytet?
3. Audit Out of Scope — powody nadal ważne?
4. Aktualizacja Context o bieżący stan

---
*Last updated: 2026-04-04 after initialization*
