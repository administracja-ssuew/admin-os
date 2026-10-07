# Weryfikacja zmian — 2026-09-21

## Wyniki

- `npm ci --dry-run --offline --no-audit --no-fund`: poprawny lockfile. Zależności zainstalowano po usunięciu konfliktu peer dependency Supabase.
- `npm run typecheck`: PASS.
- `npm test`: PASS, 13 testów.
- `npm run build`: PASS, Next.js 16.2.1/Turbopack. Użyto wyłącznie przykładowego publicznego URL i klucza Supabase, bez dostępu do danych produkcyjnych.
- Lint dla app/scores, ScoresAccessPanel, useScoresAccess, case-filters, tests, FilterBar, Zebrań i lib/email: PASS bez ostrzeżeń.
- Pełny lint: 83 błędy i 25 ostrzeżeń. Porównanie ESLint na źródłach bazowego commita 2b08482: 90 błędów i 28 ostrzeżeń. Brak nowych błędów w porównaniu liczników plik/reguła. Pozostały m.in. any i stare wzorce efektów React w innych modułach.
- `git diff --check`: PASS.

Test HTTP na lokalnym buildzie: /login i /wniosek odpowiadają 200; HTML wniosku zawiera tytuł i nie zawiera kategorii; /knowledge odpowiada 404. /scores bez sesji zwraca strumieniowany redirect Next.js do /login (`NEXT_REDIRECT;replace;/login;307;`), bez treści ocen. Zewnętrzny status odpowiedzi strumieniowanej wynosi 200, co nie oznacza udzielenia dostępu.

## Weryfikacja zmian z 2026-10-06

- `npm run typecheck`, `npm test` (21 testów, w tym nowe `dashboard` i `cred-notes`), `npm run build` z przykładowym URL/kluczem Supabase: PASS.
- ESLint zmienionych plików: brak nowych błędów względem bazowego commita (liczniki reguł równe, 2 ostrzeżenia mniej).
- Nie wykonano testu w przeglądarce z rzeczywistą sesją — lokalnie brak `.env.local`.
- `tests/rls-cleanup.test.mjs` (PGlite): anon, pending, inactive, member, admin, Storage, sprzątanie struktury i blokada usuwania tabel z danymi. Przed wdrożeniem migrację uruchomiono na produkcji w transakcji z ROLLBACK, z odczytem w imieniu admina, członka i anon.

## Co sprawdzają testy

PGlite uruchamia rzeczywisty silnik PostgreSQL, tabele, funkcje i RLS z nowych migracji. Fixture emuluje auth.uid() i konta Supabase; identyfikatory profili celowo różnią się od kont Auth.

Scenariusze obejmują właściciela panelu, osobę dopuszczoną, samo posiadanie roli superadmin, brak sesji, niezweryfikowane/zawieszone konto, trwałe nadanie i odebranie dostępu, zakaz edycji ocen i limitów przez podgląd, zakaz zarządzania dostępami przez podgląd oraz zmianę publicznego e-maila w celu podszycia się pod właściciela.

Dodatkowo testowane są wyłączenie dostępu do usuniętych modułów bez utraty historii, zapis sprawy bez kategorii, sygnatury SPR/CRED, łączenie filtrów i data graniczna obejmująca cały dzień.

## Weryfikacja powiadomień (Task 8 — dzwoneczek, linki do rekordów)

- `npm run typecheck`: PASS.
- `npm test`: PASS, 58 testów (0 błędów).
- `npm run build` z przykładowym `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` (bez dostępu do danych produkcyjnych), po usunięciu `.next`: PASS, Next.js 16.2.1/Turbopack.
- ESLint `components/NotificationBell.tsx`, `app/tasks/page.tsx`, `app/cases/page.tsx`, `types/index.ts`: liczba błędów taka sama jak w bazowym commicie (29/29, policzone per plik). Przybyło jedno ostrzeżenie `react-hooks/exhaustive-deps` w `app/cases/page.tsx` — `fetchData` teraz wywołuje `openCaseDetails` (otwarcie rekordu z linku powiadomienia), co reguła liczy jako nową zależność efektu; błędów to nie dotyczy, a wzorzec (funkcja wywołana przed deklaracją w tym samym komponencie) jest już w pliku.
- Nie wykonano testu w przeglądarce z rzeczywistą sesją — lokalnie brak `.env.local`; nie wykonano żadnego zapytania do bazy ani adresu produkcyjnego.

## Poprawki po przeglądzie całej gałęzi powiadomień (2026-10-07)

- Deduplikacja jest atomowa w bazie: funkcja `public.insert_notification_once` (migracja `supabase/migrations/20261007_notifications_dedupe.sql`) sprawdza i zapisuje wpis pod blokadą `pg_advisory_xact_lock`; e-mail wychodzi tylko wtedy, gdy wpis faktycznie powstał. Ta sama migracja dodaje `notifications` do publikacji `supabase_realtime`.
- `account_pending` linkuje do konkretnego konta (`/users?user=<id>`) — każde nowe konto trafia do zarządu, nie tylko pierwsze.
- Formularz publiczny: escapowany tytuł i numer w potwierdzeniu, limit długości tytułu (200) i opisu (6000) na serwerze, powiadomienia po odpowiedzi (`after()`), osobna obsługa błędów dla zarządu i wnioskodawcy.
- Drobne: brak powiadomień dla nieaktywnych właścicieli, `account_pending` raz na zamontowanie `AuthGuard`, data warszawska z `formatToParts`, JSON 500 przy błędzie weryfikacji autora, limit HTML i obsługa błędów `MailApp` w `scripts/gas/mailer.gs`.

