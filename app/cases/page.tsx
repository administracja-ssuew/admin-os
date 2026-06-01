'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import Sidebar from '../../components/Sidebar'
import FilterBar, { FilterConfig } from '../../components/FilterBar'
import FileUpload from '../../components/FileUpload'
import ConfirmDialog from '../../components/ConfirmDialog'
import { logAudit } from '../../lib/audit'
import { sendNotification } from '../../lib/notify'
import {
  Briefcase, Plus, FileText, Link as LinkIcon, X, Clock, User,
  Building2, Send, Loader2, Shield, Paperclip, ChevronLeft,
  ChevronRight, Trash2, Edit2, Check, ChevronDown, ArrowRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Case, CaseComment, AppUser, Department } from '../../types'

const CASE_TYPES = ['Administracyjna', 'Finansowa', 'Prawna', 'Kadrowa', 'Logistyczna', 'Inna']

export default function CasesPage() {
  const { user: currentUser, isAdmin } = useCurrentUser()

  const [cases, setCases] = useState<Case[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedCase, setSelectedCase] = useState<Case | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [credSignature, setCredSignature] = useState('')

  const [comments, setComments] = useState<CaseComment[]>([])
  const [auditEvents, setAuditEvents] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [isSendingComment, setIsSendingComment] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingCommentText, setEditingCommentText] = useState('')
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: '', description: '', case_type: 'Administracyjna',
    confidentiality_level: 'internal', owner_id: '', department_id: ''
  })

  // Filtry
  const [filterValues, setFilterValues] = useState<Record<string, string>>({
    search: '', status: '', case_type: '', department_id: '', owner_id: '', date_from: '', date_to: ''
  })

  // Potwierdzenie usunięcia sprawy
  const [deleteCaseId, setDeleteCaseId] = useState<string | null>(null)

  // Zmiana statusu w drawerze
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false)

  useEffect(() => {
    fetchData()
    const channel = supabase
      .channel('cases-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cases' }, () => fetchData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const fetchData = async () => {
    const [casesRes, usersRes, deptsRes] = await Promise.all([
      supabase.from('cases').select('*, users(first_name, last_name), departments(name)').order('created_at', { ascending: false }),
      supabase.from('users').select('*').in('system_role', ['active', 'member', 'admin', 'superadmin']).order('first_name'),
      supabase.from('departments').select('*').order('name'),
    ])
    if (casesRes.data) setCases(casesRes.data as Case[])
    if (usersRes.data) setUsers(usersRes.data as AppUser[])
    if (deptsRes.data) setDepartments(deptsRes.data as Department[])
    setLoading(false)
  }

  const openCaseDetails = async (c: Case) => {
    setSelectedCase(c)
    setCredSignature(c.cred_signature || '')
    setIsDrawerOpen(true)
    setEditingCommentId(null)
    fetchComments(c.id)
    fetchAuditEvents(c.id)
  }

  const fetchComments = async (caseId: string) => {
    const { data } = await supabase
      .from('case_comments').select('*, users(first_name, last_name)')
      .eq('case_id', caseId).order('created_at', { ascending: true })
    if (data) setComments(data)
  }

  const fetchAuditEvents = async (caseId: string) => {
    const { data } = await supabase
      .from('audit_log')
      .select('*')
      .eq('entity_type', 'case')
      .eq('entity_id', caseId)
      .order('created_at', { ascending: true })
    if (data) setAuditEvents(data)
  }

  const saveCredSignature = async () => {
    if (!selectedCase) return
    const toastId = toast.loading('Zapisywanie sygnatury...')
    const { error } = await supabase.from('cases').update({ cred_signature: credSignature }).eq('id', selectedCase.id)
    if (!error) { toast.success('Sygnatura CRED zaktualizowana!', { id: toastId }); fetchData() }
    else toast.error('Błąd zapisu', { id: toastId })
  }

  const updateCaseStatus = async (newStatus: string) => {
    if (!selectedCase || !currentUser) return
    const oldStatus = selectedCase.status
    const { error } = await supabase.from('cases').update({ status: newStatus }).eq('id', selectedCase.id)
    if (!error) {
      setSelectedCase({ ...selectedCase, status: newStatus as any })
      setStatusDropdownOpen(false)
      toast.success(`Status zmieniony na: ${statusLabel(newStatus)}`)
      await logAudit({ userId: currentUser.id, action: 'case.status_change', entityType: 'case', entityId: selectedCase.id, oldValue: { status: oldStatus }, newValue: { status: newStatus } })
      fetchAuditEvents(selectedCase.id)
      // Powiadomienie do właściciela sprawy
      if (selectedCase.owner_id && selectedCase.owner_id !== currentUser.id) {
        const owner = users.find(u => u.id === selectedCase.owner_id)
        sendNotification('case_status_changed', {
          caseNumber: selectedCase.case_number,
          caseTitle: selectedCase.title,
          oldStatus,
          newStatus,
          ownerId: selectedCase.owner_id,
          ownerEmail: owner?.email,
        })
      }
      fetchData()
    } else toast.error('Błąd zmiany statusu')
  }

  const reassignCase = async (newOwnerId: string) => {
    if (!selectedCase || !currentUser) return
    const newOwner = users.find(u => u.id === newOwnerId)
    const { error } = await supabase.from('cases').update({ owner_id: newOwnerId || null }).eq('id', selectedCase.id)
    if (!error) {
      setSelectedCase({ ...selectedCase, owner_id: newOwnerId, users: newOwner ? { first_name: newOwner.first_name, last_name: newOwner.last_name } : null })
      setOwnerDropdownOpen(false)
      toast.success('Sprawa przepisana')
      await logAudit({ userId: currentUser.id, action: 'case.reassign', entityType: 'case', entityId: selectedCase.id, newValue: { owner_id: newOwnerId } })
      fetchData()
    } else toast.error('Błąd przepisywania')
  }

  const deleteCase = async () => {
    if (!deleteCaseId || !currentUser) return
    await supabase.from('case_comments').delete().eq('case_id', deleteCaseId)
    const { error } = await supabase.from('cases').delete().eq('id', deleteCaseId)
    if (!error) {
      toast.success('Sprawa usunięta')
      await logAudit({ userId: currentUser.id, action: 'case.delete', entityType: 'case', entityId: deleteCaseId })
      setDeleteCaseId(null)
      setIsDrawerOpen(false)
      fetchData()
    } else toast.error('Błąd usuwania')
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !selectedCase || !currentUser) return
    setIsSendingComment(true)
    const { error } = await supabase.from('case_comments').insert([{ case_id: selectedCase.id, user_id: currentUser.id, content: newComment }])
    if (!error) {
      setNewComment(''); fetchComments(selectedCase.id)
      // Powiadomienie do właściciela (jeśli inny niż komentujący)
      if (selectedCase.owner_id && selectedCase.owner_id !== currentUser.id) {
        const owner = users.find(u => u.id === selectedCase.owner_id)
        sendNotification('case_comment', {
          caseNumber: selectedCase.case_number,
          caseTitle: selectedCase.title,
          commentAuthor: `${currentUser.first_name} ${currentUser.last_name}`,
          ownerId: selectedCase.owner_id,
          ownerEmail: owner?.email,
        })
      }
    }
    setIsSendingComment(false)
  }

  const handleUpdateComment = async (commentId: string) => {
    if (!editingCommentText.trim()) return
    const { error } = await supabase.from('case_comments').update({ content: editingCommentText }).eq('id', commentId)
    if (!error) {
      setEditingCommentId(null)
      if (selectedCase) fetchComments(selectedCase.id)
      toast.success('Komentarz zaktualizowany')
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase.from('case_comments').delete().eq('id', commentId)
    if (!error) {
      setDeleteCommentId(null)
      if (selectedCase) fetchComments(selectedCase.id)
    }
  }

  const handleFileUpload = (file: { id: string; name: string; url: string; added_at: string }) => {
    if (!selectedCase) return
    const updatedAttachments = [...(selectedCase.attachments || []), file]
    supabase.from('cases').update({ attachments: updatedAttachments }).eq('id', selectedCase.id).then(({ error }) => {
      if (!error) {
        setSelectedCase({ ...selectedCase, attachments: updatedAttachments })
        toast.success('Plik dodany do akt')
        fetchData()
      }
    })
  }

  const handleAddCase = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    const currentYear = new Date().getFullYear()
    const { data: lastCase } = await supabase
      .from('cases')
      .select('case_number')
      .ilike('case_number', `SPR/${currentYear}/%`)
      .order('created_at', { ascending: false })
      .limit(1)
    let nextNum = 1
    if (lastCase && lastCase.length > 0) {
      const parsed = parseInt(lastCase[0].case_number.split('/')[2])
      if (!isNaN(parsed)) nextNum = parsed + 1
    }
    const caseNumber = `SPR/${currentYear}/${nextNum}`
    const { error } = await supabase.from('cases').insert([{
      title: formData.title,
      description: formData.description || null,
      case_type: formData.case_type,
      confidentiality_level: formData.confidentiality_level,
      owner_id: formData.owner_id || currentUser?.id,
      department_id: formData.department_id || null,
      case_number: caseNumber,
      status: 'new',
      attachments: []
    }])
    if (!error) {
      setFormData({ title: '', description: '', case_type: 'Administracyjna', confidentiality_level: 'internal', owner_id: '', department_id: '' })
      setIsModalOpen(false)
      fetchData()
      toast.success('Sprawa zarejestrowana')
    } else toast.error('Błąd rejestracji sprawy')
    setIsSubmitting(false)
  }

  const statusLabel = (s: string) => ({ new: 'Nowa', in_progress: 'W toku', closed: 'Zamknięta' }[s] || s)

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      new: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      in_progress: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
      closed: 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700'
    }
    return (
      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${styles[status] || styles.new}`}>
        {statusLabel(status)}
      </span>
    )
  }

  // Filtry
  const filterConfigs: FilterConfig[] = [
    { key: 'search', label: 'Szukaj', type: 'search', placeholder: 'Szukaj po nazwie lub sygnaturze...' },
    { key: 'status', label: 'Status', type: 'select', options: [{ value: 'new', label: 'Nowa' }, { value: 'in_progress', label: 'W toku' }, { value: 'closed', label: 'Zamknięta' }] },
    { key: 'case_type', label: 'Typ sprawy', type: 'select', options: CASE_TYPES.map(t => ({ value: t, label: t })) },
    { key: 'department_id', label: 'Pion', type: 'select', options: departments.map(d => ({ value: d.id, label: d.name })) },
    { key: 'date_from', label: 'Od', type: 'date' },
    { key: 'date_to', label: 'Do', type: 'date' },
  ]

  const filteredCases = cases.filter(c => {
    const q = filterValues.search.toLowerCase()
    if (q && !(c.title || '').toLowerCase().includes(q) && !(c.case_number || '').toLowerCase().includes(q)) return false
    if (filterValues.status && c.status !== filterValues.status) return false
    if (filterValues.case_type && c.case_type !== filterValues.case_type) return false
    if (filterValues.department_id && c.department_id !== filterValues.department_id) return false
    if (filterValues.date_from && c.created_at < filterValues.date_from) return false
    if (filterValues.date_to && c.created_at.split('T')[0] > filterValues.date_to) return false
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / PAGE_SIZE))
  const pagedCases = filteredCases.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <Sidebar />

      <div className="flex-1 md:ml-64 p-8 pt-16 md:pt-8 flex flex-col h-screen">

        <div className="flex justify-between items-center mb-6 shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <Briefcase className="text-blue-600 dark:text-blue-500" size={32} /> Rejestr Spraw
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">{filteredCases.length} spraw · Główny obieg dokumentów</p>
          </div>
          {isAdmin && (
            <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-500/30 transition-all">
              <Plus size={20} /> Nowa Sprawa
            </button>
          )}
        </div>

        {/* Filtry */}
        <div className="mb-4 shrink-0">
          <FilterBar
            filters={filterConfigs}
            values={filterValues}
            onChange={(key, val) => { setFilterValues(prev => ({ ...prev, [key]: val })); setPage(1) }}
            onClear={() => { setFilterValues({ search: '', status: '', case_type: '', department_id: '', owner_id: '', date_from: '', date_to: '' }); setPage(1) }}
          />
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 size={32} className="animate-spin text-blue-500" />
            </div>
          ) : pagedCases.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
              <Briefcase size={32} />
              <p className="font-bold">Brak spraw spełniających kryteria</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Sygnatury</th>
                  <th className="px-6 py-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Przedmiot Sprawy</th>
                  <th className="px-6 py-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Odpowiedzialność</th>
                  <th className="px-6 py-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {pagedCases.map(c => (
                  <tr key={c.id} onClick={() => openCaseDetails(c)} className="hover:bg-blue-50/50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group">
                    <td className="px-6 py-4">
                      <div className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 inline-block px-2 py-1 rounded mb-1">{c.case_number}</div>
                      {c.cred_signature
                        ? <div className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400"><LinkIcon size={10} /> {c.cred_signature}</div>
                        : <div className="text-[10px] text-slate-400 italic">Brak CRED</div>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-2">
                        {c.confidentiality_level === 'board_only' && <Shield size={14} className="text-red-500" />}
                        {c.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate max-w-xs">
                        {c.source === 'Formularz Zewnętrzny' ? '📥 Wpłynęło z Biura Podawczego' : c.case_type}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-0.5">
                        <User size={14} className="text-slate-400" /> {c.users ? `${c.users.first_name} ${c.users.last_name}` : 'Nieprzypisana'}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <Building2 size={12} className="text-slate-400" /> {c.departments ? c.departments.name : 'Ogólne'}
                      </div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(c.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginacja */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 shrink-0">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Strona {page} z {totalPages} · {filteredCases.length} spraw</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors shadow-sm"><ChevronLeft size={16} /></button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors shadow-sm"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Overlay */}
      {isDrawerOpen && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40" onClick={() => setIsDrawerOpen(false)} />}

      {/* Drawer */}
      <div className={`fixed top-0 right-0 h-full w-[580px] bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-all duration-300 ease-in-out flex flex-col border-l border-slate-200 dark:border-slate-800 ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedCase && (
          <>
            {/* Nagłówek drawera */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
              <div className="flex justify-between items-start mb-3">
                <div className="flex gap-2 items-center flex-wrap">
                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded border border-blue-200 dark:border-blue-800">{selectedCase.case_number}</span>
                  {getStatusBadge(selectedCase.status)}
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button onClick={() => setDeleteCaseId(selectedCase.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                      <Trash2 size={16} />
                    </button>
                  )}
                  <button onClick={() => setIsDrawerOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white p-1 bg-white dark:bg-slate-800 rounded-full shadow-sm"><X size={20} /></button>
                </div>
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight mb-2">{selectedCase.title}</h2>

              {/* Zmiana statusu + właściciel — tylko admin */}
              {isAdmin && (
                <div className="mt-3 flex gap-2 flex-wrap">
                  {/* Dropdown statusu */}
                  <div className="relative">
                    <button
                      onClick={() => { setStatusDropdownOpen(!statusDropdownOpen); setOwnerDropdownOpen(false) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-blue-400 transition-colors"
                    >
                      Zmień status <ChevronDown size={12} />
                    </button>
                    {statusDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 w-44 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-10 overflow-hidden">
                        {['new', 'in_progress', 'closed'].map(s => (
                          <button key={s} onClick={() => updateCaseStatus(s)}
                            className={`w-full text-left px-4 py-2.5 text-sm font-bold transition-colors hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center justify-between ${selectedCase.status === s ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                            {statusLabel(s)}
                            {selectedCase.status === s && <Check size={14} />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Dropdown właściciela */}
                  <div className="relative">
                    <button
                      onClick={() => { setOwnerDropdownOpen(!ownerDropdownOpen); setStatusDropdownOpen(false) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-blue-400 transition-colors"
                    >
                      Przepisz <ChevronDown size={12} />
                    </button>
                    {ownerDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-10 overflow-hidden max-h-48 overflow-y-auto">
                        {users.map(u => (
                          <button key={u.id} onClick={() => reassignCase(u.id)}
                            className={`w-full text-left px-4 py-2.5 text-sm font-bold transition-colors hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center justify-between ${selectedCase.owner_id === u.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                            {u.first_name} {u.last_name}
                            {selectedCase.owner_id === u.id && <Check size={14} />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50 dark:bg-slate-900 flex flex-col gap-5">

              {/* Treść wniosku */}
              {selectedCase.description && (
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><FileText size={14} /> Treść wniosku</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{selectedCase.description}</p>
                </div>
              )}

              {/* Akta sprawy — upload plików */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Paperclip size={14} /> Akta Sprawy</h3>
                <div className="space-y-2 mb-3">
                  {(!selectedCase.attachments || selectedCase.attachments.length === 0) ? (
                    <p className="text-xs text-slate-400 italic">Brak podpiętych dokumentów.</p>
                  ) : (
                    selectedCase.attachments.map((att: any) => (
                      <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-700 transition-colors group">
                        <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0"><FileText size={14} /></div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors truncate">{att.name}</span>
                      </a>
                    ))
                  )}
                </div>
                <FileUpload
                  bucketPath={`cases/${selectedCase.id}`}
                  onUploadComplete={handleFileUpload}
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  label="Dodaj plik do akt"
                />
              </div>

              {/* Integracja CRED — tylko admin */}
              {isAdmin && (
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><LinkIcon size={14} /> Integracja CRED (Zarząd)</h3>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Wklej sygnaturę z CRED..." className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm font-mono text-slate-900 dark:text-white" value={credSignature} onChange={(e) => setCredSignature(e.target.value)} />
                    <button onClick={saveCredSignature} className="px-4 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600 text-white text-sm font-bold rounded-xl transition-colors">Zapisz</button>
                  </div>
                </div>
              )}

              {/* Oś czasu z komentarzami */}
              <div>
                <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Clock size={14} /> Oś Czasu i Notatki Operacyjne</h3>
                <div className="space-y-4">

                  {/* Otwarcie sprawy */}
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0"><Briefcase size={14} /></div>
                    <div className="flex-1 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">Otwarcie sprawy</span>
                        <time className="font-mono text-[10px] text-slate-400">{new Date(selectedCase.created_at).toLocaleDateString('pl-PL')}</time>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Sprawa wpłynęła do systemu.</p>
                    </div>
                  </div>

                  {/* Zdarzenia z audit_log (zmiany statusu, etc.) i komentarze — posortowane chronologicznie */}
                  {[
                    ...auditEvents.map(e => ({ type: 'audit' as const, date: e.created_at, data: e })),
                    ...comments.map(c => ({ type: 'comment' as const, date: c.created_at, data: c })),
                  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(item => {
                    if (item.type === 'audit') {
                      const e = item.data
                      const oldS = e.old_value?.status
                      const newS = e.new_value?.status
                      return (
                        <div key={e.id} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0"><ArrowRight size={14} /></div>
                          <div className="flex-1 bg-white dark:bg-slate-800 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30 shadow-sm">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-slate-900 dark:text-white text-sm">Zmiana statusu</span>
                              <time className="font-mono text-[10px] text-slate-400">{new Date(e.created_at).toLocaleDateString('pl-PL')}</time>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {oldS && newS ? <><span className="font-semibold">{statusLabel(oldS)}</span> → <span className="font-semibold text-blue-600 dark:text-blue-400">{statusLabel(newS)}</span></> : statusLabel(newS ?? '')}
                            </p>
                          </div>
                        </div>
                      )
                    }
                    const comment = item.data
                    const isOwner = comment.user_id === currentUser?.id
                    const canEdit = isOwner || isAdmin
                    return (
                      <div key={comment.id} className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0 font-bold text-xs border border-slate-200 dark:border-slate-700">
                          {comment.users ? `${comment.users.first_name.charAt(0)}${comment.users.last_name.charAt(0)}` : '?'}
                        </div>
                        <div className="flex-1 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-slate-900 dark:text-white text-sm">
                              {comment.users ? `${comment.users.first_name} ${comment.users.last_name}` : 'Nieznany'}
                            </span>
                            <div className="flex items-center gap-2">
                              <time className="font-mono text-[10px] text-slate-400">{new Date(comment.created_at).toLocaleDateString('pl-PL')}</time>
                              {canEdit && editingCommentId !== comment.id && (
                                <div className="flex gap-1">
                                  {isOwner && (
                                    <button onClick={() => { setEditingCommentId(comment.id); setEditingCommentText(comment.content) }} className="p-1 text-slate-400 hover:text-blue-500 rounded transition-colors"><Edit2 size={12} /></button>
                                  )}
                                  <button onClick={() => setDeleteCommentId(comment.id)} className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"><Trash2 size={12} /></button>
                                </div>
                              )}
                            </div>
                          </div>
                          {editingCommentId === comment.id ? (
                            <div className="flex gap-2">
                              <input
                                className="flex-1 text-sm px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-white"
                                value={editingCommentText}
                                onChange={e => setEditingCommentText(e.target.value)}
                                autoFocus
                              />
                              <button onClick={() => handleUpdateComment(comment.id)} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Check size={14} /></button>
                              <button onClick={() => setEditingCommentId(null)} className="p-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-300"><X size={14} /></button>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{comment.content}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Dodaj komentarz */}
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input type="text" placeholder="Dodaj notatkę operacyjną..." className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none text-sm text-slate-900 dark:text-white" value={newComment} onChange={(e) => setNewComment(e.target.value)} />
                <button type="submit" disabled={isSendingComment || !newComment.trim()} className="px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors flex items-center justify-center">
                  {isSendingComment ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* Modal tworzenia sprawy */}
      {isModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Otwórz nową sprawę</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddCase} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Przedmiot sprawy *</label>
                <input type="text" required autoFocus className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Opis</label>
                <textarea rows={3} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white resize-none" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Typ sprawy</label>
                  <select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={formData.case_type} onChange={(e) => setFormData({ ...formData, case_type: e.target.value })}>
                    {CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Poufność</label>
                  <select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={formData.confidentiality_level} onChange={(e) => setFormData({ ...formData, confidentiality_level: e.target.value })}>
                    <option value="internal">Wewnętrzna</option>
                    <option value="board_only">Tylko Zarząd</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Przypisz do osoby</label>
                  <select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={formData.owner_id} onChange={(e) => setFormData({ ...formData, owner_id: e.target.value })}>
                    <option value="">Ja ({currentUser?.first_name})</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Pion</label>
                  <select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={formData.department_id} onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}>
                    <option value="">Ogólne</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full py-4 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : 'Zarejestruj sprawę'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Potwierdzenie usunięcia sprawy */}
      <ConfirmDialog
        isOpen={!!deleteCaseId}
        title="Usunąć sprawę?"
        description="Tej operacji nie można cofnąć. Zostaną usunięte również wszystkie komentarze do tej sprawy."
        confirmLabel="Usuń sprawę"
        onConfirm={deleteCase}
        onCancel={() => setDeleteCaseId(null)}
      />

      {/* Potwierdzenie usunięcia komentarza */}
      <ConfirmDialog
        isOpen={!!deleteCommentId}
        title="Usunąć komentarz?"
        confirmLabel="Usuń"
        onConfirm={() => deleteCommentId && handleDeleteComment(deleteCommentId)}
        onCancel={() => setDeleteCommentId(null)}
      />
    </div>
  )
}
