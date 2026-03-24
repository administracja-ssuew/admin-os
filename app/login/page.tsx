'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { Lock, Mail, Loader2, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const [isLoginView, setIsLoginView] = useState(true)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const router = useRouter()

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    if (isLoginView) {
      // --- LOGOWANIE ---
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })

      if (error) {
        setErrorMsg('Nieprawidłowy e-mail lub hasło.')
      } else {
        router.push('/') // Po udanym logowaniu wrzucamy gościa na stronę główną (lub do poczekalni, jeśli to złapie Bramkarz)
      }
    } else {
      // --- REJESTRACJA ---
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      })

      if (error) {
        setErrorMsg('Błąd rejestracji: ' + error.message)
      } else {
        setSuccessMsg('Konto utworzone! Zaloguj się, aby przejść do poczekalni.')
        setIsLoginView(true) // Przełączamy z powrotem na logowanie
        setFormData({ email: '', password: '' })
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-wider">AdminOS</h1>
          <p className="text-slate-400 mt-2 font-medium">System Weryfikacji Komisji</p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-100 softly-lifted">
          <h2 className="text-xl font-bold text-slate-900 mb-6">
            {isLoginView ? 'Zaloguj się do systemu' : 'Utwórz nowe konto'}
          </h2>

          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 text-sm font-bold rounded-xl flex items-start gap-2 border border-red-100">
              <AlertCircle size={18} className="shrink-0" /> {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="mb-6 p-4 bg-green-50 text-green-600 text-sm font-bold rounded-xl flex items-start gap-2 border border-green-100">
              <ShieldCheck size={18} className="shrink-0" /> {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">E-mail służbowy</label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 text-slate-400" size={20} />
                <input 
                  type="email" 
                  required 
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-900" 
                  placeholder="imie.nazwisko@domena.pl"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Hasło dostępu</label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 text-slate-400" size={20} />
                <input 
                  type="password" 
                  required 
                  minLength={6}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-900" 
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70 mt-4 group"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : (
                <>{isLoginView ? 'WEJDŹ DO SYSTEMU' : 'ZAREJESTRUJ SIĘ'} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              type="button" 
              onClick={() => { setIsLoginView(!isLoginView); setErrorMsg(''); setSuccessMsg(''); }}
              className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors"
            >
              {isLoginView ? 'Nie masz konta? Złóż wniosek o dostęp' : 'Masz już konto? Zaloguj się'}
            </button>
          </div>
        </div>
      </div>

      {/* Abstrakcyjne tło */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 w-[800px] h-[800px] rounded-full bg-blue-900/20 blur-[120px]"></div>
    </div>
  )
}