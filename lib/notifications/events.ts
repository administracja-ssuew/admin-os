export const CLIENT_EVENTS = ['task_assigned', 'task_reviewed', 'case_assigned', 'case_status_changed', 'case_comment', 'account_pending', 'account_approved'] as const
export type ClientEvent = typeof CLIENT_EVENTS[number]

export type NotificationType =
  | 'task_assigned' | 'task_approved' | 'task_rejected' | 'deadline_tomorrow' | 'deadline_overdue'
  | 'external_submission' | 'case_assigned' | 'case_status_changed' | 'case_comment'
  | 'account_pending' | 'account_approved'

/** Zdarzenia, które poza dzwoneczkiem wysyłają e-mail (wymagają działania). */
export const EMAIL_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  'task_assigned', 'task_rejected', 'deadline_tomorrow', 'deadline_overdue', 'external_submission',
  'case_assigned', 'account_pending', 'account_approved',
])

/** Powiadomienia wysyłane najwyżej raz (bez okna 10 minut). */
export const DEDUPE_FOREVER: ReadonlySet<NotificationType> = new Set<NotificationType>(['deadline_overdue', 'account_pending', 'account_approved'])

export const taskLink = (id: string) => `/tasks?task=${encodeURIComponent(id)}`
export const caseLink = (id: string) => `/cases?case=${encodeURIComponent(id)}`
export const USERS_LINK = '/users'

export const isActiveMember = (role: string | null | undefined) => ['member', 'active', 'admin', 'superadmin'].includes(role ?? '')
export const isBoard = (role: string | null | undefined) => role === 'admin' || role === 'superadmin'

/** Z przeglądarki przyjmujemy wyłącznie nazwę zdarzenia i identyfikator rekordu. */
export function parseEventRequest(body: unknown): { event: ClientEvent; id: string } | null {
  if (!body || typeof body !== 'object') return null
  const { event, id } = body as Record<string, unknown>
  if (typeof event !== 'string' || !(CLIENT_EVENTS as readonly string[]).includes(event)) return null
  if (typeof id !== 'string' || !id.trim() || id.length > 100) return null
  return { event: event as ClientEvent, id: id.trim() }
}
