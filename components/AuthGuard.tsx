'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

// Te strony są widoczne dla każdego (nie blokujemy ich)
const PUBLIC_ROUTES = ['/wniosek', '/login']

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isAuthorized, setIsAuthorized] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    checkAuthorization()
  }, [pathname])

  const checkAuthorization = async () => {
    // 1. Sprawdzamy, czy to strona publiczna (Biuro Podawcze)
    if (PUBLIC_ROUTES.includes(pathname)) {
      setIsAuthorized(true)
      return
    }

    // 2. Kto tu puka?
    const { data: { session } } = await supabase.auth.getSession()

    // 3. Brak sesji? To znaczy, że nie mamy tu jeszcze systemu logowania, 
    // więc na ten moment (podczas budowy) po prostu przepuszczamy,
    // ALE docelowo wyślemy go na '/login'.
    if (!session?.user?.email) {
      setIsAuthorized(true) 
      return
    }

    // 4. Jeśli ma sesję, sprawdzamy jego rolę w tabeli users
    const { data: userData } = await supabase
      .from('users')
      .select('system_role')
      .eq('email', session.user.email)
      .single()

    const role = userData?.system_role

    // 5. Główna logika Bramkarza
    if (role === 'pending' || role === 'inactive') {
      // Jeśli jest zablokowany, ale próbuje wejść gdzie indziej niż do poczekalni -> Wyrzuć go tam
      if (pathname !== '/pending') {
        router.push('/pending')
      } else {
        setIsAuthorized(true) // Pozwól mu widzieć stronę poczekalni
      }
    } else {
      // Jeśli jest ZWERYFIKOWANY (member, admin, superadmin)
      if (pathname === '/pending') {
        // Jeśli omyłkowo wpisał adres poczekalni, a jest już zweryfikowany -> Wpuść na główną
        router.push('/')
      } else {
        setIsAuthorized(true) // Przepuść do systemu
      }
    }
  }

  // Zanim sprawdzimy, pokazujemy ekran ładowania
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center">
        <Loader2 size={48} className="text-blue-500 animate-spin mb-4" />
        <p className="text-slate-400 font-bold tracking-widest uppercase text-sm">Autoryzacja dostępu...</p>
      </div>
    )
  }

  return <>{children}</>
}