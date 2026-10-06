'use client'

import Sidebar from '../../components/Sidebar'
import { Archive, Loader2 } from 'lucide-react'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { useArchivingData } from '../../hooks/useArchivingData'
import { ArchiveFoldersPanel } from '../../components/ArchiveFoldersPanel'

export default function ArchivingPage() {
  const { user: currentUser, isAdmin, loading: userLoading } = useCurrentUser()
  const archiving = useArchivingData()

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar />
      <main className="flex-1 md:ml-64 overflow-y-auto pt-14 md:pt-0 p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 flex items-center gap-3">
            <Archive size={28} className="text-blue-500" />
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Archiwizacja</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Moduł teczek archiwalnych</p>
            </div>
          </div>
          <ArchiveFoldersPanel {...archiving} currentUser={currentUser} isAdmin={isAdmin} onRefetch={archiving.refetch} />
        </div>
      </main>
    </div>
  )
}
