-- Fix: created_by referenced auth.users(id) but app sends public.users.id
-- Drop the FK constraint and re-point it to public.users(id)

ALTER TABLE public.meeting_protocols
  DROP CONSTRAINT IF EXISTS meeting_protocols_created_by_fkey;

ALTER TABLE public.meeting_protocols
  ADD CONSTRAINT meeting_protocols_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
