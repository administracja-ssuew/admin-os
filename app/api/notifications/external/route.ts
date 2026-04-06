import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../../../../lib/email'
import {
  externalSubmissionAdminTemplate,
  externalSubmissionConfirmationTemplate,
} from '../../../../lib/email-templates'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

// POST /api/notifications/external
// Only handles external_submission type (from /wniosek public form)
// Protected by x-external-secret header (not session token — caller is unauthenticated)
export async function POST(request: Request) {
  try {
    const secret = process.env.EXTERNAL_NOTIFICATIONS_SECRET
    if (!secret) {
      return Response.json({ error: 'EXTERNAL_NOTIFICATIONS_SECRET is not configured' }, { status: 500 })
    }

    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseServiceKey) {
      return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' }, { status: 500 })
    }

    // Verify caller secret
    if (request.headers.get('x-external-secret') !== secret) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { type, payload } = await request.json()

    // This endpoint only handles external_submission — reject all other types
    if (type !== 'external_submission') {
      return Response.json({ error: 'This endpoint only accepts external_submission type' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { caseNumber, caseTitle, caseType, contactEmail } = payload

    // Fetch admins for in-app notifications
    const { data: admins } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .in('system_role', ['admin', 'superadmin'])

    // In-app notifications for all admins
    if (admins && admins.length > 0) {
      await supabase.from('notifications').insert(
        admins.map((a: { id: string; email: string }) => ({
          user_id: a.id,
          type: 'external_submission',
          title: `Nowy wniosek zewnętrzny: ${caseNumber}`,
          body: caseTitle,
          link: '/cases',
        }))
      )

      const adminEmails = admins.map((a: { email: string }) => a.email).filter(Boolean)
      if (adminEmails.length > 0) {
        const adminTpl = externalSubmissionAdminTemplate(caseNumber, caseTitle, contactEmail, caseType)
        await sendEmail({ to: adminEmails, subject: adminTpl.subject, html: adminTpl.html })
      }
    }

    // Confirmation email to the submitter
    if (contactEmail) {
      const confTpl = externalSubmissionConfirmationTemplate(caseNumber, caseTitle)
      await sendEmail({ to: contactEmail, subject: confTpl.subject, html: confTpl.html })
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error('External notification error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
