import type { ReactNode } from 'react'

// Szkielety ładowania w kształcie docelowych widoków. Animacja tylko przy włączonym ruchu
// (prefers-reduced-motion), a czytnik ekranu dostaje jeden komunikat „Ładowanie…” na obszar.

type Tone = 'auto' | 'dark'

/** tone="dark" dla widoków zawsze ciemnych (System Motywacyjny), niezależnie od motywu. */
export function Skeleton({ className = '', tone = 'auto' }: { className?: string; tone?: Tone }) {
  const color = tone === 'dark' ? 'bg-slate-800' : 'bg-slate-200 dark:bg-slate-700/70'
  return <div aria-hidden="true" className={`motion-safe:animate-pulse rounded-lg ${color} ${className}`} />
}

export function LoadingRegion({ label = 'Ładowanie…', className = '', children }: { label?: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

const card = 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 shadow-sm'

/** Panel Główny: 3 kafelki statystyk i 4 kafelki list. */
export function DashboardSkeleton() {
  return (
    <LoadingRegion label="Ładowanie panelu…" className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className={`${card} p-6 rounded-3xl flex justify-between`}>
            <div className="space-y-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-12 w-12 rounded-2xl" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`${card} p-6 rounded-3xl space-y-3`}>
            <div className="flex justify-between items-center mb-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-16" />
            </div>
            {Array.from({ length: 3 }, (_, j) => <Skeleton key={j} className="h-14 w-full rounded-xl" />)}
          </div>
        ))}
      </div>
    </LoadingRegion>
  )
}

/** Tablica zadań: kolumny z kartami. */
export function BoardSkeleton({ columns = 3 }: { columns?: number }) {
  return (
    <LoadingRegion label="Ładowanie zadań…" className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
      {Array.from({ length: columns }, (_, i) => (
        <div key={i} className="rounded-2xl p-4 bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 space-y-3">
          <div className="flex justify-between items-center mb-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-8 rounded-full" />
          </div>
          {Array.from({ length: 3 - (i % 2) }, (_, j) => (
            <div key={j} className={`${card} rounded-xl p-4 space-y-3`}>
              <div className="flex gap-2"><Skeleton className="h-4 w-14" /><Skeleton className="h-4 w-20" /></div>
              <Skeleton className="h-4 w-4/5" />
              <div className="flex justify-between pt-2"><Skeleton className="h-6 w-24 rounded-full" /><Skeleton className="h-4 w-12" /></div>
            </div>
          ))}
        </div>
      ))}
    </LoadingRegion>
  )
}

/** Wiersze tabeli lub listy (Rejestr Spraw, CRED, lista zadań). Bez własnej ramki — wstawiany do istniejącej. */
export function TableSkeleton({ rows = 6, label = 'Ładowanie listy…' }: { rows?: number; label?: string }) {
  return (
    <LoadingRegion label={label} className="divide-y divide-slate-100 dark:divide-slate-700/50">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4">
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className={`h-4 ${i % 3 === 0 ? 'w-3/5' : i % 3 === 1 ? 'w-2/5' : 'w-1/2'}`} />
          </div>
          <Skeleton className="hidden md:block h-4 w-32" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </LoadingRegion>
  )
}

/** Lista osób lub pozycji z awatarem (Kadry, System Motywacyjny, Zebrania). */
export function ListSkeleton({ rows = 5, label = 'Ładowanie listy…', tone = 'auto' }: { rows?: number; label?: string; tone?: Tone }) {
  const divider = tone === 'dark' ? 'divide-slate-800' : 'divide-slate-100 dark:divide-slate-700/50'
  return (
    <LoadingRegion label={label} className={`divide-y ${divider}`}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton tone={tone} className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton tone={tone} className={`h-4 ${i % 2 ? 'w-1/3' : 'w-2/5'}`} />
            <Skeleton tone={tone} className="h-3 w-1/4" />
          </div>
          <Skeleton tone={tone} className="hidden sm:block h-6 w-16 rounded-full" />
        </div>
      ))}
    </LoadingRegion>
  )
}

/** Siatka kart (Archiwizacja, Burza Mózgów). */
export function CardGridSkeleton({ count = 6, label = 'Ładowanie…' }: { count?: number; label?: string }) {
  return (
    <LoadingRegion label={label} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`${card} p-5 rounded-2xl space-y-3`}>
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-1/2" />
          <div className="flex justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </LoadingRegion>
  )
}

/** Siatka miesiąca w kalendarzu (pod istniejącym nagłówkiem dni tygodnia). */
export function CalendarSkeleton() {
  return (
    <LoadingRegion label="Ładowanie kalendarza…" className="flex-1 grid grid-cols-7 grid-rows-5 md:grid-rows-6 auto-rows-fr">
      {Array.from({ length: 42 }, (_, i) => (
        <div key={i} className={`border-r border-b border-slate-100 dark:border-slate-700/50 p-2 space-y-2 ${i >= 35 ? 'hidden md:block' : ''}`}>
          <Skeleton className="h-3 w-5" />
          {i % 5 === 2 && <Skeleton className="h-4 w-full rounded" />}
        </div>
      ))}
    </LoadingRegion>
  )
}

/** Cała aplikacja przed sprawdzeniem sesji: zarys menu i treści zamiast ekranu z kółkiem. */
export function AppShellSkeleton() {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      <div aria-hidden="true" className="hidden md:flex w-64 fixed inset-y-0 left-0 bg-slate-900 flex-col p-6 gap-3 border-r border-slate-800">
        <div className="h-7 w-32 rounded-lg bg-slate-800 mb-8" />
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-10 rounded-lg bg-slate-800/70" />)}
      </div>
      <main className="flex-1 md:ml-64 p-8 pt-16 md:pt-8">
        <div className="mb-8 space-y-3">
          <Skeleton className="h-8 w-72 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className={`${card} rounded-3xl overflow-hidden`}>
          <TableSkeleton rows={7} label="Ładowanie aplikacji…" />
        </div>
      </main>
    </div>
  )
}
