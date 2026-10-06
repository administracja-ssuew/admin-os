export const FILES_BUCKET = 'adminos-files'

/** Zamienia polskie znaki i spacje na bezpieczne odpowiedniki */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/ą/g, 'a').replace(/Ą/g, 'A')
    .replace(/ć/g, 'c').replace(/Ć/g, 'C')
    .replace(/ę/g, 'e').replace(/Ę/g, 'E')
    .replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .replace(/ń/g, 'n').replace(/Ń/g, 'N')
    .replace(/ó/g, 'o').replace(/Ó/g, 'O')
    .replace(/ś/g, 's').replace(/Ś/g, 'S')
    .replace(/ź/g, 'z').replace(/Ź/g, 'Z')
    .replace(/ż/g, 'z').replace(/Ż/g, 'Z')
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')
}

/**
 * Ścieżka pliku w magazynie na podstawie zapisanego adresu. Załączniki przechowują dawny publiczny
 * adres (…/object/public/adminos-files/<ścieżka>); od zamknięcia magazynu służy on tylko do
 * wskazania pliku, a otwiera się go linkiem podpisanym. Zwraca null dla linków zewnętrznych.
 */
export function storagePath(ref: string): string | null {
  const match = ref.match(new RegExp(`/storage/v1/object/(?:public|sign|authenticated)/${FILES_BUCKET}/([^?#]+)`))
  if (match) return decodeURIComponent(match[1])
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) return null
  const path = ref.replace(/^\/+/, '')
  return path || null
}

export const EXTERNAL_UPLOAD_PREFIX = 'wnioski/'
export const EXTERNAL_MAX_BYTES = 10 * 1024 * 1024
export const EXTERNAL_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx']

/** Walidacja pliku z publicznego formularza; zwraca komunikat błędu albo null. */
export function externalFileError(name: string, size: number): string | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (!EXTERNAL_EXTENSIONS.includes(ext)) return 'Niedozwolony typ pliku'
  if (size <= 0 || size > EXTERNAL_MAX_BYTES) return 'Plik przekracza limit 10 MB'
  return null
}
