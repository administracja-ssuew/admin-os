'use client'

interface SkeletonLoaderProps {
  variant?: 'card' | 'table-row' | 'kanban-column'
  count?: number
}

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded ${className ?? ''}`} />
}

function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
      <SkeletonPulse className="h-5 w-3/4" />
      <SkeletonPulse className="h-4 w-1/2" />
      <div className="flex gap-2 pt-2">
        <SkeletonPulse className="h-6 w-16 rounded-full" />
        <SkeletonPulse className="h-6 w-20 rounded-full" />
      </div>
    </div>
  )
}

function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3 px-4 border-b border-slate-100 dark:border-slate-800">
      <SkeletonPulse className="h-4 w-24" />
      <SkeletonPulse className="h-4 w-48 flex-1" />
      <SkeletonPulse className="h-6 w-20 rounded-full" />
      <SkeletonPulse className="h-4 w-28" />
    </div>
  )
}

function KanbanColumnSkeleton() {
  return (
    <div className="min-w-[300px] bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-2">
        <SkeletonPulse className="h-5 w-28" />
        <SkeletonPulse className="h-5 w-8 rounded-full" />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 space-y-2">
          <SkeletonPulse className="h-4 w-4/5" />
          <SkeletonPulse className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  )
}

export default function SkeletonLoader({ variant = 'card', count = 3 }: SkeletonLoaderProps) {
  const Component = {
    'card': CardSkeleton,
    'table-row': TableRowSkeleton,
    'kanban-column': KanbanColumnSkeleton,
  }[variant]

  if (variant === 'kanban-column') {
    return (
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: count }, (_, i) => <Component key={i} />)}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => <Component key={i} />)}
    </div>
  )
}
