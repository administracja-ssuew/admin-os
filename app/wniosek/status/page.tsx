'use client'

import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Search, Loader2, CheckCircle, Clock, AlertCircle, Briefcase, ArrowLeft, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  new: { label: 'Nowa — Oczekuje na rozpatrzenie', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: <Clock size={20} /> },
  in_progress: { label: 'W toku — Trwa rozpatrywanie', color: 'text-orange-600 bg-orange-50 border-orange-200', icon: <Loader2 size={20} className="animate-spin" /> },
  closed: { label: 'Zamknięta — Sprawa zakończona', color: 'text-green-600 bg-green-50 border-green-200', icon: <CheckCircle size={20} /> },
}

export default function WniosekStatusPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim().toUpperCase()
    if (!trimmed) return
    setLoading(true)
    setResult(null)
    setNotFound(false)
    setError('')

    const { data, error: err } = await supabase
      .from('cases')
      .select('case_number, status, created_at, case_type')
      .eq('case_number', trimmed)
      .eq('source', 'Formularz Zewnętrzny')
      .single()

    if (err || !data) {
      setNotFound(true)
    } else {
      setResult(data)
    }

    setLoading(false)
  }

  const statusCfg = result ? (STATUS_CONFIG[result.status] ?? { label: result.status, color: 'text-slate-600 bg-slate-50 border-slate-200', icon: <AlertCircle size={20} /> }) : null

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden">

      <div className="w-full max-w-md relative z-10">

        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
            <ShieldCheck size={28} />
          </div>
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Komisja Weryfikacyjna</p>
          <h1 className="text-2xl font-extrabold text-white mb-1">Sprawdź Status Wniosku</h1>
          <p className="text-slate-400 text-sm">Podaj numer sprawy, który otrzymałeś po złożeniu wniosku.</p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-100">

          <form onSubmit={handleSearch} className="mb-6">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Numer sprawy</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="np. WNI/2026/1234"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-900 font-mono text-sm uppercase placeholder-slate-300"
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              </button>
            </div>
          </form>

          {/* Wynik */}
          {result && statusCfg && (
            <div className="space-y-4">
              <div className={`flex items-center gap-3 p-4 rounded-xl border font-bold ${statusCfg.color}`}>
                {statusCfg.icon}
                <span className="text-sm">{statusCfg.label}</span>
              </div>
              <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-100">
                <div className="px-4 py-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase">Numer sprawy</span>
                  <span className="font-mono text-sm font-bold text-blue-600">{result.case_number}</span>
                </div>
                <div className="px-4 py-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase">Kategoria</span>
                  <span className="text-sm font-bold text-slate-700">{result.case_type}</span>
                </div>
                <div className="px-4 py-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase">Data złożenia</span>
                  <span className="text-sm font-bold text-slate-700">{new Date(result.created_at).toLocaleDateString('pl-PL')}</span>
                </div>
              </div>
            </div>
          )}

          {notFound && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl font-bold text-sm">
              <AlertCircle size={18} className="shrink-0" />
              Nie znaleziono wniosku o podanym numerze. Sprawdź pisownię — numer ma format WNI/RRRR/XXXX.
            </div>
          )}

          <div className="mt-6 text-center">
            <Link href="/wniosek" className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-1">
              <ArrowLeft size={14} /> Wróć do formularza
            </Link>
          </div>
        </div>
      </div>

      <div className="fixed inset-0 bg-slate-900 -z-20"></div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 w-[800px] h-[800px] rounded-full bg-blue-900/20 blur-[120px]"></div>
    </div>
  )
}
