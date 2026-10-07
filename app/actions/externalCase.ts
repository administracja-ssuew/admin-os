'use server'

import { createClient } from '@supabase/supabase-js'
import { EXTERNAL_UPLOAD_PREFIX, FILES_BUCKET, externalFileError, sanitizeFileName, storagePath } from '../../lib/files'
import { contactEmailFromDescription } from '../../lib/request-status'
import { resolveExternalSubmission } from '../../lib/notifications/resolve'
import { dispatch, supabaseStore } from '../../lib/notifications/dispatch'
import { loadBoard } from '../../lib/notifications/load'
import { sendEmail } from '../../lib/email'
import { externalSubmissionConfirmationTemplate } from '../../lib/email-templates'

function getServiceClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export type CalendarEvent = {
  id: string
  title: string
  date: string
  type: 'meeting' | 'task'
}

export async function fetchPublicCalendarEvents(
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> {
  const supabase = getServiceClient()
  const [protocolsRes, tasksRes] = await Promise.all([
    supabase
      .from('meeting_protocols')
      .select('id, title, date')
      .gte('date', startDate)
      .lte('date', endDate),
    supabase
      .from('tasks')
      .select('id, title, deadline')
      .not('deadline', 'is', null)
      .gte('deadline', startDate)
      .lte('deadline', endDate)
      .neq('status', 'done'),
  ])

  return [
    ...(protocolsRes.data ?? []).map(m => ({ id: `m-${m.id}`, title: m.title, date: m.date, type: 'meeting' as const })),
    ...(tasksRes.data ?? []).map(t => ({ id: `t-${t.id}`, title: t.title, date: t.deadline, type: 'task' as const })),
  ]
}

/** Jednorazowy link do wysłania pliku z formularza publicznego (magazyn jest prywatny). */
export async function createExternalUpload(
  name: string,
  size: number
): Promise<{ path: string; token: string; url: string } | { error: string }> {
  const problem = externalFileError(String(name), Number(size))
  if (problem) return { error: problem }
  const supabase = getServiceClient()
  const path = `${EXTERNAL_UPLOAD_PREFIX}${crypto.randomUUID()}/${sanitizeFileName(String(name))}`
  const { data, error } = await supabase.storage.from(FILES_BUCKET).createSignedUploadUrl(path)
  if (error || !data) return { error: 'Nie udało się przygotować wysyłki pliku' }
  const { data: { publicUrl } } = supabase.storage.from(FILES_BUCKET).getPublicUrl(path)
  return { path, token: data.token, url: publicUrl }
}

export async function submitExternalCase(payload: {
  id: string
  title: string
  description: string
  attachments: { id: string; name: string; url: string; added_at: string }[] | null
}): Promise<{ caseNumber: string } | { error: string }> {
  const supabase = getServiceClient()

  // Przyjmujemy wyłącznie pliki wysłane przez createExternalUpload (folder wnioski/ naszego magazynu)
  const attachments = (payload.attachments ?? [])
    .filter(a => typeof a?.url === 'string' && a.url.startsWith(process.env.NEXT_PUBLIC_SUPABASE_URL!)
      && (storagePath(a.url) ?? '').startsWith(EXTERNAL_UPLOAD_PREFIX))
    .slice(0, 3)
    .map(a => ({ id: String(a.id), name: String(a.name).slice(0, 200), url: a.url, added_at: String(a.added_at) }))

  const { data, error } = await supabase
    .from('cases')
    .insert([{
      id: payload.id,
      title: payload.title,
      description: payload.description,
      source: 'Formularz Zewnętrzny',
      status: 'new',
      confidentiality_level: 'internal',
      attachments: attachments.length > 0 ? attachments : null,
    }])
    .select('id, case_number, title, description')
    .single()

  if (error) return { error: error.message }

  // Powiadomienia nie mogą zablokować przyjęcia wniosku
  try {
    await dispatch(supabaseStore(supabase), resolveExternalSubmission(data, await loadBoard(supabase)))
    const contact = contactEmailFromDescription(data.description)
    if (contact) {
      const tpl = externalSubmissionConfirmationTemplate(data.case_number, data.title)
      await sendEmail({ to: contact, subject: tpl.subject, html: tpl.html })
    }
  } catch (err) {
    console.error('External submission notification failed:', err)
  }

  return { caseNumber: data.case_number }
}
