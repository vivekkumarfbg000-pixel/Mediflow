import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { api, MASTER_TEST_CATALOG } from '../../services/api';
import { supabase } from '../../lib/supabaseClient';
import { useSpecialization } from '../../context/SpecializationContext';
import { useClinic } from '../../context/ClinicContext';
import { VISUAL_ACUITY_OPTIONS } from '../../types/ophthalmic';
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
import InvoiceGenerator from './InvoiceGenerator';
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
  const [activeTab, setActiveTab] = useState<'intake' | 'patients' | 'tokens' | 'labs' | 'pharmacy' | 'ot_billing'>('intake');

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

  // Vernacular Dosage Assistant States
  const [selectedLanguage, setSelectedLanguage] = useState<'hindi' | 'bhojpuri'>('hindi');
  const [dosageTemplate, setDosageTemplate] = useState<'od' | 'bd' | 'tds' | 'sos'>('od');

  // Registry Registry state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  
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
  const [isInvoiceGeneratorOpen, setIsInvoiceGeneratorOpen] = useState(false);

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
  
  // Simulated prescription OCR scan state
  const [isPrescriptionScanning, setIsPrescriptionScanning] = useState(false);
  const [prescriptionImage, setPrescriptionImage] = useState<string | null>(null);
  const [ocrLogs, setOcrLogs] = useState<string[]>([]);
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
        setTempVal(vitalsPatient.vitals.temperature || (isOphthalmology ? '6/6' : '98.6'));
        setBpVal(vitalsPatient.vitals.bloodPressure || (isOphthalmology ? '6/6' : '120/80'));
        setPulseVal(vitalsPatient.vitals.pulseRate || (isOphthalmology ? '16' : '72'));
        setWeightVal(vitalsPatient.vitals.weight || (isOphthalmology ? '' : '65'));
        setSugarVal(vitalsPatient.vitals.bloodSugar || '');
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

  // Scan Prescription Simulation
  const handlePrescriptionImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPrescriptionImage(reader.result as string);
      setOcrLogs([]);
    };
    reader.readAsDataURL(file);
  };

  const handleTriggerPrescriptionOcr = async () => {
    if (!prescriptionImage) return;
    setIsPrescriptionScanning(true);
    setOcrLogs([
      `[${new Date().toLocaleTimeString()}] Reading prescription visual bounds...`,
      `[${new Date().toLocaleTimeString()}] Querying clinical RAG OCR pipeline...`
    ]);

    await new Promise(resolve => setTimeout(resolve, 800));
    setOcrLogs(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Extracting handwriting strokes...`,
      `[${new Date().toLocaleTimeString()}] Parsed medications list from Doctor Vivek`
    ]);

    try {
      const parsedData = await api.parsePrescriptionOCR(prescriptionImage);
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Match from inventory
      const matched = api.matchPrescriptionMedicines(parsedData.medications.map((m: any) => m.medicineName));
      
      const newItems: MedicineBillItem[] = matched.map(invItem => {
        const itemTotal = invItem.price * 10;
        const gst = invItem.hsn === '300410' ? 0.12 : 0.05;
        
        return {
          inventoryItemId: invItem.id,
          name: invItem.name,
          genericName: invItem.genericName,
          dosage: invItem.dosage,
          batchNumber: invItem.batchNumber,
          expiryDate: invItem.expiryDate,
          quantity: 10, // Default prescription qty
          mrp: invItem.mrp,
          sellingPrice: invItem.price,
          discountPercent: 0,
          gstPercent: gst * 100,
          lineTotal: itemTotal
        };
      });

      setBillingItems(prev => [...prev, ...newItems]);
      setOcrLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] SUCCESS: Digitized ${matched.length} medicines. Auto-populated bill workspace! [OK]`
      ]);
      
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: `AI OCR parsed prescription: Loaded ${matched.length} medicines matching Patna live inventory!`,
          type: 'success',
          title: 'Prescription Parsed Successfully'
        }
      }));
    } catch (err: any) {
      setOcrLogs(prev => [...prev, `[ERROR] AI OCR failed: ${err.message}`]);
    } finally {
      setIsPrescriptionScanning(false);
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

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.phone.includes(searchQuery) ||
    (p.abhaId && p.abhaId.includes(searchQuery))
  );

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
          <div className="flex items-start gap-4">
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
            <button
              type="button"
              onClick={() => setIsInvoiceGeneratorOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-clinical-800/50 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-clinical-700/50 hover:shadow-md transition-all cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              Invoice Generator
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-rose-700 hover:bg-rose-100 transition cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5 text-rose-600" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Integrated Tab Switcher — scrollable glass pill capsules for all screen sizes */}
        <div className="flex overflow-x-auto gap-2 no-scrollbar select-none -mb-px p-1.5 bg-slate-100/80 dark:bg-slate-900/60 rounded-xl border border-slate-200/50 dark:border-white/5 backdrop-blur-md">
          {[
            { id: 'intake', label: 'Intake (इन्टेक)', icon: <UserCheck className="h-4 w-4" /> },
            { id: 'patients', label: 'Patients (पेशेंट)', icon: <Users className="h-4 w-4 text-indigo-600" /> },
            { id: 'tokens', label: 'Tokens (टोकन)', icon: <Activity className="h-4 w-4 text-rose-500" /> },
            { id: 'labs', label: isOphthalmology ? 'Biometry (बायोमेट्री)' : nomenclature.careLoopLabStep, icon: <FileText className="h-4 w-4 text-indigo-500" /> },
            { id: 'pharmacy', label: isOphthalmology ? 'Optical/Rx (चश्मा)' : nomenclature.careLoopPharmacyStep, icon: <QrCode className="h-4 w-4 text-amber-500" /> },
            { id: 'ot_billing', label: isOphthalmology ? 'Daycare (सर्जरी)' : 'Minor OT (ओटी)', icon: <span className="material-symbols-outlined text-sm font-bold text-rose-600">medical_services</span> }
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

      {/* ACTIVE PATIENT CARE LOOP HUD */}
      {activePatient ? (
        <div className="glass-panel p-6 border-indigo-500/20 shadow-xl relative overflow-hidden bg-gradient-to-r from-indigo-500/5 to-teal-500/5">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 to-teal-500" />
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left: Patient Profile summary */}
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-lg border border-indigo-500/20 shrink-0">
                {activePatient.name.charAt(0)}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 leading-none">{activePatient.name}</h3>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full font-semibold">
                    {activePatient.age}y · {activePatient.gender}
                  </span>
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px] text-slate-600">phone</span>
                  +91 {activePatient.phone}
                  {activePatient.abhaId && (
                    <span className="ml-2 font-mono text-[10px] text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded">
                      ABHA: {activePatient.abhaId}
                    </span>
                  )}
                </p>
                {activePatient.vitals && (
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-slate-500 font-semibold font-mono">
                    {isOphthalmology ? (
                      <>
                        <span className="bg-rose-50 border border-rose-200 text-rose-600 px-1.5 py-0.2 rounded">👁️ OD: {activePatient.vitals.temperature}</span>
                        <span className="bg-indigo-50 border border-indigo-200 text-indigo-600 px-1.5 py-0.2 rounded">👁️ OS: {activePatient.vitals.bloodPressure}</span>
                        {activePatient.vitals.weight && activePatient.vitals.weight !== '0' && activePatient.vitals.weight !== '65' && (
                          <span className="bg-pink-50 border border-pink-200 text-pink-600 px-1.5 py-0.2 rounded">👓 Aided OD: {activePatient.vitals.weight}</span>
                        )}
                        {activePatient.vitals.bloodSugar && (
                          <span className="bg-violet-50 border border-violet-200 text-violet-600 px-1.5 py-0.2 rounded">👓 Aided OS: {activePatient.vitals.bloodSugar}</span>
                        )}
                        <span className="bg-emerald-50 border border-emerald-200 text-emerald-600 px-1.5 py-0.2 rounded">🩺 IOP: {activePatient.vitals.pulseRate} mmHg</span>
                      </>
                    ) : (
                      <>
                        <span className="bg-rose-50 border border-rose-200 text-rose-600 px-1.5 py-0.2 rounded">🌡️ {activePatient.vitals.temperature}°F</span>
                        <span className="bg-indigo-50 border border-indigo-200 text-indigo-600 px-1.5 py-0.2 rounded">🩺 {activePatient.vitals.bloodPressure}</span>
                        <span className="bg-emerald-50 border border-emerald-200 text-emerald-600 px-1.5 py-0.2 rounded">💓 {activePatient.vitals.pulseRate} bpm</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Center: Interactive Stepper */}
            <div className="flex-1 max-w-xl">
              <div className="flex items-center justify-between gap-1 select-none overflow-x-auto py-1 scrollbar-none">
                {[
                  { id: 'registered', label: '1. Registry', tab: 'intake' },
                  { id: 'vitals', label: `2. ${isOphthalmology ? 'Eye Exam' : 'Vitals Logged'}`, tab: 'tokens' },
                  { id: 'diagnosing', label: '3. CDSS Consult', tab: 'tokens' },
                  { id: 'lab', label: `4. ${isOphthalmology ? 'Scan / Lab' : 'Lab'}`, tab: 'labs' },
                  { id: 'pharmacy', label: `5. ${isOphthalmology ? 'Optical / Rx' : 'Rx POS'}`, tab: 'pharmacy' },
                  { id: 'settled', label: '6. Ledger Settled', tab: 'pharmacy' }
                ].map((step, idx, arr) => {
                  const stages = ['registered', 'vitals', 'diagnosing', 'lab', 'pharmacy', 'settled'];
                  
                  // Compute if this step is completed or active
                  let isCompleted = false;
                  let isActive = false;
                  
                  const activeIdx = stages.indexOf(activePatientStage);
                  const currentStepIdx = stages.indexOf(step.id);
                  
                  if (step.id === 'vitals') {
                    isCompleted = !!activePatient.vitals;
                    isActive = !activePatient.vitals && activePatientStage === 'registered';
                  } else if (step.id === 'registered') {
                    isCompleted = true;
                    isActive = false;
                  } else {
                    isCompleted = currentStepIdx < activeIdx || (activePatientStage === 'settled');
                    isActive = activePatientStage === step.id;
                  }

                  return (
                    <React.Fragment key={step.id}>
                      <button
                        onClick={() => {
                          setActiveTab(step.tab as any);
                          if (step.tab === 'tokens') {
                            setVitalsPatient(activePatient);
                            setCustomToken(activePatient.tokenNumber || api.generateNextTokenNumber());
                          }
                        }}
                        className={`flex flex-col items-center gap-1 bg-transparent border-0 cursor-pointer p-0 group outline-none`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border text-[9px] font-bold transition-all duration-300 ${
                          isActive 
                            ? 'bg-indigo-600 border-indigo-600 text-slate-800 shadow-md shadow-indigo-600/20 scale-105' 
                            : isCompleted 
                              ? 'bg-emerald-500 border-emerald-500 text-slate-800' 
                              : 'bg-white border-slate-200 text-slate-600 group-hover:border-slate-400 group-hover:text-slate-600'
                        }`}>
                          {isCompleted ? '✓' : idx + 1}
                        </div>
                        <span className={`text-[9px] font-bold whitespace-nowrap transition-colors ${
                          isActive 
                            ? 'text-indigo-600' 
                            : isCompleted 
                              ? 'text-emerald-600' 
                              : 'text-slate-600 group-hover:text-slate-600'
                        }`}>
                          {step.label}
                        </span>
                      </button>
                      
                      {idx < arr.length - 1 && (
                        <div className={`flex-1 h-[2px] min-w-[20px] rounded transition-all duration-500 ${
                          isCompleted 
                            ? 'bg-emerald-500' 
                            : 'bg-slate-200'
                        }`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
 
            {/* Right: Contextual Actions & Close button */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Contextual Action Button */}
              {(() => {
                let btnText = "";
                let targetTab: 'intake' | 'tokens' | 'labs' | 'pharmacy' = "intake";
                let btnColor = "bg-indigo-600 hover:bg-indigo-500 text-slate-800";
                
                if (!activePatient.vitals) {
                  btnText = "Record Vitals";
                  targetTab = "tokens";
                  btnColor = "bg-rose-600 hover:bg-rose-500 text-slate-800 shadow-lg shadow-rose-600/15 animate-pulse-wave";
                } else if (activePatientStage === 'registered') {
                  btnText = "Consultation Active";
                  targetTab = "tokens";
                  btnColor = "bg-indigo-600 hover:bg-indigo-500 text-slate-800";
                } else if (activePatientStage === 'diagnosing') {
                  btnText = "Consult Billing";
                  targetTab = "tokens";
                  btnColor = "bg-emerald-600 hover:bg-emerald-500 text-slate-800 shadow-lg shadow-emerald-600/15";
                } else if (activePatientStage === 'lab') {
                  btnText = "Pathology Lab";
                  targetTab = "labs";
                  btnColor = "bg-indigo-600 hover:bg-indigo-500 text-slate-800 shadow-lg shadow-indigo-600/15";
                } else if (activePatientStage === 'pharmacy') {
                  btnText = "Pharmacy POS";
                  targetTab = "pharmacy";
                  btnColor = "bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/15";
                } else if (activePatientStage === 'settled') {
                  btnText = "Care Loop Complete";
                  targetTab = "intake";
                  btnColor = "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20";
                }
 
                return (
                  <button
                    onClick={() => {
                      setActiveTab(targetTab);
                      if (targetTab === 'tokens') {
                        setVitalsPatient(activePatient);
                        setCustomToken(activePatient.tokenNumber || api.generateNextTokenNumber());
                      }
                    }}
                    className={`px-4 py-2 text-xs font-bold rounded-xl uppercase tracking-wider transition-all cursor-pointer border-0 active:scale-95 flex items-center gap-1.5 ${btnColor}`}
                  >
                    <span className="material-symbols-outlined text-sm">double_arrow</span>
                    {btnText}
                  </button>
                );
              })()}


              {/* Compounder Physical Presence Verification — valid clinical action in all environments */}
              {!api.isPatientConsentActive(activePatient.id) && (
                <button
                  type="button"
                  onClick={async () => {
                    await api.grantInPersonConsent(activePatient.id);
                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                      detail: {
                        message: `In-Person presence verified! Patient records unlocked for consultation.`,
                        type: 'success',
                        title: 'Presence Verified'
                      }
                    }));
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-slate-800 text-xs font-bold rounded-xl uppercase tracking-wider transition-all cursor-pointer border-0 active:scale-95 flex items-center gap-1.5 shadow-md shadow-rose-600/10 text-slate-800-force"
                  title="Verify patient presence to grant clinical file access to the Doctor"
                >
                  <span className="material-symbols-outlined text-sm font-bold text-slate-800-force">how_to_reg</span>
                  Verify Presence
                </button>
              )}


              {/* Dismiss patient from HUD */}
              <button
                onClick={() => {
                  api.setActivePatient(null);
                  setActiveSession(null);
                  window.dispatchEvent(new CustomEvent('mediflow-toast', {
                    detail: { message: 'Cleared active patient loop.', type: 'info', title: 'Loop Cleared' }
                  }));
                }}
                className="p-2 text-slate-600 hover:text-slate-700 bg-white border border-slate-200/80 hover:bg-slate-50 rounded-xl transition-all cursor-pointer shadow-sm"
                title="Dismiss Active Patient"
              >
                <span className="material-symbols-outlined text-[16px] block">close</span>
              </button>
            </div>

          </div>
        </div>
      ) : null}

      {/* TAB CONTENT SPACES */}
      <div className="space-y-6">
        {isInvoiceGeneratorOpen && (
          <div className="glass-panel p-6 border-slate-200/60 shadow-xl animate-fade-in relative">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Invoice Generator</p>
                <p className="text-xs text-slate-500">Open post-payment invoice workflow for scanned bills and receipts.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsInvoiceGeneratorOpen(false)}
                className="text-xs font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-900"
              >
                Close
              </button>
            </div>
            <InvoiceGenerator />
          </div>
        )}
        
        {/* PATIENTS DIRECTORY & BULK ONBOARDER TAB */}
        {activeTab === 'patients' && (
          <div className="animate-fade-in">
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
          </div>
        )}

        {/* TAB 1: INTAKE DESK */}
        {activeTab === 'intake' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
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
                              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                {p.name}
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
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-650 bg-slate-50 border-slate-200 text-slate-800 rounded-lg"
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
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-650 bg-slate-50 border-slate-200 text-slate-800 rounded-lg"
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
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-650 bg-slate-50 border-slate-200 text-slate-800 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Gender</label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value as any)}
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-650 bg-slate-50 border-slate-200 text-slate-800 rounded-lg cursor-pointer"
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
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-650 bg-slate-50 border-slate-200 text-slate-800 rounded-lg"
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
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-650 bg-slate-50 border-slate-200 text-slate-800 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Weight (kg)</label>
                      <input
                        type="number"
                        placeholder="Weight"
                        value={weightInput}
                        onChange={(e) => setWeightInput(e.target.value)}
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-650 bg-slate-50 border-slate-200 text-slate-800 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Blood Group</label>
                      <select
                        value={bloodGroupInput}
                        onChange={(e) => setBloodGroupInput(e.target.value)}
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-650 bg-slate-50 border-slate-200 text-slate-800 rounded-lg cursor-pointer"
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
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-650 bg-slate-50 border-slate-200 text-slate-800 rounded-lg"
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
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-slate-800 rounded-lg"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newStaffRole}
                      onChange={(e) => setNewStaffRole(e.target.value as any)}
                      className="flex-1 input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-slate-800 rounded-lg cursor-pointer"
                    >
                      <option value="compounder">Compounder</option>
                      <option value="receptionist">Receptionist</option>
                      <option value="admin">Clinic Admin</option>
                    </select>
                    <button 
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-slate-800 font-bold rounded-lg text-xs cursor-pointer border-0 transition active:scale-95 shrink-0"
                    >
                      Register
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: APPOINTMENTS & TOKENS */}
        {activeTab === 'tokens' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Doctor Tracker, Vitals and Token Queue */}
            <div className="lg:col-span-6 space-y-6">
              
              {/* Doctor Availability Schedule Tracker */}
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden bg-white text-slate-800">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-650 opacity-60" />
                <h2 className="text-sm font-semibold text-slate-800 mb-2.5 flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-650 text-[18px]">calendar_today</span>
                  🗓️ Doctor Availability Schedule (डॉक्टर उपलब्धता)
                </h2>
                <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">Dr. Vivek Sharma</h4>
                      <p className="text-[10px] text-slate-500">General Physician / Eye Specialist</p>
                    </div>
                    <span className="text-[9px] bg-emerald-50 border border-emerald-200 text-emerald-600 font-mono font-bold px-2 py-0.5 rounded-full animate-pulse uppercase tracking-wider">
                      Available (chamber 1)
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-605 space-y-1 pt-1.5 border-t border-slate-200/60">
                    <p className="flex justify-between"><span>Morning Shift:</span> <span className="font-semibold text-slate-800">10:00 AM - 02:00 PM</span></p>
                    <p className="flex justify-between"><span>Evening Shift:</span> <span className="font-semibold text-slate-800">04:00 PM - 08:00 PM</span></p>
                  </div>
                </div>
              </div>

              {/* Swasthya Token Queue */}
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden bg-white text-slate-800">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-rose-500 to-indigo-500 opacity-60" />
                
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-4 mb-4">
                  <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-rose-500 animate-pulse" />
                    Swasthya Token Queue (टोकन कतार)
                  </h2>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-full animate-pulse-subtle">
                    Live Status
                  </span>
                </div>

                <div className="space-y-4">
                  {patients.length === 0 ? (
                    <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm text-slate-550">
                      No patients registered in active queue.
                    </div>
                  ) : (
                    (() => {
                      let patientsAwaitingConsult = 0;
                      return patients.map((p) => {
                        const hasVitals = !!p.vitals;
                        const isAwaitingVitals = p.queueStatus === 'awaiting_vitals' || !p.queueStatus;
                        const isAwaitingConsult = p.queueStatus === 'awaiting_consultation';
                        
                        let currentWaitEstimate = 0;
                        if (isAwaitingVitals || isAwaitingConsult) {
                          currentWaitEstimate = patientsAwaitingConsult * 15;
                          patientsAwaitingConsult++;
                        }

                        return (
                          <div 
                            key={p.id} 
                            className={`p-4 bg-slate-50 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 ${
                              vitalsPatient?.id === p.id 
                                ? 'border-rose-500/50 bg-rose-500/5 shadow-md shadow-rose-500/5' 
                                : 'border-slate-200 hover:bg-slate-100/50'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2.5">
                                <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-lg border ${
                                  p.tokenNumber 
                                    ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/25' 
                                    : 'bg-slate-500/10 text-slate-600 border-slate-500/25'
                                }`}>
                                  {p.tokenNumber || 'NO TOKEN'}
                                </span>
                                <h4 className="font-bold text-slate-805 text-xs">{p.name}</h4>
                                <span className="text-slate-500 text-[10px] font-medium">({p.age}y · {p.gender})</span>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                                <span className="flex items-center gap-1">
                                  <Smartphone className="h-3 w-3 text-indigo-500" />
                                  {p.phone}
                                </span>
                                {hasVitals && (
                                  <span className="text-emerald-600 flex items-center gap-1.5 bg-emerald-500/5 px-2 py-0.2 rounded border border-emerald-500/10">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                                    Vitals Logged
                                  </span>
                                )}
                                {isOphthalmology && p.vitals?.dilationStatus && (
                                  <span className={`flex items-center gap-1.5 px-2 py-0.2 rounded border text-[8px] font-bold uppercase tracking-wider ${
                                    p.vitals.dilationStatus === 'dilated'
                                      ? 'bg-emerald-500/5 text-emerald-600 border-emerald-500/10'
                                      : 'bg-amber-500/5 text-amber-600 border-amber-500/10'
                                  }`}>
                                    {p.vitals.dilationStatus === 'dilated' ? '👁️ Fully Dilated' : '⏳ Dilation in Progress'}
                                    {p.vitals.dilationStatus === 'instilled' && p.vitals.dilationStartTime && (
                                      <span className="font-mono text-[9px] lowercase">
                                        ({Math.max(0, Math.ceil((new Date(p.vitals.dilationStartTime).getTime() + 20 * 60 * 1000 - Date.now()) / (60 * 1000)))}m left)
                                      </span>
                                    )}
                                  </span>
                                )}
                                {(isAwaitingVitals || isAwaitingConsult) && (
                                  <span className="text-indigo-600 font-mono text-[9px]">
                                    Est. Wait: ~{currentWaitEstimate} mins
                                  </span>
                                )}
                              </div>

                              {hasVitals && p.vitals && (
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5 pt-2.5 border-t border-slate-200/60 text-[9px] font-mono text-slate-600">
                                  {isOphthalmology ? (
                                    <>
                                      <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">👁️ VA (OD): {p.vitals.temperature}</span>
                                      <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">👁️ VA (OS): {p.vitals.bloodPressure}</span>
                                      {p.vitals.weight && p.vitals.weight !== '0' && p.vitals.weight !== '65' && (
                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">👓 Aided OD: {p.vitals.weight}</span>
                                      )}
                                      {p.vitals.bloodSugar && (
                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">👓 Aided OS: {p.vitals.bloodSugar}</span>
                                      )}
                                      <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">🩺 IOP: {p.vitals.pulseRate} mmHg</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">🌡️ Temp: {p.vitals.temperature}°F</span>
                                      <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">🩺 BP: {p.vitals.bloodPressure}</span>
                                      <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">💓 Pulse: {p.vitals.pulseRate} bpm</span>
                                      <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">⚖️ Wt: {p.vitals.weight} kg</span>
                                      {p.vitals.bloodSugar && <span className="bg-slate-100 px-1.5 py-0.5 rounded text-amber-600 border border-amber-200">🩸 Sugar: {p.vitals.bloodSugar} mg/dL</span>}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isAwaitingVitals ? (
                                <button
                                  onClick={() => {
                                    setVitalsPatient(p);
                                    setCustomToken(p.tokenNumber || api.generateNextTokenNumber());
                                  }}
                                  className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-500/20 hover:border-rose-600 font-bold rounded-lg uppercase tracking-wider text-[9px] transition-all cursor-pointer border-0"
                                >
                                  Check Vitals
                                </button>
                              ) : isAwaitingConsult ? (
                                <div className="flex flex-col items-end gap-1.5">
                                  {isOphthalmology && (
                                    <div className="flex items-center gap-1 mb-1">
                                      {(!p.vitals?.dilationStatus || p.vitals.dilationStatus === 'not_started') ? (
                                        <button
                                          onClick={() => {
                                            const updatedVitals = {
                                              ...(p.vitals || {
                                                temperature: '6/6',
                                                bloodPressure: '6/6',
                                                pulseRate: '16',
                                                weight: '',
                                                recordedAt: new Date().toISOString()
                                              }),
                                              dilationStatus: 'instilled' as const,
                                              dilationStartTime: new Date().toISOString()
                                            };
                                            api.updatePatientVitalsAndToken(p.id, updatedVitals, p.tokenNumber || 'TK-1');
                                            syncData();
                                          }}
                                          className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500 text-amber-600 hover:text-white border border-amber-500/20 rounded font-bold uppercase tracking-wider text-[8px] transition-all cursor-pointer border-0"
                                        >
                                          💧 Instill Drops
                                        </button>
                                      ) : p.vitals.dilationStatus === 'instilled' ? (
                                        <button
                                          onClick={() => {
                                            const updatedVitals: PatientVitals = {
                                              temperature: p.vitals?.temperature || '6/6',
                                              bloodPressure: p.vitals?.bloodPressure || '6/6',
                                              pulseRate: p.vitals?.pulseRate || '16',
                                              weight: p.vitals?.weight || '',
                                              recordedAt: p.vitals?.recordedAt || new Date().toISOString(),
                                              bloodSugar: p.vitals?.bloodSugar,
                                              dilationStatus: 'dilated' as const,
                                              dilationStartTime: p.vitals?.dilationStartTime
                                            };
                                            api.updatePatientVitalsAndToken(p.id, updatedVitals, p.tokenNumber || 'TK-1');
                                            syncData();
                                          }}
                                          className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-bold uppercase tracking-wider text-[8px] transition-all cursor-pointer border-0"
                                        >
                                          👁️ Mark Dilated
                                        </button>
                                      ) : (
                                        <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-250 px-2 py-0.5 rounded uppercase tracking-wider">
                                          Fully Dilated
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  <span className="text-[8px] bg-amber-500/10 text-amber-700 font-mono font-bold px-2 py-0.5 rounded border border-amber-200 uppercase tracking-widest animate-pulse-subtle">
                                    In Doctor Chamber
                                  </span>
                                  <button
                                    onClick={() => {
                                      api.updatePatientQueueStatus(p.id, 'completed');
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
                              
                              {/* WhatsApp confirmed slot dispatch */}
                              <button
                                onClick={async () => {
                                  const invoiceText = `🗓️ *APPOINTMENT CONFIRMED* \n----------------------------------------\nPatient: *${p.name}*\nPhone: *+91 ${p.phone}*\nToken Number: *${p.tokenNumber || 'TK-01'}*\nEstimated Wait Time: *${currentWaitEstimate} mins*\n\nConsultation Fee: *₹450.00*\nStatus: *AWAITING PAYMENT*\n----------------------------------------\nPlease complete your check-in or view records at: https://mediflow.in/reg/${p.id}\n\n*A reminder message will also be sent 30 minutes before your slot.*`;
                                  
                                  let session = sessions.find(s => s.patientPhone === p.phone);
                                  if (!session) {
                                    session = api.initiateWhatsAppSession(p.phone);
                                  }
                                  
                                  api.updateWhatsAppState(p.phone, 'AWAITING_PAYMENT', {
                                    chatHistory: [
                                      ...(session.sessionData.chatHistory || []),
                                      { sender: 'bot', text: invoiceText, time: new Date().toISOString() }
                                    ]
                                  });
                                  
                                  handleInitiateWhatsAppLoop(p);
                                  
                                  window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                    detail: {
                                      message: `Token invoice & registration link pushed to +91 ${p.phone} on WhatsApp! Reminder scheduled 30m prior.`,
                                      type: 'success',
                                      title: 'WhatsApp Token Dispatched'
                                    }
                                  }));
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-250 cursor-pointer transition active:scale-90"
                                title="Send WhatsApp Confirmation & Scheduled Reminder"
                              >
                                <Send className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      });
                    })()
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Vitals Intake Form, Consult Invoice Initiator and Consult Invoices List */}
            <div className="lg:col-span-6 space-y-6">
              
              {/* Vitals Intake Form */}
              {vitalsPatient ? (
                <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative animate-fade-in bg-white text-slate-800">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-rose-500 opacity-60" />
                  
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-4 mb-4">
                    <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <span className="material-symbols-outlined text-rose-450 text-base">monitor_heart</span>
                      Swasthya Vitals (स्वास्थ्य जांच): {vitalsPatient.name}
                    </h2>
                    <button
                      onClick={() => setVitalsPatient(null)}
                      className="text-slate-500 hover:text-slate-800 text-xs underline cursor-pointer bg-transparent border-0 p-0"
                    >
                      Cancel
                    </button>
                  </div>

                  <form onSubmit={handleRecordVitalsSubmit} className="space-y-4">
                    {isOphthalmology ? (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Token Number</label>
                            <input
                              type="text"
                              required
                              value={customToken}
                              onChange={(e) => setCustomToken(e.target.value)}
                              className="w-full input-field text-xs py-2 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg font-mono font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Intraocular Pressure (IOP - mmHg)</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. 16"
                              value={pulseVal === '72' ? '16' : pulseVal}
                              onChange={(e) => setPulseVal(e.target.value)}
                              className="w-full input-field text-xs py-2 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Visual Acuity - Right Eye (OD)</label>
                            <select
                              value={tempVal === '98.6' ? '6/6' : tempVal}
                              onChange={(e) => setTempVal(e.target.value)}
                              className="w-full input-field text-xs py-2 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg cursor-pointer"
                            >
                              {VISUAL_ACUITY_OPTIONS.map(opt => <option key={opt} value={opt} className="bg-white text-slate-850">{opt}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Visual Acuity - Left Eye (OS)</label>
                            <select
                              value={bpVal === '120/80' ? '6/6' : bpVal}
                              onChange={(e) => setBpVal(e.target.value)}
                              className="w-full input-field text-xs py-2 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg cursor-pointer"
                            >
                              {VISUAL_ACUITY_OPTIONS.map(opt => <option key={opt} value={opt} className="bg-white text-slate-850">{opt}</option>)}
                            </select>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Token Number</label>
                            <input
                              type="text"
                              required
                              value={customToken}
                              onChange={(e) => setCustomToken(e.target.value)}
                              className="w-full input-field text-xs py-2 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg font-mono font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Temperature (°F)</label>
                            <div className="relative">
                              <input
                                type="text"
                                required
                                placeholder="e.g. 98.6"
                                value={tempVal}
                                onChange={(e) => setTempVal(e.target.value)}
                                className="w-full input-field text-xs py-2 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg"
                              />
                              {parseFloat(tempVal) > 100 && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" title="Fever Alert!" />
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">BP (mmHg)</label>
                            <div className="relative">
                              <input
                                type="text"
                                required
                                placeholder="e.g. 120/80"
                                value={bpVal}
                                onChange={(e) => setBpVal(e.target.value)}
                                className="w-full input-field text-xs py-2 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg"
                              />
                              {bpVal.includes('/') && parseInt(bpVal.split('/')[0]) > 140 && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" title="High BP Alert!" />
                              )}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Pulse (bpm)</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. 72"
                              value={pulseVal}
                              onChange={(e) => setPulseVal(e.target.value)}
                              className="w-full input-field text-xs py-2 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Weight (kg)</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. 65"
                              value={weightVal}
                              onChange={(e) => setWeightVal(e.target.value)}
                              className="w-full input-field text-xs py-2 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Blood Sugar (mg/dL) - Optional</label>
                          <input
                            type="text"
                            placeholder="e.g. 110"
                            value={sugarVal}
                            onChange={(e) => setSugarVal(e.target.value)}
                            className="w-full input-field text-xs py-2 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg"
                          />
                        </div>
                      </>
                    )}

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-gradient-to-r from-rose-500 to-indigo-500 hover:scale-[1.02] active:scale-[0.98] text-slate-850 font-black tracking-wider uppercase border-0 rounded-xl text-xs cursor-pointer transition-transform font-bold"
                    >
                      Save &amp; Dispatch to Doctor 🩺
                    </button>
                  </form>
                </div>
              ) : (
                <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative text-center text-slate-500 py-10 bg-white rounded-xl">
                  <Activity className="h-8 w-8 text-slate-400 mx-auto mb-3 animate-pulse" />
                  <p className="text-xs font-semibold text-slate-700">Select an active patient from the Token Queue to record vitals.</p>
                </div>
              )}

              {/* Consultation Invoice Initiator */}
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden bg-white text-slate-800">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-emerald-600 opacity-60" />
                <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-[16px]">point_of_sale</span>
                  Initiate Gate 1: Consultation Invoice (पर्ची बिल)
                </h2>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  Select a registered patient to generate a consult invoice of ₹450 and dispatch the WhatsApp payment nudge.
                </p>
                <div className="space-y-4">
                  <label className="text-[10px] text-slate-550 font-bold uppercase tracking-wider font-mono block pl-1">
                    Select Patient
                  </label>
                  <select
                    onChange={(e) => {
                      const patientId = e.target.value;
                      if (patientId) {
                        api.createGate1Consult(patientId);
                        window.dispatchEvent(new CustomEvent('mediflow-toast', {
                          detail: {
                            message: 'Consultation invoice created and WhatsApp payment nudge sent!',
                            type: 'success',
                            title: 'Invoice Generated'
                          }
                        }));
                        e.target.value = "";
                      }
                    }}
                    className="w-full input-field text-xs py-2.5 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-slate-50 border-slate-200 text-slate-800 rounded-lg cursor-pointer"
                    defaultValue=""
                  >
                    <option value="" disabled>-- Choose Patient from Registry --</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (+91 {p.phone})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Active Consult Invoices */}
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden bg-white text-slate-800">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-600 opacity-60" />
                <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-[16px]">receipt_long</span>
                  Active Consult Invoices
                </h2>
                
                <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1">
                  {api.getInvoices().filter(i => i.type === 'consult').length === 0 ? (
                    <div className="p-6 bg-slate-50 border border-slate-150 rounded-xl text-center text-xs text-slate-500">
                      No consultation invoices found.
                    </div>
                  ) : (
                    api.getInvoices().filter(i => i.type === 'consult').map(invoice => {
                      const appt = api.getAppointments().find(a => a.id === invoice.appointmentId);
                      const patient = appt ? patients.find(p => p.id === appt.patientId) : null;
                      return (
                        <InvoiceCard
                          key={invoice.id}
                          invoiceId={invoice.id}
                          patientName={patient?.name ?? 'Unknown Patient'}
                          amount={invoice.amount}
                          status={invoice.status}
                          onPay={invoice.status === 'unpaid' ? () => {
                            api.markInvoicePaid(invoice.id);
                            window.dispatchEvent(new CustomEvent('mediflow-toast', {
                              detail: {
                                title: 'Consultation Fee Settled ✅',
                                message: `Consultation fee of ₹${invoice.amount} paid at counter in Cash. Patient routed to consult queue.`,
                                type: 'success'
                              }
                            }));
                          } : undefined}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: GATE 2 LAB BILLING & OCR */}
        {activeTab === 'labs' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-6">
              {/* Prescription Dispatch Panel */}
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden bg-white text-slate-800">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-600 opacity-60" />
                
                <h2 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600 text-base">upload_file</span>
                  📄 Prescription Dispatch Panel (Upload &amp; Scan)
                </h2>
                <p className="text-xs text-slate-500 mb-4">
                  Upload or scan a doctor's prescription. Clinical AI OCR will automatically extract patient credentials, match or register them, and send a requisition to the lab queue.
                </p>

                {/* Handwritten Rx Workflow Alert */}
                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-start gap-2 mb-4">
                  <span className="material-symbols-outlined text-indigo-600 text-sm mt-0.5">info</span>
                  <div className="text-[10px] text-indigo-900 leading-relaxed text-left">
                    <span className="font-bold">Handwritten Rx Workflow:</span> Capture/upload the doctor's paper prescription here. The AI will extract the parameters and populate the lab/medicine queues automatically.
                  </div>
                </div>

                <div className="space-y-4">
                  {/* File Upload Area */}
                  <div className="flex gap-4 items-start">
                    <label className="flex-1 flex flex-col items-center justify-center gap-2 border border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-4 bg-slate-50 text-center cursor-pointer text-xs font-semibold text-slate-700 hover:text-slate-900 transition-all shadow-sm hover:shadow-md">
                      <Upload className="h-5 w-5 text-indigo-600" />
                      <span>{dispatchFile ? 'Change Prescription File' : 'Upload / Drag Rx Image/PDF'}</span>
                      <input 
                        type="file" 
                        accept="image/*,application/pdf" 
                        className="hidden" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setDispatchFile(file);
                          
                          // Run OCR
                          const reader = new FileReader();
                          reader.onload = async () => {
                            const dataUrl = reader.result as string;
                            setDispatchPreviewUrl(dataUrl);
                            setIsDispatchOcrParsing(true);
                            setDispatchOcrLogs([
                              `[${new Date().toLocaleTimeString()}] Visualizing prescription bounds...`,
                              `[${new Date().toLocaleTimeString()}] Querying Clinical AI LLM-OCR...`
                            ]);
                            
                            try {
                              const parsed = await api.parsePrescriptionOCR(dataUrl);
                              setDispatchOcrLogs(prev => [
                                ...prev,
                                `[${new Date().toLocaleTimeString()}] Extracted Name: "${parsed.patientName}"`,
                                `[${new Date().toLocaleTimeString()}] Extracted Age: ${parsed.patientAge || 'Unknown'}, Gender: ${parsed.patientGender || 'Unknown'}`,
                                `[${new Date().toLocaleTimeString()}] Found ${parsed.diagnosticTests?.length || 0} diagnostic test order(s)`
                              ]);
                              
                              if (parsed.patientName) setDispatchPatientName(parsed.patientName);
                              if (parsed.patientAge) setDispatchPatientAge(parsed.patientAge.toString());
                              if (parsed.patientGender) setDispatchPatientGender(parsed.patientGender as any);
                              
                              // Check if matches existing patient
                              const matched = api.getPatients().find(p => p.name.toLowerCase().trim() === parsed.patientName.toLowerCase().trim());
                              if (matched) {
                                setDispatchPatientPhone(matched.phone);
                                setDispatchPatientAge(matched.age.toString());
                                setDispatchPatientGender(matched.gender);
                                setDispatchOcrLogs(prev => [
                                  ...prev,
                                  `[${new Date().toLocaleTimeString()}] MATCH FOUND: Linked to patient ${matched.name} (+91 ${matched.phone})`
                                ]);
                              } else {
                                setDispatchPatientPhone('');
                                setDispatchOcrLogs(prev => [
                                  ...prev,
                                  `[${new Date().toLocaleTimeString()}] NO MATCH: New profile will be automatically synced.`
                                ]);
                              }

                              // Pre-fill test ordered
                              if (parsed.diagnosticTests && parsed.diagnosticTests.length > 0) {
                                const matchedTest = MASTER_TEST_CATALOG.find(t => 
                                  t.name.toLowerCase().includes(parsed.diagnosticTests[0].name.toLowerCase()) ||
                                  t.loincCode === parsed.diagnosticTests[0].loincCode
                                );
                                if (matchedTest) {
                                  setDispatchSelectedTestCode(matchedTest.loincCode);
                                  setDispatchOcrLogs(prev => [
                                    ...prev,
                                    `[${new Date().toLocaleTimeString()}] Test order matched: ${matchedTest.name}`
                                  ]);
                                } else {
                                  setDispatchSelectedTestCode(MASTER_TEST_CATALOG[0].loincCode);
                                }
                              } else {
                                setDispatchSelectedTestCode(MASTER_TEST_CATALOG[0].loincCode);
                              }
                              
                              setDispatchOcrLogs(prev => [
                                ...prev,
                                `[${new Date().toLocaleTimeString()}] [SUCCESS] AI extraction complete. Ready to dispatch.`
                              ]);
                            } catch (err: any) {
                              setDispatchOcrLogs(prev => [
                                ...prev,
                                `[ERROR] Extraction failed: ${err?.message || err}`
                              ]);
                            } finally {
                              setIsDispatchOcrParsing(false);
                            }
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>

                    {dispatchPreviewUrl && (
                      <div className="w-20 h-20 rounded-xl border border-slate-200 overflow-hidden relative group shrink-0 shadow-sm">
                        <img src={dispatchPreviewUrl} alt="Prescription Thumbnail" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => setViewingDocUrl(dispatchPreviewUrl)}
                          className="absolute inset-0 bg-slate-800/60 flex items-center justify-center text-[10px] text-slate-800 opacity-0 group-hover:opacity-100 transition-opacity font-bold"
                        >
                          View Rx
                        </button>
                      </div>
                    )}
                  </div>

                  {/* OCR Logging Panel */}
                  {dispatchOcrLogs.length > 0 && (
                    <div className="bg-white border border-slate-950 rounded-xl p-3 font-mono text-[9px] text-indigo-300 space-y-1 max-h-[85px] overflow-y-auto shadow-inner">
                      {dispatchOcrLogs.map((log, index) => (
                        <div key={index} className={log.includes('[ERROR]') ? 'text-rose-400 font-bold' : log.includes('[SUCCESS]') ? 'text-emerald-400 font-bold' : ''}>
                          {log}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Form fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Patient Name</label>
                      <input 
                        type="text" 
                        placeholder="Enter patient name"
                        value={dispatchPatientName}
                        onChange={(e) => setDispatchPatientName(e.target.value)}
                        className="w-full input-field text-xs py-1.5 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg focus:bg-white transition-colors"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Phone (+91)</label>
                      <input 
                        type="text" 
                        maxLength={10}
                        placeholder="10-digit number"
                        value={dispatchPatientPhone}
                        onChange={(e) => setDispatchPatientPhone(e.target.value.replace(/\D/g, ''))}
                        className="w-full input-field text-xs py-1.5 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg focus:bg-white transition-colors"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Age</label>
                      <input 
                        type="number" 
                        placeholder="Age"
                        value={dispatchPatientAge}
                        onChange={(e) => setDispatchPatientAge(e.target.value)}
                        className="w-full input-field text-xs py-1.5 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg focus:bg-white transition-colors"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Gender</label>
                      <select 
                        value={dispatchPatientGender}
                        onChange={(e) => setDispatchPatientGender(e.target.value as any)}
                        className="w-full input-field text-xs py-1.5 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg cursor-pointer focus:bg-white transition-colors"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Lab Test Ordered</label>
                    <select 
                      value={dispatchSelectedTestCode}
                      onChange={(e) => setDispatchSelectedTestCode(e.target.value)}
                      className="w-full input-field text-xs py-1.5 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg cursor-pointer focus:bg-white transition-colors"
                      required
                    >
                      <option value="" disabled>-- Select Lab Test --</option>
                      {MASTER_TEST_CATALOG.map(t => (
                        <option key={t.loincCode} value={t.loincCode}>{t.name} (₹{t.price})</option>
                      ))}
                    </select>
                  </div>

                  {/* Dynamic Price & Discount Selection */}
                  {dispatchSelectedTestCode && (() => {
                    const test = MASTER_TEST_CATALOG.find(t => t.loincCode === dispatchSelectedTestCode);
                    if (test) {
                      const testPrice = test.price || 350;
                      const finalPrice = testPrice * (1 - labDiscountPercent / 100);

                      return (
                        <div className="space-y-4 pt-2">
                          {/* Discount Selectors: 0, 5, 10, 15 */}
                          <div className="space-y-1.5 select-none">
                            <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono block">Apply Pathology Discount</label>
                            <div className="flex gap-1.5">
                              {[0, 5, 10, 15].map(disc => (
                                <button
                                  key={disc}
                                  type="button"
                                  onClick={() => setLabDiscountPercent(disc)}
                                  className={`flex-1 py-2 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                                    labDiscountPercent === disc
                                      ? 'bg-indigo-600 text-slate-800 border-indigo-700 shadow-md shadow-indigo-600/10'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  {disc === 0 ? 'No Disc' : `${disc}% OFF`}
                                </button>
                              ))}
                              <div className="w-16">
                                <input
                                  type="number"
                                  placeholder="Custom %"
                                  min={0}
                                  max={100}
                                  value={labDiscountPercent > 15 || (labDiscountPercent !== 0 && labDiscountPercent !== 5 && labDiscountPercent !== 10 && labDiscountPercent !== 15) ? labDiscountPercent : ''}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? 0 : Math.min(100, Math.max(0, Number(e.target.value)));
                                    setLabDiscountPercent(val);
                                  }}
                                  className="w-full input-field text-[10px] py-1.5 px-2 bg-white border-slate-200 text-slate-800 rounded-lg text-center"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Invoice Breakdown */}
                          <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl space-y-2 text-xs select-none">
                            <div className="flex justify-between items-center text-slate-600">
                              <span>Test Name:</span>
                              <span className="font-bold text-slate-800">{test.name}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-650">
                              <span>LOINC Code:</span>
                              <span className="font-mono bg-slate-200/60 px-1.5 py-0.2 rounded text-[10px] text-slate-700 font-bold">{test.loincCode}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-600">
                              <span>Standard Fee:</span>
                              <span className="font-semibold text-slate-850">₹{testPrice.toFixed(2)}</span>
                            </div>
                            {labDiscountPercent > 0 && (
                              <div className="flex justify-between items-center text-emerald-650 font-bold">
                                <span>Discount ({labDiscountPercent}%):</span>
                                <span>-₹{(testPrice * labDiscountPercent / 100).toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between items-center border-t border-slate-200/80 pt-2 text-sm font-bold text-slate-800">
                              <span>Total Lab Fee Payable:</span>
                              <span className="text-indigo-600">₹{finalPrice.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Payment Mode (Lab Fee Collection)</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'cash', label: 'Cash', icon: 'payments' },
                        { id: 'upi', label: 'UPI QR', icon: 'qr_code_2' },
                        { id: 'whatsapp_pay', label: 'WhatsApp Pay', icon: 'send_to_mobile' }
                      ].map(mode => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setLabPaymentMode(mode.id as any)}
                          className={`py-2 text-[10px] font-bold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                            labPaymentMode === mode.id
                              ? 'bg-indigo-600 text-slate-800 border-indigo-700 shadow-md shadow-indigo-600/10'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">{mode.icon}</span>
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button 
                    type="button"
                    disabled={isDispatchOcrParsing || isDispatchingToLab || !dispatchFile || !dispatchPatientName || !dispatchPatientPhone || !dispatchSelectedTestCode}
                    onClick={async () => {
                      if (!dispatchFile) return;
                      setIsDispatchingToLab(true);
                      try {
                        const testItem = MASTER_TEST_CATALOG.find(t => t.loincCode === dispatchSelectedTestCode);
                        const testPrice = testItem?.price || 350;
                        const finalPrice = testPrice * (1 - labDiscountPercent / 100);

                        let patientId = '';
                        const matchedPatient = api.getPatients().find(p => p.name.toLowerCase().trim() === dispatchPatientName.toLowerCase().trim() || p.phone === dispatchPatientPhone);
                        if (matchedPatient) {
                          patientId = matchedPatient.id;
                        } else {
                          const reg = api.registerPatient({
                            name: dispatchPatientName,
                            phone: dispatchPatientPhone || '9876543210',
                            age: Number(dispatchPatientAge) || 30,
                            gender: dispatchPatientGender,
                            allergies: [],
                            chronicConditions: []
                          });
                          patientId = reg.id;
                          setPatients(api.getPatients());
                        }

                        // Create paid invoice record in system
                        const invoiceId = `inv-lab-${Date.now()}`;
                        api.saveInvoice({
                          id: invoiceId,
                          appointmentId: `lab-pos-${Date.now()}`,
                          type: 'lab',
                          amount: finalPrice,
                          status: 'paid',
                          createdAt: new Date().toISOString()
                        });

                        const fileUrl = await api.uploadPrescriptionToStorage(dispatchFile, patientId);
                        const testName = testItem?.name || 'Lab Test';
                        
                        // Push to Lab technician queue
                        api.createLabRequisitionFromPrescription(patientId, dispatchSelectedTestCode, testName, fileUrl);

                         // Dispatch receipt message to patient's WhatsApp
                        let session = sessions.find(s => s.patientPhone === dispatchPatientPhone);
                        if (!session) {
                          session = api.initiateWhatsAppSession(dispatchPatientPhone);
                        }

                        const payModeLabel = labPaymentMode === 'cash' ? 'Cash at Counter' : labPaymentMode === 'upi' ? 'UPI Dynamic QR' : 'WhatsApp Pay Link';
                        const receiptMsg = `🧪 *MEDIFLOW PATHOLOGY LAB RECEIPT*\n----------------------------------------\nPatient Name: *${dispatchPatientName}*\nPhone: *+91 ${dispatchPatientPhone}*\nTest ordered: *${testName}* (LOINC: ${dispatchSelectedTestCode})\n\nOriginal Price: *₹${testPrice.toFixed(2)}*\nDiscount Applied: *${labDiscountPercent}%*\nTotal Paid: *₹${finalPrice.toFixed(2)}* (via ${payModeLabel})\nStatus: *PAID & routed to Pathology Lab*\n\n💳 Pay securely via mock UPI link below:\nupi://pay?pa=mediflow@icici&pn=Mediflow&am=${finalPrice.toFixed(2)}&cu=INR&tn=MF-LAB-${invoiceId.substring(4, 8)}\n----------------------------------------\nThank you! Mediflow Pathology. 🟢`;
                        
                        api.pushWhatsAppMessageFromBot(dispatchPatientPhone, receiptMsg);

                        const updatedSessions = api.getWhatsAppSessions();
                        const updatedSession = updatedSessions.find(s => s.patientPhone === dispatchPatientPhone) || session;

                        api.updateWhatsAppState(dispatchPatientPhone, 'COMPLETED', {
                          chatHistory: updatedSession.sessionData.chatHistory || []
                        });

                        const finalPat = api.getPatients().find(p => p.id === patientId) || { id: patientId, name: dispatchPatientName, phone: dispatchPatientPhone, age: Number(dispatchPatientAge), gender: dispatchPatientGender };
                        handleInitiateWhatsAppLoop(finalPat as Patient);

                        window.dispatchEvent(new CustomEvent('mediflow-toast', {
                          detail: {
                            message: `Lab Fee of ₹${finalPrice.toFixed(2)} collected. Requisition dispatched & WhatsApp invoice pushed!`,
                            type: 'success',
                            title: 'Lab Dispatch Success'
                          }
                        }));

                        // Reset form
                        setDispatchFile(null);
                        setDispatchPreviewUrl('');
                        setDispatchPatientName('');
                        setDispatchPatientAge('');
                        setDispatchPatientGender('Male');
                        setDispatchPatientPhone('');
                        setDispatchSelectedTestCode('');
                        setDispatchOcrLogs([]);
                        setLabDiscountPercent(0);
                      } catch (err: any) {
                        alert(`Error dispatching to lab: ${err.message || err}`);
                      } finally {
                        setIsDispatchingToLab(false);
                      }
                    }}
                    className={`w-full py-2.5 text-slate-800 font-bold rounded-lg uppercase tracking-wider text-[10px] cursor-pointer flex items-center justify-center gap-1.5 transition-all ${
                      isDispatchingToLab || isDispatchOcrParsing || !dispatchFile || !dispatchPatientName || !dispatchPatientPhone || !dispatchSelectedTestCode
                        ? 'bg-slate-400 cursor-not-allowed opacity-50'
                        : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 shadow-md shadow-indigo-600/10'
                    }`}
                  >
                    {isDispatchingToLab ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Settle Payment &amp; Dispatch to Lab...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[14px]">payments</span>
                        Settle Fees &amp; Send to Lab Queue →
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Existing Invoicing Chambers queue */}
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden bg-white text-slate-800">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-600 opacity-60" />
                
                <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600 text-base">receipt_long</span>
                  Gate 2: Active Chamber Billing &amp; Invoicing
                </h2>
                
                <div className="space-y-6">
                  {api.getAppointments().filter(a => a.status === 'ready_for_consult' || a.status === 'completed').length === 0 ? (
                    <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                      No active consultation chambers matching Gate 2 bounds.
                    </div>
                  ) : (
                    api.getAppointments().filter(a => a.status === 'ready_for_consult' || a.status === 'completed').sort((a, b) => {
                      const isPatA = a.patientId === activePatient?.id;
                      const isPatB = b.patientId === activePatient?.id;
                      if (isPatA && !isPatB) return -1;
                      if (!isPatA && isPatB) return 1;
                      return 0;
                    }).map(appt => {
                      const patient = patients.find(p => p.id === appt.patientId);
                      const prescription = api.getPrescriptions().find(p => p.appointmentId === appt.id);
                      const labInvoice = api.getInvoices().find(i => i.appointmentId === appt.id && i.type === 'lab');
                      const isActiveAppt = appt.patientId === activePatient?.id;
                      
                      return (
                        <div 
                          key={appt.id} 
                          className={`p-4 border rounded-xl space-y-4 transition-all duration-350 ${
                            isActiveAppt 
                              ? 'border-indigo-500 bg-indigo-500/5 shadow-md shadow-indigo-500/5' 
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div>
                              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                {isActiveAppt && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping shrink-0" />}
                                {patient ? patient.name : 'Unknown Patient'}
                              </h4>
                              <p className="text-[9px] text-slate-400 font-mono">Appt ID: {appt.id.substring(0, 8)}... | Status: {appt.status}</p>
                            </div>
                            <span className="text-[9px] bg-indigo-100 text-indigo-750 font-mono font-bold px-2 py-0.5 rounded border border-indigo-200">
                              CHAMBER OUT
                            </span>
                          </div>

                          {!prescription ? (
                            <div className="space-y-3">
                              <p className="text-[10px] text-slate-500">Upload or scan the doctor's handwritten/printed prescription to run AI OCR and auto-generate invoices.</p>
                              
                              {/* Handwritten Rx Scanner Alert */}
                              <div className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-start gap-2">
                                <span className="material-symbols-outlined text-indigo-650 text-sm mt-0.5">info</span>
                                <div className="text-[10px] text-indigo-900 leading-relaxed text-left">
                                  <span className="font-bold">Handwritten Rx Workflow:</span> Capture/upload the doctor's paper prescription here. The AI will extract the parameters and populate the lab/medicine queues automatically.
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <label className="flex-1 flex flex-col items-center justify-center gap-2 border border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-4 bg-slate-50 text-center cursor-pointer text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors shadow-sm hover:shadow-md">
                                  <Upload className="h-5 w-5 text-indigo-600" />
                                  <span>Upload / Scan Prescription</span>
                                  <span className="text-[9px] text-slate-600 font-medium">Supports JPEG, PNG, and PDF</span>
                                  <input 
                                    type="file" 
                                    accept="image/*,application/pdf" 
                                    className="hidden" 
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        setOcrScanningApptId(appt.id);
                                        const reader = new FileReader();
                                        reader.onload = () => {
                                          const base64Url = reader.result as string;
                                          api.runSaaSPrescriptionOCR(appt.id, base64Url).then(() => {
                                            setOcrScanningApptId(null);
                                            window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                              detail: {
                                                message: 'AI OCR parsed prescription: Loaded tests and medicine invoices!',
                                                type: 'success',
                                                title: 'Prescription Parsed'
                                              }
                                            }));
                                          });
                                        };
                                        reader.readAsDataURL(file);
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="bg-slate-50 border border-slate-150 p-3 rounded-lg space-y-2">
                                <span className="block text-[8px] font-black text-slate-600 tracking-widest uppercase font-mono">Extracted Lab Tests (AI OCR)</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {prescription.extractedTests?.map((t, idx) => (
                                    <span key={idx} className="bg-indigo-500/10 text-indigo-700 border border-indigo-500/20 text-[9px] font-semibold px-2 py-0.5 rounded">
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="bg-slate-50 border border-slate-150 p-3 rounded-lg flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[8px] font-black text-slate-600 tracking-widest uppercase font-mono">Prescription Document</span>
                                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded font-mono uppercase tracking-wider ${
                                    prescription.prescriptionFileUrl 
                                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
                                      : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                  }`}>
                                    {prescription.prescriptionFileUrl ? 'Attached & Sent to Lab' : 'No Document Attached'}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {prescription.prescriptionFileUrl && (
                                    <button
                                      type="button"
                                      onClick={() => setViewingDocUrl(prescription.prescriptionFileUrl || null)}
                                      className="flex-1 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-[10px] font-bold rounded-lg border border-slate-200 cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1 shadow-sm"
                                    >
                                      View Original Rx
                                    </button>
                                  )}
                                  <label className="flex-1 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg border border-indigo-200 cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1 text-center font-sans">
                                    {prescription.prescriptionFileUrl ? 'Re-upload / Change' : 'Upload Rx Doc'}
                                    <input 
                                      type="file" 
                                      accept="image/*,application/pdf" 
                                      className="hidden" 
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          setOcrScanningApptId(appt.id);
                                          const reader = new FileReader();
                                          reader.onload = () => {
                                            const base64Url = reader.result as string;
                                            api.runSaaSPrescriptionOCR(appt.id, base64Url).then(() => {
                                              setOcrScanningApptId(null);
                                              window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                                detail: {
                                                  message: 'Prescription document updated successfully!',
                                                  type: 'success',
                                                  title: 'Prescription Updated'
                                                }
                                              }));
                                            });
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                              </div>

                              {labInvoice && (
                                <div className="flex items-center justify-between pt-1">
                                  <div>
                                    <span className="text-[9px] text-slate-600 block font-mono">Lab Invoice: {labInvoice.id.substring(0, 8)}...</span>
                                    <span className="text-[12px] font-black text-slate-800">Lab Total: ₹{labInvoice.amount}</span>
                                  </div>
                                  <div>
                                    {labInvoice.status === 'unpaid' ? (
                                      <button
                                        onClick={() => {
                                          api.settleSaaSInvoice(labInvoice.id);
                                          window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                            detail: {
                                              message: 'Lab invoice marked as PAID. Requisitions pushed to Lab Technician.',
                                              type: 'success',
                                              title: 'Lab Fee Settled'
                                            }
                                          }));
                                        }}
                                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-800 font-bold rounded-lg uppercase tracking-wider text-[9px] cursor-pointer"
                                      >
                                        Mark Paid &amp; Route to Lab Tech
                                      </button>
                                    ) : (
                                      <span className="text-[9px] bg-emerald-500/10 text-emerald-600 font-mono font-bold px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest">
                                        PAID &amp; SENT TO LAB ✅
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {ocrScanningApptId === appt.id && (
                            <div className="p-3 bg-indigo-500/5 border border-indigo-500/15 rounded-lg flex items-center gap-2.5 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-550 animate-ping" />
                              <span className="text-[10px] text-indigo-600 font-mono font-semibold">Running LLM-OCR scanning on prescription...</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              {/* Completed Lab Reports Approval Panel */}
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden bg-white text-slate-800">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-emerald-500 opacity-60" />
                <h2 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-base">verified_user</span>
                  ✅ Completed Lab Reports
                </h2>
                <p className="text-xs text-slate-500 mb-4">
                  Review and clinically approve completed lab reports, then lock the patient's next revisit consultation timing.
                </p>

                {/* Tab toggle */}
                <div className="flex gap-2 mb-4 bg-slate-100 p-1 rounded-lg">
                  <button 
                    onClick={() => setReportFilterTab('pending')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      reportFilterTab === 'pending' ? 'bg-white text-slate-850 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Awaiting Approval ({fullLabReports.filter(r => r.status === 'pending').length})
                  </button>
                  <button 
                    onClick={() => setReportFilterTab('approved')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      reportFilterTab === 'approved' ? 'bg-white text-slate-850 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Approved Reports ({fullLabReports.filter(r => r.status === 'approved').length})
                  </button>
                </div>

                <div className="space-y-4">
                  {reportFilterTab === 'pending' && (
                    fullLabReports.filter(r => r.status === 'pending').length === 0 ? (
                      <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                        No reports awaiting approval.
                      </div>
                    ) : (
                      fullLabReports.filter(r => r.status === 'pending').map(report => {
                        const biomarkers = report.biomarkerJson?.biomarkers || {};
                        const reportId = report.id;
                        
                        return (
                          <div key={report.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-3 shadow-sm">
                            <div className="flex items-center justify-between border-b border-slate-150 pb-2">
                              <div>
                                <h4 className="font-bold text-slate-800 text-xs">{report.patientName}</h4>
                                <p className="text-[9px] text-slate-600 font-mono">Report ID: {report.id.substring(0, 8)}...</p>
                              </div>
                              <span className="text-[9px] bg-amber-100 text-amber-800 font-mono font-bold px-2 py-0.5 rounded border border-amber-200 uppercase">
                                Pending
                              </span>
                            </div>

                            <div className="space-y-1">
                              <span className="block text-[8px] font-black text-slate-600 tracking-widest uppercase font-mono">Results &amp; Biomarkers</span>
                              <div className="flex flex-wrap gap-1.5">
                                {Object.keys(biomarkers).filter(k => !k.endsWith('_unit')).map(key => {
                                  const val = biomarkers[key];
                                  const unit = biomarkers[`${key}_unit`] || biomarkers.unit || '';
                                  return (
                                    <span key={key} className="bg-indigo-50 border border-indigo-150 text-indigo-750 text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                                      {key}: {val} {unit}
                                    </span>
                                  );
                                })}
                                {Object.keys(biomarkers).length === 0 && (
                                  <span className="text-[10px] text-slate-500 italic">No structured values found</span>
                                )}
                              </div>
                            </div>

                            {report.reportFileUrl && (
                              <button
                                type="button"
                                onClick={() => setViewingDocUrl(report.reportFileUrl || null)}
                                className="w-full py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-[10px] font-bold rounded-lg border border-slate-200 cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                              >
                                <span className="material-symbols-outlined text-[12px]">picture_as_pdf</span>
                                View Report Document (PDF/Image)
                              </button>
                            )}

                            {/* Revisit Scheduler inside report card */}
                            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
                              <span className="block text-[8px] font-black text-slate-600 tracking-widest uppercase font-mono">Schedule Revisit for Doctor's Final Advice</span>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="text-[8px] text-slate-600 font-bold uppercase tracking-wider font-mono">Date</label>
                                  <div className="flex gap-1">
                                    <input 
                                      type="date"
                                      value={reportRevisitDates[reportId] || ''}
                                      onChange={(e) => setReportRevisitDates(prev => ({ ...prev, [reportId]: e.target.value }))}
                                      className="w-full input-field text-[11px] py-1 px-2 bg-slate-50 border-slate-200 text-slate-800 rounded-md focus:bg-white"
                                    />
                                    <button
                                      type="button"
                                      title="AI Calculate Advice Revisit"
                                      onClick={async () => {
                                        try {
                                          const patient = api.getPatients().find(p => p.id === report.patientId);
                                          if (!patient) return;
                                          const history = api.getPatientHistoricalBiomarkers(report.patientId);
                                          const latestReport = history[history.length - 1];
                                          const current_data = latestReport ? {
                                            age: patient.age.toString(),
                                            gender: patient.gender,
                                            HbA1c: latestReport.HbA1c,
                                            creatinine: latestReport.creatinine,
                                            hemoglobin: latestReport.hemoglobin
                                          } : {
                                            age: patient.age.toString(),
                                            gender: patient.gender,
                                            HbA1c: 7.2,
                                            creatinine: 1.1,
                                            hemoglobin: 14.0
                                          };
                                          
                                          const trendResult = await api.labTrend({ current_data });
                                          
                                          // Default to same day (today) evening according to token number
                                          const dateString = new Date().toISOString().split('T')[0];
                                          const tokenStr = patient.tokenNumber || '1';
                                          const tokenNum = parseInt(tokenStr.replace(/\D/g, '')) || 1;
                                          const totalMinutes = 16 * 60 + (tokenNum - 1) * 10; // 4:00 PM start, 10 min per token
                                          const hours = Math.floor(totalMinutes / 60);
                                          const minutes = totalMinutes % 60;
                                          const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                                          
                                          setReportRevisitDates(prev => ({ ...prev, [reportId]: dateString }));
                                          setReportRevisitTimes(prev => ({ ...prev, [reportId]: timeString }));
                                          setReportRevisitNotes(prev => ({ ...prev, [reportId]: `Same-day evening final advice (Token #${tokenNum}). ${trendResult.trajectory ? `Report trajectory is ${trendResult.trajectory}.` : ''}` }));
                                          
                                          window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                            detail: {
                                              message: `AI scheduled final advice session for today evening at ${timeString} based on token #${tokenNum}!`,
                                              type: 'success',
                                              title: 'AI Advice Revisit Calculated'
                                            }
                                          }));
                                        } catch (err) {
                                          console.error('[AI Revisit error]:', err);
                                        }
                                      }}
                                      className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-md text-[9px] cursor-pointer flex items-center justify-center shrink-0 border-0 text-white-force"
                                    >
                                      🤖 AI
                                    </button>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[8px] text-slate-600 font-bold uppercase tracking-wider font-mono">Time</label>
                                  <input 
                                    type="time"
                                    value={reportRevisitTimes[reportId] || ''}
                                    onChange={(e) => setReportRevisitTimes(prev => ({ ...prev, [reportId]: e.target.value }))}
                                    className="w-full input-field text-[11px] py-1 px-2 bg-slate-50 border-slate-200 text-slate-800 rounded-md focus:bg-white"
                                  />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] text-slate-600 font-bold uppercase tracking-wider font-mono">Clinical Note / Recommendation</label>
                                <input 
                                  type="text"
                                  placeholder="e.g. Return for HbA1c review"
                                  value={reportRevisitNotes[reportId] || ''}
                                  onChange={(e) => setReportRevisitNotes(prev => ({ ...prev, [reportId]: e.target.value }))}
                                  className="w-full input-field text-[11px] py-1 px-2 bg-slate-50 border-slate-200 text-slate-800 rounded-md focus:bg-white"
                                />
                              </div>
                            </div>

                            {showRejectModalForId === report.id ? (
                              <div className="mt-3 p-3 bg-rose-50 border border-rose-205 rounded-xl space-y-2">
                                <label className="text-[9px] text-rose-700 font-bold uppercase tracking-wider font-mono">Rejection Reason</label>
                                <textarea 
                                  placeholder="Why are you rejecting this report?"
                                  value={rejectionReasons[report.id] || ''}
                                  onChange={(e) => setRejectionReasons(prev => ({ ...prev, [report.id]: e.target.value }))}
                                  className="w-full input-field text-xs py-1.5 px-3 bg-white border-rose-200 text-slate-850 rounded-lg focus:border-rose-400"
                                  rows={2}
                                  required
                                />
                                <div className="flex gap-2 justify-end">
                                  <button 
                                    onClick={() => setShowRejectModalForId(null)}
                                    className="px-2.5 py-1 text-slate-600 bg-slate-100 hover:bg-slate-200 text-[10px] font-bold rounded-lg cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button 
                                    disabled={!(rejectionReasons[report.id] || '').trim()}
                                    onClick={async () => {
                                      await api.rejectLabReport(report.id, rejectionReasons[report.id]);
                                      setShowRejectModalForId(null);
                                    }}
                                    className="px-2.5 py-1 text-slate-800 bg-rose-600 hover:bg-rose-500 text-[10px] font-bold rounded-lg cursor-pointer disabled:opacity-50"
                                  >
                                    Send back to Lab
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2 pt-1">
                                <button 
                                  onClick={async () => {
                                    const date = reportRevisitDates[reportId] || '';
                                    const time = reportRevisitTimes[reportId] || '';
                                    const note = reportRevisitNotes[reportId] || '';
                                    await api.approveLabReport(reportId, date, time, note);
                                  }}
                                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-800 font-bold rounded-lg text-[10px] uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-[12px]">check_circle</span>
                                  Approve &amp; Revisit
                                </button>
                                <button 
                                  onClick={() => setShowRejectModalForId(report.id)}
                                  className="py-1.5 px-3 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold rounded-lg text-[10px] uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )
                  )}

                  {reportFilterTab === 'approved' && (
                    fullLabReports.filter(r => r.status === 'approved').length === 0 ? (
                      <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                        No approved reports found.
                      </div>
                    ) : (
                      fullLabReports.filter(r => r.status === 'approved').map(report => {
                        const biomarkers = report.biomarkerJson?.biomarkers || {};
                        return (
                          <div key={report.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-3 shadow-sm">
                            <div className="flex items-center justify-between border-b border-slate-150 pb-2">
                              <div>
                                <h4 className="font-bold text-slate-800 text-xs">{report.patientName}</h4>
                                <p className="text-[9px] text-slate-600 font-mono">Report ID: {report.id.substring(0, 8)}...</p>
                              </div>
                              <span className="text-[9px] bg-emerald-500/10 text-emerald-600 font-mono font-bold px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest">
                                Approved
                              </span>
                            </div>

                            <div className="space-y-1">
                              <span className="block text-[8px] font-black text-slate-600 tracking-widest uppercase font-mono">Results &amp; Biomarkers</span>
                              <div className="flex flex-wrap gap-1.5">
                                {Object.keys(biomarkers).filter(k => !k.endsWith('_unit')).map(key => {
                                  const val = biomarkers[key];
                                  const unit = biomarkers[`${key}_unit`] || biomarkers.unit || '';
                                  return (
                                    <span key={key} className="bg-indigo-50 border border-indigo-150 text-indigo-750 text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                                      {key}: {val} {unit}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                            {report.reportFileUrl && (
                              <button
                                type="button"
                                onClick={() => setViewingDocUrl(report.reportFileUrl || null)}
                                className="w-full py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-[10px] font-bold rounded-lg border border-slate-200 cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                              >
                                <span className="material-symbols-outlined text-[12px]">picture_as_pdf</span>
                                View Approved Report Document
                              </button>
                            )}

                            {report.revisitScheduledAt && (
                              <div className="p-2.5 bg-emerald-50 border border-emerald-150 rounded-lg text-[10px] text-emerald-800">
                                <strong>Advice Revisit Locked:</strong> {new Date(report.revisitScheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                {report.revisitNote && <p className="mt-1 text-slate-650 font-medium">Note: {report.revisitNote}</p>}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )
                  )}
                </div>
              </div>

              {/* Doctor's Final Advice Appointment Desk (Manual Book) */}
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden bg-white text-slate-800">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-rose-500 opacity-60" />
                <h2 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-600 text-base">calendar_month</span>
                  Doctor's Final Advice Appointment Desk (Manual Book)
                </h2>
                <p className="text-xs text-slate-500 mb-4">
                  Manually schedule final advice appointments for patients without any linked lab reports.
                </p>

                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!revisitPatientId || !revisitDate || !revisitTime) {
                      alert('Please select patient and fill out date/time');
                      return;
                    }
                    const p = patients.find(pat => pat.id === revisitPatientId);
                    if (p) {
                      const msg = `📅 *Mediflow Revisit Lock!* 🏥\n\n` +
                        `Hello *${p.name}*, aapka doctor se milkar *final advice* lene ka appointment lock ho gaya hai:\n` +
                        `📅 *${revisitDate}* at *${revisitTime}*.\n\n` +
                        `Time par clinic aakar doctor se final advice lein. Dhyan rakhein! 🟢`;
                      api.pushWhatsAppMessageFromBot(p.phone, msg);
                      window.dispatchEvent(new CustomEvent('mediflow-toast', {
                        detail: {
                          message: `Advice appointment locked on WhatsApp for ${p.name}!`,
                          type: 'success',
                          title: 'Appointment Booked'
                        }
                      }));
                      setRevisitPatientId('');
                      setRevisitDate('');
                      setRevisitTime('');
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Patient</label>
                    <select
                      value={revisitPatientId}
                      onChange={(e) => {
                        const patId = e.target.value;
                        setRevisitPatientId(patId);
                        const pat = patients.find(p => p.id === patId);
                        if (pat) {
                          setRevisitDate(new Date().toISOString().split('T')[0]);
                          const tokenNum = parseInt((pat.tokenNumber || '1').replace(/\D/g, '')) || 1;
                          const totalMinutes = 16 * 60 + (tokenNum - 1) * 10; // 4:00 PM start, 10 min per token
                          const hours = Math.floor(totalMinutes / 60);
                          const minutes = totalMinutes % 60;
                          setRevisitTime(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
                        }
                      }}
                      className="w-full input-field text-xs py-2 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg cursor-pointer focus:bg-white"
                      required
                    >
                      <option value="" disabled>-- Select Patient --</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (+91 {p.phone})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Date</label>
                      <input 
                        type="date"
                        value={revisitDate}
                        onChange={(e) => setRevisitDate(e.target.value)}
                        className="w-full input-field text-xs py-2 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg cursor-pointer focus:bg-white"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Time</label>
                      <input 
                        type="time"
                        value={revisitTime}
                        onChange={(e) => setRevisitTime(e.target.value)}
                        className="w-full input-field text-xs py-2 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg cursor-pointer focus:bg-white"
                        required
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-slate-800 font-bold rounded-lg uppercase tracking-wider text-[10px] cursor-pointer"
                  >
                    Lock Advice Appointment &amp; Dispatch Bot Notification
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: GATE 3 PHARMACY BILLING */}
        {activeTab === 'pharmacy' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: AI Prescription Scan & POS Billing Workspace */}
            <div className="lg:col-span-7 space-y-6">
              <div className="glass-panel p-6 border-slate-200 shadow-xl relative overflow-hidden bg-white text-slate-800">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-amber-500 opacity-60" />
                
                <h2 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500 text-base">receipt_long</span>
                  📄 AI Prescription Scanner &amp; POS Workspace
                </h2>
                <p className="text-xs text-slate-500 mb-4">
                  Scan prescription, extract patient profile and medicines via AI, sync with inventory prices, apply discounts, and dispatch WhatsApp invoices and dosage slips.
                </p>

                {/* Prescription File Upload Zone */}
                <div className="space-y-4">
                  <div className="flex gap-4 items-start">
                    <label className="flex-1 flex flex-col items-center justify-center gap-2 border border-dashed border-slate-350 hover:border-amber-400 rounded-2xl p-4 bg-slate-50 text-center cursor-pointer text-xs font-semibold text-slate-700 hover:text-slate-900 transition-all shadow-sm hover:shadow-md">
                      <Upload className="h-5 w-5 text-amber-500" />
                      <span>{prescriptionImage ? 'Change Prescription File' : 'Upload / Scan Prescription Image/PDF'}</span>
                      <input 
                        type="file" 
                        accept="image/*,application/pdf" 
                        className="hidden" 
                        onChange={handlePrescriptionImageUpload}
                      />
                    </label>

                    {prescriptionImage && (
                      <div className="w-20 h-20 rounded-xl border border-slate-200 overflow-hidden relative group shrink-0 shadow-sm">
                        <img src={prescriptionImage} alt="Prescription Thumbnail" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => setViewingDocUrl(prescriptionImage)}
                          className="absolute inset-0 bg-slate-800/60 flex items-center justify-center text-[10px] text-slate-800 opacity-0 group-hover:opacity-100 transition-opacity font-bold"
                        >
                          View Rx
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Run OCR Button */}
                  {prescriptionImage && (
                    <button
                      type="button"
                      onClick={handleTriggerPrescriptionOcr}
                      disabled={isPrescriptionScanning}
                      className="w-full py-2 bg-amber-500 hover:bg-amber-450 text-slate-800 font-bold rounded-lg uppercase tracking-wider text-[10px] flex items-center justify-center gap-1.5 transition-all shadow-md"
                    >
                      {isPrescriptionScanning ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          AI Extracting Prescription...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[14px]">psychology</span>
                          Extract Data &amp; Sync Inventory
                        </>
                      )}
                    </button>
                  )}

                  {/* OCR Logging Panel */}
                  {ocrLogs.length > 0 && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 font-mono text-[9px] text-indigo-700 space-y-1 max-h-[85px] overflow-y-auto shadow-inner">
                      {ocrLogs.map((log, index) => (
                        <div key={index} className={log.includes('[ERROR]') ? 'text-rose-600 font-bold' : log.includes('SUCCESS') ? 'text-emerald-600 font-bold' : 'text-indigo-700'}>
                          {log}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Patient Profile Form (Editable) */}
                  <div className="border-t border-slate-100 pt-4 mt-2">
                    <span className="block text-[9px] font-black text-slate-600 tracking-widest uppercase font-mono mb-2">Patient Profile (Extracted)</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Patient Name</label>
                        <input 
                          type="text" 
                          placeholder="Name"
                          value={billingPatient?.name || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBillingPatient(prev => prev ? { ...prev, name: val } : { id: `pat-${Date.now()}`, name: val, phone: '', age: 30, gender: 'Male', allergies: [], chronicConditions: [], createdAt: new Date().toISOString() });
                          }}
                          className="w-full input-field text-xs py-1.5 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg focus:bg-white transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Phone (+91)</label>
                        <input 
                          type="text" 
                          maxLength={10}
                          placeholder="Phone number"
                          value={billingPatient?.phone || ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setBillingPatient(prev => prev ? { ...prev, phone: val } : { id: `pat-${Date.now()}`, name: '', phone: val, age: 30, gender: 'Male', allergies: [], chronicConditions: [], createdAt: new Date().toISOString() });
                          }}
                          className="w-full input-field text-xs py-1.5 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg focus:bg-white transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Age</label>
                        <input 
                          type="number" 
                          placeholder="Age"
                          value={billingPatient?.age || ''}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 30;
                            setBillingPatient(prev => prev ? { ...prev, age: val } : { id: `pat-${Date.now()}`, name: '', phone: '', age: val, gender: 'Male', allergies: [], chronicConditions: [], createdAt: new Date().toISOString() });
                          }}
                          className="w-full input-field text-xs py-1.5 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg focus:bg-white transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Gender</label>
                        <select 
                          value={billingPatient?.gender || 'Male'}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setBillingPatient(prev => prev ? { ...prev, gender: val } : { id: `pat-${Date.now()}`, name: '', phone: '', age: 30, gender: val, allergies: [], chronicConditions: [], createdAt: new Date().toISOString() });
                          }}
                          className="w-full input-field text-xs py-1.5 px-3 bg-slate-50 border-slate-200 text-slate-800 rounded-lg cursor-pointer focus:bg-white"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Medicines Workspace */}
                  {billingItems.length > 0 && (
                    <div className="border-t border-slate-100 pt-4 mt-2">
                      <span className="block text-[9px] font-black text-slate-600 tracking-widest uppercase font-mono mb-2">Sync'd Medicines from Inventory</span>
                      <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-sm mb-3">
                        {billingItems.map((item, idx) => (
                          <div key={idx} className="p-3 flex items-center justify-between text-xs gap-4 hover:bg-slate-50/50 transition-colors">
                            <div className="flex-1 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-800">{item.name}</h4>
                                <span className="text-[8px] bg-emerald-50 border border-emerald-250 text-emerald-700 font-mono font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                  Patna Live Stock Match 🟢
                                </span>
                              </div>
                              <p className="text-[9px] text-slate-650 font-mono">MRP: ₹{item.mrp} · Batch: {item.batchNumber}</p>
                              
                              {/* Bilingual Directions */}
                              {(() => {
                                const instr = getBilingualInstruction(item.name, item.dosage);
                                return (
                                  <div className="p-2 bg-indigo-50/50 rounded-lg border border-indigo-100/60 text-[10px] space-y-0.5 max-w-sm select-none">
                                    <span className="font-bold text-indigo-750 block uppercase tracking-widest text-[8px] font-mono">Dosage Directions</span>
                                    <p className="text-slate-650">🇬🇧 {instr.english}</p>
                                    <p className="text-indigo-805 font-bold">🇮🇳 {instr.hindi}</p>
                                  </div>
                                );
                              })()}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                                <button 
                                  type="button" 
                                  onClick={() => handleUpdateItemQty(idx, item.quantity - 1)}
                                  className="px-2 py-0.5 hover:bg-slate-200 text-slate-600 font-bold"
                                >-</button>
                                <span className="px-2.5 font-bold text-slate-700">{item.quantity}</span>
                                <button 
                                  type="button" 
                                  onClick={() => handleUpdateItemQty(idx, item.quantity + 1)}
                                  className="px-2 py-0.5 hover:bg-slate-200 text-slate-600 font-bold"
                                >+</button>
                              </div>
                              <span className="w-16 text-right font-mono font-bold text-slate-800">₹{item.lineTotal.toFixed(2)}</span>
                              <button 
                                type="button" 
                                onClick={() => handleRemoveBillingItem(idx)}
                                className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 p-1 rounded transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Manual search addition */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Add Medicine Manually</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Search medicines from live Patna inventory..."
                        value={medSearchQuery}
                        onChange={(e) => setMedSearchQuery(e.target.value)}
                        className="w-full input-field text-xs pl-10 py-2 bg-slate-50 border-slate-200 text-slate-800 rounded-lg focus:bg-white"
                      />
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 h-4 w-4" />
                      {medSearchQuery && billingSearchMatches.length > 0 && (
                        <div className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto border border-slate-200 bg-white rounded-xl shadow-lg z-50 divide-y divide-slate-100">
                          {billingSearchMatches.map(med => (
                            <div 
                              key={med.id}
                              onClick={() => {
                                handleSelectMedForBilling(med);
                                setMedSearchQuery('');
                              }}
                              className="p-2.5 hover:bg-indigo-50/60 cursor-pointer flex justify-between items-center text-xs"
                            >
                              <div>
                                <p className="font-bold text-slate-800">{med.name} ({med.dosage})</p>
                                <p className="text-[9px] text-slate-600 font-mono">Stock: {med.stock} | HSN: {med.hsn}</p>
                              </div>
                              <span className="font-mono font-bold text-indigo-600">₹{med.price}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Discount Selectors: 10, 15, 20 */}
                  {billingItems.length > 0 && (
                    <div className="space-y-1.5 pt-2 select-none">
                      <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Apply Coupon / Special Discount</label>
                      <div className="flex gap-2">
                        {[0, 10, 15, 20].map(disc => (
                          <button
                            key={disc}
                            type="button"
                            onClick={() => setCustomDiscountPercent(disc)}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                              customDiscountPercent === disc
                                ? 'bg-amber-500 text-slate-800 border-amber-600 shadow-md shadow-amber-500/10'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {disc === 0 ? 'No Discount' : `${disc}% OFF`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Financial Invoice Breakdown */}
                  {billingItems.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl space-y-2.5 text-xs select-none">
                      {podEntities.find(pe => pe.entityType === 'pharmacy' && pe.status === 'approved')?.gstin && (
                        <div className="flex justify-between text-[10.5px] text-slate-500 font-mono border-b border-slate-200 pb-1.5 mb-1.5">
                          <span>Pharmacy GSTIN:</span>
                          <span className="font-bold">{podEntities.find(pe => pe.entityType === 'pharmacy' && pe.status === 'approved')?.gstin}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal (Net):</span>
                        <span className="font-semibold">₹{billingTotals.subtotal.toFixed(2)}</span>
                      </div>
                      {billingTotals.loyaltyDiscountAmount > 0 && (
                        <div className="flex justify-between text-emerald-600 font-bold">
                          <span>Special Discount ({billingTotals.loyaltyDiscountPercent}%):</span>
                          <span>-₹{billingTotals.loyaltyDiscountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-600">
                        <span>GST Tax Amount:</span>
                        <span className="font-semibold">₹{billingTotals.gstAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200 pt-2.5 text-sm font-bold text-slate-800">
                        <span>Total Amount Payable:</span>
                        <span className="text-indigo-600">₹{billingTotals.totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Submit Payments Action */}
                  <button
                    type="button"
                    disabled={!billingPatient || !billingPatient.name || !billingPatient.phone || billingItems.length === 0}
                    onClick={async () => {
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
                        paymentMode: 'cash',
                        upiQrPayload: `upi://pay?pa=mediflow@icici&pn=Mediflow&am=${billingTotals.totalAmount.toFixed(2)}&cu=INR&tn=MF-BILL-${billId.substring(4, 8)}`,
                        status: 'paid',
                        source: 'counter',
                        deliveryType: 'pickup',
                        createdAt: new Date().toISOString()
                      };

                      // Register patient if new
                      const matchedPatient = api.getPatients().find(p => p.phone === billingPatient.phone || p.name.toLowerCase().trim() === billingPatient.name.toLowerCase().trim());
                      let resolvedPatientId = billingPatient.id;
                      if (!matchedPatient) {
                        const reg = api.registerPatient({
                          name: billingPatient.name,
                          phone: billingPatient.phone || '9876543210',
                          age: billingPatient.age || 30,
                          gender: billingPatient.gender || 'Male',
                          allergies: [],
                          chronicConditions: []
                        });
                        resolvedPatientId = reg.id;
                        setPatients(api.getPatients());
                      } else {
                        resolvedPatientId = matchedPatient.id;
                      }

                      api.saveMedicineBill(bill);
                      api.dispenseMedicineBill(billId);

                      // WhatsApp invoice receipt
                      let session = sessions.find(s => s.patientPhone === billingPatient.phone);
                      if (!session) {
                        session = api.initiateWhatsAppSession(billingPatient.phone);
                      }
                      const invoiceText = api.generateMedicineInvoiceMessage(bill);

                      // Vernacular dosage in Hindi/Hinglish
                      let dosageText = `📋 *दवाई की खुराक की जानकारी (Bilingual Dosage Slip)*\n\nनमस्ते, यहाँ आपकी दवाइयों की खुराक की जानकारी हिंदी/Hinglish में है:\n\n`;
                      billingItems.forEach(item => {
                        const instr = getBilingualInstruction(item.name, item.dosage);
                        
                        dosageText += `💊 *${item.name}* (${item.dosage || '1 Tab'})\n`;
                        dosageText += `👉 *Directions:* ${instr.english}\n`;
                        dosageText += `👉 *खुराक:* ${instr.hindi}\n\n`;
                      });
                      dosageText += `⚠️ *Note:* Dawa hamesha doctor ke nirdeshan anusar hi lein.`;

                      api.updateWhatsAppState(billingPatient.phone, 'COMPLETED', {
                        chatHistory: [
                          ...(session.sessionData.chatHistory || []),
                          { sender: 'bot', text: `✅ *PAYMENT RECEIVED (₹${bill.totalAmount.toFixed(2)})*\n\n${invoiceText}`, time: new Date().toISOString() },
                          { sender: 'bot', text: dosageText, time: new Date().toISOString() }
                        ],
                        draftMedicineBill: bill
                      });

                      const finalPat = api.getPatients().find(p => p.id === resolvedPatientId) || billingPatient;
                      handleInitiateWhatsAppLoop(finalPat);

                      window.dispatchEvent(new CustomEvent('mediflow-toast', {
                        detail: {
                          message: `Direct billing complete! Invoice & Hinglish dosage summary sent to WhatsApp.`,
                          type: 'success',
                          title: 'POS Settle Complete'
                        }
                      }));

                      // Reset fields
                      setBillingItems([]);
                      setBillingPatient(null);
                      setPrescriptionImage(null);
                      setOcrLogs([]);
                      setCustomDiscountPercent(0);
                      syncData();
                    }}
                    className={`w-full py-2.5 text-slate-800 font-bold rounded-lg uppercase tracking-wider text-[10px] cursor-pointer flex items-center justify-center gap-1.5 transition-all ${
                      (!billingPatient || !billingPatient.name || !billingPatient.phone || billingItems.length === 0)
                        ? 'bg-slate-400 cursor-not-allowed opacity-50'
                        : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-md shadow-indigo-600/10'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">send_to_mobile</span>
                    Settle POS &amp; Send WhatsApp Receipt →
                  </button>

                  {/* ── Allocate Evening Slot ──────────────────────────── */}
                  {billingPatient && (
                    <div className="mt-3 border border-indigo-100 rounded-xl p-3 bg-indigo-50/60 space-y-2">
                      <p className="text-[9px] font-black text-indigo-600 tracking-widest uppercase flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">event_upcoming</span>
                        Same-Day Evening Follow-up
                      </p>

                      {(eveningSlot || api.getAppointmentByPatient(billingPatient.id)) ? (
                        <div className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          Slot confirmed: {(eveningSlot || api.getAppointmentByPatient(billingPatient.id))?.startTime} – {(eveningSlot || api.getAppointmentByPatient(billingPatient.id))?.endTime}
                        </div>
                      ) : (
                        <button
                          id="btn-allocate-evening-slot"
                          type="button"
                          disabled={isAllocatingSlot}
                          onClick={async () => {
                            if (!billingPatient) return;
                            setIsAllocatingSlot(true);
                            try {
                              const slot = await api.createEveningSlot(billingPatient.id, 'doc-1');
                              if (slot) {
                                setEveningSlot(slot);
                                // Notify patient via WhatsApp
                                api.pushWhatsAppMessageFromBot(
                                  billingPatient.phone,
                                  `🕒 *Dr. Sharma ka Evening Appointment (Aaj):*\n\nAapka evening follow-up slot confirm ho gaya hai:\n*${slot.startTime} – ${slot.endTime}*\nKrupaya 5 minute pehle clinic reception par pahunchen. 🏥`
                                );
                                window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                  detail: {
                                    message: `Evening slot ${slot.startTime}–${slot.endTime} allocated & notified on WhatsApp!`,
                                    type: 'success',
                                    title: 'Evening Slot Confirmed 🕒'
                                  }
                                }));
                              } else {
                                window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                  detail: { message: 'No evening slots available today (5 PM–8 PM full). Ask patient to call tomorrow.', type: 'warning', title: 'Slots Full' }
                                }));
                              }
                            } catch (err) {
                              console.error('[EveningSlot] Allocation error:', err);
                            } finally {
                              setIsAllocatingSlot(false);
                            }
                          }}
                          className={`w-full py-2 text-[10px] font-bold rounded-lg uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                            isAllocatingSlot
                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              : 'bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 active:scale-95 shadow-sm'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          {isAllocatingSlot ? 'Allocating…' : 'Allocate Evening Slot for Patient'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Active Pharmacy Invoices Queue (consultation splits) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="glass-panel p-6 border-slate-200 shadow-xl relative overflow-hidden bg-white text-slate-800">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-600 opacity-60" />
                
                <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600 text-base">hourglass_empty</span>
                  ⏳ Chamber Invoices Queue
                </h2>
                
                <div className="space-y-4">
                  {api.getInvoices().filter(i => i.type === 'pharmacy').length === 0 ? (
                    <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                      No active pharmacy invoices found.
                    </div>
                  ) : (
                    api.getInvoices().filter(i => i.type === 'pharmacy').sort((a, b) => {
                      const apptA = api.getAppointments().find(x => x.id === a.appointmentId);
                      const apptB = api.getAppointments().find(x => x.id === b.appointmentId);
                      const isPatA = apptA?.patientId === activePatient?.id;
                      const isPatB = apptB?.patientId === activePatient?.id;
                      if (isPatA && !isPatB) return -1;
                      if (!isPatA && isPatB) return 1;
                      return 0;
                    }).map(invoice => {
                      const appt = api.getAppointments().find(a => a.id === invoice.appointmentId);
                      const patient = appt ? patients.find(p => p.id === appt.patientId) : null;
                      const prescription = appt ? api.getPrescriptions().find(p => p.appointmentId === appt.id) : null;
                      const isActiveInvoice = patient?.id === activePatient?.id;

                      return (
                        <div 
                          key={invoice.id} 
                          className={`p-4 border rounded-xl space-y-4 transition-all duration-350 ${
                            isActiveInvoice 
                              ? 'border-amber-500 bg-amber-500/5 shadow-md' 
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div>
                              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                {isActiveInvoice && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping shrink-0" />}
                                {patient ? patient.name : 'Unknown Patient'}
                              </h4>
                              <p className="text-[9px] text-slate-600 font-mono">Invoice: {invoice.id.substring(0, 8)}... | Date: {new Date(invoice.createdAt).toLocaleDateString()}</p>
                            </div>
                            <div className="text-[12px] font-black text-amber-600">₹{invoice.amount}</div>
                          </div>

                          {prescription && prescription.extractedMedicines && (
                            <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg space-y-3">
                              <span className="block text-[8px] font-black text-slate-600 tracking-widest uppercase font-mono">Extracted Medicines &amp; Dosages</span>
                              
                              <InvoiceCard
                                invoiceId={invoice.id}
                                patientName={patient?.name ?? 'Unknown Patient'}
                                amount={invoice.amount}
                                status={invoice.status}
                                onPay={invoice.status === 'unpaid' ? () => {
                                  api.markInvoicePaid(invoice.id);
                                  
                                  // Send receipt and dosage to whatsapp
                                  if (patient) {
                                    let session = sessions.find(s => s.patientPhone === patient.phone);
                                    if (!session) {
                                      session = api.initiateWhatsAppSession(patient.phone);
                                    }
                                    api.pushWhatsAppMessageFromBot(patient.phone, `💳 *PAYMENT SUCCESSFUL* \n\nYour pharmacy bill of *₹${invoice.amount}* has been settled via counter.\n\nThank you! Mediflow POS.`);
                                    
                                    // Generate Hinglish dosage summary
                                    const itemsMapped: MedicineBillItem[] = (prescription.extractedMedicines || []).map(m => ({
                                      inventoryItemId: 'item-1',
                                      name: m.name,
                                      genericName: m.name,
                                      dosage: m.dosage,
                                      batchNumber: 'MET-MOCK',
                                      expiryDate: '2028-12-31',
                                      quantity: 10,
                                      mrp: 10,
                                      sellingPrice: 10,
                                      discountPercent: 0,
                                      gstPercent: 5,
                                      lineTotal: 100
                                    }));
                                    
                                    let dosageText = `📋 *दवाई की खुराक की जानकारी (Bilingual Dosage Slip)*\n\nनमस्ते, यहाँ आपकी दवाइयों की खुराक की जानकारी हिंदी/Hinglish में है:\n\n`;
                                    itemsMapped.forEach(item => {
                                      const instr = getBilingualInstruction(item.name, item.dosage);
                                      dosageText += `💊 *${item.name}* (${item.dosage || '1 Tab'})\n`;
                                      dosageText += `👉 *Directions:* ${instr.english}\n`;
                                      dosageText += `👉 *खुराक:* ${instr.hindi}\n\n`;
                                    });
                                    api.pushWhatsAppMessageFromBot(patient.phone, dosageText);
                                    
                                    handleInitiateWhatsAppLoop(patient);
                                  }

                                  window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                    detail: {
                                      message: 'Invoice marked as PAID and WhatsApp notification sent.',
                                      type: 'success',
                                      title: 'Invoice Paid'
                                    }
                                  }));
                                } : undefined}
                              />
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                                {prescription.extractedMedicines.map((m, idx) => (
                                  <div key={idx} className="text-[10px] text-slate-600 font-mono flex items-center justify-between border-b border-slate-100 pb-1">
                                    <span>💊 {m.name} ({m.dosage})</span>
                                    <span className="text-[9px] bg-slate-200/50 px-2 py-0.5 rounded text-slate-700 font-semibold">{m.frequency}</span>
                                  </div>
                                ))}
                              </div>

                              {/* Split Ledger payout Details */}
                              <div className="mt-2.5 pt-2.5 border-t border-slate-200 space-y-1.5 select-none">
                                <span className="block text-[8px] font-bold text-indigo-750 tracking-widest uppercase font-mono">Dynamic Multi-Vendor Payout Splits</span>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px] text-slate-500 font-mono">
                                  <div className="flex justify-between border-b border-dashed border-slate-200/60 pb-0.5">
                                    <span>Platform Fee (3%):</span>
                                    <span className="font-semibold text-slate-750">₹{(invoice.amount * 0.03).toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between border-b border-dashed border-slate-200/60 pb-0.5">
                                    <span>Ecosystem Net Payout:</span>
                                    <span className="font-semibold text-emerald-600">₹{(invoice.amount * 0.97).toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
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
                      ? 'Daycare admission OT tracker. Collect advance bookings, track lens packages, and print finalized bills.'
                      : 'Daycare minor OT procedure tracker. Collect payments, track dressing rooms, and print finalized bills.'}
                  </p>

                  <div className="space-y-3.5 max-h-[480px] overflow-y-auto pr-1">
                    {daycarePatients.length === 0 ? (
                      <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                        {isOphthalmology 
                          ? 'No surgeries currently scheduled by doctors.' 
                          : 'No minor procedures currently scheduled by doctors.'}
                      </div>
                    ) : (
                      daycarePatients.map(p => {
                        if (isOphthalmology) {
                          if (!p.vitals) return null;
                          const booking = p.vitals.surgeryBooking;
                          if (!booking) return null;
                          const balance = booking.price - (booking.advancePaid || 0);
                          const isSelected = activePatient?.id === p.id;

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
                                  <span className="text-[8px] font-mono font-bold bg-indigo-50 text-indigo-750 border border-indigo-200 px-1.5 py-0.2 rounded uppercase">
                                    Eye: {booking.eye}
                                  </span>
                                  <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded uppercase font-mono border ${
                                    booking.status === 'paid'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : booking.advancePaid > 0
                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                        : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}>
                                    {booking.status === 'paid'
                                      ? 'Settled'
                                      : booking.advancePaid > 0
                                        ? `Adv Paid (₹${booking.advancePaid})`
                                        : 'Unpaid'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500">
                                  Package: <strong>{booking.package}</strong> | Date: {booking.date}
                                </p>
                                <p className="text-[10px] text-slate-650 font-medium">
                                  Lens model: {booking.lensType} | Target Power: {booking.iolPower || 'N/A'}
                                </p>
                              </div>

                              <div className="text-right space-y-1">
                                <div className="text-[12px] font-black text-slate-800">₹{booking.price}</div>
                                {balance > 0 ? (
                                  <div className="text-[9px] font-semibold text-rose-600">Due: ₹{balance}</div>
                                ) : (
                                  <div className="text-[9px] font-semibold text-emerald-600">Fully Paid</div>
                                )}
                              </div>
                            </div>
                          );
                        } else {
                          if (!p.vitals) return null;
                          const booking = p.vitals.gpProcedureBooking;
                          if (!booking) return null;
                          const balance = booking.price - (booking.advancePaid || 0);
                          const isSelected = activePatient?.id === p.id;

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
                                    Procedure Room: {booking.room}
                                  </span>
                                  <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded uppercase font-mono border ${
                                    booking.status === 'paid'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : booking.advancePaid > 0
                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                        : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}>
                                    {booking.status === 'paid'
                                      ? 'Settled'
                                      : booking.advancePaid > 0
                                        ? `Adv Paid (₹${booking.advancePaid})`
                                        : 'Unpaid'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500">
                                  Type: <strong>{booking.procedure}</strong> | Date: {booking.date}
                                </p>
                                <p className="text-[10px] text-slate-650 font-medium">
                                  Facility: {booking.room}
                                </p>
                              </div>

                              <div className="text-right space-y-1">
                                <div className="text-[12px] font-black text-slate-800">₹{booking.price}</div>
                                {balance > 0 ? (
                                  <div className="text-[9px] font-semibold text-rose-600">Due: ₹{balance}</div>
                                ) : (
                                  <div className="text-[9px] font-semibold text-emerald-600">Fully Paid</div>
                                )}
                              </div>
                            </div>
                          );
                        }
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: OT/Procedure Billing Worksheet & Payments */}
              <div className="lg:col-span-6 space-y-6">
                {activePatient ? (
                  isOphthalmology && activePatient.vitals?.surgeryBooking && activePatient.vitals.surgeryBooking.eye !== 'None' ? (
                    (() => {
                      const booking = activePatient.vitals.surgeryBooking;
                      const balance = booking.price - (booking.advancePaid || 0);
                      const surgeonFee = Math.round(booking.price * 0.35);
                      const lensConsumables = Math.round(booking.price * 0.45);
                      const anesthetistFee = Math.round(booking.price * 0.10);
                      const otRent = Math.round(booking.price * 0.10);

                      return (
                        <div className="glass-panel p-6 border-slate-200 shadow-xl relative overflow-hidden bg-white text-slate-800 space-y-5 animate-fade-in text-left">
                          <div className="absolute top-0 left-0 w-full h-[3px] bg-rose-600" />
                          
                          <div className="flex justify-between items-start border-b border-slate-200 pb-3 flex-wrap gap-2">
                            <div>
                              <span className="block text-[8px] font-black text-rose-700 tracking-widest uppercase font-mono">Daycare Surgery Pre-Op Billing</span>
                              <h3 className="font-bold text-sm text-slate-800 mt-0.5">OT Worksheet: {activePatient.name}</h3>
                            </div>
                            <span className="text-[9px] bg-slate-100 text-slate-655 px-2.5 py-0.5 rounded border font-mono">
                              ID: {activePatient.tokenNumber || 'PAT'}
                            </span>
                          </div>

                          {/* Package Itemized splits */}
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 select-none font-mono">
                            <span className="block text-[8px] font-black text-slate-600 tracking-widest uppercase mb-1">Clinic Package Breakdown splits</span>
                            <div className="flex justify-between text-[10px] text-slate-600 border-b border-slate-200/50 pb-1.5">
                              <span>Surgeon Operation Fee (35%):</span>
                              <span className="font-bold">₹{surgeonFee}</span>
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-600 border-b border-slate-200/50 pb-1.5">
                              <span>IOL Lens Implant & OT Consumables (45%):</span>
                              <span className="font-bold">₹{lensConsumables}</span>
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-600 border-b border-slate-200/50 pb-1.5">
                              <span>Anaesthetist Consultation Block (10%):</span>
                              <span className="font-bold">₹{anesthetistFee}</span>
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-600 pb-0.5">
                              <span>OT Rent & Daycare Ward Rent (10%):</span>
                              <span className="font-bold">₹{otRent}</span>
                            </div>
                          </div>

                          {/* Ledger Summary */}
                          <div className="grid grid-cols-3 gap-3 text-center border-y border-slate-200 py-3.5 select-none">
                            <div>
                              <div className="text-[9px] font-bold text-slate-500 uppercase font-mono">Total Package</div>
                              <div className="text-sm font-black text-slate-800 mt-1">₹{booking.price}</div>
                            </div>
                            <div>
                              <div className="text-[9px] font-bold text-slate-500 uppercase font-mono">Advance Paid</div>
                              <div className="text-sm font-black text-indigo-750 mt-1">₹{booking.advancePaid || 0}</div>
                            </div>
                            <div>
                              <div className="text-[9px] font-bold text-slate-500 uppercase font-mono">Balance Due</div>
                              <div className="text-sm font-black text-rose-600 mt-1">₹{balance}</div>
                            </div>
                          </div>

                          {/* Payment inputs */}
                          {balance > 0 && (
                            <div className="space-y-3.5 border-b border-slate-200 pb-4">
                              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Record Payment Desk</h4>
                              
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  id="ot-deposit-amount"
                                  placeholder="Deposit Amount (₹)"
                                  className="flex-1 input-field text-xs py-2 px-3 focus:ring-1 focus:ring-rose-500 focus:border-rose-500 bg-slate-50 border-slate-200 text-slate-800 rounded-lg outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const el = document.getElementById('ot-deposit-amount') as HTMLInputElement;
                                    const amt = parseInt(el?.value || '');
                                    if (!amt || isNaN(amt) || amt <= 0) {
                                      alert('Please enter a valid deposit amount.');
                                      return;
                                    }
                                    if (amt > balance) {
                                      alert(`Deposit amount cannot exceed the balance due of ₹${balance}.`);
                                      return;
                                    }
                                    
                                    const invoices = api.getInvoices();
                                    const otInv = invoices.find(i => i.patientId === activePatient.id && i.type === 'ot' && i.status === 'unpaid');
                                    if (otInv) {
                                      api.recordOTAdvancePayment(otInv.id, amt);
                                      el.value = "";
                                      syncData();
                                      
                                      api.pushWhatsAppMessageFromBot(activePatient.phone, 
                                        `🏥 *OT Package Advance Collected* ✅\n\n` +
                                        `Hello *${activePatient.name}*, hume aapki surgery booking ke liye *₹${amt}* ka deposit prapt hua hai.\n\n` +
                                        `💵 *Total Price:* ₹${booking.price}\n` +
                                        `💰 *Advance Paid:* ₹${booking.advancePaid + amt}\n` +
                                        `⚖️ *Remaining Due:* ₹${balance - amt}\n\n` +
                                        `Thank you. Mediflow Daycare.`
                                      );
                                      
                                      window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                        detail: {
                                          message: `Advance deposit of ₹${amt} successfully recorded.`,
                                          type: 'success',
                                          title: 'Advance Recorded'
                                        }
                                      }));
                                    }
                                  }}
                                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-slate-850 font-bold rounded-lg text-xs cursor-pointer border-0 active:scale-95 transition-all shrink-0"
                                >
                                  Collect Advance
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  const invoices = api.getInvoices();
                                  const otInv = invoices.find(i => i.patientId === activePatient.id && i.type === 'ot' && i.status === 'unpaid');
                                  if (otInv) {
                                    api.recordOTAdvancePayment(otInv.id, balance);
                                    syncData();
                                    
                                    api.pushWhatsAppMessageFromBot(activePatient.phone, 
                                      `🏥 *Daycare Surgery Billing Settled* ✅\n\n` +
                                      `Hello *${activePatient.name}*, aapka Daycare surgery bill purntah settle ho gaya hai.\n\n` +
                                      `💵 *Settle Amount:* ₹${balance}\n` +
                                      `👍 *Status:* FULLY PAID\n\n` +
                                      `Thank you. Mediflow Daycare.`
                                    );

                                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                      detail: {
                                        message: `Remaining balance of ₹${balance} fully settled.`,
                                        type: 'success',
                                        title: 'Worksheet Settled'
                                      }
                                    }));
                                  }
                                }}
                                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-850 font-bold rounded-lg uppercase tracking-wider text-[10px] cursor-pointer flex items-center justify-center gap-1 cursor-pointer border-0"
                              >
                                <span className="material-symbols-outlined text-[14px]">done_all</span>
                                Settle Remaining Balance (₹{balance}) &amp; Approve OT Entry
                              </button>
                            </div>
                          )}

                          {/* Daycare Admission Receipt print */}
                          <button
                            type="button"
                            onClick={() => {
                              const printWindow = window.open('', '_blank', 'width=800,height=900');
                              if (!printWindow) return;
                              
                              printWindow.document.write(`
                                <html>
                                  <head>
                                    <title>Mediflow Daycare - Daycare OT Admission Receipt</title>
                                    <style>
                                      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
                                      .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
                                      .title { font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #dc2626; }
                                      .meta-table { width: 100%; margin-bottom: 30px; font-size: 13px; }
                                      .meta-table td { padding: 6px 12px; }
                                      .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; border-bottom: 1.5px solid #dc2626; color: #dc2626; padding-bottom: 6px; margin: 30px 0 15px; }
                                      table.splits-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                                      table.splits-table th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 12px; text-align: left; font-size: 11px; text-transform: uppercase; font-weight: 800; color: #475569; }
                                      table.splits-table td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
                                      .summary-box { float: right; width: 300px; background: #fafafa; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-top: 30px; font-size: 13px; }
                                      .summary-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: 500; }
                                      .summary-row.total { font-weight: 800; font-size: 16px; border-top: 1.5px solid #e2e8f0; padding-top: 8px; margin-top: 8px; color: #dc2626; }
                                      .footer { clear: both; text-align: center; margin-top: 80px; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; }
                                    </style>
                                  </head>
                                  <body>
                                    <div class="header">
                                      <div class="title">Mediflow Connected Healthcare Pod</div>
                                      <div style="font-size: 11px; font-weight: bold; color: #64748b; margin-top: 5px;">DAYCARE SURGERY ADMISSION &amp; OT RECEIPT</div>
                                    </div>
                                    <table class="meta-table" width="100%">
                                      <tr>
                                        <td><strong>Patient Name:</strong> \${activePatient.name}</td>
                                        <td><strong>Date:</strong> \${new Date().toLocaleDateString('en-IN')}</td>
                                      </tr>
                                      <tr>
                                        <td><strong>Age / Gender:</strong> \${activePatient.age}y / \${activePatient.gender}</td>
                                        <td><strong>Token Number:</strong> \${activePatient.tokenNumber || '—'}</td>
                                      </tr>
                                      <tr>
                                        <td><strong>Procedure Type:</strong> \${booking.type}</td>
                                        <td><strong>Selected Eye:</strong> \${booking.eye}</td>
                                      </tr>
                                      <tr>
                                        <td><strong>Lens Model / IOL power:</strong> \${booking.lensType} (\${booking.iolPower || 'N/A'})</td>
                                        <td><strong>Assigned OT Charge:</strong> \${booking.coordinator}</td>
                                      </tr>
                                    </table>

                                    <div class="section-title">Itemized Package splits (LEDGER DESCRIPTION)</div>
                                    <table class="splits-table">
                                      <thead>
                                        <tr>
                                          <th>Billing Item / Splitted Category</th>
                                          <th style="text-align: right;">Amount Charged</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        <tr>
                                          <td>Surgeon Operation Fee (35%)</td>
                                          <td style="text-align: right;">₹\${surgeonFee}</td>
                                        </tr>
                                        <tr>
                                          <td>IOL Implant, Viscoelastics &amp; OT Consumables (45%)</td>
                                          <td style="text-align: right;">₹\${lensConsumables}</td>
                                        </tr>
                                        <tr>
                                          <td>Anesthetist Consultation Block (10%)</td>
                                          <td style="text-align: right;">₹\${anesthetistFee}</td>
                                        </tr>
                                        <tr>
                                          <td>OT Chamber Ward &amp; Post-Op Care Rent (10%)</td>
                                          <td style="text-align: right;">₹\${otRent}</td>
                                        </tr>
                                      </tbody>
                                    </table>

                                    <div class="summary-box">
                                      <div class="summary-row">
                                        <span>Total Package cost:</span>
                                        <span>₹\${booking.price}</span>
                                      </div>
                                      <div class="summary-row">
                                        <span>Advance Deposit Paid:</span>
                                        <span style="color: #4f46e5;">₹\${booking.advancePaid || 0}</span>
                                      </div>
                                      <div class="summary-row total">
                                        <span>Balance Due:</span>
                                        <span>₹\${balance}</span>
                                      </div>
                                    </div>

                                    <div class="footer">
                                      <p>This daycare OT admission receipt is digitally authorized under VitalSync Clinic guidelines.</p>
                                      <p style="margin-top: 40px; font-weight: bold; color: #475569;">Authorized Registrar Signature / Hospital Seal</p>
                                    </div>
                                  </body>
                                </html>
                              `);
                              printWindow.document.close();
                            }}
                            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold rounded-lg border border-slate-200 cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-[14px]">print</span>
                            Print Daycare Admission &amp; OT Receipt
                          </button>
                        </div>
                      );
                    })()
                  ) : !isOphthalmology && activePatient.vitals?.gpProcedureBooking && activePatient.vitals.gpProcedureBooking.procedure !== 'None' ? (
                    (() => {
                      const booking = activePatient.vitals.gpProcedureBooking;
                      const balance = booking.price - (booking.advancePaid || 0);
                      const surgeonFee = Math.round(booking.price * 0.40);
                      const roomFee = Math.round(booking.price * 0.30);
                      const consumablesFee = Math.round(booking.price * 0.30);

                      return (
                        <div className="glass-panel p-6 border-slate-200 shadow-xl relative overflow-hidden bg-white text-slate-800 space-y-5 animate-fade-in text-left">
                          <div className="absolute top-0 left-0 w-full h-[3px] bg-amber-600" />
                          
                          <div className="flex justify-between items-start border-b border-slate-200 pb-3 flex-wrap gap-2">
                            <div>
                              <span className="block text-[8px] font-black text-amber-700 tracking-widest uppercase font-mono">Daycare Minor OT &amp; Dressing Billing</span>
                              <h3 className="font-bold text-sm text-slate-800 mt-0.5">Procedure Worksheet: {activePatient.name}</h3>
                            </div>
                            <span className="text-[9px] bg-slate-100 text-slate-655 px-2.5 py-0.5 rounded border font-mono">
                              ID: {activePatient.tokenNumber || 'PAT'}
                            </span>
                          </div>

                          {/* Package Itemized splits */}
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 select-none font-mono">
                            <span className="block text-[8px] font-black text-slate-600 tracking-widest uppercase mb-1">Procedure Cost Breakdown splits</span>
                            <div className="flex justify-between text-[10px] text-slate-600 border-b border-slate-200/50 pb-1.5">
                              <span>Doctor/Surgeon Fee (40%):</span>
                              <span className="font-bold">₹{surgeonFee}</span>
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-600 border-b border-slate-200/50 pb-1.5">
                              <span>Sterile Dressing Room / Facility Fee (30%):</span>
                              <span className="font-bold">₹{roomFee}</span>
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-600 pb-0.5">
                              <span>Sterile Consumables &amp; Disposables (30%):</span>
                              <span className="font-bold">₹{consumablesFee}</span>
                            </div>
                          </div>

                          {/* Ledger Summary */}
                          <div className="grid grid-cols-3 gap-3 text-center border-y border-slate-200 py-3.5 select-none">
                            <div>
                              <div className="text-[9px] font-bold text-slate-500 uppercase font-mono">Total Procedure</div>
                              <div className="text-sm font-black text-slate-800 mt-1">₹{booking.price}</div>
                            </div>
                            <div>
                              <div className="text-[9px] font-bold text-slate-500 uppercase font-mono">Paid Amount</div>
                              <div className="text-sm font-black text-indigo-755 mt-1">₹{booking.advancePaid || 0}</div>
                            </div>
                            <div>
                              <div className="text-[9px] font-bold text-slate-500 uppercase font-mono">Balance Due</div>
                              <div className="text-sm font-black text-rose-600 mt-1">₹{balance}</div>
                            </div>
                          </div>

                          {/* Payment inputs */}
                          {balance > 0 ? (
                            <div className="space-y-3.5 border-b border-slate-200 pb-4">
                              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Record Payment Desk</h4>
                              
                              <button
                                type="button"
                                onClick={() => {
                                  const invoices = api.getInvoices();
                                  const gpInv = invoices.find(i => i.patientId === activePatient.id && i.type === ('gp_procedure' as any) && i.status === 'unpaid');
                                  if (gpInv) {
                                    api.recordGPProcedurePayment(gpInv.id, balance);
                                    syncData();
                                    
                                    api.pushWhatsAppMessageFromBot(activePatient.phone, 
                                      `🏥 *GP Minor Procedure Settled* ✅\n\n` +
                                      `Hello *${activePatient.name}*, aapka minor procedure bill settle ho gaya hai.\n\n` +
                                      `💵 *Procedure:* ${booking.procedure}\n` +
                                      `💰 *Total Amount:* ₹${booking.price}\n` +
                                      `👍 *Status:* FULLY PAID\n\n` +
                                      `Thank you. Mediflow Daycare.`
                                    );

                                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                      detail: {
                                        message: `Procedure bill of ₹${balance} fully settled.`,
                                        type: 'success',
                                        title: 'Worksheet Settled'
                                      }
                                    }));
                                  }
                                }}
                                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-850 font-bold rounded-lg uppercase tracking-wider text-[10px] cursor-pointer flex items-center justify-center gap-1 cursor-pointer border-0"
                              >
                                <span className="material-symbols-outlined text-[14px]">done_all</span>
                                Settle Procedure Bill (₹{balance}) &amp; Approve Entry
                              </button>
                            </div>
                          ) : (
                            <div className="p-3 bg-emerald-50 border border-emerald-250 rounded-xl text-center text-xs text-emerald-800 font-bold font-mono">
                              🎉 Invoice Settle &amp; Payment Verification Complete
                            </div>
                          )}

                          {/* Daycare Admission Receipt print */}
                          <button
                            type="button"
                            onClick={() => {
                              const printWindow = window.open('', '_blank', 'width=800,height=900');
                              if (!printWindow) return;
                              
                              printWindow.document.write(`
                                <html>
                                  <head>
                                    <title>Mediflow Daycare - Minor Procedure Admission Receipt</title>
                                    <style>
                                      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
                                      .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
                                      .title { font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #d97706; }
                                      .meta-table { width: 100%; margin-bottom: 30px; font-size: 13px; }
                                      .meta-table td { padding: 6px 12px; }
                                      .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; border-bottom: 1.5px solid #d97706; color: #d97706; padding-bottom: 6px; margin: 30px 0 15px; }
                                      table.splits-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                                      table.splits-table th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 12px; text-align: left; font-size: 11px; text-transform: uppercase; font-weight: 800; color: #475569; }
                                      table.splits-table td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
                                      .summary-box { float: right; width: 300px; background: #fafafa; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-top: 30px; font-size: 13px; }
                                      .summary-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: 500; }
                                      .summary-row.total { font-weight: 800; font-size: 16px; border-top: 1.5px solid #e2e8f0; padding-top: 8px; margin-top: 8px; color: #d97706; }
                                      .footer { clear: both; text-align: center; margin-top: 80px; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; }
                                    </style>
                                  </head>
                                  <body>
                                    <div class="header">
                                      <div class="title">Mediflow Connected Healthcare Pod</div>
                                      <div style="font-size: 11px; font-weight: bold; color: #64748b; margin-top: 5px;">MINOR PROCEDURE ADMISSION &amp; RECEIPT</div>
                                    </div>
                                    <table class="meta-table" width="100%">
                                      <tr>
                                        <td><strong>Patient Name:</strong> \${activePatient.name}</td>
                                        <td><strong>Date:</strong> \${new Date().toLocaleDateString('en-IN')}</td>
                                      </tr>
                                      <tr>
                                        <td><strong>Age / Gender:</strong> \${activePatient.age}y / \${activePatient.gender}</td>
                                        <td><strong>Token Number:</strong> \${activePatient.tokenNumber || '—'}</td>
                                      </tr>
                                      <tr>
                                        <td><strong>Procedure Type:</strong> \${booking.procedure}</td>
                                        <td><strong>Facility / Room:</strong> \${booking.room}</td>
                                      </tr>
                                    </table>

                                    <div class="section-title">Itemized Splits (LEDGER DESCRIPTION)</div>
                                    <table class="splits-table">
                                      <thead>
                                        <tr>
                                          <th>Billing Item / Splitted Category</th>
                                          <th style="text-align: right;">Amount Charged</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        <tr>
                                          <td>Doctor/Surgeon Fee (40%)</td>
                                          <td style="text-align: right;">₹\${surgeonFee}</td>
                                        </tr>
                                        <tr>
                                          <td>Sterile Dressing Room / Facility Rent (30%)</td>
                                          <td style="text-align: right;">₹\${roomFee}</td>
                                        </tr>
                                        <tr>
                                          <td>Sterile Consumables &amp; Disposables (30%)</td>
                                          <td style="text-align: right;">₹\${consumablesFee}</td>
                                        </tr>
                                      </tbody>
                                    </table>

                                    <div class="summary-box">
                                      <div class="summary-row">
                                        <span>Total Price:</span>
                                        <span>₹\${booking.price}</span>
                                      </div>
                                      <div class="summary-row">
                                        <span>Amount Paid:</span>
                                        <span style="color: #4f46e5;">₹\${booking.advancePaid || 0}</span>
                                      </div>
                                      <div class="summary-row total">
                                        <span>Balance Due:</span>
                                        <span>₹\${balance}</span>
                                      </div>
                                    </div>

                                    <div class="footer">
                                      <p>This minor procedure receipt is digitally authorized under VitalSync Clinic guidelines.</p>
                                      <p style="margin-top: 40px; font-weight: bold; color: #475569;">Authorized Registrar Signature / Hospital Seal</p>
                                    </div>
                                  </body>
                                </html>
                              `);
                              printWindow.document.close();
                            }}
                            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold rounded-lg border border-slate-200 cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-[14px]">print</span>
                            Print Minor OT Admission &amp; Receipt
                          </button>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-indigo-200 rounded-2xl p-8 bg-indigo-50/30 text-center h-[300px]">
                      <span className="material-symbols-outlined text-3xl text-indigo-400">person_search</span>
                      <p className="text-xs text-slate-655 font-semibold">
                        {isOphthalmology 
                          ? 'Select a patient scheduled for surgery from the list on the left to start OT billing.'
                          : 'Select a patient scheduled for a minor procedure from the list on the left to start procedure billing.'}
                      </p>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-indigo-200 rounded-2xl p-8 bg-indigo-50/30 text-center h-[300px]">
                    <span className="material-symbols-outlined text-3xl text-indigo-400">person_search</span>
                    <p className="text-xs text-slate-655 font-semibold">
                      {isOphthalmology 
                        ? 'Select a patient scheduled for surgery from the list on the left to start OT billing.'
                        : 'Select a patient scheduled for a minor procedure from the list on the left to start procedure billing.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Real-time WhatsApp Loop simulator at the bottom */}
        <div className="glass-panel border-slate-200 shadow-xl overflow-hidden flex flex-col h-[600px] relative mt-8">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-emerald-600 opacity-80" />
            
            <div className="bg-[#075e54] p-4 border-b border-[#128c7e]/20 flex items-center justify-between">
              <div className="flex items-center gap-3 select-none">
                <div className="h-9 w-9 rounded-full bg-white/10 text-slate-800 flex items-center justify-center font-bold text-sm shrink-0 border border-white/20">
                  💬
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800">WhatsApp Live Simulator Sandbox</h3>
                  <p className="text-[10px] text-emerald-250 flex items-center gap-1 font-semibold tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    ACTIVE VERIFICATION SERVICE
                  </p>
                </div>
              </div>
            </div>

            {/* Session Selector Dropdown */}
            <div className="bg-white border-b border-slate-200/60 p-3 flex items-center gap-2 select-none">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
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
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-755 outline-none font-medium text-slate-700"
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

            <div 
              ref={chatContainerRef}
              onScroll={handleScroll}
              className="flex-1 bg-[#efeae2] p-4 overflow-y-auto space-y-4 font-sans text-xs"
            >
              {activeSession ? (
                <div className="space-y-4">
                  <div className="text-center select-none">
                    <span className="bg-white/10 text-slate-650 px-3 py-1 rounded-md text-[9px] font-bold tracking-widest uppercase font-mono">
                      TODAY
                    </span>
                  </div>

                  <div className="bg-white/90 border border-slate-200/80 p-3.5 rounded-xl flex gap-3 leading-relaxed shadow-sm select-none">
                    <ShieldAlert className="h-5 w-5 text-indigo-650 flex-shrink-0 mt-0.5" />
                    <p className="text-slate-605 text-[10px] leading-relaxed">
                      Time-locked patient clinical consent simulation for <strong>{patients.find(p => p.phone === activeSession.patientPhone)?.name || 'Patient'}</strong> (+91 {activeSession.patientPhone}). Current state: <span className="font-mono text-emerald-600 uppercase font-semibold">{activeSession.currentState.replace('_', ' ')}</span>
                    </p>
                  </div>

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
                            className={`max-w-[85%] p-3.5 rounded-2xl shadow-sm relative leading-relaxed ${
                              isBot 
                                ? 'bg-white rounded-tl-none text-slate-800' 
                                : 'bg-[#d9fdd3] rounded-tr-none text-slate-850'
                            }`}
                          >
                            <p className="leading-relaxed whitespace-pre-line font-mono text-[11px] font-medium text-slate-800">{msg.text}</p>
                            
                            {isBot && msg.text.includes('Welcome to Mediflow') && activeSession.currentState === 'AWAITING_WELCOME' && (
                              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2 select-none">
                                <button
                                  onClick={() => {
                                    api.processIncomingWhatsAppMessage(activeSession.patientPhone, '1');
                                    syncData();
                                  }}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-800 font-bold py-2 rounded-xl text-center shadow active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer border-0"
                                >
                                  Grant Consent ({patients.find(p => p.phone === activeSession.patientPhone)?.name || 'Patient'})
                                </button>
                              </div>
                            )}
                            {isBot && msg.text.includes('consent is committed') && activeSession.currentState !== 'AWAITING_WELCOME' && (
                              <div className="mt-2 flex items-center gap-1 text-emerald-600 text-[9px] font-bold uppercase tracking-wider select-none">
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
                  <span className="material-symbols-outlined text-6xl text-slate-600 animate-pulse">forum</span>
                  <div>
                    <h4 className="font-bold text-slate-700 text-sm">No Active WhatsApp Loop</h4>
                    <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                      Lookup a patient in patient registry lookup or register a new one, then click "SMS opt-in" to trigger simulated messaging sandboxing.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSendReply} className="bg-[#f0f2f5] p-3 border-t border-slate-200 flex gap-2">
              <input
                type="text"
                value={replyInput}
                onChange={(e) => setReplyInput(e.target.value)}
                disabled={!activeSession}
                placeholder={activeSession ? "Type simulated message (e.g. '1', 'PAY', 'Metformin 30 tabs')..." : "Simulated WhatsApp Sandbox Interface"}
                className="flex-1 bg-white border border-slate-200/80 rounded-full px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
              <button 
                type="submit"
                disabled={!activeSession || !replyInput.trim()} 
                className={`p-2.5 rounded-full transition-colors border-0 shrink-0 ${
                  activeSession && replyInput.trim() 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-slate-800 cursor-pointer shadow active:scale-95' 
                    : 'bg-slate-200 text-slate-650'
                }`}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>

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

      {/* Premium PWA Mobile Fixed Bottom Tab Bar Navigation for Compounder Dashboard */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-50/95 backdrop-blur-lg border-t border-slate-200/80 shadow-[0_-4px_12px_rgba(0,0,0,0.02)] px-2 pb-safe-bottom">
        <div className="flex items-center justify-around h-16">
          {[
            { id: 'intake', label: 'Intake', icon: UserCheck },
            { id: 'patients', label: 'Patients', icon: Users },
            { id: 'tokens', label: 'Tokens', icon: Activity },
            { id: 'labs', label: 'Labs', icon: FileText },
            { id: 'pharmacy', label: 'Pharmacy', icon: QrCode },
            { id: 'ot_billing', label: isOphthalmology ? 'Daycare' : 'Minor OT', icon: Stethoscope }
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
                    ? 'text-indigo-600 font-bold' 
                    : 'text-slate-600 hover:text-slate-600'
                }`}
              >
                <div className={`p-1.5 rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-600 scale-105 shadow-sm' 
                    : 'bg-transparent text-slate-600'
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold mt-1 tracking-wide leading-none">
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-600" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
