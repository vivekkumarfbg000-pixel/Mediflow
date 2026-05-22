import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { InventoryHold, SeasonalForecast } from '../../types';
import { 
  Calendar, 
  XCircle,
  Lightbulb
} from 'lucide-react';

export interface PharmacyShelfStock {
  name: string;
  stock: number;
  unit: string;
  threshold: number;
}

const ShelfStockRow = React.memo<{
  item: PharmacyShelfStock;
  onRestock: (name: string) => void;
}>(({ item, onRestock }) => {
  const isLow = item.stock < item.threshold;
  return (
    <tr className="hover:bg-surface-container/50 transition-colors">
      <td className="p-3.5 text-white font-semibold">{item.name}</td>
      <td className="p-3.5">
        <span className={`font-mono font-bold ${isLow ? 'text-rose-400 font-black' : 'text-emerald-400'}`}>
          {item.stock} {item.unit}
        </span>
      </td>
      <td className="p-3.5 text-clinical-400 font-mono">{item.threshold} {item.unit}</td>
      <td className="p-3.5 text-center">
        {isLow ? (
          <span className="inline-flex items-center gap-1 text-[9px] font-black text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            LOW STOCK
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            SECURE
          </span>
        )}
      </td>
      <td className="p-3.5 text-right">
        <button
          onClick={() => onRestock(item.name)}
          className={`text-[9px] font-bold tracking-wider uppercase px-2.5 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer border ${
            isLow 
              ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-500 hover:border-rose-600' 
              : 'bg-surface-container-highest text-clinical-300 border-outline-variant hover:text-white hover:border-outline'
          }`}
        >
          {isLow ? 'Auto-Restock' : 'Restock +500'}
        </button>
      </td>
    </tr>
  );
});

ShelfStockRow.displayName = 'ShelfStockRow';

