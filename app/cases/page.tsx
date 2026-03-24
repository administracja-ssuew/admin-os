'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../../components/Sidebar'
import { Briefcase, Search, Plus, FileText, Link as LinkIcon, X, Clock, User, Building2, Send, Loader2, Shield, Paperclip } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CasesPage() {
  const [cases, setCases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)

  const [selectedCase, setSelectedCase] = useState<any>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [credSignature, setCredSignature] = useState('')
  
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [isSendingComment, setIsSendingComment] = useState(false)

  const [attachmentName, setAttachmentName] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({ title: '', description: '', case_type: 'Administracyjna', confidentiality_level: 'internal' })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.email) {
      const { data: userData } = await supabase.from('users').select('*').eq('email', session.user.email).single()
      if (userData) setCurrentUser(userData)
    }

    const { data } = await supabase.from('cases').select('*, users(first_name, last_name), departments(name)').order('created_at', { ascending: false })
    if (data) setCases(data)
    setLoading(false)
  }

  const openCaseDetails = async (c: any) => {
    setSelectedCase(c)
    setCredSignature(c.cred_signature || '')
    setIsDrawerOpen(true)
    fetchComments(c.id)
  }

  const fetchComments = async (caseId: string) => {
    const { data } = await supabase.from('case_comments').select('*, users(first_name, last_name)').eq('case_id', caseId).order('created_at', { ascending: true })
    if (data) setComments(data)
  }

  const saveCredSignature = async () => {
    if (!selectedCase) return
    const toastId = toast.loading('Zapisywanie sygnatury...')
    const { error } = await supabase.from('cases').update({ cred_signature: credSignature }).eq('id', selectedCase.id)
    if (!error) {
      toast.success('Sygnatura CRED zaktualizowana!', { id: toastId })
      fetchData()
    } else toast.error('Błąd zapisu', { id: toastId })
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !selectedCase || !currentUser) return
    setIsSendingComment(true)
    const { error } = await supabase.from('case_comments').insert([{ case_id: selectedCase.id, user_id: currentUser.id, content: newComment }])
    if (!error) {
      setNewComment('')
      fetchComments(selectedCase.id)
    }
    setIsSendingComment(false)
  }

  const handleAddAttachment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!attachmentName.trim() || !attachmentUrl.trim() || !selectedCase) return

    const newAttachment = { id: crypto.randomUUID(), name: attachmentName, url: attachmentUrl, added_at: new Date().toISOString() }
    const updatedAttachments = [...(selectedCase.attachments || []), newAttachment]

    const { error } = await supabase.from('cases').update({ attachments: updatedAttachments }).eq('id', selectedCase.id)
    if (!error) {
      setSelectedCase({ ...selectedCase, attachments: updatedAttachments })
      setAttachmentName('')
      setAttachmentUrl('')
      toast.success('Załącznik dodany do akt')
      fetchData()
    }
  }

  const handleAddCase = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    const currentYear = new Date().getFullYear()
    const randomNum = Math.floor(1000 + Math.random() * 9000)
    
    const { error } = await supabase.from('cases').insert([{
      ...formData,
      case_number: `SPR/${currentYear}/${randomNum}`,
      owner_id: currentUser?.id,
      status: 'new',
      attachments: []
    }])

    if (!error) {
      setFormData({ title: '', description: '', case_type: 'Administracyjna', confidentiality_level: 'internal' })
      setIsModalOpen(false)
      fetchData()
      toast.success('Sprawa zarejestrowana')
    }
    setIsSubmitting(false)
  }

  const getStatusBadge = (status: string) => {
    const styles: any = {
      'new': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      'in_progress': 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 animate-pulse',
      'closed': 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700'
    }
    return <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${styles[status] || styles['new']}`}>{status === 'new' ? 'Nowa' : status === 'in_progress' ? 'W toku' : 'Zamknięta'}</span>
  }

  const filteredCases = cases.filter(c => (c.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || (c.case_number || '').toLowerCase().includes(searchTerm.toLowerCase()))

  // --- WERYFIKACJA UPRAWNIEŃ ---
  const isAdmin = currentUser?.system_role === 'admin' || currentUser?.system_role === 'superadmin'

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 relative overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 ml-64 p-8 flex flex-col h-screen">
        
        <div className="flex justify-between items-center mb-8 shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3 transition-colors">
              <Briefcase className="text-blue-600 dark:text-blue-500" size={32} /> Rejestr Spraw
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 transition-colors">Główny obieg dokumentów i integracja Workspace</p>
          </div>
          
          {/* PRZYCISK WIDOCZNY TYLKO DLA ZARZĄDU */}
          {isAdmin && (
            <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-500/30 transition-all">
              <Plus size={20} /> Nowa Sprawa
            </button>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl mb-6 border border-slate-200 dark:border-slate-700 shrink-0 shadow-sm transition-colors">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input type="text" placeholder="Szukaj po nazwie lub sygnaturze..." className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900 transition-colors" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 transition-colors">
              <tr>
                <th className="px-6 py-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Sygnatury</th>
                <th className="px-6 py-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Przedmiot Sprawy</th>
                <th className="px-6 py-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Odpowiedzialność</th>
                <th className="px-6 py-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {filteredCases.map(c => (
                <tr key={c.id} onClick={() => openCaseDetails(c)} className="hover:bg-blue-50/50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group">
                  <td className="px-6 py-4">
                    <div className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 inline-block px-2 py-1 rounded mb-1">{c.case_number}</div>
                    {c.cred_signature ? <div className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400"><LinkIcon size={10}/> {c.cred_signature}</div> : <div className="text-[10px] text-slate-400 italic">Brak CRED</div>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-2">
                      {c.confidentiality_level === 'board_only' && <Shield size={14} className="text-red-500" />}
                      {c.title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate max-w-xs">{c.source === 'Formularz Zewnętrzny' ? '📥 Wpłynęło z Biura Podawczego' : c.description}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-0.5"><User size={14} className="text-slate-400"/> {c.users ? `${c.users.first_name} ${c.users.last_name}` : 'Nieprzypisana'}</div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><Building2 size={12} className="text-slate-400"/> {c.departments ? c.departments.name : 'Ogólne'}</div>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(c.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isDrawerOpen && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity" onClick={() => setIsDrawerOpen(false)} />}
      
      <div className={`fixed top-0 right-0 h-full w-[550px] bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-all duration-300 ease-in-out flex flex-col border-l border-slate-200 dark:border-slate-800 ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedCase && (
          <>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-2 items-center">
                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded border border-blue-200 dark:border-blue-800">{selectedCase.case_number}</span>
                  {getStatusBadge(selectedCase.status)}
                </div>
                <button onClick={() => setIsDrawerOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white p-1 bg-white dark:bg-slate-800 rounded-full shadow-sm"><X size={20} /></button>
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white leading-tight mb-2">{selectedCase.title}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 whitespace-pre-wrap">{selectedCase.description}</p>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50 dark:bg-slate-900 flex flex-col gap-6">
              
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm softly-lifted">
                <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Paperclip size={14}/> Akta Sprawy (Google Workspace)</h3>
                
                <div className="space-y-2 mb-4">
                  {(!selectedCase.attachments || selectedCase.attachments.length === 0) ? (
                    <p className="text-xs text-slate-400 italic">Brak podpiętych dokumentów.</p>
                  ) : (
                    selectedCase.attachments.map((att: any) => (
                      <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-700 transition-colors group">
                        <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0"><FileText size={14}/></div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">{att.name}</span>
                      </a>
                    ))
                  )}
                </div>

                <form onSubmit={handleAddAttachment} className="flex flex-col gap-2 border-t border-slate-100 dark:border-slate-700 pt-3">
                  <input type="text" placeholder="Nazwa pliku (np. Wniosek.pdf)" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-xs text-slate-900 dark:text-white" value={attachmentName} onChange={(e) => setAttachmentName(e.target.value)} />
                  <div className="flex gap-2">
                    <input type="url" placeholder="Link do Google Drive..." className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-xs text-slate-900 dark:text-white" value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} />
                    <button type="submit" disabled={!attachmentName || !attachmentUrl} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors">Podepnij</button>
                  </div>
                </form>
              </div>

              {/* INTEGRACJA CRED - TYLKO DLA ADMINÓW */}
              {isAdmin && (
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm softly-lifted">
                  <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><LinkIcon size={14}/> Integracja CRED (Zarząd)</h3>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Wklej sygnaturę z CRED..." className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm font-mono text-slate-900 dark:text-white" value={credSignature} onChange={(e) => setCredSignature(e.target.value)} />
                    <button onClick={saveCredSignature} className="px-4 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600 text-white text-sm font-bold rounded-xl transition-colors">Zapisz</button>
                  </div>
                </div>
              )}

              <div className="flex-1 flex flex-col">
                <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Clock size={14}/> Oś Czasu i Notatki Operacyjne</h3>
                
                <div className="flex-1 space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-700 before:to-transparent">
                  
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white dark:border-slate-900 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2"><Briefcase size={16} /></div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-bold text-slate-900 dark:text-white text-sm">Otwarcie sprawy</div>
                        <time className="font-mono text-[10px] text-slate-400">{new Date(selectedCase.created_at).toLocaleDateString()}</time>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Sprawa wpłynęła do systemu.</div>
                    </div>
                  </div>

                  {comments.map((comment, idx) => (
                    <div key={comment.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 font-bold text-xs">
                        {comment.users ? `${comment.users.first_name.charAt(0)}${comment.users.last_name.charAt(0)}` : '?'}
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-bold text-slate-900 dark:text-white text-sm">{comment.users ? `${comment.users.first_name} ${comment.users.last_name}` : 'Nieznany'}</div>
                          <time className="font-mono text-[10px] text-slate-400">{new Date(comment.created_at).toLocaleDateString()}</time>
                        </div>
                        <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{comment.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

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

      {isModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Otwórz nową sprawę</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddCase} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Przedmiot sprawy</label>
                <input type="text" required autoFocus className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full py-4 mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : 'Zarejestruj sprawę'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}