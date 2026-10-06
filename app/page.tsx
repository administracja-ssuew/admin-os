'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useCurrentUser } from '../hooks/useCurrentUser'
import Sidebar from '../components/Sidebar'
import { Briefcase, CheckSquare, TrendingUp, Clock, AlertCircle, ArrowRight, User, ListTodo, Inbox } from 'lucide-react'
import Link from 'next/link'
import type { Case, Task, TaskStatus } from '../types'
import SkeletonLoader from '../components/SkeletonLoader'
import EmptyState from '../components/EmptyState'
import toast from 'react-hot-toast'
import { isUrgentTask, isVisibleOnBoard, localDateString, sortTasksForOverview } from '../lib/dashboard'

const STATUS_LABEL: Record<TaskStatus, string> = { to_do: 'Do zrobienia', in_progress: 'W toku', done: 'Zrobione' }
const STATUS_BADGE: Record<TaskStatus, string> = {
  to_do: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  in_progress: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  done: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-500',
}

type NewRequest = Pick<Case, 'id' | 'case_number' | 'title' | 'created_at'>

function formatDeadline(deadline: string, today: string) {
  const day = deadline.slice(0, 10)
  if (day === today) return 'dziś'
  const [y, m, d] = today.split('-').map(Number)
  if (day === localDateString(new Date(y, m - 1, d + 1))) return 'jutro'
  return `${day.slice(8, 10)}.${day.slice(5, 7)}`
}

