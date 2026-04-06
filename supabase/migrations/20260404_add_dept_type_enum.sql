-- Migration: Add dept_type enum to departments table
-- Phase 2, Plan 01 — REF-04, REF-05
-- Adds dept_type column for subcommittee routing, replacing string matching in page.tsx

-- ============================================================
-- 1. Create the enum type (idempotent)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE dept_type_enum AS ENUM ('logistics', 'archiving', 'grants');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. Add column to departments (idempotent)
-- NOT NULL is intentionally omitted — generic departments have NULL.
-- ============================================================
ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS dept_type dept_type_enum;

-- ============================================================
-- 3. Backfill based on Polish name fragments
-- Same heuristics as app/my-department/page.tsx lines 118-139.
-- ============================================================

-- Grants subcommittee (dotacj)
UPDATE departments SET dept_type = 'grants'
  WHERE dept_type IS NULL AND lower(name) LIKE '%dotacj%';

-- Logistics subcommittee (logistyk or logitech)
UPDATE departments SET dept_type = 'logistics'
  WHERE dept_type IS NULL AND (lower(name) LIKE '%logistyk%' OR lower(name) LIKE '%logitech%');

-- Archiving subcommittee (archiwizacj or bieżąc)
UPDATE departments SET dept_type = 'archiving'
  WHERE dept_type IS NULL AND (lower(name) LIKE '%archiwizacj%' OR lower(name) LIKE '%bieżąc%');

-- ============================================================
-- 4. Comment and index
-- ============================================================
COMMENT ON COLUMN departments.dept_type IS 'Enum type for subcommittee routing. NULL = generic department.';
CREATE INDEX IF NOT EXISTS departments_dept_type_idx ON departments (dept_type);
