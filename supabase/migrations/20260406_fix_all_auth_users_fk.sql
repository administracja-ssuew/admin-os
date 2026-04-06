-- Fix ALL remaining auth.users FK references — public.users.id != auth.uid() in this schema
-- Tables: notifications, notification_preferences

-- ─── notifications ────────────────────────────────────────────────
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ─── notification_preferences ─────────────────────────────────────
ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_user_id_fkey;

ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notification_preferences_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ─── Fix notifications RLS (same auth.uid() issue) ────────────────
DROP POLICY IF EXISTS "Users can read own notifications"  ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT id FROM public.users WHERE email = auth.email() LIMIT 1)
  );

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT id FROM public.users WHERE email = auth.email() LIMIT 1)
  )
  WITH CHECK (
    user_id = (SELECT id FROM public.users WHERE email = auth.email() LIMIT 1)
  );

-- ─── Fix notification_preferences RLS ─────────────────────────────
DROP POLICY IF EXISTS "Users can manage own preferences" ON public.notification_preferences;

CREATE POLICY "Users can manage own preferences"
  ON public.notification_preferences FOR ALL
  TO authenticated
  USING (
    user_id = (SELECT id FROM public.users WHERE email = auth.email() LIMIT 1)
  )
  WITH CHECK (
    user_id = (SELECT id FROM public.users WHERE email = auth.email() LIMIT 1)
  );
