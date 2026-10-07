import { EMAIL_TYPES, caseLink, isActiveMember, isBoard, taskLink, userLink, type NotificationType } from './events.ts'

export interface Person { id: string; email: string | null; first_name: string; last_name: string; system_role: string }
export interface TaskRecord { id: string; title: string; owner_id: string | null; deadline: string | null; status: string; verification_status: string | null; verification_feedback: string | null }
export interface CaseRecord { id: string; case_number: string; title: string; owner_id: string | null; status: string }
export interface Outgoing { userId: string; email: string | null; type: NotificationType; title: string; body: string; link: string; sendEmail: boolean }
export type Resolution = { ok: true; notifications: Outgoing[] } | { ok: false; status: 403 | 404; reason: string }

const CASE_STATUS: Record<string, string> = { new: 'Nowa', in_progress: 'W toku', closed: 'Zamknięta' }
const name = (p: Person) => `${p.first_name} ${p.last_name}`.trim()
const deny = (status: 403 | 404, reason: string): Resolution => ({ ok: false, status, reason })
const none = (): Resolution => ({ ok: true, notifications: [] })

function to(recipient: Person, type: NotificationType, title: string, body: string, link: string): Outgoing {
  return { userId: recipient.id, email: recipient.email, type, title, body, link, sendEmail: EMAIL_TYPES.has(type) }
}

/** Odbiorca istnieje i nie jest autorem zmiany. */
const recipientOf = (actor: Person, owner: Person | null) => (owner && owner.id !== actor.id ? owner : null)

export function resolveTaskAssigned(actor: Person, task: TaskRecord | null, owner: Person | null): Resolution {
  if (!isActiveMember(actor.system_role)) return deny(403, 'Brak uprawnień')
  if (!task) return deny(404, 'Nie ma takiego zadania')
  const recipient = recipientOf(actor, owner)
  if (!recipient) return none()
  return { ok: true, notifications: [to(recipient, 'task_assigned', 'Przydzielono Ci zadanie', `${name(actor)} przydzielił(a) Ci zadanie „${task.title}”.`, taskLink(task.id))] }
}

export function resolveTaskReviewed(actor: Person, task: TaskRecord | null, owner: Person | null): Resolution {
  if (!isBoard(actor.system_role)) return deny(403, 'Ocenia wyłącznie zarząd')
  if (!task) return deny(404, 'Nie ma takiego zadania')
  if (task.verification_status !== 'approved' && task.verification_status !== 'rejected') return deny(403, 'Zadanie nie zostało ocenione')
  const recipient = recipientOf(actor, owner)
  if (!recipient) return none()
  if (task.verification_status === 'approved') {
    return { ok: true, notifications: [to(recipient, 'task_approved', 'Zadanie zatwierdzone', `${name(actor)} zatwierdził(a) zadanie „${task.title}”.`, taskLink(task.id))] }
  }
  const feedback = task.verification_feedback ? ` Uwagi: ${task.verification_feedback}` : ''
  return { ok: true, notifications: [to(recipient, 'task_rejected', 'Zadanie wymaga poprawek', `${name(actor)} odesłał(a) zadanie „${task.title}” do poprawek.${feedback}`, taskLink(task.id))] }
}

export function resolveCaseAssigned(actor: Person, kase: CaseRecord | null, owner: Person | null): Resolution {
  if (!isActiveMember(actor.system_role)) return deny(403, 'Brak uprawnień')
  if (!kase) return deny(404, 'Nie ma takiej sprawy')
  const recipient = recipientOf(actor, owner)
  if (!recipient) return none()
  return { ok: true, notifications: [to(recipient, 'case_assigned', `Prowadzisz sprawę ${kase.case_number}`, `${name(actor)} przypisał(a) Ci sprawę „${kase.title}”.`, caseLink(kase.id))] }
}

export function resolveCaseStatusChanged(actor: Person, kase: CaseRecord | null, owner: Person | null): Resolution {
  if (!isActiveMember(actor.system_role)) return deny(403, 'Brak uprawnień')
  if (!kase) return deny(404, 'Nie ma takiej sprawy')
  const recipient = recipientOf(actor, owner)
  if (!recipient) return none()
  const status = CASE_STATUS[kase.status] ?? kase.status
  return { ok: true, notifications: [to(recipient, 'case_status_changed', `Zmiana statusu: ${kase.case_number}`, `${name(actor)} zmienił(a) status sprawy „${kase.title}” na: ${status}.`, caseLink(kase.id))] }
}

export function resolveCaseComment(actor: Person, kase: CaseRecord | null, owner: Person | null, hasRecentComment: boolean): Resolution {
  if (!isActiveMember(actor.system_role)) return deny(403, 'Brak uprawnień')
  if (!kase) return deny(404, 'Nie ma takiej sprawy')
  if (!hasRecentComment) return deny(403, 'Brak nowego komentarza')
  const recipient = recipientOf(actor, owner)
  if (!recipient) return none()
  return { ok: true, notifications: [to(recipient, 'case_comment', `Nowy komentarz: ${kase.case_number}`, `${name(actor)} skomentował(a) sprawę „${kase.title}”.`, caseLink(kase.id))] }
}

export function resolveAccountPending(actor: Person, targetId: string, board: Person[]): Resolution {
  if (actor.id !== targetId || actor.system_role !== 'pending') return deny(403, 'Można zgłosić tylko własne oczekujące konto')
  const who = actor.email ?? name(actor)
  return { ok: true, notifications: board.map(b => to(b, 'account_pending', 'Nowe konto czeka na weryfikację', `${who} zarejestrował(a) się i czeka na zatwierdzenie w Kadrach.`, userLink(actor.id))) }
}

export function resolveAccountApproved(actor: Person, target: Person | null): Resolution {
  if (!isBoard(actor.system_role)) return deny(403, 'Zatwierdza wyłącznie zarząd')
  if (!target) return deny(404, 'Nie ma takiego konta')
  if (!isActiveMember(target.system_role)) return deny(403, 'Konto nie jest aktywne')
  return { ok: true, notifications: [to(target, 'account_approved', 'Twoje konto zostało zatwierdzone', 'Masz już dostęp do AdminOS. Zaloguj się, aby zacząć.', '/')] }
}

export function resolveExternalSubmission(kase: { id: string; case_number: string; title: string }, board: Person[]): Outgoing[] {
  return board.map(b => to(b, 'external_submission', `Nowy wniosek: ${kase.case_number}`, `Z formularza wpłynął wniosek „${kase.title}”.`, caseLink(kase.id)))
}

export function resolveDeadlines(tasks: Array<TaskRecord & { owner: Person | null }>, today: string): Outgoing[] {
  const tomorrow = addDays(today, 1)
  const yesterday = addDays(today, -1)
  const out: Outgoing[] = []
  for (const t of tasks) {
    if (!t.owner || t.status === 'done' || !t.deadline) continue
    const day = t.deadline.slice(0, 10)
    if (day === tomorrow) out.push(to(t.owner, 'deadline_tomorrow', 'Termin zadania jutro', `Zadanie „${t.title}” ma termin jutro.`, taskLink(t.id)))
    if (day === yesterday) out.push(to(t.owner, 'deadline_overdue', 'Zadanie po terminie', `Termin zadania „${t.title}” minął wczoraj.`, taskLink(t.id)))
  }
  return out
}

/** Dzień kalendarzowy w Warszawie (YYYY-MM-DD). */
export function warsawDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}
