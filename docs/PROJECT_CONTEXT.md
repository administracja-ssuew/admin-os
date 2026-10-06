# Kontekst projektu — 2026-09-21

## Źródło i lokalna organizacja pracy

Właściwy kod pochodzi z https://github.com/administracja-ssuew/admin-os, gałąź master, commit bazowy `2b08482`. Istnieje też gałąź main z innym układem katalogów; nie jest bazą tych zmian.

Początkowy katalog lokalny zawierał wyłącznie stary starter. Aby zachować jego niezacommitowane zmiany, utworzono worktree `.worktrees/panel-updates` na gałęzi `changes/requested-panel-updates`. W tej sesji polecenia aplikacji wykonuj właśnie w tym worktree. Gałąź zmian: changes/requested-panel-updates. Migracje nie zostały zastosowane na produkcji.

## Architektura

Next.js 16.2.1 App Router, React 19.2.4, TypeScript strict, Tailwind CSS 4, lucide-react, react-hot-toast, Supabase Auth/Postgres/Storage/Realtime. Sesja klienta korzysta z `@supabase/ssr` i cookies. Serwer odczytuje cookies przez asynchroniczne `cookies()`.

| Katalog/plik | Odpowiedzialność |
| --- | --- |
| app/layout.tsx | Polski dokument HTML, Inter, globalny AuthGuard i toasty |
| app/page.tsx | Dashboard |
| app/login, app/pending | Logowanie i weryfikacja konta |
| app/cases | Rejestr spraw, przypisania, komentarze, załączniki, historia |
| app/wniosek, app/wniosek/status | Publiczny wniosek i podgląd statusu |
| app/meetings | Zebrania, obecność, porządek obrad, protokoły |
| app/tasks, app/calendar | Zadania i kalendarz |
| app/archiving, components/ArchiveFoldersPanel.tsx | Archiwizacja — Moduł Teczek; `/my-department` tylko przekierowuje |
| lib/files.ts, components/FileLink.tsx | Prywatny magazyn plików: ścieżki, linki podpisane, wysyłka z formularza publicznego |
| lib/dashboard.ts | Reguły dashboardu: pilność, widoczność na Tablicy, sortowanie |
| components/Skeleton.tsx | Szkielety ładowania w kształcie widoków (jedyny komponent ładowania danych) |
| app/cred, app/api/cred | Integracja CRED przez serwer |
| app/documents, app/executive, app/users, app/brainstorm | Dokumenty, kierownictwo, kadry, burza mózgów |
| app/scores | System Motywacyjny: bramka serwerowa i interfejs |
| components/Sidebar.jsx | Nawigacja, motyw, menu mobilne |
| hooks/ | Pobieranie użytkownika i danych modułów |
| lib/supabase.ts, lib/supabase-server.ts | Klienci Supabase przeglądarki i serwera |
| app/actions, app/api/notifications, lib/email* | Wniosek zewnętrzny i powiadomienia |
| types/index.ts | Współdzielone modele aplikacji |
| supabase/migrations | Rozszerzenia schematu i polityk RLS |
| tests/ | Testy filtrów oraz rzeczywistych polityk SQL w PGlite |

Większość stron jest komponentami klientowymi i komunikuje się bezpośrednio z Supabase. AuthGuard odpowiada za przepływ interfejsu; nie zastępuje autoryzacji w bazie. Operacje z service role omijają RLS i wymagają osobnej walidacji/autoryzacji po stronie serwera.

## System Motywacyjny

Źródło uprawnień: funkcje SQL `is_scores_admin()` i `has_scores_access()`, a nie rola superadmin ani lokalna flaga. Administrator jest identyfikowany przez zweryfikowany adres w `auth.users` powiązany z `auth.uid()`.

`public.scores_access.user_id` wskazuje **auth.users.id**. Identyfikatory `public.users.id` mogą się różnić; oceny nadal odnoszą się do profili publicznych. Nie zamieniaj tych identyfikatorów.

Administrator nadaje dostęp w `ScoresAccessPanel`. Osoby dopuszczone mają podgląd ocen i rankingu. Zapis ocen i zmiana limitów pozostają dostępne tylko wskazanemu kontu. Odwołanie uprawnień blokuje kolejne zapytanie do bazy; interfejs odświeża widoczność co 30 sekund i po odzyskaniu fokusu.

## Zasady zmian

- Przed pracą z API Next.js czytaj lokalne przewodniki zgodnie z AGENTS.md.
- Zachowuj styl i istniejące przepływy; nie buduj równoległej aplikacji.
- Przy zmianie pól spraw sprawdzaj oba formularze, Server Actions, status publiczny, e-maile, archiwum i migracje.
- Nie usuwaj starych migracji ani historycznych danych tylko dlatego, że moduł zniknął z UI.
- Nie traktuj ukrycia zakładki jako zabezpieczenia jej danych.
- Nie wnioskuj o wdrożeniu migracji z obecności pliku SQL w repozytorium.
