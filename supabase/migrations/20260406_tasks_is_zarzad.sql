-- Add is_zarzad flag to tasks table
-- Tasks created in "Tablica Zarządu" mode are hidden from the general board

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_zarzad boolean NOT NULL DEFAULT false;
