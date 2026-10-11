BEGIN;

-- Granted users edit scores and limits; only the administrator manages scores_access.
DROP POLICY IF EXISTS scores_write ON public.member_scores;
CREATE POLICY scores_write ON public.member_scores FOR ALL TO authenticated
  USING (public.has_scores_access()) WITH CHECK (public.has_scores_access());

CREATE OR REPLACE FUNCTION public.set_score_limit(member_id uuid, new_limit integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.has_scores_access() THEN
    RAISE EXCEPTION 'Brak uprawnień' USING ERRCODE = '42501';
  END IF;
  IF new_limit IS NULL OR new_limit < 1 OR new_limit > 20 THEN
    RAISE EXCEPTION 'Limit musi być liczbą od 1 do 20' USING ERRCODE = '22023';
  END IF;
  UPDATE public.users SET personal_limit = new_limit WHERE id = member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nie znaleziono osoby'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_score_limit()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.personal_limit IS DISTINCT FROM OLD.personal_limit
    AND current_user IN ('anon', 'authenticated') AND NOT public.has_scores_access() THEN
    RAISE EXCEPTION 'Brak uprawnień do zmiany limitu' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
