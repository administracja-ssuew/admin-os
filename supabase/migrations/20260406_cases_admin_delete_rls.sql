-- Restrict case deletion to admin and superadmin only
-- (UI already guards this, but DB-level policy is the authoritative protection)

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read cases" ON public.cases;
DROP POLICY IF EXISTS "Authenticated users can insert cases" ON public.cases;
DROP POLICY IF EXISTS "Admin or owner can update cases" ON public.cases;
DROP POLICY IF EXISTS "Only admins can delete cases" ON public.cases;

CREATE POLICY "Authenticated users can read cases"
  ON public.cases FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert cases"
  ON public.cases FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admin or owner can update cases"
  ON public.cases FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE email = auth.email()
        AND (system_role IN ('admin', 'superadmin') OR id = cases.owner_id)
    )
  );

CREATE POLICY "Only admins can delete cases"
  ON public.cases FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE email = auth.email()
        AND system_role IN ('admin', 'superadmin')
    )
  );
