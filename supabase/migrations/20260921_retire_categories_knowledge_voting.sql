BEGIN;

-- Retain historical values, but new cases no longer require or receive a category.
ALTER TABLE public.cases ALTER COLUMN case_type DROP NOT NULL;
ALTER TABLE public.cases ALTER COLUMN case_type DROP DEFAULT;

-- Retire removed modules for browser/API roles without deleting historical records.
-- Also remove policies so a later broad table grant cannot accidentally reopen access.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('meeting_votes', 'knowledge_articles')
  LOOP EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename); END LOOP;
END $$;
ALTER TABLE public.meeting_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_articles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meeting_votes, public.knowledge_articles FROM PUBLIC, anon, authenticated;

COMMIT;
