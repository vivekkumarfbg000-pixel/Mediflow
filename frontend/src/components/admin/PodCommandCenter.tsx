import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import type { Patient, LabRequisition, InventoryHold, FinancialLedgerEntry, WhatsAppSession } from '../../types';

/* ─────────────────────────────────────────────────────────────────────────────
   PodCommandCenter.tsx — Doctor Admin "God View"
   Live cross-pod telemetry panel visible only to the Doctor role.
   Shows all Lab, Pharmacy, WhatsApp, and Billing activity in one unified view.
───────────────────────────────────────────────────────────────────────────── */

interface PodCommandCenterProps {
  onStartConsultation?: (patient: Patient) => void;
  hideHeader?: boolean;
}

export const PodCommandCenter: React.FC<PodCommandCenterProps> = ({ onStartConsultation, hideHeader }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [labReqs, setLabReqs] = useState<LabRequisition[]>([]);
  const [inventoryHolds, setInventoryHolds] = useState<InventoryHold[]>([]);
  const [financials, setFinancials] = useState<FinancialLedgerEntry[]>([]);
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [reagents, setReagents] = useState<any[]>([]);
  const [pharmacyInventory, setPharmacyInventory] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pulse, setPulse] = useState(true);

  /* ─── Live clock + heartbeat ─────────────────────────────────── */
  useEffect(() => {
    const t = setInterval(() => {
      setCurrentTime(new Date());
      setPulse(p => !p);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  /* ─── Realtime data sync ─────────────────────────────────────── */
  useEffect(() => {
    const sync = () => {
      setPatients(api.getPatients());
      setLabReqs(api.getLabRequisitions());
      setInventoryHolds(api.getInventoryHolds());
      setFinancials(api.getFinancialLedgers());
      setSessions(api.getWhatsAppSessions());
      setReagents(api.getReagentStocks());
      setPharmacyInventory(api.getPharmacyInventory());
    };
    sync();
    return api.subscribe(sync);
  }, []);

  /* ─── Computed metrics ───────────────────────────────────────── */
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const labMetrics = useMemo(() => ({
    pending: labReqs.filter(r => r.status === 'pending').length,
    processing: labReqs.filter(r => r.status === 'collected' || r.status === 'processed').length,
    completedToday: labReqs.filter(r => r.status === 'completed' && r.createdAt.startsWith(todayStr)).length,
    walkins: labReqs.filter(r => r.encounterId === 'walkin').length,
    lowReagents: reagents.filter(r => r.stockVolume < 200).length,
    criticalReagents: reagents.filter(r => r.stockVolume < 100).length,
  }), [labReqs, reagents, todayStr]);

  const pharmacyMetrics = useMemo(() => ({
    pendingHolds: inventoryHolds.filter(h => h.holdStatus === 'held').length,
    dispensedToday: inventoryHolds.filter(h => h.holdStatus === 'dispensed' && h.createdAt.startsWith(todayStr)).length,
    lowStockItems: pharmacyInventory.filter((i: any) => i.stock <= i.threshold).length,
    criticalStockItems: pharmacyInventory.filter((i: any) => i.stock === 0).length,
  }), [inventoryHolds, pharmacyInventory, todayStr]);

  const financialMetrics = useMemo(() => {
    const today = financials.filter(l => l.createdAt?.startsWith(todayStr));
    const grossRev = financials.filter(l => l.transactionType === 'appointment_fee').reduce((s, l) => s + l.grossAmount, 0);
    const cleared = financials.filter(l => l.paymentStatus === 'cleared').reduce((s, l) => s + l.netPayout, 0);
    const pending = financials.filter(l => l.paymentStatus === 'pending').reduce((s, l) => s + l.netPayout, 0);
    const todayLedgers = today.length;
    return { grossRev, cleared, pending, todayLedgers };
  }, [financials, todayStr]);

  const whatsappMetrics = useMemo(() => ({
    active: sessions.filter(s => !['COMPLETED', 'FAILED_DELIVERY'].includes(s.currentState)).length,
    awaitingPayment: sessions.filter(s => s.currentState === 'AWAITING_PAYMENT').length,
    completed: sessions.filter(s => s.currentState === 'COMPLETED').length,
    failed: sessions.filter(s => s.currentState === 'FAILED_DELIVERY').length,
  }), [sessions]);

  const patientMetrics = useMemo(() => ({
    total: patients.length,
    awaitingConsultation: patients.filter(p => p.queueStatus === 'awaiting_consultation').length,
    inConsultation: patients.filter(p => (p.queueStatus as string) === 'in_consultation').length,
    completed: patients.filter(p => p.queueStatus === 'completed').length,
  }), [patients]);

  const overallHealthScore = useMemo(() => {
    let score = 100;
    if (labMetrics.criticalReagents > 0) score -= 15;
    if (labMetrics.lowReagents > 1) score -= 8;
    if (pharmacyMetrics.criticalStockItems > 0) score -= 12;
    if (pharmacyMetrics.lowStockItems > 2) score -= 6;
    if (whatsappMetrics.failed > 0) score -= 10;
    if (financialMetrics.pending > 5000) score -= 5;
    return Math.max(0, score);
  }, [labMetrics, pharmacyMetrics, whatsappMetrics, financialMetrics]);

  const healthColor = overallHealthScore >= 85 ? 'emerald' :
    overallHealthScore >= 65 ? 'amber' : 'rose';

  /* ─── Recent activity feed from lab + pharmacy combined ──────── */
  const activityFeed = useMemo(() => {
    const items: { time: string; type: string; icon: string; color: string; label: string; patient?: string }[] = [];

    labReqs.slice(0, 5).forEach(r => {
      items.push({
        time: r.createdAt,
        type: 'lab',
        icon: r.status === 'completed' ? 'verified' : r.status === 'collected' ? 'science' : 'pending',
        color: r.status === 'completed' ? 'emerald' : r.status === 'collected' ? 'blue' : 'amber',
        label: `${r.testName} — ${r.status.charAt(0).toUpperCase() + r.status.slice(1)}`,
        patient: r.patientName,
      });
    });

    inventoryHolds.slice(0, 5).forEach(h => {
      items.push({
        time: h.createdAt,
        type: 'pharmacy',
        icon: h.holdStatus === 'dispensed' ? 'medication' : 'inventory_2',
        color: h.holdStatus === 'dispensed' ? 'emerald' : 'blue',
        label: `${h.medicineName} — ${h.holdStatus.charAt(0).toUpperCase() + h.holdStatus.slice(1)}`,
        patient: h.patientId,
      });
    });

    return items
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 8);
  }, [labReqs, inventoryHolds]);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ──────────────────────────────────────────────── */}
      {!hideHeader && (
        <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 via-primary to-secondary" />

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-indigo-400 text-[20px]">hub</span>
                </div>
                <div>
                  <h1 className="text-base font-bold text-slate-800 leading-tight">Pod Command Center</h1>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Admin Telemetry — Mediflow Bihar Clinic Pod · Doctor Full Access
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Health Score Ring */}
              <div className="text-center">
                <div className={`w-14 h-14 rounded-full border-4 flex items-center justify-center font-bold text-lg font-mono ${
                  healthColor === 'emerald' ? 'border-emerald-400 text-emerald-700 bg-emerald-50' :
                  healthColor === 'amber' ? 'border-amber-400 text-amber-700 bg-amber-50' :
                  'border-rose-400 text-rose-700 bg-rose-50'
                }`}>
                  {overallHealthScore}
                </div>
                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Pod Health</div>
              </div>

              {/* Live clock */}
              <div className="text-right">
                <div className="text-base font-bold text-slate-800 font-mono">
                  {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {currentTime.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
                </div>
                <div className="flex items-center gap-1 justify-end mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${pulse ? 'bg-emerald-400' : 'bg-emerald-600'} transition-colors`} />
                  <span className="text-[8px] text-emerald-600 font-mono font-bold uppercase tracking-widest">Realtime</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Pod Nodes Grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

        {/* Lab Node */}
        <div className="glass-panel p-5 border-white/10 shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary to-secondary opacity-70" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">biotech</span>
              <span className="font-bold text-sm text-slate-800">Pathology Lab</span>
            </div>
            <div className={`w-2 h-2 rounded-full ${labMetrics.criticalReagents > 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400'}`} />
          </div>
          {(() => {
            const total = labMetrics.pending + labMetrics.processing + labMetrics.completedToday;
            return (
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 shrink-0">
                  <svg className="w-full h-full transform -rotate-90 animate-fade-in" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                    {total > 0 ? (
                      <>
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#10b981" strokeWidth="3" 
                          strokeDasharray={`${(labMetrics.completedToday / total) * 100} ${100 - (labMetrics.completedToday / total) * 100}`}
                          strokeDashoffset="0"
                        />
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#3b82f6" strokeWidth="3" 
                          strokeDasharray={`${(labMetrics.processing / total) * 100} ${100 - (labMetrics.processing / total) * 100}`}
                          strokeDashoffset={`-${(labMetrics.completedToday / total) * 100}`}
                        />
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f59e0b" strokeWidth="3" 
                          strokeDasharray={`${(labMetrics.pending / total) * 100} ${100 - (labMetrics.pending / total) * 100}`}
                          strokeDashoffset={`-${((labMetrics.completedToday + labMetrics.processing) / total) * 100}`}
                        />
                      </>
                    ) : (
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#cbd5e1" strokeWidth="3" strokeDasharray="100 0" />
                    )}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-black text-slate-800 text-xs font-mono">
                    {total}
                  </div>
                </div>
                <div className="flex-1 space-y-1.5 text-[10px]">
                  <div className="flex justify-between font-bold text-slate-600">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>Done Today</span>
                    <span className="font-mono">{labMetrics.completedToday}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-600">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"/>Processing</span>
                    <span className="font-mono">{labMetrics.processing}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-600">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"/>Pending</span>
                    <span className="font-mono">{labMetrics.pending}</span>
                  </div>
                </div>
              </div>
            );
          })()}
          {labMetrics.walkins > 0 && (
            <div className="mt-3 text-[9px] text-blue-500 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg font-mono font-bold text-center">
              {labMetrics.walkins} walk-in test(s) active
            </div>
          )}
        </div>

        {/* Pharmacy Node */}
        <div className="glass-panel p-5 border-white/10 shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-500 to-blue-500 opacity-70" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-500 text-[20px]">medication</span>
              <span className="font-bold text-sm text-slate-800">Pharmacy POS</span>
            </div>
            <div className={`w-2 h-2 rounded-full ${pharmacyMetrics.criticalStockItems > 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400'}`} />
          </div>
          {(() => {
            const totalPharma = pharmacyMetrics.dispensedToday + pharmacyMetrics.pendingHolds + pharmacyMetrics.lowStockItems;
            return (
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 shrink-0">
                  <svg className="w-full h-full transform -rotate-90 animate-fade-in" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                    {totalPharma > 0 ? (
                      <>
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#10b981" strokeWidth="3" 
                          strokeDasharray={`${(pharmacyMetrics.dispensedToday / totalPharma) * 100} ${100 - (pharmacyMetrics.dispensedToday / totalPharma) * 100}`}
                          strokeDashoffset="0"
                        />
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#6366f1" strokeWidth="3" 
                          strokeDasharray={`${(pharmacyMetrics.pendingHolds / totalPharma) * 100} ${100 - (pharmacyMetrics.pendingHolds / totalPharma) * 100}`}
                          strokeDashoffset={`-${(pharmacyMetrics.dispensedToday / totalPharma) * 100}`}
                        />
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f59e0b" strokeWidth="3" 
                          strokeDasharray={`${(pharmacyMetrics.lowStockItems / totalPharma) * 100} ${100 - (pharmacyMetrics.lowStockItems / totalPharma) * 100}`}
                          strokeDashoffset={`-${((pharmacyMetrics.dispensedToday + pharmacyMetrics.pendingHolds) / totalPharma) * 100}`}
                        />
                      </>
                    ) : (
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#cbd5e1" strokeWidth="3" strokeDasharray="100 0" />
                    )}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-black text-slate-800 text-xs font-mono">
                    {pharmacyMetrics.dispensedToday}
                  </div>
                </div>
                <div className="flex-1 space-y-1.5 text-[10px]">
                  <div className="flex justify-between font-bold text-slate-600">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>Dispensed</span>
                    <span className="font-mono">{pharmacyMetrics.dispensedToday}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-600">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500"/>Active Holds</span>
                    <span className="font-mono">{pharmacyMetrics.pendingHolds}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-600">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"/>Low Stock SKU</span>
                    <span className="font-mono">{pharmacyMetrics.lowStockItems}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* WhatsApp Node */}
        <div className="glass-panel p-5 border-white/10 shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-emerald-500 to-teal-500 opacity-70" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-[20px]">chat</span>
              <span className="font-bold text-sm text-slate-800">WhatsApp Engine</span>
            </div>
            <div className={`w-2 h-2 rounded-full ${whatsappMetrics.failed > 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400'}`} />
          </div>
          {(() => {
            const totalWA = whatsappMetrics.active + whatsappMetrics.awaitingPayment + whatsappMetrics.completed;
            return (
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 shrink-0">
                  <svg className="w-full h-full transform -rotate-90 animate-fade-in" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                    {totalWA > 0 ? (
                      <>
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#10b981" strokeWidth="3" 
                          strokeDasharray={`${(whatsappMetrics.completed / totalWA) * 100} ${100 - (whatsappMetrics.completed / totalWA) * 100}`}
                          strokeDashoffset="0"
                        />
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#0d9488" strokeWidth="3" 
                          strokeDasharray={`${(whatsappMetrics.active / totalWA) * 100} ${100 - (whatsappMetrics.active / totalWA) * 100}`}
                          strokeDashoffset={`-${(whatsappMetrics.completed / totalWA) * 100}`}
                        />
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f59e0b" strokeWidth="3" 
                          strokeDasharray={`${(whatsappMetrics.awaitingPayment / totalWA) * 100} ${100 - (whatsappMetrics.awaitingPayment / totalWA) * 100}`}
                          strokeDashoffset={`-${((whatsappMetrics.completed + whatsappMetrics.active) / totalWA) * 100}`}
                        />
                      </>
                    ) : (
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#cbd5e1" strokeWidth="3" strokeDasharray="100 0" />
                    )}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-black text-slate-800 text-xs font-mono">
                    {whatsappMetrics.active}
                  </div>
                </div>
                <div className="flex-1 space-y-1.5 text-[10px]">
                  <div className="flex justify-between font-bold text-slate-600">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>Completed</span>
                    <span className="font-mono">{whatsappMetrics.completed}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-600">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-teal-500"/>Active Sessions</span>
                    <span className="font-mono">{whatsappMetrics.active}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-600">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"/>Awaiting Pay</span>
                    <span className="font-mono">{whatsappMetrics.awaitingPayment}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Billing Node */}
        <div className="glass-panel p-5 border-white/10 shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500 to-orange-500 opacity-70" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600 text-[20px]">account_balance_wallet</span>
              <span className="font-bold text-sm text-slate-800">Revenue Ledger</span>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          {(() => {
            return (
              <div className="space-y-3">
                <div className="h-10 flex items-end justify-around gap-2 px-2 bg-slate-50 border border-slate-100 rounded-lg py-1">
                  {[
                    { label: 'Gross', amount: financialMetrics.grossRev, color: 'bg-amber-400' },
                    { label: 'Cleared', amount: financialMetrics.cleared, color: 'bg-emerald-500' },
                    { label: 'Pending', amount: financialMetrics.pending, color: 'bg-orange-500' }
                  ].map((bar, i) => {
                    const maxVal = Math.max(1, financialMetrics.grossRev, financialMetrics.cleared, financialMetrics.pending);
                    const heightPct = (bar.amount / maxVal) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                        <div className={`${bar.color} w-full rounded-t-xs transition-all duration-500`} style={{ height: `${Math.max(10, heightPct)}%` }} />
                        <span className="text-[7px] text-slate-400 mt-1 uppercase font-bold tracking-wider">{bar.label}</span>
                      </div>
                    );
                  })}
                </div>
                
                <div className="space-y-1 text-[9px] font-bold">
                  <div className="flex justify-between text-slate-600">
                    <span>Gross:</span>
                    <span className="font-mono">₹{financialMetrics.grossRev.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Cleared:</span>
                    <span className="font-mono">₹{financialMetrics.cleared.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Patient Flow + Activity Feed ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Patient flow summary */}
        <div className="lg:col-span-4 space-y-5">
          {/* Active Consultation Queue */}
          <div className="glass-panel p-5 border-white/10 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-500 to-indigo-500 opacity-60" />
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500 text-[16px]">pending_actions</span>
                Active Consultation Queue
              </h2>
              <span className="text-[9px] font-bold font-mono px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-500 rounded-full">
                {patients.length} Checked In
              </span>
            </div>
            
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {patients.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs italic">
                  No patients waiting today.
                </div>
              ) : (
                patients.map(p => (
                  <div key={p.id} className="p-3 bg-slate-50/60 border border-slate-200/50 rounded-xl flex items-center justify-between gap-3 group transition-all">
                    <div>
                      <div className="text-xs font-bold text-slate-700">{p.name}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">
                        {p.age}y • {p.gender}
                      </div>
                    </div>
                    {onStartConsultation && (
                      <button
                        onClick={() => onStartConsultation(p)}
                        className="px-2.5 py-1.5 bg-white hover:bg-indigo-600 hover:text-white border border-slate-200 hover:border-indigo-650 rounded-lg text-[9px] font-bold uppercase tracking-wider text-slate-600 shadow-2xs transition-all cursor-pointer hover:text-white-force"
                      >
                        Consult
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="glass-panel p-5 border-white/10 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-500 to-indigo-500 opacity-60" />
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-500 text-[16px]">group</span>
              Patient Flow Today
            </h2>
            <div className="space-y-2">
              {[
                { label: 'Total Registered', value: patientMetrics.total, color: 'blue', icon: 'person' },
                { label: 'Awaiting Consultation', value: patientMetrics.awaitingConsultation, color: 'amber', icon: 'schedule' },
                { label: 'In Consultation', value: patientMetrics.inConsultation, color: 'indigo', icon: 'stethoscope' },
                { label: 'Completed Care Loop', value: patientMetrics.completed, color: 'emerald', icon: 'task_alt' },
              ].map(item => (
                <div key={item.label} className={`flex items-center justify-between p-3 rounded-xl border ${
                  item.color === 'blue' ? 'bg-blue-50 border-blue-100' :
                  item.color === 'amber' ? 'bg-amber-50 border-amber-100' :
                  item.color === 'indigo' ? 'bg-indigo-50 border-indigo-100' :
                  'bg-emerald-50 border-emerald-100'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined text-[14px] ${
                      item.color === 'blue' ? 'text-blue-500' :
                      item.color === 'amber' ? 'text-amber-500' :
                      item.color === 'indigo' ? 'text-indigo-500' : 'text-emerald-500'
                    }`}>{item.icon}</span>
                    <span className={`text-xs font-semibold ${
                      item.color === 'blue' ? 'text-blue-700' :
                      item.color === 'amber' ? 'text-amber-700' :
                      item.color === 'indigo' ? 'text-indigo-700' : 'text-emerald-700'
                    }`}>{item.label}</span>
                  </div>
                  <span className={`text-base font-bold font-mono ${
                    item.color === 'blue' ? 'text-blue-800' :
                    item.color === 'amber' ? 'text-amber-800' :
                    item.color === 'indigo' ? 'text-indigo-800' : 'text-emerald-800'
                  }`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Reagent quick view */}
          <div className="glass-panel p-5 border-white/10 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary to-secondary opacity-50" />
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[16px]">science</span>
              Reagent Snapshot
            </h2>
            <div className="space-y-2">
              {reagents.map((r: any) => {
                const pct = Math.min(100, (r.stockVolume / 1000) * 100);
                const isLow = r.stockVolume < 200;
                const isCritical = r.stockVolume < 100;
                return (
                  <div key={r.reagentName}>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className={`font-semibold truncate max-w-[160px] ${isCritical ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-600'}`}>
                        {r.reagentName.replace(' Reagent', '').replace(' Enzyme', '')}
                      </span>
                      <span className="font-mono font-bold text-slate-500">{r.stockVolume}ml</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isCritical ? 'bg-rose-500' : isLow ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Live activity feed */}
        <div className="lg:col-span-8 space-y-5">
          <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-500 via-primary to-secondary opacity-60" />
            <h2 className="text-sm font-bold text-slate-800 mb-5 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${pulse ? 'bg-emerald-400' : 'bg-emerald-600'} transition-colors`} />
              Live Pod Activity Feed
              <span className="text-[10px] text-slate-400 font-mono ml-1">({activityFeed.length} recent events)</span>
            </h2>
            {activityFeed.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">No pod events logged today.</div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-[1px] bg-slate-100" />
                <div className="space-y-4 pl-10">
                  {activityFeed.map((item, i) => (
                    <div key={i} className="relative">
                      {/* Dot on timeline */}
                      <div className={`absolute -left-[26px] top-0.5 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${
                        item.color === 'emerald' ? 'border-emerald-400' :
                        item.color === 'blue' ? 'border-blue-400' :
                        'border-amber-400'
                      }`}>
                        <span className={`material-symbols-outlined text-[10px] ${
                          item.color === 'emerald' ? 'text-emerald-500' :
                          item.color === 'blue' ? 'text-blue-500' : 'text-amber-500'
                        }`}>{item.icon}</span>
                      </div>
                      <div className={`p-3 rounded-xl border transition-all ${
                        item.color === 'emerald' ? 'bg-emerald-50/50 border-emerald-100' :
                        item.color === 'blue' ? 'bg-blue-50/50 border-blue-100' :
                        'bg-amber-50/50 border-amber-100'
                      }`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-[11px] font-bold text-slate-700">{item.label}</div>
                            {item.patient && (
                              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">Patient: {item.patient}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                              item.type === 'lab' ? 'text-primary bg-primary/5 border-primary/10' : 'text-indigo-500 bg-indigo-50 border-indigo-100'
                            }`}>
                              {item.type === 'lab' ? 'LAB' : 'PHARMA'}
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono">
                              {new Date(item.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Financial Ledger Breakdown */}
          <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500 to-orange-500 opacity-50" />
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500 text-[16px]">receipt_long</span>
              Split Billing Ledger — Transaction Type Breakdown
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { type: 'appointment_fee', label: 'Clinic Appt', color: 'blue' },
                { type: 'lab_commission', label: 'Lab Revenue', color: 'primary' },
                { type: 'medicine_commission', label: 'Pharmacy', color: 'indigo' },
                { type: 'platform_fee', label: 'Platform', color: 'slate' },
              ].map(t => {
                const entries = financials.filter(l => l.transactionType === t.type);
                const total = entries.reduce((s, l) => s + l.netPayout, 0);
                return (
                  <div key={t.type} className={`p-3 rounded-xl border text-center ${
                    t.color === 'blue' ? 'bg-blue-50 border-blue-100' :
                    t.color === 'primary' ? 'bg-indigo-50 border-indigo-100' :
                    t.color === 'indigo' ? 'bg-purple-50 border-purple-100' :
                    'bg-slate-50 border-slate-100'
                  }`}>
                    <div className="text-base font-bold font-mono text-slate-800">
                      ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{t.label}</div>
                    <div className="text-[9px] text-slate-400 font-mono">{entries.length} txn</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Pod System Notices ───────────────────────────────────── */}
      {(labMetrics.criticalReagents > 0 || pharmacyMetrics.criticalStockItems > 0 || whatsappMetrics.failed > 0) && (
        <div className="glass-panel p-5 border-rose-200 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-rose-500 animate-pulse" />
          <h2 className="text-sm font-bold text-rose-700 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-500 text-[16px] animate-pulse">emergency</span>
            Critical Alerts Requiring Attention
          </h2>
          <div className="space-y-2">
            {labMetrics.criticalReagents > 0 && (
              <div className="flex items-center gap-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs">
                <span className="material-symbols-outlined text-rose-500 text-sm">science</span>
                <div>
                  <strong className="text-rose-700">{labMetrics.criticalReagents} reagent(s) critically low</strong>
                  <span className="text-rose-500 ml-2">(&lt;100ml remaining). Run autopilot or contact supplier immediately.</span>
                </div>
              </div>
            )}
            {pharmacyMetrics.criticalStockItems > 0 && (
              <div className="flex items-center gap-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs">
                <span className="material-symbols-outlined text-rose-500 text-sm">medication</span>
                <div>
                  <strong className="text-rose-700">{pharmacyMetrics.criticalStockItems} medicine SKU(s) out of stock.</strong>
                  <span className="text-rose-500 ml-2">Pending prescriptions may be blocked. Place B2B order immediately.</span>
                </div>
              </div>
            )}
            {whatsappMetrics.failed > 0 && (
              <div className="flex items-center gap-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs">
                <span className="material-symbols-outlined text-rose-500 text-sm">chat_error</span>
                <div>
                  <strong className="text-rose-700">{whatsappMetrics.failed} WhatsApp message(s) failed to deliver.</strong>
                  <span className="text-rose-500 ml-2">Patient care loop disrupted. Check Meta API gateway status.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
