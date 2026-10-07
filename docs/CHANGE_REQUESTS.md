# Zmiany z 2026-09-21

## Wykonane w kodzie

1. System Motywacyjny: dostęp dla zweryfikowanego konta `administracja@samorzad.ue.wroc.pl`; panel nadawania i odbierania podglądu innym istniejącym kontom. Zwykła rola superadmin nie wystarcza. Nawigacja, wejście przez URL i dane są zabezpieczone. Przyjęto interpretację „widzenia zakładki” jako podglądu; osoby dopuszczone nie edytują ocen ani uprawnień.
2. Usunięta Baza Wiedzy: strona `/knowledge`, nawigacja i typ artykułu. Nowa migracja zamyka dostęp aplikacji do historycznej tabeli. Zależność react-markdown pozostaje, bo używa jej Burza Mózgów.
3. Zebrania: usunięte głosowania, wyniki, subskrypcje i operacje na głosach. Zachowano porządek obrad i notatki, obecność, protokoły i załączniki.
4. Rejestr Spraw: wyłącznie filtry sygnatury (numer sprawy i sygnatura CRED), statusu (Nowa/W toku/Zamknięta) oraz daty „Do”. Data nadal dotyczy utworzenia sprawy, obejmuje cały wskazany dzień. Kontrolka daty ma polski język i opis formatu dd.mm.rrrr; natywny sposób renderowania zależy od ustawień przeglądarki.
5. Kategoria/typ sprawy: usunięte z tworzenia sprawy, wniosku, listy, podglądu statusu, archiwum i powiadomień. Nowe rekordy nie podają tej wartości.
6. Uzupełnione instrukcje projektu, konfiguracja e-maili, testy, CI i polecenie typecheck. Naprawiony konflikt zależności: @supabase/ssr 0.10.0 wymaga supabase-js co najmniej 2.100.1; przypięto kompatybilną wersję 2.100.1. Resend jest inicjalizowany dopiero przy wysyłce, aby brak klucza nie blokował kompilacji.

## Wdrożenie bazy — pozostaje do wykonania na środowisku docelowym

Po sprawdzeniu kopii zapasowej i stanu bazy uruchom w SQL Editor właściwego projektu Supabase, w tej kolejności:

1. `supabase/migrations/20260921_scores_access.sql`
2. `supabase/migrations/20260921_retire_categories_knowledge_voting.sql`

To migracje jednorazowe, transakcyjne. Nie wymagają service role w przeglądarce. Pierwsza tworzy przydziały dostępu na UUID kont Auth, zastępuje polityki member_scores i zabezpiecza zmianę personal_limit. Druga usuwa obowiązkowość i domyślną wartość case_type oraz zamyka klientom dostęp do knowledge_articles i meeting_votes. Historyczne rekordy pozostają w bazie.

Nie zastosowano tych migracji do zdalnej bazy. Do czasu ich zastosowania nowy moduł ocen celowo odmawia dostępu. Formularze bez kategorii wymagają drugiej migracji. Skoordynuj migracje z wdrożeniem aplikacji; stara aplikacja po zmianie polityk utraci obsługę usuwanych modułów.

## Odbiór na rzeczywistym Supabase

- Zalogować wskazane konto, sprawdzić oceny i panel uprawnień.
- Nadać dostęp aktywnej osobie; sprawdzić menu, bezpośredni URL i podgląd po ponownym logowaniu.
- Odebrać dostęp; sprawdzić blokadę następnego zapytania oraz zniknięcie UI do 30 sekund lub po odzyskaniu fokusu.
- Sprawdzić brak odczytu i zapisu dla osoby bez dostępu, brak edycji dla osoby z podglądem i brak dostępu na samej roli superadmin.
- Złożyć wniosek bez kategorii, dodać sprawę wewnętrzną, odczytać starszą sprawę i jej status.
- Połączyć filtry sygnatury, statusu i daty granicznej, wyczyścić je.
- Sprawdzić porządek obrad, obecność i protokół; głosowania i /knowledge mają być niedostępne.

Kolejne wymagania użytkownika należy dopisywać, nie zastępując tej listy bez wyraźnego polecenia.

# Zmiany z 2026-10-06

