---
plan: 03-01
phase: 03-logistics-module
status: complete
---
# Plan 03-01: Migracja schema logistyki

Dodano migrację supabase/migrations/20260404_logistics_schema_extension.sql:
- equipment_loans: borrower_phone, borrower_org, loan_source (bez deposit_*)
- assets: min_quantity, unit (CHECK: szt/ryza/opak/komplet)
