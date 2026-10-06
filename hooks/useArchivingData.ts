'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { ArchiveFolder, Petition } from '../types'

export interface UseArchivingDataResult {
  archiveFolders: ArchiveFolder[]
  petitions: Petition[]
  loading: boolean
  refetch: () => Promise<void>
}

export function useArchivingData(): UseArchivingDataResult {
  const [archiveFolders, setArchiveFolders] = useState<ArchiveFolder[]>([])
  const [petitions, setPetitions] = useState<Petition[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)

    const [foldersRes, petitionsRes] = await Promise.all([
      supabase.from('archive_folders').select('*').order('created_at', { ascending: false }),
      supabase.from('petitions').select('*').order('submission_date', { ascending: false }),
    ])

    if (foldersRes.data) setArchiveFolders(foldersRes.data)
    if (petitionsRes.data) setPetitions(petitionsRes.data)

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { archiveFolders, petitions, loading, refetch: fetchData }
}
