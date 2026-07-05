import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import type { Patient, LabRequisition, InventoryHold, FinancialLedgerEntry, WhatsAppSession, PathologyReport } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { ProactiveHealthMonitor } from '../../services/autoHealerAgent';
import { PatientService } from '../../services/patientService';
import { WhatsAppService } from '../../services/whatsappService';
import { LabService } from '../../services/labService';
import { PharmacyService } from '../../services/pharmacyService';

/* ─────────────────────────────────────────────────────────────────────────────
   PodCommandCenter.tsx — Mediflow B2B Glassmorphic Matrix Console
   Professional clinic cockpit dashboard filled with widgets, real-time metrics,
   and core system functions easily accessible to the Doctor / Admin.
   ───────────────────────────────────────────────────────────────────────────── */

interface PodCommandCenterProps {
  onStartConsultation?: (patient: Patient) => void;
  hideHeader?: boolean;
}

export const PodCommandCenter: React.FC<PodCommandCenterProps> = ({ onStartConsultation, hideHeader }) => {
  /* ─── State Management ─────────────────────────────────────────── */
  const [patients, setPatients] = useState<Patient[]>([]);
  const [labReqs, setLabReqs] = useState<LabRequisition[]>([]);
  const [inventoryHolds, setInventoryHolds] = useState<InventoryHold[]>([]);
  const [financials, setFinancials] = useState<FinancialLedgerEntry[]>([]);
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [reagents, setReagents] = useState<any[]>([]);
  const [pharmacyInventory, setPharmacyInventory] = useState<any[]>([]);
  const [pathologyReports, setPathologyReports] = useState<PathologyReport[]>([]);

  // Lab Report Sign-off Interactive States
  const [signingReportId, setSigningReportId] = useState<string | null>(null);
  const [signingAdvice, setSigningAdvice] = useState<string>('');
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pulse, setPulse] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  /* ─── Digital Clock + Pulse ──────────────────────────── */
  useEffect(() => {
    const t = setInterval(() => {
      setCurrentTime(new Date());
      setPulse(p => !p);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  /* ─── Realtime Data Sync ───────────────────────────────────────── */
  useEffect(() => {
    const sync = () => {
      setPatients(api.getPatients());
      setLabReqs(api.getLabRequisitions());
      setInventoryHolds(api.getInventoryHolds());
      setFinancials(api.getFinancialLedgers());
      setSessions(api.getWhatsAppSessions());
      setReagents(api.getReagentStocks());
      setPharmacyInventory(api.getPharmacyInventory());
      setPathologyReports(api.getPathologyReports());
    };
    sync();
    return api.subscribe(sync);
  }, []);

  /* ─── Computed Metrics ─────────────────────────────────────────── */
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const labMetrics = useMemo(() => ({
    total: labReqs.length,
    pending: labReqs.filter(r => r.status === 'pending').length,
    processing: labReqs.filter(r => r.status === 'collected' || r.status === 'processed').length,
    completedToday: labReqs.filter(r => r.status === 'completed' && r.createdAt.startsWith(todayStr)).length,
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

  const filteredPatients = useMemo(() => {
    const parseTokenNum = (token?: string) => {
      if (!token) return Infinity;
      const match = token.match(/\d+/);
      return match ? parseInt(match[0], 10) : Infinity;
    };

    return patients
      .filter(p => {
        const isActiveQueue = p.queueStatus === 'awaiting_consultation' || p.queueStatus === 'in_consultation';
        if (!isActiveQueue && !searchQuery) return false;

        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              p.phone.includes(searchQuery) ||
                              (p.tokenNumber && p.tokenNumber.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesSearch;
      })
      .sort((a, b) => {
        const statusOrder = { 'in_consultation': 1, 'awaiting_consultation': 2 };
        const statusA = statusOrder[a.queueStatus as keyof typeof statusOrder] || 99;
        const statusB = statusOrder[b.queueStatus as keyof typeof statusOrder] || 99;
        if (statusA !== statusB) return statusA - statusB;

        const tokenA = parseTokenNum(a.tokenNumber);
        const tokenB = parseTokenNum(b.tokenNumber);
        return tokenA - tokenB;
      });
  }, [patients, searchQuery]);

  const lowStockSKUs = useMemo(() => {
    return pharmacyInventory.filter(item => item.stock <= item.threshold);
  }, [pharmacyInventory]);

  // Vitals Audit Parser for Triage
  const checkVitalsAlerts = (vitals: any) => {
    const alerts: string[] = [];
    if (!vitals) return alerts;

    if (vitals.temperature) {
      const temp = parseFloat(vitals.temperature);
      if (!isNaN(temp)) {
        if (temp > 100) alerts.push(`Fever (${temp}°F)`);
        else if (temp < 96) alerts.push(`Hypothermia (${temp}°F)`);
      }
    }
    if (vitals.bloodPressure) {
      const parts = vitals.bloodPressure.split('/');
      const systolic = parseInt(parts[0]);
      if (!isNaN(systolic)) {
        if (systolic > 140) alerts.push(`High BP (${vitals.bloodPressure})`);
        else if (systolic < 90) alerts.push(`Low BP (${vitals.bloodPressure})`);
      }
    }
    if (vitals.pulseRate) {
      const hr = parseInt(vitals.pulseRate);
      if (!isNaN(hr)) {
        if (hr > 100) alerts.push(`High HR (${hr} bpm)`);
        else if (hr < 55) alerts.push(`Low HR (${hr} bpm)`);
      }
    }
    if (vitals.bloodSugar) {
      const bs = parseInt(vitals.bloodSugar);
      if (!isNaN(bs)) {
        if (bs > 180) alerts.push(`High Sugar (${bs} mg/dL)`);
        else if (bs < 70) alerts.push(`Low Sugar (${bs} mg/dL)`);
      }
    }
    return alerts;
  };

  const criticalPatients = useMemo(() => {
    return patients.filter(p => {
      if (p.queueStatus !== 'awaiting_consultation' || !p.vitals) return false;
      return checkVitalsAlerts(p.vitals).length > 0;
    });
  }, [patients]);

  const pendingReports = useMemo(() => {
    return pathologyReports.filter((r: any) => r.status === 'pending');
  }, [pathologyReports]);

  const groupedHolds = useMemo(() => {
    const groups: { [patientId: string]: { patientName: string; medicines: { name: string; qty: number; status: string }[]; totalItems: number; status: 'dispensed' | 'held' } } = {};
    inventoryHolds.forEach(h => {
      const patient = patients.find(p => p.id === h.patientId);
      const name = patient ? patient.name : `Patient ${h.patientId.substring(0, 5)}`;
      if (!groups[h.patientId]) {
        groups[h.patientId] = {
          patientName: name,
          medicines: [],
          totalItems: 0,
          status: 'dispensed'
        };
      }
      groups[h.patientId].medicines.push({ name: h.medicineName, qty: h.quantity, status: h.holdStatus });
      groups[h.patientId].totalItems += h.quantity;
      if (h.holdStatus === 'held') {
        groups[h.patientId].status = 'held';
      }
    });
    return Object.values(groups);
  }, [inventoryHolds, patients]);

  const patientInquiries = useMemo(() => {
    const list: { id: string; patientName: string; text: string; status: string; phone: string }[] = [];
    sessions.forEach(s => {
      const history = s.sessionData?.chatHistory || [];
      const lastPatientMsg = [...history].reverse().find(m => m.sender === 'patient');
      if (lastPatientMsg) {
        const patient = patients.find(p => p.phone === s.patientPhone);
        list.push({
          id: s.id,
          patientName: patient ? patient.name : s.patientPhone,
          text: lastPatientMsg.text,
          status: s.currentState,
          phone: s.patientPhone
        });
      }
    });
    return list.slice(0, 3);
  }, [sessions, patients]);

  /* ─── Quick Actions & Handlers ─────────────────────────────────── */
  const checkInWalkInPatient = () => {
    const firstNames = ['Amit', 'Rajesh', 'Suresh', 'Priya', 'Anjali', 'Neha', 'Vikram', 'Rohan', 'Sunita', 'Kiran'];
    const lastNames = ['Kumar', 'Sharma', 'Singh', 'Verma', 'Gupta', 'Prasad', 'Das', 'Roy', 'Mehta', 'Yadav'];
    const name = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
    const phone = '98' + Math.floor(10000000 + Math.random() * 90000000);
    const age = Math.floor(Math.random() * 50) + 18;
    const gender = Math.random() > 0.5 ? 'Male' : 'Female';
    const chronicList = [['Type-2 Diabetes'], ['Hypertension'], ['Type-2 Diabetes', 'Hypertension'], ['Asthma'], []];
    const chronic = chronicList[Math.floor(Math.random() * chronicList.length)];
    const abha = `ABHA-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const token = PatientService.generateNextTokenNumber();
    
    // Generate mock clinical vitals for triage illustration
    const bpSystolic = Math.random() > 0.6 ? (Math.random() > 0.5 ? 148 : 84) : 120;
    const bpDiastolic = bpSystolic > 120 ? 94 : 80;
    const temp = Math.random() > 0.6 ? 101.4 : 98.6;
    const hr = Math.random() > 0.6 ? 106 : 72;
    const sugar = Math.random() > 0.6 ? 192 : 110;
    const vitals = {
      temperature: temp.toString(),
      bloodPressure: `${bpSystolic}/${bpDiastolic}`,
      pulseRate: hr.toString(),
      weight: '68',
      bloodSugar: sugar.toString(),
      recordedAt: new Date().toISOString()
    };

    PatientService.registerPatient({
      name,
      phone,
      age,
      gender,
      allergies: Math.random() > 0.8 ? ['Penicillin'] : [],
      chronicConditions: chronic,
      abhaId: abha,
      queueStatus: 'awaiting_consultation',
      tokenNumber: token,
      vitals
    });

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Checked in patient ${name} successfully! Assigned Token: ${token}`,
        type: 'success',
        title: 'Walk-In Registered'
      }
    }));
  };

  const handleSignOffReport = (reportId: string) => {
    if (!signingAdvice.trim()) return;
    LabService.processPathologyReport(reportId, signingAdvice);
    setSigningReportId(null);
    setSigningAdvice('');
  };

  const restockAllReagents = () => {
    reagents.forEach(r => {
      if (r.stockVolume < 300) {
        LabService.replenishReagentStock(r.reagentName, 500); // Add 500ml
      }
    });
    
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: 'Replenished critical pathology reagents (+500ml).',
        type: 'success',
        title: 'Reagents Restocked'
      }
    }));
  };

  const restockPharmacyOOS = () => {
    let restockCount = 0;
    pharmacyInventory.forEach(item => {
      if (item.stock <= item.threshold) {
        PharmacyService.restockPharmacyInventoryItem(item.id, 100); // Add 100 units
        restockCount++;
      }
    });

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: restockCount > 0 
          ? `Restocked ${restockCount} low pharmacy SKU(s) (+100 items).`
          : 'All pharmacy SKU stock levels are healthy.',
        type: 'success',
        title: 'POS Inventory Replenished'
      }
    }));
  };

  const runTelemetryDiagnostics = async () => {
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: 'Running proactive system checks and cache validation...',
        type: 'info',
        title: 'Telemetry Scan Started'
      }
    }));
    try {
      await ProactiveHealthMonitor.runChecks();
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: 'All core clinical systems nominal. Auto-healer uplink is online.',
          type: 'success',
          title: 'Diagnostics Complete'
        }
      }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: 'System scan encountered minor errors. Auto-healing triggered.',
          type: 'warning',
          title: 'Diagnostics Degraded'
        }
      }));
    }
  };

  const triggerFailedMessageRetry = () => {
    const failedSessions = sessions.filter(s => s.currentState === 'FAILED_DELIVERY');
    if (failedSessions.length === 0) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { message: 'No failed WhatsApp messages to retry.', type: 'info', title: 'WhatsApp Gateway' }
      }));
      return;
    }
    
    failedSessions.forEach(s => {
      WhatsAppService.initiateWhatsAppSession(s.patientPhone);
    });

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Flushed and retried ${failedSessions.length} failed message(s) through Meta API gateway.`,
        type: 'success',
        title: 'WhatsApp Gateway Retried'
      }
    }));
  };
   return (
    <div className="space-y-5 w-full animate-fade-in font-sans">

      {/* ── CLINIC FINANCIAL SUMMARY WIDGET ─────────────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden animate-fade-in">
        {/* Amber-to-indigo gradient top line */}
        <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-emerald-500 to-indigo-500" />
        <div className="p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          {/* Left info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-amber-600 text-[20px]">payments</span>
            </div>
            <div>
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans">
                Clinic Financial Overview
              </h2>
              <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                Real-time commission splits, settlement shares & system health metrics
              </div>
            </div>
          </div>

          {/* Revenue Columns Grid + Clock */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full lg:w-auto lg:flex-1 lg:justify-end max-w-4xl">
            <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-center min-w-[120px]">
              <div className="text-[8px] text-slate-500 font-semibold uppercase tracking-wider">Gross Revenue</div>
              <div className="text-xs font-bold font-mono text-slate-900 mt-0.5">
                ₹{financialMetrics.grossRev.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-100 p-2.5 rounded-xl text-center min-w-[120px]">
              <div className="text-[8px] text-emerald-600 font-semibold uppercase tracking-wider">Cleared Share</div>
              <div className="text-xs font-bold font-mono text-emerald-700 mt-0.5">
                ₹{financialMetrics.cleared.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="bg-amber-50/50 border border-amber-100 p-2.5 rounded-xl text-center min-w-[120px]">
              <div className="text-[8px] text-amber-600 font-semibold uppercase tracking-wider">Pending Split</div>
              <div className="text-xs font-bold font-mono text-amber-700 mt-0.5">
                ₹{financialMetrics.pending.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="bg-indigo-50/50 border border-indigo-100 p-2.5 rounded-xl text-center min-w-[100px] flex flex-col justify-center items-center">
              <div className="text-[8px] text-indigo-600 font-semibold uppercase tracking-wider">Health Index</div>
              <div className="text-xs font-bold font-mono text-indigo-700 mt-0.5 flex items-center gap-1 justify-center">
                <span className={`w-1.5 h-1.5 rounded-full ${overallHealthScore >= 85 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {overallHealthScore}%
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-center min-w-[130px] hidden sm:block">
              <div className="text-[8px] text-slate-500 font-semibold uppercase tracking-wider font-mono">
                {currentTime.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
              </div>
              <div className="text-xs font-bold font-mono text-slate-900 mt-0.5">
                {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── CLINIC CLINICAL METRICS GRID ─────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in">
        {[
          { label: 'Total Registered',         value: patientMetrics.total,                icon: 'group',          accent: 'indigo',   sub: 'Total checked-in patients' },
          { label: 'Awaiting Consultation',    value: patientMetrics.awaitingConsultation, icon: 'clinical_notes',  accent: 'amber',    sub: 'Patients waiting in queue' },
          { label: 'In Consultation',          value: patientMetrics.inConsultation,       icon: 'stethoscope',     accent: 'teal',     sub: 'Active patient encounters' },
          { label: 'Completed Care Loop',      value: patientMetrics.completed,            icon: 'task_alt',        accent: 'emerald',  sub: 'Completed clinic visits'  },
        ].map(({ label, value, icon, accent, sub }) => (
          <div
            key={label}
            className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-sm flex items-center gap-4 hover:shadow-md transition-all duration-300"
          >
            <div className={`w-11 h-11 rounded-xl bg-${accent}-50 border border-${accent}-100 flex items-center justify-center text-${accent}-600 shrink-0`}>
              <span className="material-symbols-outlined text-[22px]">{icon}</span>
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-slate-900 leading-tight">
                {value}
              </div>
              <div className="text-[10px] font-bold text-slate-800 mt-0.5 leading-none">
                {label}
              </div>
              <div className="text-[9px] text-slate-500 mt-1 font-medium leading-none">
                {sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── 3-COLUMN WIDGET GRID ─────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* ── COLUMN 1: QUEUE & WHATSAPP ─────────────────────────── */}
        <div className="space-y-5">

          {/* Consultation Queue */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[350px]">
            <div className="h-1 w-full bg-indigo-500" />
            <div className="p-5 flex flex-col flex-1">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-500 text-[18px]">clinical_notes</span>
                  Active Consultation Queue
                </h2>
                <span className="text-[10px] font-bold px-2.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full font-mono">
                  {filteredPatients.length} Active
                </span>
              </div>

              {/* Search Patient in Queue */}
              <div className="relative mb-3">
                <span className="material-symbols-outlined text-slate-400 text-[14px] absolute left-3 top-2">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search patient name or token…"
                  className="w-full bg-slate-50 border border-slate-200 text-[11px] px-8 py-1.5 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-all"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2 text-slate-400 hover:text-slate-700 cursor-pointer border-0 bg-transparent">
                    <span className="material-symbols-outlined text-[13px]">close</span>
                  </button>
                )}
              </div>

              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[300px] pr-0.5">
                {filteredPatients.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12 text-center">
                    <span className="material-symbols-outlined text-3xl mb-2 text-slate-300">group_off</span>
                    <span className="text-xs font-medium">No patients in queue</span>
                  </div>
                ) : (
                  filteredPatients.map(p => (
                    <div
                      key={p.id}
                      className="p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/70 hover:border-indigo-200 rounded-xl flex items-center justify-between gap-3 transition-all"
                    >
                      <div className="truncate">
                        <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                          {p.name}
                          {p.tokenNumber && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded border border-indigo-200">
                              {p.tokenNumber}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {p.age}y · {p.gender} · {p.chronicConditions.join(', ') || 'General Checkup'}
                        </div>
                      </div>
                      {onStartConsultation && (
                        <button
                          onClick={() => onStartConsultation(p)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer border-0 shadow-sm whitespace-nowrap"
                        >
                          Consult
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Patient Triage & Vitals Monitor */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="h-1 w-full bg-rose-500" />
            <div className="p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-500 text-[18px]">medical_services</span>
                  Triage Alerts & Vitals
                </h2>
                <span className="text-[10px] font-bold px-2.5 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-full font-mono">
                  {criticalPatients.length} Alerts
                </span>
              </div>

              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-0.5">
                {criticalPatients.length === 0 ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs text-center rounded-xl flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    All waiting patients are stable
                  </div>
                ) : (
                  criticalPatients.map(p => {
                    const alerts = checkVitalsAlerts(p.vitals);
                    return (
                      <div key={p.id} className="p-3 bg-rose-50/30 hover:bg-rose-50 border border-rose-100 rounded-xl space-y-1.5 transition-all">
                        <div className="flex justify-between items-center">
                          <div className="truncate">
                            <span className="text-xs font-semibold text-slate-900 block truncate">{p.name}</span>
                            <span className="text-[9px] text-slate-500 font-mono">Token: {p.tokenNumber || '—'}</span>
                          </div>
                          {onStartConsultation && (
                            <button
                              onClick={() => onStartConsultation(p)}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[9px] font-bold uppercase transition-all border-0 cursor-pointer shadow-sm shrink-0"
                            >
                              Triage
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {alerts.map((al, idx) => (
                            <span key={idx} className="text-[8px] font-bold px-1.5 py-0.5 bg-white border border-rose-200 text-rose-600 rounded font-mono">
                              {al}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── COLUMN 2: LABS, PRESCRIPTIONS, & INBOX ─────────────── */}
        <div className="space-y-5">

          {/* Lab Reports Sign-Off */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="h-1 w-full bg-teal-500" />
            <div className="p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-teal-600 text-[18px]">biotech</span>
                  Lab Reports Sign-Off
                </h2>
                <span className="text-[10px] font-bold font-mono px-2.5 py-0.5 bg-teal-50 border border-teal-200 text-teal-700 rounded-full">
                  {pendingReports.length} Pending
                </span>
              </div>

              <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-0.5">
                {pendingReports.length === 0 ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs text-center rounded-xl flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    All lab reports signed off
                  </div>
                ) : (
                  pendingReports.map(rep => {
                    const isSigning = signingReportId === rep.id;
                    return (
                      <div key={rep.id} className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <div className="truncate">
                            <span className="text-xs font-semibold text-slate-900 block truncate">{rep.patientName}</span>
                            <span className="text-[9px] text-slate-500 font-medium">
                              Test: {rep.testName}
                            </span>
                          </div>
                          <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200 uppercase shrink-0">
                            Needs Sign-off
                          </span>
                        </div>

                        {isSigning ? (
                          <div className="space-y-2 bg-white border border-slate-200 p-2.5 rounded-lg">
                            <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Clinical Advice</label>
                            <textarea
                              value={signingAdvice}
                              onChange={e => setSigningAdvice(e.target.value)}
                              placeholder="Enter advice..."
                              className="w-full text-[10px] p-2 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-teal-500 resize-none h-12"
                            />
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => setSigningReportId(null)}
                                className="px-2 py-1 text-[8px] font-bold uppercase text-slate-500 bg-slate-100 hover:bg-slate-200 rounded border-0 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSignOffReport(rep.id)}
                                className="px-3 py-1 text-[8px] font-bold uppercase text-white bg-teal-600 hover:bg-teal-700 rounded border-0 cursor-pointer shadow-sm"
                              >
                                Approve
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                            <span className="text-[8px] text-slate-400 font-mono">
                              {new Date(rep.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button
                              onClick={() => {
                                setSigningReportId(rep.id);
                                setSigningAdvice(rep.results || 'Report verified. Acceptable parameters. Review in next follow-up.');
                              }}
                              className="px-2 py-1 text-[9px] font-bold uppercase text-teal-700 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-600 hover:text-white transition-all cursor-pointer border-0"
                            >
                              Sign Off
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* E-Rx Dispensation Monitor */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="h-1 w-full bg-violet-500" />
            <div className="p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-violet-600 text-[18px]">medication</span>
                  E-Rx Fulfillment
                </h2>
                <span className="text-[10px] font-bold px-2.5 py-0.5 bg-violet-50 border border-violet-200 text-violet-700 rounded-full font-mono">
                  {groupedHolds.filter(g => g.status === 'held').length} Pending
                </span>
              </div>

              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-0.5">
                {groupedHolds.filter(g => g.status === 'held').length === 0 ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs text-center rounded-xl flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    All prescriptions dispensed
                  </div>
                ) : (
                  groupedHolds.filter(g => g.status === 'held').map((group, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-slate-900 truncate max-w-[180px]">{group.patientName}</span>
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider font-mono bg-amber-50 border-amber-200 text-amber-700">
                          Held
                        </span>
                      </div>
                      <div className="text-[9px] text-slate-600 bg-white border border-slate-100 p-2 rounded-lg space-y-1">
                        {group.medicines.map((m, mIdx) => (
                          <div key={mIdx} className="flex justify-between items-center">
                            <span className="truncate max-w-[160px] font-medium">{m.name}</span>
                            <span className="text-[8px] text-slate-500 font-mono font-semibold">Qty: {m.qty}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Patient Inquiries Feed */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="h-1 w-full bg-emerald-500" />
            <div className="p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-[18px]">chat_bubble</span>
                Patient Inquiries Feed
              </h2>

              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-0.5">
                {patientInquiries.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs italic">
                    No incoming clinical queries.
                  </div>
                ) : (
                  patientInquiries.map(m => (
                    <div key={m.id} className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-slate-900">{m.patientName}</span>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider border ${
                          m.status === 'AWAITING_PAYMENT' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                          m.status === 'COMPLETED' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                          'bg-slate-100 border-slate-200 text-slate-600'
                        }`}>{m.status.replace(/_/g, ' ')}</span>
                      </div>
                      <p className="text-[10px] text-slate-600 leading-relaxed italic line-clamp-2 bg-white border border-slate-100 p-2 rounded-lg">
                        "{m.text}"
                      </p>
                      <div className="flex justify-end">
                        <button
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('mediflow-change-tab', { detail: 'whatsapp' }));
                          }}
                          className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded text-[9px] font-bold uppercase hover:bg-indigo-600 hover:text-white transition-all cursor-pointer"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── COLUMN 3: FINANCE ───────────────────────────────────── */}
        <div className="space-y-5">

          {/* Revenue Split Ledger */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="h-1 w-full bg-amber-500" />
            <div className="p-5">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-600 text-[18px]">payments</span>
                  Revenue Split Ledger
                </h2>
                <span className="text-[10px] font-mono font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">Bihar Zone</span>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl text-center">
                  <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-widest">Gross</div>
                  <div className="text-sm font-bold font-mono mt-1 text-slate-900">₹{financialMetrics.grossRev.toLocaleString('en-IN')}</div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <div className="text-[9px] text-emerald-600 font-semibold uppercase tracking-widest">Cleared</div>
                  <div className="text-sm font-bold font-mono mt-1 text-emerald-700">₹{financialMetrics.cleared.toLocaleString('en-IN')}</div>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <div className="text-[9px] text-amber-600 font-semibold uppercase tracking-widest">Pending</div>
                  <div className="text-sm font-bold font-mono mt-1 text-amber-700">₹{financialMetrics.pending.toLocaleString('en-IN')}</div>
                </div>
              </div>

              {/* Revenue bar + breakdown */}
              <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-xl space-y-3">
                <div className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Revenue Transaction Shares</div>

                {/* Stacked bar */}
                <div className="h-4 bg-slate-200 rounded-full overflow-hidden flex">
                  {[
                    { type: 'appointment_fee',    label: 'Consult',  color: 'bg-indigo-500' },
                    { type: 'lab_commission',      label: 'Lab',      color: 'bg-teal-500'   },
                    { type: 'medicine_commission', label: 'Pharmacy', color: 'bg-violet-500' },
                    { type: 'platform_fee',        label: 'Platform', color: 'bg-slate-400'  }
                  ].map((item, index) => {
                    const total = financials.filter(l => l.transactionType === item.type).reduce((s, l) => s + l.netPayout, 0);
                    const allTotal = financials.reduce((s, l) => s + l.netPayout, 0) || 1;
                    const pct = (total / allTotal) * 100;
                    if (pct === 0) return null;
                    return (
                      <div
                        key={index}
                        className={`${item.color} h-full transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                        title={`${item.label}: ₹${total} (${Math.round(pct)}%)`}
                      />
                    );
                  })}
                </div>

                {/* Breakdown rows */}
                <div className="space-y-2 pt-1">
                  {[
                    { type: 'appointment_fee',    label: 'Clinic Consult Payout',      dot: 'bg-indigo-500' },
                    { type: 'lab_commission',      label: 'Lab Share Settlement',        dot: 'bg-teal-500'   },
                    { type: 'medicine_commission', label: 'Pharmacy Share Settlement',   dot: 'bg-violet-500' },
                    { type: 'platform_fee',        label: 'Platform Commission Split',   dot: 'bg-slate-400'  }
                  ].map((item, index) => {
                    const amt = financials.filter(l => l.transactionType === item.type).reduce((s, l) => s + l.netPayout, 0);
                    return (
                      <div key={index} className="flex items-center justify-between bg-white border border-slate-200/60 px-3 py-2 rounded-xl">
                        <span className="flex items-center gap-2 text-[11px] font-medium text-slate-700">
                          <span className={`w-2 h-2 rounded-full ${item.dot} shrink-0`} />
                          {item.label}
                        </span>
                        <span className="font-mono font-bold text-slate-900 text-[11px]">₹{Math.round(amt).toLocaleString('en-IN')}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM ALERT BANNER ──────────────────────────────────── */}
      {criticalPatients.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="absolute top-0 left-0 w-full h-1 bg-rose-500" />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-rose-600 text-[20px] animate-pulse">warning</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-800">Critical Triage Alert</h3>
              <p className="text-[11px] text-rose-600 mt-0.5">
                {criticalPatients.length} patient(s) in the consultation queue have abnormal vitals requiring immediate attention.
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <button
              onClick={() => {
                const firstCrit = criticalPatients[0];
                if (onStartConsultation && firstCrit) {
                  onStartConsultation(firstCrit);
                }
              }}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer shadow-sm border-0"
            >
              Consult High-Priority Patient
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