Wyniki lokalne:

- `npm run typecheck`: PASS.
- `npm test`: PASS, 69 testów (0 błędów), w tym nowy `tests/notifications-dedupe.test.mjs` (PGlite: pierwszy zapis, powtórka w oknie, `p_since = NULL`, inny link/odbiorca, brak prawa wywołania dla `anon`/`authenticated`, publikacja Realtime, dwukrotne uruchomienie migracji).
- `npm run build` z przykładowym `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`: PASS.
- ESLint zmienionych plików: 1 błąd i 2 ostrzeżenia — te same co przed zmianą (zastane w `components/AuthGuard.tsx`).
- Migrację uruchomiono wyłącznie lokalnie w PGlite; nie wykonano żadnego zapytania do bazy ani adresu produkcyjnego. Prawdziwej współbieżności (wiele połączeń naraz) PGlite nie odtwarza — blokadę potwierdzi dopiero odbiór na produkcji. `after()` nie był uruchamiany w przeglądarce.

### Odbiór na produkcji — pozostaje do wykonania (po wdrożeniu Vercel)

Nic z tej listy nie zostało jeszcze wykonane; brak tu żadnych wyników.

0. **Przed wdrożeniem kodu** zastosować migrację `supabase/migrations/20261007_notifications_dedupe.sql` (kod woła funkcję `insert_notification_once`; bez migracji zapis powiadomień kończy się błędem). Sprawdzić: `select has_function_privilege('authenticated', 'public.insert_notification_once(uuid, text, text, text, text, timestamptz)', 'EXECUTE')` → `false`.
1. `npm run sb -- db query --linked "select type, count(*) from notifications where created_at > now() - interval '1 hour' group by 1"` — stan wyjściowy przed testami.
2. Zalogowany jako `administracja@` przez REST: `POST https://admin-os-lake.vercel.app/api/notifications` z `{"event":"task_assigned","id":"<zadanie z właścicielem innym niż admin>"}` → oczekiwane 200, `inserted: 1`; drugie wywołanie → oczekiwane `skipped: 1`.
3. `{"event":"task_reviewed","id":"<zadanie bez oceny>"}` → oczekiwane 403; `{"event":"external_submission","id":"x"}` → oczekiwane 400.
4. Usunięcie wpisów testowych: `delete from notifications where created_at > '<czas testu>' and link like '/tasks?task=<id>'`.
5. Po ustawieniu przez użytkownika `MAIL_GAS_URL`, `MAIL_GAS_TOKEN`, `CRON_SECRET` w Vercel i wdrożeniu `scripts/gas/mailer.gs`: wywołanie deadline-check z nagłówkiem `Authorization: Bearer $CRON_SECRET` → oczekiwane 200 z liczbami wysłanych powiadomień; sprawdzenie skrzynki pocztowej.
6. Dwa różne nowe konta oczekujące (rejestracja dwóch kont testowych) → każde tworzy wpis `account_pending` u każdej osoby z zarządu (`link = '/users?user=<id>'`); ponowne wejście tego samego konta nie tworzy kolejnego wpisu.
7. Realtime: `select tablename from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications'` zwraca wiersz; nowe powiadomienie pojawia się w dzwoneczku bez przeładowania strony.
8. Zadanie z właścicielem i terminem na jutro (czas warszawski) → wywołanie deadline-check → wpis `deadline_tomorrow` i e-mail rzeczywiście docierają. Potwierdza to założenie, że `tasks.deadline` jest zwykłą datą (bez godziny) porównywaną z dniem w Warszawie.

## Ograniczenia i dalszy audyt

- Migracje nie były wykonywane na zdalnym Supabase. Fixture nie zastępuje kontroli realnego schematu, wcześniejszych triggerów i historii migracji. Repo nie zawiera kompletnego bazowego schematu.
- Nie wykonano pełnego testu przeglądarkowego z prawdziwymi kontami ani wysyłki e-maili. Scenariusze odbioru są w CHANGE_REQUESTS.md.
- Pełny lint pozostaje długiem technicznym. CI raportuje go jako krok doradczy; testy, typy, build i lint modułu uprawnień są obowiązkowe. Nie wyłączano reguł dla całej aplikacji.
- Szerszy audyt bezpieczeństwa pozostaje istotny: publiczne Server Actions używają service role, a część wcześniejszej walidacji jest tylko po stronie klienta. Istniejące mechanizmy sesji, polityki users, walidacja uploadów i publiczny podgląd spraw wymagają osobnego przeglądu na docelowym schemacie. Bieżące testy nie potwierdzają bezpieczeństwa całej aplikacji.
- System Motywacyjny udostępnia uprawnionym osobom także notatki ocen. Zmieniono mylącą etykietę „prywatna” na „dla uprawnionych”.
- Node może wypisać ostrzeżenie o automatycznym rozpoznaniu ESM przy imporcie TypeScript w testach; nie wpływa ono na wynik.
