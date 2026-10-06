import { redirect } from 'next/navigation'

// Podkomisje zostały zastąpione samodzielną zakładką Archiwizacji.
export default function MyDepartmentPage() {
  redirect('/archiving')
}
