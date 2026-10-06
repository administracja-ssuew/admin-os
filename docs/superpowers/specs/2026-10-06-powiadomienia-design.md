# Powiadomienia — projekt (2026-10-06)

## Cel

Członkowie i zarząd dowiadują się na czas o tym, co wymaga ich działania: przydzielonych zadaniach i sprawach, terminach, nowych wnioskach i kontach do weryfikacji. Dzwoneczek w aplikacji działa zawsze; e-mail tylko przy zdarzeniach wymagających działania. Bez ustawień per osoba (decyzja użytkownika).

Kryteria sukcesu:
- każde zdarzenie z tabeli niżej trafia do właściwych osób, żadne nie trafia do autora zmiany;
- nikt nie może wysłać powiadomienia ani e-maila z dowolną treścią lub do dowolnego adresu;
- przypomnienia o terminach przychodzą codziennie bez ręcznego uruchamiania;
- kliknięcie powiadomienia otwiera konkretne zadanie lub sprawę;
- brak konfiguracji poczty nie psuje aplikacji (dzwoneczek działa, e-maile są pomijane).

## Zdarzenia

| Zdarzenie | Odbiorca | Dzwoneczek | E-mail |
|---|---|---|---|
| `task_assigned` — zadanie przydzielone | właściciel zadania, jeśli ≠ autor | ✓ | ✓ |
| `task_reviewed` — odesłane do poprawek | właściciel zadania | ✓ | ✓ |
| `task_reviewed` — zatwierdzone | właściciel zadania | ✓ | — |
| `deadline_tomorrow` — termin jutro | właściciel zadania | ✓ | ✓ |
| `deadline_overdue` — pierwszy dzień po terminie (raz) | właściciel zadania | ✓ | ✓ |
| `external_submission` — nowy wniosek z formularza | zarząd (admin, superadmin) | ✓ | ✓ |
| `case_assigned` — nowy prowadzący sprawy | prowadzący, jeśli ≠ autor | ✓ | ✓ |
| `case_status_changed` | prowadzący, jeśli ≠ autor | ✓ | — |
| `case_comment` | prowadzący, jeśli ≠ autor komentarza | ✓ | — |
| `account_pending` — nowe konto czeka | zarząd | ✓ | ✓ |
| `account_approved` — konto zatwierdzone | ta osoba | ✓ | ✓ |

Potwierdzenie złożenia wniosku dla wnioskodawcy (e-mail) pozostaje bez zmian. Zadania bez właściciela i sprawy bez prowadzącego nie generują powiadomień „do osoby”.

Poza zakresem: zebrania, komentarze w zadaniach (brak takiej funkcji), ustawienia powiadomień, powiadomienia push w przeglądarce, podsumowania dzienne.

## Architektura (podejście A: serwer z typowanymi zdarzeniami)

```
przeglądarka ──POST /api/notifications {event, id}──▶ route (weryfikacja tokenu)
                                                        │
                                   lib/notifications/resolve.ts  (czyste funkcje: zdarzenie + dane z bazy → odbiorcy i treść)
                                                        │
                                   lib/notifications/dispatch.ts (deduplikacja, insert do notifications, e-mail)
                                                        │
                                   lib/email.ts ──POST {to, subject, html, token}──▶ Google Apps Script (MailApp)

Vercel Cron (codziennie) ──GET /api/notifications/deadline-check (Bearer CRON_SECRET)──▶ resolve + dispatch
submitExternalCase (server action) ──bezpośrednio──▶ dispatch(external_submission)
```

Jednostki:
- `lib/notifications/events.ts` — typy zdarzeń, etykiety, które zdarzenia wysyłają e-mail, budowa linków (`/tasks?task=<id>`, `/cases?case=<id>`).
- `lib/notifications/resolve.ts` — czyste funkcje bez dostępu do sieci. Wejście: zdarzenie, autor (profil z bazy), rekord z bazy (zadanie/sprawa/konto), lista zarządu. Wyjście: lista `{ userId, email, title, body, link, sendEmail }` albo odmowa z powodem. Tu są wszystkie reguły z tabeli i sprawdzenia uprawnień. Testowane jednostkowo.
- `lib/notifications/dispatch.ts` — dla każdego odbiorcy: deduplikacja, insert do `notifications` (service role), e-mail przez `sendEmail`. Błąd e-maila nie przerywa reszty.
- `lib/email.ts` — `sendEmail({to, subject, html})` przez Google Apps Script; wspólny szablon HTML z przyciskiem do konkretnego miejsca. Biblioteka Resend usunięta.
- `scripts/gas/mailer.gs` — kod Apps Script do wklejenia (doPost, weryfikacja tokenu z Script Properties, `MailApp.sendEmail` z `name: 'AdminOS'`, limit długości, odpowiedź JSON).

