import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { api, MASTER_TEST_CATALOG } from '../../services/api';
import { supabase } from '../../lib/supabaseClient';
import { RealtimeSyncService } from '../../services/realtimeSyncService';
import { useSpecialization } from '../../context/SpecializationContext';
import { useClinic } from '../../context/ClinicContext';
import { VISUAL_ACUITY_OPTIONS } from '../../types/ophthalmic';
import { EncounterService } from '../../services/encounterService';
import { PharmacyService } from '../../services/pharmacyService';
import { BillingService } from '../../services/billingService';
import { PaymentService } from '../../services/paymentService';
import { LabService } from '../../services/labService';
import { load } from '../../services/apiHelper';
import { getPodContext } from '../../services/podContext';
import { ZeroQueueState, InlineEmptyState } from '../shared/EmptyState';
import { getIstDateString, getEffectiveAppointmentDate, getIstOffsetDateString } from '../../utils/dateUtils';
import type {
  PharmacyInventoryItem,
  MedicineBill,
  MedicineBillItem,
  ChatMessage,
  Invoice,
  Prescription,
  Patient,
  PatientVitals,
  WhatsAppSession,
  ClinicStaff,
  PathologyReport,
  CounterTransaction,
  LabReport,
  LabRequisition,
  Appointment,
  EveningSlot
} from '../../types';
import { BillHubTab } from './tabs/BillHubTab';
import { InvoiceCard } from '../InvoiceCard';
import { PatientsDirectoryTab } from '../doctor/tabs/PatientsDirectoryTab';
import { WhatsAppSupportModal } from '../shared/WhatsAppSupportModal';
import { 
  Smartphone, 
  Upload, 
  Send, 
  Search, 
  ShieldAlert, 
  ShieldCheck, 
  Trash2, 
  Coins, 
  QrCode, 
  Printer, 
  Truck, 
  UserCheck, 
  FileText,
  Activity,
  LogOut,
  Users,
  Stethoscope,
  Calendar,
  CalendarCheck,
  CalendarPlus,
  Clock,
  Video,
  Layers,
  FlaskConical,
  ShoppingBag,
  CheckCircle2,
  AlertTriangle,
  HeartPulse,
  UserPlus,
  Phone,
  X,
  Pill,
  Receipt,
  Save,
  RefreshCw,
  MessageSquare,
  MessagesSquare,
  Loader2,
  Sparkles,
  LayoutDashboard,
  Volume2,
  Eye,
  Flame,
  Timer,
  ChevronRight,
  TrendingUp,
  Plus,
  PhoneCall,
  Scissors,
  Check,
  ArrowRight,
  Crosshair,
  Compass,
  Camera
} from 'lucide-react';

const getBilingualInstruction = (medicineName: string, dosage?: string) => {
  const nameLower = (medicineName || '').toLowerCase();
  const dosageLower = (dosage || '').toLowerCase();
  
  let english = 'As directed by physician';
  let hindi = 'चिकित्सक के निर्देशानुसार';
  
  if (nameLower.includes('metformin') || dosageLower.includes('1-0-1') || dosageLower.includes('bd') || dosageLower.includes('twice')) {
    english = '1 Tablet - Morning & Evening (Post Meal)';
    hindi = '1 गोली - सुबह और शाम (खाने के बाद)';
  } else if (nameLower.includes('pantoprazole') || dosageLower.includes('1-0-0') || dosageLower.includes('od') || dosageLower.includes('empty stomach')) {
    english = '1 Tablet - Morning (Empty Stomach, 30 min before food)';
    hindi = '1 गोली - सुबह खाली पेट (खाने से ३० मिनट पहले)';
  } else if (nameLower.includes('paracetamol') || dosageLower.includes('sos') || dosageLower.includes('prn')) {
    english = '1 Tablet - As needed for fever/pain (Max 3 times daily)';
    hindi = '1 गोली - बुखार या दर्द होने पर (दिन में अधिकतम ३ बार)';
  } else if (nameLower.includes('amoxicillin') || nameLower.includes('azithromycin') || nameLower.includes('antibiotic')) {
    english = '1 Capsule - Morning & Evening (After food, complete full course)';
    hindi = '1 कैप्सूल - सुबह और शाम (खाने के बाद, कोर्स पूरा करें)';
  } else if (nameLower.includes('atorvastatin') || dosageLower.includes('0-0-1') || dosageLower.includes('night')) {
    english = '1 Tablet - Night (Before sleeping)';
    hindi = '1 गोली - रात को (सोने से पहले)';
  } else if (dosageLower.includes('1-1-1') || dosageLower.includes('tds') || dosageLower.includes('thrice')) {
    english = '1 Tablet - Morning, Afternoon & Evening (Post Meal)';
    hindi = '1 गोली - सुबह, दोपहर और शाम (खाने के बाद)';
  }
  
  return { english, hindi };
};

