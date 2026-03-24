'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Search, Briefcase, CheckSquare, X, Command, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ cases: any[], tasks: any[] }>({ cases: [], tasks: [] })
  const [loading, setLoading] = useState(false)

  // Nasłuchiwanie skrótu klawiszowego Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Pobieranie danych z bazy na żywo
  useEffect(() => {
    if (!query.trim()) {
      setResults({ cases: [], tasks: [] })
      return
    }

    const searchDb = async () => {
      setLoading(true)
      
      const [casesRes, tasksRes] = await Promise.all([
        supabase.from('cases').select('id, title, case_number').ilike('title', `%${query}%`).limit(4),
        supabase.from('tasks').select('id, title, status').ilike('title', `%${query}%`).limit(4)
      ])

      setResults({
        cases: casesRes.data || [],
        tasks: tasksRes.data || []
      })
      setLoading(false)
    }

    // Debounce (czekamy 300ms po wpisaniu litery, żeby nie zabić bazy zapytań)
    const delay = setTimeout(searchDb, 300)
    return () => clearTimeout(delay)
  }, [query])

  if (!isOpen) return null

  const closeModal = () => {
    setIsOpen(false)
    setQuery('')
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-start justify-center pt-[15vh] p-4 transition-opacity">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
        
        {/* Pasek wyszukiwania */}
        <div className="relative flex items-center p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <Search size={24} className="text-blue-500 absolute left-6" />
          <input 
            type="text" 
            autoFocus
            placeholder="Szukaj w sprawach i zadaniach..." 
            className="w-full pl-12 pr-10 py-3 bg-transparent text-lg text-slate-900 dark:text-white outline-none font-medium placeholder-slate-400 dark:placeholder-slate-500"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading ? (
            <Loader2 size={20} className="text-slate-400 absolute right-6 animate-spin" />
          ) : (
            <button onClick={closeModal} className="absolute right-6 p-1 bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-md transition-colors">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Wyniki wyszukiwania */}
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
          {!query && (
            <div className="p-10 text-center text-slate-400 dark:text-slate-500 font-medium flex flex-col items-center gap-3">
              <Command size={32} className="opacity-50" />
              Zacznij pisać, aby przeszukać cały system.
            </div>
          )}

          {query && results.cases.length === 0 && results.tasks.length === 0 && !loading && (
            <div className="p-10 text-center text-slate-400 dark:text-slate-500 font-medium">
              Nic nie znaleziono dla "{query}".
            </div>
          )}

          {results.cases.length > 0 && (
            <div className="mb-4">
              <h3 className="px-4 py-2 text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Briefcase size={12}/> Znalezione Sprawy
              </h3>
              <div className="flex flex-col gap-1 px-2">
                {results.cases.map(c => (
                  <Link key={c.id} href="/cases" onClick={closeModal} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group">
                    <span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{c.title}</span>
                    <span className="text-xs font-mono text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded">{c.case_number}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {results.tasks.length > 0 && (
            <div>
              <h3 className="px-4 py-2 text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <CheckSquare size={12}/> Znalezione Zadania
              </h3>
              <div className="flex flex-col gap-1 px-2">
                {results.tasks.map(t => (
                  <Link key={t.id} href="/tasks" onClick={closeModal} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group">
                    <span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">{t.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 p-3 text-center">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Wciśnij ESC aby zamknąć</span>
        </div>
      </div>
    </div>
  )
}