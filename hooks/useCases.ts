'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Case } from '../types'

interface UseCasesResult {
  cases: Case[]
  loading: boolean
  refetch: () => Promise<void>
}

export function useCases(): UseCasesResult {
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCases = useCallback(async () => {
    const { data } = await supabase
      .from('cases')
      .select('*, users(first_name, last_name), departments(name)')
      .order('created_at', { ascending: false })
    if (data) setCases(data as Case[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCases()

    const channel = supabase
      .channel('cases-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cases' }, () => {
        fetchCases()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchCases])

  return { cases, loading, refetch: fetchCases }
}
