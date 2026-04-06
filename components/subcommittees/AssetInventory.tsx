'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import EmptyState from '../EmptyState'
import toast from 'react-hot-toast'
import { Check, X } from 'lucide-react'
import type { Asset } from '../../types'

interface AssetInventoryProps {
  assets: Asset[]
  lowStockAssets: Asset[]
  onRefetch: () => Promise<void>
}

export default function AssetInventory({ assets, lowStockAssets, onRefetch }: AssetInventoryProps) {
  const officeAssets = assets.filter(a => a.asset_type === 'Artykuły biurowe' || a.min_quantity > 0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const startEdit = (asset: Asset) => {
    setEditingId(asset.id)
    setEditValue(String(asset.quantity ?? 0))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  const saveEdit = async (assetId: string) => {
    const qty = parseInt(editValue)
    if (isNaN(qty) || qty < 0) {
      toast.error('Podaj prawidłową ilość (liczba ≥ 0)')
      return
    }
    const { error } = await supabase.from('assets').update({ quantity: qty }).eq('id', assetId)
    if (!error) {
      toast.success('Ilość zaktualizowana')
      cancelEdit()
      await onRefetch()
    } else {
      toast.error('Błąd zapisu')
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-slate-800 dark:text-white">Materiały biurowe</h3>
        {lowStockAssets.length > 0 && (
          <span className="px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
            {lowStockAssets.length} niski stan
          </span>
        )}
      </div>
      {officeAssets.length === 0 ? (
        <EmptyState title="Brak materiałów biurowych" description="Dodaj zasoby z oznaczonym minimalnym poziomem zapasów" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">Nazwa</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">Ilość</th>
                <th className="text-left py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">Jed.</th>
                <th className="text-left py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {officeAssets.map(asset => (
                <tr key={asset.id} className="border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                  <td className="py-2 px-3 text-slate-800 dark:text-white">{asset.name}</td>
                  <td className="py-2 px-3 text-right">
                    {editingId === asset.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          min={0}
                          autoFocus
                          className="w-16 px-2 py-1 text-right font-mono text-sm bg-white dark:bg-slate-900 border border-blue-400 rounded-lg outline-none text-slate-900 dark:text-white"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveEdit(asset.id)
                            if (e.key === 'Escape') cancelEdit()
                          }}
                        />
                        <button onClick={() => saveEdit(asset.id)} className="p-1 text-green-600 hover:text-green-700"><Check size={14} /></button>
                        <button onClick={cancelEdit} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X size={14} /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(asset)}
                        className="font-mono text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:underline decoration-dotted transition-colors"
                        title="Kliknij, aby edytować"
                      >
                        {asset.quantity ?? 0}
                      </button>
                    )}
                  </td>
                  <td className="py-2 px-3 text-slate-500 dark:text-slate-400">{asset.unit}</td>
                  <td className="py-2 px-3">
                    {asset.status === 'maintenance' ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">Awaria</span>
                    ) : asset.status === 'low_stock' || (asset.min_quantity > 0 && (asset.quantity ?? 0) < asset.min_quantity) ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">Niski stan</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
