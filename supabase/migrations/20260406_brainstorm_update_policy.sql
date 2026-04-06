-- Allow author or admin to update brainstorm cards

CREATE POLICY "Author or admin can update brainstorm cards"
  ON public.brainstorm_cards FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.email = auth.email()
        AND (
          u.id = brainstorm_cards.author_id
          OR u.system_role IN ('admin', 'superadmin')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.email = auth.email()
        AND (
          u.id = brainstorm_cards.author_id
          OR u.system_role IN ('admin', 'superadmin')
        )
    )
  );
