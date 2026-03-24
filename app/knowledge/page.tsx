'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../../components/Sidebar'
import { BookOpen, FileText, ExternalLink, HardHat, AlertTriangle, Shield, Search, Lock, ChevronRight, Save, Plus, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function KnowledgePage() {
  const [articles, setArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeArticle, setActiveArticle] = useState<any>(null)
  
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', content: '', drive_link: '', category: 'Procedury' })

  // Twardo zakodowane zakładki "Work in Progress" o które prosiłeś
  const wipTabs = [
    { id: 'wip-1', title: 'Analiza wniosków o dotacje zewnętrzne', category: 'W Budowie' },
    { id: 'wip-2', title: 'Audyt umów użyczenia', category: 'W Budowie' },
    { id: 'wip-3', title: 'Procedura archiwizacji', category: 'W Budowie' }
  ]

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.email) {
      const { data: userData } = await supabase.from('users').select('*').eq('email', session.user.email).single()
      if (userData) setCurrentUser(userData)
    }

    const { data } = await supabase.from('knowledge_articles').select('*').order('title', { ascending: true })
    if (data) {
      setArticles(data)
      if (data.length > 0 && !activeArticle) setActiveArticle(data[0])
    }
    setLoading(false)
  }

  const handleSaveArticle = async () => {
    const toastId = toast.loading('Zapisywanie...')
    
    if (activeArticle?.id && !activeArticle.id.startsWith('wip-')) {
      // Aktualizacja istniejącego
      const { error } = await supabase.from('knowledge_articles').update({
        title: editForm.title,
        content: editForm.content,
        drive_link: editForm.drive_link,
        category: editForm.category,
        updated_at: new Date().toISOString()
      }).eq('id', activeArticle.id)
      
      if (!error) {
        toast.success('Zaktualizowano!', { id: toastId })
        setIsEditing(false)
        fetchData()
        setActiveArticle({ ...activeArticle, ...editForm })
      } else toast.error('Błąd', { id: toastId })
    } else {
      // Dodawanie nowego
      const { error } = await supabase.from('knowledge_articles').insert([editForm])
      if (!error) {
        toast.success('Dodano artykuł!', { id: toastId })
        setIsEditing(false)
        fetchData()
      } else toast.error('Błąd', { id: toastId })
    }
  }

  const startNewArticle = () => {
    setActiveArticle({ id: 'new', title: 'Nowy Artykuł', category: 'Procedury' })
    setEditForm({ title: '', content: '', drive_link: '', category: 'Procedury' })
    setIsEditing(true)
  }

  const openArticle = (item: any) => {
    setActiveArticle(item)
    if (!item.id.startsWith('wip-')) {
      setEditForm({ title: item.title, content: item.content || '', drive_link: item.drive_link || '', category: item.category })
      setIsEditing(false)
    }
  }

  const isAdmin = currentUser?.system_role === 'admin' || currentUser?.system_role === 'superadmin'

  // Łączymy prawdziwe artykuły z bazy i te "w budowie" do wyświetlania na liście
  const allItems = [...articles, ...wipTabs]
  const filteredItems = allItems.filter(a => a.title.toLowerCase().includes(searchTerm.toLowerCase()))

  // Grupowanie po kategoriach
  const groupedItems = filteredItems.reduce((acc: any, item: any) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 relative overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 ml-64 p-8 flex flex-col h-screen overflow-hidden">
        
        <div className="flex justify-between items-center mb-8 shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3 transition-colors">
              <BookOpen className="text-blue-600 dark:text-blue-500" size={32} /> Baza Wiedzy (Wiki)
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 transition-colors">Procedury, szablony i struktura plików Workspace.</p>
          </div>
          {isAdmin && (
            <button onClick={startNewArticle} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-500/30 transition-all">
              <Plus size={20} /> Nowy Wpis
            </button>
          )}
        </div>

        <div className="flex-1 flex gap-8 min-h-0">
          
          {/* LEWA KOLUMNA: NAWIGACJA (SPIS TREŚCI) */}
          <div className="w-1/3 flex flex-col gap-4">
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input type="text" placeholder="Szukaj w procedurach..." className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white bg-white dark:bg-slate-800 transition-colors shadow-sm softly-lifted" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors softly-lifted p-4 space-y-6">
              {Object.keys(groupedItems).map(category => (
                <div key={category}>
                  <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    {category === 'W Budowie' ? <HardHat size={14} className="text-orange-500"/> : <Shield size={14}/>} {category}
                  </h3>
                  <div className="space-y-1">
                    {groupedItems[category].map((item: any) => {
                      const isActive = activeArticle?.id === item.id
                      const isWip = item.id.startsWith('wip-')
                      return (
                        <button 
                          key={item.id} 
                          onClick={() => openArticle(item)}
                          className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-between group ${isActive ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                        >
                          <span className="truncate pr-2 flex items-center gap-2">
                            {isWip ? <Lock size={14} className="text-slate-400" /> : <FileText size={14} className={isActive ? 'text-blue-500' : 'text-slate-400'}/>}
                            {item.title}
                          </span>
                          {isActive && <ChevronRight size={14} />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PRAWA KOLUMNA: CZYTNIK / EDYTOR */}
          <div className="w-2/3 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors softly-lifted flex flex-col overflow-hidden">
            {activeArticle ? (
              activeArticle.id.startsWith('wip-') ? (
                // --- EKRAN "W BUDOWIE" ---
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-stripes-slate">
                  <div className="w-24 h-24 bg-orange-100 dark:bg-orange-900/40 text-orange-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <HardHat size={48} />
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-3">{activeArticle.title}</h2>
                  <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto font-medium leading-relaxed">
                    Zarząd Komisji aktualnie pracuje nad wdrożeniem i zatwierdzeniem tej procedury. Oczekuj na aktualizację w najbliższych dniach.
                  </p>
                  <div className="mt-8 px-4 py-2 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-500 text-xs font-bold uppercase tracking-widest rounded-lg border border-orange-200 dark:border-orange-800/50 flex items-center gap-2">
                    <AlertTriangle size={14} /> Status: Prace Robocze
                  </div>
                </div>
              ) : isEditing ? (
                // --- EKRAN EDYCJI (ADMIN) ---
                <div className="flex-1 flex flex-col h-full">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FileText className="text-blue-500" size={20} /> Tryb Edycji (SSOT)
                    </h2>
                    <div className="flex gap-2">
                      <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-sm transition-colors hover:bg-slate-200 dark:hover:bg-slate-600">Anuluj</button>
                      <button onClick={handleSaveArticle} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all text-sm flex items-center gap-2"><Save size={16}/> Zapisz</button>
                    </div>
                  </div>
                  <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Tytuł dokumentu</label>
                      <input type="text" className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-slate-900 dark:text-white" value={editForm.title} onChange={(e) => setEditForm({...editForm, title: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Kategoria</label>
                        <select className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={editForm.category} onChange={(e) => setEditForm({...editForm, category: e.target.value})}>
                          <option value="Procedury">Procedury</option>
                          <option value="Regulaminy">Regulaminy</option>
                          <option value="Szablony">Szablony i Druki</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Link do autoryzowanego folderu (Drive)</label>
                        <input type="url" placeholder="https://drive.google.com/..." className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={editForm.drive_link} onChange={(e) => setEditForm({...editForm, drive_link: e.target.value})} />
                      </div>
                    </div>
                    <div className="flex-1 min-h-[300px] flex flex-col">
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Treść wytycznych</label>
                      <textarea className="flex-1 w-full px-4 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none resize-none text-sm text-slate-800 dark:text-slate-200 leading-relaxed custom-scrollbar" value={editForm.content} onChange={(e) => setEditForm({...editForm, content: e.target.value})} placeholder="Wpisz procedurę lub notatkę..." />
                    </div>
                  </div>
                </div>
              ) : (
                // --- EKRAN CZYTANIA (DLA WSZYSTKICH) ---
                <div className="flex-1 flex flex-col h-full">
                  <div className="p-8 border-b border-slate-100 dark:border-slate-700 shrink-0">
                    <div className="flex justify-between items-start mb-4">
                      <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-slate-200 dark:border-slate-600">
                        {activeArticle.category}
                      </span>
                      {isAdmin && (
                        <button onClick={() => setIsEditing(true)} className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline">Edytuj treść</button>
                      )}
                    </div>
                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">{activeArticle.title}</h2>
                  </div>

                  <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {activeArticle.content || <span className="italic opacity-50">Ten artykuł nie posiada jeszcze wewnętrznej treści.</span>}
                    </div>
                  </div>

                  {/* AUTORYZOWANY FOLDER WORKSPACE */}
                  {activeArticle.drive_link && (
                    <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
                      <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-5 flex items-center justify-between group softly-lifted">
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                            <Shield size={16} className="text-blue-500" /> Oficjalny Folder Roboczy (Workspace)
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Umieszczaj pliki powiązane z tą procedurą wyłącznie w tym autoryzowanym miejscu.</p>
                        </div>
                        <a href={activeArticle.drive_link} target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all flex items-center gap-2 text-sm shadow-md group-hover:scale-105">
                          Otwórz Dysk <ExternalLink size={16} />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                <BookOpen size={48} className="mb-4 opacity-50" />
                <p className="font-medium">Wybierz dokument ze spisu treści po lewej stronie.</p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Tło w paski do ekranu budowy (czysty CSS, definiowany lokalnie) */}
      <style dangerouslySetInnerHTML={{__html: `
        .bg-stripes-slate {
          background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(100, 116, 139, 0.05) 10px, rgba(100, 116, 139, 0.05) 20px);
        }
      `}} />
    </div>
  )
}