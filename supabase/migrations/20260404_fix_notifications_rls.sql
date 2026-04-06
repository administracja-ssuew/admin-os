-- Migration: Fix notifications RLS — restrict INSERT to service role only
-- Phase 1, Plan 04 — SEC-04
-- Prerequisite: SUPABASE_SERVICE_ROLE_KEY must be confirmed present in all environments
-- before applying this migration (see Plan 01 for confirmation step).
--
-- How this works:
-- WITH CHECK (false) blocks all JWT-authenticated users from inserting.
-- Service role key clients bypass RLS entirely — they are unaffected.
-- All notification inserts go through API routes using the service role client.

-- Drop the existing permissive policy
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON notifications;

-- Create a restrictive policy that blocks all authenticated-user INSERTs
-- Service role (used by API routes) bypasses this policy entirely.
CREATE POLICY "service_role_insert_only" ON notifications
  FOR INSERT
  WITH CHECK (false);
