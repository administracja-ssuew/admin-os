-- Migration: Archiving Module
-- Phase 04, Plan 01
-- Creates meeting_protocols table and adds folder_type to archive_folders

-- 1. Enum: protocol_status
DO $$ BEGIN
  CREATE TYPE protocol_status AS ENUM ('draft', 'finalized');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Enum: folder_type
DO $$ BEGIN
  CREATE TYPE folder_type AS ENUM ('general', 'project_report');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Table: meeting_protocols
CREATE TABLE IF NOT EXISTS meeting_protocols (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  date            date NOT NULL,
  participants    text NOT NULL DEFAULT '',
  agenda          text NOT NULL DEFAULT '',
  findings        text NOT NULL DEFAULT '',
  actions         text NOT NULL DEFAULT '',
  protocol_status protocol_status NOT NULL DEFAULT 'draft',
  file_url        text,
  file_name       text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 4. RLS on meeting_protocols
ALTER TABLE meeting_protocols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read protocols"
  ON meeting_protocols FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert protocols"
  ON meeting_protocols FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update protocols"
  ON meeting_protocols FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Also allow authenticated users (mutations via anon key client)
CREATE POLICY "Authenticated users can insert protocols"
  ON meeting_protocols FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update protocols"
  ON meeting_protocols FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Add folder_type column to archive_folders
ALTER TABLE archive_folders
  ADD COLUMN IF NOT EXISTS folder_type folder_type NOT NULL DEFAULT 'general';
