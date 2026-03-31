'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import Sidebar from '../../components/Sidebar'
import { Lightbulb, Plus, X, Loader2, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── KOLORY KARTECZEK ────────────────────────────────────────────
const COLORS = [
  { id: 'yellow', label: 'Żółty',        bg: 'bg-yellow-200',  border: 'border-yellow-300',  shadow: 'shadow-yellow-200', text: 'text-yellow-950' },
  { id: 'sky',    label: 'Niebieski',    bg: 'bg-sky-200',     border: 'border-sky-300',     shadow: 'shadow-sky-200',    text: 'text-sky-950'    },
  { id: 'green',  label: 'Zielony',      bg: 'bg-green-200',   border: 'border-green-300',   shadow: 'shadow-green-200',  text: 'text-green-950'  },
  { id: 'pink',   label: 'Różowy',       bg: 'bg-pink-200',    border: 'border-pink-300',    shadow: 'shadow-pink-200',   text: 'text-pink-950'   },
  { id: 'purple', label: 'Fioletowy',    bg: 'bg-purple-200',  border: 'border-purple-300',  shadow: 'shadow-purple-200', text: 'text-purple-950' },
  { id: 'orange', label: 'Pomarańczowy', bg: 'bg-orange-200',  border: 'border-orange-300',  shadow: 'shadow-orange-200', text: 'text-orange-950' },
] as const

type ColorId = typeof COLORS[number]['id']

// ─── HELPERS ─────────────────────────────────────────────────────

// Deterministyczna rotacja — na podstawie id karty, bez losowości przy re-renderach
function getRotation(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(31, h) + id.charCodeAt(i) | 0
  }
  const angles = [-3, -2, -1.5, -1, 0, 0, 1, 1.5, 2, 3]
  return `rotate(${angles[Math.abs(h) % angles.length]}deg)`
}

function colorCfg(colorId: string) {
  return COLORS.find(c => c.id === colorId) ?? COLORS[0]
}

// ─── TYPY ────────────────────────────────────────────────────────
interface BrainstormCard {
  id: string
  content: string
  color: ColorId
  author_id: string
  assigned_to: string | null
  created_at: string
  author?: { first_name: string; last_name: string } | null
  assignee?: { id: string; first_name: string; last_name: string } | null
}

interface ViceUser {
  id: string
  first_name: string
  last_name: string
  org_function: string | null
}

// ─── KOMPONENT KARTECZKI ─────────────────────────────────────────
function StickyCard({
  card,
  canDelete,
  onDelete,
}: {
  card: BrainstormCard
  canDelete: boolean
  onDelete: (id: string) => void
}) {
  const cfg = colorCfg(card.color)
  const rotation = getRotation(card.id)

  return (
    <div
      className={`break-inside-avoid mb-5 inline-block w-full ${cfg.bg} ${cfg.border} border shadow-lg ${cfg.shadow} rounded-xl p-4 relative group transition-all duration-200 hover:scale-[1.03] hover:shadow-xl hover:z-10 cursor-default`}
      style={{ transform: rotation }}
    >
      {/* Przycisk usuwania */}
      {canDelete && (
        <button
          onClick={() => onDelete(card.id)}
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black/10 hover:bg-red-500 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150"
          title="Usuń karteczkę"
        >
          <X size={11} />
        </button>
      )}

      {/* Treść */}
      <p className={`text-sm font-medium leading-relaxed ${cfg.text} mb-4 whitespace-pre-wrap break-words`}>
        {card.content}
      </p>

      {/* Przypisanie */}
      {card.assignee && (
        <div className={`flex items-center gap-1.5 mb-2 ${cfg.text} opacity-70`}>
          <div className="w-4 h-4 rounded-full bg-black/15 flex items-center justify-center text-[8px] font-extrabold shrink-0">
            {card.assignee.first_name.charAt(0)}{card.assignee.last_name.charAt(0)}
          </div>
          <span className="text-[10px] font-bold">
            → {card.assignee.first_name} {card.assignee.last_name}
          </span>
        </div>
      )}

      {/* Stopka: autor + data */}
      <div className={`flex items-center justify-between pt-2 border-t border-black/10 ${cfg.text}`}>
        <div className="flex items-center gap-1.5 opacity-60">
          <div className="w-5 h-5 rounded-full bg-black/15 flex items-center justify-center text-[9px] font-extrabold shrink-0">
            {card.author?.first_name?.charAt(0) ?? '?'}{card.author?.last_name?.charAt(0) ?? ''}
          </div>
          <span className="text-[10px] font-bold">{card.author?.first_name ?? 'Anonim'}</span>
        </div>
        <span className="text-[9px] font-mono opacity-50">
          {new Date(card.created_at).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}
        </span>
      </div>
    </div>
  )
}