export default function DashboardPage() {
  const { user: currentUser, isAdmin } = useCurrentUser()
  const searchParams = useSearchParams()

  // Show access denied toast when redirected from a protected route
  useEffect(() => {
    if (searchParams.get('toast') === 'access_denied') {
      toast.error('Brak dostępu do tej strony')
    }
  }, [searchParams])

  const [stats, setStats] = useState({
    activeCases: 0,
    pendingTasks: 0,
    completedTasksThisWeek: 0,
  })
  const [tasks, setTasks] = useState<Task[]>([])
  const [newRequests, setNewRequests] = useState<NewRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)

    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 1) // poniedziałek

    const [activeCasesRes, pendingTasksRes, completedTasksRes, tasksRes, requestsRes] = await Promise.all([
      supabase.from('cases').select('*', { count: 'exact', head: true }).neq('status', 'closed'),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).neq('status', 'done'),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'done').gte('created_at', startOfWeek.toISOString()),
      supabase.from('tasks').select('*, owner:users!tasks_owner_id_fkey(first_name, last_name)'),
      // Zsyp z Biura Podawczego: wnioski z formularza, jeszcze nie podjęte
      supabase.from('cases').select('id, case_number, title, created_at')
        .eq('source', 'Formularz Zewnętrzny').eq('status', 'new')
        .order('created_at', { ascending: false }),
    ])

    setStats({
      activeCases: activeCasesRes.count || 0,
      pendingTasks: pendingTasksRes.count || 0,
      completedTasksThisWeek: completedTasksRes.count || 0,
    })
    if (tasksRes.data) setTasks(tasksRes.data)
    if (requestsRes.data) setNewRequests(requestsRes.data)

    setLoading(false)
  }

  const todayStr = localDateString(new Date())
  const boardTasks = tasks.filter(t => isVisibleOnBoard(t, currentUser, isAdmin))
  const myTasks = sortTasksForOverview(tasks.filter(t => currentUser && t.owner_id === currentUser.id && t.status !== 'done'))
  const allTasks = sortTasksForOverview(boardTasks)
  const urgentTasks = sortTasksForOverview(boardTasks.filter(t => isUrgentTask(t, todayStr)))
  const statusCounts = (['to_do', 'in_progress', 'done'] as TaskStatus[]).map(s => ({
    status: s,
    count: boardTasks.filter(t => t.status === s).length,
  }))

  // KAFELEK STATYSTYKI — cały kafelek prowadzi do zakładki
  const StatCard = ({ title, value, subtitle, icon: Icon, color, iconBg, href }: any) => (
    <Link href={href} className="block p-6 rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 shadow-sm softly-lifted transition-all relative overflow-hidden group hover:border-blue-300 dark:hover:border-blue-700 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 dark:opacity-5 transition-transform group-hover:scale-150 ${color}`}></div>
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{title}</p>
          <h3 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-1">{value}</h3>
          <p className={`text-xs font-bold ${color.replace('bg-', 'text-')}`}>{subtitle}</p>
        </div>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconBg} ${color.replace('bg-', 'text-')}`}>
          <Icon size={24} />
        </div>
      </div>
      <span className="relative z-10 mt-3 flex items-center gap-1 text-xs font-bold text-slate-400 group-hover:text-blue-500 transition-colors">
        Otwórz <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )

  // KAFELEK LISTY — nagłówek z licznikiem i linkiem, przewijana zawartość
  const ListTile = ({ title, icon: Icon, iconClass, count, href, linkLabel, children, footer, tone = 'default' }: any) => (
    <div className={`p-6 rounded-3xl shadow-sm border transition-colors softly-lifted flex flex-col ${
      tone === 'danger'
        ? 'bg-red-50/70 dark:bg-red-950/30 border-red-200 dark:border-red-900/60'
        : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800'
    }`}>
      <div className="flex justify-between items-center mb-4 gap-2">
        <Link href={href} className={`text-lg font-bold flex items-center gap-2 hover:underline ${tone === 'danger' ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
          <Icon size={20} className={iconClass} /> {title}
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tone === 'danger' ? 'bg-red-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{count}</span>
        </Link>
        {linkLabel && (
          <Link href={href} className={`text-xs font-bold hover:underline shrink-0 ${tone === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>{linkLabel}</Link>
        )}
      </div>
      <div className="flex-1 max-h-80 overflow-y-auto custom-scrollbar -mx-2 px-2">
        {children}
      </div>
      {footer}
    </div>
  )

  const TaskRow = ({ task, showOwner = false, tone = 'default' }: { task: Task; showOwner?: boolean; tone?: 'default' | 'danger' }) => {
    const isOverdue = !!task.deadline && task.deadline.slice(0, 10) < todayStr && task.status !== 'done'
    const owner = task.owner ?? null
    return (
      <Link
        href="/tasks"
        className={`flex items-center justify-between gap-3 p-3 mb-2 rounded-xl border transition-colors group ${
          tone === 'danger'
            ? 'bg-white dark:bg-slate-900/60 border-red-200 dark:border-red-900/60 hover:border-red-400 dark:hover:border-red-700'
            : 'border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
        }`}
      >
        <div className="min-w-0">
          <p className={`text-sm font-bold truncate transition-colors ${task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white'} ${tone === 'danger' ? 'group-hover:text-red-600' : 'group-hover:text-blue-500'}`}>{task.title}</p>
          {showOwner && (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {owner ? `${owner.first_name} ${owner.last_name}` : 'Nieprzypisane'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 text-[11px] font-bold">
          {tone !== 'danger' && (
            <span className={`px-2 py-1 rounded-md ${STATUS_BADGE[task.status]}`}>{STATUS_LABEL[task.status]}</span>
          )}
          {task.deadline && (
            <span className={`flex items-center gap-1 px-2 py-1 rounded-md ${
              isOverdue || tone === 'danger'
                ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              <Clock size={12} /> {isOverdue ? `po terminie (${formatDeadline(task.deadline, todayStr)})` : formatDeadline(task.deadline, todayStr)}
            </span>
          )}
        </div>
      </Link>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 relative overflow-hidden">
      <Sidebar />

      <div className="flex-1 md:ml-64 p-8 pt-16 md:pt-8 overflow-y-auto custom-scrollbar">

        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 transition-colors">
            Witaj w Centrum Dowodzenia{currentUser ? `, ${currentUser.first_name}` : ''}! 👋
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Oto przegląd sytuacji operacyjnej Komisji na dzisiaj.</p>
        </div>

        {loading ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <SkeletonLoader variant="card" count={3} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SkeletonLoader variant="card" count={4} />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <StatCard title="Sprawy w toku" value={stats.activeCases} subtitle="Oczekujące na zamknięcie" icon={Briefcase} color="bg-blue-500" iconBg="bg-blue-50 dark:bg-blue-900/30" href="/cases" />
              <StatCard title="Otwarte Zadania" value={stats.pendingTasks} subtitle="Wymagają podjęcia akcji" icon={CheckSquare} color="bg-green-500" iconBg="bg-green-50 dark:bg-green-900/30" href="/tasks" />
              <StatCard title="Rozwiązane Zadania" value={stats.completedTasksThisWeek} subtitle="Zamknięte w tym tygodniu" icon={TrendingUp} color="bg-purple-500" iconBg="bg-purple-50 dark:bg-purple-900/30" href="/tasks" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              <ListTile title="Moje zadania" icon={User} iconClass="text-blue-500" count={myTasks.length} href="/tasks" linkLabel="Tablica">
                {myTasks.length > 0
                  ? myTasks.map(task => <TaskRow key={task.id} task={task} />)
                  : <EmptyState icon={CheckSquare} title="Brak przypisanych zadań" description="Nie masz otwartych zadań." />}
              </ListTile>

              <ListTile title="Zadania ogólne" icon={ListTodo} iconClass="text-green-500" count={allTasks.length} href="/tasks" linkLabel="Tablica">
                <div className="flex flex-wrap gap-2 mb-3">
                  {statusCounts.map(({ status, count }) => (
                    <span key={status} className={`text-[11px] font-bold px-2 py-1 rounded-md ${STATUS_BADGE[status]}`}>
                      {STATUS_LABEL[status]}: {count}
                    </span>
                  ))}
                </div>
                {allTasks.length > 0
                  ? allTasks.map(task => <TaskRow key={task.id} task={task} showOwner />)
                  : <EmptyState icon={ListTodo} title="Brak zadań" description="Tablica jest pusta." />}
              </ListTile>

              <ListTile title="Nowe wnioski" icon={Inbox} iconClass="text-orange-500" count={newRequests.length} href="/cases" linkLabel="Rejestr Spraw">
                {newRequests.length > 0 ? newRequests.map(c => (
                  <Link key={c.id} href="/cases" className="block p-3 mb-2 rounded-xl border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold">{c.case_number}</span>
                      <span className="text-[11px] font-bold text-slate-400 shrink-0">{new Date(c.created_at).toLocaleDateString('pl-PL')}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-500 transition-colors mt-0.5">{c.title}</p>
                  </Link>
                )) : (
                  <EmptyState icon={Inbox} title="Brak nowych wniosków" description="Skrzynka podawcza jest pusta." />
                )}
              </ListTile>

              <ListTile
                title="Pilne" icon={AlertCircle} iconClass="text-red-600 dark:text-red-400" count={urgentTasks.length} href="/tasks" tone="danger"
                footer={
                  <Link href="/tasks" className="mt-4 w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
                    Przejdź do Tablicy <ArrowRight size={16}/>
                  </Link>
                }
              >
                <p className="text-xs font-bold text-red-600/80 dark:text-red-400/80 mb-3">Termin dziś lub jutro oraz zadania po terminie</p>
                {urgentTasks.length > 0
                  ? urgentTasks.map(task => <TaskRow key={task.id} task={task} showOwner tone="danger" />)
                  : <EmptyState icon={CheckSquare} title="Brak pilnych zadań" description="Świetna robota!" />}
              </ListTile>

            </div>
          </>
        )}
      </div>
    </div>
  )
}
