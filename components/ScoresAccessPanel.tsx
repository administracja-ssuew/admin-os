'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

interface AccessUser { user_id: string; email: string; has_access: boolean }

export default function ScoresAccessPanel() {
  const [users, setUsers] = useState<AccessUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await supabase.rpc('list_scores_access')
      if (result.error) throw result.error
      setUsers(result.data ?? [])
      setError('')
    } catch {
      setError('Nie udało się pobrać uprawnień. Spróbuj ponownie.')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const toggle = async (user: AccessUser) => {
    setBusy(user.user_id)
    try {
      const result = user.has_access
        ? await supabase.from('scores_access').delete().eq('user_id', user.user_id).select('user_id')
        : await supabase.from('scores_access').insert({ user_id: user.user_id }).select('user_id')
      if (result.error || result.data?.length !== 1) throw result.error ?? new Error('Access denied')
      setUsers(prev => prev.map(item => item.user_id === user.user_id ? { ...item, has_access: !item.has_access } : item))
      toast.success(user.has_access ? 'Odebrano dostęp' : 'Nadano dostęp do podglądu')
    } catch { toast.error('Nie udało się zmienić dostępu. Odśwież listę i spróbuj ponownie.') }
    finally { setBusy(null) }
  }

  const filtered = users.filter(user => user.email.toLowerCase().includes(query.trim().toLowerCase()))
  return (
    <section aria-labelledby="scores-access-title" className="max-w-6xl mx-auto mb-8 rounded-xl border border-slate-700 bg-slate-900 p-5">
      <h2 id="scores-access-title" className="text-lg font-bold text-white">Dostęp do Systemu Motywacyjnego</h2>
      <p className="mt-1 text-sm text-slate-300">Uprawnione osoby mogą przeglądać oceny i ranking. Tylko administracja@samorzad.ue.wroc.pl zarządza dostępem i edytuje oceny.</p>
      <label htmlFor="scores-access-search" className="block mt-4 mb-1 text-sm text-slate-300">Szukaj osoby po e-mailu</label>
      <input id="scores-access-search" type="search" value={query} onChange={event => setQuery(event.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
      {loading ? <p className="mt-4 text-slate-300" role="status">Ładowanie uprawnień…</p> : error ? (
        <div className="mt-4"><p role="alert" className="text-red-300">{error}</p><button onClick={load} className="mt-2 rounded-lg bg-slate-700 px-3 py-2">Spróbuj ponownie</button></div>
      ) : (
        <ul className="mt-4 max-h-80 overflow-y-auto divide-y divide-slate-700">
          {filtered.map(user => (
            <li key={user.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0"><p className="break-all text-sm text-white">{user.email}</p><p className="text-sm text-slate-300">{user.has_access ? 'Ma dostęp do podglądu' : 'Brak dostępu'}</p></div>
              <button disabled={busy !== null} onClick={() => toggle(user)} aria-label={`${user.has_access ? 'Odbierz' : 'Nadaj'} dostęp: ${user.email}`} className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600 focus-visible:outline-2 focus-visible:outline-blue-400 disabled:opacity-50">
                {busy === user.user_id ? 'Zapisywanie…' : user.has_access ? 'Odbierz dostęp' : 'Nadaj dostęp'}
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="py-3 text-sm text-slate-300">Brak osób spełniających kryteria. Lista obejmuje zweryfikowane konta aktywnych członków oraz osoby z nadanym dostępem.</li>}
        </ul>
      )}
    </section>
  )
}
