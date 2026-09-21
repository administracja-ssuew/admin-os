interface FilterableCase {
  case_number: string | null
  cred_signature: string | null
  status: string
  created_at: string
}

/** Date upper bound includes the entire day, matching the registry's existing date semantics. */
export function matchesCaseFilters(item: FilterableCase, filters: Record<string, string>): boolean {
  const query = (filters.search ?? '').trim().toLocaleLowerCase('pl-PL')
  if (query && ![item.case_number, item.cred_signature].some(value =>
    (value ?? '').toLocaleLowerCase('pl-PL').includes(query))) return false
  if (filters.status && item.status !== filters.status) return false
  if (filters.date_to && item.created_at.split('T')[0] > filters.date_to) return false
  return true
}
