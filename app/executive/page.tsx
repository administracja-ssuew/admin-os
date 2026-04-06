// Server Component — auth guard runs before any HTML is sent to the browser.
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '../../lib/supabase-server'
import ExecutiveClientPage from './ExecutiveClientPage'

export default async function ExecutivePanelPage() {
  const supabase = await createSupabaseServerClient()

  // getSession reads the JWT from cookies without a network call — more reliable
  // than getUser() when cookie-based sessions are freshly established.
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('system_role')
    .eq('id', session.user.id)
    .single()

  const allowedRoles = ['admin', 'superadmin']
  if (!userData || !allowedRoles.includes(userData.system_role)) {
    redirect('/?toast=access_denied')
  }

  return <ExecutiveClientPage />
}