### API `POST /api/notifications`

Body: `{ event: 'task_assigned' | 'task_reviewed' | 'case_assigned' | 'case_status_changed' | 'case_comment' | 'account_pending' | 'account_approved', id: string }`. Żadnych e-maili, tytułów ani treści od klienta.

Autor = użytkownik z tokenu (`auth.getUser`) → profil `public.users` po e-mailu. Sprawdzenia (odmowa = 403, nic nie jest wysyłane):
- zdarzenia zadań i spraw: autor jest aktywnym członkiem; rekord istnieje;
- `task_reviewed`: autor jest w zarządzie; `verification_status` w bazie to `approved` lub `rejected` — od tego zależy treść;
- `case_comment`: w bazie istnieje komentarz autora do tej sprawy sprzed ≤ 10 min;
- `account_pending`: autor to ta sama osoba (`id` = jego profil) i ma rolę `pending`;
- `account_approved`: autor w zarządzie; konto docelowe ma rolę aktywnego członka.

Deduplikacja: brak nowego wpisu, jeśli ten sam odbiorca ma już powiadomienie o tym samym `type` i `link` z ostatnich 10 minut; dla `deadline_overdue`, `account_pending`, `account_approved` — jeśli ma je kiedykolwiek. Ogranicza to również wielokrotne wywołania tego samego zdarzenia.

### Przypomnienia o terminach

`vercel.json`: cron `0 5 * * *` (UTC) → 7:00 czasu letniego, 6:00 zimowego. Route sprawdza `Authorization: Bearer CRON_SECRET` (Vercel dodaje go sam). Daty liczone w strefie Europe/Warsaw: „jutro” = termin jutro, „po terminie” = termin wczoraj (pierwszy dzień spóźnienia), tylko zadania nieukończone z właścicielem.

### Dzwoneczek

- Subskrypcja Realtime po `user_id` z profilu (`public.users.id`), nie po `auth.uid()` — dziś identyfikatory mogą się różnić.
- Kliknięcie przechodzi pod `link`; strony Zadania i Rejestr Spraw otwierają szczegóły rekordu z parametru `?task=` / `?case=`.
- Istniejące wywołania `sendNotification(type, payload)` w Zadaniach, Sprawach i Kadrach zastąpione przez `notify(event, id)`; `AuthGuard` (stan pending) wywołuje `account_pending`.

## Konfiguracja (Vercel → Settings → Environment Variables)

- `MAIL_GAS_URL` — adres wdrożenia Apps Script (Wdróż → Aplikacja internetowa, „Wykonaj jako: ja”, „Dostęp: każdy”).
- `MAIL_GAS_TOKEN` — losowy sekret; ten sam w Script Properties skryptu (`TOKEN`).
- `CRON_SECRET` — losowy sekret dla przypomnień.
- `NEXT_PUBLIC_APP_URL` — adres aplikacji do linków w e-mailach (np. https://admin-os-lake.vercel.app).

Brak `MAIL_GAS_URL`/`MAIL_GAS_TOKEN`: e-maile pomijane z ostrzeżeniem w logach, dzwoneczek działa. Limity Google: ok. 100 odbiorców dziennie (Gmail), ok. 1500 (Workspace).

## Obsługa błędów

- Route zwraca 200 także wtedy, gdy część e-maili się nie udała (powiadomienia w aplikacji są zapisane); błędy e-maili trafiają do logów.
- Odmowa uprawnień lub nieznane zdarzenie: 400/403 bez skutków ubocznych.
- Wywołania z przeglądarki są „wyślij i zapomnij” — błąd powiadomienia nie blokuje zapisu zadania/sprawy.

## Testy

- `resolve`: każde zdarzenie z tabeli — odbiorcy, kanały, pomijanie autora, odmowy uprawnień, treść zależna od statusu weryfikacji.
- Deduplikacja i daty przypomnień (strefa Warszawa, przełom miesiąca).
- `sendEmail`: brak konfiguracji → pominięcie; poprawny kształt żądania do Apps Script (fetch podmieniony w teście).
- Po wdrożeniu: wywołanie zdarzeń na produkcji kontem administracja@ i sprawdzenie wpisów w `notifications`; test wysyłki e-maila po skonfigurowaniu Apps Script.
