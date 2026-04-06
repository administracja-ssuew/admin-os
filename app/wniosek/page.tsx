'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import FileUpload from '../../components/FileUpload'
import type { UploadedFile } from '../../components/FileUpload'
import {
  Briefcase, Send, CheckCircle, AlertCircle, Loader2,
  ChevronLeft, ChevronRight, Phone, Search, Copy, Check,
  CalendarDays,
} from 'lucide-react'
import Link from 'next/link'
import { notifyExternalSubmission } from '../actions/notifyExternalSubmission'

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function validateEmail(v: string) {
  if (!v.trim()) return 'Adres e-mail jest wymagany.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Podaj poprawny adres e-mail.'
  return ''
}
function validatePhone(v: string) {
  if (!v.trim()) return '' // optional
  const digits = v.replace(/\D/g, '')
  if (digits.length < 9 || digits.length > 12) return 'Numer telefonu powinien mieć 9–12 cyfr.'
  return ''
}
function validateTitle(v: string) {
  if (v.trim().length < 5) return 'Tytuł musi mieć co najmniej 5 znaków.'
  if (v.trim().length > 200) return 'Tytuł nie może przekraczać 200 znaków.'
  return ''
}
function validateDescription(v: string) {
  if (v.trim().length < 20) return `Opis musi mieć co najmniej 20 znaków (brakuje ${20 - v.trim().length}).`
  if (v.trim().length > 5000) return 'Opis nie może przekraczać 5000 znaków.'
  return ''
}

// ─── SUCCESS VIEW ─────────────────────────────────────────────────────────────

