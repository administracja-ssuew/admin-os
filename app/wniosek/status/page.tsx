'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { normalizeCaseNumber } from '../../../lib/request-status'
import { Search, Loader2, CheckCircle, Clock, XCircle, ArrowLeft, ShieldCheck, Copy, Check, Inbox, Mail } from 'lucide-react'
import Link from 'next/link'

// ─── ETAPY WNIOSKU ────────────────────────────────────────────────────────────

const STEPS = [
  { status: 'new', label: 'Złożony', description: 'Wniosek wpłynął i czeka na przydzielenie do rozpatrzenia.', icon: Inbox },
  { status: 'in_progress', label: 'W toku', description: 'Komisja rozpatruje Twój wniosek.', icon: Clock },
  { status: 'closed', label: 'Zakończony', description: 'Sprawa została zamknięta. Odpowiedź trafi na Twój e-mail.', icon: CheckCircle },
] as const

interface RequestStatus {
  case_number: string
  status: string
  created_at: string
  closed_at: string | null
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })

// ─── KOMPONENT ────────────────────────────────────────────────────────────────

export default function WniosekStatusPage() {
  // Link z e-maila potwierdzającego: /wniosek/status?nr=WNI/2026/0007
  const searchParams = useSearchParams()
  const [caseNumber, setCaseNumber] = useState(() => normalizeCaseNumber(searchParams.get('nr') ?? ''))
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RequestStatus | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)

  const reset = () => {
    setResult(null)
    setNotFound(false)
    setFailed(false)
  }

  const handleSearch = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    const nr = normalizeCaseNumber(caseNumber)
    if (!nr || !email.trim()) return
    setCaseNumber(nr)
    setLoading(true)
    reset()

    const { data, error } = await supabase.rpc('public_request_status', { p_case_number: nr, p_email: email.trim() })
    if (error) setFailed(true)
    else if (!data || data.length === 0) setNotFound(true)
    else setResult(data[0] as RequestStatus)
    setLoading(false)
  }

  const copyNumber = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.case_number)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const stepIndex = result ? STEPS.findIndex(s => s.status === result.status) : -1
  const currentStep = stepIndex >= 0 ? STEPS[stepIndex] : null

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="w-full max-w-md relative z-10">

        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
            <ShieldCheck size={28} />
          </div>
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Komisja Weryfikacyjna</p>
          <h1 className="text-2xl font-extrabold text-white mb-1">Sprawdź status wniosku</h1>
          <p className="text-slate-400 text-sm">Podaj numer sprawy i adres e-mail, który wpisałeś we wniosku.</p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-100">

          {!result && (
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label htmlFor="nr" className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">
                  Numer sprawy
                </label>
                <input
                  id="nr"
                  type="text"
                  placeholder="WNI/2026/0001"
                  value={caseNumber}
                  onChange={e => setCaseNumber(e.target.value.toUpperCase())}
                  onBlur={() => setCaseNumber(normalizeCaseNumber(caseNumber))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-900 font-mono text-sm uppercase placeholder-slate-300 tracking-wider"
                  autoComplete="off"
                  spellCheck="false"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1.5 ml-0.5">Numer znajdziesz w e-mailu potwierdzającym złożenie wniosku.</p>
              </div>
              <div>
                <label htmlFor="email" className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">
                  E-mail z wniosku
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    id="email"
                    type="email"
                    placeholder="adres@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-900 text-sm placeholder-slate-300"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !caseNumber.trim() || !email.trim()}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                Sprawdź status
              </button>
            </form>
          )}

          {(notFound || failed) && (
            <div className="mt-5 flex items-start gap-3 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl" role="alert">
              <XCircle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">{failed ? 'Nie udało się sprawdzić statusu' : 'Nie znaleziono wniosku'}</p>
                <p className="text-xs mt-0.5 opacity-80">
                  {failed
                    ? 'Spróbuj ponownie za chwilę.'
                    : 'Sprawdź numer sprawy i podaj ten sam adres e-mail, który został wpisany we wniosku.'}
                </p>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-5 animate-fade-in">
              {/* Bieżący etap */}
              <div className="flex items-start gap-3 p-4 rounded-xl border bg-blue-50 border-blue-200 text-blue-800">
                {currentStep ? <currentStep.icon size={20} className="mt-0.5 shrink-0" /> : <Clock size={20} className="mt-0.5 shrink-0" />}
                <div>
                  <p className="font-extrabold text-sm">{currentStep?.label ?? 'Status nieznany'}</p>
                  <p className="text-xs mt-0.5 opacity-80">
                    {currentStep?.description ?? 'Skontaktuj się z Komisją, podając numer sprawy.'}
                  </p>
                </div>
              </div>

              {/* Oś etapów */}
              <ol className="flex items-start">
                {STEPS.map((step, i) => {
                  const done = stepIndex >= i
                  return (
                    <li key={step.status} className="flex-1 flex flex-col items-center text-center relative">
                      {i > 0 && (
                        <span className={`absolute top-3 right-1/2 w-full h-0.5 -z-0 ${stepIndex >= i ? 'bg-blue-500' : 'bg-slate-200'}`} />
                      )}
                      <span className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        done ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                      }`}>
                        {done ? <Check size={12} /> : i + 1}
                      </span>
                      <span className={`mt-1.5 text-[11px] font-bold ${done ? 'text-slate-800' : 'text-slate-400'}`}>{step.label}</span>
                    </li>
                  )
                })}
              </ol>

              {/* Szczegóły */}
              <dl className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-100">
                <div className="px-4 py-3 flex justify-between items-center gap-2">
                  <dt className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Numer sprawy</dt>
                  <dd className="flex items-center gap-2">
                    <span className="font-mono text-sm font-extrabold text-blue-600 tracking-wider">{result.case_number}</span>
                    <button
                      onClick={copyNumber}
                      title="Kopiuj numer"
                      aria-label="Kopiuj numer"
                      className={`p-1 rounded transition-all ${copied ? 'text-green-500' : 'text-slate-400 hover:text-slate-700'}`}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </dd>
                </div>
                <div className="px-4 py-3 flex justify-between items-center">
                  <dt className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data złożenia</dt>
                  <dd className="text-sm font-bold text-slate-700">{formatDate(result.created_at)}</dd>
                </div>
                {result.closed_at && (
                  <div className="px-4 py-3 flex justify-between items-center">
                    <dt className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data zamknięcia</dt>
                    <dd className="text-sm font-bold text-slate-700">{formatDate(result.closed_at)}</dd>
                  </div>
                )}
              </dl>

              <button
                onClick={() => { reset(); setCaseNumber('') }}
                className="w-full py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <Search size={14} /> Sprawdź inny wniosek
              </button>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between text-sm font-bold">
            <Link href="/wniosek" className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1">
              <ArrowLeft size={14} /> Złóż nowy wniosek
            </Link>
          </div>
        </div>
      </div>

      <div className="fixed inset-0 bg-slate-900 -z-20" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 w-[600px] h-[600px] rounded-full bg-blue-900/20 blur-[100px]" />
    </div>
  )
}
