import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { InventoryHold, SeasonalForecast } from '../../types';
import { 
  ShoppingBag, 
  Calendar, 
  TrendingUp, 
  Package, 
  AlertCircle, 
  CheckCircle,
  XCircle,
  BrainCircuit,
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
    <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* LEFT COLUMN: e-Prescription Inventory Holds (FEFO Sorted) */}
      <div className="lg:col-span-8 space-y-8">
        
        {/* Active Holds Queue */}
        <div className="glass-panel p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-emerald-500 animate-pulse-subtle" /> Active Inventory holds (FEFO Sorted)
              </h2>
              <p className="text-xs text-clinical-400 mt-1">
                Medicine packages pre-allocated by doctor prescription to prevent double-selling to physical walk-ins.
              </p>
            </div>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
              FEFO Control Active
            </span>
          </div>

          {activeHolds.length === 0 ? (
            <div className="p-8 bg-clinical-950/40 border border-clinical-850 rounded-xl text-center text-sm text-clinical-500">
              No active e-prescription medicine reserves in queue.
            </div>
          ) : (
            <div className="space-y-4">
              {activeHolds.map(hold => {
                const daysToExpiry = Math.ceil((new Date(hold.expiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
                const isNearExpiry = daysToExpiry < 90;
                
                return (
                  <div key={hold.id} className="p-4 bg-clinical-900/40 border border-clinical-800 rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-bold text-sm text-white">{hold.medicineName}</h4>
                        <span className="text-[10px] font-bold text-clinical-400 bg-clinical-950 border border-clinical-800 px-2 py-0.5 rounded">
                          Batch: {hold.batchNumber}
                        </span>
                      </div>
                      <p className="text-xs text-clinical-300">Dosage: {hold.dosage} • Target Qty: {hold.quantity} units</p>
                      
                      {/* Expiry alerts indicators matching SOP section */}
                      <div className="flex flex-wrap items-center gap-3 pt-2 text-[10px]">
                        <span className={`flex items-center gap-1 font-semibold ${isNearExpiry ? 'text-rose-400' : 'text-clinical-400'}`}>
                          <Calendar className="h-3.5 w-3.5" /> Expiry: {hold.expiryDate} ({daysToExpiry} days left)
                        </span>
                        {isNearExpiry && (
                          <span className="text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Near Expiry Flag
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <button
                        onClick={() => handleCancel(hold.id)}
                        className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl active:scale-95 transition-all"
                        title="Cancel hold"
                      >
                        <XCircle className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDispense(hold.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow active:scale-95 transition-all"
                      >
                        <CheckCircle className="h-4.5 w-4.5" /> Dispense Order
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* History of Dispensed Medicine Holds */}
        <div className="glass-panel p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-clinical-400" /> Completed POS Dispatches
          </h2>
          {dispensedHolds.length === 0 ? (
            <div className="text-center py-6 text-clinical-500 text-sm">No medicine packages dispatched today.</div>
          ) : (
            <div className="border border-clinical-800 rounded-2xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-clinical-900 text-clinical-400 border-b border-clinical-800 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Medicine Info</th>
                    <th className="p-3">Batch & Expiry</th>
                    <th className="p-3">Quantity</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-clinical-800/80 bg-clinical-950/20">
                  {dispensedHolds.map(hold => (
                    <tr key={hold.id} className="hover:bg-clinical-900/20">
                      <td className="p-3">
                        <div className="font-semibold text-white">{hold.medicineName}</div>
                        <div className="text-[10px] text-clinical-500 mt-0.5">{hold.dosage}</div>
                      </td>
                      <td className="p-3 text-clinical-300">
                        <div>Batch: {hold.batchNumber}</div>
                        <div className="text-[9px] text-clinical-500 mt-0.5">Exp: {hold.expiryDate}</div>
                      </td>
                      <td className="p-3 text-clinical-300 font-semibold">{hold.quantity} units</td>
                      <td className="p-3 text-center">
                        <span className="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded uppercase">
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
      <div className="lg:col-span-4 space-y-8">
        
        {/* Gemini Demand engine card */}
        <div className="glass-panel border-emerald-500/20 p-6 shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl"></div>
          
          <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-emerald-500 animate-pulse-subtle" /> Gemini Demand AI
          </h2>
          <p className="text-xs text-clinical-400 mb-6">
            Predictive seasonal stocking recommendations based on localized Bihar epidemiology metrics.
          </p>

          <div className="space-y-4">
            {forecasts.map(forecast => (
              <div 
                key={forecast.id} 
                className={`p-4 rounded-xl border relative transition-all duration-300 ${
                  forecast.isActedUpon 
                    ? 'bg-clinical-900/30 border-clinical-800/80 text-clinical-400' 
                    : 'bg-emerald-500/[0.02] border-emerald-500/20 hover:border-emerald-500/40'
                }`}
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  <h4 className="font-bold text-xs text-white">{forecast.medicineName}</h4>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                    forecast.isActedUpon 
                      ? 'bg-clinical-950 text-clinical-500 border border-clinical-850' 
                      : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  }`}>
                    {forecast.isActedUpon ? 'Acted Upon' : `+${forecast.suggestedIncreasePercentage}% Bump`}
                  </span>
                </div>
                
                <p className="text-[11px] leading-relaxed text-clinical-400 mb-3">{forecast.reason}</p>
                
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] text-clinical-500 flex items-center gap-1">
                    <Lightbulb className="h-3.5 w-3.5 text-emerald-500" /> Confidence: {Math.floor(forecast.forecastConfidence * 100)}%
                  </div>
                  {!forecast.isActedUpon && (
                    <button
                      onClick={() => handleActOnForecast(forecast.id)}
                      className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 hover:border-emerald-500 font-bold text-[10px] px-2.5 py-1 rounded-lg transition-all active:scale-95"
                    >
                      Authorize Order
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/10 p-3.5 rounded-xl text-[10px] text-emerald-400 leading-relaxed">
            <TrendingUp className="h-5 w-5 text-emerald-500 flex-shrink-0" />
            <span>AI stock recommendations integrate with regional Dengue pools, heatwaves, and seasonal rain gauges to prevent localized supply shocks.</span>
          </div>
        </div>

      </div>
    </div>
  );
};
