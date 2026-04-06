'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/audit'
import { useCases } from '../../hooks/useCases'
import ConfirmDialog from '../ConfirmDialog'
import SkeletonLoader from '../SkeletonLoader'
import EmptyState from '../EmptyState'
import toast from 'react-hot-toast'
import {
  Plus, Loader2, FileText, FolderClosed, BookOpen, Send,
  Paperclip, UploadCloud, Trash2, X, ExternalLink, Activity, Search, Phone, Pencil, Check,
} from 'lucide-react'
import Link from 'next/link'
import type { ArchiveFolder, Petition, AppUser, CaseAttachment, Case, CaseStatus, FolderType } from '../../types'

// ─── TYPY LOKALNE ────────────────────────────────────────────────────────────
interface DeptMember {
  id: string
  first_name: string
  last_name: string
}

// ─── PROPS ───────────────────────────────────────────────────────────────────
export interface ArchivingPanelProps {
  archiveFolders: ArchiveFolder[]
  petitions: Petition[]
  members: DeptMember[]
  currentUser: AppUser | null
  isAdmin: boolean
  loading?: boolean
  onRefetch: () => Promise<void>
}

// ─── KOMPONENT ───────────────────────────────────────────────────────────────
export function ArchivingPanel({
  archiveFolders,
  petitions,
  members,
  currentUser,
  isAdmin,
  loading = false,
  onRefetch,
}: ArchivingPanelProps) {
  // Stan: zakładki
  const [activeTab, setActiveTab] = useState<'folders' | 'cases'>('folders')

  // Hook spraw
  const { cases, loading: casesLoading, refetch: refetchCases } = useCases()

  // Stany: teczki archiwalne
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false)
  const [isSubmittingArchive, setIsSubmittingArchive] = useState(false)
  const [archiveForm, setArchiveForm] = useState({
    title: '',
    status: 'W przygotowaniu',
    notes: '',
    folder_type: 'general' as FolderType,
    contact_name: '',
    contact_info: '',
  })
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [assignSearch, setAssignSearch] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<ArchiveFolder | null>(null)
  const [isFolderDrawerOpen, setIsFolderDrawerOpen] = useState(false)
  const [isFolderEditing, setIsFolderEditing] = useState(false)
  const [folderEditForm, setFolderEditForm] = useState({ title: '', contact_name: '', contact_info: '' })
  const [isSavingFolder, setIsSavingFolder] = useState(false)

  // Stany: podania
  const [isPetitionModalOpen, setIsPetitionModalOpen] = useState(false)
  const [isSubmittingPetition, setIsSubmittingPetition] = useState(false)
  const [petitionForm, setPetitionForm] = useState({
    title: '',
    recipient: '',
    submission_date: '',
    status: 'Złożone',
  })
  const [selectedPetition, setSelectedPetition] = useState<Petition | null>(null)
  const [isPetitionDrawerOpen, setIsPetitionDrawerOpen] = useState(false)

  // Stan: upload pliku
  const [isUploading, setIsUploading] = useState(false)

  // ─── MUTACJE: TECZKI ──────────────────────────────────────────
  const handleAddArchiveFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingArchive(true)
    await supabase.from('archive_folders').insert([archiveForm])
    toast.success('Teczka utworzona!')
    setIsArchiveModalOpen(false)
    setArchiveForm({ title: '', status: 'W przygotowaniu', notes: '', folder_type: 'general', contact_name: '', contact_info: '' })
    await onRefetch()
    setIsSubmittingArchive(false)
  }

  const updateArchiveStatus = async (id: string, newStatus: string) => {
    if (!currentUser) return
    const folder = archiveFolders.find(f => f.id === id)
    const oldStatus = folder?.status ?? null
    await supabase.from('archive_folders').update({ status: newStatus }).eq('id', id)
    await logAudit({
      userId: currentUser.id,
      action: 'STATUS_CHANGED',
      entityType: 'archive_folder',
      entityId: id,
      oldValue: oldStatus ? { status: oldStatus } : null,
      newValue: { status: newStatus },
    })
    await onRefetch()
  }

  const deleteArchiveFolder = async (id: string) => {
    const toastId = toast.loading('Usuwanie...')
    await supabase.from('archive_folders').delete().eq('id', id)
    setIsFolderDrawerOpen(false)
    await onRefetch()
    toast.success('Usunięto', { id: toastId })
  }

  const saveFolderEdit = async () => {
    if (!selectedFolder) return
    setIsSavingFolder(true)
    const { error } = await supabase.from('archive_folders').update({
      title: folderEditForm.title,
      contact_name: folderEditForm.contact_name || null,
      contact_info: folderEditForm.contact_info || null,
    }).eq('id', selectedFolder.id)
    if (!error) {
      const updated = { ...selectedFolder, ...folderEditForm, contact_name: folderEditForm.contact_name || null, contact_info: folderEditForm.contact_info || null }
      setSelectedFolder(updated)
      setIsFolderEditing(false)
      toast.success('Teczka zaktualizowana!')
      await onRefetch()
    } else {
      toast.error('Błąd zapisu')
    }
    setIsSavingFolder(false)
  }

  // ─── MUTACJE: PODANIA ─────────────────────────────────────────
  const handleAddPetition = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingPetition(true)
    await supabase.from('petitions').insert([{
      ...petitionForm,
      submission_date: petitionForm.submission_date || new Date().toISOString().split('T')[0],
    }])
    toast.success('Podanie dodane do rejestru!')
    setIsPetitionModalOpen(false)
    setPetitionForm({ title: '', recipient: '', submission_date: '', status: 'Złożone' })
    await onRefetch()
    setIsSubmittingPetition(false)
  }

  const updatePetitionStatus = async (id: string, newStatus: string) => {
    await supabase.from('petitions').update({ status: newStatus }).eq('id', id)
    await onRefetch()
    if (selectedPetition && selectedPetition.id === id) {
      setSelectedPetition({ ...selectedPetition, status: newStatus as Petition['status'] })
    }
  }

  const deletePetition = async (id: string) => {
    const toastId = toast.loading('Usuwanie...')
    await supabase.from('petitions').delete().eq('id', id)
    setIsPetitionDrawerOpen(false)
    await onRefetch()
    toast.success('Usunięto', { id: toastId })
  }

  // ─── UPLOAD PLIKU (AiKB) ──────────────────────────────────────
  const handleAiKBUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    recordId: string,
    table: 'archive_folders' | 'petitions',
    currentRecord: ArchiveFolder | Petition,
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    const toastId = toast.loading('Wrzucanie pliku na serwer...')
    try {
      // Odpolszczacz — zamienia polskie znaki na standardowe, spacje na podkreślenia
      const safeFileName = file.name
        .replace(/ą/g, 'a').replace(/Ą/g, 'A')
        .replace(/ć/g, 'c').replace(/Ć/g, 'C')
        .replace(/ę/g, 'e').replace(/Ę/g, 'E')
        .replace(/ł/g, 'l').replace(/Ł/g, 'L')
        .replace(/ń/g, 'n').replace(/Ń/g, 'N')
        .replace(/ó/g, 'o').replace(/Ó/g, 'O')
        .replace(/ś/g, 's').replace(/Ś/g, 'S')
        .replace(/ź/g, 'z').replace(/Ź/g, 'Z')
        .replace(/ż/g, 'z').replace(/Ż/g, 'Z')
        .replace(/[^a-zA-Z0-9.\-_]/g, '_')

      const filePath = `aikb/${table}/${recordId}/${crypto.randomUUID()}/${safeFileName}`

      const { error: uploadError } = await supabase.storage
        .from('adminos-files')
        .upload(filePath, file, { contentType: file.type })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('adminos-files').getPublicUrl(filePath)

      const newAttachment: CaseAttachment = {
        id: crypto.randomUUID(),
        name: file.name,
        url: data.publicUrl,
        added_at: new Date().toISOString(),
      }
      const updatedAttachments = [...(currentRecord.attachments || []), newAttachment]

      const { error: updateError } = await supabase
        .from(table)
        .update({ attachments: updatedAttachments })
        .eq('id', recordId)
      if (updateError) throw updateError

      if (table === 'archive_folders' && selectedFolder) {
        setSelectedFolder({ ...selectedFolder, attachments: updatedAttachments })
      }
      if (table === 'petitions' && selectedPetition) {
        setSelectedPetition({ ...selectedPetition, attachments: updatedAttachments })
      }

      await onRefetch()
      toast.success('Dokument podpięty!', { id: toastId })
    } catch (error) {
      toast.error('Błąd podczas wgrywania pliku', { id: toastId })
      console.error(error)
    } finally {
      setIsUploading(false)
    }
  }

  // ─── DERIVED: SPRAWY DZIAŁU ──────────────────────────────────
  const deptCases = cases.filter(c => c.department_id === currentUser?.department_id)

  const assignCase = async (caseId: string) => {
    await supabase.from('cases').update({ department_id: currentUser?.department_id }).eq('id', caseId)
    setIsAssignModalOpen(false)
    setAssignSearch('')
    await refetchCases()
  }

  const unassignCase = async (caseId: string) => {
    await supabase.from('cases').update({ department_id: null }).eq('id', caseId)
    await refetchCases()
  }

  const caseColumns: { id: CaseStatus; title: string; color: string; textColor: string }[] = [
    { id: 'new', title: 'Nowe', color: 'bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50', textColor: 'text-slate-600 dark:text-slate-400' },
    { id: 'in_progress', title: 'W Toku', color: 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/50', textColor: 'text-blue-700 dark:text-blue-400' },
    { id: 'closed', title: 'Zamknięte', color: 'bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/50', textColor: 'text-green-700 dark:text-green-500' },
  ]

  // ─── HELPERS ─────────────────────────────────────────────────────
  const getFolderTypeBadge = (folderType: FolderType) => {
    if (folderType === 'project_report') {
      return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">Raport projektowy</span>
    }
    return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">Ogólna</span>
  }

  // ─── JSX ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      {/* Zakładki */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('folders')}
          className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 -mb-px ${
            activeTab === 'folders'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Foldery i Podania
        </button>
        <button
          onClick={() => setActiveTab('cases')}
          className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 -mb-px ${
            activeTab === 'cases'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Sprawy
        </button>
      </div>

      {/* Zawartość zakładki Sprawy — Kanban */}
      {activeTab === 'cases' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Sprawy przypisane do podkomisji</h2>
            {isAdmin && (
              <button
                onClick={() => setIsAssignModalOpen(true)}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
              >
                <Plus size={14} /> Przypisz sprawę
              </button>
            )}
          </div>
          {casesLoading ? (
            <SkeletonLoader variant="kanban-column" count={3} />
          ) : deptCases.length === 0 ? (
            <EmptyState title="Brak przypisanych spraw" description="Przypisz sprawy z Rejestru Spraw do tej podkomisji" actionLabel={isAdmin ? "Przypisz sprawę" : undefined} onAction={isAdmin ? () => setIsAssignModalOpen(true) : undefined} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {caseColumns.map(col => {
                const colCases = deptCases.filter(c => c.status === col.id)
                return (
                  <div key={col.id} className={`rounded-xl p-3 ${col.color}`}>
                    <div className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center justify-between ${col.textColor}`}>
                      <span>{col.title}</span>
                      <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-400">{colCases.length}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {colCases.map(c => (
                        <div
                          key={c.id}
                          className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm group relative"
                        >
                          {isAdmin && (
                            <button
                              onClick={() => unassignCase(c.id)}
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                              title="Odepnij sprawę"
                            >
                              <X size={12}/>
                            </button>
                          )}
                          <div className="flex items-center justify-between mb-1 pr-4">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider">{c.case_number}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-bold">{c.case_type}</span>
                          </div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{c.title}</p>
                          {c.users && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {c.users.first_name} {c.users.last_name}
                            </p>
                          )}
                        </div>
                      ))}
                      {colCases.length === 0 && (
                        <p className="text-xs text-slate-400 dark:text-slate-600 text-center py-4">Brak spraw</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Modal: przypisz sprawę */}
          {isAssignModalOpen && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="font-bold text-slate-900 dark:text-white">Przypisz sprawę do podkomisji</h3>
                  <button onClick={() => { setIsAssignModalOpen(false); setAssignSearch('') }} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                    <X size={20}/>
                  </button>
                </div>
                <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input
                      type="text"
                      placeholder="Szukaj po numerze lub tytule..."
                      value={assignSearch}
                      onChange={e => setAssignSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
                  {cases
                    .filter(c => c.department_id !== currentUser?.department_id)
                    .filter(c => !assignSearch || c.title.toLowerCase().includes(assignSearch.toLowerCase()) || c.case_number.toLowerCase().includes(assignSearch.toLowerCase()))
                    .map(c => (
                      <button
                        key={c.id}
                        onClick={() => assignCase(c.id)}
                        className="w-full text-left p-3 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        <div className="font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold">{c.case_number}</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">{c.title}</div>
                        {c.departments && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Przypisana do: {c.departments.name}</div>
                        )}
                      </button>
                    ))
                  }
                  {cases.filter(c => c.department_id !== currentUser?.department_id).length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-8">Brak dostępnych spraw</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Zawartość zakładki Foldery i Podania */}
      {activeTab === 'folders' && (
      <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Systemy i operacje */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors softly-lifted">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
            <BookOpen className="text-purple-500" size={20} /> Systemy i Operacje
          </h2>
          <div className="space-y-3">
            <Link
              href="/cred"
              className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:border-purple-300 dark:hover:border-purple-800 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-purple-500 transition-colors">CRED</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Cenralny Rejestr Ewidencji Dokumentów</p>
                </div>
              </div>
              <ExternalLink size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-purple-500" />
            </Link>
            <a
              href="https://cra-system.vercel.app/"
              target="_blank"
              className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:border-blue-300 dark:hover:border-blue-800 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Activity size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-blue-500 transition-colors">System CRA</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Centralny Rejestr Administracyjny</p>
                </div>
              </div>
              <ExternalLink size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-blue-500" />
            </a>
          </div>
        </div>

        {/* Rejestr Podań */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors softly-lifted flex flex-col h-[350px]">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Send className="text-blue-500" size={20} /> Rejestr Podań
            </h2>
            <button
              onClick={() => setIsPetitionModalOpen(true)}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
            >
              <Plus size={14} /> Nowe
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-700 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3">Podanie</th>
                  <th className="px-4 py-3">Adresat</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-sm">
                {petitions.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => { setSelectedPetition(p); setIsPetitionDrawerOpen(true) }}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                        {p.title} {p.attachments?.length > 0 && <Paperclip size={12} className="text-blue-500" />}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">{p.submission_date}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{p.recipient}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        className={`px-2 py-1 text-[10px] font-bold border rounded-lg uppercase transition-colors ${
                          p.status === 'Rozpatrzone'
                            ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800'
                            : p.status === 'Odrzucone'
                            ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800'
                            : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {p.status}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Moduł Teczek Archiwalnych */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden softly-lifted h-[350px] flex flex-col">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FolderClosed className="text-orange-500" size={20} /> Moduł Teczek Archiwalnych
          </h2>
          <button
            onClick={() => setIsArchiveModalOpen(true)}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm flex items-center gap-2 shadow-md transition-colors"
          >
            <Plus size={16} /> Kompletuj Nową Teczkę
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {archiveFolders.map(folder => (
              <div
                key={folder.id}
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-col justify-between gap-4 group hover:border-orange-300 dark:hover:border-orange-700 transition-colors"
              >
                <div>
                  <select
                    className={`mb-3 w-max max-w-full text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded outline-none border cursor-pointer ${
                      folder.status === 'W przygotowaniu'
                        ? 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-800'
                        : 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800'
                    }`}
                    value={folder.status}
                    onChange={e => updateArchiveStatus(folder.id, e.target.value)}
                  >
                    <option value="W przygotowaniu">W przygotowaniu</option>
                    <option value="Przekazane do Archiwum">Zarchiwizowane</option>
                  </select>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-relaxed break-words">{folder.title}</h3>
                  {folder.contact_name && (
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <Phone size={10} className="shrink-0"/>
                      <span className="font-bold">{folder.contact_name}</span>
                      {folder.contact_info && <span className="truncate">— {folder.contact_info}</span>}
                    </div>
                  )}
                  <div className="mt-2">{getFolderTypeBadge(folder.folder_type ?? 'general')}</div>
                </div>
                <div className="flex justify-between items-end pt-3 border-t border-slate-200 dark:border-slate-700 mt-auto">
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-500">
                    <Paperclip size={12} /> {folder.attachments?.length || 0}
                  </div>
                  <button
                    onClick={() => { setSelectedFolder(folder); setIsFolderDrawerOpen(true) }}
                    className="text-xs font-bold text-orange-600 hover:underline"
                  >
                    Zarządzaj wkładem
                  </button>
                </div>
              </div>
            ))}
            {loading && (
              <div className="col-span-full p-4"><SkeletonLoader variant="card" count={3} /></div>
            )}
            {!loading && archiveFolders.length === 0 && (
              <div className="col-span-full">
                <EmptyState title="Brak teczek archiwalnych" description="Utwórz pierwszą teczkę dla sprawy lub raportu" actionLabel="Nowa teczka" onAction={() => setIsArchiveModalOpen(true)} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Szuflada teczki archiwalnej */}
      {isFolderDrawerOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsFolderDrawerOpen(false)}
        />
      )}
      <div
        className={`fixed top-0 right-0 h-full w-full md:w-[450px] bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-all duration-300 ease-in-out flex flex-col border-l border-slate-200 dark:border-slate-800 ${isFolderDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {selectedFolder && (
          <>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0 relative">
              <div className="flex justify-between items-start mb-4">
                <select
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold uppercase rounded-lg px-3 py-1.5 outline-none shadow-sm"
                  value={selectedFolder.status}
                  onChange={e => updateArchiveStatus(selectedFolder.id, e.target.value)}
                >
                  <option value="W przygotowaniu">W przygotowaniu</option>
                  <option value="Przekazane do Archiwum">Zarchiwizowane</option>
                </select>
                <div className="flex items-center gap-1">
                  {isAdmin && !isFolderEditing && (
                    <button
                      onClick={() => { setFolderEditForm({ title: selectedFolder.title, contact_name: selectedFolder.contact_name ?? '', contact_info: selectedFolder.contact_info ?? '' }); setIsFolderEditing(true) }}
                      className="text-slate-400 hover:text-blue-500 p-1 transition-colors"
                      title="Edytuj teczkę"
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => deleteArchiveFolder(selectedFolder.id)}
                      className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                      title="Usuń Teczkę"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => { setIsFolderDrawerOpen(false); setIsFolderEditing(false) }}
                    className="text-slate-400 hover:text-slate-800 dark:hover:text-white p-1"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {isFolderEditing ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={folderEditForm.title}
                    onChange={e => setFolderEditForm({ ...folderEditForm, title: e.target.value })}
                    placeholder="Nazwa teczki"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-blue-400 rounded-xl outline-none text-slate-900 dark:text-white font-bold text-base focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={folderEditForm.contact_name}
                    onChange={e => setFolderEditForm({ ...folderEditForm, contact_name: e.target.value })}
                    placeholder="Osoba kontaktowa (opcjonalnie)"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white text-sm"
                  />
                  <input
                    type="text"
                    value={folderEditForm.contact_info}
                    onChange={e => setFolderEditForm({ ...folderEditForm, contact_info: e.target.value })}
                    placeholder="Dane kontaktowe (opcjonalnie)"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white text-sm"
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={saveFolderEdit}
                      disabled={isSavingFolder || !folderEditForm.title.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm disabled:opacity-50 transition-colors"
                    >
                      <Check size={14}/> {isSavingFolder ? 'Zapisywanie...' : 'Zapisz'}
                    </button>
                    <button
                      onClick={() => setIsFolderEditing(false)}
                      className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white text-sm font-bold transition-colors"
                    >
                      Anuluj
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight mb-2">{selectedFolder.title}</h2>
                  {selectedFolder.contact_name && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 mb-1">
                      <Phone size={13} className="text-slate-400 shrink-0"/>
                      <span className="font-bold">{selectedFolder.contact_name}</span>
                      {selectedFolder.contact_info && <span className="text-slate-400 dark:text-slate-500">— {selectedFolder.contact_info}</span>}
                    </div>
                  )}
                  <p className="text-xs font-mono text-slate-500">Utworzono: {selectedFolder.created_at.substring(0, 10)}</p>
                </>
              )}
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-6">
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm softly-lifted">
                <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Paperclip size={14} /> Wkład Teczki (Natywny Dysk)
                </h3>
                <div className="space-y-2 mb-4">
                  {(!selectedFolder.attachments || selectedFolder.attachments.length === 0) ? (
                    <p className="text-xs text-slate-400 italic">Teczka jest pusta.</p>
                  ) : (
                    selectedFolder.attachments.map(att => (
                      <a
                        key={att.id}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-blue-200 transition-colors group"
                      >
                        <div className="w-8 h-8 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center shrink-0">
                          <FileText size={14} />
                        </div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{att.name}</span>
                      </a>
                    ))
                  )}
                </div>
                <div className="relative">
                  <input
                    type="file"
                    onChange={e => handleAiKBUpload(e, selectedFolder.id, 'archive_folders', selectedFolder)}
                    disabled={isUploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className={`w-full py-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition-colors ${
                    isUploading
                      ? 'border-slate-200 bg-slate-50'
                      : 'border-orange-200 bg-orange-50/50 hover:bg-orange-50 dark:border-orange-900/50 dark:bg-orange-900/10 dark:hover:bg-orange-900/20'
                  }`}>
                    {isUploading
                      ? <Loader2 size={24} className="text-orange-500 animate-spin" />
                      : <UploadCloud size={24} className="text-orange-500" />}
                    <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                      {isUploading ? 'Przesyłanie na serwer...' : 'Dorzuć dokument do teczki'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Szuflada podania */}
      {isPetitionDrawerOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsPetitionDrawerOpen(false)}
        />
      )}
      <div
        className={`fixed top-0 right-0 h-full w-full md:w-[450px] bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-all duration-300 ease-in-out flex flex-col border-l border-slate-200 dark:border-slate-800 ${isPetitionDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {selectedPetition && (
          <>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0 relative">
              <div className="flex justify-between items-start mb-4">
                <select
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold uppercase rounded-lg px-3 py-1.5 outline-none shadow-sm"
                  value={selectedPetition.status}
                  onChange={e => updatePetitionStatus(selectedPetition.id, e.target.value)}
                >
                  <option value="Złożone">Złożone</option>
                  <option value="Rozpatrzone">Rozpatrzone</option>
                  <option value="Odrzucone">Odrzucone</option>
                </select>
                <div className="flex items-center gap-1">
                  {isAdmin && (
                    <button
                      onClick={() => deletePetition(selectedPetition.id)}
                      className="text-slate-400 hover:text-red-500 p-1 mr-2 transition-colors"
                      title="Usuń Podanie"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => setIsPetitionDrawerOpen(false)}
                    className="text-slate-400 hover:text-slate-800 dark:hover:text-white p-1"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight mb-2">{selectedPetition.title}</h2>
              <p className="text-xs font-bold text-slate-500">Adresat: {selectedPetition.recipient}</p>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-6">
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm softly-lifted">
                <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Paperclip size={14} /> Skan Podania
                </h3>
                <div className="space-y-2 mb-4">
                  {(!selectedPetition.attachments || selectedPetition.attachments.length === 0) ? (
                    <p className="text-xs text-slate-400 italic">Brak podpiętego skanu.</p>
                  ) : (
                    selectedPetition.attachments.map(att => (
                      <a
                        key={att.id}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-blue-200 transition-colors group"
                      >
                        <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center shrink-0">
                          <FileText size={14} />
                        </div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{att.name}</span>
                      </a>
                    ))
                  )}
                </div>
                <div className="relative">
                  <input
                    type="file"
                    onChange={e => handleAiKBUpload(e, selectedPetition.id, 'petitions', selectedPetition)}
                    disabled={isUploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className={`w-full py-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition-colors ${
                    isUploading
                      ? 'border-slate-200 bg-slate-50'
                      : 'border-blue-200 bg-blue-50/50 hover:bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/10 dark:hover:bg-blue-900/20'
                  }`}>
                    {isUploading
                      ? <Loader2 size={24} className="text-blue-500 animate-spin" />
                      : <UploadCloud size={24} className="text-blue-500" />}
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      {isUploading ? 'Przesyłanie na serwer...' : 'Wgraj plik (np. PDF)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal: Nowa teczka archiwalna */}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Nowa Teczka Archiwalna</h2>
              <button onClick={() => setIsArchiveModalOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddArchiveFolder} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Nazwa (np. Protokoły 2026)
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                  value={archiveForm.title}
                  onChange={e => setArchiveForm({ ...archiveForm, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Typ teczki</label>
                <select
                  value={archiveForm.folder_type}
                  onChange={e => setArchiveForm({ ...archiveForm, folder_type: e.target.value as FolderType })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                >
                  <option value="general">Ogólna</option>
                  <option value="project_report">Raport projektowy</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Osoba kontaktowa (opcjonalnie)
                </label>
                <input
                  type="text"
                  placeholder="np. Jan Kowalski"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                  value={archiveForm.contact_name}
                  onChange={e => setArchiveForm({ ...archiveForm, contact_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Dane kontaktowe
                </label>
                <input
                  type="text"
                  placeholder="np. jan@example.com / +48 123 456 789"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                  value={archiveForm.contact_info}
                  onChange={e => setArchiveForm({ ...archiveForm, contact_info: e.target.value })}
                />
              </div>
              <button
                type="submit"
                disabled={isSubmittingArchive}
                className="w-full py-4 mt-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl flex justify-center gap-2 transition-colors"
              >
                {isSubmittingArchive ? <Loader2 size={18} className="animate-spin" /> : null}
                Utwórz teczkę
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Wpisz podanie do rejestru */}
      {isPetitionModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Wpisz podanie do rejestru</h2>
              <button onClick={() => setIsPetitionModalOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddPetition} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Przedmiot Podania</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                  value={petitionForm.title}
                  onChange={e => setPetitionForm({ ...petitionForm, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Adresat (np. Prorektor)</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                    value={petitionForm.recipient}
                    onChange={e => setPetitionForm({ ...petitionForm, recipient: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Data Złożenia</label>
                  <input
                    type="date"
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                    value={petitionForm.submission_date}
                    onChange={e => setPetitionForm({ ...petitionForm, submission_date: e.target.value })}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmittingPetition}
                className="w-full py-4 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex justify-center gap-2 transition-colors"
              >
                {isSubmittingPetition ? <Loader2 size={18} className="animate-spin" /> : null}
                Wpisz do Rejestru
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ConfirmDialog — nie jest potrzebny dla archiwizacji (używamy confirm natywnego w źródle) */}
      {/* Archiwizacja używa bezpośrednich delete bez confirm dialog */}
      </div>
      )}
    </div>
  )
}
