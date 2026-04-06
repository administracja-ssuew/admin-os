-- Phase 6: Knowledge Base — schema extension
-- Adds article_type, file upload fields, updated_by attribution

DO $$ BEGIN
  CREATE TYPE article_type_enum AS ENUM ('guide', 'template', 'regulation');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE knowledge_articles
  ADD COLUMN IF NOT EXISTS article_type article_type_enum NOT NULL DEFAULT 'guide',
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Backfill based on existing category column
UPDATE knowledge_articles
SET article_type = CASE
  WHEN category ILIKE '%szablon%' OR category ILIKE '%druk%' THEN 'template'::article_type_enum
  WHEN category ILIKE '%regulamin%' THEN 'regulation'::article_type_enum
  ELSE 'guide'::article_type_enum
END;
