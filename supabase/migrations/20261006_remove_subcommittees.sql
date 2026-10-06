-- Migration: Usunięcie podkomisji (departments) — 2026-10-06
-- Podkomisje zniknęły z aplikacji. Przed usunięciem: 3 podkomisje, 11 osób przypisanych,
-- 0 zadań i 0 spraw przypisanych, 3 puste notatki. Usuwane są tylko te przypisania i nazwy.
-- Migracja przerywa się, jeśli jakieś zadanie lub sprawa jest przypisana do podkomisji
-- albo notatka podkomisji ma treść.

BEGIN;

DO $$
DECLARE n bigint;
BEGIN
  IF to_regclass('public.departments') IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO n FROM public.tasks WHERE department_id IS NOT NULL;
  IF n > 0 THEN RAISE EXCEPTION '% zadań jest przypisanych do podkomisji — przerwano', n; END IF;
  SELECT count(*) INTO n FROM public.cases WHERE department_id IS NOT NULL;
  IF n > 0 THEN RAISE EXCEPTION '% spraw jest przypisanych do podkomisji — przerwano', n; END IF;
  IF to_regclass('public.department_notes') IS NOT NULL THEN
    SELECT count(*) INTO n FROM public.department_notes WHERE coalesce(btrim(content), '') <> '';
    IF n > 0 THEN RAISE EXCEPTION '% notatek podkomisji ma treść — przerwano', n; END IF;
  END IF;
END $$;

ALTER TABLE public.tasks DROP COLUMN IF EXISTS department_id;
ALTER TABLE public.cases DROP COLUMN IF EXISTS department_id;
ALTER TABLE public.users DROP COLUMN IF EXISTS department_id;
DROP TABLE IF EXISTS public.department_notes;
DROP TABLE IF EXISTS public.departments;
DROP TYPE IF EXISTS public.dept_type_enum;

COMMIT;
