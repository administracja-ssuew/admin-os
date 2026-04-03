'use client'

import { Search, X } from 'lucide-react'

export interface FilterOption {
  value: string
  label: string
}

export interface FilterConfig {
  key: string
  label: string
  type: 'select' | 'date' | 'search'
  options?: FilterOption[]
  placeholder?: string
}

interface FilterBarProps {
  filters: FilterConfig[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  onClear: () => void
}

export default function FilterBar({ filters, values, onChange, onClear }: FilterBarProps) {
  const hasActiveFilters = Object.values(values).some(v => v !== '')

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      {filters.map((filter) => {
        if (filter.type === 'search') {
          return (
            <div key={filter.key} className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={filter.placeholder ?? `Szukaj...`}
                value={values[filter.key] ?? ''}
                onChange={(e) => onChange(filter.key, e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )
        }

        if (filter.type === 'select') {
          return (
            <select
              key={filter.key}
              value={values[filter.key] ?? ''}
              onChange={(e) => onChange(filter.key, e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{filter.label}</option>
              {filter.options?.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )
        }

        if (filter.type === 'date') {
          return (
            <div key={filter.key} className="flex items-center gap-1">
              <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{filter.label}:</span>
              <input
                type="date"
                value={values[filter.key] ?? ''}
                onChange={(e) => onChange(filter.key, e.target.value)}
                className="px-2 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )
        }

        return null
      })}

      {hasActiveFilters && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium"
        >
          <X size={14} /> Wyczyść
        </button>
      )}
    </div>
  )
}
