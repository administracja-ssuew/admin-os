-- Dodanie osobistego limitu punktów do tabeli users (domyślnie 20)
ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_limit INTEGER DEFAULT 20 CHECK (personal_limit > 0 AND personal_limit <= 20);

-- Tabela wyników miesięcznych
CREATE TABLE IF NOT EXISTS member_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  activity_points NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (activity_points >= 0),
  quality_points NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (quality_points >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, year, month)
);

-- RLS: tylko superadmin może czytać i zapisywać
ALTER TABLE member_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_full_access" ON member_scores
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE email = (auth.jwt()->>'email')
      AND system_role = 'superadmin'
    )
  );

-- Trigger: automatyczna aktualizacja updated_at
CREATE OR REPLACE FUNCTION update_member_scores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER member_scores_updated_at
  BEFORE UPDATE ON member_scores
  FOR EACH ROW EXECUTE FUNCTION update_member_scores_updated_at();
