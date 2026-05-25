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

  // V2.0 Barcode Scan State
  const [scanningHold, setScanningHold] = useState<InventoryHold | null>(null);
  const [scannerStage, setScannerStage] = useState<'idle' | 'scanning' | 'matched'>('idle');
  const [scanLogs, setScanLogs] = useState<string[]>([]);

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

  useEffect(() => {
    if (scanningHold) {
      const patients = api.getPatients();
      const patient = patients.find(p => p.id === scanningHold.patientId);
      if (patient) {
        api.setActivePatient(patient);
      }
    }
  }, [scanningHold]);
  // V2.0 Barcode Scan Effect
  useEffect(() => {
    if (!scanningHold || scannerStage !== 'scanning') return;

    const log1 = setTimeout(() => {
      setScanLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Laser target locked on batch: ${scanningHold.batchNumber}`,
        `[${new Date().toLocaleTimeString()}] Querying FEFO index...`
      ]);
    }, 600);

    const log2 = setTimeout(() => {
      setScanLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] MATCH DETECTED! status: RESERVED`,
        `[${new Date().toLocaleTimeString()}] Medicine package: ${scanningHold.medicineName} (${scanningHold.dosage})`,
        `[${new Date().toLocaleTimeString()}] Batch expiry: ${scanningHold.expiryDate} (FEFO Compliant) [OK]`,
        `[${new Date().toLocaleTimeString()}] Package integrity: VERIFIED [OK]`
      ]);
      setScannerStage('matched');

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: `Batch ${scanningHold.batchNumber} FEFO code matched & approved. Ready for dispatch.`,
          type: 'success',
          title: 'Barcode Match Verified'
        }
      }));
    }, 1500);

    return () => {
      clearTimeout(log1);
      clearTimeout(log2);
    };
  }, [scanningHold, scannerStage]);

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

  const handleActOnForecast = React.useCallback((id: string, medicineName: string) => {
    api.actOnSeasonalForecast(id);
    // V2.0 Trigger automatic restocking levels (+500 units)
    setShelfStock(prev => prev.map(item => {
      if (item.name.toLowerCase().includes(medicineName.toLowerCase()) || medicineName.toLowerCase().includes(item.name.toLowerCase())) {
        return { ...item, stock: item.stock + 500 };
      }
      return item;
    }));

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Gemini epidemiology demand stocking increase authorized. Replenishment logged and shelf stock increased (+500 units of ${medicineName}).`,
        type: 'success',
        title: 'Forecast Approved'
      }
    }));
  }, []);

  const activeHolds = React.useMemo(() => holds.filter(h => h.holdStatus === 'held'), [holds]);
  const dispensedHolds = React.useMemo(() => holds.filter(h => h.holdStatus === 'dispensed'), [holds]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in relative">
      
      {/* Laser sweep animation styles */}
      <style>{`
        @keyframes laser-sweep {
          0% { top: 0%; opacity: 0.3; }
          50% { top: 100%; opacity: 1; }
          100% { top: 0%; opacity: 0.3; }
        }
        .laser-line {
          animation: laser-sweep 2.5s infinite ease-in-out;
        }
      `}</style>

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
                // Consent compliant lockout blur
                const isConsentActive = api.isPatientConsentActive(hold.patientId);
                
                return (
                  <div key={hold.id} className="p-5 bg-surface-container border border-outline-variant rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:border-outline/50 transition-all relative overflow-hidden">
                    
                    {/* compliance lockout */}
                    {!isConsentActive && (
                      <div className="absolute inset-0 z-[45] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md border border-rose-500/20 p-4 text-center animate-fade-in">
                        <div className="w-8 h-8 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-1.5 text-rose-500 animate-pulse">
                          <span className="material-symbols-outlined text-base">lock</span>
                        </div>
                        <h4 className="text-white font-bold text-xs">Consent Lock Active</h4>
                        <p className="text-[9px] text-clinical-400 max-w-[220px]">
                          Ecosystem security notice: Patient must approve clinical access on WhatsApp simulation to unlock this inventory hold.
                        </p>
                      </div>
                    )}

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
                        className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl active:scale-95 transition-all border border-rose-500/20 cursor-pointer"
                        title="Cancel hold"
                      >
                        <XCircle className="h-4.5 w-4.5" />
                      </button>
                      <button
                        onClick={() => {
                          setScanningHold(hold);
                          setScannerStage('scanning');
                          setScanLogs([
                            `[${new Date().toLocaleTimeString()}] Initializing smart laser scanner device...`,
                            `[${new Date().toLocaleTimeString()}] Awaiting FEFO batch alignment...`
                          ]);
                        }}
                        className="btn-primary py-2.5 px-4 text-xs font-bold flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-transform bg-gradient-to-r from-secondary to-primary cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm font-bold">qr_code_scanner</span>
                        Verify & Dispense
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
                      onClick={() => handleActOnForecast(forecast.id, forecast.medicineName)}
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

      {/* V2.0 PREMIUM LASER BARCODE SCANNER SIMULATION MODAL */}
      {scanningHold && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="glass-panel max-w-md w-full p-6 border-secondary/20 shadow-2xl space-y-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-secondary to-primary" />
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary animate-pulse">qr_code_scanner</span>
                FEFO Barcode Scan Verification
              </h3>
              <button
                onClick={() => {
                  setScanningHold(null);
                  setScannerStage('idle');
                }}
                className="text-clinical-400 hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Viewfinder block */}
            <div className="relative h-48 w-full bg-black/80 rounded-lg border border-white/10 flex flex-col items-center justify-center overflow-hidden">
              
              {/* Corner brackets */}
              <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-secondary/80 rounded-tl" />
              <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-secondary/80 rounded-tr" />
              <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-secondary/80 rounded-bl" />
              <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-secondary/80 rounded-br" />

              {/* Sweeping Laser Line */}
              {scannerStage === 'scanning' && (
                <div className="absolute left-0 w-full h-[2px] bg-rose-500 shadow-[0_0_12px_#ef4444] laser-line z-10" />
              )}

              {/* Holographic Barcode */}
              <div className={`flex flex-col items-center justify-center gap-2 transition-all duration-500 ${
                scannerStage === 'matched' ? 'scale-105 opacity-100' : 'opacity-65'
              }`}>
                {/* SVG mock barcode */}
                <svg className="w-56 h-16 text-white fill-current" viewBox="0 0 200 60">
                  {/* Outer rect border */}
                  <rect x="0" y="0" width="200" height="60" fill="transparent" />
                  
                  {/* Generated bars */}
                  <rect x="10" y="5" width="3" height="50" fill="currentColor" />
                  <rect x="15" y="5" width="1" height="50" fill="currentColor" />
                  <rect x="18" y="5" width="2" height="50" fill="currentColor" />
                  <rect x="24" y="5" width="4" height="50" fill="currentColor" />
                  <rect x="30" y="5" width="1" height="50" fill="currentColor" />
                  <rect x="33" y="5" width="3" height="50" fill="currentColor" />
                  <rect x="40" y="5" width="2" height="50" fill="currentColor" />
                  <rect x="46" y="5" width="5" height="50" fill="currentColor" />
                  <rect x="54" y="5" width="1" height="50" fill="currentColor" />
                  
                  {/* Center guard bars */}
                  <rect x="95" y="5" width="2" height="50" fill="#ef4444" />
                  <rect x="99" y="5" width="2" height="50" fill="#ef4444" />
                  
                  {/* More bars */}
                  <rect x="110" y="5" width="3" height="50" fill="currentColor" />
                  <rect x="115" y="5" width="4" height="50" fill="currentColor" />
                  <rect x="122" y="5" width="1" height="50" fill="currentColor" />
                  <rect x="126" y="5" width="2" height="50" fill="currentColor" />
                  <rect x="132" y="5" width="5" height="50" fill="currentColor" />
                  <rect x="140" y="5" width="1" height="50" fill="currentColor" />
                  <rect x="144" y="5" width="3" height="50" fill="currentColor" />
                  <rect x="150" y="5" width="2" height="50" fill="currentColor" />
                  <rect x="156" y="5" width="1" height="50" fill="currentColor" />
                  <rect x="162" y="5" width="3" height="50" fill="currentColor" />
                  <rect x="170" y="5" width="4" height="50" fill="currentColor" />
                  <rect x="178" y="5" width="2" height="50" fill="currentColor" />
                  <rect x="185" y="5" width="3" height="50" fill="currentColor" />
                </svg>
                <div className="text-[10px] font-mono text-secondary tracking-widest font-black uppercase">
                  {scanningHold.batchNumber}
                </div>
              </div>

              {/* Status text badge */}
              <div className="absolute bottom-4 bg-black/60 px-3 py-1 rounded border border-white/10 text-[9px] font-mono uppercase tracking-widest text-center">
                {scannerStage === 'scanning' ? (
                  <span className="text-secondary flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping" />
                    LASER ACTIVE...
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1.5 font-bold animate-pulse">
                    <span className="material-symbols-outlined text-xs">check_circle</span>
                    MATCH FOUND
                  </span>
                )}
              </div>
            </div>

            {/* Scrolling terminal output */}
            <div className="bg-surface-container-lowest border border-outline-variant p-3.5 rounded-lg h-32 overflow-y-auto font-mono text-[9px] text-clinical-300 space-y-1">
              {scanLogs.map((log, idx) => (
                <div key={idx} className={log.includes('MATCH') ? 'text-emerald-400 font-bold' : log.includes('Laser target') ? 'text-secondary' : ''}>
                  {log}
                </div>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="flex gap-3 justify-end pt-3 border-t border-white/10">
              <button
                onClick={() => {
                  setScanningHold(null);
                  setScannerStage('idle');
                }}
                className="px-4 py-2 bg-surface-container hover:bg-surface-container-highest border border-outline-variant text-clinical-300 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Abort
              </button>
              {scannerStage === 'matched' ? (
                <button
                  onClick={() => {
                    handleDispense(scanningHold.id);
                    setScanningHold(null);
                    setScannerStage('idle');
                  }}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-black tracking-wider uppercase flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm font-bold">local_shipping</span>
                  Settle & Dispense
                </button>
              ) : (
                <button
                  disabled
                  className="px-5 py-2 bg-surface-container-highest border border-outline-variant text-clinical-500 rounded-xl text-xs font-bold cursor-not-allowed uppercase flex items-center gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-clinical-500 animate-pulse" />
                  Verifying...
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
