'use client'

import EmptyState from '../EmptyState'
import type { Asset } from '../../types'

interface AssetInventoryProps {
  assets: Asset[]
  lowStockAssets: Asset[]
}

export default function AssetInventory({ assets, lowStockAssets }: AssetInventoryProps) {
  const officeAssets = assets.filter(a => a.asset_type === 'Artykuły biurowe' || a.min_quantity > 0)

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-slate-800 dark:text-white">
          Materiały biurowe
        </h3>
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
                  <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300">{asset.quantity}</td>
                  <td className="py-2 px-3 text-slate-500 dark:text-slate-400">{asset.unit}</td>
                  <td className="py-2 px-3">
                    {asset.min_quantity > 0 && asset.quantity < asset.min_quantity ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                        Niski stan
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                        OK
                      </span>
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