// ─── STRONA GŁÓWNA ────────────────────────────────────────────────
export default function BrainstormPage() {
  const { user: currentUser, isAdmin, loading: authLoading } = useCurrentUser()
  const [cards, setCards] = useState<BrainstormCard[]>([])
  const [viceChairs, setViceChairs] = useState<ViceUser[]>([])
  const [loading, setLoading] = useState(true)
  const [filterBy, setFilterBy] = useState<string | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<{ content: string; color: ColorId; assigned_to: string }>({
    content: '', color: 'yellow', assigned_to: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)

    const { data: cardsData } = await supabase
      .from('brainstorm_cards')
      .select('*, author:users!brainstorm_cards_author_id_fkey(id, first_name, last_name), assignee:users!brainstorm_cards_assigned_to_fkey(id, first_name, last_name)')
      .order('created_at', { ascending: false })
    if (cardsData) setCards(cardsData as BrainstormCard[])

    // Wiceprzewodniczący — szukamy po org_function lub tagach
    const { data: usersData } = await supabase
      .from('users')
      .select('id, first_name, last_name, org_function, tags, system_role')
      .in('system_role', ['active', 'admin', 'superadmin'])
      .order('first_name', { ascending: true })

    const filtered = (usersData || []).filter(u =>
      (u.org_function ?? '').toLowerCase().includes('wice') ||
      (u.tags ?? []).some((t: string) => t.toLowerCase().includes('wice'))
    )
    // Fallback: jeśli brak użytkowników z funkcją wice — pokaż wszystkich aktywnych jako opcje
    setViceChairs(filtered.length > 0 ? filtered : (usersData ?? []).slice(0, 15))

    setLoading(false)
  }

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser || !form.content.trim()) return
    setIsSubmitting(true)

    const { error } = await supabase.from('brainstorm_cards').insert([{
      content: form.content.trim(),
      color: form.color,
      author_id: currentUser.id,
      assigned_to: form.assigned_to || null,
    }])

    if (!error) {
      toast.success('Pomysł dodany na tablicę!')
      setIsModalOpen(false)
      setForm({ content: '', color: 'yellow', assigned_to: '' })
      fetchData()
    } else {
      toast.error('Błąd zapisu karteczki')
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (cardId: string) => {
    const { error } = await supabase.from('brainstorm_cards').delete().eq('id', cardId)
    if (!error) {
      setCards(prev => prev.filter(c => c.id !== cardId))
      toast.success('Karteczka usunięta')
    } else {
      toast.error('Błąd usuwania')
    }
  }

  const filteredCards = filterBy ? cards.filter(c => c.assigned_to === filterBy) : cards
  const preview = colorCfg(form.color)

  // Blokada dla nieadminów (na wypadek gdyby ktoś wszedł przez URL)
  if (!authLoading && !isAdmin) {
    return (
      <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
        <Sidebar />
        <div className="flex-1 ml-64 flex flex-col items-center justify-center gap-4 text-center p-8">
          <ShieldAlert size={64} className="text-slate-300 dark:text-slate-600" />
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Brak dostępu</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm">Ta sekcja jest dostępna wyłącznie dla Zarządu i Administratorów Systemu.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <Sidebar />

      <div className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">

        {/* ─── NAGŁÓWEK ─────────────────────────────────────── */}
        <div className="p-8 pb-4 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
                <Lightbulb className="text-yellow-500" size={32} />
                Tablica Burzy Mózgów
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
                Przestrzeń na swobodne pomysły i koncepcje Zarządu Komisji.
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-yellow-400 hover:bg-yellow-500 active:bg-yellow-600 text-yellow-900 font-bold px-5 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-yellow-400/30 transition-all text-sm"
            >
              <Plus size={20} /> Dodaj pomysł
            </button>
          </div>

          {/* ─── FILTRY ───────────────────────────────────────── */}
          {viceChairs.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mr-1">Filtruj:</span>
              <button
                onClick={() => setFilterBy(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${!filterBy
                  ? 'bg-slate-800 text-white border-slate-700 shadow-md'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'}`}
              >
                Wszystkie ({cards.length})
              </button>
              {viceChairs.map(vc => {
                const count = cards.filter(c => c.assigned_to === vc.id).length
                return (
                  <button
                    key={vc.id}
                    onClick={() => setFilterBy(filterBy === vc.id ? null : vc.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${filterBy === vc.id
                      ? 'bg-blue-600 text-white border-blue-700 shadow-md shadow-blue-500/20'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'}`}
                  >
                    <div className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[8px] font-extrabold">
                      {vc.first_name.charAt(0)}{vc.last_name.charAt(0)}
                    </div>
                    {vc.first_name} {vc.last_name}
                    {count > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] bg-current/20">
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ─── TABLICA ──────────────────────────────────────────── */}
        <div
          className="flex-1 overflow-y-auto custom-scrollbar px-8 py-8"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.10) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        >
          {loading || authLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 size={40} className="animate-spin text-yellow-400" />
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
              <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                <Lightbulb size={40} className="text-yellow-400" />
              </div>
              <p className="text-slate-400 dark:text-slate-500 font-bold text-lg">
                {filterBy ? 'Brak pomysłów dla wybranej osoby.' : 'Tablica jest pusta. Bądź pierwszy!'}
              </p>
            </div>
          ) : (
            <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-5">
              {filteredCards.map(card => (
                <StickyCard
                  key={card.id}
                  card={card}
                  canDelete={currentUser?.id === card.author_id || isAdmin}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── MODAL: Dodaj pomysł ──────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Lightbulb className="text-yellow-500" size={22} /> Nowy Pomysł
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddCard} className="p-6 space-y-5">

              {/* Treść */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                  Treść pomysłu
                </label>
                <textarea
                  required
                  rows={4}
                  autoFocus
                  placeholder="Opisz swój pomysł..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-yellow-400/40 text-slate-900 dark:text-white resize-none custom-scrollbar transition-all"
                  value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                />
              </div>

              {/* Kolor */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                  Kolor karteczki
                </label>
                <div className="flex gap-2.5 flex-wrap">
                  {COLORS.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setForm({ ...form, color: c.id })}
                      title={c.label}
                      className={`w-8 h-8 rounded-full ${c.bg} border-2 transition-all ${
                        form.color === c.id
                          ? 'border-slate-700 dark:border-white scale-125 shadow-md'
                          : 'border-transparent hover:scale-110 hover:border-slate-400 dark:hover:border-slate-500'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Przypisanie do Wiceprzewodniczącego */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                  Przypisz do (opcjonalnie)
                </label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-yellow-400/40 text-slate-900 dark:text-white transition-all"
                  value={form.assigned_to}
                  onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                >
                  <option value="">— Bez przypisania —</option>
                  {viceChairs.map(vc => (
                    <option key={vc.id} value={vc.id}>
                      {vc.first_name} {vc.last_name}{vc.org_function ? ` (${vc.org_function})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Podgląd */}
              <div className="flex justify-center py-1">
                <div
                  className={`w-44 ${preview.bg} ${preview.border} border shadow-lg ${preview.shadow} rounded-xl p-4`}
                  style={{ transform: 'rotate(-1.5deg)' }}
                >
                  <p className={`text-xs font-medium leading-relaxed ${preview.text} line-clamp-3 min-h-[3rem]`}>
                    {form.content || 'Podgląd karteczki...'}
                  </p>
                  <div className={`mt-3 pt-2 border-t border-black/10 flex items-center gap-1 ${preview.text} opacity-50`}>
                    <div className="w-4 h-4 rounded-full bg-black/15 flex items-center justify-center text-[8px] font-extrabold">
                      {currentUser?.first_name?.charAt(0) ?? '?'}{currentUser?.last_name?.charAt(0) ?? ''}
                    </div>
                    <span className="text-[9px] font-bold">{currentUser?.first_name ?? '...'}</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !form.content.trim()}
                className="w-full py-4 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-yellow-400/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                Przypnij na tablicy
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
