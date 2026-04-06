'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../../components/Sidebar'
import SkeletonLoader from '../../components/SkeletonLoader'
import {
  Plus, X, Lock, FileText, Paperclip, UploadCloud,
  Users, CheckSquare, Square, Vote, ChevronDown, ChevronUp,
  Trash2, PlusCircle, ClipboardList, UserCheck, Settings,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import type { MeetingProtocol, AttendanceMember, AgendaItem } from '../../types'

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function genId() {
  return crypto.randomUUID()
}

const EMPTY_FORM = {
  title: '',
  date: new Date().toISOString().split('T')[0],
  participants: '',
  agenda: '',
  findings: '',
  actions: '',
}

type DrawerTab = 'general' | 'attendance' | 'agenda' | 'protocol'

const TAB_CONFIG: { id: DrawerTab; label: string; icon: React.ReactNode }[] = [
  { id: 'general',    label: 'Ogólne',      icon: <Settings size={14} /> },
  { id: 'attendance', label: 'Obecność',    icon: <UserCheck size={14} /> },
  { id: 'agenda',     label: 'Porządek',    icon: <ClipboardList size={14} /> },
  { id: 'protocol',   label: 'Protokół',    icon: <FileText size={14} /> },
]

// ─── VOTE BADGE ───────────────────────────────────────────────────────────────

function VoteBadge({ vote }: { vote: AgendaItem['vote'] }) {
  if (!vote) return null
  const total = vote.for + vote.against + vote.abstain
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-bold mt-2 flex-wrap">
      <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">ZA: {vote.for}</span>
      <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">PRZECIW: {vote.against}</span>
      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full">WSTRZYM.: {vote.abstain}</span>
      <span className="text-slate-400 dark:text-slate-500">łącznie: {total}</span>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function MeetingsPage() {
  const { user, loading: userLoading } = useCurrentUser()
  const [protocols, setProtocols] = useState<MeetingProtocol[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [selectedProtocol, setSelectedProtocol] = useState<MeetingProtocol | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [isUploading, setIsUploading] = useState(false)
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [activeTab, setActiveTab] = useState<DrawerTab>('general')

  // Local state for attendance and agenda items within the drawer
  const [attendance, setAttendance] = useState<AttendanceMember[]>([])
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([])
  const [newAttendanceName, setNewAttendanceName] = useState('')
  const [newAgendaTitle, setNewAgendaTitle] = useState('')
  const [expandedAgendaItem, setExpandedAgendaItem] = useState<string | null>(null)

  // All users for attendance
  const [allUsers, setAllUsers] = useState<{ id: string; first_name: string; last_name: string }[]>([])

  const fetchProtocols = useCallback(async () => {
    const { data } = await supabase
      .from('meeting_protocols')
      .select('*')
      .order('date', { ascending: false })
    if (data) setProtocols(data as MeetingProtocol[])
    setLoading(false)
  }, [])

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .in('system_role', ['active', 'admin', 'superadmin'])
      .order('last_name', { ascending: true })
    if (data) setAllUsers(data)
  }, [])

  useEffect(() => {
    fetchProtocols()
    fetchUsers()
  }, [fetchProtocols, fetchUsers])

  // ─── CREATE ──────────────────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setIsSubmitting(true)
    const toastId = toast.loading('Tworzenie protokołu...')
    const { error } = await supabase.from('meeting_protocols').insert([{
      ...form,
      protocol_status: 'draft',
      created_by: user.id,
      attendance: [],
      agenda_items: [],
    }])
    if (!error) {
      toast.success('Protokół utworzony!', { id: toastId })
      setIsModalOpen(false)
      setForm(EMPTY_FORM)
      await fetchProtocols()
    } else {
      toast.error('Błąd podczas tworzenia protokołu', { id: toastId })
    }
    setIsSubmitting(false)
  }

  // ─── SAVE GENERAL ────────────────────────────────────────────────────────────

  const handleSaveGeneral = async () => {
    if (!selectedProtocol || isFinalized) return
    const toastId = toast.loading('Zapisywanie...')
    const { error } = await supabase.from('meeting_protocols')
      .update({ ...editForm, updated_at: new Date().toISOString() })
      .eq('id', selectedProtocol.id)
    if (!error) {
      toast.success('Zapisano!', { id: toastId })
      await fetchProtocols()
      setSelectedProtocol({ ...selectedProtocol, ...editForm })
    } else {
      toast.error('Błąd zapisu', { id: toastId })
    }
  }

  // ─── ATTENDANCE ───────────────────────────────────────────────────────────────

  const togglePresence = async (memberId: string) => {
    if (!selectedProtocol || isFinalized) return
    const updated = attendance.map(m =>
      m.id === memberId ? { ...m, present: !m.present } : m
    )
    setAttendance(updated)
    await supabase.from('meeting_protocols')
      .update({ attendance: updated, updated_at: new Date().toISOString() })
      .eq('id', selectedProtocol.id)
  }

  const addAttendanceMember = async () => {
    if (!newAttendanceName.trim() || !selectedProtocol || isFinalized) return
    const newMember: AttendanceMember = { id: genId(), name: newAttendanceName.trim(), present: true }
    const updated = [...attendance, newMember]
    setAttendance(updated)
    setNewAttendanceName('')
    await supabase.from('meeting_protocols')
      .update({ attendance: updated, updated_at: new Date().toISOString() })
      .eq('id', selectedProtocol.id)
  }

  const removeAttendanceMember = async (memberId: string) => {
    if (!selectedProtocol || isFinalized) return
    const updated = attendance.filter(m => m.id !== memberId)
    setAttendance(updated)
    await supabase.from('meeting_protocols')
      .update({ attendance: updated, updated_at: new Date().toISOString() })
      .eq('id', selectedProtocol.id)
  }

  const prefillFromUsers = async () => {
    if (!selectedProtocol || isFinalized) return
    const existing = new Set(attendance.map(m => m.name))
    const toAdd: AttendanceMember[] = allUsers
      .filter(u => !existing.has(`${u.first_name} ${u.last_name}`))
      .map(u => ({ id: genId(), name: `${u.first_name} ${u.last_name}`, present: false }))
    if (toAdd.length === 0) { toast('Wszyscy członkowie już są na liście'); return }
    const updated = [...attendance, ...toAdd]
    setAttendance(updated)
    await supabase.from('meeting_protocols')
      .update({ attendance: updated, updated_at: new Date().toISOString() })
      .eq('id', selectedProtocol.id)
    toast.success(`Dodano ${toAdd.length} członków`)
  }

  // ─── AGENDA ITEMS ─────────────────────────────────────────────────────────────

  const addAgendaItem = async () => {
    if (!newAgendaTitle.trim() || !selectedProtocol || isFinalized) return
    const newItem: AgendaItem = { id: genId(), title: newAgendaTitle.trim(), notes: '', vote: null }
    const updated = [...agendaItems, newItem]
    setAgendaItems(updated)
    setNewAgendaTitle('')
    setExpandedAgendaItem(newItem.id)
    await supabase.from('meeting_protocols')
      .update({ agenda_items: updated, updated_at: new Date().toISOString() })
      .eq('id', selectedProtocol.id)
  }

  const updateAgendaItem = async (itemId: string, patch: Partial<AgendaItem>) => {
    if (!selectedProtocol || isFinalized) return
    const updated = agendaItems.map(it => it.id === itemId ? { ...it, ...patch } : it)
    setAgendaItems(updated)
    await supabase.from('meeting_protocols')
      .update({ agenda_items: updated, updated_at: new Date().toISOString() })
      .eq('id', selectedProtocol.id)
  }

  const removeAgendaItem = async (itemId: string) => {
    if (!selectedProtocol || isFinalized) return
    const updated = agendaItems.filter(it => it.id !== itemId)
    setAgendaItems(updated)
    await supabase.from('meeting_protocols')
      .update({ agenda_items: updated, updated_at: new Date().toISOString() })
      .eq('id', selectedProtocol.id)
  }

  const setVote = async (itemId: string, type: 'for' | 'against' | 'abstain', delta: number) => {
    if (!selectedProtocol || isFinalized) return
    const item = agendaItems.find(it => it.id === itemId)
    if (!item) return
    const current = item.vote ?? { for: 0, against: 0, abstain: 0 }
    const updated = { ...current, [type]: Math.max(0, current[type] + delta) }
    await updateAgendaItem(itemId, { vote: updated })
  }

  const toggleVoting = async (itemId: string) => {
    const item = agendaItems.find(it => it.id === itemId)
    if (!item) return
    if (item.vote) {
      await updateAgendaItem(itemId, { vote: null })
    } else {
      await updateAgendaItem(itemId, { vote: { for: 0, against: 0, abstain: 0 } })
    }
  }

  // ─── FILE UPLOAD ──────────────────────────────────────────────────────────────

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedProtocol) return
    setIsUploading(true)
    const toastId = toast.loading('Wrzucanie pliku...')
    try {
      const safeFileName = file.name.replace(/[^\w.\-]/g, '_')
      const filePath = `protocols/${selectedProtocol.id}/${crypto.randomUUID()}/${safeFileName}`
      const { error: uploadError } = await supabase.storage.from('adminos-files').upload(filePath, file, { contentType: file.type })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('adminos-files').getPublicUrl(filePath)
      const { error: updateError } = await supabase.from('meeting_protocols')
        .update({ file_url: urlData.publicUrl, file_name: file.name, updated_at: new Date().toISOString() })
        .eq('id', selectedProtocol.id)
      if (updateError) throw updateError
      toast.success('Plik dołączony!', { id: toastId })
      setSelectedProtocol({ ...selectedProtocol, file_url: urlData.publicUrl, file_name: file.name })
      await fetchProtocols()
    } catch {
      toast.error('Błąd podczas wgrywania pliku', { id: toastId })
    } finally {
      setIsUploading(false)
    }
  }

  // ─── FINALIZE ────────────────────────────────────────────────────────────────

  const handleFinalize = async () => {
    if (!selectedProtocol || isFinalized) return
    setIsFinalizing(true)
    const toastId = toast.loading('Blokowanie protokołu...')
    const { error } = await supabase.from('meeting_protocols')
      .update({ protocol_status: 'finalized', updated_at: new Date().toISOString() })
      .eq('id', selectedProtocol.id)
    if (!error) {
      toast.success('Protokół zablokowany!', { id: toastId })
      setSelectedProtocol({ ...selectedProtocol, protocol_status: 'finalized' })
      await fetchProtocols()
    } else {
      toast.error('Błąd podczas blokowania', { id: toastId })
    }
    setIsFinalizing(false)
  }

  // ─── OPEN DRAWER ─────────────────────────────────────────────────────────────

  const openDrawer = (protocol: MeetingProtocol) => {
    setSelectedProtocol(protocol)
    setEditForm({
      title: protocol.title,
      date: protocol.date,
      participants: protocol.participants,
      agenda: protocol.agenda,
      findings: protocol.findings,
      actions: protocol.actions,
    })
    setAttendance(protocol.attendance ?? [])
    setAgendaItems(protocol.agenda_items ?? [])
    setActiveTab('general')
    setExpandedAgendaItem(null)
    setIsDrawerOpen(true)
  }

  const isFinalized = selectedProtocol?.protocol_status === 'finalized'

  const presentCount = attendance.filter(m => m.present).length

  // ─── RENDER ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar />
      <div className="flex-1 ml-64 p-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Protokoły posiedzeń</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Planuj zebrania, sprawdzaj obecność, rejestruj głosowania</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nowe zebranie
          </button>
        </div>

        {/* Protocol list */}
        {loading ? (
          <SkeletonLoader variant="card" count={3} />
        ) : protocols.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <FileText className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-lg font-medium">Brak protokołów</p>
            <p className="text-sm mt-1">Kliknij &quot;Nowe zebranie&quot;, aby dodać pierwsze</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {protocols.map((protocol) => {
              const present = (protocol.attendance ?? []).filter(m => m.present).length
              const total = (protocol.attendance ?? []).length
              const itemCount = (protocol.agenda_items ?? []).length
              return (
                <button
                  key={protocol.id}
                  onClick={() => openDrawer(protocol)}
                  className="text-left bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm leading-snug line-clamp-2">{protocol.title}</h3>
                    {protocol.protocol_status === 'finalized' ? (
                      <span className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                        <Lock className="w-3 h-3" /> Zamknięty
                      </span>
                    ) : (
                      <span className="shrink-0 px-2 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                        Szkic
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{protocol.date}</p>
                  <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                    {total > 0 && (
                      <span className="flex items-center gap-1">
                        <Users size={11} /> {present}/{total} obecnych
                      </span>
                    )}
                    {itemCount > 0 && (
                      <span className="flex items-center gap-1">
                        <ClipboardList size={11} /> {itemCount} pkt
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── MODAL TWORZENIA ────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Nowe zebranie</h2>
              <button onClick={() => { setIsModalOpen(false); setForm(EMPTY_FORM) }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tytuł zebrania</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Np. Posiedzenie Zarządu nr 12/2026" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Wstępny porządek obrad <span className="text-slate-400 font-normal">(opcjonalnie)</span></label>
                <textarea rows={3} value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Punkty porządku obrad..." />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setIsModalOpen(false); setForm(EMPTY_FORM) }}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                  Anuluj
                </button>
                <button type="submit" disabled={isSubmitting || userLoading}
                  className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm">
                  {isSubmitting ? 'Tworzenie...' : 'Utwórz protokół'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DRAWER ─────────────────────────────────────────────────────────────── */}
      {isDrawerOpen && selectedProtocol && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-[540px] bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">

            {/* Drawer header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2 mb-0.5">
                  {isFinalized ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                      <Lock className="w-2.5 h-2.5" /> Zamknięty
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Szkic</span>
                  )}
                  {attendance.length > 0 && (
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{presentCount}/{attendance.length} obecnych</span>
                  )}
                </div>
                <h2 className="font-bold text-slate-900 dark:text-white text-sm truncate">{selectedProtocol.title}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{selectedProtocol.date}</p>
              </div>
              <button onClick={() => setIsDrawerOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            {isFinalized && (
              <div className="mx-5 mt-3 px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-medium flex items-center gap-2 shrink-0">
                <Lock className="w-3.5 h-3.5 shrink-0" /> Protokół zamknięty — edycja zablokowana
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 shrink-0 px-5 pt-3">
              {TAB_CONFIG.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-colors mr-1 ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">

              {/* ── TAB: OGÓLNE ────────────────────────────────────────────────── */}
              {activeTab === 'general' && (
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Tytuł</label>
                    <input type="text" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} disabled={isFinalized}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Data</label>
                    <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} disabled={isFinalized}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Notatki wstępne / agenda</label>
                    <textarea rows={3} value={editForm.agenda} onChange={(e) => setEditForm({ ...editForm, agenda: e.target.value })} disabled={isFinalized}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-60" />
                  </div>
                  {!isFinalized && (
                    <button onClick={handleSaveGeneral}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm transition-colors">
                      Zapisz zmiany
                    </button>
                  )}
                </div>
              )}

              {/* ── TAB: OBECNOŚĆ ──────────────────────────────────────────────── */}
              {activeTab === 'attendance' && (
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">Lista obecności</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Obecni: {presentCount} / {attendance.length}</p>
                    </div>
                    {!isFinalized && allUsers.length > 0 && (
                      <button onClick={prefillFromUsers}
                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                        <Users size={12} /> Wczytaj członków
                      </button>
                    )}
                  </div>

                  {attendance.length === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-slate-500 italic text-center py-6">Brak uczestników. Dodaj lub wczytaj listę członków.</p>
                  ) : (
                    <div className="space-y-1">
                      {attendance.map(member => (
                        <div key={member.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                          <button onClick={() => togglePresence(member.id)} disabled={isFinalized}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                              member.present
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}>
                            {member.present && <CheckSquare size={12} />}
                          </button>
                          <span className={`flex-1 text-sm font-medium ${member.present ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                            {member.name}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${member.present ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                            {member.present ? 'OBECNY' : 'NIEOBECNY'}
                          </span>
                          {!isFinalized && (
                            <button onClick={() => removeAttendanceMember(member.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all">
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {!isFinalized && (
                    <div className="flex gap-2 pt-2">
                      <input
                        type="text"
                        placeholder="Imię i nazwisko uczestnika..."
                        value={newAttendanceName}
                        onChange={e => setNewAttendanceName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addAttendanceMember()}
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button onClick={addAttendanceMember} disabled={!newAttendanceName.trim()}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-40 transition-colors">
                        <PlusCircle size={16} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: PORZĄDEK OBRAD ────────────────────────────────────────── */}
              {activeTab === 'agenda' && (
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">Punkty porządku obrad</h3>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{agendaItems.length} punkt{agendaItems.length !== 1 ? 'ów' : ''}</span>
                  </div>

                  {agendaItems.length === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-slate-500 italic text-center py-6">Brak punktów porządku. Dodaj pierwszy.</p>
                  ) : (
                    <div className="space-y-2">
                      {agendaItems.map((item, idx) => {
                        const expanded = expandedAgendaItem === item.id
                        return (
                          <div key={item.id} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                            {/* Item header */}
                            <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50">
                              <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 w-5 shrink-0">{idx + 1}.</span>
                              <span className="flex-1 text-sm font-bold text-slate-900 dark:text-white truncate">{item.title}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                {item.vote && (
                                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
                                    <Vote size={10} /> Głosowanie
                                  </span>
                                )}
                                {!isFinalized && (
                                  <button onClick={() => removeAgendaItem(item.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                                    <Trash2 size={12} />
                                  </button>
                                )}
                                <button onClick={() => setExpandedAgendaItem(expanded ? null : item.id)} className="text-slate-400 hover:text-slate-600 p-1">
                                  {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                              </div>
                            </div>

                            {/* Expanded content */}
                            {expanded && (
                              <div className="p-4 space-y-4">

                                {/* Vote section */}
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Głosowanie</span>
                                    {!isFinalized && (
                                      <button onClick={() => toggleVoting(item.id)}
                                        className={`text-xs font-bold px-2 py-0.5 rounded transition-colors ${item.vote ? 'text-red-500 hover:text-red-700' : 'text-blue-600 hover:text-blue-800 dark:text-blue-400'}`}>
                                        {item.vote ? 'Usuń głosowanie' : '+ Dodaj głosowanie'}
                                      </button>
                                    )}
                                  </div>

                                  {item.vote ? (
                                    <div className="grid grid-cols-3 gap-2">
                                      {(['for', 'against', 'abstain'] as const).map(type => {
                                        const labels = { for: 'ZA', against: 'PRZECIW', abstain: 'WSTRZYM.' }
                                        const colors = {
                                          for: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400',
                                          against: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
                                          abstain: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300',
                                        }
                                        return (
                                          <div key={type} className={`rounded-lg border p-2 text-center ${colors[type]}`}>
                                            <div className="text-[10px] font-extrabold uppercase tracking-wider mb-1">{labels[type]}</div>
                                            <div className="text-xl font-extrabold mb-1">{item.vote![type]}</div>
                                            {!isFinalized && (
                                              <div className="flex justify-center gap-1">
                                                <button onClick={() => setVote(item.id, type, -1)} className="w-5 h-5 rounded bg-white/50 dark:bg-black/20 flex items-center justify-center font-bold text-sm hover:bg-white/80 dark:hover:bg-black/40 transition-colors">−</button>
                                                <button onClick={() => setVote(item.id, type, +1)} className="w-5 h-5 rounded bg-white/50 dark:bg-black/20 flex items-center justify-center font-bold text-sm hover:bg-white/80 dark:hover:bg-black/40 transition-colors">+</button>
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">Brak głosowania dla tego punktu</p>
                                  )}
                                </div>

                                {/* Notes/decision */}
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Ustalenia / decyzja</label>
                                  <textarea
                                    rows={3}
                                    value={item.notes}
                                    onChange={e => updateAgendaItem(item.id, { notes: e.target.value })}
                                    disabled={isFinalized}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-60"
                                    placeholder="Zapisz ustalenia, decyzję lub podsumowanie punktu..."
                                  />
                                </div>
                              </div>
                            )}

                            {/* Vote badge in collapsed view */}
                            {!expanded && item.vote && (
                              <div className="px-4 pb-3">
                                <VoteBadge vote={item.vote} />
                              </div>
                            )}
                            {!expanded && item.notes && (
                              <p className="px-4 pb-3 text-xs text-slate-500 dark:text-slate-400 italic line-clamp-2">{item.notes}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {!isFinalized && (
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Tytuł punktu porządku obrad..."
                        value={newAgendaTitle}
                        onChange={e => setNewAgendaTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addAgendaItem()}
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button onClick={addAgendaItem} disabled={!newAgendaTitle.trim()}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-40 transition-colors">
                        <PlusCircle size={16} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: PROTOKÓŁ ──────────────────────────────────────────────── */}
              {activeTab === 'protocol' && (
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Ustalenia ogólne</label>
                    <textarea rows={4} value={editForm.findings} onChange={(e) => setEditForm({ ...editForm, findings: e.target.value })} disabled={isFinalized}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-60"
                      placeholder="Ogólne ustalenia posiedzenia..." />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Akcje do podjęcia</label>
                    <textarea rows={3} value={editForm.actions} onChange={(e) => setEditForm({ ...editForm, actions: e.target.value })} disabled={isFinalized}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-60"
                      placeholder="Działania do podjęcia po zebraniu..." />
                  </div>

                  {!isFinalized && (
                    <button onClick={handleSaveGeneral}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm transition-colors">
                      Zapisz protokół
                    </button>
                  )}

                  {/* Plik protokołu */}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Plik protokołu</p>
                    {selectedProtocol?.file_url ? (
                      <a href={selectedProtocol.file_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm hover:underline mb-2">
                        <Paperclip size={14} /> {selectedProtocol.file_name ?? 'Plik protokołu'}
                      </a>
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Brak dołączonego pliku</p>
                    )}
                    {!isFinalized && (
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400">
                        <UploadCloud size={16} />
                        {isUploading ? 'Wgrywanie...' : 'Dołącz plik protokołu'}
                        <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                      </label>
                    )}
                  </div>

                  {/* Finalize */}
                  {!isFinalized && (
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                      <button onClick={handleFinalize} disabled={isFinalizing}
                        className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-sm">
                        <Lock size={14} /> {isFinalizing ? 'Zamykanie...' : 'Zamknij i zablokuj protokół'}
                      </button>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-center">Po zamknięciu protokół nie będzie mógł być edytowany.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
