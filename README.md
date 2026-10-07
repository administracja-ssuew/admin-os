# AdminOS

Wewnętrzny panel administracyjny samorządu UE we Wrocławiu: sprawy i wnioski, zadania, zebrania, praca podkomisji, dokumenty, CRED, kadry oraz System Motywacyjny. Publiczne Biuro Podawcze działa pod `/wniosek`.

## Szybki start

Używaj Node.js 24 (plik `.nvmrc`) i npm. Polecenia testowe korzystają z natywnej obsługi TypeScript w Node.

```sh
npm ci
cp .env.local.example .env.local
npm run dev
```

W PowerShell kopiowanie: `Copy-Item .env.local.example .env.local`. Jeśli polityka blokuje `npm.ps1`, używaj `npm.cmd`, bez zmiany polityki systemowej. Otwórz http://localhost:3000.

Uzupełnij publiczny URL i klucz Supabase. Pozostałe zmienne konfigurują CRED, e-maile (Google Apps Script), powiadomienia i cron; szczegóły w `.env.local.example`. Nigdy nie dodawaj `NEXT_PUBLIC_` do klucza service role lub innych sekretów. Klient publiczny ma dostęp ograniczony politykami RLS.

## Najpierw przeczytaj

- [Kontekst, mapa modułów i architektura](docs/PROJECT_CONTEXT.md).
- [Zmiany z 21.09.2026 i wdrożenie migracji](docs/CHANGE_REQUESTS.md).
- [Weryfikacja i znane ograniczenia](docs/VALIDATION.md).
- `AGENTS.md`, `PRODUCT.md`, `DESIGN.md`.

`.planning/` jest historyczną dokumentacją wcześniejszych etapów. W razie sprzeczności dotyczących zmian z września 2026 pierwszeństwo mają bieżący kod, aktualne wymagania użytkownika i dokumenty w `docs/`.

## Sprawdzenie zmian

```sh
npm run typecheck
npm test
npm run lint
npm run build
```

Testy uruchamiają lokalny PostgreSQL przez PGlite; nie potrzebują konta Supabase ani kluczy i nie dotykają zewnętrznej bazy. Pełny lint ma zastane błędy, opisane w `docs/VALIDATION.md`. CI wymaga przejścia typów, testów i buildu, a pełny lint raportuje oddzielnie.

Build pobiera font Inter. Do samej kompilacji wystarczają publiczne zmienne Supabase; wartości przykładowe pozwalają sprawdzić build, ale nie uruchamiają logowania ani danych. `npm start` uruchamia gotowy build.

## E-maile i powiadomienia

E-maile wysyła skrypt Google Apps Script (`scripts/gas/mailer.gs`), bez Resend i konfiguracji DNS. Zmienne serwerowe (Vercel → Settings → Environment Variables, lokalnie `.env.local`):

- `MAIL_GAS_URL` — adres wdrożenia skryptu (…/exec): Wdróż → Aplikacja internetowa, „Wykonaj jako: ja”, „Kto ma dostęp: każdy”;
- `MAIL_GAS_TOKEN` — losowy sekret, ta sama wartość co właściwość `TOKEN` w Script Properties skryptu;
- `CRON_SECRET` — sekret codziennych przypomnień o terminach (`/api/notifications/deadline-check`, Vercel Cron dodaje nagłówek sam);
- `NEXT_PUBLIC_APP_URL` — adres aplikacji używany w linkach w e-mailach;
- `SUPABASE_SERVICE_ROLE_KEY` — wymagany do zapisu powiadomień.

Bez `MAIL_GAS_URL`/`MAIL_GAS_TOKEN` e-maile są pomijane z ostrzeżeniem w logach, a dzwoneczek działa. Zmienne nie są potrzebne do buildu.

## Baza danych

**Przed wdrożeniem zmian dostępu i formularzy zastosuj obie nowe migracje opisane w `docs/CHANGE_REQUESTS.md`.** Nie uruchamiano ich na produkcji w ramach prac nad kodem. Powiadomienia wymagają też migracji `supabase/migrations/20261007_notifications_dedupe.sql` — zastosuj ją przed wdrożeniem kodu (lista w `docs/VALIDATION.md`).

Repozytorium zawiera migracje rozszerzające istniejącą bazę, ale nie kompletny schemat startowy. Historyczne pliki mają również powtarzające się prefiksy dat. Nie zakładaj, że `supabase db reset` lub automatyczne odtworzenie wszystkich plików zadziała na pustej bazie. Najpierw sprawdź stan i historię migracji docelowego projektu Supabase.
