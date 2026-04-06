-- Migration: Data Integrity Fixes — STAB-01 and STAB-02
-- Phase 1, Plan 06

-- ============================================================
-- STAB-01: case_number — server-side generation via sequence + trigger
-- Eliminates the client-side random number generation race condition.
-- The /wniosek form will INSERT without supplying case_number;
-- the trigger sets it automatically from the sequence.
-- ============================================================

-- Create a sequence for case numbers (global counter — not per-year)
-- Format: WNI/<year>/<4-digit-padded-sequence>
CREATE SEQUENCE IF NOT EXISTS cases_case_number_seq START 1000;

-- Function: generates case_number in WNI/YYYY/NNNN format
CREATE OR REPLACE FUNCTION generate_case_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.case_number := 'WNI/' || EXTRACT(YEAR FROM NOW())::TEXT || '/' || LPAD(nextval('cases_case_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: fires BEFORE INSERT, only when case_number is not already supplied
-- The WHEN (NEW.case_number IS NULL) clause allows explicit case_number
-- in data migrations or admin overrides without triggering the sequence.
CREATE OR REPLACE TRIGGER set_case_number
  BEFORE INSERT ON cases
  FOR EACH ROW
  WHEN (NEW.case_number IS NULL)
  EXECUTE FUNCTION generate_case_number();

-- UNIQUE constraint: enforces no duplicate case numbers at the DB level
-- Safe to add even if existing rows have unique numbers.
-- If existing duplicates exist, this will fail — check first with:
--   SELECT case_number, COUNT(*) FROM cases GROUP BY case_number HAVING COUNT(*) > 1;
DO $$ BEGIN
  ALTER TABLE cases ADD CONSTRAINT cases_case_number_unique UNIQUE (case_number);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- ============================================================
-- STAB-02: department_notes — UNIQUE(department_id) for safe UPSERT
-- Eliminates the select-then-insert race condition.
-- After this migration, the app uses UPSERT with onConflict: 'department_id'.
-- ============================================================

-- UNIQUE constraint on department_id
-- If duplicate rows exist, this will fail — the app should not have created them,
-- but check with: SELECT department_id, COUNT(*) FROM department_notes GROUP BY department_id HAVING COUNT(*) > 1;
DO $$ BEGIN
  ALTER TABLE department_notes ADD CONSTRAINT department_notes_dept_unique UNIQUE (department_id);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;
