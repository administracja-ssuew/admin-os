/**
 * Numer wniosku w formacie WNI/RRRR/NNNN. Przyjmuje zapis z małych liter, ze spacjami
 * lub myślnikami, bez prefiksu i bez zer wiodących ("wni 2026 7", "2026/7").
 */
export function normalizeCaseNumber(input: string): string {
  const text = input.trim().toUpperCase()
  const match = text.match(/^(?:WNI)?[\s/\-_.]*(\d{4})[\s/\-_.]+(\d{1,4})$/)
  if (!match) return text
  return `WNI/${match[1]}/${match[2].padStart(4, '0')}`
}

/** E-mail wnioskodawcy z nagłówka opisu zapisywanego przez formularz: "[E-mail: adres | Tel: …]". */
export function contactEmailFromDescription(description: string | null): string | null {
  const match = description?.match(/^\[E-mail: ([^\]\s|]+)/)
  return match ? match[1] : null
}

/** Limity pól publicznego formularza (tytuł jak maxLength w /wniosek; opis = 5000 znaków treści + nagłówek z kontaktem). */
export const EXTERNAL_TITLE_MAX = 200
export const EXTERNAL_DESCRIPTION_MAX = 6000

/** Walidacja po stronie serwera — formularz publiczny można wywołać z pominięciem przeglądarki. */
export function externalCaseInputError(title: unknown, description: unknown): string | null {
  if (typeof title !== 'string' || !title.trim()) return 'Tytuł wniosku jest wymagany'
  if (title.length > EXTERNAL_TITLE_MAX) return `Tytuł wniosku może mieć najwyżej ${EXTERNAL_TITLE_MAX} znaków`
  if (typeof description !== 'string' || !description.trim()) return 'Opis wniosku jest wymagany'
  if (description.length > EXTERNAL_DESCRIPTION_MAX) return `Opis wniosku może mieć najwyżej ${EXTERNAL_DESCRIPTION_MAX} znaków`
  return null
}
