-- Rozszerzenie tabeli meeting_protocols o listę obecności i punkty porządku
ALTER TABLE meeting_protocols
  ADD COLUMN IF NOT EXISTS attendance  JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS agenda_items JSONB NOT NULL DEFAULT '[]'::jsonb;

-- attendance:    [{ id: uuid, name: text, present: boolean }]
-- agenda_items:  [{ id: uuid, title: text, notes: text, vote: { for: int, against: int, abstain: int } | null }]
