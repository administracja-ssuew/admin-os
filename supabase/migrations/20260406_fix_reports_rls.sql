-- Fix reports UPDATE policy: auth.uid() != public.users.id in this schema

DROP POLICY IF EXISTS "Author or admin can update report status" ON public.reports;

CREATE POLICY "Author or admin can update report status"
  ON public.reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.email = auth.email()
        AND (
          u.id = reports.submitted_by
          OR u.system_role IN ('admin', 'superadmin')
        )
    )
  );
