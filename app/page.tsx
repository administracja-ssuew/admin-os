'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import { Briefcase, CheckSquare, Calendar, Activity, TrendingUp, Clock, AlertCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  // 1. ZDEFINIOWANE STANY (Tego nam brakowało!)
  const [stats, setStats] = useState({
    activeCases: 0,
    pendingTasks: 0,
    upcomingMeetings: 0,
    completedTasksThisWeek: 0,
  })
  
  const [urgentTasks, setUrgentTasks] = useState<any[]>([])
  const [recentCases, setRecentCases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  // 2. FUNKCJA POBIERAJĄCA PRAWDZIWE DANE
  const fetchDashboardData = async () => {
    setLoading(true)
    
    // Kto się loguje?
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.email) {
      const { data: userData } = await supabase.from('users').select('*').eq('email', session.user.email).single()
      if (userData) setCurrentUser(userData)
    }

    const today = new Date().toISOString().split('T')[0]
    
    // Statystyki Spraw
    const { count: activeCases } = await supabase.from('cases').select('*', { count: 'exact', head: true }).neq('status', 'closed')
    const { data: latestCases } = await supabase.from('cases').select('*').order('created_at', { ascending: false }).limit(4)
    
    // Statystyki Zadań (Otwarte)
    const { count: pendingTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).neq('status', 'done')
    const { data: tasksDueSoon } = await supabase.from('tasks').select('*, users(first_name, last_name)').neq('status', 'done').order('deadline', { ascending: true }).limit(4)
    
    // Statystyki Spotkań
    const { count: upcomingMeetings } = await supabase.from('meetings').select('*', { count: 'exact', head: true }).gte('meeting_date', today)

    // PRAWDZIWA STATYSTYKA ZAMKNIĘTYCH ZADAŃ
    const { count: completedTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'done')

    setStats({
      activeCases: activeCases || 0,
      pendingTasks: pendingTasks || 0,
      upcomingMeetings: upcomingMeetings || 0,
      completedTasksThisWeek: completedTasks || 0
    })

    if (tasksDueSoon) setUrgentTasks(tasksDueSoon)
    if (latestCases) setRecentCases(latestCases)
      
    setLoading(false)
  }

  // 3. WIZUALNY KAFELEK
  const StatCard = ({ title, value, subtitle, icon: Icon, color, bgLight, bgDark }: any) => (
    <div className={`p-6 rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 shadow-sm softly-lifted transition-all relative overflow-hidden group`}>
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 dark:opacity-5 transition-transform group-hover:scale-150 ${color}`}></div>
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{title}</p>
          <h3 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-1">{value}</h3>
          <p className={`text-xs font-bold ${color.replace('bg-', 'text-')}`}>{subtitle}</p>
        </div>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${bgLight} dark:${bgDark} ${color.replace('bg-', 'text-')}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  )

  // 4. GŁÓWNY INTERFEJS
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 relative overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 ml-64 p-8 overflow-y-auto custom-scrollbar">
        
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 transition-colors">
            Witaj w Centrum Dowodzenia{currentUser ? `, ${currentUser.first_name}` : ''}! 👋
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Oto przegląd sytuacji operacyjnej Komisji na dzisiaj.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard title="Sprawy w toku" value={stats.activeCases} subtitle="Oczekujące na zamknięcie" icon={Briefcase} color="bg-blue-500" bgLight="bg-blue-50" bgDark="bg-blue-900/30" />
              <StatCard title="Otwarte Zadania" value={stats.pendingTasks} subtitle="Wymagają podjęcia akcji" icon={CheckSquare} color="bg-green-500" bgLight="bg-green-50" bgDark="bg-green-900/30" />
              <StatCard title="Nadchodzące Zebrania" value={stats.upcomingMeetings} subtitle="Zaplanowane w kalendarzu" icon={Calendar} color="bg-orange-500" bgLight="bg-orange-50" bgDark="bg-orange-900/30" />
              <StatCard title="Rozwiązane Zadania" value={stats.completedTasksThisWeek} subtitle="Skuteczność zespołu" icon={TrendingUp} color="bg-purple-500" bgLight="bg-purple-50" bgDark="bg-purple-900/30" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              
              <div className="xl:col-span-2 space-y-8">
                
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors softly-lifted">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Activity size={20} className="text-blue-500"/> Tempo Operacyjne
                    </h2>
                  </div>
                  
                  <div className="flex items-end gap-2 h-48 mt-4 pt-4 border-t border-slate-50 dark:border-slate-700/50">
                    {[40, 70, 45, 90, 65, 30, 85].map((height, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                        <div className="w-full relative bg-slate-100 dark:bg-slate-700 rounded-t-lg h-full overflow-hidden">
                          <div className="absolute bottom-0 w-full bg-blue-500 hover:bg-blue-400 dark:bg-blue-600 dark:hover:bg-blue-500 transition-all duration-500 rounded-t-lg" style={{ height: `${height}%` }}></div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">Dzień {i+1}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors softly-lifted">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Briefcase size={20} className="text-slate-500"/> Ostatnio wpłynęły
                    </h2>
                    <Link href="/cases" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">Wszystkie sprawy</Link>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recentCases.map(c => (
                      <Link key={c.id} href="/cases" className="block p-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:border-blue-300 dark:hover:border-blue-700 transition-colors group">
                        <div className="font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold mb-1">{c.case_number}</div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate group-hover:text-blue-500 transition-colors">{c.title}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{c.source === 'Formularz Zewnętrzny' ? '📥 Biuro Podawcze' : 'Wewnętrzna'}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors softly-lifted">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <AlertCircle size={20} className="text-red-500"/> Pilne Zadania
                  </h2>
                </div>
                
                <div className="space-y-4">
                  {urgentTasks.length > 0 ? urgentTasks.map(task => {
                    const isOverdue = task.deadline && new Date(task.deadline) < new Date()
                    return (
                      <Link key={task.id} href="/tasks" className="block p-4 rounded-2xl border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight group-hover:text-blue-500 transition-colors mb-2">{task.title}</h3>
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[9px] shrink-0">
                              {task.users ? `${task.users.first_name.charAt(0)}${task.users.last_name.charAt(0)}` : '?'}
                            </div>
                            {task.users ? task.users.first_name : 'Brak'}
                          </span>
                          <span className={`flex items-center gap-1 px-2 py-1 rounded-md ${isOverdue ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                            <Clock size={12}/> {task.deadline ? task.deadline.substring(5) : 'Brak'}
                          </span>
                        </div>
                      </Link>
                    )
                  }) : (
                    <div className="text-center p-8 text-slate-400 dark:text-slate-500 font-medium border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-2xl">
                      Brak pilnych zadań. Świetna robota!
                    </div>
                  )}
                </div>

                <Link href="/tasks" className="mt-6 w-full py-3 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm border border-slate-200 dark:border-slate-700">
                  Przejdź do Tablicy <ArrowRight size={16}/>
                </Link>
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  )
}