-- Audit log: śledzenie zmian w systemie
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- RLS: każdy zalogowany może dodawać wpisy, admini mogą czytać wszystko
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read all audit logs"
  ON audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.system_role IN ('admin', 'superadmin')
    )
  );
