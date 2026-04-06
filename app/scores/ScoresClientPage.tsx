'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  ChevronLeft, ChevronRight, Save, Loader2, Trophy,
  Lock, Edit2, Check, X, Info,
  Star, Activity, Award
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const MONTH_NAMES = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień']

interface Member {
  id: string
  first_name: string
  last_name: string
  email: string
  org_function: string | null
  system_role: string
  personal_limit: number | null
  departments: { name: string }[] | null
}

interface ScoreRow {
  userId: string
  activity: string
  quality: string
  notes: string
  saved: boolean
  saving: boolean
  editingLimit: boolean
  limitInput: string
}

function getScoreColor(pct: number) {
  if (pct >= 90) return 'text-emerald-600 dark:text-emerald-400'
  if (pct >= 70) return 'text-blue-600 dark:text-blue-400'
  if (pct >= 50) return 'text-yellow-600 dark:text-yellow-400'
  if (pct >= 25) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-500 dark:text-red-400'
}

function getMedalIcon(rank: number) {
  if (rank === 1) return <span className="text-yellow-400 text-lg">🥇</span>
  if (rank === 2) return <span className="text-slate-400 text-lg">🥈</span>
  if (rank === 3) return <span className="text-amber-600 text-lg">🥉</span>
  return <span className="text-slate-400 font-bold text-sm">#{rank}</span>
}

function PercentBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-blue-500' : pct >= 50 ? 'bg-yellow-500' : pct >= 25 ? 'bg-orange-500' : 'bg-red-500'
  return (
    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  )
}

