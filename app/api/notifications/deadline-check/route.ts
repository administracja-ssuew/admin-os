import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../../../../lib/email'
import { deadlineReminderTemplate } from '../../../../lib/email-templates'

// GET /api/notifications/deadline-check
// Wywołać jako cron (np. Vercel Cron Job co 24h)
// Cron caller musi wysyłać: Authorization: Bearer $CRON_SECRET
export async function GET(request: Request) {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseServiceKey) {
    return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' }, { status: 500 })
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return Response.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }

  // Weryfikacja przez Authorization header (sekrety w query params trafiają do logów serwera — SEC-05)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseServiceKey
  )

  try {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    // Zadania z deadline = jutro, status != done
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, deadline, owner_id, users!tasks_owner_id_fkey(id, email, first_name, last_name)')
      .eq('deadline', tomorrowStr)
      .neq('status', 'done')

    if (!tasks || tasks.length === 0) {
      return Response.json({ success: true, processed: 0 })
    }

    let processed = 0

    for (const task of tasks) {
      const owner = (task as any).users
      if (!owner) continue

      // In-app
      await supabase.from('notifications').insert([{
        user_id: owner.id,
        type: 'deadline_reminder',
        title: `Termin zadania jutro`,
        body: task.title,
        link: '/tasks',
      }])

      // Email
      if (owner.email) {
        const tpl = deadlineReminderTemplate(task.title, task.deadline)
        await sendEmail({ to: owner.email, subject: tpl.subject, html: tpl.html })
      }

      processed++
    }

    return Response.json({ success: true, processed })
  } catch (err) {
    console.error('Deadline check error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
