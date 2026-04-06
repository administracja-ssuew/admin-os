'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Asset, EquipmentLoan } from '../types'

interface DeptMember {
  id: string
  first_name: string
  last_name: string
}

interface LogisticsReport {
  id: string
  title: string
  content: string | null
  submitted_by: string | null
  submitted_at: string
  status: string
  subcommittee_type: string
  submitted_by_user?: { first_name: string; last_name: string } | null
}

export interface UseLogisticsDataResult {
  assets: Asset[]
  loans: EquipmentLoan[]
  reports: LogisticsReport[]
  members: DeptMember[]
  loading: boolean
  refetch: () => Promise<void>
}

export function useLogisticsData(departmentId: string | undefined): UseLogisticsDataResult {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loans, setLoans] = useState<EquipmentLoan[]>([])
  const [reports, setReports] = useState<LogisticsReport[]>([])
  const [members, setMembers] = useState<DeptMember[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!departmentId) {
      setLoading(false)
      return
    }

    setLoading(true)

    const [assetsRes, loansRes, reportsRes, membersRes] = await Promise.all([
      supabase.from('assets').select('*').order('name', { ascending: true }),
      supabase.from('equipment_loans').select('*').order('issue_date', { ascending: false }),
      supabase
        .from('reports')
        .select('*, submitted_by_user:users!reports_submitted_by_fkey(first_name, last_name)')
        .eq('subcommittee_type', 'logistics')
        .order('submitted_at', { ascending: false }),
      supabase.from('users').select('id, first_name, last_name').eq('department_id', departmentId),
    ])

    if (assetsRes.data) setAssets(assetsRes.data)
    if (loansRes.data) setLoans(loansRes.data)
    if (reportsRes.data) setReports(reportsRes.data)
    if (membersRes.data) setMembers(membersRes.data)

    setLoading(false)
  }, [departmentId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { assets, loans, reports, members, loading, refetch: fetchData }
}
