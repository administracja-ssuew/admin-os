-- Tabela głosowań per użytkownik per punkt porządku obrad
CREATE TABLE IF NOT EXISTS meeting_votes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id     UUID NOT NULL REFERENCES meeting_protocols(id) ON DELETE CASCADE,
  agenda_item_id  TEXT NOT NULL,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name       TEXT NOT NULL,
  vote            TEXT NOT NULL CHECK (vote IN ('for', 'against', 'abstain')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(protocol_id, agenda_item_id, user_id)
);

-- Włącz Realtime dla tej tabeli
ALTER PUBLICATION supabase_realtime ADD TABLE meeting_votes;
