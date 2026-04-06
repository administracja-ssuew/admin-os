'use client'

import { supabase } from '../../../lib/supabase'
import type { EligibilityCriterion } from '../../../types'
import { CheckCircle2, XCircle, Clock, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

interface EligibilityChecklistProps {
  grantId: string
  criteria: EligibilityCriterion[]
  isAdmin: boolean
  onUpdate: (updated: EligibilityCriterion[]) => void
}

const NEXT_STATE: Record<EligibilityCriterion['state'], EligibilityCriterion['state']> = {
  pending: 'met',
  met: 'unmet',
  unmet: 'pending',
}

const STATE_CONFIG: Record<EligibilityCriterion['state'], { icon: React.ReactNode; label: string; classes: string }> = {
  met: {
    icon: <CheckCircle2 size={16} />,
    label: 'Spełnione',
    classes: 'text-green-600 dark:text-green-400',
  },
  unmet: {
    icon: <XCircle size={16} />,
    label: 'Niespełnione',
    classes: 'text-red-500 dark:text-red-400',
  },
  pending: {
    icon: <Clock size={16} />,
    label: 'W weryfikacji',
    classes: 'text-amber-500 dark:text-amber-400',
  },
}

export function EligibilityChecklist({ grantId, criteria, isAdmin, onUpdate }: EligibilityChecklistProps) {
  const [newLabel, setNewLabel] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const persist = async (updated: EligibilityCriterion[]) => {
    await supabase.from('grants_radar').update({ eligibility_criteria: updated }).eq('id', grantId)
    onUpdate(updated)
  }

  const toggleState = (index: number) => {
    const updated = criteria.map((c, i) =>
      i === index ? { ...c, state: NEXT_STATE[c.state] } : c
    )
    persist(updated)
  }

  const addCriterion = async () => {
    const label = newLabel.trim()
    if (!label) return
    const updated: EligibilityCriterion[] = [...criteria, { label, state: 'pending' }]
    await persist(updated)
    setNewLabel('')
    setIsAdding(false)
  }

  const removeCriterion = (index: number) => {
    const updated = criteria.filter((_, i) => i !== index)
    persist(updated)
  }

  const metCount = criteria.filter(c => c.state === 'met').length

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
          Kryteria kwalifikowalności
        </p>
        {criteria.length > 0 && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
            metCount === criteria.length
              ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
              : metCount === 0
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
          }`}>
            {metCount}/{criteria.length} spełnionych
          </span>
        )}
      </div>

      {criteria.length === 0 && !isAdding && (
        <p className="text-xs text-slate-400 dark:text-slate-500 italic">Brak kryteriów</p>
      )}

      <ul className="space-y-1">
        {criteria.map((c, i) => {
          const cfg = STATE_CONFIG[c.state]
          return (
            <li key={i} className="flex items-center gap-2 group">
              <button
                onClick={() => toggleState(i)}
                className={`flex items-center gap-1.5 flex-1 text-left text-xs p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${cfg.classes}`}
                title={`Stan: ${cfg.label} — kliknij aby zmienić`}
              >
                {cfg.icon}
                <span className="text-slate-700 dark:text-slate-300">{c.label}</span>
              </button>
              {isAdmin && (
                <button
                  onClick={() => removeCriterion(i)}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {isAdmin && (
        <div className="pt-1">
          {isAdding ? (
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCriterion(); if (e.key === 'Escape') setIsAdding(false) }}
                placeholder="Nowe kryterium..."
                className="flex-1 text-xs px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
              />
              <button
                onClick={addCriterion}
                className="text-xs px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold"
              >
                Dodaj
              </button>
              <button
                onClick={() => { setIsAdding(false); setNewLabel('') }}
                className="text-xs px-2 py-1 text-slate-400 hover:text-slate-700"
              >
                Anuluj
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-green-600 transition-colors"
            >
              <Plus size={12} /> Dodaj kryterium
            </button>
          )}
        </div>
      )}
    </div>
  )
}
