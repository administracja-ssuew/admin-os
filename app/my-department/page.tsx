'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../../components/Sidebar'
import { Building2, Loader2 } from 'lucide-react'
import { useLogisticsData } from '../../hooks/useLogisticsData'
import { useArchivingData } from '../../hooks/useArchivingData'
import { useGrantsData } from '../../hooks/useGrantsData'
import { LogisticsPanel } from '../../components/subcommittees/LogisticsPanel'
import { ArchivingPanel } from '../../components/subcommittees/ArchivingPanel'
import { GrantsPanel } from '../../components/subcommittees/GrantsPanel'
import type { AppUser, Department } from '../../types'

export default function MyDepartmentPage() {
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null)
  const [department, setDepartment] = useState<Department | null>(null)

  useEffect(() => {
    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.email) { setLoading(false); return }
      const { data } = await supabase
        .from('users')
        .select('*, departments(*)')
        .eq('email', session.user.email)
        .single()
      if (data) {
        setCurrentUser(data)
        setDepartment(data.departments ?? null)
      }
      setLoading(false)
    }
    loadUser()
  }, [])

  const isAdmin = currentUser?.system_role === 'admin' || currentUser?.system_role === 'superadmin'
  const deptId = department?.id

  // Wywołaj wszystkie trzy hooki bezwarunkowo (React rules of hooks)
  // Każdy hook sam sprawdza czy departmentId jest defined
  const logistics = useLogisticsData(department?.dept_type === 'logistics' ? deptId : undefined)
  const archiving = useArchivingData(department?.dept_type === 'archiving' ? deptId : undefined)
  const grants = useGrantsData(department?.dept_type === 'grants' ? deptId : undefined)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    )
  }

  const renderPanel = () => {
    if (!department) return (
      <div className="text-center text-slate-500 py-12">
        Nie jesteś przypisany do żadnego departamentu.
      </div>
    )
    switch (department.dept_type) {
      case 'logistics':
        return <LogisticsPanel {...logistics} currentUser={currentUser} isAdmin={isAdmin} onRefetch={logistics.refetch} />
      case 'archiving':
        return <ArchivingPanel {...archiving} currentUser={currentUser} isAdmin={isAdmin} onRefetch={archiving.refetch} />
      case 'grants':
        return <GrantsPanel {...grants} currentUser={currentUser} isAdmin={isAdmin} onRefetch={grants.refetch} />
      default:
        return (
          <div className="text-center text-slate-500 py-12">
            Brak dedykowanego widoku dla tego departamentu.
          </div>
        )
    }
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar />
      <main className="flex-1 md:ml-64 overflow-y-auto pt-14 md:pt-0 p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 flex items-center gap-3">
            <Building2 size={28} className="text-blue-500" />
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {department?.name ?? 'Mój Departament'}
              </h1>
              {currentUser && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {currentUser.first_name} {currentUser.last_name}
                </p>
              )}
            </div>
          </div>
          {renderPanel()}
        </div>
      </main>
    </div>
  )
}
