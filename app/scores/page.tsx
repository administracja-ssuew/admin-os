import ScoresClientPage from './ScoresClientPage'
import { createSupabaseServerClient } from '../../lib/supabase-server'
import { notFound, redirect } from 'next/navigation'

export default async function ScoresPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: allowed, error } = await supabase.rpc('has_scores_access')
  if (error || !allowed) notFound()
  return <ScoresClientPage />
}