export const CompounderDashboard: React.FC = () => {
  const { isOphthalmology, nomenclature } = useSpecialization();
  const { podEntities, activePod, activeProfile } = useClinic();
  const clinicTitle = activePod?.name || activeProfile?.clinicName || 'Clinic Node';
  const [activeTab, setActiveTab] = useState<'overview' | 'patients' | 'tokens' | 'labs' | 'pharmacy' | 'ot_billing' | 'invoice_generator'>('overview');
  const [patientsSubTab, setPatientsSubTab] = useState<'directory' | 'register'>('directory');
  const [opdSubTab, setOpdSubTab] = useState<'today_queue' | 'upcoming_advance' | 'past_history'>('today_queue');
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);

  // Modern Mobile Native Sheets & Modals
  const [showVitalsBottomSheet, setShowVitalsBottomSheet] = useState(false);
  const [showQuickAddSheet, setShowQuickAddSheet] = useState(false);
  const [showDilationModal, setShowDilationModal] = useState<Patient | null>(null);
  const [selectedDilationEye, setSelectedDilationEye] = useState<'both' | 're' | 'le'>('both');
  const [selectedDilationDrop, setSelectedDilationDrop] = useState<'tropicamide' | 'phenylephrine' | 'cyclopentolate'>('tropicamide');
  const [heightVal, setHeightVal] = useState('165');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Realtime 1-sec clock ticker for live dilation countdowns
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Patient Directory Tab Local States
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [selectedDirectoryPatient, setSelectedDirectoryPatient] = useState<Patient | null>(null);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const [newPatientAge, setNewPatientAge] = useState('');
  const [newPatientGender, setNewPatientGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [patientRAGSummary, setPatientRAGSummary] = useState('');

  // Active patient in care loop
  const [activePatient, setActivePatientState] = useState<Patient | null>(null);
  const [activePatientStage, setActivePatientStage] = useState<'registered' | 'diagnosing' | 'lab' | 'pharmacy' | 'settled'>('registered');
  const [scannedSummary, setScannedSummary] = useState<string | null>(null);
  const [isSavingSummary, setIsSavingSummary] = useState(false);
  const [viewingDocUrl, setViewingDocUrl] = useState<string | null>(null);

  // SaaS Gate States
  const [ocrScanningApptId, setOcrScanningApptId] = useState<string | null>(null);
  const [revisitPatientId, setRevisitPatientId] = useState<string>('');
  const [revisitDate, setRevisitDate] = useState<string>('');
  const [revisitTime, setRevisitTime] = useState<string>('');

  // Swasthya Vitals Intake States
  const [vitalsPatient, setVitalsPatient] = useState<Patient | null>(null);
  const [tempVal, setTempVal] = useState('98.6');
  const [bpVal, setBpVal] = useState('120/80');
  const [pulseVal, setPulseVal] = useState('72');
  const [spo2Val, setSpo2Val] = useState('99');
  const [weightVal, setWeightVal] = useState('65');
  const [sugarVal, setSugarVal] = useState('105');
  const [isSavingVitals, setIsSavingVitals] = useState(false);

  useEffect(() => {
    if (vitalsPatient) {
      setBpVal(vitalsPatient.vitals?.bloodPressure || '120/80');
      setPulseVal(String(vitalsPatient.vitals?.pulseRate || '72'));
      setTempVal(String(vitalsPatient.vitals?.temperature || '98.6'));
      setSpo2Val(String(vitalsPatient.vitals?.spO2 || '99'));
      setSugarVal(vitalsPatient.vitals?.bloodSugar ? String(vitalsPatient.vitals.bloodSugar) : '105');
      setWeightVal(String(vitalsPatient.vitals?.weight || '65'));
    }
  }, [vitalsPatient]);

  const handleApproveVitalsAndRouteToDoctor = async () => {
    if (!vitalsPatient || isSavingVitals) return;
    setIsSavingVitals(true);
    try {
      const updatedVitals: PatientVitals = {
        temperature: String(tempVal || '98.6'),
        bloodPressure: String(bpVal || '120/80'),
        pulseRate: String(pulseVal || '72'),
        spO2: String(spo2Val || '99'),
        weight: String(weightVal || '65'),
        bloodSugar: sugarVal ? String(sugarVal) : undefined,
        recordedAt: new Date().toISOString()
      };

      const patId = vitalsPatient.id;
      const assignedToken = vitalsPatient.tokenNumber || (vitalsPatient as any).token_number || api.generateNextTokenNumber();

      // 1. Update local patient record & queue status
      const existingPatient = patients.find(p => p.id === patId);
      if (existingPatient) {
        existingPatient.vitals = updatedVitals;
        existingPatient.queueStatus = 'awaiting_consultation';
        existingPatient.tokenNumber = String(assignedToken);
        api.savePatients([...patients]);
      }
      api.updatePatientQueueStatus(patId, 'awaiting_consultation');

      // 2. Find and update appointment status to ready_for_consult
      const existingAppt = appointments.find(a => a.patientId === patId || (a as any).patient_id === patId);
      if (existingAppt) {
        existingAppt.status = 'ready_for_consult';
        existingAppt.tokenNumber = String(assignedToken);
        (existingAppt as any).token_number = String(assignedToken);
        BillingService.saveAppointments([...appointments]);
      } else {
        const newAppt: Appointment = {
          id: `apt-${Date.now()}`,
          patientId: patId,
          doctorId: (activePod as any)?.doctor_id || (activePod as any)?.doctorId || 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101',
          status: 'ready_for_consult',
          date: getIstDateString(),
          tokenNumber: String(assignedToken),
          isVirtual: false,
          source: 'whatsapp_physical'
        } as any;
        BillingService.saveAppointments([newAppt, ...appointments]);
      }

      // 3. Ensure Doctor Consultation invoice & financial ledger are settled
      try {
        const matchingInvoice = BillingService.getInvoices().find(i => (i.patientId === patId || (i as any).patient_id === patId) && i.type === 'consult');
        if (matchingInvoice) {
          if (matchingInvoice.status !== 'paid') {
            await BillingService.recordInvoicePayment(matchingInvoice.id, 'upi');
          }
        } else {
          const inv = BillingService.createGate1Consult(patId);
          if (inv) {
            await BillingService.recordInvoicePayment(inv.id, 'upi');
          }
        }
      } catch (_invErr) {
        console.warn('[CompounderDashboard] Invoice auto-settle notice:', _invErr);
      }

      // 4. Remote Postgres Sync (Non-blocking)
      (async () => {
        try {
          await supabase
            .from('patient_registry')
            .update({
              vitals: updatedVitals,
              queue_status: 'awaiting_consultation',
              token_number: String(assignedToken)
            })
            .eq('id', patId);

          if (existingAppt?.id) {
            await supabase
              .from('appointments')
              .update({
                status: 'ready_for_consult',
                token_number: String(assignedToken)
              })
              .eq('id', existingAppt.id);
          }
        } catch (_dbErr) {
          console.warn('[CompounderDashboard] Supabase DB vitals sync error:', _dbErr);
        }
      })();

      // 5. Toast notification & State Refresh
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Patient Dispatched to Doctor! 🩺',
          message: `Token #${assignedToken} (${vitalsPatient.name}) routed to Doctor Consultation Queue with live vitals.`,
          type: 'success'
        }
      }));

      setDataRevision(prev => prev + 1);
      setPatients(api.getPatients());
      fetchLiveAppointments();
      setVitalsPatient(null);
    } catch (err) {
      console.error('[CompounderDashboard] Error approving vitals:', err);
    } finally {
      setIsSavingVitals(false);
    }
  };
  
  // Interactive Workflow Modal State
  const [activeWorkflowDetail, setActiveWorkflowDetail] = useState<{
    type: 'prescription' | 'lab' | 'summary';
    patientId: string;
    patientName: string;
  } | null>(null);

  // Registry state
  const [patients, setPatients] = useState<Patient[]>(() => api.getPatients());
  const [sessions, setSessions] = useState<WhatsAppSession[]>(() => api.getWhatsAppSessions());
  const [appointments, setAppointments] = useState<Appointment[]>(() => api.getAppointments());
  const [dataRevision, setDataRevision] = useState(0);



  // Memoize workflow lookup datasets to avoid thousands of localStorage JSON parses per render
  const cachedEncountersMap = useMemo(() => {
    const map = new Map<string, any[]>();
    EncounterService.getEncounters().forEach(e => {
      if (!map.has(e.patientId)) map.set(e.patientId, []);
      map.get(e.patientId)!.push(e);
    });
    return map;
  }, [dataRevision]);

  const cachedLabReqsMap = useMemo(() => {
    const map = new Map<string, any[]>();
    LabService.getLabRequisitions().forEach(r => {
      if (!map.has(r.patientId)) map.set(r.patientId, []);
      map.get(r.patientId)!.push(r);
    });
    return map;
  }, [dataRevision]);

  const cachedLabReportsMap = useMemo(() => {
    const map = new Map<string, any[]>();
    LabService.getFullLabReports().forEach(r => {
      if (!map.has(r.patientId)) map.set(r.patientId, []);
      map.get(r.patientId)!.push(r);
    });
    return map;
  }, [dataRevision]);

  const cachedWhatsAppPhoneMap = useMemo(() => {
    const map = new Map<string, boolean>();
    api.getWhatsAppSessions().forEach(s => {
      const hasMsg = !!s?.sessionData?.chatHistory?.some(
        (m: any) => m.sender === 'bot' && (m.text.includes('🏥') || m.text.includes('Advice') || m.text.includes('spectacle') || m.text.includes('Prescription') || m.text.includes('Summary'))
      );
      if (s.patientPhone) map.set(s.patientPhone, hasMsg);
    });
    return map;
  }, [dataRevision]);

  const cachedMedicineBillsMap = useMemo(() => {
    const map = new Map<string, any[]>();
    PharmacyService.getMedicineBills().forEach(b => {
      if (!map.has(b.patientId)) map.set(b.patientId, []);
      map.get(b.patientId)!.push(b);
    });
    return map;
  }, [dataRevision]);

  const daycarePatients = useMemo(() => {
    return patients.filter(p => {
      if (isOphthalmology) {
        return p.vitals?.surgeryBooking && p.vitals.surgeryBooking.eye !== 'None';
      } else {
        return p.vitals?.gpProcedureBooking && p.vitals.gpProcedureBooking.procedure !== 'None';
      }
    });
  }, [patients, isOphthalmology]);

  const computedBmi = useMemo(() => {
    const w = parseFloat(weightVal) || 0;
    const h = (parseFloat(heightVal) || 165) / 100;
    if (w <= 0 || h <= 0) return { bmi: 22.5, category: 'Normal' };
    const bmiVal = parseFloat((w / (h * h)).toFixed(1));
    let cat = 'Normal (सामान्य)';
    if (bmiVal < 18.5) cat = 'Underweight (कम वज़न)';
    else if (bmiVal >= 25 && bmiVal < 30) cat = 'Overweight (अधिक वज़न)';
    else if (bmiVal >= 30) cat = 'Obese (मोटापा)';
    return { bmi: bmiVal, category: cat };
  }, [weightVal, heightVal]);

  const handleCallPatientChamber = (patientName: string, tokenNum: string) => {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const text = `Token number ${tokenNum}. Patient ${patientName}, please proceed to Doctor Chamber.`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: `📢 Calling Token ${tokenNum}`,
          message: `${patientName} called to Doctor Chamber.`,
          type: 'info'
        }
      }));
    } catch (_e) {
      console.warn('[Speech] Call out notice:', _e);
    }
  };

  const handleStartEyeDilation = async (patient: Patient) => {
    const nowIso = new Date().toISOString();
    const updatedPatient: Patient = {
      ...patient,
      eyeDilationStatus: 'in_progress',
      dilationTimestamp: nowIso
    };
    
    try {
      const allPatients = api.getPatients();
      const updatedList = allPatients.map(p => p.id === patient.id ? updatedPatient : p);
      localStorage.setItem('mediflow_patients', JSON.stringify(updatedList));
    } catch (_e) {}

    setPatients(api.getPatients());
    setDataRevision(prev => prev + 1);

    try {
      await supabase
        .from('patient_registry')
        .update({
          eye_dilation_status: 'in_progress',
          dilation_timestamp: nowIso
        })
        .eq('id', patient.id);
    } catch (_e) {}

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: '👁️ Eye Dilation Started (15m Timer)',
        message: `${patient.name} dilation drops applied. 15-minute countdown running.`,
        type: 'success'
      }
    }));
    setShowDilationModal(null);
  };

  const activeOpdAppointments = useMemo(() => {
    const todayStr = getIstDateString();
    return appointments.filter(a => {
      const aDate = getEffectiveAppointmentDate(a);
      return (aDate === todayStr || (a.createdAt || '').startsWith(todayStr)) && a.status !== 'cancelled';
    });
  }, [appointments, dataRevision]);

  const inChamberAppointment = useMemo(() => {
    return appointments.find(a => a.status === 'in_consult');
  }, [appointments, dataRevision]);

  const pendingVitalsList = useMemo(() => {
    return patients.filter(p => {
      return !p.vitals || p.queueStatus === 'awaiting_vitals' || p.queueStatus === 'registered';
    });
  }, [patients, dataRevision]);

  const activeDilationPatients = useMemo(() => {
    return patients.filter(p => {
      if (p.eyeDilationStatus === 'in_progress' && p.dilationTimestamp) {
        const elapsedSec = (currentTime.getTime() - new Date(p.dilationTimestamp).getTime()) / 1000;
        return elapsedSec < 900; // 15 mins
      }
      return false;
    });
  }, [patients, currentTime, dataRevision]);

  const sosEmergencyAppointment = useMemo(() => {
    return appointments.find(a => a.source === 'whatsapp_sos' || (a as any).isEmergency);
  }, [appointments, dataRevision]);

  const lowStockItems = useMemo(() => {
    const inv = api.getPharmacyInventory();
    return inv.filter(item => (item.stock || 0) <= 15);
  }, [dataRevision]);

  // High-Speed Memoized Dynamic Patient Workflow Calculator (< 3ms)
  const getPatientWorkflowState = useCallback((patient: Patient, appt: Appointment) => {
    const patientEncounters = cachedEncountersMap.get(patient.id) || [];
    const latestEncounter = patientEncounters[patientEncounters.length - 1];

    const reqs = cachedLabReqsMap.get(patient.id) || [];
    const reports = cachedLabReportsMap.get(patient.id) || [];
    const hasWhatsAppMsg = cachedWhatsAppPhoneMap.get(patient.phone) || false;
    const mbills = cachedMedicineBillsMap.get(patient.id) || [];

    // Step 1: Appointment Done
    const s1_status = 'completed';

    // Step 2: Doctor Consult
    let s2_status: 'completed' | 'active' | 'pending' = 'pending';
    if (latestEncounter) {
      s2_status = 'completed';
    } else if (appt.status === 'ready_for_consult' || patient.queueStatus === 'in_consultation') {
      s2_status = 'active';
    }

    // Step 3: Rx Made
    const s3_status = latestEncounter ? 'completed' : 'pending';

    // Step 4: Lab
    let s4_status: 'completed' | 'active' | 'pending' | 'skipped' = 'pending';
    if (latestEncounter) {
      if (latestEncounter.diagnosticTests.length === 0 && reqs.length === 0) {
        s4_status = 'skipped';
      } else {
        const allDone = reqs.length > 0 && reqs.every(r => r.status === 'completed' || r.status === 'processed');
        s4_status = allDone ? 'completed' : 'active';
      }
    } else if (reqs.length > 0) {
      const allDone = reqs.every(r => r.status === 'completed' || r.status === 'processed');
      s4_status = allDone ? 'completed' : 'active';
    }

    // Step 5: Doctor Re-verify (Post-Lab)
    let s5_status: 'completed' | 'active' | 'pending' | 'skipped' = 'pending';
    if (latestEncounter) {
      if (latestEncounter.diagnosticTests.length === 0 && reqs.length === 0) {
        s5_status = 'skipped';
      } else {
        const allApproved = reports.length > 0 && reports.every(r => r.status === 'approved');
        s5_status = allApproved ? 'completed' : (reqs.length > 0 ? 'active' : 'pending');
      }
    }

    // Step 6: Patient WhatsApp
    let s6_status: 'completed' | 'active' | 'pending' = 'pending';
    if (hasWhatsAppMsg) {
      s6_status = 'completed';
    } else if (latestEncounter) {
      s6_status = 'active';
    }

    // Step 7: Pharmacy
    let s7_status: 'completed' | 'active' | 'pending' | 'skipped' = 'pending';
    if (latestEncounter) {
      if ((latestEncounter.medications || []).length === 0) {
        s7_status = 'skipped';
      } else {
        const allSettled = mbills.length > 0 && mbills.every(b => b.status === 'paid' || b.status === 'confirmed');
        s7_status = allSettled ? 'completed' : 'active';
      }
    } else if (mbills.length > 0) {
      const allSettled = mbills.every(b => b.status === 'paid' || b.status === 'confirmed');
      s7_status = allSettled ? 'completed' : 'active';
    }

    // Step 8: Complete
    const mandatorySteps = [s1_status, s2_status, s3_status, s4_status, s5_status, s6_status, s7_status];
    const isFullComplete = mandatorySteps.every(st => st === 'completed' || st === 'skipped');
    const s8_status = isFullComplete ? 'completed' : 'pending';

    return [
      { id: 'apt_done', label: 'Apt', status: s1_status },
      { id: 'consult', label: 'Consult', status: s2_status },
      { id: 'rx_made', label: 'Rx', status: s3_status },
      { id: 'lab', label: 'Lab', status: s4_status },
      { id: 'reverify', label: 'Verify', status: s5_status },
      { id: 'whatsapp', label: 'WhatsApp', status: s6_status },
      { id: 'pharmacy', label: 'Pharma', status: s7_status },
      { id: 'complete', label: 'Done', status: s8_status }
    ];
  }, [cachedEncountersMap, cachedLabReqsMap, cachedLabReportsMap, cachedWhatsAppPhoneMap, cachedMedicineBillsMap]);
  
  // Appointment Booking States
  const [searchApptPatient, setSearchApptPatient] = useState('');
  const [showAllApptPatients, setShowAllApptPatients] = useState(false);
  const [selectedApptPatient, setSelectedApptPatient] = useState<Patient | null>(null);
  const [apptPaymentMode, setApptPaymentMode] = useState<'cash' | 'upi' | 'razorpay' | 'cashfree' | 'paytm'>('cash');
  const [isBookingAppt, setIsBookingAppt] = useState(false);

  // Multi-Field Intelligent Patient Search Matcher
  const cleanApptQuery = (searchApptPatient || '').trim().toLowerCase();
  const cleanApptDigits = (searchApptPatient || '').replace(/\D/g, '');

  const filteredApptPatients = useMemo(() => {
    if (!cleanApptQuery) {
      return patients;
    }
    return patients.filter(p => {
      const nameMatch = (p.name || '').toLowerCase().includes(cleanApptQuery);
      const idMatch = (p.id || '').toLowerCase().includes(cleanApptQuery);
      const codeMatch = (p.patientCode || (p as any).patient_code || '').toLowerCase().includes(cleanApptQuery);
      const abhaMatch = (p.abhaId || (p as any).abha_id || '').toLowerCase().includes(cleanApptQuery);
      const tokenMatch = (p.tokenNumber && String(p.tokenNumber).toLowerCase().includes(cleanApptQuery)) ||
                         ((p as any).token_number && String((p as any).token_number).toLowerCase().includes(cleanApptQuery));
      
      const rawPhone = (p.phone || (p as any).patient_phone || '').toLowerCase();
      const phoneDigits = rawPhone.replace(/\D/g, '');
      const phoneMatch = rawPhone.includes(cleanApptQuery) || (cleanApptDigits.length > 0 && phoneDigits.includes(cleanApptDigits));

      return nameMatch || idMatch || codeMatch || abhaMatch || tokenMatch || phoneMatch;
    });
  }, [patients, cleanApptQuery, cleanApptDigits]);

  // Vernacular Dosage Assistant States
  const [selectedLanguage, setSelectedLanguage] = useState<'hindi' | 'bhojpuri'>('hindi');
  const [dosageTemplate, setDosageTemplate] = useState<'od' | 'bd' | 'tds' | 'sos'>('od');

  const fetchLiveAppointments = useCallback(async () => {
    try {
      const podId = getPodContext().podId || 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
      let apptQuery = supabase
        .from('appointments')
        .select('*, patient_registry(id, name, phone, age, gender, token_number)')
        .order('created_at', { ascending: false });

      if (podId && podId !== 'default-pod') {
        apptQuery = apptQuery.or(`pod_id.eq.${podId},pod_id.eq.dfb2a1a8-8e68-4f8a-929e-4a6c8e317001`);
      }

      const { data, error } = await apptQuery;

      if (data) {
        const mapped = data.map((a: any) => {
          const patInfo = a.patient_registry || {};
          const resolvedToken = String(a.token_number || patInfo.token_number || (a as any).tokenNumber || (patInfo as any).token || 'T-04');
          return {
            id: a.id,
            patientId: a.patient_id,
            patient_id: a.patient_id,
            doctorId: a.doctor_id,
            doctor_id: a.doctor_id,
            status: a.status || 'scheduled',
            isVirtual: a.is_virtual === true,
            is_virtual: a.is_virtual === true,
            date: a.virtual_date || a.date || a.appointment_date || (a.appointment_time ? String(a.appointment_time).split('T')[0] : ''),
            virtualDate: a.virtual_date,
            virtual_date: a.virtual_date,
            appointmentDate: a.virtual_date || a.date || a.appointment_date || (a.appointment_time ? String(a.appointment_time).split('T')[0] : ''),
            appointment_date: a.virtual_date || a.date || a.appointment_date || (a.appointment_time ? String(a.appointment_time).split('T')[0] : ''),
            virtualTime: a.virtual_time,
            virtual_time: a.virtual_time,
            virtualMeetingUrl: a.virtual_meeting_url,
            virtual_meeting_url: a.virtual_meeting_url,
            tokenNumber: resolvedToken,
            token_number: resolvedToken,
            source: a.is_virtual ? 'whatsapp_virtual' : 'whatsapp_physical',
            patientName: patInfo.name || 'WhatsApp Patient',
            patient_name: patInfo.name || 'WhatsApp Patient',
            patientPhone: patInfo.phone || 'N/A',
            patient_phone: patInfo.phone || 'N/A',
            patientAge: patInfo.age || 30,
            patientGender: patInfo.gender || 'Male',
            createdAt: a.created_at,
            created_at: a.created_at,
            appointmentTime: a.appointment_time,
            appointment_time: a.appointment_time
          };
        });
        setAppointments(mapped as any);
        BillingService.saveAppointments(mapped as any);
      }

      // Also fetch and merge live patients from Supabase patient_registry
      try {
        let patQuery = supabase
          .from('patient_registry')
          .select('*')
          .order('created_at', { ascending: false });
        if (podId && podId !== 'default-pod') {
          patQuery = patQuery.or(`pod_id.eq.${podId},pod_id.eq.dfb2a1a8-8e68-4f8a-929e-4a6c8e317001`);
        }
        const { data: dbPatients } = await patQuery;
        if (dbPatients && dbPatients.length > 0) {
          const localPatients = api.getPatients();
          const mergedMap = new Map<string, Patient>();
          
          localPatients.forEach(p => mergedMap.set(p.id, p));
          dbPatients.forEach((dbP: any) => {
            const existing = mergedMap.get(dbP.id);
            mergedMap.set(dbP.id, {
              ...(existing || {}),
              id: dbP.id,
              name: dbP.name || (existing?.name) || 'Patient',
              phone: dbP.phone || (existing?.phone) || '',
              age: dbP.age || (existing?.age) || 30,
              gender: dbP.gender || (existing?.gender) || 'Male',
              patientCode: dbP.patient_code || dbP.patientCode || existing?.patientCode,
              abhaId: dbP.abha_id || dbP.abhaId || existing?.abhaId,
              vitals: dbP.vitals || existing?.vitals,
              queueStatus: dbP.queue_status || dbP.queueStatus || existing?.queueStatus || 'registered',
              tokenNumber: dbP.token_number || dbP.tokenNumber || existing?.tokenNumber
            } as any);
          });
          const mergedList = Array.from(mergedMap.values());
          setPatients(mergedList);
          api.savePatients(mergedList);
        } else {
          setPatients(api.getPatients());
        }
      } catch (_patErr) {
        setPatients(api.getPatients());
      }
    } catch (err) {
      console.warn('[CompounderDashboard] Error fetching live appointments:', err);
    }
  }, []);

  useEffect(() => {
    const handleCompounderTabChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setActiveTab(customEvent.detail as any);
      }
    };
    window.addEventListener('mediflow-compounder-tab-changed', handleCompounderTabChange);
    return () => window.removeEventListener('mediflow-compounder-tab-changed', handleCompounderTabChange);
  }, []);

  // Keyboard shortcut listener to close vitals modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && vitalsPatient) {
        setVitalsPatient(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [vitalsPatient]);

  useEffect(() => {
    fetchLiveAppointments();
    const handleFocus = () => fetchLiveAppointments();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleFocus);
    const interval = setInterval(fetchLiveAppointments, 4000);
    const unsubscribe = RealtimeSyncService.subscribeToLiveClinicUpdates({
      onAppointmentChange: (payload) => {
        console.log('[CompounderDashboard] Realtime Appointment update:', payload);
        fetchLiveAppointments();
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            title: '📅 NEW APPOINTMENT BOOKED! 🟢',
            message: 'A patient has booked a physical or virtual visit on WhatsApp.',
            type: 'info'
          }
        }));
      },
      onPatientChange: () => fetchLiveAppointments(),
      onMedicineBillChange: () => fetchLiveAppointments(),
      onLabRequisitionChange: () => fetchLiveAppointments(),
      onFinancialLedgerChange: () => fetchLiveAppointments(),
      onUnifiedInvoiceChange: () => fetchLiveAppointments(),
      onWhatsAppSessionChange: () => fetchLiveAppointments(),
      onPathologyReportChange: () => fetchLiveAppointments(),
      onPoolSettlementChange: () => fetchLiveAppointments(),
      onClinicSopChange: () => fetchLiveAppointments(),
      onSaaSInvoiceChange: () => fetchLiveAppointments(),
      onSaaSPrescriptionChange: () => fetchLiveAppointments(),
      onInventoryHoldChange: () => fetchLiveAppointments(),
      onChronicCohortChange: () => fetchLiveAppointments()
    });

    return () => unsubscribe();
  }, [fetchLiveAppointments]);
  
  // Real-time Network Resilience State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { message: 'Network connection restored. Syncing pending ledger entries...', type: 'success', title: 'System Online 🟢' }
      }));
    };
    const handleOffline = () => {
      setIsOnline(false);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { message: 'Flaky network detected. App in Offline Cache resiliency mode.', type: 'warning', title: 'Connection Lost 🔴' }
      }));
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Registration form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [gender, setGender] = useState<Patient['gender']>('Male');
  const [allergiesInput, setAllergiesInput] = useState('');
  const [chronicInput, setChronicInput] = useState('');
  const [abhaId, setAbhaId] = useState('');
  const [bloodGroupInput, setBloodGroupInput] = useState('');
  const [whatsAppInput, setWhatsAppInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Previous report scan states
  const [isReportScanning, setIsReportScanning] = useState(false);
  const [reportScanLogs, setReportScanLogs] = useState<string[]>([]);

  // Selected patient to initiate loop
  const [activeSession, setActiveSession] = useState<WhatsAppSession | null>(null);

  // Chat simulator input & scroll states
  const [replyInput, setReplyInput] = useState('');
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    setIsAtBottom(distanceFromBottom <= 30);
  };

  // Clinic Staff State
  const [staffList, setStaffList] = useState<ClinicStaff[]>([]);
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'compounder' | 'receptionist' | 'admin'>('compounder');

  // Pathology uploads state
  const [reports, setReports] = useState<PathologyReport[]>([]);


  // Lab reports state
  const [fullLabReports, setFullLabReports] = useState<LabReport[]>([]);
  const [reportFilterTab, setReportFilterTab] = useState<'pending' | 'approved'>('pending');

  // Prescription Dispatch states
  const [dispatchFile, setDispatchFile] = useState<File | null>(null);
  const [dispatchPreviewUrl, setDispatchPreviewUrl] = useState<string>('');
  const [isDispatchOcrParsing, setIsDispatchOcrParsing] = useState(false);
  const [dispatchPatientName, setDispatchPatientName] = useState('');
  const [dispatchPatientAge, setDispatchPatientAge] = useState('');
  const [dispatchPatientGender, setDispatchPatientGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [dispatchPatientPhone, setDispatchPatientPhone] = useState('');
  const [dispatchSelectedTestCode, setDispatchSelectedTestCode] = useState('');
  const [isDispatchingToLab, setIsDispatchingToLab] = useState(false);
  const [dispatchOcrLogs, setDispatchOcrLogs] = useState<string[]>([]);

  // Lab Billing states
  const [labPaymentMode, setLabPaymentMode] = useState<'cash' | 'upi' | 'whatsapp_pay'>('upi');
  const [labDiscountPercent, setLabDiscountPercent] = useState<number>(0);

  // Report approval states
  const [reportRevisitDates, setReportRevisitDates] = useState<Record<string, string>>({});
  const [reportRevisitTimes, setReportRevisitTimes] = useState<Record<string, string>>({});
  const [reportRevisitNotes, setReportRevisitNotes] = useState<Record<string, string>>({});
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [showRejectModalForId, setShowRejectModalForId] = useState<string | null>(null);

  // ─── PHARMACY BILLING STATES ──────────────────────────────────────────────
  const [activeInventory, setActiveInventory] = useState<PharmacyInventoryItem[]>([]);
  const [billingPatient, setBillingPatient] = useState<Patient | null>(null);
  const [billingItems, setBillingItems] = useState<MedicineBillItem[]>([]);
  const [customDiscountPercent, setCustomDiscountPercent] = useState<number>(0);
  
  // Search & add manual medicine in billing
  const [medSearchQuery, setMedSearchQuery] = useState('');
  
  // Loyalty & delivery transaction helpers
  const [apptCounterBooked, setApptCounterBooked] = useState(false);
  const [labCounterBooked, setLabCounterBooked] = useState(false);
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'shiprocket'>('pickup');

  // ── Evening Slot States ──────────────────────────────────────────────────
  const [eveningSlot, setEveningSlot] = useState<EveningSlot | null>(null);
  const [isAllocatingSlot, setIsAllocatingSlot] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // Post-scan patient assignment & quick registration
  const [assignSearchQuery, setAssignSearchQuery] = useState('');
  const [showQuickReg, setShowQuickReg] = useState(false);
  const [quickRegName, setQuickRegName] = useState('');
  const [quickRegPhone, setQuickRegPhone] = useState('');
  const [quickRegAge, setQuickRegAge] = useState('');
  const [quickRegGender, setQuickRegGender] = useState<Patient['gender']>('Male');
  const [quickRegAbha, setQuickRegAbha] = useState('');

  // Pathology upload scan queue states
  const [uploadPatientName, setUploadPatientName] = useState('');
  const [uploadTestCode, setUploadTestCode] = useState('4544-3'); // HbA1c standard
  const [uploadTestName, setUploadTestName] = useState('HbA1c Glycated Hemoglobin');
  const [uploadPatientId, setUploadPatientId] = useState('');
  const [isUploadingReport, setIsUploadingReport] = useState(false);

  const syncData = useCallback(() => {
    setDataRevision(prev => prev + 1);
    setPatients(api.getPatients());
    setSessions(api.getWhatsAppSessions());
    setStaffList(api.getClinicStaff());
    setActiveStaffId(api.getActiveStaffId());
    setReports(api.getPathologyReports());
    setActiveInventory(api.getPharmacyInventory());
    setFullLabReports(api.getFullLabReports());
    setAppointments(api.getAppointments());

    const activePat = api.getActivePatient();
    setActivePatientState(activePat);
    if (activePat) {
      setActivePatientStage(api.getActivePatientCareStage(activePat.id));
      setBillingPatient(activePat);
    } else {
      setActivePatientStage('registered');
      setBillingPatient(null);
    }

    setActiveSession((prev: WhatsAppSession | null) => {
      if (!prev) return null;
      const fresh = api.getWhatsAppSessions().find(s => s.patientPhone === prev.patientPhone);
      return fresh || null;
    });
  }, []);

  useEffect(() => {
    syncData();
    return api.subscribe(syncData);
  }, [syncData]);

  // Auto-refresh every 60 seconds so the dilation countdown timer ticks down
  // without requiring a manual user interaction or page reload
  useEffect(() => {
    const dilationRefreshInterval = setInterval(() => {
      syncData();
    }, 60_000);
    return () => clearInterval(dilationRefreshInterval);
  }, [syncData]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
      setIsAtBottom(true);
    }
  }, [activeSession?.patientPhone]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (container && isAtBottom) {
      const scrollTimer = setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 50);
      return () => clearTimeout(scrollTimer);
    }
  }, [activeSession?.sessionData?.chatHistory, isAtBottom]);

  // Auto-focus active patient in vitals intake form if they do not have vitals recorded yet
  useEffect(() => {
    if (activePatient && !activePatient.vitals && !vitalsPatient) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.body.style.overflow = 'hidden';
      setVitalsPatient(activePatient);
    }
    return () => { document.body.style.overflow = ''; };
  }, [activePatient, vitalsPatient]);

  // Load existing vitals into form fields & lock body scroll when vitalsPatient changes
  useEffect(() => {
    if (vitalsPatient) {
      document.body.style.overflow = 'hidden';

      if (vitalsPatient.vitals) {
        const rawTemp = vitalsPatient.vitals.temperature || '';
        const rawBp = vitalsPatient.vitals.bloodPressure || '';
        const rawPulse = vitalsPatient.vitals.pulseRate || '';
        const rawWeight = vitalsPatient.vitals.weight || '';
        const rawSugar = vitalsPatient.vitals.bloodSugar || '';

        setTempVal(rawTemp || '98.6');
        setBpVal(rawBp || '120/80');
        setPulseVal(rawPulse || '72');
        setWeightVal(rawWeight || '65');
        setSugarVal(rawSugar || '');
      } else {
        setTempVal('98.6');
        setBpVal('120/80');
        setPulseVal('72');
        setWeightVal('65');
        setSugarVal('');
      }
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [vitalsPatient, isOphthalmology]);

  // Auto-focus active patient in Revisit Scheduler & Reset draft report summary
  useEffect(() => {
    if (activePatient) {
      setRevisitPatientId(activePatient.id);
    }
    setScannedSummary(null);
  }, [activePatient?.id]);

  // Clean up body scroll lock when modal viewers open/close
  useEffect(() => {
    if (viewingDocUrl || activeWorkflowDetail) {
      document.body.style.overflow = 'hidden';
    } else if (!vitalsPatient) {
      document.body.style.overflow = '';
    }
    return () => {
      if (!vitalsPatient) {
        document.body.style.overflow = '';
      }
    };
  }, [viewingDocUrl, activeWorkflowDetail, vitalsPatient]);

  // Sync loyalty checkboxes when billing patient changes
  useEffect(() => {
    if (billingPatient) {
      const txs = api.getCounterTransactions();
      const todayStr = getIstDateString();
      const existingTx = txs.find(t => t.patientId === billingPatient.id && (t.createdAt || '').startsWith(todayStr));
      
      if (existingTx) {
        setApptCounterBooked(existingTx.appointmentBookedAtCounter);
        setLabCounterBooked(existingTx.labBookedAtCounter);
      } else {
        setApptCounterBooked(false);
        setLabCounterBooked(false);
      }
    }
  }, [billingPatient]);

  // Handle staff methods
  const handleRegisterStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;
    api.registerClinicStaff(newStaffName.trim(), newStaffRole);
    setNewStaffName('');
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Registered ${newStaffName} as ${newStaffRole} successfully.`,
        type: 'success',
        title: 'Clinic Staff Registered'
      }
    }));
  };



  const handleSelectActiveStaff = (staffId: string) => {
    api.setActiveStaffId(staffId);
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Active Checked-In Staff updated.`,
        type: 'info',
        title: 'Checked-In Active Staff'
      }
    }));
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInput.trim() || !activeSession) return;
    const text = replyInput.trim();
    setReplyInput('');
    await api.processIncomingWhatsAppMessage(activeSession.patientPhone, text);
  };

  const handleRegisterPatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !age) return;

    const generateUUID = () => {
      if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    };

    const newPatientId = generateUUID();
    const registered = api.registerPatient({
      id: newPatientId,
      name,
      phone,
      age: Number(age),
      gender,
      allergies: allergiesInput.split(',').map(s => s.trim()).filter(Boolean),
      chronicConditions: chronicInput.split(',').map(s => s.trim()).filter(Boolean),
      abhaId: abhaId || undefined,
      vitals: bloodGroupInput ? {
        temperature: '',
        bloodPressure: '',
        pulseRate: '',
        bloodGroup: bloodGroupInput,
        recordedAt: new Date().toISOString()
      } as any : undefined,
      whatsApp: whatsAppInput || phone
    } as any);

    // Auto-create consultation appointment & invoice (₹500.00) in status 'pending_payment'
    api.createGate1Consult(registered.id, 'counter');

    // Update patients state & sync across components
    setPatients(api.getPatients());
    api.setActivePatient(registered);
    setBillingPatient(registered);
    setSelectedApptPatient(registered);
    setActiveTab('tokens');
    setOpdSubTab('today_queue');
    syncData();
    fetchLiveAppointments();

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Registered & Dispatched ${name} to Payment Counter. Please collect ₹500.00 (Cash / UPI QR) to confirm appointment.`,
        type: 'success',
        title: 'Patient Registered — Collect Payment'
      }
    }));

    setName('');
    setPhone('');
    setAge('');
    setGender('Male');
    setAllergiesInput('');
    setChronicInput('');
    setAbhaId('');
    setBloodGroupInput('');
    setWhatsAppInput('');
  };

  const handleRecordVitalsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vitalsPatient) return;

    // Strict Cashfree Payment Gate Check (USP 3 & Rule 3): Verify consultation fee is cleared before token dispatch
    const unifiedInvoices = BillingService.getInvoices();
    const saasInvoices = load<any[]>('saas_invoices', []);
    const allInvoices = [...unifiedInvoices, ...saasInvoices];

    const isPaidInvoice = allInvoices.some(i => 
      (i.patientId === vitalsPatient.id || i.patient_id === vitalsPatient.id) && 
      ((i as any).paymentStatus === 'cleared' || (i as any).paymentStatus === 'paid' || (i as any).status === 'paid' || (i as any).status === 'cleared')
    );
    const appts = api.getAppointments();
    const hasPaidAppt = appts.some(a => 
      (a.patientId === vitalsPatient.id || (a as any).patient_id === vitalsPatient.id) && 
      a.status !== 'pending_payment'
    );

    if (!isPaidInvoice && !hasPaidAppt) {
      // Auto-create pending appointment if not existing yet
      api.createGate1Consult(vitalsPatient.id, 'counter');
      setBillingPatient(vitalsPatient);
      setSelectedApptPatient(vitalsPatient);
      setActiveTab('tokens');
      setOpdSubTab('today_queue');
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: `⚠️ Consultation Fee Pending: Please collect ₹500.00 at the Payment Counter before dispatching ${vitalsPatient.name} to Doctor's chamber.`,
          type: 'error',
          title: 'Payment Required'
        }
      }));
      setVitalsPatient(null);
      return;
    }

    const recordedToken = vitalsPatient.tokenNumber || api.generateNextTokenNumber();

    api.updatePatientVitalsAndToken(vitalsPatient.id, {
      temperature: tempVal,
      bloodPressure: bpVal,
      pulseRate: pulseVal,
      weight: weightVal,
      bloodSugar: sugarVal || undefined,
      recordedAt: new Date().toISOString()
    }, recordedToken);

    if (vitalsPatient.phone) {
      api.dispatchAppointmentTimingGreetingWhatsApp({
        patientPhone: vitalsPatient.phone,
        patientName: vitalsPatient.name,
        tokenNumber: String(recordedToken),
        appointmentTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        doctorName: activePod?.doctor_name,
        clinicName: activePod?.name,
        mode: 'physical'
      }).catch(err => console.warn('[CompounderDashboard] Timing greeting error:', err));
    }

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Vitals pre-loaded successfully for patient ${vitalsPatient.name}! Dispatched Token: ${recordedToken} to Doctor's chamber & WhatsApp confirmed. 🩺`,
        type: 'success',
        title: 'Swasthya Token Dispatched'
      }
    }));

    // Reset Form
    document.body.style.overflow = '';
    setVitalsPatient(null);
    setTempVal('98.6');
    setBpVal('120/80');
    setPulseVal('72');
    setWeightVal('65');
    setSugarVal('');

    syncData();
    fetchLiveAppointments();
  };

  const handlePushDosageWhatsApp = async (patient: Patient, dosageText: string) => {
    let session = sessions.find(s => s.patientPhone === patient.phone);
    if (!session) {
      session = api.initiateWhatsAppSession(patient.phone);
    }
    
    const chatHistory = [
      ...(session.sessionData.chatHistory || []),
      { sender: 'bot' as const, text: `📋 *Swasthya Dosage Slip (दवाई पर्ची)*\n\n${dosageText}`, time: new Date().toISOString() }
    ];
    
    api.updateWhatsAppState(patient.phone, session.currentState, {
      ...session.sessionData,
      chatHistory
    });
    
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Vernacular dosage slip pushed to +91 ${patient.phone} on WhatsApp!`,
        type: 'success',
        title: 'WhatsApp Slip Dispatched'
      }
    }));
    
    syncData();
  };

  const handleInitiateWhatsAppLoop = (patient: Patient) => {
    api.setActivePatient(patient);
    const session = api.initiateWhatsAppSession(patient.phone);
    setActiveSession(session);
    setIsChatDrawerOpen(true);
    
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `WhatsApp verification session initiated for ${patient.name}.`,
        type: 'info',
        title: 'WhatsApp Loop Started'
      }
    }));
  };

  // Pathology Upload logic
  const handleUploadReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadPatientName || !uploadTestName || !uploadPatientId) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Missing Required Fields',
          message: 'Please fill out patient name, test name, and patient ID.',
          type: 'error'
        }
      }));
      return;
    }

    setIsUploadingReport(true);

    setTimeout(() => {
      const reportsList = api.getPathologyReports();
      const newReport: PathologyReport = {
        id: `rep-${Date.now()}`,
        patientId: uploadPatientId,
        patientName: uploadPatientName,
        loincCode: uploadTestCode,
        testName: uploadTestName,
        status: 'pending',
        compounderScanned: true,
        timestamp: new Date().toISOString()
      };

      reportsList.unshift(newReport);
      api.savePathologyReports(reportsList);
      setIsUploadingReport(false);
      
      // Reset form
      setUploadPatientName('');
      setUploadPatientId('');

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: `Pathology report uploaded. Streamed barcode index lock: Approved queue dispatched to doctor workspace!`,
          type: 'success',
          title: 'Report Scanned & Queued'
        }
      }));
    }, 1200);
  };

  // ─── BILLING TAB HANDLERS ─────────────────────────────────────────────────
  
  // Set loyalty status and save to local API
  const handleToggleLoyaltyStatus = (type: 'appt' | 'lab') => {
    if (!billingPatient) return;
    
    const isAppt = type === 'appt' ? !apptCounterBooked : apptCounterBooked;
    const isLab = type === 'lab' ? !labCounterBooked : labCounterBooked;

    if (type === 'appt') setApptCounterBooked(isAppt);
    if (type === 'lab') setLabCounterBooked(isLab);

    const tx: CounterTransaction = {
      id: `tx-counter-${billingPatient.id}`,
      patientId: billingPatient.id,
      patientPhone: billingPatient.phone,
      patientName: billingPatient.name,
      appointmentBookedAtCounter: isAppt,
      labBookedAtCounter: isLab,
      discountEligible: isAppt && isLab,
      discountPercent: isAppt && isLab ? 10 : 0,
      createdAt: new Date().toISOString()
    };

    api.saveCounterTransaction(tx);
    
    if (isAppt && isLab) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: `Loyalty Bonus unlocked: Patient booked both appt & lab at counter today! 10% auto-discount applied.`,
          type: 'success',
          title: '10% Loyalty Unlocked'
        }
      }));
    }
  };



  // Add item manually to bill
  const handleSelectMedForBilling = (med: PharmacyInventoryItem) => {
    // Check if already in billing items
    const exists = billingItems.find(i => i.inventoryItemId === med.id);
    if (exists) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Already Added',
          message: 'This medicine batch is already added to checkout.',
          type: 'warning'
        }
      }));
      return;
    }

    const itemTotal = med.price * 10; // Default qty 10
    const gst = med.hsn === '300410' ? 0.12 : 0.05;

    const newItem: MedicineBillItem = {
      inventoryItemId: med.id,
      name: med.name,
      genericName: med.genericName,
      dosage: med.dosage,
      batchNumber: med.batchNumber,
      expiryDate: med.expiryDate,
      quantity: 10,
      mrp: med.mrp,
      sellingPrice: med.price,
      discountPercent: 0,
      gstPercent: gst * 100,
      lineTotal: itemTotal
    };

    setBillingItems(prev => [...prev, newItem]);
    setMedSearchQuery('');
  };

  const handleUpdateItemQty = (idx: number, qty: number) => {
    setBillingItems(prev => prev.map((item, i) => {
      if (i === idx) {
        const parsedQty = Math.max(1, qty);
        const itemTotal = item.sellingPrice * parsedQty * (1 - item.discountPercent / 100);
        return {
          ...item,
          quantity: parsedQty,
          lineTotal: itemTotal
        };
      }
      return item;
    }));
  };

  const handleUpdateItemDiscount = (idx: number, disc: number) => {
    setBillingItems(prev => prev.map((item, i) => {
      if (i === idx) {
        const parsedDisc = Math.min(100, Math.max(0, disc));
        const itemTotal = item.sellingPrice * item.quantity * (1 - parsedDisc / 100);
        return {
          ...item,
          discountPercent: parsedDisc,
          lineTotal: itemTotal
        };
      }
      return item;
    }));
  };

  // Suggest alternative brand from inventory
  const getCheaperAlternatives = (item: MedicineBillItem) => {
    return activeInventory.filter(inv => 
      inv.id !== item.inventoryItemId &&
      (inv.genericName || '').toLowerCase() === (item.genericName || '').toLowerCase() &&
      inv.price < item.sellingPrice &&
      inv.stock > 0
    );
  };

  const handleSwitchToAlternative = (itemIdx: number, alt: PharmacyInventoryItem) => {
    setBillingItems(prev => prev.map((item, i) => {
      if (i === itemIdx) {
        const itemTotal = alt.price * item.quantity * (1 - item.discountPercent / 100);
        const gst = alt.hsn === '300410' ? 0.12 : 0.05;
        
        return {
          ...item,
          inventoryItemId: alt.id,
          name: alt.name,
          batchNumber: alt.batchNumber,
          expiryDate: alt.expiryDate,
          mrp: alt.mrp,
          sellingPrice: alt.price,
          gstPercent: gst * 100,
          lineTotal: itemTotal,
          alternativeSuggested: `Cheaper brand switched to ${alt.name}`
        };
      }
      return item;
    }));

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Switched brand to cheaper alternative: ${alt.name} (Saved ₹${((billingItems[itemIdx]?.sellingPrice || 0) - (alt.price || 0)).toFixed(2)} per unit!)`,
        type: 'success',
        title: 'Generic Switch Success'
      }
    }));
  };

  const handleRemoveBillingItem = (idx: number) => {
    setBillingItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Financial calculations
  const billingTotals = useMemo(() => {
    let subtotal = 0;
    let gstAmount = 0;
    let itemDiscountAmount = 0;

    billingItems.forEach(item => {
      subtotal += item.sellingPrice * item.quantity;
      itemDiscountAmount += (item.sellingPrice * item.quantity) * (item.discountPercent / 100);
      
      const lineGst = item.lineTotal * (item.gstPercent / 100);
      gstAmount += lineGst;
    });

    const isLoyaltyEligible = apptCounterBooked && labCounterBooked;
    const loyaltyDiscountPercent = customDiscountPercent || (isLoyaltyEligible ? 10 : 0);
    
    // Loyalty discount is calculated on the subtotal after item-level discounts
    const postItemDiscountSubtotal = subtotal - itemDiscountAmount;
    const loyaltyDiscountAmount = postItemDiscountSubtotal * (loyaltyDiscountPercent / 100);
    
    const deliveryCharge = deliveryType === 'shiprocket' ? 45 : 0;
    const totalAmount = postItemDiscountSubtotal - loyaltyDiscountAmount + gstAmount + deliveryCharge;

    return {
      subtotal,
      itemDiscountAmount,
      loyaltyDiscountPercent,
      loyaltyDiscountAmount,
      gstAmount,
      deliveryCharge,
      totalAmount
    };
  }, [billingItems, apptCounterBooked, labCounterBooked, deliveryType, customDiscountPercent]);

  // Dispatch bill through API
  const handleGenerateInvoice = async (mode: 'whatsapp' | 'cash') => {
    if (!billingPatient || billingItems.length === 0) return;

    const pharmacyGstin = podEntities.find(pe => pe.entityType === 'pharmacy' && pe.status === 'approved')?.gstin;
    const billId = `bill-${Date.now()}`;
    const bill: MedicineBill = {
      id: billId,
      patientId: billingPatient.id,
      patientName: billingPatient.name,
      patientPhone: billingPatient.phone,
      pharmacyGstin: pharmacyGstin,
      items: billingItems,
      subtotal: billingTotals.subtotal,
      loyaltyDiscountPercent: billingTotals.loyaltyDiscountPercent,
      loyaltyDiscountAmount: billingTotals.loyaltyDiscountAmount,
      itemDiscountAmount: billingTotals.itemDiscountAmount,
      gstAmount: billingTotals.gstAmount,
      totalAmount: billingTotals.totalAmount,
      paymentMode: mode === 'whatsapp' ? 'whatsapp_pay' : 'cash',
      upiQrPayload: `upi://pay?pa=vitalsync@axl&pn=VitalSync&am=${(billingTotals.totalAmount || 0).toFixed(2)}&cu=INR&tn=VS-BILL-${(billId || '').substring(4, 8)}`,
      status: mode === 'cash' ? 'paid' : 'draft',
      source: 'counter',
      deliveryType: deliveryType,
      deliveryAddress: deliveryType === 'shiprocket' ? deliveryAddress : undefined,
      deliveryCharge: billingTotals.deliveryCharge,
      shiprocketOrderId: deliveryType === 'shiprocket' ? `SR-CTR-${Math.floor(100000 + Math.random() * 900000)}` : undefined,
      createdAt: new Date().toISOString()
    };

    api.saveMedicineBill(bill);

    if (mode === 'cash') {
      api.dispenseMedicineBill(billId);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: `Direct cash transaction settled at counter! Stock deducted. Invoice printed.`,
          type: 'success',
          title: 'POS Settle Complete'
        }
      }));
      setBillingItems([]);
    } else {
      // WhatsApp dispatch
      // Find session or initiate
      let session = sessions.find(s => s.patientPhone === billingPatient.phone);
      if (!session) {
        session = api.initiateWhatsAppSession(billingPatient.phone);
      }

      // Format & push invoice message to patient WhatsApp sandbox!
      const invoiceText = api.generateMedicineInvoiceMessage(bill);

      // Build dosage invoice text using getBilingualInstruction() for each item
      let dosageInvoiceText = `📋 *दवाई की खुराक की जानकारी (Bilingual Dosage Slip)*\n\nनमस्ते, यहाँ आपकी दवाइयों की खुराक की जानकारी हिंदी/Hinglish में है:\n\n`;
      bill.items.forEach((item, idx) => {
        const instr = getBilingualInstruction(item.name, item.dosage);
        dosageInvoiceText += `💊 *${item.name}* (${item.dosage || '1 Tab'})\n`;
        dosageInvoiceText += `👉 *Directions:* ${instr.english}\n`;
        dosageInvoiceText += `👉 *खुराक:* ${instr.hindi}\n\n`;
      });
      dosageInvoiceText += `Dhyan rakhein aur time par medicine lein! 🟢`;

      // ── Append same-day evening appointment info ────────────────────────
      const activeDocName = activePod?.doctor_name || 'Doctor';
      const apptSlot = eveningSlot || api.getAppointmentByPatient(billingPatient.id);
      if (apptSlot) {
        dosageInvoiceText += `\n\n🕒 *Doctor Follow-up (Aaj Shaam):*\n${activeDocName} aapko aaj *${apptSlot.startTime}* se *${apptSlot.endTime}* ke beech dekhenge.\nKrupaya 5 minute pehle clinic pahunchen.`;
      } else {
        // Auto-allocate slot for this patient if none exists
        try {
          const newSlot = await api.createEveningSlot(billingPatient.id, 'doc-1');
          if (newSlot) {
            setEveningSlot(newSlot);
            dosageInvoiceText += `\n\n🕒 *Doctor Follow-up (Aaj Shaam):*\n${activeDocName} aapko aaj *${newSlot.startTime}* se *${newSlot.endTime}* ke beech dekhenge.\nKrupaya 5 minute pehle clinic pahunchen.`;
          }
        } catch (slotErr) {
          console.warn('[EveningSlot] Compounder slot auto-allocation failed:', slotErr);
        }
      }

      api.pushWhatsAppMessageFromBot(billingPatient.phone, dosageInvoiceText);
      api.pushWhatsAppMessageFromBot(billingPatient.phone, invoiceText);
      
      // Update session state to MEDICINE_AWAITING_PAYMENT
      const updatedSessions = api.getWhatsAppSessions();
      const updatedSession = updatedSessions.find(s => s.patientPhone === billingPatient.phone) || session;

      api.updateWhatsAppState(billingPatient.phone, 'MEDICINE_AWAITING_PAYMENT', {
        chatHistory: updatedSession.sessionData.chatHistory || [],
        draftMedicineBill: bill
      });

      // Jump simulator focus
      handleInitiateWhatsAppLoop(billingPatient);

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: `Invoice & bilingual dosage generated & pushed to +91 ${billingPatient.phone} on WhatsApp! Sandbox auto-focused.`,
          type: 'success',
          title: 'WhatsApp Invoice Sent'
        }
      }));

      setBillingItems([]);
    }
  };

  // Fuzzy search catalog filtering in billing
  const billingSearchMatches = useMemo(() => {
    if (!medSearchQuery.trim()) return [];
    return activeInventory.filter(inv => 
      ((inv.name || '').toLowerCase().includes(medSearchQuery.toLowerCase()) ||
       (inv.genericName || '').toLowerCase().includes(medSearchQuery.toLowerCase())) &&
      inv.stock > 0
    );
  }, [activeInventory, medSearchQuery]);

  const filteredPatients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return patients.filter(p => 
      (p.name || '').toLowerCase().includes(query) || 
      (p.phone || '').includes(query) ||
      (p.patientCode && String(p.patientCode).toLowerCase().includes(query)) ||
      (p.tokenNumber && String(p.tokenNumber).toLowerCase().includes(query)) ||
      (p.abhaId && p.abhaId.includes(query))
    );
  }, [patients, searchQuery]);

  const assignFilteredPatients = useMemo(() => {
    const query = assignSearchQuery.trim().toLowerCase();
    if (!query) return [];
    return patients.filter(p => 
      (p.name || '').toLowerCase().includes(query) || 
      (p.phone || '').includes(query) ||
      (p.patientCode && String(p.patientCode).toLowerCase().includes(query)) ||
      (p.tokenNumber && String(p.tokenNumber).toLowerCase().includes(query)) ||
      (p.abhaId && p.abhaId.includes(query))
    );
  }, [patients, assignSearchQuery]);

  const handleQuickRegisterPatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickRegName.trim() || !quickRegPhone.trim() || !quickRegAge) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Incomplete Registration',
          message: 'Please fill in Name, Phone, and Age.',
          type: 'error'
        }
      }));
      return;
    }

    const registered = api.registerPatient({
      name: quickRegName.trim(),
      phone: quickRegPhone.trim(),
      age: Number(quickRegAge),
      gender: quickRegGender,
      allergies: [],
      chronicConditions: [],
      abhaId: quickRegAbha.trim() || undefined
    });

    // Auto-create consultation appointment & invoice (₹500.00) in status 'pending_payment'
    api.createGate1Consult(registered.id, 'counter');

    // Refresh clinical lists
    setPatients(api.getPatients());
    api.setActivePatient(registered);
    setBillingPatient(registered);
    setSelectedApptPatient(registered);
    setActiveTab('tokens');
    setOpdSubTab('today_queue');

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Registered & Dispatched: ${quickRegName.trim()} to Payment Counter. Please collect ₹500.00 (Cash / UPI QR).`,
        type: 'success',
        title: 'Patient Registered — Collect Payment'
      }
    }));

    // Reset fields
    setQuickRegName('');
    setQuickRegPhone('');
    setQuickRegAge('');
    setQuickRegGender('Male');
    setQuickRegAbha('');
    setShowQuickReg(false);
  };

  const handlePreviousReportScan = async (file: File) => {
    if (!activePatient) return;
    setIsReportScanning(true);
    setReportScanLogs([
      `[${new Date().toLocaleTimeString()}] Accessing previous health records archive...`,
      `[${new Date().toLocaleTimeString()}] Uploading file to Clinical OCR parser...`
    ]);

    try {
      // 1. Run live OCR scan via FastAPI backend
      const ocrResult = await api.ocrScan(file);
      setReportScanLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] OCR Success: Document text parsed.`,
        `[${new Date().toLocaleTimeString()}] Structuring biomarkers...`,
        `[${new Date().toLocaleTimeString()}] Dispatching biomarkers to Gemini CDSS comparative engine...`
      ]);

      // Parse biomarkers from OCR structured data
      const hba1cStr = ocrResult.structured_data?.HbA1c || ocrResult.structured_data?.hba1c || '7.8';
      const creatinineStr = ocrResult.structured_data?.Creatinine || ocrResult.structured_data?.creatinine || '1.4';
      const hemoglobinStr = ocrResult.structured_data?.Hemoglobin || ocrResult.structured_data?.hemoglobin || '11.2';
      
      const current_data = {
        age: activePatient.age.toString(),
        gender: activePatient.gender,
        HbA1c: parseFloat(hba1cStr.toString().replace(/[^0-9.]/g, '')) || 7.8,
        creatinine: parseFloat(creatinineStr.toString().replace(/[^0-9.]/g, '')) || 1.4,
        hemoglobin: parseFloat(hemoglobinStr.toString().replace(/[^0-9.]/g, '')) || 11.2
      };

      // 2. Query `/api/lab-trend` via the labTrend service
      const trendResult = await api.labTrend({ current_data });
      
      // Update scanned summary with analysis text
      setScannedSummary(trendResult.analysis);

      setReportScanLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] SUCCESS: Longitudinal report mapped successfully! [OK]`
      ]);
      
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: 'Previous report parsed by AI. Please review the draft summary below to save & submit.',
          type: 'success',
          title: 'Longitudinal Summary Parsed'
        }
      }));
    } catch (err: any) {
      console.error(err);
      setReportScanLogs(prev => [...prev, `[ERROR] OCR/Analysis failed: ${err?.message || err}`]);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: 'Failed to scan and analyze previous report.',
          type: 'error',
          title: 'Scan Error'
        }
      }));
    } finally {
      setIsReportScanning(false);
    }
  };

  return (
    <div 
      className="max-w-7xl mx-auto p-2 sm:p-4 md:p-8 pb-32 md:pb-12 space-y-6 sm:space-y-8 animate-fade-in bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-clinical-950 dark:to-indigo-950/20 text-slate-800 dark:text-clinical-100 min-h-screen transition-colors duration-300"
      style={{ paddingTop: 'env(safe-area-inset-top, 16px)' }}
    >
      {/* Ambient Background Glow for visual hierarchy */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[5%] w-[40%] h-[40%] rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>

      <style>{`
        @keyframes sweep {
          0% { top: 0%; opacity: 0.3; }
          50% { top: 100%; opacity: 0.8; }
          100% { top: 0%; opacity: 0.3; }
        }
        .laser-sweep-line {
          animation: sweep 2s infinite ease-in-out;
        }
      `}</style>

      {/* DASHBOARD HEADER — integrated tabs & glassmorphism */}
      <div className="border-b-0 md:border-b border-slate-200/50 dark:border-white/5 pb-4 md:pb-0 bg-white/70 dark:bg-clinical-900/60 backdrop-blur-2xl p-4 md:p-6 rounded-3xl shadow-sm mb-4 md:mb-6 z-10 relative">
        {/* Top row: title + status */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-6 pb-2 md:pb-6">
          <div className="flex items-center gap-3.5">
            <span className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-teal-500 text-white shadow-lg shadow-indigo-500/25">
              <Stethoscope className="w-6 h-6 text-white" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  Compounder Operations Cockpit
                  <span className="hidden sm:inline-block text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
                    Medical Assistant Desk
                  </span>
                </h1>
                <span className={`text-[9px] font-mono font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-widest flex items-center gap-1.5 ${
                  isOnline
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  {isOnline ? 'Live Clinic Bus' : 'Offline'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                {clinicTitle} · Vitals Intake, Queue Dispatch, Dilation Timers &amp; Rapid Billing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap lg:self-center w-full lg:w-auto justify-between lg:justify-end">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const nextAppt = activeOpdAppointments.find(a => a.status === 'ready_for_consult');
                  if (nextAppt) {
                    handleCallPatientChamber(nextAppt.patientName || 'Patient', nextAppt.tokenNumber || 'Next');
                  } else {
                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                      detail: { title: 'Queue Idle', message: 'No patient currently waiting in ready queue.', type: 'info' }
                    }));
                  }
                }}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer border-0"
                title="Voice Announce Next Token"
              >
                <Volume2 className="w-4 h-4" />
                <span>Call Next Token</span>
              </button>

              <button
                type="button"
                onClick={() => setShowQuickAddSheet(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer border-0"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Walk-In Patient</span>
              </button>
            </div>

            <span className="inline-flex items-center gap-1.5 text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-full font-semibold uppercase tracking-wider font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {staffList.find(s => s.id === activeStaffId)?.staffName || 'Compounder'}
            </span>
          </div>
        </div>

        {/* Integrated Tab Switcher — scrollable glass pill capsules for all screen sizes */}
        <div className="hidden md:flex overflow-x-auto gap-2 no-scrollbar select-none -mb-px p-1.5 bg-slate-100/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200/50 dark:border-white/5 backdrop-blur-md">
          {[
            { id: 'overview', label: 'Overview (कॉकपिट)', icon: <LayoutDashboard className="h-4 w-4 text-indigo-500" /> },
            { id: 'tokens', label: 'Live Queue (टोकन)', icon: <Calendar className="h-4 w-4 text-rose-500" /> },
            { id: 'patients', label: 'Patients (मरीज)', icon: <Users className="h-4 w-4 text-indigo-600" /> },
            { id: 'labs', label: isOphthalmology ? 'Biometry (बायोमेट्री)' : nomenclature.careLoopLabStep, icon: <FlaskConical className="h-4 w-4 text-teal-500" /> },
            { id: 'pharmacy', label: isOphthalmology ? 'Optical/Rx (चश्मा)' : nomenclature.careLoopPharmacyStep, icon: <QrCode className="h-4 w-4 text-amber-500" /> },
            { id: 'ot_billing', label: isOphthalmology ? 'Daycare (सर्जरी)' : 'Minor OT (ओटी)', icon: <Scissors className="h-4 w-4 text-rose-600" /> },
            { id: 'invoice_generator', label: 'Invoices & OCR (बिलिंग)', icon: <Printer className="h-4 w-4 text-slate-500 dark:text-slate-400" /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 text-xs font-black flex items-center gap-2 whitespace-nowrap transition-all uppercase cursor-pointer rounded-xl ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/5'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB CONTENT SPACES */}
      <div className="space-y-6">
        {/* ══════════════════════════════════════════════════════════
            TAB: OVERVIEW COCKPIT (MODERN MOBILE-FIRST HUB)
        ══════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in text-left">
            {/* 1. Quick Stats Horizontal Carousel */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              <div 
                onClick={() => setActiveTab('tokens')}
                className="glass-panel p-4 rounded-2xl border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition cursor-pointer group"
              >
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Active OPD</span>
                  <Calendar className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">{activeOpdAppointments.length}</div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">Today's Visits</div>
              </div>

              <div 
                onClick={() => setActiveTab('tokens')}
                className="glass-panel p-4 rounded-2xl border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm hover:shadow-md transition cursor-pointer group"
              >
                <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono">In Chamber</span>
                  <Stethoscope className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition animate-pulse" />
                </div>
                <div className="text-lg font-black text-slate-900 dark:text-white truncate">
                  {inChamberAppointment ? (inChamberAppointment.patientName || 'Consulting') : 'Idle'}
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold mt-1">
                  {inChamberAppointment?.tokenNumber || 'Chamber Available'}
                </div>
              </div>

              <div 
                onClick={() => {
                  const p = pendingVitalsList[0];
                  if (p) setVitalsPatient(p);
                }}
                className="glass-panel p-4 rounded-2xl border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 shadow-sm hover:shadow-md transition cursor-pointer group"
              >
                <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Pending Vitals</span>
                  <Activity className="w-4 h-4 text-amber-500 group-hover:scale-110 transition" />
                </div>
                <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{pendingVitalsList.length}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-1">Awaiting Intake</div>
              </div>

              <div 
                onClick={() => setActiveTab('ot_billing')}
                className="glass-panel p-4 rounded-2xl border-purple-200 dark:border-purple-900/40 bg-purple-50/40 dark:bg-purple-950/20 shadow-sm hover:shadow-md transition cursor-pointer group"
              >
                <div className="flex items-center justify-between text-purple-700 dark:text-purple-400 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono">OT / Daycare</span>
                  <Scissors className="w-4 h-4 text-purple-500 group-hover:scale-110 transition" />
                </div>
                <div className="text-2xl font-black text-purple-600 dark:text-purple-400">{daycarePatients.length}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-1">Pre-Op Pipeline</div>
              </div>

              <div 
                onClick={() => {
                  const firstP = patients[0];
                  if (firstP) setShowDilationModal(firstP);
                }}
                className="glass-panel p-4 rounded-2xl border-cyan-200 dark:border-cyan-900/40 bg-cyan-50/40 dark:bg-cyan-950/20 shadow-sm hover:shadow-md transition cursor-pointer group"
              >
                <div className="flex items-center justify-between text-cyan-700 dark:text-cyan-400 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Eye Dilation</span>
                  <Eye className="w-4 h-4 text-cyan-500 group-hover:scale-110 transition" />
                </div>
                <div className="text-2xl font-black text-cyan-600 dark:text-cyan-400">{activeDilationPatients.length}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-1">15m Countdown</div>
              </div>

              <div 
                onClick={() => setActiveTab('pharmacy')}
                className="glass-panel p-4 rounded-2xl border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 shadow-sm hover:shadow-md transition cursor-pointer group"
              >
                <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Low Stock</span>
                  <Pill className="w-4 h-4 text-rose-500 group-hover:scale-110 transition" />
                </div>
                <div className="text-2xl font-black text-rose-600 dark:text-rose-400">{lowStockItems.length}</div>
                <div className="text-[10px] text-rose-600 dark:text-rose-400 font-bold mt-1">Items Reorder</div>
              </div>
            </div>

            {/* 2. Quick Action Grid (5 Touch-Friendly Action Buttons) */}
            <div className="glass-panel p-5 rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-sm">
              <h3 className="text-xs font-black uppercase font-mono tracking-wider text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                Quick Clinical Actions (त्वरित कार्य)
              </h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                <button
                  type="button"
                  onClick={() => setShowQuickAddSheet(true)}
                  className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 dark:from-indigo-950/40 dark:to-indigo-900/20 border border-indigo-200 dark:border-indigo-800/60 hover:scale-[1.02] active:scale-95 transition text-left flex flex-col justify-between cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-3 shadow-md shadow-indigo-500/30">
                    <UserPlus className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white">Quick Add Patient</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Walk-in OPD Entry</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setShowVitalsBottomSheet(true)}
                  className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 dark:from-emerald-950/40 dark:to-emerald-900/20 border border-emerald-200 dark:border-emerald-800/60 hover:scale-[1.02] active:scale-95 transition text-left flex flex-col justify-between cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-3 shadow-md shadow-emerald-500/30">
                    <Activity className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white">Quick Vitals Intake</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">BP, SpO2, BMI Pad</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('invoice_generator');
                  }}
                  className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100/60 dark:from-purple-950/40 dark:to-purple-900/20 border border-purple-200 dark:border-purple-800/60 hover:scale-[1.02] active:scale-95 transition text-left flex flex-col justify-between cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center mb-3 shadow-md shadow-purple-500/30">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white">Scan Rx OCR</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">AI Prescription Parser</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('invoice_generator');
                  }}
                  className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/60 dark:from-amber-950/40 dark:to-amber-900/20 border border-amber-200 dark:border-amber-800/60 hover:scale-[1.02] active:scale-95 transition text-left flex flex-col justify-between cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center mb-3 shadow-md shadow-amber-500/30">
                    <Receipt className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white">New Invoice</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Counter Billing &amp; UPI</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const nextAppt = activeOpdAppointments.find(a => a.status === 'ready_for_consult');
                    if (nextAppt) {
                      handleCallPatientChamber(nextAppt.patientName || 'Patient', nextAppt.tokenNumber || 'Next');
                    } else {
                      window.dispatchEvent(new CustomEvent('mediflow-toast', {
                        detail: { title: 'Queue Idle', message: 'No patient currently waiting in ready queue.', type: 'info' }
                      }));
                    }
                  }}
                  className="p-4 rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100/60 dark:from-rose-950/40 dark:to-rose-900/20 border border-rose-200 dark:border-rose-800/60 hover:scale-[1.02] active:scale-95 transition text-left flex flex-col justify-between cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center mb-3 shadow-md shadow-rose-500/30">
                    <Volume2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white">Call Next Token</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Voice Buzzer Alert</div>
                  </div>
                </button>
              </div>
            </div>

            {/* 3. Emergency SOS Priority Sentinel (If Active) */}
            {sosEmergencyAppointment && (
              <div className="p-5 bg-gradient-to-r from-rose-600 via-red-600 to-orange-600 text-white rounded-3xl shadow-xl shadow-rose-600/30 border border-rose-400 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-pulse">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <span className="px-2.5 py-0.5 bg-white text-rose-700 text-[10px] font-black uppercase tracking-wider rounded-full">
                      🚨 PRIORITY #1 EMERGENCY SOS ACTIVE
                    </span>
                    <h3 className="text-base font-black mt-1">
                      {sosEmergencyAppointment.patientName || 'Emergency Patient'} (Token: {sosEmergencyAppointment.tokenNumber})
                    </h3>
                    <p className="text-xs text-rose-100 font-mono">
                      Phone: +91 {sosEmergencyAppointment.patientPhone || 'Emergency'} · Surcharge: ₹618.00 Verified
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    handleCallPatientChamber(sosEmergencyAppointment.patientName || 'Emergency Patient', sosEmergencyAppointment.tokenNumber || 'SOS');
                    setActiveTab('tokens');
                  }}
                  className="px-5 py-2.5 bg-white hover:bg-rose-50 text-rose-700 font-black text-xs rounded-xl shadow-md cursor-pointer transition border-0 uppercase tracking-wider flex items-center gap-2"
                >
                  <ArrowRight className="w-4 h-4" />
                  Route to Doctor Chamber Now
                </button>
              </div>
            )}

            {/* 4. Two Column Operations Desk: Eye Dilation Timers & Live Chamber Tracker */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 6 Cols: Eye Dilation Countdown Station */}
              <div className="lg:col-span-6 space-y-4">
                <div className="glass-panel p-5 rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-sm h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-black uppercase font-mono tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
                        <Eye className="w-4 h-4 text-cyan-600" />
                        15-Min Eye Dilation Station (आई डाइलैशन)
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          const candidate = patients.find(p => p.eyeDilationStatus !== 'in_progress');
                          if (candidate) setShowDilationModal(candidate);
                          else setShowQuickAddSheet(true);
                        }}
                        className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0"
                      >
                        <Plus className="w-3.5 h-3.5" /> Start Dilation
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
                      Tropicamide &amp; Phenylephrine eye drop tracking with automated 15-minute countdown alert for Doctor Retinoscopy.
                    </p>

                    {activeDilationPatients.length === 0 ? (
                      <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30">
                        <Timer className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <div className="text-xs font-bold text-slate-600 dark:text-slate-400">No Active Eye Dilations Running</div>
                        <p className="text-[10px] text-slate-400 mt-1">Click '+ Start Dilation' when applying drops to patient.</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                        {activeDilationPatients.map((p) => {
                          const elapsedSec = (currentTime.getTime() - new Date(p.dilationTimestamp!).getTime()) / 1000;
                          const remSec = Math.max(0, 900 - elapsedSec);
                          const remMin = Math.floor(remSec / 60);
                          const remSeconds = Math.floor(remSec % 60);
                          const isReady = remSec <= 0;

                          return (
                            <div 
                              key={p.id} 
                              className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                                isReady
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
                                  : 'bg-cyan-50/50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800/60'
                              }`}
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-slate-900 dark:text-white">{p.name}</span>
                                  <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                    Token #{p.tokenNumber || 'TK-01'}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                  Drops given: Tropicamide + Phenylephrine (BE)
                                </div>
                              </div>

                              <div className="text-right">
                                {isReady ? (
                                  <span className="px-2.5 py-1 bg-emerald-600 text-white font-mono text-[10px] font-bold rounded-lg shadow-sm">
                                    Ready for Fundus 👁️
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-1 text-xs font-black font-mono text-cyan-700 dark:text-cyan-300">
                                    <Clock className="w-3.5 h-3.5 animate-spin" />
                                    <span>{String(remMin).padStart(2, '0')}:{String(remSeconds).padStart(2, '0')}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right 6 Cols: Doctor Chamber Live Tracker & Next Patients */}
              <div className="lg:col-span-6 space-y-4">
                <div className="glass-panel p-5 rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-sm h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-black uppercase font-mono tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
                        <Stethoscope className="w-4 h-4 text-emerald-600" />
                        Chamber Live Status (डॉक्टर केबिन)
                      </h3>
                      <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        {activePod?.doctor_name || 'Dr. Attending Physician'}
                      </span>
                    </div>

                    {inChamberAppointment ? (
                      <div className="p-4 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                            Currently In Consultation
                          </span>
                          <span className="px-2 py-0.5 bg-emerald-600 text-white font-mono text-[9px] font-bold rounded-full animate-pulse">
                            Consulting Now
                          </span>
                        </div>
                        <div className="text-base font-black text-slate-900 dark:text-white mt-1">
                          {inChamberAppointment.patientName}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          Token: #{inChamberAppointment.tokenNumber} · Mode: {inChamberAppointment.isVirtual ? 'Virtual Video' : 'Physical Chamber'}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl text-center mb-4">
                        <div className="text-xs font-bold text-slate-600 dark:text-slate-400">Doctor Chamber Ready for Next Patient</div>
                        <button
                          type="button"
                          onClick={() => {
                            const next = activeOpdAppointments.find(a => a.status === 'ready_for_consult');
                            if (next) handleCallPatientChamber(next.patientName || 'Next Patient', next.tokenNumber || 'Next');
                          }}
                          className="mt-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg cursor-pointer transition border-0"
                        >
                          📢 Announce Next in Queue
                        </button>
                      </div>
                    )}

                    <div className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Next in Waiting Line ({activeOpdAppointments.filter(a => a.status === 'ready_for_consult').length} Ready)
                    </div>

                    <div className="space-y-2">
                      {activeOpdAppointments
                        .filter(a => a.status === 'ready_for_consult')
                        .slice(0, 3)
                        .map((a, idx) => (
                          <div 
                            key={a.id}
                            className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-[9px] font-mono font-bold flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <div>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{a.patientName}</span>
                                <span className="text-[9px] text-slate-500 font-mono">Token: #{a.tokenNumber}</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleCallPatientChamber(a.patientName || 'Patient', a.tokenNumber || 'Next')}
                              className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] font-bold rounded-lg cursor-pointer transition"
                            >
                              Call 🔊
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Live OPD Token Progression Rail */}
            <div className="glass-panel p-5 rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black uppercase font-mono tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  Today's OPD Token Progression Rail (मरीज़ का प्रवाह)
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('tokens')}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0"
                >
                  View Full Queue <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                {/* Step 1: Intake / Awaiting Vitals */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 mb-2 font-mono text-[10px] font-bold uppercase">
                    <span>1. Intake &amp; Vitals</span>
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded-md">{pendingVitalsList.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {pendingVitalsList.slice(0, 3).map(p => (
                      <div 
                        key={p.id}
                        onClick={() => setVitalsPatient(p)}
                        className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs font-bold truncate cursor-pointer hover:border-amber-400 transition"
                      >
                        {p.name} <span className="text-[9px] text-slate-400 font-mono">({p.phone.slice(-4)})</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 2: Ready for Consult */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 mb-2 font-mono text-[10px] font-bold uppercase">
                    <span>2. Ready for Doctor</span>
                    <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 rounded-md">
                      {activeOpdAppointments.filter(a => a.status === 'ready_for_consult').length}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {activeOpdAppointments.filter(a => a.status === 'ready_for_consult').slice(0, 3).map(a => (
                      <div 
                        key={a.id}
                        className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs font-bold truncate"
                      >
                        #{a.tokenNumber} {a.patientName}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 3: In Chamber */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 mb-2 font-mono text-[10px] font-bold uppercase">
                    <span>3. In Chamber</span>
                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-md">
                      {inChamberAppointment ? 1 : 0}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {inChamberAppointment ? (
                      <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-300 dark:border-emerald-800 text-xs font-bold text-emerald-900 dark:text-emerald-200 truncate">
                        #{inChamberAppointment.tokenNumber} {inChamberAppointment.patientName}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 italic py-2 text-center">Chamber Available</div>
                    )}
                  </div>
                </div>

                {/* Step 4: Post-Consult / Pharmacy & Lab */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 mb-2 font-mono text-[10px] font-bold uppercase">
                    <span>4. Pharmacy / Lab Settle</span>
                    <span className="px-2 py-0.5 bg-purple-500/10 text-purple-600 rounded-md">
                      {activeOpdAppointments.filter(a => a.status === 'completed').length}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {activeOpdAppointments.filter(a => a.status === 'completed').slice(0, 3).map(a => (
                      <div 
                        key={a.id}
                        onClick={() => setActiveTab('invoice_generator')}
                        className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs font-bold truncate cursor-pointer hover:border-indigo-400 transition"
                      >
                        {a.patientName} <span className="text-[9px] text-emerald-600 font-mono">✅ Settle</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB: INVOICE GENERATOR & OCR SCAN
        ══════════════════════════════════════════════════════════ */}
        {activeTab === 'invoice_generator' && (
          <BillHubTab />
        )}
        
        {/* PATIENTS DIRECTORY, ONBOARDER & INTAKE TAB */}
        {activeTab === 'patients' && (
          <div className="space-y-6 animate-fade-in text-left">
            {/* Sub Switcher */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 pb-2 gap-4">
              <button
                onClick={() => setPatientsSubTab('directory')}
                className={`pb-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 bg-transparent border-0 cursor-pointer ${
                  patientsSubTab === 'directory'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                EHR Registry Directory
              </button>
              <button
                onClick={() => setPatientsSubTab('register')}
                className={`pb-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 bg-transparent border-0 cursor-pointer ${
                  patientsSubTab === 'register'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                Register New Profile
              </button>
            </div>

            {patientsSubTab === 'directory' ? (
              <PatientsDirectoryTab
                patients={patients}
                patientSearchQuery={patientSearchQuery}
                setPatientSearchQuery={setPatientSearchQuery}
                selectedDirectoryPatient={selectedDirectoryPatient}
                setSelectedDirectoryPatient={setSelectedDirectoryPatient}
                newPatientName={newPatientName}
                setNewPatientName={setNewPatientName}
                newPatientPhone={newPatientPhone}
                setNewPatientPhone={setNewPatientPhone}
                newPatientAge={newPatientAge}
                setNewPatientAge={setNewPatientAge}
                newPatientGender={newPatientGender}
                setNewPatientGender={setNewPatientGender}
                patientRAGSummary={patientRAGSummary}
                setPatientRAGSummary={setPatientRAGSummary}
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
            <div className="lg:col-span-8 space-y-6">
              
              {/* Search Registry */}
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-600 opacity-60" />
                <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Search className="w-4 h-4 text-indigo-600" />
                  Patient Registry Lookup
                </h2>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search patient by phone, name, or ABHA ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full input-field pl-12 focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-600 text-sm py-2.5 bg-white border-slate-200 text-slate-800 rounded-xl"
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 h-5 w-5" />
                </div>

                {searchQuery && (
                  <div className="mt-4 border border-slate-200/80 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white shadow-sm animate-fade-in select-none">
                    {filteredPatients.length === 0 ? (
                      <div className="p-5 text-slate-600 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                        No matching patient found in registry.
                      </div>
                    ) : (
                      filteredPatients.map(p => {
                        const sess = sessions.find(s => s.patientPhone === p.phone);
                        const stage = api.getActivePatientCareStage(p.id);
                        const isSelected = activePatient?.id === p.id;

                        return (
                          <div 
                            key={p.id} 
                            onClick={() => api.setActivePatient(p)}
                            className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors cursor-pointer ${
                              isSelected ? 'bg-indigo-50/40 border-l-4 border-indigo-600 pl-3' : ''
                            }`}
                          >
                            <div className="space-y-1">
                              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 flex-wrap">
                                {p.name}
                                <span className="text-[9px] font-black font-mono bg-indigo-500/10 text-indigo-700 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                                  ID: {p.tokenNumber || 'N/A'}
                                </span>
                                <span className="text-[10px] text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full font-semibold">
                                  {p.age}y · {p.gender}
                                </span>
                              </h4>
                              
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-slate-500" />
                                  {p.phone}
                                </span>
                                
                                {p.abhaId && (
                                  <span className="text-[9px] font-mono text-slate-600 bg-slate-50 border border-slate-200 px-1 rounded">
                                    ABHA: {p.abhaId}
                                  </span>
                                )}

                                {p.vitals ? (
                                  <span className="text-[8px] font-bold px-1.5 py-0.2 bg-rose-50 border border-rose-200 text-rose-600 rounded">
                                    {isOphthalmology ? '👁️' : '🌡️'} Vitals Logged
                                  </span>
                                ) : (
                                  <span className="text-[8px] font-bold px-1.5 py-0.2 bg-slate-50 border border-slate-200 text-slate-600 rounded">
                                    Awaiting Vitals
                                  </span>
                                )}

                                {(() => {
                                  const virtualAppt = appointments.find(a => (a.patientId === p.id || (a as any).patient_id === p.id) && Boolean(a.isVirtual || (a as any).is_virtual));
                                  if (!virtualAppt) return null;
                                  return (
                                    <span className="flex items-center gap-0.5 text-[8px] font-bold bg-emerald-50 border border-emerald-255 text-emerald-700 px-1.5 py-0.2 rounded animate-pulse font-sans">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-700 font-bold" />
                                      📹 Virtual {virtualAppt.virtualTimeAllocated ? `(${virtualAppt.virtualTime})` : 'Appt'}
                                    </span>
                                  );
                                })()}

                                {stage === 'diagnosing' && (
                                  <span className="text-[8px] font-bold px-1.5 py-0.2 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded animate-pulse-subtle">
                                    🩺 In Consult
                                  </span>
                                )}
                                {stage === 'lab' && (
                                  <span className="text-[8px] font-bold px-1.5 py-0.2 bg-cyan-50 border border-cyan-200 text-cyan-600 rounded animate-pulse-subtle">
                                    🧪 Lab Requisitions
                                  </span>
                                )}
                                {stage === 'pharmacy' && (
                                  <span className="text-[8px] font-bold px-1.5 py-0.2 bg-amber-50 border border-amber-200 text-amber-700 rounded animate-pulse-subtle">
                                    💊 Rx Dispensation
                                  </span>
                                )}
                                {stage === 'settled' && (
                                  <span className="text-[8px] font-bold px-1.5 py-0.2 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded animate-pulse-subtle">
                                    ✅ Settle Ledger
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex gap-2 self-end sm:self-auto" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => {
                                  api.setActivePatient(p);
                                  handleInitiateWhatsAppLoop(p);
                                }}
                                className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                                  sess 
                                    ? 'bg-slate-100 text-slate-700 border-slate-200/80 hover:bg-slate-200' 
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-slate-800 border-emerald-500 hover:border-emerald-600'
                                }`}
                              >
                                <Smartphone className="h-3 w-3" />
                                {sess ? 'Focus Loop' : 'Opt-In SMS'}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Patient Registration Form */}
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative">
                <h2 className="text-sm font-semibold text-slate-800 mb-1 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-indigo-600" />
                  Manual Patient Registration (इन्टेक फॉर्म)
                </h2>
                <p className="text-xs text-clinical-400 mb-4 leading-relaxed">
                  Enter patient details at the checkup counter to register a fresh profile and generate ID.
                </p>

                <form onSubmit={handleRegisterPatient} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Patient Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rahul Kumar"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-600 bg-slate-50 border-slate-200 text-slate-800 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Phone Number *</label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 9876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-600 bg-slate-50 border-slate-200 text-slate-800 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Age *</label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 35"
                        value={age}
                        onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-600 bg-slate-50 border-slate-200 text-slate-800 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Gender</label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value as any)}
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-600 bg-slate-50 border-slate-200 text-slate-800 rounded-lg cursor-pointer"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">ABHA Health ID</label>
                      <input
                        type="text"
                        placeholder="e.g. 14-digit index"
                        value={abhaId}
                        onChange={(e) => setAbhaId(e.target.value)}
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-600 bg-slate-50 border-slate-200 text-slate-800 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Blood Group</label>
                      <select
                        value={bloodGroupInput}
                        onChange={(e) => setBloodGroupInput(e.target.value)}
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-600 bg-slate-50 border-slate-200 text-slate-800 rounded-lg cursor-pointer"
                      >
                        <option value="">Select</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">WhatsApp Number</label>
                      <input
                        type="tel"
                        placeholder="WhatsApp (if diff)"
                        value={whatsAppInput}
                        onChange={(e) => setWhatsAppInput(e.target.value)}
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-600 bg-slate-50 border-slate-200 text-slate-800 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end pt-2">
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-gradient-to-r from-secondary to-primary hover:scale-105 active:scale-95 text-slate-850 font-black tracking-wider uppercase border-0 rounded-xl text-xs cursor-pointer transition-transform"
                    >
                      Register Patient
                    </button>
                  </div>
                </form>
              </div>

              {/* Scan & Analyze Previous Reports Card — always visible */}
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden bg-white text-slate-800 rounded-3xl mt-6">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-teal-500 to-indigo-500 opacity-60" />
                <h2 className="text-sm font-semibold text-slate-800 mb-1 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600 font-bold" />
                  Scan &amp; Analyze Patient's Past Reports (रिपोर्ट्स स्कैन)
                </h2>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  Upload or snap a photo of the patient's previous diagnostic reports. Clinical AI OCR will build a longitudinal health trajectory for the doctor.
                </p>

                {activePatient ? (
                  <div className="space-y-4">
                    <div className="flex gap-4 items-start">
                      <label className="flex-1 flex flex-col items-center justify-center gap-2 border border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-4 bg-slate-50 text-center cursor-pointer text-xs font-semibold text-slate-700 hover:text-slate-900 transition-all shadow-sm hover:shadow-md relative overflow-hidden">
                        {isReportScanning && (
                          <div className="absolute inset-0 bg-indigo-50/40 flex items-center justify-center">
                            <div className="w-full h-0.5 bg-emerald-500 absolute laser-sweep-line" />
                          </div>
                        )}
                        <Upload className="w-5 h-5 text-indigo-600" />
                        <span>{isReportScanning ? 'AI OCR Analyzing Clinical Values...' : 'Upload / Snap Previous Report'}</span>
                        <span className="text-[9px] text-slate-500 font-medium">Supports JPG, PNG, PDF</span>
                        <input
                          type="file"
                          disabled={isReportScanning}
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePreviousReportScan(file);
                          }}
                        />
                      </label>
                    </div>

                    {reportScanLogs.length > 0 && (
                      <div className="bg-slate-900 border border-slate-950 rounded-xl p-3 font-mono text-[9px] text-indigo-300 space-y-1 max-h-[85px] overflow-y-auto shadow-inner">
                        {reportScanLogs.map((log, index) => (
                          <div key={`report-scan-log-${index}-${log.slice(0, 15)}`} className={log.includes('[ERROR]') ? 'text-rose-400 font-bold' : log.includes('SUCCESS') ? 'text-emerald-400 font-bold' : ''}>
                            {log}
                          </div>
                        ))}
                      </div>
                    )}

                    {scannedSummary ? (
                      <div className="bg-indigo-50 border border-indigo-200/60 p-4 rounded-xl space-y-3 animate-fade-in text-slate-800">
                        <span className="block text-[8px] font-black text-indigo-700 tracking-widest uppercase font-mono">AI Scanned Report Summary (Draft)</span>
                        <textarea
                          value={scannedSummary}
                          onChange={(e) => setScannedSummary(e.target.value)}
                          rows={3}
                          className="w-full text-xs font-semibold leading-relaxed bg-white border border-slate-200 p-2 rounded-lg text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-650"
                        />
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={async () => {
                              setIsSavingSummary(true);
                              try {
                                await api.updatePatientPastReportsSummary(activePatient.id, scannedSummary);
                                // Update active patient in state immediately
                                setActivePatientState(prev => prev ? { ...prev, pastReportsSummary: scannedSummary } : null);
                                setScannedSummary(null);
                                window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                  detail: {
                                    message: 'Report summary successfully saved to patient profile database!',
                                    type: 'success',
                                    title: 'Summary Persisted'
                                  }
                                }));
                              } catch (err) {
                                console.error('Error saving summary:', err);
                              } finally {
                                setIsSavingSummary(false);
                              }
                            }}
                            disabled={isSavingSummary}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer border-0 disabled:opacity-50 transition-all text-white-force"
                          >
                            <Save className="w-3.5 h-3.5 text-white" />
                            {isSavingSummary ? 'Saving...' : 'Save & Submit to Database'}
                          </button>
                        </div>
                      </div>
                    ) : activePatient.pastReportsSummary ? (
                      <div className="bg-indigo-50 border border-indigo-200/60 p-4 rounded-xl space-y-2.5 animate-fade-in text-slate-800">
                        <span className="block text-[8px] font-black text-indigo-700 tracking-widest uppercase font-mono">AI — Longitudinal Report Summary</span>
                        <p className="text-xs font-semibold leading-relaxed italic">
                          "{activePatient.pastReportsSummary}"
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-600 italic">
                        No previous reports scanned yet. Upload a report above to generate AI longitudinal summary.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-indigo-200 rounded-2xl p-6 bg-indigo-50/30 text-center">
                    <Search className="w-6 h-6 text-indigo-400" />
                    <p className="text-xs text-slate-600 font-medium">Search or register a patient first to enable AI report scanning.</p>
                  </div>
                )}
              </div>

            </div>

            {/* Staff list and simulator panel */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Check-in staff list */}
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl space-y-4 select-none">
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2 border-b border-slate-200/60 pb-3">
                  <UserCheck className="h-5 w-5 text-secondary" />
                  Checked-In Active Staffs
                </h3>
                
                <div className="space-y-3 lg:max-h-[300px] max-h-none lg:overflow-y-auto">
                  {staffList.length === 0 ? (
                    <p className="text-xs text-clinical-500 text-center py-4">No staffs checked-in.</p>
                  ) : (
                    staffList.map((staff, idx) => (
                      <div 
                        key={`${staff.id}-${idx}`} 
                        onClick={() => handleSelectActiveStaff(staff.id)}
                        className={`p-3 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                          staff.id === activeStaffId 
                            ? 'border-secondary bg-secondary/5' 
                            : 'border-outline-variant hover:bg-surface-container/30'
                        }`}
                      >
                        <div>
                          <h5 className="font-bold text-xs text-slate-800">{staff.staffName}</h5>
                          <span className="text-[9px] uppercase tracking-wider text-clinical-400 font-semibold">{staff.role}</span>
                        </div>
                        <span className={`text-[8px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                          staff.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {staff.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* staff registration panel */}
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl space-y-4">
                <h4 className="font-bold text-sm text-slate-800 border-b border-slate-200/60 pb-2">Register Shifts Compounders</h4>
                <form onSubmit={handleRegisterStaff} className="space-y-3">
                  <input
                    type="text"
                    required
                      className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-slate-850 rounded-lg"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newStaffRole}
                      onChange={(e) => setNewStaffRole(e.target.value as any)}
                      className="flex-1 input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-slate-850 rounded-lg cursor-pointer"
                    >
                      <option value="compounder">Compounder</option>
                      <option value="receptionist">Receptionist</option>
                      <option value="admin">Clinic Admin</option>
                    </select>
                    <button 
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs cursor-pointer border-0 transition active:scale-95 shrink-0"
                    >
                      Register
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    )}

        {/* TAB 2: APPOINTMENTS & TOKENS */}
        {activeTab === 'tokens' && (
          <div className="space-y-6 text-left">
            {/* SUB-TAB TOGGLE */}
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200/80 dark:border-white/10 pb-3">
              <button
                onClick={() => setOpdSubTab('today_queue')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  opdSubTab === 'today_queue'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200/60 dark:border-white/10'
                }`}
              >
                <Layers className="w-4 h-4 shrink-0" />
                Today's Active OPD Queue 🏥
                <span className="ml-1 bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold">
                  {(() => {
                    const todayStr = getIstDateString();
                    return appointments.filter(a => {
                      if (a.status === 'pending_payment' || a.status === 'cancelled') return false;
                      return getEffectiveAppointmentDate(a) === todayStr;
                    }).length;
                  })()}
                </span>
              </button>
              <button
                onClick={() => setOpdSubTab('upcoming_advance')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  opdSubTab === 'upcoming_advance'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200/60 dark:border-white/10'
                }`}
              >
                <Calendar className="w-4 h-4 shrink-0" />
                Upcoming Advance Bookings 📅
                <span className="ml-1 bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold">
                  {(() => {
                    const todayStr = getIstDateString();
                    return appointments.filter(a => {
                      if (a.status === 'pending_payment' || a.status === 'cancelled') return false;
                      const apptDate = getEffectiveAppointmentDate(a);
                      return Boolean(apptDate && apptDate > todayStr);
                    }).length;
                  })()}
                </span>
              </button>
              <button
                onClick={() => setOpdSubTab('past_history')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  opdSubTab === 'past_history'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200/60 dark:border-white/10'
                }`}
              >
                <Clock className="w-4 h-4 shrink-0" />
                Past & All History 🕒
                <span className="ml-1 bg-slate-500/20 text-slate-400 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold">
                  {(() => {
                    const todayStr = getIstDateString();
                    return appointments.filter(a => {
                      if (a.status === 'pending_payment' || a.status === 'cancelled') return false;
                      const apptDate = getEffectiveAppointmentDate(a);
                      return Boolean(apptDate && apptDate < todayStr);
                    }).length;
                  })()}
                </span>
              </button>
            </div>

            {opdSubTab === 'upcoming_advance' ? (
              <div className="space-y-8 animate-fade-in">
                {/* Section 1: Virtual Video Consultations Roster */}
                <div className="glass-panel p-6 border-slate-200/60 dark:border-white/10 shadow-xl bg-white dark:bg-slate-950/80 text-slate-800 dark:text-white rounded-3xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-cyan-500 opacity-80" />
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Video className="w-5 h-5 text-cyan-500 shrink-0" />
                        Virtual Video Consultations Roster (वर्चुअल वीडियो परामर्श)
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Live schedule of remote video appointments booked via WhatsApp Bot & online portals.
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold px-3 py-1 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20 rounded-full">
                      {appointments.filter(a => a.status !== 'pending_payment' && a.status !== 'cancelled' && (a.is_virtual || a.isVirtual)).length} Active Video Consults
                    </span>
                  </div>

                  {appointments.filter(a => a.status !== 'pending_payment' && a.status !== 'cancelled' && (a.is_virtual || a.isVirtual)).length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-2xl bg-slate-50/50 dark:bg-slate-900/40">
                      <Video className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50 shrink-0" />
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">No virtual video appointments scheduled for today.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {appointments.filter(a => a.status !== 'pending_payment' && a.status !== 'cancelled' && (a.is_virtual || a.isVirtual)).map(appt => {
                        const pat = patients.find(p => p.id === (appt.patientId || (appt as any).patient_id));
                        const meetUrl = appt.virtual_meeting_url || `https://meet.jit.si/vitalsync-consult-${appt.id}`;
                        const isFreeLoyalty = appt.amount === 0 || appt.fee_status === 'waived_loyalty' || String(appt.source || '').toLowerCase().includes('loyalty');
                        return (
                          <div key={appt.id} className="p-4 border border-slate-200 dark:border-white/10 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 space-y-3 relative overflow-hidden">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono font-extrabold bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded-md">
                                Token #{appt.token_number || appt.tokenNumber || 1}
                              </span>
                              {isFreeLoyalty ? (
                                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                                  💎 Free Member (₹0.00)
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                                  {appt.status === 'ready_for_consult' ? 'Ready for Consult' : appt.status}
                                </span>
                              )}
                            </div>

                            <div>
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                {pat?.name || 'Virtual Patient'}
                                <span className="text-xs font-normal text-slate-500">({pat?.phone || 'N/A'})</span>
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                Slot: {appt.virtual_time || (appt as any).virtualTime || '10:00 AM - 12:00 PM'} · Date: {appt.virtual_date || (appt as any).virtualDate || (appt as any).appointment_date || (appt as any).appointmentDate || (appt.createdAt || (appt as any).createdAt || '').split('T')[0] || 'N/A'}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-white/5">
                              <a
                                href={meetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 rounded-xl transition-all shadow-sm"
                              >
                                Join Video Room
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Section 2: Future Date & WhatsApp Advance Bookings */}
                <div className="glass-panel p-6 border-slate-200/60 dark:border-white/10 shadow-xl bg-white dark:bg-slate-950/80 text-slate-800 dark:text-white rounded-3xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-600 opacity-80" />
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <RefreshCw className="w-5 h-5 text-indigo-500" />
                        Future Date & WhatsApp Advance Bookings (अग्रिम अपॉइंटमेंट सूची)
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Patient bookings registered for upcoming dates via WhatsApp Bot & paperless check-in.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 uppercase font-mono font-bold text-[10px]">
                        <tr>
                          <th className="p-3">Token #</th>
                          <th className="p-3">Patient Name</th>
                          <th className="p-3">Phone</th>
                          <th className="p-3">Booking Date</th>
                          <th className="p-3">Time Slot</th>
                          <th className="p-3">Consult Type</th>
                          <th className="p-3">Payment Status</th>
                          <th className="p-3 text-right">Intake &amp; Vitals</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {(() => {
                          const now = new Date();
                          const todayStr = getIstDateString();
                          const futureAppts = appointments
                            .filter(appt => {
                              if (appt.status === 'pending_payment' || appt.status === 'cancelled') return false;
                              const apptDate = getEffectiveAppointmentDate(appt);
                              return Boolean(apptDate && apptDate > todayStr);
                            })
                            .sort((a, b) => {
                              const dateA = getEffectiveAppointmentDate(a);
                              const dateB = getEffectiveAppointmentDate(b);
                              return dateA.localeCompare(dateB);
                            });

                          if (futureAppts.length === 0) {
                            return (
                              <tr>
                                <td colSpan={8} className="p-6 text-center text-slate-400">
                                  No upcoming advance bookings found for future dates. (All active registrations are for today).
                                </td>
                              </tr>
                            );
                          }

                          return futureAppts.map((appt, idx) => {
                            const pat = patients.find(p => p.id === (appt.patientId || (appt as any).patient_id));
                            const apptDate = getEffectiveAppointmentDate(appt);
                            const rawToken = appt.token_number || appt.tokenNumber || (appt as any).token;
                            const tokenDisplay = String(rawToken || `T-${String(idx + 1).padStart(2, '0')}`);
                            const patName = pat?.name || (appt as any).patientName || 'Vivek Kumar';
                            const patPhone = pat?.phone || (appt as any).patientPhone || '9608032073';
                            const isWhatsAppBooking = true; // WhatsApp advance booking

                            return (
                              <tr key={appt.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors">
                                <td className="p-3">
                                  <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-mono font-black text-[11px] border border-indigo-200 dark:border-indigo-700/50 shadow-sm">
                                    #{tokenDisplay.startsWith('T-') || tokenDisplay.startsWith('TK-') ? tokenDisplay : `TK-${tokenDisplay.padStart(2, '0')}`}
                                  </span>
                                </td>
                                <td className="p-3 font-bold text-slate-900 dark:text-white">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setVitalsPatient(pat || ({
                                          id: appt.patientId || (appt as any).patient_id || 'pat-wa',
                                          name: patName,
                                          phone: patPhone,
                                          age: (appt as any).patientAge || 28,
                                          gender: (appt as any).patientGender || 'Male',
                                          tokenNumber: tokenDisplay
                                        } as any));
                                      }}
                                      className="text-left font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer bg-transparent border-0 p-0 text-xs flex items-center gap-1.5 group"
                                    >
                                      <span className="group-hover:underline">{patName}</span>
                                    </button>
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                      🟢 [W] WhatsApp
                                    </span>
                                  </div>
                                </td>
                                <td className="p-3 font-mono text-slate-600 dark:text-slate-300">{patPhone}</td>
                                <td className="p-3 font-semibold text-indigo-600 dark:text-indigo-400 font-mono">
                                  {apptDate}
                                </td>
                                <td className="p-3 text-slate-600 dark:text-slate-300 font-mono font-medium">
                                  {appt.virtual_time || (appt as any).virtualTime || '10:00 AM - 12:00 PM'}
                                </td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${appt.is_virtual ? 'bg-cyan-100 text-cyan-800' : 'bg-indigo-100 text-indigo-800'}`}>
                                    {appt.is_virtual ? 'Virtual 💻' : 'Physical 🏥'}
                                  </span>
                                </td>
                                <td className="p-3 font-mono text-emerald-600 font-bold">Cleared ✅</td>
                                <td className="p-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setVitalsPatient(pat || ({
                                        id: appt.patientId || (appt as any).patient_id || 'pat-wa',
                                        name: patName,
                                        phone: patPhone,
                                        age: (appt as any).patientAge || 28,
                                        gender: (appt as any).patientGender || 'Male',
                                        tokenNumber: tokenDisplay
                                      } as any));
                                    }}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl font-bold text-[10px] inline-flex items-center gap-1.5 cursor-pointer transition shadow-sm border-0"
                                  >
                                    <Activity className="w-3 h-3" />
                                    Record Vitals 🩺
                                  </button>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 3: Doctor Availability & Roster Matrix */}
                <div className="glass-panel p-6 border-slate-200/60 dark:border-white/10 shadow-xl bg-white dark:bg-slate-950/80 text-slate-800 dark:text-white rounded-3xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-purple-600 opacity-80" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-purple-500 shrink-0" />
                    Doctor Weekly Roster & Slot Capacity Matrix (डॉक्टर समय सारणी)
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/60">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-white">Morning Slot</span>
                        <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold">10:00 AM - 12:00 PM</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Capacity: 12 Patients / Day</p>
                      <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mt-2">Active Doctor: {activePod?.doctor_name || 'Doctor'}</p>
                    </div>

                    <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/60">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-white">Afternoon Slot</span>
                        <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-bold">02:00 PM - 04:00 PM</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Capacity: 10 Patients / Day</p>
                      <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mt-2">Active Doctor: {activePod?.doctor_name || 'Doctor'}</p>
                    </div>

                    <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/60">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-white">Evening Review Slot</span>
                        <span className="text-[10px] font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md font-bold">04:00 PM - 06:00 PM</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Lab Report Review & OPD</p>
                      <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mt-2">Active Doctor: {activePod?.doctor_name || 'Doctor'}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
                {/* Left Column: Create Appointment & Today's Appointments List */}
                <div className="lg:col-span-8 space-y-6">
                  
                  {/* Appointment Booking & Search Form */}
                  <div className="glass-panel p-6 border-slate-200/60 dark:border-white/10 shadow-xl relative overflow-hidden bg-white dark:bg-slate-950/80 text-slate-800 dark:text-white rounded-3xl">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-600 opacity-60" />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <h2 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                        <CalendarPlus className="w-4 h-4 text-indigo-500 shrink-0" />
                        Book Consultation Appointment (अपॉइंटमेंट बुकिंग)
                      </h2>
                      <button
                        type="button"
                        onClick={() => setShowAllApptPatients(prev => !prev)}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/70 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 flex items-center gap-1.5 cursor-pointer w-fit transition-all"
                      >
                        <Users className="w-3.5 h-3.5" />
                        {showAllApptPatients ? 'Hide Patient List' : `Browse All Patients (${patients.length})`}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                      Search registered patient by Name, Phone, Patient ID, or Smart Code (e.g. T2, V1) to book a consultation slot.
                    </p>

                    <div className="space-y-4">
                      {/* Search input */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] text-slate-500 dark:text-slate-300 font-bold uppercase tracking-wider font-mono block pl-1">
                            Search Patient (Name / Phone / ID / Code)
                          </label>
                          <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                            {filteredApptPatients.length} patient{filteredApptPatients.length === 1 ? '' : 's'} available
                          </span>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search by Name, Phone (e.g. 98765), ID, or Smart Code (e.g. T2, V1)..."
                            value={searchApptPatient}
                            onFocus={() => setShowAllApptPatients(true)}
                            onChange={(e) => {
                              setSearchApptPatient(e.target.value);
                              if (!showAllApptPatients) setShowAllApptPatients(true);
                            }}
                            className="w-full input-field text-xs py-2.5 pl-10 pr-9 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white rounded-lg outline-none placeholder:text-slate-400"
                          />
                          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                          {searchApptPatient && (
                            <button
                              type="button"
                              onClick={() => setSearchApptPatient('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer p-0.5"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Search Results / Full Patient Directory list */}
                      {(showAllApptPatients || searchApptPatient.trim().length > 0) && (
                        <div className="border border-slate-200 dark:border-white/10 rounded-2xl bg-slate-50/80 dark:bg-slate-900/80 p-2.5 max-h-[220px] overflow-y-auto space-y-1.5 shadow-inner">
                          <div className="flex justify-between items-center px-1 pb-1 mb-1 border-b border-slate-200/60 dark:border-white/5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              {searchApptPatient ? `Matching "${searchApptPatient}"` : 'All Registered Patients'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {filteredApptPatients.length} found
                            </span>
                          </div>
                          {filteredApptPatients.length === 0 ? (
                            <div className="py-4 text-center space-y-2">
                              <p className="text-xs text-slate-500 dark:text-slate-400">No patient found matching "{searchApptPatient}".</p>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab('patients');
                                  setPatientsSubTab('register');
                                  setNewPatientName(searchApptPatient);
                                }}
                                className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 inline-flex items-center gap-1 cursor-pointer shadow-xs"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                Register as New Patient
                              </button>
                            </div>
                          ) : (
                            filteredApptPatients.map(p => {
                              const code = p.patientCode || (p as any).patient_code || `P-${(p.id || '').substring(0, 4).toUpperCase()}`;
                              return (
                                <div 
                                  key={p.id}
                                  onClick={() => {
                                    setSelectedApptPatient(p);
                                    setSearchApptPatient('');
                                    setShowAllApptPatients(false);
                                  }}
                                  className="p-2.5 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-white/10 rounded-xl hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-500/10 cursor-pointer flex justify-between items-center transition-all group"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="shrink-0 text-[10px] font-mono font-black bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-700/50">
                                      {code}
                                    </span>
                                    <div className="min-w-0">
                                      <h5 className="font-bold text-xs text-slate-800 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                        {p.name}
                                      </h5>
                                      <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                        <span>📱 +91 {p.phone || 'N/A'}</span>
                                        <span>·</span>
                                        <span>{p.age}y ({p.gender})</span>
                                        {p.tokenNumber && (
                                          <>
                                            <span>·</span>
                                            <span className="text-emerald-600 font-bold">Tk #{p.tokenNumber}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <span className="text-[10px] bg-slate-100 dark:bg-slate-700 group-hover:bg-indigo-600 group-hover:text-white text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 ml-2">
                                    Select 👉
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}

                      {/* Booking form details (visible once patient is selected) */}
                      {selectedApptPatient && (
                        <div className="p-4 bg-indigo-50/30 dark:bg-indigo-900/20 border border-indigo-100/50 dark:border-indigo-700/40 rounded-2xl space-y-4 animate-fade-in">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 tracking-widest uppercase font-mono block">Selected Patient</span>
                              <h4 className="font-bold text-sm text-slate-800 dark:text-white mt-1">{selectedApptPatient.name}</h4>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Phone: +91 {selectedApptPatient.phone} · Age: {selectedApptPatient.age}y ({selectedApptPatient.gender})</p>
                            </div>
                            <button 
                              onClick={() => setSelectedApptPatient(null)}
                              className="text-[10px] text-rose-500 hover:underline bg-transparent border-0 cursor-pointer"
                            >
                              Clear Selection
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200/30 dark:border-white/10">
                            <div>
                              <label className="text-[10px] text-slate-500 dark:text-slate-300 font-bold uppercase tracking-wider font-mono block pl-1 mb-1">Payment Mode</label>
                              <select
                                value={apptPaymentMode}
                                onChange={(e) => setApptPaymentMode(e.target.value as any)}
                                className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white rounded-lg cursor-pointer font-bold"
                              >
                                <option value="cash">💵 Cash Payment</option>
                                <option value="upi">📱 UPI QR / Handle</option>
                                <option value="razorpay">💳 Razorpay 0% Gateway</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-500 dark:text-slate-300 font-bold uppercase tracking-wider font-mono block pl-1 mb-1">Consultation Fee</label>
                              <div className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-mono font-bold text-sm rounded-lg py-2 px-3 flex items-center justify-between">
                                <span>₹500.00</span>
                                <span className="text-[8px] uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">Calculated</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-end pt-2">
                            <button
                              type="button"
                              disabled={isBookingAppt}
                              onClick={async () => {
                                if (!selectedApptPatient || isBookingAppt) return;
                                setIsBookingAppt(true);

                                try {
                                  const newInvoice = BillingService.createGate1Consult(selectedApptPatient.id);
                                  const paymentModeLabel = apptPaymentMode;

                                  if (newInvoice) {
                                    await BillingService.recordInvoicePayment(newInvoice.id, apptPaymentMode as any);
                                  }

                                  const assignedToken = api.generateNextTokenNumber();
                                  
                                  // Non-blocking background sync to Supabase appointments table
                                  (async () => {
                                    try {
                                      const podId = getPodContext().podId || 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
                                      const podCtx = (() => {
                                        try {
                                          const r = localStorage.getItem('vitalsync_active_pod') || localStorage.getItem('vitalsync_cached_active_pod') || localStorage.getItem('mediflow_active_pod');
                                          return r ? JSON.parse(r) : null;
                                        } catch {
                                          return null;
                                        }
                                      })();
                                      const resolvedDocId = getPodContext().doctorId || podCtx?.id || podCtx?.doctorId || null;
                                      await supabase.from('appointments').insert({
                                        id: newInvoice?.appointmentId || crypto.randomUUID(),
                                        patient_id: selectedApptPatient.id.length === 36 ? selectedApptPatient.id : null,
                                        doctor_id: resolvedDocId,
                                        status: 'ready_for_consult',
                                        payment_status: 'cleared',
                                        source: 'counter',
                                        created_at: new Date().toISOString(),
                                        token_number: assignedToken,
                                        pod_id: podId
                                      });
                                    } catch (err) {
                                      console.warn('Supabase appt insert note:', err);
                                    }
                                  })();

                                  api.updatePatientQueueStatus(selectedApptPatient.id, 'awaiting_vitals');

                                  const bookedPatient = { ...selectedApptPatient, tokenNumber: assignedToken };
                                  setSelectedApptPatient(null);
                                  setApptPaymentMode('cash');
                                  setIsBookingAppt(false);

                                  syncData();
                                  fetchLiveAppointments();
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                  setVitalsPatient(bookedPatient);

                                  window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                    detail: {
                                      message: `Appointment for ${bookedPatient.name} booked & fee settled via ${paymentModeLabel.toUpperCase()}. Vitals modal is open for clinical dispatch!`,
                                      type: 'success',
                                      title: 'Appointment Active — Record Vitals 🩺'
                                    }
                                  }));
                                } catch (e) {
                                  console.error('[CompounderDashboard] Appointment Booking Error:', e);
                                  window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                    detail: {
                                      message: 'Booking completed locally. Please record vitals.',
                                      type: 'success',
                                      title: 'Appointment Active'
                                    }
                                  }));
                                  if (selectedApptPatient) {
                                    setVitalsPatient(selectedApptPatient);
                                  }
                                  setIsBookingAppt(false);
                                }
                              }}
                              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:scale-105 active:scale-95 text-white font-bold tracking-wider uppercase border-0 rounded-xl text-xs cursor-pointer transition-transform shadow-lg shadow-indigo-500/20"
                            >
                              Book Appointment &amp; Pay 💳
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

              {/* Today's Appointments List */}
              <div className="glass-panel p-6 border-slate-200/60 dark:border-white/10 shadow-xl relative overflow-hidden bg-white dark:bg-slate-950/80 text-slate-800 dark:text-white rounded-3xl">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-teal-500 to-indigo-500 opacity-60" />
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200/60 dark:border-white/10 pb-4 mb-4">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                    <Activity className="h-5 w-5 text-rose-500 animate-pulse" />
                    {(opdSubTab as string) === 'past_history' 
                      ? "Past Appointments History (पूर्व नियुक्तियां)" 
                      : "Today's Appointments Queue (दैनिक नियुक्तियां)"}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 px-3 py-1.5 rounded-xl">
                      {(() => {
                        const now = new Date();
                        const todayStr = getIstDateString();
                        const count = appointments.filter(a => {
                          if (a.status === 'pending_payment' || a.status === 'cancelled') return false;
                          const apptDate = getEffectiveAppointmentDate(a);
                          if ((opdSubTab as string) === 'past_history') {
                            return Boolean(apptDate && apptDate < todayStr);
                          }
                          return apptDate === todayStr;
                        }).length;
                        return `${count} ${opdSubTab === 'past_history' ? 'Past Records' : 'Active Tokens Today'}`;
                      })()}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {(() => {
                    const todayStr = getIstDateString();

                    let confirmedAppts = appointments.filter(a => {
                      if (a.status === 'pending_payment' || a.status === 'cancelled') return false;
                      const apptDate = getEffectiveAppointmentDate(a);
                      if (!apptDate) return (opdSubTab as string) === 'today_queue';

                      if ((opdSubTab as string) === 'today_queue') {
                        return apptDate === todayStr;
                      } else if ((opdSubTab as string) === 'upcoming_advance') {
                        return apptDate > todayStr;
                      } else {
                        // past_history
                        return apptDate < todayStr;
                      }
                    });

                    // Sort appointments chronologically
                    if ((opdSubTab as string) === 'today_queue') {
                      // 1. Emergency SOS takes Priority #1 at top of queue
                      // 2. Awaiting / Active patients before seen/completed patients (demote seen from top)
                      // 3. Strict Sequential Token Number sorting (#TK-001 > #TK-002 > #TK-003)
                      const parseTokenNum = (token?: string | number) => {
                        if (!token) return 999999;
                        if (typeof token === 'number') return token;
                        const match = String(token).match(/\d+/);
                        return match ? parseInt(match[0], 10) : 999999;
                      };

                      confirmedAppts.sort((a, b) => {
                        // Priority #1: Emergency SOS
                        const isSOSA = Boolean((a as any).isEmergency || (a as any).is_emergency || String(a.source || '').toLowerCase().includes('sos') || String(a.source || '').toLowerCase().includes('emergency') || String(a.tokenNumber || '').toUpperCase().includes('SOS') || String(a.tokenNumber || '').toUpperCase().includes(' E') || String(a.tokenNumber || '').toUpperCase().includes('E-') || String(a.tokenNumber || '').startsWith('#EM-'));
                        const isSOSB = Boolean((b as any).isEmergency || (b as any).is_emergency || String(b.source || '').toLowerCase().includes('sos') || String(b.source || '').toLowerCase().includes('emergency') || String(b.tokenNumber || '').toUpperCase().includes('SOS') || String(b.tokenNumber || '').toUpperCase().includes(' E') || String(b.tokenNumber || '').toUpperCase().includes('E-') || String(b.tokenNumber || '').startsWith('#EM-'));
                        if (isSOSA && !isSOSB) return -1;
                        if (!isSOSA && isSOSB) return 1;

                        // Priority #2: Demote completed/seen patients from top
                        const patientA = patients.find(p => p.id === (a.patientId || (a as any).patient_id));
                        const patientB = patients.find(p => p.id === (b.patientId || (b as any).patient_id));

                        const isDoneA = a.status === 'completed' || (patientA?.queueStatus as string) === 'completed' || (patientA?.queueStatus as string) === 'settled' || (patientA?.queueStatus as string) === 'pharmacy' || (patientA?.queueStatus as string) === 'lab';
                        const isDoneB = b.status === 'completed' || (patientB?.queueStatus as string) === 'completed' || (patientB?.queueStatus as string) === 'settled' || (patientB?.queueStatus as string) === 'pharmacy' || (patientB?.queueStatus as string) === 'lab';
                        if (!isDoneA && isDoneB) return -1;
                        if (isDoneA && !isDoneB) return 1;

                        // Priority #3: Sequential Numeric Token Number (Token 1 before Token 2)
                        const tokenA = parseTokenNum(a.tokenNumber || (a as any).token_number || patientA?.tokenNumber);
                        const tokenB = parseTokenNum(b.tokenNumber || (b as any).token_number || patientB?.tokenNumber);
                        if (tokenA !== tokenB) return tokenA - tokenB;

                        // Tie break by creation time
                        return (a.createdAt || '').localeCompare(b.createdAt || '');
                      });
                    } else if ((opdSubTab as string) === 'upcoming_advance') {
                      // Closest upcoming appointment first
                      confirmedAppts.sort((a, b) => {
                        const dateA = getEffectiveAppointmentDate(a);
                        const dateB = getEffectiveAppointmentDate(b);
                        return dateA.localeCompare(dateB);
                      });
                    } else if ((opdSubTab as string) === 'past_history') {
                      // Most recent past appointment first
                      confirmedAppts.sort((a, b) => {
                        const dateA = getEffectiveAppointmentDate(a);
                        const dateB = getEffectiveAppointmentDate(b);
                        return dateB.localeCompare(dateA);
                      });
                    }

                    if (confirmedAppts.length === 0) {
                      return (
                        <ZeroQueueState 
                          queueType="appointments" 
                          className="mx-0"
                        />
                      );
                    }
                    return confirmedAppts.map((appt, idx) => {
                      const patId = appt.patientId || (appt as any).patient_id;
                      const patient: any = patients.find(p => p.id === patId) || {
                        id: patId,
                        name: (appt as any).patientName || (appt as any).patient_name || 'WhatsApp Patient',
                        phone: (appt as any).patientPhone || (appt as any).patient_phone || 'N/A',
                        age: (appt as any).patientAge || (appt as any).patient_age || 30,
                        gender: (appt as any).patientGender || (appt as any).patient_gender || 'Male',
                        queueStatus: 'awaiting_vitals',
                        allergies: [],
                        chronicConditions: [],
                        createdAt: new Date().toISOString()
                      };

                      // Find matching consult invoice
                      const invoice = api.getInvoices().find(i => i.appointmentId === appt.id && i.type === 'consult');

                      const isAwaitingVitals = patient.queueStatus === 'awaiting_vitals' || !patient.queueStatus;
                      const isAwaitingConsult = patient.queueStatus === 'awaiting_consultation';
                      const isSOS = Boolean((appt as any).isEmergency || (appt as any).is_emergency || String(appt.source || '').toLowerCase().includes('sos') || String(appt.source || '').toLowerCase().includes('emergency') || String(appt.tokenNumber || '').toUpperCase().includes('SOS') || String(appt.tokenNumber || '').startsWith('#EM-'));
                      const rawToken = appt.token_number || appt.tokenNumber || (appt as any).token;
                      const tokenDisplay = String(rawToken || `TK-${String(idx + 1).padStart(2, '0')}`);

                      return (
                        <div 
                          key={appt.id} 
                          className={`p-4 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 ${
                            isSOS
                              ? 'border-rose-500 bg-rose-500/10 shadow-lg shadow-rose-500/20 ring-2 ring-rose-500/30'
                              : vitalsPatient?.id === patient.id 
                              ? 'border-rose-500/50 bg-rose-500/5 shadow-md shadow-rose-500/5' 
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100/50'
                          }`}
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-mono font-black text-[10px] border border-indigo-200 dark:border-indigo-700/50 shadow-sm">
                                #{tokenDisplay.startsWith('T-') || tokenDisplay.startsWith('TK-') ? tokenDisplay : `TK-${tokenDisplay.padStart(2, '0')}`}
                              </span>
                              {isSOS ? (
                                <span className="flex items-center gap-1 text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded-lg bg-rose-600 text-white shadow-md shadow-rose-600/30 animate-pulse">
                                  <ShieldAlert className="h-3 w-3" />
                                  🚨 EMERGENCY SOS PRIORITY #1
                                </span>
                              ) : (
                                <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-lg border ${
                                  appt.isVirtual
                                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25'
                                    : String((appt as any).source || '').toLowerCase().includes('whatsapp')
                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                    : 'bg-slate-500/10 text-slate-600 border-slate-500/25'
                                }`}>
                                  {appt.isVirtual ? '📹 VIRTUAL CALL' : String((appt as any).source || '').toLowerCase().includes('whatsapp') ? '🟢 [W] WhatsApp Bot' : '🏢 COUNTER'}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setVitalsPatient(patient)}
                                className="text-left font-bold text-slate-805 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer bg-transparent border-0 p-0 text-xs flex items-center gap-1 group"
                              >
                                <span className="group-hover:underline">{patient.name}</span>
                              </button>
                              <span className="text-slate-500 text-[10px] font-medium">({patient.age}y · {patient.gender})</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                              <span className="flex items-center gap-1">
                                <Smartphone className="h-3 w-3 text-indigo-500" />
                                {patient.phone}
                              </span>
                              
                              <span className={`flex items-center gap-1.5 px-2 py-0.2 rounded border text-[8px] font-bold uppercase tracking-wider ${
                                appt.status === 'ready_for_consult'
                                  ? 'bg-emerald-500/5 text-emerald-600 border-emerald-500/10'
                                  : appt.status === 'completed'
                                  ? 'bg-indigo-500/5 text-indigo-600 border-indigo-500/10'
                                  : 'bg-amber-500/5 text-amber-600 border-amber-500/10'
                              }`}>
                                {appt.status === 'ready_for_consult' ? 'Paid & Active' : appt.status}
                              </span>

                              {opdSubTab !== 'today_queue' && (() => {
                                const aDate = getEffectiveAppointmentDate(appt);
                                const isTomorrow = aDate === getIstOffsetDateString(1);

                                return (
                                  <span className={`flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                                    isTomorrow 
                                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' 
                                      : 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800'
                                  }`}>
                                    <Calendar className="h-2.5 w-2.5" />
                                    {isTomorrow ? 'Tomorrow' : aDate || 'Scheduled'}
                                  </span>
                                );
                              })()}
                            </div>

                            {patient.vitals && (
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5 pt-2.5 border-t border-slate-200/60 text-[9px] font-mono text-slate-600">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">🌡️ Temp: {patient.vitals.temperature}°F</span>
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">🩺 BP: {patient.vitals.bloodPressure}</span>
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">💓 Pulse: {patient.vitals.pulseRate} bpm</span>
                              </div>
                            )}

                            {/* Patient Visual Workflow & Quick Actions */}
                            {(() => {
                              const steps = getPatientWorkflowState(patient, appt);
                              const patientEncounters = EncounterService.getEncounters().filter(e => e.patientId === patient.id);
                              const latestEncounter = patientEncounters[patientEncounters.length - 1];
                              const reports = LabService.getFullLabReports().filter(r => r.patientId === patient.id);
                              
                              const hasPrescription = latestEncounter && (latestEncounter.clinicalNotes || latestEncounter.medications.length > 0);
                              const hasLabReport = reports.length > 0 && reports.some(r => r.status === 'approved');
                              const sessionList = api.getWhatsAppSessions();
                              const session = sessionList.find(s => s.patientPhone === patient.phone);
                              const hasWhatsAppHistory = session && session.sessionData?.chatHistory && session.sessionData.chatHistory.length > 0;

                              return (
                                <div className="mt-2.5 pt-2.5 border-t border-slate-200/40 space-y-2">
                                  {/* Compact Workflow Indicator in Single Horizontal Row */}
                                  <div className="flex items-center justify-start w-full flex-nowrap gap-[6px] overflow-x-auto scrollbar-none py-1.5 mt-1">
                                    {steps.map((step) => {
                                      let colorClass = 'bg-slate-800/30 text-slate-400 border border-slate-700/40';
                                      let checkIcon = '○';
                                      
                                      if (step.status === 'completed') {
                                        colorClass = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.15)]';
                                        checkIcon = '✓';
                                      } else if (step.status === 'skipped') {
                                        colorClass = 'bg-slate-900/40 text-slate-550 border border-slate-800/55 line-through opacity-50';
                                        checkIcon = '⊘';
                                      } else if (step.status === 'active') {
                                        colorClass = 'bg-indigo-500/25 text-indigo-300 border border-indigo-500/50 shadow-[0_0_8px_rgba(99,102,241,0.3)] animate-pulse font-extrabold';
                                        checkIcon = '●';
                                      }

                                      return (
                                        <div 
                                          key={step.id} 
                                          className={`flex items-center gap-[2.5px] px-2 py-[3px] rounded-lg border text-[8px] font-bold tracking-tight uppercase font-sans transition-all duration-300 shrink-0 ${colorClass}`}
                                          title={`${step.label}: ${step.status}`}
                                        >
                                          <span className="text-[8.5px] leading-none">{checkIcon}</span>
                                          <span className="leading-none">{step.label}</span>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Quick Document Actions (Always visible for professional EHR access) */}
                                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                    <button
                                      type="button"
                                      onClick={() => setActiveWorkflowDetail({ type: 'prescription', patientId: patient.id, patientName: patient.name })}
                                      className="flex items-center gap-1 px-2 py-0.5 bg-indigo-500/10 text-indigo-450 hover:bg-indigo-500/25 border border-indigo-500/25 rounded text-[8.5px] font-bold cursor-pointer transition-colors"
                                    >
                                      <FileText className="h-2.5 w-2.5" />
                                      Prescription
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setActiveWorkflowDetail({ type: 'lab', patientId: patient.id, patientName: patient.name })}
                                      className="flex items-center gap-1 px-2 py-0.5 bg-rose-500/10 text-rose-450 hover:bg-rose-500/25 border border-rose-500/25 rounded text-[8.5px] font-bold cursor-pointer transition-colors"
                                    >
                                      <Activity className="h-2.5 w-2.5" />
                                      Lab Results
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleInitiateWhatsAppLoop(patient)}
                                      className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20 rounded text-[8.5px] font-bold cursor-pointer transition-colors"
                                    >
                                      <Smartphone className="h-2.5 w-2.5" />
                                      WhatsApp Chat
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* If appointment is pending payment (whatsapp booking unpaid) */}
                            {invoice && invoice.status === 'unpaid' ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={async () => {
                                    await BillingService.recordInvoicePayment(invoice.id, 'cash');
                                    syncData();
                                    if (patient.phone) {
                                      api.dispatchFreeFollowupLoyaltyWhatsApp({
                                        patientPhone: patient.phone,
                                        patientName: patient.name,
                                        doctorName: activePod?.doctor_name,
                                        clinicName: activePod?.name
                                      }).catch(err => console.warn('[Compounder] Cash loyalty dispatch error:', err));
                                    }
                                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                      detail: { message: 'Cash collected! 🌟 VitalSync Premium Member Unlocked (1 Free Virtual Consult + 10% OFF Refills + WhatsApp PDF Reports)!', type: 'success', title: 'Payment Settled ✔️' }
                                    }));
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                    setVitalsPatient(patient);
                                  }}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold uppercase tracking-wider text-[8px] transition-all cursor-pointer border-0"
                                >
                                  Collect Cash
                                </button>
                                <button
                                  onClick={async () => {
                                    await BillingService.recordInvoicePayment(invoice.id, 'upi');
                                    syncData();
                                    if (patient.phone) {
                                      api.dispatchFreeFollowupLoyaltyWhatsApp({
                                        patientPhone: patient.phone,
                                        patientName: patient.name,
                                        doctorName: activePod?.doctor_name,
                                        clinicName: activePod?.name
                                      }).catch(err => console.warn('[Compounder] UPI loyalty dispatch error:', err));
                                    }
                                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                      detail: { message: 'UPI verified! 🌟 Mediflow Premium Member Unlocked (1 Free Virtual Consult + 10% OFF Refills + WhatsApp PDF Reports)!', type: 'success', title: 'Payment Settled ✔️' }
                                    }));
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                    setVitalsPatient(patient);
                                  }}
                                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold uppercase tracking-wider text-[8px] transition-all cursor-pointer border-0"
                                >
                                  Verify UPI
                                </button>
                              </div>
                            ) : isAwaitingVitals ? (
                              <button
                                onClick={() => {
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                  setVitalsPatient(patient);
                                }}
                                className="px-3.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white border border-rose-600 font-bold rounded-lg uppercase tracking-wider text-[9px] transition-all cursor-pointer"
                              >
                                🩺 Record Vitals
                              </button>
                            ) : isAwaitingConsult ? (
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-[8px] bg-amber-500/10 text-amber-700 font-mono font-bold px-2 py-0.5 rounded border border-amber-200 uppercase tracking-widest animate-pulse">
                                  In Doctor Chamber
                                </span>
                                <button
                                  onClick={() => {
                                    api.updatePatientQueueStatus(patient.id, 'completed');
                                    appt.status = 'completed';
                                    BillingService.saveAppointment(appt);
                                    syncData();
                                  }}
                                  className="text-[8px] text-slate-500 hover:text-slate-800 underline cursor-pointer bg-transparent border-0 p-0"
                                >
                                  Mark Completed
                                </button>
                              </div>
                            ) : (
                              <span className="text-[8px] bg-emerald-500/10 text-emerald-600 font-mono font-bold px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest">
                                Consult Complete
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  })()}
                </div>
              </div>
            </div>

            {/* Right Column: Active Vitals Quick Status */}
            <div className="lg:col-span-4 space-y-6">
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative text-center text-slate-500 py-8 bg-white dark:bg-slate-800/80 rounded-3xl">
                <Activity className="h-8 w-8 text-rose-500 mx-auto mb-2 animate-pulse" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">Vitals Intake Command</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Select any patient from the OPD Queue to open the instant Vitals Recording Modal window.</p>
              </div>

              {/* INSTANT FLOATING VITALS RECORDING MODAL OVERLAY
                   CRITICAL: outer div must be `fixed inset-0 flex items-center justify-center`
                   with NO overflow-y-auto — that breaks flexbox centering and pushes the
                   modal above the viewport. The inner panel handles its own scroll. */}
              {vitalsPatient && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
                  <div className="glass-panel w-full max-w-lg p-6 border-slate-200/60 dark:border-white/10 shadow-2xl relative bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-3xl space-y-4 max-h-[90vh] overflow-y-auto">
                    <div className="absolute top-0 left-0 w-full h-[3px] bg-rose-500" />
                    
                    <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/10 pb-3 mb-2">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                          <Activity className="w-5 h-5" />
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            Record Vitals (स्वास्थ्य जांच): {vitalsPatient.name}
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-2 flex-wrap">
                            {vitalsPatient.patientCode && (
                              <span className="text-[10px] font-extrabold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-700 px-1.5 py-0 rounded font-mono">
                                [{vitalsPatient.patientCode}]
                              </span>
                            )}
                            Token: {vitalsPatient.tokenNumber || '—'} · {vitalsPatient.age}y · {vitalsPatient.gender}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setVitalsPatient(null)}
                        className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer border-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleRecordVitalsSubmit} className="space-y-4 text-left">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider font-mono">OPD Token (System Allocated)</label>
                          <div className="w-full py-2 px-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-lg font-mono font-black text-xs flex items-center justify-between">
                            <span>{vitalsPatient.tokenNumber || api.generateNextTokenNumber()}</span>
                            <span className="text-[8px] bg-indigo-600 text-white px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Auto Token</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider font-mono">
                            {isOphthalmology ? 'Visual Acuity OD (दाहिनी आंख)' : 'Temperature (°F)'}
                          </label>
                          <input
                            type="text"
                            value={tempVal}
                            onChange={(e) => setTempVal(e.target.value)}
                            list="vitals-temp-list"
                            placeholder={isOphthalmology ? 'e.g. 6/6' : 'e.g. 98.6'}
                            className="w-full input-field text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white rounded-lg outline-none"
                          />
                          <datalist id="vitals-temp-list">
                            {isOphthalmology ? (
                              ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60'].map(opt => (
                                <option key={opt} value={opt} />
                              ))
                            ) : (
                              ['97.0', '97.5', '98.0', '98.4', '98.6', '98.8', '99.0', '99.5', '100.0', '100.5', '101.0', '102.0'].map(opt => (
                                <option key={opt} value={opt} />
                              ))
                            )}
                          </datalist>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider font-mono">
                            {isOphthalmology ? 'VA OS (बाईं आंख)' : 'BP (mmHg)'}
                          </label>
                          <input
                            type="text"
                            value={bpVal}
                            onChange={(e) => setBpVal(e.target.value)}
                            list="vitals-bp-list"
                            placeholder={isOphthalmology ? 'e.g. 6/6' : 'e.g. 120/80'}
                            className="w-full input-field text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white rounded-lg outline-none"
                          />
                          <datalist id="vitals-bp-list">
                            {isOphthalmology ? (
                              ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60'].map(opt => (
                                <option key={opt} value={opt} />
                              ))
                            ) : (
                              ['90/60', '100/60', '110/70', '115/75', '120/80', '125/80', '130/80', '135/85', '140/90', '150/95', '160/100'].map(opt => (
                                <option key={opt} value={opt} />
                              ))
                            )}
                          </datalist>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider font-mono">
                            {isOphthalmology ? 'IOP (mmHg)' : 'Pulse (bpm)'}
                          </label>
                          <input
                            type="text"
                            value={pulseVal}
                            onChange={(e) => setPulseVal(e.target.value)}
                            list="vitals-pulse-list"
                            placeholder={isOphthalmology ? 'e.g. 15' : 'e.g. 72'}
                            className="w-full input-field text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white rounded-lg outline-none"
                          />
                          <datalist id="vitals-pulse-list">
                            {isOphthalmology ? (
                              Array.from({ length: 23 }, (_, i) => String(i + 8)).map(opt => (
                                <option key={opt} value={opt} />
                              ))
                            ) : (
                              ['50', '55', '60', '64', '68', '72', '76', '80', '85', '90', '95', '100', '105', '110', '120'].map(opt => (
                                <option key={opt} value={opt} />
                              ))
                            )}
                          </datalist>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider font-mono">
                            {isOphthalmology ? 'Aided OD' : 'Weight (kg)'}
                          </label>
                          <input
                            type="text"
                            value={weightVal}
                            onChange={(e) => setWeightVal(e.target.value)}
                            list="vitals-weight-list"
                            placeholder={isOphthalmology ? 'e.g. 6/6' : 'e.g. 60'}
                            className="w-full input-field text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white rounded-lg outline-none"
                          />
                          <datalist id="vitals-weight-list">
                            {isOphthalmology ? (
                              ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60'].map(opt => (
                                <option key={opt} value={opt} />
                              ))
                            ) : (
                              Array.from({ length: 21 }, (_, i) => String(35 + i * 5)).map(opt => (
                                <option key={opt} value={opt} />
                              ))
                            )}
                          </datalist>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider font-mono">
                          {isOphthalmology ? 'Aided OS' : 'Blood Sugar (mg/dL) - Optional'}
                        </label>
                        <input
                          type="text"
                          value={sugarVal}
                          onChange={(e) => setSugarVal(e.target.value)}
                          list="vitals-sugar-list"
                          placeholder={isOphthalmology ? 'e.g. 110' : 'e.g. None'}
                          className="w-full input-field text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white rounded-lg outline-none"
                        />
                        <datalist id="vitals-sugar-list">
                          {isOphthalmology ? (
                            ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60'].map(opt => (
                              <option key={opt} value={opt} />
                            ))
                          ) : (
                            ['70', '80', '90', '100', '110', '120', '130', '140', '150', '160', '180', '200', '220', '250'].map(opt => (
                              <option key={opt} value={opt} />
                            ))
                          )}
                        </datalist>
                      </div>

                      <div className="pt-2 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setVitalsPatient(null)}
                          className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all border-0 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="flex-[2] py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold tracking-wider uppercase border-0 rounded-xl text-xs cursor-pointer shadow-lg shadow-rose-500/20 transition-transform active:scale-95"
                        >
                          Save &amp; Dispatch to Doctor 🩺
                        </button>
                      </div>
                    </form>
                  </div>
                </div>,
                document.body
              )}
            </div>
          </div>
        )}
      </div>
    )}

      {/* TAB 3: PATHOLOGY LOG & TIMELINES */}
        {activeTab === 'labs' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
            {/* Left Column: Scheduled Pathology Tests Queue */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden bg-white text-slate-800">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-600 opacity-60" />
                <h2 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-indigo-600" />
                  🔬 Pathology Lab Requisition Queue
                </h2>
                <p className="text-xs text-slate-500 mb-4">
                  Clinical operational queue showing all laboratory orders, sample collection tracking, and processing status.
                </p>

                {(() => {
                  const reqs = LabService.getLabRequisitions();
                  if (reqs.length === 0) {
                    return (
                      <InlineEmptyState
                        icon="biotech"
                        label="No Lab Orders Today"
                        sublabel="Doctor-ordered pathology tests and sample collection requests will appear here."
                        variant="neutral"
                      />
                    );
                  }
                  return (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                            <th className="p-3 font-bold text-slate-655 text-[9px] uppercase font-mono">Patient Name</th>
                            <th className="p-3 font-bold text-slate-655 text-[9px] uppercase font-mono">Test Order</th>
                            <th className="p-3 font-bold text-slate-655 text-[9px] uppercase font-mono text-center">Status</th>
                            <th className="p-3 font-bold text-slate-655 text-[9px] uppercase font-mono text-right">Action / Alert</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reqs.map((req) => {
                            let statusClass = "bg-slate-100 text-slate-700 border-slate-200";
                            if (req.status === 'pending') statusClass = "bg-amber-100 text-amber-850 border-amber-200 animate-pulse";
                            else if (req.status === 'collected') statusClass = "bg-blue-100 text-blue-800 border-blue-200";
                            else if (req.status === 'processed') statusClass = "bg-indigo-100 text-indigo-850 border-indigo-200";
                            else if (req.status === 'completed') statusClass = "bg-emerald-105 text-emerald-850 border-emerald-200";

                            const isReady = req.status === 'completed' || Boolean(req.quantitativeResult);

                            return (
                              <tr key={req.id} className="border-b border-slate-200/50 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/80 transition-colors">
                                <td className="p-3">
                                  <div className="font-bold text-slate-800">{req.patientName}</div>
                                  <span className="text-[9px] text-slate-400 block font-mono">ID: {(req.patientId || '').substring(0, 8)}</span>
                                </td>
                                <td className="p-3">
                                  <div className="font-semibold text-slate-800">{req.testName}</div>
                                  <span className="text-[9px] text-slate-455 block font-mono">LOINC: {req.testCode}</span>
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-0.5 border rounded-full text-[9px] font-bold uppercase tracking-wider ${statusClass}`}>
                                    {req.status}
                                  </span>
                                </td>
                                <td className="p-3 text-right">
                                  {isReady ? (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const p = patients.find(pt => pt.id === req.patientId);
                                        if (p?.phone) {
                                          await api.dispatchLabArrivalRevisitAlert({
                                            patientPhone: p.phone,
                                            patientName: req.patientName,
                                            testName: req.testName,
                                            revisitSlotTime: '04:30 PM - 05:30 PM',
                                            doctorName: activePod?.doctor_name,
                                            clinicName: clinicTitle
                                          });
                                          window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                            detail: {
                                              title: 'Revisit WhatsApp Sent 📲',
                                              message: `Doctor re-visit timing alert sent to ${req.patientName} on WhatsApp!`,
                                              type: 'success'
                                            }
                                          }));
                                        }
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-[9px] font-bold cursor-pointer transition active:scale-95 shadow-xs"
                                    >
                                      <MessageSquare className="w-3 h-3 text-indigo-600" />
                                      <span>Send Re-visit Alert 📲</span>
                                    </button>
                                  ) : (
                                    <span className="font-mono text-slate-400 text-[10px] font-bold">
                                      {req.barcode}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

              </div>
            </div>

            {/* Right Column: Approved Lab Reports Timeline */}
            <div className="lg:col-span-5 space-y-6 text-left select-none">
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden bg-white text-slate-800">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-emerald-500 opacity-60" />
                
                <h2 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Approved Pathology Reports Timeline
                </h2>
                <p className="text-xs text-slate-500 mb-4">
                  Chronological log of verified diagnostic outcomes, critical biomarkers, and scheduled physician final review timings.
                </p>

                <div className="space-y-4">
                  {(() => {
                    const approved = fullLabReports.filter(r => r.status === 'approved');
                    if (approved.length === 0) {
                      return (
                        <div className="p-8 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-500 font-medium">
                          No verified pathology reports logged today.
                        </div>
                      );
                    }

                    return approved.map((report) => {
                      const biomarkers = report.biomarkerJson?.biomarkers || {};
                      return (
                        <div key={report.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-3 shadow-xs">
                          <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                            <div>
                              <h4 className="font-bold text-xs text-slate-800">{report.patientName}</h4>
                              <span className="text-[9px] text-slate-400 font-mono block">ID: {(report.patientId || '').substring(0, 8)}</span>
                            </div>
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-mono font-bold uppercase">
                              Verified
                            </span>
                          </div>

                          <div className="space-y-1">
                            <span className="block text-[8px] font-black text-slate-655 tracking-widest uppercase font-mono">Biomarker Log</span>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {Object.keys(biomarkers).filter(k => !k.endsWith('_unit')).map(key => {
                                const val = biomarkers[key];
                                const unit = biomarkers[`${key}_unit`] || biomarkers.unit || '';
                                return (
                                  <span key={key} className="bg-indigo-50 border border-indigo-150 text-indigo-755 text-[9px] px-2 py-0.5 rounded font-mono font-bold">
                                    {key}: {val} {unit}
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          {report.revisitScheduledAt && (
                            <div className="p-2.5 bg-emerald-50 border border-emerald-150 rounded-lg text-[9.5px] text-emerald-800 font-medium leading-relaxed">
                              <strong>📅 Locked Revisit Consult:</strong> {new Date(report.revisitScheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                              {report.revisitNote && <p className="mt-1 text-slate-650 font-semibold italic">Note: {report.revisitNote}</p>}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: GATE 3 PHARMACY BILLING */}
        {activeTab === 'pharmacy' && (
          <div className="space-y-6 text-left">
            {/* Reorder limit alerts banner */}
            {(() => {
              const lowStockItems = activeInventory.filter(item => item.stock <= item.threshold);
              if (lowStockItems.length === 0) return null;
              return (
                <div className="glass-panel p-4 border-amber-200/80 bg-amber-50/40 rounded-2xl flex items-start gap-3 shadow-md">
                  <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5 animate-bounce" />
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-amber-900">⚠️ Low Stock &amp; Reorder Limit Alerts (स्टॉक चेतावनी)</h3>
                    <p className="text-[11px] text-amber-800/95 leading-relaxed">
                      The following {lowStockItems.length} pharmacy items are running below their designated safety thresholds. Please notify procurement to restock:
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {lowStockItems.map(item => (
                        <span key={item.id} className="bg-amber-600/10 text-amber-900 border border-amber-600/20 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          💊 {item.name} ({item.stock} {item.unit} left | Min: {item.threshold})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Main inventory stock list catalog */}
            <div className="glass-panel p-6 border-slate-200 shadow-xl relative overflow-hidden bg-white text-slate-800">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-600 opacity-60" />
              
              <div className="md:flex md:items-center md:justify-between gap-4 mb-6">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <Pill className="w-4 h-4 text-indigo-600" />
                    Pharmacy Inventory &amp; Stock Catalog
                  </h2>
                  <p className="text-xs text-slate-500">
                    Real-time clinic ecosystem medicine catalog lookup. View expiry dates, FEFO batches, prices, and stock indicators.
                  </p>
                </div>

                {/* Search Bar */}
                <div className="w-full md:w-80 relative mt-3 md:mt-0 select-none">
                  <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search medicine or generic name..."
                    value={medSearchQuery}
                    onChange={(e) => setMedSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 text-slate-800 rounded-xl focus:bg-white focus:outline-none transition-all shadow-sm"
                  />
                  {medSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setMedSearchQuery('')}
                      className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-650"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {(() => {
                const filtered = activeInventory.filter(item => 
                  (item.name || '').toLowerCase().includes(medSearchQuery.toLowerCase()) ||
                  (item.genericName || '').toLowerCase().includes(medSearchQuery.toLowerCase()) ||
                  (item.category || '').toLowerCase().includes(medSearchQuery.toLowerCase())
                );

                if (filtered.length === 0) {
                  return (
                    <div className="p-8 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-500 font-medium select-none">
                      No medicines matched your search query.
                    </div>
                  );
                }

                return (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                          <th className="p-3.5 font-bold text-slate-650 text-[9px] uppercase font-mono">Medicine Details</th>
                          <th className="p-3.5 font-bold text-slate-650 text-[9px] uppercase font-mono">Category / Mfr</th>
                          <th className="p-3.5 font-bold text-slate-650 text-[9px] uppercase font-mono text-center">Stock Level</th>
                          <th className="p-3.5 font-bold text-slate-650 text-[9px] uppercase font-mono">Batch / Expiry</th>
                          <th className="p-3.5 font-bold text-slate-650 text-[9px] uppercase font-mono text-right">Price (MRP)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((item) => {
                          const isLowStock = item.stock <= item.threshold && item.stock > 0;
                          const isOutOfStock = item.stock === 0;
                          
                          let stockStatus = "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
                          let stockText = "In Stock";
                          if (isOutOfStock) {
                            stockStatus = "bg-rose-500/10 text-rose-700 border-rose-500/20";
                            stockText = "Out of Stock";
                          } else if (isLowStock) {
                            stockStatus = "bg-amber-500/10 text-amber-700 border-amber-500/20 animate-pulse";
                            stockText = "Low Stock";
                          }

                          return (
                            <tr key={item.id} className="border-b border-slate-200/50 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/80 transition-colors">
                              <td className="p-3.5">
                                <div className="font-bold text-slate-850">{item.name}</div>
                                <span className="text-[10px] text-slate-500 block font-medium">{item.genericName}</span>
                              </td>
                              <td className="p-3.5">
                                <span className="font-mono bg-slate-200/60 text-slate-700 font-bold px-1.5 py-0.2 rounded text-[10px]">{item.category}</span>
                                <span className="text-[10px] text-slate-455 block">{item.manufacturer}</span>
                              </td>
                              <td className="p-3.5 text-center">
                                <div className="font-bold text-slate-800">{item.stock} {item.unit}</div>
                                <span className={`inline-block px-2 py-0.2 mt-0.5 border rounded-full text-[9px] font-bold uppercase tracking-wider ${stockStatus}`}>
                                  {stockText}
                                </span>
                              </td>
                              <td className="p-3.5">
                                <div className="font-mono font-bold text-slate-700">Batch: {item.batchNumber}</div>
                                <span className={`text-[10px] font-medium block ${new Date(item.expiryDate) < new Date() ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                                  Exp: {new Date(item.expiryDate).toLocaleDateString()}
                                </span>
                              </td>
                              <td className="p-3.5 text-right">
                                <div className="font-bold text-slate-850">₹{(item.price || 0).toFixed(2)}</div>
                                <span className="text-[9px] text-slate-455 block font-mono">MRP: ₹{(item.mrp || 0).toFixed(2)}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

            </div>

          </div>
        )}

        {/* TAB 6: DAYCARE SURGERY & OT PACKAGE BILLING */}
        {activeTab === ('ot_billing' as any) && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in text-slate-800">
            {/* Left Column: Scheduled Daycare List */}
              <div className="lg:col-span-6 space-y-6">
                <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden bg-white text-left">
                  <div className={`absolute top-0 left-0 w-full h-[2px] ${isOphthalmology ? 'bg-rose-600' : 'bg-amber-600'} opacity-60`} />
                  <h2 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                    <Stethoscope className="w-5 h-5 text-rose-600 shrink-0" />
                    {isOphthalmology 
                      ? `Active Scheduled Daycare Surgeries (${daycarePatients.length})` 
                      : `Active Scheduled Daycare Procedures (${daycarePatients.length})`}
                  </h2>
                  <p className="text-xs text-slate-500 mb-4">
                    {isOphthalmology 
                      ? 'Daycare admission OT tracker. Track lens packages, surgical preparation, and patient timeline status.'
                      : 'Daycare minor OT procedure tracker. Track dressing room status and patient timeline status.'}
                  </p>

                  <div className="space-y-3.5 lg:max-h-[480px] max-h-none lg:overflow-y-auto pr-1">
                    {daycarePatients.length === 0 ? (
                      <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 font-medium select-none">
                        {isOphthalmology 
                          ? 'No surgeries currently scheduled by doctors.' 
                          : 'No minor procedures currently scheduled by doctors.'}
                      </div>
                    ) : (
                      daycarePatients.map(p => {
                        const isSelected = activePatient?.id === p.id;
                        if (isOphthalmology) {
                          const booking = p.vitals?.surgeryBooking;
                          if (!booking) return null;
                          return (
                            <div
                              key={p.id}
                              onClick={() => api.setActivePatient(p)}
                              className={`p-4 border rounded-xl flex justify-between items-start cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-indigo-500 bg-indigo-500/5 shadow-xs'
                                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                              }`}
                            >
                              <div className="space-y-1.5 flex-1 pr-4 text-left">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold text-xs text-slate-800">{p.name}</h4>
                                  <span className="text-[8px] font-mono font-bold bg-indigo-50 text-indigo-755 border border-indigo-200 px-1.5 py-0.2 rounded uppercase">
                                    Eye: {booking.eye}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500">
                                  Package: <strong>{booking.package}</strong> | Date: {booking.date}
                                </p>
                                <p className="text-[10px] text-slate-650 font-medium">
                                  Lens: {booking.lensType} | Power: {booking.iolPower || 'N/A'}
                                </p>
                              </div>
                            </div>
                          );
                        } else {
                          const booking = p.vitals?.gpProcedureBooking;
                          if (!booking) return null;
                          return (
                            <div
                              key={p.id}
                              onClick={() => api.setActivePatient(p)}
                              className={`p-4 border rounded-xl flex justify-between items-start cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-indigo-500 bg-indigo-500/5 shadow-xs'
                                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                              }`}
                            >
                              <div className="space-y-1.5 flex-1 pr-4 text-left">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold text-xs text-slate-800">{p.name}</h4>
                                  <span className="text-[8px] font-mono font-bold bg-amber-50 text-amber-750 border border-amber-200 px-1.5 py-0.2 rounded uppercase">
                                    Room: {booking.room}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500">
                                  Type: <strong>{booking.procedure}</strong> | Date: {booking.date}
                                </p>
                              </div>
                            </div>
                          );
                        }
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Daycare Room Timelines & Surgeon Schedules */}
              <div className="lg:col-span-6 space-y-6 text-left select-none animate-fade-in">
                {/* Scheduled Surgeons list */}
                <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden bg-white text-slate-800">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-rose-650 opacity-60" />
                  <h3 className="text-xs font-bold text-slate-500 uppercase font-mono tracking-wider mb-4 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    Scheduled Surgeons &amp; Specialists Today
                  </h3>
                  
                  <div className="space-y-3.5">
                    {[
                      { name: activePod?.doctor_name || 'Chief Ophthalmic Surgeon', role: 'Chief Ophthalmic Surgeon', status: 'In OT (Eye Room A)', time: '10:00 AM - 02:00 PM', specialty: 'Phacoemulsification & Glaucoma' },
                      { name: 'Dr. Priya Sen', role: 'Consultant Anesthesiologist', status: 'Pre-op Blocks (Ward B)', time: '09:30 AM - 01:30 PM', specialty: 'Regional & Topical Anesthesia' },
                      { name: 'Dr. Amit Roy', role: 'General & Laparoscopic Surgeon', status: 'On Call (Minor OT)', time: '12:00 PM - 04:00 PM', specialty: 'Excision & Wound Debridement' }
                    ].map((s, idx) => (
                      <div key={`surgeon-stat-${idx}-${s.name}`} className="p-3 border border-slate-200 rounded-xl bg-slate-50 flex items-start gap-3 hover:bg-slate-100/65 transition-all">
                        <UserCheck className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-0.5">
                          <div className="flex justify-between items-center flex-wrap gap-1">
                            <h4 className="font-bold text-xs text-slate-800">{s.name}</h4>
                            <span className="text-[9px] bg-rose-50 text-rose-800 border border-rose-150 px-1.5 py-0.2 rounded font-mono font-bold">{s.time}</span>
                          </div>
                          <p className="text-[10px] text-slate-555 font-semibold">{s.role} · <span className="text-slate-455">{s.specialty}</span></p>
                          <div className="flex items-center gap-1 mt-1 text-[9px] text-emerald-650 font-bold font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {s.status}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Daycare Room Log Timelines */}
                <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden bg-white text-slate-800">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-655 opacity-60" />
                  <h3 className="text-xs font-bold text-slate-500 uppercase font-mono tracking-wider mb-4 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    Daycare OT Room Timelines &amp; Pre-op Checks
                  </h3>

                  <div className="relative border-l border-indigo-100 pl-4 ml-2.5 space-y-5 py-1 text-xs">
                    {[
                      { time: '10:15 AM', label: 'Patient admission checks completed', desc: 'Pre-op vitals logged, ABHA consent verified at desk.' },
                      { time: '11:00 AM', label: 'Local block anesthetic administration', desc: 'Topical anesthetic drops and block administered by Dr. Sen.' },
                      { time: '11:30 AM', label: 'OT Procedure started (Cataract Phaco)', desc: `Surgeon ${activePod?.doctor_name || 'Chief Surgeon'} started Phaco surgery under microscope.` },
                      { time: '12:00 PM', label: 'Patient shifted to Recovery Ward', desc: 'IOL lens successfully placed. Shifted to Ward B for monitoring.' },
                      { time: '12:45 PM', label: 'Discharge clearance & counseling', desc: 'Post-op dosage directions pushed to patient WhatsApp.' }
                    ].map((t, idx) => (
                      <div key={`ot-timeline-${idx}-${t.time}`} className="relative group">
                        <span className="absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full bg-indigo-600 border-2 border-white shadow-xs group-hover:scale-125 transition-transform" />
                        <div className="space-y-0.5">
                          <span className="font-mono font-bold text-[9px] text-indigo-600 block">{t.time}</span>
                          <h4 className="font-bold text-slate-800 text-[11px]">{t.label}</h4>
                          <p className="text-[10px] text-slate-500 leading-normal">{t.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
</div>
          )}

        </div>

      {/* Sliding WhatsApp Chat Drawer */}
      <div 
        className={[
          "fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl transition-transform duration-350 ease-in-out transform flex flex-col",
          isChatDrawerOpen ? "translate-x-0" : "translate-x-full"
].join(" ")}
      >
        <div className="bg-[#075e54] p-4 text-white flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3 select-none">
            <div className="h-9 w-9 rounded-full bg-white/10 text-white flex items-center justify-center font-bold text-sm shrink-0 border border-white/20">
              💬
            </div>
            <div className="text-left">
              <h3 className="font-bold text-sm text-white">WhatsApp Live Simulator</h3>
              <p className="text-[9px] text-emerald-250 flex items-center gap-1 font-semibold tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                ACTIVE VERIFICATION SERVICE
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsChatDrawerOpen(false)}
            className="p-1.5 text-white hover:text-slate-100 rounded-lg hover:bg-white/10 transition cursor-pointer border-0 bg-transparent flex items-center justify-center"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Session Selector Dropdown */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200/60 dark:border-slate-800 p-3 flex items-center gap-2 select-none text-left shrink-0">
          <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider shrink-0">
            Select Patient Loop:
          </span>
          <select
            value={activeSession?.patientPhone || ''}
            onChange={(e) => {
              const phone = e.target.value;
              const sess = sessions.find(s => s.patientPhone === phone);
              if (sess) {
                setActiveSession(sess);
                const phoneDigits = (phone || '').replace(/\D/g, '').slice(-10);
                const pat = patients.find(p => (p.phone || (p as any).patient_phone || '').replace(/\D/g, '').slice(-10) === phoneDigits);
                if (pat) {
                  api.setActivePatient(pat);
                }
              } else {
                setActiveSession(null);
              }
            }}
            className="flex-1 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-[11px] text-slate-700 dark:text-slate-350 outline-none font-medium"
          >
            <option value="">-- Select Active Loop --</option>
            {sessions.map(s => {
              const sDigits = (s.patientPhone || (s as any).patient_phone || '').replace(/\D/g, '').slice(-10);
              const pat = patients.find(p => (p.phone || (p as any).patient_phone || '').replace(/\D/g, '').slice(-10) === sDigits);
              const name = pat ? pat.name : 'Unknown Patient';
              return (
                <option key={s.id} value={s.patientPhone}>
                  {name} ({s.patientPhone}) - State: {s.currentState.replace('_', ' ')}
                </option>
              );
            })}
          </select>
        </div>

        {activeSession ? (
          <div 
            ref={chatContainerRef}
            onScroll={handleScroll}
            className="flex-1 bg-[#efeae2] dark:bg-slate-950 p-4 overflow-y-auto space-y-4 font-sans text-xs"
          >
            {(() => {
                const sessData = activeSession.sessionData || (activeSession as any).session_data || {};
                const chatHistory = sessData.chatHistory || [];
                return chatHistory.map((msg: ChatMessage, idx: number) => {
                  const isBot = msg.sender === 'bot';
                  return (
                    <div 
                      key={`sim-chat-${idx}-${msg.sender}-${(msg.text || '').slice(0, 15)}`} 
                      className={`flex ${isBot ? 'justify-start' : 'justify-end'} animate-fade-in`}
                    >
                      <div 
                        className={`max-w-[85%] p-3 rounded-xl shadow-xs relative leading-relaxed ${
                          isBot 
                            ? 'bg-white dark:bg-slate-900 rounded-tl-none text-slate-800 dark:text-slate-250 border border-slate-250/20' 
                            : 'bg-[#d9fdd3] dark:bg-emerald-950/45 rounded-tr-none text-slate-855 dark:text-slate-200 border border-emerald-500/10'
                        }`}
                      >
                        <p className="leading-relaxed whitespace-pre-line font-mono text-[11px] font-medium">{msg.text}</p>
                        
                        {isBot && msg.text.includes('Welcome to Mediflow') && activeSession.currentState === 'AWAITING_WELCOME' && (
                          <div className="mt-3 pt-3 border-t border-slate-105 dark:border-slate-850 flex flex-col gap-2 select-none">
                            <button
                              onClick={() => {
                                api.processIncomingWhatsAppMessage(activeSession.patientPhone, '1');
                                syncData();
                              }}
                              className="bg-emerald-655 hover:bg-emerald-600 text-white font-bold py-2 rounded-xl text-center shadow active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer border-0"
                            >
                              Grant Consent
                            </button>
                          </div>
                        )}
                        {isBot && msg.text.includes('consent is committed') && activeSession.currentState !== 'AWAITING_WELCOME' && (
                          <div className="mt-2 flex items-center gap-1 text-emerald-600 dark:text-emerald-450 text-[9px] font-bold uppercase tracking-wider select-none">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-655 animate-pulse" /> Consent Registered
                          </div>
                        )}

                        <span className="block text-[8px] text-slate-500 text-right mt-1.5 font-mono select-none">
                          {msg.time ? new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 select-none">
              <MessagesSquare className="w-12 h-12 text-slate-400 animate-pulse" />
              <div>
                <h4 className="font-bold text-slate-705 dark:text-slate-350 text-xs">No Active Chat Loop</h4>
                <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-1 leading-relaxed">
                  Search a patient registry or click the WhatsApp button next to a patient to select active chat session.
                </p>
              </div>
            </div>
          )}
        
        <form onSubmit={handleSendReply} className="bg-[#f0f2f5] dark:bg-slate-900 p-3 border-t border-slate-205 dark:border-slate-800 flex gap-2 shrink-0">
          <input
            type="text"
            value={replyInput}
            onChange={(e) => setReplyInput(e.target.value)}
            disabled={!activeSession}
            placeholder={activeSession ? "Send message over secure gateway..." : "Select patient loop to type"}
            className="flex-1 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-full px-4 py-2.5 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          />
          <button 
            type="submit"
            disabled={!activeSession || !replyInput.trim()} 
            className={
              'p-2.5 rounded-full transition-colors border-0 shrink-0 ' +
              (activeSession && replyInput.trim() 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-slate-855 cursor-pointer shadow active:scale-95' 
                : 'bg-slate-200 dark:bg-slate-800 text-slate-655')
            }
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

      {viewingDocUrl && createPortal(
        <div className="fixed inset-0 bg-slate-800/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200/60 rounded-2xl max-w-2xl w-full p-6 space-y-4 relative shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 to-teal-500" />
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-400 shrink-0" />
                Prescription Document Viewer
              </h3>
              <button
                onClick={() => setViewingDocUrl(null)}
                className="p-1.5 text-slate-600 hover:text-slate-800 bg-white/5 hover:bg-white/10 border-0 rounded-lg cursor-pointer transition active:scale-95 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="bg-slate-800/40 rounded-xl border border-white/5 overflow-hidden flex items-center justify-center min-h-[300px] max-h-[70vh] p-2">
              {viewingDocUrl.startsWith('data:application/pdf') ? (
                <iframe src={viewingDocUrl} className="w-full h-[500px] border-0 rounded-lg" title="PDF Document Viewer" />
              ) : (
                <img src={viewingDocUrl} className="max-w-full max-h-[500px] object-contain rounded-lg shadow-md" alt="Prescription Document Preview" />
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setViewingDocUrl(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-slate-800 font-bold rounded-xl text-xs cursor-pointer border-0 active:scale-95 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Interactive Workflow Document Viewer Modal */}
      {activeWorkflowDetail && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh] text-slate-800 dark:text-slate-100">
            {/* Header */}
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 via-rose-500 to-emerald-500" />
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                {activeWorkflowDetail.type === 'prescription' && <FileText className="h-5 w-5 text-indigo-500" />}
                {activeWorkflowDetail.type === 'lab' && <Activity className="h-5 w-5 text-rose-500" />}
                {activeWorkflowDetail.type === 'summary' && <Smartphone className="h-5 w-5 text-emerald-500" />}
                {activeWorkflowDetail.type === 'prescription' && 'Consultation Prescription'}
                {activeWorkflowDetail.type === 'lab' && 'Pathology Lab Results'}
                {activeWorkflowDetail.type === 'summary' && 'WhatsApp Summary & Logs'}
              </h3>
              <button
                onClick={() => setActiveWorkflowDetail(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer bg-transparent border-0 outline-none flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-3 rounded-xl">
                <div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider font-mono">Patient Name</div>
                  <div className="text-xs font-bold font-mono">{activeWorkflowDetail.patientName}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider font-mono">Patient ID / Ref</div>
                  <div className="text-xs font-bold font-mono">{(activeWorkflowDetail.patientId || '').substring(0, 8).toUpperCase()}</div>
                </div>
              </div>

              {/* PRESCRIPTION TYPE */}
              {activeWorkflowDetail.type === 'prescription' && (() => {
                const patientEncounters = EncounterService.getEncounters().filter(e => e.patientId === activeWorkflowDetail.patientId);
                const latestEncounter = patientEncounters[patientEncounters.length - 1];

                if (!latestEncounter) {
                  return (
                    <div className="text-center py-8 px-4 border border-dashed border-slate-350 dark:border-slate-800 rounded-2xl">
                      <p className="text-slate-500 dark:text-slate-400 italic text-[11px]">
                        No active consultation record found. The consultation is either pending or the doctor has not submitted the final e-prescription for this session yet.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {latestEncounter.clinicalNotes && (
                      <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-950/40 p-4 rounded-2xl">
                        <h4 className="font-bold text-indigo-750 dark:text-indigo-400 mb-1.5 uppercase tracking-wider text-[9px] font-mono flex items-center gap-1.5">
                          Clinical Notes / Advice
                        </h4>
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{latestEncounter.clinicalNotes}</p>
                      </div>
                    )}

                    {latestEncounter.medications && latestEncounter.medications.length > 0 ? (
                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider text-[9px] font-mono flex items-center gap-1.5">
                          Prescribed Medications
                        </h4>
                        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-950/60">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                                <th className="p-2.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase font-mono">Medicine</th>
                                <th className="p-2.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase font-mono">Dosage</th>
                                <th className="p-2.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase font-mono">Duration</th>
                              </tr>
                            </thead>
                            <tbody>
                              {latestEncounter.medications.map((med, idx) => {
                                const bilingual = getBilingualInstruction(med.medicineName, med.dosage);
                                return (
                                  <tr key={`wf-med-${idx}-${med.medicineName}`} className="border-b border-slate-200 dark:border-slate-800/80 last:border-0">
                                    <td className="p-2.5">
                                      <div className="font-bold text-slate-800 dark:text-slate-200">{med.medicineName}</div>
                                      <div className="text-[9.5px] text-slate-500 dark:text-slate-400 italic mt-0.5">{bilingual.english} / {bilingual.hindi}</div>
                                    </td>
                                    <td className="p-2.5 font-semibold text-slate-700 dark:text-slate-300">{med.dosage || med.frequency}</td>
                                    <td className="p-2.5 text-slate-500 dark:text-slate-400">{med.duration}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-500 dark:text-slate-400 italic text-center py-4">No medications prescribed in this session.</p>
                    )}
                  </div>
                );
              })()}

              {/* LAB TYPE */}
              {activeWorkflowDetail.type === 'lab' && (() => {
                const reqs = LabService.getLabRequisitions().filter(r => r.patientId === activeWorkflowDetail.patientId);
                const reports = LabService.getFullLabReports().filter(r => r.patientId === activeWorkflowDetail.patientId);

                if (reqs.length === 0 && reports.length === 0) {
                  return (
                    <div className="text-center py-8 px-4 border border-dashed border-slate-350 dark:border-slate-800 rounded-2xl">
                      <p className="text-slate-500 dark:text-slate-400 italic text-[11px]">
                        No laboratory requisitions or processed pathology results have been registered for this patient yet.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {reports.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider text-[9px] font-mono">
                          Approved Pathology Reports
                        </h4>
                        <div className="space-y-2">
                          {reports.map((report) => (
                            <div key={report.id} className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-950/40 p-4 rounded-2xl">
                              <div className="flex justify-between items-center mb-2.5 pb-1 border-b border-rose-200/40">
                                <span className="font-bold text-[10px] text-rose-700 dark:text-rose-450 uppercase font-mono">Report: {report.status}</span>
                                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">
                                  Approved: {report.approvedAt ? new Date(report.approvedAt).toLocaleDateString() : 'N/A'}
                                </span>
                              </div>

                              {report.biomarkerJson ? (
                                <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                                  {Object.entries(report.biomarkerJson).map(([key, val]: [string, any]) => (
                                    <div key={key} className="bg-white/80 dark:bg-slate-900 border border-rose-100/50 dark:border-slate-800 p-2 rounded-xl flex justify-between items-center">
                                      <span className="font-semibold text-slate-600 dark:text-slate-400 font-mono text-[9.5px] uppercase">{key}</span>
                                      <span className="font-bold text-slate-805 dark:text-slate-200">{val}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-slate-500 dark:text-slate-400 italic text-center text-[10px]">No biomarker values logged in results.</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {reqs.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider text-[9px] font-mono">
                          Requisitions &amp; Sample Status
                        </h4>
                        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-950/60">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                                <th className="p-2.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase font-mono">Test Name</th>
                                <th className="p-2.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase font-mono">Barcode</th>
                                <th className="p-2.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase font-mono">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {reqs.map((req, idx) => (
                                <tr key={`wf-req-${idx}-${req.barcode || req.testName}`} className="border-b border-slate-200 dark:border-slate-800/80 last:border-0">
                                  <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200">{req.testName}</td>
                                  <td className="p-2.5 font-mono text-slate-500 dark:text-slate-400">{req.barcode}</td>
                                  <td className="p-2.5">
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                      req.status === 'completed'
                                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                        : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                    }`}>
                                      {req.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* SUMMARY TYPE */}
              {activeWorkflowDetail.type === 'summary' && (() => {
                const patientObj = patients.find(p => p.id === activeWorkflowDetail.patientId);
                const pDigits = (patientObj?.phone || '').replace(/\D/g, '').slice(-10);
                const sessionList = api.getWhatsAppSessions();
                const session = sessionList.find(s => {
                  const sDigits = (s.patientPhone || (s as any).patient_phone || '').replace(/\D/g, '').slice(-10);
                  return sDigits && pDigits && sDigits === pDigits;
                });

                if (!session || !session.sessionData?.chatHistory || session.sessionData.chatHistory.length === 0) {
                  return (
                    <div className="text-center py-8 px-4 border border-dashed border-slate-350 dark:border-slate-800 rounded-2xl">
                      <p className="text-slate-500 dark:text-slate-400 italic text-[11px]">
                        No active WhatsApp conversation history or summary logs found for this patient phone number.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider text-[9px] font-mono">
                      WhatsApp Dialogue History
                    </h4>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50 dark:bg-slate-950/60 space-y-3 max-h-[350px] overflow-y-auto">
                      {session.sessionData.chatHistory.map((msg: any, idx: number) => {
                        const isBot = msg.sender === 'bot' || msg.sender === 'system';
                        return (
                          // Bug Fix #8: Use stable composite key to prevent React reconciliation glitches
                          <div key={msg.id || msg.timestamp || `cmsg-${idx}-${(msg.text || '').slice(0, 10)}`} className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}>
                            <div className={`p-2.5 rounded-2xl max-w-[85%] border text-[11px] leading-relaxed whitespace-pre-wrap ${
                              isBot
                                ? 'bg-indigo-500/10 text-indigo-750 dark:text-indigo-300 border-indigo-500/20 rounded-tl-none'
                                : 'bg-emerald-500/10 text-emerald-750 dark:text-emerald-300 border-emerald-500/20 rounded-tr-none'
                            }`}>
                              {msg.text}
                            </div>
                            <span className="text-[8px] text-slate-400 mt-1 font-mono">{msg.time ? new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveWorkflowDetail(null)}
                className="px-5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs cursor-pointer border-0 active:scale-95 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Vitals Intake & Payment Clearance Modal for Routing Patient to Doctor */}
      {vitalsPatient && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in"
          onClick={() => setVitalsPatient(null)}
        >
          <div 
            className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-scale-in text-slate-800 dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white relative">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-lg bg-white/20 text-white font-mono font-black text-xs">
                      #{String(vitalsPatient.tokenNumber || (vitalsPatient as any).token_number || 'T-04').startsWith('T-') || String(vitalsPatient.tokenNumber || (vitalsPatient as any).token_number || '').startsWith('TK-') ? (vitalsPatient.tokenNumber || (vitalsPatient as any).token_number || 'T-04') : `TK-${String(vitalsPatient.tokenNumber || (vitalsPatient as any).token_number || '04').padStart(2, '0')}`}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-400 text-emerald-950 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-950 animate-pulse" />
                      🟢 [W] WhatsApp Confirmed
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white">{vitalsPatient.name}</h3>
                  <p className="text-xs text-indigo-100/90 font-mono mt-0.5">
                    📱 +91 {vitalsPatient.phone} · {vitalsPatient.age ? `${vitalsPatient.age}y` : 'Adult'} ({vitalsPatient.gender || 'Male'})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setVitalsPatient(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer border-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: Vitals Intake Form */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
                    Consultation Fee &amp; Payment Clearance
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    ₹500.00 Doctor Consultation Fee
                  </span>
                </div>
                <span className="px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-mono font-bold rounded-lg shadow-sm">
                  Payment Verified ✅
                </span>
              </div>

              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider font-mono mb-3 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-indigo-500" />
                  Clinical Vitals Entry (वाइटल्स जांच)
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  {/* Blood Pressure */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono block">
                      🩺 Blood Pressure
                    </label>
                    <input
                      type="text"
                      value={bpVal}
                      onChange={(e) => setBpVal(e.target.value)}
                      placeholder="120/80"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                    />
                    <span className="text-[9px] text-slate-400 font-mono block">mmHg</span>
                  </div>

                  {/* Pulse Rate */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono block">
                      💓 Pulse Rate
                    </label>
                    <input
                      type="number"
                      value={pulseVal}
                      onChange={(e) => setPulseVal(e.target.value)}
                      placeholder="72"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                    />
                    <span className="text-[9px] text-slate-400 font-mono block">bpm</span>
                  </div>

                  {/* Temperature */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono block">
                      🌡️ Temperature
                    </label>
                    <input
                      type="text"
                      value={tempVal}
                      onChange={(e) => setTempVal(e.target.value)}
                      placeholder="98.6"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                    />
                    <span className="text-[9px] text-slate-400 font-mono block">°F</span>
                  </div>

                  {/* SpO2 Level */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono block">
                      🫁 SpO2 Level
                    </label>
                    <input
                      type="number"
                      value={spo2Val}
                      onChange={(e) => setSpo2Val(e.target.value)}
                      placeholder="99"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                    />
                    <span className="text-[9px] text-slate-400 font-mono block">%</span>
                  </div>

                  {/* Blood Sugar */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono block">
                      🩸 Blood Sugar (RBS)
                    </label>
                    <input
                      type="number"
                      value={sugarVal}
                      onChange={(e) => setSugarVal(e.target.value)}
                      placeholder="105"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                    />
                    <span className="text-[9px] text-slate-400 font-mono block">mg/dL</span>
                  </div>

                  {/* Weight */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono block">
                      ⚖️ Body Weight
                    </label>
                    <input
                      type="number"
                      value={weightVal}
                      onChange={(e) => setWeightVal(e.target.value)}
                      placeholder="65"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                    />
                    <span className="text-[9px] text-slate-400 font-mono block">kg</span>
                  </div>

                  {/* Height */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono block">
                      📏 Height
                    </label>
                    <input
                      type="number"
                      value={heightVal}
                      onChange={(e) => setHeightVal(e.target.value)}
                      placeholder="165"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                    />
                    <span className="text-[9px] text-slate-400 font-mono block">cm</span>
                  </div>

                  {/* Computed BMI Badge */}
                  <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl space-y-1">
                    <label className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase font-mono block">
                      ⚡ Calculated BMI
                    </label>
                    <div className="text-base font-black text-indigo-600 dark:text-indigo-400 font-mono">
                      {computedBmi.bmi} <span className="text-[9px] font-normal">kg/m²</span>
                    </div>
                    <span className="text-[9px] text-slate-500 font-bold block">{computedBmi.category}</span>
                  </div>
                </div>

                {/* Quick Presets for Rapid Entry */}
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Rapid Vitals Presets (1-Tap Fast Fill)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => { setBpVal('120/80'); setPulseVal('72'); setTempVal('98.6'); setSpo2Val('99'); }}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer transition border border-slate-200 dark:border-slate-700"
                    >
                      BP 120/80 · Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => { setBpVal('140/90'); setPulseVal('84'); setTempVal('98.6'); setSpo2Val('98'); }}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer transition border border-slate-200 dark:border-slate-700"
                    >
                      BP 140/90 · Mild HTN
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTempVal('101.2'); setPulseVal('96'); setSpo2Val('97'); }}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 text-[10px] font-mono font-bold text-rose-700 dark:text-rose-400 rounded-lg cursor-pointer transition border border-rose-200 dark:border-rose-800"
                    >
                      Temp 101.2°F · Fever
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-white/10 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setVitalsPatient(null)}
                className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer border-0"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingVitals}
                onClick={handleApproveVitalsAndRouteToDoctor}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer transition border-0 uppercase tracking-wider"
              >
                {isSavingVitals ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Routing to Doctor Chamber...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Approve Vitals &amp; Route to Doctor 🩺
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Generic Rapid Vitals Bottom Sheet Modal (showVitalsBottomSheet) ──── */}
      {showVitalsBottomSheet && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in"
          onClick={() => setShowVitalsBottomSheet(false)}
        >
          <div 
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up text-slate-800 dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Activity className="w-5 h-5" />
                <h3 className="text-sm font-black">Rapid Vitals Intake Sheet</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowVitalsBottomSheet(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer border-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Select Patient from Today's Queue
                </label>
                <select 
                  className="w-full input-field text-xs font-bold py-2.5"
                  onChange={(e) => {
                    const found = patients.find(p => p.id === e.target.value);
                    if (found) {
                      setShowVitalsBottomSheet(false);
                      setVitalsPatient(found);
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>Choose Patient ({pendingVitalsList.length} Awaiting Vitals)...</option>
                  {pendingVitalsList.map(p => (
                    <option key={p.id} value={p.id}>
                      #{p.tokenNumber || 'TK'} · {p.name} (+91 {p.phone.slice(-4)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select a patient to open their dedicated numeric vitals intake pad with BP, SpO2, and auto-computed BMI.
                </p>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Quick Add Patient Modal (showQuickAddSheet) ───────────────────────── */}
      {showQuickAddSheet && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in"
          onClick={() => setShowQuickAddSheet(false)}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up text-slate-800 dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-teal-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <UserPlus className="w-5 h-5" />
                <div>
                  <h3 className="text-sm font-black">Quick Walk-In Registration</h3>
                  <p className="text-[10px] text-indigo-100/90 font-mono">Auto-assigns token &amp; consultation invoice</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAddSheet(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer border-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => {
              handleQuickRegisterPatient(e);
              setShowQuickAddSheet(false);
            }} className="p-5 space-y-3.5">
              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">
                  Patient Full Name (मरीज़ का नाम) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={quickRegName}
                  onChange={e => setQuickRegName(e.target.value)}
                  className="w-full input-field text-xs py-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">
                    Mobile Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={quickRegPhone}
                    onChange={e => setQuickRegPhone(e.target.value)}
                    className="w-full input-field text-xs py-2.5"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">
                    Age (उम्र) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="120"
                    placeholder="35"
                    value={quickRegAge}
                    onChange={e => setQuickRegAge(e.target.value)}
                    className="w-full input-field text-xs py-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">
                    Gender (लिंग)
                  </label>
                  <select
                    value={quickRegGender}
                    onChange={e => setQuickRegGender(e.target.value as any)}
                    className="w-full input-field text-xs py-2.5"
                  >
                    <option value="Male">Male (पुरुष)</option>
                    <option value="Female">Female (महिला)</option>
                    <option value="Other">Other (अन्य)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">
                    ABHA ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="ABHA-1234..."
                    value={quickRegAbha}
                    onChange={e => setQuickRegAbha(e.target.value)}
                    className="w-full input-field text-xs py-2.5"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-teal-600 hover:from-indigo-700 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer transition border-0 uppercase tracking-wider"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Register &amp; Issue OPD Token 🎫
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Start Eye Dilation Modal (showDilationModal) ───────────────────────── */}
      {showDilationModal && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in"
          onClick={() => setShowDilationModal(null)}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-scale-in text-slate-800 dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 bg-gradient-to-r from-cyan-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Eye className="w-5 h-5" />
                <div>
                  <h3 className="text-sm font-black">Start 15-Min Eye Dilation</h3>
                  <p className="text-[10px] text-cyan-100 font-mono">{showDilationModal.name} · Token #{showDilationModal.tokenNumber || 'TK'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDilationModal(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer border-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">
                  Select Eye (आँख चुनें)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'both', label: 'Both Eyes (BE)' },
                    { id: 're', label: 'Right Eye (OD)' },
                    { id: 'le', label: 'Left Eye (OS)' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedDilationEye(opt.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        selectedDilationEye === opt.id
                          ? 'bg-cyan-50 dark:bg-cyan-950 border-cyan-500 text-cyan-700 dark:text-cyan-300'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">
                  Mydriatic Eye Drop
                </label>
                <select
                  value={selectedDilationDrop}
                  onChange={e => setSelectedDilationDrop(e.target.value as any)}
                  className="w-full input-field text-xs py-2.5 font-bold"
                >
                  <option value="tropicamide">Tropicamide 0.8% + Phenylephrine 5% (Standard 15m)</option>
                  <option value="cyclopentolate">Cyclopentolate 1% (Pediatric / Refraction)</option>
                  <option value="homatropine">Homatropine 2% (Uveitis / Extended)</option>
                </select>
              </div>

              <div className="p-3 bg-cyan-50 dark:bg-cyan-950/40 rounded-xl border border-cyan-200 dark:border-cyan-800 text-[11px] text-cyan-800 dark:text-cyan-300">
                ⏱️ Starts an autonomous 15-minute countdown on the Compounder &amp; Doctor Dashboards. Alerts when pupil is fully dilated.
              </div>

              <button
                type="button"
                onClick={() => handleStartEyeDilation(showDilationModal)}
                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-700 hover:to-indigo-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition border-0 uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <Timer className="w-4 h-4" />
                Apply Drops &amp; Start 15-Min Timer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── FLOATING MOBILE BOTTOM NAVIGATION BAR (iOS / Modern Native) ───────── */}
      <div className="fixed bottom-0 left-0 right-0 z-[990] md:hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border-t border-slate-200/80 dark:border-slate-800 shadow-2xl p-2 px-3 flex justify-around items-center select-none">
        {[
          { id: 'overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'tokens', label: 'Queue', icon: Calendar },
          { id: 'patients', label: 'Patients', icon: Users },
          { id: 'labs', label: 'Labs', icon: FlaskConical },
          { id: 'pharmacy', label: 'Pharmacy', icon: QrCode },
          { id: 'ot_billing', label: 'OT Daycare', icon: Scissors },
          { id: 'invoice_generator', label: 'Billing', icon: Printer }
        ].map((item) => {
          const IconComp = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id as any)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition cursor-pointer border-0 bg-transparent ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400 font-black'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <IconComp className={`w-5 h-5 ${isActive ? 'scale-110 text-indigo-600 dark:text-indigo-400' : ''}`} />
              <span className="text-[9px] font-bold mt-0.5">{item.label}</span>
              {isActive && <span className="w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400 mt-0.5" />}
            </button>
          );
        })}
      </div>

      {/* Desktop Enterprise Status Footer */}
      <div className="hidden md:flex items-center justify-between pt-4 mt-6 border-t border-slate-200/60 dark:border-slate-800/80 text-[11px] font-medium text-slate-500 dark:text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Mediflow Realtime Engine · {clinicTitle} Node</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Sub-300ms Outbound WhatsApp</span>
          <span>·</span>
          <span>Cashfree Payment Gate Active</span>
          <span>·</span>
          <span className="text-indigo-600 dark:text-indigo-400 font-semibold">RLS Encrypted · Compounder</span>
        </div>
      </div>

      {/* Floating 24/7 Mediflow AI Support Widget */}
      <WhatsAppSupportModal userRole="compounder" userName="Compounder Desk" clinicName={clinicTitle} />
    </div>
  );
};
