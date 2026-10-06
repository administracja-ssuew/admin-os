-- Migration: Porządek w schemacie i obowiązkowe RLS — 2026-10-06
--
-- Stan wyjściowy (Supabase advisors): 17 tabel w public bez RLS. Rola anon (sam klucz
-- publiczny ze strony, bez logowania) mogła czytać i zmieniać m.in. users.system_role.
-- Polityki "authenticated USING true" wpuszczały też konta pending i inactive.
--
-- Zasada po migracji:
--   * aktywny członek = users.system_role IN ('member','active','admin','superadmin'),
--     konto rozpoznawane tak jak w całej aplikacji: users.email = auth.email();
--   * zarząd = admin lub superadmin;
--   * pending/inactive widzą wyłącznie własny profil (AuthGuard), anon nic.
-- Dane pozostają. Usuwane są tylko puste tabele bez odwołań w kodzie (z blokadą).
-- Operacje service role (formularz zewnętrzny, powiadomienia) omijają RLS jak dotąd.

BEGIN;

-- ─── 1. Funkcje pomocnicze (SECURITY DEFINER: bez rekurencji RLS na users) ────────
CREATE OR REPLACE FUNCTION public.app_user_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT u.id FROM public.users u WHERE u.email = auth.email()
$$;

CREATE OR REPLACE FUNCTION public.is_active_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.email = auth.email()
    AND u.system_role IN ('member', 'active', 'admin', 'superadmin'))
$$;

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.email = auth.email()
    AND u.system_role IN ('admin', 'superadmin'))
$$;

REVOKE ALL ON FUNCTION public.app_user_id(), public.is_active_member(), public.is_app_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_user_id(), public.is_active_member(), public.is_app_admin() TO authenticated;

-- ─── 2. Puste, nieużywane tabele ──────────────────────────────────────────────────
DO $$
DECLARE t text; n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['board_polls', 'risks', 'notification_preferences', 'meeting_votes'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      IF n > 0 THEN RAISE EXCEPTION 'Tabela public.% zawiera % wierszy — przerwano, dane nie są usuwane', t, n; END IF;
      EXECUTE format('DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ─── 3. Usunięcie dotychczasowych polityk tabel, które dostają nowy komplet ───────
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND tablename IN (
    'archive_folders', 'audit_log', 'brainstorm_cards', 'cases', 'meeting_protocols', 'notifications', 'reports'
  ) LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- ─── 4. RLS na wszystkich tabelach aplikacji ──────────────────────────────────────
ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_comments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_loans  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grants_radar     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petitions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_notes      ENABLE ROW LEVEL SECURITY;

-- users: własny profil zawsze (ekran weryfikacji), lista dla członków, zmiany ról tylko zarząd.
-- Nowe profile tworzy trigger handle_new_user; usuwanie wyłącznie z panelu Supabase.
CREATE POLICY users_select_self ON public.users FOR SELECT TO authenticated
  USING (email = (SELECT auth.email()));
CREATE POLICY users_select_members ON public.users FOR SELECT TO authenticated
  USING ((SELECT public.is_active_member()));
CREATE POLICY users_update_admin ON public.users FOR UPDATE TO authenticated
  USING ((SELECT public.is_app_admin())) WITH CHECK ((SELECT public.is_app_admin()));

-- Wspólna praca członków
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tasks', 'case_comments', 'assets', 'equipment_loans', 'grants_radar',
    'petitions', 'documents', 'department_notes', 'meetings', 'archive_folders'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated
      USING ((SELECT public.is_active_member())) WITH CHECK ((SELECT public.is_active_member()))', t || '_members', t);
  END LOOP;
END $$;

-- Słowniki: odczyt dla członków, zmiany dla zarządu
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['departments', 'projects', 'profiles'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
      USING ((SELECT public.is_active_member()))', t || '_select_members', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated
      USING ((SELECT public.is_app_admin())) WITH CHECK ((SELECT public.is_app_admin()))', t || '_admin', t);
  END LOOP;
END $$;

-- Panel Kierownictwa: tylko zarząd
CREATE POLICY decisions_admin ON public.decisions FOR ALL TO authenticated
  USING ((SELECT public.is_app_admin())) WITH CHECK ((SELECT public.is_app_admin()));
CREATE POLICY board_notes_admin ON public.board_notes FOR ALL TO authenticated
  USING ((SELECT public.is_app_admin())) WITH CHECK ((SELECT public.is_app_admin()));

-- ─── 5. Tabele z RLS — ten sam zakres co dotąd, ale bez kont pending/inactive ─────
-- cases: odczyt i dodawanie dla członków; zmiana przez zarząd lub prowadzącego; usuwanie zarząd
CREATE POLICY cases_select_members ON public.cases FOR SELECT TO authenticated
  USING ((SELECT public.is_active_member()));
CREATE POLICY cases_insert_members ON public.cases FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_active_member()));
CREATE POLICY cases_update_admin_or_owner ON public.cases FOR UPDATE TO authenticated
  USING ((SELECT public.is_app_admin()) OR owner_id = (SELECT public.app_user_id()));
CREATE POLICY cases_delete_admin ON public.cases FOR DELETE TO authenticated
  USING ((SELECT public.is_app_admin()));

-- meeting_protocols: członkowie czytają, dodają i edytują (bez usuwania, jak dotąd)
CREATE POLICY meeting_protocols_select_members ON public.meeting_protocols FOR SELECT TO authenticated
  USING ((SELECT public.is_active_member()));
CREATE POLICY meeting_protocols_insert_members ON public.meeting_protocols FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_active_member()));
CREATE POLICY meeting_protocols_update_members ON public.meeting_protocols FOR UPDATE TO authenticated
  USING ((SELECT public.is_active_member())) WITH CHECK ((SELECT public.is_active_member()));

