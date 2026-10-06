-- Migration: Status wniosku, prywatne pliki, usunięcie modułów podkomisji — 2026-10-06
-- Wymaga 20261006_enforce_rls_cleanup.sql (funkcja is_active_member).

BEGIN;

-- ─── 1. Publiczny status wniosku: numer sprawy + e-mail z wniosku ─────────────────
-- Tabela cases jest dostępna tylko dla członków, a numery są kolejne (WNI/RRRR/NNNN).
-- Funkcja zwraca wyłącznie status i daty, i tylko gdy e-mail zgadza się z tym, który
-- formularz zapisał na początku opisu: "[E-mail: adres | Tel: …]" albo "[E-mail: adres]".
CREATE OR REPLACE FUNCTION public.public_request_status(p_case_number text, p_email text)
RETURNS TABLE (case_number text, status text, created_at timestamptz, closed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.case_number::text, c.status::text, c.created_at, c.closed_at
  FROM public.cases c
  WHERE c.source = 'Formularz Zewnętrzny'
    AND c.case_number = upper(btrim(p_case_number))
    AND length(btrim(coalesce(p_email, ''))) > 3
    AND lower(substring(c.description FROM '^\[E-mail: ([^] |]+)')) = lower(btrim(p_email))
$$;
REVOKE ALL ON FUNCTION public.public_request_status(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_request_status(text, text) TO anon, authenticated;

-- ─── 2. Pliki tylko dla członków ──────────────────────────────────────────────────
-- Aplikacja otwiera pliki linkami podpisanymi; formularz publiczny wysyła pliki przez
-- jednorazowy link wydany przez serwer (folder wnioski/), bez polityki dla anon.
UPDATE storage.buckets SET public = false, file_size_limit = 26214400 WHERE id = 'adminos-files';
DROP POLICY IF EXISTS "Odczyt dla wszystkich" ON storage.objects;
CREATE POLICY "Odczyt dla członków" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'adminos-files' AND (SELECT public.is_active_member()));

-- ─── 3. Moduły podkomisji usunięte z aplikacji (Logistyka, Granty, Podania) ───────
DO $$
DECLARE t text; n bigint;
BEGIN
  -- reports: dopuszczalny jest wyłącznie testowy wpis z 2026-04-06 ("thn" / "tntnt")
  IF to_regclass('public.reports') IS NOT NULL THEN
    SELECT count(*) INTO n FROM public.reports WHERE NOT (title = 'thn' AND content = 'tntnt');
    IF n > 0 THEN RAISE EXCEPTION 'Tabela public.reports zawiera % wpisów poza testowym — przerwano', n; END IF;
    DROP TABLE public.reports;
  END IF;
  FOREACH t IN ARRAY ARRAY['petitions', 'assets', 'equipment_loans', 'grants_radar'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      IF n > 0 THEN RAISE EXCEPTION 'Tabela public.% zawiera % wierszy — przerwano, dane nie są usuwane', t, n; END IF;
      EXECUTE format('DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

COMMIT;
