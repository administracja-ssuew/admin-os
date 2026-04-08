'use server'

import { createClient } from '@supabase/supabase-js'

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

export async function submitExternalCase(payload: {
  id: string
  title: string
  description: string
  case_type: string
  attachments: { id: string; name: string; url: string; added_at: string }[] | null
}): Promise<{ caseNumber: string } | { error: string }> {
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('cases')
    .insert([{
      id: payload.id,
      title: payload.title,
      description: payload.description,
      case_type: payload.case_type,
      source: 'Formularz Zewnętrzny',
      status: 'new',
      confidentiality_level: 'internal',
      attachments: payload.attachments,
    }])
    .select('case_number')
    .single()

  if (error) return { error: error.message }
  return { caseNumber: data.case_number }
}
