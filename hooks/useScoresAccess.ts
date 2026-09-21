'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useScoresAccess() {
  const [access, setAccess] = useState({ allowed: false, admin: false, loading: true })

  useEffect(() => {
    let cancelled = false
    let request = 0
    const refresh = async () => {
      const current = ++request
      try {
        const [allowed, admin] = await Promise.all([
          supabase.rpc('has_scores_access'), supabase.rpc('is_scores_admin'),
        ])
        if (!cancelled && current === request) setAccess({
          allowed: !allowed.error && allowed.data === true,
          admin: !admin.error && admin.data === true,
          loading: false,
        })
      } catch {
        if (!cancelled && current === request) setAccess({ allowed: false, admin: false, loading: false })
      }
    }
    void refresh()
    const timer = window.setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    // Do not await another auth request from inside the auth callback.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void refresh() })
    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
      subscription.unsubscribe()
    }
  }, [])

  return access
}
