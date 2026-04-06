-- Logistics Module: schema extension (Phase 3, Plan 01)
-- LOG-01: borrower contact fields on equipment_loans (BEZ deposit_*)
-- LOG-03: stock tracking fields on assets

ALTER TABLE equipment_loans
  ADD COLUMN IF NOT EXISTS borrower_phone TEXT,
  ADD COLUMN IF NOT EXISTS borrower_org TEXT,
  ADD COLUMN IF NOT EXISTS loan_source TEXT;

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_quantity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'szt'
    CONSTRAINT assets_unit_check CHECK (unit IN ('szt', 'ryza', 'opak', 'komplet'));
