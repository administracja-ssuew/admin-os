import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../../../../lib/email'
import { deadlineReminderTemplate } from '../../../../lib/email-templates'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET /api/notifications/deadline-check
// Wywołać jako cron (np. Vercel Cron Job co 24h)
export async function GET(request: Request) {
  // Opcjonalna weryfikacja secret dla cron
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
