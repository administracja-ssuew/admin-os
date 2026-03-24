'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../../components/Sidebar'
import { Shield, Lock, EyeOff, AlertTriangle, Briefcase, ChevronRight, Gavel, Check, FileText, Save, Plus, Loader2, User, Clock } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function ExecutivePanelPage() {
  const [confidentialCases, setConfidentialCases] = useState<any[]>([])
  const [decisions, setDecisions] = useState<any[]>([])
  const [workspaceNote, setWorkspaceNote] = useState({ id: '', content: '' })
  
  const [loading, setLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false)
  
  const [newDecisionForm, setNewDecisionForm] = useState({ title: '', content: '', effective_date: '' })

  useEffect(() => {
    fetchExecutiveData()
  }, [])

  const fetchExecutiveData = async () => {
    setLoading(true)
    
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.email) {
      const { data: userData } = await supabase.from('users').select('*').eq('email', session.user.email).single()
      
      // BRAMKARZ
      if (userData?.system_role === 'admin' || userData?.system_role === 'superadmin') {
        setIsAuthorized(true)
        setCurrentUser(userData)
        
        // 1. Sprawy poufne (Zarząd)
        const { data: secretCases } = await supabase.from('cases').select('*, users(first_name, last_name)').eq('confidentiality_level', 'board_only').order('created_at', { ascending: false })
        if (secretCases) setConfidentialCases(secretCases)

        // 2. Tabela DECYZJI (Uchwały)
        const { data: decisionsData } = await supabase.from('decisions').select('*, author:users!decisions_author_id_fkey(first_name, last_name), approver:users!decisions_approver_id_fkey(first_name, last_name)').order('created_at', { ascending: false })
        if (decisionsData) setDecisions(decisionsData)

        // 3. Notatnik roboczy
        const { data: noteData } = await supabase.from('board_notes').select('*').limit(1).single()
        if (noteData) setWorkspaceNote(noteData)
      }
    }
    setLoading(false)
  }

  // --- PRZESTRZEŃ ROBOCZA ---
  const handleSaveNote = async () => {
    if (!workspaceNote.id) return
    setIsSavingNote(true)
    const { error } = await supabase.from('board_notes').update({ content: workspaceNote.content, updated_at: new Date().toISOString() }).eq('id', workspaceNote.id)
    if (!error) toast.success('Brudnopis Zarządu zapisany')
    else toast.error('Błąd zapisu')
    setIsSavingNote(false)
  }

  // --- LOGIKA DECYZJI / UCHWAŁ ---
  const handleDraftDecision = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDecisionForm.title.trim() || !newDecisionForm.content.trim()) return
    setIsSubmittingDecision(true)

    const { error } = await supabase.from('decisions').insert([{
      title: newDecisionForm.title,
      content: newDecisionForm.content,
      effective_date: newDecisionForm.effective_date || null,
      author_id: currentUser.id,
      status: 'draft' // Ląduje jako szkic oczekujący na zatwierdzenie
    }])

    if (!error) {
      setNewDecisionForm({ title: '', content: '', effective_date: '' })
      fetchExecutiveData()
      toast.success('Projekt uchwały zgłoszony. Oczekuje na podpis.')
    } else toast.error('Błąd dodawania')
    setIsSubmittingDecision(false)
  }

  const approveDecision = async (decisionId: string) => {
    if (!currentUser) return
    const toastId = toast.loading('Nadawanie mocy prawnej...')
    
    // Zatwierdzający nie powinien być tą samą osobą co autor (choć Superadmin może wszystko)
    const { error } = await supabase.from('decisions').update({
      status: 'active',
      approver_id: currentUser.id
    }).eq('id', decisionId)

    if (!error) {
      fetchExecutiveData()
      toast.success('Uchwała zatwierdzona!', { id: toastId })
    } else toast.error('Błąd autoryzacji', { id: toastId })
  }

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen bg-slate-900 text-white items-center justify-center p-4">
        <div className="text-center">
          <Shield size={64} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Brak Dostępu</h1>
          <p className="text-slate-400">Ten obszar jest zastrzeżony wyłącznie dla Zarządu Komisji.</p>
          <Link href="/" className="mt-6 inline-block text-blue-400 hover:text-blue-300">Wróć do Panelu Głównego</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 relative overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 ml-64 p-8 overflow-y-auto custom-scrollbar flex flex-col h-screen">
        
        {/* NAGŁÓWEK VIP */}
        <div className="bg-gradient-to-r from-slate-900 to-black rounded-3xl p-8 text-white shadow-xl shadow-red-900/20 mb-8 relative overflow-hidden border border-slate-800 shrink-0">
          <div className="absolute top-0 right-0 opacity-5 pointer-events-none transform translate-x-1/4 -translate-y-1/4"><Lock size={300} /></div>
          <div className="relative z-10">
            <span className="px-3 py-1 bg-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-widest rounded-full flex items-center gap-1 w-max mb-3 border border-red-500/30">
              <EyeOff size={12} /> Strefa Zastrzeżona Zarządu
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold mb-2">Centrum Strategiczne</h1>
            <p className="text-slate-400 font-medium text-sm md:text-base max-w-2xl">Zarządzaj sprawami o najwyższej klauzuli tajności, procesuj uchwały i planuj w zamkniętej przestrzeni roboczej.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 flex-1 min-h-0">
          
          {/* LEWA KOLUMNA: DECYZJE I SPRAWY */}
          <div className="xl:col-span-1 space-y-8 flex flex-col overflow-y-auto custom-scrollbar pr-2">
            
            {/* SPRAWY POUFNE */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors softly-lifted shrink-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <AlertTriangle className="text-red-500" size={20} /> Akta Poufne
              </h2>
              <div className="space-y-2">
                {confidentialCases.length > 0 ? confidentialCases.map(c => (
                  <Link key={c.id} href="/cases" className="flex items-center justify-between p-3 rounded-xl border border-red-50 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group">
                    <div className="min-w-0 pr-2">
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">{c.title}</h3>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-red-500 shrink-0" />
                  </Link>
                )) : (
                  <div className="text-xs text-center text-slate-500 dark:text-slate-400 py-4 italic">Brak otwartych spraw poufnych.</div>
                )}
              </div>
            </div>

            {/* MODUŁ UCHWAŁ (TABELA: decisions) */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors softly-lifted flex-1 flex flex-col">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <Gavel className="text-blue-500" size={20} /> Rejestr Uchwał
              </h2>

              <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1">
                {decisions.map(dec => {
                  const isActive = dec.status === 'active'
                  return (
                    <div key={dec.id} className={`p-4 rounded-2xl border transition-colors ${isActive ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700' : 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/50'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/50' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/50'}`}>
                          {isActive ? 'W Mocy' : 'Projekt (Szkic)'}
                        </span>
                        {dec.effective_date && <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Clock size={10}/> {dec.effective_date}</span>}
                      </div>
                      
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{dec.title}</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 whitespace-pre-wrap">{dec.content}</p>
                      
                      <div className="flex flex-col gap-1.5 mt-auto pt-3 border-t border-slate-200 dark:border-slate-700/50">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <User size={10}/> Autor: <span className="font-bold">{dec.author ? `${dec.author.first_name} ${dec.author.last_name}` : 'Nieznany'}</span>
                        </div>
                        {isActive ? (
                          <div className="text-[10px] text-green-600 dark:text-green-500 flex items-center gap-1">
                            <Check size={10}/> Zatwierdził: <span className="font-bold">{dec.approver ? `${dec.approver.first_name} ${dec.approver.last_name}` : 'System'}</span>
                          </div>
                        ) : (
                          <button onClick={() => approveDecision(dec.id)} className="mt-2 w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg flex items-center justify-center gap-1 transition-colors">
                            <Gavel size={12}/> Zatwierdź i nadaj moc
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Formularz Projektu Uchwały */}
              <form onSubmit={handleDraftDecision} className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-2 shrink-0">
                <input type="text" placeholder="Tytuł uchwały / decyzji..." className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-xs text-slate-900 dark:text-white font-bold" value={newDecisionForm.title} onChange={(e) => setNewDecisionForm({...newDecisionForm, title: e.target.value})} />
                <textarea placeholder="Treść decyzji..." className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-xs text-slate-900 dark:text-white resize-none h-16" value={newDecisionForm.content} onChange={(e) => setNewDecisionForm({...newDecisionForm, content: e.target.value})} />
                <div className="flex gap-2">
                  <input type="date" title="Data wejścia w życie" className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-xs text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]" value={newDecisionForm.effective_date} onChange={(e) => setNewDecisionForm({...newDecisionForm, effective_date: e.target.value})} />
                  <button type="submit" disabled={isSubmittingDecision || !newDecisionForm.title || !newDecisionForm.content} className="px-4 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg transition-colors text-xs font-bold flex items-center gap-1">
                    {isSubmittingDecision ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>} Zgłoś Projekt
                  </button>
                </div>
              </form>
            </div>

          </div>

          {/* PRAWA KOLUMNA: PRZESTRZEŃ ROBOCZA */}
          <div className="xl:col-span-2 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors softly-lifted flex flex-col overflow-hidden h-full">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="text-orange-500" size={20} /> Brudnopis Zarządu (Shared)
              </h2>
              <button onClick={handleSaveNote} disabled={isSavingNote} className="px-4 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm">
                {isSavingNote ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Zapisz Notatkę
              </button>
            </div>
            
            <textarea 
              className="flex-1 w-full p-6 bg-transparent text-slate-800 dark:text-slate-200 outline-none resize-none leading-relaxed text-sm placeholder-slate-400 dark:placeholder-slate-500 custom-scrollbar"
              placeholder="Tutaj Zarząd może wspólnie pracować nad brudnopisami uchwał, planować budżet i robić luźne notatki..."
              value={workspaceNote.content}
              onChange={(e) => setWorkspaceNote({ ...workspaceNote, content: e.target.value })}
            />
            
            <div className="p-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 shrink-0 text-center">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Współdzielone na żywo z resztą Zarządu</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}