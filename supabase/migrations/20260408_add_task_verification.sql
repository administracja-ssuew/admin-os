-- Dodanie nowych kolumn do weryfikacji zadań przez zarząd/koordynatorów
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'unverified',
ADD COLUMN IF NOT EXISTS verification_feedback TEXT;
