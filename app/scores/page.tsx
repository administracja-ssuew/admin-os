// Server Component — auth guard runs before any HTML is sent to the browser.
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '../../lib/supabase-server'
import ScoresClientPage from './ScoresClientPage'

export default async function ScoresPage() {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.system_role !== 'superadmin') {
    redirect('/?toast=access_denied')
  }

  return <ScoresClientPage />
}
