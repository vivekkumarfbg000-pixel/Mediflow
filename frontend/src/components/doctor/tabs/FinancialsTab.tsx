import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Landmark, FileText, Pill, FlaskConical, Activity, Search, ShieldCheck, Sparkles, Check } from 'lucide-react';
import type { FinancialLedgerEntry } from '../../../types';
import { SettlementWidget } from '../../shared/SettlementWidget';
import { PointerGlowCard } from '../../ui/PointerGlowCard';
import { BillingService } from '../../../services/billingService';
import { RealtimeSyncService } from '../../../services/realtimeSyncService';
import { supabase } from '../../../lib/supabaseClient';
import { SaaSSubscriptionService, type SaaSSubscription, type PodUsageQuota } from '../../../services/saasSubscriptionService';

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
  const [syncVersion, setSyncVersion] = useState(0);

  useEffect(() => {
    const unsub = RealtimeSyncService.subscribeToLiveClinicUpdates({
      onFinancialLedgerChange: () => setSyncVersion(v => v + 1),
      onUnifiedInvoiceChange: () => setSyncVersion(v => v + 1),
      onPatientChange: () => setSyncVersion(v => v + 1),
      onPoolSettlementChange: () => setSyncVersion(v => v + 1),
      onClinicSopChange: () => setSyncVersion(v => v + 1),
    });
    const handleLocalStateChange = () => setSyncVersion(v => v + 1);
    window.addEventListener('mediflow-state-change', handleLocalStateChange);
    window.addEventListener('mediflow-financial-update', handleLocalStateChange);
    return () => {
      unsub();
      window.removeEventListener('mediflow-state-change', handleLocalStateChange);
      window.removeEventListener('mediflow-financial-update', handleLocalStateChange);
    };
  }, []);

  // Compute SOP-Driven Commission Pool & Multi-Party Split
  const poolStats = useMemo(() => {
    return BillingService.calculateCommissionPoolBalance();
  }, [financialLedgers, syncVersion]);

  // Phase 23: Precision doctor settlement summary engine
  const doctorId = activePod?.doctor_id || activePod?.doctorId || '';
  const settlementSummary = useMemo(() => {
    return BillingService.calculateDoctorSettlementSummary(doctorId, timeframe);
  }, [doctorId, timeframe, financialLedgers, syncVersion]);

  const apptFees = settlementSummary.grossOpdConsults > 0 ? settlementSummary.netOpdConsults : poolStats.doctorConsultsEarned;
  const pharmacyComm = settlementSummary.pharmacyReferralEarnings > 0 ? settlementSummary.pharmacyReferralEarnings : poolStats.doctorMedicineReferralsEarned;
  const labComm = settlementSummary.labReferralEarnings > 0 ? settlementSummary.labReferralEarnings : poolStats.doctorLabReferralsEarned;
  const totalEarnings = settlementSummary.totalNetEarnings > 0 ? settlementSummary.totalNetEarnings : poolStats.totalDoctorEarned;

  // Dynamic timeframe data generation with async chunking (Rule 1.4)
  const [chartData, setChartData] = useState<{ label: string; clinic: number; pharmacy: number; lab: number }[]>([]);

  useEffect(() => {
    let active = true;
    
    const computeData = async () => {
      const now = new Date();
      const result: { label: string; clinic: number; pharmacy: number; lab: number }[] = [];

      // Async yield if records > 50
      const chunkYield = async () => {
        if (financialLedgers.length > 50) {
          await new Promise(r => setTimeout(r, 0));
        }
      };

      if (timeframe === '7d') {
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let i = 6; i >= 0; i--) {
          if (!active) return;
          await chunkYield();
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
          const dayLabel = daysOfWeek[d.getDay()];
          
          const dayLedgers = financialLedgers.filter(entry => {
            if (!entry.createdAt) return false;
            const entryDate = new Date(entry.createdAt);
            return entryDate.getFullYear() === d.getFullYear() &&
                   entryDate.getMonth() === d.getMonth() &&
                   entryDate.getDate() === d.getDate();
          });

          const clinic = dayLedgers.filter(e => (e.transactionType || (e as any).transaction_type) === 'appointment_fee' || ((e.transactionType || (e as any).transaction_type) as any) === 'doctor_consultation_fee').reduce((acc, e) => acc + Number(e.grossAmount ?? (e as any).gross_amount ?? (e as any).amount ?? 0), 0);
          const pharmacy = dayLedgers.filter(e => (e.transactionType || (e as any).transaction_type) === 'medicine_commission').reduce((acc, e) => acc + Number(e.netPayout ?? (e as any).net_payout ?? 0), 0);
          const lab = dayLedgers.filter(e => (e.transactionType || (e as any).transaction_type) === 'lab_commission').reduce((acc, e) => acc + Number(e.netPayout ?? (e as any).net_payout ?? 0), 0);

          result.push({ label: dayLabel, clinic, pharmacy, lab });
        }
      } else if (timeframe === '30d') {
        for (let i = 5; i >= 0; i--) {
          if (!active) return;
          await chunkYield();
          const endDayOffset = i * 5;
          const startDayOffset = endDayOffset + 4;
          
          const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - startDayOffset);
          const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - endDayOffset);
          
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(23, 59, 59, 999);

          const bucketLedgers = financialLedgers.filter(entry => {
            if (!entry.createdAt) return false;
            const entryDate = new Date(entry.createdAt);
            return entryDate >= startDate && entryDate <= endDate;
          });

          const clinic = bucketLedgers.filter(e => (e.transactionType || (e as any).transaction_type) === 'appointment_fee' || ((e.transactionType || (e as any).transaction_type) as any) === 'doctor_consultation_fee').reduce((acc, e) => acc + Number(e.grossAmount ?? (e as any).gross_amount ?? (e as any).amount ?? 0), 0);
          const pharmacy = bucketLedgers.filter(e => (e.transactionType || (e as any).transaction_type) === 'medicine_commission').reduce((acc, e) => acc + Number(e.netPayout ?? (e as any).net_payout ?? 0), 0);
          const lab = bucketLedgers.filter(e => (e.transactionType || (e as any).transaction_type) === 'lab_commission').reduce((acc, e) => acc + Number(e.netPayout ?? (e as any).net_payout ?? 0), 0);

          const label = endDayOffset === 0 ? 'Today' : `D-${endDayOffset}`;
          result.push({ label, clinic, pharmacy, lab });
        }
      } else if (timeframe === '6m') {
        for (let i = 5; i >= 0; i--) {
          if (!active) return;
          await chunkYield();
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthLabel = d.toLocaleString('en-US', { month: 'short' });
          
          const monthLedgers = financialLedgers.filter(entry => {
            if (!entry.createdAt) return false;
            const entryDate = new Date(entry.createdAt);
            return entryDate.getFullYear() === d.getFullYear() &&
                   entryDate.getMonth() === d.getMonth();
          });

          const clinic = monthLedgers.filter(e => (e.transactionType || (e as any).transaction_type) === 'appointment_fee' || ((e.transactionType || (e as any).transaction_type) as any) === 'doctor_consultation_fee').reduce((acc, e) => acc + Number(e.grossAmount ?? (e as any).gross_amount ?? (e as any).amount ?? 0), 0);
          const pharmacy = monthLedgers.filter(e => (e.transactionType || (e as any).transaction_type) === 'medicine_commission').reduce((acc, e) => acc + Number(e.netPayout ?? (e as any).net_payout ?? 0), 0);
          const lab = monthLedgers.filter(e => (e.transactionType || (e as any).transaction_type) === 'lab_commission').reduce((acc, e) => acc + Number(e.netPayout ?? (e as any).net_payout ?? 0), 0);

          result.push({ label: monthLabel, clinic, pharmacy, lab });
        }
      } else if (timeframe === '12m') {
        for (let i = 11; i >= 0; i--) {
          if (!active) return;
          await chunkYield();
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthLabel = d.toLocaleString('en-US', { month: 'short' });
          
          const monthLedgers = financialLedgers.filter(entry => {
            if (!entry.createdAt) return false;
            const entryDate = new Date(entry.createdAt);
            return entryDate.getFullYear() === d.getFullYear() &&
                   entryDate.getMonth() === d.getMonth();
          });

          const clinic = monthLedgers.filter(e => (e.transactionType || (e as any).transaction_type) === 'appointment_fee' || ((e.transactionType || (e as any).transaction_type) as any) === 'doctor_consultation_fee').reduce((acc, e) => acc + Number(e.grossAmount ?? (e as any).gross_amount ?? (e as any).amount ?? 0), 0);
          const pharmacy = monthLedgers.filter(e => (e.transactionType || (e as any).transaction_type) === 'medicine_commission').reduce((acc, e) => acc + Number(e.netPayout ?? (e as any).net_payout ?? 0), 0);
          const lab = monthLedgers.filter(e => (e.transactionType || (e as any).transaction_type) === 'lab_commission').reduce((acc, e) => acc + Number(e.netPayout ?? (e as any).net_payout ?? 0), 0);

          result.push({ label: monthLabel, clinic, pharmacy, lab });
        }
      }

      if (active) {
        setChartData(result);
      }
    };
    
    computeData();
    return () => { active = false; };
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

  // SaaS Software Subscription & Quota State (Phase 25)
  const [saasSub, setSaasSub] = useState<SaaSSubscription>(() => SaaSSubscriptionService.getCachedSubscription(activePod?.id));
  const [saasQuota, setSaasQuota] = useState<PodUsageQuota>(() => SaaSSubscriptionService.getCachedQuota(activePod?.id));

  useEffect(() => {
    SaaSSubscriptionService.fetchLiveStatus(activePod?.id).then(({ subscription, quota }) => {
      setSaasSub(subscription);
      setSaasQuota(quota);
    });

    const handleSubUpdate = (e: any) => {
      if (e.detail?.subscription) setSaasSub(e.detail.subscription);
      if (e.detail?.quota) setSaasQuota(e.detail.quota);
    };
    window.addEventListener('mediflow-subscription-update', handleSubUpdate);
    return () => window.removeEventListener('mediflow-subscription-update', handleSubUpdate);
  }, [activePod?.id]);

  const activeSop = BillingService.getActiveSop();
  const docLabSplit = activeSop?.extractedConfig?.splits?.doctor ?? 40;
  const docMedSplit = (activeSop?.extractedConfig?.splits as any)?.pharmacyDoctor ?? 20;

  const invoices = useMemo(() => BillingService.getUnifiedInvoices(), [financialLedgers, syncVersion]);
  const patients = useMemo(() => BillingService.getPatients(), [financialLedgers, syncVersion]);
  const appointments = useMemo(() => BillingService.getAppointments(), [financialLedgers, syncVersion]);

  const getPatientName = useCallback((entry: FinancialLedgerEntry) => {
    if (entry.patientName) return entry.patientName;
    const inv = invoices.find(i => i.id === entry.invoiceId || i.encounterId === entry.invoiceId);
    const appt = appointments.find(a => a.id === entry.invoiceId || (inv && a.id === inv.encounterId));
    const patientId = inv?.patientId || appt?.patientId;
    if (patientId) {
      const p = patients.find((patient: any) => patient.id === patientId);
      if (p && p.name) return p.name;
    }
    if ((inv as any)?.patientName) return (inv as any).patientName;
    if ((appt as any)?.patient_name) return (appt as any).patient_name;
    return `Patient #${(entry.invoiceId || 'N/A').substring(0, 6).toUpperCase()}`;
  }, [invoices, appointments, patients]);

  const getPaymentModeLabel = useCallback((entry: FinancialLedgerEntry) => {
    const mode = entry.paymentMethod || (invoices.find(i => i.id === entry.invoiceId)?.paymentMethod);
    if (mode === 'cash') return 'Cash Counter 💵';
    if (mode === 'whatsapp_pay') return 'WhatsApp UPI 💬';
    if (mode === 'card') return 'Card POS 💳';
    const inv = invoices.find(i => i.id === entry.invoiceId || i.encounterId === entry.invoiceId);
    const appt = appointments.find(a => a.id === entry.invoiceId || (inv && a.id === inv.encounterId));
    if (inv?.paymentMethod === 'cash' || (appt as any)?.payment_method === 'cash') {
      return 'Cash Counter 💵';
    }
    if (String((inv as any)?.source || '').toLowerCase().includes('whatsapp') ||
        String(appt?.source || '').toLowerCase().includes('whatsapp') ||
        (appt as any)?.is_virtual) {
      return 'WhatsApp UPI 💬';
    }
    return 'UPI / QR Code 📱';
  }, [invoices, appointments]);

  const getPaymentModeBadge = useCallback((entry: FinancialLedgerEntry) => {
    const label = getPaymentModeLabel(entry);
    if (label.includes('Cash Counter')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
          💵 Cash
        </span>
      );
    }
    if (label.includes('WhatsApp UPI')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-50 text-green-700 border border-green-200">
          💬 WhatsApp UPI
        </span>
      );
    }
    if (label.includes('Card POS')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-violet-50 text-violet-700 border border-violet-200">
          💳 Card POS
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
        📱 UPI / QR
      </span>
    );
  }, [getPaymentModeLabel]);

  const filteredLedgers = useMemo(() => {
    const activeLedgers = (financialLedgers && financialLedgers.length > 0) ? financialLedgers : BillingService.getFinancialLedgers();

    return activeLedgers
      .filter(entry => {
        const pName = String(getPatientName(entry) || '').toLowerCase();
        const pMode = String(getPaymentModeLabel(entry) || '').toLowerCase();
        const query = (financialSearch || '').trim().toLowerCase();
        return (
          pName.includes(query) ||
          pMode.includes(query) ||
          String(entry.invoiceId || '').toLowerCase().includes(query) ||
          String(entry.transactionType || '').toLowerCase().includes(query)
        );
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [financialLedgers, financialSearch, syncVersion, getPatientName, getPaymentModeLabel]);

  const exportFinancialLedgersPDF = useCallback(() => {
    const printWin = window.open('', '_blank');
    if (!printWin) return;

    const rowsHtml = filteredLedgers.map(entry => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${getPatientName(entry)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace; color: #475569;">${getPaymentModeLabel(entry)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; text-transform: uppercase; font-size: 11px;">${(entry.transactionType || 'fee').replace('_', ' ')}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace;">₹${(entry.grossAmount || 0).toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-family: monospace;">${((entry.commissionRate || 0) * 100).toFixed(0)}%</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; font-family: monospace; color: #0f172a;">₹${(entry.netPayout || 0).toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: #059669; text-transform: uppercase; font-size: 10px;">${entry.paymentStatus}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Financial Sales Ledger & Payout Statement</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #1e293b; background: #ffffff; }
          .header { border-bottom: 2px solid #4f46e5; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          .title { font-size: 22px; font-weight: 800; color: #1e1b4b; margin: 0; }
          .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
          .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0; }
          .meta-box { font-size: 11px; }
          .meta-label { color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; }
          .meta-val { font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px; font-family: monospace; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
          th { background: #f1f5f9; padding: 10px; text-align: left; font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #cbd5e1; }
          .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 10px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">VitalSync Connected Care Network</h1>
            <div class="subtitle">${activePod?.name || activePod?.doctor_name || 'VitalSync Care Clinic'} — Official Sales Mapping & Financial Payout Ledger</div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #64748b;">
            <div><strong>Clinic Code:</strong> ${activePod?.clinicCode ? activePod.clinicCode : 'Unassigned'}</div>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-box">
            <div class="meta-label">Total Doctor Net Earnings</div>
            <div class="meta-val">₹${totalEarnings.toLocaleString()}</div>
          </div>
          <div class="meta-box">
            <div class="meta-label">OPD Consult Fees</div>
            <div class="meta-val">₹${apptFees.toLocaleString()}</div>
          </div>
          <div class="meta-box">
            <div class="meta-label">Direct Clinic Net Retained</div>
            <div class="meta-val">₹${totalEarnings.toLocaleString()}</div>
          </div>
          <div class="meta-box">
            <div class="meta-label">Total Transactions Recorded</div>
            <div class="meta-val">${filteredLedgers.length}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Patient Name / Customer</th>
              <th>Payment Mode / Channel</th>
              <th>Type</th>
              <th style="text-align: right;">Gross Amount</th>
              <th style="text-align: center;">Comm. Rate</th>
              <th style="text-align: right;">Net Payout</th>
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer">
          VitalSync 360° Real-Time Financial Statement • Generated electronically for ${(() => {
            try {
              const rawProf = localStorage.getItem('vitalsync_cached_profile');
              const p = rawProf ? JSON.parse(rawProf) : {};
              return p.display_name || 'Chief Clinical Consultant';
            } catch (_e) { return 'Chief Clinical Consultant'; }
          })()} • Verified via Supabase Postgres CDC
        </div>
      </body>
      </html>
    `;

    printWin.document.write(htmlContent);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 400);
  }, [filteredLedgers, getPatientName, getPaymentModeLabel, totalEarnings, apptFees, poolStats, activePod]);

  return (
    <div className="space-y-6 text-slate-800 animate-fade-in text-left">
      {/* Revenue splits grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <PointerGlowCard containerClassName="shadow-sm rounded-2xl lg:col-span-2" className="p-6 bg-white dark:bg-slate-950/60 border border-slate-200/85 dark:border-white/5 text-left">
          <div className="text-[10px] text-slate-400 dark:text-zinc-400 uppercase tracking-widest font-bold">Total Doctor Net Earnings</div>
          <div className="text-2xl font-bold mt-2 text-slate-900 dark:text-white">₹{totalEarnings.toLocaleString()}</div>
          <p className="text-[10px] text-slate-500 dark:text-zinc-450 mt-1">SOP Consolidated — 100% Consults + {docLabSplit}% Lab + {docMedSplit}% Pharmacy</p>
        </PointerGlowCard>

        {[
          { label: 'Doctor Consultation Fees', val: `₹${apptFees.toLocaleString()}`, split: '100% Doctor Fee (0% Platform Deducted)', icon: <FileText className="w-5 h-5" />, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Medicine Referral Income', val: `₹${pharmacyComm.toLocaleString()}`, split: `${docMedSplit}% SOP Doctor Referral Share`, icon: <Pill className="w-5 h-5" />, color: 'text-teal-600 dark:text-teal-400' },
          { label: 'Lab Test Referral Income', val: `₹${labComm.toLocaleString()}`, split: `${docLabSplit}% SOP Doctor Referral Share`, icon: <FlaskConical className="w-5 h-5" />, color: 'text-amber-600 dark:text-amber-400' },
        ].map((item, i) => (
          <PointerGlowCard key={`fin-card-${i}-${item.label}`} containerClassName="shadow-sm rounded-2xl" className="p-6 bg-white dark:bg-slate-950/60 border border-slate-200/85 dark:border-white/5 text-left">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 dark:text-zinc-400 uppercase tracking-widest font-bold">{item.label}</span>
              <span className={`shrink-0 ${item.color}`}>{item.icon}</span>
            </div>
            <div className="text-xl font-bold mt-2 text-slate-850 dark:text-white">{item.val}</div>
            <p className="text-[10px] text-slate-500 dark:text-zinc-450 mt-1">{item.split}</p>
          </PointerGlowCard>
        ))}
      </div>

      {/* NMC Compliant 100% Direct Settlement & SaaS Software Subscription Status Card */}
      <div className="rounded-2xl border border-indigo-200/80 dark:border-indigo-500/20 bg-white dark:bg-slate-950/80 p-6 space-y-4 shadow-sm text-slate-800 dark:text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 p-2.5 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                100% Direct Clinic Settlement &amp; SaaS License
                <span className="text-[9px] bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-mono px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20 font-bold uppercase">
                  {saasSub.tierName}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Strictly NMC Ethics Code 6.4 Compliant: 100% of patient consultation, pharmacy, and diagnostic fees settle directly to your clinic with 0% platform deductions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-right">
            <div>
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono font-bold">Monthly Software License</div>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                ₹{saasSub.monthlyFeeInr}/mo
              </div>
            </div>

            <button
              onClick={() => {
                const nextTier = saasSub.tier === 'tier_2_unlimited_pro' ? 'tier_1_growth' : 'tier_2_unlimited_pro';
                SaaSSubscriptionService.upgradeTier(nextTier, activePod?.id);
              }}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-teal-600 hover:from-indigo-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-500/20 border-0 cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {saasSub.tier === 'tier_2_unlimited_pro' ? 'Current Plan: Unlimited Pro' : 'Upgrade to Unlimited Pro (₹1,999/mo)'}
            </button>
          </div>
        </div>

        {/* Real-time Usage Quota Gauges */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-200/80 dark:border-white/10 text-xs">
          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-white/5 border border-slate-200/70 dark:border-white/5">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-semibold uppercase block">AI Vision OCR Scans</span>
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 font-mono">
              {saasQuota.aiScansUsed} / {saasQuota.aiScansLimit < 0 ? 'Unlimited' : saasQuota.aiScansLimit}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-white/5 border border-slate-200/70 dark:border-white/5">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-semibold uppercase block">WhatsApp Care Loop Msgs</span>
            <span className="text-sm font-bold text-teal-600 dark:text-teal-400 font-mono">
              {saasQuota.whatsappMessagesUsed} / {saasQuota.whatsappMessagesLimit < 0 ? 'Unlimited' : saasQuota.whatsappMessagesLimit}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-white/5 border border-slate-200/70 dark:border-white/5">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-semibold uppercase block">Platform Transaction Cut</span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">0.00% (Strictly ₹0)</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-white/5 border border-slate-200/70 dark:border-white/5">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-semibold uppercase block">Pilot Expiry / Renewal</span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 font-mono">
              {saasSub.pilotEndDate ? new Date(saasSub.pilotEndDate).toLocaleDateString() : 'Active'}
            </span>
          </div>
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
                <Activity className="w-8 h-8 text-slate-300 mb-1.5" />
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
                <g key={`pt-group-${index}-${d.label}`}>
                  {d.clinic > 0 && <circle cx={xCoords[index]} cy={getY(d.clinic)} r="0.8" fill="#0f62fe" />}
                  {d.pharmacy > 0 && <circle cx={xCoords[index]} cy={getY(d.pharmacy)} r="0.8" fill="#007d70" />}
                  {d.lab > 0 && <circle cx={xCoords[index]} cy={getY(d.lab)} r="0.8" fill="#d97706" />}
                </g>
              ))}

              {/* Dynamic Labels */}
              {chartData.map((d, index) => (
                <text
                  key={`label-${index}-${d.label}`}
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
                <text x="284" y="103" className="text-[8px] font-mono fill-teal-600 font-bold" stroke="none">₹{pharmacyComm.toLocaleString()} ({docMedSplit}%)</text>
              </g>

              {/* Lab Node */}
              <g>
                <circle cx="260" cy="150" r="16" fill="#fffbeb" stroke="#d97706" strokeWidth="2.5" />
                <text x="260" y="154" textAnchor="middle" className="text-[8px] font-extrabold fill-amber-600 font-sans" stroke="none">LAB</text>
                <text x="284" y="148" className="text-[9px] font-extrabold fill-slate-700 font-sans" stroke="none">Pathology</text>
                <text x="284" y="158" className="text-[8px] font-mono fill-amber-600 font-bold" stroke="none">₹{labComm.toLocaleString()} ({docLabSplit}%)</text>
              </g>

              {/* Platform Cut Node */}
              <g>
                <circle cx="260" cy="205" r="16" fill="#eef2ff" stroke="#4f46e5" strokeWidth="2.5" />
                <text x="260" y="209" textAnchor="middle" className="text-[9px] font-extrabold fill-indigo-600 font-sans" stroke="none">MF</text>
                <text x="284" y="203" className="text-[9px] font-extrabold fill-slate-700 font-sans" stroke="none">Platform Fee</text>
                <text x="284" y="213" className="text-[8px] font-mono fill-emerald-600 font-bold" stroke="none">₹0 (0% Pure SaaS)</text>
              </g>
            </svg>
          </div>
        </div>
      </div>

      {/* Financial ledger logs table */}
      <div className="glass-panel p-6 bg-white border-slate-200/80 shadow-sm rounded-2xl space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Sales Mappings &amp; Transaction Ledger</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">Sorted Newest First • Real-Time Postgres CDC Stream</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button
              onClick={exportFinancialLedgersPDF}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold text-xs rounded-xl border border-indigo-200 dark:border-indigo-500/30 transition-all cursor-pointer shadow-xs"
            >
              <FileText className="w-4 h-4 text-indigo-700 dark:text-indigo-300" />
              Download PDF Statement 📄
            </button>

            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by Patient Name, Payment Mode..."
                value={financialSearch}
                onChange={e => setFinancialSearch(e.target.value)}
                className="w-full input-field py-1.5 pl-9 text-xs"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-wider text-[9px]">
              <tr>
                <th className="p-3.5">Patient Name / Customer</th>
                <th className="p-3.5">Payment Mode / Channel</th>
                <th className="p-3.5">Type</th>
                <th className="p-3.5 text-right">Gross Amount</th>
                <th className="p-3.5 text-center">Rate</th>
                <th className="p-3.5 text-right">Net Payout</th>
                <th className="p-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredLedgers.length > 0 ? filteredLedgers.map(entry => (
                <tr key={entry.id} className="hover:bg-slate-55/50 transition-colors">
                  <td className="p-3.5 font-sans font-bold text-slate-900 text-xs">{getPatientName(entry)}</td>
                  <td className="p-3.5">{getPaymentModeBadge(entry)}</td>
                  <td className="p-3.5">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider font-mono ${
                      entry.transactionType === 'appointment_fee'
                        ? 'bg-blue-50 text-blue-700'
                        : entry.transactionType === 'medicine_commission'
                        ? 'bg-teal-50 text-teal-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {(entry.transactionType || 'fee').replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3.5 text-right font-mono text-slate-600">₹{(entry.grossAmount || 0).toFixed(2)}</td>
                  <td className="p-3.5 text-center font-mono text-slate-600">{((entry.commissionRate || 0) * 100).toFixed(0)}%</td>
                  <td className="p-3.5 text-right font-mono text-slate-800 font-bold">₹{(entry.netPayout || 0).toFixed(2)}</td>
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
