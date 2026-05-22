import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { InventoryHold, SeasonalForecast } from '../../types';
import { 
  Calendar, 
  XCircle,
  Lightbulb
} from 'lucide-react';

export const PharmacyDashboard: React.FC = () => {
  const [holds, setHolds] = useState<InventoryHold[]>([]);
  const [forecasts, setForecasts] = useState<SeasonalForecast[]>([]);

  useEffect(() => {
    setHolds(api.getInventoryHolds());
    setForecasts(api.getSeasonalForecasts());
  }, []);

  const handleDispense = (id: string) => {
    api.dispenseInventoryHold(id);
    setHolds(api.getInventoryHolds());
  };

  const handleCancel = (id: string) => {
    api.cancelInventoryHold(id);
    setHolds(api.getInventoryHolds());
  };

  const handleActOnForecast = (id: string) => {
    api.actOnSeasonalForecast(id);
    setForecasts(api.getSeasonalForecasts());
  };

  const activeHolds = holds.filter(h => h.holdStatus === 'held');
  const dispensedHolds = holds.filter(h => h.holdStatus === 'dispensed');

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
