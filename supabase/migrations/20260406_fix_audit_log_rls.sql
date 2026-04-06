-- Fix audit_log RLS: users.id = auth.uid() never true in this schema
-- Use auth.email() join like other fixed policies

DROP POLICY IF EXISTS "Admins can read all audit logs" ON audit_log;

CREATE POLICY "Admins can read all audit logs"
  ON audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE email = auth.email()
        AND system_role IN ('admin', 'superadmin')
    )
  );
