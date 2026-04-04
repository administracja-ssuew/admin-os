import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../../../lib/email'
import {
  taskAssignedTemplate,
  caseStatusChangeTemplate,
  newMeetingTemplate,
  caseCommentTemplate,
  externalSubmissionAdminTemplate,
  externalSubmissionConfirmationTemplate,
} from '../../../lib/email-templates'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function getSupabase(token?: string) {
  if (token) {
    const client = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    return client
  }
  return createClient(supabaseUrl, supabaseServiceKey)
}

// POST /api/notifications
// Body: { type, payload, userId? }
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    const supabase = getSupabase(token)

    // Jeśli token podany — weryfikujemy usera
    let callerUserId: string | null = null
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token)
      callerUserId = user?.id ?? null
    }

    const body = await request.json()
    const { type, payload } = body

    if (!type || !payload) {
      return Response.json({ error: 'Missing type or payload' }, { status: 400 })
    }

    // Pobieramy adminów do notyfikacji (dla typów 'external_submission')
    const { data: admins } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .in('system_role', ['admin', 'superadmin'])

    switch (type) {

      case 'task_assigned': {
        // payload: { taskId, taskTitle, assigneeId, assigneeEmail, assignerName }
        const { taskTitle, assigneeId, assigneeEmail, assignerName } = payload

        // In-app
        await supabase.from('notifications').insert([{
          user_id: assigneeId,
          type: 'task_assigned',
          title: 'Przydzielono Ci nowe zadanie',
          body: taskTitle,
          link: '/tasks',
        }])

        // Email
        if (assigneeEmail) {
          const tpl = taskAssignedTemplate(taskTitle, assignerName)
          await sendEmail({ to: assigneeEmail, subject: tpl.subject, html: tpl.html })
        }
        break
      }

      case 'case_status_changed': {
        // payload: { caseNumber, caseTitle, oldStatus, newStatus, ownerEmail, ownerId }
        const { caseNumber, caseTitle, oldStatus, newStatus, ownerEmail, ownerId } = payload

        if (ownerId) {
          await supabase.from('notifications').insert([{
            user_id: ownerId,
            type: 'case_status_changed',
            title: `Zmiana statusu: ${caseNumber}`,
            body: `${caseTitle} — ${newStatus}`,
            link: '/cases',
          }])
        }

        if (ownerEmail) {
          const tpl = caseStatusChangeTemplate(caseNumber, caseTitle, oldStatus, newStatus)
          await sendEmail({ to: ownerEmail, subject: tpl.subject, html: tpl.html })
        }
        break
      }

      case 'case_comment': {
        // payload: { caseNumber, caseTitle, commentAuthor, ownerId, ownerEmail }
        const { caseNumber, caseTitle, commentAuthor, ownerId, ownerEmail } = payload

        if (ownerId) {
          await supabase.from('notifications').insert([{
            user_id: ownerId,
            type: 'case_comment',
            title: `Nowy komentarz w sprawie ${caseNumber}`,
            body: `${commentAuthor} dodał/a komentarz`,
            link: '/cases',
          }])
        }

        if (ownerEmail) {
          const tpl = caseCommentTemplate(caseNumber, caseTitle, commentAuthor, '')
          await sendEmail({ to: ownerEmail, subject: tpl.subject, html: tpl.html })
        }
        break
      }

      case 'new_meeting': {
        // payload: { meetingTitle, date, time, organizerName, attendeeIds: string[], attendeeEmails: string[] }
        const { meetingTitle, date, time, organizerName, attendeeIds = [], attendeeEmails = [] } = payload

        const tpl = newMeetingTemplate(meetingTitle, date, time, organizerName)

        if (attendeeIds.length > 0) {
          await supabase.from('notifications').insert(
            attendeeIds.map((uid: string) => ({
              user_id: uid,
              type: 'new_meeting',
              title: 'Nowe zebranie w kalendarzu',
              body: `${meetingTitle} — ${date}${time ? ` o ${time}` : ''}`,
              link: '/meetings',
            }))
          )
        }

        if (attendeeEmails.length > 0) {
          await sendEmail({ to: attendeeEmails, subject: tpl.subject, html: tpl.html })
        }
        break
      }

      case 'external_submission': {
        // payload: { caseNumber, caseTitle, caseType, contactEmail }
        const { caseNumber, caseTitle, caseType, contactEmail } = payload

        // In-app dla adminów
        if (admins && admins.length > 0) {
          await supabase.from('notifications').insert(
            admins.map(a => ({
              user_id: a.id,
              type: 'external_submission',
              title: `Nowy wniosek zewnętrzny: ${caseNumber}`,
              body: caseTitle,
              link: '/cases',
            }))
          )

          // Email do adminów
          const adminEmails = admins.map(a => a.email).filter(Boolean)
          if (adminEmails.length > 0) {
            const adminTpl = externalSubmissionAdminTemplate(caseNumber, caseTitle, contactEmail, caseType)
            await sendEmail({ to: adminEmails, subject: adminTpl.subject, html: adminTpl.html })
          }
        }

        // Potwierdzenie do wnioskodawcy
        if (contactEmail) {
          const confTpl = externalSubmissionConfirmationTemplate(caseNumber, caseTitle)
          await sendEmail({ to: contactEmail, subject: confTpl.subject, html: confTpl.html })
        }
        break
      }

      default:
        return Response.json({ error: `Unknown notification type: ${type}` }, { status: 400 })
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error('Notification error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
