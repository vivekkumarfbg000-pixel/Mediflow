import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../lib/supabaseClient';
import { 
  Users, Search, FileText, Activity, QrCode, Check, X, ShieldAlert, Sparkles, Printer, Mic, MicOff, Plus, AlertCircle, ShieldCheck,
  ArrowRight, CheckCircle2, Pill, FlaskConical, Calendar, Stethoscope, RefreshCw, Loader2, Receipt, UserPlus, Send, Phone
} from 'lucide-react';
import { SearchInput } from '../../ui/SearchInput';
import { api } from '../../../services/api';
import { EncounterService } from '../../../services/encounterService';
import { PharmacyService } from '../../../services/pharmacyService';
import { LabService, MASTER_TEST_CATALOG } from '../../../services/labService';
import { BillingService } from '../../../services/billingService';
import { PaymentService } from '../../../services/paymentService';
import { PatientService } from '../../../services/patientService';
import { getPodContext } from '../../../services/podContext';
import { useSpecialization } from '../../../context/SpecializationContext';
import { useClinic } from '../../../context/ClinicContext';
import { WhatsAppService } from '../../../services/whatsappService';
import { WhatsAppTemplateEngine } from '../../../services/WhatsAppTemplateEngine';
import { generateQRCodeDataURI } from '../../../utils/qrCode';
import { ClinicalNotificationService } from '../../../services/clinicalNotificationService';
import { ChronicCareService } from '../../../services/chronicCareService';
import { ForecastService } from '../../../services/forecastService';
import { PaperModeService } from '../../../services/paperModeService';
import { getIstDateString, getEffectiveAppointmentDate, getIstOffsetDateString } from '../../../utils/dateUtils';
import { safeGetStorageJSON } from '../../../utils/storage';
import { save } from '../../../services/apiHelper';
import type { Patient, UnifiedInvoice, PharmacyInventoryItem, DiagnosticTest } from '../../../types';


export interface BillHubTabProps {
  initialMode?: 'manual_billing';
  initialPatientId?: string | null;
}

