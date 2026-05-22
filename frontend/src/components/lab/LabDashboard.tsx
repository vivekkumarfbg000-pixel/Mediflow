import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { ReagentStock } from '../../services/api';
import type { LabRequisition } from '../../types';


export const LabDashboard: React.FC = () => {
  const [requisitions, setRequisitions] = useState<LabRequisition[]>([]);
  const [reagents, setReagents] = useState<ReagentStock[]>([]);
  
  // Single result form input
  const [activeReqId, setActiveReqId] = useState<string | null>(null);
  const [resultVal, setResultVal] = useState('');

  useEffect(() => {
    setRequisitions(api.getLabRequisitions());
    setReagents(api.getReagentStocks());
  }, []);

  const handleCollectSample = (id: string) => {
    api.collectLabSample(id);
    setRequisitions(api.getLabRequisitions());
  };

  const handleOpenSubmit = (req: LabRequisition) => {
    setActiveReqId(req.id);
    setResultVal('');
  };

  const handlePublishReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReqId || !resultVal) return;

    api.submitLabResult(activeReqId, resultVal);
    
    // Refresh lists to show state and reagent deduction!
    setRequisitions(api.getLabRequisitions());
    setReagents(api.getReagentStocks());
    
    setActiveReqId(null);
    setResultVal('');
  };

  const pendingList = requisitions.filter(r => r.status === 'pending');
  const collectedList = requisitions.filter(r => r.status === 'collected');
  const completedList = requisitions.filter(r => r.status === 'completed');

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
      {/* LEFT COLUMN: Test Requisition queue (Pending, Collected) */}
      <div className="lg:col-span-8 space-y-6">
        
        {/* Active Test Requisitions */}
        <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary to-secondary opacity-50" />
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">biotech</span>
            Active Pathology Specimen & Requisition Queue
          </h2>

          <div className="space-y-6">
            
            {/* 1. Samples pending collection */}
            <div>
              <h3 className="font-bold text-xs text-clinical-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                Awaiting Sample Collection ({pendingList.length})
              </h3>
              
              {pendingList.length === 0 ? (
                <div className="p-5 bg-surface-container-lowest/40 border border-outline-variant rounded-xl text-center text-xs text-clinical-500">
                  No pending sample draws.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingList.map(req => (
                    <div key={req.id} className="p-5 bg-surface-container rounded-xl border border-outline-variant flex flex-col justify-between gap-4 hover:border-outline/50 transition-all duration-300">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-bold text-sm text-white">{req.patientName}</h4>
                          <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                            Pending Draw
                          </span>
                        </div>
                        <p className="text-xs font-bold text-primary mt-2 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">science</span>
                          {req.testName}
                        </p>
                        
                        {/* Simulated Barcode Sticker sticker decal */}
                        <div className="mt-3 p-3 bg-surface-container-lowest/80 border border-outline-variant rounded-lg space-y-2">
                          <div className="flex justify-between text-[8px] text-clinical-400 font-mono font-bold tracking-widest uppercase">
                            <span>REQUISITION MAPPED</span>
                            <span>ID: {req.id.toUpperCase()}</span>
                          </div>
                          <div className="simulated-barcode h-8 w-full" />
                          <p className="text-[9px] text-center text-clinical-300 font-mono tracking-wider font-bold">
                            *{req.barcode}*
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCollectSample(req.id)}
                        className="btn-primary py-2 text-xs flex items-center justify-center gap-2 active:scale-95 transition-all w-full font-bold"
                      >
                        <span className="material-symbols-outlined text-sm font-bold">print</span>
                        Print Barcode & Collect Sample
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Collected / Processing Requisitions */}
            <div className="border-t border-outline-variant pt-6">
              <h3 className="font-bold text-xs text-clinical-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                Drawn Samples in Process ({collectedList.length})
              </h3>
              {collectedList.length === 0 ? (
                <div className="p-5 bg-surface-container-lowest/40 border border-outline-variant rounded-xl text-center text-xs text-clinical-500">
                  No samples ready for testing.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {collectedList.map(req => (
                    <div key={req.id} className="p-5 bg-surface-container rounded-xl border border-outline-variant flex flex-col justify-between gap-4 hover:border-outline/50 transition-all duration-300">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-bold text-sm text-white">{req.patientName}</h4>
                          <span className="text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                            Processing
                          </span>
                        </div>
                        <p className="text-xs font-bold text-secondary mt-2 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">science</span>
                          {req.testName}
                        </p>
                        <div className="mt-3 flex items-center gap-2 bg-surface-container-lowest/70 border border-outline-variant/60 p-2.5 rounded-lg">
                          <span className="material-symbols-outlined text-sm text-primary">label</span>
                          <div className="text-[10px] text-clinical-300 font-medium">
                            Specimen Barcode <strong className="text-white font-mono">{req.barcode}</strong> matches catalog trigger
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenSubmit(req)}
                        className="btn-primary py-2 text-xs flex items-center justify-center gap-2 active:scale-95 transition-all w-full font-bold bg-gradient-to-r from-primary to-secondary"
                      >
                        <span className="material-symbols-outlined text-sm font-bold">input</span>
                        Input Analyzer Result
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Diagnostic completed reports card */}
        <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-secondary to-primary opacity-50" />
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-xl">verified</span>
            Completed Diagnostic Report Cards & Reagent Logs
          </h2>
          
          {completedList.length === 0 ? (
            <div className="text-center py-8 text-clinical-500 text-sm">No completed tests logged today.</div>
          ) : (
            <div className="border border-outline-variant rounded-xl overflow-hidden glass-panel-inner">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-container text-clinical-300 border-b border-outline-variant font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Patient</th>
                    <th className="p-3.5">Lab Requisition</th>
                    <th className="p-3.5">Analyzer Value</th>
                    <th className="p-3.5 text-right">Reagent Stock Deduction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant bg-surface-container-lowest/30">
                  {completedList.map(req => (
                    <tr key={req.id} className="hover:bg-surface-container/50 transition-colors">
                      <td className="p-3.5 font-semibold text-white">{req.patientName}</td>
                      <td className="p-3.5 text-clinical-300">
                        <div className="font-semibold text-white">{req.testName}</div>
                        <div className="text-[9px] text-clinical-400 mt-1 uppercase font-mono tracking-wider">
                          Barcode: {req.barcode}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="font-bold text-secondary bg-secondary/10 border border-secondary/20 px-3 py-1 rounded-lg font-mono">
                          {req.quantitativeResult}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        {req.reagentDeductions.map((ded, idx) => (
                          <div key={idx} className="text-right text-[10px] text-rose-400 flex items-center justify-end gap-1.5 font-bold tracking-wide uppercase font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                            -{ded.volumeDeducted}{ded.unit} {ded.reagentName}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* RIGHT COLUMN: Reagent stocks, Result Input Modal */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Reagent Chemical Inventory Ledger */}
        <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary to-secondary opacity-50" />
          <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">database</span>
            Reagent Chemical Ledger
          </h2>
          <p className="text-[11px] text-clinical-400 mb-5 leading-relaxed">
            Real-time analyzer chemical stock tracking with auto-deduction.
          </p>

          <div className="space-y-4">
            {reagents.map((reag, idx) => {
              const percentage = (reag.stockVolume / 1000) * 100;
              const isLow = reag.stockVolume < 100;
              return (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-clinical-300">{reag.reagentName}</span>
                    <span className={`font-mono text-xs ${isLow ? 'text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded' : 'text-clinical-300'}`}>
                      {reag.stockVolume} {reag.unit}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-surface-container-lowest rounded-full overflow-hidden border border-outline-variant p-[1px]">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isLow ? 'bg-rose-500' : 'bg-gradient-to-r from-primary to-secondary'
                      }`}
                      style={{ width: `${Math.min(100, percentage)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex items-start gap-2 bg-primary/5 border border-primary/10 p-3 rounded-lg text-[10px] text-primary leading-relaxed">
            <span className="material-symbols-outlined text-sm mt-0.5 flex-shrink-0">info</span>
            <span>Automatic Reagent Deduction Trigger <code>on_lab_test_completed</code> is active on the database broker. Reagent stocks deduct seamlessly upon submission.</span>
          </div>
        </div>

        {/* Floating Analyzer Submission Modal */}
        {activeReqId && (
          <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden animate-fade-in">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-secondary to-primary opacity-50" />
            <h3 className="font-bold text-white mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-xl">edit_document</span>
              Analyzer Result Input
            </h3>
            <p className="text-xs text-clinical-400 mb-4 leading-relaxed">
              Enter clinical metrics value to verify and route patient PDF reports.
            </p>

            <form onSubmit={handlePublishReport} className="space-y-4">
              <div>
                <label className="block text-[9px] text-clinical-300 mb-1.5 uppercase font-bold tracking-wider font-mono">
                  Test ID: {activeReqId.toUpperCase()}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 7.1 % or 1.4 mg/dL"
                  value={resultVal}
                  onChange={(e) => setResultVal(e.target.value)}
                  className="w-full input-field text-sm focus:ring-1 focus:ring-secondary focus:border-secondary"
                />
              </div>

              {/* High-fidelity clinical quantitative reference range markers */}
              <div className="bg-surface-container-lowest/80 p-3.5 border border-outline-variant rounded-lg space-y-2">
                <span className="text-[10px] text-clinical-300 font-bold uppercase tracking-wider font-mono">Reference Values Reference</span>
                <div className="h-[2px] w-full bg-outline-variant relative rounded-full">
                  <div className="absolute left-[30%] right-[30%] h-full bg-secondary" />
                  <span className="absolute left-[30%] -top-[3px] w-2 h-2 rounded-full bg-secondary" />
                  <span className="absolute right-[30%] -top-[3px] w-2 h-2 rounded-full bg-secondary" />
                </div>
                <div className="flex justify-between text-[9px] text-clinical-400 font-mono">
                  <span>0.6 mg/dL (Low)</span>
                  <span className="text-secondary font-bold">0.6 - 1.2 mg/dL (Normal)</span>
                  <span>1.2 mg/dL (High)</span>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setActiveReqId(null)}
                  className="btn-secondary py-1.5 px-3 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary py-1.5 px-4 text-xs font-bold bg-gradient-to-r from-secondary to-primary hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                >
                  Publish & Verify
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};
