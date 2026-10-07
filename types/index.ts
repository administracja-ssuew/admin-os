// ─── UŻYTKOWNICY ─────────────────────────────────────────────────
export type SystemRole = 'pending' | 'active' | 'inactive' | 'admin' | 'superadmin'

export interface AppUser {
  id: string
  email: string
  first_name: string
  last_name: string
  system_role: SystemRole
  org_function: string | null
  tags: string[]
  created_at: string
  // relacje
}

// ─── SPRAWY ──────────────────────────────────────────────────────
export type CaseStatus = 'new' | 'in_progress' | 'closed'
export type ConfidentialityLevel = 'internal' | 'board_only'

export interface CaseAttachment {
  id: string
  name: string
  url: string
  added_at: string
}

export interface Case {
  id: string
  title: string
  description: string | null
  case_number: string
  status: CaseStatus
  source: string | null
  confidentiality_level: ConfidentialityLevel
  owner_id: string | null
  cred_signature: string | null
  attachments: CaseAttachment[]
  created_at: string
  // relacje
  users?: { first_name: string; last_name: string } | null
}

export interface CaseComment {
  id: string
  case_id: string
  user_id: string
  content: string
  created_at: string
  // relacje
  users?: { first_name: string; last_name: string } | null
}

// ─── ZADANIA ─────────────────────────────────────────────────────
export type TaskStatus = 'to_do' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
}

export interface TaskAttachment {
  id: string
  name: string
  url: string
  added_at: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  owner_id: string | null
  project_id: string | null
  case_id: string | null
  deadline: string | null
  checklists: ChecklistItem[]
  attachments: TaskAttachment[]
  completion_percentage: number
  is_zarzad: boolean
  verification_status?: 'unverified' | 'approved' | 'rejected'
  verification_feedback?: string | null
  created_at: string
  updated_at?: string
  // relacje
  owner?: { first_name: string; last_name: string } | null
  users?: { first_name: string; last_name: string } | null
  projects?: { name: string } | null
  cases?: { title: string; case_number: string } | null
}

// ─── SPOTKANIA ───────────────────────────────────────────────────
export type ProtocolStatus = 'draft' | 'finalized'

export interface Meeting {
  id: string
  title: string
  meeting_date: string
  meeting_time: string | null
  agenda: string | null
  organizer_id: string | null
  attendees: string[]
  protocol_status: ProtocolStatus | null
  findings: string | null
  created_at: string
}

// ─── DOKUMENTY ───────────────────────────────────────────────────
export type DocumentStatus = 'Oczekujący' | 'Zatwierdzony' | 'Do poprawy'

export interface Document {
  id: string
  title: string
  owner_id: string | null
  status: DocumentStatus
  notes: string | null
  created_at: string
  // relacje
  users?: { first_name: string; last_name: string } | null
}

// ─── DECYZJE (PANEL ZARZĄDU) ──────────────────────────────────────
export type DecisionStatus = 'draft' | 'active'

export interface Decision {
  id: string
  title: string
  content: string | null
  status: DecisionStatus
  author_id: string | null
  approver_id: string | null
  effective_date: string | null
  created_at: string
}

// ─── AUDIT LOG ──────────────────────────────────────────────────
export interface AuditLogEntry {
  id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string
  old_value: Record<string, any> | null
  new_value: Record<string, any> | null
  created_at: string
  // relacje
  users?: { first_name: string; last_name: string } | null
}

// ─── POWIADOMIENIA ──────────────────────────────────────────────
import type { NotificationType } from '../lib/notifications/events'
export type { NotificationType } from '../lib/notifications/events'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

// ─── ARCHIWIZACJA ───────────────────────────────────────────────

export type ArchiveFolderStatus = 'W przygotowaniu' | 'Aktywna' | 'Zamknięta'

export type FolderType = 'general' | 'project_report'

export interface ArchiveFolder {
  id: string
  title: string
  status: ArchiveFolderStatus
  folder_type: FolderType
  notes: string | null
  contact_name?: string | null
  contact_info?: string | null
  attachments: CaseAttachment[]
  created_at: string
}

export interface AttendanceMember {
  id: string
  name: string
  present: boolean
}

export interface AgendaItem {
  id: string
  title: string
  notes: string
}

export interface MeetingProtocol {
  id: string
  title: string
  date: string                    // format: YYYY-MM-DD
  participants: string
  agenda: string
  findings: string
  actions: string
  protocol_status: ProtocolStatus
  file_url: string | null
  file_name: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  attendance: AttendanceMember[]
  agenda_items: AgendaItem[]
}
