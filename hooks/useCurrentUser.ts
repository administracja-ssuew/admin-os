'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { AppUser } from '../types'

interface UseCurrentUserResult {
  user: AppUser | null
  loading: boolean
  isAdmin: boolean
  isSuperAdmin: boolean
}

export function useCurrentUser(): UseCurrentUserResult {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.email) {
        if (!cancelled) setLoading(false)
        return
      }
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single()
      if (!cancelled) {
        setUser(data ?? null)
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const isAdmin = user?.system_role === 'admin' || user?.system_role === 'superadmin'
  const isSuperAdmin = user?.system_role === 'superadmin'

  return { user, loading, isAdmin, isSuperAdmin }
}
