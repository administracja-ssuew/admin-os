'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../../components/Sidebar'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import {
  FileText, RefreshCw, ChevronDown, ChevronUp,
  AlertCircle, Clock, CheckCircle, Pause, Search,
  MessageSquare, User, Calendar, ExternalLink,
  Filter, SortDesc, Loader2, Lock
} from 'lucide-react'

// ─── KONFIGURACJA ────────────────────────────────────────────────
// Wklej URL swojego wdrożonego Apps Script (Wdróż → Aplikacja internetowa)
const CRED_URL = '/api/cred'

// Dostępne statusy do zmiany
const STATUSY = [
  'NOWA', 'W TRAKCIE', 'OCZEKUJE NA WNIOSKODAWCĘ',
  'PODPIS WŁADZ', 'POPRAWKI', 'WSTRZYMANE',
  'ZAKOŃCZONE', 'ZREALIZOWANE', 'ODRZUCONE', 'ANULOWANE'
]

// ─── HELPERS ─────────────────────────────────────────────────────
async function credFetch(params: Record<string, string>) {
  const { data: { session } } = await supabase.auth.getSession()
  const qs = new URLSearchParams({ ...params }).toString()
  return fetch(`${CRED_URL}?${qs}`, {
    headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
  }).then(r => r.json())
}

function slaClass(state: string) {
  if (state === 'overdue') return 'text-red-600 dark:text-red-400 font-bold'
  if (state === 'danger')  return 'text-orange-600 dark:text-orange-400 font-bold'
  if (state === 'warning') return 'text-yellow-600 dark:text-yellow-400'
  return 'text-slate-500 dark:text-slate-400'
}

function slaDot(state: string) {
  if (state === 'overdue') return 'bg-red-500 animate-pulse'
  if (state === 'danger')  return 'bg-orange-500 animate-pulse'
  if (state === 'warning') return 'bg-yellow-500'
  if (state === 'ok')      return 'bg-green-500'
  return 'bg-slate-300 dark:bg-slate-600'
}

function scoreColor(score: number) {
  if (score >= 60) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  if (score >= 35) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
}

function statusBadgeClass(status: string) {
  const s = status.toUpperCase()
  if (s === 'NOWA')                          return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  if (['ZAKOŃCZONE','ZREALIZOWANE'].some(x => s.includes(x))) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
  if (['ODRZUCONE','ANULOWANE'].some(x => s.includes(x)))     return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  if (['OCZEKUJE','PODPIS','POPRAWKI','WSTRZYMANE'].some(x => s.includes(x))) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
  return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
}

function akcjaIcon(akcja: string) {
  if (akcja === 'ZMIANA_STATUSU')       return '🔄'
  if (akcja === 'NOTATKA_WEWNETRZNA')   return '📝'
  if (akcja === 'ZMIANA_PROWADZACEGO')  return '👤'
  if (akcja === 'ZMIANA_SLA')           return '📅'
  return '⚙️'
}

// ─── TYPY ────────────────────────────────────────────────────────
interface Sprawa {
  znak: string; typ: string; podmiot: string; tytul: string
  status: string; prowadzacy: string; email: string
  dataWplywu: string; termin: string; folderUrl: string
  slaState: string; daysLeft: number | null; isPaused: boolean; score: number
}

interface AuditEntry {
  timestamp: string; akcja: string; stara: string
  nowa: string; autor: string; zrodlo: string
}

interface SzczegolySpr extends Sprawa {
  auditLog: AuditEntry[]; akceptujacy: string
}

