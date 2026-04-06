-- Phase 5: Grants Module — schema extension
-- Adds eligibility criteria, application tracking, and patronage fields to grants_radar

ALTER TABLE grants_radar
  ADD COLUMN IF NOT EXISTS eligibility_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS application_url TEXT,
  ADD COLUMN IF NOT EXISTS applied_at DATE,
  ADD COLUMN IF NOT EXISTS decision_expected_at DATE,
  ADD COLUMN IF NOT EXISTS patronage_event_name TEXT,
  ADD COLUMN IF NOT EXISTS patronage_event_date DATE,
  ADD COLUMN IF NOT EXISTS patron_identity TEXT;

COMMENT ON COLUMN grants_radar.eligibility_criteria IS
  'Array of {label: string, state: "met"|"unmet"|"pending"} objects';
