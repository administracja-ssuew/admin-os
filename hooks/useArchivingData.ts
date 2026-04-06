'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { ArchiveFolder, Petition } from '../types'

interface DeptMember {
  id: string
  first_name: string
  last_name: string
}

export interface UseArchivingDataResult {
  archiveFolders: ArchiveFolder[]
  petitions: Petition[]
  members: DeptMember[]
  loading: boolean
  refetch: () => Promise<void>
}

export function useArchivingData(departmentId: string | undefined): UseArchivingDataResult {
  const [archiveFolders, setArchiveFolders] = useState<ArchiveFolder[]>([])
  const [petitions, setPetitions] = useState<Petition[]>([])
  const [members, setMembers] = useState<DeptMember[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!departmentId) {
      setLoading(false)
      return
    }

    setLoading(true)

    const [foldersRes, petitionsRes, membersRes] = await Promise.all([
      supabase.from('archive_folders').select('*').order('created_at', { ascending: false }),
      supabase.from('petitions').select('*').order('submission_date', { ascending: false }),
      supabase.from('users').select('id, first_name, last_name').eq('department_id', departmentId),
    ])

    if (foldersRes.data) setArchiveFolders(foldersRes.data)
    if (petitionsRes.data) setPetitions(petitionsRes.data)
    if (membersRes.data) setMembers(membersRes.data)

    setLoading(false)
  }, [departmentId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { archiveFolders, petitions, members, loading, refetch: fetchData }
}
