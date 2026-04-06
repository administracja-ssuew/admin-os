'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../../components/Sidebar'
import SkeletonLoader from '../../components/SkeletonLoader'
import { Plus, X, Lock, FileText, Paperclip, UploadCloud } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import type { MeetingProtocol, ProtocolStatus } from '../../types'

const EMPTY_FORM = {
  title: '',
  date: new Date().toISOString().split('T')[0],
  participants: '',
  agenda: '',
  findings: '',
  actions: '',
}

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

  const fetchProtocols = useCallback(async () => {
    const { data } = await supabase
      .from('meeting_protocols')
      .select('*')
      .order('date', { ascending: false })
    if (data) setProtocols(data as MeetingProtocol[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchProtocols()
  }, [fetchProtocols])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setIsSubmitting(true)
    const toastId = toast.loading('Tworzenie protokołu...')
    const { error } = await supabase.from('meeting_protocols').insert([{
      ...form,
      protocol_status: 'draft',
      created_by: user.id,
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

  const handleSaveEdit = async () => {
    if (!selectedProtocol || selectedProtocol.protocol_status === 'finalized') return
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedProtocol) return
    setIsUploading(true)
    const toastId = toast.loading('Wrzucanie pliku...')
    try {
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
      const filePath = `protocols/${selectedProtocol.id}/${crypto.randomUUID()}/${safeFileName}`
      const { error: uploadError } = await supabase.storage
        .from('adminos-files')
        .upload(filePath, file, { contentType: file.type })
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

  const handleFinalize = async () => {
    if (!selectedProtocol || selectedProtocol.protocol_status === 'finalized') return
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
    setIsDrawerOpen(true)
  }

  const isFinalized = selectedProtocol?.protocol_status === 'finalized'

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar />
      <div className="flex-1 ml-64 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Protokoły posiedzeń</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Zarządzaj protokołami posiedzeń</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nowy protokół
          </button>
        </div>

        {/* Protocol list */}
        {loading ? (
          <SkeletonLoader variant="card" count={3} />
        ) : protocols.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <FileText className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-lg font-medium">Brak protokołów</p>
            <p className="text-sm mt-1">Kliknij &quot;Nowy protokół&quot;, aby dodać pierwszy</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {protocols.map((protocol) => (
              <button
                key={protocol.id}
                onClick={() => openDrawer(protocol)}
                className="text-left bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-slate-900 dark:text-white text-sm leading-snug line-clamp-2">
                    {protocol.title}
                  </h3>
                  {protocol.protocol_status === 'finalized' ? (
                    <span className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                      <Lock className="w-3 h-3" />
                      Zablokowany
                    </span>
                  ) : (
                    <span className="shrink-0 px-2 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                      Szkic
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{protocol.date}</p>
                {protocol.participants && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 truncate">{protocol.participants}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal tworzenia */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Nowy protokół</h2>
              <button
                onClick={() => { setIsModalOpen(false); setForm(EMPTY_FORM) }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tytuł</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Np. Posiedzenie Zarządu nr 12/2026"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Uczestnicy</label>
                <textarea
                  rows={3}
                  value={form.participants}
                  onChange={(e) => setForm({ ...form, participants: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Imiona i nazwiska uczestników..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Porządek obrad</label>
                <textarea
                  rows={3}
                  value={form.agenda}
                  onChange={(e) => setForm({ ...form, agenda: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Punkty porządku obrad..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ustalenia</label>
                <textarea
                  rows={3}
                  value={form.findings}
                  onChange={(e) => setForm({ ...form, findings: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Ustalenia posiedzenia..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Akcje</label>
                <textarea
                  rows={3}
                  value={form.actions}
                  onChange={(e) => setForm({ ...form, actions: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Działania do podjęcia..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setForm(EMPTY_FORM) }}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || userLoading}
                  className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isSubmitting ? 'Tworzenie...' : 'Utwórz protokół'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drawer edycji */}
      {isDrawerOpen && selectedProtocol && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setIsDrawerOpen(false)}
          />
          <div className="fixed right-0 top-0 h-full w-[480px] bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Protokół</h2>
                {selectedProtocol.protocol_status === 'finalized' ? (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                    <Lock className="w-3 h-3" />
                    Zablokowany
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                    Szkic
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isFinalized && (
              <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-sm font-medium flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0" />
                Ten protokół jest zablokowany i nie można go edytować
              </div>
            )}

            <div className="p-6 space-y-4 flex-1">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tytuł</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  disabled={isFinalized}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data</label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  disabled={isFinalized}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Uczestnicy</label>
                <textarea
                  rows={3}
                  value={editForm.participants}
                  onChange={(e) => setEditForm({ ...editForm, participants: e.target.value })}
                  disabled={isFinalized}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Porządek obrad</label>
                <textarea
                  rows={3}
                  value={editForm.agenda}
                  onChange={(e) => setEditForm({ ...editForm, agenda: e.target.value })}
                  disabled={isFinalized}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ustalenia</label>
                <textarea
                  rows={3}
                  value={editForm.findings}
                  onChange={(e) => setEditForm({ ...editForm, findings: e.target.value })}
                  disabled={isFinalized}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Akcje</label>
                <textarea
                  rows={3}
                  value={editForm.actions}
                  onChange={(e) => setEditForm({ ...editForm, actions: e.target.value })}
                  disabled={isFinalized}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              {/* Plik protokołu */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Plik protokołu</p>
                {selectedProtocol?.file_url ? (
                  <a
                    href={selectedProtocol.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm hover:underline"
                  >
                    <Paperclip size={14} />
                    {selectedProtocol.file_name ?? 'Plik protokołu'}
                  </a>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Brak dołączonego pliku</p>
                )}
                {!isFinalized && (
                  <label className="mt-2 flex items-center gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400">
                    <UploadCloud size={16} />
                    {isUploading ? 'Wgrywanie...' : 'Dołącz plik'}
                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                  </label>
                )}
              </div>
            </div>

            {!isFinalized && (
              <div className="px-6 pt-4 pb-2">
                <button
                  onClick={handleFinalize}
                  disabled={isFinalizing}
                  className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Lock size={16} />
                  {isFinalizing ? 'Blokowanie...' : 'Zablokuj protokół'}
                </button>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
                  Po zablokowaniu protokół nie będzie mógł być edytowany.
                </p>
              </div>
            )}

            {!isFinalized && (
              <div className="p-6 border-t border-slate-200 dark:border-slate-700 shrink-0">
                <button
                  onClick={handleSaveEdit}
                  disabled={isFinalized}
                  className="w-full px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Zapisz zmiany
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
