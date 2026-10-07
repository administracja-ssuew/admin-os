-- Migration: Atomowa deduplikacja powiadomień i Realtime dla dzwoneczka — 2026-10-07
--
-- Stan wyjściowy: serwer (lib/notifications/dispatch.ts) najpierw sprawdzał, czy takie
-- powiadomienie już istnieje, a potem osobnym zapytaniem je zapisywał. Równoległe wywołania
-- tego samego zdarzenia przechodziły oba sprawdzenia i każde wysyłało e-mail.
--
-- Po migracji sprawdzenie i zapis to jedna funkcja wykonywana pod blokadą doradczą
-- (pg_advisory_xact_lock) na kluczu odbiorca + typ + link. Drugie wywołanie czeka na
-- zakończenie pierwszej transakcji i widzi już zapisany wiersz.
--   * p_since = NULL  → powiadomienie najwyżej raz, kiedykolwiek;
--   * p_since = czas  → najwyżej raz od tej chwili (okno 10 minut liczy serwer).
-- Funkcję wywołuje wyłącznie serwer kluczem service role; anon i authenticated nie mają prawa.
--
-- Wdrożenie: migrację uruchamia się PRZED wdrożeniem kodu, który woła tę funkcję.
-- Migracja jest idempotentna (można ją uruchomić ponownie).

BEGIN;

-- ─── 1. Zapis powiadomienia najwyżej raz (sprawdzenie i insert pod jedną blokadą) ──
CREATE OR REPLACE FUNCTION public.insert_notification_once(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text,
  p_since timestamptz
)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Blokada do końca transakcji: równoległe wywołania z tym samym kluczem czekają w kolejce
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_user_id::text || '|' || p_type || '|' || coalesce(p_link, '')));

  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = p_user_id
      AND n.type = p_type
      AND n.link IS NOT DISTINCT FROM p_link
      AND (p_since IS NULL OR n.created_at >= p_since)
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (p_user_id, p_type, p_title, p_body, p_link);
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.insert_notification_once(uuid, text, text, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_notification_once(uuid, text, text, text, text, timestamptz)
  TO service_role;

-- ─── 2. Realtime: dzwoneczek subskrybuje zmiany w notifications ───────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

COMMIT;
