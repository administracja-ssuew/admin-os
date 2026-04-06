'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../../components/Sidebar'
import ReactMarkdown from 'react-markdown'
import SkeletonLoader from '../../components/SkeletonLoader'
import {
  BookOpen, FileText, ExternalLink, HardHat, AlertTriangle, Shield,
  Search, Lock, ChevronRight, Save, Plus, Trash2, Download, Upload,
} from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '../../components/ConfirmDialog'

// ─── TYPES ──────────────────────────────────────────────────────────────────

type ArticleType = 'guide' | 'template' | 'regulation'

interface KnowledgeArticle {
  id: string
  title: string
  content: string | null
  drive_link: string | null
  category: string
  article_type: ArticleType
  file_url: string | null
  file_name: string | null
  updated_by: string | null
  updated_at: string | null
  updatedByUser?: { first_name: string; last_name: string } | null
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const ARTICLE_TYPE_CONFIG: Record<ArticleType, { label: string; classes: string }> = {
  guide: { label: 'Przewodnik', classes: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
  template: { label: 'Szablon', classes: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800' },
  regulation: { label: 'Regulacja', classes: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function KnowledgePage() {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeArticle, setActiveArticle] = useState<KnowledgeArticle | null>(null)
  const [currentUser, setCurrentUser] = useState<{ id: string; system_role: string } | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    title: '',
    content: '',
    drive_link: '',
    category: 'Procedury',
    article_type: 'guide' as ArticleType,
  })
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // WIP tabs hardcoded (nie zmieniaj — istniejący UX)
  const wipTabs = [
    { id: 'wip-1', title: 'Analiza wniosków o dotacje zewnętrzne', category: 'W Budowie' },
    { id: 'wip-2', title: 'Audyt umów użyczenia', category: 'W Budowie' },
    { id: 'wip-3', title: 'Procedura archiwizacji', category: 'W Budowie' },
  ]

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.email) {
      const { data: userData } = await supabase
        .from('users')
        .select('id, system_role')
        .eq('email', session.user.email)
        .single()
      if (userData) setCurrentUser(userData)
    }

    const { data } = await supabase
      .from('knowledge_articles')
      .select('*, updatedByUser:users!knowledge_articles_updated_by_fkey(first_name, last_name)')
      .order('title', { ascending: true })
    if (data) {
      setArticles(data as KnowledgeArticle[])
      if (data.length > 0 && !activeArticle) setActiveArticle(data[0] as KnowledgeArticle)
    }
    setLoading(false)
  }

  const handleSaveArticle = async () => {
    const toastId = toast.loading('Zapisywanie...')
    const payload = {
      ...editForm,
      updated_by: currentUser?.id ?? null,
      updated_at: new Date().toISOString(),
    }

    if (activeArticle?.id && !activeArticle.id.startsWith('wip-') && activeArticle.id !== 'new') {
      const { error } = await supabase.from('knowledge_articles').update(payload).eq('id', activeArticle.id)
      if (!error) {
        toast.success('Zaktualizowano!', { id: toastId })
        setIsEditing(false)
        fetchData()
      } else toast.error('Błąd zapisu', { id: toastId })
    } else {
      const { error } = await supabase.from('knowledge_articles').insert([payload])
      if (!error) {
        toast.success('Dodano artykuł!', { id: toastId })
        setIsEditing(false)
        fetchData()
      } else toast.error('Błąd zapisu', { id: toastId })
    }
  }