// ─── KOMPONENT GŁÓWNY ────────────────────────────────────────────
export default function CREDPage() {
  const { isAdmin } = useCurrentUser()
  const [sprawy, setSprawy]           = useState<Sprawa[]>([])
  const [loading, setLoading]         = useState(true)
  const [lastUpdate, setLastUpdate]   = useState<Date | null>(null)
  const [search, setSearch]           = useState('')
  const [filterSLA, setFilterSLA]     = useState<string>('all')
  const [selectedZnak, setSelectedZnak] = useState<string | null>(null)
  const [szczegoly, setSzczegoly]     = useState<SzczegolySpr | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null)

  // Panel akcji
  const [nowaNotatka, setNowaNotatka] = useState('')
  const [nowyStatus, setNowyStatus]   = useState('')
  const [nowyOwner, setNowyOwner]     = useState('')
  const [nowySLA, setNowySLA]         = useState('')

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const loadList = useCallback(async () => {
    try {
      setLoading(true)
      const data = await credFetch({ action: 'list' })
      if (data.error) throw new Error(data.error)
      setSprawy(data.cases || [])
      setLastUpdate(new Date())
    } catch (e: any) {
      showToast('Błąd ładowania: ' + e.message, false)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDetails = useCallback(async (znak: string) => {
    setDetailLoading(true)
    setSzczegoly(null)
    try {
      const data = await credFetch({ action: 'getCase', znak })
      if (data.error) throw new Error(data.error)
      setSzczegoly(data)
      setNowyStatus(data.status || '')
      setNowyOwner(data.prowadzacy || '')
      setNowySLA(data.termin || '')
    } catch (e: any) {
      showToast('Błąd ładowania szczegółów: ' + e.message, false)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => { loadList() }, [loadList])

  // Auto-refresh co 30s
  useEffect(() => {
    const id = setInterval(loadList, 30_000)
    return () => clearInterval(id)
  }, [loadList])

  const handleSelectZnak = (znak: string) => {
    if (selectedZnak === znak) { setSelectedZnak(null); setSzczegoly(null); return }
    setSelectedZnak(znak)
    loadDetails(znak)
  }

  const handleAction = async (action: string, params: Record<string, string>, successMsg: string) => {
    if (!selectedZnak) return
    setActionLoading(true)
    try {
      const data = await credFetch({ action, znak: selectedZnak, ...params })
      if (data.error) throw new Error(data.error)
      showToast(successMsg)
      await Promise.all([loadList(), loadDetails(selectedZnak)])
      if (action === 'addNote') setNowaNotatka('')
    } catch (e: any) {
      showToast('Błąd: ' + e.message, false)
    } finally {
      setActionLoading(false)
    }
  }

  // Filtrowanie i wyszukiwanie
  const filtered = sprawy.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !q || [s.znak, s.podmiot, s.tytul, s.typ, s.prowadzacy]
      .some(v => v.toLowerCase().includes(q))
    const matchSLA =
      filterSLA === 'all'     ? true :
      filterSLA === 'overdue' ? s.slaState === 'overdue' :
      filterSLA === 'urgent'  ? ['overdue','danger','warning'].includes(s.slaState) :
      filterSLA === 'paused'  ? s.isPaused : true
    return matchSearch && matchSLA
  })

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <Sidebar />

      <div className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">

        {/* ── HEADER ─────────────────────────────────────────────── */}
        <div className="shrink-0 px-8 pt-8 pb-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <FileText className="text-amber-500" size={28} />
                Zarządzanie sprawami CRED
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                {lastUpdate
                  ? `Ostatnia aktualizacja: ${lastUpdate.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                  : 'Ładowanie...'}
                {' · '}{sprawy.length} aktywnych spraw
              </p>
            </div>
            <button
              onClick={loadList}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Odśwież
            </button>
          </div>

          {/* Pasek filtrów */}
          <div className="flex gap-3 items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Szukaj znaku, podmiotu, tytułu..."
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-amber-400 transition-colors"
              />
            </div>
            {(['all','urgent','overdue','paused'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterSLA(f)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors border ${
                  filterSLA === f
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-amber-300'
                }`}
              >
                {{ all: 'Wszystkie', urgent: '⚠️ Pilne', overdue: '🚨 Po terminie', paused: '⏳ Zamrożone' }[f]}
              </button>
            ))}
          </div>
        </div>

        {/* ── GŁÓWNY PANEL ────────────────────────────────────────── */}
        <div className="flex flex-1 gap-0 min-h-0 px-8 pb-8">

          {/* Lista spraw */}
          <div className={`flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden transition-all ${selectedZnak ? 'w-[45%] mr-4' : 'flex-1'}`}>
            {loading && sprawy.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="animate-spin text-amber-500" size={32} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm font-medium">
                Brak spraw spełniających kryteria.
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {/* Nagłówek tabeli */}
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 sticky top-0 z-10">
                  {['Znak / Tytuł', 'Podmiot', 'Status', 'SLA', 'Priorytet'].map(h => (
                    <span key={h} className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{h}</span>
                  ))}
                </div>

                {filtered.map(s => (
                  <div
                    key={s.znak}
                    onClick={() => handleSelectZnak(s.znak)}
                    className={`grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-2 px-4 py-3 border-b border-slate-50 dark:border-slate-700/50 cursor-pointer transition-colors ${
                      selectedZnak === s.znak
                        ? 'bg-amber-50 dark:bg-amber-900/10 border-l-2 border-l-amber-500'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                    } ${s.isPaused ? 'opacity-60' : ''}`}
                  >
                    {/* Znak + tytuł */}
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 truncate">{s.znak}</div>
                      <div className="text-sm text-slate-700 dark:text-slate-300 truncate mt-0.5">{s.tytul}</div>
                    </div>
                    {/* Podmiot */}
                    <div className="flex items-center">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400 truncate">{s.podmiot || '—'}</span>
                    </div>
                    {/* Status */}
                    <div className="flex items-center">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md truncate ${statusBadgeClass(s.status)}`}>
                        {s.isPaused ? '⏳ ' : ''}{s.status || '—'}
                      </span>
                    </div>
                    {/* SLA */}
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${slaDot(s.slaState)}`} />
                      <span className={`text-xs ${slaClass(s.slaState)}`}>
                        {s.slaState === 'overdue'
                          ? `${Math.abs(s.daysLeft ?? 0)}d temu`
                          : s.daysLeft !== null
                            ? `${s.daysLeft}d`
                            : '—'}
                      </span>
                    </div>
                    {/* Score */}
                    <div className="flex items-center justify-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${scoreColor(s.score)}`}>
                        {s.score}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Panel szczegółów */}
          {selectedZnak && (
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">

              {detailLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="animate-spin text-amber-500" size={32} />
                </div>
              ) : szczegoly ? (
                <div className="flex-1 overflow-y-auto">

                  {/* Nagłówek szczegółów */}
                  <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-bold text-amber-600 dark:text-amber-400">{szczegoly.znak}</div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1 leading-tight">{szczegoly.tytul}</h2>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className={`text-xs font-bold px-2 py-1 rounded-md ${statusBadgeClass(szczegoly.status)}`}>{szczegoly.status}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{szczegoly.typ} · {szczegoly.podmiot}</span>
                        </div>
                      </div>
                      {szczegoly.folderUrl && (
                        <a href={szczegoly.folderUrl} target="_blank" rel="noreferrer"
                          className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-xl hover:bg-amber-100 transition-colors border border-amber-200 dark:border-amber-800"
                        >
                          <ExternalLink size={14} /> Akta Drive
                        </a>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
                      <div><span className="text-slate-400 block mb-0.5">Wnioskodawca</span><span className="font-bold text-slate-700 dark:text-slate-300 truncate block">{szczegoly.email || '—'}</span></div>
                      <div><span className="text-slate-400 block mb-0.5">Wpłynęło</span><span className="font-bold text-slate-700 dark:text-slate-300">{szczegoly.dataWplywu || '—'}</span></div>
                      <div><span className="text-slate-400 block mb-0.5">Termin SLA</span><span className={`font-bold ${slaClass(szczegoly.slaState || 'none')}`}>{szczegoly.termin || '—'}</span></div>
                    </div>
                  </div>

                  {/* Akcje — tylko dla adminów */}
                  {isAdmin ? (
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 space-y-4">
                      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Akcje</h3>

                      {/* Zmiana statusu */}
                      <div className="flex gap-2">
                        <select
                          value={nowyStatus}
                          onChange={e => setNowyStatus(e.target.value)}
                          className="flex-1 text-sm px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-amber-400"
                        >
                          {STATUSY.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button
                          onClick={() => handleAction('setStatus', { value: nowyStatus }, `Status zmieniony na: ${nowyStatus}`)}
                          disabled={actionLoading || nowyStatus === szczegoly.status}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                          {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                          Zmień
                        </button>
                      </div>

                      {/* Prowadzący */}
                      <div className="flex gap-2">
                        <input
                          value={nowyOwner}
                          onChange={e => setNowyOwner(e.target.value)}
                          placeholder="email prowadzącego..."
                          className="flex-1 text-sm px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-amber-400 placeholder:text-slate-400"
                        />
                        <button
                          onClick={() => handleAction('setOwner', { email: nowyOwner }, 'Prowadzący zaktualizowany')}
                          disabled={actionLoading || !nowyOwner}
                          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                          <User size={14} /> Przypisz
                        </button>
                      </div>

                      {/* Termin SLA */}
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={nowySLA}
                          onChange={e => setNowySLA(e.target.value)}
                          className="flex-1 text-sm px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-amber-400"
                        />
                        <button
                          onClick={() => handleAction('setSLA', { date: nowySLA }, 'Termin SLA zaktualizowany')}
                          disabled={actionLoading || !nowySLA}
                          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                          <Calendar size={14} /> Ustaw SLA
                        </button>
                      </div>

                      {/* Notatka */}
                      <div className="space-y-2">
                        <textarea
                          value={nowaNotatka}
                          onChange={e => setNowaNotatka(e.target.value)}
                          placeholder="Notatka wewnętrzna (niewidoczna dla wnioskodawcy)..."
                          rows={2}
                          className="w-full text-sm px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-amber-400 resize-none placeholder:text-slate-400"
                        />
                        <button
                          onClick={() => handleAction('addNote', { text: encodeURIComponent(nowaNotatka) }, 'Notatka zapisana')}
                          disabled={actionLoading || !nowaNotatka.trim()}
                          className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                        >
                          <MessageSquare size={14} /> Dodaj notatkę
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                        <Lock size={16} className="text-slate-400 flex-shrink-0" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Widok tylko do odczytu. Akcje dostępne wyłącznie dla Zarządu.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Audit Log — historia */}
                  <div className="px-6 py-4">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                      Historia ({szczegoly.auditLog?.length ?? 0})
                    </h3>
                    {!szczegoly.auditLog || szczegoly.auditLog.length === 0 ? (
                      <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">Brak wpisów w historii.</p>
                    ) : (
                      <div className="space-y-2">
                        {szczegoly.auditLog.map((entry, i) => (
                          <div key={i} className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="text-xl shrink-0 mt-0.5">{akcjaIcon(entry.akcja)}</div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                  {entry.akcja.replace(/_/g, ' ')}
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                                  {entry.timestamp} · {entry.autor}
                                </span>
                              </div>
                              {entry.akcja === 'NOTATKA_WEWNETRZNA' ? (
                                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{entry.nowa}</p>
                              ) : entry.nowa ? (
                                <div className="flex items-center gap-2 mt-1 text-xs">
                                  {entry.stara && <span className="text-slate-400 line-through">{entry.stara}</span>}
                                  {entry.stara && <span className="text-slate-400">→</span>}
                                  <span className="font-bold text-slate-700 dark:text-slate-300">{entry.nowa}</span>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold text-white transition-all ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.ok ? '✅' : '❌'} {toast.msg}
        </div>
      )}
    </div>
  )
}
