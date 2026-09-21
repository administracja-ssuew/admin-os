BEGIN;

-- Resolve identity through auth.users, not editable public profile fields or client input.
CREATE OR REPLACE FUNCTION public.is_scores_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users a
    WHERE a.id = auth.uid()
      AND lower(a.email) = 'administracja@samorzad.ue.wroc.pl'
      AND a.email_confirmed_at IS NOT NULL
  );
$$;

CREATE TABLE public.scores_access (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scores_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scores_access FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.scores_access TO authenticated;
CREATE POLICY scores_access_admin ON public.scores_access
  FOR ALL TO authenticated
  USING (public.is_scores_admin()) WITH CHECK (public.is_scores_admin());

CREATE OR REPLACE FUNCTION public.has_scores_access()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.is_scores_admin() OR EXISTS (
    SELECT 1 FROM public.scores_access g
    JOIN auth.users a ON a.id = g.user_id
    WHERE a.id = auth.uid() AND a.email_confirmed_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE lower(u.email) = lower(a.email)
          AND u.system_role::text IN ('active', 'member', 'admin', 'superadmin')
      )
  );
$$;

-- Auth UUIDs and public.users IDs may differ. Never grant by a mutable profile ID.
CREATE OR REPLACE FUNCTION public.list_scores_access()
RETURNS TABLE (user_id uuid, email text, has_access boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_scores_admin() THEN
    RAISE EXCEPTION 'Brak uprawnień' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT a.id, a.email::text, g.user_id IS NOT NULL
    FROM auth.users a
    LEFT JOIN public.scores_access g ON g.user_id = a.id
    WHERE a.email_confirmed_at IS NOT NULL
      AND lower(a.email) <> 'administracja@samorzad.ue.wroc.pl'
      AND (g.user_id IS NOT NULL OR EXISTS (
        SELECT 1 FROM public.users u WHERE lower(u.email) = lower(a.email)
        AND u.system_role::text IN ('active', 'member', 'admin', 'superadmin')
      ))
    ORDER BY a.email;
END;
$$;

-- Replace every previous policy: permissive RLS policies combine with OR.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'member_scores'
  LOOP EXECUTE format('DROP POLICY %I ON public.member_scores', p.policyname); END LOOP;
END $$;
ALTER TABLE public.member_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY scores_read ON public.member_scores FOR SELECT TO authenticated
  USING (public.has_scores_access());
CREATE POLICY scores_write ON public.member_scores FOR ALL TO authenticated
  USING (public.is_scores_admin()) WITH CHECK (public.is_scores_admin());

CREATE OR REPLACE FUNCTION public.set_score_limit(member_id uuid, new_limit integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_scores_admin() THEN
    RAISE EXCEPTION 'Brak uprawnień' USING ERRCODE = '42501';
  END IF;
  IF new_limit IS NULL OR new_limit < 1 OR new_limit > 20 THEN
    RAISE EXCEPTION 'Limit musi być liczbą od 1 do 20' USING ERRCODE = '22023';
  END IF;
  UPDATE public.users SET personal_limit = new_limit WHERE id = member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nie znaleziono osoby'; END IF;
END;
$$;

-- Protect the same field from direct profile updates, even if users has broad policies.
CREATE OR REPLACE FUNCTION public.guard_score_limit()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.personal_limit IS DISTINCT FROM OLD.personal_limit
    AND current_user IN ('anon', 'authenticated') AND NOT public.is_scores_admin() THEN
    RAISE EXCEPTION 'Brak uprawnień do zmiany limitu' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_score_limit BEFORE UPDATE OF personal_limit ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_score_limit();

REVOKE ALL ON FUNCTION public.is_scores_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_scores_access() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_scores_access() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_score_limit(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_scores_admin(), public.has_scores_access(),
  public.list_scores_access(), public.set_score_limit(uuid, integer) TO authenticated;

COMMIT;