1. Nawigacja: Panel Główny → Zadania → Rejestr Spraw → CRED → Archiwizacja → Zebrania. Podkomisje usunięte z interfejsu: „Moja Podkomisja” zastąpiła samodzielna zakładka `/archiving` (teczki archiwalne i rejestr podań) dla wszystkich zalogowanych; `/my-department` przekierowuje na `/archiving`. Podzakładka „Sprawy” (przypinanie spraw do podkomisji) oraz panele Logistyki i Grantów nie są już osiągalne z UI; pliki komponentów i dane w bazie pozostają. Widoczność zakładki nie zmienia uprawnień w bazie: `archive_folders` ma polityki dla wszystkich zalogowanych, polityki tabeli `petitions` nie są w repozytorium — sprawdzić na docelowym Supabase.
2. Sidebar ma wysokość okna (`h-dvh`), a nawigacja przewija się wewnątrz panelu.
3. Dashboard: usunięty kafelek „Nadchodzące Zebrania”; trzy kafelki statystyk są klikalne (Rejestr Spraw / Zadania). Pod nimi cztery kafelki zastępujące wykres i dotychczasowe listy: Moje zadania (otwarte, przypisane do zalogowanej osoby), Zadania ogólne (zadania widoczne na ogólnej Tablicy z licznikami i statusem), Nowe wnioski (sprawy z Formularza Zewnętrznego o statusie Nowa), Pilne (czerwony; niezakończone zadania z terminem dziś/jutro lub po terminie, z przyciskiem „Przejdź do Tablicy”). Logika w `lib/dashboard.ts`; Tablica Zadań używa tej samej reguły widoczności.
4. CRED: notatka była kodowana `encodeURIComponent` mimo wysyłki w JSON, przez co zapisywała się z `%20`. Tekst jest teraz wysyłany bez kodowania; historyczne zakodowane notatki są dekodowane przy wyświetlaniu (`lib/cred-notes.ts`), bez zmiany danych w arkuszu CRED.

5. Baza (produkcja `mutflmihoxndxefuxsno`), migracja `20261006_enforce_rls_cleanup.sql`. Stan wyjściowy wg `supabase db advisors`: 17 tabel bez RLS — anon (sam klucz publiczny, bez logowania) czytał i zmieniał m.in. `users.system_role`; polityki „authenticated USING true” wpuszczały konta pending/inactive. Po migracji: RLS na wszystkich tabelach; dostęp przez funkcje `is_active_member()`, `is_app_admin()`, `app_user_id()`; pending/inactive widzą tylko własny profil; role zmienia tylko zarząd; zapis plików w Storage tylko dla członków. Usunięte puste, nieużywane tabele `board_polls`, `risks`, `notification_preferences`, `meeting_votes` (migracja przerywa się, gdy tabela ma dane), zdublowane indeksy unikalne `cases_case_number_unique` i `department_notes_dept_unique`; ustalony `search_path` funkcji; `handle_new_user` i funkcje ocen niewywoływalne przez anon; `cases` i `tasks` dodane do Realtime (aplikacja je subskrybuje). Route `/api/cred` sprawdza rolę w imieniu zalogowanego użytkownika — bez tego RLS blokowałby zmiany w CRED. Konto `administracja@samorzad.ue.wroc.pl` przywrócone z `inactive` do `superadmin` (wpis w audit_log).

6. Status wniosku (`/wniosek/status`): dotąd odczyt `cases` jako anon — po RLS zawsze „nie znaleziono”, a kolejne numery pozwalały sprawdzać cudze wnioski. Teraz funkcja `public_request_status(numer, e-mail)` zwraca tylko status i daty, gdy e-mail zgadza się z wpisanym we wniosku. Strona: numer + e-mail, oś etapów, numer w dowolnym zapisie (`wni/2026/7`), link `?nr=` z e-maila i ekranu po złożeniu.
7. Pliki: magazyn `adminos-files` prywatny (limit 25 MB), odczyt tylko dla członków; aplikacja otwiera pliki linkiem podpisanym na 5 min (`FileLink`). Zapisane adresy załączników służą do wskazania pliku. Formularz publiczny wysyła pliki przez jednorazowy link wydany przez serwer (`createExternalUpload`, folder `wnioski/`, PDF/JPG/PNG/DOC do 10 MB); wcześniej wysyłka bez logowania była blokowana. Serwer przyjmuje tylko załączniki z tego folderu. Naprawione dodawanie kilku plików (zostawał ostatni).
8. Usunięte moduły podkomisji: kod Logistyki, Grantów i Podań oraz tabele `reports` (1 wpis testowy „thn”), `petitions`, `assets`, `equipment_loans`, `grants_radar` (puste). Archiwizacja = wyłącznie Moduł Teczek (`components/ArchiveFoldersPanel.tsx`).
9. Kadry i Weryfikacja: zawieszone konta są klikalne i można je przywrócić; zmiany ról i zawieszenia trafiają do `audit_log`; zapis bez uprawnień nie pokazuje już fałszywego „Zapisano”.

