'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { AppUser } from '../types'

interface UseUsersResult {
  users: AppUser[]
  loading: boolean
  refetch: () => Promise<void>
}

export function useUsers(): UseUsersResult {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase
      .from('users')
      .select('*, departments(name)')
      .in('system_role', ['active', 'member', 'admin', 'superadmin'])
      .order('first_name', { ascending: true })
    if (data) setUsers(data as AppUser[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  return { users, loading, refetch: fetchUsers }
}
