'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/audit'
import ConfirmDialog from '../ConfirmDialog'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Loader2, FileText, Printer, BarChart3,
  ClipboardList, AlertTriangle, CheckCheck, Send,
} from 'lucide-react'
import type { Asset, EquipmentLoan, AppUser } from '../../types'

// ─── TYPY LOKALNIE UŻYWANE W HOOKU (przyszłe przeniesienie do types/index.ts) ─
interface LogisticsReport {
  id: string
  title: string
  content: string | null
  submitted_by: string | null
  submitted_at: string
  status: string
  subcommittee_type: string
  submitted_by_user?: { first_name: string; last_name: string } | null
}

interface DeptMember {
  id: string
  first_name: string
  last_name: string
}

// ─── PROPS ───────────────────────────────────────────────────────────────────
export interface LogisticsPanelProps {
  assets: Asset[]
  loans: EquipmentLoan[]
  reports: LogisticsReport[]
  members: DeptMember[]
  currentUser: AppUser | null
  isAdmin: boolean
  onRefetch: () => Promise<void>
}

// ─── KOMPONENT ───────────────────────────────────────────────────────────────
export function LogisticsPanel({
  assets,
  loans,
  reports,
  members,
  currentUser,
  isAdmin,
  onRefetch,
}: LogisticsPanelProps) {
  // Stany: assets
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false)
  const [isSubmittingAsset, setIsSubmittingAsset] = useState(false)
  const [assetForm, setAssetForm] = useState({
    name: '',
    asset_type: 'Artykuły biurowe',
    status: 'available',
    location: '',
    notes: '',
  })
  const [assetTypeFilter, setAssetTypeFilter] = useState('all')
  const [assetStatusFilter, setAssetStatusFilter] = useState('all')

  // Stany: loans
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false)
  const [isSubmittingLoan, setIsSubmittingLoan] = useState(false)
  const [loanForm, setLoanForm] = useState({
    agreement_number: '',
    item_category: 'Namiot Plenerowy',
    borrower_name: '',
    issue_date: '',
    return_date: '',
    status: 'Wypożyczone',
    notes: '',
  })
  const [loanStatusFilter, setLoanStatusFilter] = useState('all')

  // Stany: reports
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)
  const [reportForm, setReportForm] = useState({ title: '', content: '' })

  // Stany: usuwanie
  const [confirmDelete, setConfirmDelete] = useState<{
    open: boolean
    type: string
    id: string
  }>({ open: false, type: '', id: '' })

  // ─── MUTACJE: ASSETS ───────────────────────────────────────────
  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingAsset(true)
    await supabase.from('assets').insert([assetForm])
    toast.success('Zasób dodany!')
    setIsAssetModalOpen(false)
    setAssetForm({ name: '', asset_type: 'Artykuły biurowe', status: 'available', location: '', notes: '' })
    await onRefetch()
    setIsSubmittingAsset(false)
  }

  const updateAssetStatus = async (id: string, newStatus: string) => {
    await supabase.from('assets').update({ status: newStatus }).eq('id', id)
    await onRefetch()
  }

  const deleteAsset = async (id: string) => {
    const toastId = toast.loading('Usuwanie...')
    await supabase.from('assets').delete().eq('id', id)
    if (currentUser) await logAudit({ userId: currentUser.id, action: 'DELETE', entityType: 'asset', entityId: id })
    await onRefetch()
    toast.success('Usunięto zasób', { id: toastId })
    setConfirmDelete({ open: false, type: '', id: '' })
  }

  // ─── MUTACJE: LOANS ────────────────────────────────────────────
  const handleAddLoan = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingLoan(true)
    await supabase.from('equipment_loans').insert([{
      ...loanForm,
      return_date: loanForm.return_date || null,
    }])
    toast.success('Umowa wpisana!')
    setIsLoanModalOpen(false)
    setLoanForm({ agreement_number: '', item_category: 'Namiot Plenerowy', borrower_name: '', issue_date: '', return_date: '', status: 'Wypożyczone', notes: '' })
    await onRefetch()
    setIsSubmittingLoan(false)
  }

  const toggleLoanStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Wypożyczone' ? 'Zwrócone' : 'Wypożyczone'
    await supabase.from('equipment_loans').update({
      status: newStatus,
      return_date: newStatus === 'Zwrócone' ? new Date().toISOString().split('T')[0] : null,
    }).eq('id', id)
    await onRefetch()
  }

  const deleteLoan = async (id: string) => {
    const toastId = toast.loading('Usuwanie...')
    await supabase.from('equipment_loans').delete().eq('id', id)
    if (currentUser) await logAudit({ userId: currentUser.id, action: 'DELETE', entityType: 'equipment_loan', entityId: id })
    await onRefetch()
    toast.success('Usunięto umowę', { id: toastId })
    setConfirmDelete({ open: false, type: '', id: '' })
  }

  // ─── MUTACJE: REPORTS ──────────────────────────────────────────
  const handleAddReport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return
    setIsSubmittingReport(true)
    const { error } = await supabase.from('reports').insert([{
      title: reportForm.title,
      content: reportForm.content,
      submitted_by: currentUser.id,
      subcommittee_type: 'logistics',
      status: 'new',
    }])
    if (!error) {
      toast.success('Raport złożony!')
      setIsReportModalOpen(false)
      setReportForm({ title: '', content: '' })
      await onRefetch()
    } else {
      toast.error('Błąd zapisu raportu')
    }
    setIsSubmittingReport(false)
  }

  const updateReportStatus = async (id: string, newStatus: string) => {
    await supabase.from('reports').update({ status: newStatus }).eq('id', id)
    await onRefetch()
  }

  // ─── UTILS ─────────────────────────────────────────────────────
  const getTimelineData = () => {
    const counts: Record<string, number> = {}
    loans.forEach(loan => {
      if (loan.issue_date) {
        const dateKey = loan.issue_date.substring(0, 7)
        counts[dateKey] = (counts[dateKey] || 0) + 1
      }
    })
    const sorted = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]))
    const maxVal = sorted.length > 0 ? Math.max(...sorted.map(s => s[1])) : 1
    return { sorted, maxVal }
  }

  // ─── POCHODNE ──────────────────────────────────────────────────
  const filteredAssets = assets.filter(a => {
    const matchType = assetTypeFilter === 'all' || a.asset_type === assetTypeFilter
    const matchStatus = assetStatusFilter === 'all' || a.status === assetStatusFilter
    return matchType && matchStatus
  })

  const filteredLoans = loans.filter(l =>
    loanStatusFilter === 'all' || l.status === loanStatusFilter
  )

  const loanedCount = loans.filter(l => l.status === 'Wypożyczone').length
  const maintenanceCount = assets.filter(a => a.status === 'maintenance').length
  const { sorted: timelineData, maxVal } = getTimelineData()

  const reportStatusConfig: Record<string, { label: string; cls: string }> = {
    new:             { label: 'Nowy',           cls: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800' },
    read:            { label: 'Przeczytany',    cls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' },
    requires_action: { label: 'Wymaga akcji',   cls: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800' },
    archived:        { label: 'Zarchiwizowany', cls: 'bg-slate-50 text-slate-400 border-slate-100 dark:bg-slate-900 dark:text-slate-500 dark:border-slate-800' },
  }

  // ─── JSX ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-8">
      {/* Statystyki */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 softly-lifted">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Zasoby łącznie</p>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{assets.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 softly-lifted">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Aktywne wypożyczenia</p>
          <p className="text-3xl font-extrabold text-orange-500">{loanedCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 softly-lifted">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Awarie / problemy</p>
          <p className="text-3xl font-extrabold text-red-500">{maintenanceCount}</p>
        </div>
      </div>

      {/* Tabela zasobów */}
      <div className="flex flex-col bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden softly-lifted">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-wrap gap-2 justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Printer className="text-blue-500" size={20} /> Biuro i Zaopatrzenie
          </h2>
          <div className="flex gap-2 items-center">
            <select
              value={assetTypeFilter}
              onChange={e => setAssetTypeFilter(e.target.value)}
              className="text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-700 dark:text-slate-300"
            >
              <option value="all">Wszystkie typy</option>
              <option value="Artykuły biurowe">Artykuły biurowe</option>
              <option value="Sprzęt IT">Sprzęt IT</option>
              <option value="Meble">Meble</option>
              <option value="Audio-Video">Audio-Video</option>
              <option value="Inne">Inne</option>
            </select>
            <select
              value={assetStatusFilter}
              onChange={e => setAssetStatusFilter(e.target.value)}
              className="text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-700 dark:text-slate-300"
            >
              <option value="all">Wszystkie statusy</option>
              <option value="available">Dostępne</option>
              <option value="low_stock">Mało</option>
              <option value="maintenance">Awaria</option>
            </select>
            <button
              onClick={() => setIsAssetModalOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex gap-2"
            >
              <Plus size={16} /> Dodaj
            </button>
          </div>
        </div>
        <div className="overflow-x-auto p-6">
          <div className="flex gap-4 pb-2 custom-scrollbar">
            {filteredAssets.map(asset => (
              <div
                key={asset.id}
                className={`min-w-[250px] p-4 rounded-2xl border transition-colors relative group shrink-0 ${
                  asset.status === 'maintenance'
                    ? 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-900/50'
                    : asset.status === 'low_stock'
                    ? 'bg-yellow-50/50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/50'
                    : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{asset.asset_type}</span>
                  <div className="flex items-center gap-1">
                    <select
                      className="text-[10px] font-bold px-2 py-1 rounded outline-none border bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      value={asset.status}
                      onChange={e => updateAssetStatus(asset.id, e.target.value)}
                    >
                      <option value="available">Dostępne</option>
                      <option value="low_stock">Mało</option>
                      <option value="maintenance">Awaria</option>
                    </select>
                    {isAdmin && (
                      <button
                        onClick={() => setConfirmDelete({ open: true, type: 'asset', id: asset.id })}
                        className="p-1 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{asset.name}</h3>
                {asset.location && <p className="text-[10px] text-slate-400">{asset.location}</p>}
              </div>
            ))}
            {filteredAssets.length === 0 && (
              <div className="text-sm text-slate-400 dark:text-slate-500 py-4">Brak zasobów dla wybranych filtrów</div>
            )}
          </div>
        </div>
      </div>

      {/* Loans + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden softly-lifted h-[400px] flex flex-col">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-wrap gap-2 justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="text-orange-500" size={20} /> Rejestr Umów Użyczenia
            </h2>
            <div className="flex gap-2 items-center">
              <select
                value={loanStatusFilter}
                onChange={e => setLoanStatusFilter(e.target.value)}
                className="text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-700 dark:text-slate-300"
              >
                <option value="all">Wszystkie</option>
                <option value="Wypożyczone">Wypożyczone</option>
                <option value="Zwrócone">Zwrócone</option>
              </select>
              <button
                onClick={() => setIsLoanModalOpen(true)}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm flex gap-2"
              >
                <Plus size={16} /> Dodaj
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-900/80 sticky top-0 z-10 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">Nr</th>
                  <th className="px-4 py-3">Sprzęt / Pożyczkobiorca</th>
                  <th className="px-4 py-3 text-center">Daty</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  {isAdmin && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-sm">
                {filteredLoans.map(loan => (
                  <tr key={loan.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{loan.agreement_number}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 dark:text-white">{loan.item_category}</div>
                      {loan.borrower_name && <div className="text-[10px] text-slate-500">{loan.borrower_name}</div>}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-slate-600 dark:text-slate-400">
                      {loan.issue_date}
                      {loan.return_date && (
                        <><br /><span className="text-orange-500">→ {loan.return_date}</span></>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleLoanStatus(loan.id, loan.status)}
                        className={`px-3 py-1 text-[10px] font-bold border rounded-lg uppercase ${
                          loan.status === 'Zwrócone'
                            ? 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                            : 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-400'
                        }`}
                      >
                        {loan.status}
                      </button>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setConfirmDelete({ open: true, type: 'loan', id: loan.id })}
                          className="p-1 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Wykres timeline */}
        <div className="lg:col-span-1 bg-gradient-to-b from-slate-900 to-black rounded-3xl shadow-sm border border-slate-800 overflow-hidden softly-lifted flex flex-col h-[400px]">
          <div className="p-5 border-b border-slate-800 shrink-0">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 className="text-blue-400" size={18} /> Wypożyczenia w czasie
            </h2>
          </div>
          <div className="flex-1 p-5 flex items-end justify-between gap-2 overflow-x-auto custom-scrollbar">
            {timelineData.map(([monthYear, count]) => (
              <div key={monthYear} className="flex flex-col items-center gap-2 group flex-1 min-w-[30px]">
                <div className="text-[10px] font-bold text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">{count}</div>
                <div className="w-full max-w-[40px] bg-slate-800 rounded-t-lg relative flex flex-col justify-end h-full">
                  <div
                    className="bg-blue-500 hover:bg-blue-400 transition-colors w-full rounded-t-lg"
                    style={{ height: `${(count / maxVal) * 100}%`, minHeight: '10%' }}
                  />
                </div>
                <div className="text-[9px] text-slate-500 font-mono -rotate-45 origin-top-left mt-2 whitespace-nowrap">{monthYear}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Raporty logistyczne */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden softly-lifted flex flex-col">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="text-violet-500" size={20} /> Raporty Logistyczne
          </h2>
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-sm flex items-center gap-2 shadow-md shadow-violet-500/20 transition-all"
          >
            <Plus size={16} /> Złóż Raport
          </button>
        </div>
        {reports.length === 0 ? (
          <div className="p-10 text-center text-slate-400 dark:text-slate-500 text-sm font-medium">
            Brak złożonych raportów w tej podkomisji.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {reports.map(report => {
              const cfg = reportStatusConfig[report.status] ?? reportStatusConfig.new
              return (
                <div key={report.id} className="p-4 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                  <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    report.status === 'requires_action'
                      ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                      : report.status === 'read'
                      ? 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                      : 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400'
                  }`}>
                    {report.status === 'requires_action'
                      ? <AlertTriangle size={16} />
                      : report.status === 'read'
                      ? <CheckCheck size={16} />
                      : <FileText size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{report.title}</h3>
                      <select
                        value={report.status}
                        onChange={e => updateReportStatus(report.id, e.target.value)}
                        onClick={e => e.stopPropagation()}
                        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border outline-none cursor-pointer shrink-0 transition-colors ${cfg.cls}`}
                      >
                        <option value="new">Nowy</option>
                        <option value="read">Przeczytany</option>
                        <option value="requires_action">Wymaga akcji</option>
                        <option value="archived">Zarchiwizowany</option>
                      </select>
                    </div>
                    {report.content && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{report.content}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                      {report.submitted_by_user && (
                        <span className="flex items-center gap-1">
                          <div className="w-4 h-4 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 flex items-center justify-center text-[8px] font-bold">
                            {report.submitted_by_user.first_name.charAt(0)}{report.submitted_by_user.last_name.charAt(0)}
                          </div>
                          {report.submitted_by_user.first_name} {report.submitted_by_user.last_name}
                        </span>
                      )}
                      <span>{new Date(report.submitted_at).toLocaleDateString('pl-PL')}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal: Dodaj zasób */}
      {isAssetModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Printer className="text-blue-500" size={22} /> Dodaj Zasób
              </h2>
              <button onClick={() => setIsAssetModalOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white">✕</button>
            </div>
            <form onSubmit={handleAddAsset} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Nazwa *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                  value={assetForm.name}
                  onChange={e => setAssetForm({ ...assetForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Typ zasobu *</label>
                <select
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                  value={assetForm.asset_type}
                  onChange={e => setAssetForm({ ...assetForm, asset_type: e.target.value })}
                >
                  <option value="Artykuły biurowe">Artykuły biurowe</option>
                  <option value="Sprzęt IT">Sprzęt IT</option>
                  <option value="Meble">Meble</option>
                  <option value="Audio-Video">Audio-Video</option>
                  <option value="Inne">Inne</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Status</label>
                  <select
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                    value={assetForm.status}
                    onChange={e => setAssetForm({ ...assetForm, status: e.target.value })}
                  >
                    <option value="available">Dostępne</option>
                    <option value="low_stock">Mało</option>
                    <option value="maintenance">Awaria</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Lokalizacja</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                    value={assetForm.location}
                    onChange={e => setAssetForm({ ...assetForm, location: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Notatki</label>
                <textarea
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white resize-none"
                  value={assetForm.notes}
                  onChange={e => setAssetForm({ ...assetForm, notes: e.target.value })}
                />
              </div>
              <button
                type="submit"
                disabled={isSubmittingAsset}
                className="w-full py-4 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex justify-center items-center gap-2 transition-colors disabled:opacity-70"
              >
                {isSubmittingAsset ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Dodaj zasób
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nowa umowa użyczenia */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="text-orange-500" size={22} /> Nowa Umowa Użyczenia
              </h2>
              <button onClick={() => setIsLoanModalOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white">✕</button>
            </div>
            <form onSubmit={handleAddLoan} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Nr umowy</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                    value={loanForm.agreement_number}
                    onChange={e => setLoanForm({ ...loanForm, agreement_number: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Kategoria sprzętu *</label>
                  <select
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                    value={loanForm.item_category}
                    onChange={e => setLoanForm({ ...loanForm, item_category: e.target.value })}
                  >
                    <option value="Namiot Plenerowy">Namiot Plenerowy</option>
                    <option value="Sprzęt Audio">Sprzęt Audio</option>
                    <option value="Projektor">Projektor</option>
                    <option value="Meble">Meble</option>
                    <option value="Inne">Inne</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Pożyczkobiorca *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                  value={loanForm.borrower_name}
                  onChange={e => setLoanForm({ ...loanForm, borrower_name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Data wydania *</label>
                  <input
                    type="date"
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                    value={loanForm.issue_date}
                    onChange={e => setLoanForm({ ...loanForm, issue_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Data zwrotu</label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                    value={loanForm.return_date}
                    onChange={e => setLoanForm({ ...loanForm, return_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Status</label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                  value={loanForm.status}
                  onChange={e => setLoanForm({ ...loanForm, status: e.target.value })}
                >
                  <option value="Wypożyczone">Wypożyczone</option>
                  <option value="Zwrócone">Zwrócone</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Notatki</label>
                <textarea
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white resize-none"
                  value={loanForm.notes}
                  onChange={e => setLoanForm({ ...loanForm, notes: e.target.value })}
                />
              </div>
              <button
                type="submit"
                disabled={isSubmittingLoan}
                className="w-full py-4 mt-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl flex justify-center items-center gap-2 transition-colors disabled:opacity-70"
              >
                {isSubmittingLoan ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Wpisz umowę
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Złóż raport logistyczny */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardList className="text-violet-500" size={22} /> Złóż Raport Logistyczny
              </h2>
              <button onClick={() => setIsReportModalOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors">✕</button>
            </div>
            <form onSubmit={handleAddReport} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Temat Raportu</label>
                <input
                  type="text"
                  required
                  placeholder="np. Stan zapasów materiałów biurowych — marzec 2026"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-violet-500/20 text-slate-900 dark:text-white transition-all"
                  value={reportForm.title}
                  onChange={e => setReportForm({ ...reportForm, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Treść / Opis sytuacji</label>
                <textarea
                  rows={5}
                  placeholder="Opisz sytuację logistyczną, problemy, rekomendacje..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-violet-500/20 text-slate-900 dark:text-white resize-none custom-scrollbar transition-all"
                  value={reportForm.content}
                  onChange={e => setReportForm({ ...reportForm, content: e.target.value })}
                />
              </div>
              <button
                type="submit"
                disabled={isSubmittingReport}
                className="w-full py-4 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20 transition-all disabled:opacity-70"
              >
                {isSubmittingReport ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                Złóż Raport
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
          if (confirmDelete.type === 'asset') deleteAsset(confirmDelete.id)
          else if (confirmDelete.type === 'loan') deleteLoan(confirmDelete.id)
        }}
        onCancel={() => setConfirmDelete({ open: false, type: '', id: '' })}
      />
    </div>
  )
}