10. Podkomisje usunięte w całości: pola „Pion/Podkomisja” w zadaniach, sprawach i Kadrach, etykieta „Dedykowane dla Pionu”, tabele `departments` i `department_notes`, kolumny `department_id` w `users`, `tasks`, `cases` (migracja `20261006_remove_subcommittees.sql`; przed usunięciem 11 przypisanych osób, 0 zadań i spraw, puste notatki — migracja przerywa się, gdy coś jest przypisane). Widoczność zadań: członek — własne i nieprzypisane, zarząd — wszystkie poza tablicą Zarządu. Usunięte nieużywane hooki `useTasks`, `useCases`, `useUsers`.
11. Skeleton loading: wspólny `components/Skeleton.tsx` (szkielety w kształcie widoków, menu widoczne, `motion-safe`, komunikat dla czytników ekranu). Zastępuje kółka na Panelu, w Zadaniach, Sprawach, CRED, Archiwizacji, Zebraniach, Kalendarzu, Burzy Mózgów, Kierownictwie, Systemie Motywacyjnym, Kadrach i Dokumentach; pełnoekranowe ekrany ładowania AuthGuard i `app/loading.tsx` zastąpione zarysem aplikacji. Zadania, Kadry i Dokumenty nie pokazują już „Brak…” w trakcie ładowania; odświeżenie po zapisie nie chowa danych.
12. Powiadomienia: dzwoneczek w aplikacji (Realtime po `public.users.id`, nie po `auth.uid()`) i e-mail przez Google Apps Script dla zdarzeń wymagających działania. Zdarzenia i odbiorcy: przydzielenie zadania, ocena zadania (odesłanie do poprawek — dzwoneczek i e-mail; zatwierdzenie — tylko dzwoneczek), termin jutro i pierwszy dzień po terminie, nowy wniosek z formularza (zarząd), nowy prowadzący sprawy, zmiana statusu sprawy i komentarz w sprawie (prowadzący, tylko dzwoneczek), nowe konto do weryfikacji i jego zatwierdzenie — zawsze z wyłączeniem autora zmiany. Serwer sam ustala odbiorców i treść na podstawie zdarzenia i rekordu z bazy (`lib/notifications/resolve.ts`), deduplikuje wysyłki (`lib/notifications/dispatch.ts`) i wysyła e-mail przez `lib/email.ts`/`scripts/gas/mailer.gs`; z przeglądarki przyjmowana jest tylko nazwa zdarzenia i identyfikator rekordu (`POST /api/notifications`). Przypomnienia o terminach uruchamia codziennie Vercel Cron (`vercel.json`, `0 5 * * *` UTC → `GET /api/notifications/deadline-check`). Kliknięcie powiadomienia otwiera konkretny rekord (`/tasks?task=`, `/cases?case=`). Projekt: `docs/superpowers/specs/2026-10-06-powiadomienia-design.md`.

    Do ustawienia przez użytkownika: w Vercel (Settings → Environment Variables) zmienne `MAIL_GAS_URL` (adres wdrożenia Apps Script), `MAIL_GAS_TOKEN` (sekret, ten sam co w Script Properties skryptu), `CRON_SECRET` (sekret dla przypomnień, Vercel dodaje go sam do wywołania cronu) i `NEXT_PUBLIC_APP_URL` (adres aplikacji do linków w e-mailach); w Google Apps Script — wdrożenie `scripts/gas/mailer.gs` jako aplikacja internetowa („Wykonaj jako: ja”, „Dostęp: każdy”) z `TOKEN` w Script Properties. Bez `MAIL_GAS_URL`/`MAIL_GAS_TOKEN` e-maile są pomijane z ostrzeżeniem w logach, dzwoneczek działa bez zmian.

Odbiór: przewinąć menu na niskim oknie i na telefonie; sprawdzić 4 kafelki na koncie z przypisanymi zadaniami i nowym wnioskiem z formularza; dodać w CRED notatkę ze spacjami i polskimi znakami; otworzyć Archiwizację kontem bez roli admin i sprawdzić odczyt podań. Odbiór powiadomień na produkcji (po wdrożeniu Vercel i ustawieniu zmiennych) — lista kroków w `docs/VALIDATION.md`, jeszcze nie wykonany.
