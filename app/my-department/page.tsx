'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../../components/Sidebar'
import { Building2, FileSpreadsheet, Users, Activity, CheckSquare, Clock, Save, Loader2, ShieldAlert, PiggyBank, Package, Archive, Plus, Search, ExternalLink, X, User, Printer, FileText, BarChart3, FolderClosed, BookOpen, Send, Paperclip, UploadCloud } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

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
          // Pobieramy ID członków podkomisji
          const { data: members } = await supabase.from('users').select('id').eq('department_id', userDept.id)
          const memberIds = members?.map(m => m.id) || []
          
          // 🔥 NAPRAWIONE POBIERANIE ZADAŃ 🔥
          // Pobieramy zadania, które są przypisane DO LUDZI w pionie LUB BEZPOŚREDNIO DO PIONU
          let tasksQuery = supabase.from('tasks')
            .select('*, users!tasks_owner_id_fkey(first_name, last_name)')
            .neq('status', 'done')
            .order('deadline', { ascending: true })

          if (memberIds.length > 0) {
            tasksQuery = tasksQuery.or(`department_id.eq.${userDept.id},owner_id.in.(${memberIds.join(',')})`)
          } else {
            tasksQuery = tasksQuery.eq('department_id', userDept.id)
          }

          const { data: tasks } = await tasksQuery
          if (tasks) setDeptTasks(tasks)

          // Przestrzeń robocza (notatnik)
          const { data: note } = await supabase.from('department_notes').select('content').eq('department_id', userDept.id).single()
          if (note) setWorkspaceNote(note.content)
          else await supabase.from('department_notes').insert([{ department_id: userDept.id, content: '' }])

          const deptName = userDept.name.toLowerCase()

          // DOTACJE
          if (deptName.includes('dotacj')) {
            const { data: grantsData } = await supabase.from('grants_radar').select('*, owner:users!grants_radar_owner_id_fkey(first_name, last_name)').order('deadline', { ascending: true })
            if (grantsData) setGrants(grantsData)
          }

          // LOGITECH
          if (deptName.includes('logistyk') || deptName.includes('logitech')) {
            const { data: assetsData } = await supabase.from('assets').select('*').order('name', { ascending: true })
            if (assetsData) setAssets(assetsData)
            const { data: loansData } = await supabase.from('equipment_loans').select('*').order('issue_date', { ascending: false })
            if (loansData) setLoans(loansData)
          }

          // AiKB
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

  // === LOGIKA: AiKB ===
  const handleAddArchiveFolder = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmittingArchive(true)
    await supabase.from('archive_folders').insert([archiveForm]); toast.success('Teczka utworzona!'); setIsArchiveModalOpen(false); setArchiveForm({ title: '', status: 'W przygotowaniu', notes: '' }); fetchDepartmentData(); setIsSubmittingArchive(false)
  }
  const updateArchiveStatus = async (id: string, newStatus: string) => {
    await supabase.from('archive_folders').update({ status: newStatus }).eq('id', id); fetchDepartmentData();
  }
  const handleAddPetition = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmittingPetition(true)
    await supabase.from('petitions').insert([{...petitionForm, submission_date: petitionForm.submission_date || new Date().toISOString().split('T')[0]}]); toast.success('Podanie dodane do rejestru!'); setIsPetitionModalOpen(false); setPetitionForm({ title: '', recipient: '', submission_date: '', status: 'Złożone' }); fetchDepartmentData(); setIsSubmittingPetition(false)
  }
  const updatePetitionStatus = async (id: string, newStatus: string) => {
    await supabase.from('petitions').update({ status: newStatus }).eq('id', id); fetchDepartmentData();
    if(selectedPetition && selectedPetition.id === id) setSelectedPetition({...selectedPetition, status: newStatus})
  }

  const handleAiKBUpload = async (e: React.ChangeEvent<HTMLInputElement>, recordId: string, table: 'archive_folders' | 'petitions', currentRecord: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    const toastId = toast.loading('Wrzucanie pliku na serwer...')
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${crypto.randomUUID()}.${fileExt}`
      const filePath = `aikb/${table}/${recordId}/${fileName}`
      const { error: uploadError } = await supabase.storage.from('adminos-files').upload(filePath, file)
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('adminos-files').getPublicUrl(filePath)
      const newAttachment = { id: crypto.randomUUID(), name: file.name, url: data.publicUrl, added_at: new Date().toISOString() }
      const updatedAttachments = [...(currentRecord.attachments || []), newAttachment]
      const { error: updateError } = await supabase.from(table).update({ attachments: updatedAttachments }).eq('id', recordId)
      if (updateError) throw updateError
      if(table === 'archive_folders') setSelectedFolder({ ...selectedFolder, attachments: updatedAttachments })
      if(table === 'petitions') setSelectedPetition({ ...selectedPetition, attachments: updatedAttachments })
      fetchDepartmentData()
      toast.success('Dokument podpięty!', { id: toastId })
    } catch (error) { toast.error('Błąd podczas wgrywania pliku', { id: toastId }) } finally { setIsUploading(false) }
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
  }
  const calculateDaysLeft = (deadline: string) => {
    if (!deadline) return '-'
    const diffDays = Math.ceil(Math.abs(new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    return new Date(deadline) < new Date() ? `-${diffDays}` : diffDays
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
    
    // 🟢 WIDOK: DOTACJE
    if (deptName.includes('dotacj')) {
      return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden softly-lifted">
          <div className="p-4 md:p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
            <div><h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><PiggyBank className="text-green-500" size={20} /> Radar Dotacji i Patronatów</h2></div>
            <button onClick={() => setIsGrantModalOpen(true)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm flex items-center gap-2"><Plus size={16}/> Nowa Pozycja</button>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left min-w-[800px]">
              <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 backdrop-blur-sm">
                <tr><th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">ID</th><th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Nazwa / Org</th><th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Typ</th><th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">Do Końca</th><th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {grants.map(g => (
                  <tr key={g.id} onClick={() => { setSelectedGrant(g); setIsGrantDrawerOpen(true) }} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer">
                    <td className="px-4 py-3"><span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300">{g.signature}</span></td>
                    <td className="px-4 py-3"><div className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[250px]">{g.name}</div></td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${g.type === 'PATRONAT' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' : 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'}`}>{g.type}</span></td>
                    <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300"><div className="text-xs">{g.deadline}</div></td>
                    <td className="px-4 py-3"><div className={`text-[10px] font-bold border inline-block px-2 py-0.5 rounded ${g.status === 'RADAR' ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800' : g.status === 'ARCHIWUM' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'}`}>{g.status}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }
    
    // 🟠 WIDOK: LOGITECH
    if (deptName.includes('logitech') || deptName.includes('logistyk')) {
      const { sorted: timelineData, maxVal } = getTimelineData()
      return (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden softly-lifted">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center"><h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><Printer className="text-blue-500" size={20} /> Biuro i Zaopatrzenie</h2><button onClick={() => setIsAssetModalOpen(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex gap-2"><Plus size={16}/> Dodaj</button></div>
            <div className="overflow-x-auto p-6"><div className="flex gap-4 pb-2 custom-scrollbar">
                {assets.map(asset => (
                  <div key={asset.id} className={`min-w-[250px] p-4 rounded-2xl border transition-colors relative group shrink-0 ${asset.status === 'maintenance' ? 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-900/50' : asset.status === 'low_stock' ? 'bg-yellow-50/50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/50' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700'}`}>
                    <div className="flex justify-between items-start mb-3"><span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{asset.asset_type}</span><select className="text-[10px] font-bold px-2 py-1 rounded outline-none border bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700" value={asset.status} onChange={(e) => updateAssetStatus(asset.id, e.target.value)}><option value="available">✅ Dostępne</option><option value="low_stock">⚠️ Mało</option><option value="maintenance">🚨 Awaria</option></select></div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{asset.name}</h3>
                  </div>
                ))}
            </div></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden softly-lifted h-[400px] flex flex-col">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center"><h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><FileText className="text-orange-500" size={20} /> Rejestr Umów Użyczenia</h2><button onClick={() => setIsLoanModalOpen(true)} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm flex gap-2"><Plus size={16}/> Dodaj</button></div>
              <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/80 sticky top-0 z-10 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700"><tr><th className="px-4 py-3">Nr</th><th className="px-4 py-3">Sprzęt</th><th className="px-4 py-3 text-center">Daty</th><th className="px-4 py-3 text-center">Status</th></tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-sm">
                    {loans.map(loan => (
                      <tr key={loan.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{loan.agreement_number}</td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{loan.item_category}</td>
                        <td className="px-4 py-3 text-center text-xs text-slate-600 dark:text-slate-400">{loan.issue_date}</td>
                        <td className="px-4 py-3 text-center"><button onClick={() => toggleLoanStatus(loan.id, loan.status)} className={`px-3 py-1 text-[10px] font-bold border rounded-lg uppercase ${loan.status === 'Zwrócone' ? 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' : 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-400'}`}>{loan.status}</button></td>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {archiveFolders.map(folder => (
                  <div key={folder.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-col gap-3 group hover:border-orange-300 dark:hover:border-orange-700 transition-colors">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight pr-2">{folder.title}</h3>
                      <select className={`shrink-0 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded outline-none border cursor-pointer ${folder.status === 'W przygotowaniu' ? 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-800' : 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800'}`} value={folder.status} onChange={(e) => updateArchiveStatus(folder.id, e.target.value)}>
                        <option value="W przygotowaniu">W przygotowaniu</option>
                        <option value="Przekazane do Archiwum">Zarchiwizowane</option>
                      </select>
                    </div>
                    <div className="flex justify-between items-end mt-auto pt-2 border-t border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-1 text-xs font-bold text-slate-500"><Paperclip size={12}/> {folder.attachments?.length || 0} plików</div>
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
                {/* ZAKTUALIZOWANE RENDEROWANIE ZADAŃ */}
                {deptTasks.length > 0 ? deptTasks.map(task => (
                  <Link key={task.id} href="/tasks" className="block p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-700 transition-colors group">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1 group-hover:text-blue-500 transition-colors leading-tight">{task.title}</h3>
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      {task.users ? (
                        <span className="text-slate-500 dark:text-slate-400">{task.users.first_name} {task.users.last_name}</span>
                      ) : (
                        <span className="text-orange-500 animate-pulse">✋ Do wzięcia!</span>
                      )}
                    </div>
                  </Link>
                )) : (<div className="text-center p-6 text-slate-400 text-xs">Brak aktywnych zadań w zespole.</div>)}
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
                <button onClick={() => setIsFolderDrawerOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white p-1"><X size={20} /></button>
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
                <button onClick={() => setIsPetitionDrawerOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white p-1"><X size={20} /></button>
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
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Nazwa (np. Protokoły 2026)</label>
                <input type="text" required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={archiveForm.title} onChange={(e) => setArchiveForm({...archiveForm, title: e.target.value})} />
              </div>
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
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Przedmiot Podania</label>
                <input type="text" required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={petitionForm.title} onChange={(e) => setPetitionForm({...petitionForm, title: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Adresat (np. Prorektor)</label>
                  <input type="text" required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={petitionForm.recipient} onChange={(e) => setPetitionForm({...petitionForm, recipient: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Data Złożenia</label>
                  <input type="date" required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]" value={petitionForm.submission_date} onChange={(e) => setPetitionForm({...petitionForm, submission_date: e.target.value})} />
                </div>
              </div>
              <button type="submit" disabled={isSubmittingPetition} className="w-full py-4 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex justify-center gap-2 transition-colors">Wpisz do Rejestru</button>
            </form>
          </div>
        </div>
      )}

      {/* GRANTY I ZASOBY (Dla Logiki React) */}
      {isGrantModalOpen && <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center"><div className="bg-white dark:bg-slate-800 p-6 rounded-xl"><button onClick={() => setIsGrantModalOpen(false)}>Zamknij</button></div></div>}
      {isAssetModalOpen && <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center"><div className="bg-white dark:bg-slate-800 p-6 rounded-xl"><button onClick={() => setIsAssetModalOpen(false)}>Zamknij</button></div></div>}
      {isLoanModalOpen && <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center"><div className="bg-white dark:bg-slate-800 p-6 rounded-xl"><button onClick={() => setIsLoanModalOpen(false)}>Zamknij</button></div></div>}
    </div>
  )
}