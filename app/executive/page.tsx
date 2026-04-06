// Client-side auth guard — role check happens in ExecutiveClientPage.
// Server-side guard was unreliable due to RLS on the users table
// when the anon key is used without a properly forwarded auth context.
import ExecutiveClientPage from './ExecutiveClientPage'

export default function ExecutivePanelPage() {
  return <ExecutiveClientPage />
}
