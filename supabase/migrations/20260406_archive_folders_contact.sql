-- Add contact person fields to archive_folders
-- Used in Podkomisja ds. Archiwizacji to store admin contact for document retrieval

ALTER TABLE public.archive_folders
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_info text;