export const PharmacyDashboard: React.FC = () => {
  const [holds, setHolds] = useState<InventoryHold[]>([]);
  const [forecasts, setForecasts] = useState<SeasonalForecast[]>([]);
  const [shelfStock, setShelfStock] = useState<PharmacyShelfStock[]>([
    { name: 'Metformin 500mg', stock: 450, unit: 'tabs', threshold: 100 },
    { name: 'Paracetamol 650mg', stock: 45, unit: 'tabs', threshold: 100 },
    { name: 'Amoxicillin 250mg', stock: 120, unit: 'caps', threshold: 100 },
    { name: 'Atorvastatin 10mg', stock: 15, unit: 'tabs', threshold: 50 },
    { name: 'Pantoprazole 40mg', stock: 320, unit: 'tabs', threshold: 100 }
  ]);

  const handleRestock = React.useCallback((medName: string) => {
    setShelfStock(prev => prev.map(item => {
      if (item.name === medName) {
        return { ...item, stock: item.stock + 500 };
      }
      return item;
    }));
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Authorized Gemini B2B automated bulk restock order: +500 units of ${medName}.`,
        type: 'success',
        title: 'Restock Order Dispatched'
      }
    }));
  }, []);

  useEffect(() => {
    const alertedBatches = new Set<string>();

    const syncPharmacy = () => {
      const dbHolds = api.getInventoryHolds();
      const dbForecasts = api.getSeasonalForecasts();
      setHolds(dbHolds);
      setForecasts(dbForecasts);

      // Expiry alerting logic for held items
      const active = dbHolds.filter(h => h.holdStatus === 'held');
      active.forEach(hold => {
        const daysToExpiry = Math.ceil((new Date(hold.expiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        if (daysToExpiry < 90 && !alertedBatches.has(hold.batchNumber)) {
          alertedBatches.add(hold.batchNumber);
          window.dispatchEvent(new CustomEvent('mediflow-toast', {
            detail: {
              message: `FEFO WARNING: Batch ${hold.batchNumber} of ${hold.medicineName} expires in ${daysToExpiry} days. Prioritize dispensing.`,
              type: 'warning',
              title: 'FEFO Expiry Alert'
            }
          }));
        }
      });
    };

    syncPharmacy();
    return api.subscribe(syncPharmacy);
  }, []);

  const handleDispense = React.useCallback((id: string) => {
    api.dispenseInventoryHold(id);
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: 'Prescription inventory package successfully dispensed and POS settled.',
        type: 'success',
        title: 'POS Dispensed'
      }
    }));
  }, []);

  const handleCancel = React.useCallback((id: string) => {
    api.cancelInventoryHold(id);
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: 'Prescription reserve cancelled. Medicine returned to active stock.',
        type: 'info',
        title: 'Reservation Cancelled'
      }
    }));
  }, []);

  const handleActOnForecast = React.useCallback((id: string) => {
    api.actOnSeasonalForecast(id);
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: 'Gemini epidemiology demand stocking increase authorized successfully.',
        type: 'success',
        title: 'Forecast Approved'
      }
    }));
  }, []);

  const activeHolds = React.useMemo(() => holds.filter(h => h.holdStatus === 'held'), [holds]);
  const dispensedHolds = React.useMemo(() => holds.filter(h => h.holdStatus === 'dispensed'), [holds]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
      {/* LEFT COLUMN: e-Prescription Inventory Holds (FEFO Sorted) */}
      <div className="lg:col-span-8 space-y-6">
        
        {/* Active Holds Queue */}
        <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary to-secondary opacity-50" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">inventory_2</span>
                Active Inventory Holds (FEFO Sorted)
              </h2>
              <p className="text-xs text-clinical-400 mt-1">
                Medicine packages pre-allocated by doctor prescription to prevent double-selling to physical walk-ins.
              </p>
            </div>
            <span className="text-[10px] bg-secondary/15 text-secondary border border-secondary/25 px-3 py-1 rounded-full font-bold uppercase tracking-wider font-mono w-max">
              FEFO Control Active
            </span>
          </div>

          {activeHolds.length === 0 ? (
            <div className="p-8 bg-surface-container-lowest/40 border border-outline-variant rounded-xl text-center text-sm text-clinical-500">
              No active e-prescription medicine reserves in queue.
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Critical FEFO Expiry Countdown Warning Banner */}
              {activeHolds.some(h => Math.ceil((new Date(h.expiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) < 90) && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl space-y-2.5 animate-pulse relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-rose-500 via-amber-500 to-transparent" />
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider font-mono">
                    <span className="material-symbols-outlined text-sm text-amber-400">warning</span>
                    CRITICAL EXPIRY ALERT (FEFO BATCH CONTROL)
                  </div>
                  <p className="text-[11px] leading-relaxed text-clinical-300">
                    The following pre-allocated medicine holds are under the 90-day expiry threshold. Prioritize dispatches to maintain ecosystem clinical compliance:
                  </p>
                  <ul className="text-[10px] space-y-1.5 list-disc list-inside font-mono">
                    {activeHolds.map(hold => {
                      const days = Math.ceil((new Date(hold.expiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
                      if (days >= 90) return null;
                      return (
                        <li key={hold.id} className="text-amber-400 font-semibold">
                          {hold.medicineName} (Batch: {hold.batchNumber}) — <strong className="text-rose-400 font-black">{days} Days to Expiry</strong>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {activeHolds.map(hold => {
                const daysToExpiry = Math.ceil((new Date(hold.expiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
                const isNearExpiry = daysToExpiry < 90;
                
                return (
                  <div key={hold.id} className="p-5 bg-surface-container border border-outline-variant rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:border-outline/50 transition-all">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-sm text-white">{hold.medicineName}</h4>
                        <span className="text-[9px] font-bold text-clinical-300 bg-surface-container-highest border border-outline-variant px-2 py-0.5 rounded font-mono">
                          Batch: {hold.batchNumber}
                        </span>
                      </div>
                      <p className="text-xs text-clinical-300">Dosage: {hold.dosage} • Target Qty: <strong className="text-white font-mono">{hold.quantity} units</strong></p>
                      
                      {/* Expiry alerts indicators */}
                      <div className="flex flex-wrap items-center gap-3 pt-1.5 text-[10px]">
                        <span className={`flex items-center gap-1 font-semibold font-mono ${isNearExpiry ? 'text-rose-400' : 'text-clinical-400'}`}>
                          <Calendar className="h-3.5 w-3.5" /> Expiry: {hold.expiryDate} ({daysToExpiry} days left)
                        </span>
                        {isNearExpiry && (
                          <span className="text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 animate-pulse uppercase tracking-wider text-[8px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Near Expiry Alert
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <button
                        onClick={() => handleCancel(hold.id)}
                        className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl active:scale-95 transition-all border border-rose-500/20"
                        title="Cancel hold"
                      >
                        <XCircle className="h-4.5 w-4.5" />
                      </button>
                      <button
                        onClick={() => handleDispense(hold.id)}
                        className="btn-primary py-2.5 px-4 text-xs font-bold flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-transform bg-gradient-to-r from-secondary to-primary cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm font-bold">local_shipping</span>
                        Dispense Order
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Component 3: Active Shelf Stock Inventory & Low-Stock Alerts */}
        <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 opacity-55" />
          <h2 className="text-lg font-bold text-white mb-1.5 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-xl">inventory</span>
            Active Shelf Stock Inventory & Alerts
          </h2>
          <p className="text-xs text-clinical-400 mb-5 leading-relaxed">
            Real-time pharmacy shop shelf stock status. Flashing alerts indicate items falling below safety margins.
          </p>

          <div className="border border-outline-variant rounded-xl overflow-hidden glass-panel-inner">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-container text-clinical-300 border-b border-outline-variant font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Medicine Name</th>
                  <th className="p-3.5">Stock Level</th>
                  <th className="p-3.5 font-mono">Threshold</th>
                  <th className="p-3.5 text-center">Alert Status</th>
                  <th className="p-3.5 text-right">Supply Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant bg-surface-container-lowest/30">
                {shelfStock.map((item) => (
                  <ShelfStockRow key={item.name} item={item} onRestock={handleRestock} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* History of Dispensed Medicine Holds */}
        <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-secondary to-primary opacity-50" />
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-xl">receipt_long</span>
            Completed POS Dispatches Ledger
          </h2>
          
          {dispensedHolds.length === 0 ? (
            <div className="text-center py-6 text-clinical-500 text-sm">No medicine packages dispatched today.</div>
          ) : (
            <div className="border border-outline-variant rounded-xl overflow-hidden glass-panel-inner">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-container text-clinical-300 border-b border-outline-variant font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Medicine Info</th>
                    <th className="p-3.5">Batch & Expiry</th>
                    <th className="p-3.5 font-mono text-center">Quantity</th>
                    <th className="p-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant bg-surface-container-lowest/30">
                  {dispensedHolds.map(hold => (
                    <tr key={hold.id} className="hover:bg-surface-container/50 transition-colors">
                      <td className="p-3.5">
                        <div className="font-semibold text-white">{hold.medicineName}</div>
                        <div className="text-[10px] text-clinical-400 mt-1">{hold.dosage}</div>
                      </td>
                      <td className="p-3.5 text-clinical-300">
                        <div className="font-semibold text-white font-mono">Batch: {hold.batchNumber}</div>
                        <div className="text-[9px] text-clinical-400 mt-1 font-mono">Exp: {hold.expiryDate}</div>
                      </td>
                      <td className="p-3.5 text-center font-bold text-white font-mono">{hold.quantity} units</td>
                      <td className="p-3.5 text-center">
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
                          Dispensed
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* RIGHT COLUMN: AI Seasonal Stocking Recommendations */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Gemini Demand engine card */}
        <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary to-secondary opacity-50" />
          
          <h2 className="text-lg font-bold text-white mb-1.5 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">psychology</span>
            Gemini Demand AI
          </h2>
          <p className="text-[11px] text-clinical-400 mb-5 leading-relaxed">
            Predictive seasonal stocking recommendations based on localized Bihar epidemiology metrics.
          </p>

          <div className="space-y-4">
            
            {/* Sewage pathogen surveillance mini SVG graph */}
            <div className="bg-surface-container-lowest/80 border border-outline-variant p-4 rounded-xl space-y-3">
              <h4 className="font-bold text-[9px] text-clinical-300 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <span className="material-symbols-outlined text-xs text-primary animate-pulse">analytics</span>
                SEWAGE PATHOGEN DENSITY (PATNA)
              </h4>
              <div className="h-16 flex items-end justify-between gap-2 border-b border-l border-outline-variant pb-1 pl-1">
                {/* Bar 1 */}
                <div className="flex-1 flex flex-col items-center">
                  <div className="w-full bg-primary/20 h-4 rounded-t" />
                  <span className="text-[8px] text-clinical-400 font-mono mt-1 uppercase">Mar</span>
                </div>
                {/* Bar 2 */}
                <div className="flex-1 flex flex-col items-center">
                  <div className="w-full bg-primary/40 h-8 rounded-t" />
                  <span className="text-[8px] text-clinical-400 font-mono mt-1 uppercase">Apr</span>
                </div>
                {/* Bar 3 */}
                <div className="flex-1 flex flex-col items-center">
                  <div className="w-full bg-gradient-to-t from-secondary to-primary h-14 rounded-t animate-pulse" />
                  <span className="text-[8px] text-secondary font-mono font-bold mt-1 uppercase">May</span>
                </div>
              </div>
              <p className="text-[9px] text-rose-400 font-bold flex items-center gap-1 leading-normal">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping shrink-0" />
                Alert: pre-monsoon water logging spike predicted.
              </p>
            </div>

            {forecasts.map(forecast => (
              <div 
                key={forecast.id} 
                className={`p-4 rounded-xl border relative transition-all duration-300 ${
                  forecast.isActedUpon 
                    ? 'bg-surface-container-lowest/40 border-outline-variant/60 text-clinical-400' 
                    : 'bg-surface-container border-outline-variant hover:border-primary/40'
                }`}
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  <h4 className="font-bold text-xs text-white">{forecast.medicineName}</h4>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wider uppercase font-mono border ${
                    forecast.isActedUpon 
                      ? 'bg-surface-container-lowest text-clinical-400 border-outline-variant' 
                      : 'bg-secondary/10 text-secondary border border-secondary/20'
                  }`}>
                    {forecast.isActedUpon ? 'Acted' : `+${forecast.suggestedIncreasePercentage}% Bump`}
                  </span>
                </div>
                
                <p className="text-[11px] leading-relaxed text-clinical-400 mb-3">{forecast.reason}</p>
                
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[9px] text-clinical-400 flex items-center gap-1 font-semibold">
                    <Lightbulb className="h-3.5 w-3.5 text-secondary flex-shrink-0" />
                    Confidence: {Math.floor(forecast.forecastConfidence * 100)}%
                  </div>
                  {!forecast.isActedUpon && (
                    <button
                      onClick={() => handleActOnForecast(forecast.id)}
                      className="bg-secondary/10 hover:bg-secondary text-secondary hover:text-white border border-secondary/20 hover:border-secondary font-bold text-[9px] tracking-wider uppercase px-2.5 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer"
                    >
                      Authorize Order
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-start gap-2 bg-secondary/5 border border-secondary/10 p-3 rounded-lg text-[10px] text-secondary leading-relaxed">
            <span className="material-symbols-outlined text-sm mt-0.5 flex-shrink-0">info</span>
            <span>AI stock recommendations integrate with regional Dengue pools, heatwaves, and seasonal rain gauges to prevent localized supply shocks.</span>
          </div>
        </div>

      </div>
    </div>
  );
};
