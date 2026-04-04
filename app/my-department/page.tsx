'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../../components/Sidebar'
import { Building2, FileSpreadsheet, Users, Activity, CheckSquare, Clock, Save, Loader2, ShieldAlert, PiggyBank, Package, Archive, Plus, Search, ExternalLink, X, User, Printer, FileText, BarChart3, FolderClosed, BookOpen, Send, Paperclip, UploadCloud, Trash2, ClipboardList, CheckCheck, AlertTriangle, Eye, Filter, TrendingUp, DollarSign, Package2, ArrowUpDown } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import ConfirmDialog from '../../components/ConfirmDialog'
import { logAudit } from '../../lib/audit'

export default function MyDepartmentPage() {
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [department, setDepartment] = useState<any>(null)
  
  const [deptTasks, setDeptTasks] = useState<any[]>([])
  const [workspaceNote, setWorkspaceNote] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // --- STANY: DOTACJE ---
  const [grants, setGrants] = useState<any[]>([])
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false)
  const [isSubmittingGrant, setIsSubmittingGrant] = useState(false)
  const [grantForm, setGrantForm] = useState({ signature: '', name: '', organizer: '', type: 'DOTACJA', max_amount: '', scope: 'Polska', deadline: '', status: 'RADAR', decision: 'OCZEKUJE', owner_id: '', drive_link: '', description: '', notes: '' })
  const [selectedGrant, setSelectedGrant] = useState<any>(null)
  const [isGrantDrawerOpen, setIsGrantDrawerOpen] = useState(false)

  // --- STANY: CZŁONKOWIE DEPARTAMENTU ---
  const [deptMembers, setDeptMembers] = useState<any[]>([])

  // --- STANY: RAPORTY ---
  const [reports, setReports] = useState<any[]>([])
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)
  const [reportForm, setReportForm] = useState({ title: '', content: '' })

  // --- STANY: LOGITECH ---
  const [assets, setAssets] = useState<any[]>([])
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false)
  const [isSubmittingAsset, setIsSubmittingAsset] = useState(false)
  const [assetForm, setAssetForm] = useState({ name: '', asset_type: 'Artykuły biurowe', status: 'available', location: '', notes: '' })

  const [loans, setLoans] = useState<any[]>([])
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false)
  const [isSubmittingLoan, setIsSubmittingLoan] = useState(false)
  const [loanForm, setLoanForm] = useState({ agreement_number: '', item_category: 'Namiot Plenerowy', borrower_name: '', issue_date: '', return_date: '', status: 'Wypożyczone', notes: '' })

  // --- STANY: AiKB ---
  const [archiveFolders, setArchiveFolders] = useState<any[]>([])
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false)
  const [isSubmittingArchive, setIsSubmittingArchive] = useState(false)
  const [archiveForm, setArchiveForm] = useState({ title: '', status: 'W przygotowaniu', notes: '' })
  const [selectedFolder, setSelectedFolder] = useState<any>(null)
  const [isFolderDrawerOpen, setIsFolderDrawerOpen] = useState(false)

  const [petitions, setPetitions] = useState<any[]>([])
  const [isPetitionModalOpen, setIsPetitionModalOpen] = useState(false)
  const [isSubmittingPetition, setIsSubmittingPetition] = useState(false)
  const [petitionForm, setPetitionForm] = useState({ title: '', recipient: '', submission_date: '', status: 'Złożone' })
  const [selectedPetition, setSelectedPetition] = useState<any>(null)
  const [isPetitionDrawerOpen, setIsPetitionDrawerOpen] = useState(false)

  const isAdmin = currentUser?.system_role === 'admin' || currentUser?.system_role === 'superadmin'

  // --- STANY: FILTROWANIE ---
  const [grantSearch, setGrantSearch] = useState('')
  const [grantStatusFilter, setGrantStatusFilter] = useState('all')
  const [grantTypeFilter, setGrantTypeFilter] = useState('all')
  const [assetTypeFilter, setAssetTypeFilter] = useState('all')
  const [assetStatusFilter, setAssetStatusFilter] = useState('all')
  const [loanStatusFilter, setLoanStatusFilter] = useState('all')

  // --- STANY: POTWIERDZENIE USUNIĘCIA ---
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; type: string; id: string }>({ open: false, type: '', id: '' })

  // --- STANY: SZUFLADA GRANTU ---
  const [isGrantDrawerOpen2, setIsGrantDrawerOpen2] = useState(false)

  useEffect(() => {
    fetchDepartmentData()
  }, [])

  const fetchDepartmentData = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.user?.email) {
      const { data: userData } = await supabase.from('users').select('*, departments(*)').eq('email', session.user.email).single()
      
      if (userData) {
        setCurrentUser(userData)
        const userDept = userData.departments
        setDepartment(userDept)

        if (userDept) {
          const { data: members } = await supabase.from('users').select('id, first_name, last_name').eq('department_id', userDept.id)
          const memberIds = members?.map(m => m.id) || []
          setDeptMembers(members || [])
          
          let tasksQuery = supabase.from('tasks').select('*, users!tasks_owner_id_fkey(first_name, last_name)').neq('status', 'done').order('deadline', { ascending: true })
          if (memberIds.length > 0) { tasksQuery = tasksQuery.or(`department_id.eq.${userDept.id},owner_id.in.(${memberIds.join(',')})`) } 
          else { tasksQuery = tasksQuery.eq('department_id', userDept.id) }
          const { data: tasks } = await tasksQuery
          if (tasks) setDeptTasks(tasks)

          const { data: note } = await supabase.from('department_notes').select('content').eq('department_id', userDept.id).single()
          if (note) setWorkspaceNote(note.content)
          else await supabase.from('department_notes').insert([{ department_id: userDept.id, content: '' }])

          const deptName = userDept.name.toLowerCase()

          if (deptName.includes('dotacj')) {
            const { data: grantsData } = await supabase.from('grants_radar').select('*, owner:users!grants_radar_owner_id_fkey(first_name, last_name)').order('deadline', { ascending: true })
            if (grantsData) setGrants(grantsData)
          }

          if (deptName.includes('logistyk') || deptName.includes('logitech')) {
            const { data: assetsData } = await supabase.from('assets').select('*').order('name', { ascending: true })
            if (assetsData) setAssets(assetsData)
            const { data: loansData } = await supabase.from('equipment_loans').select('*').order('issue_date', { ascending: false })
            if (loansData) setLoans(loansData)
            const { data: reportsData } = await supabase.from('reports').select('*, submitted_by_user:users!reports_submitted_by_fkey(first_name, last_name)').eq('subcommittee_type', 'logistics').order('submitted_at', { ascending: false })
            if (reportsData) setReports(reportsData)
          }

          if (deptName.includes('archiwizacj') || deptName.includes('bieżąc')) {
            const { data: archData } = await supabase.from('archive_folders').select('*').order('created_at', { ascending: false })
            if (archData) setArchiveFolders(archData)
            const { data: petData } = await supabase.from('petitions').select('*').order('submission_date', { ascending: false })
            if (petData) setPetitions(petData)
          }
        }
      }
    }
    setLoading(false)
  }

  const handleSaveNote = async () => {
    if (!department) return
    setIsSavingNote(true)
    const { error } = await supabase.from('department_notes').update({ content: workspaceNote, updated_at: new Date().toISOString() }).eq('department_id', department.id)
    if (!error) toast.success('Przestrzeń robocza zapisana!')
    setIsSavingNote(false)
  }

  // === LOGIKA: ZADANIA DEPARTAMENTU ===
  const updateDeptTaskStatus = async (taskId: string, newStatus: string) => {
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
    fetchDepartmentData()
  }

  const updateTaskAssignee = async (taskId: string, userId: string) => {
    await supabase.from('tasks').update({ owner_id: userId || null }).eq('id', taskId)
    toast.success('Zadanie przypisane!')
    fetchDepartmentData()
  }

  // === LOGIKA: RAPORTY ===
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
      fetchDepartmentData()
    } else {
      toast.error('Błąd zapisu raportu')
    }
    setIsSubmittingReport(false)
  }

  const updateReportStatus = async (id: string, newStatus: string) => {
    await supabase.from('reports').update({ status: newStatus }).eq('id', id)
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r))
  }

  // === LOGIKA: AiKB ===
  const handleAddArchiveFolder = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmittingArchive(true)
    await supabase.from('archive_folders').insert([archiveForm]); toast.success('Teczka utworzona!'); setIsArchiveModalOpen(false); setArchiveForm({ title: '', status: 'W przygotowaniu', notes: '' }); fetchDepartmentData(); setIsSubmittingArchive(false)
  }
  const updateArchiveStatus = async (id: string, newStatus: string) => {
    await supabase.from('archive_folders').update({ status: newStatus }).eq('id', id); fetchDepartmentData();
  }
  const deleteArchiveFolder = async (id: string) => {
    if(!confirm('Czy na pewno chcesz usunąć tę teczkę?')) return
    const toastId = toast.loading('Usuwanie...')
    await supabase.from('archive_folders').delete().eq('id', id)
    setIsFolderDrawerOpen(false); fetchDepartmentData(); toast.success('Usunięto', { id: toastId })
  }

  const handleAddPetition = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmittingPetition(true)
    await supabase.from('petitions').insert([{...petitionForm, submission_date: petitionForm.submission_date || new Date().toISOString().split('T')[0]}]); toast.success('Podanie dodane do rejestru!'); setIsPetitionModalOpen(false); setPetitionForm({ title: '', recipient: '', submission_date: '', status: 'Złożone' }); fetchDepartmentData(); setIsSubmittingPetition(false)
  }
  const updatePetitionStatus = async (id: string, newStatus: string) => {
    await supabase.from('petitions').update({ status: newStatus }).eq('id', id); fetchDepartmentData();
    if(selectedPetition && selectedPetition.id === id) setSelectedPetition({...selectedPetition, status: newStatus})
  }
  const deletePetition = async (id: string) => {
    if(!confirm('Czy na pewno chcesz usunąć to podanie?')) return
    const toastId = toast.loading('Usuwanie...')
    await supabase.from('petitions').delete().eq('id', id)
    setIsPetitionDrawerOpen(false); fetchDepartmentData(); toast.success('Usunięto', { id: toastId })
  }

  // === LOGIKA: USUWANIE (ADMIN) ===
  const deleteGrant = async (id: string) => {
    const toastId = toast.loading('Usuwanie...')
    await supabase.from('grants_radar').delete().eq('id', id)
    if (currentUser) await logAudit({ userId: currentUser.id, action: 'DELETE', entityType: 'grant', entityId: id })
    setIsGrantDrawerOpen(false)
    fetchDepartmentData()
    toast.success('Usunięto z radaru', { id: toastId })
    setConfirmDelete({ open: false, type: '', id: '' })
  }

  const deleteAsset = async (id: string) => {
    const toastId = toast.loading('Usuwanie...')
    await supabase.from('assets').delete().eq('id', id)
    if (currentUser) await logAudit({ userId: currentUser.id, action: 'DELETE', entityType: 'asset', entityId: id })
    fetchDepartmentData()
    toast.success('Usunięto zasób', { id: toastId })
    setConfirmDelete({ open: false, type: '', id: '' })
  }

  const deleteLoan = async (id: string) => {
    const toastId = toast.loading('Usuwanie...')
    await supabase.from('equipment_loans').delete().eq('id', id)
    if (currentUser) await logAudit({ userId: currentUser.id, action: 'DELETE', entityType: 'equipment_loan', entityId: id })
    fetchDepartmentData()
    toast.success('Usunięto umowę', { id: toastId })
    setConfirmDelete({ open: false, type: '', id: '' })
  }

  const handleAiKBUpload = async (e: React.ChangeEvent<HTMLInputElement>, recordId: string, table: 'archive_folders' | 'petitions', currentRecord: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    const toastId = toast.loading('Wrzucanie pliku na serwer...')
    try {
      // ODPOLSZCZACZ: Zamienia polskie znaki na standardowe, a spacje na podkreślenia
      const safeFileName = file.name
        .replace(/ą/g, 'a').replace(/Ą/g, 'A')
        .replace(/ć/g, 'c').replace(/Ć/g, 'C')
        .replace(/ę/g, 'e').replace(/Ę/g, 'E')
        .replace(/ł/g, 'l').replace(/Ł/g, 'L')
        .replace(/ń/g, 'n').replace(/Ń/g, 'N')
        .replace(/ó/g, 'o').replace(/Ó/g, 'O')
        .replace(/ś/g, 's').replace(/Ś/g, 'S')
        .replace(/ź/g, 'z').replace(/Ź/g, 'Z')
        .replace(/ż/g, 'z').replace(/Ż/g, 'Z')
        .replace(/[^a-zA-Z0-9.\-_]/g, '_') // Wszelkie inne dziwne znaki i spacje zamienia na _

      // Budujemy bezpieczną ścieżkę do bucketa
      const filePath = `aikb/${table}/${recordId}/${crypto.randomUUID()}/${safeFileName}`
      
      const { error: uploadError } = await supabase.storage.from('adminos-files').upload(filePath, file, {
        contentType: file.type 
      })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('adminos-files').getPublicUrl(filePath)
      
      // Ale do JSONB dodajemy oryginalną nazwę (file.name), żeby w systemie wyglądało ładnie!
      const newAttachment = { id: crypto.randomUUID(), name: file.name, url: data.publicUrl, added_at: new Date().toISOString() }
      const updatedAttachments = [...(currentRecord.attachments || []), newAttachment]
      
      const { error: updateError } = await supabase.from(table).update({ attachments: updatedAttachments }).eq('id', recordId)
      if (updateError) throw updateError

      if(table === 'archive_folders') setSelectedFolder({ ...selectedFolder, attachments: updatedAttachments })
      if(table === 'petitions') setSelectedPetition({ ...selectedPetition, attachments: updatedAttachments })
      
      fetchDepartmentData()
      toast.success('Dokument podpięty!', { id: toastId })
    } catch (error) { 
      toast.error('Błąd podczas wgrywania pliku', { id: toastId }) 
      console.error(error)
    } finally { 
      setIsUploading(false) 
    }
  }


  // === LOGIKA: DOTACJE ===
  const handleAddGrant = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmittingGrant(true)
    const { error } = await supabase.from('grants_radar').insert([{ ...grantForm, max_amount: grantForm.max_amount ? parseFloat(grantForm.max_amount) : null, owner_id: grantForm.owner_id || null }])
    if (!error) { toast.success('Dodano do radaru!'); setIsGrantModalOpen(false); setGrantForm({ signature: '', name: '', organizer: '', type: 'DOTACJA', max_amount: '', scope: 'Polska', deadline: '', status: 'RADAR', decision: 'OCZEKUJE', owner_id: '', drive_link: '', description: '', notes: '' }); fetchDepartmentData(); } 
    setIsSubmittingGrant(false)
  }
  const updateGrantStatus = async (id: string, newStatus: string) => {
    await supabase.from('grants_radar').update({ status: newStatus }).eq('id', id); fetchDepartmentData();
    if (selectedGrant?.id === id) setSelectedGrant({ ...selectedGrant, status: newStatus })
  }

  const updateGrantDecision = async (id: string, newDecision: string) => {
    await supabase.from('grants_radar').update({ decision: newDecision }).eq('id', id); fetchDepartmentData();
    if (selectedGrant?.id === id) setSelectedGrant({ ...selectedGrant, decision: newDecision })
  }

  // === LOGIKA: LOGITECH ===
  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmittingAsset(true)
    await supabase.from('assets').insert([assetForm]); toast.success('Zasób dodany!'); setIsAssetModalOpen(false); setAssetForm({ name: '', asset_type: 'Artykuły biurowe', status: 'available', location: '', notes: '' }); fetchDepartmentData(); setIsSubmittingAsset(false)
  }
  const updateAssetStatus = async (id: string, newStatus: string) => {
    await supabase.from('assets').update({ status: newStatus }).eq('id', id); fetchDepartmentData();
  }
  const handleAddLoan = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmittingLoan(true)
    await supabase.from('equipment_loans').insert([{...loanForm, return_date: loanForm.return_date || null}]); toast.success('Umowa wpisana!'); setIsLoanModalOpen(false); setLoanForm({ agreement_number: '', item_category: 'Namiot Plenerowy', borrower_name: '', issue_date: '', return_date: '', status: 'Wypożyczone', notes: '' }); fetchDepartmentData(); setIsSubmittingLoan(false)
  }
  const toggleLoanStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Wypożyczone' ? 'Zwrócone' : 'Wypożyczone'
    await supabase.from('equipment_loans').update({ status: newStatus, return_date: newStatus === 'Zwrócone' ? new Date().toISOString().split('T')[0] : null }).eq('id', id); fetchDepartmentData();
  }
  const getTimelineData = () => {
    const counts: Record<string, number> = {}
    loans.forEach(loan => { if (loan.issue_date) { const dateKey = loan.issue_date.substring(0, 7); counts[dateKey] = (counts[dateKey] || 0) + 1 } })
    const sorted = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]))
    const maxVal = sorted.length > 0 ? Math.max(...sorted.map(s => s[1])) : 1
    return { sorted, maxVal }
  }


  // ==========================================
  // RENDEROWANIE WŁAŚCIWEGO WIDOKU DLA PIONU
  // ==========================================
  const renderDepartmentTools = () => {
    if (!department) return null
    const deptName = department.name.toLowerCase()
    
    if (deptName.includes('dotacj')) {
      const filteredGrants = grants.filter(g => {
        const matchSearch = !grantSearch || g.name.toLowerCase().includes(grantSearch.toLowerCase()) || g.signature?.toLowerCase().includes(grantSearch.toLowerCase())
        const matchStatus = grantStatusFilter === 'all' || g.status === grantStatusFilter
        const matchType = grantTypeFilter === 'all' || g.type === grantTypeFilter
        return matchSearch && matchStatus && matchType
      })
      const totalAmount = grants.filter(g => g.max_amount).reduce((sum: number, g: any) => sum + (g.max_amount || 0), 0)
      const accepted = grants.filter(g => g.decision === 'ZAAKCEPTOWANE').length
      const inProgress = grants.filter(g => g.status === 'W TOKU').length

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
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{totalAmount > 0 ? `${totalAmount.toLocaleString('pl-PL')} zł` : '—'}</p>
            </div>
          </div>

          <div className="flex flex-col h-full bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden softly-lifted">
            <div className="p-4 md:p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-col gap-3 shrink-0">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><PiggyBank className="text-green-500" size={20} /> Radar Dotacji i Patronatów</h2>
                <button onClick={() => setIsGrantModalOpen(true)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm flex items-center gap-2"><Plus size={16}/> Nowa Pozycja</button>
              </div>
              {/* Filtry */}
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[160px]">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input type="text" placeholder="Szukaj..." value={grantSearch} onChange={e => setGrantSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-white" />
                </div>
                <select value={grantStatusFilter} onChange={e => setGrantStatusFilter(e.target.value)} className="text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-700 dark:text-slate-300">
                  <option value="all">Wszystkie statusy</option>
                  <option value="RADAR">Radar</option>
                  <option value="W TOKU">W toku</option>
                  <option value="ARCHIWUM">Archiwum</option>
                </select>
                <select value={grantTypeFilter} onChange={e => setGrantTypeFilter(e.target.value)} className="text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-700 dark:text-slate-300">
                  <option value="all">Wszystkie typy</option>
                  <option value="DOTACJA">Dotacja</option>
                  <option value="PATRONAT">Patronat</option>
                </select>
              </div>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left min-w-[800px]">
                <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 backdrop-blur-sm">
                  <tr><th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">ID</th><th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Nazwa / Org</th><th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Typ</th><th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">Do Końca</th><th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status</th><th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Decyzja</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {filteredGrants.map(g => (
                    <tr key={g.id} onClick={() => { setSelectedGrant(g); setIsGrantDrawerOpen(true) }} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer">
                      <td className="px-4 py-3"><span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300">{g.signature}</span></td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[250px]">{g.name}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{g.organizer}</div>
                      </td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${g.type === 'PATRONAT' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' : 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'}`}>{g.type}</span></td>
                      <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300"><div className="text-xs">{g.deadline}</div></td>
                      <td className="px-4 py-3"><div className={`text-[10px] font-bold border inline-block px-2 py-0.5 rounded ${g.status === 'RADAR' ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800' : g.status === 'ARCHIWUM' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'}`}>{g.status}</div></td>
                      <td className="px-4 py-3"><div className={`text-[10px] font-bold border inline-block px-2 py-0.5 rounded ${g.decision === 'ZAAKCEPTOWANE' ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800' : g.decision === 'ODRZUCONE' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>{g.decision}</div></td>
                    </tr>
                  ))}
                  {filteredGrants.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">Brak wyników dla wybranych filtrów</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )
    }
    
    if (deptName.includes('logitech') || deptName.includes('logistyk')) {
      const { sorted: timelineData, maxVal } = getTimelineData()

      const filteredAssets = assets.filter(a => {
        const matchType = assetTypeFilter === 'all' || a.asset_type === assetTypeFilter
        const matchStatus = assetStatusFilter === 'all' || a.status === assetStatusFilter
        return matchType && matchStatus
      })
      const filteredLoans = loans.filter(l => loanStatusFilter === 'all' || l.status === loanStatusFilter)
      const loanedCount = loans.filter(l => l.status === 'Wypożyczone').length
      const maintenanceCount = assets.filter(a => a.status === 'maintenance').length

      const reportStatusConfig: Record<string, { label: string; cls: string }> = {
        new:             { label: 'Nowy',          cls: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800' },
        read:            { label: 'Przeczytany',   cls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' },
        requires_action: { label: 'Wymaga akcji',  cls: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800' },
        archived:        { label: 'Zarchiwizowany',cls: 'bg-slate-50 text-slate-400 border-slate-100 dark:bg-slate-900 dark:text-slate-500 dark:border-slate-800' },
      }

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

          <div className="flex flex-col bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden softly-lifted">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-wrap gap-2 justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><Printer className="text-blue-500" size={20} /> Biuro i Zaopatrzenie</h2>
              <div className="flex gap-2 items-center">
                <select value={assetTypeFilter} onChange={e => setAssetTypeFilter(e.target.value)} className="text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-700 dark:text-slate-300">
                  <option value="all">Wszystkie typy</option>
                  <option value="Artykuły biurowe">Artykuły biurowe</option>
                  <option value="Sprzęt IT">Sprzęt IT</option>
                  <option value="Meble">Meble</option>
                  <option value="Audio-Video">Audio-Video</option>
                  <option value="Inne">Inne</option>
                </select>
                <select value={assetStatusFilter} onChange={e => setAssetStatusFilter(e.target.value)} className="text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-700 dark:text-slate-300">
                  <option value="all">Wszystkie statusy</option>
                  <option value="available">Dostępne</option>
                  <option value="low_stock">Mało</option>
                  <option value="maintenance">Awaria</option>
                </select>
                <button onClick={() => setIsAssetModalOpen(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex gap-2"><Plus size={16}/> Dodaj</button>
              </div>
            </div>
            <div className="overflow-x-auto p-6"><div className="flex gap-4 pb-2 custom-scrollbar">
                {filteredAssets.map(asset => (
                  <div key={asset.id} className={`min-w-[250px] p-4 rounded-2xl border transition-colors relative group shrink-0 ${asset.status === 'maintenance' ? 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-900/50' : asset.status === 'low_stock' ? 'bg-yellow-50/50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/50' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{asset.asset_type}</span>
                      <div className="flex items-center gap-1">
                        <select className="text-[10px] font-bold px-2 py-1 rounded outline-none border bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700" value={asset.status} onChange={(e) => updateAssetStatus(asset.id, e.target.value)}><option value="available">✅ Dostępne</option><option value="low_stock">⚠️ Mało</option><option value="maintenance">🚨 Awaria</option></select>
                        {isAdmin && <button onClick={() => setConfirmDelete({ open: true, type: 'asset', id: asset.id })} className="p-1 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>}
                      </div>
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{asset.name}</h3>
                    {asset.location && <p className="text-[10px] text-slate-400">{asset.location}</p>}
                  </div>
                ))}
                {filteredAssets.length === 0 && <div className="text-sm text-slate-400 dark:text-slate-500 py-4">Brak zasobów dla wybranych filtrów</div>}
            </div></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden softly-lifted h-[400px] flex flex-col">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-wrap gap-2 justify-between items-center">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><FileText className="text-orange-500" size={20} /> Rejestr Umów Użyczenia</h2>
                <div className="flex gap-2 items-center">
                  <select value={loanStatusFilter} onChange={e => setLoanStatusFilter(e.target.value)} className="text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-700 dark:text-slate-300">
                    <option value="all">Wszystkie</option>
                    <option value="Wypożyczone">Wypożyczone</option>
                    <option value="Zwrócone">Zwrócone</option>
                  </select>
                  <button onClick={() => setIsLoanModalOpen(true)} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm flex gap-2"><Plus size={16}/> Dodaj</button>
                </div>
              </div>
              <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/80 sticky top-0 z-10 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700"><tr><th className="px-4 py-3">Nr</th><th className="px-4 py-3">Sprzęt / Pożyczkobiorca</th><th className="px-4 py-3 text-center">Daty</th><th className="px-4 py-3 text-center">Status</th>{isAdmin && <th className="px-4 py-3"></th>}</tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-sm">
                    {filteredLoans.map(loan => (
                      <tr key={loan.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{loan.agreement_number}</td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900 dark:text-white">{loan.item_category}</div>
                          {loan.borrower_name && <div className="text-[10px] text-slate-500">{loan.borrower_name}</div>}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-slate-600 dark:text-slate-400">{loan.issue_date}{loan.return_date && <><br/><span className="text-orange-500">→ {loan.return_date}</span></>}</td>
                        <td className="px-4 py-3 text-center"><button onClick={() => toggleLoanStatus(loan.id, loan.status)} className={`px-3 py-1 text-[10px] font-bold border rounded-lg uppercase ${loan.status === 'Zwrócone' ? 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' : 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-400'}`}>{loan.status}</button></td>
                        {isAdmin && <td className="px-4 py-3 text-center"><button onClick={() => setConfirmDelete({ open: true, type: 'loan', id: loan.id })} className="p-1 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors"><Trash2 size={14}/></button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="lg:col-span-1 bg-gradient-to-b from-slate-900 to-black rounded-3xl shadow-sm border border-slate-800 overflow-hidden softly-lifted flex flex-col h-[400px]">
              <div className="p-5 border-b border-slate-800 shrink-0"><h2 className="text-sm font-bold text-white flex items-center gap-2"><BarChart3 className="text-blue-400" size={18} /> Wypożyczenia w czasie</h2></div>
              <div className="flex-1 p-5 flex items-end justify-between gap-2 overflow-x-auto custom-scrollbar">
                {timelineData.map(([monthYear, count]) => (
                  <div key={monthYear} className="flex flex-col items-center gap-2 group flex-1 min-w-[30px]">
                    <div className="text-[10px] font-bold text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">{count}</div>
                    <div className="w-full max-w-[40px] bg-slate-800 rounded-t-lg relative flex flex-col justify-end h-full">
                      <div className="bg-blue-500 hover:bg-blue-400 transition-colors w-full rounded-t-lg" style={{ height: `${(count / maxVal) * 100}%`, minHeight: '10%' }}></div>
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono -rotate-45 origin-top-left mt-2 whitespace-nowrap">{monthYear}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── RAPORTY LOGISTYCZNE ─────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden softly-lifted flex flex-col">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardList className="text-violet-500" size={20} /> Raporty Logistyczne
              </h2>
              <button onClick={() => setIsReportModalOpen(true)} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-sm flex items-center gap-2 shadow-md shadow-violet-500/20 transition-all">
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
                      <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${report.status === 'requires_action' ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' : report.status === 'read' ? 'bg-slate-100 dark:bg-slate-700 text-slate-400' : 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400'}`}>
                        {report.status === 'requires_action' ? <AlertTriangle size={16} /> : report.status === 'read' ? <CheckCheck size={16} /> : <FileText size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{report.title}</h3>
                          <select
                            value={report.status}
                            onChange={(e) => updateReportStatus(report.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
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

        </div>
      )
    }

    // 🟣 WIDOK: AiKB (Archiwizacja i Pisma)
    if (deptName.includes('archiwizacj') || deptName.includes('bieżąc')) {
      return (
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors softly-lifted">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
                <BookOpen className="text-purple-500" size={20} /> Systemy i Operacje
              </h2>
              <div className="space-y-3">
                <Link href="/meetings" className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:border-purple-300 dark:hover:border-purple-800 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center"><FileText size={20}/></div>
                    <div><h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-purple-500 transition-colors">Generator Protokołów</h4><p className="text-xs text-slate-500 dark:text-slate-400">Przejdź do spotkań Zarządu</p></div>
                  </div>
                  <ExternalLink size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-purple-500" />
                </Link>
                <a href="#" target="_blank" className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:border-blue-300 dark:hover:border-blue-800 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center"><Activity size={20}/></div>
                    <div><h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-blue-500 transition-colors">System CRA</h4><p className="text-xs text-slate-500 dark:text-slate-400">Rejestr Aktywności (Zewnętrzny)</p></div>
                  </div>
                  <ExternalLink size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-blue-500" />
                </a>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors softly-lifted flex flex-col h-[350px]">
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><Send className="text-blue-500" size={20} /> Rejestr Podań</h2>
                <button onClick={() => setIsPetitionModalOpen(true)} className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"><Plus size={14}/> Nowe</button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-700 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest sticky top-0 z-10">
                    <tr><th className="px-4 py-3">Podanie</th><th className="px-4 py-3">Adresat</th><th className="px-4 py-3 text-center">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-sm">
                    {petitions.map(p => (
                      <tr key={p.id} onClick={() => { setSelectedPetition(p); setIsPetitionDrawerOpen(true) }} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                            {p.title} {p.attachments?.length > 0 && <Paperclip size={12} className="text-blue-500"/>}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">{p.submission_date}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{p.recipient}</td>
                        <td className="px-4 py-3 text-center"><button className={`px-2 py-1 text-[10px] font-bold border rounded-lg uppercase transition-colors ${p.status === 'Zaakceptowane' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800' : p.status === 'Odrzucone' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`}>{p.status}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden softly-lifted h-[350px] flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FolderClosed className="text-orange-500" size={20} /> Moduł Teczek Archiwalnych
              </h2>
              <button onClick={() => setIsArchiveModalOpen(true)} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm flex items-center gap-2 shadow-md transition-colors">
                <Plus size={16}/> Kompletuj Nową Teczkę
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* NAPRAWIONY LAYOUT KARTY TECZKI */}
                {archiveFolders.map(folder => (
                  <div key={folder.id} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-col justify-between gap-4 group hover:border-orange-300 dark:hover:border-orange-700 transition-colors">
                    <div>
                      <select className={`mb-3 w-max max-w-full text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded outline-none border cursor-pointer ${folder.status === 'W przygotowaniu' ? 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-800' : 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800'}`} value={folder.status} onChange={(e) => updateArchiveStatus(folder.id, e.target.value)}>
                        <option value="W przygotowaniu">W przygotowaniu</option>
                        <option value="Przekazane do Archiwum">Zarchiwizowane</option>
                      </select>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-relaxed break-words">{folder.title}</h3>
                    </div>
                    <div className="flex justify-between items-end pt-3 border-t border-slate-200 dark:border-slate-700 mt-auto">
                      <div className="flex items-center gap-1 text-xs font-bold text-slate-500"><Paperclip size={12}/> {folder.attachments?.length || 0}</div>
                      <button onClick={() => { setSelectedFolder(folder); setIsFolderDrawerOpen(true) }} className="text-xs font-bold text-orange-600 hover:underline">Zarządzaj wkładem</button>
                    </div>
                  </div>
                ))}
                {archiveFolders.length === 0 && <div className="col-span-full p-6 text-center text-xs text-slate-400 dark:text-slate-500">Brak otwartych teczek archiwalnych.</div>}
              </div>
            </div>
          </div>
        </div>
      )
    }

    return null
  }

  // --- RENDERY GŁÓWNE ---
  if (loading) return <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-blue-500"></div></div>
  if (!department) return (<div className="flex min-h-screen bg-slate-50 dark:bg-slate-900"><Sidebar/><div className="flex-1 ml-64 p-8 flex flex-col items-center justify-center text-center"><ShieldAlert size={64} className="text-slate-300 dark:text-slate-600 mb-4" /><h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Brak Przypisania</h2></div></div>)

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 relative overflow-hidden">
      <Sidebar />
      <div className="flex-1 ml-16 md:ml-64 p-4 md:p-8 overflow-y-auto custom-scrollbar flex flex-col h-screen transition-all">
        
        <div className="bg-gradient-to-r from-blue-900 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-blue-900/20 mb-8 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4"><Building2 size={300} /></div>
          <div className="relative z-10">
            <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-widest rounded-full flex items-center gap-1 w-max mb-3 border border-blue-500/30"><Users size={12} /> Twój Zespół</span>
            <h1 className="text-3xl md:text-4xl font-extrabold mb-2">{department.name}</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 flex-1 min-h-0">
          <div className="xl:col-span-2 flex flex-col">{renderDepartmentTools()}</div>
          
          <div className="xl:col-span-1 space-y-8 flex flex-col">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors softly-lifted flex flex-col overflow-hidden h-[300px] shrink-0">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><Activity className="text-orange-500" size={16} /> Przestrzeń Robocza</h2>
                <button onClick={handleSaveNote} disabled={isSavingNote} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50">{isSavingNote ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}</button>
              </div>
              <textarea className="flex-1 w-full p-4 bg-transparent text-slate-800 dark:text-slate-200 outline-none resize-none leading-relaxed text-sm placeholder-slate-400 dark:placeholder-slate-500 custom-scrollbar" placeholder="Wspólny brudnopis dla podkomisji..." value={workspaceNote} onChange={(e) => setWorkspaceNote(e.target.value)} />
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors softly-lifted flex-1 flex flex-col min-h-[300px]">
              <div className="flex justify-between items-center mb-4 shrink-0">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><CheckSquare className="text-green-500" size={16} /> Aktywne Zadania</h2>
                <Link href="/tasks" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">Kanban</Link>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2">
                {deptTasks.length > 0 ? deptTasks.map(task => {
                  const isOverdue = task.deadline && new Date(task.deadline) < new Date()
                  const statusColors: Record<string, string> = {
                    to_do: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
                    in_progress: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800',
                    done: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800',
                  }
                  const statusLabel: Record<string, string> = { to_do: 'Do zrobienia', in_progress: 'W toku', done: 'Gotowe' }
                  return (
                    <div key={task.id} className="p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-700/50 transition-colors">
                      {/* Nagłówek: status + priorytet */}
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <select
                          value={task.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => { e.stopPropagation(); updateDeptTaskStatus(task.id, e.target.value) }}
                          className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border outline-none cursor-pointer transition-colors ${statusColors[task.status] || statusColors.to_do}`}
                        >
                          <option value="to_do">Do zrobienia</option>
                          <option value="in_progress">W toku</option>
                          <option value="done">Gotowe</option>
                        </select>
                        {task.deadline && (
                          <span className={`text-[9px] font-bold flex items-center gap-0.5 ${isOverdue ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
                            <Clock size={10} /> {task.deadline.substring(5)}
                          </span>
                        )}
                      </div>

                      {/* Tytuł */}
                      <Link href="/tasks">
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-2 leading-tight hover:text-blue-500 dark:hover:text-blue-400 transition-colors">{task.title}</h3>
                      </Link>

                      {/* Pasek postępu */}
                      {task.completion_percentage > 0 && (
                        <div className="mb-2">
                          <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 mb-0.5">
                            <span>Postęp</span><span>{task.completion_percentage}%</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1 overflow-hidden">
                            <div className="bg-green-500 h-1 rounded-full transition-all duration-500" style={{ width: `${task.completion_percentage}%` }} />
                          </div>
                        </div>
                      )}

                      {/* Assignee */}
                      <div className="flex items-center gap-1.5 mt-1">
                        {task.users ? (
                          <>
                            <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[9px] font-bold shrink-0">
                              {task.users.first_name.charAt(0)}{task.users.last_name.charAt(0)}
                            </div>
                            <select
                              value={task.owner_id || ''}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateTaskAssignee(task.id, e.target.value)}
                              className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-transparent border-none outline-none cursor-pointer truncate max-w-[140px]"
                            >
                              <option value="">(nieprzypisane)</option>
                              {deptMembers.map(m => (
                                <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                              ))}
                            </select>
                          </>
                        ) : (
                          <select
                            value=""
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => { if (e.target.value) updateTaskAssignee(task.id, e.target.value) }}
                            className="text-[10px] font-bold text-orange-500 bg-transparent border-none outline-none cursor-pointer w-full"
                          >
                            <option value="">✋ Przypisz do osoby...</option>
                            {deptMembers.map(m => (
                              <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  )
                }) : (<div className="text-center p-6 text-slate-400 text-xs">Brak aktywnych zadań w zespole.</div>)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === WSZYSTKIE MODALE PIONÓW === */}
      
      {/* AiKB: SZUFLADA TECZKI ARCHIWALNEJ */}
      {isFolderDrawerOpen && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity" onClick={() => setIsFolderDrawerOpen(false)} />}
      <div className={`fixed top-0 right-0 h-full w-full md:w-[450px] bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-all duration-300 ease-in-out flex flex-col border-l border-slate-200 dark:border-slate-800 ${isFolderDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedFolder && (
          <>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0 relative">
              <div className="flex justify-between items-start mb-4">
                <select className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold uppercase rounded-lg px-3 py-1.5 outline-none shadow-sm" value={selectedFolder.status} onChange={(e) => updateArchiveStatus(selectedFolder.id, e.target.value)}>
                  <option value="W przygotowaniu">W przygotowaniu</option><option value="Przekazane do Archiwum">Zarchiwizowane</option>
                </select>
                <div className="flex items-center gap-1">
                  {/* ADMIN USUWANKO */}
                  {isAdmin && <button onClick={() => deleteArchiveFolder(selectedFolder.id)} className="text-slate-400 hover:text-red-500 p-1 mr-2 transition-colors" title="Usuń Teczkę"><Trash2 size={18} /></button>}
                  <button onClick={() => setIsFolderDrawerOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white p-1"><X size={20} /></button>
                </div>
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight mb-2">{selectedFolder.title}</h2>
              <p className="text-xs font-mono text-slate-500">Utworzono: {selectedFolder.created_at.substring(0, 10)}</p>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-6">
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm softly-lifted">
                <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Paperclip size={14}/> Wkład Teczki (Natywny Dysk)</h3>
                <div className="space-y-2 mb-4">
                  {(!selectedFolder.attachments || selectedFolder.attachments.length === 0) ? (
                    <p className="text-xs text-slate-400 italic">Teczka jest pusta.</p>
                  ) : (
                    selectedFolder.attachments.map((att: any) => (
                      <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-blue-200 transition-colors group">
                        <div className="w-8 h-8 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center shrink-0"><FileText size={14}/></div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{att.name}</span>
                      </a>
                    ))
                  )}
                </div>
                <div className="relative">
                  <input type="file" onChange={(e) => handleAiKBUpload(e, selectedFolder.id, 'archive_folders', selectedFolder)} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                  <div className={`w-full py-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition-colors ${isUploading ? 'border-slate-200 bg-slate-50' : 'border-orange-200 bg-orange-50/50 hover:bg-orange-50 dark:border-orange-900/50 dark:bg-orange-900/10 dark:hover:bg-orange-900/20'}`}>
                    {isUploading ? <Loader2 size={24} className="text-orange-500 animate-spin" /> : <UploadCloud size={24} className="text-orange-500" />}
                    <span className="text-xs font-bold text-orange-600 dark:text-orange-400">{isUploading ? 'Przesyłanie na serwer...' : 'Dorzuć dokument do teczki'}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* AiKB: SZUFLADA PODANIA */}
      {isPetitionDrawerOpen && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity" onClick={() => setIsPetitionDrawerOpen(false)} />}
      <div className={`fixed top-0 right-0 h-full w-full md:w-[450px] bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-all duration-300 ease-in-out flex flex-col border-l border-slate-200 dark:border-slate-800 ${isPetitionDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedPetition && (
          <>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0 relative">
              <div className="flex justify-between items-start mb-4">
                <select className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold uppercase rounded-lg px-3 py-1.5 outline-none shadow-sm" value={selectedPetition.status} onChange={(e) => updatePetitionStatus(selectedPetition.id, e.target.value)}>
                  <option value="Złożone">Złożone</option><option value="Zaakceptowane">Zaakceptowane</option><option value="Odrzucone">Odrzucone</option>
                </select>
                <div className="flex items-center gap-1">
                  {/* ADMIN USUWANKO */}
                  {isAdmin && <button onClick={() => deletePetition(selectedPetition.id)} className="text-slate-400 hover:text-red-500 p-1 mr-2 transition-colors" title="Usuń Podanie"><Trash2 size={18} /></button>}
                  <button onClick={() => setIsPetitionDrawerOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white p-1"><X size={20} /></button>
                </div>
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight mb-2">{selectedPetition.title}</h2>
              <p className="text-xs font-bold text-slate-500">Adresat: {selectedPetition.recipient}</p>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-6">
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm softly-lifted">
                <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Paperclip size={14}/> Skan Podania</h3>
                <div className="space-y-2 mb-4">
                  {(!selectedPetition.attachments || selectedPetition.attachments.length === 0) ? (
                    <p className="text-xs text-slate-400 italic">Brak podpiętego skanu.</p>
                  ) : (
                    selectedPetition.attachments.map((att: any) => (
                      <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-blue-200 transition-colors group">
                        <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center shrink-0"><FileText size={14}/></div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{att.name}</span>
                      </a>
                    ))
                  )}
                </div>
                <div className="relative">
                  <input type="file" onChange={(e) => handleAiKBUpload(e, selectedPetition.id, 'petitions', selectedPetition)} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                  <div className={`w-full py-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition-colors ${isUploading ? 'border-slate-200 bg-slate-50' : 'border-blue-200 bg-blue-50/50 hover:bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/10 dark:hover:bg-blue-900/20'}`}>
                    {isUploading ? <Loader2 size={24} className="text-blue-500 animate-spin" /> : <UploadCloud size={24} className="text-blue-500" />}
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{isUploading ? 'Przesyłanie na serwer...' : 'Wgraj plik (np. PDF)'}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* AiKB: Modal Teczki Archiwalnej */}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Nowa Teczka Archiwalna</h2>
              <button onClick={() => setIsArchiveModalOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddArchiveFolder} className="p-6 space-y-4">
              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Nazwa (np. Protokoły 2026)</label><input type="text" required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={archiveForm.title} onChange={(e) => setArchiveForm({...archiveForm, title: e.target.value})} /></div>
              <button type="submit" disabled={isSubmittingArchive} className="w-full py-4 mt-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl flex justify-center gap-2 transition-colors">Utwórz teczkę</button>
            </form>
          </div>
        </div>
      )}

      {/* AiKB: Modal Rejestru Podań */}
      {isPetitionModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Wpisz podanie do rejestru</h2>
              <button onClick={() => setIsPetitionModalOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddPetition} className="p-6 space-y-4">
              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Przedmiot Podania</label><input type="text" required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={petitionForm.title} onChange={(e) => setPetitionForm({...petitionForm, title: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Adresat (np. Prorektor)</label><input type="text" required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={petitionForm.recipient} onChange={(e) => setPetitionForm({...petitionForm, recipient: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Data Złożenia</label><input type="date" required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]" value={petitionForm.submission_date} onChange={(e) => setPetitionForm({...petitionForm, submission_date: e.target.value})} /></div>
              </div>
              <button type="submit" disabled={isSubmittingPetition} className="w-full py-4 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex justify-center gap-2 transition-colors">Wpisz do Rejestru</button>
            </form>
          </div>
        </div>
      )}

      {/* RAPORTY LOGISTYCZNE: Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardList className="text-violet-500" size={22} /> Złóż Raport Logistyczny
              </h2>
              <button onClick={() => setIsReportModalOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"><X size={24} /></button>
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
                  onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Treść / Opis sytuacji</label>
                <textarea
                  rows={5}
                  placeholder="Opisz sytuację logistyczną, problemy, rekomendacje..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-violet-500/20 text-slate-900 dark:text-white resize-none custom-scrollbar transition-all"
                  value={reportForm.content}
                  onChange={(e) => setReportForm({ ...reportForm, content: e.target.value })}
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

      {/* === MODAL: NOWA DOTACJA / PATRONAT === */}
      {isGrantModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><PiggyBank className="text-green-500" size={22} /> Nowa Dotacja / Patronat</h2>
              <button onClick={() => setIsGrantModalOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddGrant} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Sygnatura / ID</label><input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={grantForm.signature} onChange={e => setGrantForm({...grantForm, signature: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Typ *</label>
                  <select required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={grantForm.type} onChange={e => setGrantForm({...grantForm, type: e.target.value})}>
                    <option value="DOTACJA">Dotacja</option><option value="PATRONAT">Patronat</option>
                  </select>
                </div>
              </div>
              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Nazwa programu *</label><input type="text" required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={grantForm.name} onChange={e => setGrantForm({...grantForm, name: e.target.value})} /></div>
              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Organizator</label><input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={grantForm.organizer} onChange={e => setGrantForm({...grantForm, organizer: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Maks. kwota (zł)</label><input type="number" min="0" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={grantForm.max_amount} onChange={e => setGrantForm({...grantForm, max_amount: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Zasięg</label>
                  <select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={grantForm.scope} onChange={e => setGrantForm({...grantForm, scope: e.target.value})}>
                    <option value="Polska">Polska</option><option value="Europejski">Europejski</option><option value="Regionalny">Regionalny</option><option value="Lokalny">Lokalny</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Termin złożenia</label><input type="date" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]" value={grantForm.deadline} onChange={e => setGrantForm({...grantForm, deadline: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Status</label>
                  <select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={grantForm.status} onChange={e => setGrantForm({...grantForm, status: e.target.value})}>
                    <option value="RADAR">Radar</option><option value="W TOKU">W toku</option><option value="ARCHIWUM">Archiwum</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Decyzja</label>
                  <select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={grantForm.decision} onChange={e => setGrantForm({...grantForm, decision: e.target.value})}>
                    <option value="OCZEKUJE">Oczekuje</option><option value="ZAAKCEPTOWANE">Zaakceptowane</option><option value="ODRZUCONE">Odrzucone</option>
                  </select>
                </div>
                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Opiekun</label>
                  <select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={grantForm.owner_id} onChange={e => setGrantForm({...grantForm, owner_id: e.target.value})}>
                    <option value="">— Nieprzypisany —</option>
                    {deptMembers.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Link do Drive</label><input type="url" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={grantForm.drive_link} onChange={e => setGrantForm({...grantForm, drive_link: e.target.value})} /></div>
              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Opis / Szczegóły</label><textarea rows={3} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white resize-none custom-scrollbar" value={grantForm.description} onChange={e => setGrantForm({...grantForm, description: e.target.value})} /></div>
              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Notatki wewnętrzne</label><textarea rows={2} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white resize-none custom-scrollbar" value={grantForm.notes} onChange={e => setGrantForm({...grantForm, notes: e.target.value})} /></div>
              <button type="submit" disabled={isSubmittingGrant} className="w-full py-4 mt-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl flex justify-center items-center gap-2 transition-colors disabled:opacity-70">
                {isSubmittingGrant ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Dodaj do Radaru
              </button>
            </form>
          </div>
        </div>
      )}

      {/* === SZUFLADA GRANTU === */}
      {isGrantDrawerOpen && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40" onClick={() => setIsGrantDrawerOpen(false)} />}
      <div className={`fixed top-0 right-0 h-full w-full md:w-[480px] bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-all duration-300 ease-in-out flex flex-col border-l border-slate-200 dark:border-slate-800 ${isGrantDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedGrant && (
          <>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-2">
                  <select className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold uppercase rounded-lg px-3 py-1.5 outline-none" value={selectedGrant.status} onChange={e => updateGrantStatus(selectedGrant.id, e.target.value)}>
                    <option value="RADAR">Radar</option><option value="W TOKU">W toku</option><option value="ARCHIWUM">Archiwum</option>
                  </select>
                  <select className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold uppercase rounded-lg px-3 py-1.5 outline-none" value={selectedGrant.decision} onChange={e => updateGrantDecision(selectedGrant.id, e.target.value)}>
                    <option value="OCZEKUJE">Oczekuje</option><option value="ZAAKCEPTOWANE">Zaakceptowane</option><option value="ODRZUCONE">Odrzucone</option>
                  </select>
                </div>
                <div className="flex gap-1">
                  {isAdmin && <button onClick={() => setConfirmDelete({ open: true, type: 'grant', id: selectedGrant.id })} className="text-slate-400 hover:text-red-500 p-1 transition-colors"><Trash2 size={18} /></button>}
                  <button onClick={() => setIsGrantDrawerOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white p-1"><X size={20} /></button>
                </div>
              </div>
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border mb-2 ${selectedGrant.type === 'PATRONAT' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' : 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'}`}>{selectedGrant.type}</span>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight">{selectedGrant.name}</h2>
              {selectedGrant.organizer && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{selectedGrant.organizer}</p>}
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {selectedGrant.deadline && <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl"><p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Termin</p><p className="text-sm font-bold text-slate-900 dark:text-white">{selectedGrant.deadline}</p></div>}
                {selectedGrant.max_amount && <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl"><p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Maks. kwota</p><p className="text-sm font-bold text-green-600 dark:text-green-400">{Number(selectedGrant.max_amount).toLocaleString('pl-PL')} zł</p></div>}
                {selectedGrant.scope && <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl"><p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Zasięg</p><p className="text-sm font-bold text-slate-900 dark:text-white">{selectedGrant.scope}</p></div>}
                {selectedGrant.owner && <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl"><p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Opiekun</p><p className="text-sm font-bold text-slate-900 dark:text-white">{selectedGrant.owner.first_name} {selectedGrant.owner.last_name}</p></div>}
              </div>
              {selectedGrant.description && <div><p className="text-xs font-bold text-slate-500 uppercase mb-2">Opis</p><p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{selectedGrant.description}</p></div>}
              {selectedGrant.notes && <div><p className="text-xs font-bold text-slate-500 uppercase mb-2">Notatki</p><p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{selectedGrant.notes}</p></div>}
              {selectedGrant.drive_link && <a href={selectedGrant.drive_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm font-bold hover:underline"><ExternalLink size={16}/> Otwórz w Google Drive</a>}
            </div>
          </>
        )}
      </div>

      {/* === MODAL: NOWY ZASÓB === */}
      {isAssetModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><Package className="text-blue-500" size={22}/> Dodaj Zasób</h2>
              <button onClick={() => setIsAssetModalOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddAsset} className="p-6 space-y-4">
              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Nazwa *</label><input type="text" required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={assetForm.name} onChange={e => setAssetForm({...assetForm, name: e.target.value})} /></div>
              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Typ zasobu *</label>
                <select required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={assetForm.asset_type} onChange={e => setAssetForm({...assetForm, asset_type: e.target.value})}>
                  <option value="Artykuły biurowe">Artykuły biurowe</option>
                  <option value="Sprzęt IT">Sprzęt IT</option>
                  <option value="Meble">Meble</option>
                  <option value="Audio-Video">Audio-Video</option>
                  <option value="Inne">Inne</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Status</label>
                  <select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={assetForm.status} onChange={e => setAssetForm({...assetForm, status: e.target.value})}>
                    <option value="available">Dostępne</option><option value="low_stock">Mało</option><option value="maintenance">Awaria</option>
                  </select>
                </div>
                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Lokalizacja</label><input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={assetForm.location} onChange={e => setAssetForm({...assetForm, location: e.target.value})} /></div>
              </div>
              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Notatki</label><textarea rows={2} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white resize-none" value={assetForm.notes} onChange={e => setAssetForm({...assetForm, notes: e.target.value})} /></div>
              <button type="submit" disabled={isSubmittingAsset} className="w-full py-4 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex justify-center items-center gap-2 transition-colors disabled:opacity-70">
                {isSubmittingAsset ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18}/>} Dodaj zasób
              </button>
            </form>
          </div>
        </div>
      )}

      {/* === MODAL: NOWA UMOWA UŻYCZENIA === */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><FileText className="text-orange-500" size={22}/> Nowa Umowa Użyczenia</h2>
              <button onClick={() => setIsLoanModalOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddLoan} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Nr umowy</label><input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={loanForm.agreement_number} onChange={e => setLoanForm({...loanForm, agreement_number: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Kategoria sprzętu *</label>
                  <select required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={loanForm.item_category} onChange={e => setLoanForm({...loanForm, item_category: e.target.value})}>
                    <option value="Namiot Plenerowy">Namiot Plenerowy</option>
                    <option value="Sprzęt Audio">Sprzęt Audio</option>
                    <option value="Projektor">Projektor</option>
                    <option value="Meble">Meble</option>
                    <option value="Inne">Inne</option>
                  </select>
                </div>
              </div>
              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Pożyczkobiorca *</label><input type="text" required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={loanForm.borrower_name} onChange={e => setLoanForm({...loanForm, borrower_name: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Data wydania *</label><input type="date" required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]" value={loanForm.issue_date} onChange={e => setLoanForm({...loanForm, issue_date: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Data zwrotu</label><input type="date" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]" value={loanForm.return_date} onChange={e => setLoanForm({...loanForm, return_date: e.target.value})} /></div>
              </div>
              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Status</label>
                <select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={loanForm.status} onChange={e => setLoanForm({...loanForm, status: e.target.value})}>
                  <option value="Wypożyczone">Wypożyczone</option><option value="Zwrócone">Zwrócone</option>
                </select>
              </div>
              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Notatki</label><textarea rows={2} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white resize-none" value={loanForm.notes} onChange={e => setLoanForm({...loanForm, notes: e.target.value})} /></div>
              <button type="submit" disabled={isSubmittingLoan} className="w-full py-4 mt-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl flex justify-center items-center gap-2 transition-colors disabled:opacity-70">
                {isSubmittingLoan ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18}/>} Wpisz umowę
              </button>
            </form>
          </div>
        </div>
      )}

      {/* === CONFIRM DIALOG === */}
      <ConfirmDialog
        isOpen={confirmDelete.open}
        title="Potwierdź usunięcie"
        description="Tej operacji nie można cofnąć."
        confirmLabel="Usuń"
        variant="danger"
        onConfirm={() => {
          if (confirmDelete.type === 'grant') deleteGrant(confirmDelete.id)
          else if (confirmDelete.type === 'asset') deleteAsset(confirmDelete.id)
          else if (confirmDelete.type === 'loan') deleteLoan(confirmDelete.id)
        }}
        onCancel={() => setConfirmDelete({ open: false, type: '', id: '' })}
      />
    </div>
  )
}