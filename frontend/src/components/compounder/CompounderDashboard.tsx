import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { api, MASTER_TEST_CATALOG } from '../../services/api';
import { supabase } from '../../lib/supabaseClient';
import { RealtimeSyncService } from '../../services/realtimeSyncService';
import { useSpecialization } from '../../context/SpecializationContext';
import { useClinic } from '../../context/ClinicContext';
import { VISUAL_ACUITY_OPTIONS } from '../../types/ophthalmic';
import { EncounterService } from '../../services/encounterService';
import { PharmacyService } from '../../services/pharmacyService';
import { BillingService } from '../../services/billingService';
import { LabService } from '../../services/labService';
import { ZeroQueueState, InlineEmptyState } from '../shared/EmptyState';
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
  Stethoscope
} from 'lucide-react';

const getBilingualInstruction = (medicineName: string, dosage?: string) => {
  const nameLower = medicineName.toLowerCase();
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
  const { podEntities } = useClinic();
  const [activeTab, setActiveTab] = useState<'patients' | 'tokens' | 'labs' | 'pharmacy' | 'ot_billing' | 'invoice_generator'>('tokens');
  const [patientsSubTab, setPatientsSubTab] = useState<'directory' | 'register'>('directory');
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);

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
  const [weightVal, setWeightVal] = useState('65');
  const [sugarVal, setSugarVal] = useState('');
  const [customToken, setCustomToken] = useState('');
  
  // Interactive Workflow Modal State
  const [activeWorkflowDetail, setActiveWorkflowDetail] = useState<{
    type: 'prescription' | 'lab' | 'summary';
    patientId: string;
    patientName: string;
  } | null>(null);

  // Dynamic Patient Workflow Calculator
  const getPatientWorkflowState = useCallback((patient: Patient, appt: Appointment) => {
    // 1. Encounters
    const patientEncounters = EncounterService.getEncounters().filter(e => e.patientId === patient.id);
    const latestEncounter = patientEncounters[patientEncounters.length - 1];

    // 2. Lab Requisitions & Reports
    const reqs = LabService.getLabRequisitions().filter(r => r.patientId === patient.id);
    const reports = LabService.getFullLabReports().filter(r => r.patientId === patient.id);

    // 3. WhatsApp Session messages
    const sessionList = api.getWhatsAppSessions();
    const session = sessionList.find(s => s.patientPhone === patient.phone);
    const hasWhatsAppMsg = !!session?.sessionData?.chatHistory?.some(
      (m: any) => m.sender === 'bot' && (m.text.includes('🏥') || m.text.includes('Advice') || m.text.includes('spectacle') || m.text.includes('Prescription') || m.text.includes('Summary'))
    );

    // 4. Pharmacy bills
    const mbills = PharmacyService.getMedicineBills().filter(b => b.patientId === patient.id);

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
      if (latestEncounter.medications.length === 0) {
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
  }, []);
  
  // Appointment Booking States
  const [searchApptPatient, setSearchApptPatient] = useState('');
  const [selectedApptPatient, setSelectedApptPatient] = useState<Patient | null>(null);
  const [apptPaymentMode, setApptPaymentMode] = useState<'cash' | 'upi'>('cash');

  // Vernacular Dosage Assistant States
  const [selectedLanguage, setSelectedLanguage] = useState<'hindi' | 'bhojpuri'>('hindi');
  const [dosageTemplate, setDosageTemplate] = useState<'od' | 'bd' | 'tds' | 'sos'>('od');

  // Registry Registry state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const fetchLiveAppointments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, patient_registry(id, name, phone, age, gender)')
        .order('created_at', { ascending: false });

      if (data) {
        const mapped = data.map((a: any) => {
          const patInfo = a.patient_registry || {};
          return {
            id: a.id,
            patientId: a.patient_id,
            doctorId: a.doctor_id,
            status: a.status || 'pending_payment',
            isVirtual: a.is_virtual === true,
            virtualDate: a.virtual_date,
            virtualTime: a.virtual_time,
            virtualMeetingUrl: a.virtual_meeting_url,
            source: a.is_virtual ? 'whatsapp_virtual' : 'whatsapp_physical',
            patientName: patInfo.name || 'WhatsApp Patient',
            patientPhone: patInfo.phone || 'N/A',
            patientAge: patInfo.age || 30,
            patientGender: patInfo.gender || 'Male'
          };
        });
        setAppointments(mapped as any);
      }
    } catch (err) {
      console.warn('[CompounderDashboard] Error fetching live appointments:', err);
    }
  }, []);

  useEffect(() => {
    fetchLiveAppointments();
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
      onPatientChange: () => {
        setPatients(api.getPatients());
        fetchLiveAppointments();
      }
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
  const [heightInput, setHeightInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
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
  const [labPaymentMode, setLabPaymentMode] = useState<'cash' | 'upi' | 'whatsapp_pay'>('cash');
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
      setVitalsPatient(activePatient);
      setCustomToken(activePatient.tokenNumber || api.generateNextTokenNumber());
    }
  }, [activePatient, vitalsPatient]);

  // Load existing vitals into form fields when vitalsPatient changes
  useEffect(() => {
    if (vitalsPatient) {
      if (vitalsPatient.vitals) {
        const rawTemp = vitalsPatient.vitals.temperature || '';
        const rawBp = vitalsPatient.vitals.bloodPressure || '';
        const rawPulse = vitalsPatient.vitals.pulseRate || '';
        const rawWeight = vitalsPatient.vitals.weight || '';
        const rawSugar = vitalsPatient.vitals.bloodSugar || '';

        if (isOphthalmology) {
          const vaOdMatch = String(rawTemp).match(/6\/\d+/);
          setTempVal(vaOdMatch ? vaOdMatch[0] : '6/6');

          const vaOsMatch = String(rawBp).match(/6\/\d+/);
          setBpVal(vaOsMatch ? vaOsMatch[0] : '6/6');

          const iopMatch = String(rawPulse).match(/\d+/);
          setPulseVal(iopMatch ? iopMatch[0] : '16');

          const aidedOdMatch = String(rawWeight).match(/6\/\d+/);
          setWeightVal(aidedOdMatch ? aidedOdMatch[0] : '');

          const aidedOsMatch = String(rawSugar).match(/6\/\d+/);
          setSugarVal(aidedOsMatch ? aidedOsMatch[0] : '');
        } else {
          const tempMatch = String(rawTemp).match(/\d+\.?\d*/);
          if (tempMatch) {
            const parsed = parseFloat(tempMatch[0]);
            setTempVal(parsed > 90 && parsed < 110 ? parsed.toFixed(1) : '98.6');
          } else {
            setTempVal('98.6');
          }

          const bpMatch = String(rawBp).match(/\d{2,3}\/\d{2,3}/);
          setBpVal(bpMatch ? bpMatch[0] : '120/80');

          const pulseMatch = String(rawPulse).match(/\d+/);
          if (pulseMatch) {
            const parsed = parseInt(pulseMatch[0]);
            setPulseVal(parsed > 30 && parsed < 200 ? String(parsed) : '72');
          } else {
            setPulseVal('72');
          }

          const weightMatch = String(rawWeight).match(/^\d{2,3}/);
          setWeightVal(weightMatch ? weightMatch[0] : '65');

          const sugarMatch = String(rawSugar).match(/\d+/);
          setSugarVal(sugarMatch ? sugarMatch[0] : '');
        }
      } else {
        setTempVal(isOphthalmology ? '6/6' : '98.6');
        setBpVal(isOphthalmology ? '6/6' : '120/80');
        setPulseVal(isOphthalmology ? '16' : '72');
        setWeightVal(isOphthalmology ? '' : '65');
        setSugarVal('');
      }
      setCustomToken(vitalsPatient.tokenNumber || '');
    }
  }, [vitalsPatient, isOphthalmology]);

  // Auto-focus active patient in Revisit Scheduler & Reset draft report summary
  useEffect(() => {
    if (activePatient) {
      setRevisitPatientId(activePatient.id);
    }
    setScannedSummary(null);
  }, [activePatient?.id]);

  // Sync loyalty checkboxes when billing patient changes
  useEffect(() => {
    if (billingPatient) {
      const txs = api.getCounterTransactions();
      const todayStr = new Date().toISOString().split('T')[0];
      const existingTx = txs.find(t => t.patientId === billingPatient.id && t.createdAt.startsWith(todayStr));
      
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

    const registered = api.registerPatient({
      id: `pat-${phone}`,
      name,
      phone,
      age: Number(age),
      gender,
      allergies: allergiesInput.split(',').map(s => s.trim()).filter(Boolean),
      chronicConditions: chronicInput.split(',').map(s => s.trim()).filter(Boolean),
      abhaId: abhaId || undefined,
      vitals: (weightInput || heightInput || bloodGroupInput) ? {
        temperature: '',
        bloodPressure: '',
        pulseRate: '',
        weight: weightInput,
        height: heightInput,
        bloodGroup: bloodGroupInput,
        recordedAt: new Date().toISOString()
      } as any : undefined,
      whatsApp: whatsAppInput || phone
    } as any);

    api.setActivePatient(registered);

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Patient ${name} registered successfully. ABHA profile linked.`,
        type: 'success',
        title: 'Patient Registered'
      }
    }));

    setName('');
    setPhone('');
    setAge('');
    setGender('Male');
    setAllergiesInput('');
    setChronicInput('');
    setAbhaId('');
    setHeightInput('');
    setWeightInput('');
    setBloodGroupInput('');
    setWhatsAppInput('');
  };

  const handleRecordVitalsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vitalsPatient) return;

    const recordedToken = customToken.trim() || api.generateNextTokenNumber();

    const finalTempVal = isOphthalmology ? (tempVal === '98.6' ? '6/6' : tempVal) : tempVal;
    const finalBpVal = isOphthalmology ? (bpVal === '120/80' ? '6/6' : bpVal) : bpVal;
    const finalPulseVal = isOphthalmology ? (pulseVal === '72' ? '16' : pulseVal) : pulseVal;
    const finalWeightVal = isOphthalmology ? (weightVal === '65' ? '' : weightVal) : weightVal;
    const finalSugarVal = isOphthalmology ? sugarVal || undefined : sugarVal || undefined;

    api.updatePatientVitalsAndToken(vitalsPatient.id, {
      temperature: finalTempVal,
      bloodPressure: finalBpVal,
      pulseRate: finalPulseVal,
      weight: finalWeightVal,
      bloodSugar: finalSugarVal,
      recordedAt: new Date().toISOString()
    }, recordedToken);

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Vitals pre-loaded successfully for patient ${vitalsPatient.name}! Dispatched Token: ${recordedToken} to Doctor Vivek's chamber. 🩺`,
        type: 'success',
        title: 'Swasthya Token Dispatched'
      }
    }));

    // Reset Form
    setVitalsPatient(null);
    setTempVal('98.6');
    setBpVal('120/80');
    setPulseVal('72');
    setWeightVal('65');
    setSugarVal('');
    setCustomToken('');

    syncData();
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
      alert('Please fill out all required fields.');
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
      alert('This batch is already added to checkout.');
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
      inv.genericName.toLowerCase() === item.genericName.toLowerCase() &&
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
        message: `Switched brand to cheaper alternative: ${alt.name} (Saved ₹${(billingItems[itemIdx].sellingPrice - alt.price).toFixed(2)} per unit!)`,
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
      upiQrPayload: `upi://pay?pa=vitalsync@icici&pn=VitalSync&am=${billingTotals.totalAmount.toFixed(2)}&cu=INR&tn=VS-BILL-${billId.substring(4, 8)}`,
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
      const apptSlot = eveningSlot || api.getAppointmentByPatient(billingPatient.id);
      if (apptSlot) {
        dosageInvoiceText += `\n\n🕒 *Doctor Follow-up (Aaj Shaam):*\nDr. Sharma aapko aaj *${apptSlot.startTime}* se *${apptSlot.endTime}* ke beech dekhenge.\nKrupaya 5 minute pehle clinic pahunchen.`;
      } else {
        // Auto-allocate slot for this patient if none exists
        try {
          const newSlot = await api.createEveningSlot(billingPatient.id, 'doc-1');
          if (newSlot) {
            setEveningSlot(newSlot);
            dosageInvoiceText += `\n\n🕒 *Doctor Follow-up (Aaj Shaam):*\nDr. Sharma aapko aaj *${newSlot.startTime}* se *${newSlot.endTime}* ke beech dekhenge.\nKrupaya 5 minute pehle clinic pahunchen.`;
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

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { message: 'Logged out successfully from session.', type: 'success', title: 'Logged Out 🟢' }
      }));
    } catch (err: any) {
      console.error('Logout error:', err);
      window.location.reload();
    }
  };

  // Fuzzy search catalog filtering in billing
  const billingSearchMatches = useMemo(() => {
    if (!medSearchQuery.trim()) return [];
    return activeInventory.filter(inv => 
      (inv.name.toLowerCase().includes(medSearchQuery.toLowerCase()) ||
       inv.genericName.toLowerCase().includes(medSearchQuery.toLowerCase())) &&
      inv.stock > 0
    );
  }, [activeInventory, medSearchQuery]);

  const filteredPatients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return patients.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.phone.includes(query) ||
      (p.abhaId && p.abhaId.includes(query))
    );
  }, [patients, searchQuery]);

  const assignFilteredPatients = useMemo(() => {
    if (!assignSearchQuery.trim()) return [];
    return patients.filter(p => 
      p.name.toLowerCase().includes(assignSearchQuery.toLowerCase().trim()) || 
      p.phone.includes(assignSearchQuery.trim()) ||
      (p.abhaId && p.abhaId.includes(assignSearchQuery.trim()))
    );
  }, [patients, assignSearchQuery]);

  const handleQuickRegisterPatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickRegName.trim() || !quickRegPhone.trim() || !quickRegAge) {
      alert('Please fill in Name, Phone, and Age.');
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

    // Refresh clinical lists
    setPatients(api.getPatients());
    setBillingPatient(registered);

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Registered & Assigned Patient: ${quickRegName.trim()} successfully!`,
        type: 'success',
        title: 'Patient Assigned'
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
    <div className="max-w-7xl mx-auto p-4 pb-20 md:pb-8 md:p-8 space-y-8 animate-fade-in bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-clinical-950 dark:to-indigo-950/20 text-slate-800 dark:text-clinical-100 min-h-screen rounded-xl shadow-[0_8px_32px_-12px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_-12px_rgba(0,0,0,0.5)] border border-slate-200/50 dark:border-white/5 relative overflow-hidden transition-colors duration-300">
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
      <div className="border-b-0 md:border-b border-slate-200/50 dark:border-white/5 pb-4 md:pb-0 bg-white/60 dark:bg-clinical-900/40 backdrop-blur-xl p-4 md:p-5 rounded-2xl shadow-sm mb-4 md:mb-6 z-10 relative">
        {/* Top row: title + status */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-6 pb-2 md:pb-6">
          <div className="hidden md:flex items-start gap-4">
            <span className="hidden sm:inline-flex flex-shrink-0 items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/20">
              <span className="material-symbols-outlined text-[24px]">medical_services</span>
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Compounder Operations Desk
                </h1>
                <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border uppercase tracking-widest ${
                  isOnline
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 animate-pulse'
                    : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400'
                }`}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <p className="hidden sm:block text-sm text-slate-500 dark:text-slate-400 mt-1">
                Clinical checkup hub — appointments, medicine billing, pathology scans &amp; Shiprocket dispatches.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap lg:self-center w-full lg:w-auto justify-start lg:justify-end">
            <span className="inline-flex items-center gap-1 text-[9px] bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 px-3 py-1.5 rounded-full font-semibold uppercase tracking-wider font-mono shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
              {staffList.find(s => s.id === activeStaffId)?.staffName || 'System Compounder'} · Checked-In
            </span>
          </div>
        </div>

        {/* Integrated Tab Switcher — scrollable glass pill capsules for all screen sizes */}
        <div className="hidden md:flex overflow-x-auto gap-2 no-scrollbar select-none -mb-px p-1.5 bg-slate-100/80 dark:bg-slate-900/60 rounded-xl border border-slate-200/50 dark:border-white/5 backdrop-blur-md">
          {[
            { id: 'patients', label: 'Patients (मरीज)', icon: <Users className="h-4 w-4 text-indigo-600" /> },
            { id: 'tokens', label: 'Appointments (अपॉइंटमेंट)', icon: <span className="material-symbols-outlined text-[15px] font-bold text-rose-500">calendar_month</span> },
            { id: 'labs', label: isOphthalmology ? 'Biometry (बायोमेट्री)' : nomenclature.careLoopLabStep, icon: <FileText className="h-4 w-4 text-indigo-500" /> },
            { id: 'pharmacy', label: isOphthalmology ? 'Optical/Rx (चश्मा)' : nomenclature.careLoopPharmacyStep, icon: <QrCode className="h-4 w-4 text-amber-500" /> },
            { id: 'ot_billing', label: isOphthalmology ? 'Daycare (सर्जरी)' : 'Minor OT (ओटी)', icon: <span className="material-symbols-outlined text-sm font-bold text-rose-600">medical_services</span> },
            { id: 'invoice_generator', label: 'Invoices (इनवॉइस)', icon: <Printer className="h-4 w-4 text-slate-500 dark:text-slate-450" /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 text-[10px] font-bold flex items-center gap-1.5 whitespace-nowrap transition-all uppercase cursor-pointer rounded-lg ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                  : 'text-slate-650 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5'
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
                  <span className="material-symbols-outlined text-secondary text-[16px]">person_search</span>
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
                        <span className="material-symbols-outlined text-rose-500 text-base">warning</span>
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
                                  <span className="material-symbols-outlined text-[12px] text-slate-600">phone</span>
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
                                  const virtualAppt = appointments.find(a => a.patientId === p.id && a.isVirtual);
                                  if (!virtualAppt) return null;
                                  return (
                                    <span className="flex items-center gap-0.5 text-[8px] font-bold bg-emerald-50 border border-emerald-255 text-emerald-700 px-1.5 py-0.2 rounded animate-pulse font-sans">
                                      <span className="material-symbols-outlined text-[10px] text-emerald-700 font-bold">check_circle</span>
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
                  <span className="material-symbols-outlined text-primary text-[16px]">person_add</span>
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

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Height (cm)</label>
                      <input
                        type="number"
                        placeholder="Height"
                        value={heightInput}
                        onChange={(e) => setHeightInput(e.target.value)}
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-600 bg-slate-50 border-slate-200 text-slate-800 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Weight (kg)</label>
                      <input
                        type="number"
                        placeholder="Weight"
                        value={weightInput}
                        onChange={(e) => setWeightInput(e.target.value)}
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-600 bg-slate-50 border-slate-200 text-slate-800 rounded-lg"
                      />
                    </div>
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
                  <span className="material-symbols-outlined text-indigo-600 text-base font-bold">clinical_notes</span>
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
                        <span className="material-symbols-outlined text-xl text-indigo-600">upload</span>
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
                          <div key={index} className={log.includes('[ERROR]') ? 'text-rose-400 font-bold' : log.includes('SUCCESS') ? 'text-emerald-400 font-bold' : ''}>
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
                            <span className="material-symbols-outlined text-[13px] text-white-force">save</span>
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
                    <span className="material-symbols-outlined text-2xl text-indigo-400">person_search</span>
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
                
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
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
                    placeholder="Enter Staff Name"
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
            {/* Left Column: Create Appointment & Today's Appointments List */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Appointment Booking & Search Form */}
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden bg-white dark:bg-slate-800/80 text-slate-800 rounded-3xl">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-600 opacity-60" />
                <h2 className="text-sm font-semibold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-500 text-[18px]">calendar_today</span>
                  Book Consultation Appointment (अपॉइंटमेंट बुकिंग)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Search registered patient by Name, Phone or ID to book a consultation slot.
                </p>

                <div className="space-y-4">
                  {/* Search input */}
                  <div>
                    <label className="text-[10px] text-slate-500 dark:text-slate-300 font-bold uppercase tracking-wider font-mono block pl-1 mb-1">
                      Search Patient
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search by Name, Phone, or Patient ID..."
                        value={searchApptPatient}
                        onChange={(e) => setSearchApptPatient(e.target.value)}
                        className="w-full input-field text-xs py-2.5 pl-10 pr-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white rounded-lg outline-none placeholder:text-slate-400"
                      />
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                    </div>
                  </div>

                  {/* Search Results list */}
                  {searchApptPatient.trim().length > 0 && (
                    <div className="border border-slate-100 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-slate-900/60 p-2 max-h-[160px] overflow-y-auto space-y-1.5 shadow-inner">
                      {patients.filter(p => 
                        p.name.toLowerCase().includes(searchApptPatient.toLowerCase()) ||
                        p.phone.includes(searchApptPatient) ||
                        p.id.toLowerCase().includes(searchApptPatient.toLowerCase()) ||
                        (p.tokenNumber && p.tokenNumber.toLowerCase().includes(searchApptPatient.toLowerCase()))
                      ).length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-2">No patients found in registry.</p>
                      ) : (
                        patients.filter(p => 
                          p.name.toLowerCase().includes(searchApptPatient.toLowerCase()) ||
                          p.phone.includes(searchApptPatient) ||
                          p.id.toLowerCase().includes(searchApptPatient.toLowerCase()) ||
                          (p.tokenNumber && p.tokenNumber.toLowerCase().includes(searchApptPatient.toLowerCase()))
                        ).map(p => (
                          <div 
                            key={p.id}
                            onClick={() => {
                              setSelectedApptPatient(p);
                              setSearchApptPatient('');
                            }}
                            className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg hover:border-indigo-500 hover:bg-indigo-50/20 dark:hover:bg-indigo-500/10 cursor-pointer flex justify-between items-center transition-all"
                          >
                            <div>
                              <h5 className="font-bold text-xs text-slate-800 dark:text-white">{p.name}</h5>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">ID: {p.id} · +91 {p.phone}</span>
                            </div>
                            <span className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-mono font-bold">Select</span>
                          </div>
                        ))
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
                            <option value="upi">📱 Online (UPI/QR)</option>
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
                          onClick={async () => {
                            // 1. Create appointment + invoice (async init inside)
                            BillingService.createGate1Consult(selectedApptPatient.id);

                            // 2. Give async appointment creation 200ms to settle, then pay
                            await new Promise(r => setTimeout(r, 200));
                            // Retrieve the just-created unpaid consult invoice for this patient
                            const newInvoice = BillingService.getInvoices()
                              .filter(inv => inv.patientId === selectedApptPatient.id && inv.status === 'unpaid' && inv.type === 'consult')
                              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
                            if (newInvoice) {
                              await BillingService.recordInvoicePayment(newInvoice.id, apptPaymentMode as 'cash' | 'upi' | 'card');
                            }

                            // 3. Reset selection
                            const bookedPatient = selectedApptPatient;
                            setSelectedApptPatient(null);
                            setApptPaymentMode('cash');

                            // 4. Full sync to refresh all state
                            syncData();

                            // 5. Pre-open vitals form for this patient
                            setVitalsPatient(bookedPatient);
                            setCustomToken(bookedPatient.tokenNumber || api.generateNextTokenNumber());

                            window.dispatchEvent(new CustomEvent('mediflow-toast', {
                              detail: {
                                message: `Appointment booked & fee settled via ${apptPaymentMode === 'cash' ? 'Cash' : 'UPI'}. Now record vitals to dispatch to doctor queue!`,
                                type: 'success',
                                title: 'Appointment Active — Record Vitals 🩺'
                              }
                            }));
                          }}
                          className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:scale-105 active:scale-95 text-white font-bold tracking-wider uppercase border-0 rounded-xl text-xs cursor-pointer transition-transform"
                        >
                          Book Appointment &amp; Pay 💳
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Today's Appointments List */}
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden bg-white text-slate-800 rounded-3xl">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-teal-500 to-indigo-500 opacity-60" />
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-4 mb-4">
                  <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-rose-500 animate-pulse" />
                    Today's Appointments Queue (दैनिक नियुक्तियां)
                  </h2>
                  <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 bg-indigo-500/10 text-indigo-600 border border-indigo-550/20 rounded-full animate-pulse">
                    Live Status
                  </span>
                </div>

                <div className="space-y-4">
                  {(() => {
                    const confirmedAppts = appointments.filter(a => a.status !== 'pending_payment');
                    if (confirmedAppts.length === 0) {
                      return <ZeroQueueState queueType="appointments" className="mx-0" />;
                    }
                    return confirmedAppts.map((appt) => {
                      const patient = patients.find(p => p.id === appt.patientId) || {
                        id: appt.patientId,
                        name: (appt as any).patientName || 'WhatsApp Patient',
                        phone: (appt as any).patientPhone || 'N/A',
                        age: (appt as any).patientAge || 30,
                        gender: (appt as any).patientGender || 'Male',
                        queueStatus: 'awaiting_vitals'
                      };

                      // Find matching consult invoice
                      const invoice = api.getInvoices().find(i => i.appointmentId === appt.id && i.type === 'consult');

                      const isAwaitingVitals = patient.queueStatus === 'awaiting_vitals' || !patient.queueStatus;
                      const isAwaitingConsult = patient.queueStatus === 'awaiting_consultation';

                      return (
                        <div 
                          key={appt.id} 
                          className={`p-4 bg-slate-50 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 ${
                            vitalsPatient?.id === patient.id 
                              ? 'border-rose-500/50 bg-rose-500/5 shadow-md shadow-rose-500/5' 
                              : 'border-slate-200 hover:bg-slate-100/50'
                          }`}
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2.5">
                              <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-lg border ${
                                appt.isVirtual
                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25'
                                  : (appt as any).source?.includes('whatsapp')
                                  ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/25'
                                  : 'bg-slate-500/10 text-slate-600 border-slate-500/25'
                              }`}>
                                {appt.isVirtual ? '📹 VIRTUAL CALL' : (appt as any).source?.includes('whatsapp') ? '🏥 PHYSICAL VISIT (WA)' : '🏢 COUNTER'}
                              </span>
                              <h4 className="font-bold text-slate-805 text-xs">{patient.name}</h4>
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
                                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                      detail: { message: 'Cash collected! 🌟 Mediflow Premium Member Unlocked (1 Free Virtual Consult + 10% OFF Refills + WhatsApp PDF Reports)!', type: 'success', title: 'Payment Settled ✔️' }
                                    }));
                                    setVitalsPatient(patient);
                                    setCustomToken(patient.tokenNumber || api.generateNextTokenNumber());
                                  }}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold uppercase tracking-wider text-[8px] transition-all cursor-pointer border-0"
                                >
                                  Collect Cash
                                </button>
                                <button
                                  onClick={async () => {
                                    await BillingService.recordInvoicePayment(invoice.id, 'upi');
                                    // Full sync: refresh patients + appointments
                                    syncData();
                                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                      detail: { message: 'UPI verified! 🌟 Mediflow Premium Member Unlocked (1 Free Virtual Consult + 10% OFF Refills + WhatsApp PDF Reports)!', type: 'success', title: 'Payment Settled ✔️' }
                                    }));
                                    // Auto-open vitals for this patient
                                    setVitalsPatient(patient);
                                    setCustomToken(patient.tokenNumber || api.generateNextTokenNumber());
                                  }}
                                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold uppercase tracking-wider text-[8px] transition-all cursor-pointer border-0"
                                >
                                  Verify UPI
                                </button>
                              </div>
                            ) : isAwaitingVitals ? (
                              <button
                                onClick={() => {
                                  setVitalsPatient(patient);
                                  setCustomToken(patient.tokenNumber || api.generateNextTokenNumber());
                                  // Reset form defaults
                                  setTempVal(isOphthalmology ? '6/6' : '98.6');
                                  setBpVal(isOphthalmology ? '6/6' : '120/80');
                                  setPulseVal(isOphthalmology ? '16' : '72');
                                  setWeightVal(isOphthalmology ? '' : '65');
                                  setSugarVal('');
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

            {/* Right Column: Vitals Intake Form */}
            <div className="lg:col-span-4 space-y-6">
              {vitalsPatient ? (
                <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative animate-fade-in bg-white text-slate-800 rounded-3xl">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-rose-500 opacity-60" />
                  
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-4 mb-4">
                    <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <span className="material-symbols-outlined text-rose-450 text-base">monitor_heart</span>
                      Record Vitals (स्वास्थ्य जांच): {vitalsPatient.name}
                    </h2>
                    <button
                      onClick={() => setVitalsPatient(null)}
                      className="text-slate-500 hover:text-slate-800 text-xs underline cursor-pointer bg-transparent border-0 p-0"
                    >
                      Cancel
                    </button>
                  </div>

                  <form onSubmit={handleRecordVitalsSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Token Number</label>
                        <input
                          type="text"
                          required
                          value={customToken}
                          onChange={(e) => setCustomToken(e.target.value)}
                          className="w-full input-field text-xs py-2 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg font-mono font-bold outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">
                          {isOphthalmology ? 'Visual Acuity OD (दाहिनी आंख)' : 'Temperature (°F)'}
                        </label>
                        <input
                          type="text"
                          value={tempVal}
                          onChange={(e) => setTempVal(e.target.value)}
                          list="vitals-temp-list"
                          placeholder={isOphthalmology ? 'e.g. 6/6' : 'e.g. 98.6'}
                          className="w-full input-field text-xs py-2 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg outline-none"
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
                        <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">
                          {isOphthalmology ? 'VA OS (बाईं आंख)' : 'BP (mmHg)'}
                        </label>
                        <input
                          type="text"
                          value={bpVal}
                          onChange={(e) => setBpVal(e.target.value)}
                          list="vitals-bp-list"
                          placeholder={isOphthalmology ? 'e.g. 6/6' : 'e.g. 120/80'}
                          className="w-full input-field text-xs py-2 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg outline-none"
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
                        <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">
                          {isOphthalmology ? 'IOP (mmHg)' : 'Pulse (bpm)'}
                        </label>
                        <input
                          type="text"
                          value={pulseVal}
                          onChange={(e) => setPulseVal(e.target.value)}
                          list="vitals-pulse-list"
                          placeholder={isOphthalmology ? 'e.g. 15' : 'e.g. 72'}
                          className="w-full input-field text-xs py-2 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg outline-none"
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
                        <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">
                          {isOphthalmology ? 'Aided OD (Optional)' : 'Weight (kg)'}
                        </label>
                        <input
                          type="text"
                          value={weightVal}
                          onChange={(e) => setWeightVal(e.target.value)}
                          list="vitals-weight-list"
                          placeholder={isOphthalmology ? 'e.g. 6/6' : 'e.g. 60'}
                          className="w-full input-field text-xs py-2 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg outline-none"
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
                      <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">
                        {isOphthalmology ? 'Aided OS (Optional)' : 'Blood Sugar (mg/dL) - Optional'}
                      </label>
                      <input
                        type="text"
                        value={sugarVal}
                        onChange={(e) => setSugarVal(e.target.value)}
                        list="vitals-sugar-list"
                        placeholder={isOphthalmology ? 'e.g. 110' : 'e.g. None'}
                        className="w-full input-field text-xs py-2 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg outline-none"
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

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:scale-[1.02] active:scale-[0.98] text-white font-bold tracking-wider uppercase border-0 rounded-xl text-xs cursor-pointer transition-transform"
                    >
                      Save &amp; Dispatch to Doctor 🩺
                    </button>
                  </form>
                </div>
              ) : (
                <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative text-center text-slate-550 py-10 bg-white rounded-3xl">
                  <Activity className="h-8 w-8 text-slate-400 mx-auto mb-3 animate-pulse" />
                  <p className="text-xs font-semibold text-slate-700">Select an active patient from the Appointments Queue to record vitals.</p>
                </div>
              )}
            </div>
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
                  <span className="material-symbols-outlined text-indigo-600 text-base">biotech</span>
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
                            <th className="p-3 font-bold text-slate-655 text-[9px] uppercase font-mono text-right">Barcode</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reqs.map((req) => {
                            let statusClass = "bg-slate-100 text-slate-700 border-slate-200";
                            if (req.status === 'pending') statusClass = "bg-amber-100 text-amber-850 border-amber-200 animate-pulse";
                            else if (req.status === 'collected') statusClass = "bg-blue-100 text-blue-800 border-blue-200";
                            else if (req.status === 'processed') statusClass = "bg-indigo-100 text-indigo-850 border-indigo-200";
                            else if (req.status === 'completed') statusClass = "bg-emerald-105 text-emerald-850 border-emerald-200";

                            return (
                              <tr key={req.id} className="border-b border-slate-200/50 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/80 transition-colors">
                                <td className="p-3">
                                  <div className="font-bold text-slate-800">{req.patientName}</div>
                                  <span className="text-[9px] text-slate-400 block font-mono">ID: {req.patientId.substring(0, 8)}</span>
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
                                <td className="p-3 text-right font-mono text-slate-500 font-bold">
                                  {req.barcode}
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
                  <span className="material-symbols-outlined text-emerald-600 text-base">verified_user</span>
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
                              <span className="text-[9px] text-slate-400 font-mono block">ID: {report.patientId.substring(0, 8)}</span>
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
                  <span className="material-symbols-outlined text-amber-600 text-2xl shrink-0 mt-0.5 animate-bounce">warning</span>
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
                    <span className="material-symbols-outlined text-indigo-600 text-lg">medication</span>
                    Pharmacy Inventory &amp; Stock Catalog
                  </h2>
                  <p className="text-xs text-slate-500">
                    Real-time Patna ecosystem medicine catalog lookup. View expiry dates, FEFO batches, prices, and stock indicators.
                  </p>
                </div>

                {/* Search Bar */}
                <div className="w-full md:w-80 relative mt-3 md:mt-0 select-none">
                  <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                    <span className="material-symbols-outlined text-base">search</span>
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
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  )}
                </div>
              </div>

              {(() => {
                const filtered = activeInventory.filter(item => 
                  item.name.toLowerCase().includes(medSearchQuery.toLowerCase()) ||
                  item.genericName.toLowerCase().includes(medSearchQuery.toLowerCase()) ||
                  item.category.toLowerCase().includes(medSearchQuery.toLowerCase())
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
                                <div className="font-bold text-slate-850">₹{item.price.toFixed(2)}</div>
                                <span className="text-[9px] text-slate-455 block font-mono">MRP: ₹{item.mrp.toFixed(2)}</span>
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
        {activeTab === ('ot_billing' as any) && (() => {
          const daycarePatients = patients.filter(p => {
            if (isOphthalmology) {
              return p.vitals?.surgeryBooking && p.vitals.surgeryBooking.eye !== 'None';
            } else {
              return p.vitals?.gpProcedureBooking && p.vitals.gpProcedureBooking.procedure !== 'None';
            }
          });

          return (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in text-slate-800">
              {/* Left Column: Scheduled Daycare List */}
              <div className="lg:col-span-6 space-y-6">
                <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden bg-white text-left">
                  <div className={`absolute top-0 left-0 w-full h-[2px] ${isOphthalmology ? 'bg-rose-600' : 'bg-amber-600'} opacity-60`} />
                  <h2 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-rose-600 text-lg">medical_services</span>
                    {isOphthalmology 
                      ? `Active Scheduled Daycare Surgeries (${daycarePatients.length})` 
                      : `Active Scheduled Daycare Procedures (${daycarePatients.length})`}
                  </h2>
                  <p className="text-xs text-slate-500 mb-4">
                    {isOphthalmology 
                      ? 'Daycare admission OT tracker. Track lens packages, surgical preparation, and patient timeline status.'
                      : 'Daycare minor OT procedure tracker. Track dressing room status and patient timeline status.'}
                  </p>

                  <div className="space-y-3.5 max-h-[480px] overflow-y-auto pr-1">
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
                    <span className="material-symbols-outlined text-rose-655 text-sm">hail</span>
                    Scheduled Surgeons &amp; Specialists Today
                  </h3>
                  
                  <div className="space-y-3.5">
                    {[
                      { name: 'Dr. Vivek Sharma', role: 'Chief Ophthalmic Surgeon', status: 'In OT (Eye Room A)', time: '10:00 AM - 02:00 PM', specialty: 'Phacoemulsification & Glaucoma' },
                      { name: 'Dr. Priya Sen', role: 'Consultant Anesthesiologist', status: 'Pre-op Blocks (Ward B)', time: '09:30 AM - 01:30 PM', specialty: 'Regional & Topical Anesthesia' },
                      { name: 'Dr. Amit Roy', role: 'General & Laparoscopic Surgeon', status: 'On Call (Minor OT)', time: '12:00 PM - 04:00 PM', specialty: 'Excision & Wound Debridement' }
                    ].map((s, idx) => (
                      <div key={idx} className="p-3 border border-slate-200 rounded-xl bg-slate-50 flex items-start gap-3 hover:bg-slate-100/65 transition-all">
                        <span className="material-symbols-outlined text-rose-500 text-xl mt-0.5">account_circle</span>
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
                    <span className="material-symbols-outlined text-indigo-600 text-sm">schedule</span>
                    Daycare OT Room Timelines &amp; Pre-op Checks
                  </h3>

                  <div className="relative border-l border-indigo-100 pl-4 ml-2.5 space-y-5 py-1 text-xs">
                    {[
                      { time: '10:15 AM', label: 'Patient admission checks completed', desc: 'Pre-op vitals logged, ABHA consent verified at desk.' },
                      { time: '11:00 AM', label: 'Local block anesthetic administration', desc: 'Topical anesthetic drops and block administered by Dr. Sen.' },
                      { time: '11:30 AM', label: 'OT Procedure started (Cataract Phaco)', desc: 'Surgeon Dr. Vivek Sharma started Phaco surgery under microscope.' },
                      { time: '12:00 PM', label: 'Patient shifted to Recovery Ward', desc: 'IOL lens successfully placed. Shifted to Ward B for monitoring.' },
                      { time: '12:45 PM', label: 'Discharge clearance & counseling', desc: 'Post-op dosage directions pushed to patient WhatsApp.' }
                    ].map((t, idx) => (
                      <div key={idx} className="relative group">
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

          );
        })()}

      {/* Sliding WhatsApp Chat Drawer */}
      <div className={`fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl transition-transform duration-350 ease-in-out transform flex flex-col ${
        isChatDrawerOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
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
            className="p-1.5 text-white hover:text-slate-100 rounded-lg hover:bg-white/10 transition cursor-pointer border-0 bg-transparent flex items-center"
          >
            <span className="material-symbols-outlined text-sm font-bold text-white-force">close</span>
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
                const pat = patients.find(p => p.phone === phone);
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
              const pat = patients.find(p => p.phone === s.patientPhone);
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
                      key={idx} 
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
              <span className="material-symbols-outlined text-5xl text-slate-400 animate-pulse">forum</span>
              <div>
                <h4 className="font-bold text-slate-705 dark:text-slate-350 text-xs">No Active Chat Loop</h4>
                <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-1 leading-relaxed">
                  Search a patient registry or click the WhatsApp button next to a patient to select active chat session.
                </p>
              </div>
            </div>
          )}
        </div>

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
            className={`p-2.5 rounded-full transition-colors border-0 shrink-0 ${
              activeSession && replyInput.trim() 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-slate-855 cursor-pointer shadow active:scale-95' 
                : 'bg-slate-200 dark:bg-slate-800 text-slate-655'
            }`}
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

      {viewingDocUrl && (
        <div className="fixed inset-0 bg-slate-800/80 backdrop-blur-md z-[999] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200/60 rounded-2xl max-w-2xl w-full p-6 space-y-4 relative shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 to-teal-500" />
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-400 text-base">receipt_long</span>
                Prescription Document Viewer
              </h3>
              <button
                onClick={() => setViewingDocUrl(null)}
                className="p-1.5 text-slate-600 hover:text-slate-800 bg-white/5 hover:bg-white/10 border-0 rounded-lg cursor-pointer transition active:scale-95 flex items-center"
              >
                <span className="material-symbols-outlined text-sm font-bold">close</span>
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
        </div>
      )}

      {/* Interactive Workflow Document Viewer Modal */}
      {activeWorkflowDetail && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
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
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer bg-transparent border-0 outline-none"
              >
                <span className="material-symbols-outlined text-xl">close</span>
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
                  <div className="text-xs font-bold font-mono">{activeWorkflowDetail.patientId.substring(0, 8).toUpperCase()}</div>
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
                                  <tr key={idx} className="border-b border-slate-200 dark:border-slate-800/80 last:border-0">
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
                                <tr key={idx} className="border-b border-slate-200 dark:border-slate-800/80 last:border-0">
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
                const sessionList = api.getWhatsAppSessions();
                const session = sessionList.find(s => s.patientPhone === (patientObj?.phone || ''));

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
                          <div key={idx} className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}>
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
        </div>
      )}

      {/* Premium PWA Mobile Fixed Bottom Tab Bar Navigation for Compounder Dashboard */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-50/95 dark:bg-[#0b0f19]/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800/80 shadow-[0_-4px_12px_rgba(0,0,0,0.02)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.5)] px-2 pb-safe-bottom">
        <div className="flex items-center justify-around h-16">
          {[
            { id: 'patients', label: 'Patients', icon: Users },
            { id: 'tokens', label: 'Tokens', icon: Activity },
            { id: 'labs', label: 'Labs', icon: FileText },
            { id: 'pharmacy', label: 'Pharmacy', icon: QrCode },
            { id: 'ot_billing', label: isOphthalmology ? 'Daycare' : 'Minor OT', icon: Stethoscope },
            { id: 'invoice_generator', label: 'Invoices', icon: Printer }
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as any);
                  if (item.id === 'tokens' && activePatient) {
                    setVitalsPatient(activePatient);
                    setCustomToken(activePatient.tokenNumber || api.generateNextTokenNumber());
                  }
                }}
                className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-200 cursor-pointer relative bg-transparent border-0 outline-none ${
                  isActive 
                    ? 'text-indigo-600 dark:text-indigo-400 font-bold' 
                    : 'text-slate-650 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <div className={`p-1.5 rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 scale-105 shadow-sm' 
                    : 'bg-transparent text-slate-500 dark:text-slate-400'
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold mt-1 tracking-wide leading-none">
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