export const BillHubTab: React.FC<BillHubTabProps> = ({ initialMode = 'ocr_scan', initialPatientId = null }) => {
  const { isOphthalmology } = useSpecialization();
  const { activePod, activeProfile } = useClinic();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Dual Master Header Tabs (Default: 1. OCR Scan & Auto-Save)
  const [invoiceSectionTab, setInvoiceSectionTab] = useState<'ocr_scan' | 'manual_billing'>(initialMode);

  useEffect(() => {
    if (initialMode) {
      setInvoiceSectionTab(initialMode);
    }
  }, [initialMode]);

  useEffect(() => {
    if (initialPatientId) {
      const allPats = PatientService.getPatients();
      const target = allPats.find(p => p.id === initialPatientId || (p as any).patient_code === initialPatientId);
      if (target) {
        setSelectedPatient(target);
        setBillingMode('digital');
      }
    }
  }, [initialPatientId]);
  
  // App States
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [patientFilterTab, setPatientFilterTab] = useState<'today_queue' | 'all'>('today_queue');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [billingMode, setBillingMode] = useState<'digital' | 'manual'>('digital');
  
  // Manual Upload / OCR States
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [ocrScanStep, setOcrScanStep] = useState<string>('');
  const [lastScannedResult, setLastScannedResult] = useState<{
    patient: Patient;
    medications: any[];
    diagnosticTests: any[];
    matchedAppointment?: any;
    // Clinic OS extended fields
    tokenNumber?: string | null;
    chronicConditions?: string[];
    isChronic?: boolean;
    prescriptionImageUrl?: string | null;
    waDispatched?: boolean;
    isNewPatient?: boolean;
    consultFee?: number;
  } | null>(null);
  const [manualExtractedData, setManualExtractedData] = useState<{
    raw: string;
    structured: Record<string, string>;
  } | null>(null);

  // Manual Billing & Catalog Search States
  const [manualItemSearchQuery, setManualItemSearchQuery] = useState('');
  const [manualMedicinesList, setManualMedicinesList] = useState<Array<{ name: string; mrp: number; price: number; batch: string; stock: number }>>([]);
  const [manualTestsList, setManualTestsList] = useState<DiagnosticTest[]>([]);

  // Voice Billing States
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');

  // Billing Item States (Toggles & Quantities)
  const [includeConsult, setIncludeConsult] = useState(true);
  const [includeOT, setIncludeOT] = useState(true);
  const [selectedMedicines, setSelectedMedicines] = useState<Record<string, { selected: boolean; qty: number }>>({});
  const [selectedTests, setSelectedTests] = useState<Record<string, boolean>>({});
  const [discountInput, setDiscountInput] = useState<number>(0);
  const [referralCode, setReferralCode] = useState<string>("");
  const [partialCashAmount, setPartialCashAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'cash'>('upi');
  const [isClearing, setIsClearing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Missing Phone Modal State for Paper Mode OCR
  const [missingPhoneModalData, setMissingPhoneModalData] = useState<{
    patient: Patient;
    doctorName: string;
    clinicName: string;
    medications: any[];
    diagnosticTests: any[];
    prescriptionImageUrl: string | null;
    isNewPatient: boolean;
  } | null>(null);
  const [inputPhone, setInputPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const isEncounterMatchingPatient = (e: any, pat: Patient | null): boolean => {
    if (!pat || !e) return false;
    const encPatId = String(e.patientId || e.patient_id || '').trim().toLowerCase();
    const patId = String(pat.id || '').trim().toLowerCase();
    const patCode = String(pat.patientCode || (pat as any).patient_code || '').trim().toLowerCase();
    const patPhone = (pat.phone || '').replace(/\D/g, '').slice(-10);
    const patName = (pat.name || '').toLowerCase().trim();

    const encPhone = (e.patientPhone || e.patient_phone || '').replace(/\D/g, '').slice(-10);
    const encName = (e.patientName || e.patient_name || '').toLowerCase().trim();

    if (encPatId && patId && encPatId === patId) return true;
    if (patCode && encPatId && encPatId === patCode) return true;
    if (patPhone && encPhone && patPhone.length >= 6 && patPhone === encPhone) return true;
    if (patName && encName && patName.length >= 3 && patName === encName) return true;
    return false;
  };

  // Fetch initial list of patients & live state listener
  useEffect(() => {
    setPatients(PatientService.getPatients());
    const handleStateChange = () => {
      setRefreshKey(prev => prev + 1);
      setPatients(PatientService.getPatients());
    };
    window.addEventListener('mediflow-state-change', handleStateChange);
    window.addEventListener('storage', handleStateChange);
    const unsub = api.subscribe(handleStateChange);
    return () => {
      window.removeEventListener('mediflow-state-change', handleStateChange);
      window.removeEventListener('storage', handleStateChange);
      unsub();
    };
  }, []);

  // Sync state if selected patient changes
  useEffect(() => {
    if (selectedPatient) {
      setFileName(null);
      setManualExtractedData(null);
      // Check if consultation fee was ALREADY paid at Gate 1 booking time
      const saasInvoices = BillingService.getInvoices();
      const uInvoices = BillingService.getUnifiedInvoices();
      const alreadyPaidConsult = saasInvoices.some((i: any) => (i.patientId === selectedPatient.id || (selectedPatient.patientCode && i.patientId === selectedPatient.patientCode)) && i.type === 'consult' && i.status === 'paid') ||
                                 uInvoices.some((i: any) => isEncounterMatchingPatient(i, selectedPatient) && (i.paymentStatus === 'cleared' || i.payment_status === 'cleared') && ((i.doctorFee || i.doctor_fee || 0) > 0 || i.type === 'consult'));

      setIncludeConsult(!alreadyPaidConsult);
      setIncludeOT(true);
      setManualMedicinesList([]);
      setManualTestsList([]);
      setVoiceTranscript('');

      // Check if there is an active digital prescription / encounter
      const encounters = EncounterService.getEncounters()
        .filter(e => isEncounterMatchingPatient(e, selectedPatient))
        .sort((a, b) => new Date(b.createdAt || (b as any).created_at || 0).getTime() - new Date(a.createdAt || (a as any).created_at || 0).getTime());

      let saasPrescriptions: any[] = [];
      try {
        saasPrescriptions = (BillingService.getPrescriptions ? BillingService.getPrescriptions() : safeGetStorageJSON<any[]>('saas_prescriptions', []))
          .filter((r: any) => isEncounterMatchingPatient(r, selectedPatient))
          .sort((a: any, b: any) => new Date(b.createdAt || b.created_at || 0).getTime() - new Date(a.createdAt || a.created_at || 0).getTime());
      } catch (_rxErr) { /* ignore */ }

      const latestEncounter = encounters[0];
      const latestRx = saasPrescriptions[0];

      const rawMeds = (latestEncounter?.medications && latestEncounter.medications.length > 0)
        ? latestEncounter.medications
        : (latestRx?.extractedMedicines || latestRx?.extracted_medicines || latestRx?.medications || []);

      const rawTests = (latestEncounter?.diagnosticTests && latestEncounter.diagnosticTests.length > 0)
        ? latestEncounter.diagnosticTests
        : (latestRx?.extractedTests || latestRx?.extracted_tests || latestRx?.diagnosticTests || []);

      if (rawMeds.length > 0 || rawTests.length > 0 || latestEncounter || latestRx) {
        setBillingMode('digital');
        // Pre-select all digital medicines
        const initialMeds: Record<string, { selected: boolean; qty: number }> = {};
        rawMeds.forEach((m: any) => {
          const mName = (m.medicineName || m.name || '').toLowerCase();
          if (mName) initialMeds[mName] = { selected: true, qty: 10 };
        });
        setSelectedMedicines(initialMeds);

        // Pre-select all digital tests
        const initialTests: Record<string, boolean> = {};
        rawTests.forEach((t: any) => {
          const loinc = typeof t === 'string'
            ? (LabService.getTestCatalog().find(cat => cat.name.toLowerCase() === t.toLowerCase())?.loincCode || t)
            : (t?.loincCode || t?.testCode || t?.code);
          if (loinc) initialTests[loinc] = true;
        });
        setSelectedTests(initialTests);
      } else {
        setBillingMode('manual');
        setSelectedMedicines({});
        setSelectedTests({});
      }
    }
  }, [selectedPatient, refreshKey]);

  // Catalogs
  const inventory = useMemo(() => PharmacyService.getPharmacyInventory(), []);
  
  // Today's active appointments & registrations in IST
  const todayOpdPatientIds = useMemo(() => {
    const todayStr = getIstDateString();
    const appts = BillingService.getAppointments().filter(a => {
      const aDate = getEffectiveAppointmentDate(a);
      return (aDate === todayStr || getIstDateString(a.createdAt) === todayStr) && a.status !== 'cancelled';
    });
    const ids = new Set<string>();
    appts.forEach(a => {
      if (a.patientId) ids.add(a.patientId);
      if ((a as any).patient_id) ids.add((a as any).patient_id);
    });
    patients.forEach(p => {
      if (getIstDateString(p.registeredAt || (p as any).createdAt || (p as any).created_at) === todayStr) {
        ids.add(p.id);
      }
    });
    return ids;
  }, [patients, refreshKey]);

  // Filtered patients list
  const filteredPatients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let list = patients;

    if (patientFilterTab === 'today_queue' && !query) {
      const todayList = patients.filter(p => todayOpdPatientIds.has(p.id));
      list = todayList.length > 0 ? todayList : patients;
    }

    if (!query) return list;

    return patients.filter(p => 
      (p.name || '').toLowerCase().includes(query) ||
      (p.phone || '').includes(query) ||
      (p.tokenNumber != null && String(p.tokenNumber).toLowerCase().includes(query))
    );
  }, [patients, searchQuery, patientFilterTab, todayOpdPatientIds]);

  // Catalog item search suggestions
  const catalogSuggestions = useMemo(() => {
    const query = manualItemSearchQuery.trim().toLowerCase();
    if (!query) return [];

    const matchedMeds = inventory
      .filter(m => (m.name || '').toLowerCase().includes(query) || (m.genericName || '').toLowerCase().includes(query))
      .slice(0, 5)
      .map(m => ({ id: m.id, name: m.name || 'Medicine Item', type: 'pharmacy' as const, price: m.price || 0, item: m }));

    const matchedTests = LabService.getTestCatalog()
      .filter(t => (t.name || '').toLowerCase().includes(query))
      .slice(0, 5)
      .map(t => ({ id: t.loincCode, name: t.name || 'Lab Test', type: 'lab' as const, price: t.price || 0, item: t }));

    return [...matchedMeds, ...matchedTests];
  }, [manualItemSearchQuery, inventory]);

  // Add selected item from catalog search
  const handleAddSuggestedItem = (s: any) => {
    if (s.type === 'pharmacy') {
      const med = s.item as PharmacyInventoryItem;
      const medName = med.name || 'Medicine';
      if (!manualMedicinesList.some(m => (m.name || '').toLowerCase() === medName.toLowerCase())) {
        setManualMedicinesList(prev => [...prev, {
          name: medName,
          mrp: med.mrp || 0,
          price: med.price || 0,
          batch: med.batchNumber || 'BATCH-01',
          stock: med.stock || 0
        }]);
      }
      setSelectedMedicines(prev => ({
        ...prev,
        [medName.toLowerCase()]: { selected: true, qty: 10 }
      }));
    } else {
      const test = s.item as DiagnosticTest;
      if (!manualTestsList.some(t => t.loincCode === test.loincCode)) {
        setManualTestsList(prev => [...prev, test]);
      }
      setSelectedTests(prev => ({
        ...prev,
        [test.loincCode]: true
      }));
    }
    setManualItemSearchQuery('');
  };

  // Voice Billing NLP Parser
  const parseVoiceCommand = (text: string) => {
    const textLower = (text || '').toLowerCase();
    
    // Help parse spoken numbers in English
    const numberWords: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
      eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20, thirty: 30, fifty: 50
    };

    const findQty = (sentence: string, defaultValue = 10): number => {
      const matchDigit = sentence.match(/\b\d+\b/);
      if (matchDigit) return parseInt(matchDigit[0], 10);
      
      for (const [word, val] of Object.entries(numberWords)) {
        if (sentence.includes(word)) return val;
      }
      return defaultValue;
    };

    const recognizedItems: string[] = [];

    // 1. Scan pharmacy catalog
    const newMedsList = [...manualMedicinesList];
    const newMedsRecord = { ...selectedMedicines };

    inventory.forEach(item => {
      const nameLower = (item.name || '').toLowerCase();
      const genericLower = item.genericName ? (item.genericName || '').toLowerCase() : '';
      
      if (nameLower && (textLower.includes(nameLower) || (genericLower && textLower.includes(genericLower)))) {
        if (!newMedsList.some(m => (m.name || '').toLowerCase() === nameLower)) {
          newMedsList.push({
            name: item.name,
            mrp: item.mrp,
            price: item.price,
            batch: item.batchNumber,
            stock: item.stock
          });
        }
        
        const qty = findQty(textLower);
        newMedsRecord[nameLower] = { selected: true, qty };
        recognizedItems.push(`${qty}x ${item.name}`);
      }
    });

    // 2. Scan lab tests catalog
    const newTestsList = [...manualTestsList];
    const newTestsRecord = { ...selectedTests };

    LabService.getTestCatalog().forEach(test => {
      const nameLower = (test.name || '').toLowerCase();
      if (nameLower && (textLower.includes(nameLower) || (textLower.includes('hba1c') && (test.name || '').includes('HbA1c')))) {
        if (!newTestsList.some(t => t.loincCode === test.loincCode)) {
          newTestsList.push(test);
        }
        newTestsRecord[test.loincCode] = true;
        recognizedItems.push(test.name);
      }
    });

    setManualMedicinesList(newMedsList);
    setSelectedMedicines(newMedsRecord);
    setManualTestsList(newTestsList);
    setSelectedTests(newTestsRecord);

    if (recognizedItems.length > 0) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Voice Billing Success! 🎤',
          message: `Successfully added: ${recognizedItems.join(', ')}`,
          type: 'success'
        }
      }));
    } else {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Voice Match Alert',
          message: 'No medicines/tests matched catalog names. Try: "Add Paracetamol" or "Add HbA1c test".',
          type: 'info'
        }
      }));
    }
  };

  // Start voice recognition
  const handleStartVoiceBilling = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { 
          title: 'Web Speech Not Supported', 
          message: 'Voice recognition is not supported in this browser. Please use Chrome or Safari.', 
          type: 'error' 
        }
      }));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-IN';
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceTranscript('Listening... Describe billing details now.');
    };

    recognition.onerror = (e: any) => {
      console.error('Speech recognition error:', e);
      setIsListening(false);
      setVoiceTranscript('Error capturing audio.');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (transcript) {
        setVoiceTranscript(`Transcribed: "${transcript}"`);
        parseVoiceCommand(transcript);
      }
    };

    recognition.start();
  };

  // Medicine & Test Selection Handlers
  const handleToggleMedicine = (medName: string, isChecked: boolean) => {
    const key = medName.toLowerCase();
    setSelectedMedicines(prev => ({
      ...prev,
      [key]: { selected: isChecked, qty: prev[key]?.qty ?? 10 }
    }));
  };

  const handleMedicineQtyChange = (medName: string, qty: number) => {
    const key = medName.toLowerCase();
    setSelectedMedicines(prev => ({
      ...prev,
      [key]: { selected: prev[key]?.selected ?? true, qty: Math.max(1, qty) }
    }));
  };

  const handleToggleTest = (loincCode: string, isChecked: boolean) => {
    setSelectedTests(prev => ({
      ...prev,
      [loincCode]: isChecked
    }));
  };

  // Active items mapping (syncing prices)
  const billingLedger = useMemo(() => {
    if (!selectedPatient) return null;

    let baseConsultFee = 500;
    const activeSop = BillingService.getActiveSop();
    if (activeSop?.extractedConfig?.doctor_fee) {
      baseConsultFee = activeSop.extractedConfig.doctor_fee;
    }

    const feeResult = PatientService.calculateDynamicOPDFee(selectedPatient.id);
    let consultFee = feeResult.amount;
    if (feeResult.type === 'First Visit') {
      consultFee = baseConsultFee;
    } else if (feeResult.type === 'Follow-up') {
      consultFee = Math.round(baseConsultFee * 0.4);
    }

    let medicinesList: Array<{ name: string; mrp: number; price: number; batch: string; stock: number }> = [];
    let testsList: DiagnosticTest[] = [];

    if (billingMode === 'digital') {
      const encounters = EncounterService.getEncounters()
        .filter(e => isEncounterMatchingPatient(e, selectedPatient))
        .sort((a, b) => new Date(b.createdAt || (b as any).created_at || 0).getTime() - new Date(a.createdAt || (a as any).created_at || 0).getTime());

      let saasPrescriptions: any[] = [];
      try {
        saasPrescriptions = (BillingService.getPrescriptions ? BillingService.getPrescriptions() : safeGetStorageJSON<any[]>('saas_prescriptions', []))
          .filter((r: any) => isEncounterMatchingPatient(r, selectedPatient))
          .sort((a: any, b: any) => new Date(b.createdAt || b.created_at || 0).getTime() - new Date(a.createdAt || a.created_at || 0).getTime());
      } catch (_rxErr) { /* ignore */ }

      const latest = encounters[0];
      const latestRx = saasPrescriptions[0];

      const rawMeds = (latest?.medications && latest.medications.length > 0)
        ? latest.medications
        : (latestRx?.extractedMedicines || latestRx?.extracted_medicines || latestRx?.medications || []);

      const rawTests = (latest?.diagnosticTests && latest.diagnosticTests.length > 0)
        ? latest.diagnosticTests
        : (latestRx?.extractedTests || latestRx?.extracted_tests || latestRx?.diagnosticTests || []);

      rawMeds.forEach((med: any) => {
        const medName = med.medicineName || med.name || 'Prescribed Medicine';
        const matched = inventory.find(i => (i.name || '').toLowerCase() === medName.toLowerCase() || (i.genericName || '').toLowerCase() === medName.toLowerCase());
        medicinesList.push({
          name: medName,
          mrp: matched?.mrp || 120,
          price: matched?.price || 100,
          batch: matched?.batchNumber || 'BATCH-01',
          stock: matched?.stock ?? 10
        });
      });

      rawTests.forEach((test: any) => {
        let testObj: any = test;
        if (typeof test === 'string') {
          const matched = LabService.getTestCatalog().find(t => (t.name || '').toLowerCase() === test.toLowerCase() || t.loincCode === test);
          testObj = matched || { loincCode: '4544-3', name: test, price: 350 };
        } else {
          const matched = LabService.getTestCatalog().find(t => t.loincCode === test.loincCode);
          if (matched && !testObj.price) testObj.price = matched.price;
        }
        testsList.push({
          loincCode: testObj.loincCode || '4544-3',
          name: testObj.name || 'Diagnostic Test',
          price: testObj.price || 350,
          category: testObj.category || 'General',
          normalRange: testObj.normalRange || '',
          unit: testObj.unit || ''
        });
      });
    } else {
      // Manual billing combines OCR + Manual list additions
      const combinedMeds = [...manualMedicinesList];
      const combinedTests = [...manualTestsList];

      if (manualExtractedData) {
        Object.entries(manualExtractedData.structured).forEach(([k, v]) => {
          const itemLower = (k || '').toLowerCase();
          // Bug Fix A: guard genericName — may be undefined for CSV-imported batches
          const matchedMed = inventory.find(i => (i.name || '').toLowerCase().includes(itemLower) || (i.genericName || '').toLowerCase().includes(itemLower));
          if (matchedMed) {
            if (!combinedMeds.some(m => (m.name || '').toLowerCase() === (matchedMed.name || '').toLowerCase())) {
              combinedMeds.push({
                name: matchedMed.name,
                mrp: matchedMed.mrp,
                price: matchedMed.price,
                batch: matchedMed.batchNumber,
                stock: matchedMed.stock
              });
            }
            return;
          }

          const matchedTest = LabService.getTestCatalog().find(t => (t.name || '').toLowerCase().includes(itemLower));
          if (matchedTest) {
            if (!combinedTests.some(t => t.loincCode === matchedTest.loincCode)) {
              combinedTests.push(matchedTest);
            }
            return;
          }

          // Fallback
          const priceNum = parseFloat((v || '').toString().replace(/[^0-9.]/g, '')) || 150;
          if (!combinedMeds.some(m => (m.name || '').toLowerCase() === itemLower)) {
            combinedMeds.push({
              name: k,
              mrp: priceNum + 20,
              price: priceNum,
              batch: 'GEN-01',
              stock: 10
            });
          }
        });
      }

      medicinesList = combinedMeds;
      testsList = combinedTests;
    }

    // Totals Calculation
    const consultTotal = includeConsult ? consultFee : 0;
    let pharmacySub = 0;
    let labSub = 0;

    medicinesList.forEach(m => {
      const mNameLower = (m.name || '').toLowerCase();
      const state = selectedMedicines[mNameLower];
      if (state?.selected) {
        pharmacySub += m.price * state.qty;
      }
    });

    testsList.forEach(t => {
      if (selectedTests[t.loincCode]) {
        labSub += t.price || 0;
      }
    });

    // Scheduled Minor OT / Daycare Surgery check
    let otItem: { name: string; price: number } | null = null;
    if (isOphthalmology) {
      if (selectedPatient.vitals?.surgeryBooking && selectedPatient.vitals.surgeryBooking.eye !== 'None') {
        const eyeBooking = selectedPatient.vitals.surgeryBooking;
        otItem = {
          name: `Cataract Surgery (${eyeBooking.eye} Eye) - ${eyeBooking.lensPackage} Lens Package`,
          price: eyeBooking.totalPrice || 15000
        };
      }
    } else {
      if (selectedPatient.vitals?.gpProcedureBooking && selectedPatient.vitals.gpProcedureBooking.procedure !== 'None') {
        const procBooking = selectedPatient.vitals.gpProcedureBooking;
        otItem = {
          name: `${procBooking.procedure} Daycare Procedure`,
          price: procBooking.price || 3500
        };
      }
    }
    const otTotal = (otItem && includeOT) ? otItem.price : 0;

    // Premium Club Membership checks
    const hasPharmacyItems = pharmacySub > 0;
    const hasLabTests = labSub > 0;
    const isQualifyingFirstPurchase = hasPharmacyItems && hasLabTests && !selectedPatient.isPremiumMember;
    const isRefillPurchase = selectedPatient.isPremiumMember === true;

    // 10% discount on refills only (applied on pharmacy subtotal)
    const pharmacyDiscount = isRefillPurchase ? parseFloat((pharmacySub * 0.1).toFixed(2)) : 0;
    
    // USP #6: B2B Referral Reward Engine (10% OFF automatically deducting from checkup and medicine bills)
    const isValidReferral = referralCode && /^REF-[A-Z0-9]{4}$/i.test(referralCode.trim());
    const b2bReferralDiscount = isValidReferral ? parseFloat(((consultTotal + pharmacySub + labSub) * 0.1).toFixed(2)) : 0;

    const totalDiscount = pharmacyDiscount + b2bReferralDiscount + discountInput;

    // Bug Fix #7: Align pharmacy GST to 5% (matches PharmacyDashboard and Indian GST for essential medicines)
    // Lab diagnostic services attract 18% GST as per Indian GST Schedule
    const pharmGst = parseFloat((pharmacySub * 0.05).toFixed(2));
    const labGst = parseFloat((labSub * 0.18).toFixed(2));
    const totalGst = parseFloat((pharmGst + labGst).toFixed(2));

    const totalBeforeDiscount = consultTotal + pharmacySub + labSub + otTotal + totalGst;
    const finalTotal = Math.max(0, parseFloat((totalBeforeDiscount - totalDiscount).toFixed(2)));

    return {
      consultFee,
      medicinesList,
      testsList,
      consultTotal,
      pharmacySub,
      labSub,
      otItem,
      otTotal,
      pharmacyDiscount,
      b2bReferralDiscount,
      totalDiscount,
      pharmGst,
      labGst,
      totalGst,
      finalTotal,
      isRefillPurchase,
      isQualifyingFirstPurchase
    };
  }, [selectedPatient, billingMode, manualExtractedData, manualMedicinesList, manualTestsList, includeConsult, includeOT, selectedMedicines, selectedTests, discountInput, referralCode, inventory, isOphthalmology, refreshKey]);
  const handleClearBill = async () => {
    if (!selectedPatient || !billingLedger) return;
    setIsClearing(true);

    try {
      // 1. Always create & save a UnifiedInvoice for the full consolidated bill (Consult + Pharmacy + Lab + OT)
      const unifiedInvoiceId = `inv-${crypto.randomUUID().substring(0, 8)}`;
      const isPureCounterConsult = billingLedger.pharmacySub === 0 && billingLedger.labSub === 0 && billingLedger.otTotal === 0;

      // Find target appointment if one exists for this patient
      const saasInvoices = BillingService.getInvoices();
      const consultInvoice = saasInvoices.find(
        (i: any) => i.patientId === selectedPatient.id && i.type === 'consult' && (i.status === 'unpaid' || i.status === 'pending')
      );
      const appts = BillingService.getAppointments();
      const targetAppt = appts.find(a => (consultInvoice && a.id === consultInvoice.appointmentId) || (a.patientId === selectedPatient.id && a.status !== 'completed' && a.status !== 'cancelled'));
      const linkedApptId = targetAppt?.id || consultInvoice?.appointmentId || 'counter-checkout';

      const newUnifiedInvoice: UnifiedInvoice = {
        id: unifiedInvoiceId,
        encounterId: linkedApptId,
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        patientPhone: selectedPatient.phone,
        doctorFee: billingLedger.consultTotal,
        labFee: billingLedger.labSub,
        pharmacyFee: billingLedger.pharmacySub,
        platformFee: isPureCounterConsult ? 0 : parseFloat(((billingLedger.labSub * 0.05) + (billingLedger.pharmacySub * 0.02)).toFixed(2)),
        totalAmount: billingLedger.finalTotal,
        upiQrPayload: dynamicUpiPayload || PaymentService.generateDirectUpiPayload(billingLedger.finalTotal, unifiedInvoiceId).upiDeepLink,
        referralCode: referralCode ? referralCode.trim().toUpperCase() : undefined,
        referralDiscount: (billingLedger.b2bReferralDiscount || 0) > 0 ? billingLedger.b2bReferralDiscount : undefined,
        paymentStatus: 'cleared',
        paymentMethod: paymentMethod,
        createdAt: new Date().toISOString()
      };
      if (linkedApptId !== 'counter-checkout') {
        (newUnifiedInvoice as any).appointmentId = linkedApptId;
      }
      BillingService.saveUnifiedInvoice(newUnifiedInvoice);

      // 2. Clear existing consultation invoice if any
      if (consultInvoice) {
        consultInvoice.status = 'paid';
        consultInvoice.paymentMethod = paymentMethod;
        BillingService.saveInvoice(consultInvoice);

        // Confirm appointment status — MUST set payment_status = 'cleared' to enforce payment gate (USP 3)
        if (targetAppt) {
          targetAppt.status = 'ready_for_consult';
          targetAppt.payment_status = 'cleared';
          BillingService.saveAppointments(appts);
          supabase.from('appointments').update({ status: 'ready_for_consult', payment_status: 'cleared' }).eq('id', targetAppt.id).then(() => {});
        }
      }

      // 3. Clear the unified invoice (triggers 3% platform fee split, commission pool refill, and financial ledgers)
      BillingService.clearInvoice(unifiedInvoiceId, paymentMethod);

      // 4. Deduct pharmacy inventory stock for selected medicines and create MedicineBill
      if (billingLedger.pharmacySub > 0) {
        const activeInventory = PharmacyService.getPharmacyInventory();
        const billItems: any[] = [];
        let invUpdated = false;
        
        billingLedger.medicinesList.forEach(m => {
          const mNameLower = (m.name || '').toLowerCase();
          const state = selectedMedicines[mNameLower];
          if (state?.selected) {
            const itemInInv = activeInventory.find(inv => (inv.name || '').toLowerCase() === mNameLower);
            if (itemInInv) {
              itemInInv.stock = Math.max(0, itemInInv.stock - state.qty);
              invUpdated = true;
              billItems.push({
                inventoryItemId: itemInInv.id,
                name: itemInInv.name,
                batchNumber: itemInInv.batchNumber,
                expiryDate: itemInInv.expiryDate,
                quantity: state.qty,
                mrp: itemInInv.mrp,
                sellingPrice: itemInInv.price,
                lineTotal: itemInInv.price * state.qty
              });
            }
          }
        });
        
        if (invUpdated) {
          PharmacyService.savePharmacyInventory(activeInventory);
          
          // Dispatch to Pharmacy POS!
          const newMedicineBill = {
            id: `medbill-${crypto.randomUUID().substring(0, 8)}`,
            patientId: selectedPatient.id,
            patientName: selectedPatient.name,
            patientPhone: selectedPatient.phone,
            items: billItems,
            subtotal: billingLedger.pharmacySub,
            loyaltyDiscountPercent: 0,
            loyaltyDiscountAmount: 0,
            itemDiscountAmount: 0,
            gstAmount: parseFloat((billingLedger.pharmacySub * 0.05).toFixed(2)),
            totalAmount: billingLedger.pharmacySub,
            paymentMode: paymentMethod,
            status: 'paid', // Already paid at counter
            source: 'counter',
            createdAt: new Date().toISOString()
          };
          PharmacyService.saveMedicineBill(newMedicineBill as any).catch(err => console.warn('[BillHubTab] Pharmacy dispatch failed', err));
        }
      }

      // 5. Update linked Lab Requisitions to paid/cleared
      if (billingLedger.labSub > 0) {
        const reqs = LabService.getLabRequisitions();
        let reqsUpdated = false;
        reqs.forEach(r => {
          if (r.patientId === selectedPatient.id && r.status !== 'completed') {
            (r as any).isPaid = true;
            (r as any).paymentStatus = 'cleared';
            reqsUpdated = true;
          }
        });
        if (reqsUpdated) {
          LabService.saveLabRequisitions(reqs);
        }
      }

      // 6. Update linked Inventory Holds to ready for dispensing / cleared
      if (billingLedger.pharmacySub > 0) {
        const holds = PharmacyService.getInventoryHolds();
        let holdsUpdated = false;
        holds.forEach(h => {
          if (h.patientId === selectedPatient.id && h.holdStatus === 'held') {
            (h as any).isPaid = true;
            (h as any).paymentStatus = 'cleared';
            holdsUpdated = true;
          }
        });
        if (holdsUpdated) {
          save('inventory_holds', holds);
        }
      }

      // 7. Premium Club Eligibility Check: Unlocked ONLY when both Partner Pharmacy and Partner Pathology are billed on platform
      const hasPharmacyInThisBill = billingLedger.pharmacySub > 0;
      const hasLabInThisBill = billingLedger.labSub > 0;
      const priorEligibility = BillingService.checkPatientFreeVirtualEligibility(selectedPatient.id);
      const isEligibleNow = (priorEligibility.hasPharmacyBilled || hasPharmacyInThisBill) && (priorEligibility.hasLabBilled || hasLabInThisBill);

      if (isEligibleNow && (!selectedPatient.isPremiumMember || priorEligibility.isEligible !== true)) {
        PatientService.updatePatientPremiumStatus(selectedPatient.id, true);
        const rawDocName = activePod?.doctor_name || 'our doctor';
        const docTitle = (rawDocName.startsWith('Dr.') || rawDocName.startsWith('dr.')) ? rawDocName : `Dr. ${rawDocName}`;
        const clinicTitle = activePod?.name || activeProfile?.clinicName || 'Clinic';

        ClinicalNotificationService.dispatchFreeFollowupLoyaltyWhatsApp({
          patientPhone: selectedPatient.phone,
          patientName: selectedPatient.name,
          doctorName: docTitle,
          clinicName: clinicTitle,
          expiryDays: 30
        }).catch(err => console.warn('[BillHubTab] Loyalty WhatsApp dispatch notice:', err));
        
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: { 
            title: '1 Free Virtual Consult Unlocked! 🌟', 
            message: `${selectedPatient.name} completed both Partner Pharmacy & Pathology billing! 1 Free Virtual Consult unlocked.`, 
            type: 'success' 
          }
        }));
      } else if (!isEligibleNow) {
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            title: 'Payment Succeeded 🧾',
            message: `Invoice settled. (Note: 1 Free Virtual Consult unlocks when BOTH medicines & lab tests are billed on platform).`,
            type: 'info'
          }
        }));
      }

      // 8. Dispatch Digital Invoice — Hinglish bill via PaperModeService (Meta Graph API + local bot)
      PaperModeService.dispatchBillWhatsApp({
        patientPhone: selectedPatient.phone,
        patientName: selectedPatient.name,
        clinicName: activePod?.name || activeProfile?.clinicName || 'VitalSync Clinic',
        consultTotal: billingLedger.consultTotal,
        pharmacySub: billingLedger.pharmacySub,
        labSub: billingLedger.labSub,
        finalTotal: billingLedger.finalTotal
      });
      const medListText = (billingLedger.medicinesList || [])
        .filter(m => selectedMedicines[(m?.name || '').toLowerCase()]?.selected)
        .map(m => {
          const freq = (m as any).frequency || (m as any).freq || '1-0-1';
          const dur = (m as any).duration || (m as any).dur || '10 Days';
          const instr = (m as any).instructions || (m as any).dosage || 'Take after meals';
          return `- *${m.name || 'Medicine'}*: ${freq} for ${dur} (${instr}).`;
        })
        .join('\n');
      // Push local bot copy as well (for WhatsApp chat panel display)
      const invoiceMsg = `Hi ${selectedPatient.name}! 🧾 Aapka Bill settle ho gaya hai.\n\n*Amount Paid:* ₹${billingLedger.finalTotal.toFixed(2)} (${paymentMethod.toUpperCase()})\n\n🔗 *Invoice Link:* https://app.vitalsync.in/invoices/${unifiedInvoiceId}\n\n${medListText ? `*Medication Refill & Dosage Guide:*\n${medListText}` : ''}\n\nTake care & stay healthy! 🏥`;
      WhatsAppService.pushWhatsAppMessageFromBot(selectedPatient.phone, invoiceMsg);

      // 8.1. Automated Dosage Delivery & Supabase Dosage Schedules Dispatch
      if (selectedPatient.phone && (billingLedger.medicinesList || []).length > 0) {
        const activeMedsForDosage = (billingLedger.medicinesList || [])
          .filter(m => selectedMedicines[(m?.name || '').toLowerCase()]?.selected)
          .map(m => ({
            medicineName: m.name,
            dosage: (m as any).dosage || '1 Tab',
            frequency: (m as any).frequency || (m as any).freq || '1-0-1',
            duration: (m as any).duration || (m as any).dur || '10 Days',
            instructions: (m as any).instructions || 'Take with water after meals'
          }));

        if (activeMedsForDosage.length > 0) {
          ClinicalNotificationService.dispatchPrescriptionDosageWhatsApp({
            patientPhone: selectedPatient.phone,
            patientName: selectedPatient.name,
            doctorName: activePod?.doctor_name || 'Dr. Attending Physician',
            clinicName: activePod?.name || activeProfile?.clinicName || 'VitalSync Clinic',
            medications: activeMedsForDosage,
            clinicalNotes: 'Prescription settled and verified at Pharmacy Counter'
          }).catch(err => console.warn('[BillHubTab] Prescription dosage WhatsApp dispatch notice:', err));
        }
      }

      // 9. Dispatch state change event for instant 360-degree CDC update across consoles
      window.dispatchEvent(new CustomEvent('mediflow-state-change', {
        detail: {
          entity: 'billing',
          patientId: selectedPatient.id,
          invoiceId: unifiedInvoiceId,
          paymentStatus: 'cleared'
        }
      }));
      window.dispatchEvent(new CustomEvent('mediflow-chronic-update', {
        detail: { patientId: selectedPatient.id }
      }));

      setRefreshKey(prev => prev + 1);

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { title: 'Bill Settled & WhatsApp Sent! 🧾📱', message: `Invoice amount of ₹${billingLedger.finalTotal.toFixed(2)} received via ${paymentMethod.toUpperCase()}. Digital bill sent to patient WhatsApp!`, type: 'success' }
      }));

      setSelectedPatient(null);
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { title: 'Checkout Error', message: 'Could not settle invoice.', type: 'error' }
      }));
    } finally {
      setIsClearing(false);
    }
  };


  const dynamicUpiPayload = billingLedger
    ? `upi://pay?pa=${activePod?.upiVpa || 'vitalsync@axl'}&pn=${encodeURIComponent(activePod?.name || 'VitalSync Smart Clinic')}&am=${(billingLedger.finalTotal || 0).toFixed(2)}&cu=INR&tn=BillHub-${(selectedPatient?.id || 'pat-0000').substring(0, 8)}`
    : '';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Patient Selection */}
        <div className="lg:col-span-3 glass-panel p-5 bg-white dark:bg-clinical-900/40 border-slate-200/80 shadow-sm rounded-2xl flex flex-col h-[calc(100vh-140px)]">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
            <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-500" />
              Patient Selection
            </h3>
          </div>
          
          <SearchInput 
            value={searchQuery} 
            onChange={setSearchQuery} 
            placeholder="Search patients..." 
            className="mb-4"
          />

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredPatients.length === 0 ? (
              <div className="text-center p-4 text-slate-400 text-xs">No patients found.</div>
            ) : (
              filteredPatients.map(p => (
                <div 
                  key={p.id}
                  onClick={() => setSelectedPatient(p)}
                  className={`p-3 rounded-xl cursor-pointer border transition-all ${
                    selectedPatient?.id === p.id 
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                      : 'border-slate-100 dark:border-slate-800 hover:border-indigo-300'
                  }`}
                >
                  <div className="font-bold text-sm text-slate-900 dark:text-white">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.phone}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* MIDDLE COLUMN: Cart / Auto-Populated Items */}
        <div className="lg:col-span-5 glass-panel p-5 bg-white dark:bg-clinical-900/40 border-slate-200/80 shadow-sm rounded-2xl flex flex-col h-[calc(100vh-140px)]">
          {!selectedPatient ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <CreditCard className="h-12 w-12 mb-3 opacity-20" />
              <p>Select a patient to generate invoice</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-500" />
                  Itemized Cart
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                {/* Consult Fee */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Stethoscope className="h-5 w-5 text-indigo-500" />
                    <div>
                      <div className="font-bold text-sm">Doctor Consultation</div>
                      <div className="text-xs text-slate-500">Standard OPD Fee</div>
                    </div>
                  </div>
                  <div className="font-bold">₹{billingLedger?.consultFee || 0}</div>
                </div>

                {/* Pharmacy Items */}
                {billingLedger?.medicinesList.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 ml-1">Pharmacy Prescriptions (Auto-Synced)</h4>
                    <div className="space-y-2">
                      {billingLedger.medicinesList.map((med: any, i: number) => {
                        const isSelected = selectedMedicines[med.name.toLowerCase()]?.selected;
                        return (
                          <div key={i} className={`p-3 rounded-xl border flex items-center justify-between ${isSelected ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="flex items-center gap-3">
                              <input 
                                type="checkbox" 
                                checked={!!isSelected}
                                onChange={(e) => setSelectedMedicines(prev => ({ ...prev, [med.name.toLowerCase()]: { selected: e.target.checked, qty: prev[med.name.toLowerCase()]?.qty || 10 } }))}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <div>
                                <div className="font-bold text-sm">{med.name}</div>
                                <div className="text-xs text-slate-500">₹{med.price} / unit</div>
                              </div>
                            </div>
                            {isSelected && (
                              <input 
                                type="number" 
                                className="w-16 p-1 text-sm border rounded bg-white text-center"
                                value={selectedMedicines[med.name.toLowerCase()]?.qty || 10}
                                onChange={(e) => setSelectedMedicines(prev => ({ ...prev, [med.name.toLowerCase()]: { selected: true, qty: parseInt(e.target.value) || 0 } }))}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Lab Tests */}
                {billingLedger?.testsList.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 ml-1">Pathology Tests (Auto-Synced)</h4>
                    <div className="space-y-2">
                      {billingLedger.testsList.map((test: any, i: number) => {
                        const isSelected = selectedTests[test.loincCode];
                        return (
                          <div key={i} className={`p-3 rounded-xl border flex items-center justify-between ${isSelected ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="flex items-center gap-3">
                              <input 
                                type="checkbox" 
                                checked={!!isSelected}
                                onChange={(e) => setSelectedTests(prev => ({ ...prev, [test.loincCode]: e.target.checked }))}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <div>
                                <div className="font-bold text-sm">{test.name}</div>
                              </div>
                            </div>
                            <div className="font-bold text-sm">₹{test.price}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* RIGHT COLUMN: Financial Summary & Checkout */}
        <div className="lg:col-span-4 glass-panel p-5 bg-gradient-to-br from-indigo-900 to-slate-900 text-white shadow-xl rounded-2xl flex flex-col h-[calc(100vh-140px)]">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-indigo-200">
              <Receipt className="h-4 w-4" />
              Final Settlement
            </h3>
          </div>

          {!selectedPatient || !billingLedger ? (
            <div className="flex-1 flex items-center justify-center text-white/40 text-sm">
              Pending Patient Selection
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="space-y-3 flex-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Consultation</span>
                  <span>₹{billingLedger.consultTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Pharmacy</span>
                  <span>₹{billingLedger.pharmacySub.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Pathology</span>
                  <span>₹{billingLedger.labSub.toFixed(2)}</span>
                </div>
                <div className="h-px bg-white/10 my-2" />
                <div className="flex justify-between text-sm text-rose-400">
                  <span>Discounts</span>
                  <span>-₹{billingLedger.totalDiscount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-400">
                  <span>GST (5% & 18%)</span>
                  <span>+₹{billingLedger.totalGst.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-white/10">
                <div className="flex justify-between items-end mb-6">
                  <span className="text-sm font-bold text-slate-300">Total Payable</span>
                  <span className="text-3xl font-black text-emerald-400">₹{billingLedger.finalTotal.toFixed(2)}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button 
                    onClick={() => setPaymentMethod('upi')}
                    className={`py-3 rounded-xl text-sm font-bold transition-all ${paymentMethod === 'upi' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
                  >
                    UPI / QR
                  </button>
                  <button 
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-3 rounded-xl text-sm font-bold transition-all ${paymentMethod === 'cash' ? 'bg-emerald-500 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
                  >
                    Cash
                  </button>
                </div>

                <button 
                  onClick={handleClearBill}
                  disabled={isClearing}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-white font-black text-lg shadow-lg hover:shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isClearing ? 'Clearing...' : 'Submit & Send Invoice'}
                  {!isClearing && <Send className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
