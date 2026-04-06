-- Fix brainstorm_cards RLS: public.users.id != auth.uid()
-- Join via email to correctly identify the user's role

DROP POLICY IF EXISTS "Admins can read brainstorm cards"    ON public.brainstorm_cards;
DROP POLICY IF EXISTS "Admins can insert brainstorm cards"  ON public.brainstorm_cards;
DROP POLICY IF EXISTS "Author or admin can delete brainstorm cards" ON public.brainstorm_cards;

-- Helper: is the current auth session user an admin/superadmin in public.users?
-- We match by email because public.users.id != auth.uid() in this schema.

CREATE POLICY "Admins can read brainstorm cards"
  ON public.brainstorm_cards FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN auth.users au ON au.email = u.email
      WHERE au.id = auth.uid()
        AND u.system_role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Admins can insert brainstorm cards"
  ON public.brainstorm_cards FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN auth.users au ON au.email = u.email
      WHERE au.id = auth.uid()
        AND u.system_role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Author or admin can delete brainstorm cards"
  ON public.brainstorm_cards FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN auth.users au ON au.email = u.email
      WHERE au.id = auth.uid()
        AND (
          u.id = brainstorm_cards.author_id
          OR u.system_role IN ('admin', 'superadmin')
        )
    )
  );
