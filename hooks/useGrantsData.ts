'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Grant } from '../types'

interface DeptMember {
  id: string
  first_name: string
  last_name: string
}

export interface UseGrantsDataResult {
  grants: Grant[]
  members: DeptMember[]
  loading: boolean
  refetch: () => Promise<void>
}

export function useGrantsData(departmentId: string | undefined): UseGrantsDataResult {
  const [grants, setGrants] = useState<Grant[]>([])
  const [members, setMembers] = useState<DeptMember[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!departmentId) {
      setLoading(false)
      return
    }

    setLoading(true)

    const [grantsRes, membersRes] = await Promise.all([
      // grants_radar is global (not filtered by department_id) — serves the entire grants subcommittee
      supabase
        .from('grants_radar')
        .select('*, owner:users!grants_radar_owner_id_fkey(first_name, last_name)')
        .order('deadline', { ascending: true }),
      supabase.from('users').select('id, first_name, last_name').eq('department_id', departmentId),
    ])

    if (grantsRes.data) setGrants(grantsRes.data)
    if (membersRes.data) setMembers(membersRes.data)

    setLoading(false)
  }, [departmentId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { grants, members, loading, refetch: fetchData }
}
