// ─── UŻYTKOWNICY ─────────────────────────────────────────────────
export type SystemRole = 'pending' | 'active' | 'inactive' | 'admin' | 'superadmin'

export interface AppUser {
  id: string
  email: string
  first_name: string
  last_name: string
  system_role: SystemRole
  department_id: string | null
  org_function: string | null
  tags: string[]
  created_at: string
  // relacje
  departments?: { name: string } | null
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
  case_type: string
  status: CaseStatus
  source: string | null
  confidentiality_level: ConfidentialityLevel
  owner_id: string | null
  department_id: string | null
  cred_signature: string | null
  attachments: CaseAttachment[]
  created_at: string
  // relacje
  users?: { first_name: string; last_name: string } | null
  departments?: { name: string } | null
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
  done: boolean
}

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  owner_id: string | null
  department_id: string | null
  project_id: string | null
  case_id: string | null
  deadline: string | null
  checklists: ChecklistItem[]
  attachments: string[]
  completion_percentage: number
  created_at: string
  // relacje
  users?: { first_name: string; last_name: string } | null
  departments?: { name: string } | null
  projects?: { name: string } | null
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

// ─── WIEDZA ──────────────────────────────────────────────────────
export interface KnowledgeArticle {
  id: string
  title: string
  content: string | null
  category: string
  drive_link: string | null
  updated_at: string
}

// ─── DEPARTAMENTY ─────────────────────────────────────────────────
export interface Department {
  id: string
  name: string
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
