import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { ReagentStock } from '../../services/api';
import type { LabRequisition } from '../../types';
import { 
  Beaker, 
  Barcode, 
  CheckCircle, 
  Send, 
  FlaskConical, 
  Database,
  Activity
} from 'lucide-react';

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
    <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* LEFT COLUMN: Test Requisition queue (Pending, Collected) */}
      <div className="lg:col-span-8 space-y-8">
        
        {/* Active Test Requisitions */}
        <div className="glass-panel p-6">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Beaker className="h-5 w-5 text-blue-500 animate-pulse-subtle" /> Active Test Requisition Queue
          </h2>

          <div className="space-y-6">
            
            {/* 1. Samples pending collection */}
            <div>
              <h3 className="font-bold text-xs text-clinical-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Awaiting Sample Collection ({pendingList.length})
              </h3>
              {pendingList.length === 0 ? (
                <div className="p-4 bg-clinical-950/40 border border-clinical-850 rounded-xl text-center text-xs text-clinical-500">
                  No pending sample draws.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingList.map(req => (
                    <div key={req.id} className="p-4 bg-clinical-900/40 border border-clinical-800 rounded-xl flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-bold text-sm text-white">{req.patientName}</h4>
                          <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded uppercase">
                            Pending Draw
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-blue-400 mt-2">{req.testName}</p>
                        <p className="text-[10px] text-clinical-500 mt-1 uppercase">Barcode: {req.barcode}</p>
                      </div>
                      <button
                        onClick={() => handleCollectSample(req.id)}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2 rounded-lg flex items-center justify-center gap-2 shadow active:scale-95 transition-all"
                      >
                        <Barcode className="h-4 w-4" /> Print Barcode & Collect Sample
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Collected / Processing Requisitions */}
            <div className="border-t border-clinical-800/80 pt-6">
              <h3 className="font-bold text-xs text-clinical-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Drawn Samples in Process ({collectedList.length})
              </h3>
              {collectedList.length === 0 ? (
                <div className="p-4 bg-clinical-950/40 border border-clinical-850 rounded-xl text-center text-xs text-clinical-500">
                  No samples ready for testing.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {collectedList.map(req => (
                    <div key={req.id} className="p-4 bg-clinical-900/40 border border-clinical-800 rounded-xl flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-bold text-sm text-white">{req.patientName}</h4>
                          <span className="text-[9px] font-bold text-blue-500 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded uppercase">
                            Processing
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-blue-400 mt-2">{req.testName}</p>
                        <p className="text-[10px] text-clinical-500 mt-1 uppercase">Sticker Label Mapped</p>
                      </div>
                      <button
                        onClick={() => handleOpenSubmit(req)}
                        className="bg-gradient-to-r from-blue-600 to-accent-600 hover:from-blue-500 hover:to-accent-500 text-white font-semibold text-xs py-2 rounded-lg flex items-center justify-center gap-2 shadow active:scale-95 transition-all"
                      >
                        <Send className="h-4 w-4" /> Input Analyzer Result
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Diagnostic completed reports card */}
        <div className="glass-panel p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-500" /> Completed Diagnostic Report Cards
          </h2>
          {completedList.length === 0 ? (
            <div className="text-center py-6 text-clinical-500 text-sm">No completed tests logged today.</div>
          ) : (
            <div className="border border-clinical-800 rounded-2xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-clinical-900 text-clinical-400 border-b border-clinical-800 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Patient</th>
                    <th className="p-3">Lab Requisition</th>
                    <th className="p-3">Analyzer Value</th>
                    <th className="p-3 text-center">Reagent Stock Deduction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-clinical-800/80 bg-clinical-950/20">
                  {completedList.map(req => (
                    <tr key={req.id} className="hover:bg-clinical-900/20">
                      <td className="p-3 font-semibold text-white">{req.patientName}</td>
                      <td className="p-3 text-clinical-300">
                        <div>{req.testName}</div>
                        <div className="text-[9px] text-clinical-500 mt-0.5 uppercase">Barcode: {req.barcode}</div>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-accent-400 bg-accent-500/10 border border-accent-500/20 px-2.5 py-1 rounded-lg">
                          {req.quantitativeResult}
                        </span>
                      </td>
                      <td className="p-3">
                        {req.reagentDeductions.map((ded, idx) => (
                          <div key={idx} className="text-right text-[10px] text-rose-400 flex items-center justify-end gap-1.5 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse-subtle"></span>
                            Deducted: -{ded.volumeDeducted}{ded.unit} {ded.reagentName}
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
      <div className="lg:col-span-4 space-y-8">
        
        {/* Reagent Chemical Inventory Ledger */}
        <div className="glass-panel p-6 border-blue-500/20 shadow-md">
          <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-blue-500" /> Reagent Ledger
          </h2>
          <p className="text-xs text-clinical-400 mb-6">
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
                    <span className={isLow ? 'text-rose-500' : 'text-clinical-400'}>
                      {reag.stockVolume} {reag.unit}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-clinical-950 rounded-full overflow-hidden border border-clinical-800">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isLow ? 'bg-rose-500' : 'bg-gradient-to-r from-blue-600 to-accent-600'
                      }`}
                      style={{ width: `${Math.min(100, percentage)}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex items-center gap-3 bg-blue-500/5 border border-blue-500/10 p-3.5 rounded-xl text-[10px] text-blue-400 leading-relaxed">
            <Database className="h-5 w-5 text-blue-500 flex-shrink-0" />
            <span>Automatic Deduction Trigger <code>on_lab_test_completed</code> is active on the database broker. Reagent stocks deduct seamlessly upon submission.</span>
          </div>
        </div>

        {/* Floating Analyzer Submission Modal */}
        {activeReqId && (
          <div className="glass-panel p-6 border-accent-500/40 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-accent-500/5 rounded-full blur-2xl"></div>
            <h3 className="font-bold text-white mb-2 flex items-center gap-2">
              <Activity className="h-5 w-5 text-accent-500" /> Quantitative Result Entry
            </h3>
            <p className="text-xs text-clinical-400 mb-4">
              Enter clinical metrics value to verify and route patient PDF reports.
            </p>

            <form onSubmit={handlePublishReport} className="space-y-4">
              <div>
                <label className="block text-[10px] text-clinical-400 mb-1.5 uppercase font-semibold">
                  Test ID: {activeReqId}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 7.1 % or 1.4 mg/dL"
                  value={resultVal}
                  onChange={(e) => setResultVal(e.target.value)}
                  className="w-full input-field text-sm"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setActiveReqId(null)}
                  className="btn-secondary py-2 px-3 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary py-2 px-4 text-xs font-semibold"
                >
                  Publish & Verify Report
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};
