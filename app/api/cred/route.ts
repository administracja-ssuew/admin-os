import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { logAudit } from '../../../lib/audit'

const MUTATION_ACTIONS = ['setStatus', 'setOwner', 'setSLA', 'addNote']

type AdminRow = { id: string; system_role: string }

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ─── Pomocnicza: autoryzacja użytkownika przez Supabase ───────────────────────
async function authorizeUser(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return { user: null, supabase: null, error: 'Unauthorized' as const }

  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return { user: null, supabase: null, error: 'Unauthorized' as const }

  return { user, supabase, error: null }
}

// ─── Pomocnicza: sprawdzenie roli admin/superadmin ────────────────────────────
async function requireAdmin(supabase: SupabaseClient, email: string): Promise<AdminRow | null> {
  const { data } = await (supabase as SupabaseClient<any>)
    .from('users')
    .select('system_role, id')
    .eq('email', email)
    .single() as { data: AdminRow | null }

  if (!data || !['admin', 'superadmin'].includes(data.system_role)) return null
  return data
}

/* ═══════════════════════════════════════════════════════════════
   GET — tylko odczyt (list, getCase)
   Mutacje przez GET zwracają 405, żeby złapać stare wywołania.
   ═══════════════════════════════════════════════════════════════ */
export async function GET(request: Request) {
  try {
    const { user, error } = await authorizeUser(request)
    if (error || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || ''

    // Stara ścieżka bez action — publiczny status (znak)
    // Przekazujemy bezpośrednio bez tokenu admin (CRA to robi samo)
    if (!action) {
      const credApiUrl = process.env.CRED_API_URL
      const qs = new URLSearchParams(Object.fromEntries(searchParams.entries())).toString()
      const res = await fetch(`${credApiUrl}?${qs}`)
      return Response.json(await res.json())
    }

    // Blokuj mutacje przez GET
    if (MUTATION_ACTIONS.includes(action)) {
      return Response.json(
        { error: `Akcja "${action}" wymaga metody POST. Zaktualizuj wywołanie po stronie frontendu.` },
        { status: 405 }
      )
    }

    // Read-only: list, getCase
    const credApiUrl = process.env.CRED_API_URL
    const credToken  = process.env.CRED_TOKEN

    const qs = new URLSearchParams({
      ...Object.fromEntries(searchParams.entries()),
      token: credToken!,
      autor: user.email!,
    }).toString()

    const res  = await fetch(`${credApiUrl}?${qs}`)
    const data = await res.json()
    return Response.json(data)

  } catch {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/* ═══════════════════════════════════════════════════════════════
   POST — mutacje (setStatus, setOwner, setSLA, addNote)
   Body: { action, znak, value/email/date/text, autor? }
   ═══════════════════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const { user, supabase, error } = await authorizeUser(request)
    if (error || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body   = await request.json()
    const action = body.action || ''

    if (!MUTATION_ACTIONS.includes(action)) {
      return Response.json({ error: `Nieznana akcja: "${action}"` }, { status: 400 })
    }

    // Wymagana rola admin/superadmin dla mutacji
    const userData = await requireAdmin(supabase, user.email!)
    if (!userData) {
      return Response.json(
        { error: 'Brak uprawnień. Wymagana rola: Admin.' },
        { status: 403 }
      )
    }

    const credApiUrl = process.env.CRED_API_URL
    const credToken  = process.env.CRED_TOKEN

    // Wysyłamy POST z JSON body do CRED Apps Script
    const res = await fetch(credApiUrl!, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        token: credToken,
        autor: user.email,
      }),
    })

    const data = await res.json()

    // Logujemy do audit_log AdminOS (niezależnie od CRED AUDIT_LOG)
    if (!data.error) {
      await logAudit({
        userId:     userData.id,
        action:     `cred.${action}`,
        entityType: 'cred_case',
        entityId:   body.znak || '',
        newValue:   body,
      })
    }

    return Response.json(data)

  } catch {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