function SuccessView({ generatedNumber, resetForm }: { generatedNumber: string; resetForm: () => void }) {
  const [copied, setCopied] = useState(false)

  const copyNumber = async () => {
    await navigator.clipboard.writeText(generatedNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="text-center">
      <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md border border-green-200">
        <CheckCircle size={40} />
      </div>
      <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Wniosek przyjęty!</h2>
      <p className="text-slate-500 mb-6 text-sm leading-relaxed">
        Twój wniosek został przesłany do Komisji. Zachowaj numer sprawy — będzie potrzebny do sprawdzenia statusu.
      </p>

      {/* Numer sprawy z przyciskiem kopiuj */}
      <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl mb-6 shadow-inner">
        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Twój numer sprawy</p>
        <div className="flex items-center justify-center gap-3">
          <p className="text-2xl font-mono font-extrabold text-blue-600 tracking-wider">{generatedNumber}</p>
          <button
            onClick={copyNumber}
            title="Kopiuj numer"
            className={`p-2 rounded-lg transition-all ${copied ? 'bg-green-100 text-green-600' : 'bg-white border border-blue-200 text-blue-400 hover:text-blue-600 hover:border-blue-400'}`}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
        {copied && <p className="text-xs text-green-600 font-bold mt-1">Skopiowano!</p>}
      </div>

      <Link
        href="/wniosek/status"
        className="flex items-center justify-center gap-2 w-full py-3 mb-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-sm transition-colors border border-blue-200"
      >
        <Search size={16} /> Sprawdź status wniosku
      </Link>
      <button
        onClick={resetForm}
        className="text-sm font-bold text-slate-400 hover:text-slate-700 transition-colors"
      >
        Wyślij kolejny wniosek
      </button>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function PublicIntakePage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()))
  const [events, setEvents] = useState<{ id: string; title: string; date: string; time?: string }[]>([])
  const [calendarLoading, setCalendarLoading] = useState(true)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [generatedNumber, setGeneratedNumber] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [pendingCaseId] = useState(() => crypto.randomUUID())

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    contact_email: '',
    contact_phone: '',
    case_type: 'Administracyjna',
    website: '', // honeypot
  })

  const fetchMonthEvents = useCallback(async () => {
    setCalendarLoading(true)
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    const { data: meetings } = await supabase
      .from('meetings')
      .select('id, title, meeting_date, meeting_time')
      .gte('meeting_date', toDateStr(startOfMonth))
      .lte('meeting_date', toDateStr(endOfMonth))
    if (meetings) {
      setEvents(meetings.map(m => ({ id: m.id, title: m.title, date: m.meeting_date, time: m.meeting_time })))
    }
    setCalendarLoading(false)
  }, [currentDate])

  useEffect(() => { fetchMonthEvents() }, [fetchMonthEvents])

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()
  const startingEmptyCells = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const emptyCellsArray = Array.from({ length: startingEmptyCells }, (_, i) => i)

  const monthNames = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień']
  const dayNames = ['Pon', 'Wto', 'Śro', 'Czw', 'Pią', 'Sob', 'Nie']
  const todayStr = toDateStr(new Date())

  const selectedDayEvents = events.filter(e => e.date === selectedDate)

  // ─── BLUR VALIDATION ──────────────────────────────────────────────────────

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }))
    const errs = { ...fieldErrors }
    if (field === 'contact_email') errs.contact_email = validateEmail(formData.contact_email)
    if (field === 'contact_phone') errs.contact_phone = validatePhone(formData.contact_phone)
    if (field === 'title') errs.title = validateTitle(formData.title)
    if (field === 'description') errs.description = validateDescription(formData.description)
    setFieldErrors(errs)
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error as soon as user starts fixing
    if (touched[field] && fieldErrors[field]) {
      const errs = { ...fieldErrors }
      if (field === 'contact_email') errs.contact_email = validateEmail(value)
      if (field === 'contact_phone') errs.contact_phone = validatePhone(value)
      if (field === 'title') errs.title = validateTitle(value)
      if (field === 'description') errs.description = validateDescription(value)
      setFieldErrors(errs)
    }
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {
      contact_email: validateEmail(formData.contact_email),
      contact_phone: validatePhone(formData.contact_phone),
      title: validateTitle(formData.title),
      description: validateDescription(formData.description),
    }
    setFieldErrors(errs)
    setTouched({ contact_email: true, contact_phone: true, title: true, description: true })
    return !Object.values(errs).some(Boolean)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    // Honeypot: fałszywy sukces
    if (formData.website) {
      const currentYear = new Date().getFullYear()
      setGeneratedNumber(`WNI/${currentYear}/${Math.floor(1000 + Math.random() * 9000)}`)
      setIsSuccess(true)
      return
    }

    if (!validate()) return

    setIsSubmitting(true)

    const contactLine = formData.contact_phone
      ? `[E-mail: ${formData.contact_email} | Tel: ${formData.contact_phone}]`
      : `[E-mail: ${formData.contact_email}]`
    const fullDescription = `${contactLine}\n\nTreść wniosku:\n${formData.description}`

    const attachments = uploadedFiles.map(f => ({ id: f.id, name: f.name, url: f.url, added_at: f.added_at }))

    const { data: insertedCase, error } = await supabase.from('cases').insert([{
      id: pendingCaseId,
      title: formData.title,
      description: fullDescription,
      case_type: formData.case_type,
      source: 'Formularz Zewnętrzny',
      status: 'new',
      confidentiality_level: 'internal',
      attachments: attachments.length > 0 ? attachments : null,
    }]).select('case_number').single()

    if (!error && insertedCase) {
      setGeneratedNumber(insertedCase.case_number)
      setIsSuccess(true)
      notifyExternalSubmission({
        caseNumber: insertedCase.case_number,
        caseTitle: formData.title,
        caseType: formData.case_type,
        contactEmail: formData.contact_email,
      }).catch(err => console.error('External notification failed:', err))
    } else if (error) {
      setErrorMsg('Wystąpił problem z połączeniem. Spróbuj ponownie za chwilę.')
      console.error(error)
    }

    setIsSubmitting(false)
  }

  const resetForm = () => {
    setIsSuccess(false)
    setFormData({ title: '', description: '', contact_email: '', contact_phone: '', case_type: 'Administracyjna', website: '' })
    setFieldErrors({})
    setTouched({})
    setUploadedFiles([])
  }

  // Description progress
  const descLen = formData.description.trim().length
  const descProgress = Math.min((descLen / 20) * 100, 100)
  const descGood = descLen >= 20

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center p-6 md:p-8 transition-all relative overflow-hidden">

      {/* Header */}
      <div className="text-center mb-8 max-w-lg w-full shrink-0 relative z-10">
        <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
          <Briefcase size={28} />
        </div>
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Komisja Weryfikacyjna</p>
        <h1 className="text-3xl font-extrabold text-blue-500 tracking-wider">BIURO PODAWCZE</h1>
        <p className="text-slate-400 mt-2 font-medium max-w-sm mx-auto text-sm">Złóż Oficjalny Wniosek lub Zapytanie Operacyjne</p>
      </div>

      <div className="flex-1 w-full max-w-6xl flex gap-8 overflow-hidden relative z-10">

        {/* ── LEWA: KALENDARZ ────────────────────────────────────────────────── */}
        <div className="flex-[2] bg-white rounded-[28px] shadow-2xl border border-gray-100 flex flex-col overflow-hidden softly-lifted">

          {/* Nagłówek miesiąca */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600">
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-gray-800 tracking-wide text-sm">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </span>
              {calendarLoading && <Loader2 size={14} className="animate-spin text-slate-400" />}
            </div>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Nagłówki dni */}
          <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/80 shrink-0">
            {dayNames.map(day => (
              <div key={day} className="py-3 text-center text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">{day}</div>
            ))}
          </div>

          {/* Siatka dni */}
          <div className="flex-1 grid grid-cols-7 auto-rows-fr">
            {emptyCellsArray.map(cell => (
              <div key={`empty-${cell}`} className="border-r border-b border-gray-50 bg-gray-50/30" />
            ))}
            {daysArray.map(day => {
              const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDate
              const dayEvents = events.filter(e => e.date === dateStr)
              return (
                <div
                  key={day}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`border-r border-b border-gray-50 p-2 cursor-pointer transition-all group relative min-h-[52px] ${
                    isSelected ? 'bg-blue-50/70 ring-inset ring-2 ring-blue-400' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    isToday ? 'bg-blue-600 text-white shadow-md' : isSelected ? 'text-blue-700 font-extrabold' : 'text-gray-700 group-hover:text-blue-600'
                  }`}>{day}</span>
                  <div className="absolute bottom-1.5 left-2 flex flex-wrap gap-0.5">
                    {dayEvents.slice(0, 3).map((_, i) => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    ))}
                    {dayEvents.length > 3 && <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Panel wybranego dnia */}
          <div className="border-t border-gray-100 bg-gray-50/80 shrink-0 px-5 py-3 min-h-[64px]">
            {selectedDayEvents.length > 0 ? (
              <div>
                <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <CalendarDays size={11} /> Posiedzenia — {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}
                </p>
                <div className="space-y-1">
                  {selectedDayEvents.map(ev => (
                    <div key={ev.id} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                      <span className="text-xs font-bold text-gray-700 truncate">{ev.title}</span>
                      {ev.time && <span className="text-[10px] text-gray-400 ml-auto shrink-0">{ev.time.slice(0, 5)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400/60" />
                Brak posiedzeń w tym dniu
              </p>
            )}
          </div>

          {/* Legenda */}
          <div className="px-5 py-2.5 border-t border-gray-100 bg-white flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              Posiedzenie komisji
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-white text-[8px] font-extrabold">D</span>
              </div>
              Dziś
            </div>
          </div>
        </div>

        {/* ── PRAWA: FORMULARZ ──────────────────────────────────────────────── */}
        <div className="flex-1 bg-white rounded-[28px] shadow-2xl border border-gray-100 flex flex-col overflow-hidden max-w-sm softly-lifted">
          <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar flex flex-col h-full">

            {isSuccess ? (
              <SuccessView generatedNumber={generatedNumber} resetForm={resetForm} />
            ) : (
              <>
                {errorMsg && (
                  <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm font-bold rounded-xl flex items-center gap-2 border border-red-100">
                    <AlertCircle size={16} className="shrink-0" /> {errorMsg}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 flex flex-col h-full">

                  {/* HONEYPOT */}
                  <input
                    type="text"
                    name="website"
                    value={formData.website}
                    onChange={e => setFormData({ ...formData, website: e.target.value })}
                    tabIndex={-1}
                    autoComplete="off"
                    style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0 }}
                    aria-hidden="true"
                  />

                  <div className="space-y-4 flex-1">

                    {/* EMAIL */}
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 ml-0.5">
                        Adres e-mail <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        className={`w-full px-4 py-3 bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-900 text-sm ${fieldErrors.contact_email ? 'border-red-400 bg-red-50/30' : touched.contact_email && !fieldErrors.contact_email ? 'border-green-400' : 'border-slate-200'}`}
                        placeholder="kontakt@domena.pl"
                        value={formData.contact_email}
                        onChange={e => handleChange('contact_email', e.target.value)}
                        onBlur={() => handleBlur('contact_email')}
                      />
                      {fieldErrors.contact_email && <p className="mt-1 text-xs text-red-500 font-bold">{fieldErrors.contact_email}</p>}
                    </div>

                    {/* TELEFON */}
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 ml-0.5">
                        Telefon kontaktowy <span className="text-slate-300 font-normal normal-case">(opcjonalnie)</span>
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-3.5 text-slate-400" size={14} />
                        <input
                          type="tel"
                          className={`w-full pl-9 pr-4 py-3 bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-900 text-sm ${fieldErrors.contact_phone ? 'border-red-400 bg-red-50/30' : 'border-slate-200'}`}
                          placeholder="+48 123 456 789"
                          value={formData.contact_phone}
                          onChange={e => handleChange('contact_phone', e.target.value)}
                          onBlur={() => handleBlur('contact_phone')}
                        />
                      </div>
                      {fieldErrors.contact_phone && <p className="mt-1 text-xs text-red-500 font-bold">{fieldErrors.contact_phone}</p>}
                    </div>

                    {/* KATEGORIA */}
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 ml-0.5">
                        Kategoria sprawy
                      </label>
                      <select
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-900 text-sm"
                        value={formData.case_type}
                        onChange={e => setFormData({ ...formData, case_type: e.target.value })}
                      >
                        <option value="Administracyjna">Sprawa Administracyjna</option>
                        <option value="Finansowa">Finansowa / Dotacyjna</option>
                        <option value="Prawna">Prawna</option>
                        <option value="Logistyczna">Logistyczna</option>
                        <option value="Skarga">Skarga / Zażalenie</option>
                        <option value="Informacyjna">Zapytanie Informacyjne</option>
                        <option value="Inna">Inna</option>
                      </select>
                    </div>

                    {/* TYTUŁ */}
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 ml-0.5">
                        Tytuł wniosku <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        className={`w-full px-4 py-3 bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-900 text-sm ${fieldErrors.title ? 'border-red-400 bg-red-50/30' : touched.title && !fieldErrors.title ? 'border-green-400' : 'border-slate-200'}`}
                        placeholder="Czego dotyczy Twoja sprawa?"
                        value={formData.title}
                        onChange={e => handleChange('title', e.target.value)}
                        onBlur={() => handleBlur('title')}
                        maxLength={200}
                      />
                      <div className="flex justify-between mt-1">
                        {fieldErrors.title
                          ? <p className="text-xs text-red-500 font-bold">{fieldErrors.title}</p>
                          : <span />}
                        <p className="text-[10px] text-slate-400 ml-auto">{formData.title.length}/200</p>
                      </div>
                    </div>

                    {/* OPIS */}
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 ml-0.5">
                        Opis sytuacji <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        required
                        className={`w-full px-4 py-3 bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none text-slate-900 text-sm custom-scrollbar ${
                          fieldErrors.description ? 'border-red-400 bg-red-50/30' : touched.description && !fieldErrors.description ? 'border-green-400' : 'border-slate-200'
                        }`}
                        style={{ height: '140px' }}
                        placeholder="Opisz dokładnie swoją sprawę, podaj kontekst i oczekiwane działanie..."
                        value={formData.description}
                        onChange={e => handleChange('description', e.target.value)}
                        onBlur={() => handleBlur('description')}
                        maxLength={5000}
                      />

                      {/* Pasek postępu 0→20 znaków */}
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${descGood ? 'bg-green-500' : 'bg-blue-400'}`}
                            style={{ width: `${descProgress}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 shrink-0">
                          {descGood
                            ? <span className="text-green-600 font-bold">✓ {descLen}/5000</span>
                            : <span className={descLen > 0 ? 'text-blue-500 font-bold' : ''}>{descLen}/20 min</span>
                          }
                        </p>
                      </div>
                      {fieldErrors.description && <p className="mt-0.5 text-xs text-red-500 font-bold">{fieldErrors.description}</p>}
                    </div>

                    {/* ZAŁĄCZNIKI */}
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 ml-0.5">
                        Załączniki <span className="text-slate-300 font-normal normal-case">(max 3 pliki, PDF/PNG/JPG)</span>
                      </label>
                      <FileUpload
                        bucketPath={`cases/${pendingCaseId}`}
                        onUploadComplete={files => setUploadedFiles(Array.isArray(files) ? files : [files])}
                        accept="application/pdf,image/png,image/jpeg"
                        maxSizeMB={10}
                        maxFiles={3}
                        label="Przeciągnij lub kliknij — max 10MB"
                      />
                    </div>

                  </div>

                  {/* PRZYCISK SUBMIT */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold rounded-xl shadow-lg shadow-blue-300/40 transition-all flex items-center justify-center gap-2 disabled:opacity-70 mt-auto shrink-0 relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
                    {isSubmitting
                      ? <><Loader2 size={18} className="animate-spin" /> Wysyłanie...</>
                      : <><Send size={18} /> Wyślij wniosek</>
                    }
                  </button>

                  <p className="text-center text-[10px] text-slate-400 mt-1.5">
                    Masz już numer?{' '}
                    <Link href="/wniosek/status" className="text-blue-500 hover:underline font-bold">Sprawdź status</Link>
                  </p>

                </form>
              </>
            )}
          </div>
        </div>

      </div>

      <p className="mt-6 text-center text-slate-500 max-w-sm text-xs font-medium relative z-10">
        Wysłanie wniosku oznacza akceptację regulaminu i polityki prywatności Komisji.
      </p>

      {/* Tło */}
      <div className="fixed inset-0 bg-slate-900 -z-20" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 w-[900px] h-[900px] rounded-full bg-blue-900/30 blur-[120px]" />
    </div>
  )
}
