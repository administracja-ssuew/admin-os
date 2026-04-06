'use client'

import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Search, Loader2, CheckCircle, Clock, XCircle, ArrowLeft, ShieldCheck, Copy, Check, RefreshCw } from 'lucide-react'
import Link from 'next/link'

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, {
  label: string
  description: string
  color: string
  dot: string
  icon: React.ReactNode
}> = {
  new: {
    label: 'Nowa',
    description: 'Wniosek wpłynął — oczekuje na przydzielenie do rozpatrzenia.',
    color: 'text-blue-700 bg-blue-50 border-blue-200',
    dot: 'bg-blue-500',
    icon: <Clock size={20} />,
  },
  in_progress: {
    label: 'W toku',
    description: 'Komisja aktywnie rozpatruje Twój wniosek.',
    color: 'text-orange-700 bg-orange-50 border-orange-200',
    dot: 'bg-orange-500 animate-pulse',
    icon: <Loader2 size={20} className="animate-spin" />,
  },
  closed: {
    label: 'Zamknięta',
    description: 'Sprawa została zamknięta. Odpowiedź powinna trafić na Twój e-mail.',
    color: 'text-green-700 bg-green-50 border-green-200',
    dot: 'bg-green-500',
    icon: <CheckCircle size={20} />,
  },
}

// Fallback dla nieznanych statusów
const FALLBACK_STATUS = {
  label: 'Nieznany status',
  description: 'Skontaktuj się z Komisją, podając numer sprawy.',
  color: 'text-slate-600 bg-slate-50 border-slate-200',
  dot: 'bg-slate-400',
  icon: <RefreshCw size={20} />,
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function WniosekStatusPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    case_number: string
    status: string
    created_at: string
    case_type: string
  } | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleSearch = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    const trimmed = query.trim().toUpperCase()
    if (!trimmed) return
    setLoading(true)
    setResult(null)
    setNotFound(false)

    const { data } = await supabase
      .from('cases')
      .select('case_number, status, created_at, case_type')
      .eq('case_number', trimmed)
      .eq('source', 'Formularz Zewnętrzny')
      .single()

    if (!data) {
      setNotFound(true)
    } else {
      setResult(data)
    }
    setLoading(false)
  }

  const copyNumber = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.case_number)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const statusCfg = result ? (STATUS_CONFIG[result.status] ?? FALLBACK_STATUS) : null

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden">

      <div className="w-full max-w-md relative z-10">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
            <ShieldCheck size={28} />
          </div>
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Komisja Weryfikacyjna</p>
          <h1 className="text-2xl font-extrabold text-white mb-1">Sprawdź Status Wniosku</h1>
          <p className="text-slate-400 text-sm">Podaj numer sprawy, który otrzymałeś po złożeniu wniosku.</p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-100">

          {/* Formularz wyszukiwania */}
          <form onSubmit={handleSearch} className="mb-6">
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">
              Numer sprawy
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="WNI/2026/1234"
                value={query}
                onChange={e => setQuery(e.target.value.toUpperCase())}
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-900 font-mono text-sm uppercase placeholder-slate-300 tracking-wider"
                autoComplete="off"
                spellCheck="false"
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 ml-0.5">Format: WNI/RRRR/XXXX (litery wielkie, cyfry)</p>
          </form>

          {/* Wynik */}
          {result && statusCfg && (
            <div className="space-y-4 animate-fade-in">
              {/* Status badge */}
              <div className={`flex items-start gap-3 p-4 rounded-xl border ${statusCfg.color}`}>
                <div className="mt-0.5 shrink-0">{statusCfg.icon}</div>
                <div>
                  <p className="font-extrabold text-sm">{statusCfg.label}</p>
                  <p className="text-xs mt-0.5 opacity-80">{statusCfg.description}</p>
                </div>
                <div className={`w-2 h-2 rounded-full mt-1.5 ml-auto shrink-0 ${statusCfg.dot}`} />
              </div>

              {/* Szczegóły */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-100">
                <div className="px-4 py-3 flex justify-between items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Numer sprawy</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-extrabold text-blue-600 tracking-wider">{result.case_number}</span>
                    <button
                      onClick={copyNumber}
                      title="Kopiuj"
                      className={`p-1 rounded transition-all ${copied ? 'text-green-500' : 'text-slate-400 hover:text-slate-700'}`}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <div className="px-4 py-3 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kategoria</span>
                  <span className="text-sm font-bold text-slate-700">{result.case_type}</span>
                </div>
                <div className="px-4 py-3 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data złożenia</span>
                  <span className="text-sm font-bold text-slate-700">
                    {new Date(result.created_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Szukaj kolejnego */}
              <button
                onClick={() => { setResult(null); setQuery('') }}
                className="w-full py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <Search size={14} /> Sprawdź inny numer
              </button>
            </div>
          )}

          {/* Nie znaleziono */}
          {notFound && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">
                <XCircle size={18} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm">Nie znaleziono wniosku</p>
                  <p className="text-xs mt-0.5 opacity-80">
                    Upewnij się, że numer jest poprawny (format: WNI/RRRR/XXXX) i że wniosek został złożony przez formularz zewnętrzny.
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setNotFound(false); setQuery('') }}
                className="w-full py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Spróbuj ponownie
              </button>
            </div>
          )}

          {/* Linki nawigacyjne */}
          <div className="mt-6 flex items-center justify-between text-sm font-bold">
            <Link
              href="/wniosek"
              className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1"
            >
              <ArrowLeft size={14} /> Złóż nowy wniosek
            </Link>
          </div>
        </div>
      </div>

      {/* Tło */}
      <div className="fixed inset-0 bg-slate-900 -z-20" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 w-[600px] h-[600px] rounded-full bg-blue-900/20 blur-[100px]" />
    </div>
  )
}
