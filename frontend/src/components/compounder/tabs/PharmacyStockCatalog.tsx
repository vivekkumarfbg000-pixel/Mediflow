import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Pill, AlertTriangle } from 'lucide-react';
import { SearchInput } from '../../ui/SearchInput';
import type { PharmacyInventoryItem } from '../../../types';

interface PharmacyStockCatalogProps {
  activeInventory: PharmacyInventoryItem[];
  medSearchQuery: string;
  setMedSearchQuery: (q: string) => void;
}

export const PharmacyStockCatalog: React.FC<PharmacyStockCatalogProps> = ({
  activeInventory,
  medSearchQuery,
  setMedSearchQuery
}) => {
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const lowStockItems = (activeInventory || []).filter(item => item.stock <= item.threshold);

  const filtered = (activeInventory || []).filter(item => 
    (item.name || '').toLowerCase().includes((medSearchQuery || '').toLowerCase()) ||
    (item.genericName || '').toLowerCase().includes((medSearchQuery || '').toLowerCase()) ||
    (item.category || '').toLowerCase().includes((medSearchQuery || '').toLowerCase())
  );

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 65,
    overscan: 5,
  });

  return (
    <div className="space-y-6 text-left animate-fade-in">
      {/* Reorder limit alerts banner */}
      {lowStockItems.length > 0 && (
        <div className="glass-panel p-4 border-amber-200/80 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/30 rounded-2xl flex items-start gap-3 shadow-md">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-bounce" />
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200">⚠️ Low Stock &amp; Reorder Limit Alerts</h3>
            <p className="text-[11px] text-amber-800/90 dark:text-amber-300 leading-relaxed">
              The following {lowStockItems.length} pharmacy items are running below designated safety thresholds. Please notify procurement:
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1.5">
              {lowStockItems.map(item => (
                <span key={item.id} className="bg-amber-600/10 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 border border-amber-600/20 dark:border-amber-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  💊 {item.name} ({item.stock} {item.unit} left | Min: {item.threshold})
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main inventory stock list catalog */}
      <div className="glass-panel p-4 sm:p-6 border-slate-200/80 dark:border-white/10 shadow-xl relative overflow-hidden bg-white dark:bg-slate-900/90 text-slate-800 dark:text-white rounded-3xl">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500 to-indigo-600 opacity-80" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="space-y-1">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Pill className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Pharmacy Inventory &amp; Stock Catalog
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Real-time clinic medicine catalog lookup. View expiry dates, FEFO batches, prices, and stock indicators.
            </p>
          </div>

          {/* Search Bar */}
          <div className="w-full sm:w-80 relative select-none">
            <SearchInput
              value={medSearchQuery}
              onChange={setMedSearchQuery}
              placeholder="Search medicine or generic name..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition-all shadow-xs"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 bg-slate-50/50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-center text-xs text-slate-500 dark:text-slate-400 font-medium select-none">
            No medicines matched your search query.
          </div>
        ) : (
          <div 
            ref={tableContainerRef}
            className="max-h-[500px] overflow-y-auto border border-slate-200/80 dark:border-white/10 rounded-2xl bg-slate-50/50 dark:bg-slate-950/50 shadow-xs relative"
          >
            <table className="w-full text-left border-collapse text-xs table-fixed">
              <thead className="sticky top-0 z-10 bg-slate-100/90 dark:bg-slate-900 border-b border-slate-200/80 dark:border-white/10 shadow-sm backdrop-blur-sm">
                <tr className="flex w-full">
                  <th className="p-3.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase tracking-wider font-mono w-[25%]">Medicine Details</th>
                  <th className="p-3.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase tracking-wider font-mono w-[20%]">Category / Mfr</th>
                  <th className="p-3.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase tracking-wider font-mono text-center w-[20%]">Stock Level</th>
                  <th className="p-3.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase tracking-wider font-mono w-[20%]">Batch / Expiry</th>
                  <th className="p-3.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase tracking-wider font-mono text-right w-[15%]">Price (MRP)</th>
                </tr>
              </thead>
              <tbody 
                className="divide-y divide-slate-200/60 dark:divide-white/5 block relative"
                style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%' }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const item = filtered[virtualRow.index];
                  const isLowStock = item.stock <= item.threshold && item.stock > 0;
                  const isOutOfStock = item.stock === 0;
                  
                  let stockStatus = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
                  let stockText = "In Stock";
                  if (isOutOfStock) {
                    stockStatus = "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20";
                    stockText = "Out of Stock";
                  } else if (isLowStock) {
                    stockStatus = "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 animate-pulse";
                    stockText = "Low Stock";
                  }

                  return (
                    <tr 
                      key={item.id} 
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      className="absolute top-0 left-0 flex w-full hover:bg-white/60 dark:hover:bg-white/5 transition-colors items-center"
                      style={{
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <td className="p-3.5 w-[25%] truncate">
                        <div className="font-extrabold text-slate-900 dark:text-white truncate">{item.name}</div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium truncate">{item.genericName}</span>
                      </td>
                      <td className="p-3.5 w-[20%] truncate">
                        <span className="font-mono bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-1.5 py-0.2 rounded text-[10px] truncate block max-w-fit">{item.category}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5 truncate">{item.manufacturer}</span>
                      </td>
                      <td className="p-3.5 text-center w-[20%]">
                        <div className="font-bold text-slate-900 dark:text-white truncate">{item.stock} {item.unit}</div>
                        <span className={`inline-block px-2 py-0.2 mt-0.5 border rounded-full text-[9px] font-bold uppercase tracking-wider ${stockStatus} truncate`}>
                          {stockText}
                        </span>
                      </td>
                      <td className="p-3.5 w-[20%] truncate">
                        <div className="font-mono font-bold text-slate-700 dark:text-slate-300 truncate">Batch: {item.batchNumber}</div>
                        <span className={`text-[10px] font-medium block truncate ${new Date(item.expiryDate) < new Date() ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                          Exp: {new Date(item.expiryDate).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="p-3.5 text-right w-[15%] truncate">
                        <div className="font-extrabold text-slate-900 dark:text-white truncate">₹{(item.price || 0).toFixed(2)}</div>
                        <span className="text-[9px] text-slate-500 dark:text-slate-400 block font-mono truncate">MRP: ₹{(item.mrp || 0).toFixed(2)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