-- reports: członkowie czytają i zgłaszają; status zmienia autor lub zarząd
CREATE POLICY reports_select_members ON public.reports FOR SELECT TO authenticated
  USING ((SELECT public.is_active_member()));
CREATE POLICY reports_insert_members ON public.reports FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_active_member()));
CREATE POLICY reports_update_author_or_admin ON public.reports FOR UPDATE TO authenticated
  USING ((SELECT public.is_app_admin()) OR submitted_by = (SELECT public.app_user_id()));

-- brainstorm_cards: tablica zarządu; edycja i usuwanie przez autora lub zarząd
CREATE POLICY brainstorm_select_admin ON public.brainstorm_cards FOR SELECT TO authenticated
  USING ((SELECT public.is_app_admin()));
CREATE POLICY brainstorm_insert_admin ON public.brainstorm_cards FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_app_admin()));
CREATE POLICY brainstorm_update_author_or_admin ON public.brainstorm_cards FOR UPDATE TO authenticated
  USING ((SELECT public.is_app_admin()) OR author_id = (SELECT public.app_user_id()))
  WITH CHECK ((SELECT public.is_app_admin()) OR author_id = (SELECT public.app_user_id()));
CREATE POLICY brainstorm_delete_author_or_admin ON public.brainstorm_cards FOR DELETE TO authenticated
  USING ((SELECT public.is_app_admin()) OR author_id = (SELECT public.app_user_id()));

-- audit_log: zapis przez członków, odczyt przez zarząd
CREATE POLICY audit_log_insert_members ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_active_member()));
CREATE POLICY audit_log_select_admin ON public.audit_log FOR SELECT TO authenticated
  USING ((SELECT public.is_app_admin()));

-- notifications: własne; tworzy je wyłącznie serwer (service role), stąd brak polityki INSERT
CREATE POLICY notifications_select_own ON public.notifications FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()));
CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));

-- ─── 6. Storage: zapis plików tylko dla członków (publiczny odczyt bez zmian) ─────
DROP POLICY IF EXISTS "Wgrywanie dla zalogowanych" ON storage.objects;
DROP POLICY IF EXISTS "Edycja dla zalogowanych" ON storage.objects;
DROP POLICY IF EXISTS "Usuwanie dla zalogowanych" ON storage.objects;
CREATE POLICY "Wgrywanie dla członków" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'adminos-files' AND (SELECT public.is_active_member()));
CREATE POLICY "Edycja dla członków" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'adminos-files' AND (SELECT public.is_active_member()));
CREATE POLICY "Usuwanie dla członków" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'adminos-files' AND (SELECT public.is_active_member()));

-- ─── 7. Funkcje: stały search_path, brak wywołań przez anon ───────────────────────
ALTER FUNCTION public.generate_case_number() SET search_path = public;
ALTER FUNCTION public.update_member_scores_updated_at() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
-- Funkcje triggerów nie są wywoływane przez API (wyzwalacze nie wymagają EXECUTE)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_scores_access(), public.is_scores_admin(),
  public.list_scores_access(), public.set_score_limit(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_scores_access(), public.is_scores_admin(),
  public.list_scores_access(), public.set_score_limit(uuid, integer) TO authenticated;

-- ─── 8. Zdublowane indeksy unikalne (pozostają *_key) ─────────────────────────────
ALTER TABLE public.cases DROP CONSTRAINT IF EXISTS cases_case_number_unique;
DROP INDEX IF EXISTS public.cases_case_number_unique;
ALTER TABLE public.department_notes DROP CONSTRAINT IF EXISTS department_notes_dept_unique;
DROP INDEX IF EXISTS public.department_notes_dept_unique;

-- ─── 9. Realtime dla kanałów, które subskrybuje aplikacja (cases, tasks) ──────────
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['cases', 'tasks'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

COMMIT;
