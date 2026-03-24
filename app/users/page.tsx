'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../../components/Sidebar'
import { Users, ShieldCheck, UserX, Clock, Building2, ChevronRight, UserCheck, AlertTriangle, Tag, X, Plus, User, Mail, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [newTag, setNewTag] = useState('')
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    department_id: '',
    system_role: '',
    org_function: '',
    tags: [] as string[]
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.email) {
      const { data: userData } = await supabase.from('users').select('*').eq('email', session.user.email).single()
      if (userData) setCurrentUser(userData)
    }

    const { data: usersData } = await supabase.from('users').select('*, departments(name)').order('created_at', { ascending: false })
    const { data: deptsData } = await supabase.from('departments').select('*').order('name', { ascending: true })

    if (usersData) setUsers(usersData)
    if (deptsData) setDepartments(deptsData)
    setLoading(false)
  }

  const handleSaveUser = async () => {
    if (!selectedUser) return
    const toastId = toast.loading('Zapisywanie profilu...')

    const { error } = await supabase
      .from('users')
      .update({
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        department_id: editForm.department_id || null,
        system_role: editForm.system_role,
        org_function: editForm.org_function,
        tags: editForm.tags
      })
      .eq('id', selectedUser.id)

    if (!error) {
      toast.success('Zapisano!', { id: toastId })
      setSelectedUser(null)
      fetchData()
    } else toast.error('Błąd zapisu', { id: toastId })
  }

  const handleSuspendUser = async (userId: string) => {
    if(!confirm('Czy na pewno chcesz zawiesić to konto?')) return
    const toastId = toast.loading('Zawieszanie...')
    const { error } = await supabase.from('users').update({ system_role: 'inactive', department_id: null }).eq('id', userId)
    if(!error) {
      toast.success('Konto zawieszone.', { id: toastId })
      setSelectedUser(null)
      fetchData()
    } else toast.error('Błąd.', { id: toastId })
  }

  const openEditor = (user: any) => {
    setSelectedUser(user)
    setEditForm({
      first_name: user.first_name,
      last_name: user.last_name,
      department_id: user.department_id || '',
      system_role: user.system_role === 'pending' ? 'member' : user.system_role,
      org_function: user.org_function || '',
      tags: user.tags || []
    })
  }

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTag.trim()) return
    if (!editForm.tags.includes(newTag.trim())) {
      setEditForm({ ...editForm, tags: [...editForm.tags, newTag.trim()] })
    }
    setNewTag('')
  }

  const removeTag = (tagToRemove: string) => {
    setEditForm({ ...editForm, tags: editForm.tags.filter(t => t !== tagToRemove) })
  }

  const pendingUsers = users.filter(u => u.system_role === 'pending')
  const activeUsers = users.filter(u => ['member', 'admin', 'superadmin'].includes(u.system_role))
  const inactiveUsers = users.filter(u => u.system_role === 'inactive')

  // KONTROLA DOSTĘPU
  const isAdmin = currentUser?.system_role === 'admin' || currentUser?.system_role === 'superadmin'

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 relative overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 ml-64 p-8 flex flex-col h-screen overflow-y-auto custom-scrollbar">
        
        <div className="flex justify-between items-center mb-8 shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3 transition-colors">
              <Users className="text-blue-600 dark:text-blue-500" size={32} /> {isAdmin ? 'Kadry i Weryfikacja' : 'Książka Adresowa Zespołu'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 transition-colors">
              {isAdmin ? 'Zarządzaj dostępem, weryfikuj nowych członków i przypisuj kompetencje.' : 'Sprawdź kompetencje i przypisanie członków Komisji.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* KOLUMNA LISTY */}
          <div className="xl:col-span-2 space-y-8">
            
            {/* POCZEKALNIA (WIDOCZNA TYLKO DLA ADMINA) */}
            {isAdmin && (
              <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-orange-200 dark:border-orange-900/50 overflow-hidden transition-colors softly-lifted">
                <div className="p-5 border-b border-orange-100 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-900/10 flex justify-between items-center">
                  <h2 className="text-lg font-bold text-orange-800 dark:text-orange-400 flex items-center gap-2">
                    <Clock size={20} /> Poczekalnia ({pendingUsers.length})
                  </h2>
                  {pendingUsers.length > 0 && <span className="flex h-3 w-3"><span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-orange-400 dark:bg-orange-500 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500 dark:bg-orange-400"></span></span>}
                </div>
                
                {pendingUsers.length > 0 ? (
                  <ul className="divide-y divide-orange-50 dark:divide-orange-900/30">
                    {pendingUsers.map(user => (
                      <li key={user.id} className="p-4 flex items-center justify-between hover:bg-orange-50/50 dark:hover:bg-orange-900/20 cursor-pointer transition-colors" onClick={() => openEditor(user)}>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{user.email}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Zarejestrowano: {new Date(user.created_at).toLocaleDateString()}</p>
                        </div>
                        <button className="text-sm font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/40 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-orange-200 dark:hover:bg-orange-900/60 transition-colors border border-orange-200 dark:border-orange-800/50">
                          <UserCheck size={16}/> Weryfikuj
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-8 text-center text-orange-300 dark:text-orange-500/50 font-medium">Brak nowych wniosków o dostęp.</div>
                )}
              </div>
            )}

            {/* AKTYWNY ZESPÓŁ */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors softly-lifted">
              <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <ShieldCheck size={20} className="text-green-500 dark:text-green-400" /> Aktywny Zespół ({activeUsers.length})
                </h2>
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {activeUsers.map(user => (
                  <li key={user.id} className="p-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors group" onClick={() => openEditor(user)}>
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm shrink-0">
                        {user.first_name.charAt(0)}{user.last_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 dark:text-white truncate">
                          {user.first_name} {user.last_name} 
                          {user.system_role === 'admin' || user.system_role === 'superadmin' ? <span className="ml-2 text-[10px] bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-full uppercase">Zarząd</span> : ''}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building2 size={12}/> {user.departments ? user.departments.name : 'Brak przypisanego pionu'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 ml-14 md:ml-0 md:justify-end">
                      {(user.tags || []).slice(0, 3).map((tag: string) => (
                        <span key={tag} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold rounded border border-slate-200 dark:border-slate-600 flex items-center gap-1">
                          <Tag size={10} /> {tag}
                        </span>
                      ))}
                      {(user.tags || []).length > 3 && <span className="text-[10px] text-slate-400 font-bold px-1">+{user.tags.length - 3}</span>}
                    </div>
                    
                    <ChevronRight size={18} className="text-slate-300 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors hidden md:block" />
                  </li>
                ))}
              </ul>
            </div>

            {/* ZAWIESZENI (WIDOCZNI TYLKO DLA ADMINA) */}
            {isAdmin && inactiveUsers.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden opacity-75 hover:opacity-100 transition-opacity">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                  <h2 className="text-sm font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2"><UserX size={16}/> Konta Zawieszone ({inactiveUsers.length})</h2>
                </div>
                <div className="p-4 text-xs text-slate-500 dark:text-slate-400">
                  {inactiveUsers.map(u => <span key={u.id} className="inline-block mr-3 mb-1 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">{u.first_name} {u.last_name}</span>)}
                </div>
              </div>
            )}
            
          </div>

          {/* KOLUMNA EDYTORA / PROFILU */}
          <div className="relative">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden sticky top-8 transition-colors softly-lifted">
              {selectedUser ? (
                isAdmin ? (
                  // WIDOK EDYTORA DLA ADMINA
                  <div className="flex flex-col h-full max-h-[85vh] overflow-y-auto custom-scrollbar">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                        {selectedUser.system_role === 'pending' ? 'Weryfikacja Nowego' : 'Edycja Profilu'}
                      </h2>
                      <p className="text-xs font-mono text-slate-400 dark:text-slate-500">{selectedUser.email}</p>
                    </div>
                    
                    <div className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Imię</label>
                          <input type="text" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white" value={editForm.first_name} onChange={(e) => setEditForm({...editForm, first_name: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Nazwisko</label>
                          <input type="text" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white" value={editForm.last_name} onChange={(e) => setEditForm({...editForm, last_name: e.target.value})} />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Przypisanie do Pionu</label>
                        <select className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-white" value={editForm.department_id} onChange={(e) => setEditForm({...editForm, department_id: e.target.value})}>
                          <option value="">Brak (Zawieszony / Oczekujący)</option>
                          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Funkcja (opcjonalnie)</label>
                        <input type="text" placeholder="np. Koordynator ds. Promocji" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-white" value={editForm.org_function} onChange={(e) => setEditForm({...editForm, org_function: e.target.value})} />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Poziom Uprawnień</label>
                        <select className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none font-bold text-slate-900 dark:text-white" value={editForm.system_role} onChange={(e) => setEditForm({...editForm, system_role: e.target.value})}>
                          <option value="pending" disabled>Oczekujący (Brak dostępu)</option>
                          <option value="member">Zwykły Członek</option>
                          <option value="admin">Administrator / Zarząd</option>
                          <option value="superadmin">Główny Przewodniczący</option>
                        </select>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-1"><Tag size={14}/> Tagi Kompetencji</label>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {editForm.tags.map(tag => (
                            <span key={tag} className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold rounded-md border border-blue-200 dark:border-blue-800/50 flex items-center gap-1">
                              {tag} <button onClick={() => removeTag(tag)} className="hover:text-red-500"><X size={12} /></button>
                            </span>
                          ))}
                          {editForm.tags.length === 0 && <span className="text-xs text-slate-400 dark:text-slate-500 italic">Brak przypisanych umiejętności.</span>}
                        </div>
                        <form onSubmit={handleAddTag} className="flex gap-2">
                          <input type="text" placeholder="Dodaj tag (np. Prawo Jazdy)..." className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-xs text-slate-900 dark:text-white" value={newTag} onChange={(e) => setNewTag(e.target.value)} />
                          <button type="submit" disabled={!newTag.trim()} className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white disabled:opacity-50 font-bold rounded-lg transition-colors"><Plus size={16}/></button>
                        </form>
                      </div>
                    </div>

                    <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 mt-auto flex flex-col gap-3">
                      <button onClick={handleSaveUser} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all">
                        Zapisz i Zatwierdź
                      </button>
                      {selectedUser.system_role !== 'pending' && selectedUser.system_role !== 'inactive' && (
                        <button onClick={() => handleSuspendUser(selectedUser.id)} className="w-full py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-500 border border-red-100 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/40 font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
                          <AlertTriangle size={16}/> Dezaktywuj Konto
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  // WIDOK WIZYTÓWKI (READ-ONLY) DLA ZWYKŁYCH CZŁONKÓW
                  <div className="p-8 text-center flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-3xl mb-4 shadow-inner">
                      {selectedUser.first_name.charAt(0)}{selectedUser.last_name.charAt(0)}
                    </div>
                    <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-1">
                      {selectedUser.first_name} {selectedUser.last_name}
                    </h2>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6">{selectedUser.org_function || 'Członek Zespołu'}</p>
                    
                    <div className="w-full space-y-3 text-left bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-3 text-sm">
                        <Mail size={16} className="text-slate-400"/>
                        <span className="text-slate-700 dark:text-slate-300">{selectedUser.email}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <Building2 size={16} className="text-slate-400"/>
                        <span className="text-slate-700 dark:text-slate-300 font-bold">{selectedUser.departments?.name || 'Brak pionu'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <Shield size={16} className="text-slate-400"/>
                        <span className="text-slate-700 dark:text-slate-300 uppercase text-xs tracking-widest">{selectedUser.system_role === 'member' ? 'Członek' : 'Zarząd'}</span>
                      </div>
                    </div>

                    <div className="w-full mt-6 text-left">
                      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Tag size={14}/> Kompetencje i Tagi</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedUser.tags && selectedUser.tags.length > 0 ? (
                          selectedUser.tags.map((tag: string) => (
                            <span key={tag} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700">
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-400 italic">Brak przypisanych tagów.</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="p-12 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center justify-center h-full min-h-[400px]">
                  <User size={48} className="mb-4 opacity-50" />
                  <p className="font-medium text-lg">Wybierz osobę z listy</p>
                  <p className="text-sm mt-1">{isAdmin ? 'aby zarządzać uprawnieniami.' : 'aby zobaczyć wizytówkę i kompetencje.'}</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}