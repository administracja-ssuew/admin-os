// plik: components/AuthGuard.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePathname, useRouter } from 'next/navigation'
import { ShieldAlert, Loader2, LogOut } from 'lucide-react'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'pending' | 'active' | 'unauthenticated'>('loading')
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    checkUser()
  }, [pathname])

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      setStatus('unauthenticated')
      if (pathname !== '/login') router.push('/login')
      return
    }

    // Pobieramy rolę zalogowanego użytkownika
    const { data: userData } = await supabase
      .from('users')
      .select('system_role')
      .eq('email', session.user.email)
      .single()
    
    // Jeśli konto jest w weryfikacji LUB zostało zawieszone przez Ciebie
    if (userData?.system_role === 'pending' || userData?.system_role === 'inactive') {
      setStatus('pending')
    } else {
      setStatus('active')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Na stronę logowania wpuszczamy każdego
  if (pathname === '/login') return <>{children}</>

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center">
        <Loader2 size={48} className="animate-spin text-blue-500 mb-4" />
        <p className="text-slate-400 text-sm font-bold tracking-widest uppercase">Weryfikacja tożsamości...</p>
      </div>
    )
  }

  if (status === 'unauthenticated') return null // Czeka na przekierowanie do /login

  // ŚCIANA DLA NIEZWERYFIKOWANYCH 🛑
  if (status === 'pending') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center z-50 relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>
        <ShieldAlert size={80} className="text-orange-500 mb-6 animate-pulse relative z-10" />
        <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-4 relative z-10">Konto w weryfikacji</h1>
        <p className="text-slate-400 max-w-lg mb-8 text-sm md:text-base leading-relaxed relative z-10">
          Twoje konto zostało zarejestrowane, ale oczekuje na ręczne zatwierdzenie przez Zarząd Komisji oraz przypisanie do odpowiedniego pionu. 
          <br/><br/>
          Ze względów bezpieczeństwa dostęp do systemu operacyjnego został tymczasowo zablokowany.
        </p>
        <button onClick={handleLogout} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl flex items-center gap-2 transition-colors relative z-10 shadow-lg">
          <LogOut size={18} /> Wyloguj się
        </button>
      </div>
    )
  }

  // Wpuszczamy do systemu (Członek, Admin, Superadmin) ✅
  return <>{children}</>
}