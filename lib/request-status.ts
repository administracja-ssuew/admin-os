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
