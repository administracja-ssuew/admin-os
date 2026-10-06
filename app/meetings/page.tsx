'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../../components/Sidebar'
import FileLink from '../../components/FileLink'
import SkeletonLoader from '../../components/SkeletonLoader'
import {
  Plus, X, Lock, FileText, Paperclip, UploadCloud,
  UserCheck, ClipboardList, PlusCircle,
  Trash2, ChevronDown, ChevronUp, CheckCircle2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import type { MeetingProtocol, AttendanceMember, AgendaItem } from '../../types'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type DrawerTab = 'general' | 'attendance' | 'agenda' | 'protocol'

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  title: '',
  date: new Date().toISOString().split('T')[0],
  participants: '',
  agenda: '',
  findings: '',
  actions: '',
}

const TAB_CONFIG: { id: DrawerTab; label: string }[] = [
  { id: 'general',    label: 'Ogólne'    },
  { id: 'attendance', label: 'Obecność'  },
  { id: 'agenda',     label: 'Porządek obrad'},
  { id: 'protocol',   label: 'Protokół'  },
]

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function MeetingsPage() {
  const { user, loading: userLoading } = useCurrentUser()
  const [protocols, setProtocols]       = useState<MeetingProtocol[]>([])
  const [loading, setLoading]           = useState(true)
  const [isModalOpen, setIsModalOpen]   = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm]                 = useState(EMPTY_FORM)

  // Drawer
  const [selectedProtocol, setSelectedProtocol] = useState<MeetingProtocol | null>(null)
  const [isDrawerOpen, setIsDrawerOpen]          = useState(false)
  const [activeTab, setActiveTab]                = useState<DrawerTab>('general')
  const [editForm, setEditForm]                  = useState(EMPTY_FORM)
  const [isSaving, setIsSaving]                  = useState(false)
  const [isUploading, setIsUploading]            = useState(false)
  const [isFinalizing, setIsFinalizing]          = useState(false)

  // Attendance
  const [attendance, setAttendance]           = useState<AttendanceMember[]>([])
  const [newAttendanceName, setNewAttendanceName] = useState('')
  const [allUsers, setAllUsers]               = useState<{ id: string; first_name: string; last_name: string }[]>([])

  // Agenda
  const [agendaItems, setAgendaItems]             = useState<AgendaItem[]>([])
  const [newAgendaTitle, setNewAgendaTitle]       = useState('')
  const [expandedItem, setExpandedItem]           = useState<string | null>(null)

  // ─── FETCH ──────────────────────────────────────────────────────────────────

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
      .order('last_name')
    if (data) setAllUsers(data)
  }, [])

  useEffect(() => { fetchProtocols(); fetchUsers() }, [fetchProtocols, fetchUsers])

  // ─── OPEN / CLOSE DRAWER ──────────────────────────────────────────────────

  const openDrawer = (protocol: MeetingProtocol) => {
    setSelectedProtocol(protocol)
    setEditForm({
      title: protocol.title, date: protocol.date,
      participants: protocol.participants, agenda: protocol.agenda,
      findings: protocol.findings, actions: protocol.actions,
    })
    setAttendance(protocol.attendance ?? [])
    setAgendaItems(protocol.agenda_items ?? [])
    setActiveTab('general')
    setExpandedItem(null)
    setIsDrawerOpen(true)
  }

  const closeDrawer = () => {
    setIsDrawerOpen(false)
    setTimeout(() => setSelectedProtocol(null), 300)
  }


  const isFinalized = selectedProtocol?.protocol_status === 'finalized'
  const isAdmin = user?.system_role === 'admin' || user?.system_role === 'superadmin'

  // ─── CREATE PROTOCOL ──────────────────────────────────────────────────────

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
      toast.error('Błąd podczas tworzenia', { id: toastId })
    }
    setIsSubmitting(false)
  }

  // ─── SAVE HELPERS ─────────────────────────────────────────────────────────

  const patchProtocol = async (patch: Record<string, unknown>) => {
    if (!selectedProtocol) return
    const { error } = await supabase
      .from('meeting_protocols')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', selectedProtocol.id)
    if (error) toast.error('Błąd zapisu')
    else await fetchProtocols()
    return !error
  }

  const handleSaveGeneral = async () => {
    setIsSaving(true)
    const ok = await patchProtocol({ ...editForm })
    if (ok) { toast.success('Zapisano!'); setSelectedProtocol(p => p ? { ...p, ...editForm } : p) }
    setIsSaving(false)
  }

  // ─── ATTENDANCE ───────────────────────────────────────────────────────────

  const saveAttendance = async (updated: AttendanceMember[]) => {
    setAttendance(updated)
    await patchProtocol({ attendance: updated })
  }

  const togglePresence = (memberId: string) => {
    if (isFinalized) return
    const updated = attendance.map(m => m.id === memberId ? { ...m, present: !m.present } : m)
    saveAttendance(updated)
  }

  const addAttendanceMember = async () => {
    if (!newAttendanceName.trim() || isFinalized) return
    const newMember: AttendanceMember = { id: crypto.randomUUID(), name: newAttendanceName.trim(), present: true }
    await saveAttendance([...attendance, newMember])
    setNewAttendanceName('')
  }

  const removeAttendanceMember = (memberId: string) => {
    if (isFinalized) return
    saveAttendance(attendance.filter(m => m.id !== memberId))
  }

  const prefillFromUsers = async () => {
    if (isFinalized) return
    const existing = new Set(attendance.map(m => m.name))
    const toAdd: AttendanceMember[] = allUsers
      .filter(u => !existing.has(`${u.first_name} ${u.last_name}`))
      .map(u => ({ id: crypto.randomUUID(), name: `${u.first_name} ${u.last_name}`, present: false }))
    if (!toAdd.length) { toast('Wszyscy już są na liście'); return }
    await saveAttendance([...attendance, ...toAdd])
    toast.success(`Dodano ${toAdd.length} osób`)
  }

  // ─── AGENDA ──────────────────────────────────────────────────────────────

  const saveAgenda = async (updated: AgendaItem[]) => {
    setAgendaItems(updated)
    await patchProtocol({ agenda_items: updated })
  }

  const addAgendaItem = async () => {
    if (!newAgendaTitle.trim() || isFinalized) return
    const item: AgendaItem = { id: crypto.randomUUID(), title: newAgendaTitle.trim(), notes: '' }
    const updated = [...agendaItems, item]
    await saveAgenda(updated)
    setNewAgendaTitle('')
    setExpandedItem(item.id)
  }

  const updateAgendaItem = async (itemId: string, patch: Partial<AgendaItem>) => {
    if (isFinalized) return
    const updated = agendaItems.map(it => it.id === itemId ? { ...it, ...patch } : it)
    await saveAgenda(updated)
  }

  const removeAgendaItem = async (itemId: string) => {
    if (isFinalized) return
    await saveAgenda(agendaItems.filter(it => it.id !== itemId))
  }

  // ─── FILE UPLOAD ─────────────────────────────────────────────────────────

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
      const { data: { publicUrl } } = supabase.storage.from('adminos-files').getPublicUrl(filePath)
      const { error: updateError } = await supabase.from('meeting_protocols')
        .update({ file_url: publicUrl, file_name: file.name, updated_at: new Date().toISOString() })
        .eq('id', selectedProtocol.id)
      if (updateError) throw updateError
      toast.success('Plik dołączony!', { id: toastId })
      setSelectedProtocol(p => p ? { ...p, file_url: publicUrl, file_name: file.name } : p)
      await fetchProtocols()
    } catch {
      toast.error('Błąd wgrywania', { id: toastId })
    } finally {
      setIsUploading(false)
    }
  }

  // ─── FINALIZE ────────────────────────────────────────────────────────────

  const handleFinalize = async () => {
    if (!selectedProtocol || isFinalized) return
    setIsFinalizing(true)
    const toastId = toast.loading('Zamykanie protokołu...')
    const { error } = await supabase.from('meeting_protocols')
      .update({ protocol_status: 'finalized', updated_at: new Date().toISOString() })
      .eq('id', selectedProtocol.id)
    if (!error) {
      toast.success('Protokół zamknięty!', { id: toastId })
      setSelectedProtocol(p => p ? { ...p, protocol_status: 'finalized' } : p)
      await fetchProtocols()
    } else {
      toast.error('Błąd', { id: toastId })
    }
    setIsFinalizing(false)
  }

  const presentCount = attendance.filter(m => m.present).length

  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar />
      <div className="flex-1 md:ml-64 p-8 pt-16 md:pt-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Zebrania</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Planuj zebrania, ustalaj porządek obrad, rejestruj obecność</p>
          </div>
          <button onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20">
            <Plus className="w-4 h-4" /> Nowe zebranie
          </button>
        </div>

        {/* List */}
        {loading ? (
          <SkeletonLoader variant="card" count={3} />
        ) : protocols.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <FileText className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-lg font-medium">Brak zebrań</p>
            <p className="text-sm mt-1">Kliknij &quot;Nowe zebranie&quot;, aby zaplanować pierwsze</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {protocols.map(protocol => {
              const present   = (protocol.attendance   ?? []).filter(m => m.present).length
              const totalAtt  = (protocol.attendance   ?? []).length
              const itemCount = (protocol.agenda_items ?? []).length
              return (
                <button key={protocol.id} onClick={() => openDrawer(protocol)}
                  className="text-left bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 hover:border-blue-300 dark:hover:border-blue-600 transition-all hover:shadow-md cursor-pointer">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm leading-snug line-clamp-2">{protocol.title}</h3>
                    {protocol.protocol_status === 'finalized' ? (
                      <span className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                        <Lock className="w-3 h-3" /> Zamknięty
                      </span>
                    ) : (
                      <span className="shrink-0 px-2 py-1 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Szkic</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{protocol.date}</p>
                  <div className="flex flex-wrap gap-3 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                    {totalAtt > 0 && <span className="flex items-center gap-1"><UserCheck size={11}/> {present}/{totalAtt}</span>}
                    {itemCount > 0 && <span className="flex items-center gap-1"><ClipboardList size={11}/> {itemCount} pkt</span>}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── MODAL: NOWE ZEBRANIE ─────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Nowe zebranie</h2>
              <button onClick={() => { setIsModalOpen(false); setForm(EMPTY_FORM) }}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tytuł</label>
                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Np. Posiedzenie Zarządu nr 12/2026" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setIsModalOpen(false); setForm(EMPTY_FORM) }}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">Anuluj</button>
                <button type="submit" disabled={isSubmitting || userLoading}
                  className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
                  {isSubmitting ? 'Tworzenie...' : 'Utwórz'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DRAWER ───────────────────────────────────────────────────────────── */}
      {isDrawerOpen && selectedProtocol && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={closeDrawer} />
          <div className="fixed right-0 top-0 h-full w-[560px] bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">

            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {isFinalized
                    ? <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"><Lock className="w-2.5 h-2.5"/>Zamknięty</span>
                    : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Szkic</span>
                  }
                  {attendance.length > 0 && (
                    <span className="text-[10px] font-bold text-slate-400"><UserCheck size={10} className="inline mr-0.5"/>{presentCount}/{attendance.length} obecnych</span>
                  )}
                </div>
                <h2 className="font-bold text-slate-900 dark:text-white text-base truncate">{selectedProtocol.title}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{selectedProtocol.date}</p>
              </div>
              <button onClick={closeDrawer} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0">
                <X className="w-5 h-5"/>
              </button>
            </div>

            {isFinalized && (
              <div className="mx-5 mt-3 px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs flex items-center gap-2 shrink-0">
                <Lock className="w-3 h-3 shrink-0"/> Protokół zamknięty — edycja zablokowana
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 shrink-0 px-4 pt-2">
              {TAB_CONFIG.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors mr-1 ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">

              {/* ── OGÓLNE ─────────────────────────────────────────────────── */}
              {activeTab === 'general' && (
                <div className="p-5 space-y-4">
                  {['title', 'date', 'agenda'].map(field => (
                    <div key={field}>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                        {field === 'title' ? 'Tytuł' : field === 'date' ? 'Data' : 'Notatki / agenda'}
                      </label>
                      {field === 'agenda' ? (
                        <textarea rows={3} value={editForm[field as keyof typeof editForm]}
                          onChange={e => setEditForm({ ...editForm, [field]: e.target.value })} disabled={isFinalized}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-60" />
                      ) : (
                        <input type={field === 'date' ? 'date' : 'text'} value={editForm[field as keyof typeof editForm]}
                          onChange={e => setEditForm({ ...editForm, [field]: e.target.value })} disabled={isFinalized || !isAdmin}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60" />
                      )}
                    </div>
                  ))}
                  {!isFinalized && (
                    <button onClick={handleSaveGeneral} disabled={isSaving}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50">
                      {isSaving ? 'Zapisywanie...' : 'Zapisz zmiany'}
                    </button>
                  )}
                </div>
              )}

              {/* ── OBECNOŚĆ ───────────────────────────────────────────────── */}
              {activeTab === 'attendance' && (
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">Lista obecności</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Obecnych: {presentCount} / {attendance.length}</p>
                    </div>
                    {!isFinalized && allUsers.length > 0 && (
                      <button onClick={prefillFromUsers} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
                        Wczytaj członków
                      </button>
                    )}
                  </div>

                  {attendance.length === 0 ? (
                    <p className="text-sm text-slate-400 italic text-center py-8">Brak uczestników. Dodaj lub wczytaj z systemu.</p>
                  ) : (
                    <div className="space-y-1">
                      {attendance.map(member => (
                        <div key={member.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 group">
                          <button onClick={() => togglePresence(member.id)} disabled={isFinalized}
                            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                              member.present ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 dark:border-slate-600'
                            }`}>
                            {member.present && <CheckCircle2 size={14}/>}
                          </button>
                          <span className={`flex-1 text-sm font-medium ${member.present ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                            {member.name}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${member.present ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                            {member.present ? 'OBECNY' : 'NIEOB.'}
                          </span>
                          {!isFinalized && (
                            <button onClick={() => removeAttendanceMember(member.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all">
                              <X size={14}/>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {!isFinalized && (
                    <div className="flex gap-2">
                      <input type="text" placeholder="Imię i nazwisko uczestnika..."
                        value={newAttendanceName} onChange={e => setNewAttendanceName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addAttendanceMember()}
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                      <button onClick={addAttendanceMember} disabled={!newAttendanceName.trim()}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-40">
                        <PlusCircle size={16}/>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── PORZĄDEK OBRAD ─────────────────────────────────────────────── */}
              {activeTab === 'agenda' && (
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">Punkty porządku obrad</h3>
                    <span className="text-[10px] text-slate-400">{agendaItems.length} pkt</span>
                  </div>

                  {agendaItems.length === 0 ? (
                    <p className="text-sm text-slate-400 italic text-center py-8">Brak punktów. Dodaj pierwszy poniżej.</p>
                  ) : (
                    <div className="space-y-3">
                      {agendaItems.map((item, idx) => {
                        const expanded     = expandedItem === item.id

                        return (
                          <div key={item.id} className="border rounded-2xl overflow-hidden border-slate-200 dark:border-slate-700">

                            {/* Item header */}
                            <div className="flex items-center gap-2 p-3.5 bg-slate-50 dark:bg-slate-800/50">
                              <span className="text-[11px] font-extrabold text-slate-400 w-5 shrink-0">{idx + 1}.</span>
                              <span className="flex-1 text-sm font-bold text-slate-900 dark:text-white">{item.title}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                {isAdmin && !isFinalized && (
                                  <button onClick={() => removeAgendaItem(item.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                                    <Trash2 size={12}/>
                                  </button>
                                )}
                                <button onClick={() => setExpandedItem(expanded ? null : item.id)} className="text-slate-400 p-1">
                                  {expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                                </button>
                              </div>
                            </div>

                            {/* Expanded */}
                            {expanded && (
                              <div className="p-4 space-y-4">

                                {/* NOTATKI / DECYZJA */}
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Ustalenia / decyzja</label>
                                  <textarea rows={3} value={item.notes}
                                    onChange={e => updateAgendaItem(item.id, { notes: e.target.value })}
                                    disabled={isFinalized}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-60"
                                    placeholder="Zapisz ustalenia lub podsumowanie punktu..."/>
                                </div>

                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {!isFinalized && (
                    <div className="flex gap-2 pt-1">
                      <input type="text" placeholder="Tytuł nowego punktu porządku..."
                        value={newAgendaTitle} onChange={e => setNewAgendaTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addAgendaItem()}
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                      <button onClick={addAgendaItem} disabled={!newAgendaTitle.trim()}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-40">
                        <PlusCircle size={16}/>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── PROTOKÓŁ ───────────────────────────────────────────────── */}
              {activeTab === 'protocol' && (
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Ustalenia ogólne</label>
                    <textarea rows={5} value={editForm.findings}
                      onChange={e => setEditForm({ ...editForm, findings: e.target.value })} disabled={isFinalized}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-60"
                      placeholder="Ogólne ustalenia posiedzenia..."/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Akcje do podjęcia</label>
                    <textarea rows={3} value={editForm.actions}
                      onChange={e => setEditForm({ ...editForm, actions: e.target.value })} disabled={isFinalized}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-60"
                      placeholder="Działania do podjęcia po zebraniu..."/>
                  </div>
                  {!isFinalized && (
                    <button onClick={handleSaveGeneral} disabled={isSaving}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm disabled:opacity-50">
                      {isSaving ? 'Zapisywanie...' : 'Zapisz protokół'}
                    </button>
                  )}

                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Plik protokołu</p>
                    {selectedProtocol?.file_url ? (
                      <FileLink href={selectedProtocol.file_url}
                        className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm hover:underline mb-2 cursor-pointer">
                        <Paperclip size={14}/> {selectedProtocol.file_name ?? 'Plik'}
                      </FileLink>
                    ) : (
                      <p className="text-xs text-slate-400 mb-2">Brak pliku</p>
                    )}
                    {!isFinalized && (
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400">
                        <UploadCloud size={16}/> {isUploading ? 'Wgrywanie...' : 'Dołącz plik'}
                        <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading}/>
                      </label>
                    )}
                  </div>

                  {!isFinalized && isAdmin && (
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                      <button onClick={handleFinalize} disabled={isFinalizing}
                        className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                        <Lock size={14}/> {isFinalizing ? 'Zamykanie...' : 'Zamknij i zablokuj protokół'}
                      </button>
                      <p className="text-xs text-slate-400 mt-2 text-center">Po zamknięciu protokół nie będzie mógł być edytowany.</p>
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
