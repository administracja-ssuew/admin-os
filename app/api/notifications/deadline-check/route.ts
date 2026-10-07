import { serviceClient } from '../../../../lib/notifications/load'
import { dispatch, supabaseStore } from '../../../../lib/notifications/dispatch'
import { addDays, resolveDeadlines, warsawDate, type Person, type TaskRecord } from '../../../../lib/notifications/resolve'

// GET /api/notifications/deadline-check — Vercel Cron (vercel.json), nagłówek Authorization: Bearer $CRON_SECRET
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return Response.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  if (!db) return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' }, { status: 500 })

  try {
    const today = warsawDate(new Date())
    const { data, error } = await db
      .from('tasks')
      .select('id, title, owner_id, deadline, status, verification_status, verification_feedback, owner:users!tasks_owner_id_fkey(id, email, first_name, last_name, system_role)')
      .in('deadline', [addDays(today, 1), addDays(today, -1)])
      .neq('status', 'done')
      .not('owner_id', 'is', null)
    if (error) throw error

    const tasks = (data ?? []) as unknown as Array<TaskRecord & { owner: Person | null }>
    const result = await dispatch(supabaseStore(db), resolveDeadlines(tasks, today))
    return Response.json({ success: true, today, ...result })
  } catch (err) {
    console.error('Deadline check error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
