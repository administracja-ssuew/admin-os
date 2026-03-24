'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Briefcase, Send, CheckCircle, AlertCircle, Loader2, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Users } from 'lucide-react'

// Komponent Sukcesu (Wyświetlany w prawej kolumnie)
const SuccessView = ({ generatedNumber, resetForm }: { generatedNumber: string; resetForm: () => void }) => (
  <div className="text-center">
    <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md border border-green-200">
      <CheckCircle size={40} />
    </div>
    <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Wniosek przyjęty!</h2>
    <p className="text-slate-500 mb-6">
      Twój wniosek został pomyślnie przesłany do Komisji. Rozpatrzymy go najszybciej jak to możliwe.
    </p>
    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-8 shadow-sm">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Twój numer sprawy</p>
      <p className="text-xl font-mono font-bold text-blue-600">{generatedNumber}</p>
    </div>
    <button 
      onClick={resetForm}
      className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
    >
      Wyślij kolejny wniosek
    </button>
  </div>
)

// Główne wejście na stronę
export default function PublicIntakePage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [events, setEvents] = useState<any[]>([])
  const [calendarLoading, setCalendarLoading] = useState(true)

  // Stany formularza
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [generatedNumber, setGeneratedNumber] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    contact_email: '',
    case_type: 'Administracyjna'
  })

  useEffect(() => {
    fetchMonthEvents()
  }, [currentDate])

  // Pobieramy publiczne spotkania (Meetings) do kalendarza po lewej
  const fetchMonthEvents = async () => {
    setCalendarLoading(true)
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0]
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0]

    const { data: meetings } = await supabase
      .from('meetings')
      .select('id, title, meeting_date, meeting_time')
      .gte('meeting_date', startOfMonth)
      .lte('meeting_date', endOfMonth)

    if (meetings) {
      setEvents(meetings.map(m => ({ ...m, date: m.meeting_date, time: m.meeting_time, type: 'meeting' })))
    }
    setCalendarLoading(false)
  }

  // Funkcje do zmiany miesiąca
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  const goToToday = () => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDate(today.toISOString().split('T')[0])
  }

  // Generowanie siatki dni (Z polskim tygodniem)
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()
  const startingEmptyCells = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const emptyCellsArray = Array.from({ length: startingEmptyCells }, (_, i) => i)

  const monthNames = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"]
  const dayNames = ["Pon", "Wto", "Śro", "Czw", "Pią", "Sob", "Nie"]
  const todayStr = new Date().toISOString().split('T')[0]

  // Obsługa wysyłki wniosku
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMsg('')

    // Generujemy oficjalny numer sprawy: WNI/2026/8492
    const currentYear = new Date().getFullYear()
    const randomNum = Math.floor(1000 + Math.random() * 9000)
    const newCaseNumber = `WNI/${currentYear}/${randomNum}`

    // Łączymy e-mail kontaktowy z opisem
    const fullDescription = `[E-mail kontaktowy wnioskodawcy: ${formData.contact_email}]\n\nTreść wniosku:\n${formData.description}`

    // Zapisujemy wprost do tabeli 'cases' jako nową sprawę zewnętrzną
    const { error } = await supabase.from('cases').insert([{
      title: formData.title,
      description: fullDescription,
      case_type: formData.case_type,
      case_number: newCaseNumber,
      source: 'Formularz Zewnętrzny', 
      status: 'new',
      confidentiality_level: 'internal' // Publiczny wniosek jest wewnętrznie widoczny dla całej Komisji
    }])

    if (!error) {
      setGeneratedNumber(newCaseNumber)
      setIsSuccess(true)
    } else {
      setErrorMsg('Wystąpił problem z połączeniem. Spróbuj ponownie później.')
      console.error(error)
    }
    
    setIsSubmitting(false)
  }

  const resetForm = () => {
    setIsSuccess(false);
    setFormData({...formData, title: '', description: '', contact_email: ''});
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center p-8 transition-all relative overflow-hidden">
      
      {/* NAGŁÓWEK PUBLICZNY (Z teczką a'la halo) */}
      <div className="text-center mb-10 max-w-lg w-full shrink-0 relative z-10">
        <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200 relative overflow-hidden group">
          <div className="absolute inset-0 bg-blue-500 opacity-0 group-hover:opacity-20 transition-opacity"></div>
          <div className="absolute inset-0 bg-white/10 blur-xl scale-125 opacity-100 group-hover:opacity-0 transition-opacity"></div>
          <Briefcase size={32} className="relative z-10" />
        </div>
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Komisja Weryfikacyjna</p>
        <h1 className="text-3xl font-extrabold text-blue-500 tracking-wider">BIURO PODAWCZE</h1>
        <p className="text-slate-400 mt-2 font-medium max-w-sm mx-auto">Złóż Oficjalny Wniosek lub Zapytanie Operacyjne</p>
      </div>

      <div className="flex-1 w-full max-w-6xl flex gap-10 overflow-hidden">
        
        {/* LEWA STRONA: WIDOK KALENDARZA ZESPOŁU */}
        <div className="flex-[2] bg-white rounded-[30px] shadow-2xl border border-gray-100 flex flex-col overflow-hidden softly-lifted">
          
          <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/80 shrink-0">
            {dayNames.map(day => (
              <div key={day} className="py-4 text-center text-xs font-extrabold text-gray-400 uppercase tracking-widest">
                {day}
              </div>
            ))}
          </div>

          <div className="flex-1 grid grid-cols-7 grid-rows-5 lg:grid-rows-auto auto-rows-fr">
            {emptyCellsArray.map(cell => (
              <div key={`empty-${cell}`} className="border-r border-b border-gray-50 bg-gray-50/30"></div>
            ))}

            {daysArray.map(day => {
              const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
              const dateString = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(cellDate.getDate()).padStart(2, '0')}`
              
              const isToday = dateString === todayStr
              const isSelected = dateString === selectedDate
              const dayEvents = events.filter(e => e.date === dateString)

              return (
                <div 
                  key={day} 
                  onClick={() => setSelectedDate(dateString)}
                  className={`border-r border-b border-gray-50 p-2 cursor-pointer transition-all group relative ${isSelected ? 'bg-blue-50/50 ring-inset ring-2 ring-blue-500' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex justify-between items-start">
                    <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold transition-colors ${
                      isToday ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 
                      isSelected ? 'text-blue-700' : 'text-gray-700 group-hover:text-blue-600'
                    }`}>
                      {day}
                    </span>
                  </div>
                  
                  {/* Kropki wydarzeń */}
                  <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1 mt-2">
                    {dayEvents.slice(0, 4).map((e, i) => (
                      <div key={i} className={`w-2 h-2 rounded-full ${
                        e.type === 'meeting' ? 'bg-orange-500' : 
                        e.type === 'task' ? 'bg-green-500' : 'bg-blue-500'
                      }`} title={e.title}></div>
                    ))}
                    {dayEvents.length > 4 && <div className="w-2 h-2 rounded-full bg-gray-300"></div>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Navigacja Kalendarza na dole */}
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"><ChevronLeft size={20}/></button>
            <div className="text-center font-bold text-gray-800 tracking-wide text-sm">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </div>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"><ChevronRight size={20}/></button>
          </div>
        </div>

        {/* PRAWA STRONA: FORMULARZ LUB SUKCES */}
        <div className="flex-1 bg-white rounded-[30px] shadow-2xl border border-gray-100 flex flex-col overflow-hidden max-w-sm softly-lifted">
          <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar flex flex-col h-full">
            
            {isSuccess ? (
              <SuccessView generatedNumber={generatedNumber} resetForm={resetForm} />
            ) : (
              <>
                {errorMsg && (
                  <div className="mb-6 p-4 bg-red-50 text-red-600 text-sm font-bold rounded-xl flex items-center gap-2 border border-red-100 shadow-sm">
                    <AlertCircle size={18} className="shrink-0" /> {errorMsg}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6 flex flex-col h-full">
                  
                  <div className="space-y-4 flex-1">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">ADRES E-MAIL</label>
                      <input type="email" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-900" placeholder="np. kontakt@domena.pl" value={formData.contact_email} onChange={(e) => setFormData({...formData, contact_email: e.target.value})} />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">KATEGORIA SPRAWY</label>
                      <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-900" value={formData.case_type} onChange={(e) => setFormData({...formData, case_type: e.target.value})}>
                        <option value="Zasoby / Sprzęt">Wypożyczenie sprzętu (Logitech)</option>
                        <option value="Dotacja / Finanse">Wniosek o dofinansowanie</option>
                        <option value="Administracyjna">Sprawa ogólna / Administracyjna</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">TYTUŁ WNIOSKU</label>
                      <input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-900" placeholder="Czego dotyczy Twoja sprawa?" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">DOKŁADNY OPIS SYTUACJI</label>
                      <textarea required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none h-32 text-slate-900" placeholder="Opisz dokładnie swoją prośbę, podaj kluczowe daty, lokalizacje i szczegóły operacyjne..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                    </div>
                  </div>

                  <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70 mt-auto shrink-0 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                    <div className="absolute inset-0 bg-blue-500/10 blur-xl scale-125 opacity-100"></div>
                    {isSubmitting ? <Loader2 size={20} className="animate-spin relative z-10" /> : <><Send size={20} className="relative z-10"/> WYŚLIJ WNIOSEK</>}
                  </button>
                  
                </form>
              </>
            )}
          </div>
        </div>
      </div>
      
      <p className="mt-8 text-center text-slate-500 max-w-sm text-sm font-medium relative z-10">
        Wysłanie wniosku oznacza akceptację regulaminu i polityki prywatności Komisji.
      </p>

      {/* Tło z gradientami blur (Wzorem obrazka) */}
      <div className="fixed inset-0 bg-slate-900 -z-20"></div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 w-[1200px] h-[1200px] rounded-full bg-slate-800 opacity-80 blur-[150px]"></div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 w-[600px] h-[600px] rounded-full bg-blue-900/40 opacity-50 blur-[100px]"></div>

    </div>
  )
}