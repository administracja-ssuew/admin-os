-- Restrict case deletion to admin and superadmin only
-- (UI already guards this, but DB-level policy is the authoritative protection)

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read cases
CREATE POLICY IF NOT EXISTS "Authenticated users can read cases"
  ON public.cases FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert cases (public form submissions)
CREATE POLICY IF NOT EXISTS "Authenticated users can insert cases"
  ON public.cases FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow admin or owner to update cases
CREATE POLICY IF NOT EXISTS "Admin or owner can update cases"
  ON public.cases FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE email = auth.email()
        AND (system_role IN ('admin', 'superadmin') OR id = cases.owner_id)
    )
  );

-- Only admin/superadmin can delete cases
CREATE POLICY "Only admins can delete cases"
  ON public.cases FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE email = auth.email()
        AND system_role IN ('admin', 'superadmin')
    )
  );
