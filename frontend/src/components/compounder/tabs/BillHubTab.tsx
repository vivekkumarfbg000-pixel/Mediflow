import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { supabase } from '../../../lib/supabaseClient';
import { 
  Users, Search, FileText, Activity, QrCode, Check, X, ShieldAlert, Sparkles, Printer, Mic, MicOff, Plus, Minus, Trash2, Tag, DollarSign, Camera, AlertCircle, ShieldCheck,
  ArrowRight, CheckCircle2, Pill, FlaskConical, Calendar, Stethoscope, RefreshCw, Loader2, Receipt, UserPlus, Send, Phone, CreditCard
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
import { fuzzyCorrectMedicineName, fuzzyCorrectLabTest } from '../../../utils/ocrFuzzyCorrector';
import { getIstDateString, getEffectiveAppointmentDate, getIstOffsetDateString } from '../../../utils/dateUtils';
import { safeGetStorageJSON } from '../../../utils/storage';
import { save } from '../../../services/apiHelper';
import { useCircuitBreaker } from '../../../context/CircuitBreakerContext';
import { CryptoAuditService } from '../../../services/cryptoAuditService';
import type { Patient, UnifiedInvoice, PharmacyInventoryItem, DiagnosticTest } from '../../../types';


export interface BillHubTabProps {
  initialMode?: 'manual_billing' | 'ocr_scan';
  initialPatientId?: string | null;
}

export const BillHubTab: React.FC<BillHubTabProps> = ({ initialMode = 'ocr_scan', initialPatientId = null }) => {
  const { isOphthalmology } = useSpecialization();
  const { activePod, activeProfile } = useClinic();
  const { status: circuitStatus } = useCircuitBreaker();
  const isWhatsAppOffline = circuitStatus.whatsapp === 'OPEN';
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // App States — MUST be declared before any useEffect that references these setters
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [patientFilterTab, setPatientFilterTab] = useState<'today_queue' | 'all'>('today_queue');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [billingMode, setBillingMode] = useState<'digital' | 'manual'>('digital');

  // Dual Master Header Tabs (Default: 1. OCR Scan & Auto-Save)
  const [invoiceSectionTab, setInvoiceSectionTab] = useState<'ocr_scan' | 'manual_billing'>(initialMode);

  useEffect(() => {
    if (initialMode) {
      setInvoiceSectionTab(initialMode);
    }
  }, [initialMode]);

  // FIX 3: Added mediflow-state-change listener to retry patient resolution
  // if BillHubTab mounts before persistClinicOsPipeline finishes writing to localStorage.
  // This eliminates the timing gap where initialPatientId exists but the patient
  // record hasn't been flushed to PatientService.getPatients() yet.
  useEffect(() => {
    let resolved = false;

    const resolvePatient = (): boolean => {
      const allPats = PatientService.getPatients();
      if (initialPatientId) {
        const target = allPats.find(p =>
          p.id === initialPatientId ||
          (p as any).patient_code === initialPatientId ||
          (p.tokenNumber != null && String(p.tokenNumber) === String(initialPatientId))
        );
        if (target) {
          setSelectedPatient(target);
          setBillingMode('digital');
          // FIX 4: Bump refreshKey immediately after patient selection so that
          // billingLedger useMemo re-evaluates AFTER the selectedPatient useEffect
          // setters (manualMedicinesList, selectedMedicines) have fired.
          // This prevents the ₹0 / empty-medicines first-paint race condition.
          setRefreshKey(k => k + 1);
          resolved = true;
          return true;
        }
      }

      // Always fall back to the active patient
      const activePat = api.getActivePatient();
      if (activePat) {
        setSelectedPatient(activePat);
        setBillingMode('digital');
        setRefreshKey(k => k + 1);
        resolved = true;
        return true;
      }
      return false;
    };

    if (resolvePatient()) return;

    // Patient not yet in cache — listen for state-change events fired by
    // persistClinicOsPipeline after it flushes save('patients', ...) to localStorage.
    const t = setTimeout(resolvePatient, 150);
    const handleStateChange = () => {
      if (!resolved) resolvePatient();
    };
    window.addEventListener('mediflow-state-change', handleStateChange);
    // Safety net: stop retrying after 4 seconds regardless
    const safetyTimer = setTimeout(() => {
      window.removeEventListener('mediflow-state-change', handleStateChange);
    }, 4000);

    return () => {
      clearTimeout(t);
      clearTimeout(safetyTimer);
      window.removeEventListener('mediflow-state-change', handleStateChange);
    };
  }, [initialPatientId]);
  
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
  const [includePharmacy, setIncludePharmacy] = useState(true);
  const [includeLabTests, setIncludeLabTests] = useState(true);
  const [selectedMedicines, setSelectedMedicines] = useState<Record<string, { selected: boolean; qty: number | string }>>({});
  const [selectedTests, setSelectedTests] = useState<Record<string, boolean>>({});
  const [excludedMedicines, setExcludedMedicines] = useState<string[]>([]);
  const [excludedTests, setExcludedTests] = useState<string[]>([]);
  const [discountInput, setDiscountInput] = useState<number>(0);
  const [referralCode, setReferralCode] = useState<string>("");
  const [partialCashAmount, setPartialCashAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'cash'>('upi');
  const [isClearing, setIsClearing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [isPosExpanded, setIsPosExpanded] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInAge, setWalkInAge] = useState('');
  const [walkInGender, setWalkInGender] = useState<'Male' | 'Female' | 'Other'>('Male');

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
      setExcludedMedicines([]);
      setExcludedTests([]);

      // Check if consultation fee was ALREADY paid at Gate 1 booking time
      const saasInvoices = BillingService.getInvoices();
      const uInvoices = BillingService.getUnifiedInvoices();

      // 🌟 PERMANENT FIX (Bug #4): For paper-scan patients, the consultation was completed
      // during the physical clinic visit. The prescription scan IS the consultation record.
      // Never charge an additional OPD consult fee at the billing counter for OCR patients.
      const cleanSelPhone = (selectedPatient.phone || '').replace(/\D/g, '').slice(-10);
      const isPaperScanPatient = (selectedPatient as any)?.source === 'paper_scan' ||
        selectedPatient.queueStatus === 'completed' ||
        (selectedPatient as any)?.queue_status === 'completed' ||
        (() => {
          try {
            const ocr = localStorage.getItem('vitalsync_active_ocr_rx');
            if (ocr) {
              const parsed = JSON.parse(ocr);
              const cleanOcrPhone = (parsed?.patientPhone || parsed?.phone || '').replace(/\D/g, '').slice(-10);
              return (
                parsed?.patientId === selectedPatient.id ||
                parsed?.patientId === (selectedPatient as any).patient_code ||
                (parsed?.patientCode && parsed.patientCode === (selectedPatient as any).patient_code) ||
                (cleanSelPhone.length >= 6 && cleanOcrPhone.length >= 6 && cleanSelPhone === cleanOcrPhone)
              );
            }
          } catch (_) {}
          return false;
        })();

      const alreadyPaidConsult = isPaperScanPatient ||
        saasInvoices.some((i: any) => (i.patientId === selectedPatient.id || (selectedPatient.patientCode && i.patientId === selectedPatient.patientCode)) && i.type === 'consult' && i.status === 'paid') ||
        uInvoices.some((i: any) => isEncounterMatchingPatient(i, selectedPatient) && (i.paymentStatus === 'cleared' || i.payment_status === 'cleared') && ((i.doctorFee || i.doctor_fee || 0) > 0 || i.type === 'consult'));

      setIncludeConsult(!alreadyPaidConsult);
      setIncludeOT(true);
      setManualMedicinesList([]);
      setManualTestsList([]);
      setExcludedMedicines([]);
      setExcludedTests([]);
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

      // Check active OCR bundle from recent scan session
      let activeOcrBundle: any = null;
      try {
        const rawOcr = localStorage.getItem('vitalsync_active_ocr_rx');
        if (rawOcr) {
          const parsed = JSON.parse(rawOcr);
          const cleanOcrPhone = (parsed?.patientPhone || parsed?.phone || '').replace(/\D/g, '').slice(-10);
          const matchesById = parsed && selectedPatient && (
            parsed.patientId === selectedPatient.id ||
            parsed.patientId === (selectedPatient as any).patient_code ||
            (parsed.patientCode && parsed.patientCode === (selectedPatient as any).patient_code) ||
            (cleanSelPhone.length >= 6 && cleanOcrPhone.length >= 6 && cleanSelPhone === cleanOcrPhone) ||
            (parsed.tokenNumber != null && selectedPatient.tokenNumber != null && String(parsed.tokenNumber) === String(selectedPatient.tokenNumber))
          );
          if (parsed && (matchesById || isEncounterMatchingPatient(parsed, selectedPatient))) {
            activeOcrBundle = parsed;
          }
        }
      } catch (_e) { /* ignore */ }

      const latestEncounter = encounters[0];
      const latestRx = saasPrescriptions[0];

      const rawMeds = (latestEncounter?.medications && latestEncounter.medications.length > 0)
        ? latestEncounter.medications
        : (latestRx?.extractedMedicines || latestRx?.extracted_medicines || latestRx?.medications || activeOcrBundle?.extractedMedicines || activeOcrBundle?.extracted_medicines || activeOcrBundle?.medications || []);

      const rawTests = (latestEncounter?.diagnosticTests && latestEncounter.diagnosticTests.length > 0)
        ? latestEncounter.diagnosticTests
        : (latestRx?.extractedTests || latestRx?.extracted_tests || latestRx?.diagnosticTests || activeOcrBundle?.extractedTests || activeOcrBundle?.extracted_tests || activeOcrBundle?.diagnosticTests || []);

      if (rawMeds.length > 0 || rawTests.length > 0 || latestEncounter || latestRx || activeOcrBundle) {
        setBillingMode('digital');
        // Pre-select all digital medicines and sync real prices from inventory
        const initialMeds: Record<string, { selected: boolean; qty: number }> = {};
        const resolvedMedsList: Array<{ name: string; mrp: number; price: number; batch: string; stock: number }> = [];
        const fullInventory = PharmacyService.getPharmacyInventory();

        rawMeds.forEach((m: any) => {
          const rawMName = (m.medicineName || m.name || '').toLowerCase();
          const strippedName = rawMName.replace(/^(tab|tablet|cap|capsule|syrup|syp|inj|injection|drops|eye drops|ointment)\.?\s+/i, '').trim();
          const searchWord = (strippedName.split(' ')[0] || rawMName.split(' ')[0] || '').toLowerCase();
          
          if (rawMName) {
            let computedQty = 15; // default 15 tablets
            if (m.quantity) {
              computedQty = Number(m.quantity);
            } else if (m.frequency && m.duration) {
              const tabsPerDay = (m.frequency.match(/\d+/g) || []).reduce((sum: number, d: string) => sum + parseInt(d, 10), 0) || 1;
              const days = parseInt((m.duration.match(/\d+/) || ['15'])[0], 10) || 15;
              computedQty = tabsPerDay * days;
            }

            // Sync with real inventory to get price, mrp, batch
            const inventoryMatch = fullInventory.find(inv => {
              const invName = (inv.name || '').toLowerCase();
              const invGeneric = (inv.genericName || '').toLowerCase();
              return (
                (strippedName.length >= 3 && invName.includes(strippedName)) ||
                (strippedName.length >= 3 && invGeneric.includes(strippedName)) ||
                (searchWord.length >= 3 && invName.includes(searchWord)) ||
                (searchWord.length >= 3 && invGeneric.includes(searchWord)) ||
                rawMName.includes(invName)
              );
            });
            
            const resolvedName = inventoryMatch?.name || m.medicineName || m.name || 'Medicine';
            const resolvedLower = resolvedName.toLowerCase();
            
            initialMeds[resolvedLower] = { selected: true, qty: computedQty };
            if (!resolvedMedsList.some(rm => rm.name === resolvedName)) {
              resolvedMedsList.push({
                name: resolvedName,
                mrp: inventoryMatch?.mrp || 120, // default 120 if not found
                price: inventoryMatch?.price || 100, // default 100 if not found
                batch: inventoryMatch?.batchNumber || 'BATCH-01',
                stock: inventoryMatch?.stock || 10
              });
            }
          }
        });
        setSelectedMedicines(initialMeds);
        setManualMedicinesList(resolvedMedsList);

        // Pre-select all digital tests and sync real prices
        const initialTests: Record<string, boolean> = {};
        const resolvedTestsList: DiagnosticTest[] = [];

        rawTests.forEach((t: any) => {
          const tName = typeof t === 'string' ? t : (t?.name || t?.testName || '');
          const catalogMatch = LabService.getTestCatalog().find(cat => 
            cat.name.toLowerCase() === tName.toLowerCase() ||
            (tName.toLowerCase().includes('hba1c') && cat.name.includes('HbA1c')) ||
            (tName.toLowerCase().includes('lipid') && cat.name.includes('Lipid')) ||
            (tName.toLowerCase().includes('thyroid') && cat.name.includes('Thyroid')) ||
            (tName.toLowerCase().includes('creatinine') && cat.name.includes('Creatinine'))
          );
          const loinc = catalogMatch?.loincCode || (typeof t === 'string' ? t : (t?.loincCode || t?.testCode || t?.code));
          if (loinc) {
            initialTests[loinc] = true;
            if (catalogMatch && !resolvedTestsList.some(rt => rt.loincCode === catalogMatch.loincCode)) {
              resolvedTestsList.push(catalogMatch);
            }
          }
        });
        setSelectedTests(initialTests);
        setManualTestsList(resolvedTestsList);
      } else {
        setBillingMode('manual');
        setSelectedMedicines({});
        setSelectedTests({});
        setManualMedicinesList([]);
        setManualTestsList([]);
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

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredPatients.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5
  });

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

  // Today's counter metrics and receipts for Executive Cashier Cockpit
  const todayMetrics = useMemo(() => {
    const todayStr = getIstDateString();
    let allInvoices: UnifiedInvoice[] = [];
    try {
      allInvoices = BillingService.getUnifiedInvoices ? BillingService.getUnifiedInvoices() : [];
    } catch {
      allInvoices = safeGetStorageJSON<UnifiedInvoice[]>('unified_invoices', []);
    }

    const todayPaidInvoices = allInvoices.filter(inv => {
      const invDate = getIstDateString(inv.createdAt || (inv as any).created_at || (inv as any).clearedAt);
      return invDate === todayStr && (inv as any).status === 'paid';
    });

    const cashTotal = todayPaidInvoices
      .filter(inv => ((inv.paymentMethod || '') as string).toLowerCase() === 'cash')
      .reduce((sum, inv) => sum + (inv.totalAmount || (inv as any).finalTotal || 0), 0);

    const upiTotal = todayPaidInvoices
      .filter(inv => ((inv.paymentMethod || '') as string).toLowerCase() !== 'cash')
      .reduce((sum, inv) => sum + (inv.totalAmount || (inv as any).finalTotal || 0), 0);

    const totalCollected = cashTotal + upiTotal;

    const todayAppts = BillingService.getAppointments().filter(a => {
      const aDate = getEffectiveAppointmentDate(a);
      return (aDate === todayStr || getIstDateString(a.createdAt) === todayStr) && a.status !== 'cancelled';
    });
    const unbilledCount = todayAppts.filter(a => a.payment_status !== 'cleared' && a.status !== 'completed').length;

    return {
      todayPaidInvoices,
      cashTotal,
      upiTotal,
      totalCollected,
      unbilledCount,
      totalCount: todayPaidInvoices.length
    };
  }, [refreshKey]);

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

    // Use RAG fuzzy correctors for better hallucination prevention
    const words = textLower.split(/\s+/);
    words.forEach(word => {
      if (word.length < 3) return;
      const fuzzyMedMatch = fuzzyCorrectMedicineName(word);
      const exactMatch = inventory.find(i => (i.name || '').toLowerCase() === fuzzyMedMatch.corrected);
      
      if (exactMatch || textLower.includes(fuzzyMedMatch.corrected)) {
        const item = exactMatch || inventory.find(i => (i.name || '').toLowerCase().includes(fuzzyMedMatch.corrected));
        if (item) {
          const nameLower = (item.name || '').toLowerCase();
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
          if (!recognizedItems.includes(`${qty}x ${item.name}`)) {
            recognizedItems.push(`${qty}x ${item.name}`);
          }
        }
      }
    });

    // 2. Scan lab tests catalog
    const newTestsList = [...manualTestsList];
    const newTestsRecord = { ...selectedTests };

    words.forEach(word => {
      if (word.length < 3) return;
      const fuzzyLabMatch = fuzzyCorrectLabTest(word);
      if (fuzzyLabMatch) {
        const test = LabService.getTestCatalog().find(t => (t.name || '').toLowerCase().includes(fuzzyLabMatch.name.toLowerCase()) || (t.loincCode || '').toLowerCase() === fuzzyLabMatch.name.toLowerCase());
        if (test) {
          if (!newTestsList.some(t => t.loincCode === test.loincCode)) {
            newTestsList.push(test);
          }
          newTestsRecord[test.loincCode] = true;
          if (!recognizedItems.includes(test.name)) {
            recognizedItems.push(test.name);
          }
        }
      }
    });

    // Fallback if RAG tokenization misses multi-word names
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
        if (!recognizedItems.includes(`${qty}x ${item.name}`)) {
            recognizedItems.push(`${qty}x ${item.name}`);
        }
      }
    });

    LabService.getTestCatalog().forEach(test => {
      const nameLower = (test.name || '').toLowerCase();
      if (nameLower && (textLower.includes(nameLower) || (textLower.includes('hba1c') && (test.name || '').includes('HbA1c')))) {
        if (!newTestsList.some(t => t.loincCode === test.loincCode)) {
          newTestsList.push(test);
        }
        newTestsRecord[test.loincCode] = true;
        if (!recognizedItems.includes(test.name)) {
            recognizedItems.push(test.name);
        }
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


  const handleCreateQuickWalkIn = () => {
    if (!walkInName.trim()) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { title: 'Name Required', message: 'Please enter the walk-in patient name.', type: 'warning' }
      }));
      return;
    }
    const cleanPhone = walkInPhone.replace(/\D/g, '').slice(-10);
    const newPat = PatientService.registerPatient({
      name: walkInName.trim(),
      phone: cleanPhone ? `+91 ${cleanPhone}` : '+91 9999999999',
      age: parseInt(walkInAge) || 30,
      gender: walkInGender,
      tokenNumber: `#TK-${String(Math.floor(100 + Math.random() * 900))}`,
      chronicConditions: [],
      allergies: []
    });

    setPatients(PatientService.getPatients());
    setSelectedPatient(newPat);
    setShowWalkInModal(false);
    setWalkInName('');
    setWalkInPhone('');
    setWalkInAge('');

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: { 
        title: 'Walk-In Patient Registered! 👤', 
        message: `${newPat.name} (Token: ${newPat.tokenNumber}) added and ready for counter billing.`, 
        type: 'success' 
      }
    }));
  };

  // Medicine & Test Selection Handlers
  const handleToggleMedicine = (medName: string, isChecked: boolean) => {
    const key = medName.toLowerCase();
    setSelectedMedicines(prev => ({
      ...prev,
      [key]: { selected: isChecked, qty: prev[key]?.qty ?? 10 }
    }));
  };

  const handleMedicineQtyChange = (medName: string, qty: number | string) => {
    const key = medName.toLowerCase();
    let finalQty: number | string = qty;
    if (typeof qty === 'string') {
      if (qty === '') {
        finalQty = '';
      } else {
        const parsed = parseInt(qty, 10);
        finalQty = isNaN(parsed) ? '' : parsed;
      }
    } else {
      finalQty = Math.max(1, qty);
    }
    
    setSelectedMedicines(prev => ({
      ...prev,
      [key]: { selected: prev[key]?.selected ?? true, qty: finalQty }
    }));
  };

  const handleMedicinePriceChange = (medName: string, price: number | string) => {
    let finalPrice: number | string = price;
    if (typeof price === 'string') {
      if (price === '' || price.endsWith('.')) {
        finalPrice = price;
      } else {
        const parsed = parseFloat(price);
        finalPrice = isNaN(parsed) ? '' : parsed;
      }
    }
    setManualMedicinesList(prev => prev.map(m => (m.name || '').toLowerCase() === medName.toLowerCase() ? { ...m, price: finalPrice as any } : m));
  };

  const handleTestPriceChange = (testCode: string, price: number | string) => {
    let finalPrice: number | string = price;
    if (typeof price === 'string') {
      if (price === '' || price.endsWith('.')) {
        finalPrice = price;
      } else {
        const parsed = parseFloat(price);
        finalPrice = isNaN(parsed) ? '' : parsed;
      }
    }
    setManualTestsList(prev => prev.map(t => t.loincCode === testCode ? { ...t, price: finalPrice as any } : t));
  };

  const handleToggleTest = (loincCode: string, isChecked: boolean) => {
    setSelectedTests(prev => ({
      ...prev,
      [loincCode]: isChecked
    }));
  };


  const handleRemoveMedicine = (medName: string) => {
    const key = (medName || '').toLowerCase();
    setExcludedMedicines(prev => prev.includes(key) ? prev : [...prev, key]);
    setManualMedicinesList(prev => prev.filter(m => (m.name || '').toLowerCase() !== key));
    setSelectedMedicines(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleRemoveManualMedicine = handleRemoveMedicine;

  const handleRemoveTest = (loincCode: string, testName?: string) => {
    const nameKey = (testName || '').toLowerCase();
    setExcludedTests(prev => {
      const next = [...prev];
      if (loincCode && !next.includes(loincCode)) next.push(loincCode);
      if (nameKey && !next.includes(nameKey)) next.push(nameKey);
      return next;
    });
    setManualTestsList(prev => prev.filter(t => t.loincCode !== loincCode && (t.name || '').toLowerCase() !== nameKey));
    setSelectedTests(prev => {
      const next = { ...prev };
      delete next[loincCode];
      return next;
    });
  };

  const handleRemoveManualTest = handleRemoveTest;

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

    if (billingMode === 'digital' || billingMode === 'manual') {
      medicinesList = [...manualMedicinesList];
      testsList = [...manualTestsList];

      // Filter out explicitly excluded/deleted items
      medicinesList = medicinesList.filter(m => !excludedMedicines.includes((m.name || '').toLowerCase()));
      testsList = testsList.filter(t => !excludedTests.includes(t.loincCode) && !excludedTests.includes((t.name || '').toLowerCase()));
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

      medicinesList = combinedMeds.filter(m => !excludedMedicines.includes((m.name || '').toLowerCase()));
      testsList = combinedTests.filter(t => !excludedTests.includes(t.loincCode) && !excludedTests.includes((t.name || '').toLowerCase()));
    }

    // Totals Calculation
    const consultTotal = consultFee;
    let pharmacySub = 0;
    let labSub = 0;

    medicinesList.forEach(m => {
      const mNameLower = (m.name || '').toLowerCase();
      const state = selectedMedicines[mNameLower];
      if (includePharmacy && state?.selected) {
        pharmacySub += (Number(m.price) || 0) * (Number(state.qty) || 0);
      }
    });

    testsList.forEach(t => {
      if (includeLabTests && selectedTests[t.loincCode]) {
        labSub += (Number(t.price) || 0);
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
    
    // POS Polish: Remove legacy referral and GST logic. Keep only discount.
    const b2bReferralDiscount = 0; // Legacy 

    const totalDiscount = pharmacyDiscount + discountInput;

    const pharmGst = 0;
    const labGst = 0;
    const totalGst = 0;

    const totalBeforeDiscount = consultTotal + pharmacySub + labSub + otTotal;
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
  }, [selectedPatient, billingMode, manualExtractedData, manualMedicinesList, manualTestsList, includeConsult, includeOT, includePharmacy, includeLabTests, selectedMedicines, selectedTests, discountInput, referralCode, inventory, isOphthalmology, refreshKey]);
  const handleClearBill = async () => {
    if (!selectedPatient || !billingLedger) return;
    if (isClearing) return; // Phase 8 POS Double-Tap Guard
    setIsClearing(true);

    try {
      // PHASE 19: Offline Vault POS Support
      if (!navigator.onLine) {
        const unifiedInvoiceId = `inv-${crypto.randomUUID().substring(0, 8)}`;
        const payload = {
          patientId: selectedPatient.id,
          billingLedger,
          paymentMethod,
          unifiedInvoiceId,
          timestamp: new Date().toISOString()
        };
        const walDB = await import('../../../services/api').then(m => m.walDB);
        if (walDB && walDB.addEntry) {
          await walDB.addEntry('offline_pos_checkout', payload);
        }
        window.dispatchEvent(new CustomEvent('mediflow-toast', { detail: { message: `Offline Mode Active. Bill secured in Local Vault POS and will sync automatically.`, type: 'info', title: 'Offline Checkout' }}));
        
        setSelectedPatient(null);
        setSelectedMedicines({});
        setSelectedTests({});
        setIsClearing(false);
        return;
      }

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
        platformFee: 0.00,
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

      // Generate Cryptographic PHI Tamper-Evident Hash
      const auditHash = await CryptoAuditService.generatePHISignature(newUnifiedInvoice, activeProfile?.id || 'compounder');
      (newUnifiedInvoice as any).hash_signature = auditHash.signature;
      (newUnifiedInvoice as any).hash_timestamp = auditHash.timestamp;

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
      await BillingService.clearInvoice(unifiedInvoiceId, paymentMethod);

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
              itemInInv.stock = Math.max(0, itemInInv.stock - (Number(state.qty) || 0));
              invUpdated = true;
              billItems.push({
                inventoryItemId: itemInInv.id,
                name: itemInInv.name,
                batchNumber: itemInInv.batchNumber,
                expiryDate: itemInInv.expiryDate,
                quantity: state.qty,
                mrp: itemInInv.mrp,
                sellingPrice: itemInInv.price,
                lineTotal: itemInInv.price * (Number(state.qty) || 0)
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
          
          const medBillHash = await CryptoAuditService.generatePHISignature(newMedicineBill, activeProfile?.id || 'compounder');
          (newMedicineBill as any).hash_signature = medBillHash.signature;
          (newMedicineBill as any).hash_timestamp = medBillHash.timestamp;

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
      window.dispatchEvent(new CustomEvent('mediflow-financial-update'));

      setRefreshKey(prev => prev + 1);

      if (isWhatsAppOffline) {
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: { title: 'Bill Settled! 🧾', message: `Invoice amount of ₹${billingLedger.finalTotal.toFixed(2)} received via ${paymentMethod.toUpperCase()}. WhatsApp offline, printing physical copy!`, type: 'info' }
        }));
        setTimeout(() => window.print(), 500);
      } else {
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: { title: 'Bill Settled & WhatsApp Sent! 🧾📱', message: `Invoice amount of ₹${billingLedger.finalTotal.toFixed(2)} received via ${paymentMethod.toUpperCase()}. Digital bill sent to patient WhatsApp!`, type: 'success' }
        }));
      }

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
    <div className="space-y-6 animate-in fade-in duration-500 pb-24 lg:pb-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Patient Selection (Today's OPD / All Patients) */}
        <div className={`lg:col-span-3 glass-panel p-4 sm:p-5 bg-white dark:bg-clinical-900/40 border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl flex flex-col h-auto lg:h-[calc(100vh-140px)] transition-all ${
          selectedPatient ? 'hidden lg:flex' : 'flex'
        }`}>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
            <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-500" />
              Patient Selection
            </h3>
            <button
              type="button"
              onClick={() => setShowWalkInModal(true)}
              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] rounded-lg shadow-xs flex items-center gap-1 transition cursor-pointer border-0"
              title="Add a walk-in patient directly at counter"
            >
              <UserPlus className="w-3 h-3" />
              + Walk-In
            </button>
          </div>

          {/* Today's OPD vs All filter toggle */}
          <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/80 rounded-xl mb-3">
            <button
              type="button"
              onClick={() => setPatientFilterTab('today_queue')}
              className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-extrabold transition cursor-pointer border-0 ${
                patientFilterTab === 'today_queue'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-transparent'
              }`}
            >
              📅 Today's OPD ({patients.filter(p => todayOpdPatientIds.has(p.id)).length})
            </button>
            <button
              type="button"
              onClick={() => setPatientFilterTab('all')}
              className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-extrabold transition cursor-pointer border-0 ${
                patientFilterTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-transparent'
              }`}
            >
              👥 All ({patients.length})
            </button>
          </div>
          
          <SearchInput 
            value={searchQuery} 
            onChange={setSearchQuery} 
            placeholder="Search name, phone, token..." 
            className="mb-3"
          />

          <div 
            ref={parentRef}
            className="flex-1 overflow-y-auto pr-1 no-scrollbar max-h-[60vh] lg:max-h-none"
          >
            {filteredPatients.length === 0 ? (
              <div className="text-center p-6 text-slate-400 text-xs flex flex-col items-center gap-2">
                <Users className="w-8 h-8 opacity-20" />
                <span>No patients found</span>
                <button
                  type="button"
                  onClick={() => setShowWalkInModal(true)}
                  className="mt-1 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] rounded-lg border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                >
                  + Add Walk-In Patient
                </button>
              </div>
            ) : (
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative'
                }}
              >
                {rowVirtualizer.getVirtualItems().map(virtualRow => {
                  const p = filteredPatients[virtualRow.index];
                  const isSelected = selectedPatient?.id === p.id;
                  const encounters = EncounterService.getEncounters().filter(e => isEncounterMatchingPatient(e, p));
                  const saasPrescriptions = (BillingService.getPrescriptions ? BillingService.getPrescriptions() : []).filter((r: any) => isEncounterMatchingPatient(r, p));
                  const hasRx = encounters.length > 0 || saasPrescriptions.length > 0;

                  return (
                    <div 
                      key={virtualRow.key}
                      onClick={() => setSelectedPatient(p)}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                        paddingBottom: '8px'
                      }}
                    >
                      <div className={`h-full p-3 rounded-xl cursor-pointer border transition-all text-left relative ${
                        isSelected 
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-xs' 
                          : 'border-slate-100 dark:border-slate-800 hover:border-indigo-300 bg-white/50 dark:bg-slate-900/30'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              window.dispatchEvent(new CustomEvent('mediflow-open-patient-profile', {
                                detail: p
                              }));
                            }}
                            className="font-bold text-xs text-slate-900 dark:text-white truncate max-w-[70%] hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer"
                            title="Click to view 360° patient profile"
                          >
                            {p.name}
                          </div>
                          <span className="text-[9px] font-mono font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">
                            {p.tokenNumber || 'WALK-IN'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                          <span>{p.phone || 'No phone'}</span>
                          {hasRx && (
                            <span className="text-[8px] font-black px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded">
                              Rx Ready
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* WHEN NO PATIENT IS SELECTED: Executive Counter Cashier Cockpit (Spans 9 columns) */}
        {!selectedPatient ? (
          <div className="lg:col-span-9 flex flex-col gap-5 text-left">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Metric 1: Today's Collections */}
              <div className="glass-panel p-4 bg-white dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Today's Collections</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  ₹{todayMetrics.totalCollected.toFixed(2)}
                </div>
                <div className="flex items-center gap-2 mt-2 text-[10px]">
                  <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold px-1.5 py-0.5 rounded">
                    Cash: ₹{todayMetrics.cashTotal.toFixed(0)}
                  </span>
                  <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold px-1.5 py-0.5 rounded">
                    UPI: ₹{todayMetrics.upiTotal.toFixed(0)}
                  </span>
                </div>
              </div>

              {/* Metric 2: Pending Unbilled Queue */}
              <div className="glass-panel p-4 bg-white dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Awaiting Billing</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {todayMetrics.unbilledCount} Patients
                </div>
                <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>OPD queue pending settlement</span>
                </div>
              </div>

              {/* Metric 3: Total Invoices Settled */}
              <div className="glass-panel p-4 bg-white dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Receipts Cleared</span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Receipt className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {todayMetrics.totalCount} Bills
                </div>
                <div className="flex items-center gap-1 mt-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>100% WhatsApp receipts sent</span>
                </div>
              </div>

              {/* Metric 4: Direct Clinic Settlement & Retention */}
              <div className="glass-panel p-4 bg-white dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Direct Retention</span>
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-cyan-600 dark:text-cyan-400">
                  100% Direct
                </div>
                <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                  <span>0% Platform Cut • Pure SaaS</span>
                </div>
              </div>
            </div>

            {/* Cashier Welcome / Quick Action Banner */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden border border-indigo-500/20">
              <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="space-y-2 max-w-xl relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-400/20">
                  <Sparkles className="w-3.5 h-3.5" />
                  Hospital-Grade Cashier POS Terminal
                </div>
                <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Ready to Settle OPD, Pharmacy &amp; Lab Invoices
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Select a patient from today's OPD queue on the left to review medications and tests, or click below to issue an instant counter invoice.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 relative z-10 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowWalkInModal(true)}
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition cursor-pointer border-0 active:scale-95"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ New Walk-in Invoice</span>
                </button>
              </div>
            </div>

            {/* Recent Counter Settlements Table */}
            <div className="glass-panel p-5 bg-white dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm flex-1 flex flex-col min-h-[320px]">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-indigo-500" />
                  Recent Cleared Counter Invoices (Today)
                </h4>
                <span className="text-[10px] text-slate-500 font-mono">
                  {todayMetrics.todayPaidInvoices.length} transactions recorded
                </span>
              </div>

              {todayMetrics.todayPaidInvoices.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
                  <Receipt className="w-10 h-10 opacity-20 mb-2" />
                  <p className="font-bold text-xs text-slate-600 dark:text-slate-300">No Counter Settlements Yet Today</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Select a patient on the left or create a walk-in to start counter checkout.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <th className="pb-2">Invoice #</th>
                        <th className="pb-2">Patient</th>
                        <th className="pb-2">Items</th>
                        <th className="pb-2">Payment Mode</th>
                        <th className="pb-2 text-right">Amount</th>
                        <th className="pb-2 text-right">Receipt / WhatsApp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {todayMetrics.todayPaidInvoices.slice(0, 8).map((inv: any) => (
                        <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                          <td className="py-2.5 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                            {inv.id.substring(0, 10)}
                          </td>
                          <td className="py-2.5">
                            <span 
                              onClick={() => {
                                window.dispatchEvent(new CustomEvent('mediflow-open-patient-profile', {
                                  detail: inv.patientId || inv.patient_id || inv.patientName
                                }));
                              }}
                              className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 hover:underline cursor-pointer"
                              title="Click to view full patient medical record"
                            >
                              {inv.patientName || inv.patient_name || 'Patient'}
                            </span>
                          </td>
                          <td className="py-2.5 text-slate-500 text-[11px]">
                            {inv.items?.length || 1} Item(s)
                          </td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
                              (inv.paymentMethod || '').toLowerCase() === 'cash'
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            }`}>
                              {inv.paymentMethod || 'UPI'}
                            </span>
                          </td>
                          <td className="py-2.5 text-right font-black text-slate-900 dark:text-white">
                            ₹{(inv.totalAmount || inv.finalTotal || 0).toFixed(2)}
                          </td>
                          <td className="py-2.5 text-right">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                              <Check className="w-3 h-3" />
                              WhatsApp Sent
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* MAIN COLUMN: Cart, Live Catalog Search & Voice Billing */}
            <div className="lg:col-span-12 glass-panel p-4 sm:p-5 bg-white dark:bg-clinical-900/40 border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl flex flex-col h-auto lg:h-[calc(100vh-140px)] transition-all flex">
              {/* Selected Patient Banner */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h3 
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('mediflow-open-patient-profile', {
                          detail: selectedPatient
                        }));
                      }}
                      className="text-sm font-black text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer"
                      title="Click to view 360° patient profile"
                    >
                      {selectedPatient.name}
                    </h3>
                    <span className="text-[9px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                      {selectedPatient.tokenNumber || 'PAT'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('mediflow-open-patient-profile', {
                          detail: selectedPatient
                        }));
                      }}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition cursor-pointer border-0"
                    >
                      360° Profile →
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500">{selectedPatient.phone} · {selectedPatient.age || '—'} Y / {selectedPatient.gender || '—'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPatient(null)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-bold px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/70 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition cursor-pointer flex items-center gap-1 shrink-0 active:scale-95"
                  title="Return to Cashier Cockpit"
                >
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                  <span>Switch Patient</span>
                </button>
              </div>

              {/* Search & Voice Billing Engine (Google-Style Single Row) */}
              <div className="mb-3">
                <div className="relative flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-200 rounded-full transition-all px-3 py-1.5 shadow-sm hover:shadow-md">
                  <Search className="h-4 w-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search medicine (e.g. Paracetamol) or lab test..."
                    value={manualItemSearchQuery}
                    onChange={(e) => setManualItemSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent border-none text-xs outline-none px-3 text-slate-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleStartVoiceBilling}
                    className={`shrink-0 flex items-center justify-center p-1.5 rounded-full border-0 transition-all cursor-pointer ${
                      isListening 
                        ? 'bg-rose-100 text-rose-500 dark:bg-rose-900/30 dark:text-rose-400 animate-pulse' 
                        : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50'
                    }`}
                    title="Speak Billing"
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  {/* Autocomplete Dropdown */}
                  {catalogSuggestions.length > 0 && (
                    <div className="absolute top-12 left-0 right-0 z-30 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-h-[220px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {catalogSuggestions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleAddSuggestedItem(s)}
                          className="w-full px-4 py-2.5 text-left text-xs hover:bg-indigo-50 dark:hover:bg-slate-800 cursor-pointer border-0 bg-transparent flex items-center justify-between group transition-all"
                        >
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600">{s.name}</span>
                            <span className="block text-[9.5px] text-slate-400 mt-0.5">
                              {s.type === 'pharmacy' ? `Medicine (${(s.item as any)?.stock ?? 'In Stock'})` : 'Pathology Test'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-indigo-600 dark:text-indigo-400">₹{s.price}</span>
                            <span className="text-[9px] bg-indigo-600 text-white font-black px-2 py-0.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                              Add
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {voiceTranscript && (
                  <div className="mt-2 p-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 rounded-xl text-[10px] text-indigo-700 dark:text-indigo-300 font-medium text-center animate-in fade-in slide-in-from-top-2">
                    🎤 {voiceTranscript}
                  </div>
                )}
              </div>

              {/* Scrollable Cart List */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 pb-32 no-scrollbar text-left">
                {/* 1. Doctor Consultation Fee */}
                <div className="p-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Stethoscope className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Doctor Consultation</span>
                        <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-mono px-1.5 py-0.2 rounded font-bold">
                          {(billingLedger as any)?.consultFeeType || 'OPD'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    ₹{(billingLedger?.consultFee || 500).toFixed(2)}
                  </span>
                </div>

                {/* Ophthalmology Minor OT / Eye Procedure Fee */}
                {isOphthalmology && (
                  <div className="p-2 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/30 flex justify-between items-center">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeOT}
                        onChange={(e) => setIncludeOT(e.target.checked)}
                        className="rounded text-rose-600 focus:ring-rose-500"
                      />
                      <div>
                        <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-rose-500" />
                          <span>Minor OT / Eye Procedure</span>
                        </div>
                        <span className="text-[10px] text-slate-400">Daycare Procedure &amp; Sterile Pack</span>
                      </div>
                    </label>
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      ₹{((billingLedger as any)?.otFee || 350).toFixed(2)}
                    </span>
                  </div>
                )}

                {/* 2. Prescribed / Added Medicines in Cart (Toggleable & Editable) */}
                {(billingLedger?.medicinesList?.length || 0) > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 p-2">
                    <div className="flex items-center justify-between mb-2 px-2 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={includePharmacy}
                          onChange={(e) => setIncludePharmacy(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                        />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                          <Pill className="w-3.5 h-3.5" /> Pharmacy
                        </span>
                      </label>
                      <span className="text-[9px] text-slate-400 font-mono">FEFO Dispensed</span>
                    </div>

                    <div className={`space-y-1.5 transition-opacity ${includePharmacy ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                      {billingLedger?.medicinesList?.map((med: any, i: number) => {
                        const mKey = (med.name || '').toLowerCase();
                        const state = selectedMedicines[mKey] || { selected: true, qty: 10 };
                        const isManual = manualMedicinesList.some(m => (m.name || '').toLowerCase() === mKey);

                        return (
                          <div 
                            key={i} 
                            className={`p-1.5 rounded-xl border flex items-center justify-between transition-all ${
                              state.selected 
                                ? 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/40' 
                                : 'bg-slate-50/40 border-slate-100 dark:bg-slate-900/20 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              <input 
                                type="checkbox" 
                                checked={state.selected} 
                                onChange={(e) => handleToggleMedicine(med.name, e.target.checked)}
                                className="rounded text-emerald-600 focus:ring-emerald-500 shrink-0"
                              />
                              <div className="truncate">
                                <div className="font-bold text-xs text-slate-900 dark:text-white truncate">{med.name}</div>
                                <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                                  <span>{med.batch || 'BATCH-2026'}</span>
                                  <span>•</span>
                                  <span>Stock: {med.stock || 45}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              {/* Editable Quantity Input */}
                              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleMedicineQtyChange(med.name, (Number(state.qty) || 0) - 1)}
                                  className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white rounded transition cursor-pointer border-0 bg-transparent"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <input
                                  type="text"
                                  value={state.qty}
                                  onChange={(e) => handleMedicineQtyChange(med.name, e.target.value)}
                                  className="w-7 text-center font-mono font-bold text-xs text-slate-800 dark:text-slate-200 bg-transparent border-0 outline-none px-0 py-1"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleMedicineQtyChange(med.name, (Number(state.qty) || 0) + 1)}
                                  className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white rounded transition cursor-pointer border-0 bg-transparent"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>

                              <div className="text-right flex flex-col items-end">
                                <div className="flex items-center text-xs font-black text-slate-900 dark:text-white">
                                  ₹<input 
                                    type="text" 
                                    value={med.price} 
                                    onChange={(e) => handleMedicinePriceChange(med.name, e.target.value)}
                                    className="w-10 text-right bg-transparent border-0 outline-none p-0 focus:border-b focus:border-indigo-500 font-black"
                                  />
                                </div>
                                <span className="block text-[9px] font-black text-slate-400">
                                  Total: ₹{((Number(med.price) || 0) * (Number(state.qty) || 0)).toFixed(2)}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveMedicine(med.name)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer border-0 bg-transparent"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Pathology Tests in Cart (Toggleable & Editable) */}
                {(billingLedger?.testsList?.length || 0) > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 p-2">
                    <div className="flex items-center justify-between mb-2 px-2 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={includeLabTests}
                          onChange={(e) => setIncludeLabTests(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                        />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                          <FlaskConical className="w-3 h-3 text-teal-500" /> Pathology
                        </span>
                      </label>
                      <span className="text-[9px] text-slate-400 font-mono">LOINC Standardized</span>
                    </div>

                    <div className={`space-y-1.5 transition-opacity ${includeLabTests ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                      {billingLedger?.testsList?.map((test: any, i: number) => {
                        const isSelected = selectedTests[test.loincCode];
                        const isManual = manualTestsList.some(t => t.loincCode === test.loincCode);

                        return (
                          <div 
                            key={i} 
                            className={`p-1.5 rounded-xl border flex items-center justify-between transition-all ${
                              isSelected 
                                ? 'bg-teal-50/70 border-teal-200 dark:bg-teal-950/20 dark:border-teal-800/40' 
                                : 'bg-slate-50/40 border-slate-100 dark:bg-slate-900/20 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              <input 
                                type="checkbox" 
                                checked={!!isSelected} 
                                onChange={(e) => setSelectedTests(prev => ({ ...prev, [test.loincCode]: e.target.checked }))}
                                className="rounded text-teal-600 focus:ring-teal-500 shrink-0"
                              />
                              <div className="truncate">
                                <div className="font-bold text-xs text-slate-900 dark:text-white truncate">{test.name}</div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  LOINC: {test.loincCode} · {test.category || 'Clinical'}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="flex items-center text-xs font-black text-slate-900 dark:text-white">
                                ₹<input 
                                  type="text" 
                                  value={test.price} 
                                  onChange={(e) => handleTestPriceChange(test.loincCode, e.target.value)}
                                  className="w-12 text-right bg-transparent border-0 outline-none p-0 focus:border-b focus:border-indigo-500 font-black"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveTest(test.loincCode, test.name)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer border-0 bg-transparent"
                                title="Remove test"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Empty Cart Notice */}
                {(billingLedger?.medicinesList?.length === 0 && billingLedger?.testsList?.length === 0) && (
                  <div className="p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center text-xs text-slate-400 space-y-1">
                    <p className="font-semibold text-slate-600 dark:text-slate-300">No medicines or lab tests in cart</p>
                    <p className="text-[10px]">Use the catalog search above or tap "Speak Billing" to add items.</p>
                  </div>
                )}
              </div>
            </div>

            {/* FLOATING POS: Financial Summary & Checkout */}
            <div className={`fixed bottom-0 left-0 right-0 lg:left-[calc(25%+1.5rem)] lg:right-6 bg-slate-900/95 dark:bg-slate-950/95 text-white shadow-[0_-15px_40px_rgba(0,0,0,0.4)] rounded-t-[2rem] border-t border-slate-700/50 backdrop-blur-xl transition-all duration-[400ms] ease-[cubic-bezier(0.23,1,0.32,1)] z-50 flex flex-col ${isPosExpanded ? 'max-h-[50vh] p-5 sm:p-6' : 'max-h-[110px] p-4 cursor-pointer hover:bg-slate-800/95 group'}`} onClick={() => !isPosExpanded && setIsPosExpanded(true)}>
              {/* Drag Handle */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-600/50 rounded-full" />
              
              <div className={`flex items-center justify-between ${isPosExpanded ? 'mb-5 mt-2' : 'mt-2'} relative`}>
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2 text-indigo-300">
                  <Receipt className="h-4 w-4 sm:h-5 sm:w-5" />
                  {isPosExpanded ? 'Final Settlement POS' : 'Tap to expand POS'}
                </h3>
                <div className="flex items-center gap-3">
                  {isPosExpanded && (
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setIsPosExpanded(false); }}
                      className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                      <ArrowRight className="w-4 h-4 rotate-90" />
                    </button>
                  )}
                </div>
              </div>

              {!isPosExpanded ? (
                // Collapsed State
                <div className="flex items-center justify-between mt-1">
                  <div className="flex flex-col">
                    <span className="text-2xl font-black text-emerald-400">₹{billingLedger?.finalTotal.toFixed(2) || '0.00'}</span>
                  </div>
                  <button 
                    type="button"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-lg transition-transform group-hover:scale-105"
                  >
                    Checkout
                  </button>
                </div>
              ) : (
                // Expanded State
                <>
                  {isWhatsAppOffline && (
                    <div className="mb-4 bg-rose-500/20 border border-rose-500/50 rounded-xl p-3 flex items-start gap-2 text-left">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-[10px] font-black text-rose-300 uppercase tracking-wider">Meta API Regional Outage</h4>
                        <p className="text-[10px] text-rose-200/80 mt-0.5 leading-snug">WhatsApp dispatch is currently offline. Rerouting to Physical Print Protocols to prevent queue bottlenecks.</p>
                      </div>
                    </div>
                  )}

                  {!billingLedger ? (
                    <div className="flex-1 flex items-center justify-center text-white/40 text-xs text-center p-4">
                      Select a patient on the left to review ledger and complete payment.
                    </div>
                  ) : (
                    <div className="flex flex-col h-full overflow-y-auto no-scrollbar">
                      <div className="space-y-3 flex-1 pr-1 text-xs sm:text-sm">
                        <div className="flex justify-between text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <Stethoscope className="w-3.5 h-3.5 text-indigo-400" />
                            Doctor Consultation:
                          </span>
                          <span className="font-mono font-bold">₹{billingLedger.consultTotal.toFixed(2)}</span>
                        </div>

                        <div className="flex justify-between text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <Pill className="w-3.5 h-3.5 text-emerald-400" />
                            Pharmacy Medicines:
                          </span>
                          <span className="font-mono font-bold">₹{billingLedger.pharmacySub.toFixed(2)}</span>
                        </div>

                        <div className="flex justify-between text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <FlaskConical className="w-3.5 h-3.5 text-teal-400" />
                            Pathology Tests:
                          </span>
                          <span className="font-mono font-bold">₹{billingLedger.labSub.toFixed(2)}</span>
                        </div>

                        <div className="h-px bg-white/10 my-3" />

                        {/* Compounder Custom Discount */}
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 text-xs font-semibold">Custom Discount:</span>
                          <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1.5">
                            <span className="text-xs text-slate-400">₹</span>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={discountInput || ''}
                              onChange={(e) => setDiscountInput(parseFloat(e.target.value) || 0)}
                              className="w-20 bg-transparent text-right font-mono text-xs text-white outline-none"
                            />
                          </div>
                        </div>

                        {billingLedger.totalDiscount > 0 && (
                          <div className="flex justify-between text-rose-400 font-bold mt-2">
                            <span>Total Discounts:</span>
                            <span className="font-mono">-₹{billingLedger.totalDiscount.toFixed(2)}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-6 pt-4 border-t border-white/10 space-y-4">
                        <div className="flex justify-between items-baseline">
                          <div>
                            <span className="text-sm font-bold text-slate-300">Total Net Amount</span>
                          </div>
                          <span className="text-3xl font-black text-emerald-400 tracking-tight">
                            ₹{billingLedger.finalTotal.toFixed(2)}
                          </span>
                        </div>

                        <button 
                          type="button"
                          onClick={() => { setIsPosExpanded(false); handleClearBill(); }}
                          disabled={isClearing}
                          className="w-full py-4 mt-4 rounded-2xl text-white font-black text-sm sm:text-base shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border border-white/10 bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 hover:shadow-indigo-500/30 backdrop-blur-md"
                        >
                          {isClearing ? 'Settling & Clearing...' : (isWhatsAppOffline ? 'Clear & Print Physical Bill' : 'Submit & Dispatch')}
                          {!isClearing && (isWhatsAppOffline ? <Printer className="w-5 h-5" /> : <Send className="w-5 h-5" />)}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Quick Walk-In Registration Modal */}
      {showWalkInModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowWalkInModal(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-left"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Quick Walk-In Patient</h3>
                  <p className="text-[10px] text-slate-500">Register new patient for instant counter POS billing</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWalkInModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 border-0 bg-transparent cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Patient Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Mobile / WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={walkInPhone}
                    onChange={(e) => setWalkInPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Age (Years)</label>
                  <input
                    type="number"
                    placeholder="35"
                    value={walkInAge}
                    onChange={(e) => setWalkInAge(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Gender</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Male', 'Female', 'Other'] as const).map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setWalkInGender(g)}
                      className={`py-1.5 text-xs font-bold rounded-xl border transition cursor-pointer ${
                        walkInGender === g
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-transparent'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowWalkInModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer border-0 bg-transparent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateQuickWalkIn}
                className="px-5 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md cursor-pointer border-0"
              >
                Register & Start Billing
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