  const handleDeleteArticle = async (id: string) => {
    const toastId = toast.loading('Usuwanie...')
    const { error } = await supabase.from('knowledge_articles').delete().eq('id', id)
    if (!error) {
      toast.success('Artykuł usunięty', { id: toastId })
      setActiveArticle(null)
      fetchData()
    } else toast.error('Błąd usuwania', { id: toastId })
    setConfirmDeleteId(null)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeArticle?.id || activeArticle.id === 'new') return
    setIsUploading(true)
    const ext = file.name.split('.').pop()
    const path = `knowledge/${activeArticle.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('adminos-files').upload(path, file, { upsert: true })
    if (uploadError) {
      toast.error('Nie udało się wgrać pliku')
      setIsUploading(false)
      return
    }
    const { data: { publicUrl } } = supabase.storage.from('adminos-files').getPublicUrl(path)
    const { error: updateError } = await supabase
      .from('knowledge_articles')
      .update({ file_url: publicUrl, file_name: file.name, updated_by: currentUser?.id, updated_at: new Date().toISOString() })
      .eq('id', activeArticle.id)
    if (!updateError) {
      toast.success('Plik dołączony!')
      fetchData()
    } else {
      toast.error('Błąd zapisu pliku')
    }
    setIsUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const startNewArticle = () => {
    setActiveArticle({ id: 'new', title: 'Nowy Artykuł', category: 'Procedury', article_type: 'guide', content: null, drive_link: null, file_url: null, file_name: null, updated_by: null, updated_at: null })
    setEditForm({ title: '', content: '', drive_link: '', category: 'Procedury', article_type: 'guide' })
    setIsEditing(true)
  }

  const openArticle = (item: KnowledgeArticle | typeof wipTabs[0]) => {
    if ('article_type' in item) {
      setActiveArticle(item)
      setEditForm({ title: item.title, content: item.content || '', drive_link: item.drive_link || '', category: item.category, article_type: item.article_type })
      setIsEditing(false)
    } else {
      setActiveArticle(item as unknown as KnowledgeArticle)
      setIsEditing(false)
    }
  }

  const isAdmin = currentUser?.system_role === 'admin' || currentUser?.system_role === 'superadmin'

  const allItems = [...articles, ...wipTabs]
  const filteredItems = allItems.filter(a => a.title.toLowerCase().includes(searchTerm.toLowerCase()))
  const groupedItems = filteredItems.reduce((acc: Record<string, typeof allItems>, item) => {
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
          {/* LEWA: nawigacja */}
          <div className="w-1/3 flex flex-col gap-4">
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Szukaj w procedurach..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white bg-white dark:bg-slate-800 transition-colors shadow-sm softly-lifted"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors softly-lifted p-4 space-y-6">
              {loading && <SkeletonLoader variant="card" count={3} />}
              {!loading && Object.keys(groupedItems).map(category => (
                <div key={category}>
                  <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    {category === 'W Budowie' ? <HardHat size={14} className="text-orange-500" /> : <Shield size={14} />} {category}
                  </h3>
                  <div className="space-y-1">
                    {groupedItems[category].map((item) => {
                      const isActive = activeArticle?.id === item.id
                      const isWip = item.id.startsWith('wip-')
                      const typeCfg = 'article_type' in item && item.article_type ? ARTICLE_TYPE_CONFIG[item.article_type as ArticleType] : null
                      return (
                        <button
                          key={item.id}
                          onClick={() => openArticle(item as KnowledgeArticle)}
                          className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-between group ${isActive ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                        >
                          <span className="truncate pr-2 flex items-center gap-2">
                            {isWip ? <Lock size={14} className="text-slate-400" /> : <FileText size={14} className={isActive ? 'text-blue-500' : 'text-slate-400'} />}
                            {item.title}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {typeCfg && (
                              <span className={`hidden group-hover:inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border ${typeCfg.classes}`}>
                                {typeCfg.label}
                              </span>
                            )}
                            {isActive && <ChevronRight size={14} />}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PRAWA: czytnik / edytor */}
          <div className="w-2/3 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors softly-lifted flex flex-col overflow-hidden">
            {activeArticle ? (
              activeArticle.id.startsWith('wip-') ? (
                // WIP screen
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
                // Edit screen
                <div className="flex-1 flex flex-col h-full">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FileText className="text-blue-500" size={20} /> Tryb Edycji
                    </h2>
                    <div className="flex gap-2">
                      <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-sm transition-colors hover:bg-slate-200 dark:hover:bg-slate-600">Anuluj</button>
                      <button onClick={handleSaveArticle} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all text-sm flex items-center gap-2"><Save size={16} /> Zapisz</button>
                    </div>
                  </div>
                  <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Tytuł dokumentu</label>
                      <input type="text" className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-slate-900 dark:text-white" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Kategoria</label>
                        <select className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}>
                          <option value="Procedury">Procedury</option>
                          <option value="Regulaminy">Regulaminy</option>
                          <option value="Szablony">Szablony i Druki</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Typ artykułu</label>
                        <select className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={editForm.article_type} onChange={e => setEditForm({ ...editForm, article_type: e.target.value as ArticleType })}>
                          <option value="guide">Przewodnik</option>
                          <option value="template">Szablon</option>
                          <option value="regulation">Regulacja</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Link do Drive</label>
                        <input type="url" placeholder="https://drive.google.com/..." className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={editForm.drive_link} onChange={e => setEditForm({ ...editForm, drive_link: e.target.value })} />
                      </div>
                    </div>
                    <div className="flex-1 min-h-[300px] flex flex-col">
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Treść (Markdown)</label>
                      <textarea className="flex-1 w-full px-4 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none resize-none text-sm text-slate-800 dark:text-slate-200 leading-relaxed custom-scrollbar font-mono" value={editForm.content} onChange={e => setEditForm({ ...editForm, content: e.target.value })} placeholder="Wpisz treść w formacie Markdown..." rows={12} />
                    </div>
                  </div>
                </div>
              ) : (
                // Read screen
                <div className="flex-1 flex flex-col h-full">
                  <div className="p-8 border-b border-slate-100 dark:border-slate-700 shrink-0">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-slate-200 dark:border-slate-600">
                          {activeArticle.category}
                        </span>
                        {activeArticle.article_type && ARTICLE_TYPE_CONFIG[activeArticle.article_type] && (
                          <span className={`px-2 py-1 text-[10px] font-bold rounded border ${ARTICLE_TYPE_CONFIG[activeArticle.article_type].classes}`}>
                            {ARTICLE_TYPE_CONFIG[activeArticle.article_type].label}
                          </span>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-3">
                          {activeArticle.article_type === 'template' && (
                            <>
                              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                              <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="text-sm font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                              >
                                <Upload size={14} /> {isUploading ? 'Wgrywanie...' : 'Załącz plik'}
                              </button>
                            </>
                          )}
                          <button onClick={() => setIsEditing(true)} className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline">Edytuj treść</button>
                          <button onClick={() => setConfirmDeleteId(activeArticle.id)} className="text-sm font-bold text-red-500 hover:text-red-700 dark:hover:text-red-400 flex items-center gap-1 transition-colors"><Trash2 size={14} /> Usuń</button>
                        </div>
                      )}
                    </div>
                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">{activeArticle.title}</h2>
                    {activeArticle.updatedByUser && (
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        Ostatnia edycja: <span className="font-bold">{activeArticle.updatedByUser.first_name} {activeArticle.updatedByUser.last_name}</span>
                        {activeArticle.updated_at && ` · ${new Date(activeArticle.updated_at).toLocaleDateString('pl-PL')}`}
                      </p>
                    )}
                  </div>

                  <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                    {activeArticle.content ? (
                      <ReactMarkdown
                        components={{
                          h1: ({ children }) => <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-4 mt-6 pb-2 border-b border-slate-200 dark:border-slate-700">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-3 mt-5">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-2 mt-4">{children}</h3>,
                          p: ({ children }) => <p className="text-sm text-slate-700 dark:text-slate-300 mb-3 leading-relaxed">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-sm text-slate-700 dark:text-slate-300">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-sm text-slate-700 dark:text-slate-300">{children}</ol>,
                          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                          strong: ({ children }) => <strong className="font-bold text-slate-900 dark:text-white">{children}</strong>,
                          em: ({ children }) => <em className="italic text-slate-600 dark:text-slate-400">{children}</em>,
                          code: ({ children }) => <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400 rounded text-xs font-mono">{children}</code>,
                          pre: ({ children }) => <pre className="bg-slate-100 dark:bg-slate-900 rounded-xl p-4 mb-3 overflow-x-auto text-xs font-mono text-slate-800 dark:text-slate-200">{children}</pre>,
                          blockquote: ({ children }) => <blockquote className="pl-4 border-l-4 border-blue-300 dark:border-blue-700 italic text-slate-600 dark:text-slate-400 my-3">{children}</blockquote>,
                          hr: () => <hr className="border-slate-200 dark:border-slate-700 my-5" />,
                          a: ({ href, children }) => <a href={href} className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                          table: ({ children }) => <div className="overflow-x-auto mb-4"><table className="w-full text-sm border-collapse">{children}</table></div>,
                          th: ({ children }) => <th className="text-left px-3 py-2 bg-slate-100 dark:bg-slate-700 font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600">{children}</th>,
                          td: ({ children }) => <td className="px-3 py-2 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">{children}</td>,
                        }}
                      >
                        {activeArticle.content}
                      </ReactMarkdown>
                    ) : (
                      <span className="italic text-slate-400 dark:text-slate-500 text-sm">Ten artykuł nie posiada jeszcze wewnętrznej treści.</span>
                    )}
                  </div>

                  {/* Download dla szablonu */}
                  {activeArticle.article_type === 'template' && activeArticle.file_url && (
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border-t border-purple-100 dark:border-purple-800/30 shrink-0">
                      <a
                        href={activeArticle.file_url}
                        download={activeArticle.file_name || 'szablon'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-purple-700 dark:text-purple-400 font-bold text-sm hover:underline"
                      >
                        <Download size={16} /> Pobierz szablon: {activeArticle.file_name}
                      </a>
                    </div>
                  )}

                  {/* Folder Workspace */}
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

      <style dangerouslySetInnerHTML={{ __html: `.bg-stripes-slate { background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(100, 116, 139, 0.05) 10px, rgba(100, 116, 139, 0.05) 20px); }` }} />

      <ConfirmDialog
        isOpen={!!confirmDeleteId}
        title="Usuń artykuł"
        description="Tej operacji nie można cofnąć. Artykuł zostanie trwale usunięty z Bazy Wiedzy."
        confirmLabel="Usuń"
        variant="danger"
        onConfirm={() => confirmDeleteId && handleDeleteArticle(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
