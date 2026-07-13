import React from 'react';
import type { FinancialLedgerEntry } from '../../../types';
import { SettlementWidget } from '../../shared/SettlementWidget';
import { PointerGlowCard } from '../../ui/PointerGlowCard';

interface FinancialsTabProps {
  financialLedgers: FinancialLedgerEntry[];
  financialSearch: string;
  setFinancialSearch: (s: string) => void;
  activePod: any;
  activeEntity: any;
}

export const FinancialsTab: React.FC<FinancialsTabProps> = React.memo(({
  financialLedgers,
  financialSearch,
  setFinancialSearch,
  activePod,
  activeEntity
}) => {
  const apptFees = financialLedgers.filter(e => e.transactionType === 'appointment_fee').reduce((acc, e) => acc + e.grossAmount, 0);
  const pharmacyComm = financialLedgers.filter(e => e.transactionType === 'medicine_commission').reduce((acc, e) => acc + e.netPayout, 0);
  const labComm = financialLedgers.filter(e => e.transactionType === 'lab_commission').reduce((acc, e) => acc + e.netPayout, 0);
  const totalEarnings = apptFees + pharmacyComm + labComm;

  const filteredLedgers = financialLedgers.filter(entry => 
    entry.invoiceId.toLowerCase().includes(financialSearch.toLowerCase()) ||
    entry.transactionType.toLowerCase().includes(financialSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 text-slate-800 animate-fade-in text-left">
      {/* Revenue splits grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <PointerGlowCard containerClassName="shadow-sm rounded-2xl" className="p-6 bg-white dark:bg-slate-950/60 border border-slate-200/85 dark:border-white/5 text-left">
          <div className="text-[10px] text-slate-400 dark:text-zinc-400 uppercase tracking-widest font-bold">Total Earnings</div>
          <div className="text-2xl font-bold mt-2 text-slate-900 dark:text-white">₹{totalEarnings.toLocaleString()}</div>
          <p className="text-[10px] text-slate-500 dark:text-zinc-450 mt-1">Consolidated Clinic + Referral Fees</p>
        </PointerGlowCard>
        {[
          { label: "Clinic Fees", val: `₹${apptFees.toLocaleString()}`, split: "100% Payout", icon: "clinical_notes", color: "text-blue-600 dark:text-blue-400" },
          { label: "Pharmacy Commission", val: `₹${pharmacyComm.toLocaleString()}`, split: "10% Referral Fee", icon: "pill", color: "text-teal-600 dark:text-teal-400" },
          { label: "Pathology Lab Splits", val: `₹${labComm.toLocaleString()}`, split: "15% Referral Fee", icon: "biotech", color: "text-amber-600 dark:text-amber-400" }
        ].map((item, i) => (
          <PointerGlowCard key={i} containerClassName="shadow-sm rounded-2xl" className="p-6 bg-white dark:bg-slate-950/60 border border-slate-200/85 dark:border-white/5 text-left">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 dark:text-zinc-400 uppercase tracking-widest font-bold">{item.label}</span>
              <span className={`material-symbols-outlined text-lg ${item.color}`}>{item.icon}</span>
            </div>
            <div className="text-xl font-bold mt-2 text-slate-850 dark:text-white">{item.val}</div>
            <p className="text-[10px] text-slate-500 dark:text-zinc-450 mt-1">{item.split}</p>
          </PointerGlowCard>
        ))}
      </div>

      {/* Side-by-side splits & projection dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* SVG Revenue projections chart */}
        <div className="lg:col-span-7 glass-panel p-6 bg-white border-slate-200/80 shadow-sm rounded-2xl space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Ecosystem Revenue Projection (Patna Pod)</h2>
              <p className="text-[10px] text-slate-600 mt-0.5">Simulated 6-Month Trajectory Trends</p>
            </div>
            <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider font-mono">
              <span className="flex items-center gap-1.5 text-blue-600">
                <span className="w-2 h-2 rounded bg-blue-600" /> Clinic
              </span>
              <span className="flex items-center gap-1.5 text-teal-600">
                <span className="w-2 h-2 rounded bg-teal-600" /> Pharmacy
              </span>
              <span className="flex items-center gap-1.5 text-amber-600">
                <span className="w-2 h-2 rounded bg-amber-600" /> Pathology Lab
              </span>
            </div>
          </div>

          <div className="h-44 relative border-l border-b border-slate-200 p-2">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none">
              <line x1="0" y1="10" x2="100" y2="10" stroke="#f1f5f9" strokeWidth="0.5" />
              <line x1="0" y1="20" x2="100" y2="20" stroke="#f1f5f9" strokeWidth="0.5" />
              <line x1="0" y1="30" x2="100" y2="30" stroke="#f1f5f9" strokeWidth="0.5" />

              <path d="M 5,28 L 25,24 L 45,22 L 65,18 L 85,14 L 95,10" fill="none" stroke="#0f62fe" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M 5,35 L 25,32 L 45,30 L 65,26 L 85,22 L 95,19" fill="none" stroke="#007d70" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M 5,38 L 25,37 L 45,35 L 65,33 L 85,29 L 95,26" fill="none" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />

              <text x="5" y="39" className="text-[5px] fill-slate-400 font-mono font-bold" textAnchor="middle">Jan</text>
              <text x="25" y="39" className="text-[5px] fill-slate-400 font-mono font-bold" textAnchor="middle">Feb</text>
              <text x="45" y="39" className="text-[5px] fill-slate-400 font-mono font-bold" textAnchor="middle">Mar</text>
              <text x="65" y="39" className="text-[5px] fill-slate-400 font-mono font-bold" textAnchor="middle">Apr</text>
              <text x="85" y="39" className="text-[5px] fill-slate-400 font-mono font-bold" textAnchor="middle">May</text>
              <text x="95" y="39" className="text-[5px] fill-slate-400 font-mono font-bold" textAnchor="middle">Jun</text>
            </svg>
          </div>
        </div>

        {/* Interactive SVG Payout Split Node Diagram */}
        <div className="lg:col-span-5 glass-panel p-6 bg-white border-slate-200/80 shadow-sm rounded-2xl flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800 text-left">Interactive UPI Payout Nodes</h2>
            <p className="text-[10px] text-slate-600 mt-0.5 text-left">Real-Time Split Flows & Referral Cuts</p>
          </div>
          
          <div className="flex-1 flex items-center justify-center p-1 bg-slate-50/50 rounded-xl border border-slate-100">
            <svg className="w-full h-auto overflow-visible" viewBox="0 0 400 250">
              {/* Connecting Curves */}
              <path d="M 60,125 C 160,125 160,40 260,40" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
              <path d="M 60,125 C 160,125 160,95 260,95" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
              <path d="M 60,125 C 160,125 160,150 260,150" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
              <path d="M 60,125 C 160,125 160,205 260,205" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />

              {/* Flowing Cash Streams (Animated Lines) */}
              <path d="M 60,125 C 160,125 160,40 260,40" fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="6,6" className="animate-dash-flow" />
              <path d="M 60,125 C 160,125 160,95 260,95" fill="none" stroke="#0d9488" strokeWidth="2" strokeDasharray="6,6" className="animate-dash-flow" />
              <path d="M 60,125 C 160,125 160,150 260,150" fill="none" stroke="#d97706" strokeWidth="2" strokeDasharray="6,6" className="animate-dash-flow" />
              <path d="M 60,125 C 160,125 160,205 260,205" fill="none" stroke="#4f46e5" strokeWidth="2" strokeDasharray="6,6" className="animate-dash-flow" />

              {/* Central UPI Payment Node */}
              <g className="animate-pulse">
                <circle cx="60" cy="125" r="22" fill="#ecfdf5" stroke="#10b981" strokeWidth="3" />
                <text x="60" y="122" textAnchor="middle" className="text-[7px] font-extrabold fill-slate-800 font-sans" stroke="none">UPI</text>
                <text x="60" y="132" textAnchor="middle" className="text-[6px] font-mono fill-emerald-600 font-bold" stroke="none">100%</text>
              </g>

              {/* Recipient Nodes & Labels */}
              {/* Doctor Node */}
              <g>
                <circle cx="260" cy="40" r="16" fill="#eff6ff" stroke="#2563eb" strokeWidth="2.5" />
                <text x="260" y="44" textAnchor="middle" className="text-[9px] font-extrabold fill-blue-600 font-sans" stroke="none">DR</text>
                <text x="284" y="38" className="text-[9px] font-extrabold fill-slate-700 font-sans" stroke="none">Clinic split</text>
                <text x="284" y="48" className="text-[8px] font-mono fill-blue-600 font-bold" stroke="none">₹{apptFees.toLocaleString()} (100%)</text>
              </g>

              {/* Pharmacy Node */}
              <g>
                <circle cx="260" cy="95" r="16" fill="#e6f6f4" stroke="#0d9488" strokeWidth="2.5" />
                <text x="260" y="99" textAnchor="middle" className="text-[9px] font-extrabold fill-teal-600 font-sans" stroke="none">RX</text>
                <text x="284" y="93" className="text-[9px] font-extrabold fill-slate-700 font-sans" stroke="none">Pharmacy</text>
                <text x="284" y="103" className="text-[8px] font-mono fill-teal-600 font-bold" stroke="none">₹{pharmacyComm.toLocaleString()} (10%)</text>
              </g>

              {/* Lab Node */}
              <g>
                <circle cx="260" cy="150" r="16" fill="#fffbeb" stroke="#d97706" strokeWidth="2.5" />
                <text x="260" y="154" textAnchor="middle" className="text-[8px] font-extrabold fill-amber-600 font-sans" stroke="none">LAB</text>
                <text x="284" y="148" className="text-[9px] font-extrabold fill-slate-700 font-sans" stroke="none">Pathology</text>
                <text x="284" y="158" className="text-[8px] font-mono fill-amber-600 font-bold" stroke="none">₹{labComm.toLocaleString()} (15%)</text>
              </g>

              {/* Platform Cut Node */}
              <g>
                <circle cx="260" cy="205" r="16" fill="#eef2ff" stroke="#4f46e5" strokeWidth="2.5" />
                <text x="260" y="209" textAnchor="middle" className="text-[9px] font-extrabold fill-indigo-600 font-sans" stroke="none">MF</text>
                <text x="284" y="203" className="text-[9px] font-extrabold fill-slate-700 font-sans" stroke="none">Platform Fee</text>
                <text x="284" y="213" className="text-[8px] font-mono fill-indigo-600 font-bold" stroke="none">₹{(financialLedgers.filter(e => e.transactionType === 'platform_fee').reduce((acc, e) => acc + e.netPayout, 0)).toLocaleString()} (INR 9)</text>
              </g>
            </svg>
          </div>
        </div>
      </div>

      {/* Financial ledger logs table */}
      <div className="glass-panel p-6 bg-white border-slate-200/80 shadow-sm rounded-2xl space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-sm font-bold text-slate-800">Sales Mappings & Transaction Ledger</h2>
          <div className="relative w-full md:w-72">
            <input
              type="text"
              placeholder="Search ledger by Invoice ID..."
              value={financialSearch}
              onChange={e => setFinancialSearch(e.target.value)}
              className="w-full input-field py-1.5 pl-9 text-xs"
            />
            <span className="material-symbols-outlined text-slate-600 absolute left-3 top-2 text-sm">search</span>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-wider text-[9px]">
              <tr>
                <th className="p-3.5">Transaction ID</th>
                <th className="p-3.5">Invoice ID</th>
                <th className="p-3.5">Type</th>
                <th className="p-3.5 text-right">Gross Amount</th>
                <th className="p-3.5 text-center">Comm. Rate</th>
                <th className="p-3.5 text-right">Net Commission</th>
                <th className="p-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredLedgers.length > 0 ? filteredLedgers.map(entry => (
                <tr key={entry.id} className="hover:bg-slate-55/50 transition-colors">
                  <td className="p-3.5 font-mono text-slate-600 text-[10px] font-bold">{entry.id}</td>
                  <td className="p-3.5 font-mono text-slate-600 text-[9px]">{entry.invoiceId}</td>
                  <td className="p-3.5">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider font-mono ${
                      entry.transactionType === 'appointment_fee'
                        ? 'bg-blue-50 text-blue-700'
                        : entry.transactionType === 'medicine_commission'
                        ? 'bg-teal-50 text-teal-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {entry.transactionType.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3.5 text-right font-mono text-slate-600">₹{entry.grossAmount.toFixed(2)}</td>
                  <td className="p-3.5 text-center font-mono text-slate-600">{(entry.commissionRate * 100).toFixed(0)}%</td>
                  <td className="p-3.5 text-right font-mono text-slate-800 font-bold">₹{entry.netPayout.toFixed(2)}</td>
                  <td className="p-3.5 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-bold bg-emerald-100 text-emerald-700 uppercase tracking-wider font-mono">
                      {entry.paymentStatus}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-600 text-xs italic">
                    No matching financial transaction ledgers recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SaaS Settlement Configuration Panel using Shared SettlementWidget */}
      {activeEntity?.id && activePod?.id && (
        <SettlementWidget
          entityId={activeEntity.id}
          podId={activePod.id}
          entityType="clinic"
          displayName="Clinic Payouts Setup"
          theme="light"
        />
      )}
    </div>
  );
});
