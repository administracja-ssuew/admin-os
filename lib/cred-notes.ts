/**
 * Notes used to be sent through encodeURIComponent inside a JSON body, so CRED stored
 * them literally ("Ala%20ma%20kota"). Such a note never contains whitespace, which
 * separates it from a plain note with a literal percent sign.
 */
export function decodeLegacyNote(text: string): string {
  if (/\s/.test(text) || !/%[0-9A-Fa-f]{2}/.test(text)) return text
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}
