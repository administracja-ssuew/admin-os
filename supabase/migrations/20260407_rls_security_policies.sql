-- RLS policies for tables that were missing security rules

-- ─── meeting_votes ────────────────────────────────────────────────────────────
ALTER TABLE meeting_votes ENABLE ROW LEVEL SECURITY;

-- All authenticated users can see all votes (live counts visible to everyone)
CREATE POLICY "Authenticated users can read votes"
  ON meeting_votes FOR SELECT
  TO authenticated
  USING (true);

-- Users can only insert their own vote
CREATE POLICY "Users can insert their own vote"
  ON meeting_votes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own vote
CREATE POLICY "Users can update their own vote"
  ON meeting_votes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own vote (toggle off)
CREATE POLICY "Users can delete their own vote"
  ON meeting_votes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ─── archive_folders ─────────────────────────────────────────────────────────
ALTER TABLE archive_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read archive folders"
  ON archive_folders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert archive folders"
  ON archive_folders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update archive folders"
  ON archive_folders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete archive folders"
  ON archive_folders FOR DELETE
  TO authenticated
  USING (true);
