'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import { FILES_BUCKET, sanitizeFileName } from '../lib/files'
import FileLink from './FileLink'
import SkeletonLoader from './SkeletonLoader'
import EmptyState from './EmptyState'
import toast from 'react-hot-toast'
import {
  Plus, Loader2, FileText, FolderClosed, Paperclip, UploadCloud, Trash2, X, Phone, Pencil, Check,
} from 'lucide-react'
import type { ArchiveFolder, AppUser, CaseAttachment, FolderType } from '../types'

// ─── PROPS ───────────────────────────────────────────────────────────────────
export interface ArchiveFoldersPanelProps {
  archiveFolders: ArchiveFolder[]
  currentUser: AppUser | null
  isAdmin: boolean
  loading?: boolean
  onRefetch: () => Promise<void>
}

// ─── KOMPONENT: Moduł Teczek Archiwalnych ─────────────────────────────────────
export function ArchiveFoldersPanel({
  archiveFolders,
  currentUser,
  isAdmin,
  loading = false,
  onRefetch,
}: ArchiveFoldersPanelProps) {
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
  const [selectedFolder, setSelectedFolder] = useState<ArchiveFolder | null>(null)
  const [isFolderDrawerOpen, setIsFolderDrawerOpen] = useState(false)
  const [isFolderEditing, setIsFolderEditing] = useState(false)
  const [folderEditForm, setFolderEditForm] = useState({ title: '', contact_name: '', contact_info: '' })
  const [isSavingFolder, setIsSavingFolder] = useState(false)

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
    if (!confirm('Usunąć teczkę? Wpis teczki zniknie z modułu.')) return
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

  // ─── UPLOAD DOKUMENTU DO TECZKI ─────────────────────────────────
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>, folder: ArchiveFolder) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    const toastId = toast.loading('Wrzucanie pliku na serwer...')
    try {
      const filePath = `aikb/archive_folders/${folder.id}/${crypto.randomUUID()}/${sanitizeFileName(file.name)}`
      const { error: uploadError } = await supabase.storage
        .from(FILES_BUCKET)
        .upload(filePath, file, { contentType: file.type })
      if (uploadError) throw uploadError

      // Adres służy jako wskazanie pliku; otwierany jest linkiem podpisanym (FileLink)
      const { data } = supabase.storage.from(FILES_BUCKET).getPublicUrl(filePath)
      const newAttachment: CaseAttachment = {
        id: crypto.randomUUID(),
        name: file.name,
        url: data.publicUrl,
        added_at: new Date().toISOString(),
      }
      const updatedAttachments = [...(folder.attachments || []), newAttachment]

      const { error: updateError } = await supabase
        .from('archive_folders')
        .update({ attachments: updatedAttachments })
        .eq('id', folder.id)
      if (updateError) throw updateError

      if (selectedFolder?.id === folder.id) setSelectedFolder({ ...selectedFolder, attachments: updatedAttachments })
      await onRefetch()
      toast.success('Dokument podpięty!', { id: toastId })
    } catch (error) {
      toast.error('Błąd podczas wgrywania pliku', { id: toastId })
      console.error(error)
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

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
      {/* Moduł Teczek Archiwalnych */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden softly-lifted flex flex-col">
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
        <div className="p-6">
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
                      <FileLink
                        key={att.id}
                        href={att.url}
                        className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-blue-200 transition-colors group cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center shrink-0">
                          <FileText size={14} />
                        </div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{att.name}</span>
                      </FileLink>
                    ))
                  )}
                </div>
                <div className="relative">
                  <input
                    type="file"
                    onChange={e => handleFolderUpload(e, selectedFolder)}
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

    </div>
  )
}
