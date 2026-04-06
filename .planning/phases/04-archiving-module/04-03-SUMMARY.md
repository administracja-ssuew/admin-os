---
phase: 04-archiving-module
plan: 03
subsystem: ui
tags: [supabase-storage, file-upload, protocol-finalization, meetings, react]

# Dependency graph
requires:
  - phase: 04-02
    provides: Meetings drawer z formularzem edycji protokolu (draft/finalized)
provides:
  - Upload pliku do protokolu (Supabase Storage, bucket adminos-files, sciezka protocols/{id}/{uuid}/{safeFileName})
  - Finalizacja protokolu (protocol_status='finalized')
  - Formularz disabled po zablokowaniu, przycisk Zablokuj i Zapisz znikaja
affects: [archiving-module]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Polish filename sanitizer (odpolszczacz) reused z ArchivingPanel.tsx — replace map dla polskich znakow"
    - "Supabase Storage upload z getPublicUrl — zwraca publicUrl do zapisu w rekordzie DB"
    - "Optymistyczna aktualizacja stanu po upload i finalizacji (setSelectedProtocol) + fetchProtocols() dla listy"

key-files:
  created: []
  modified:
    - app/meetings/page.tsx

key-decisions:
  - "Upload pliku podmienia file_url i file_name w rekordzie meeting_protocols (nie tworzy nowego rekordu)"
  - "Po finalizacji: formularz disabled, przyciski Zablokuj i Zapisz ukryte via !isFinalized guard — brak mozliwosci odblokowania per D-03"
  - "Sekcja pliku pokazuje link do pobrania jesli file_url != null, niezaleznie od statusu (draft i finalized)"

patterns-established:
  - "Finalizacja jako jednorazowe zdarzenie bez mozliwosci cofniecia — przycisk znika po sukcesie"
  - "Upload pliku z toastId dla UX — loading/success/error stany"

requirements-completed: [ARCH-02, ARCH-03]

# Metrics
duration: 8min
completed: 2026-04-06
---

# Phase 4 Plan 03: Upload pliku i finalizacja protokolu

**File upload do Supabase Storage i nieodwracalna finalizacja protokolu posiedzen z blokada formularza**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-06T13:50:00Z
- **Completed:** 2026-04-06T13:58:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- handleFileUpload: sanityzuje nazwe pliku (odpolszczacz), uploaduje do bucket adminos-files pod sciezka `protocols/{protocolId}/{uuid}/{safeFileName}`, zapisuje file_url + file_name w rekordzie meeting_protocols
- handleFinalize: ustawia protocol_status='finalized' w Supabase, aktualizuje stan lokalny, fetchuje listy
- Sekcja "Plik protokolu" w drawerze: link do pobrania (jesli plik istnieje) lub komunikat "Brak dołączonego pliku", plus przycisk dołączania pliku (tylko dla draft)
- Przycisk "Zablokuj protokol" (czerwony, z ikona Lock) widoczny tylko dla draft — znika po finalizacji
- Przycisk "Zapisz zmiany" takze ukryty po finalizacji
- Wszystkie pola formularza maja disabled={isFinalized} — brak edycji zablokowanego protokolu

## Task Commits

1. **Task 1: Upload pliku i finalizacja protokolu w drawerze** - `d6f18fa` (feat)

## Files Created/Modified

- `app/meetings/page.tsx` - Dodano handleFileUpload, handleFinalize, stany isUploading/isFinalizing, sekcje JSX pliku i finalizacji w drawerze; dodano importy Paperclip, UploadCloud z lucide-react

## Decisions Made

- Sekcja pliku widoczna dla obu statusow (draft i finalized) — po finalizacji link do pobrania pozostaje dostepny, przycisk upload znika
- Wzorzec odpolszczacza skopiowany 1:1 z ArchivingPanel.tsx (per plan — REUSE)
- Upload podmienia istniejacy plik (brak wersjonowania) — update file_url/file_name na tym samym rekordzie

## Deviations from Plan

None — plan wykonany dokladnie wg specyfikacji.

## Note: /meetings gotowe (ARCH-01, ARCH-02, ARCH-03)

- ARCH-01 (edytor protokolu): zrealizowany w 04-02
- ARCH-02 (upload pliku do protokolu): zrealizowany w tym planie — bucket adminos-files, sciezka protocols/{id}/...
- ARCH-03 (blokowanie protokolu): zrealizowany w tym planie — protocol_status='finalized', formularz disabled, brak mozliwosci odblokowania

## Self-Check: PASSED

- `app/meetings/page.tsx` exists and contains handleFileUpload, handleFinalize, adminos-files, protocol_status='finalized'
- Commit `d6f18fa` exists in git log

---
*Phase: 04-archiving-module*
*Completed: 2026-04-06*
