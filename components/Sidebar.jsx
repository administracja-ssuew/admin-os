'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { Moon, Sun, LogOut } from 'lucide-react'

export default function Sidebar() {
  const pathname = usePathname()
  const [userRole, setUserRole] = useState(null)
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    checkUserRole()
    
    // Sprawdzamy, czy użytkownik miał już włączony tryb nocny podczas ostatniej wizyty
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark')
      setIsDarkMode(true)
    }
  }, [])

  const checkUserRole = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.email) {
      const { data } = await supabase.from('users').select('system_role').eq('email', session.user.email).single()
      if (data) setUserRole(data.system_role)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // LOGIKA TRYBU NOCNEGO
  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
      setIsDarkMode(false)
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
      setIsDarkMode(true)
    }
  }

  const isActive = (path) => {
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }

  const getLinkStyle = (path) => {
    return isActive(path)
      ? 'block py-3 px-4 rounded-lg bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20 transition-all'
      : 'block py-3 px-4 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-all font-medium'
  }

  return (
    <div className="w-64 bg-slate-900 text-white min-h-screen flex flex-col fixed left-0 top-0 z-50 shadow-2xl">
      <div className="p-6 border-b border-slate-800">
        <h2 className="text-2xl font-extrabold text-blue-500 tracking-wider">AdminOS</h2>
        <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">Wrocław</p>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
        <Link href="/" className={getLinkStyle('/')}>📊 Panel Główny</Link>
        <Link href="/my-department" className={getLinkStyle('/my-department')}>🎯 Moja Podkomisja</Link>
        <Link href="/calendar" className={getLinkStyle('/calendar')}>🗓️ Kalendarz</Link>
        <Link href="/cases" className={getLinkStyle('/cases')}>📁 Rejestr Spraw</Link>
        <Link href="/tasks" className={getLinkStyle('/tasks')}>✅ Zadania</Link>
        <Link href="/meetings" className={getLinkStyle('/meetings')}>📅 Zebrania</Link>
        <Link href="/knowledge" className={getLinkStyle('/knowledge')}>💡 Baza Wiedzy</Link>

        {/* BRAMKARZ VIP ROOMU */}
        {(userRole === 'admin' || userRole === 'superadmin') && (
          <div className="pt-4 mt-4 border-t border-slate-800">
            <Link href="/users" className={getLinkStyle('/users')}>👥 Kadry i Weryfikacja</Link>
            <Link href="/executive" className={isActive('/executive') 
              ? 'block py-3 px-4 rounded-lg bg-slate-700 text-white font-bold shadow-md transition-all border border-slate-600 mt-2' 
              : 'block py-3 px-4 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-all font-medium mt-2'}>
              🛡️ Panel Kierownictwa
            </Link>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-slate-800 flex flex-col gap-2">
        {/* PRZEŁĄCZNIK TRYBU NOCNEGO */}
        <button 
          onClick={toggleDarkMode} 
          className="w-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white py-3 px-4 rounded-lg transition-colors font-bold flex items-center justify-between"
        >
          <span className="text-sm">Tryb interfejsu</span>
          {isDarkMode ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} className="text-blue-400" />}
        </button>

        <button 
          onClick={handleLogout} 
          className="w-full bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white py-3 px-4 rounded-lg transition-colors font-bold flex items-center justify-center gap-2"
        >
          <LogOut size={18} /> Wyloguj się
        </button>
      </div>
    </div>
  )
}