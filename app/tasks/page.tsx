'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../../components/Sidebar'
import { CheckSquare, Clock, Plus, LayoutGrid, List as ListIcon, Search, User, X, CheckCircle2, Circle, ArrowRight, ArrowLeft, Loader2, Paperclip, FileText, Hand, FolderKanban, Building2, Briefcase, Trash2, Edit2, UploadCloud } from 'lucide-react'
import toast from 'react-hot-toast'

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [cases, setCases] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)

  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [newChecklistItem, setNewChecklistItem] = useState('')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  
  // Tryb Edycji dla Admina
  const [isEditingTask, setIsEditingTask] = useState(false)
  const [editForm, setEditForm] = useState<any>({})

  const [formData, setFormData] = useState({ 
    title: '', description: '', owner_id: '', department_id: '',
    project_id: '', case_id: '', deadline: '', status: 'to_do', priority: 'medium' 
  })

  useEffect(() => {
    fetchData()
    if (window.innerWidth < 768) setViewMode('list')
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.email) {
      const { data: userData } = await supabase.from('users').select('*').eq('email', session.user.email).single()
      if (userData) setCurrentUser(userData)
    }

    const { data: tasksData } = await supabase.from('tasks')
      .select('*, owner:users!tasks_owner_id_fkey(first_name, last_name), projects(name), departments(name), cases(title, case_number)')
      .order('created_at', { ascending: false })
      
    const { data: usersData } = await supabase.from('users').select('*').order('first_name', { ascending: true })
    const { data: projectsData } = await supabase.from('projects').select('*').order('name', { ascending: true })
    const { data: deptsData } = await supabase.from('departments').select('*').order('name', { ascending: true })
    const { data: casesData } = await supabase.from('cases').select('*').order('created_at', { ascending: false })

    if (tasksData) setTasks(tasksData)
    if (usersData) setUsers(usersData)
    if (projectsData) setProjects(projectsData)
    if (deptsData) setDepartments(deptsData)
    if (casesData) setCases(casesData)
    
    setLoading(false)
  }

  const isAdmin = currentUser?.system_role === 'admin' || currentUser?.system_role === 'superadmin'

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
    if (!error) {
      fetchData()
      if (selectedTask && selectedTask.id === taskId) setSelectedTask({ ...selectedTask, status: newStatus })
    }
  }

  const claimTask = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation()
    if (!currentUser) return
    const toastId = toast.loading('Przypisuję do Ciebie...')
    const { error } = await supabase.from('tasks').update({ owner_id: currentUser.id }).eq('id', taskId)
    if (!error) { toast.success('Zadanie jest Twoje!', { id: toastId }); fetchData() } 
    else toast.error('Błąd przypisywania', { id: toastId })
  }

  // --- NOWE FUNKCJE ADMINA (EDYCJA I USUWANIE) ---
  const startEditing = () => {
    setEditForm({
      title: selectedTask.title,
      description: selectedTask.description || '',
      owner_id: selectedTask.owner_id || '',
      department_id: selectedTask.department_id || '',
      deadline: selectedTask.deadline || '',
      priority: selectedTask.priority
    })
    setIsEditingTask(true)
  }

  const saveTaskEdit = async () => {
    const toastId = toast.loading('Zapisywanie zmian...')
    const { error } = await supabase.from('tasks').update({
      title: editForm.title,
      description: editForm.description,
      owner_id: editForm.owner_id || null,
      department_id: editForm.department_id || null,
      deadline: editForm.deadline || null,
      priority: editForm.priority
    }).eq('id', selectedTask.id)

    if (!error) {
      toast.success('Zaktualizowano zadanie', { id: toastId })
      setIsEditingTask(false)
      setIsDrawerOpen(false)
      fetchData()
    } else {
      toast.error('Błąd zapisu', { id: toastId })
    }
  }

  const deleteTask = async () => {
    if(!confirm('Czy na pewno chcesz usunąć to zadanie? (Nie da się tego cofnąć)')) return
    const toastId = toast.loading('Usuwanie...')
    const { error } = await supabase.from('tasks').delete().eq('id', selectedTask.id)
    if (!error) {
      toast.success('Zadanie usunięte', { id: toastId })
      setIsDrawerOpen(false)
      fetchData()
    } else {
      toast.error('Błąd usuwania', { id: toastId })
    }
  }

  // --- NATIVE UPLOAD DO SUPABASE STORAGE ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedTask) return

    setIsUploading(true)
    const toastId = toast.loading('Wrzucanie pliku na serwer...')

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${crypto.randomUUID()}.${fileExt}`
      const filePath = `tasks/${selectedTask.id}/${fileName}`

      // 1. Upload do bucketa
      const { error: uploadError } = await supabase.storage.from('adminos-files').upload(filePath, file)
      if (uploadError) throw uploadError

      // 2. Pobranie publicznego linku
      const { data } = supabase.storage.from('adminos-files').getPublicUrl(filePath)
      
      // 3. Zapis do JSONB w tabeli tasks
      const newAttachment = { id: crypto.randomUUID(), name: file.name, url: data.publicUrl, added_at: new Date().toISOString() }
      const updatedAttachments = [...(selectedTask.attachments || []), newAttachment]

      const { error: updateError } = await supabase.from('tasks').update({ attachments: updatedAttachments }).eq('id', selectedTask.id)
      if (updateError) throw updateError

      setSelectedTask({ ...selectedTask, attachments: updatedAttachments })
      fetchData()
      toast.success('Plik dodany poprawnie!', { id: toastId })
    } catch (error) {
      console.error(error)
      toast.error('Błąd podczas wgrywania pliku', { id: toastId })
    } finally {
      setIsUploading(false)
    }
  }

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChecklistItem.trim() || !selectedTask) return
    const newItem = { id: crypto.randomUUID(), text: newChecklistItem, completed: false }
    const updatedChecklists = [...(selectedTask.checklists || []), newItem]
    const completedCount = updatedChecklists.filter((c: any) => c.completed).length
    const percentage = Math.round((completedCount / updatedChecklists.length) * 100)
    const { error } = await supabase.from('tasks').update({ checklists: updatedChecklists, completion_percentage: percentage }).eq('id', selectedTask.id)
    if (!error) { setSelectedTask({ ...selectedTask, checklists: updatedChecklists, completion_percentage: percentage }); setNewChecklistItem(''); fetchData() }
  }

  const toggleChecklistItem = async (itemId: string) => {
    if (!selectedTask) return
    const updatedChecklists = (selectedTask.checklists || []).map((item: any) => item.id === itemId ? { ...item, completed: !item.completed } : item)
    const completedCount = updatedChecklists.filter((c: any) => c.completed).length
    const percentage = Math.round((completedCount / updatedChecklists.length) * 100)
    const { error } = await supabase.from('tasks').update({ checklists: updatedChecklists, completion_percentage: percentage }).eq('id', selectedTask.id)
    if (!error) { setSelectedTask({ ...selectedTask, checklists: updatedChecklists, completion_percentage: percentage }); fetchData() }
  }

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    const { error } = await supabase.from('tasks').insert([{
      title: formData.title, description: formData.description, owner_id: formData.owner_id || null, department_id: formData.department_id || null,
      project_id: formData.project_id || null, case_id: formData.case_id || null, deadline: formData.deadline || null, priority: formData.priority,
      status: formData.status, checklists: [], attachments: [], completion_percentage: 0
    }])
    if (!error) { setFormData({ title: '', description: '', owner_id: '', department_id: '', project_id: '', case_id: '', deadline: '', status: 'to_do', priority: 'medium' }); setIsModalOpen(false); fetchData(); toast.success('Zadanie wrzucone na tablicę!') } 
    else { toast.error('Błąd dodawania zadania.') }
    setIsSubmitting(false)
  }

  const filteredTasks = tasks.filter((t: any) => (t.title || '').toLowerCase().includes(searchTerm.toLowerCase()))
  const columns = [
    { id: 'to_do', title: 'Do Zrobienia', color: 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/50', textColor: 'text-slate-600 dark:text-slate-400' },
    { id: 'in_progress', title: 'W Toku', color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/50', textColor: 'text-blue-700 dark:text-blue-400' },
    { id: 'done', title: 'Zrobione', color: 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/50', textColor: 'text-green-700 dark:text-green-500' }
  ]

  const TaskCard = ({ task }: { task: any }) => {
    const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done'
    const isUnassigned = !task.owner_id
    const isForMyDept = isUnassigned && task.department_id && currentUser?.department_id === task.department_id

    return (
      <div className={`bg-white dark:bg-slate-800 p-4 rounded-xl border transition-all group cursor-pointer relative overflow-hidden softly-lifted ${isUnassigned ? 'border-orange-200 dark:border-orange-800/50 shadow-orange-100 dark:shadow-none' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'}`} onClick={() => { setSelectedTask(task); setIsEditingTask(false); setIsDrawerOpen(true); }}>
        {isUnassigned && <div className="absolute inset-0 bg-orange-50/30 dark:bg-orange-900/5 pointer-events-none"></div>}
        <div className="flex justify-between items-start mb-2 relative z-10">
          <div className="flex gap-1.5 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${task.priority === 'high' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800/50' : task.priority === 'medium' ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-500 border-yellow-100 dark:border-yellow-800/50' : 'bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-600'}`}>{task.priority === 'high' ? 'Pilne' : task.priority === 'medium' ? 'Średnie' : 'Niskie'}</span>
            {task.projects && <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-800/50 flex items-center gap-1"><FolderKanban size={10} /> {task.projects.name}</span>}
            {task.cases && <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800/50 flex items-center gap-1"><Briefcase size={10} /> {task.cases.case_number}</span>}
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 rounded shadow-sm">
            {task.status !== 'to_do' && <button onClick={(e) => {e.stopPropagation(); updateTaskStatus(task.id, task.status === 'done' ? 'in_progress' : 'to_do')}} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-blue-600"><ArrowLeft size={14}/></button>}
            {task.status !== 'done' && <button onClick={(e) => {e.stopPropagation(); updateTaskStatus(task.id, task.status === 'to_do' ? 'in_progress' : 'done')}} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-blue-600"><ArrowRight size={14}/></button>}
          </div>
        </div>
        <h3 className="font-bold text-slate-900 dark:text-white mb-3 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors relative z-10">{task.title}</h3>
        {task.checklists?.length > 0 && (
          <div className="mb-3 relative z-10">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1"><span>Postęp ({task.completion_percentage}%)</span><span>{task.checklists.filter((c: any) => c.completed).length}/{task.checklists.length}</span></div>
            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden"><div className="bg-green-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${task.completion_percentage || 0}%` }}></div></div>
          </div>
        )}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-50 dark:border-slate-700/50 relative z-10">
          {isUnassigned ? (
            task.departments ? <button onClick={(e) => claimTask(e, task.id)} className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg shadow-sm transition-colors flex items-center gap-1 ${isForMyDept ? 'bg-orange-500 hover:bg-orange-600 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>{isForMyDept ? <Hand size={12}/> : <Building2 size={12}/>} {isForMyDept ? 'Twój Pion: Biorę to!' : `Dla: ${task.departments.name}`}</button> : <button onClick={(e) => claimTask(e, task.id)} className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg shadow-md transition-colors flex items-center gap-1 animate-pulse"><Hand size={12} /> Biorę to!</button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-[9px] shrink-0">{task.owner ? `${task.owner.first_name.charAt(0)}${task.owner.last_name.charAt(0)}` : '?'}</div>
              <span className="truncate max-w-[80px]">{task.owner ? task.owner.first_name : 'Brak'}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            {task.attachments?.length > 0 && <Paperclip size={12} className="text-slate-400 dark:text-slate-500" />}
            {task.deadline && <div className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${isOverdue ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}><Clock size={10} /> {task.deadline.substring(5)}</div>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 relative overflow-hidden">
      <Sidebar />
      <div className="flex-1 ml-64 p-4 md:p-8 transition-all flex flex-col h-screen">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 shrink-0">
          <div><h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3 transition-colors"><CheckSquare className="text-green-500" size={32} /> Tablica Operacyjna</h1></div>
          {isAdmin && <button onClick={() => setIsModalOpen(true)} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 transition-all"><Plus size={20} /> Nowe Zadanie</button>}
        </div>

        <div className="bg-white dark:bg-slate-800 p-2 rounded-xl mb-6 border border-slate-200 dark:border-slate-700 shrink-0 shadow-sm flex flex-col md:flex-row gap-2 transition-colors">
          <div className="relative flex-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={18} /><input type="text" placeholder="Szukaj zadania..." className="w-full pl-10 pr-4 py-2 border-none focus:ring-0 outline-none text-slate-900 dark:text-white bg-transparent text-sm font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
          <div className="w-px bg-slate-100 dark:bg-slate-700 mx-2 hidden md:block"></div>
          <div className="flex gap-1 bg-slate-50 dark:bg-slate-900/50 p-1 rounded-lg self-end md:self-auto">
            <button onClick={() => setViewMode('board')} className={`p-1.5 rounded-md flex items-center gap-1 text-sm font-bold transition-all ${viewMode === 'board' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={16} /> Tablica</button>
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md flex items-center gap-1 text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}><ListIcon size={16} /> Lista</button>
          </div>
        </div>

        {viewMode === 'board' && (
          <div className="flex-1 flex gap-4 overflow-x-auto custom-scrollbar pb-4 items-start">
            {columns.map(col => (
              <div key={col.id} className={`flex-1 min-w-[300px] max-w-sm rounded-2xl flex flex-col max-h-full overflow-hidden border transition-colors ${col.color}`}>
                <div className={`p-4 border-b border-black/5 dark:border-white/5 shrink-0 flex justify-between items-center ${col.textColor}`}><h3 className="font-extrabold uppercase tracking-wider text-sm">{col.title}</h3><span className="bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded-full text-xs font-bold">{filteredTasks.filter((t: any) => t.status === col.id).length}</span></div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">{filteredTasks.filter((t: any) => t.status === col.id).map((task: any) => <TaskCard key={task.id} task={task} />)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- SZUFLADA ZADANIA (TERAZ Z UPRAWNIENIAMI ADMINA I NATYWNYM DYSKIEM) --- */}
      {isDrawerOpen && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity" onClick={() => setIsDrawerOpen(false)} />}
      <div className={`fixed top-0 right-0 h-full w-full md:w-[450px] bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-all duration-300 ease-in-out flex flex-col border-l border-slate-200 dark:border-slate-800 ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedTask && (
          <>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0 relative">
              <div className="flex justify-between items-start mb-4">
                <select className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase rounded-lg px-3 py-1.5 outline-none shadow-sm transition-colors" value={selectedTask.status} onChange={(e) => updateTaskStatus(selectedTask.id, e.target.value)}>
                  <option value="to_do">Do Zrobienia</option><option value="in_progress">W Toku</option><option value="done">Zrobione</option>
                </select>
                <div className="flex items-center gap-2">
                  {/* PANEL WŁADZY ADMINA */}
                  {isAdmin && !isEditingTask && (
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm mr-2">
                      <button onClick={startEditing} className="p-1 text-slate-400 hover:text-blue-500 transition-colors" title="Edytuj"><Edit2 size={16}/></button>
                      <div className="w-px h-4 bg-slate-200 dark:bg-slate-700"></div>
                      <button onClick={deleteTask} className="p-1 text-slate-400 hover:text-red-500 transition-colors" title="Usuń"><Trash2 size={16}/></button>
                    </div>
                  )}
                  <button onClick={() => {setIsDrawerOpen(false); setIsEditingTask(false)}} className="text-slate-400 hover:text-slate-800 dark:hover:text-white p-1 bg-white dark:bg-slate-800 rounded-full shadow-sm"><X size={20} /></button>
                </div>
              </div>

              {/* WIDOK EDYCJI vs WIDOK NORMALNY */}
              {isEditingTask ? (
                <div className="space-y-3">
                  <input type="text" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 rounded-lg text-sm font-bold text-slate-900 dark:text-white outline-none" value={editForm.title} onChange={(e) => setEditForm({...editForm, title: e.target.value})} />
                  <textarea className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 rounded-lg text-sm text-slate-900 dark:text-white outline-none resize-none h-20" value={editForm.description} onChange={(e) => setEditForm({...editForm, description: e.target.value})} />
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <select className="px-2 py-2 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={editForm.owner_id} onChange={(e) => setEditForm({...editForm, owner_id: e.target.value, department_id: ''})}>
                      <option value="">Brak osoby...</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                    </select>
                    <select className="px-2 py-2 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white disabled:opacity-50" disabled={!!editForm.owner_id} value={editForm.department_id} onChange={(e) => setEditForm({...editForm, department_id: e.target.value})}>
                      <option value="">LUB Brak Pionu...</option>{departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <input type="date" className="px-2 py-2 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white [color-scheme:light] dark:[color-scheme:dark]" value={editForm.deadline} onChange={(e) => setEditForm({...editForm, deadline: e.target.value})} />
                    <select className="px-2 py-2 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={editForm.priority} onChange={(e) => setEditForm({...editForm, priority: e.target.value})}>
                      <option value="low">Priorytet: Niski</option><option value="medium">Priorytet: Średni</option><option value="high">Priorytet: Wysoki</option>
                    </select>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setIsEditingTask(false)} className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-lg">Anuluj</button>
                    <button onClick={saveTaskEdit} className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700">Zapisz Zmiany</button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">{selectedTask.title}</h2>
                  {selectedTask.description && <p className="text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 whitespace-pre-wrap">{selectedTask.description}</p>}
                  
                  <div className="flex flex-wrap gap-4 mt-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5"><User size={14}/> {selectedTask.owner ? `${selectedTask.owner.first_name} ${selectedTask.owner.last_name}` : <span className="text-orange-500">Nieprzypisane (Do wzięcia)</span>}</div>
                    {selectedTask.deadline && <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400"><Clock size={14}/> Termin: {selectedTask.deadline}</div>}
                  </div>

                  {!selectedTask.owner_id && (
                    <button onClick={(e) => claimTask(e, selectedTask.id)} className="mt-4 w-full py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2">
                      <Hand size={16} /> Biorę to zadanie!
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50 dark:bg-slate-900 flex flex-col gap-6">
              {(selectedTask.projects || selectedTask.departments || selectedTask.cases) && (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm softly-lifted space-y-3">
                  {selectedTask.projects && <div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-500 dark:text-slate-400">Projekt parasolowy:</span><span className="text-xs font-bold bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-1 rounded flex items-center gap-1"><FolderKanban size={12}/> {selectedTask.projects.name}</span></div>}
                  {selectedTask.cases && <div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-500 dark:text-slate-400">Powiązana Sprawa:</span><span className="text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded flex items-center gap-1"><Briefcase size={12}/> {selectedTask.cases.case_number}</span></div>}
                  {selectedTask.departments && !selectedTask.owner_id && <div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-500 dark:text-slate-400">Dedykowane dla Pionu:</span><span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded flex items-center gap-1"><Building2 size={12}/> {selectedTask.departments.name}</span></div>}
                </div>
              )}

              {/* SEKACJA: ZAŁĄCZNIKI NATYWNE (SUPABASE STORAGE) */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm softly-lifted">
                <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Paperclip size={14}/> Załączniki (Natywny Dysk)</h3>
                
                <div className="space-y-2 mb-4">
                  {(!selectedTask.attachments || selectedTask.attachments.length === 0) ? (
                    <p className="text-xs text-slate-400 italic">Brak podpiętych plików.</p>
                  ) : (
                    selectedTask.attachments.map((att: any) => (
                      <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-blue-200 transition-colors group">
                        <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center shrink-0"><FileText size={14}/></div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{att.name}</span>
                      </a>
                    ))
                  )}
                </div>

                <div className="relative">
                  <input type="file" onChange={handleFileUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                  <div className={`w-full py-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition-colors ${isUploading ? 'border-slate-200 bg-slate-50' : 'border-blue-200 bg-blue-50/50 hover:bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/10 dark:hover:bg-blue-900/20'}`}>
                    {isUploading ? <Loader2 size={24} className="text-blue-500 animate-spin" /> : <UploadCloud size={24} className="text-blue-500" />}
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{isUploading ? 'Przesyłanie na serwer...' : 'Kliknij lub przeciągnij plik tutaj'}</span>
                  </div>
                </div>
              </div>

              {/* SEKACJA: PODZADANIA */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm softly-lifted">
                <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><CheckSquare size={14}/> Podzadania</h3>
                <div className="space-y-2 mb-4">
                  {(selectedTask.checklists || []).map((item: any) => (
                    <div key={item.id} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-blue-200 transition-colors group cursor-pointer" onClick={() => toggleChecklistItem(item.id)}>
                      <div className={`mt-0.5 shrink-0 ${item.completed ? 'text-green-500' : 'text-slate-300 dark:text-slate-600'}`}>{item.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}</div>
                      <span className={`text-sm font-medium ${item.completed ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300'}`}>{item.text}</span>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddChecklist} className="flex gap-2 relative">
                  <input type="text" placeholder="Dodaj podzadanie..." className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm text-slate-900 dark:text-white" value={newChecklistItem} onChange={(e) => setNewChecklistItem(e.target.value)} />
                  <button type="submit" disabled={!newChecklistItem.trim()} className="absolute right-2 top-2 p-1.5 bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg"><Plus size={18} /></button>
                </form>
              </div>
            </div>
          </>
        )}
      </div>

      {isModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          {/* Formularz dodawania bez zmian */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Zleć Zadanie Operacyjne</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddTask} className="p-6 space-y-4">
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tytuł zadania</label><input type="text" required autoFocus className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Konkretna Osoba</label><select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={formData.owner_id} onChange={(e) => setFormData({...formData, owner_id: e.target.value, department_id: ''})}><option value="">Do wzięcia!</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}</select></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lub Do Pionu</label><select disabled={!!formData.owner_id} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white disabled:opacity-50" value={formData.department_id} onChange={(e) => setFormData({...formData, department_id: e.target.value})}><option value="">Wybierz Pion...</option>{departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Projekt</label><select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={formData.project_id} onChange={(e) => setFormData({...formData, project_id: e.target.value})}><option value="">Brak</option>{projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Powiązana Sprawa</label><select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={formData.case_id} onChange={(e) => setFormData({...formData, case_id: e.target.value})}><option value="">Brak Sprawy</option>{cases.map((c: any) => <option key={c.id} value={c.id}>{c.case_number}</option>)}</select></div>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full py-4 mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">{isSubmitting ? <Loader2 size={20} className="animate-spin" /> : 'Zleć Zadanie'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}