'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../../components/Sidebar'
import { Calendar, Plus, Loader2, X, CheckCircle2, Users, FileText, Clock, ArrowRight, Lock, Printer } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<any[]>([])
  const [usersList, setUsersList] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({ title: '', meeting_date: '', meeting_time: '', agenda: '' })

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null)
  const [findings, setFindings] = useState('')
  
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskOwner, setNewTaskOwner] = useState('')
  const [isGeneratingTask, setIsGeneratingTask] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.email) {
      const { data: userData } = await supabase.from('users').select('*').eq('email', session.user.email).single()
      if (userData) setCurrentUser(userData)
    }

    const { data: meetingsData } = await supabase.from('meetings').select('*, users!meetings_organizer_id_fkey(first_name, last_name)').order('meeting_date', { ascending: false })
    const { data: usersData } = await supabase.from('users').select('*')

    if (meetingsData) setMeetings(meetingsData)
    if (usersData) {
      setUsersList(usersData)
      if (usersData.length > 0) setNewTaskOwner(usersData[0].id)
    }
    setLoading(false)
  }

  const handleAddMeeting = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    const toastId = toast.loading('Planowanie spotkania...')

    const { error } = await supabase.from('meetings').insert([{ ...formData, organizer_id: currentUser?.id, attendees: [], protocol_status: 'draft' }])

    if (!error) {
      setFormData({ title: '', meeting_date: '', meeting_time: '', agenda: '' })
      setIsModalOpen(false)
      fetchData()
      toast.success('Spotkanie zaplanowane!', { id: toastId })
    } else toast.error('Błąd: ' + error.message, { id: toastId })
    setIsSubmitting(false)
  }

  const handleCheckIn = async (meetingId: string, currentAttendees: string[] | null) => {
    if (!currentUser) return
    const toastId = toast.loading('Potwierdzanie obecności...')
    const attendeesList = currentAttendees || []
    
    if (attendeesList.includes(currentUser.id)) {
      toast.error('Już potwierdziłeś obecność!', { id: toastId })
      return
    }

    const newAttendees = [...attendeesList, currentUser.id]
    const { error } = await supabase.from('meetings').update({ attendees: newAttendees }).eq('id', meetingId)

    if (!error) {
      fetchData()
      toast.success('Obecność potwierdzona!', { id: toastId })
    } else toast.error('Błąd zapisu', { id: toastId })
  }

  const saveFindings = async () => {
    if (!selectedMeeting) return
    const toastId = toast.loading('Zapisywanie protokołu...')
    const { error } = await supabase.from('meetings').update({ findings }).eq('id', selectedMeeting.id)
    if (!error) {
      fetchData()
      toast.success('Ustalenia zapisane!', { id: toastId })
      // Aktualizujemy otwarte spotkanie, żeby drukował się nowy tekst
      setSelectedMeeting({...selectedMeeting, findings: findings})
    } else toast.error('Błąd zapisu', { id: toastId })
  }

  const generateTask = async () => {
    if (!newTaskTitle.trim() || !selectedMeeting) return
    setIsGeneratingTask(true)
    const toastId = toast.loading('Delegowanie zadania...')
    const { error } = await supabase.from('tasks').insert([{ title: newTaskTitle, description: `Z protokołu: ${selectedMeeting.title}`, owner_id: newTaskOwner, status: 'to_do', priority: 'medium' }])
    
    if (!error) {
      setNewTaskTitle('')
      toast.success('Zadanie na tablicy Kanban!', { id: toastId })
    } else toast.error('Błąd generowania', { id: toastId })
    setIsGeneratingTask(false)
  }

  const openDetails = (meeting: any) => {
    setSelectedMeeting(meeting)
    setFindings(meeting.findings || '')
    setIsDrawerOpen(true)
  }

  // Funkcja wywołująca systemowe okno druku/zapisu do PDF
  const printDocument = () => {
    window.print()
  }

  const todayStr = new Date().toISOString().split('T')[0]
  const isAdmin = currentUser?.system_role === 'admin' || currentUser?.system_role === 'superadmin'

  return (
    <>
      {/* --- WIDOK GŁÓWNY (Ukrywany podczas drukowania `print:hidden`) --- */}
      <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 relative overflow-hidden print:hidden">
        <Sidebar />
        
        <div className="flex-1 ml-64 p-8 flex flex-col h-screen overflow-hidden">
          
          <div className="flex justify-between items-center mb-8 shrink-0">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3 transition-colors">
                <Calendar className="text-blue-600 dark:text-blue-500" size={32} />
                Posiedzenia i Protokoły
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1 transition-colors">Zarządzaj spotkaniami i generuj oficjalne dokumenty PDF</p>
            </div>
            {isAdmin && (
              <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-500/30 transition-all">
                <Plus size={20} /> Zaplanuj Zebranie
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-8">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              
              {/* TRWAJĄCE / NADCHODZĄCE */}
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-4 transition-colors">
                  <Clock className="text-orange-500" size={24} /> Trwające i Nadchodzące
                </h2>
                <div className="space-y-4">
                  {meetings.filter(m => m.meeting_date >= todayStr).map(meeting => {
                    const isToday = meeting.meeting_date === todayStr
                    const imCheckedIn = currentUser && (meeting.attendees || []).includes(currentUser.id)

                    return (
                      <div key={meeting.id} className={`bg-white dark:bg-slate-800 rounded-2xl p-6 border transition-all softly-lifted relative overflow-hidden ${isToday ? 'border-orange-300 dark:border-orange-500/50 shadow-orange-100 dark:shadow-none' : 'border-slate-100 dark:border-slate-700'}`}>
                        {isToday && <div className="absolute top-0 left-0 w-full h-1 bg-orange-500 animate-pulse"></div>}
                        
                        <div className="flex justify-between items-start mb-2 mt-1">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${isToday ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                            {isToday ? 'DZISIAJ' : 'ZAPLANOWANE'}
                          </span>
                          <span className="text-sm font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-3 py-1 rounded-lg">
                            {meeting.meeting_date} | {meeting.meeting_time || '--:--'}
                          </span>
                        </div>
                        
                        <h3 className="font-bold text-slate-900 dark:text-white text-xl mb-2">{meeting.title}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 truncate">{meeting.agenda || 'Brak dodanej agendy.'}</p>
                        
                        <div className="flex gap-3 mt-auto border-t border-slate-50 dark:border-slate-700/50 pt-4">
                          <button onClick={() => openDetails(meeting)} className="px-4 py-2 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold rounded-xl transition-colors text-sm border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                            <FileText size={16}/> Protokół
                          </button>
                          
                          {isToday && (
                            imCheckedIn ? (
                              <button disabled className="px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-500 font-bold rounded-xl text-sm border border-green-200 dark:border-green-900/50 flex items-center gap-2 opacity-70">
                                <CheckCircle2 size={16}/> Obecność zapisana
                              </button>
                            ) : (
                              <button onClick={() => handleCheckIn(meeting.id, meeting.attendees)} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30 font-bold rounded-xl transition-all text-sm flex items-center gap-2 animate-pulse">
                                <Users size={16}/> Potwierdź Obecność
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ZAKOŃCZONE */}
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-4 transition-colors">
                  <CheckCircle2 className="text-slate-400" size={24} /> Zakończone posiedzenia
                </h2>
                <div className="space-y-4">
                  {meetings.filter(m => m.meeting_date < todayStr).map(meeting => (
                    <div key={meeting.id} className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between hover:border-blue-300 dark:hover:border-blue-700 transition-colors group cursor-pointer softly-lifted" onClick={() => openDetails(meeting)}>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{meeting.title}</h3>
                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                          <span className="flex items-center gap-1"><Calendar size={12}/> {meeting.meeting_date}</span>
                          <span className="flex items-center gap-1"><Users size={12}/> Obecnych: {(meeting.attendees || []).length}</span>
                        </div>
                      </div>
                      <ArrowRight className="text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors" />
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* --- SZUFLADA PROTOKOŁU --- */}
        {isDrawerOpen && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity" onClick={() => setIsDrawerOpen(false)} />}
        
        <div className={`fixed top-0 right-0 h-full w-[500px] bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col border-l border-slate-200 dark:border-slate-800 ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          {selectedMeeting && (
            <>
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 shrink-0">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1 leading-tight">{selectedMeeting.title}</h2>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{selectedMeeting.meeting_date} | {selectedMeeting.meeting_time}</p>
                  </div>
                  <button onClick={() => setIsDrawerOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white p-1 bg-white dark:bg-slate-800 rounded-full shadow-sm"><X size={20} /></button>
                </div>
                
                {/* PRZYCISK GENEROWANIA PDF */}
                <button onClick={printDocument} className="mt-4 w-full py-2.5 bg-slate-900 dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors text-sm shadow-md">
                  <Printer size={16} /> Pobierz / Drukuj Protokół (PDF)
                </button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-8">
                
                <div>
                  <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Users size={14}/> Lista obecności ({selectedMeeting.attendees ? selectedMeeting.attendees.length : 0})</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedMeeting.attendees && selectedMeeting.attendees.length > 0 ? (
                      selectedMeeting.attendees.map((attId: string) => {
                        const user = usersList.find(u => u.id === attId)
                        return <span key={attId} className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold rounded-lg border border-blue-100 dark:border-blue-800/50">{user ? `${user.first_name} ${user.last_name}` : 'Nieznany'}</span>
                      })
                    ) : <span className="text-sm text-slate-400 italic">Brak obecnych.</span>}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-3">
                    <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileText size={14}/> Ustalenia / Protokół</h3>
                    {isAdmin && (
                      <button onClick={saveFindings} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg transition-colors">Zapisz zmiany</button>
                    )}
                  </div>
                  <textarea 
                    className={`w-full p-4 border rounded-xl text-slate-900 dark:text-white focus:outline-none transition-all resize-none min-h-[200px] text-sm leading-relaxed ${isAdmin ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-blue-500/20' : 'bg-transparent border-transparent cursor-default'}`}
                    placeholder={isAdmin ? "Zanotuj kluczowe decyzje ze spotkania..." : "Brak zapisanych ustaleń."}
                    value={findings}
                    onChange={(e) => setFindings(e.target.value)}
                    readOnly={!isAdmin}
                  />
                </div>

                {isAdmin && (
                  <div className="bg-slate-800 dark:bg-slate-950 rounded-2xl p-5 shadow-lg mt-auto softly-lifted">
                    <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Lock size={14} className="text-orange-500" /> Generator Zadań (Admin)</h3>
                    <input type="text" placeholder="Co jest do zrobienia?" className="w-full px-4 py-2.5 mb-3 text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border border-transparent focus:border-blue-500/50" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} />
                    <div className="flex gap-2">
                      <select className="flex-1 px-3 py-2 text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border border-transparent" value={newTaskOwner} onChange={(e) => setNewTaskOwner(e.target.value)}>
                        {usersList.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                      </select>
                      <button onClick={generateTask} disabled={isGeneratingTask || !newTaskTitle.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors text-sm flex items-center gap-2 disabled:opacity-50">
                        {isGeneratingTask ? <Loader2 size={16} className="animate-spin"/> : 'Deleguj'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* MODAL PLANOWANIA */}
        {isModalOpen && isAdmin && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            {/* Formularz taki sam jak poprzednio... */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Zaplanuj posiedzenie</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"><X size={24} /></button>
              </div>
              <form onSubmit={handleAddMeeting} className="p-6">
                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Nazwa zebrania</label>
                  <input type="text" autoFocus className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} required />
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Data</label>
                    <input type="date" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]" value={formData.meeting_date} onChange={(e) => setFormData({...formData, meeting_date: e.target.value})} required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Godzina</label>
                    <input type="time" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]" value={formData.meeting_time} onChange={(e) => setFormData({...formData, meeting_time: e.target.value})} />
                  </div>
                </div>
                <div className="mb-6">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Agenda</label>
                  <textarea className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none resize-none h-24 text-slate-900 dark:text-white" value={formData.agenda} onChange={(e) => setFormData({...formData, agenda: e.target.value})} />
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Zapisz do kalendarza'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* --- WIDOK DO DRUKU / PDF (Widoczny TYLKO podczas drukowania) --- */}
      {/* ========================================================= */}
      {selectedMeeting && (
        <div className="hidden print:block p-10 bg-white text-black font-serif max-w-4xl mx-auto">
          
          <div className="border-b-2 border-black pb-6 mb-8 text-center">
            <h1 className="text-2xl font-bold uppercase tracking-widest mb-2">Protokół z Posiedzenia Komisji</h1>
            <p className="text-sm text-gray-600">Wygenerowano z systemu operacyjnego AdminOS</p>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-bold mb-2">{selectedMeeting.title}</h2>
            <div className="grid grid-cols-2 gap-4 text-sm mt-4">
              <div><strong>Data posiedzenia:</strong> {selectedMeeting.meeting_date}</div>
              <div><strong>Godzina rozpoczęcia:</strong> {selectedMeeting.meeting_time || 'Nie określono'}</div>
              <div><strong>Protokolant / Przewodniczący:</strong> {selectedMeeting.users ? `${selectedMeeting.users.first_name} ${selectedMeeting.users.last_name}` : 'System'}</div>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="font-bold text-lg border-b border-gray-300 pb-2 mb-4 uppercase text-sm">Lista Obecności</h3>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {selectedMeeting.attendees && selectedMeeting.attendees.length > 0 ? (
                selectedMeeting.attendees.map((attId: string) => {
                  const user = usersList.find(u => u.id === attId)
                  return <li key={attId}>{user ? `${user.first_name} ${user.last_name}` : 'Nieznany uczestnik'}</li>
                })
              ) : <li className="italic text-gray-500">Brak odnotowanych obecności w systemie.</li>}
            </ul>
          </div>

          {selectedMeeting.agenda && (
            <div className="mb-8">
              <h3 className="font-bold text-lg border-b border-gray-300 pb-2 mb-4 uppercase text-sm">Agenda Spotkania</h3>
              <div className="text-sm whitespace-pre-wrap pl-2">{selectedMeeting.agenda}</div>
            </div>
          )}

          <div className="mb-12">
            <h3 className="font-bold text-lg border-b border-gray-300 pb-2 mb-4 uppercase text-sm">Ustalenia i Decyzje</h3>
            <div className="text-sm whitespace-pre-wrap pl-2 leading-relaxed text-justify">
              {selectedMeeting.findings || <span className="italic text-gray-500">Brak wprowadzonych ustaleń.</span>}
            </div>
          </div>

          <div className="mt-20 pt-8 border-t border-gray-300 flex justify-between items-end">
            <div className="text-xs text-gray-500">
              Dokument wygenerowany elektronicznie.<br/>
              Data wygenerowania: {new Date().toLocaleDateString()}
            </div>
            <div className="text-center">
              <div className="w-48 border-b border-black mb-2"></div>
              <span className="text-xs">Podpis Przewodniczącego</span>
            </div>
          </div>
          
        </div>
      )}
    </>
  )
}