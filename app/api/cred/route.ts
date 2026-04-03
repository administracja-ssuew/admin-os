import { createClient } from '@supabase/supabase-js'
import { logAudit } from '../../../lib/audit'

// Akcje, które modyfikują dane — wymagają roli admin/superadmin
const MUTATION_ACTIONS = ['setStatus', 'setOwner', 'setSLA', 'addNote']

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabase = createClient(supabaseUrl!, supabaseKey!)

    const { data: { user } } = await supabase.auth.getUser(token)

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || ''

    // Sprawdzenie roli dla akcji mutujących
    if (MUTATION_ACTIONS.includes(action)) {
      const { data: userData } = await supabase
        .from('users')
        .select('system_role, id')
        .eq('email', user.email!)
        .single()

      if (!userData || !['admin', 'superadmin'].includes(userData.system_role)) {
        return Response.json(
          { error: 'Brak uprawnień do wykonania tej operacji. Wymagana rola: Admin.' },
          { status: 403 }
        )
      }

      // Logujemy mutację do audit_log po wykonaniu
      const znak = searchParams.get('znak') || ''
      const params = Object.fromEntries(searchParams.entries())

      const credToken = process.env.CRED_TOKEN
      const credApiUrl = process.env.CRED_API_URL

      const qs = new URLSearchParams({
        ...params,
        token: credToken!,
        autor: user.email!,
      }).toString()

      const res = await fetch(`${credApiUrl}?${qs}`)
      const data = await res.json()

      if (!data.error) {
        await logAudit({
          userId: userData.id,
          action: `cred.${action}`,
          entityType: 'cred_case',
          entityId: znak,
          newValue: { action, ...params },
        })
      }

      return Response.json(data)
    }

    // Akcje read-only — dostępne dla wszystkich zalogowanych
    const credToken = process.env.CRED_TOKEN
    const credApiUrl = process.env.CRED_API_URL

    const params = Object.fromEntries(searchParams.entries())

    const qs = new URLSearchParams({
      ...params,
      token: credToken!,
      autor: user.email!,
    }).toString()

    const res = await fetch(`${credApiUrl}?${qs}`)
    const data = await res.json()

    return Response.json(data)
  } catch (err) {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
