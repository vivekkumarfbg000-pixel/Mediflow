import React, { useEffect, useState, useMemo, useCallback } from 'react';
import type { FinancialLedgerEntry } from '../../../types';
import { SettlementWidget } from '../../shared/SettlementWidget';
import { PointerGlowCard } from '../../ui/PointerGlowCard';

interface FinancialsTabProps {
  financialLedgers: FinancialLedgerEntry[];
  financialSearch: string;
  setFinancialSearch: (s: string) => void;
  activePod: any;
  activeEntity: any;
  supabaseClient?: any; // optional — for pool balance fetching
}

export const FinancialsTab: React.FC<FinancialsTabProps> = React.memo(({
  financialLedgers,
  financialSearch,
  setFinancialSearch,
  activePod,
  activeEntity,
  supabaseClient,
}) => {
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '6m' | '12m'>('6m');

  const apptFees = financialLedgers.filter(e => e.transactionType === 'appointment_fee').reduce((acc, e) => acc + e.grossAmount, 0);
  const pharmacyComm = financialLedgers.filter(e => e.transactionType === 'medicine_commission').reduce((acc, e) => acc + e.netPayout, 0);
  const labComm = financialLedgers.filter(e => e.transactionType === 'lab_commission').reduce((acc, e) => acc + e.netPayout, 0);
  const totalEarnings = apptFees + pharmacyComm + labComm;

  // Dynamic timeframe data generation
  const chartData = useMemo(() => {
    const now = new Date();
    const result: { label: string; clinic: number; pharmacy: number; lab: number }[] = [];

    if (timeframe === '7d') {
      // Last 7 Days
      const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dayLabel = daysOfWeek[d.getDay()];
        
        const dayLedgers = financialLedgers.filter(entry => {
          const entryDate = new Date(entry.createdAt);
          return entryDate.getFullYear() === d.getFullYear() &&
                 entryDate.getMonth() === d.getMonth() &&
                 entryDate.getDate() === d.getDate();
        });

        const clinic = dayLedgers.filter(e => e.transactionType === 'appointment_fee').reduce((acc, e) => acc + e.grossAmount, 0);
        const pharmacy = dayLedgers.filter(e => e.transactionType === 'medicine_commission').reduce((acc, e) => acc + e.netPayout, 0);
        const lab = dayLedgers.filter(e => e.transactionType === 'lab_commission').reduce((acc, e) => acc + e.netPayout, 0);

        result.push({ label: dayLabel, clinic, pharmacy, lab });
      }
    } else if (timeframe === '30d') {
      // Last 30 Days (grouped into 6 buckets of 5 days)
      for (let i = 5; i >= 0; i--) {
        const endDayOffset = i * 5;
        const startDayOffset = endDayOffset + 4;
        
        const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - startDayOffset);
        const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - endDayOffset);
        
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        const bucketLedgers = financialLedgers.filter(entry => {
          const entryDate = new Date(entry.createdAt);
          return entryDate >= startDate && entryDate <= endDate;
        });

        const clinic = bucketLedgers.filter(e => e.transactionType === 'appointment_fee').reduce((acc, e) => acc + e.grossAmount, 0);
        const pharmacy = bucketLedgers.filter(e => e.transactionType === 'medicine_commission').reduce((acc, e) => acc + e.netPayout, 0);
        const lab = bucketLedgers.filter(e => e.transactionType === 'lab_commission').reduce((acc, e) => acc + e.netPayout, 0);

        const label = endDayOffset === 0 ? 'Today' : `D-${endDayOffset}`;
        result.push({ label, clinic, pharmacy, lab });
      }
    } else if (timeframe === '6m') {
      // Last 6 Months (default)
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthLabel = d.toLocaleString('en-US', { month: 'short' });
        
        const monthLedgers = financialLedgers.filter(entry => {
          const entryDate = new Date(entry.createdAt);
          return entryDate.getFullYear() === d.getFullYear() &&
                 entryDate.getMonth() === d.getMonth();
        });

        const clinic = monthLedgers.filter(e => e.transactionType === 'appointment_fee').reduce((acc, e) => acc + e.grossAmount, 0);
        const pharmacy = monthLedgers.filter(e => e.transactionType === 'medicine_commission').reduce((acc, e) => acc + e.netPayout, 0);
        const lab = monthLedgers.filter(e => e.transactionType === 'lab_commission').reduce((acc, e) => acc + e.netPayout, 0);

        result.push({ label: monthLabel, clinic, pharmacy, lab });
      }
    } else if (timeframe === '12m') {
      // Last 12 Months
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthLabel = d.toLocaleString('en-US', { month: 'short' });
        
        const monthLedgers = financialLedgers.filter(entry => {
          const entryDate = new Date(entry.createdAt);
          return entryDate.getFullYear() === d.getFullYear() &&
                 entryDate.getMonth() === d.getMonth();
        });

        const clinic = monthLedgers.filter(e => e.transactionType === 'appointment_fee').reduce((acc, e) => acc + e.grossAmount, 0);
        const pharmacy = monthLedgers.filter(e => e.transactionType === 'medicine_commission').reduce((acc, e) => acc + e.netPayout, 0);
        const lab = monthLedgers.filter(e => e.transactionType === 'lab_commission').reduce((acc, e) => acc + e.netPayout, 0);

        result.push({ label: monthLabel, clinic, pharmacy, lab });
      }
    }

    return result;
  }, [timeframe, financialLedgers]);

  // Determine standard grid X coordinates and Y scaling
  const pointsCount = chartData.length;
  
  const xCoords = useMemo(() => {
    if (pointsCount === 1) return [50];
    const step = 90 / (pointsCount - 1);
    return Array.from({ length: pointsCount }, (_, i) => 5 + (i * step));
  }, [pointsCount]);

  // Find max value to scale the chart dynamically
  const maxVal = useMemo(() => {
    const rawMax = Math.max(
      ...chartData.map(d => Math.max(d.clinic, d.pharmacy, d.lab)),
      0
    );
    return rawMax === 0 ? 500 : rawMax;
  }, [chartData]);

  // Scale value to Y coordinate: viewBox height is 40. Plot area Y runs from 4 (top) to 34 (bottom)
  const getY = useCallback((val: number) => {
    const fraction = val / maxVal;
    return 34 - (fraction * 30);
  }, [maxVal]);

  // Generate SVG path strings for each channel
  const clinicPath = useMemo(() => {
    return chartData.map((d, index) => {
      const prefix = index === 0 ? 'M' : 'L';
      return `${prefix} ${xCoords[index]},${getY(d.clinic)}`;
    }).join(' ');
  }, [chartData, xCoords, getY]);

  const pharmacyPath = useMemo(() => {
    return chartData.map((d, index) => {
      const prefix = index === 0 ? 'M' : 'L';
      return `${prefix} ${xCoords[index]},${getY(d.pharmacy)}`;
    }).join(' ');
  }, [chartData, xCoords, getY]);

  const labPath = useMemo(() => {
    return chartData.map((d, index) => {
      const prefix = index === 0 ? 'M' : 'L';
      return `${prefix} ${xCoords[index]},${getY(d.lab)}`;
    }).join(' ');
  }, [chartData, xCoords, getY]);

  // Commission pool balance
  const [poolBalance, setPoolBalance] = useState<number | null>(null);
  const [pendingCash, setPendingCash] = useState<number>(0);
  const [isPoolLow, setIsPoolLow] = useState(false);

  useEffect(() => {
    if (!supabaseClient || !activePod?.id) return;
    supabaseClient
      .rpc('get_pool_status', { p_pod_id: activePod.id })
      .then(({ data }: any) => {
        if (data) {
          setPoolBalance(data.pool_balance ?? 0);
          setPendingCash(data.pending_cash_balance ?? 0);
          setIsPoolLow(data.is_low ?? false);
        }
      });
  }, [activePod?.id, supabaseClient]);

  const filteredLedgers = financialLedgers.filter(entry =>
    entry.invoiceId.toLowerCase().includes(financialSearch.toLowerCase()) ||
    entry.transactionType.toLowerCase().includes(financialSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 text-slate-800 animate-fade-in text-left">
      {/* Revenue splits grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <PointerGlowCard containerClassName="shadow-sm rounded-2xl lg:col-span-2" className="p-6 bg-white dark:bg-slate-950/60 border border-slate-200/85 dark:border-white/5 text-left">
          <div className="text-[10px] text-slate-400 dark:text-zinc-400 uppercase tracking-widest font-bold">Total Earnings</div>
          <div className="text-2xl font-bold mt-2 text-slate-900 dark:text-white">₹{totalEarnings.toLocaleString()}</div>
          <p className="text-[10px] text-slate-500 dark:text-zinc-450 mt-1">Consolidated — Appointments + Pharmacy + Lab</p>
        </PointerGlowCard>

        {[
          { label: 'Appointment Fees', val: `₹${apptFees.toLocaleString()}`, split: '3% of consultation (paid by patient)', icon: 'clinical_notes', color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Pharmacy Commission', val: `₹${pharmacyComm.toLocaleString()}`, split: '3% Platform Commission', icon: 'medication', color: 'text-teal-600 dark:text-teal-400' },
          { label: 'Lab Commission', val: `₹${labComm.toLocaleString()}`, split: '3% Platform Commission', icon: 'biotech', color: 'text-amber-600 dark:text-amber-400' },
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

      {/* Commission Pool Status */}
      <div className={`rounded-2xl border p-4 flex items-center justify-between gap-4 ${
        isPoolLow
          ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700/40'
          : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700/40'
      }`}>
        <div className="flex items-center gap-3">
          <span className={`material-symbols-outlined text-2xl ${
            isPoolLow ? 'text-amber-500' : 'text-emerald-500'
          }`}>
            {isPoolLow ? 'warning' : 'savings'}
          </span>
          <div>
            <div className="text-xs font-bold text-slate-800 dark:text-white">
              Commission Pool {isPoolLow ? '— Low Balance' : '— Healthy'}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Cash commissions are deducted from this pool. Pool refills from online payments.
            </div>
          </div>
        </div>
        <div className="flex gap-6 text-right shrink-0">
          <div>
            <div className="text-[9px] text-slate-400 uppercase tracking-widest font-mono font-bold">Pool Balance</div>
            <div className={`text-lg font-bold font-mono ${
              isPoolLow ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {poolBalance !== null ? `₹${poolBalance.toLocaleString()}` : '—'}
            </div>
          </div>
          {pendingCash > 0 && (
            <div>
              <div className="text-[9px] text-slate-400 uppercase tracking-widest font-mono font-bold">Deferred</div>
              <div className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400">
                ₹{pendingCash.toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Side-by-side splits & projection dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* SVG Revenue projections chart */}
        <div className="lg:col-span-7 glass-panel p-6 bg-white border-slate-200/80 shadow-sm rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Ecosystem Revenue Trajectory ({activePod?.name || 'Local Pod'})</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Real-Time Earnings Data & Analytics</p>
            </div>
            
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-[10px] font-bold text-slate-650 outline-none focus:border-slate-350 transition-all cursor-pointer shadow-xs"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="6m">Last 6 Months</option>
                <option value="12m">Last 12 Months</option>
              </select>

              <div className="flex gap-3 text-[9px] font-bold uppercase tracking-wider font-mono">
                <span className="flex items-center gap-1 text-blue-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600" /> Clinic
                </span>
                <span className="flex items-center gap-1 text-teal-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-600" /> Pharmacy
                </span>
                <span className="flex items-center gap-1 text-amber-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600" /> Lab
                </span>
              </div>
            </div>
          </div>

          <div className="h-44 relative border-l border-b border-slate-200 p-2">
            {chartData.length === 0 || maxVal === 500 && chartData.every(d => d.clinic === 0 && d.pharmacy === 0 && d.lab === 0) ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                <span className="material-symbols-outlined text-slate-300 text-3xl mb-1.5">monitoring</span>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">No Transaction Data Yet</p>
                <p className="text-[9px] text-slate-400 max-w-[200px] mt-0.5">Earnings lines will automatically plot here once patient bills are generated.</p>
              </div>
            ) : null}

            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none">
              <line x1="0" y1="9" x2="100" y2="9" stroke="#f8fafc" strokeWidth="0.5" />
              <line x1="0" y1="19" x2="100" y2="19" stroke="#f8fafc" strokeWidth="0.5" />
              <line x1="0" y1="29" x2="100" y2="29" stroke="#f8fafc" strokeWidth="0.5" />

              {/* Dynamic Paths */}
              <path d={clinicPath} fill="none" stroke="#0f62fe" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d={pharmacyPath} fill="none" stroke="#007d70" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d={labPath} fill="none" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />

              {/* Data Points */}
              {chartData.map((d, index) => (
                <g key={index}>
                  {d.clinic > 0 && <circle cx={xCoords[index]} cy={getY(d.clinic)} r="0.8" fill="#0f62fe" />}
                  {d.pharmacy > 0 && <circle cx={xCoords[index]} cy={getY(d.pharmacy)} r="0.8" fill="#007d70" />}
                  {d.lab > 0 && <circle cx={xCoords[index]} cy={getY(d.lab)} r="0.8" fill="#d97706" />}
                </g>
              ))}

              {/* Dynamic Labels */}
              {chartData.map((d, index) => (
                <text
                  key={index}
                  x={xCoords[index]}
                  y="38"
                  className="text-[3.5px] fill-slate-400 font-mono font-bold"
                  textAnchor="middle"
                >
                  {d.label}
                </text>
              ))}
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
