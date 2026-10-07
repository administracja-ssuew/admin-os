// Schemat odwzorowuje produkcję (Supabase) z 2026-10-06 w zakresie, którego dotyczą migracje
import { readFile } from 'node:fs/promises'
export const ids = {
  admin: '20000000-0000-0000-0000-000000000001',
  member: '20000000-0000-0000-0000-000000000002',
  pending: '20000000-0000-0000-0000-000000000003',
  inactive: '20000000-0000-0000-0000-000000000004',
}
export const emails = { admin: 'admin@example.org', member: 'member@example.org', pending: 'pending@example.org', inactive: 'inactive@example.org' }
export const migration = name => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8')

export const fixture = `
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
  CREATE SCHEMA auth; CREATE SCHEMA storage;
  CREATE FUNCTION auth.email() RETURNS text LANGUAGE sql AS
    $$ SELECT nullif(current_setting('request.jwt.claim.email', true), '') $$;
  GRANT USAGE ON SCHEMA auth, storage, public TO anon, authenticated, service_role;
  CREATE TABLE storage.buckets (id text PRIMARY KEY, public boolean, file_size_limit bigint);
  INSERT INTO storage.buckets VALUES ('adminos-files', true, null);
  CREATE TABLE storage.objects (id serial, bucket_id text, name text);
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Wgrywanie dla zalogowanych" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'adminos-files');
  CREATE POLICY "Odczyt dla wszystkich" ON storage.objects FOR SELECT USING (bucket_id = 'adminos-files');
  CREATE PUBLICATION supabase_realtime;

  CREATE TABLE public.users (id uuid PRIMARY KEY, email varchar UNIQUE, system_role varchar, department_id uuid);
  INSERT INTO public.users VALUES
    ('${ids.admin}', '${emails.admin}', 'admin', null), ('${ids.member}', '${emails.member}', 'member', null),
    ('${ids.pending}', '${emails.pending}', 'pending', null), ('${ids.inactive}', '${emails.inactive}', 'inactive', null);
  CREATE TABLE public.tasks (id serial PRIMARY KEY, title text, owner_id uuid);
  INSERT INTO public.tasks (title) VALUES ('Istniejące zadanie');
  CREATE TABLE public.cases (id serial PRIMARY KEY, title text, owner_id uuid, case_number text, source text, status text DEFAULT 'new',
    description text, created_at timestamptz DEFAULT now(), closed_at timestamptz,
    CONSTRAINT cases_case_number_key UNIQUE (case_number), CONSTRAINT cases_case_number_unique UNIQUE (case_number));
  ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Authenticated users can read cases" ON public.cases FOR SELECT TO authenticated USING (true);
  INSERT INTO public.cases (title, owner_id, case_number) VALUES ('Sprawa członka', '${ids.member}', 'WNI/1'), ('Cudza sprawa', '${ids.admin}', 'WNI/2');
  CREATE TABLE public.department_notes (id serial PRIMARY KEY, department_id uuid,
    CONSTRAINT department_notes_department_id_key UNIQUE (department_id), CONSTRAINT department_notes_dept_unique UNIQUE (department_id));
  CREATE TABLE public.archive_folders (id serial PRIMARY KEY, title text);
  ALTER TABLE public.archive_folders ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Authenticated users can read archive folders" ON public.archive_folders FOR SELECT TO authenticated USING (true);
  INSERT INTO public.archive_folders (title) VALUES ('Teczka');
  CREATE TABLE public.audit_log (id serial PRIMARY KEY, action text);
  ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
  CREATE TABLE public.brainstorm_cards (id serial PRIMARY KEY, author_id uuid);
  ALTER TABLE public.brainstorm_cards ENABLE ROW LEVEL SECURITY;
  CREATE TABLE public.meeting_protocols (id serial PRIMARY KEY);
  ALTER TABLE public.meeting_protocols ENABLE ROW LEVEL SECURITY;
  CREATE TABLE public.notifications (id serial PRIMARY KEY, user_id uuid, type text, title text, body text, link text,
    is_read boolean DEFAULT false, created_at timestamptz DEFAULT now());
  ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
  CREATE POLICY service_role_insert_only ON public.notifications FOR INSERT WITH CHECK (false);
  INSERT INTO public.notifications (user_id) VALUES ('${ids.member}'), ('${ids.admin}');
  CREATE TABLE public.reports (id serial PRIMARY KEY, submitted_by uuid, title text, content text);
  ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
  CREATE TABLE public.case_comments (id serial PRIMARY KEY); CREATE TABLE public.assets (id serial PRIMARY KEY);
  CREATE TABLE public.equipment_loans (id serial PRIMARY KEY); CREATE TABLE public.grants_radar (id serial PRIMARY KEY);
  CREATE TABLE public.petitions (id serial PRIMARY KEY); CREATE TABLE public.documents (id serial PRIMARY KEY);
  CREATE TABLE public.meetings (id serial PRIMARY KEY); CREATE TABLE public.departments (id serial PRIMARY KEY, name text);
  INSERT INTO public.departments (name) VALUES ('Pion');
  CREATE TABLE public.projects (id serial PRIMARY KEY); CREATE TABLE public.profiles (id serial PRIMARY KEY);
  CREATE TABLE public.decisions (id serial PRIMARY KEY, title text); INSERT INTO public.decisions (title) VALUES ('Uchwała');
  CREATE TABLE public.board_notes (id serial PRIMARY KEY);
  CREATE TABLE public.board_polls (id serial PRIMARY KEY); CREATE TABLE public.risks (id serial PRIMARY KEY);
  CREATE TABLE public.notification_preferences (id serial PRIMARY KEY); CREATE TABLE public.meeting_votes (id serial PRIMARY KEY);
  GRANT ALL ON ALL TABLES IN SCHEMA public, storage TO anon, authenticated;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public, storage TO anon, authenticated;

  CREATE FUNCTION public.generate_case_number() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
  CREATE FUNCTION public.update_member_scores_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
  CREATE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN NEW; END $$;
  CREATE FUNCTION public.has_scores_access() RETURNS boolean LANGUAGE sql AS 'SELECT true';
  CREATE FUNCTION public.is_scores_admin() RETURNS boolean LANGUAGE sql AS 'SELECT false';
  CREATE FUNCTION public.list_scores_access() RETURNS SETOF uuid LANGUAGE sql AS 'SELECT NULL::uuid WHERE false';
  CREATE FUNCTION public.set_score_limit(member_id uuid, new_limit integer) RETURNS void LANGUAGE sql AS 'SELECT';
`

