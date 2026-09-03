import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import type { Patient, LabRequisition, InventoryHold, FinancialLedgerEntry, WhatsAppSession, PathologyReport } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { RealtimeSyncService } from '../../services/realtimeSyncService';
import { ProactiveHealthMonitor } from '../../services/autoHealerAgent';
import { PatientService } from '../../services/patientService';
import { WhatsAppService } from '../../services/whatsappService';
import { LabService } from '../../services/labService';
import { PharmacyService } from '../../services/pharmacyService';
import { BillingService } from '../../services/billingService';
import { ChronicCareService, type ChronicCohortRecord } from '../../services/chronicCareService';
import { PointerGlowCard } from '../ui/PointerGlowCard';
import { getIstDateString, getEffectiveAppointmentDate } from '../../utils/dateUtils';
import { SkeletonMetric, SkeletonCard, SkeletonRow } from '../ui/SkeletonLoader';
import { ZeroQueueState } from '../shared/EmptyState';
import { 
  Users, 
  ClipboardList, 
  Stethoscope, 
  CheckCircle2, 
  CreditCard, 
  Search, 
  UserPlus, 
  X, 
  Clock,
  HeartPulse,
  FlaskConical,
  TestTube2,
  Pill,
  Package,
  MessageSquare,
  RefreshCw,
  AlertTriangle,
  Coins,
  Sparkles
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────────
   PodCommandCenter.tsx — Mediflow B2B Glassmorphic Matrix Console
   Professional clinic cockpit dashboard filled with widgets, real-time metrics,
   and core system functions easily accessible to the Doctor / Admin.
   ───────────────────────────────────────────────────────────────────────────── */

interface PodCommandCenterProps {
  onStartConsultation?: (patient: Patient) => void;
  onOpenChronicCare?: () => void;
  hideHeader?: boolean;
}

export const PodCommandCenter: React.FC<PodCommandCenterProps> = ({ onStartConsultation, onOpenChronicCare, hideHeader }) => {
  /* ─── State Management ─────────────────────────────────────────── */
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [labReqs, setLabReqs] = useState<LabRequisition[]>([]);
  const [inventoryHolds, setInventoryHolds] = useState<InventoryHold[]>([]);
  const [financials, setFinancials] = useState<FinancialLedgerEntry[]>([]);
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [reagents, setReagents] = useState<any[]>([]);
  const [pharmacyInventory, setPharmacyInventory] = useState<any[]>([]);
  const [pathologyReports, setPathologyReports] = useState<PathologyReport[]>([]);
  const [chronicCohorts, setChronicCohorts] = useState<ChronicCohortRecord[]>([]);

  // Lab Report Sign-off Interactive States
  const [signingReportId, setSigningReportId] = useState<string | null>(null);
  const [signingAdvice, setSigningAdvice] = useState<string>('');
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pulse, setPulse] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 700);
    return () => clearTimeout(timer);
  }, []);

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
      setAppointments(api.getAppointments());
      setLabReqs(api.getLabRequisitions());
      setInventoryHolds(api.getInventoryHolds());
      setFinancials(api.getFinancialLedgers());
      setSessions(api.getWhatsAppSessions());
      setReagents(api.getReagentStocks());
      setPharmacyInventory(api.getPharmacyInventory());
      setPathologyReports(api.getPathologyReports());
      ChronicCareService.getChronicCohorts().then(c => setChronicCohorts(c || []));
    };
    sync();

    const unsubscribeApi = api.subscribe(sync);
    window.addEventListener('mediflow-state-change', sync);
    window.addEventListener('storage', sync);

    const unsubscribeRealtime = RealtimeSyncService.subscribeToLiveClinicUpdates({
      onAppointmentChange: () => sync(),
      onMedicineBillChange: () => sync(),
      onLabRequisitionChange: () => sync(),
      onPatientChange: () => sync(),
      onWhatsAppSessionChange: () => sync(),
      onFinancialLedgerChange: () => sync(),
      onUnifiedInvoiceChange: () => sync(),
      onPathologyReportChange: () => sync(),
      onPoolSettlementChange: () => sync(),
      onClinicSopChange: () => sync(),
      onSaaSInvoiceChange: () => sync(),
      onSaaSPrescriptionChange: () => sync(),
      onEncounterChange: () => sync(),
      onInventoryHoldChange: () => sync(),
      onChronicCohortChange: () => sync()
    });

    return () => {
      unsubscribeApi();
      unsubscribeRealtime();
      window.removeEventListener('mediflow-state-change', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  /* ─── Computed Metrics ───────────────────────────────────────── */
  const todayStr = useMemo(() => getIstDateString(currentTime), [currentTime]);

  const isPatientForToday = (p: Patient) => {
    const patAppts = appointments.filter(a => (a.patientId === p.id || (a as any).patient_id === p.id) && a.status !== 'cancelled');
    if (patAppts.length > 0) {
      return patAppts.some(a => getEffectiveAppointmentDate(a) === todayStr);
    }
    const regDate = p.registeredAt || p.createdAt || (p as any).registered_at || '';
    const pDate = getIstDateString(regDate);
    return pDate === todayStr;
  };

  const labMetrics = useMemo(() => ({
    total: labReqs.length,
    pending: labReqs.filter(r => r.status === 'pending').length,
    processing: labReqs.filter(r => r.status === 'collected' || r.status === 'processed').length,
    completedToday: labReqs.filter(r => r.status === 'completed' && getIstDateString(r.createdAt) === todayStr).length,
    lowReagents: reagents.filter(r => r.stockVolume < 200).length,
    criticalReagents: reagents.filter(r => r.stockVolume < 100).length,
  }), [labReqs, reagents, todayStr]);

  const pharmacyMetrics = useMemo(() => ({
    pendingHolds: inventoryHolds.filter(h => h.holdStatus === 'held').length,
    dispensedToday: inventoryHolds.filter(h => h.holdStatus === 'dispensed' && getIstDateString(h.createdAt) === todayStr).length,
    lowStockItems: pharmacyInventory.filter((i: any) => i.stock <= i.threshold).length,
    criticalStockItems: pharmacyInventory.filter((i: any) => i.stock === 0).length,
  }), [inventoryHolds, pharmacyInventory, todayStr]);

  const financialMetrics = useMemo(() => {
    const uInvoices = api.getUnifiedInvoices();
    const saasInvoices = api.getInvoices();
    
    // Map distinct invoices by ID to eliminate multi-party split duplication
    const invMap = new Map<string, { totalAmount: number; paymentStatus: string; createdAt?: string }>();
    
    uInvoices.forEach(i => {
      invMap.set(i.id, {
        totalAmount: Number(i.totalAmount) || ((Number(i.doctorFee) || 0) + (Number(i.labFee) || 0) + (Number(i.pharmacyFee) || 0)),
        paymentStatus: i.paymentStatus || 'pending',
        createdAt: i.createdAt
      });
    });

    saasInvoices.forEach(i => {
      if (!invMap.has(i.id) && !invMap.has(i.appointmentId)) {
        invMap.set(i.id, {
          totalAmount: Number(i.amount) || 0,
          paymentStatus: i.status === 'paid' ? 'cleared' : 'pending',
          createdAt: i.createdAt
        });
      }
    });

    const allInvoices = Array.from(invMap.values());
    const grossRev = allInvoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
    const cleared = allInvoices
      .filter(i => (i.paymentStatus as string) === 'cleared' || (i.paymentStatus as string) === 'paid')
      .reduce((s, i) => s + (i.totalAmount || 0), 0);
    const pending = allInvoices
      .filter(i => (i.paymentStatus as string) === 'pending' || (i.paymentStatus as string) === 'unpaid')
      .reduce((s, i) => s + (i.totalAmount || 0), 0);

    const todayLedgers = allInvoices.filter(i => getIstDateString(i.createdAt) === todayStr).length;

    return { grossRev, cleared, pending, todayLedgers };
  }, [financials, todayStr]);

  const whatsappMetrics = useMemo(() => ({
    active: sessions.filter(s => !['COMPLETED', 'FAILED_DELIVERY'].includes(s.currentState)).length,
    awaitingPayment: sessions.filter(s => s.currentState === 'AWAITING_PAYMENT').length,
    completed: sessions.filter(s => s.currentState === 'COMPLETED').length,
    failed: sessions.filter(s => s.currentState === 'FAILED_DELIVERY').length,
  }), [sessions]);

  const patientMetrics = useMemo(() => {
    const todayPatients = patients.filter(isPatientForToday);
    const isPatientCompleted = (p: any) => p.queueStatus === 'completed' || p.queue_status === 'completed' || p.queueStatus === 'settled' || p.queueStatus === 'pharmacy' || p.queueStatus === 'lab';

    return {
      total: todayPatients.length,
      awaitingConsultation: todayPatients.filter(p => (p.queueStatus === 'awaiting_consultation' || !p.queueStatus) && !isPatientCompleted(p)).length,
      inConsultation: todayPatients.filter(p => p.queueStatus === 'in_consultation' && !isPatientCompleted(p)).length,
      completed: todayPatients.filter(isPatientCompleted).length,
    };
  }, [patients, appointments, todayStr]);

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
    const parseTokenNum = (token?: string | number) => {
      if (!token) return Infinity;
      const match = String(token).match(/\d+/);
      return match ? parseInt(match[0], 10) : Infinity;
    };

    return patients
      .filter(p => {
        // If user is searching by text, allow searching all patients
        if (searchQuery) {
          const cleanQuery = searchQuery.replace(/\D/g, '');
          return (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                 (p.phone || '').includes(searchQuery) ||
                 (cleanQuery.length >= 3 && (p.phone || '').replace(/\D/g, '').includes(cleanQuery)) ||
                 (p.tokenNumber && String(p.tokenNumber).toLowerCase().includes(searchQuery.toLowerCase()));
        }

        // Must be a patient for today
        if (!isPatientForToday(p)) return false;

        // Handle metric-specific filters (Enforces vitals intake & payment verification before doctor queue)
        const isCompleted = p.queueStatus === 'completed' || (p as any).queue_status === 'completed' || (p as any).queueStatus === 'settled' || (p as any).queueStatus === 'pharmacy' || (p as any).queueStatus === 'lab';
        const isAwaitingConsult = !isCompleted && 
                                  (p.queueStatus === 'awaiting_consultation' || Boolean(p.vitals?.bloodPressure)) &&
                                  p.queueStatus !== 'awaiting_vitals' && p.queueStatus !== 'registered' && (p.queueStatus as any) !== 'pending_payment';
        const isInConsult = !isCompleted && p.queueStatus === 'in_consultation';

        if (selectedMetric === 'all') {
          return true;
        } else if (selectedMetric === 'awaiting') {
          return isAwaitingConsult;
        } else if (selectedMetric === 'active') {
          return isInConsult;
        } else if (selectedMetric === 'completed') {
          return isCompleted;
        } else {
          // Default filter: Active Consultation Queue (Only active patients whose vitals & payment are verified and care loop NOT completed)
          return isAwaitingConsult || isInConsult;
        }
      })
      .sort((a, b) => {
        const isSosA = Boolean((a as any).isEmergency || (a as any).is_emergency || String((a as any).source || '').toLowerCase().includes('sos') || String((a as any).source || '').toLowerCase().includes('emergency') || (a.tokenNumber && (String(a.tokenNumber).includes('E') || String(a.tokenNumber).toUpperCase().includes('SOS') || String(a.tokenNumber).startsWith('#EM-'))));
        const isSosB = Boolean((b as any).isEmergency || (b as any).is_emergency || String((b as any).source || '').toLowerCase().includes('sos') || String((b as any).source || '').toLowerCase().includes('emergency') || (b.tokenNumber && (String(b.tokenNumber).includes('E') || String(b.tokenNumber).toUpperCase().includes('SOS') || String(b.tokenNumber).startsWith('#EM-'))));
        if (isSosA && !isSosB) return -1;
        if (!isSosA && isSosB) return 1;

        const statusOrder = { 'in_consultation': 1, 'awaiting_consultation': 2, 'completed': 3 };
        const statusA = statusOrder[a.queueStatus as keyof typeof statusOrder] || 99;
        const statusB = statusOrder[b.queueStatus as keyof typeof statusOrder] || 99;
        if (statusA !== statusB) return statusA - statusB;

        const tokenA = parseTokenNum(a.tokenNumber);
        const tokenB = parseTokenNum(b.tokenNumber);
        return tokenA - tokenB;
      });
  }, [patients, appointments, searchQuery, selectedMetric, todayStr]);

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
      const systolic = parseInt(parts[0] || '0', 10);
      if (!isNaN(systolic)) {
        if (systolic > 140) alerts.push(`High BP (${vitals.bloodPressure})`);
        else if (systolic < 90) alerts.push(`Low BP (${vitals.bloodPressure})`);
      }
    }
    if (vitals.pulseRate) {
      let hr = parseInt(vitals.pulseRate, 10);
      if (!isNaN(hr)) {
        // Sanitize repeated digits (e.g. 72727272 -> 72)
        const hrStr = vitals.pulseRate.toString().trim();
        if (hrStr.length >= 4 && hrStr.length % 2 === 0) {
          const half = hrStr.substring(0, 2);
          if (hrStr.split(half).join('') === '') {
            hr = parseInt(half, 10);
          }
        }
        
        if (hr >= 30 && hr <= 250) {
          if (hr > 100) alerts.push(`High HR (${hr} bpm)`);
          else if (hr < 55) alerts.push(`Low HR (${hr} bpm)`);
        } else {
          alerts.push(`Invalid HR (${hrStr} bpm)`);
        }
      }
    }
    if (vitals.bloodSugar) {
      let bs = parseInt(vitals.bloodSugar, 10);
      if (!isNaN(bs)) {
        const bsStr = vitals.bloodSugar.toString().trim();
        if (bsStr.length >= 6 && bsStr.length % 3 === 0) {
          const pattern = bsStr.substring(0, 3);
          if (bsStr.split(pattern).join('') === '') {
            bs = parseInt(pattern, 10);
          }
        } else if (bsStr.length >= 4 && bsStr.length % 2 === 0) {
          const pattern = bsStr.substring(0, 2);
          if (bsStr.split(pattern).join('') === '') {
            bs = parseInt(pattern, 10);
          }
        }
        
        if (bs >= 20 && bs <= 1000) {
          if (bs > 180) alerts.push(`High Sugar (${bs} mg/dL)`);
          else if (bs < 70) alerts.push(`Low Sugar (${bs} mg/dL)`);
        } else {
          alerts.push(`Invalid Sugar (${bsStr} mg/dL)`);
        }
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
    const groups: { [patientId: string]: { patientName: string; medicines: { id: string; name: string; qty: number; status: string }[]; totalItems: number; status: 'dispensed' | 'held' } } = {};
    inventoryHolds.forEach(h => {
      const patient = patients.find(p => p.id === h.patientId);
      const name = patient ? patient.name : `Patient ${(h.patientId || '').substring(0, 5)}`;
      if (!groups[h.patientId]) {
        groups[h.patientId] = {
          patientName: name,
          medicines: [],
          totalItems: 0,
          status: 'dispensed'
        };
      }
      groups[h.patientId].medicines.push({ id: h.id, name: h.medicineName, qty: h.quantity, status: h.holdStatus });
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
        const sPhoneDigits = (s.patientPhone || (s as any).patient_phone || '').replace(/\D/g, '').slice(-10);
        const patient = patients.find(p => (p.phone || (p as any).patient_phone || '').replace(/\D/g, '').slice(-10) === sPhoneDigits);
        let text = lastPatientMsg.text.trim();
        const cleaned = text.toLowerCase();
        
        // Translate short technical keyword replies into meaningful action labels
        if (cleaned === '1' || cleaned === 'start') {
          if (s.currentState === 'AWAITING_WELCOME') {
            text = '1 (Initiate Workspace Connect)';
          } else if (s.currentState === 'AWAITING_CONSENT') {
            text = '1 (Grant Data Sharing Consent)';
          } else if (s.currentState === 'AWAITING_PAYMENT') {
            text = '1 (Confirm Invoice Payment)';
          } else {
            text = `${text} (Select Option 1)`;
          }
        } else if (cleaned === 'consent') {
          text = 'CONSENT (Grant Data Sharing)';
        } else if (cleaned === 'summary') {
          text = 'SUMMARY (Request Lab Report Scan)';
        } else if (cleaned === 'a') {
          text = 'A (Check Active Appointments)';
        } else if (cleaned === 'i') {
          text = 'I (Invoices Summary Request)';
        } else if (cleaned === 'pay' || cleaned === 'clear' || cleaned === 'done') {
          text = `${text.toUpperCase()} (Clear Outstanding Invoice)`;
        }

        list.push({
          id: s.id,
          patientName: patient ? patient.name : s.patientPhone,
          text: text,
          status: s.currentState,
          phone: s.patientPhone
        });
      }
    });
    return list.slice(0, 3);
  }, [sessions, patients]);

  /* ─── Quick Actions & Handlers ─────────────────────────────────── */
  const checkInWalkInPatient = () => {
    let isDemo = false;
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('vitalsync_cached_profile');
        if (cached) {
          const parsed = JSON.parse(cached);
          isDemo = parsed?.isDemo === true || parsed?.email === 'demo@mediflow.com';
        }
      } catch (_e) {}
    }

    if (!isDemo && !import.meta.env.DEV) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Walk-In Intake 📋',
          message: 'Please register live walk-in patients via the Compounder Desk to capture verified clinical vitals and demographics.',
          type: 'info'
        }
      }));
      return;
    }

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
    
    // Generate mock clinical vitals for triage illustration in demo mode
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

  const dispensePatientHolds = (patientMedicines: { id: string; name: string }[]) => {
    patientMedicines.forEach(m => {
      api.dispenseInventoryHold(m.id);
    });
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Successfully dispensed ${patientMedicines.length} medicine item(s).`,
        type: 'success',
        title: 'Prescription Fulfilled'
      }
    }));
  };
   return (
    <div className="space-y-5 w-full animate-fade-in font-sans">

      {/* ── CLINIC FINANCIAL SUMMARY WIDGET ─────────────────────────── */}
      <div className="bg-white/90 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/5 rounded-2xl shadow-xs overflow-hidden animate-fade-in backdrop-blur-md">
        {/* Amber-to-indigo gradient top line */}
        <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-emerald-500 to-indigo-500" />
        <div className="p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          {/* Left info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-amber-600 shrink-0" />
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
            {isLoading ? (
              <>
                <div className="h-11 bg-slate-100 dark:bg-slate-900/60 rounded-xl animate-shimmer min-w-[120px]" />
                <div className="h-11 bg-slate-100 dark:bg-slate-900/60 rounded-xl animate-shimmer min-w-[120px]" />
                <div className="h-11 bg-slate-100 dark:bg-slate-900/60 rounded-xl animate-shimmer min-w-[120px]" />
                <div className="h-11 bg-slate-100 dark:bg-slate-900/60 rounded-xl animate-shimmer min-w-[100px]" />
                <div className="h-11 bg-slate-100 dark:bg-slate-900/60 rounded-xl animate-shimmer min-w-[130px] hidden sm:block" />
              </>
            ) : (
              <>
                <PointerGlowCard containerClassName="min-w-[120px]" className="bg-slate-50 dark:bg-slate-900/40 p-2 text-center">
                  <div className="text-[8px] text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">Gross Revenue</div>
                  <div className="text-xs font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                    ₹{financialMetrics.grossRev.toLocaleString('en-IN')}
                  </div>
                </PointerGlowCard>

                <PointerGlowCard containerClassName="min-w-[120px]" className="bg-emerald-50/50 dark:bg-emerald-950/20 p-2 text-center">
                  <div className="text-[8px] text-emerald-600 dark:text-emerald-455 font-semibold uppercase tracking-wider">Cleared Share</div>
                  <div className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                    ₹{financialMetrics.cleared.toLocaleString('en-IN')}
                  </div>
                </PointerGlowCard>

                <PointerGlowCard containerClassName="min-w-[120px]" className="bg-amber-50/50 dark:bg-amber-950/20 p-2 text-center">
                  <div className="text-[8px] text-amber-600 dark:text-amber-455 font-semibold uppercase tracking-wider">Pending Split</div>
                  <div className="text-xs font-bold font-mono text-amber-700 dark:text-amber-400 mt-0.5">
                    ₹{financialMetrics.pending.toLocaleString('en-IN')}
                  </div>
                </PointerGlowCard>

                <PointerGlowCard 
                  containerClassName="min-w-[100px]" 
                  onClick={runTelemetryDiagnostics}
                  className="bg-indigo-50/50 dark:bg-indigo-950/20 p-2 text-center flex flex-col justify-center items-center cursor-pointer active:scale-95 transition-all hover:scale-[1.03]"
                  title="Run Real-time Proactive Telemetry Diagnostics Scan"
                >
                  <div className="text-[8px] text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wider">Health Index</div>
                  <div className="text-xs font-bold font-mono text-indigo-700 dark:text-indigo-455 mt-0.5 flex items-center gap-1 justify-center">
                    <span className={`w-1.5 h-1.5 rounded-full ${overallHealthScore >= 85 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {overallHealthScore}%
                  </div>
                </PointerGlowCard>

                <PointerGlowCard containerClassName="min-w-[130px] hidden sm:block" className="bg-slate-50 dark:bg-slate-900/40 p-2 text-center">
                  <div className="text-[8px] text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider font-mono">
                    {currentTime.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
                  </div>
                  <div className="text-xs font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                    {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                  </div>
                </PointerGlowCard>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── CLINIC CLINICAL METRICS GRID ─────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in">
        {isLoading ? (
          <>
            <SkeletonMetric />
            <SkeletonMetric />
            <SkeletonMetric />
            <SkeletonMetric />
          </>
        ) : (
          [
            { id: 'all',       label: 'Total Registered',         value: patientMetrics.total,                icon: Users,          accent: 'indigo',   sub: 'Total checked-in patients' },
            { id: 'awaiting',  label: 'Awaiting Consultation',    value: patientMetrics.awaitingConsultation, icon: Clock,          accent: 'amber',    sub: 'Patients waiting in queue' },
            { id: 'active',    label: 'In Consultation',          value: patientMetrics.inConsultation,       icon: Stethoscope,    accent: 'teal',     sub: 'Active patient encounters' },
            { id: 'completed', label: 'Completed Care Loop',      value: patientMetrics.completed,            icon: CheckCircle2,   accent: 'emerald',  sub: 'Completed clinic visits'  },
          ].map(({ id, label, value, icon: Icon, accent, sub }) => {
            const isSelected = selectedMetric === id || (selectedMetric === null && id === 'awaiting');
            
            const borderStyles = {
              indigo: 'border-indigo-500/80 dark:border-indigo-500/60 shadow-indigo-500/10 bg-indigo-50/10 dark:bg-indigo-950/10',
              amber: 'border-amber-500/80 dark:border-amber-500/60 shadow-amber-500/10 bg-amber-50/10 dark:bg-amber-950/10',
              teal: 'border-teal-500/80 dark:border-teal-500/60 shadow-teal-500/10 bg-teal-50/10 dark:bg-teal-950/10',
              emerald: 'border-emerald-500/80 dark:border-emerald-500/60 shadow-emerald-500/10 bg-emerald-50/10 dark:bg-emerald-950/10'
            }[accent as 'indigo' | 'amber' | 'teal' | 'emerald'];

            const iconBgStyles = {
              indigo: 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-800/30 text-indigo-650 dark:text-indigo-400',
              amber: 'bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-800/30 text-amber-650 dark:text-amber-400',
              teal: 'bg-teal-50 dark:bg-teal-950/30 border-teal-100 dark:border-teal-800/30 text-teal-650 dark:text-teal-400',
              emerald: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-800/30 text-emerald-655 dark:text-emerald-400'
            }[accent as 'indigo' | 'amber' | 'teal' | 'emerald'];

            return (
              <PointerGlowCard
                key={label}
                onClick={() => setSelectedMetric(id)}
                className={`bg-white/90 dark:bg-slate-950/60 p-4 flex items-center gap-4 hover:shadow-md transition-all duration-300 cursor-pointer border-2 hover:scale-[1.02] active:scale-95 ${
                  isSelected 
                    ? `${borderStyles} shadow-lg scale-[1.02]` 
                    : 'border-slate-200/50 dark:border-white/5'
                }`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${iconBgStyles}`}>
                  <Icon className="w-5 h-5 shrink-0" />
                </div>
                <div>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white leading-tight">
                    {value}
                  </div>
                  <div className="text-[10px] font-bold text-slate-800 dark:text-zinc-300 mt-0.5 leading-none">
                    {label}
                  </div>
                  <div className="text-[9px] text-slate-500 dark:text-zinc-400 mt-1 font-medium leading-none">
                    {sub}
                  </div>
                </div>
              </PointerGlowCard>
            );
          })
        )}
      </div>

      {/* ── 3-COLUMN WIDGET GRID ─────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* ── COLUMN 1: QUEUE & WHATSAPP ─────────────────────────── */}
        <div className="space-y-5">

          {/* Consultation Queue */}
          <div className="bg-white/90 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/5 rounded-2xl shadow-xs overflow-hidden flex flex-col min-h-[350px] backdrop-blur-md">
            <div className="h-1 w-full bg-indigo-500" />
            <div className="p-5 flex flex-col flex-1">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {selectedMetric === 'all' ? <Users className="w-4 h-4 text-indigo-500" /> : selectedMetric === 'active' ? <Stethoscope className="w-4 h-4 text-teal-500" /> : selectedMetric === 'completed' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <ClipboardList className="w-4 h-4 text-indigo-500" />}
                  </div>
                  <span>
                    {selectedMetric === 'all' && 'Registered Patients Today'}
                    {selectedMetric === 'awaiting' && 'Consultation Queue (Awaiting)'}
                    {selectedMetric === 'active' && 'Active Consultations (In Progress)'}
                    {selectedMetric === 'completed' && 'Completed Consultations'}
                    {(selectedMetric === null) && 'Active Consultation Queue'}
                  </span>
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={checkInWalkInPatient}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/5 rounded text-indigo-700 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-white transition-all cursor-pointer text-[10px] font-bold flex items-center gap-1 bg-transparent shrink-0"
                    title="Quick check-in a new random patient for consultation"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Check-in Walk-in</span>
                  </button>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/30 text-indigo-700 dark:text-indigo-400 rounded-full font-mono shrink-0">
                    {filteredPatients.length} {selectedMetric === 'completed' ? 'Completed' : selectedMetric === 'active' ? 'Active' : 'Total'}
                  </span>
                </div>
              </div>

              {/* Search Patient in Queue */}
              <div className="relative mb-3">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search patient name or token…"
                  className="w-full bg-slate-50 border border-slate-200 text-[11px] pl-8 pr-8 py-1.5 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-all"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2 text-slate-400 hover:text-slate-700 cursor-pointer border-0 bg-transparent">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[300px] pr-0.5">
                {isLoading ? (
                  <>
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                  </>
                ) : filteredPatients.length === 0 ? (
                  <ZeroQueueState queueType="patient_queue" className="mx-0" />
                ) : (
                  filteredPatients.map(p => (
                    <div
                      key={p.id}
                      className="p-3 bg-slate-50/80 dark:bg-slate-900/40 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/20 border border-slate-200/70 dark:border-white/5 hover:border-indigo-300 dark:hover:border-indigo-800/50 rounded-xl flex items-center justify-between gap-3 transition-all duration-300 hover:scale-[1.015] hover:shadow-xs"
                    >
                      <div className="truncate">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{p.name}</span>
                          {p.syncStatus === 'pending' && (
                            <span title="Syncing to Supabase..."><RefreshCw className="w-3 h-3 text-amber-500 animate-spin" /></span>
                          )}
                          {p.syncStatus === 'failed' && (
                            <span title="Sync failed. Auto-retrying..."><AlertTriangle className="w-3 h-3 text-rose-500 animate-pulse" /></span>
                          )}
                          {p.tokenNumber && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 rounded border border-indigo-200 dark:border-indigo-800/30">
                              {p.tokenNumber}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                          {p.age ? `${p.age}y` : 'Adult'} · {p.gender || 'Patient'} · {(p.chronicConditions || []).join(', ') || 'General Checkup'}
                        </div>
                      </div>
                      {onStartConsultation && (
                        <button
                          onClick={() => onStartConsultation(p)}
                          className={`px-3 py-1.5 bg-gradient-to-r ${
                            p.queueStatus === 'completed' 
                              ? 'from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 hover:from-emerald-600 hover:to-emerald-700 text-white' 
                              : 'from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700 hover:from-indigo-600 hover:to-indigo-700 dark:hover:from-indigo-555 dark:hover:to-indigo-650 text-white'
                          } rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer border-0 shadow-[0_2px_4px_rgba(79,70,229,0.15)] whitespace-nowrap`}
                        >
                          {p.queueStatus === 'completed' ? 'Review' : 'Consult'}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Patient Triage & Vitals Monitor */}
          <div className="bg-white/90 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/5 rounded-2xl shadow-xs overflow-hidden backdrop-blur-md">
            <div className="h-1 w-full bg-rose-500" />
            <div className="p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-rose-500 shrink-0" />
                  Triage Alerts & Vitals
                </h2>
                <span className="text-[10px] font-bold px-2.5 py-0.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/30 text-rose-700 dark:text-rose-400 rounded-full font-mono">
                  {criticalPatients.length} Alerts
                </span>
              </div>

              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-0.5">
                {criticalPatients.length === 0 ? (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-400 text-xs text-center rounded-xl flex items-center justify-center gap-2 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    All waiting patients are stable
                  </div>
                ) : (
                  criticalPatients.map(p => {
                    const alerts = checkVitalsAlerts(p.vitals);
                    return (
                      <div key={p.id} className="p-3 bg-rose-50/20 dark:bg-rose-950/10 hover:bg-rose-50/40 dark:hover:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl space-y-1.5 transition-all duration-300 hover:scale-[1.015] hover:shadow-xs">
                        <div className="flex justify-between items-center">
                          <div className="truncate">
                            <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate">{p.name}</span>
                            <span className="text-[9px] text-slate-500 dark:text-zinc-400 font-mono">Token: {p.tokenNumber || '—'}</span>
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
                            <span key={`alert-chip-${idx}-${al}`} className="text-[8px] font-bold px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800/30 text-rose-600 dark:text-rose-400 rounded font-mono">
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
          <div className="bg-white/90 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/5 rounded-2xl shadow-xs overflow-hidden backdrop-blur-md">
            <div className="h-1 w-full bg-teal-500" />
            <div className="p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-teal-500 shrink-0" />
                  Lab Reports Sign-Off
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={restockAllReagents}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/5 rounded-lg text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-white transition-all cursor-pointer text-[10px] font-bold flex items-center gap-1 bg-transparent shrink-0"
                    title="Restock Lab Reagents (+500ml)"
                  >
                    <TestTube2 className="w-3.5 h-3.5 shrink-0" />
                    Restock Reagents
                  </button>
                  <span className="text-[10px] font-bold font-mono px-2.5 py-0.5 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/30 text-teal-700 dark:text-teal-400 rounded-full shrink-0">
                    {pendingReports.length} Pending
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-0.5">
                {pendingReports.length === 0 ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs text-center rounded-xl flex items-center justify-center gap-2 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
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
          <div className="bg-white/90 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/5 rounded-2xl shadow-xs overflow-hidden backdrop-blur-md">
            <div className="h-1 w-full bg-violet-500" />
            <div className="p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Pill className="w-4 h-4 text-violet-500 shrink-0" />
                  E-Rx Fulfillment
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={restockPharmacyOOS}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/5 rounded-lg text-violet-700 dark:text-violet-400 hover:text-violet-850 transition-all cursor-pointer text-[10px] font-bold flex items-center gap-1 bg-transparent shrink-0"
                    title="Restock Low Stock Pharmacy SKUs (+100 items)"
                  >
                    <Package className="w-3.5 h-3.5 shrink-0" />
                    Restock SKUs
                  </button>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-850/30 text-violet-700 dark:text-violet-400 rounded-full font-mono shrink-0">
                    {groupedHolds.filter(g => g.status === 'held').length} Pending
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-0.5">
                {groupedHolds.filter(g => g.status === 'held').length === 0 ? (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-400 text-xs text-center rounded-xl flex items-center justify-center gap-2 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    All prescriptions dispensed
                  </div>
                ) : (
                  groupedHolds.filter(g => g.status === 'held').map((group, idx) => (
                    <div key={`group-hold-${idx}-${group.patientName}`} className="p-3 bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/70 dark:border-white/5 rounded-xl space-y-2 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-all duration-300 hover:scale-[1.015] hover:shadow-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[150px]">{group.patientName}</span>
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider font-mono bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/30 text-amber-700 dark:text-amber-400 shrink-0">
                          Held
                        </span>
                      </div>
                      <div className="text-[9px] text-slate-600 dark:text-zinc-350 bg-white dark:bg-slate-950/40 border border-slate-100 dark:border-white/5 p-2 rounded-lg space-y-1">
                        {group.medicines.map((m, mIdx) => (
                          <div key={`med-hold-${mIdx}-${m.id || m.name}`} className="flex justify-between items-center">
                            <span className="truncate max-w-[165px] font-medium">{m.name}</span>
                            <span className="text-[8px] text-slate-500 dark:text-zinc-400 font-mono font-semibold shrink-0">Qty: {m.qty}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => dispensePatientHolds(group.medicines)}
                          className="px-2.5 py-1 text-[9px] font-bold uppercase text-indigo-700 bg-indigo-50 hover:bg-indigo-600 hover:text-white border border-indigo-200 rounded-md transition-all cursor-pointer border-0"
                        >
                          Dispense
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── COLUMN 3: CHRONIC CARE & PATIENT INQUIRIES ─────────── */}
        <div className="space-y-5">

          {/* Chronic Disease Care & Refill Cockpit Widget */}
          <PointerGlowCard
            containerClassName="shadow-xs overflow-hidden"
            className="bg-white/90 dark:bg-slate-950/60 p-5 relative text-left"
          >
            <div className="h-1 w-full bg-emerald-500 absolute top-0 left-0" />
            <div className="flex justify-between items-center mb-4">
              <h2 
                onClick={() => {
                  if (onOpenChronicCare) onOpenChronicCare();
                  else window.dispatchEvent(new CustomEvent('mediflow-change-tab', { detail: 'chronic' }));
                }}
                className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                <HeartPulse className="w-4 h-4 text-emerald-500 shrink-0" />
                Chronic Care &amp; Refills
              </h2>
              <button
                onClick={() => {
                  if (onOpenChronicCare) onOpenChronicCare();
                  else window.dispatchEvent(new CustomEvent('mediflow-change-tab', { detail: 'chronic' }));
                }}
                className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-2 py-0.5 rounded-full flex items-center gap-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all cursor-pointer"
              >
                <Sparkles className="w-3 h-3" /> Auto-Refills Active
              </button>
            </div>

            {/* KPI Cards: Chronic Pool, Adherence, Due Refills */}
            {(() => {
              const poolCount = chronicCohorts.length;
              const avgAdh = poolCount > 0 
                ? (chronicCohorts.reduce((s, c) => s + (Number(c.adherenceScore) || 0), 0) / poolCount).toFixed(1) + '%'
                : '100%';
              const dueRefills = chronicCohorts.filter(c => {
                if (!c.nextRefillDate) return false;
                const d = Math.ceil((new Date(c.nextRefillDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return d <= 7;
              }).length;

              const diaCount = chronicCohorts.filter(c => c.conditionCode === 'DIABETES').length;
              const htnCount = chronicCohorts.filter(c => c.conditionCode === 'HYPERTENSION').length;
              const thyCount = chronicCohorts.filter(c => c.conditionCode === 'THYROID').length;
              const ckdCount = chronicCohorts.filter(c => c.conditionCode === 'CKD' || c.conditionCode === 'CARDIAC').length;

              const defaulters = chronicCohorts.filter(c => {
                if (!c.nextRefillDate) return false;
                const d = Math.ceil((new Date(c.nextRefillDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return d < 0;
              });

              return (
                <>
                  <div className="grid grid-cols-3 gap-2.5 mb-4">
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-200/75 dark:border-white/5 rounded-xl text-center shadow-xs">
                      <div className="text-[8.5px] text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">Chronic Pool</div>
                      <div className="text-sm font-bold font-mono mt-0.5 text-slate-900 dark:text-white">{poolCount}</div>
                    </div>
                    <div className="p-2.5 bg-teal-50 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-800/30 rounded-xl text-center shadow-xs">
                      <div className="text-[8.5px] text-teal-600 dark:text-teal-400 font-semibold uppercase tracking-wider">Adherence</div>
                      <div className="text-sm font-bold font-mono mt-0.5 text-teal-700 dark:text-teal-400">{avgAdh}</div>
                    </div>
                    <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30 rounded-xl text-center shadow-xs">
                      <div className="text-[8.5px] text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wider">Due Refills</div>
                      <div className="text-sm font-bold font-mono mt-0.5 text-amber-700 dark:text-amber-450">{dueRefills}</div>
                    </div>
                  </div>

                  {/* Disease Cohort Badges */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-200/70 dark:border-white/5 rounded-xl space-y-2 mb-3">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex justify-between">
                      <span>Active Disease Cohorts</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono">100% Retest Triggers</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[10px]">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-medium">🩸 Diabetes ({diaCount})</span>
                      <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 font-medium">🫀 HTN ({htnCount})</span>
                      <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 font-medium">🦋 Thyroid ({thyCount})</span>
                      <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 font-medium">🧪 CKD / Cardio ({ckdCount})</span>
                    </div>
                  </div>

                  {/* Refill Defaulter Urgent Alerts */}
                  <div className="p-3 bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/30 rounded-xl space-y-2 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Refill Defaulters (Missed &gt;7d)
                      </span>
                      <span className="text-[9px] font-mono font-bold text-rose-600">{defaulters.length} High Risk</span>
                    </div>
                    {defaulters.length === 0 ? (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 py-1 font-medium">
                        All chronic patients up to date with medicine refills.
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-700 dark:text-slate-200 space-y-1">
                        {defaulters.slice(0, 3).map((def) => (
                          <div key={def.id} className="flex justify-between items-center">
                            <span className="truncate max-w-[140px]">{def.patientName} ({def.conditionCode})</span>
                            <button
                              onClick={() => {
                                window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                  detail: {
                                    title: 'Defaulter Nudge Sent 📱',
                                    message: `1-Tap WhatsApp Refill Nudge sent to ${def.patientName}.`,
                                    type: 'success'
                                  }
                                }));
                              }}
                              className="px-2 py-0.5 text-[8.5px] font-bold uppercase bg-rose-600 hover:bg-rose-700 text-white rounded cursor-pointer border-0"
                            >
                              1-Tap Nudge
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}

            {/* Direct CTA to full Chronic Care Cockpit */}
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('mediflow-change-tab', { detail: 'chronic' }));
              }}
              className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer border-0"
            >
              <HeartPulse className="w-3.5 h-3.5" /> View Full Chronic Care Suite
            </button>
          </PointerGlowCard>

          {/* Patient Inquiries Feed */}
          <div className="bg-white/90 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/5 rounded-2xl shadow-xs overflow-hidden backdrop-blur-md">
            <div className="h-1 w-full bg-indigo-500" />
            <div className="p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-500 shrink-0" />
                  Patient Inquiries Feed
                </h2>
                {sessions.filter(s => s.currentState === 'FAILED_DELIVERY').length > 0 && (
                  <button
                    onClick={triggerFailedMessageRetry}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/5 rounded-lg text-rose-600 dark:text-rose-455 transition-all cursor-pointer text-[10px] font-bold flex items-center gap-1 bg-transparent shrink-0"
                    title="Flush and retry all failed messages"
                  >
                    <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                    Retry Failed ({sessions.filter(s => s.currentState === 'FAILED_DELIVERY').length})
                  </button>
                )}
              </div>

              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-0.5">
                {patientInquiries.length === 0 ? (
                  <div className="text-center py-6 text-slate-450 dark:text-zinc-500 text-xs italic">
                    No incoming clinical queries.
                  </div>
                ) : (
                  patientInquiries.map(m => (
                    <div key={m.id} className="p-3 bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/70 dark:border-white/5 rounded-xl space-y-2 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-all duration-300 hover:scale-[1.015] hover:shadow-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white">{m.patientName}</span>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider border ${
                          m.status === 'AWAITING_PAYMENT' ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/30 text-amber-700 dark:text-amber-450' :
                          m.status === 'COMPLETED' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-400' :
                          'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-600 dark:text-zinc-400'
                        }`}>{m.status.replace(/_/g, ' ')}</span>
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-zinc-350 leading-relaxed italic line-clamp-2 bg-white dark:bg-slate-950/40 border border-slate-100 dark:border-white/5 p-2 rounded-lg">
                        "{m.text}"
                      </p>
                      <div className="flex justify-end">
                        <button
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('mediflow-change-tab', { detail: 'whatsapp' }));
                          }}
                          className="px-2.5 py-1 bg-gradient-to-r from-indigo-50 to-indigo-100 dark:from-indigo-950/30 dark:to-indigo-900/30 border border-indigo-200 dark:border-indigo-800/30 text-indigo-700 dark:text-indigo-400 rounded text-[9px] font-bold uppercase hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
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
      </div>

      {/* ── BOTTOM ALERT BANNER ──────────────────────────────────── */}
      {criticalPatients.length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/30 p-4 rounded-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xs">
          <div className="absolute top-0 left-0 w-full h-1 bg-rose-500" />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-455 animate-pulse shrink-0" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-800 dark:text-rose-400">Critical Triage Alert</h3>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
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
              className="px-3.5 py-2 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer border-0 shadow-sm"
            >
              Consult High-Priority Patient
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
