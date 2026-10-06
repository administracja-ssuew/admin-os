'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { ArchiveFolder } from '../types'

export interface UseArchivingDataResult {
  archiveFolders: ArchiveFolder[]
  loading: boolean
  refetch: () => Promise<void>
}

export function useArchivingData(): UseArchivingDataResult {
  const [archiveFolders, setArchiveFolders] = useState<ArchiveFolder[]>([])
  const [loading, setLoading] = useState(true)

  // Odświeżenie nie chowa listy — szkielet tylko przy pierwszym ładowaniu
  const fetchData = useCallback(async () => {
    const { data } = await supabase.from('archive_folders').select('*').order('created_at', { ascending: false })
    if (data) setArchiveFolders(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { archiveFolders, loading, refetch: fetchData }
}
