'use client'

import { supabase } from '../../lib/supabase'
import { Clock, ShieldAlert, LogOut } from 'lucide-react'

export default function PendingPage() {
  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/' // Przekierowanie na stronę główną (login)
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="bg-white p-8 md:p-12 rounded-3xl shadow-2xl max-w-lg w-full text-center relative z-10">
        
        <div className="w-24 h-24 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 relative">
          <Clock size={48} />
          <div className="absolute -bottom-2 -right-2 bg-white p-1 rounded-full">
            <ShieldAlert size={24} className="text-slate-400" />
          </div>
        </div>
        
        <h1 className="text-3xl font-extrabold text-slate-900 mb-4">Konto Oczekujące</h1>
        <p className="text-slate-500 mb-8 leading-relaxed font-medium">
          Twój profil został pomyślnie zarejestrowany, ale <strong className="text-slate-800">wymaga ręcznej weryfikacji</strong>. 
          Poczekaj, aż Zarząd Komisji potwierdzi Twoją tożsamość i nada Ci odpowiednie uprawnienia dostępowe.
        </p>
        
        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 mb-8 text-sm text-orange-800 font-bold">
          Jeśli uważasz, że to błąd, skontaktuj się z Przewodniczącym lub administracją systemu.
        </div>

        <button 
          onClick={handleLogout}
          className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <LogOut size={20} /> Wyloguj się
        </button>
        
      </div>

      {/* Tło */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 w-[800px] h-[800px] rounded-full bg-orange-900/20 blur-[120px]"></div>
    </div>
  )
}