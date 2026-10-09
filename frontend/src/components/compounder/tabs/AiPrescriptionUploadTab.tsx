import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  Loader2,
  CheckCircle2,
  User,
  Phone,
  FileText,
  ChevronRight,
  Activity,
  Zap,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Pill,
  Stethoscope,
  ShieldCheck,
  Clock,
  Check,
  Eye,
  MapPin
} from 'lucide-react';
import { api } from '../../../services/api';
import type { Patient, MedicationRequest } from '../../../types';
import { PatientService } from '../../../services/patientService';
import { EncounterService } from '../../../services/encounterService';
import { BillingService } from '../../../services/billingService';
import { PaperModeService } from '../../../services/paperModeService';
import { fuzzyCorrectMedicineName, fuzzyCorrectLabTest } from '../../../utils/ocrFuzzyCorrector';
import { getPodContext, FALLBACK_DOCTOR_ID } from '../../../services/podContext';
import { getIstDateString, getEffectiveAppointmentDate } from '../../../utils/dateUtils';

interface AiPrescriptionUploadTabProps {
  onSuccess?: (patientId: string) => void;
}

type AiStep = 'idle' | 'scanning' | 'extracting' | 'done' | 'committing' | 'completed' | 'error';


export const AiPrescriptionUploadTab: React.FC<AiPrescriptionUploadTabProps> = ({ onSuccess }) => {
  const [currentStep, setCurrentStep] = useState<AiStep>('idle');
  const [statusText, setStatusText] = useState<string>('');
  const [telemetryStep, setTelemetryStep] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [cloudSyncSuccess, setCloudSyncSuccess] = useState<boolean>(false);
  const [savedPatientId, setSavedPatientId] = useState<string | null>(null);
  const isCommittingRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      if (uploadedImageUrl) {
        URL.revokeObjectURL(uploadedImageUrl);
      }
    };
  }, [uploadedImageUrl]);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Extracted Data State
  const [extractedPatient, setExtractedPatient] = useState<Patient | null>(null);
  const [extractedMeds, setExtractedMeds] = useState<any[]>([]);
  const [chronicBadges, setChronicBadges] = useState<string[]>([]);
  const [extractedLabs, setExtractedLabs] = useState<any[]>([]);
  const [isAssistedReview, setIsAssistedReview] = useState<boolean>(false);
  const [inputMobileNumber, setInputMobileNumber] = useState<string>('');
  const [isEditingPhone, setIsEditingPhone] = useState<boolean>(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [inputAddress, setInputAddress] = useState<string>('');
  const [isEditingAddress, setIsEditingAddress] = useState<boolean>(false);
  const [isEditingAll, setIsEditingAll] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const profileSectionRef = useRef<HTMLDivElement>(null);
  const hasAutoCommitted = useRef<boolean>(false);
  const pendingCommitRef = useRef<{
    patient?: Patient;
    meds?: any[];
    labs?: any[];
    badges?: string[];
  } | null>(null);

  // Auto-scroll to extracted profile widget when OCR extraction finishes
  useEffect(() => {
    if ((currentStep === 'done' || currentStep === 'completed') && extractedPatient) {
      const scrollTimer = setTimeout(() => {
        if (profileSectionRef.current) {
          profileSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 150);
      return () => clearTimeout(scrollTimer);
    }
  // 1-Tap Direct Camera Trigger: Open device camera immediately from elevated FAB or dashboard hero
  useEffect(() => {
    const triggerCamera = () => {
      setTimeout(() => {
        if (cameraInputRef.current) {
          cameraInputRef.current.click();
        }
      }, 100);
    };

    try {
      if (sessionStorage.getItem('mediflow_pending_camera_trigger') === 'true') {
        sessionStorage.removeItem('mediflow_pending_camera_trigger');
        triggerCamera();
      }
    } catch { /* ignore */ }

    const handleCameraEvent = () => {
      triggerCamera();
    };

    window.addEventListener('mediflow-trigger-ocr-camera', handleCameraEvent);
    return () => {
      window.removeEventListener('mediflow-trigger-ocr-camera', handleCameraEvent);
    };
  }, []);

  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);

  const handleVoiceCorrect = (fieldId: string, index?: number) => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', { detail: { title: 'Not Supported', message: 'Voice dictation requires Google Chrome.', type: 'error' }}));
      return;
    }
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRec();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    setActiveVoiceField(fieldId);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (fieldId === 'name' && extractedPatient) {
        setExtractedPatient({ ...extractedPatient, name: transcript });
      } else if (fieldId === 'address' && extractedPatient) {
        setExtractedPatient({ ...extractedPatient, address: transcript });
        setInputAddress(transcript);
      } else if (fieldId.startsWith('medicine_') && typeof index === 'number') {
        const nm = [...extractedMeds];
        const fuzzyResult = fuzzyCorrectMedicineName(transcript);
        const finalName = fuzzyResult.corrected;
        if (transcript.toLowerCase() !== finalName.toLowerCase()) {
          import('../../../utils/ocrFuzzyCorrector').then(m => m.learnOcrAlias(transcript, finalName)).catch(e => console.warn(e));
        }
        nm[index].medicineName = finalName;
        nm[index].name = finalName;
        setExtractedMeds(nm);
      } else if (fieldId.startsWith('lab_') && typeof index === 'number') {
        const nl = [...extractedLabs];
        const fuzzyResult = fuzzyCorrectLabTest(transcript);
        const finalName = fuzzyResult.name;
        if (transcript.toLowerCase() !== finalName.toLowerCase()) {
          import('../../../utils/ocrFuzzyCorrector').then(m => m.learnOcrAlias(transcript, finalName)).catch(e => console.warn(e));
        }
        nl[index].name = finalName;
        setExtractedLabs(nl);
      }
      setActiveVoiceField(null);
    };

    recognition.onerror = () => setActiveVoiceField(null);
    recognition.onend = () => setActiveVoiceField(null);
    
    recognition.start();
  };

  // 🌟 ZERO-DATA-ENTRY DOCTRINE: Autonomous non-blocking cloud sync trigger
  useEffect(() => {
    if (currentStep === 'idle') {
      hasAutoCommitted.current = false;
      setSavedPatientId(null);
      setCloudSyncSuccess(false);
    }
    if (currentStep === 'done' && !hasAutoCommitted.current && extractedPatient) {
      hasAutoCommitted.current = true;
      persistClinicOsPipeline(extractedPatient, extractedMeds, extractedLabs, chronicBadges);
    }
  }, [currentStep, isAssistedReview, extractedPatient, extractedMeds, extractedLabs, chronicBadges]);

  const handleSavePatientAddress = async (newAddr: string) => {
    if (extractedPatient) {
      const trimmed = newAddr.trim();
      const updated = { ...extractedPatient, address: trimmed || undefined };
      setExtractedPatient(updated);
      api.setActivePatient(updated);
      setIsEditingAddress(false);
      window.dispatchEvent(new CustomEvent('mediflow-state-change'));
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Address Updated ✅',
          message: `Saved address for ${updated.name}.`,
          type: 'success'
        }
      }));
      // Non-blocking real-time sync with Supabase
      persistClinicOsPipeline(updated);
    }
  };

  const handleSavePatientPhone = async (newPhone: string) => {
    const cleanPhone = newPhone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length < 10) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Invalid Mobile Number',
          message: 'Please enter a valid 10-digit Indian mobile number.',
          type: 'error'
        }
      }));
      return;
    }
    if (extractedPatient) {
      const updated = { ...extractedPatient, phone: cleanPhone };
      setExtractedPatient(updated);
      api.setActivePatient(updated);
      setIsEditingPhone(false);
      window.dispatchEvent(new CustomEvent('mediflow-state-change'));
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Mobile Number Saved ✅',
          message: `Linked +91 ${cleanPhone} to ${updated.name}'s profile.`,
          type: 'success'
        }
      }));
      // Non-blocking real-time sync with Supabase
      persistClinicOsPipeline(updated);
    }
  };

  const handleToggleEditAll = async () => {
    if (isEditingAll) {
      setIsEditingAll(false);
      if (extractedPatient) {
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            title: 'Profile Updated ✅',
            message: 'All edits updated and syncing to database.',
            type: 'success'
          }
        }));
        persistClinicOsPipeline(extractedPatient, extractedMeds, extractedLabs, chronicBadges);
      }
    } else {
      setIsEditingAll(true);
    }
  };

  const processPrescriptionFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;

    // Phase 3: Canvas Pre-Flight Binarization (Cost-Neutral Contrast Enhancement)
    const applyCanvasBinarization = (file: File): Promise<File> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(file); // Fallback

          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          const threshold = 140; // Binarization threshold

          for (let i = 0; i < data.length; i += 4) {
            // Grayscale
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            // High contrast binarization
            const value = gray >= threshold ? 255 : 0;
            data[i] = value;
            data[i + 1] = value;
            data[i + 2] = value;
          }

          ctx.putImageData(imageData, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
            } else {
              resolve(file); // Fallback
            }
          }, 'image/jpeg', 0.85);
        };
        img.onerror = () => resolve(file);
        img.src = URL.createObjectURL(file);
      });
    };

    setCurrentStep('scanning');
    setTelemetryStep(1);
    setStatusText('Digitizing Prescription...');

    const processedFile = await applyCanvasBinarization(files[0]);
    const processedFiles = [processedFile];

    // Display first image in scanner HUD
    setUploadedFile(processedFiles[0]);
    const objectUrl = URL.createObjectURL(processedFiles[0]);
    setUploadedImageUrl(objectUrl);
    setErrorMessage(null);
    setExtractedPatient(null);
    setExtractedMeds([]);
    setChronicBadges([]);
    setExtractedLabs([]);
    setIsAssistedReview(false);

    try {
      const stepTimer1 = setTimeout(() => {
        setTelemetryStep(2);
        setStatusText('Building Patient Profile...');
      }, 1200);

      const stepTimer2 = setTimeout(() => {
        setTelemetryStep(3);
        setStatusText('Extracting Medicines & Dosages...');
      }, 2600);

      const result = await api.ocrScan(processedFiles);

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      setTelemetryStep(4);
      setCurrentStep('extracting');
      setStatusText('Calculating POS Billing...');
      await new Promise(r => setTimeout(r, 600));

      // Extract from digitizedPrescription, structured_data, or directly from result
      const resObj: any = result || {};
      let extractedData = resObj.digitizedPrescription || resObj.structured_data || resObj.data || resObj;
      
      // Fix: Handle cases where the LLM returns a stringified JSON instead of an object, often wrapped in markdown
      if (typeof extractedData === 'string') {
        try { 
          const cleanStr = extractedData.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
          extractedData = JSON.parse(cleanStr); 
        } catch (e) { console.warn('Failed to parse extractedData string', e); }
      }
      if (typeof resObj.structured_data === 'string') {
        try { 
          const cleanStr = resObj.structured_data.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
          resObj.structured_data = JSON.parse(cleanStr); 
          extractedData = resObj.structured_data;
        } catch (e) { console.warn('Failed to parse structured_data string', e); }
      }

      const rawExtractedPhone = extractedData?.patientPhone || extractedData?.phone || resObj.patientPhone || resObj.phone || '';
      const cleanPhone = String(rawExtractedPhone).replace(/\D/g, '').slice(-10);
      const extractedPatientName = extractedData?.patientName || resObj.patientName || extractedData?.name || resObj.name || 'Walk-in Patient';
      const isFallback = (extractedPatientName || '').includes('(Assisted Review)');
      setIsAssistedReview(isFallback);

      const mockId = crypto.randomUUID();
      const generatedToken = PatientService.generateNextTokenNumber();
      const extractedAddress = extractedData?.patientAddress || resObj?.patientAddress || extractedData?.address || resObj?.address || undefined;
      let normalizedGender: 'Male' | 'Female' | 'Other' = 'Male';
      const rawG = String(extractedData.patientGender || resObj.patientGender || '').trim().toLowerCase();
      if (rawG === 'female' || rawG === 'f') normalizedGender = 'Female';
      else if (rawG === 'other' || rawG === 'o') normalizedGender = 'Other';
      else normalizedGender = 'Male';

      const patientData: Patient = {
        id: mockId,
        name: extractedPatientName,
        phone: cleanPhone.length >= 10 ? cleanPhone : '',
        age: extractedData.patientAge ? Number(extractedData.patientAge) : (resObj.patientAge ? Number(resObj.patientAge) : 35),
        gender: normalizedGender,
        allergies: [],
        chronicConditions: extractedData.chronicConditions || resObj.chronicConditions || [],
        createdAt: new Date().toISOString(),
        queueStatus: 'pending_payment',
        abhaId: extractedData.abhaId || resObj.abhaId || null,
        tokenNumber: generatedToken,
        address: extractedAddress
      };

      if (cleanPhone.length >= 10) {
        setInputMobileNumber(cleanPhone);
        setIsEditingPhone(false);
      } else {
        setInputMobileNumber('');
        setIsEditingPhone(true);
      }

      setInputAddress(extractedAddress || '');
      setIsEditingAddress(!extractedAddress);

      const rawMeds = extractedData.medications || resObj.medications || extractedData.medicines || resObj.medicines || [];
      const meds = Array.isArray(rawMeds) ? rawMeds : [rawMeds].filter(Boolean);
      const rawLabs = extractedData.diagnosticTests || resObj.diagnosticTests || extractedData.labTests || resObj.labTests || [];
      const labs = Array.isArray(rawLabs) ? rawLabs : [rawLabs].filter(Boolean);
      
      const rawBadges = extractedData.chronicConditions || resObj.chronicConditions || [];
      const identifiedBadges: string[] = (Array.isArray(rawBadges) ? rawBadges : [rawBadges].filter(Boolean)).map(String);
      const rxText = JSON.stringify(meds).toLowerCase() + ' ' + (extractedData.diagnosis || resObj.diagnosis || '');

      if (!identifiedBadges.some(b => b.toLowerCase().includes('diabetes')) &&
          (rxText.includes('metformin') || rxText.includes('glimepiride') || rxText.includes('glycomet') || rxText.includes('sugar') || rxText.includes('diabetes'))) {
        identifiedBadges.push('Type-2 Diabetes');
      }
      if (!identifiedBadges.some(b => b.toLowerCase().includes('hypertension')) &&
          (rxText.includes('telmisartan') || rxText.includes('telma') || rxText.includes('amlodipine') || rxText.includes('bp') || rxText.includes('hypertension'))) {
        identifiedBadges.push('Hypertension');
      }
      if (!identifiedBadges.some(b => b.toLowerCase().includes('lipid') || b.toLowerCase().includes('cholesterol')) &&
          (rxText.includes('atorvastatin') || rxText.includes('atorva') || rxText.includes('rosuvastatin') || rxText.includes('cholesterol') || rxText.includes('lipid'))) {
        identifiedBadges.push('Dyslipidemia');
      }
      if (!identifiedBadges.some(b => b.toLowerCase().includes('thyroid')) &&
          (rxText.includes('thyroxine') || rxText.includes('thyronorm') || rxText.includes('tsh'))) {
        identifiedBadges.push('Hypothyroidism');
      }

      api.setActivePatient(patientData);
      setExtractedPatient({ ...patientData });

      // 🌟 GHOST PRESCRIPTION INJECTION
      // If OCR couldn't read meds, but patient has chronic badges, prefill their last known meds.
      let finalMeds = meds;
      if (finalMeds.length === 0 && identifiedBadges.length > 0) {
        try {
          const pastEncounters = EncounterService.getEncounters().filter(e => 
            e.patientId === patientData.id || 
            ((e as any).patient_id === patientData.id)
          );
          if (pastEncounters.length > 0) {
            pastEncounters.sort((a,b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
            const lastEncounter = pastEncounters[0];
            if (lastEncounter.medications && lastEncounter.medications.length > 0) {
              finalMeds = lastEncounter.medications;
              console.log('[OCR] Injected Ghost Prescriptions from past encounter');
              window.dispatchEvent(new CustomEvent('mediflow-toast', {
                detail: { title: 'Ghost Prescriptions Loaded', message: 'Pre-filled maintenance medications for chronic patient.', type: 'info' }
              }));
            }
          }
        } catch (_e) {}
      }

      setExtractedMeds(finalMeds);
      setChronicBadges(identifiedBadges);
      setExtractedLabs(labs);

      // 🌟 IMMEDIATE REAL-TIME SUPABASE PERSISTENCE GATE:
      // Pass freshly extracted objects directly in memory to bypass React 18 state closure delays
      hasAutoCommitted.current = true;
      persistClinicOsPipeline(patientData, finalMeds, labs, identifiedBadges);

      window.dispatchEvent(new CustomEvent('mediflow-state-change'));
      setCurrentStep('done');

    } catch (err: any) {
      console.warn('AI OCR Workflow gracefully handled:', err);
      // Under Rule Zero, never crash the UI; fallback to assisted review
      
      const mockId = crypto.randomUUID();
      const generatedToken = PatientService.generateNextTokenNumber();
      const fallbackPatient: Patient = {
        id: mockId,
        name: 'Walk-in Patient (Assisted Review)',
        phone: '',
        age: 35,
        gender: 'Male',
        allergies: [],
        chronicConditions: [],
        createdAt: new Date().toISOString(),
        queueStatus: 'pending_payment',
        abhaId: undefined,
        tokenNumber: generatedToken,
        address: ''
      };
      
      const fallbackMeds = [{ medicineName: 'Prescription Review Required', dosage: '1 Tab', frequency: '1-0-1', duration: '10 Days' }];
      api.setActivePatient(fallbackPatient);
      setExtractedPatient(fallbackPatient);
      setExtractedMeds(fallbackMeds);
      setChronicBadges([]);
      setExtractedLabs([]);
      
      setInputMobileNumber('');
      setIsEditingPhone(true);
      setInputAddress('');
      setIsEditingAddress(true);

      setIsAssistedReview(true);
      hasAutoCommitted.current = true;
      persistClinicOsPipeline(fallbackPatient, fallbackMeds, [], []);
      setCurrentStep('done');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const persistClinicOsPipeline = async (
    customPatient?: Patient,
    customMeds?: any[],
    customLabs?: any[],
    customBadges?: string[]
  ) => {
    const patientBase = customPatient || extractedPatient;
    if (!patientBase) return;

    if (isCommittingRef.current) {
      // Re-entrant queue: buffer newest patient/meds/labs so compounder edits are never dropped!
      pendingCommitRef.current = {
        patient: customPatient || extractedPatient || undefined,
        meds: customMeds || extractedMeds || undefined,
        labs: customLabs || extractedLabs || undefined,
        badges: customBadges || chronicBadges || undefined
      };
      return;
    }
    isCommittingRef.current = true;
    setIsCloudSyncing(true);

    // 5-second safe timeout wrapper to guarantee UI never hangs
    const withTimeout = <T,>(promise: Promise<T>, ms: number = 5000, fallback: T): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
      ]);
    };

    try {
      const activeMeds = customMeds || extractedMeds || [];
      const activeLabs = customLabs || extractedLabs || [];
      const activeBadges = customBadges || chronicBadges || [];

      // Auto-fallback for paper walk-in scans missing phone numbers
      let effectivePhone = (inputMobileNumber || patientBase.phone || '').replace(/\D/g, '').slice(-10);
      if (!effectivePhone || effectivePhone.length < 10) {
        effectivePhone = `9999${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;
      }

      const effectiveName = (patientBase.name || '').trim() || 'Walk-in Patient';
      const rawPhone = effectivePhone;
      const allSavedPats = PatientService.getPatients();
      const canonicalPat = allSavedPats.find(p => (rawPhone && (p.phone || '').replace(/\D/g, '').slice(-10) === rawPhone)) || ({} as any);

      const patientData: any = {
        ...canonicalPat,
        ...patientBase,
        id: savedPatientId || canonicalPat.id || patientBase.id,
        phone: (inputMobileNumber && inputMobileNumber.length >= 10) ? inputMobileNumber : (patientBase.phone || effectivePhone),
        address: inputAddress.trim() || patientBase.address || canonicalPat.address || undefined,
        podId: canonicalPat.podId || getPodContext().podId || (patientBase as any).podId,
      };
      // 🌟 CLINIC OS INVARIANT: Walk-in / OCR scanned patients enter active queue awaiting consultation
      patientData.queueStatus = 'awaiting_consultation';
      
      // Strict Token Sequencing: Only reuse token if patient already booked for TODAY
      const todayIst = getIstDateString();
      const existingTodayAppt = allSavedPats.length > 0 ? BillingService.getAppointments().find(a => 
        (a.patientId === canonicalPat.id || (a as any).patient_id === canonicalPat.id) &&
        (getEffectiveAppointmentDate(a) === todayIst || (a.createdAt || (a as any).created_at || '').slice(0, 10) === todayIst) &&
        a.status !== 'cancelled'
      ) : null;
      patientData.tokenNumber = existingTodayAppt?.tokenNumber || (existingTodayAppt as any)?.token_number || patientData.tokenNumber || PatientService.generateNextTokenNumber();
      patientData.token_number = patientData.tokenNumber;
      patientData.abhaId = canonicalPat.abhaId || patientBase.abhaId || null;
      patientData.source = 'paper_scan';

      // Ensure chronic flags are set before dual-write to avoid race condition overriding to false
      const mergedBadges = Array.from(new Set([
        ...(canonicalPat.chronicConditions || []), 
        ...(canonicalPat.chronic_conditions || []), 
        ...(activeBadges || [])
      ]));
      if (mergedBadges.length > 0) {
        patientData.isChronic = true;
        patientData.chronicConditions = mergedBadges;
        patientData.chronic_conditions = mergedBadges;
      }

      // 1. 🌟 ATOMIC SYNCHRONOUS PERSISTENCE: Strict await with timeout on Supabase DB write
      let realPatientId = patientData.id || crypto.randomUUID();
      try {
        if (!navigator.onLine) throw new Error('Offline Mode');
        realPatientId = await withTimeout(
          PatientService.savePatientAsync(patientData),
          5000,
          realPatientId
        );
      } catch (err: any) {
        console.warn('[OCR] DB Write failed, dropping to WAL Outbox:', err);
        PatientService.savePatient(patientData); // Local synchronous fallback
        // Explicit WAL Fallback
        import('../../../services/api').then(m => {
          if (m.walDB) m.walDB.addEntry('upsert_patient', patientData);
        }).catch(() => {});
      }

      patientData.id = realPatientId;
      setSavedPatientId(realPatientId);
      setExtractedPatient({ ...patientData });
      api.setActivePatient(patientData);

      const calculateQuantity = (freq: string, dur: string): number | undefined => {
        if (!freq || !dur) return undefined;
        let perDay = 0;
        const fStr = freq.toLowerCase();
        if (fStr.includes('1-0-1') || fStr.includes('bd')) perDay = 2;
        else if (fStr.includes('1-1-1') || fStr.includes('tds')) perDay = 3;
        else if (fStr.includes('1-0-0') || fStr.includes('0-1-0') || fStr.includes('0-0-1') || fStr.includes('od') || fStr.includes('hs') || fStr.includes('sos')) perDay = 1;
        else if (fStr.includes('1-1-1-1') || fStr.includes('qid')) perDay = 4;
        
        let days = 0;
        const dStr = dur.toLowerCase();
        const numMatch = dStr.match(/\d+/);
        if (numMatch) {
          const val = parseInt(numMatch[0]);
          if (dStr.includes('week') || dStr.includes('wk')) days = val * 7;
          else if (dStr.includes('month') || dStr.includes('mo')) days = val * 30;
          else days = val; 
        }
        
        if (perDay > 0 && days > 0) return perDay * days;
        return undefined;
      };

      const encounterMeds: MedicationRequest[] = activeMeds.map((m: any, idx: number) => ({
        id: `med-${idx}`,
        medicineName: m.medicineName || m.name || 'Prescribed Medicine',
        dosage: m.dosage || '',
        frequency: m.frequency || '',
        duration: m.duration || '',
        quantity: m.quantity || calculateQuantity(m.frequency || '', m.duration || '') || undefined
      }));

      // Cache active OCR bundle for instant POS checkout
      const activeRxBundle = {
        patientId: realPatientId,
        patientName: patientData.name,
        patientPhone: patientData.phone,
        patientAddress: patientData.address,
        patientCode: patientData.patientCode || (patientData as any).patient_code,
        tokenNumber: patientData.tokenNumber,
        medications: encounterMeds,
        extractedMedicines: encounterMeds,
        diagnosticTests: activeLabs,
        extractedTests: activeLabs,
        prescriptionImageUrl: uploadedImageUrl,
        timestamp: Date.now()
      };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('vitalsync_active_ocr_rx', JSON.stringify(activeRxBundle));
        } catch (_e) { /* ignore */ }
      }

      // 2. 🌟 PERSIST DIGITIZED PRESCRIPTION & SCAN TO SUPABASE
      let uploadedPublicUrl = uploadedImageUrl;
      const rxTemplate = api.getPrescriptionTemplate();
      const currentDocName = rxTemplate.doctorName || 'Doctor';
      const currentClinicTitle = rxTemplate.clinicName || 'Clinic';

      try {
        const persistRes = await withTimeout(
          PaperModeService.persistPrescriptionToSupabase({
            patientId: realPatientId,
            patientName: patientData.name,
            patientPhone: patientData.phone,
            patientAddress: patientData.address,
            doctorName: currentDocName,
            clinicName: currentClinicTitle,
            medications: encounterMeds,
            diagnosticTests: activeLabs,
            isChronic: patientData.isChronic,
            chronicConditions: patientData.chronicConditions,
            prescriptionImageFile: uploadedFile
          }),
          4000,
          null
        );
        if (persistRes?.prescriptionImageUrl) {
          uploadedPublicUrl = persistRes.prescriptionImageUrl;
        }
      } catch (paperErr) {
        console.warn('[OCR] PaperModeService.persistPrescriptionToSupabase notice:', paperErr);
      }

      // 3. 🌟 AUTONOMOUS OPD APPOINTMENT BOOKING for Walk-ins using canonical realPatientId
      const allAppts = BillingService.getAppointments();
      const todayISO = getIstDateString();
      const existingAppt = allAppts.find(a => 
        (a.patientId === realPatientId || (a as any).patient_id === realPatientId) && 
        (a.status !== 'cancelled') &&
        // FIX 2a: coalesce camelCase + snake_case — CDC-synced rows store created_at not createdAt
        ((a.createdAt || (a as any).created_at || '')).slice(0, 10) === todayISO
      );
      
      const resolvedDoctorId = getPodContext().doctorId || FALLBACK_DOCTOR_ID;
      const apptPayload = existingAppt ? {
        ...existingAppt,
        status: 'ready_for_consult',
        paymentStatus: 'cleared',
        payment_status: 'cleared',
        fee_status: 'cleared',
        source: 'paper_scan' as any,
        tokenNumber: patientData.tokenNumber,
        token_number: patientData.tokenNumber,
        podId: (existingAppt as any).podId || (existingAppt as any).pod_id || getPodContext().podId || null,
        pod_id: (existingAppt as any).pod_id || (existingAppt as any).podId || getPodContext().podId || null
      } : {
        id: crypto.randomUUID(),
        patientId: realPatientId,
        patient_id: realPatientId,
        patientName: patientData.name,
        patientPhone: patientData.phone,
        doctorId: resolvedDoctorId,
        date: todayISO,
        appointmentDate: todayISO,
        appointment_date: todayISO,
        virtual_date: todayISO,
        time: 'Walk-in',
        status: 'ready_for_consult',
        paymentStatus: 'cleared',
        payment_status: 'cleared',
        fee_status: 'cleared',
        tokenNumber: patientData.tokenNumber,
        token_number: patientData.tokenNumber,
        createdAt: new Date().toISOString(),
        created_at: new Date().toISOString(),
        source: 'paper_scan' as any,
        // FIX 2b: Always inject pod_id so Supabase NOT NULL constraint is satisfied
        podId: getPodContext().podId || null,
        pod_id: getPodContext().podId || null
      };

      try {
        await withTimeout(BillingService.saveAppointmentAsync(apptPayload as any), 3500, apptPayload as any);
      } catch (apptErr) {
        console.warn('[OCR] Appointment booking notice:', apptErr);
      }

      // 4. Create Encounter using canonical realPatientId
      try {
        EncounterService.createEncounter({
          patientId: realPatientId,
          patientName: patientData.name,
          patientPhone: patientData.phone,
          doctorId: resolvedDoctorId,
          clinicalNotes: 'Extracted via AI Scanner.',
          medications: encounterMeds,
          diagnosticTests: activeLabs
        });
      } catch (encErr) {
        console.warn('[OCR] Encounter creation notice:', encErr);
      }

      api.setActivePatient(patientData);

      // 5. 🌟 ZERO-DATA-ENTRY DOCTRINE: Auto-ingest chronic patient into Care Club
      // Fire-and-forget background sync to prevent Vite dev server dynamic import deadlock
      if (activeBadges.length > 0) {
        import('../../../services/chronicCareService')
          .then(({ ChronicCareService }) => {
            for (const badge of activeBadges) {
              ChronicCareService.autoIngestFromEncounter({
                patientId: realPatientId,
                patientName: patientData.name,
                patientPhone: patientData.phone || '',
                doctorId: resolvedDoctorId,
                clinicalNotes: 'Extracted via AI Scanner.',
                chronicConditions: [badge],
                medications: encounterMeds.map((m: any) => ({
                  medicineName: m.medicineName,
                  dosage: m.dosage,
                  frequency: m.frequency
                })),
                isChronic: true
              }).catch((e: any) => console.warn('[OCR] Chronic auto-ingest error:', e));
            }
          })
          .catch((err: any) => {
            console.warn('[OCR] Failed to load ChronicCareService dynamically:', err);
          });
      }

      // 6. Autonomous WhatsApp Digital Dispatch (Non-blocking)
      if (patientData.phone && patientData.phone.length >= 10 && !patientData.phone.startsWith('99999')) {
        try {
          PaperModeService.dispatchWelcomeWhatsApp({
            patientPhone: patientData.phone,
            patientName: patientData.name,
            patientId: realPatientId,
            doctorName: currentDocName || 'Doctor',
            clinicName: currentClinicTitle || 'Clinic'
          });
        } catch (e) {
          console.warn('[OCR] Welcome WhatsApp dispatch error:', e);
        }

        try {
          PaperModeService.dispatchPrescriptionWhatsApp({
            patientPhone: patientData.phone,
            patientName: patientData.name,
            doctorName: currentDocName || 'Doctor',
            clinicName: currentClinicTitle || 'Clinic',
            medications: encounterMeds,
            diagnosticTests: activeLabs,
            prescriptionImageUrl: uploadedPublicUrl
          });
        } catch (e) {
          console.warn('[OCR] Prescription WhatsApp dispatch error:', e);
        }
      }

      // Broadcast events
      window.dispatchEvent(new CustomEvent('mediflow-state-change'));
      setCloudSyncSuccess(true);
      setCurrentStep('completed');

    } catch (err: any) {
      console.warn('[OCR] Background persistence notice:', err);
    } finally {
      setIsCloudSyncing(false);
      isCommittingRef.current = false;
      // If user typed phone/address while this commit was running, fire the pending commit!
      if (pendingCommitRef.current) {
        const next = pendingCommitRef.current;
        pendingCommitRef.current = null;
        setTimeout(() => {
          persistClinicOsPipeline(next.patient, next.meds, next.labs, next.badges);
        }, 50);
      }
    }
  };

  const handleProceedToBilling = async () => {
    const targetId = savedPatientId || extractedPatient?.id;
    if (!targetId) return;

    if (isCommittingRef.current) {
      let waited = 0;
      while (isCommittingRef.current && waited < 1500) {
        await new Promise(r => setTimeout(r, 100));
        waited += 100;
      }
    }

    // FIX 1: Read the live active patient ID synchronously from api cache.
    // React state closures (savedPatientId / extractedPatient?.id) may lag by 1-2
    // render cycles after the async persistClinicOsPipeline() resolves.
    // api.setActivePatient() is called synchronously inside the pipeline with the
    // real Supabase UUID, so this is always the canonical source of truth.
    const liveActiveId = api.getActivePatient()?.id;
    const finalId = savedPatientId || liveActiveId || extractedPatient?.id || targetId;

    // Re-read current meds/labs from latest extracted state for accurate OCR bundle
    const currentMeds = extractedMeds;
    const currentLabs = extractedLabs;
    const currentPatient = extractedPatient;

    // Cache active OCR bundle for instant POS checkout in BillHubTab
    const activeRxBundle = {
      patientId: finalId,
      patientName: currentPatient?.name || 'Walk-in Patient',
      patientPhone: currentPatient?.phone || inputMobileNumber,
      patientAddress: currentPatient?.address || inputAddress,
      patientCode: currentPatient?.patientCode || (currentPatient as any)?.patient_code,
      tokenNumber: currentPatient?.tokenNumber,
      medications: currentMeds,
      extractedMedicines: currentMeds,
      diagnosticTests: currentLabs,
      extractedTests: currentLabs,
      prescriptionImageUrl: uploadedImageUrl,
      timestamp: Date.now()
    };
    try {
      localStorage.setItem('vitalsync_active_ocr_rx', JSON.stringify(activeRxBundle));
    } catch (_e) { /* ignore */ }

    if (onSuccess && finalId) {
      onSuccess(finalId);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) processPrescriptionFiles(Array.from(files));
  };



  const resetScanner = () => {
    setCurrentStep('idle');
    setUploadedImageUrl(null);
    setErrorMessage(null);
    setExtractedPatient(null);
    setExtractedMeds([]);
    setChronicBadges([]);
    setExtractedLabs([]);
    setIsAssistedReview(false);
  };

  return (
    <div className="flex flex-col lg:h-full lg:min-h-0 bg-slate-50/50 dark:bg-[#070b16] p-3 sm:p-5 lg:p-6 pb-28 lg:pb-6 lg:overflow-y-auto w-full font-sans touch-pan-y">

      {/* ── CLEAN CLINICAL WORKSTATION HEADER ───────────────────────────────── */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/70 dark:border-slate-800/80">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Prescription Scanner Station</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Prescription Vision Scanner
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Scan paper slips for instant digital prescription, billing, and OPD token.
          </p>
        </div>

        {(currentStep === 'done' || currentStep === 'completed') && (
          <button
            onClick={resetScanner}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm self-start cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Scan Another Slip
          </button>
        )}
      </div>

      {/* ── MAIN WORKSPACE GRID ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* ── LEFT: SCANNER HUD & COCKPIT (7 COLS) ───────────────────────── */}
        <div className="lg:col-span-7 flex flex-col">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const files = e.dataTransfer.files;
              if (files && files.length > 0) processPrescriptionFiles(Array.from(files));
            }}
            className={`rounded-3xl border transition-all duration-300 overflow-hidden flex flex-col ${(currentStep === 'done' || currentStep === 'completed') ? 'h-auto lg:min-h-[460px]' : 'min-h-[380px] lg:min-h-[460px]'} relative ${
              isDragOver
                ? 'border-cyan-400 bg-cyan-950/20 shadow-[0_0_40px_rgba(6,182,212,0.25)]'
                : 'bg-white dark:bg-[#0b1120] border-slate-200 dark:border-cyan-500/20 shadow-xl dark:shadow-[0_0_50px_rgba(6,182,212,0.06)]'
            }`}
          >

            {/* ASSISTED REVIEW BANNER (Rule Zero self-healing notice) */}
            {isAssistedReview && (currentStep === 'done' || currentStep === 'completed') && (
              <div className="m-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-amber-600 dark:text-amber-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold">Prescription Image Preserved & Archived</p>
                  <p className="mt-0.5 opacity-90">
                    Image attached to patient record. Verification queued for Compounder one-tap confirmation.
                  </p>
                </div>
              </div>
            )}

            {/* IDLE OR ERROR STATE: Sleek Clinical Viewfinder */}
            {(currentStep === 'idle' || currentStep === 'error') && (
              <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 text-center relative z-10">

                {/* Reticle Camera HUD */}
                <div className="relative w-28 h-28 mb-5 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border border-indigo-500/20 animate-ping" style={{ animationDuration: '3s' }} />
                  <div className="absolute inset-2 rounded-full border border-indigo-500/30 animate-pulse" />
                  
                  {/* Corner reticle brackets */}
                  <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-indigo-500" />
                  <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-indigo-500" />
                  <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-indigo-500" />
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-indigo-500" />

                  {/* Center icon */}
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-500 p-[2px] shadow-lg shadow-indigo-500/25">
                    <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
                      <Camera className="w-7 h-7 text-cyan-400" />
                    </div>
                  </div>
                </div>

                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight mb-1.5">
                  Clinic OS Auto-Flow
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6 leading-relaxed">
                  Position doctor prescription slip under camera or upload a clear photo / PDF.
                </p>

                {/* 2-ACTION BUTTON ARRAY */}
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm px-2">
                  {/* Action 1: Live Mobile Camera (High-contrast solid gradient) */}
                  <label className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black text-xs shadow-md hover:-translate-y-0.5 transition-all cursor-pointer active:scale-95">
                    <Camera className="w-4 h-4 text-white" />
                    <span>Open Camera</span>
                    <input
                      ref={cameraInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      capture="environment"
                      onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
                      onChange={handleFileUpload}
                      className="hidden"
                      style={{ display: 'none' }}
                    />
                  </label>

                  {/* Action 2: File / PDF Picker */}
                  <label className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs hover:border-slate-400 dark:hover:border-slate-600 hover:-translate-y-0.5 transition-all cursor-pointer active:scale-95 shadow-sm">
                    <Upload className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                    <span>Select Slip / PDF</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
                      onChange={handleFileUpload}
                      className="hidden"
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>

              </div>
            )}

            {/* SCANNING / EXTRACTING STATE: Holographic Laser Viewport & Telemetry HUD */}
            {(currentStep === 'scanning' || currentStep === 'extracting') && (
              <div className="flex-1 relative bg-[#060a14] flex flex-col items-center justify-center min-h-[460px] overflow-hidden p-4">

                {/* Uploaded image underlay */}
                {uploadedImageUrl && (
                  <img
                    src={uploadedImageUrl}
                    alt="Prescription preview"
                    className="absolute inset-0 w-full h-full object-contain opacity-30 filter contrast-125 saturate-50"
                  />
                )}

                {/* High-tech Matrix Grid */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.05)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

                {/* Laser Scanning Beam */}
                <div className="absolute left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_24px_#22d3ee,0_0_48px_#22d3ee] z-20 animate-[rxScan_2.4s_ease-in-out_infinite]" />

                {/* Corner HUD Brackets */}
                <div className="absolute inset-6 border border-cyan-500/10 pointer-events-none">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-400" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-400" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-400" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-400" />
                </div>

                {/* Premium Progressive Checklist Capsule */}
                <div className="relative z-30 px-6 py-6 rounded-3xl bg-slate-900/90 backdrop-blur-2xl border border-cyan-500/30 shadow-[0_0_40px_rgba(34,211,238,0.15)] flex flex-col max-w-md w-full mx-4 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-700/50 pb-3 mb-4">
                    <h3 className="text-white font-black text-lg">Processing Prescription</h3>
                    <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    {/* Step 1 */}
                    <div className={`flex items-center gap-3 transition-all duration-500 ${telemetryStep >= 1 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
                      <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center bg-[#060a14] border border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
                        {telemetryStep > 1 ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />}
                      </div>
                      <span className={`text-sm font-bold ${telemetryStep > 1 ? 'text-slate-400' : 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]'}`}>Digitizing Prescription...</span>
                    </div>
                    {/* Step 2 */}
                    <div className={`flex items-center gap-3 transition-all duration-500 ${telemetryStep >= 2 ? 'opacity-100 translate-x-0' : 'opacity-30 -translate-x-4'}`}>
                      <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center bg-[#060a14] border border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
                        {telemetryStep > 2 ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : (telemetryStep === 2 ? <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" /> : <div className="w-2 h-2 rounded-full bg-slate-700" />)}
                      </div>
                      <span className={`text-sm font-bold ${telemetryStep > 2 ? 'text-slate-400' : (telemetryStep === 2 ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'text-slate-600')}`}>Building Patient Profile...</span>
                    </div>
                    {/* Step 3 */}
                    <div className={`flex items-center gap-3 transition-all duration-500 ${telemetryStep >= 3 ? 'opacity-100 translate-x-0' : 'opacity-30 -translate-x-4'}`}>
                      <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center bg-[#060a14] border border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
                        {telemetryStep > 3 ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : (telemetryStep === 3 ? <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" /> : <div className="w-2 h-2 rounded-full bg-slate-700" />)}
                      </div>
                      <span className={`text-sm font-bold ${telemetryStep > 3 ? 'text-slate-400' : (telemetryStep === 3 ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'text-slate-600')}`}>Extracting Medicines & Dosages...</span>
                    </div>
                    {/* Step 4 */}
                    <div className={`flex items-center gap-3 transition-all duration-500 ${telemetryStep >= 4 ? 'opacity-100 translate-x-0' : 'opacity-30 -translate-x-4'}`}>
                      <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center bg-[#060a14] border border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
                        {telemetryStep > 4 ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : (telemetryStep === 4 ? <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" /> : <div className="w-2 h-2 rounded-full bg-slate-700" />)}
                      </div>
                      <span className={`text-sm font-bold ${telemetryStep > 4 ? 'text-slate-400' : (telemetryStep === 4 ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'text-slate-600')}`}>Calculating POS Billing...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DONE STATE: Prescription Visualizer */}
            {(currentStep === 'done' || currentStep === 'committing' || currentStep === 'completed') && (
              <div className="flex-1 flex flex-col p-3 sm:p-6 items-center justify-center text-center relative bg-[#060a14] rounded-3xl overflow-hidden border border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.05)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent opacity-50" />
                
                <div className="flex sm:flex-col items-center gap-2 sm:gap-0 mb-1.5 sm:mb-4 relative z-10">
                  <div className="w-9 h-9 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-[1px] shadow-[0_0_30px_rgba(16,185,129,0.3)] animate-[pulse_3s_ease-in-out_infinite]">
                    <div className="w-full h-full bg-[#060a14] rounded-[15px] flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 sm:w-8 sm:h-8 text-emerald-400" />
                    </div>
                  </div>
                  <div className="text-left sm:text-center ml-1 sm:ml-0 mt-0 sm:mt-2">
                    <h3 className="text-sm sm:text-xl font-black text-white">
                      Digital Profile Created
                    </h3>
                    <p className="text-[11px] sm:text-sm text-slate-400">
                      Prescription digitized & synchronized to cloud.
                    </p>
                  </div>
                </div>

                {uploadedImageUrl && (
                  <div className="w-full max-w-sm rounded-2xl overflow-hidden border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)] relative group z-10 mb-2">
                    <img src={uploadedImageUrl} alt="Prescription" className="w-full h-20 sm:h-48 object-cover filter brightness-75 contrast-125" />
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-[#060a14] via-transparent to-transparent opacity-80" />
                    
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-2 sm:gap-3">
                      <a
                        href={uploadedImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-white/10 backdrop-blur-md text-white text-xs font-bold hover:bg-white/20 border border-white/20 transition-all hover:scale-105"
                      >
                        <Eye className="w-4 h-4" />
                        Inspect Original Scan
                      </a>
                      {currentStep === 'completed' ? (
                        <a
                          href={uploadedImageUrl || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 backdrop-blur-md text-cyan-300 text-xs font-bold hover:bg-cyan-500/30 border border-cyan-500/30 transition-all hover:scale-105"
                        >
                          <FileText className="w-4 h-4" />
                          Open Digital PDF
                        </a>
                      ) : (
                        <button
                          onClick={() => alert('Digital PDF will be generated upon commitment.')}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 backdrop-blur-md text-cyan-300 text-xs font-bold hover:bg-cyan-500/30 border border-cyan-500/30 transition-all hover:scale-105"
                        >
                          <FileText className="w-4 h-4" />
                          Generate Digital PDF
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* ── RIGHT: EXTRACTED CLINICAL PROFILE & DISPENSING QUEUE (5 COLS) ─ */}
        <div ref={profileSectionRef} className="lg:col-span-5 flex flex-col lg:h-full lg:min-h-[460px] scroll-mt-6">
          <div className="bg-white dark:bg-[#0b1120] rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xl p-4 sm:p-6 flex flex-col flex-1 lg:h-full lg:max-h-full">

            {/* Panel Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                <User className="w-4 h-4 text-cyan-500" />
                <span>Extracted Patient & Medications</span>
              </div>
              {(currentStep === 'done' || currentStep === 'completed') && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleToggleEditAll}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${isEditingAll ? 'bg-cyan-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                  >
                    {isEditingAll ? 'Done Editing' : 'Edit All'}
                  </button>
                  {isCloudSyncing ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[11px] font-bold border border-cyan-500/20">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Syncing
                    </span>
                  ) : cloudSyncSuccess ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold border border-emerald-500/20">
                      <Check className="w-3 h-3" />
                      Cloud Synced
                    </span>
                  ) : null}
                </div>
              )}
            </div>

            {/* Empty State */}
            {(currentStep === 'idle' || currentStep === 'scanning' || currentStep === 'extracting' || currentStep === 'error') && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-500">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="font-bold text-xs text-slate-700 dark:text-slate-300">
                  Awaiting Prescription Scan
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 max-w-[220px]">
                  Extracted patient profile, chronic disease tags, and prescribed medicines will appear here.
                </p>
              </div>
            )}

            {/* Extracted Profile Content */}
            {(currentStep === 'done' || currentStep === 'committing' || currentStep === 'completed') && extractedPatient && (
              <div className="flex-1 flex flex-col min-h-0">

                {/* Patient Demographic Card (Premium Single-Row) */}
                <div 
                  onClick={() => {
                    if (!isEditingAll) {
                      window.dispatchEvent(new CustomEvent('mediflow-open-patient-profile', {
                        detail: extractedPatient
                      }));
                    }
                  }}
                  className={`shrink-0 flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800 ${!isEditingAll ? 'hover:border-cyan-500/50 hover:bg-cyan-50/30 dark:hover:bg-cyan-950/20 cursor-pointer group' : ''} transition-all`}
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-md group-hover:scale-105 transition-transform shrink-0">
                    {extractedPatient.name?.charAt(0) || 'P'}
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-2">
                    {/* Name */}
                    {isEditingAll ? (
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          value={extractedPatient.name || ''}
                          onChange={(e) => setExtractedPatient({ ...extractedPatient, name: e.target.value })}
                          className="text-sm font-black text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-2 pr-7 py-1 w-36 sm:w-48 outline-none focus:border-cyan-500"
                          placeholder="Name"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button onClick={(e) => { e.stopPropagation(); handleVoiceCorrect('name'); }} title="Voice Correct" className={`absolute right-1.5 cursor-pointer text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500 transition-transform ${activeVoiceField === 'name' ? 'animate-ping scale-125' : 'hover:scale-110'}`}>
                          <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                        </button>
                      </div>
                    ) : (
                      <h4 className="text-sm font-black text-slate-900 dark:text-white truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                        {extractedPatient.name || 'Unknown Patient'}
                      </h4>
                    )}

                    {/* Age & Gender */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                      {isEditingAll ? (
                        <>
                          <input
                            type="number"
                            value={extractedPatient.age || ''}
                            onChange={(e) => setExtractedPatient({ ...extractedPatient, age: parseInt(e.target.value) || 0 })}
                            className="w-12 px-1 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold outline-none focus:border-cyan-500"
                            placeholder="Age"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <select
                            value={extractedPatient.gender || 'Male'}
                            onChange={(e) => setExtractedPatient({ ...extractedPatient, gender: e.target.value as any })}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-1 py-1 font-bold outline-none focus:border-cyan-500"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="Male">M</option>
                            <option value="Female">F</option>
                            <option value="Other">O</option>
                          </select>
                        </>
                      ) : (
                        <span className="font-semibold bg-slate-200/50 dark:bg-slate-800 px-2 py-0.5 rounded-full">{extractedPatient.age}Y • {extractedPatient.gender?.charAt(0)}</span>
                      )}
                    </div>

                    {/* Phone */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(isEditingPhone || isEditingAll) ? (
                        <div className="relative">
                          <input
                            type="tel"
                            maxLength={10}
                            placeholder="Mobile"
                            value={inputMobileNumber}
                            onChange={(e) => {
                              setInputMobileNumber(e.target.value.replace(/\D/g, ''));
                              if (isEditingAll) setExtractedPatient({ ...extractedPatient, phone: e.target.value.replace(/\D/g, '') });
                            }}
                            className="w-28 pl-7 pr-2 py-1 rounded-lg border border-amber-300 dark:border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Phone className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-500" />
                        </div>
                      ) : (
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 text-xs">
                          <Phone className="w-3 h-3 text-emerald-500" /> +91 {extractedPatient.phone || '—'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Scrollable middle section: contact, tags, meds, labs */}
                <div className="flex-1 lg:min-h-0 lg:overflow-y-auto pr-0.5 space-y-3 mt-3">

                {/* Contact & Chronic Tags */}
                <div className="space-y-2 text-xs">
                  {/* WhatsApp / Mobile Number Input & Display */}
                  <div className="py-2 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-500 font-medium">WhatsApp / Mobile</span>
                      {extractedPatient.phone && !isEditingPhone && !isEditingAll && (
                        <button
                          type="button"
                          onClick={() => {
                            setInputMobileNumber(extractedPatient.phone || '');
                            setIsEditingPhone(true);
                          }}
                          className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold hover:underline cursor-pointer"
                        >
                          Change
                        </button>
                      )}
                    </div>
                    {(!extractedPatient.phone || isEditingPhone || isEditingAll) ? (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">+91</span>
                          <input
                            type="tel"
                            maxLength={10}
                            placeholder="Enter 10-digit mobile"
                            value={inputMobileNumber}
                            onChange={(e) => {
                              setInputMobileNumber(e.target.value.replace(/\D/g, ''));
                              if (isEditingAll) {
                                setExtractedPatient({ ...extractedPatient, phone: e.target.value.replace(/\D/g, '') });
                              }
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSavePatientPhone(inputMobileNumber); }}
                            className="w-full pl-9 pr-2 py-1.5 rounded-xl border border-amber-300 dark:border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                            autoFocus={isEditingPhone && !isEditingAll}
                          />
                        </div>
                        {!isEditingAll && (
                          <button
                            type="button"
                            onClick={() => handleSavePatientPhone(inputMobileNumber)}
                            disabled={inputMobileNumber.length < 10}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                          >
                            Save
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                          <Phone className="w-3.5 h-3.5 text-emerald-500" />
                          +91 {extractedPatient.phone}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                          Active WhatsApp
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Residential Address Input & Display */}
                  <div className="py-2 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-500 font-medium">Residential Address</span>
                    </div>
                    {(!extractedPatient.address || isEditingAddress || isEditingAll) ? (
                      <div className="relative flex items-center w-full mt-1">
                        <input
                          type="text"
                          placeholder="Locality / address (e.g. Line Bazar, Purnea)"
                          value={inputAddress}
                          onChange={(e) => {
                            setInputAddress(e.target.value);
                            if (isEditingAll) setExtractedPatient({ ...extractedPatient, address: e.target.value });
                          }}
                          className="w-full px-2.5 pr-8 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                        <button onClick={(e) => { e.stopPropagation(); handleVoiceCorrect('address'); }} title="Voice Correct" className={`absolute right-2 cursor-pointer text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500 transition-transform ${activeVoiceField === 'address' ? 'animate-ping scale-125' : 'hover:scale-110'}`}>
                          <Sparkles className="w-4 h-4 text-cyan-500" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs truncate max-w-[220px]">
                          <MapPin className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                          {extractedPatient.address}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Detected Chronic Cohorts */}
                  <div className="py-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Detected Chronic Cohorts
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {chronicBadges.length > 0 ? (
                        chronicBadges.map((badge) => (
                          <span
                            key={badge}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[11px] font-bold"
                          >
                            <Activity className="w-3 h-3" />
                            {badge}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">General OPD (Non-chronic)</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Prescribed Medications List */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Prescribed Medications ({extractedMeds.length})
                    </span>
                    <span className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400">
                      Auto-Matched
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {isEditingAll && (
                      <button 
                        type="button" 
                        onClick={() => setExtractedMeds([...extractedMeds, { medicineName: '', dosage: '1 Tab', frequency: '1-0-1', duration: '15 Days' }])}
                        className="w-full text-center py-1.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:bg-slate-200 mb-2"
                      >
                        + Add Medicine
                      </button>
                    )}
                    {extractedMeds.length > 0 ? (
                      extractedMeds.map((m: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-col gap-2 text-xs"
                        >
                          {isEditingAll ? (
                            <div className="flex flex-col gap-1 w-full">
                              <div className="relative flex items-center w-full">
                                <input type="text" value={m.medicineName || m.name || ''} onChange={(e) => { const nm = [...extractedMeds]; nm[idx].medicineName = e.target.value; nm[idx].name = e.target.value; setExtractedMeds(nm); }} className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded px-1.5 py-1 pr-6" placeholder="Medicine Name" />
                                <button onClick={(e) => { e.stopPropagation(); handleVoiceCorrect(`medicine_${idx}`, idx); }} title="Voice Correct" className={`absolute right-1.5 cursor-pointer text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500 transition-transform ${activeVoiceField === `medicine_${idx}` ? 'animate-ping scale-125' : 'hover:scale-110'}`}>
                                  <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                                </button>
                              </div>
                              <div className="flex items-center gap-1">
                                <input type="text" value={m.dosage || ''} onChange={(e) => { const nm = [...extractedMeds]; nm[idx].dosage = e.target.value; setExtractedMeds(nm); }} className="w-16 text-[11px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded px-1 py-0.5" placeholder="Dosage" />
                                <span className="text-slate-400">•</span>
                                <input type="text" value={m.frequency || ''} onChange={(e) => { const nm = [...extractedMeds]; nm[idx].frequency = e.target.value; setExtractedMeds(nm); }} className="w-16 text-[11px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded px-1 py-0.5" placeholder="Freq" />
                                <input type="text" value={m.duration || ''} onChange={(e) => { const nm = [...extractedMeds]; nm[idx].duration = e.target.value; setExtractedMeds(nm); }} className="w-16 text-[11px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded px-1 py-0.5" placeholder="Duration" />
                                <button type="button" onClick={() => { const nm = [...extractedMeds]; nm.splice(idx, 1); setExtractedMeds(nm); }} className="ml-auto text-rose-500 hover:text-rose-600 font-bold text-xs p-1">X</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between w-full">
                              <div className="min-w-0 pr-2">
                                <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                  {m.medicineName || m.name || 'Prescription Medicine'}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  {m.dosage || '1 Tab'} • {m.frequency || '1-0-1'}
                                </p>
                              </div>
                              <span className="shrink-0 font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md text-[11px]">
                                {m.duration || '15 Days'}
                              </span>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500 text-center italic">
                        Prescription photo archived to patient profile
                      </div>
                    )}
                  </div>
                </div>

                {/* Prescribed Lab Tests */}
                {(extractedLabs.length > 0 || isEditingAll) && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Requested Diagnostics ({extractedLabs.length})
                    </span>
                    {isEditingAll && (
                      <button 
                        type="button" 
                        onClick={() => setExtractedLabs([...extractedLabs, { name: '' }])}
                        className="w-full text-center py-1.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-slate-200 mb-2"
                      >
                        + Add Lab Test
                      </button>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {extractedLabs.map((lab: any, lIdx: number) => (
                        <span
                          key={lIdx}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[11px] font-semibold"
                        >
                          <Stethoscope className="w-3 h-3" />
                          {isEditingAll ? (
                            <div className="relative flex items-center">
                              <input 
                                type="text" 
                                value={lab.name || ''} 
                                onChange={(e) => { const nl = [...extractedLabs]; nl[lIdx].name = e.target.value; setExtractedLabs(nl); }} 
                                className="bg-transparent border-b border-indigo-300 dark:border-indigo-700 outline-none w-32 pr-6" 
                                placeholder="Test Name" 
                              />
                              <button onClick={(e) => { e.stopPropagation(); handleVoiceCorrect(`lab_${lIdx}`, lIdx); }} title="Voice Correct" className={`absolute right-1 cursor-pointer text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500 transition-transform ${activeVoiceField === `lab_${lIdx}` ? 'animate-ping scale-125' : 'hover:scale-110'}`}>
                                <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                              </button>
                              <button type="button" onClick={() => { const nl = [...extractedLabs]; nl.splice(lIdx, 1); setExtractedLabs(nl); }} className="text-rose-500 hover:text-rose-600 ml-1">X</button>
                            </div>
                          ) : (
                            lab.name || 'Diagnostic Panel'
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                </div>{/* end scrollable middle */}

                {/* ✅ Direct Action Button to Billing — ALWAYS VISIBLE, pinned to bottom */}
                <div className="pt-3 shrink-0 pb-16 sm:pb-6">
                  <button
                    onClick={handleProceedToBilling}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm flex items-center justify-between shadow-lg shadow-emerald-600/25 transition-all hover:-translate-y-0.5 active:scale-98 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      {isCloudSyncing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-teal-200" />
                          <span>Syncing with Cloud... • Proceed to Billing POS</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 text-emerald-300" />
                          <span>Proceed to Billing POS</span>
                        </>
                      )}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-100 font-semibold">
                      <span>Open POS</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>

      </div>

      <style>{`
        @keyframes rxScan {
          0% { top: 4%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: 96%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};
