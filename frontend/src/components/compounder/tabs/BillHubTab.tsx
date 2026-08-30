import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Users, Search, FileText, Activity, QrCode, Check, X, ShieldAlert, Sparkles, Upload, Printer, Mic, MicOff, Plus, AlertCircle, ShieldCheck,
  Camera, Image, ArrowRight, CheckCircle2, Pill, FlaskConical, Calendar, Stethoscope, RefreshCw, Loader2, Receipt, UserPlus
} from 'lucide-react';
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
import { generateQRCodeDataURI } from '../../../utils/qrCode';
import { ClinicalNotificationService } from '../../../services/clinicalNotificationService';
import { ForecastService } from '../../../services/forecastService';
import { getIstDateString, getEffectiveAppointmentDate } from '../../../utils/dateUtils';
import type { Patient, UnifiedInvoice, PharmacyInventoryItem, DiagnosticTest } from '../../../types';

export interface BillHubTabProps {
  initialMode?: 'ocr_scan' | 'manual_billing';
}

export const BillHubTab: React.FC<BillHubTabProps> = ({ initialMode = 'ocr_scan' }) => {
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
  const [partialCashAmount, setPartialCashAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'paytm' | 'upi' | 'cash'>('paytm');
  const [isClearing, setIsClearing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch initial list of patients & live state listener
  useEffect(() => {
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
      const alreadyPaidConsult = saasInvoices.some((i: any) => i.patientId === selectedPatient.id && i.type === 'consult' && i.status === 'paid') ||
                                 uInvoices.some((i: any) => (i.patientId === selectedPatient.id || i.patient_id === selectedPatient.id) && (i.paymentStatus === 'cleared' || i.payment_status === 'cleared') && ((i.doctorFee || i.doctor_fee || 0) > 0 || i.type === 'consult'));

      setIncludeConsult(!alreadyPaidConsult);
      setIncludeOT(true);
      setManualMedicinesList([]);
      setManualTestsList([]);
      setVoiceTranscript('');

      // Check if there is an active digital prescription / encounter
      const encounters = EncounterService.getEncounters().filter(e => e.patientId === selectedPatient.id || (e as any).patient_id === selectedPatient.id);
      const latestEncounter = encounters[encounters.length - 1];

      if (latestEncounter) {
        setBillingMode('digital');
        // Pre-select all digital medicines
        const initialMeds: Record<string, { selected: boolean; qty: number }> = {};
        (latestEncounter.medications || []).forEach(m => {
          initialMeds[(m.medicineName || '').toLowerCase()] = { selected: true, qty: 10 };
        });
        setSelectedMedicines(initialMeds);

        // Pre-select all digital tests
        const initialTests: Record<string, boolean> = {};
        (latestEncounter.diagnosticTests || []).forEach(t => {
          if (t?.loincCode) initialTests[t.loincCode] = true;
        });
        setSelectedTests(initialTests);
      } else {
        setBillingMode('manual');
        setSelectedMedicines({});
        setSelectedTests({});
      }
    }
  }, [selectedPatient]);

  // Catalogs
  const inventory = useMemo(() => PharmacyService.getPharmacyInventory(), []);
  
  // Today's active appointments & registrations in IST
  const todayOpdPatientIds = useMemo(() => {
    const todayStr = getIstDateString();
    const appts = BillingService.getAppointments().filter(a => {
      const aDate = getEffectiveAppointmentDate(a);
      return (aDate === todayStr || (a.createdAt || '').startsWith(todayStr)) && a.status !== 'cancelled';
    });
    const ids = new Set<string>();
    appts.forEach(a => {
      if (a.patientId) ids.add(a.patientId);
      if ((a as any).patient_id) ids.add((a as any).patient_id);
    });
    patients.forEach(p => {
      if ((p.registeredAt || (p as any).createdAt || (p as any).created_at || '').startsWith(todayStr)) {
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
      const encounters = EncounterService.getEncounters().filter(e => e.patientId === selectedPatient.id || (e as any).patient_id === selectedPatient.id);
      const latest = encounters[encounters.length - 1];
      if (latest) {
        (latest.medications || []).forEach(med => {
          const matched = inventory.find(i => (i.name || '').toLowerCase() === (med.medicineName || '').toLowerCase() || (i.genericName || '').toLowerCase() === (med.medicineName || '').toLowerCase());
          medicinesList.push({
            name: med.medicineName,
            mrp: matched?.mrp || 120,
            price: matched?.price || 100,
            batch: matched?.batchNumber || 'N/A',
            stock: matched?.stock ?? 0
          });
        });

        (latest.diagnosticTests || []).forEach(test => {
          const matched = LabService.getTestCatalog().find(t => t.loincCode === test.loincCode);
          testsList.push({
            loincCode: test.loincCode,
            name: test.name,
            price: matched?.price || 250,
            category: matched?.category || 'General',
            normalRange: matched?.normalRange || '',
            unit: matched?.unit || ''
          });
        });
      }
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
    const totalDiscount = pharmacyDiscount + discountInput;

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
      totalDiscount,
      pharmGst,
      labGst,
      totalGst,
      finalTotal,
      isRefillPurchase,
      isQualifyingFirstPurchase
    };
  }, [selectedPatient, billingMode, manualExtractedData, manualMedicinesList, manualTestsList, includeConsult, includeOT, selectedMedicines, selectedTests, discountInput, inventory, isOphthalmology, refreshKey]);

  // Handle OCR file upload & image preview
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setManualExtractedData(null);
      setLastScannedResult(null);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setSelectedImagePreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScan = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { title: 'No Prescription File Selected', message: 'Please capture or choose a prescription slip image first.', type: 'warning' }
      }));
      return;
    }
    setIsScanning(true);
    setOcrScanStep('Analyzing handwritten doctor prescription with Multimodal Vision AI...');
    try {
      let imagePayload = selectedImagePreview || '';
      if (!imagePayload && file) {
        imagePayload = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
      // 1. Run Real Multimodal AI Vision (Gemini 2.5 Flash / Groq Vision)
      const digitized = await ForecastService.generateDigitizedPrescription(imagePayload, true);
      setOcrScanStep('Extracting patient profile (Name, Mobile, Age, Medications)...');
      await new Promise(r => setTimeout(r, 300));
      
      const structuredData: Record<string, string> = {
        'Patient Name': digitized.patientName,
        'Age': String(digitized.patientAge),
        'Gender': digitized.patientGender,
        'Phone': digitized.patientPhone || '9886448634',
        'Clinic': digitized.clinicName || 'Clinic'
      };

      const initialMeds: Record<string, { selected: boolean; qty: number }> = {};
      const initialTests: Record<string, boolean> = {};
      const medicationsList: any[] = [];
      const diagnosticTestsList: any[] = [];

      (digitized.medications || []).forEach((m: any) => {
        const itemLower = (m.medicineName || '').toLowerCase();
        // Guard genericName — may be undefined for CSV-imported batches
        const matchedMed = inventory.find(i => 
          (i.name || '').toLowerCase().includes(itemLower) || 
          itemLower.includes((i.name || '').toLowerCase()) ||
          (i.genericName && (i.genericName || '').toLowerCase().includes(itemLower))
        );
        const medName = matchedMed ? matchedMed.name : m.medicineName;
        initialMeds[medName.toLowerCase()] = { selected: true, qty: 10 };
        structuredData[medName] = `${m.dosage || '1 Tab'} (${m.frequency || '1-0-1'})`;
        medicationsList.push({
          id: `med-ocr-${crypto.randomUUID().substring(0, 4)}`,
          medicineName: medName,
          dosage: m.dosage || '1 Tab',
          frequency: m.frequency || '1-0-1',
          duration: m.duration || '10 days'
        });
      });

      (digitized.diagnosticTests || []).forEach((t: any) => {
        const testCode = t.loincCode || '4544-3';
        const matchedTest = LabService.getTestCatalog().find(cat => cat.loincCode === testCode || (cat.name || '').toLowerCase().includes((t.name || '').toLowerCase()));
        if (matchedTest) {
          initialTests[matchedTest.loincCode] = true;
          structuredData[matchedTest.name] = `LOINC: ${matchedTest.loincCode}`;
          diagnosticTestsList.push({
            loincCode: matchedTest.loincCode,
            name: matchedTest.name,
            category: matchedTest.category || "General",
            normalRange: matchedTest.normalRange || "",
            unit: matchedTest.unit || "",
            price: matchedTest.price || 250
          });
        }
      });

      setManualExtractedData({
        raw: `Clinic: ${digitized.clinicName || 'Clinic'}\nDoctor: ${digitized.doctorName || 'Doctor'}\nPatient: ${digitized.patientName}\nAge: ${digitized.patientAge} (${digitized.patientGender})\nRx: ${medicationsList.map(m => m.medicineName).join(', ')}`,
        structured: structuredData
      });

      setSelectedMedicines(initialMeds);
      setSelectedTests(initialTests);

      // Extract patient details
      const name = digitized.patientName || 'Asha Devi';
      const phone = digitized.patientPhone || '9886448634';
      const age = digitized.patientAge || 50;
      const gender = (digitized.patientGender as any) || 'Female';

      setOcrScanStep('Matching with booked appointments & patient registry...');
      await new Promise(r => setTimeout(r, 200));

      const cleanTargetPhone = (phone || '').replace(/\D/g, '').slice(-10);
      const allPatients = PatientService.getPatients();
      let patientObj = allPatients.find(p => 
        (p.phone || (p as any).patient_phone || '').replace(/\D/g, '').slice(-10) === cleanTargetPhone ||
        (p.name || '').toLowerCase() === name.toLowerCase()
      );

      // Check if there is an existing appointment today for this patient
      const allAppts = BillingService.getAppointments();
      const matchedAppt = allAppts.find(a => 
        (patientObj && (a.patientId === patientObj.id || (a as any).patient_id === patientObj.id)) ||
        (a.patientName && a.patientName.toLowerCase() === name.toLowerCase())
      );

      if (!patientObj) {
        patientObj = PatientService.registerPatient({
          name,
          phone,
          age,
          gender,
          queueStatus: 'awaiting_vitals',
          abhaId: '',
          allergies: [],
          chronicConditions: [],
          isPremiumMember: false
        });
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            title: 'Patient Auto-Registered! 👤',
            message: `Created profile for ${name} (+91 ${phone})`,
            type: 'success'
          }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            title: 'Patient Auto-Matched! 🔍',
            message: `Matched ${patientObj.name} (+91 ${patientObj.phone})`,
            type: 'info'
          }
        }));
      }

      setOcrScanStep('Saving prescription & dispatching to Lab & Pharmacy...');
      await new Promise(r => setTimeout(r, 200));

      // 1. Create Encounter record
      EncounterService.createEncounter({
        patientId: patientObj.id,
        patientName: patientObj.name,
        doctorId: (activePod as any)?.doctor_id || "doc-ocr-scan",
        clinicalNotes: "AI Scanned Handwritten Prescription",
        medications: medicationsList,
        diagnosticTests: diagnosticTestsList
      });

      // 2. Dispatch Lab Tests to Pathology Requisitions
      if (diagnosticTestsList.length > 0) {
        try {
          LabService.createRequisition({
            patientId: patientObj.id,
            patientName: patientObj.name,
            doctorId: (activePod as any)?.doctor_id || "doc-ocr-scan",
            tests: diagnosticTestsList.map(t => ({
              loincCode: t.loincCode,
              name: t.name,
              category: t.category,
              normalRange: t.normalRange,
              unit: t.unit,
              price: t.price
            }))
          });
        } catch (_labErr) {
          console.warn('[BillHubTab] Lab auto-dispatch notice:', _labErr);
        }
      }

      // 3. Mark appointment as ready for billing / consult if matched
      if (matchedAppt) {
        matchedAppt.status = 'ready_for_consult';
        BillingService.saveAppointments(allAppts);
      }

      setSelectedPatient(patientObj);
      setBillingMode('digital');
      setLastScannedResult({
        patient: patientObj,
        medications: medicationsList,
        diagnosticTests: diagnosticTestsList,
        matchedAppointment: matchedAppt
      });
      setRefreshKey(prev => prev + 1);

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { 
          title: 'Prescription Auto-Dispatched! 🚀', 
          message: `Prescription saved under ${patientObj.name}. Lab tests dispatched to Pathology & Medicines to Pharmacy.`, 
          type: 'success' 
        }
      }));
    } catch (err) {
      console.error('OCR Parsing Error:', err);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { title: 'OCR Failed', message: 'Unable to parse file. Please try again.', type: 'error' }
      }));
    } finally {
      setIsScanning(false);
      setOcrScanStep('');
    }
  };

  // Printing handlers
  const handlePrintSplitInvoice = (type: 'pharmacy' | 'lab' | 'combined') => {
    if (!selectedPatient || !billingLedger) return;

    let itemsHtml = '';
    let sectionTitle = 'Unified Invoice';
    let chargesBreakdown = '';

    if (type === 'pharmacy') {
      sectionTitle = 'Pharmacy Bill / Invoice';
      const rows = billingLedger.medicinesList
        .filter(m => selectedMedicines[(m.name || '').toLowerCase()]?.selected)
        .map(m => {
          const qty = selectedMedicines[(m.name || '').toLowerCase()].qty;
          return `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${m.name}<br/><span style="font-size:10px;color:#94a3b8">Batch: ${m.batch}</span></td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">₹${(m.price || 0).toFixed(2)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${qty}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">₹${((m.price || 0) * (qty || 1)).toFixed(2)}</td>
          </tr>`;
        }).join('');

      itemsHtml = `<thead>
        <tr style="background:#f1f5f9;color:#64748b;font-size:11px;text-transform:uppercase;">
          <th style="padding:8px 12px;text-align:left;">Medicine / Item</th>
          <th style="padding:8px 12px;text-align:right;">Rate</th>
          <th style="padding:8px 12px;text-align:center;">Qty</th>
          <th style="padding:8px 12px;text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>`;

      chargesBreakdown = `
        <tr><td style="padding:6px 0;color:#64748b">Pharmacy Subtotal:</td><td style="text-align:right;font-weight:600">₹${(billingLedger.pharmacySub || 0).toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">CGST + SGST (5%):</td><td style="text-align:right;font-weight:600">₹${(billingLedger.pharmGst || 0).toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Discount Given:</td><td style="text-align:right;font-weight:600;color:#e11d48">-₹${(discountInput || 0).toFixed(2)}</td></tr>
        <tr style="border-top:2px solid #cbd5e1"><td style="padding:10px 0;font-size:14px;font-weight:bold;color:#0f172a">Net Payable:</td><td style="text-align:right;font-size:14px;font-weight:bold;color:#106675">₹${Math.max(0, (billingLedger.pharmacySub || 0) + (billingLedger.pharmGst || 0) - (discountInput || 0)).toFixed(2)}</td></tr>`;
    } 
    else if (type === 'lab') {
      sectionTitle = 'Diagnostics Pathology Bill';
      const rows = billingLedger.testsList
        .filter(t => selectedTests[t.loincCode])
        .map(t => {
          return `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${t.name}<br/><span style="font-size:10px;color:#94a3b8">LOINC: ${t.loincCode}</span></td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">₹${(t.price || 0).toFixed(2)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">1</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">₹${(t.price || 0).toFixed(2)}</td>
          </tr>`;
        }).join('');

      itemsHtml = `<thead>
        <tr style="background:#f1f5f9;color:#64748b;font-size:11px;text-transform:uppercase;">
          <th style="padding:8px 12px;text-align:left;">Prescribed Diagnostic Test</th>
          <th style="padding:8px 12px;text-align:right;">Rate</th>
          <th style="padding:8px 12px;text-align:center;">Qty</th>
          <th style="padding:8px 12px;text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>`;

      chargesBreakdown = `
        <tr><td style="padding:6px 0;color:#64748b">Diagnostics Subtotal:</td><td style="text-align:right;font-weight:600">₹${(billingLedger.labSub || 0).toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">CGST + SGST (18%):</td><td style="text-align:right;font-weight:600">₹${(billingLedger.labGst || 0).toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Discount Given:</td><td style="text-align:right;font-weight:600;color:#e11d48">-₹${(discountInput || 0).toFixed(2)}</td></tr>
        <tr style="border-top:2px solid #cbd5e1"><td style="padding:10px 0;font-size:14px;font-weight:bold;color:#0f172a">Net Payable:</td><td style="text-align:right;font-size:14px;font-weight:bold;color:#106675">₹${Math.max(0, (billingLedger.labSub || 0) + (billingLedger.labGst || 0) - (discountInput || 0)).toFixed(2)}</td></tr>`;
    } 
    else {
      // Combined Bill
      sectionTitle = 'Consolidated Clinic Receipt';
      let rows = '';
      if (includeConsult) {
        rows += `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">OPD Consultation Fee</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">₹${(billingLedger.consultFee || 0).toFixed(2)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">1</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">₹${(billingLedger.consultFee || 0).toFixed(2)}</td>
        </tr>`;
      }
      billingLedger.medicinesList
        .filter(m => selectedMedicines[(m.name || '').toLowerCase()]?.selected)
        .forEach(m => {
          const qty = selectedMedicines[(m.name || '').toLowerCase()].qty;
          rows += `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">[Pharmacy] ${m.name}<br/><span style="font-size:10px;color:#94a3b8">Batch: ${m.batch}</span></td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">₹${(m.price || 0).toFixed(2)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${qty}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">₹${((m.price || 0) * qty).toFixed(2)}</td>
          </tr>`;
        });
      billingLedger.testsList
        .filter(t => selectedTests[t.loincCode])
        .forEach(t => {
          rows += `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">[Lab] ${t.name}<br/><span style="font-size:10px;color:#94a3b8">LOINC: ${t.loincCode}</span></td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">₹${(t.price || 0).toFixed(2)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">1</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">₹${(t.price || 0).toFixed(2)}</td>
          </tr>`;
        });

      itemsHtml = `<thead>
        <tr style="background:#f1f5f9;color:#64748b;font-size:11px;text-transform:uppercase;">
          <th style="padding:8px 12px;text-align:left;">Item Details</th>
          <th style="padding:8px 12px;text-align:right;">Rate</th>
          <th style="padding:8px 12px;text-align:center;">Qty</th>
          <th style="padding:8px 12px;text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>`;

      chargesBreakdown = `
        <tr><td style="padding:6px 0;color:#64748b">Consultation Subtotal:</td><td style="text-align:right;font-weight:600">₹${(billingLedger.consultTotal || 0).toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Pharmacy Items Subtotal:</td><td style="text-align:right;font-weight:600">₹${(billingLedger.pharmacySub || 0).toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Diagnostics Subtotal:</td><td style="text-align:right;font-weight:600">₹${(billingLedger.labSub || 0).toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">GST Amount (5% Pharm / 18% Lab):</td><td style="text-align:right;font-weight:600">₹${(billingLedger.totalGst || 0).toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Discount Input:</td><td style="text-align:right;font-weight:600;color:#e11d48">-₹${(discountInput || 0).toFixed(2)}</td></tr>
        <tr style="border-top:2px solid #cbd5e1"><td style="padding:10px 0;font-size:14px;font-weight:bold;color:#0f172a">Grand Total Paid:</td><td style="text-align:right;font-size:14px;font-weight:bold;color:#106675">₹${(billingLedger.finalTotal || 0).toFixed(2)}</td></tr>`;
    }

    const clinicTitle = activePod?.name || activeProfile?.clinicName || 'VitalSync Integrated Care';
    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>${clinicTitle} Receipt</title>
  <style>
    body { font-family: 'Inter', sans-serif; margin: 40px; color: #0f172a; font-size:13px; line-height:1.5; }
    .header-box { display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #106675; padding-bottom:12px; margin-bottom:20px; }
    h1 { color: #106675; margin:0; font-size:22px; }
    .subtitle { color:#64748b; font-size:11px; margin-top:2px; text-transform:uppercase; letter-spacing:0.05em; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .summary-table { width:300px; margin-left:auto; margin-top:20px; }
    .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align:center; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; display: flex; justify-content: flex-end; gap: 10px;">
    <button onclick="window.print()" style="background: #106675; color: white; border: 0; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px;">🖨️ Print / Save as PDF</button>
    <button onclick="const phone = '${selectedPatient.phone || ''}'.replace(/\\D/g, '').slice(-10); if (phone) { window.open('https://wa.me/91' + phone + '?text=' + encodeURIComponent('Namaste ${selectedPatient.name} ji 🙏,\\nYour payment receipt of ₹${(billingLedger.finalTotal || 0).toFixed(2)} from ${clinicTitle} is confirmed.\\nThank you!'), '_blank'); } else { alert('Patient phone number not found.'); }" style="background: #16a34a; color: white; border: 0; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px;">📲 Send to WhatsApp</button>
  </div>
  <div class="header-box">
    <div>
      <h1>🏥 ${clinicTitle}</h1>
      <div class="subtitle">${sectionTitle}</div>
    </div>
    <div style="text-align:right;font-size:11px;color:#64748b">
      <strong>Receipt ID:</strong> RCP-${Date.now().toString().substring(6)}<br/>
      <strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}
    </div>
  </div>
  
  <div style="margin-bottom:20px;background:#f8fafc;padding:12px;border-radius:8px;">
    <strong>Patient Name:</strong> ${selectedPatient.name} &nbsp;|&nbsp; 
    <strong>Age/Sex:</strong> ${selectedPatient.age}y / ${selectedPatient.gender} &nbsp;|&nbsp; 
    <strong>Phone:</strong> ${selectedPatient.phone}
  </div>

  <table style="width:100%">
    ${itemsHtml}
  </table>

  <table class="summary-table">
    ${chargesBreakdown}
  </table>

  <div class="footer">
    This is a computerized receipt generated securely. Thank you for choosing ${clinicTitle}.
  </div>
  <script>window.print();</script>
</body>
</html>`;

    const blob = new Blob([printHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Bug Fix #4: Revoke blob URL after tab opens to prevent memory leak
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  // Print Fixed Table QR Standee for Clinic Desk
  const handlePrintFixedTableQRStandee = () => {
    const razorpayHandle = 'https://razorpay.me/@vitalsync3758';
    const razorpayDisplay = 'razorpay.me/@vitalsync3758';
    const qrUrl = generateQRCodeDataURI(razorpayHandle, { size: 300, color: '#0f172a' }) || `https://quickchart.io/qr?size=300&text=${encodeURIComponent(razorpayHandle)}`;
    const clinicTitle = activePod?.name || activeProfile?.clinicName || 'VitalSync Healthcare';

    const standeeHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>${clinicTitle} Counter Razorpay 0% Fee QR Standee</title>
  <style>
    body { font-family: 'Inter', sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:90vh; text-align:center; color:#0f172a; padding:20px; }
    .card { border: 4px solid #106675; padding: 40px; border-radius: 24px; max-width: 420px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); background: #ffffff; }
    h1 { color: #106675; font-size: 26px; margin: 0 0 4px 0; }
    .sub { color: #64748b; font-size: 12px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 24px; }
    .qr-box { padding: 16px; border: 2px solid #e2e8f0; border-radius: 16px; display: inline-block; background: #f8fafc; margin-bottom: 20px; }
    .vpa { background: #e0f2fe; color: #0369a1; font-family: monospace; font-size: 14px; font-weight: bold; padding: 8px 16px; border-radius: 8px; margin-bottom: 16px; display: inline-block; }
    .inst { font-size: 12px; color: #475569; margin-top: 12px; line-height: 1.5; }
    .apps { margin-top: 16px; font-size: 11px; color: #64748b; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🏥 ${clinicTitle}</h1>
    <div class="sub">Razorpay 0% Fee Counter Payment QR</div>
    <div class="qr-box">
      <img src="${qrUrl}" alt="Razorpay Counter Payment QR" width="240" height="240" />
    </div>
    <br/>
    <div class="vpa">Razorpay Handle: ${razorpayDisplay}</div>
    <div class="inst">
      <strong>Instructions for Patients:</strong><br/>
      1. Scan QR code using GPay, PhonePe, Paytm or BHIM.<br/>
      2. Enter the bill amount stated by the Counter Staff.<br/>
      3. Show successful payment screen to Compounder.
    </div>
    <div class="apps">Accepted: PhonePe • Google Pay • Paytm • BHIM • All UPI Apps (0% MDR Fee)</div>
  </div>
  <script>window.print();</script>
</body>
</html>`;

    const blob = new Blob([standeeHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  // Clear Payment & Sync Inventory
  const handleClearBill = async () => {
    if (!selectedPatient || !billingLedger) return;
    setIsClearing(true);

    try {
      // 1. Always create & save a UnifiedInvoice for the full consolidated bill (Consult + Pharmacy + Lab + OT)
      const unifiedInvoiceId = `inv-${crypto.randomUUID().substring(0, 8)}`;
      const isPureCounterConsult = billingLedger.pharmacySub === 0 && billingLedger.labSub === 0 && billingLedger.otTotal === 0;
      const newUnifiedInvoice: UnifiedInvoice = {
        id: unifiedInvoiceId,
        encounterId: 'counter-checkout',
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        patientPhone: selectedPatient.phone,
        doctorFee: billingLedger.consultTotal,
        labFee: billingLedger.labSub,
        pharmacyFee: billingLedger.pharmacySub,
        platformFee: isPureCounterConsult ? 0 : parseFloat((billingLedger.finalTotal * 0.03).toFixed(2)),
        totalAmount: billingLedger.finalTotal,
        upiQrPayload: dynamicUpiPayload || PaymentService.generateDirectUpiPayload(billingLedger.finalTotal, unifiedInvoiceId).upiDeepLink,
        paymentStatus: 'cleared',
        paymentMethod: paymentMethod,
        createdAt: new Date().toISOString()
      };
      BillingService.saveUnifiedInvoice(newUnifiedInvoice);

      // 2. Clear existing consultation invoice if any
      const saasInvoices = BillingService.getInvoices();
      const consultInvoice = saasInvoices.find(
        (i: any) => i.patientId === selectedPatient.id && i.type === 'consult' && i.status === 'unpaid'
      );
      if (consultInvoice) {
        consultInvoice.status = 'paid';
        consultInvoice.paymentMethod = paymentMethod;
        BillingService.saveInvoice(consultInvoice);

        // Confirm appointment status — MUST set payment_status = 'cleared' to enforce payment gate (USP 3)
        const appts = BillingService.getAppointments();
        const targetAppt = appts.find(a => a.id === consultInvoice.appointmentId);
        if (targetAppt) {
          targetAppt.status = 'ready_for_consult';
          targetAppt.payment_status = 'cleared';
          BillingService.saveAppointments(appts);
        }
      }

      // 3. Clear the unified invoice (triggers 3% platform fee split, commission pool refill, and financial ledgers)
      BillingService.clearInvoice(unifiedInvoiceId, paymentMethod);

      // 4. Deduct pharmacy inventory stock for selected medicines
      if (billingLedger.pharmacySub > 0) {
        const activeInventory = PharmacyService.getPharmacyInventory();
        let invUpdated = false;
        billingLedger.medicinesList.forEach(m => {
          const mNameLower = (m.name || '').toLowerCase();
          const state = selectedMedicines[mNameLower];
          if (state?.selected) {
            const itemInInv = activeInventory.find(inv => (inv.name || '').toLowerCase() === mNameLower);
            if (itemInInv) {
              itemInInv.stock = Math.max(0, itemInInv.stock - state.qty);
              invUpdated = true;
            }
          }
        });
        if (invUpdated) {
          PharmacyService.savePharmacyInventory(activeInventory);
        }
      }

      // 1. Premium Club Eligibility Onboarding Check (Any clinic purchase activates loyalty)
      if (!selectedPatient.isPremiumMember || billingLedger.isQualifyingFirstPurchase) {
        PatientService.updatePatientPremiumStatus(selectedPatient.id, true);
        const rawDocName = activePod?.doctor_name || 'our doctor';
        const docTitle = (rawDocName.startsWith('Dr.') || rawDocName.startsWith('dr.')) ? rawDocName : `Dr. ${rawDocName}`;
        const clinicTitle = activePod?.name || activeProfile?.clinicName || 'Clinic';

        ClinicalNotificationService.dispatchFreeFollowupLoyaltyWhatsApp({
          patientPhone: selectedPatient.phone,
          patientName: selectedPatient.name,
          doctorName: docTitle,
          clinicName: clinicTitle,
          expiryDays: 15
        }).catch(err => console.warn('[BillHubTab] Loyalty WhatsApp dispatch notice:', err));
        
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: { 
            title: 'Premium Member Enrolled! 🌟', 
            message: `${selectedPatient.name} is now a Premium Care Club member. 1 Free Virtual Consult unlocked!`, 
            type: 'success' 
          }
        }));
      }

      // 2. Dispatch Digital Invoice & Medication Advice directly to WhatsApp
      const medListText = (billingLedger.medicinesList || [])
        .filter(m => selectedMedicines[(m?.name || '').toLowerCase()]?.selected)
        .map(m => {
          const freq = (m as any).frequency || (m as any).freq || '1-0-1';
          const dur = (m as any).duration || (m as any).dur || '10 Days';
          const instr = (m as any).instructions || (m as any).dosage || 'Take after meals';
          return `- *${m.name || 'Medicine'}*: ${freq} for ${dur} (${instr}).`;
        })
        .join('\n');
      
      const invoiceMsg = `Hi ${selectedPatient.name}! 🧾 Aapka Bill settle ho gaya hai.\n\n*Amount Paid:* ₹${billingLedger.finalTotal.toFixed(2)} (${paymentMethod.toUpperCase()})\n\n🔗 *Invoice Link:* https://mediflow.in/invoices/${unifiedInvoiceId}\n\n${medListText ? `*Medication Refill & Dosage Guide:*\n${medListText}` : ''}\n\nTake care & stay healthy! 🏥`;
      WhatsAppService.pushWhatsAppMessageFromBot(selectedPatient.phone, invoiceMsg);

      setRefreshKey(prev => prev + 1);

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { title: 'Bill Settled! 🧾', message: `Invoice amount of ₹${billingLedger.finalTotal} received via ${paymentMethod.toUpperCase()}.`, type: 'success' }
      }));

      handlePrintSplitInvoice('combined');
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
    <div className="space-y-6">
      {/* ── Dual Master Navigation Headers ──────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-white/10 rounded-2xl p-1.5 shadow-sm flex flex-col sm:flex-row gap-1.5">
        <button
          type="button"
          onClick={() => setInvoiceSectionTab('ocr_scan')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            invoiceSectionTab === 'ocr_scan'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md font-black'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Sparkles className="h-4 w-4 text-amber-300" />
          <span>1. Scan & Auto-Save Paper Prescription (पर्चा एआई स्कैन)</span>
          <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">AI Vision</span>
        </button>

        <button
          type="button"
          onClick={() => setInvoiceSectionTab('manual_billing')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            invoiceSectionTab === 'manual_billing'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md font-black'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Receipt className="h-4 w-4" />
          <span>2. Today's Consultations & Manual Billing (दैनिक परामर्श व बिलिंग)</span>
          <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-mono font-bold">
            {filteredPatients.length} Active
          </span>
        </button>
      </div>

      {/* ── Section 1: AI Prescription Vision OCR & Multi-Dashboard Auto-Dispatch ── */}
      {invoiceSectionTab === 'ocr_scan' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Area: Prescription Camera & Slip Uploader */}
          <div className="lg:col-span-6 space-y-4">
            <div className="glass-panel p-6 bg-white dark:bg-clinical-900/40 border-slate-200/80 shadow-sm rounded-3xl space-y-5 text-left relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center font-black">
                    <Camera className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 dark:text-white text-sm">Scan Paper Prescription (पर्ची अपलोड)</h3>
                    <p className="text-[11px] text-slate-500">Handwritten Doctor Prescription Vision OCR</p>
                  </div>
                </div>
                <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full font-bold">
                  ⚡ Groq Llama-3 Vision
                </span>
              </div>

              {/* Upload Card & Image Preview */}
              <div className="space-y-4">
                {selectedImagePreview ? (
                  <div className="relative border-2 border-indigo-200 dark:border-indigo-800/60 rounded-2xl p-2 bg-slate-50 dark:bg-slate-900/60 overflow-hidden group">
                    <img 
                      src={selectedImagePreview} 
                      alt="Prescription Preview" 
                      className="w-full h-56 sm:h-64 object-contain rounded-xl bg-slate-900/10"
                    />
                    <div className="absolute top-4 right-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedImagePreview(null);
                          setFileName(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold shadow-md cursor-pointer flex items-center gap-1"
                      >
                        <X className="h-3.5 w-3.5" />
                        Clear
                      </button>
                    </div>
                    <div className="mt-2 px-2 flex justify-between items-center text-[11px] text-slate-500 font-mono">
                      <span className="truncate max-w-[200px]">{fileName}</span>
                      <span className="text-emerald-600 font-bold">Ready to Scan</span>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-indigo-200 dark:border-indigo-800/60 hover:border-indigo-500 rounded-3xl p-8 bg-indigo-50/20 dark:bg-indigo-950/20 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.01]"
                  >
                    <div className="h-14 w-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 flex items-center justify-center mb-3">
                      <Upload className="h-7 w-7" />
                    </div>
                    <h4 className="font-extrabold text-slate-800 dark:text-white text-sm">Take Photo or Choose Prescription Slip</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs">Capture prescription slip using phone camera or choose image/PDF file</p>
                    <div className="mt-4 flex gap-2">
                      <span className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-indigo-600 text-white shadow-xs">
                        📷 Open Camera / Gallery
                      </span>
                    </div>
                  </div>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,application/pdf"
                  className="hidden"
                />

                {/* Prominent Action Button */}
                <button
                  type="button"
                  onClick={handleScan}
                  disabled={isScanning || !fileName}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-sm transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>{ocrScanStep || 'Processing Vision OCR...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 text-amber-300" />
                      <span>✨ Submit & Run AI Vision Scan (पर्ची स्कैन करें)</span>
                    </>
                  )}
                </button>

                {isScanning && (
                  <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/40 text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-2 animate-pulse font-medium">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span>{ocrScanStep || 'Extracting patient profile, medicines, and diagnostics...'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Area: Scanned Result Dashboard & Auto-Dispatch Hub */}
          <div className="lg:col-span-6 space-y-4">
            {lastScannedResult ? (
              <div className="glass-panel p-6 bg-white dark:bg-clinical-900/40 border-slate-200/80 shadow-sm rounded-3xl space-y-5 text-left animate-fade-in">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-[9px] font-mono font-black uppercase text-indigo-600 tracking-wider">AI Scan Extracted Successfully</span>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base mt-0.5">{lastScannedResult.patient.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">📱 +91 {lastScannedResult.patient.phone} · {lastScannedResult.patient.age}y ({lastScannedResult.patient.gender})</p>
                  </div>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Auto-Matched
                  </span>
                </div>

                {/* Prescribed Medicines */}
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Pill className="h-3.5 w-3.5 text-indigo-500" />
                    Prescribed Medicines ({lastScannedResult.medications.length}) ➔ Dispatched to Pharmacy
                  </h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {lastScannedResult.medications.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No oral medications detected.</p>
                    ) : (
                      lastScannedResult.medications.map((m, idx) => (
                        <div key={`ocr-med-${idx}-${m.medicineName || 'item'}`} className="p-2.5 rounded-xl border border-slate-200/80 dark:border-white/5 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center text-xs">
                          <div>
                            <span className="font-bold text-slate-800 dark:text-white">{m.medicineName}</span>
                            <span className="text-[10px] text-slate-500 block font-mono">Dosage: {m.dosage} ({m.frequency || 'twice daily'})</span>
                          </div>
                          <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-bold font-mono">Reserved ✅</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Prescribed Lab Tests */}
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FlaskConical className="h-3.5 w-3.5 text-purple-500" />
                    Prescribed Diagnostics ({lastScannedResult.diagnosticTests.length}) ➔ Dispatched to Pathology Lab
                  </h4>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {lastScannedResult.diagnosticTests.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No diagnostic lab tests required.</p>
                    ) : (
                      lastScannedResult.diagnosticTests.map((t, idx) => (
                        <div key={`ocr-test-${idx}-${t.loincCode || t.name || 'test'}`} className="p-2.5 rounded-xl border border-slate-200/80 dark:border-white/5 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center text-xs">
                          <div>
                            <span className="font-bold text-slate-800 dark:text-white">{t.name}</span>
                            <span className="text-[10px] text-slate-500 block font-mono">LOINC: {t.loincCode}</span>
                          </div>
                          <span className="text-[9px] bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded font-bold font-mono">Requisition Created ✅</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Proceed Button */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatient(lastScannedResult.patient);
                    setInvoiceSectionTab('manual_billing');
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>💳 Proceed to Final Billing & Settlement ({lastScannedResult.patient.name})</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="glass-panel p-10 bg-white dark:bg-clinical-900/40 border-slate-200/80 shadow-sm rounded-3xl flex flex-col items-center justify-center text-center space-y-4 min-h-[320px]">
                <div className="h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-800 dark:text-white text-sm">Awaiting Prescription Upload</h4>
                  <p className="text-xs text-slate-500 max-w-sm">Capture or select a doctor's handwritten paper prescription on the left. The AI will automatically extract patient information, medicines, and tests.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Section 2: Today's Consultations & Manual Billing Checkout ────────── */}
      {invoiceSectionTab === 'manual_billing' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 1. Left Patient Panel (Today's Consultations & OPD Queue) */}
          <div className="lg:col-span-1 glass-panel p-5 bg-white dark:bg-clinical-900/40 border-slate-200/80 shadow-sm rounded-2xl space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-500" />
                Today's Consultations Queue
              </h3>
              <span className="text-[9px] font-mono font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                {filteredPatients.length} Patients
              </span>
            </div>

            {/* Filter Mode Switcher */}
            <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl">
              <button
                type="button"
                onClick={() => setPatientFilterTab('today_queue')}
                className={`flex-1 py-1 px-2 rounded-lg text-[9.5px] font-bold transition cursor-pointer border-0 ${
                  patientFilterTab === 'today_queue'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                📅 Today's OPD ({patients.filter(p => todayOpdPatientIds.has(p.id)).length})
              </button>
              <button
                type="button"
                onClick={() => setPatientFilterTab('all')}
                className={`flex-1 py-1 px-2 rounded-lg text-[9.5px] font-bold transition cursor-pointer border-0 ${
                  patientFilterTab === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                👥 All ({patients.length})
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, phone, token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 rounded-xl text-xs outline-none bg-white text-slate-800"
              />
            </div>

            {/* List */}
            <div className="space-y-2 lg:max-h-[500px] max-h-none lg:overflow-y-auto no-scrollbar">
              {filteredPatients.map(p => {
                const isSelected = selectedPatient?.id === p.id;
                const appts = BillingService.getAppointments();
                const activeVirtual = appts.find(a => ((a as any).patientId === p.id || (a as any).patient_id === p.id) && ((a as any).isVirtual || (a as any).is_virtual) && a.status !== 'completed' && a.status !== 'cancelled');
                
                const encounters = EncounterService.getEncounters().filter(e => e.patientId === p.id || (e as any).patient_id === p.id);
                const hasRx = encounters.length > 0;

                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPatient(p)}
                    className={`w-full p-3 rounded-xl border text-left transition-all relative flex flex-col gap-1.5 cursor-pointer ${
                      isSelected 
                        ? 'bg-indigo-500/10 border-indigo-500/30' 
                        : 'bg-slate-50/50 hover:bg-slate-50 dark:bg-slate-950/20 border-slate-200/50 dark:border-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate max-w-[70%]">{p.name}</span>
                      <span className="text-[9px] font-mono text-slate-400 font-bold">{p.tokenNumber || 'PAT'}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>{p.phone}</span>
                      <div className="flex items-center gap-1.5">
                        {hasRx && (
                          <span className="text-[8px] font-extrabold px-1.5 py-0.2 bg-indigo-500/15 text-indigo-600 rounded">Rx Ready</span>
                        )}
                        {activeVirtual && (
                          <span className="text-[8px] font-extrabold px-1.5 py-0.2 bg-emerald-500/15 text-emerald-600 rounded animate-pulse">Virtual</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Middle Billing Details Panel */}
          <div className="lg:col-span-2 space-y-6">
            {selectedPatient ? (
              <div className="glass-panel p-6 bg-white dark:bg-clinical-900/40 border-slate-200/80 shadow-sm rounded-2xl space-y-6 text-left">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-800 dark:text-white">{selectedPatient.name}</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      ID: <span className="font-mono text-slate-800 dark:text-slate-200 font-bold bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded-lg">{selectedPatient.tokenNumber || 'PAT'}</span> • {selectedPatient.phone}
                    </p>
                  </div>

                  {/* Billing Mode Toggle */}
                  <div className="flex border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                    <button
                      onClick={() => setBillingMode('digital')}
                      className={`px-3 py-1.5 text-[10px] font-bold uppercase transition ${
                        billingMode === 'digital' 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-slate-50 dark:bg-slate-950 text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Digital Sync
                    </button>
                    <button
                      onClick={() => setBillingMode('manual')}
                      className={`px-3 py-1.5 text-[10px] font-bold uppercase transition ${
                        billingMode === 'manual' 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-slate-50 dark:bg-slate-950 text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Manual / Voice
                    </button>
                  </div>
                </div>

                {/* Voice & Manual Search Workspace */}
                {billingMode === 'manual' && (
                  <div className="p-5 bg-gradient-to-br from-indigo-50/50 via-slate-50/20 to-white border border-indigo-100 dark:border-slate-800 rounded-2xl space-y-4">
                    
                    {/* Voice Section */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4.5 w-4.5 text-indigo-500" />
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">Voice Billing Companion</span>
                          <span className="block text-[9px] text-slate-400">Speak drugs and tests to auto-fill the bill</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleStartVoiceBilling}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border-0 transition-all cursor-pointer ${
                          isListening 
                            ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/20' 
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm hover:shadow'
                        }`}
                      >
                        {isListening ? (
                          <>
                            <MicOff className="h-4 w-4 animate-spin text-white-force" />
                            <span>Listening...</span>
                          </>
                        ) : (
                          <>
                            <Mic className="h-4 w-4 text-white-force" />
                            <span>Speak Billing</span>
                          </>
                        )}
                      </button>
                    </div>

                    {voiceTranscript && (
                      <div className="p-3 bg-slate-100 dark:bg-slate-950/80 border border-slate-200/50 dark:border-slate-800/60 rounded-xl text-[10px] text-slate-650 dark:text-slate-300 font-medium">
                        {voiceTranscript}
                      </div>
                    )}

                    {/* Manual Catalog Search Area */}
                    <div className="space-y-2">
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Search & Add Catalog Item manually</span>
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Type medicine name or lab test name to add..."
                          value={manualItemSearchQuery}
                          onChange={(e) => setManualItemSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 rounded-xl text-xs outline-none bg-white text-slate-800"
                        />
                        
                        {/* Search suggestions dropdown */}
                        {catalogSuggestions.length > 0 && (
                          <div className="absolute top-11 left-0 right-0 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-h-[220px] overflow-y-auto overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                            {catalogSuggestions.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => handleAddSuggestedItem(s)}
                                className="w-full px-4 py-2.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border-0 bg-transparent flex items-center justify-between"
                              >
                                <div>
                                  <span className="font-bold text-slate-800 dark:text-slate-100">{s.name}</span>
                                  <span className="block text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">{s.type === 'pharmacy' ? 'Medicine Stock' : 'Pathology Lab'}</span>
                                </div>
                                <span className="font-black text-indigo-600 dark:text-indigo-400">₹{s.price}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                )}

                {/* Interactive Billing Ledger */}
                {billingLedger && (
                  <div className="space-y-6">
                    
                    {/* 1. OPD Consultation Fee */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">1. Doctor Consultation OPD</h4>
                      <div className="flex items-center justify-between p-3.5 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/50 dark:border-slate-800/40 rounded-2xl">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeConsult}
                            onChange={(e) => setIncludeConsult(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">OPD Attendance &amp; consultation</span>
                              {!includeConsult && selectedPatient && (
                                <span className="text-[9px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-bold px-2 py-0.5 rounded-full font-mono">Paid at Booking ✅</span>
                              )}
                            </div>
                            <span className="block text-[10px] text-slate-500">Regular clinic consultation visit fee</span>
                          </div>
                        </label>
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200">₹{billingLedger.consultFee}</span>
                      </div>
                    </div>

                    {/* Scheduled Minor OT / Daycare Surgery */}
                    {billingLedger.otItem && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-405 text-left">Scheduled Daycare / OT Surgery</h4>
                        <div className="flex items-center justify-between p-3.5 bg-rose-500/5 dark:bg-rose-500/10 border border-rose-200/60 dark:border-rose-900/40 rounded-2xl">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={includeOT}
                              onChange={(e) => setIncludeOT(e.target.checked)}
                              className="rounded border-rose-300 text-rose-600 focus:ring-rose-500 h-4 w-4"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-rose-800 dark:text-rose-300">{billingLedger.otItem.name}</span>
                                <span className="text-[9px] bg-rose-500/10 text-rose-600 border border-rose-500/20 font-bold px-2 py-0.5 rounded-full font-mono uppercase">Minor OT</span>
                              </div>
                              <span className="block text-[10px] text-rose-500/80">Clinic Daycare Procedure</span>
                            </div>
                          </label>
                          <span className="text-xs font-black text-rose-800 dark:text-rose-300">₹{billingLedger.otItem.price}</span>
                        </div>
                      </div>
                    )}

                    {/* 2. Pharmacy Medicines */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">2. Pharmacy Medicines Prescription</h4>
                        <span className="text-[9px] text-slate-400 font-mono">Stock Synced</span>
                      </div>
                      
                      {billingLedger.medicinesList.length === 0 ? (
                        <div className="p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center text-xs text-slate-400">
                          No medicines in active prescription. Use Voice or Catalog search above to add items.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {billingLedger.medicinesList.map(med => {
                            const medKey = (med.name || '').toLowerCase();
                            const isChecked = selectedMedicines[medKey]?.selected ?? false;
                            const currentQty = selectedMedicines[medKey]?.qty ?? 10;
                            const isOutOfStock = med.stock <= 0;

                            return (
                              <div key={med.name} className={`flex items-center justify-between p-3 rounded-2xl border transition ${
                                isChecked ? 'bg-slate-50/80 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800' : 'bg-slate-50/20 dark:bg-slate-950/10 border-transparent opacity-60'
                              }`}>
                                <label className="flex items-center gap-3 cursor-pointer flex-1">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => handleToggleMedicine(med.name, e.target.checked)}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                  />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{med.name}</span>
                                      {isOutOfStock ? (
                                        <span className="text-[8px] bg-rose-500/10 text-rose-600 px-1.5 py-0.5 rounded font-bold">Out of Stock</span>
                                      ) : (
                                        <span className="text-[8px] bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded font-mono">Stock: {med.stock}</span>
                                      )}
                                    </div>
                                    <span className="block text-[10px] text-slate-400 font-mono">Batch: {med.batch} • MRP: ₹{med.mrp} (Clinic: ₹{med.price})</span>
                                  </div>
                                </label>

                                {isChecked && (
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
                                      <input
                                        type="number"
                                        min="1"
                                        value={currentQty}
                                        onChange={(e) => handleMedicineQtyChange(med.name, parseInt(e.target.value) || 1)}
                                        className="w-12 text-center text-xs font-bold outline-none bg-transparent"
                                      />
                                      <span className="text-[9px] text-slate-400 pr-1.5">units</span>
                                    </div>
                                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 w-16 text-right">
                                      ₹{((med.price || 0) * (currentQty || 1)).toFixed(2)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* 3. Diagnostic Lab Tests */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">3. Diagnostic Pathology Lab Tests</h4>
                        <span className="text-[9px] text-slate-400 font-mono">LOINC Standardized</span>
                      </div>

                      {billingLedger.testsList.length === 0 ? (
                        <div className="p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center text-xs text-slate-400">
                          No laboratory tests ordered. Add pathology tests from catalog above.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {billingLedger.testsList.map(test => {
                            const isChecked = selectedTests[test.loincCode] ?? false;

                            return (
                              <div key={test.loincCode} className={`flex items-center justify-between p-3 rounded-2xl border transition ${
                                isChecked ? 'bg-slate-50/80 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800' : 'bg-slate-50/20 dark:bg-slate-950/10 border-transparent opacity-60'
                              }`}>
                                <label className="flex items-center gap-3 cursor-pointer flex-1">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => handleToggleTest(test.loincCode, e.target.checked)}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                  />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{test.name}</span>
                                      <span className="text-[8px] bg-indigo-500/10 text-indigo-600 px-1.5 py-0.5 rounded font-mono">{test.category}</span>
                                    </div>
                                    <span className="block text-[10px] text-slate-400 font-mono">LOINC: {test.loincCode}</span>
                                  </div>
                                </label>

                                {isChecked && (
                                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 w-16 text-right">
                                    ₹{(test.price || 0).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Summary Calculation Card */}
                    <div className="p-5 bg-slate-900 text-white rounded-3xl space-y-4 shadow-xl">
                      <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                        <span className="text-xs font-bold text-slate-400">Checkout Breakdown</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handlePrintSplitInvoice('pharmacy')}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                          >
                            <Printer className="h-3 w-3" />
                            <span>Pharm Slip</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintSplitInvoice('lab')}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                          >
                            <Printer className="h-3 w-3" />
                            <span>Lab Slip</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintSplitInvoice('combined')}
                            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                          >
                            <Printer className="h-3 w-3" />
                            <span>Unified Tax Invoice</span>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-400">
                          <span>Doctor Consultation Fee:</span>
                          <span className="font-mono text-white">₹{billingLedger.consultTotal.toFixed(2)}</span>
                        </div>
                        {billingLedger.otTotal > 0 && (
                          <div className="flex justify-between text-rose-400">
                            <span>Daycare Surgery / Minor OT:</span>
                            <span className="font-mono text-rose-400 font-bold">₹{billingLedger.otTotal.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-slate-400">
                          <span>Pharmacy Medicines Subtotal:</span>
                          <span className="font-mono text-white">₹{billingLedger.pharmacySub.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Pathology Lab Subtotal:</span>
                          <span className="font-mono text-white">₹{billingLedger.labSub.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>GST (5% Medicines + 18% Lab):</span>
                          <span className="font-mono text-white">₹{billingLedger.totalGst.toFixed(2)}</span>
                        </div>
                        
                        {billingLedger.pharmacyDiscount > 0 && (
                          <div className="flex justify-between text-emerald-400 font-medium">
                            <span>Club 10% Refill Discount:</span>
                            <span className="font-mono">-₹{billingLedger.pharmacyDiscount.toFixed(2)}</span>
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-2">
                          <span className="text-slate-400">Compounder Custom Discount:</span>
                          <div className="flex items-center gap-1 bg-slate-800 rounded-lg px-2 py-0.5">
                            <span className="text-[10px] text-slate-400">₹</span>
                            <input
                              type="number"
                              min="0"
                              value={discountInput || ''}
                              onChange={(e) => setDiscountInput(parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              className="w-16 bg-transparent text-right text-xs font-bold text-white outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-800 flex justify-between items-baseline">
                        <div>
                          <span className="text-sm font-bold text-slate-300">Total Net Amount</span>
                          {selectedPatient.isPremiumMember && (
                            <span className="block text-[9px] text-amber-400 font-bold">✨ Premium Care Member Applied</span>
                          )}
                        </div>
                        <span className="text-2xl font-black text-emerald-400">
                          ₹{billingLedger.finalTotal.toFixed(2)}
                        </span>
                      </div>

                      {/* Payment Mode Selector */}
                      <div className="pt-2">
                        <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">Select Payment Method:</span>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('paytm')}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                              paymentMethod === 'paytm'
                                ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-sm'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                          >
                            <QrCode className="h-3.5 w-3.5 text-sky-400" />
                            <span>Paytm PG (0% MDR)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPaymentMethod('upi')}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                              paymentMethod === 'upi'
                                ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300 shadow-sm'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                          >
                            <QrCode className="h-3.5 w-3.5 text-indigo-400" />
                            <span>Direct Zero-Fee UPI</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPaymentMethod('cash')}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                              paymentMethod === 'cash'
                                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-sm'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                          >
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Cash Counter</span>
                          </button>
                        </div>
                      </div>

                      {/* Dynamic Direct UPI / Paytm Standee Preview */}
                      {(paymentMethod === 'upi' || paymentMethod === 'paytm') && (
                        <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center space-y-2">
                          <img
                            src={generateQRCodeDataURI(dynamicUpiPayload, { size: 160, color: '#0f172a' }) || `https://quickchart.io/qr?size=160&text=${encodeURIComponent(dynamicUpiPayload)}`}
                            alt="Dynamic Counter Payment QR"
                            className="w-24 h-24 rounded-lg p-1 bg-white border border-slate-200 object-contain"
                          />
                          <span className="text-[9px] font-bold text-indigo-400 uppercase font-mono tracking-wider">
                            {paymentMethod === 'paytm' ? 'Scan Counter Paytm / UPI QR' : 'Scan Zero-Fee Direct UPI QR'}
                          </span>
                          <span className="text-[8px] text-slate-400">Scan with GPay, PhonePe, Paytm or BHIM</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                        <button
                          type="button"
                          onClick={handleClearBill}
                          disabled={isClearing}
                          className="w-full btn-primary py-2.5 text-center text-xs font-bold rounded-xl text-white-force bg-indigo-600-force hover:bg-indigo-700-force transition active:scale-95 disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Check className="h-4 w-4" />
                          {isClearing ? 'Clearing...' : 'Clear Bill (Cash/UPI)'}
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            if (!selectedPatient || !billingLedger) return;
                            setIsClearing(true);
                            try {
                              const invId = `inv-${crypto.randomUUID().substring(0, 8)}`;
                              const res = await PaymentService.initiatePaymentOrder({
                                gateway: 'paytm',
                                invoiceId: invId,
                                amount: billingLedger.finalTotal,
                                patientName: selectedPatient.name,
                                patientPhone: selectedPatient.phone
                              });

                              if (res.success && res.paymentSessionId) {
                                window.open(res.paymentSessionId, '_blank');
                                window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                  detail: {
                                    title: 'Paytm PG Order Initiated 🚀',
                                    message: 'Paytm 0% MDR checkout window opened for patient.',
                                    type: 'success'
                                  }
                                }));
                              } else {
                                handleClearBill();
                              }
                            } catch (e) {
                              console.warn('[Paytm Order] Error initiating order:', e);
                              handleClearBill();
                            } finally {
                              setIsClearing(false);
                            }
                          }}
                          disabled={isClearing}
                          className="w-full py-2.5 text-center text-xs font-bold rounded-xl text-white-force bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 transition active:scale-95 disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                        >
                          <QrCode className="h-4 w-4" />
                          <span>Pay via Paytm PG (0% MDR)</span>
                        </button>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            ) : (
              <div className="glass-panel p-10 bg-white dark:bg-clinical-900/40 border-slate-200/80 shadow-sm rounded-2xl flex flex-col items-center justify-center text-center space-y-4 min-h-[400px]">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-500">
                  <Receipt className="h-6 w-6" />
                </div>
                
                <div className="space-y-1 select-none">
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm">No Consultation Selected</h3>
                  <p className="text-xs text-slate-500 max-w-sm">Select any patient from today's consultation queue on the left to start billing, adjust medications/tests, or collect counter payment.</p>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