export default function ScoresClientPage() {
  const router = useRouter()

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)

  const [members, setMembers] = useState<Member[]>([])
  const [rows, setRows] = useState<Record<string, ScoreRow>>({})
  const [loading, setLoading] = useState(true)
  const [showRanking, setShowRanking] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)

    // Client-side role guard
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.email) { router.replace('/login'); return }
    const { data: me } = await supabase.from('users').select('system_role').eq('email', session.user.email).single()
    if (!me || me.system_role !== 'superadmin') { router.replace('/'); return }

    // Pobierz wszystkich aktywnych Członków (active, admin, superadmin)
    const { data: membersData } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, org_function, system_role, personal_limit, departments(name)')
      .in('system_role', ['active', 'admin', 'superadmin'])
      .order('last_name', { ascending: true })

    // Pobierz wyniki dla wybranego miesiąca
    const { data: scoresData } = await supabase
      .from('member_scores')
      .select('*')
      .eq('year', year)
      .eq('month', month)

    const scoresMap: Record<string, any> = {}
    scoresData?.forEach(s => { scoresMap[s.user_id] = s })

    const initialRows: Record<string, ScoreRow> = {}
    membersData?.forEach(m => {
      const existing = scoresMap[m.id]
      initialRows[m.id] = {
        userId: m.id,
        activity: existing ? String(existing.activity_points) : '0',
        quality: existing ? String(existing.quality_points) : '0',
        notes: existing?.notes || '',
        saved: !!existing,
        saving: false,
        editingLimit: false,
        limitInput: String(m.personal_limit ?? 20),
      }
    })

    setMembers(membersData || [])
    setRows(initialRows)
    setLoading(false)
  }, [year, month])

  useEffect(() => { fetchData() }, [fetchData])

  const updateRow = (userId: string, field: keyof ScoreRow, value: any) => {
    setRows(prev => ({ ...prev, [userId]: { ...prev[userId], [field]: value } }))
  }

  const getLimit = (member: Member) => member.personal_limit ?? 20

  const getTotal = (userId: string, member: Member) => {
    const row = rows[userId]
    if (!row) return 0
    const a = parseFloat(row.activity) || 0
    const q = parseFloat(row.quality) || 0
    return Math.min(a + q, getLimit(member))
  }

  const getPercent = (userId: string, member: Member) => {
    return Math.round((getTotal(userId, member) / getLimit(member)) * 100)
  }

  const saveScore = async (member: Member) => {
    const row = rows[member.id]
    if (!row) return

    const a = parseFloat(row.activity) || 0
    const q = parseFloat(row.quality) || 0
    const limit = getLimit(member)

    if (a + q > limit) {
      toast.error(`Suma punktów (${a + q}) przekracza limit tej osoby (${limit})`)
      return
    }

    updateRow(member.id, 'saving', true)
    const { error } = await supabase.from('member_scores').upsert({
      user_id: member.id,
      year,
      month,
      activity_points: a,
      quality_points: q,
      notes: row.notes || null,
    }, { onConflict: 'user_id,year,month' })

    if (!error) {
      updateRow(member.id, 'saved', true)
      toast.success(`Zapisano: ${member.first_name} ${member.last_name}`)
    } else {
      toast.error('Błąd zapisu')
    }
    updateRow(member.id, 'saving', false)
  }

  const saveLimit = async (member: Member) => {
    const row = rows[member.id]
    if (!row) return
    const newLimit = parseInt(row.limitInput)
    if (isNaN(newLimit) || newLimit < 1 || newLimit > 100) {
      toast.error('Limit musi być liczbą od 1 do 100')
      return
    }
    const { error } = await supabase
      .from('users')
      .update({ personal_limit: newLimit })
      .eq('id', member.id)
    if (!error) {
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, personal_limit: newLimit } : m))
      updateRow(member.id, 'editingLimit', false)
      toast.success(`Limit zmieniony na ${newLimit} pkt`)
    } else {
      toast.error('Błąd zapisu limitu')
    }
  }

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  // Ranking
  const ranking = members
    .map(m => ({ member: m, pct: getPercent(m.id, m), total: getTotal(m.id, m) }))
    .filter(r => rows[r.member.id]?.saved)
    .sort((a, b) => b.pct - a.pct)

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-10">

      {/* HEADER */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">
              <Lock size={12} /> Dostęp zastrzeżony
            </div>
            <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/20 text-yellow-400 rounded-xl flex items-center justify-center">
                <Trophy size={22} />
              </div>
              System Motywacyjny
            </h1>
            <p className="text-slate-400 text-sm mt-1">Widoczne wyłącznie dla Ciebie</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowRanking(!showRanking)}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 ${showRanking ? 'bg-yellow-500 text-slate-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              <Award size={16} /> {showRanking ? 'Ukryj ranking' : 'Pokaż ranking'}
            </button>
            <button onClick={() => router.push('/')} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-sm transition-colors flex items-center gap-2">
              <X size={16} /> Zamknij
            </button>
          </div>
        </div>
      </div>

      {/* NAWIGACJA MIESIĄCA */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div className="text-center min-w-[180px]">
            <p className="text-xl font-extrabold text-white">{MONTH_NAMES[month - 1]} {year}</p>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Okres rozliczeniowy</p>
          </div>
          <button onClick={nextMonth} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* RANKING MIESIĘCZNY */}
      {showRanking && ranking.length > 0 && (
        <div className="max-w-6xl mx-auto mb-8">
          <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6">
            <h2 className="text-lg font-extrabold text-white mb-5 flex items-center gap-2">
              <Trophy size={18} className="text-yellow-400" /> Ranking — {MONTH_NAMES[month - 1]} {year}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {ranking.map((r, i) => (
                <div key={r.member.id} className={`flex items-center gap-3 p-4 rounded-2xl border ${i === 0 ? 'border-yellow-500/40 bg-yellow-500/5' : i === 1 ? 'border-slate-500/40 bg-slate-500/5' : i === 2 ? 'border-amber-700/40 bg-amber-700/5' : 'border-slate-800 bg-slate-900/50'}`}>
                  <div className="w-8 text-center shrink-0">{getMedalIcon(i + 1)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm truncate">{r.member.first_name} {r.member.last_name}</p>
                    <PercentBar pct={r.pct} />
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-extrabold text-lg ${getScoreColor(r.pct)}`}>{r.pct}%</p>
                    <p className="text-[10px] text-slate-500">{r.total}/20 pkt</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TABELA OCEN */}
      <div className="max-w-6xl mx-auto">
        <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-extrabold text-white flex items-center gap-2">
              <Activity size={18} className="text-blue-400" /> Oceny Członków
            </h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{members.length} osób</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={32} className="animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {members.map(member => {
                const row = rows[member.id]
                if (!row) return null
                const total = getTotal(member.id, member)
                const pct = getPercent(member.id, member)
                const limit = getLimit(member)
                const a = parseFloat(row.activity) || 0
                const q = parseFloat(row.quality) || 0
                const isOverLimit = a + q > limit

                return (
                  <div key={member.id} className={`p-5 transition-colors ${row.saved ? 'bg-slate-900' : 'bg-slate-950'}`}>
                    <div className="flex flex-col lg:flex-row lg:items-start gap-4">

                      {/* INFO O OSOBIE */}
                      <div className="flex items-center gap-3 lg:w-52 shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center font-bold text-sm shrink-0">
                          {member.first_name.charAt(0)}{member.last_name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-white text-sm">{member.first_name} {member.last_name}</p>
                          <p className="text-[10px] text-slate-500 truncate">{member.departments?.[0]?.name || 'Brak podkomisji'}</p>
                        </div>
                      </div>

                      {/* LIMIT OSOBISTY */}
                      <div className="flex items-center gap-2 lg:w-36 shrink-0">
                        <div className="flex-1">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Limit</p>
                          {row.editingLimit ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={1}
                                max={20}
                                className="w-14 px-2 py-1.5 bg-slate-800 border border-blue-500 rounded-lg text-white text-sm font-bold outline-none text-center"
                                value={row.limitInput}
                                onChange={e => updateRow(member.id, 'limitInput', e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveLimit(member); if (e.key === 'Escape') updateRow(member.id, 'editingLimit', false) }}
                                autoFocus
                              />
                              <button onClick={() => saveLimit(member)} className="p-1 text-emerald-400 hover:text-emerald-300"><Check size={14} /></button>
                              <button onClick={() => updateRow(member.id, 'editingLimit', false)} className="p-1 text-slate-500 hover:text-slate-300"><X size={14} /></button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { updateRow(member.id, 'editingLimit', true); updateRow(member.id, 'limitInput', String(limit)) }}
                              className="flex items-center gap-1.5 text-sm font-bold text-slate-300 hover:text-blue-400 transition-colors group"
                            >
                              <span className="font-mono">{limit} pkt</span>
                              <Edit2 size={11} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* PUNKTY: AKTYWNOŚĆ */}
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                          <Activity size={10} /> Aktywność
                        </p>
                        <input
                          type="number"
                          min={0}
                          max={limit}
                          step={0.5}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-xl text-white text-sm font-bold outline-none transition-colors text-center"
                          value={row.activity}
                          onChange={e => { updateRow(member.id, 'activity', e.target.value); updateRow(member.id, 'saved', false) }}
                        />
                      </div>

                      {/* PUNKTY: JAKOŚĆ */}
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                          <Star size={10} /> Jakość
                        </p>
                        <input
                          type="number"
                          min={0}
                          max={limit}
                          step={0.5}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-xl text-white text-sm font-bold outline-none transition-colors text-center"
                          value={row.quality}
                          onChange={e => { updateRow(member.id, 'quality', e.target.value); updateRow(member.id, 'saved', false) }}
                        />
                      </div>

                      {/* SUMA + % */}
                      <div className="lg:w-32 shrink-0">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Wynik</p>
                        <div className={`px-3 py-2 rounded-xl text-center border ${isOverLimit ? 'border-red-500/50 bg-red-900/20' : 'border-slate-700 bg-slate-800'}`}>
                          <p className={`text-sm font-extrabold ${isOverLimit ? 'text-red-400' : getScoreColor(pct)}`}>
                            {isOverLimit ? `⚠️ ${a + q}` : `${total}/${limit}`}
                          </p>
                          {!isOverLimit && <p className={`text-xs font-bold ${getScoreColor(pct)}`}>{pct}%</p>}
                          {isOverLimit && <p className="text-[10px] text-red-400">przekracza limit</p>}
                        </div>
                        {!isOverLimit && <PercentBar pct={pct} />}
                      </div>

                      {/* NOTATKA */}
                      <div className="flex-1 lg:flex-[1.5]">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                          <Info size={10} /> Notatka (prywatna)
                        </p>
                        <input
                          type="text"
                          placeholder="Uzasadnienie, obserwacje..."
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 focus:border-slate-500 rounded-xl text-slate-300 text-sm outline-none transition-colors placeholder-slate-600"
                          value={row.notes}
                          onChange={e => { updateRow(member.id, 'notes', e.target.value); updateRow(member.id, 'saved', false) }}
                        />
                      </div>

                      {/* ZAPIS */}
                      <div className="flex items-end shrink-0">
                        <button
                          onClick={() => saveScore(member)}
                          disabled={row.saving || isOverLimit}
                          className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-50 ${
                            row.saved
                              ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800 hover:bg-emerald-900/60'
                              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/40'
                          }`}
                        >
                          {row.saving
                            ? <Loader2 size={15} className="animate-spin" />
                            : row.saved
                            ? <><Check size={15} /> Zapisano</>
                            : <><Save size={15} /> Zapisz</>
                          }
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* LEGENDA */}
        <div className="mt-6 p-4 bg-slate-900 rounded-2xl border border-slate-800 flex flex-wrap gap-6">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest self-center">Skala procentowa:</p>
          {[
            { label: '90–100%', color: 'text-emerald-400', desc: 'Wybitny' },
            { label: '70–89%', color: 'text-blue-400', desc: 'Bardzo dobry' },
            { label: '50–69%', color: 'text-yellow-400', desc: 'Dobry' },
            { label: '25–49%', color: 'text-orange-400', desc: 'Przeciętny' },
            { label: '0–24%', color: 'text-red-400', desc: 'Słaby' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className={`font-bold text-xs ${l.color}`}>{l.label}</span>
              <span className="text-slate-600 text-xs">— {l.desc}</span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-center text-[11px] text-slate-700 font-bold uppercase tracking-widest">
          Ta strona nie jest indeksowana w nawigacji. Dostęp tylko przez bezpośredni URL.
        </p>
      </div>
    </div>
  )
}
