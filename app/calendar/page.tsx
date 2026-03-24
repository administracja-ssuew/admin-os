'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../../components/Sidebar'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, CheckSquare, Briefcase, Users } from 'lucide-react'

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  useEffect(() => {
    fetchCalendarData()
  }, [currentDate])

  const fetchCalendarData = async () => {
    setLoading(true)
    
    // Obliczamy początek i koniec obecnego miesiąca, żeby nie pobierać całej bazy
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1).toISOString().split('T')[0]
    const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0]

    // 1. Pobieramy Spotkania
    const { data: meetings } = await supabase.from('meetings')
      .select('id, title, meeting_date, meeting_time')
      .gte('meeting_date', firstDay)
      .lte('meeting_date', lastDay)

    // 2. Pobieramy Zadania (deadline)
    const { data: tasks } = await supabase.from('tasks')
      .select('id, title, deadline, status')
      .gte('deadline', firstDay)
      .lte('deadline', lastDay)

    // 3. Pobieramy Sprawy (data otwarcia) - dla uproszczenia bierzemy created_at
    const { data: cases } = await supabase.from('cases')
      .select('id, title, created_at, status')
      .gte('created_at', `${firstDay}T00:00:00.000Z`)
      .lte('created_at', `${lastDay}T23:59:59.999Z`)

    // Formatujemy wszystko do jednej, wspólnej tablicy wydarzeń
    const allEvents: any[] = []
    
    if (meetings) {
      meetings.forEach(m => allEvents.push({ id: `m-${m.id}`, date: m.meeting_date, title: m.title, type: 'meeting', time: m.meeting_time }))
    }
    if (tasks) {
      tasks.forEach(t => allEvents.push({ id: `t-${t.id}`, date: t.deadline, title: t.title, type: 'task', status: t.status }))
    }
    if (cases) {
      cases.forEach(c => allEvents.push({ id: `c-${c.id}`, date: c.created_at.split('T')[0], title: c.title, type: 'case', status: c.status }))
    }

    setEvents(allEvents)
    setLoading(false)
  }

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  const goToToday = () => { setCurrentDate(new Date()); setSelectedDay(new Date()) }

  // Logika budowania siatki kalendarza
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
  const getFirstDayOfMonth = (year: number, month: number) => {
    let day = new Date(year, month, 1).getDay()
    return day === 0 ? 6 : day - 1 // Konwersja z niedzieli(0) na poniedziałek(0)
  }

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDayIndex = getFirstDayOfMonth(year, month)
  
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const blanks = Array.from({ length: firstDayIndex }, (_, i) => i)

  const monthNames = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"]
  const weekDays = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nie"]

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter(e => e.date === dateStr)
  }

  const getEventStyle = (type: string, status?: string) => {
    if (type === 'meeting') return 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800'
    if (type === 'task') return status === 'done' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 line-through' : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
    if (type === 'case') return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
    return 'bg-gray-100 text-gray-700'
  }

  const getEventIcon = (type: string) => {
    if (type === 'meeting') return <Users size={10} className="shrink-0" />
    if (type === 'task') return <CheckSquare size={10} className="shrink-0" />
    if (type === 'case') return <Briefcase size={10} className="shrink-0" />
    return null
  }

  // Wydarzenia wybranego dnia (panel boczny)
  const selectedDateStr = selectedDay ? `${selectedDay.getFullYear()}-${String(selectedDay.getMonth() + 1).padStart(2, '0')}-${String(selectedDay.getDate()).padStart(2, '0')}` : ''
  const selectedEvents = selectedDay ? events.filter(e => e.date === selectedDateStr) : []

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 relative overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 ml-64 p-8 flex flex-col h-screen overflow-hidden">
        
        {/* NAGŁÓWEK */}
        <div className="flex justify-between items-center mb-8 shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3 transition-colors">
              <CalendarIcon className="text-blue-600 dark:text-blue-500" size={32} /> Globalny Kalendarz
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 transition-colors">Widok operacyjny całego miesiąca.</p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={goToToday} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">Dzisiaj</button>
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-sm softly-lifted transition-colors">
              <button onClick={prevMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-400 transition-colors"><ChevronLeft size={20}/></button>
              <span className="w-32 text-center font-bold text-slate-900 dark:text-white">{monthNames[month]} {year}</span>
              <button onClick={nextMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-400 transition-colors"><ChevronRight size={20}/></button>
            </div>
          </div>
        </div>

        <div className="flex gap-8 flex-1 min-h-0">
          
          {/* SIATKA KALENDARZA */}
          <div className="flex-1 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors softly-lifted flex flex-col overflow-hidden">
            <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-700 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
              {weekDays.map(day => (
                <div key={day} className="py-3 text-center text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{day}</div>
              ))}
            </div>
            
            {loading ? (
              <div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>
            ) : (
              <div className="flex-1 grid grid-cols-7 grid-rows-5 md:grid-rows-6 auto-rows-fr">
                {blanks.map(b => (
                  <div key={`blank-${b}`} className="border-r border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/30 dark:bg-slate-900/20 p-2 opacity-50"></div>
                ))}
                
                {days.map(day => {
                  const dayEvents = getEventsForDay(day)
                  const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear()
                  const isSelected = selectedDay?.getDate() === day && selectedDay?.getMonth() === month
                  
                  return (
                    <div 
                      key={day} 
                      onClick={() => setSelectedDay(new Date(year, month, day))}
                      className={`border-r border-b border-slate-100 dark:border-slate-700/50 p-2 cursor-pointer transition-colors overflow-y-auto custom-scrollbar group
                        ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10 shadow-inner' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}
                      `}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold transition-all ${isToday ? 'bg-blue-600 text-white shadow-md' : isSelected ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}>
                          {day}
                        </span>
                        {dayEvents.length > 0 && <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{dayEvents.length}</span>}
                      </div>
                      
                      <div className="space-y-1 mt-2">
                        {dayEvents.slice(0, 3).map(e => (
                          <div key={e.id} className={`text-[10px] font-bold px-1.5 py-1 rounded truncate border flex items-center gap-1 ${getEventStyle(e.type, e.status)}`}>
                            {getEventIcon(e.type)}
                            <span className="truncate">{e.time ? `${e.time} ` : ''}{e.title}</span>
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-1 text-center">+ {dayEvents.length - 3} więcej</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* PANEL BOCZNY: SZCZEGÓŁY DNIA */}
          <div className="w-80 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors softly-lifted flex flex-col overflow-hidden shrink-0">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 shrink-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                {selectedDay ? `${selectedDay.getDate()} ${monthNames[selectedDay.getMonth()]}` : 'Wybierz dzień'}
              </h2>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Wydarzenia operacyjne</p>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
              {!selectedDay ? (
                <div className="text-center text-slate-400 dark:text-slate-500 mt-10">
                  <CalendarIcon size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="font-medium text-sm">Kliknij dowolny dzień w siatce kalendarza, aby zobaczyć szczegóły.</p>
                </div>
              ) : selectedEvents.length === 0 ? (
                <div className="text-center text-slate-400 dark:text-slate-500 mt-10 font-medium text-sm">
                  Brak zaplanowanych wydarzeń na ten dzień.
                </div>
              ) : (
                selectedEvents.map(e => (
                  <div key={e.id} className={`p-4 rounded-2xl border transition-colors flex flex-col gap-2 ${getEventStyle(e.type, e.status)}`}>
                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest opacity-80 border-b border-current pb-2 mb-1">
                      {getEventIcon(e.type)} 
                      {e.type === 'meeting' ? 'Spotkanie' : e.type === 'task' ? 'Deadline Zadania' : 'Otwarcie Sprawy'}
                    </div>
                    <div className="font-bold text-sm leading-tight">{e.title}</div>
                    {e.time && <div className="text-xs font-bold flex items-center gap-1 opacity-90"><Clock size={12}/> {e.time}</div>}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}