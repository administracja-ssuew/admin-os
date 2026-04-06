'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/audit'
import ConfirmDialog from '../ConfirmDialog'
import toast from 'react-hot-toast'
import {
  Plus, Loader2, Trash2, X, Search, PiggyBank, ExternalLink,
} from 'lucide-react'
import type { Grant, AppUser } from '../../types'

// ─── TYPY LOKALNE ────────────────────────────────────────────────────────────
interface DeptMember {
  id: string
  first_name: string
  last_name: string
}

// ─── PROPS ───────────────────────────────────────────────────────────────────
export interface GrantsPanelProps {
  grants: Grant[]
  members: DeptMember[]
  currentUser: AppUser | null
  isAdmin: boolean
  onRefetch: () => Promise<void>
}

// ─── KOMPONENT ───────────────────────────────────────────────────────────────
export function GrantsPanel({
  grants,
  members,
  currentUser,
  isAdmin,
  onRefetch,
}: GrantsPanelProps) {
  // Stany: modal dodawania
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false)
  const [isSubmittingGrant, setIsSubmittingGrant] = useState(false)
  const [grantForm, setGrantForm] = useState({
    signature: '',
    name: '',
    organizer: '',
    type: 'DOTACJA',
    max_amount: '',
    scope: 'Polska',
    deadline: '',
    status: 'RADAR',
    decision: 'OCZEKUJE',
    owner_id: '',
    drive_link: '',
    description: '',
    notes: '',
  })

  // Stany: szuflada grantu
  const [selectedGrant, setSelectedGrant] = useState<Grant | null>(null)
  const [isGrantDrawerOpen, setIsGrantDrawerOpen] = useState(false)

  // Stany: filtry
  const [grantSearch, setGrantSearch] = useState('')
  const [grantStatusFilter, setGrantStatusFilter] = useState('all')
  const [grantTypeFilter, setGrantTypeFilter] = useState('all')

  // Stany: usuwanie
  const [confirmDelete, setConfirmDelete] = useState<{
    open: boolean
    type: string
    id: string
  }>({ open: false, type: '', id: '' })

  // ─── MUTACJE ──────────────────────────────────────────────────
  const handleAddGrant = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingGrant(true)
    const { error } = await supabase.from('grants_radar').insert([{
      ...grantForm,
      max_amount: grantForm.max_amount ? parseFloat(grantForm.max_amount) : null,
      owner_id: grantForm.owner_id || null,
    }])
    if (!error) {
      toast.success('Dodano do radaru!')
      setIsGrantModalOpen(false)
      setGrantForm({
        signature: '', name: '', organizer: '', type: 'DOTACJA', max_amount: '',
        scope: 'Polska', deadline: '', status: 'RADAR', decision: 'OCZEKUJE',
        owner_id: '', drive_link: '', description: '', notes: '',
      })
      await onRefetch()
    }
    setIsSubmittingGrant(false)
  }

  const updateGrantStatus = async (id: string, newStatus: string) => {
    await supabase.from('grants_radar').update({ status: newStatus }).eq('id', id)
    await onRefetch()
    if (selectedGrant?.id === id) {
      setSelectedGrant({ ...selectedGrant, status: newStatus as Grant['status'] })
    }
  }

  const updateGrantDecision = async (id: string, newDecision: string) => {
    await supabase.from('grants_radar').update({ decision: newDecision }).eq('id', id)
    await onRefetch()
    if (selectedGrant?.id === id) {
      setSelectedGrant({ ...selectedGrant, decision: newDecision as Grant['decision'] })
    }
  }

  const deleteGrant = async (id: string) => {
    const toastId = toast.loading('Usuwanie...')
    await supabase.from('grants_radar').delete().eq('id', id)
    if (currentUser) {
      await logAudit({ userId: currentUser.id, action: 'DELETE', entityType: 'grant', entityId: id })
    }
    setIsGrantDrawerOpen(false)
    await onRefetch()
    toast.success('Usunięto z radaru', { id: toastId })
    setConfirmDelete({ open: false, type: '', id: '' })
  }

  // ─── FILTROWANIE ───────────────────────────────────────────────
  const filteredGrants = grants.filter(g => {
    const matchSearch =
      !grantSearch ||
      g.name.toLowerCase().includes(grantSearch.toLowerCase()) ||
      g.signature?.toLowerCase().includes(grantSearch.toLowerCase())
    const matchStatus = grantStatusFilter === 'all' || g.status === grantStatusFilter
    const matchType = grantTypeFilter === 'all' || g.type === grantTypeFilter
    return matchSearch && matchStatus && matchType
  })

  // ─── STATYSTYKI ────────────────────────────────────────────────
  const totalAmount = grants
    .filter(g => g.max_amount)
    .reduce((sum, g) => sum + (g.max_amount || 0), 0)
  const accepted = grants.filter(g => g.decision === 'ZAAKCEPTOWANE').length

  // ─── JSX ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      {/* Statystyki */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 softly-lifted">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Łącznie pozycji</p>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{grants.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 softly-lifted">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Zaakceptowane</p>
          <p className="text-3xl font-extrabold text-green-600 dark:text-green-400">{accepted}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 softly-lifted">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Łączna kwota</p>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {totalAmount > 0 ? `${totalAmount.toLocaleString('pl-PL')} zł` : '—'}
          </p>
        </div>
      </div>

      {/* Tabela grantów */}
      <div className="flex flex-col h-full bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden softly-lifted">
        <div className="p-4 md:p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-col gap-3 shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PiggyBank className="text-green-500" size={20} /> Radar Dotacji i Patronatów
            </h2>
            <button
              onClick={() => setIsGrantModalOpen(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm flex items-center gap-2"
            >
              <Plus size={16} /> Nowa Pozycja
            </button>
          </div>
          {/* Filtry */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Szukaj..."
                value={grantSearch}
                onChange={e => setGrantSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-white"
              />
            </div>
            <select
              value={grantStatusFilter}
              onChange={e => setGrantStatusFilter(e.target.value)}
              className="text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-700 dark:text-slate-300"
            >
              <option value="all">Wszystkie statusy</option>
              <option value="RADAR">Radar</option>
              <option value="W TOKU">W toku</option>
              <option value="ARCHIWUM">Archiwum</option>
            </select>
            <select
              value={grantTypeFilter}
              onChange={e => setGrantTypeFilter(e.target.value)}
              className="text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-700 dark:text-slate-300"
            >
              <option value="all">Wszystkie typy</option>
              <option value="DOTACJA">Dotacja</option>
              <option value="PATRONAT">Patronat</option>
            </select>
          </div>
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">ID</th>
                <th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Nazwa / Org</th>
                <th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Typ</th>
                <th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">Do Końca</th>
                <th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Decyzja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {filteredGrants.map(g => (
                <tr
                  key={g.id}
                  onClick={() => { setSelectedGrant(g); setIsGrantDrawerOpen(true) }}
                  className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300">{g.signature}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[250px]">{g.name}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">{g.organizer}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      g.type === 'PATRONAT'
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                        : 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
                    }`}>{g.type}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">
                    <div className="text-xs">{g.deadline}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`text-[10px] font-bold border inline-block px-2 py-0.5 rounded ${
                      g.status === 'RADAR'
                        ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
                        : g.status === 'ARCHIWUM'
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                    }`}>{g.status}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`text-[10px] font-bold border inline-block px-2 py-0.5 rounded ${
                      g.decision === 'ZAAKCEPTOWANE'
                        ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
                        : g.decision === 'ODRZUCONE'
                        ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}>{g.decision}</div>
                  </td>
                </tr>
              ))}
              {filteredGrants.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                    Brak wyników dla wybranych filtrów
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Szuflada grantu */}
      {isGrantDrawerOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
          onClick={() => setIsGrantDrawerOpen(false)}
        />
      )}
      <div
        className={`fixed top-0 right-0 h-full w-full md:w-[480px] bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-all duration-300 ease-in-out flex flex-col border-l border-slate-200 dark:border-slate-800 ${isGrantDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {selectedGrant && (
          <>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-2">
                  <select
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold uppercase rounded-lg px-3 py-1.5 outline-none"
                    value={selectedGrant.status}
                    onChange={e => updateGrantStatus(selectedGrant.id, e.target.value)}
                  >
                    <option value="RADAR">Radar</option>
                    <option value="W TOKU">W toku</option>
                    <option value="ARCHIWUM">Archiwum</option>
                  </select>
                  <select
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold uppercase rounded-lg px-3 py-1.5 outline-none"
                    value={selectedGrant.decision}
                    onChange={e => updateGrantDecision(selectedGrant.id, e.target.value)}
                  >
                    <option value="OCZEKUJE">Oczekuje</option>
                    <option value="ZAAKCEPTOWANE">Zaakceptowane</option>
                    <option value="ODRZUCONE">Odrzucone</option>
                  </select>
                </div>
                <div className="flex gap-1">
                  {isAdmin && (
                    <button
                      onClick={() => setConfirmDelete({ open: true, type: 'grant', id: selectedGrant.id })}
                      className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => setIsGrantDrawerOpen(false)}
                    className="text-slate-400 hover:text-slate-800 dark:hover:text-white p-1"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border mb-2 ${
                selectedGrant.type === 'PATRONAT'
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                  : 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
              }`}>{selectedGrant.type}</span>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight">{selectedGrant.name}</h2>
              {selectedGrant.organizer && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{selectedGrant.organizer}</p>
              )}
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {selectedGrant.deadline && (
                  <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Termin</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedGrant.deadline}</p>
                  </div>
                )}
                {selectedGrant.max_amount && (
                  <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Maks. kwota</p>
                    <p className="text-sm font-bold text-green-600 dark:text-green-400">
                      {Number(selectedGrant.max_amount).toLocaleString('pl-PL')} zł
                    </p>
                  </div>
                )}
                {selectedGrant.scope && (
                  <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Zasięg</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedGrant.scope}</p>
                  </div>
                )}
                {selectedGrant.owner && (
                  <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Opiekun</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedGrant.owner.first_name} {selectedGrant.owner.last_name}
                    </p>
                  </div>
                )}
              </div>
              {selectedGrant.description && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Opis</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{selectedGrant.description}</p>
                </div>
              )}
              {selectedGrant.notes && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Notatki</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{selectedGrant.notes}</p>
                </div>
              )}
              {selectedGrant.drive_link && (
                <a
                  href={selectedGrant.drive_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm font-bold hover:underline"
                >
                  <ExternalLink size={16} /> Otwórz w Google Drive
                </a>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal: Nowa dotacja / patronat */}
      {isGrantModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <PiggyBank className="text-green-500" size={22} /> Nowa Dotacja / Patronat
              </h2>
              <button onClick={() => setIsGrantModalOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddGrant} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Sygnatura / ID</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                    value={grantForm.signature}
                    onChange={e => setGrantForm({ ...grantForm, signature: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Typ *</label>
                  <select
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                    value={grantForm.type}
                    onChange={e => setGrantForm({ ...grantForm, type: e.target.value })}
                  >
                    <option value="DOTACJA">Dotacja</option>
                    <option value="PATRONAT">Patronat</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Nazwa programu *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                  value={grantForm.name}
                  onChange={e => setGrantForm({ ...grantForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Organizator</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                  value={grantForm.organizer}
                  onChange={e => setGrantForm({ ...grantForm, organizer: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Maks. kwota (zł)</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                    value={grantForm.max_amount}
                    onChange={e => setGrantForm({ ...grantForm, max_amount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Zasięg</label>
                  <select
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                    value={grantForm.scope}
                    onChange={e => setGrantForm({ ...grantForm, scope: e.target.value })}
                  >
                    <option value="Polska">Polska</option>
                    <option value="Europejski">Europejski</option>
                    <option value="Regionalny">Regionalny</option>
                    <option value="Lokalny">Lokalny</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Termin złożenia</label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                    value={grantForm.deadline}
                    onChange={e => setGrantForm({ ...grantForm, deadline: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Status</label>
                  <select
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                    value={grantForm.status}
                    onChange={e => setGrantForm({ ...grantForm, status: e.target.value })}
                  >
                    <option value="RADAR">Radar</option>
                    <option value="W TOKU">W toku</option>
                    <option value="ARCHIWUM">Archiwum</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Decyzja</label>
                  <select
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                    value={grantForm.decision}
                    onChange={e => setGrantForm({ ...grantForm, decision: e.target.value })}
                  >
                    <option value="OCZEKUJE">Oczekuje</option>
                    <option value="ZAAKCEPTOWANE">Zaakceptowane</option>
                    <option value="ODRZUCONE">Odrzucone</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Opiekun</label>
                  <select
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                    value={grantForm.owner_id}
                    onChange={e => setGrantForm({ ...grantForm, owner_id: e.target.value })}
                  >
                    <option value="">— Nieprzypisany —</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Link do Drive</label>
                <input
                  type="url"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                  value={grantForm.drive_link}
                  onChange={e => setGrantForm({ ...grantForm, drive_link: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Opis / Szczegóły</label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white resize-none custom-scrollbar"
                  value={grantForm.description}
                  onChange={e => setGrantForm({ ...grantForm, description: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Notatki wewnętrzne</label>
                <textarea
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white resize-none custom-scrollbar"
                  value={grantForm.notes}
                  onChange={e => setGrantForm({ ...grantForm, notes: e.target.value })}
                />
              </div>
              <button
                type="submit"
                disabled={isSubmittingGrant}
                className="w-full py-4 mt-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl flex justify-center items-center gap-2 transition-colors disabled:opacity-70"
              >
                {isSubmittingGrant ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                Dodaj do Radaru
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ConfirmDialog */}
      <ConfirmDialog
        isOpen={confirmDelete.open}
        title="Potwierdź usunięcie"
        description="Tej operacji nie można cofnąć."
        confirmLabel="Usuń"
        variant="danger"
        onConfirm={() => {
          if (confirmDelete.type === 'grant') deleteGrant(confirmDelete.id)
        }}
        onCancel={() => setConfirmDelete({ open: false, type: '', id: '' })}
      />
    </div>
  )
}
