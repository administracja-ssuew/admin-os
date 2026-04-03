'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { Lock, Mail, Loader2, ShieldCheck, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react'

type View = 'login' | 'register' | 'reset' | 'new_password'

export default function LoginPage() {
  const [view, setView] = useState<View>('login')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  const [formData, setFormData] = useState({ email: '', password: '', newPassword: '', confirmPassword: '' })

  // Wykrywamy token recovery z URL po kliknięciu linku resetującego
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery') || hash.includes('type=signup')) {
      // Supabase automatycznie ustawi sesję z URL hash — czekamy chwilę
      supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setView('new_password')
        }
      })
    }
  }, [])

  const switchView = (next: View) => {
    setView(next)
    setErrorMsg('')
    setSuccessMsg('')
    setFormData({ email: '', password: '', newPassword: '', confirmPassword: '' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    if (view === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })
      if (error) {
        setErrorMsg('Nieprawidłowy e-mail lub hasło.')
      } else {
        router.push('/')
      }

    } else if (view === 'register') {
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      })
      if (error) {
        setErrorMsg('Błąd rejestracji: ' + error.message)
      } else {
        setSuccessMsg('Konto utworzone! Sprawdź skrzynkę e-mail i potwierdź adres, a następnie zaloguj się i poczekaj na weryfikację przez Zarząd.')
        switchView('login')
      }

    } else if (view === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/login`,
      })
      if (error) {
        setErrorMsg('Nie udało się wysłać e-maila: ' + error.message)
      } else {
        setSuccessMsg('Link do resetowania hasła został wysłany. Sprawdź skrzynkę (również folder SPAM).')
      }

    } else if (view === 'new_password') {
      if (formData.newPassword.length < 6) {
        setErrorMsg('Hasło musi mieć co najmniej 6 znaków.')
        setLoading(false)
        return
      }
      if (formData.newPassword !== formData.confirmPassword) {
        setErrorMsg('Hasła nie są identyczne.')
        setLoading(false)
        return
      }
      const { error } = await supabase.auth.updateUser({ password: formData.newPassword })
      if (error) {
        setErrorMsg('Błąd ustawiania hasła: ' + error.message)
      } else {
        setSuccessMsg('Hasło zostało zmienione. Możesz się teraz zalogować.')
        switchView('login')
      }
    }

    setLoading(false)
  }

  const titles: Record<View, string> = {
    login: 'Zaloguj się do systemu',
    register: 'Utwórz nowe konto',
    reset: 'Resetuj hasło',
    new_password: 'Ustaw nowe hasło',
  }

  const buttonLabels: Record<View, string> = {
    login: 'WEJDŹ DO SYSTEMU',
    register: 'ZAREJESTRUJ SIĘ',
    reset: 'WYŚLIJ LINK RESETUJĄCY',
    new_password: 'USTAW NOWE HASŁO',
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
          <h2 className="text-xl font-bold text-slate-900 mb-6">{titles[view]}</h2>

          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 text-sm font-bold rounded-xl flex items-start gap-2 border border-red-100">
              <AlertCircle size={18} className="shrink-0 mt-0.5" /> {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="mb-6 p-4 bg-green-50 text-green-700 text-sm font-bold rounded-xl flex items-start gap-2 border border-green-100">
              <ShieldCheck size={18} className="shrink-0 mt-0.5" /> {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email — przy new_password nie potrzebny */}
            {view !== 'new_password' && (
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
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* Hasło — tylko dla login i register */}
            {(view === 'login' || view === 'register') && (
              <div>
                <div className="flex justify-between items-center mb-1.5 ml-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Hasło dostępu</label>
                  {view === 'login' && (
                    <button type="button" onClick={() => switchView('reset')} className="text-xs font-bold text-blue-500 hover:text-blue-700 transition-colors">
                      Zapomniałem hasła
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 text-slate-400" size={20} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    className="w-full pl-12 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-900"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            )}

            {/* Nowe hasło — tylko dla new_password */}
            {view === 'new_password' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Nowe hasło</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-3.5 text-slate-400" size={20} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      className="w-full pl-12 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-900"
                      placeholder="Minimum 6 znaków"
                      value={formData.newPassword}
                      onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600">
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Powtórz nowe hasło</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-3.5 text-slate-400" size={20} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-900"
                      placeholder="Powtórz hasło"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70 mt-4 group"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : (
                <>{buttonLabels[view]}<ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
              )}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            {view === 'login' && (
              <button type="button" onClick={() => switchView('register')} className="block w-full text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">
                Nie masz konta? Złóż wniosek o dostęp
              </button>
            )}
            {(view === 'register' || view === 'reset' || view === 'new_password') && (
              <button type="button" onClick={() => switchView('login')} className="block w-full text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">
                Wróć do logowania
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 w-[800px] h-[800px] rounded-full bg-blue-900/20 blur-[120px]"></div>
    </div>
  )
}
