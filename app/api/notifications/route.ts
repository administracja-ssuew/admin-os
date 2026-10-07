import { createClient } from '@supabase/supabase-js'
import { parseEventRequest } from '../../../lib/notifications/events'
import { loadBoard, loadPersonByEmail, loadPersonById, serviceClient } from '../../../lib/notifications/load'
import { dispatch, supabaseStore } from '../../../lib/notifications/dispatch'
import {
  resolveAccountApproved, resolveAccountPending, resolveCaseAssigned, resolveCaseComment, resolveCaseStatusChanged,
  resolveTaskAssigned, resolveTaskReviewed, type CaseRecord, type Resolution, type TaskRecord,
} from '../../../lib/notifications/resolve'

const TASK = 'id, title, owner_id, deadline, status, verification_status, verification_feedback'
const CASE = 'id, case_number, title, owner_id, status'

// POST /api/notifications  { event, id } — treść i odbiorców ustala serwer na podstawie bazy
export async function POST(request: Request) {
  const db = serviceClient()
  if (!db) return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' }, { status: 500 })

  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return new Response('Unauthorized', { status: 401 })

  // Każdy błąd sieci lub bazy (także przy weryfikacji autora) kończy się odpowiedzią JSON 500
  try {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
    const { data: { user } } = await anon.auth.getUser(token)
    if (!user?.email) return new Response('Unauthorized', { status: 401 })

    const req = parseEventRequest(await request.json().catch(() => null))
    if (!req) return Response.json({ error: 'Nieprawidłowe zdarzenie' }, { status: 400 })

    const actor = await loadPersonByEmail(db, user.email)
    if (!actor) return Response.json({ error: 'Brak profilu' }, { status: 403 })

    let resolution: Resolution
    switch (req.event) {
      case 'task_assigned':
      case 'task_reviewed': {
        const { data } = await db.from('tasks').select(TASK).eq('id', req.id).maybeSingle()
        const task = data as TaskRecord | null
        const owner = await loadPersonById(db, task?.owner_id ?? null)
        resolution = req.event === 'task_assigned' ? resolveTaskAssigned(actor, task, owner) : resolveTaskReviewed(actor, task, owner)
        break
      }
      case 'case_assigned':
      case 'case_status_changed':
      case 'case_comment': {
        const { data } = await db.from('cases').select(CASE).eq('id', req.id).maybeSingle()
        const kase = data as CaseRecord | null
        const owner = await loadPersonById(db, kase?.owner_id ?? null)
        if (req.event === 'case_assigned') resolution = resolveCaseAssigned(actor, kase, owner)
        else if (req.event === 'case_status_changed') resolution = resolveCaseStatusChanged(actor, kase, owner)
        else {
          const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
          const { data: comments } = await db.from('case_comments').select('id').eq('case_id', req.id).eq('user_id', actor.id).gte('created_at', since).limit(1)
          resolution = resolveCaseComment(actor, kase, owner, (comments?.length ?? 0) > 0)
        }
        break
      }
      case 'account_pending':
        resolution = resolveAccountPending(actor, req.id, await loadBoard(db))
        break
      case 'account_approved':
        resolution = resolveAccountApproved(actor, await loadPersonById(db, req.id))
        break
      default:
        return Response.json({ error: 'Nieobsługiwane zdarzenie' }, { status: 400 })
    }

    if (!resolution.ok) return Response.json({ error: resolution.reason }, { status: resolution.status })
    const result = await dispatch(supabaseStore(db), resolution.notifications)
    return Response.json({ success: true, ...result })
  } catch (err) {
    console.error('Notification error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
