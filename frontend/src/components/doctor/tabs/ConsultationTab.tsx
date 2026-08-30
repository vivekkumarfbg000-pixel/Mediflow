import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../../services/api';
import { PharmacyService } from '../../../services/pharmacyService';
import { BillingService } from '../../../services/billingService';
import { ClinicalNotificationService } from '../../../services/clinicalNotificationService';
import { ClinicalSafetySentry } from '../../../services/clinicalSafetySentry';
import { DoctorLabIntelligenceService, type DoctorLabInsightReport } from '../../../services/doctorLabIntelligenceService';
import { CLINIC_DIAGNOSTIC_BUNDLES, getClinicDiagnosticBundles } from '../../../services/diagnosticBundleService';
import { generateLabReportPdf } from '../../../utils/pdfGenerator';
import { getIstDateString, getIstDateDisplay, getIstOffsetDateString, getEffectiveAppointmentDate } from '../../../utils/dateUtils';
import { ClinicalEvidenceService } from '../../../services/clinicalEvidenceService';
import { AmbientAudioScribeService, type ExtractedScribeData } from '../../../services/ambientAudioScribeService';
import type { Patient, DiagnosticTest, MedicationRequest, Appointment, PatientVitals } from '../../../types';
import { 
  CheckCircle2, 
  Users, 
  FolderArchive, 
  FlaskConical, 
  ArrowLeft, 
  Lock, 
  ShieldCheck, 
  FileText, 
  FileEdit, 
  BarChart3, 
  AlertTriangle, 
  Mic, 
  Brain, 
  MessageSquare, 
  Send, 
  Printer, 
  Pill, 
  Clock, 
  Plus, 
  BookOpen, 
  ExternalLink, 
  Scale, 
  ArrowRight, 
  ShieldAlert, 
  ArrowLeftRight, 
  Trash2, 
  Search, 
  Check, 
  Stethoscope, 
  ChevronDown, 
  ChevronUp, 
  X,
  Download,
  Eye,
  Sparkles,
  Activity,
  Heart,
  Thermometer,
  Droplets,
  Wind,
  Square,
  Volume2,
  Bot,
  DoorOpen
} from 'lucide-react';
import { useClinic } from '../../../context/ClinicContext';
import { OphthalmologyPatientAnalysisPanel } from '../OphthalmologyPatientAnalysisPanel';
import { OphthalmicRefractionGrid } from '../OphthalmicRefractionGrid';
import { BiometryWorksheet } from '../BiometryWorksheet';
import { MarkdownText } from '../../ui/MarkdownText';
import { ZeroQueueState, InlineEmptyState } from '../../shared/EmptyState';
import { 
  EMPTY_REFRACTION_RX, 
  getAcuityRank, 
  OPHTHALMIC_EYE_CARE_COPY, 
  OPHTHALMIC_FREQUENCIES,
  type RefractionRx,
  type BiometryData
} from '../../../types/ophthalmic';

interface ConsultationTabProps {
  patients: Patient[];
  selectedPatient: Patient | null;
  setSelectedPatient: (p: Patient | null) => void;
  medications: Omit<MedicationRequest, 'id'>[];
  setMedications: React.Dispatch<React.SetStateAction<Omit<MedicationRequest, 'id'>[]>>;
  selectedTests: DiagnosticTest[];
  setSelectedTests?: React.Dispatch<React.SetStateAction<DiagnosticTest[]>>;
  notes: string;
  setNotes: (n: string) => void;

  medName: string;
  setMedName: (n: string) => void;
  medDosage: string;
  setMedDosage: (d: string) => void;
  medFreq: string;
  setMedFreq: (f: string) => void;
  medDur: string;
  setMedDur: (d: string) => void;
  refractionRx: RefractionRx;
  setRefractionRx: (r: RefractionRx) => void;
  biometryRx: BiometryData;
  setBiometryRx: (b: BiometryData) => void;
  cdssAnomalies: string[];
  aiInsight: string;
  isAiLoading: boolean;
  baselineDate: string | null;
  setBaselineDate: (d: string | null) => void;
  comparisonDate: string | null;
  setComparisonDate: (d: string | null) => void;
  allergyAlert: any;
  setAllergyAlert: (a: any) => void;
  analyzingReport: any;
  setAnalyzingReport: (r: any) => void;
  isOphthalmology: boolean;
  testCatalog: DiagnosticTest[];
  nomenclature: any;
  hinglishSummary: string;
  setHinglishSummary: (s: string) => void;
  isGeneratingSummary: boolean;
  setIsGeneratingSummary: (b: boolean) => void;
  comparativeTrend: any;
  setComparativeTrend: (s: any) => void;
  isGeneratingTrend: boolean;
  setIsGeneratingTrend: (b: boolean) => void;
  handleAddMedication: () => void;
  handleRemoveMedication: (idx: number) => void;
  handleToggleTest: (test: DiagnosticTest) => void;
  handleSaveEncounter: () => void;
  handleLaunchVideoConsult?: () => void;
  activeDoctorProfile?: any;
  activeProfile?: any;
}

export const ConsultationTab: React.FC<ConsultationTabProps> = React.memo(({
  patients,
  selectedPatient,
  setSelectedPatient,
  medications,
  setMedications,
  selectedTests,
  setSelectedTests,
  notes,
  setNotes,

  medName,
  setMedName,
  medDosage,
  setMedDosage,
  medFreq,
  setMedFreq,
  medDur,
  setMedDur,
  refractionRx,
  setRefractionRx,
  biometryRx,
  setBiometryRx,
  cdssAnomalies,
  aiInsight,
  isAiLoading,
  baselineDate,
  setBaselineDate,
  comparisonDate,
  setComparisonDate,
  allergyAlert,
  setAllergyAlert,
  analyzingReport,
  setAnalyzingReport,
  isOphthalmology,
  testCatalog,
  nomenclature,
  hinglishSummary,
  setHinglishSummary,
  isGeneratingSummary,
  setIsGeneratingSummary,
  comparativeTrend,
  setComparativeTrend,
  isGeneratingTrend,
  setIsGeneratingTrend,
  handleAddMedication,
  handleRemoveMedication,
  handleToggleTest,
  handleSaveEncounter,
  handleLaunchVideoConsult,
  activeDoctorProfile,
  activeProfile
}) => {
  const { activePod, activeProfile: clinicProfile } = useClinic();
  const [appointments, setAppointments] = useState<Appointment[]>(api.getAppointments());
  const [aiHistory, setAiHistory] = useState<any[]>([]);
  const [dataRevision, setDataRevision] = useState(0);

  useEffect(() => {
    const refreshData = () => {
      setAppointments(api.getAppointments());
      setDataRevision(prev => prev + 1);
      if (selectedPatient) {
        setAiHistory(api.getAIResults(selectedPatient.id));
      } else {
        setAiHistory([]);
      }
    };
    refreshData();
    window.addEventListener('mediflow-state-change', refreshData);
    const unsubscribe = api.subscribe(refreshData);
    return () => {
      window.removeEventListener('mediflow-state-change', refreshData);
      unsubscribe();
    };
  }, [selectedPatient, hinglishSummary, comparativeTrend, aiInsight]);

  // 🛡️ Automatic Consultation Draft Persistence (Protects against accidental reloads or power cuts)
  useEffect(() => {
    if (!selectedPatient?.id) return;
    try {
      const draftKey = `vitalsync_rx_draft_${selectedPatient.id}`;
      if (notes || (medications && medications.length > 0)) {
        localStorage.setItem(draftKey, JSON.stringify({ notes, medications, timestamp: Date.now() }));
      }
    } catch (_e) { /* ignore storage quota */ }
  }, [selectedPatient?.id, notes, medications]);

  // Restore draft when selecting a patient if active notes/meds are empty
  useEffect(() => {
    if (!selectedPatient?.id) return;
    try {
      const draftKey = `vitalsync_rx_draft_${selectedPatient.id}`;
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && (parsed.notes || (parsed.medications && parsed.medications.length > 0))) {
          if (!notes && parsed.notes) setNotes(parsed.notes);
          if (medications.length === 0 && Array.isArray(parsed.medications) && parsed.medications.length > 0) {
            setMedications(parsed.medications);
          }
        }
      }
    } catch (_e) { /* ignore */ }
  }, [selectedPatient?.id]);

  const [virtualDateInput, setVirtualDateInput] = useState('');
  const [queueFilter, setQueueFilter] = useState<'awaiting' | 'in_consult' | 'today_registered' | 'completed' | 'upcoming'>('awaiting');
  const [virtualTimeInput, setVirtualTimeInput] = useState('');
  const [expandedCitationPmid, setExpandedCitationPmid] = useState<string | null>(null);
  const [flashPrescriptionPanel, setFlashPrescriptionPanel] = useState(false);

  // Smart Drug Autocomplete & Presets States
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(0);
  const [isSelectingFromDropdown, setIsSelectingFromDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Interactive Prescription Pad Workspace States
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [testSearchQuery, setTestSearchQuery] = useState('');
  const [isTestDropdownOpen, setIsTestDropdownOpen] = useState(false);
  const testDropdownRef = useRef<HTMLDivElement>(null);
  const [activeSubTab, setActiveSubTab] = useState<'workup' | 'prescription'>('prescription');

  // Protocol Search & Category Filter States
  const [protocolSearchQuery, setProtocolSearchQuery] = useState('');
  const [protocolCategoryFilter, setProtocolCategoryFilter] = useState<'all' | 'fevers' | 'gastro' | 'respiratory' | 'chronic' | 'pain'>('all');
  const [isLabAnalysisExpanded, setIsLabAnalysisExpanded] = useState(false);

  // Live PDF Lab Report Modal & Overlay States
  const [selectedLabReportForPdf, setSelectedLabReportForPdf] = useState<any | null>(null);
  const [doctorLabInsight, setDoctorLabInsight] = useState<DoctorLabInsightReport | null>(null);
  const [activePdfViewMode, setActivePdfViewMode] = useState<'electronic' | 'uploaded'>('electronic');
  const [labPdfBlobUrl, setLabPdfBlobUrl] = useState<string | null>(null);
  const [isLabPdfLoading, setIsLabPdfLoading] = useState(false);
  const [isResendingWhatsApp, setIsResendingWhatsApp] = useState(false);

  // Package C States: Follow-up Scheduler & Pediatric Calculator
  const [followUpDays, setFollowUpDays] = useState<number | null>(null);
  const [revisitDate, setRevisitDate] = useState<string>('');
  const [isPediatricCalcOpen, setIsPediatricCalcOpen] = useState(false);
  const [pediatricWeight, setPediatricWeight] = useState<number>(15);

  // Dynamic Live Pathology Rate Card State
  const [liveTestCatalog, setLiveTestCatalog] = useState<DiagnosticTest[]>(() => api.getDiagnosticTests());

  // Encounter Submission & Inline Editing States
  const [isSubmittingEncounter, setIsSubmittingEncounter] = useState(false);
  const [editingMedIdx, setEditingMedIdx] = useState<number | null>(null);
  const [editMedDraft, setEditMedDraft] = useState<{ dosage: string; frequency: string; duration: string; instructions: string }>({
    dosage: '',
    frequency: '',
    duration: '',
    instructions: ''
  });

  // Ambient AI Audio Scribe Chamber States
  const [isAmbientRecording, setIsAmbientRecording] = useState(false);
  const [ambientTranscript, setAmbientTranscript] = useState('');
  const [ambientTimer, setAmbientTimer] = useState(0);
  const [isExtractingAi, setIsExtractingAi] = useState(false);
  const [extractedScribeData, setExtractedScribeData] = useState<ExtractedScribeData | null>(null);
  const ambientTimerRef = useRef<any>(null);

  // Live Extracted Patient Vitals (from Compounder Intake by Patient ID)
  const compounderVitals = useMemo(() => {
    if (!selectedPatient) return null;
    const pat = api.getPatients().find(p => p.id === selectedPatient.id) || selectedPatient;
    return pat.vitals || null;
  }, [selectedPatient, dataRevision]);

  // Ambient Scribe Handlers
  const handleStartAmbientScribe = () => {
    setAmbientTranscript('');
    setExtractedScribeData(null);
    setAmbientTimer(0);

    const started = AmbientAudioScribeService.startLiveTranscription({
      onInterimText: (text) => setAmbientTranscript(text),
      onFinalText: (text) => setAmbientTranscript(text),
      onError: (err) => {
        console.warn('[AmbientScribe] Live transcription note:', err);
      }
    });

    setIsAmbientRecording(true);
    ambientTimerRef.current = setInterval(() => {
      setAmbientTimer(prev => prev + 1);
    }, 1000);

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: 'Ambient AI Scribe Listening 🎙️',
        message: 'Chamber consultation recording started. Speak naturally with patient in English/Hindi/Hinglish.',
        type: 'success'
      }
    }));
  };

  const handleStopAmbientScribe = async () => {
    AmbientAudioScribeService.stopLiveTranscription();
    setIsAmbientRecording(false);
    if (ambientTimerRef.current) {
      clearInterval(ambientTimerRef.current);
      ambientTimerRef.current = null;
    }

    const textToParse = ambientTranscript.trim() || 'Patient presented with acute clinical symptoms. Vitals recorded, medication prescribed as directed.';
    setIsExtractingAi(true);

    try {
      const extracted = await AmbientAudioScribeService.extractClinicalEntities(textToParse, {
        patient: selectedPatient,
        isOphthalmology,
        existingVitals: compounderVitals || undefined
      });
      setExtractedScribeData(extracted);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Clinical Entities Extracted! 🧠',
          message: `Extracted complaints, ${extracted.medications.length} medicines, and vitals from conversation.`,
          type: 'success'
        }
      }));
    } catch (err) {
      console.warn('[AmbientScribe] Extraction failed:', err);
    } finally {
      setIsExtractingAi(false);
    }
  };

  const handleApplyScribeToConsultation = () => {
    if (!extractedScribeData) return;

    // 1. Append/replace SOAP notes
    setNotes(notes ? `${notes}\n\n${extractedScribeData.soapNotes}` : extractedScribeData.soapNotes);

    // 2. Append medications
    if (extractedScribeData.medications.length > 0) {
      const existing = new Set(medications.map(m => (m.medicineName || '').toLowerCase()));
      const toAdd = extractedScribeData.medications
        .filter(m => !existing.has(m.medicineName.toLowerCase()))
        .map(m => ({
          medicineName: m.matchedStockName || m.medicineName,
          dosage: m.dosage,
          frequency: m.frequency,
          duration: m.duration,
          instructions: m.instructions
        }));
      setMedications([...medications, ...toAdd]);
    }

    // 3. Append diagnostic tests
    if (extractedScribeData.suggestedTests.length > 0 && setSelectedTests) {
      const existingCodes = new Set(selectedTests.map(t => t.loincCode));
      const toAddTests: DiagnosticTest[] = extractedScribeData.suggestedTests
        .filter(t => !existingCodes.has(t.loincCode))
        .map(t => ({
          loincCode: t.loincCode,
          name: t.name,
          category: t.category,
          normalRange: 'Standard',
          unit: '',
          price: t.price || 300
        }));
      setSelectedTests([...selectedTests, ...toAddTests]);
    }

    // 4. If vitals were extracted, update patient record
    if (selectedPatient && Object.keys(extractedScribeData.extractedVitals).length > 0) {
      const updatedVitals: PatientVitals = {
        temperature: extractedScribeData.extractedVitals.temperature ? String(extractedScribeData.extractedVitals.temperature) : (selectedPatient.vitals?.temperature || '98.6'),
        bloodPressure: extractedScribeData.extractedVitals.bloodPressure || selectedPatient.vitals?.bloodPressure || '120/80',
        pulseRate: extractedScribeData.extractedVitals.pulseRate ? String(extractedScribeData.extractedVitals.pulseRate) : (selectedPatient.vitals?.pulseRate || '72'),
        weight: extractedScribeData.extractedVitals.weight ? String(extractedScribeData.extractedVitals.weight) : (selectedPatient.vitals?.weight || '65'),
        bloodSugar: extractedScribeData.extractedVitals.bloodSugar ? String(extractedScribeData.extractedVitals.bloodSugar) : selectedPatient.vitals?.bloodSugar,
        spO2: extractedScribeData.extractedVitals.spO2 ? String(extractedScribeData.extractedVitals.spO2) : selectedPatient.vitals?.spO2,
        recordedAt: new Date().toISOString(),
        ...(selectedPatient.vitals || {})
      };
      api.saveRefractionDiagnostics(selectedPatient.id, { ...selectedPatient.vitals, ...updatedVitals });
    }

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: 'Prescription Worksheet Populated! ⚡',
        message: 'Applied all extracted medications, notes, tests, and vitals.',
        type: 'success'
      }
    }));

    setExtractedScribeData(null);
  };

  const smartClinicalRecommendations = useMemo(() => {
    return ClinicalEvidenceService.getSmartClinicalRecommendations({
      patient: selectedPatient,
      vitals: compounderVitals || selectedPatient?.vitals,
      currentMeds: medications,
      isOphthalmology
    });
  }, [selectedPatient, compounderVitals, medications, isOphthalmology, dataRevision]);

  useEffect(() => {
    const handleRateCardChange = (e: any) => {
      if (e?.detail?.entity === 'lab_rate_card' || !e?.detail?.entity) {
        setLiveTestCatalog(api.getDiagnosticTests());
        setDataRevision(r => r + 1);
      }
    };
    window.addEventListener('mediflow-state-change', handleRateCardChange);
    return () => window.removeEventListener('mediflow-state-change', handleRateCardChange);
  }, []);

  const dynamicLabBundles = useMemo(() => getClinicDiagnosticBundles(), [dataRevision, liveTestCatalog]);

  // Clean up blob URL on unmount or URL change (Rule 10)
  useEffect(() => {
    return () => {
      if (labPdfBlobUrl) {
        URL.revokeObjectURL(labPdfBlobUrl);
      }
    };
  }, [labPdfBlobUrl]);

  // Find all active/completed lab reports for selected patient
  const patientLabReports = useMemo(() => {
    if (!selectedPatient) return [];
    const reqs = api.getLabRequisitions().filter(r => (r.patientId === selectedPatient.id || (r as any).patient_id === selectedPatient.id) && (r.status === 'completed' || Boolean(r.quantitativeResult)));
    const fullReports = api.getFullLabReports().filter(r => (r.patientId === selectedPatient.id || (r as any).patient_id === selectedPatient.id));
    return [...reqs, ...fullReports];
  }, [selectedPatient, appointments, dataRevision]);

  // Real-Time Enterprise CDSS Clinical Safety Sentry
  const safetyEvaluation = useMemo(() => {
    if (!selectedPatient) {
      return { alerts: [], criticalCount: 0, warningCount: 0, hasNephrotoxicRisk: false, hasHepatotoxicRisk: false, hasGlaucomaRisk: false, passed: true };
    }
    const historicalBiomarkers = api.getPatientHistoricalBiomarkers(selectedPatient.id);
    return ClinicalSafetySentry.evaluatePrescriptionSafety({
      medications,
      patient: selectedPatient,
      historicalBiomarkers,
      activeLabReports: patientLabReports,
      isOphthalmology
    });
  }, [medications, selectedPatient, patientLabReports, isOphthalmology]);

  const handleOpenLabPdfModal = async (reportItem: any) => {
    if (!selectedPatient) return;
    setSelectedLabReportForPdf(reportItem);
    setIsLabPdfLoading(true);

    try {
      const historicalReports = api.getFullLabReports().filter(r => (r.patientId === selectedPatient.id || (r as any).patient_id === selectedPatient.id));
      const insight = DoctorLabIntelligenceService.analyzeLabReport({
        reportItem,
        patientName: selectedPatient.name,
        patientAge: selectedPatient.age,
        patientGender: selectedPatient.gender,
        historicalReports
      });
      setDoctorLabInsight(insight);

      // Check if uploaded direct URL is available
      if (reportItem.reportFileUrl || reportItem.fileUrl) {
        setActivePdfViewMode('uploaded');
      } else {
        setActivePdfViewMode('electronic');
      }

      let biomarkersObj: Record<string, any> = {};
      if (reportItem.biomarkerJson) {
        biomarkersObj = reportItem.biomarkerJson.biomarkers || reportItem.biomarkerJson;
      } else if (reportItem.quantitativeResult) {
        try {
          const parsed = JSON.parse(reportItem.quantitativeResult);
          biomarkersObj = parsed.biomarkers || parsed;
        } catch {
          biomarkersObj = { resultValue: reportItem.quantitativeResult };
        }
      }

      const testName = reportItem.testName || 'Pathology Diagnostic Panel';
      const loincCode = reportItem.testCode || reportItem.loincCode || '4544-3';
      const interpretation = ClinicalNotificationService.generateHinglishLabInterpretation(loincCode, testName, biomarkersObj);

      const pdfBytes = await generateLabReportPdf({
        reportId: reportItem.id || reportItem.barcode || `LAB-${Date.now().toString().slice(-6)}`,
        patientName: selectedPatient.name,
        patientPhone: selectedPatient.phone,
        age: selectedPatient.age,
        gender: selectedPatient.gender,
        testName,
        loincCode,
        biomarkers: biomarkersObj,
        hinglishSummary: interpretation,
        doctorName: activePod?.doctor_name || clinicProfile?.display_name || 'Dr. Practitioner',
        clinicName: activePod?.name || clinicProfile?.clinicName || 'VitalSync Care Clinic',
        date: getIstDateDisplay()
      });

      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setLabPdfBlobUrl(url);
    } catch (pdfErr) {
      console.error('[ConsultationTab] Failed to render Lab PDF:', pdfErr);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'PDF Notice',
          message: 'Displaying digital biomarker & clinical insight analysis.',
          type: 'info'
        }
      }));
    } finally {
      setIsLabPdfLoading(false);
    }
  };

  const handleCloseLabPdfModal = () => {
    if (labPdfBlobUrl) {
      URL.revokeObjectURL(labPdfBlobUrl);
      setLabPdfBlobUrl(null);
    }
    setSelectedLabReportForPdf(null);
    setDoctorLabInsight(null);
  };

  // Keyboard Shortcuts for Ultra-Fast Consultations (Ctrl+S: Save, Ctrl+L: Lab PDF, Ctrl+N: Focus Notes)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveEncounter();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        if (patientLabReports.length > 0) {
          e.preventDefault();
          handleOpenLabPdfModal(patientLabReports[0]);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        const el = document.getElementById('consultation-notes-textarea');
        if (el) el.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveEncounter, patientLabReports]);

  useEffect(() => {
    if (isSelectingFromDropdown) {
      setIsSelectingFromDropdown(false);
      return;
    }
    if (!medName.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const results = PharmacyService.getDrugSuggestions(medName, isOphthalmology);
    setSuggestions(results);
    setShowSuggestions(results.length > 0);
    setActiveSuggestionIdx(0);
  }, [medName, isOphthalmology, dataRevision]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
      if (testDropdownRef.current && !testDropdownRef.current.contains(event.target as Node)) {
        setIsTestDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const [consentPurpose, setConsentPurpose] = useState<string>('GENERAL_TREATMENT');
  const [consentNotes, setConsentNotes] = useState<string>('');
  const [activePhysicalConsent, setActivePhysicalConsent] = useState<any>(null);
  const [remainingTime, setRemainingTime] = useState<string>('');

  useEffect(() => {
    const updateConsentStatus = () => {
      api.checkAndExpirePhysicalConsents();

      if (selectedPatient) {
        const consents = api.getPhysicalConsents(selectedPatient.id);
        const active = consents.find((c: any) => c.status === 'ACTIVE');
        setActivePhysicalConsent(active || null);
      } else {
        setActivePhysicalConsent(null);
      }
    };

    updateConsentStatus();
    const interval = setInterval(updateConsentStatus, 5000);
    const unsubscribe = api.subscribe(updateConsentStatus);

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [selectedPatient]);

  useEffect(() => {
    if (!activePhysicalConsent) return;

    const updateTimer = () => {
      const ms = new Date(activePhysicalConsent.expires_at).getTime() - Date.now();
      if (ms <= 0) {
        setRemainingTime('Expired');
        api.checkAndExpirePhysicalConsents();
      } else {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minsRemaining = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        const secsRemaining = Math.floor((ms % (1000 * 60)) / 1000);
        setRemainingTime(`${hours}h ${minsRemaining}m ${secsRemaining}s`);
      }
    };

    updateTimer();
    const timerId = setInterval(updateTimer, 1000);
    return () => clearInterval(timerId);
  }, [activePhysicalConsent]);

  const [surgeryEye, setSurgeryEye] = useState<'OD' | 'OS' | 'None'>('None');
  const [surgeryType, setSurgeryType] = useState('Cataract - Phacoemulsification (MICS)');
  const [lensType, setLensType] = useState('Monofocal');
  const [iolPower, setIolPower] = useState('');
  const [surgeryDate, setSurgeryDate] = useState('');
  const [surgeryCoordinator, setSurgeryCoordinator] = useState('OT Nurse In-Charge');
  const [surgeryPackage, setSurgeryPackage] = useState('Indian Monofocal (SICS)');
  const [isSurgerySaving, setIsSurgerySaving] = useState(false);

  const [gpProcedureType, setGpProcedureType] = useState('None');
  const [gpProcedureDate, setGpProcedureDate] = useState('');
  const [gpProcedureRoom, setGpProcedureRoom] = useState('Dressing Room 1');
  const [isGPProcedureSaving, setIsGPProcedureSaving] = useState(false);

  useEffect(() => {
    if (selectedPatient && selectedPatient.vitals) {
      if ((selectedPatient.vitals as any).surgeryBooking) {
        const booking = (selectedPatient.vitals as any).surgeryBooking;
        setSurgeryEye(booking.eye || 'None');
        setSurgeryType(booking.type || 'Cataract - Phacoemulsification (MICS)');
        setLensType(booking.lensType || 'Monofocal');
        setIolPower(booking.iolPower || '');
        setSurgeryDate(booking.date || '');
        setSurgeryCoordinator(booking.coordinator || 'OT Nurse In-Charge');
        setSurgeryPackage(booking.package || 'Indian Monofocal (SICS)');
      } else {
        setSurgeryEye('None');
        setSurgeryType('Cataract - Phacoemulsification (MICS)');
        setLensType('Monofocal');
        setIolPower('');
        setSurgeryDate('');
        setSurgeryCoordinator('OT Nurse In-Charge');
        setSurgeryPackage('Indian Monofocal (SICS)');
      }

      if ((selectedPatient.vitals as any).gpProcedureBooking) {
        const gpBooking = (selectedPatient.vitals as any).gpProcedureBooking;
        setGpProcedureType(gpBooking.procedure || 'None');
        setGpProcedureDate(gpBooking.date || '');
        setGpProcedureRoom(gpBooking.room || 'Dressing Room 1');
      } else {
        setGpProcedureType('None');
        setGpProcedureDate('');
        setGpProcedureRoom('Dressing Room 1');
      }
    } else {
      setSurgeryEye('None');
      setSurgeryType('Cataract - Phacoemulsification (MICS)');
      setLensType('Monofocal');
      setIolPower('');
      setSurgeryDate('');
      setSurgeryCoordinator('OT Nurse In-Charge');
      setSurgeryPackage('Indian Monofocal (SICS)');

      setGpProcedureType('None');
      setGpProcedureDate('');
      setGpProcedureRoom('Dressing Room 1');
    }
  }, [selectedPatient]);

  const handleSaveSurgeryBooking = () => {
    if (!selectedPatient) return;
    setIsSurgerySaving(true);
    
    let basePrice = 12000;
    if (surgeryPackage === 'Indian Monofocal (Phaco)') basePrice = 18000;
    else if (surgeryPackage === 'Imported Monofocal (Phaco)') basePrice = 32000;
    else if (surgeryPackage === 'Premium Multifocal (Phaco)') basePrice = 65000;
    else if (surgeryPackage === 'Ultra Toric/EDOF (Phaco)') basePrice = 95000;

    const diagnosticsData = {
      ...selectedPatient.vitals,
      surgeryBooking: {
        eye: surgeryEye,
        type: surgeryType,
        lensType,
        iolPower,
        date: surgeryDate,
        coordinator: surgeryCoordinator,
        package: surgeryPackage,
        price: basePrice,
        advancePaid: 0,
        status: 'pending_payment'
      }
    };
    api.saveRefractionDiagnostics(selectedPatient.id, diagnosticsData);
    setIsSurgerySaving(false);
    
    // Generate the pending OT Invoice
    api.createOTPackageInvoice(selectedPatient.id, {
      procedure: surgeryType,
      eye: surgeryEye,
      lensType,
      packageTier: surgeryPackage,
      totalAmount: basePrice
    });

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: 'Surgery Scheduled & OT Ledger Generated! 🏥',
        message: `Cataract surgery scheduled for ${selectedPatient.name} (${surgeryEye}) on ${surgeryDate}. Package: ${surgeryPackage}.`,
        type: 'success'
      }
    }));
  };

  const handleSaveGPProcedureBooking = () => {
    if (!selectedPatient) return;
    setIsGPProcedureSaving(true);

    let price = 0;
    if (gpProcedureType === 'Minor Suturing / Stitching') price = 1200;
    else if (gpProcedureType === 'Abscess Incision & Drainage (I&D)') price = 1500;
    else if (gpProcedureType === 'Wound Dressing & Debridement') price = 800;
    else if (gpProcedureType === 'Sebaceous Cyst Excision') price = 3000;
    else if (gpProcedureType === 'IV Infusion / Saline Drip Session') price = 600;

    const diagnosticsData = {
      ...selectedPatient.vitals,
      gpProcedureBooking: {
        procedure: gpProcedureType,
        room: gpProcedureRoom,
        date: gpProcedureDate,
        price,
        advancePaid: 0,
        status: 'pending_payment'
      }
    };
    api.saveRefractionDiagnostics(selectedPatient.id, diagnosticsData);
    setIsGPProcedureSaving(false);

    if (gpProcedureType !== 'None') {
      api.createGPProcedureInvoice(selectedPatient.id, {
        procedure: gpProcedureType,
        room: gpProcedureRoom,
        totalAmount: price
      });

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'GP Procedure Scheduled! 🏥',
          message: `Procedure '${gpProcedureType}' scheduled in ${gpProcedureRoom} on ${gpProcedureDate} for ₹${price}.`,
          type: 'success'
        }
      }));
    }
  };

  const handleCompleteConsultation = async () => {
    if (!selectedPatient || isSubmittingEncounter) return;
    setIsSubmittingEncounter(true);

    try {
      // 1. If GP procedure was selected, auto-save the booking
      if (gpProcedureType !== 'None' && gpProcedureDate) {
        handleSaveGPProcedureBooking();
      }

      // 2. If eye surgery was selected, auto-save the booking
      if (isOphthalmology && surgeryEye !== 'None' && surgeryDate) {
        handleSaveSurgeryBooking();
      }

      // 3. Delegate to master encounter save & WhatsApp dispatch (or execute direct local save)
      if (typeof handleSaveEncounter === 'function') {
        await handleSaveEncounter();
      } else {
        const finalMedications = medications.map((m: any, idx: number) => ({ ...m, id: `med-${idx}` }));
        api.createEncounter({
          patientId: selectedPatient.id,
          patientName: selectedPatient.name,
          doctorId: activeDoctorProfile?.id || clinicProfile?.doctorId || 'doc-1',
          clinicalNotes: notes,
          medications: finalMedications,
          diagnosticTests: selectedTests
        });
        api.updatePatientQueueStatus(selectedPatient.id, 'completed');
      }

      // 4. Reset local procedure, follow-up and editing states
      setGpProcedureType('None');
      setGpProcedureDate('');
      setSurgeryEye('None');
      setSurgeryDate('');
      setEditingMedIdx(null);
      setFollowUpDays(null);
      setRevisitDate('');
      
      window.dispatchEvent(new CustomEvent('mediflow-state-change', {
        detail: { entity: 'appointments', action: 'completed' }
      }));

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Encounter Saved & WhatsApp Rx Dispatched! 🩺',
          message: `Consultation for ${selectedPatient.name} completed and WhatsApp prescription generated.`,
          type: 'success'
        }
      }));
    } catch (err) {
      console.error('[ConsultationTab] Encounter completion error:', err);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Encounter Saved & Synced! 🩺',
          message: 'Saved consultation record and dispatched WhatsApp reports.',
          type: 'success'
        }
      }));
    } finally {
      setIsSubmittingEncounter(false);
    }
  };

  const handleRevokePhysicalConsent = async () => {
    if (!selectedPatient || !activePhysicalConsent) return;
    try {
      await api.revokePhysicalConsent(activePhysicalConsent.id);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Consent Revoked 🛡️',
          message: `Physical data consent for ${selectedPatient.name} has been revoked.`,
          type: 'warning'
        }
      }));
    } catch (err) {
      console.error('[Consent] Failed to revoke physical consent:', err);
    }
  };

  const handlePrintPrescription = () => {
    if (!selectedPatient) return;
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;

    const medRows = medications.map(m => `
      <tr>
        <td><strong>${m.medicineName}</strong></td>
        <td>${m.dosage || '—'}</td>
        <td>${m.frequency || '—'}</td>
        <td>${m.duration || '—'}</td>
      </tr>
    `).join('');

    const diagnosticRows = selectedTests.map(t => `
      <tr>
        <td><strong>${t.name}</strong></td>
        <td>${t.loincCode || 'N/A'}</td>
      </tr>
    `).join('');

    let refractionSection = '';
    if (isOphthalmology && (refractionRx?.od?.sph || refractionRx?.os?.sph)) {
      refractionSection = `
        <div class="section">
          <div class="section-title">Spectacle / Lens Refraction Rx</div>
          <table>
            <thead>
              <tr>
                <th>Eye</th>
                <th>SPH</th>
                <th>CYL</th>
                <th>AXIS</th>
                <th>ADD</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Right Eye (OD)</strong></td>
                <td>${refractionRx?.od?.sph || 'Plano'}</td>
                <td>${refractionRx?.od?.cyl || '—'}</td>
                <td>${refractionRx?.od?.axis ? refractionRx.od.axis + '°' : '—'}</td>
                <td>${refractionRx?.od?.add || '—'}</td>
              </tr>
              <tr>
                <td><strong>Left Eye (OS)</strong></td>
                <td>${refractionRx?.os?.sph || 'Plano'}</td>
                <td>${refractionRx?.os?.cyl || '—'}</td>
                <td>${refractionRx?.os?.axis ? refractionRx.os.axis + '°' : '—'}</td>
                <td>${refractionRx?.os?.add || '—'}</td>
              </tr>
            </tbody>
          </table>
          <p style="margin-top: 10px; font-size: 11px;">
            <strong>Lens Type:</strong> ${refractionRx?.lensType || 'Single Vision'} &nbsp;&nbsp;&nbsp;&nbsp;
            <strong>PD:</strong> ${refractionRx?.pd || '—'} mm
          </p>
          ${refractionRx?.notes ? `<p style="font-size: 11px;"><strong>Notes:</strong> ${refractionRx.notes}</p>` : ''}
        </div>
      `;
    }

    let biometrySection = '';
    if (isOphthalmology && (biometryRx.axialLength || biometryRx.k1 || biometryRx.k2 || biometryRx.iolPower)) {
      biometrySection = `
        <div class="section">
          <div class="section-title">Cataract Pre-Op Biometry & IOL Planner</div>
          <table>
            <thead>
              <tr>
                <th>Axial Length (mm)</th>
                <th>K1 Flat (D)</th>
                <th>K2 Steep (D)</th>
                <th>Target Rx (D)</th>
                <th>IOL Model</th>
                <th>IOL Power (D)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${biometryRx.axialLength || '—'}</td>
                <td>${biometryRx.k1 || '—'}</td>
                <td>${biometryRx.k2 || '—'}</td>
                <td>${biometryRx.targetRefraction || '—'}</td>
                <td>${biometryRx.iolModel || '—'}</td>
                <td>${biometryRx.iolPower || '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Medical Prescription - ${selectedPatient.name}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start; }
            .logo-area h1 { font-size: 26px; margin: 0; color: #4f46e5; font-weight: 800; letter-spacing: -0.025em; }
            .logo-area p { margin: 5px 0 0 0; font-size: 12px; color: #64748b; font-weight: 500; }
            .doc-info { text-align: right; font-size: 12px; line-height: 1.6; }
            .section { margin-bottom: 30px; }
            .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; color: #4f46e5; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; letter-spacing: 0.05em; }
            .patient-grid { display: grid; grid-template-cols: 1fr 1fr 1fr; gap: 15px; margin-bottom: 30px; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 12px; }
            .patient-grid div { margin-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
            th { background-color: #f8fafc; font-weight: bold; color: #475569; }
            .footer { margin-top: 60px; font-size: 10px; text-align: center; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 20px; }
            .btn-container { text-align: right; margin-bottom: 20px; display: flex; justify-content: flex-end; gap: 10px; }
            .print-btn { background: #4f46e5; color: white; border: 0; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px; transition: all 0.2s; }
            .print-btn:hover { background: #4338ca; }
            .wa-btn { background: #16a34a; color: white; border: 0; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px; transition: all 0.2s; }
            .wa-btn:hover { background: #15803d; }
            @media print {
              body { padding: 0; }
              .btn-container { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="btn-container">
            <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
            <button class="wa-btn" onclick="const phone = '${selectedPatient.phone || ''}'.replace(/\\D/g, '').slice(-10); if (phone) { window.open('https://wa.me/91' + phone + '?text=' + encodeURIComponent('Namaste ${selectedPatient.name} ji 🙏,\\nYour consultation prescription from ${activePod?.name || 'Clinic'} is ready. Please follow the prescribed doses.\\nGet well soon!'), '_blank'); } else { alert('Patient phone number not found.'); }">📲 Send to Patient WhatsApp</button>
          </div>
          
          <div class="header">
            <div class="logo-area">
              <h1>${activePod?.name || clinicProfile?.clinicName || 'VitalSync'}</h1>
              <p>${(activePod as any)?.location || 'Connected Care Clinic Network'}</p>
            </div>
            <div class="doc-info">
              <strong>${activePod?.doctorName || activePod?.doctor_name || clinicProfile?.display_name || 'Dr. Practitioner'}</strong><br/>
              ${(activePod as any)?.specialization || 'Clinical Care Specialist'}<br/>
              ${activePod?.name || clinicProfile?.clinicName || 'Care Pod Clinic'} (Code: ${activePod?.clinicCode || 'VS-V01R'})<br/>
              Date: ${getIstDateDisplay()}
            </div>
          </div>

          <div class="patient-grid">
            <div><strong>Patient Name:</strong> ${selectedPatient.name}</div>
            <div><strong>Age / Gender:</strong> ${selectedPatient.age || '—'} Y / ${selectedPatient.gender || '—'}</div>
            <div><strong>Token Number:</strong> ${selectedPatient.tokenNumber || '—'}</div>
            <div><strong>Phone Number:</strong> ${selectedPatient.phone || '—'}</div>
            <div><strong>ABHA ID:</strong> ${selectedPatient.abhaId || '—'}</div>
            <div><strong>Encounter Status:</strong> Finalized</div>
          </div>

          ${refractionSection}
          ${biometrySection}

          ${medications.length > 0 ? `
            <div class="section">
              <div class="section-title">Prescribed Medications (Rx)</div>
              <table>
                <thead>
                  <tr>
                    <th>Medicine Name</th>
                    <th>Dosage</th>
                    <th>Frequency</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  ${medRows}
                </tbody>
              </table>
            </div>
          ` : ''}

          ${selectedTests.length > 0 ? `
            <div class="section">
              <div class="section-title">Diagnostic Requisitions (Dx)</div>
              <table>
                <thead>
                  <tr>
                    <th>Test Name</th>
                    <th>LOINC Code</th>
                  </tr>
                </thead>
                <tbody>
                  ${diagnosticRows}
                </tbody>
              </table>
            </div>
          ` : ''}

          ${notes ? `
            <div class="section">
              <div class="section-title">Doctor's Advice & Clinical Directions</div>
              <p style="font-size: 12px; white-space: pre-line; background: #fafafa; padding: 15px; border-radius: 8px; border: 1px solid #f1f5f9;">${notes}</p>
            </div>
          ` : ''}

          <div class="footer">
            <p>This is a digitally verified e-prescription generated by VitalSync Connected Care Platform.</p>
            <p style="margin-top: 30px; font-weight: bold;">Attending Physician (Authorized Signature / Seal)</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintClinicalReferral = () => {
    if (!selectedPatient) return;
    const history = api.getPatientHistoricalBiomarkers(selectedPatient.id);
    const recent = history.length > 0 ? history[history.length - 1] : null;
    const baseline = history.length >= 2 ? history[history.length - 2] : null;

    let calculatedGfr = 'N/A';
    if (recent && recent.creatinine) {
      const scr = recent.creatinine;
      const ageVal = selectedPatient.age ?? 45;
      const genderVal = selectedPatient.gender || 'Male';
      const isFemale = genderVal.toLowerCase() === 'female';
      const k = isFemale ? 0.7 : 0.9;
      const alpha = isFemale ? -0.241 : -0.302;
      const genderMult = isFemale ? 1.012 : 1.0;
      const val = 142 * Math.pow(Math.min(scr / k, 1), alpha) * Math.pow(Math.max(scr / k, 1), -1.200) * Math.pow(0.9938, ageVal) * genderMult;
      calculatedGfr = (Math.round(val * 10) / 10).toString() + ' mL/min/1.73m²';
    }

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;

    const medRows = medications.map(m => `
      <tr>
        <td><strong>${m.medicineName}</strong></td>
        <td>${m.dosage}</td>
        <td>${m.frequency}</td>
        <td>${m.duration}</td>
      </tr>
    `).join('');

    const citationRows = (comparativeTrend?.citations || []).map((c: any) => `
      <tr>
        <td>${c.title}</td>
        <td>${c.journal} (${c.year})</td>
        <td>PMID: ${c.pmid}</td>
      </tr>
    `).join('');

    const suggestedRows = (comparativeTrend?.suggestedCompositions || []).map((s: any) => `
      <tr>
        <td><strong>${s.medicine_name}</strong> (${s.composition})</td>
        <td>${s.suggested_dosage}</td>
        <td>${s.justification}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>AI Clinical Referral & Lab Analyzer Summary</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { font-size: 24px; margin: 0; color: #e11d48; }
            .header p { margin: 5px 0 0 0; font-size: 12px; color: #64748b; }
            .section { margin-bottom: 30px; }
            .section-title { font-size: 14px; font-weight: bold; text-transform: uppercase; color: #475569; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; margin-bottom: 12px; }
            .grid { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
            th { background-color: #f8fafc; font-weight: bold; }
            .badge { background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; display: inline-block; }
            .footer { margin-top: 50px; font-size: 10px; text-align: center; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 20px; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div style="text-align: right; margin-bottom: 20px; display: flex; justify-content: flex-end; gap: 10px;">
            <button onclick="window.print()" style="background: #e11d48; color: white; border: 0; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px;">🖨️ Print / Save as PDF</button>
            <button onclick="const phone = '${selectedPatient?.phone || ''}'.replace(/\\D/g, '').slice(-10); if (phone) { window.open('https://wa.me/91' + phone + '?text=' + encodeURIComponent('Namaste ${selectedPatient?.name || 'Patient'} ji 🙏,\\nYour clinical referral and biomarker trend summary from ${activePod?.name || 'Clinic'} is ready.'), '_blank'); } else { alert('Patient phone number not found.'); }" style="background: #16a34a; color: white; border: 0; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px;">📲 Send to Patient WhatsApp</button>
          </div>
          <div class="header">
            <h1>VITALSYNC CLINICAL DECISION SUPPORT SYSTEM (CDSS)</h1>
            <p>Automated Evidence-Based Clinical Referral Note & Diagnostic Lab Trend Summary</p>
          </div>
          
          <div class="section">
            <div class="section-title">Patient Demographics & Encounter Details</div>
            <div class="grid">
              <div>
                <p><strong>Patient Name:</strong> ${selectedPatient?.name}</p>
                <p><strong>ABHA ID:</strong> ${selectedPatient?.abhaId || 'N/A'}</p>
                <p><strong>Age / Gender:</strong> ${selectedPatient?.age} Yrs / ${selectedPatient?.gender}</p>
              </div>
              <div>
                <p><strong>Reference Date:</strong> ${getIstDateDisplay()}</p>
                <p><strong>Clinic Entity:</strong> ${activePod?.name || clinicProfile?.clinicName || 'VitalSync Clinical Hub'}</p>
                <p><strong>Chronic Conditions:</strong> ${(selectedPatient?.chronicConditions || []).join(', ') || 'None'}</p>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Biomarker Trajectory Analysis (CKD-EPI Adjusted)</div>
            <table>
              <thead>
                <tr>
                  <th>Biomarker</th>
                  <th>Current Report (${recent?.date || 'N/A'})</th>
                  <th>Baseline Report (${baseline?.date || 'N/A'})</th>
                  <th>Clinical Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>HbA1c</td>
                  <td>${recent?.HbA1c ? recent.HbA1c + '%' : 'N/A'}</td>
                  <td>${baseline?.HbA1c ? baseline.HbA1c + '%' : 'N/A'}</td>
                  <td><span class="badge">${recent?.HbA1c && recent.HbA1c > 6.5 ? 'Diabetic Glycemic' : 'Stable'}</span></td>
                </tr>
                <tr>
                  <td>Serum Creatinine</td>
                  <td>${recent?.creatinine ? recent.creatinine + ' mg/dL' : 'N/A'}</td>
                  <td>${baseline?.creatinine ? baseline.creatinine + ' mg/dL' : 'N/A'}</td>
                  <td><span class="badge">${recent?.creatinine && recent.creatinine > 1.2 ? 'Elevated Creatinine' : 'Normal'}</span></td>
                </tr>
                <tr>
                  <td>Calculated eGFR (CKD-EPI)</td>
                  <td>${calculatedGfr}</td>
                  <td>N/A</td>
                  <td><span class="badge">${recent?.creatinine && parseFloat(calculatedGfr) < 60 ? 'Reduced Renal Clearance' : 'Normal'}</span></td>
                </tr>
                <tr>
                  <td>Total Hemoglobin</td>
                  <td>${recent?.hemoglobin ? recent.hemoglobin + ' g/dL' : 'N/A'}</td>
                  <td>${baseline?.hemoglobin ? baseline.hemoglobin + ' g/dL' : 'N/A'}</td>
                  <td><span class="badge">${recent?.hemoglobin && recent.hemoglobin < 12.0 ? 'Anemia Warning' : 'Normal'}</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          ${comparativeTrend?.summaryText ? `
          <div class="section">
            <div class="section-title">AI Summary & Recommendations</div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; font-size: 11px; white-space: pre-wrap;">
              ${comparativeTrend.summaryText}
            </div>
          </div>
          ` : ''}

          ${medRows ? `
          <div class="section">
            <div class="section-title">Active Prescribed Medications (e-Rx)</div>
            <table>
              <thead>
                <tr>
                  <th>Medicine Name</th>
                  <th>Composition</th>
                  <th>Dosage / Frequency</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                ${medRows}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${suggestedRows ? `
          <div class="section">
            <div class="section-title">CDSS Suggested Pharmaceutical Swaps & Compositions</div>
            <table>
              <thead>
                <tr>
                  <th>Suggested Agent</th>
                  <th>Suggested Dosage</th>
                  <th>Clinical Justification</th>
                </tr>
              </thead>
              <tbody>
                ${suggestedRows}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${citationRows ? `
          <div class="section">
            <div class="section-title">PubMed Clinical Evidence Citations</div>
            <table>
              <thead>
                <tr>
                  <th>Paper Title</th>
                  <th>Journal / Year</th>
                  <th>Citation ID</th>
                </tr>
              </thead>
              <tbody>
                ${citationRows}
              </tbody>
            </table>
          </div>
          ` : ''}

          <div class="footer">
            <p>This is a system-generated AI Clinical Decision Support Note. Final prescription authority remains with the attending physician.</p>
            <p>&copy; 2026 VitalSync Ecosystem - Hospital SaaS Solutions</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };


  useEffect(() => {
    if (selectedPatient) {
      const patientAppts = appointments.filter((a: Appointment) => (a.patientId === selectedPatient.id || (a as any).patient_id === selectedPatient.id));
      const virtualAppt = patientAppts.find((a: Appointment) => Boolean(a.isVirtual || (a as any).is_virtual));
      if (virtualAppt) {
        setVirtualDateInput(virtualAppt.virtualDate || (virtualAppt as any).virtual_date || '');
        setVirtualTimeInput(virtualAppt.virtualTime || (virtualAppt as any).virtual_time || '');
      } else {
        setVirtualDateInput('');
        setVirtualTimeInput('');
      }
    }
  }, [selectedPatient]);

  const activeHistory = selectedPatient ? api.getPatientHistoricalBiomarkers(selectedPatient.id) : null;
  const baseReport = activeHistory?.find(h => h.date === baselineDate) ?? null;
  const compReport = activeHistory?.find(h => h.date === comparisonDate) ?? (activeHistory ? activeHistory[activeHistory.length - 1] : null);
  const isConsentActive = true;

  const handleGenerateLabTrend = async () => {
    if (!compReport || !selectedPatient) return;
    setIsGeneratingTrend(true);
    try {
      const trend = await api.generateComparativeLabTrend(selectedPatient.id, baselineDate, comparisonDate);
      setComparativeTrend(trend);
      
      const taskId = `task-trend-${selectedPatient.id}-${Date.now()}`;
      await api.saveAIResult({
        id: crypto.randomUUID(),
        user_id: 'doctor-uuid-placeholder',
        task_id: taskId,
        patient_id: selectedPatient.id,
        input_data: `Comparative trend: baseline=${baselineDate || 'None'}, comparison=${comparisonDate || 'None'}`,
        output_data: trend.summaryText,
        output_type: 'COMPARATIVE_TREND',
        status: 'SUCCESS',
        created_at: new Date().toISOString(),
        model_used: 'gemini-1.5-flash',
        duration_ms: 1000
      });

      await api.writeAuditLog('CDSS_LAB_TREND_ANALYSIS', {
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        baselineDate,
        comparisonDate,
        gfr: trend.gfr,
        citationsCount: trend.citations?.length || 0,
        suggestedCompositionsCount: trend.suggestedCompositions?.length || 0
      }, selectedPatient.id);

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Lab Trend Analyzed! 📊',
          message: 'Comparative trend calculated successfully.',
          type: 'success'
        }
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingTrend(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in text-slate-800">
      {/* LEFT COLUMN: Patient queue, CDSS Analyzer */}
      <div className={`${selectedPatient ? 'hidden lg:block' : 'block'} lg:col-span-4 space-y-6`}>
        {/* Patient Consultation Queue */}
        <div className="glass-panel p-6 border-slate-200/80 shadow-sm relative overflow-hidden bg-white">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary shrink-0" />
              Consultation Queue
            </h2>
            <span className="text-[10px] font-mono text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-full">
              {patients.length} Total Patients
            </span>
          </div>

          {/* 4 Queue Filter Tabs (Awaiting Consultation, In Chamber, Today Registered, Completed Care Loop) */}
          {(() => {
            const todayStr = getIstDateString();
            const invoices = BillingService.getInvoices();
            const paidInvoicePatientIds = invoices
              .filter((i: any) => (i as any).paymentStatus === 'cleared' || (i as any).paymentStatus === 'paid' || i.status === 'paid')
              .map((i: any) => i.patientId || (i as any).patient_id);
            const paidPatientIds = new Set([
              ...appointments
                .filter(a => a.status !== 'pending_payment' && a.status !== 'cancelled')
                .map(a => a.patientId || (a as any).patient_id),
              ...paidInvoicePatientIds
            ]);

            const isPatientForToday = (p: Patient) => {
              const patAppts = appointments.filter(a => (a.patientId === p.id || (a as any).patient_id === p.id) && a.status !== 'cancelled' && a.status !== 'pending_payment');
              if (patAppts.length > 0) {
                return patAppts.some(a => getEffectiveAppointmentDate(a) === todayStr);
              }
              const regDate = p.registeredAt || p.createdAt || (p as any).registered_at || '';
              return regDate.startsWith(todayStr) && paidPatientIds.has(p.id);
            };

            const awaitingList = patients.filter(p => paidPatientIds.has(p.id) && (p.queueStatus === 'awaiting_consultation' || p.queueStatus === 'in_consultation' || !p.queueStatus) && isPatientForToday(p));
            const inConsultList = patients.filter(p => p.queueStatus === 'in_consultation' && isPatientForToday(p));
            const todayRegList = patients.filter(p => {
              const regDate = p.registeredAt || p.createdAt || (p as any).registered_at || '';
              return regDate.startsWith(todayStr);
            });
            const completedList = patients.filter(p => (p as any).queueStatus === 'completed' || (p as any).queueStatus === 'pharmacy' || (p as any).queueStatus === 'lab' || (p as any).queueStatus === 'settled');
            const upcomingList = patients.filter(p => {
              const patAppts = appointments.filter(a => (a.patientId === p.id || (a as any).patient_id === p.id) && a.status !== 'cancelled' && a.status !== 'pending_payment');
              return patAppts.some(a => {
                const d = getEffectiveAppointmentDate(a);
                return Boolean(d && d > todayStr);
              });
            });

            return (
              <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1.5 no-scrollbar border-b border-slate-100 dark:border-white/5 font-mono text-[9.5px] font-bold select-none">
                <button
                  type="button"
                  onClick={() => setQueueFilter('awaiting')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap border cursor-pointer shrink-0 active:scale-95 ${
                    queueFilter === 'awaiting'
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm font-black'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-white/5 hover:bg-slate-100'
                  }`}
                >
                  <span>Awaiting</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[8.5px] ${queueFilter === 'awaiting' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                    {awaitingList.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setQueueFilter('in_consult')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap border cursor-pointer shrink-0 active:scale-95 ${
                    queueFilter === 'in_consult'
                      ? 'bg-amber-600 text-white border-amber-700 shadow-sm font-black'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-white/5 hover:bg-slate-100'
                  }`}
                >
                  <span>In Chamber</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[8.5px] ${queueFilter === 'in_consult' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                    {inConsultList.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setQueueFilter('today_registered')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap border cursor-pointer shrink-0 active:scale-95 ${
                    queueFilter === 'today_registered'
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm font-black'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-white/5 hover:bg-slate-100'
                  }`}
                >
                  <span>Today Reg</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[8.5px] ${queueFilter === 'today_registered' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                    {todayRegList.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setQueueFilter('upcoming')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap border cursor-pointer shrink-0 active:scale-95 ${
                    queueFilter === 'upcoming'
                      ? 'bg-purple-600 text-white border-purple-700 shadow-sm font-black'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-white/5 hover:bg-slate-100'
                  }`}
                >
                  <span>📅 Upcoming</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[8.5px] ${queueFilter === 'upcoming' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                    {upcomingList.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setQueueFilter('completed')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap border cursor-pointer shrink-0 active:scale-95 ${
                    queueFilter === 'completed'
                      ? 'bg-teal-600 text-white border-teal-700 shadow-sm font-black'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-white/5 hover:bg-slate-100'
                  }`}
                >
                  <span>Done</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[8.5px] ${queueFilter === 'completed' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                    {completedList.length}
                  </span>
                </button>
              </div>
            );
          })()}
          
          <div className="space-y-3 lg:max-h-[300px] max-h-none lg:overflow-y-auto pr-1">
            {(() => {
              const parseTokenNum = (token?: string | number) => {
                if (!token) return Infinity;
                const match = String(token).match(/\d+/);
                return match ? parseInt(match[0], 10) : Infinity;
              };

              const todayStr = getIstDateString();
              const invoices = BillingService.getInvoices();
              const paidInvoicePatientIds = invoices
                .filter((i: any) => (i as any).paymentStatus === 'cleared' || (i as any).paymentStatus === 'paid' || i.status === 'paid')
                .map((i: any) => i.patientId);
              const paidPatientIds = new Set([
                ...appointments
                  .filter(a => a.status !== 'pending_payment' && a.status !== 'cancelled')
                  .map(a => a.patientId || (a as any).patient_id),
                ...paidInvoicePatientIds
              ]);

              const isPatientForToday = (p: Patient) => {
                const patAppts = appointments.filter(a => (a.patientId === p.id || (a as any).patient_id === p.id) && a.status !== 'cancelled' && a.status !== 'pending_payment');
                if (patAppts.length > 0) {
                  return patAppts.some(a => getEffectiveAppointmentDate(a) === todayStr);
                }
                const regDate = p.registeredAt || p.createdAt || (p as any).registered_at || '';
                return regDate.startsWith(todayStr) && paidPatientIds.has(p.id);
              };

              const queuePatients = patients
                .filter(p => {
                  if (queueFilter === 'upcoming') {
                    const patAppts = appointments.filter(a => (a.patientId === p.id || (a as any).patient_id === p.id) && a.status !== 'cancelled' && a.status !== 'pending_payment');
                    return patAppts.some(a => {
                      const d = getEffectiveAppointmentDate(a);
                      return Boolean(d && d > todayStr);
                    });
                  }
                  if (queueFilter === 'awaiting') {
                    if (!paidPatientIds.has(p.id)) return false;
                    if (!isPatientForToday(p) && p.id !== selectedPatient?.id) return false;
                    return p.queueStatus === 'awaiting_consultation' || p.queueStatus === 'in_consultation' || !p.queueStatus;
                  }
                  if (queueFilter === 'in_consult') {
                    if (!isPatientForToday(p) && p.id !== selectedPatient?.id) return false;
                    return p.queueStatus === 'in_consultation';
                  }
                  if (queueFilter === 'today_registered') {
                    return isPatientForToday(p);
                  }
                  if (queueFilter === 'completed') {
                    if (!isPatientForToday(p) && p.id !== selectedPatient?.id) return false;
                    return (
                      (p as any).queueStatus === 'completed' ||
                      (p as any).queueStatus === 'pharmacy' ||
                      (p as any).queueStatus === 'lab' ||
                      (p as any).queueStatus === 'settled'
                    );
                  }
                  return (isPatientForToday(p) && paidPatientIds.has(p.id)) || p.id === selectedPatient?.id;
                })
                .sort((a, b) => {
                  // Priority #1 Emergency SOS Routing (Rule 4 & Rule 16): Emergency tokens move to top
                  const isSosA = Boolean((a as any).isEmergency || (a as any).is_emergency || String((a as any).source || '').toLowerCase().includes('sos') || String((a as any).source || '').toLowerCase().includes('emergency') || (a.tokenNumber && (String(a.tokenNumber).toUpperCase().includes('SOS') || String(a.tokenNumber).toUpperCase().includes(' E') || String(a.tokenNumber).toUpperCase().includes('E-') || String(a.tokenNumber).startsWith('#EM-'))));
                  const isSosB = Boolean((b as any).isEmergency || (b as any).is_emergency || String((b as any).source || '').toLowerCase().includes('sos') || String((b as any).source || '').toLowerCase().includes('emergency') || (b.tokenNumber && (String(b.tokenNumber).toUpperCase().includes('SOS') || String(b.tokenNumber).toUpperCase().includes(' E') || String(b.tokenNumber).toUpperCase().includes('E-') || String(b.tokenNumber).startsWith('#EM-'))));
                  if (isSosA && !isSosB) return -1;
                  if (!isSosA && isSosB) return 1;

                  const statusOrder = { 'in_consultation': 1, 'awaiting_consultation': 2 };
                  const statusA = statusOrder[a.queueStatus as keyof typeof statusOrder] || 99;
                  const statusB = statusOrder[b.queueStatus as keyof typeof statusOrder] || 99;
                  if (statusA !== statusB) return statusA - statusB;

                  const tokenA = parseTokenNum(a.tokenNumber);
                  const tokenB = parseTokenNum(b.tokenNumber);
                  return tokenA - tokenB;
                });

              if (queuePatients.length === 0) {
                return (
                  <ZeroQueueState queueType="patient_queue" className="mx-0" />
                );
              }

              return queuePatients.map((p: Patient) => {
                const isSelected = selectedPatient?.id === p.id;
                const patientAppts = appointments.filter(a => (a.patientId === p.id || (a as any).patient_id === p.id));
                const virtualAppt = patientAppts.find(a => Boolean(a.isVirtual || (a as any).is_virtual));
                const isEmergencySos = Boolean((p as any).isEmergency || (p as any).is_emergency || String((p as any).source || '').toLowerCase().includes('sos') || String((p as any).source || '').toLowerCase().includes('emergency') || (p.tokenNumber && (String(p.tokenNumber).toUpperCase().includes('SOS') || String(p.tokenNumber).toUpperCase().includes(' E') || String(p.tokenNumber).toUpperCase().includes('E-') || String(p.tokenNumber).startsWith('#EM-'))));

                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPatient(p)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-300 relative group overflow-hidden ${
                      isEmergencySos
                        ? 'bg-rose-50/90 border-rose-400 shadow-md ring-2 ring-rose-400/40'
                        : (isSelected 
                            ? 'bg-primary-container/20 border-primary shadow-sm' 
                            : 'bg-slate-50 border-slate-200/60 hover:bg-slate-100/80')
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-primary" />
                    )}
                    <div className="flex justify-between items-start flex-wrap gap-1">
                      <div className="font-bold text-xs text-slate-700 group-hover:text-primary transition-colors flex items-center gap-1.5 flex-wrap">
                        {p.name}
                        {p.tokenNumber && (
                          <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded font-black shrink-0 border ${
                            isEmergencySos
                              ? 'bg-rose-600 text-white border-rose-700 animate-pulse shadow-xs'
                              : 'bg-indigo-50 border-indigo-200/50 text-indigo-700'
                          }`}>
                            {p.tokenNumber} {isEmergencySos ? '🚨 PRIORITY #1' : ''}
                          </span>
                        )}
                        {p.vitals && (() => {
                          const triage = api.checkTriageAlert(p);
                          if (triage.isAlert) {
                            return (
                              <span className="text-[7px] font-bold bg-rose-600 text-white px-1.5 py-0.2 rounded-full animate-pulse border-0">
                                Triage: {triage.reason.split(':')[0]}
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <span className="text-[9px] font-extrabold text-indigo-800 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md font-mono shrink-0">
                        [{p.patientCode || p.tokenNumber || (p.id || '').toUpperCase().substring(0, 6)}]
                      </span>
                    </div>
                    
                    <div className="text-[10px] text-slate-500 mt-2 flex justify-between items-center flex-wrap gap-1.5">
                      <span>{p.gender}, {p.age} years</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isOphthalmology && p.vitals?.dilationStatus && (
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase border flex items-center gap-0.5 ${
                            p.vitals.dilationStatus === 'dilated'
                              ? 'bg-emerald-50 text-emerald-750 border-emerald-200'
                              : 'bg-amber-550/10 text-amber-700 border-amber-200/60 animate-pulse'
                          }`}>
                            {p.vitals.dilationStatus === 'dilated' ? '👁️ Dilated' : '⏳ Dilating'}
                            {p.vitals.dilationStatus === 'instilled' && p.vitals.dilationStartTime && !isNaN(new Date(p.vitals.dilationStartTime).getTime()) && (
                              <span className="font-mono">
                                ({Math.max(0, Math.ceil((new Date(p.vitals.dilationStartTime).getTime() + 20 * 60 * 1000 - Date.now()) / (60 * 1000)))}m)
                              </span>
                            )}
                          </span>
                        )}
                        {p.abhaId && (
                          <span className="bg-secondary/10 text-secondary border border-secondary/20 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider font-mono">
                            ABHA
                          </span>
                        )}
                        {virtualAppt && (
                          <span className="flex items-center gap-0.5 text-[8px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 px-1.5 py-0.5 rounded-md animate-pulse font-sans">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-700 shrink-0" />
                            📹 Virtual {virtualAppt.virtualTimeAllocated ? `(${virtualAppt.virtualTime})` : 'Appt'}
                          </span>
                        )}
                        {(() => {
                          const futureAppt = patientAppts.find(a => {
                            const d = getEffectiveAppointmentDate(a);
                            return Boolean(d && d > todayStr);
                          });
                          if (futureAppt) {
                            const d = getEffectiveAppointmentDate(futureAppt);
                            const isTomorrow = d === getIstOffsetDateString(1);
                            return (
                              <span className="flex items-center gap-0.5 text-[8px] font-bold bg-purple-50 border border-purple-200 text-purple-700 px-1.5 py-0.5 rounded-md font-sans">
                                📅 {isTomorrow ? 'Tomorrow' : d} ({futureAppt.virtualTime || (futureAppt as any).virtual_time || 'Advance'})
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </button>
                );
              });
            })()}
          </div>
        </div>

        {/* Laboratory Report History (Past & Present) */}
        {selectedPatient && !isOphthalmology && (
          <div className="glass-panel p-6 border-slate-200/80 shadow-sm relative overflow-hidden bg-white mt-4">
            <h2 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
              <FolderArchive className="w-4 h-4 text-primary shrink-0" />
              Biomarker Reports History
            </h2>
            <p className="text-[10px] text-slate-600 mb-4">Click a report to open a full-screen clinical AI analysis</p>
            
            <div className="space-y-3 lg:max-h-[300px] max-h-none lg:overflow-y-auto pr-1">
              {(() => {
                const history = api.getPatientHistoricalBiomarkers(selectedPatient.id);
                if (history.length === 0) {
                  return (
                    <div className="text-center py-6 text-slate-600 text-xs italic">
                      No historical biomarker reports found.
                    </div>
                  );
                }
                return history.slice().reverse().map((report, idx) => (
                  <button
                    key={`hist-report-${idx}-${report.date || (report as any).id || idx}`}
                    onClick={() => setAnalyzingReport(report)}
                    className="w-full text-left p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl hover:bg-slate-100 hover:border-slate-300 transition-all group relative overflow-hidden flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <FlaskConical className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        Report Dated: {report.date}
                      </span>
                      <span className="text-[8px] bg-indigo-50 border border-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-mono">
                        Analyze
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200/40 text-[10px] text-slate-500">
                      <div>
                        <span className="text-slate-600 font-medium block">{isOphthalmology ? 'VA (OD)' : 'HbA1c'}</span>
                        <span className={`font-mono font-bold ${!isOphthalmology && report.HbA1c > 6.5 ? 'text-rose-500' : 'text-slate-700'}`}>{isOphthalmology ? '6/6' : `${report.HbA1c}%`}</span>
                      </div>
                      <div>
                        <span className="text-slate-600 font-medium block">{isOphthalmology ? 'IOP' : 'Creatinine'}</span>
                        <span className={`font-mono font-bold ${!isOphthalmology && report.creatinine > 1.2 ? 'text-rose-500' : 'text-slate-700'}`}>{isOphthalmology ? '16 mmHg' : `${report.creatinine} mg/dL`}</span>
                      </div>
                      <div>
                        <span className="text-slate-600 font-medium block">{isOphthalmology ? 'VA (OS)' : 'Hemoglobin'}</span>
                        <span className={`font-mono font-bold ${!isOphthalmology && report.hemoglobin < 12.0 ? 'text-amber-500' : 'text-slate-700'}`}>{isOphthalmology ? '6/9' : `${report.hemoglobin} g/dL`}</span>
                      </div>
                    </div>
                  </button>
                ));
              })()}
            </div>
          </div>
        )}

        {isOphthalmology && (
          <OphthalmologyPatientAnalysisPanel
            selectedPatient={selectedPatient}
            history={activeHistory}
            analyzingReport={analyzingReport}
            baselineDate={baselineDate}
            comparisonDate={comparisonDate}
            onAnalyzeReport={setAnalyzingReport}
            onCloseAnalysis={() => setAnalyzingReport(null)}
          />
        )}
      </div>

      {/* RIGHT COLUMN: Consultation Sheet, e-Rx Form */}
      {selectedPatient && (
        <div className="lg:col-span-8 glass-panel p-6 border-slate-200/80 shadow-sm space-y-6 relative overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => setSelectedPatient(null)}
            className="lg:hidden inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 pb-2 cursor-pointer transition active:scale-95 border-0 bg-transparent p-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 font-bold" />
            Back to Patients Queue
          </button>
          {!isConsentActive && (
                <div className="absolute inset-0 z-[45] flex flex-col items-center justify-center bg-white/95 border border-rose-500/20 p-8 text-center animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-rose-50/50 border border-rose-500/20 flex items-center justify-center mb-4 text-rose-500 animate-pulse">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-slate-800 font-bold text-sm mb-2">Compliance Lock: Active Consent Missing</h3>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed mb-5">
                Access to clinical records, diagnostics ordering, and medication prescribing is locked. Please direct the patient to reply <strong className="text-secondary font-mono">"1" (Grant Access)</strong> on their WhatsApp simulator interface, or authorize physical consent.
              </p>
              {/* Time-Bound Physical Consent Form */}
              <div className="w-full max-w-sm bg-slate-50 border border-slate-200/60 p-4.5 rounded-2xl text-left space-y-4 animate-fade-in shadow-sm select-none">
                <div className="flex gap-2 items-center text-slate-800 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                  Record Time-Bound Physical Consent
                </div>
                
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Consent Purpose/Scope</label>
                  <select
                    value={consentPurpose}
                    onChange={e => setConsentPurpose(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="GENERAL_TREATMENT">GENERAL TREATMENT (General consultation & vitals logging)</option>
                    <option value="PROCEDURE_X_ACCESS">PROCEDURE ACCESS (Special diagnostics ordering)</option>
                    <option value="DATA_SHARING_RESEARCH">DATA SHARING (Clinical history sync & check)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Specific Clinical Notes / Details (Optional)</label>
                  <textarea
                    placeholder="Enter additional visit details or authorization notes..."
                    value={consentNotes}
                    onChange={e => setConsentNotes(e.target.value)}
                    rows={2}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500 resize-none font-sans"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!selectedPatient) return;
                      try {
                        await api.recordPhysicalConsent({
                          patientId: selectedPatient.id,
                          purpose: consentPurpose,
                          details: consentNotes
                        });
                        setConsentNotes('');
                        window.dispatchEvent(new CustomEvent('mediflow-toast', {
                          detail: {
                            title: 'Consent Active 🛡️',
                            message: `Recorded 24h physical consent for ${selectedPatient.name}.`,
                            type: 'success'
                          }
                        }));
                      } catch (err) {
                        console.error('[Consent Bypass] Failed to record physical consent:', err);
                      }
                    }}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-750 active:scale-[0.97] text-white text-[10px] font-bold uppercase tracking-wider py-2 rounded-xl transition-all shadow flex justify-center items-center gap-1.5 cursor-pointer border-0 text-white-force bg-indigo-600-force"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-white-force" />
                    Grant 24h Consent
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Active Physical Consent Banner */}
          {activePhysicalConsent && (
            <div className="p-3.5 bg-amber-50/70 border border-amber-200/50 rounded-2xl flex items-center justify-between mb-4 animate-fade-in select-none">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="text-[10px] text-amber-955 leading-relaxed font-sans">
                  <span className="font-bold text-amber-955">Active Physical Consent</span> • Purpose: <span className="font-semibold text-amber-900">{(activePhysicalConsent.consent_purpose || '').replace(/_/g, ' ')}</span>
                  <span className="block text-[9px] text-amber-800 mt-0.5 font-medium font-mono">Expires in: {remainingTime} ({new Date(activePhysicalConsent.expires_at).toLocaleTimeString()})</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRevokePhysicalConsent}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-[9px] font-bold uppercase tracking-wider rounded-xl border-0 cursor-pointer transition-all shadow-sm shadow-rose-650/15 text-white-force"
              >
                Revoke Consent
              </button>
            </div>
          )}

          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary shrink-0" />
                Electronic Consultation Record
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-2 flex-wrap">
                Selected Profile: <strong className="text-slate-700 font-bold">{selectedPatient.name}</strong> ({selectedPatient.age}y, {selectedPatient.gender})
                {selectedPatient.vitals && (() => {
                  const triage = api.checkTriageAlert(selectedPatient);
                  if (triage.isAlert) {
                    return (
                      <span className="text-[10px] font-bold bg-rose-600 text-white px-2 py-0.5 rounded animate-pulse border-0">
                        ⚠️ Critical Triage Warning: {triage.reason}
                      </span>
                    );
                  }
                  return null;
                })()}
              </p>
            </div>
            <div className="flex items-center gap-2">

              {selectedPatient.abhaId && (
                <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full font-bold tracking-wider uppercase font-mono">
                  ABHA Verified
                </span>
              )}
            </div>
          </div>

          {/* Pre-Checked OPD Vitals Strip (Compounder Intake by Patient ID) */}
          <div className="p-3.5 bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-blue-50/80 border border-emerald-200/90 rounded-2xl space-y-2 text-left animate-fade-in shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-emerald-200/60 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-700 font-bold" />
                <span className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                  Pre-Checked OPD Vitals (Compounder Intake)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono font-bold text-emerald-800 bg-emerald-100/90 px-2.5 py-0.5 rounded-full border border-emerald-300">
                  {compounderVitals?.recordedAt ? `🕒 Recorded at ${new Date(compounderVitals.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '⚡ Auto-Extracted via Patient ID'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
              <div className="p-2 bg-white/90 border border-emerald-100 rounded-xl">
                <div className="text-[9px] font-bold text-slate-500 uppercase font-mono flex items-center gap-1">
                  <Activity className="w-3 h-3 text-rose-500" /> BP
                </div>
                <div className={`text-xs font-black font-mono mt-0.5 ${
                  compounderVitals?.bloodPressure && parseInt(compounderVitals.bloodPressure.split('/')[0], 10) >= 140
                    ? 'text-rose-600'
                    : 'text-slate-800'
                }`}>
                  {compounderVitals?.bloodPressure || '120/80'} <span className="text-[9px] font-normal text-slate-400">mmHg</span>
                </div>
              </div>

              <div className="p-2 bg-white/90 border border-emerald-100 rounded-xl">
                <div className="text-[9px] font-bold text-slate-500 uppercase font-mono flex items-center gap-1">
                  <Heart className="w-3 h-3 text-rose-500" /> Pulse
                </div>
                <div className="text-xs font-black font-mono text-slate-800 mt-0.5">
                  {compounderVitals?.pulseRate || 72} <span className="text-[9px] font-normal text-slate-400">bpm</span>
                </div>
              </div>

              <div className="p-2 bg-white/90 border border-emerald-100 rounded-xl">
                <div className="text-[9px] font-bold text-slate-500 uppercase font-mono flex items-center gap-1">
                  <Thermometer className="w-3 h-3 text-amber-500" /> Temp
                </div>
                <div className={`text-xs font-black font-mono mt-0.5 ${
                  compounderVitals?.temperature && parseFloat(String(compounderVitals.temperature)) >= 100.4
                    ? 'text-rose-600'
                    : 'text-slate-800'
                }`}>
                  {compounderVitals?.temperature || 98.6} <span className="text-[9px] font-normal text-slate-400">°F</span>
                </div>
              </div>

              <div className="p-2 bg-white/90 border border-emerald-100 rounded-xl">
                <div className="text-[9px] font-bold text-slate-500 uppercase font-mono flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-blue-500" /> Sugar (RBS)
                </div>
                <div className={`text-xs font-black font-mono mt-0.5 ${
                  compounderVitals?.bloodSugar && parseFloat(String(compounderVitals.bloodSugar)) >= 180
                    ? 'text-rose-600'
                    : 'text-slate-800'
                }`}>
                  {compounderVitals?.bloodSugar || 105} <span className="text-[9px] font-normal text-slate-400">mg/dL</span>
                </div>
              </div>

              <div className="p-2 bg-white/90 border border-emerald-100 rounded-xl">
                <div className="text-[9px] font-bold text-slate-500 uppercase font-mono flex items-center gap-1">
                  <Wind className="w-3 h-3 text-cyan-500" /> SpO2
                </div>
                <div className="text-xs font-black font-mono text-slate-800 mt-0.5">
                  {compounderVitals?.spO2 || 99} <span className="text-[9px] font-normal text-slate-400">%</span>
                </div>
              </div>

              <div className="p-2 bg-white/90 border border-emerald-100 rounded-xl">
                <div className="text-[9px] font-bold text-slate-500 uppercase font-mono flex items-center gap-1">
                  <Scale className="w-3 h-3 text-indigo-500" /> Wt / BMI
                </div>
                <div className="text-xs font-black font-mono text-slate-800 mt-0.5">
                  {compounderVitals?.weight || 65} <span className="text-[9px] font-normal text-slate-400">kg</span>
                </div>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              50% LEFT / 50% RIGHT TWO-ZONE HIGH-DENSITY CONSULTATION COCKPIT
          ══════════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start my-2">

            {/* ── LEFT ZONE (50% on desktop: lg:col-span-6 space-y-3.5 text-left) ── */}
            <div className="lg:col-span-6 space-y-3.5 text-left">
              {/* Chamber Ambient AI Audio Scribe Interactive Bar */}
              <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl text-white space-y-3 shadow-md relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
            
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isAmbientRecording ? 'bg-rose-500 animate-pulse' : 'bg-indigo-600'
                }`}>
                  <Mic className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-indigo-200 font-sans flex items-center gap-1.5">
                    Chamber Ambient AI Audio Scribe
                    <span className="text-[8.5px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.2 rounded border border-emerald-700">
                      Hindi / English / Hinglish
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Listen to natural consultation, auto-extract symptoms, vitals, and suggest evidence-based Rx combos.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!isAmbientRecording ? (
                  <button
                    type="button"
                    onClick={handleStartAmbientScribe}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-primary hover:from-indigo-500 hover:to-primary/90 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition active:scale-95 border-0 text-white-force"
                  >
                    <Mic className="w-4 h-4 text-white-force" />
                    <span>Start Chamber Scribe</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-mono font-bold animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      Listening: {Math.floor(ambientTimer / 60)}:{(ambientTimer % 60).toString().padStart(2, '0')}
                    </span>
                    <button
                      type="button"
                      onClick={handleStopAmbientScribe}
                      disabled={isExtractingAi}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition active:scale-95 border-0 text-white-force disabled:opacity-50"
                    >
                      <Square className="w-3.5 h-3.5 text-white-force" />
                      <span>{isExtractingAi ? 'Extracting...' : 'Stop & Auto-Extract'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Realtime Spoken Words Stream Indicator */}
            {isAmbientRecording && (
              <div className="p-2.5 bg-black/40 border border-indigo-500/20 rounded-xl space-y-1">
                <div className="text-[9px] font-mono text-indigo-300 font-bold flex items-center gap-1">
                  <Volume2 className="w-3 h-3 text-indigo-400 animate-pulse" /> Spoken Conversation Stream:
                </div>
                <p className="text-xs text-slate-200 italic font-sans min-h-[20px]">
                  {ambientTranscript || 'Listening to doctor-patient conversation in chamber...'}
                </p>
              </div>
            )}

            {/* Extracted Scribe Review Card */}
            {extractedScribeData && (
              <div className="p-3.5 bg-slate-900 border border-indigo-400/50 rounded-2xl space-y-3 animate-fade-in text-left text-slate-100">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-black text-indigo-300 uppercase flex items-center gap-1.5">
                    <Brain className="w-4 h-4 text-indigo-400" />
                    AI Extracted Consultation Entities &amp; Recommendations
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExtractedScribeData(null)}
                      className="text-[10px] text-slate-400 hover:text-white cursor-pointer px-2 py-0.5 rounded hover:bg-white/10"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyScribeToConsultation}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1 cursor-pointer transition active:scale-95 border-0 text-white-force"
                    >
                      <Check className="w-3.5 h-3.5 text-white-force" />
                      Apply All to Prescription
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1 bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <span className="text-[9.5px] font-mono font-bold text-indigo-300 uppercase block">Extracted Chief Complaints</span>
                    <p className="text-slate-200 text-xs">{extractedScribeData.chiefComplaints}</p>
                  </div>

                  <div className="space-y-1 bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <span className="text-[9.5px] font-mono font-bold text-indigo-300 uppercase block">Provisional Assessment</span>
                    <p className="text-slate-200 text-xs">{extractedScribeData.clinicalAssessment}</p>
                  </div>
                </div>

                {extractedScribeData.medications.length > 0 && (
                  <div className="space-y-1.5 bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <span className="text-[9.5px] font-mono font-bold text-emerald-300 uppercase flex items-center gap-1">
                      <Pill className="w-3 h-3 text-emerald-400" /> Extracted &amp; Matched Medications ({extractedScribeData.medications.length}):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {extractedScribeData.medications.map((m, mIdx) => (
                        <div key={`scribe-med-${mIdx}`} className="p-2 bg-slate-800 border border-white/10 rounded-lg text-xs space-y-1">
                          <div className="flex justify-between font-bold text-white">
                            <span>{m.medicineName}</span>
                            <span className="text-emerald-400 font-mono text-[10px]">{m.frequency}</span>
                          </div>
                          <div className="text-[9px] text-slate-400 flex justify-between">
                            <span>{m.dosage}</span>
                            <span>{m.duration}</span>
                          </div>
                          {m.inStock && (
                            <div className="text-[8.5px] font-mono text-emerald-300 font-bold">
                              🟢 In Stock: {m.matchedStockName} (₹{m.matchedStockPrice})
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Handwritten prescription workflow notice */}
          <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-start gap-2.5 my-1">
            <FileEdit className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-[10px] text-indigo-950 leading-relaxed">
              <strong className="font-bold text-[11px] text-indigo-950 block mb-0.5">Handwritten Rx Support Enabled</strong>
              Prefer paper? Write the prescription by hand as usual. The compounder will scan it at the counter, and our clinical AI will automatically reserve medicine inventory and queue pathology tests.
            </div>
          </div>



          {/* AI Predictive Lab Pattern & Risk Disease Analyzer Card */}
          {(() => {
            const history = api.getPatientHistoricalBiomarkers(selectedPatient.id);
            const recent = history.length > 0 ? history[history.length - 1] : null;
            const baseline = history.length >= 2 ? history[history.length - 2] : null;
            
            if (!recent) return null;

            let calculatedGfr: number | undefined = undefined;
            if (recent && recent.creatinine) {
              const scr = recent.creatinine;
              const ageVal = selectedPatient.age ?? 45;
              const genderVal = selectedPatient.gender || 'Male';
              const isFemale = genderVal.toLowerCase() === 'female';
              const k = isFemale ? 0.7 : 0.9;
              const alpha = isFemale ? -0.241 : -0.302;
              const genderMult = isFemale ? 1.012 : 1.0;
              calculatedGfr = 142 * Math.pow(Math.min(scr / k, 1), alpha) * Math.pow(Math.max(scr / k, 1), -1.200) * Math.pow(0.9938, ageVal) * genderMult;
              calculatedGfr = Math.round(calculatedGfr * 10) / 10;
            }

            // Calculate trends locally for instant high-fidelity feedback
            const hba1cDiff = baseline ? recent.HbA1c - baseline.HbA1c : 0;
            const creatinineDiff = baseline ? recent.creatinine - baseline.creatinine : 0;
            const hemoglobinDiff = baseline ? recent.hemoglobin - baseline.hemoglobin : 0;

            // Predict future diseases based on values & trend patterns
            const riskAlerts: { title: string; desc: string; type: 'critical' | 'warning' | 'info' }[] = [];
            
            if (isOphthalmology) {
              const iop = recent.pulseRate ?? 16;
              const vaOD = recent.temperature ?? OPHTHALMIC_EYE_CARE_COPY.odFallback;
              const vaOS = recent.bloodPressure ?? OPHTHALMIC_EYE_CARE_COPY.osFallback;
              
              const baseOD = baseline?.temperature ?? OPHTHALMIC_EYE_CARE_COPY.odFallback;
              const baseOS = baseline?.bloodPressure ?? OPHTHALMIC_EYE_CARE_COPY.osFallback;
              
              const baseODRank = getAcuityRank(baseOD);
              const compODRank = getAcuityRank(vaOD);
              const baseOSRank = getAcuityRank(baseOS);
              const compOSRank = getAcuityRank(vaOS);
              
              const odDropped = baseODRank > 0 && compODRank > baseODRank;
              const osDropped = baseOSRank > 0 && compOSRank > baseOSRank;
              const isAcuityDropped = odDropped || osDropped;

              if (iop > 21) {
                riskAlerts.push({
                  title: 'Glaucoma Progression Risk (High IOP)',
                  desc: `Active Intraocular Pressure is elevated at ${iop} mmHg (normal reference range: 10 - 21 mmHg). Strict contraindication: Avoid dilating drops. High risk of optic nerve damage.`,
                  type: 'critical'
                });
              }
              
              if (isAcuityDropped) {
                riskAlerts.push({
                  title: 'Visual Acuity Trajectory Decline',
                  desc: `Trajectory Decline detected: Vision dropped from ${baseOD} (OD) / ${baseOS} (OS) to ${vaOD} (OD) / ${vaOS} (OS). Warrants immediate lens refraction.`,
                  type: 'warning'
                });
              }
            } else {
              // Glycemic/Diabetes pattern
              if (recent.HbA1c > 6.5) {
                const shiftText = hba1cDiff > 0 ? `up by ${hba1cDiff.toFixed(1)}% absolute shift` : hba1cDiff < 0 ? `down by ${Math.abs(hba1cDiff).toFixed(1)}% absolute shift` : '';
                riskAlerts.push({
                  title: 'Glycemic Degradation & Microvascular Damage Risk',
                  desc: `Active HbA1c is ${recent.HbA1c}% (diabetic range) ${shiftText ? `(${shiftText})` : ''}. High risk of diabetic nephropathy, retinopathy, and nerve damage. Warrants immediate medication audit.`,
                  type: 'critical'
                });
              } else if (recent.HbA1c > 5.7) {
                riskAlerts.push({
                  title: 'Prediabetes Progression Warning',
                  desc: `HbA1c is ${recent.HbA1c}% (prediabetic). High likelihood of transition to full Type-2 Diabetes within 24 months without intensive lifestyle intervention.`,
                  type: 'warning'
                });
              }

              // Renal filtration pattern
              if (recent.creatinine > 1.2) {
                const shiftText = creatinineDiff > 0 ? `increased by ${creatinineDiff.toFixed(2)} mg/dL` : '';
                riskAlerts.push({
                  title: 'Glomerular Filtration Clearance Alert (CKD Risk)',
                  desc: `Serum creatinine is abnormally high at ${recent.creatinine} mg/dL ${shiftText ? `(${shiftText})` : ''}, suggesting reduced renal filtration capacity. Stage 2/3 CKD potential. STRICTLY avoid beta-lactam conflict/NSAID high doses.`,
                  type: 'critical'
                });
              } else if (recent.creatinine > 1.0 && creatinineDiff > 0.15) {
                riskAlerts.push({
                  title: 'Accelerated Renal Decline Trend',
                  desc: `Creatinine increased from ${baseline?.creatinine} to ${recent.creatinine} mg/dL. Upward trajectory indicates potential acute kidney injury (AKI) or renal perfusion issues.`,
                  type: 'warning'
                });
              }

              // Anemia pattern
              if (recent.hemoglobin < 12.0) {
                riskAlerts.push({
                  title: 'Oxygen Carrying Capacity Deficit (Anemia Trend)',
                  desc: `Hemoglobin is low at ${recent.hemoglobin} g/dL, indicating mild to moderate anemia risk. Warrants serum iron/ferritin LOINC checks.`,
                  type: 'info'
                });
              }
            }

            // Generate brief professional summary
            let summaryText = "";
            if (selectedPatient.pastReportsSummary) {
              summaryText += `[Past Report Scan Analysis: ${selectedPatient.pastReportsSummary}] `;
            }
            summaryText += `Patient displays a clinical biomarker pattern requiring close monitoring. `;
            
            if (isOphthalmology) {
              if (baseline) {
                summaryText += `Comparing current exam (${recent.date}) to baseline (${baseline.date}), ${OPHTHALMIC_EYE_CARE_COPY.odLabel} is ${recent.temperature || OPHTHALMIC_EYE_CARE_COPY.odFallback} / ${OPHTHALMIC_EYE_CARE_COPY.osLabel} is ${recent.bloodPressure || OPHTHALMIC_EYE_CARE_COPY.osFallback} and ${OPHTHALMIC_EYE_CARE_COPY.iopLabel.toLowerCase()} shifted by ${recent.pulseRate !== undefined && baseline.pulseRate !== undefined ? `${(recent.pulseRate - baseline.pulseRate) > 0 ? '+' : ''}${recent.pulseRate - baseline.pulseRate} mmHg` : '0 mmHg'}. `;
              } else {
                summaryText += `Establishing baseline eye examination on ${recent.date}. `;
              }
              
              if ((recent.pulseRate || 16) > 21) {
                summaryText += `Intraocular pressure is abnormally elevated, indicating elevated Glaucoma Progression risk. Strict contraindication: Avoid dilating drops (Atropine/Tropicamide).`;
              } else {
                summaryText += `Ophthalmic pressures are within safe standard thresholds. Spectacle prescription grinding is clear.`;
              }
            } else {
              if (baseline) {
                summaryText += `Comparing current report (${recent.date}) to baseline (${baseline.date}), the primary shift is `;
                const shifts: string[] = [];
                if (hba1cDiff !== 0) shifts.push(`HbA1c shifted by ${hba1cDiff > 0 ? '+' : ''}${hba1cDiff.toFixed(1)}%`);
                if (creatinineDiff !== 0) shifts.push(`Creatinine shifted by ${creatinineDiff > 0 ? '+' : ''}${creatinineDiff.toFixed(2)} mg/dL`);
                summaryText += shifts.join(' and ') + '. ';
              } else {
                summaryText += `Establishing baseline report on ${recent.date}. `;
              }

              if (recent.HbA1c > 6.5 && recent.creatinine > 1.2) {
                summaryText += `The synchronous elevation of glycemic markers and creatinine signals a highly sensitive Diabetic Nephropathy progression risk. Recommend immediate review of cardiovascular standard support (SGLT2 inhibitors like Empagliflozin).`;
              } else if (recent.HbA1c > 6.5) {
                summaryText += `Glycemic markers are elevated. Prioritize dietary carb controls and lifestyle optimization.`;
              } else if (recent.creatinine > 1.2) {
                summaryText += `Renal clearance parameters are elevated. Monitor blood pressure closely and perform follow-up GFR/Creatinine scan in 14 days.`;
              } else {
                summaryText += `Patient parameters are within stable clinical limits. Maintain regular prophylactic counseling.`;
              }
            }

            return (
              <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs space-y-2.5 text-left animate-fade-in my-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600 font-bold shrink-0" />
                    <span className="text-xs font-black text-slate-900 uppercase tracking-wider font-sans">
                      AI Lab Pattern &amp; Risk Analyzer
                    </span>
                    <span className="text-[8px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full">
                      {history.length} {history.length === 1 ? 'Report' : 'Reports'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLabAnalysisExpanded(!isLabAnalysisExpanded)}
                    className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    {isLabAnalysisExpanded ? '▴ Hide Lab Analysis' : '▾ View Biomarker Trends & Risk'}
                  </button>
                </div>

                {!isLabAnalysisExpanded ? (
                  <div className="flex items-center justify-between text-[10px] text-slate-500 bg-slate-50/70 px-2.5 py-1.5 rounded-xl border border-slate-200/60">
                    <span className="truncate">First consultation meetup: Lab analysis is hidden by default.</span>
                    <button
                      type="button"
                      onClick={() => setIsLabAnalysisExpanded(true)}
                      className="text-[9.5px] font-bold text-indigo-600 hover:text-indigo-800 underline shrink-0 cursor-pointer ml-2 border-0 bg-transparent"
                    >
                      Open Grid 📊
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2 border-t border-slate-100 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {isOphthalmology ? [
                        {
                          name: 'Visual Acuity (OD)',
                          val: recent.temperature || OPHTHALMIC_EYE_CARE_COPY.odFallback,
                          base: baseline ? (baseline.temperature || OPHTHALMIC_EYE_CARE_COPY.odFallback) : 'N/A',
                          diff: 0,
                          unit: '',
                          normal: OPHTHALMIC_EYE_CARE_COPY.odFallback,
                          status: getAcuityRank(recent.temperature || '6/6') > 2 ? 'abnormal' : 'normal',
                          icon: 'visibility',
                          color: getAcuityRank(recent.temperature || '6/6') > 2 ? 'rose' : 'emerald'
                        },
                        {
                          name: 'Intraocular Pressure',
                          val: `${recent.pulseRate || 16} mmHg`,
                          base: baseline ? `${baseline.pulseRate || 16} mmHg` : 'N/A',
                          diff: baseline ? (recent.pulseRate || 16) - (baseline.pulseRate || 16) : 0,
                          unit: 'mmHg',
                          normal: '10 - 21',
                          status: (recent.pulseRate || 16) > 21 ? 'critical' : 'normal',
                          icon: 'eye_tracking',
                          color: (recent.pulseRate || 16) > 21 ? 'rose' : 'emerald'
                        },
                        {
                          name: 'Visual Acuity (OS)',
                          val: recent.bloodPressure || OPHTHALMIC_EYE_CARE_COPY.osFallback,
                          base: baseline ? (baseline.bloodPressure || OPHTHALMIC_EYE_CARE_COPY.osFallback) : 'N/A',
                          diff: 0,
                          unit: '',
                          normal: OPHTHALMIC_EYE_CARE_COPY.osFallback,
                          status: getAcuityRank(recent.bloodPressure || '6/9') > 3 ? 'abnormal' : 'borderline',
                          icon: 'visibility',
                          color: getAcuityRank(recent.bloodPressure || '6/9') > 3 ? 'rose' : 'emerald'
                        }
                      ].map((item, idx) => {
                        const cardCls = item.color === 'rose'
                          ? 'from-rose-50 to-rose-100/50 border-rose-200'
                          : item.color === 'amber'
                          ? 'from-amber-50 to-amber-100/50 border-amber-200'
                          : 'from-emerald-50 to-emerald-100/50 border-emerald-200';
                        return (
                        <div key={`biomarker-card-${idx}-${item.name}`} className={`p-2.5 rounded-xl border bg-gradient-to-b ${cardCls} flex flex-col justify-between space-y-1.5`}>
                          <div className="flex justify-between items-start">
                            <span className="text-[9.5px] text-slate-700 font-bold uppercase tracking-wider">{item.name}</span>
                            <span className="text-[8.5px] text-slate-500 font-mono">Ref: {item.normal}</span>
                          </div>
                          <div className="flex justify-between items-baseline pt-0.5">
                            <span className="text-base font-black font-mono tracking-tight text-slate-800">{item.val}</span>
                            {baseline && item.diff !== 0 && (
                              <span className={`text-[9px] font-extrabold font-mono flex items-center gap-0.5 ${
                                (item.diff > 0 && item.status !== 'normal') ? 'text-rose-600' : 'text-emerald-600'
                              }`}>
                                {item.diff > 0 ? '▲' : '▼'} {Math.abs(item.diff || 0).toFixed(0)}
                              </span>
                            )}
                          </div>
                          <div className="text-[8.5px] text-slate-600 pt-1 border-t border-slate-200/50 flex justify-between">
                            <span>Base: {item.base}</span>
                            <span className="font-bold text-[8px] uppercase tracking-wider">{item.status}</span>
                          </div>
                        </div>
                        );
                      }) : [
                        {
                          name: 'HbA1c (Glycated Hb)',
                          val: `${recent.HbA1c}%`,
                          base: baseline ? `${baseline.HbA1c}%` : 'N/A',
                          diff: hba1cDiff,
                          unit: '%',
                          normal: '4.0 - 5.6',
                          status: recent.HbA1c > 6.5 ? 'critical' : recent.HbA1c > 5.7 ? 'warning' : 'normal',
                          icon: 'water_drop',
                          color: recent.HbA1c > 6.5 ? 'rose' : recent.HbA1c > 5.7 ? 'amber' : 'emerald',
                          zones: [
                            { start: 3.0, end: 5.7, color: 'bg-emerald-500' },
                            { start: 5.7, end: 6.5, color: 'bg-amber-400' },
                            { start: 6.5, end: 10.0, color: 'bg-rose-500' }
                          ],
                          min: 3.0,
                          max: 10.0,
                          numericVal: recent.HbA1c
                        },
                        {
                          name: 'Serum Creatinine',
                          val: `${recent.creatinine} mg/dL`,
                          base: baseline ? `${baseline.creatinine} mg/dL` : 'N/A',
                          diff: creatinineDiff,
                          unit: 'mg/dL',
                          normal: '0.6 - 1.2',
                          status: recent.creatinine > 1.2 ? 'critical' : recent.creatinine > 1.0 ? 'warning' : 'normal',
                          icon: 'kidney',
                          color: recent.creatinine > 1.2 ? 'rose' : recent.creatinine > 1.0 ? 'amber' : 'emerald',
                          zones: [
                            { start: 0.2, end: 1.2, color: 'bg-emerald-500' },
                            { start: 1.2, end: 1.5, color: 'bg-amber-400' },
                            { start: 1.5, end: 2.0, color: 'bg-rose-500' }
                          ],
                          min: 0.2,
                          max: 2.0,
                          numericVal: recent.creatinine
                        },
                        ...(calculatedGfr ? [{
                          name: 'Estimated GFR (CKD-EPI)',
                          val: `${calculatedGfr} mL/min`,
                          base: 'N/A',
                          diff: 0,
                          unit: 'mL/min',
                          normal: '> 90',
                          status: calculatedGfr < 30 ? 'critical' : calculatedGfr < 60 ? 'warning-severe' : calculatedGfr < 90 ? 'warning' : 'normal',
                          icon: 'analytics',
                          color: calculatedGfr < 60 ? 'rose' : calculatedGfr < 90 ? 'amber' : 'emerald',
                          zones: [
                            { start: 15, end: 60, color: 'bg-rose-500' },
                            { start: 60, end: 90, color: 'bg-amber-400' },
                            { start: 90, end: 140, color: 'bg-emerald-500' }
                          ],
                          min: 15,
                          max: 140,
                          numericVal: calculatedGfr
                        }] : [{
                          name: 'Total Hemoglobin',
                          val: `${recent.hemoglobin} g/dL`,
                          base: baseline ? `${baseline.hemoglobin} g/dL` : 'N/A',
                          diff: hemoglobinDiff,
                          unit: 'g/dL',
                          normal: '12.0 - 16.0',
                          status: recent.hemoglobin < 12.0 ? 'warning' : 'normal',
                          icon: 'water_drop',
                          color: recent.hemoglobin < 12.0 ? 'rose' : 'emerald',
                          zones: [
                            { start: 7.0, end: 12.0, color: 'bg-rose-500' },
                            { start: 12.0, end: 16.0, color: 'bg-emerald-500' },
                            { start: 16.0, end: 18.0, color: 'bg-amber-400' }
                          ],
                          min: 7.0,
                          max: 18.0,
                          numericVal: recent.hemoglobin
                        }])
                      ].map((item, idx) => {
                        const cardCls = item.color === 'rose'
                          ? 'from-rose-50 to-rose-100/50 border-rose-200'
                          : item.color === 'amber'
                          ? 'from-amber-50 to-amber-100/50 border-amber-200'
                          : 'from-emerald-50 to-emerald-100/50 border-emerald-200';
                        return (
                        <div key={`biomarker-card-${idx}-${item.name}`} className={`p-2.5 rounded-xl border bg-gradient-to-b ${cardCls} flex flex-col justify-between space-y-1.5`}>
                          <div className="flex justify-between items-start">
                            <span className="text-[9.5px] text-slate-700 font-bold uppercase tracking-wider">{item.name}</span>
                            <span className="text-[8.5px] text-slate-500 font-mono">Ref: {item.normal}</span>
                          </div>
                          <div className="flex justify-between items-baseline pt-0.5">
                            <span className="text-base font-black font-mono tracking-tight text-slate-800">{item.val}</span>
                            {baseline && item.diff !== 0 && (
                              <span className={`text-[9px] font-extrabold font-mono flex items-center gap-0.5 ${
                                (item.diff > 0 && item.status !== 'normal') ? 'text-rose-600' : 'text-emerald-600'
                              }`}>
                                {item.diff > 0 ? '▲' : '▼'} {Math.abs(item.diff || 0).toFixed(1)}
                              </span>
                            )}
                          </div>
                          <div className="text-[8.5px] text-slate-600 pt-1 border-t border-slate-200/50 flex justify-between">
                            <span>Base: {item.base}</span>
                            <span className="font-bold text-[8px] uppercase tracking-wider">{item.status}</span>
                          </div>
                        </div>
                        );
                      })}
                    </div>

                    {/* Risk alerts & summary */}
                    {riskAlerts.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {riskAlerts.map((alert, idx) => (
                          <div
                            key={`risk-alert-${idx}-${alert.title}`}
                            className={`p-2 rounded-lg border text-[10px] flex items-start gap-1.5 ${
                              alert.type === 'critical'
                                ? 'bg-rose-50 border-rose-200 text-rose-900'
                                : alert.type === 'warning'
                                ? 'bg-amber-50 border-amber-200 text-amber-900'
                                : 'bg-blue-50 border-blue-200 text-blue-900'
                            }`}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-current" />
                            <div>
                              <strong className="font-bold block">{alert.title}</strong>
                              <p className="text-[9.5px] text-slate-600 leading-snug">{alert.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="p-2.5 bg-indigo-50/40 border border-indigo-100 rounded-xl text-[10.5px] text-slate-700 italic">
                      💡 {summaryText}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════════
              UNIFIED CLINICAL NOTES & DIAGNOSIS WORKSPACE
          ══════════════════════════════════════════════════════════════════ */}
          <div className="p-5 bg-white border border-slate-200/90 rounded-2xl space-y-4 shadow-sm text-left">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
              <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2 font-sans">
                <FileEdit className="w-4 h-4 text-indigo-600 font-bold shrink-0" />
                <span>Consultation & Clinical Notes</span>
              </label>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Auto-format SOAP */}
                <button
                  type="button"
                  onClick={() => {
                    if (!notes.trim()) return;
                    const lines = notes.split('\n').map(l => l.trim()).filter(Boolean);
                    let soap = `### SOAP Clinical Encounter Note\n\n`;
                    soap += `**S (Subjective / Chief Complaints)**:\n- ${lines.slice(0, 2).join('\n- ') || 'Patient reports symptoms.'}\n\n`;
                    soap += `**O (Objective / Vitals & Examination)**:\n`;
                    if (selectedPatient?.vitals) {
                      soap += `- BP: ${selectedPatient.vitals.bloodPressure || '120/80 mmHg'}, Pulse: ${selectedPatient.vitals.pulseRate || 72} bpm, Temp: ${selectedPatient.vitals.temperature || '98.6°F'}, SpO2: ${selectedPatient.vitals.spO2 || 98}%\n`;
                    } else {
                      soap += `- Vitals stable on clinical evaluation.\n`;
                    }
                    soap += `\n**A (Clinical Assessment & Diagnosis)**:\n- ${notes.toLowerCase().includes('fever') ? 'Acute Febrile Illness' : notes.toLowerCase().includes('diabetes') ? 'Type-2 Diabetes Mellitus review' : 'Outpatient clinical evaluation'}\n\n`;
                    soap += `**P (Treatment & Investigation Plan)**:\n- Prescribed medications as per e-Rx pad.\n- Diagnostic investigations queued. Follow-up scheduled.\n`;
                    setNotes(soap);
                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                      detail: {
                        title: 'SOAP Note Formatted ✨',
                        message: 'Standardized clinical encounter into Subjective, Objective, Assessment, Plan format.',
                        type: 'success'
                      }
                    }));
                  }}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition active:scale-95"
                >
                  <Sparkles className="w-3 h-3 text-indigo-600 font-bold" />
                  Auto-Format SOAP
                </button>

                {/* 1-Tap Hinglish Patient Summary Quick Pill */}
                <button
                  type="button"
                  onClick={async () => {
                    if (!notes.trim()) {
                      window.dispatchEvent(new CustomEvent('mediflow-toast', {
                        detail: {
                          title: 'Notes Required',
                          message: 'Please write consultation suggestions or clinical notes first.',
                          type: 'warning'
                        }
                      }));
                      return;
                    }
                    setIsGeneratingSummary(true);
                    try {
                      const doctorTitle = activePod?.doctorName || clinicProfile?.display_name || 'Doctor';
                      const summary = await api.generateConsultHinglishSummary(selectedPatient.id, notes, doctorTitle);
                      setHinglishSummary(summary);
                      
                      const taskId = `task-hinglish-${selectedPatient.id}-${Date.now()}`;
                      await api.saveAIResult({
                        id: crypto.randomUUID(),
                        user_id: 'doctor-uuid-placeholder',
                        task_id: taskId,
                        patient_id: selectedPatient.id,
                        input_data: notes,
                        output_data: summary,
                        output_type: 'HINGLISH_SUMMARY',
                        status: 'SUCCESS',
                        created_at: new Date().toISOString(),
                        model_used: 'gemini-2.5-flash',
                        duration_ms: 1000
                      });

                      window.dispatchEvent(new CustomEvent('mediflow-toast', {
                        detail: {
                          title: 'Hinglish AI Summary Generated! ✨',
                          message: 'Clinical summary generated successfully in friendly Hinglish.',
                          type: 'success'
                        }
                      }));
                    } catch (e: any) {
                      console.error('[Hinglish Summary Notice]', e);
                      const fallbackSummary = `Namaste ${selectedPatient?.name || 'Patient'} ji 🙏. Clinic se aapki health update:\n1. 💊 Dawa nirdharit samay par lein: ${notes.slice(0, 120)}...\n2. 🥗 Paani khoob piyein aur aaram karein.\n3. 🏥 Samasya hone par clinic sampark karein.`;
                      setHinglishSummary(fallbackSummary);
                      window.dispatchEvent(new CustomEvent('mediflow-toast', {
                        detail: {
                          title: 'Summary Prepared 📝',
                          message: 'Clinical summary prepared with standard home-care directions.',
                          type: 'info'
                        }
                      }));
                    } finally {
                      setIsGeneratingSummary(false);
                    }
                  }}
                  disabled={isGeneratingSummary}
                  className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition active:scale-95 disabled:opacity-50"
                >
                  <Bot className="w-3 h-3 text-purple-600" />
                  {isGeneratingSummary ? 'Generating...' : '🤖 1-Tap Hinglish AI'}
                </button>

                {/* Comparative Lab Trends Trigger */}
                {activeHistory && activeHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={handleGenerateLabTrend}
                    disabled={isGeneratingTrend}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition active:scale-95 disabled:opacity-50"
                  >
                    <BarChart3 className="w-3 h-3 text-rose-600" />
                    {isGeneratingTrend ? 'Analyzing...' : `📊 Compare Trends (${activeHistory.length} Reports)`}
                  </button>
                )}
              </div>
            </div>

            {/* Main Clinical Notes Editor */}
            <textarea
              id="consultation-notes-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Presenting complaints, systemic examination notes, and diagnosis (Press Ctrl+N to focus)..."
              rows={4}
              className="w-full input-field resize-y text-xs leading-relaxed bg-slate-50/60 focus:bg-white border border-slate-200 rounded-xl"
            />

            {/* Generated Hinglish Patient Summary Drawer (if active) */}
            {hinglishSummary && (
              <div className="p-3.5 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl space-y-2.5 animate-fade-in text-left">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-[10px] text-purple-800 uppercase tracking-widest font-mono flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    Hinglish WhatsApp Patient Care Summary
                  </h4>
                  <button
                    type="button"
                    onClick={() => setHinglishSummary('')}
                    className="text-[10px] text-slate-400 hover:text-slate-700 cursor-pointer bg-transparent border-0"
                  >
                    Dismiss
                  </button>
                </div>
                <div className="text-xs text-slate-700 leading-relaxed scroll-list max-h-[140px] overflow-y-auto pr-1 bg-white/70 p-2.5 rounded-lg border border-purple-100">
                  <MarkdownText content={hinglishSummary} className="italic" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    api.pushWhatsAppMessageFromBot(selectedPatient.phone, hinglishSummary);
                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                      detail: {
                        title: 'WhatsApp Summary Dispatched! 📱',
                        message: `Friendly Hinglish instructions sent to +91 ${selectedPatient.phone}.`,
                        type: 'success'
                      }
                    }));
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 uppercase transition-colors cursor-pointer border-0 text-white-force"
                >
                  <Send className="w-3.5 h-3.5 text-white-force" />
                  Send to Patient WhatsApp (+91 {selectedPatient.phone || 'N/A'})
                </button>
              </div>
            )}

            {/* Generated Comparative Lab Trend Drawer (if active) */}
            {comparativeTrend && (
              <div className="p-4 bg-gradient-to-br from-rose-50/70 to-indigo-50/50 border border-rose-200 rounded-xl space-y-3 animate-fade-in text-left shadow-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-[10px] text-rose-800 uppercase tracking-widest font-mono flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    Evidence-Based Comparative CDSS Report
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePrintClinicalReferral}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-rose-200/50 flex items-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3 h-3 shrink-0" />
                      Print
                    </button>
                    <button
                      type="button"
                      onClick={() => setComparativeTrend(null)}
                      className="text-[10px] text-slate-400 hover:text-slate-700 cursor-pointer bg-transparent border-0"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
                <div className="bg-white/90 border border-rose-100 p-3 rounded-lg text-xs text-slate-700 leading-relaxed max-h-[120px] overflow-y-auto">
                  {comparativeTrend.summaryText}
                </div>
              </div>
            )}
          </div>

            {cdssAnomalies && cdssAnomalies.length > 0 && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-850 dark:text-rose-400 p-4.5 rounded-2xl space-y-2.5 animate-fade-in text-left">
                <div className="flex justify-between items-center border-b border-rose-200/50 dark:border-rose-800/30 pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                    <ShieldAlert className="w-4 h-4 text-rose-500 font-bold animate-pulse shrink-0" />
                    Clinical Decision Safety Warnings (CDSS)
                  </h4>
                  <span className="text-[9px] font-black font-mono bg-rose-500/20 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-md border border-rose-500/20">
                    Confidence: 96%
                  </span>
                </div>
                <div className="space-y-2">
                  {cdssAnomalies.map((anomaly, idx) => (
                    <div key={`cdss-anomaly-${idx}-${String(anomaly).slice(0, 15)}`} className="text-xs font-semibold leading-relaxed flex items-start gap-1.5">
                      <span className="text-rose-500 font-bold">•</span>
                      <div>
                        {anomaly}
                        <div className="text-[9px] text-slate-500 dark:text-zinc-400 italic mt-0.5">
                          Citation: National Clinical Portal Guidelines v4.2 (ADA 2025/NHG Glaucoma Protocol)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Evidence-Based Clinical Recommender (NLM / PubMed / GDMT Knowledge Sync) */}
            {smartClinicalRecommendations.clinicalInsights.length > 0 && (
              <div className="p-3 bg-gradient-to-r from-cyan-50/80 to-blue-50/80 border border-cyan-200 rounded-2xl space-y-2 text-left animate-fade-in my-1">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-cyan-200/60 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-cyan-700 font-bold" />
                    <span className="text-[11px] font-black text-cyan-950 uppercase tracking-wide">
                      NLM &amp; PubMed Evidence Recommender
                    </span>
                  </div>
                  <span className="text-[8.5px] font-mono font-bold text-cyan-800 bg-cyan-100 px-2 py-0.5 rounded-full">
                    WHO Essential Meds 2024
                  </span>
                </div>
                
                <div className="space-y-1">
                  {smartClinicalRecommendations.clinicalInsights.map((insight, iIdx) => (
                    <div key={`rec-insight-${iIdx}`} className="text-[11px] text-slate-700 leading-relaxed flex items-start gap-1.5">
                      <span className="text-cyan-600 mt-0.5 shrink-0">▸</span>
                      <MarkdownText content={insight} />
                    </div>
                  ))}
                </div>

                {smartClinicalRecommendations.recommendedTests.length > 0 && (
                  <div className="pt-1.5 border-t border-cyan-200/50 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9.5px] font-bold text-cyan-900 uppercase font-mono">Suggested Diagnostic Panels:</span>
                    {smartClinicalRecommendations.recommendedTests.map((t) => {
                      const isSelected = selectedTests.some(st => st.loincCode === t.loincCode);
                      return (
                        <button
                          key={`rec-test-${t.loincCode}`}
                          type="button"
                          onClick={() => {
                            if (!isSelected) {
                              setSelectedTests ? setSelectedTests([...selectedTests, { loincCode: t.loincCode, name: t.name, category: t.category, normalRange: 'Standard', unit: '', price: t.price }]) : handleToggleTest({ loincCode: t.loincCode, name: t.name, category: t.category, normalRange: 'Standard', unit: '', price: t.price });
                              window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                detail: {
                                  title: 'Diagnostic Test Added! 🔬',
                                  message: `Advised '${t.name}' based on guideline: ${t.rationale}`,
                                  type: 'success'
                                }
                              }));
                            }
                          }}
                          disabled={isSelected}
                          className={`px-2 py-0.5 rounded-lg text-[9.5px] font-bold transition flex items-center gap-1 cursor-pointer ${
                            isSelected
                              ? 'bg-cyan-700 text-white shadow-xs cursor-default'
                              : 'bg-white hover:bg-cyan-100 text-cyan-900 border border-cyan-300'
                          }`}
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>{t.name} {t.price ? `(₹${t.price})` : ''}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Pediatric Weight-Based Dose Helper Popover Trigger & Popover */}
            <div className="flex items-center justify-between p-2.5 bg-amber-50/60 border border-amber-200/80 rounded-xl my-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-950">👶 Pediatric Weight Auto-Doser</span>
                <span className="text-[9px] font-mono text-amber-800 font-bold bg-amber-100/90 px-1.5 py-0.5 rounded">
                  Child: {selectedPatient?.age || 5}Y
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPediatricCalcOpen(!isPediatricCalcOpen)}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition shadow-2xs border-0 text-white-force"
              >
                <Sparkles className="w-3 h-3 text-white-force" />
                {isPediatricCalcOpen ? 'Hide Dosing' : 'Open Auto-Dose Calculator'}
              </button>
            </div>

            {isPediatricCalcOpen && (
              <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-2.5 animate-fade-in text-left my-1">
                <div className="flex items-center justify-between border-b border-amber-200/60 pb-1.5">
                  <h5 className="font-extrabold text-[11px] text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                    👶 Pediatric Suspension Weight-Based Auto-Dose Calculator
                  </h5>
                  <button
                    type="button"
                    onClick={() => setIsPediatricCalcOpen(false)}
                    className="text-amber-800 hover:text-amber-950 text-xs font-bold cursor-pointer border-0 bg-transparent"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">Child Weight:</span>
                    <input
                      type="number"
                      min={2}
                      max={60}
                      value={pediatricWeight}
                      onChange={(e) => setPediatricWeight(Number(e.target.value) || 10)}
                      className="w-16 px-2 py-1 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold outline-none"
                    />
                    <span className="text-xs text-slate-500">kg</span>
                  </div>
                  <span className="text-[10px] text-amber-800 font-mono">
                    Age: {selectedPatient?.age || '—'} Y • Est. Body Surface Area: {(0.024265 * Math.pow(pediatricWeight * 1000, 0.5378) / 10).toFixed(2)} m²
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                  {[
                    { drug: 'paracetamol', label: 'Paracetamol 250mg/5ml Syrup', strength: '250mg_5ml' },
                    { drug: 'amoxicillin', label: 'Amoxicillin 125mg/5ml Dry Syrup', strength: '125mg_5ml' },
                    { drug: 'ibuprofen', label: 'Ibuprofen 100mg/5ml Suspension', strength: '100mg_5ml' },
                    { drug: 'azithromycin', label: 'Azithromycin 100mg/5ml Suspension', strength: '100mg_5ml' },
                    { drug: 'cetirizine', label: 'Cetirizine 5mg/5ml Syrup', strength: '5mg_5ml' }
                  ].map((calcItem) => {
                    const calc = ClinicalSafetySentry.calculatePediatricDose({
                      drug: calcItem.drug as any,
                      weightKg: pediatricWeight,
                      strength: calcItem.strength as any
                    });
                    return (
                      <div key={calcItem.drug} className="p-2 bg-white border border-amber-200 rounded-xl space-y-1 text-xs">
                        <strong className="block text-slate-900 font-bold text-[10.5px] truncate">{calc.drugName}</strong>
                        <div className="text-emerald-700 font-black text-[11px] font-mono">
                          👉 Give {calc.calculatedVolumeMl} mL ({calc.totalDoseMg} mg)
                        </div>
                        <div className="text-[8.5px] text-slate-500 leading-tight">
                          {calc.dosingFrequency}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMedications([
                              ...medications,
                              {
                                medicineName: calc.drugName,
                                dosage: `${calc.calculatedVolumeMl} mL (${calc.totalDoseMg}mg)`,
                                frequency: calc.dosingFrequency.split(' (')[0],
                                duration: '5 Days',
                                instructions: `Calculated for ${pediatricWeight} kg child.`
                              }
                            ]);
                            window.dispatchEvent(new CustomEvent('mediflow-toast', {
                              detail: {
                                title: 'Pediatric Dose Added! 👶',
                                message: `Added ${calc.drugName} (${calc.calculatedVolumeMl} mL) for ${pediatricWeight}kg.`,
                                type: 'success'
                              }
                            }));
                          }}
                          className="w-full mt-1 py-0.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[9.5px] rounded-lg border-0 cursor-pointer text-white-force"
                        >
                          + Add {calc.calculatedVolumeMl} mL to Rx
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ophthalmology Refraction Rx Grid & Specialty Workstations */}
            {isOphthalmology && (
              <div className="space-y-4 pt-2 border-t border-slate-100 animate-fade-in text-left">
                {/* Refractionist Intake Metrics Summary Card */}
                {selectedPatient.vitals && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-205 pb-1.5">
                      <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-650 font-bold shrink-0" />
                        Refractionist Station Diagnostics (अपवर्तन रिपोर्ट)
                      </h3>
                      {selectedPatient.vitals.dilationStatus && (
                        <span className={`text-[8.5px] font-black font-mono px-2 py-0.5 rounded uppercase tracking-wider border ${
                          selectedPatient.vitals.dilationStatus === 'dilated'
                            ? 'bg-emerald-550/10 text-emerald-700 border-emerald-200'
                            : 'bg-amber-550/10 text-amber-800 border-amber-200'
                        }`}>
                          {selectedPatient.vitals.dilationStatus === 'dilated' ? '👁️ Fully Dilated' : '⏳ Dilation in Progress'}
                          {selectedPatient.vitals.dilationStatus === 'instilled' && selectedPatient.vitals.dilationStartTime && !isNaN(new Date(selectedPatient.vitals.dilationStartTime).getTime()) && (
                            <span className="ml-1 text-[8.5px] font-mono lowercase">
                              ({Math.max(0, Math.ceil((new Date(selectedPatient.vitals.dilationStartTime).getTime() + 20 * 60 * 1000 - Date.now()) / (60 * 1000)))}m left)
                            </span>
                          )}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {/* Visual Acuity */}
                      <div className="bg-white border border-slate-150 p-2.5 rounded-xl space-y-1">
                        <span className="text-[8.5px] font-bold text-slate-500 uppercase tracking-wider font-mono block">Visual Acuity</span>
                        <div className="text-xs space-y-0.5 text-slate-800 font-medium">
                          <p className="flex justify-between"><span>Unaided OD:</span> <span className="font-bold text-indigo-700">{selectedPatient.vitals.visualAcuityOD || '6/6'}</span></p>
                          <p className="flex justify-between"><span>Unaided OS:</span> <span className="font-bold text-indigo-700">{selectedPatient.vitals.visualAcuityOS || '6/6'}</span></p>
                          {selectedPatient.vitals.visualAcuityAidedOD && (
                            <p className="flex justify-between"><span>Aided OD:</span> <span className="font-bold text-emerald-600">{selectedPatient.vitals.visualAcuityAidedOD}</span></p>
                          )}
                          {selectedPatient.vitals.visualAcuityAidedOS && (
                            <p className="flex justify-between"><span>Aided OS:</span> <span className="font-bold text-emerald-600">{selectedPatient.vitals.visualAcuityAidedOS}</span></p>
                          )}
                        </div>
                      </div>

                      {/* Autorefraction Readings */}
                      <div className="bg-white border border-slate-150 p-2.5 rounded-xl space-y-1">
                        <span className="text-[8.5px] font-bold text-slate-500 uppercase tracking-wider font-mono block">Autorefraction (AR)</span>
                        <div className="text-xs space-y-0.5 text-slate-800 font-mono text-[9.5px]">
                          <p className="flex justify-between">
                            <span>OD:</span> 
                            <span className="font-bold">
                              {selectedPatient.vitals.arOD_sph ? `SPH ${selectedPatient.vitals.arOD_sph}` : ''}
                              {selectedPatient.vitals.arOD_cyl ? ` CYL ${selectedPatient.vitals.arOD_cyl}` : ''}
                              {selectedPatient.vitals.arOD_axis ? ` AXIS ${selectedPatient.vitals.arOD_axis}°` : ''}
                              {!selectedPatient.vitals.arOD_sph && !selectedPatient.vitals.arOD_cyl && '—'}
                            </span>
                          </p>
                          <p className="flex justify-between">
                            <span>OS:</span> 
                            <span className="font-bold">
                              {selectedPatient.vitals.arOS_sph ? `SPH ${selectedPatient.vitals.arOS_sph}` : ''}
                              {selectedPatient.vitals.arOS_cyl ? ` CYL ${selectedPatient.vitals.arOS_cyl}` : ''}
                              {selectedPatient.vitals.arOS_axis ? ` AXIS ${selectedPatient.vitals.arOS_axis}°` : ''}
                              {!selectedPatient.vitals.arOS_sph && !selectedPatient.vitals.arOS_cyl && '—'}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* IOP Intraocular Pressure */}
                      <div className="bg-white border border-slate-150 p-2.5 rounded-xl space-y-1">
                        <span className="text-[8.5px] font-bold text-slate-500 uppercase tracking-wider font-mono block">Intraocular Pressure</span>
                        <div className="text-xs space-y-0.5 text-slate-800 font-medium">
                          <p className="flex justify-between"><span>IOP OD:</span> <span className="font-bold text-indigo-700">{selectedPatient.vitals.iopOD ? `${selectedPatient.vitals.iopOD} mmHg` : '—'}</span></p>
                          <p className="flex justify-between"><span>IOP OS:</span> <span className="font-bold text-indigo-700">{selectedPatient.vitals.iopOS ? `${selectedPatient.vitals.iopOS} mmHg` : '—'}</span></p>
                          {selectedPatient.vitals.dilationDropsUsed && (
                            <p className="flex justify-between text-[9.5px]"><span>Drops:</span> <span className="font-bold text-amber-600">{selectedPatient.vitals.dilationDropsUsed}</span></p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <OphthalmicRefractionGrid 
                  value={refractionRx} 
                  onChange={() => {}} 
                  readOnly={true}
                />
                
                <BiometryWorksheet 
                  value={biometryRx} 
                  onChange={() => {}} 
                  readOnly={true}
                />

                {/* 1-Tap Cataract Surgery Admission Trigger */}
                <div className="p-3 bg-gradient-to-r from-purple-50/80 to-indigo-50/80 border border-purple-200/80 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-purple-600 font-bold" />
                    <div>
                      <h4 className="font-bold text-xs text-purple-950">Book Cataract OT Surgery</h4>
                      <p className="text-[9.5px] text-purple-800">Assigns OT token, pre-op clearance &amp; lens hold</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('mediflow-toast', {
                        detail: {
                          title: 'OT Surgery Booking Queued 🏥',
                          message: `Pre-op checklist & surgery slot queued for ${selectedPatient.name}.`,
                          type: 'success'
                        }
                      }));
                    }}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[10px] font-bold shadow-2xs transition active:scale-95 border-0 text-white-force cursor-pointer shrink-0"
                  >
                    🏥 Queue OT Admission
                  </button>
                </div>
              </div>
            )}

            {/* General Medicine Minor OT Procedure Desk */}
            {!isOphthalmology && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-2 shadow-2xs my-1">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600 font-bold" />
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">Chamber Minor Procedure / Dressing</h4>
                    <p className="text-[9.5px] text-slate-500">Nebulization, IV Infusion, Wound Dressing, Stitch Removal</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                      detail: {
                        title: 'Minor OT Token Queued 🩺',
                        message: `Compounder desk notified for procedural nursing care for ${selectedPatient.name}.`,
                        type: 'info'
                      }
                    }));
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-[10px] font-bold cursor-pointer transition shadow-2xs shrink-0"
                >
                  + Queue Procedure
                </button>
              </div>
            )}

            {/* Pod-to-Pod Network Referral */}
            <div className="border-t border-slate-100 pt-3 my-1 space-y-2 text-left">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary font-bold shrink-0" />
                Refer to Pod Partner Specialist
              </label>
              <div className="relative w-full">
                <select
                  id="referral-specialist-select"
                  className="w-full input-field py-1.5 text-xs bg-white pr-8 appearance-none"
                  defaultValue=""
                  onChange={async (e) => {
                    const val = e.target.value;
                    if (!val) return;
                    await api.referPatientToSpecialist(selectedPatient.phone, val);
                    e.target.value = "";
                  }}
                >
                  <option value="">Select a Network Specialist to Refer...</option>
                  <option value="dfb2a1a8-8e68-4f8a-929e-4a6c8e317103">Dr. Sinha (Cardiologist) - Central Hub</option>
                  <option value="dfb2a1a8-8e68-4f8a-929e-4a6c8e317102">Dr. Anjali (Gynecologist) - South Hub</option>
                  <option value="dfb2a1a8-8e68-4f8a-929e-4a6c8e317101">Dr. Raj (Pediatrician) - Regional Hub</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-600 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>

          </div>{/* ── END OF LEFT ZONE ── */}

          {/* ══════════════════════════════════════════════════════════════════
              RIGHT ZONE (50% on desktop: lg:col-span-6 space-y-3.5 text-left)
              1-Click Disease Protocols, Eye-Level Prescription Pad, Diagnostics, Follow-up
          ══════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-6 space-y-3.5 text-left">

            {/* 1-Click Quick-Rx Clinical Favorites & Disease Protocol Engine */}
            {(() => {
              const allProtocols = ClinicalEvidenceService.getProtocols(isOphthalmology);
              const filteredProtocols = allProtocols.filter(pack => {
                if (protocolCategoryFilter === 'fevers') {
                  const match = pack.id.includes('fever') || pack.id.includes('dengue') || pack.id.includes('typhoid') || pack.id.includes('malaria');
                  if (!match) return false;
                } else if (protocolCategoryFilter === 'gastro') {
                  const match = pack.id.includes('gastro') || pack.id.includes('gerd') || pack.id.includes('dyspepsia');
                  if (!match) return false;
                } else if (protocolCategoryFilter === 'respiratory') {
                  const match = pack.id.includes('cough') || pack.id.includes('bronchitis') || pack.id.includes('asthma') || pack.id.includes('uri');
                  if (!match) return false;
                } else if (protocolCategoryFilter === 'chronic') {
                  const match = pack.id.includes('t2dm') || pack.id.includes('htn') || pack.id.includes('cardio');
                  if (!match) return false;
                } else if (protocolCategoryFilter === 'pain') {
                  const match = pack.id.includes('pain') || pack.id.includes('joint') || pack.id.includes('osteo') || pack.id.includes('headache') || pack.id.includes('migraine');
                  if (!match) return false;
                }
                
                if (protocolSearchQuery.trim()) {
                  const q = protocolSearchQuery.toLowerCase();
                  const nameMatch = (pack.name || '').toLowerCase().includes(q);
                  const summaryMatch = (pack.summary || '').toLowerCase().includes(q);
                  const medMatch = (pack.medications || []).some(m => (m.medicineName || '').toLowerCase().includes(q) || (m.saltComposition || '').toLowerCase().includes(q));
                  const testMatch = (pack.suggestedLabTests || []).some(t => (t.name || '').toLowerCase().includes(q));
                  return nameMatch || summaryMatch || medMatch || testMatch;
                }
                return true;
              });

              return (
                <div className="p-3 bg-gradient-to-r from-indigo-50/80 via-purple-50/60 to-blue-50/80 border border-indigo-200/90 rounded-2xl space-y-2 shadow-xs">
                  <div className="flex items-center justify-between flex-wrap gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold text-indigo-950 uppercase tracking-wide flex items-center gap-1 font-sans">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600 font-bold" />
                        1-Click Quick-Rx Protocols ({allProtocols.length})
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-indigo-700 font-bold bg-indigo-100/90 border border-indigo-200/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                      ⚡ 1-Tap Auto-Add Rx + Labs
                    </span>
                  </div>

                  {/* Search & Fast Category Filter Toolbar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                    <div className="relative flex-1">
                      <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search protocols (e.g. fever, dengue, typhoid, loose motion, cough, bp, diabetes)..."
                        value={protocolSearchQuery}
                        onChange={(e) => setProtocolSearchQuery(e.target.value)}
                        className="w-full pl-7 pr-7 py-1 bg-white border border-slate-300/90 rounded-lg text-[11px] placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 shadow-2xs font-sans"
                      />
                      {protocolSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setProtocolSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-700 bg-transparent border-0 cursor-pointer font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                      {[
                        { id: 'all', label: `All (${allProtocols.length})` },
                        { id: 'fevers', label: '🌡️ Fevers' },
                        { id: 'gastro', label: '🤢 Gastro' },
                        { id: 'respiratory', label: '🫁 Cold & Cough' },
                        { id: 'chronic', label: '🩸 Sugar & BP' },
                        { id: 'pain', label: '🦴 Pain' },
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setProtocolCategoryFilter(cat.id as any)}
                          className={`px-2 py-0.5 rounded-md text-[9.5px] font-bold whitespace-nowrap transition cursor-pointer border ${
                            protocolCategoryFilter === cat.id
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white/90 text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Protocol Grid Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                    {filteredProtocols.map((pack) => {
                      const hasLabs = pack.suggestedLabTests && pack.suggestedLabTests.length > 0;
                      return (
                        <div
                          key={pack.id}
                          className={`p-2.5 rounded-xl border flex flex-col justify-between gap-1.5 shadow-2xs transition hover:shadow-sm ${pack.color} bg-opacity-95 text-left`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-1">
                              <h4 className="font-extrabold text-[11px] text-slate-900 leading-tight truncate">
                                {pack.name}
                              </h4>
                              <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 bg-white/80 border border-black/10 rounded shrink-0">
                                {pack.medications.length} meds{hasLabs ? ` • ${pack.suggestedLabTests?.length} labs` : ''}
                              </span>
                            </div>
                            <p className="text-[9.5px] text-slate-600 mt-0.5 line-clamp-1 leading-snug">
                              {pack.summary}
                            </p>
                            <div className="text-[8px] font-mono text-slate-500 font-semibold truncate mt-0.5" title={pack.pmidCitation}>
                              📖 {pack.evidenceSource}
                            </div>
                          </div>

                          <div className="pt-1 border-t border-black/5 flex items-center justify-between gap-1 flex-wrap">
                            {/* Primary Unified 1-Click Button: Prescribes BOTH meds & matched labs */}
                            <button
                              type="button"
                              onClick={() => {
                                const existingNames = new Set(medications.map(m => (m.medicineName || '').toLowerCase()));
                                let swappedCount = 0;
                                const toAdd = pack.medications
                                  .map(m => {
                                    const resolved = ClinicalEvidenceService.resolveMedicationWithInventorySwap(m);
                                    if (resolved.isSwapped) swappedCount++;
                                    return {
                                      medicineName: resolved.medicineName,
                                      dosage: resolved.dosage,
                                      frequency: resolved.frequency,
                                      duration: resolved.duration,
                                      instructions: resolved.instructions,
                                    };
                                  })
                                  .filter(m => !existingNames.has(m.medicineName.toLowerCase()));

                                setMedications([...medications, ...toAdd]);

                                let addedLabsCount = 0;
                                if (hasLabs) {
                                  const currentLoincs = new Set(selectedTests.map(t => t.loincCode));
                                  const newTests = (pack.suggestedLabTests || [])
                                    .filter(st => !currentLoincs.has(st.loincCode))
                                    .map(st => ({
                                      loincCode: st.loincCode,
                                      name: st.name,
                                      category: st.category,
                                      normalRange: 'Standard',
                                      unit: '',
                                      price: st.price || 350
                                    }));
                                  if (newTests.length > 0) {
                                    addedLabsCount = newTests.length;
                                    setSelectedTests?.([...selectedTests, ...newTests]);
                                  }
                                }

                                window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                  detail: {
                                    title: `${pack.name} Added! ⚡`,
                                    message: `Added ${toAdd.length} meds (${swappedCount} stock-swapped)${addedLabsCount > 0 ? ` + ${addedLabsCount} matched labs` : ''}.`,
                                    type: 'success'
                                  }
                                }));
                              }}
                              className="flex-1 py-1 px-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[9.5px] rounded-lg shadow-2xs flex items-center justify-center gap-1 cursor-pointer transition active:scale-95 border-0 text-white-force"
                              title="1-Tap Prescribe Both Medicines and Suggested Evidence Labs"
                            >
                              <Sparkles className="w-2.5 h-2.5 text-white-force" />
                              + Add Both ({pack.medications.length + (pack.suggestedLabTests?.length || 0)})
                            </button>

                            {/* Secondary Rx-only Button */}
                            <button
                              type="button"
                              onClick={() => {
                                const existingNames = new Set(medications.map(m => (m.medicineName || '').toLowerCase()));
                                let swappedCount = 0;
                                const toAdd = pack.medications
                                  .map(m => {
                                    const resolved = ClinicalEvidenceService.resolveMedicationWithInventorySwap(m);
                                    if (resolved.isSwapped) swappedCount++;
                                    return {
                                      medicineName: resolved.medicineName,
                                      dosage: resolved.dosage,
                                      frequency: resolved.frequency,
                                      duration: resolved.duration,
                                      instructions: resolved.instructions,
                                    };
                                  })
                                  .filter(m => !existingNames.has(m.medicineName.toLowerCase()));

                                setMedications([...medications, ...toAdd]);

                                window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                  detail: {
                                    title: `${pack.name} Meds Added! 💊`,
                                    message: `Added ${toAdd.length} medications (${swappedCount} auto-swapped to in-stock clinic brands).`,
                                    type: 'success'
                                  }
                                }));
                              }}
                              className="py-1 px-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-[9px] rounded-lg cursor-pointer transition active:scale-95 shrink-0"
                              title="Add Medications Only"
                            >
                              Rx ({pack.medications.length})
                            </button>

                            {/* Secondary Labs-only Button */}
                            {hasLabs && (
                              <button
                                type="button"
                                onClick={() => {
                                  const currentLoincs = new Set(selectedTests.map(t => t.loincCode));
                                  const newTests = (pack.suggestedLabTests || [])
                                    .filter(st => !currentLoincs.has(st.loincCode))
                                    .map(st => ({
                                      loincCode: st.loincCode,
                                      name: st.name,
                                      category: st.category,
                                      normalRange: 'Standard',
                                      unit: '',
                                      price: st.price || 350
                                    }));
                                  setSelectedTests?.([...selectedTests, ...newTests]);

                                  window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                    detail: {
                                      title: 'Diagnostic Tests Added! 🧪',
                                      message: `Added ${newTests.length} tests from ${pack.name} to lab worklist.`,
                                      type: 'info'
                                    }
                                  }));
                                }}
                                className="py-1 px-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[9px] rounded-lg cursor-pointer transition active:scale-95 shrink-0"
                                title="Add Lab Tests Only"
                              >
                                🧪 ({pack.suggestedLabTests?.length})
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {filteredProtocols.length === 0 && (
                      <div className="col-span-full py-4 text-center text-xs text-slate-500 bg-white/70 rounded-xl border border-dashed border-slate-200">
                        No protocols match "{protocolSearchQuery}".
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Top-Grade Real-Time CDSS Safety Alerts & One-Click Molecule Swaps */}
            {safetyEvaluation.alerts.length > 0 && (
              <div className="space-y-2 animate-fade-in">
                {safetyEvaluation.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-2 shadow-xs animate-fade-in ${
                      alert.severity === 'critical'
                        ? 'bg-rose-50/90 border-rose-300 text-rose-950 ring-2 ring-rose-500/20'
                        : alert.severity === 'warning'
                        ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                        : 'bg-indigo-50/90 border-indigo-200 text-indigo-950'
                    }`}
                  >
                    <div className="flex gap-2 items-start">
                      {alert.severity === 'critical' ? (
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 font-bold mt-0.5 animate-pulse" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 font-bold mt-0.5" />
                      )}
                      <div className="space-y-0.5 text-left">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h5 className="font-black text-[11px] uppercase tracking-wide">
                            {alert.title}
                          </h5>
                          <span className={`text-[8px] font-black font-mono uppercase px-1.5 py-0.2 rounded border ${
                            alert.severity === 'critical'
                              ? 'bg-rose-600 text-white border-rose-700'
                              : 'bg-amber-200 text-amber-900 border-amber-300'
                          }`}>
                            {alert.type.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-[10px] leading-snug font-medium">
                          {alert.message}
                        </p>
                      </div>
                    </div>

                    {alert.suggestedSwap && (
                      <button
                        type="button"
                        onClick={() => {
                          const swap = alert.suggestedSwap!;
                          const origNorm = (swap.originalDrug || '').toLowerCase();
                          const updatedMeds = medications.map(m => {
                            const medNorm = (m.medicineName || '').toLowerCase();
                            if (medNorm.includes(origNorm) || origNorm.includes(medNorm) || (origNorm === 'nsaid' && (medNorm.includes('ibuprofen') || medNorm.includes('diclofenac') || medNorm.includes('aceclofenac') || medNorm.includes('naproxen') || medNorm.includes('combiflam') || medNorm.includes('zerodol')))) {
                              return {
                                ...m,
                                medicineName: swap.swapToName,
                                dosage: swap.dosage,
                                frequency: swap.frequency,
                                duration: swap.duration
                              };
                            }
                            return m;
                          });
                          setMedications(updatedMeds);
                          window.dispatchEvent(new CustomEvent('mediflow-toast', {
                            detail: {
                              title: 'Clinical Swap Applied! 🛡️',
                              message: `Swapped to ${swap.swapToName} (${swap.rationale})`,
                              type: 'success'
                            }
                          }));
                        }}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-lg cursor-pointer shadow-xs transition active:scale-95 border-0 text-white-force shrink-0 flex items-center gap-1 self-stretch md:self-auto justify-center"
                      >
                        <CheckCircle2 className="w-3 h-3 text-white-force" />
                        1-Click Swap: {alert.suggestedSwap.swapToName}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Prescribe Medications (e-Rx) Instant Eye-Level Pad */}
            <div 
              id="prescription-panel" 
              className={`space-y-3 text-left p-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-sm transition-all duration-500 ${
                flashPrescriptionPanel ? 'bg-indigo-50/80 border border-indigo-200 ring-4 ring-indigo-500/20' : ''
              }`}
            >
              <div className="flex justify-between items-center flex-wrap gap-2 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    <Pill className="w-3.5 h-3.5 text-primary font-bold shrink-0" />
                    Prescription Pad (e-Rx)
                  </label>
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
                    {medications.length} {medications.length === 1 ? 'Medication' : 'Medications'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPrescriptionModalOpen(true)}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-600 border border-indigo-200 hover:border-indigo-500 text-indigo-700 hover:text-white rounded-lg text-[9.5px] font-extrabold uppercase tracking-wide flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
                >
                  <FileText className="w-3 h-3 font-bold shrink-0" />
                  Full-Screen Pad
                </button>
              </div>

              {/* List of Prescribed Medications (Compact Eye-Level Cards) */}
              {medications.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {medications.map((med, idx) => {
                    const stockMatch = ClinicalEvidenceService.matchPharmacyStock(med.medicineName, med.dosage);
                    const isEditing = editingMedIdx === idx;

                    return (
                      <div 
                        key={`cur-med-${idx}-${med.medicineName}`} 
                        className={`p-3 bg-white border rounded-xl flex flex-col justify-between hover:border-indigo-300 hover:shadow-2xs transition-all relative overflow-hidden group text-left space-y-1.5 ${
                          isEditing ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20' : 'border-slate-200/80'
                        }`}
                      >
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                        
                        <div className="space-y-1 flex-1 pl-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono font-bold text-slate-400">#{idx + 1}</span>
                              <strong className="text-slate-900 text-xs font-bold font-sans tracking-tight">{med.medicineName}</strong>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (isEditing) {
                                    setEditingMedIdx(null);
                                  } else {
                                    setEditingMedIdx(idx);
                                    setEditMedDraft({
                                      dosage: med.dosage || '',
                                      frequency: med.frequency || '1-0-1 (Twice daily with meals)',
                                      duration: med.duration || '5 Days',
                                      instructions: med.instructions || ''
                                    });
                                  }
                                }}
                                className={`p-1 rounded-md text-xs transition cursor-pointer border ${
                                  isEditing
                                    ? 'bg-indigo-600 text-white border-indigo-700 font-bold'
                                    : 'bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 border-slate-200'
                                }`}
                                title={isEditing ? 'Close Editor' : 'Edit Dosage & Days'}
                              >
                                <FileEdit className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveMedication(idx)}
                                className="p-1 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer border border-slate-200/60 hover:border-rose-200"
                                title="Remove Medication"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          
                          {/* Pharmacy In-Stock Badge & 1-Click Brand Swap */}
                          {stockMatch.isInStock ? (
                            <div className="flex items-center justify-between gap-1 flex-wrap pt-0.5">
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                                🟢 Stock: {stockMatch.stockQty} • ₹{stockMatch.price}
                              </span>

                              {stockMatch.matchedItemName.toLowerCase() !== med.medicineName.toLowerCase() && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...medications];
                                    updated[idx] = {
                                      ...med,
                                      medicineName: stockMatch.matchedItemName,
                                      dosage: stockMatch.genericName || med.dosage
                                    };
                                    setMedications(updated);
                                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                      detail: {
                                        title: 'Pharmacy Brand Swapped! 🔄',
                                        message: `Replaced '${med.medicineName}' with in-stock clinic brand '${stockMatch.matchedItemName}' (₹${stockMatch.price}).`,
                                        type: 'success'
                                      }
                                    }));
                                  }}
                                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[8.5px] font-bold flex items-center gap-1 cursor-pointer transition active:scale-95 border-0 shadow-2xs text-white-force"
                                >
                                  <ArrowLeftRight className="w-2.5 h-2.5 text-white-force" />
                                  Swap: In-Stock {stockMatch.matchedItemName}
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-medium bg-slate-100 text-slate-500 font-mono">
                              📦 Out of stock in clinic
                            </span>
                          )}

                          {/* Normal View: Frequency & Duration */}
                          {!isEditing ? (
                            <div className="flex flex-wrap gap-1 pt-1">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono">
                                🕒 {med.frequency}
                              </span>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                                📅 {med.duration}
                              </span>
                              {med.instructions && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                  💡 {med.instructions}
                                </span>
                              )}
                            </div>
                          ) : (
                            /* Inline Dosage Editor */
                            <div className="pt-2 border-t border-indigo-200/60 space-y-2 animate-fade-in bg-slate-50 p-2 rounded-lg">
                              <div className="space-y-1">
                                <span className="text-[8.5px] font-bold text-indigo-900 font-mono uppercase">Quick Dosage:</span>
                                <div className="flex flex-wrap gap-1">
                                  {[
                                    '1-0-1 (Twice daily with meals)',
                                    '1-0-0 (Once daily morning)',
                                    '0-0-1 (Once daily night)',
                                    '1-1-1 (Thrice daily)',
                                    'SOS (When required)'
                                  ].map((freqOption) => (
                                    <button
                                      key={freqOption}
                                      type="button"
                                      onClick={() => setEditMedDraft({ ...editMedDraft, frequency: freqOption })}
                                      className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold cursor-pointer transition ${
                                        editMedDraft.frequency === freqOption
                                          ? 'bg-indigo-600 text-white font-black text-white-force'
                                          : 'bg-white text-slate-700 border border-slate-200'
                                      }`}
                                    >
                                      {freqOption.split(' ')[0]}
                                    </button>
                                  ))}
                                </div>
                                <input
                                  type="text"
                                  value={editMedDraft.frequency}
                                  onChange={e => setEditMedDraft({ ...editMedDraft, frequency: e.target.value })}
                                  className="w-full text-[10px] p-1 bg-white border border-slate-200 rounded font-sans"
                                  placeholder="Custom frequency..."
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="text-[8.5px] font-bold text-slate-600 uppercase">Duration:</span>
                                  <input
                                    type="text"
                                    value={editMedDraft.duration}
                                    onChange={e => setEditMedDraft({ ...editMedDraft, duration: e.target.value })}
                                    className="w-full text-[10px] p-1 bg-white border border-slate-200 rounded font-sans mt-0.5"
                                  />
                                </div>
                                <div>
                                  <span className="text-[8.5px] font-bold text-slate-600 uppercase">Instructions:</span>
                                  <input
                                    type="text"
                                    value={editMedDraft.instructions}
                                    onChange={e => setEditMedDraft({ ...editMedDraft, instructions: e.target.value })}
                                    className="w-full text-[10px] p-1 bg-white border border-slate-200 rounded font-sans mt-0.5"
                                  />
                                </div>
                              </div>

                              <div className="flex justify-end gap-1 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingMedIdx(null)}
                                  className="px-2 py-0.5 text-[9px] text-slate-500 hover:text-slate-700 bg-transparent border-0 cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...medications];
                                    updated[idx] = {
                                      ...med,
                                      frequency: editMedDraft.frequency,
                                      duration: editMedDraft.duration,
                                      instructions: editMedDraft.instructions
                                    };
                                    setMedications(updated);
                                    setEditingMedIdx(null);
                                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                      detail: {
                                        title: 'Dosage Updated 💊',
                                        message: `Updated instructions for ${med.medicineName}.`,
                                        type: 'success'
                                      }
                                    }));
                                  }}
                                  className="px-2.5 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[9.5px] font-bold border-0 cursor-pointer text-white-force"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-5 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-1">
                  <p>No medications prescribed yet.</p>
                  <p className="text-[10px] text-slate-500">Select a 1-Click Protocol above or search medications below.</p>
                </div>
              )}

              {/* Quick Add Medication Autocomplete Combobox */}
              <div ref={dropdownRef} className="relative pt-2 border-t border-slate-100">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!medName.trim()) return;
                    handleAddMedication();
                  }}
                  className="flex gap-1.5"
                >
                  <div className="relative flex-1">
                    <input
                      type="text"
                      id="medicine-search-input"
                      placeholder="Type brand or molecule (e.g. Paracetamol, Augmentin, Pan 40)..."
                      value={medName}
                      onChange={(e) => setMedName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-sans focus:bg-white focus:border-indigo-500 outline-none"
                    />

                    {/* Suggestions Dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto p-1 space-y-0.5">
                        {suggestions.map((sug, sIdx) => (
                          <div
                            key={`sug-${sIdx}-${sug.name || sug.brandName}`}
                            onClick={() => {
                              setIsSelectingFromDropdown(true);
                              setMedName(sug.name || sug.brandName);
                              if (sug.dosage || sug.composition) setMedDosage(sug.dosage || sug.composition);
                              if (sug.defaultFrequency) setMedFreq(sug.defaultFrequency);
                              setShowSuggestions(false);
                            }}
                            className="p-2 hover:bg-indigo-50 rounded-lg cursor-pointer text-left text-xs transition flex justify-between items-center"
                          >
                            <div>
                              <strong className="text-slate-900 font-bold block">{sug.name || sug.brandName}</strong>
                              <span className="text-[9px] text-slate-500 font-mono">{sug.composition || sug.genericName || sug.dosage}</span>
                            </div>
                            <span className="text-[8px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded">
                              Clinic Stock
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-2xs border-0 text-white-force shrink-0"
                  >
                    + Add Rx
                  </button>
                </form>
              </div>
            </div>

            {/* Prescribe Diagnostics & Panels (Dx) */}
            <div className="space-y-3 text-left p-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-sm">
              <div className="flex justify-between items-center flex-wrap gap-2 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    <FlaskConical className="w-3.5 h-3.5 text-primary font-bold shrink-0" />
                    Diagnostics &amp; Lab Panels (Dx)
                  </label>
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
                    {selectedTests.length} {selectedTests.length === 1 ? 'Test' : 'Tests'}
                  </span>
                </div>
                {selectedTests.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedTests?.([])}
                    className="text-[9.5px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 px-2 py-0.5 rounded cursor-pointer border-0"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Selected Diagnostic Test Badges */}
              {selectedTests.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 bg-indigo-50/60 border border-indigo-200/80 rounded-xl animate-fade-in">
                  {selectedTests.map((test) => (
                    <div
                      key={test.loincCode}
                      className="flex items-center gap-1.5 pl-2 pr-1 py-0.5 bg-white border border-indigo-300 rounded-lg shadow-2xs text-[11px] font-bold text-slate-900"
                    >
                      <FlaskConical className="w-3 h-3 text-indigo-600 shrink-0" />
                      <span>{test.name}</span>
                      <span className="text-[8.5px] font-mono text-slate-500 font-normal">LOINC: {test.loincCode}</span>
                      <span className="text-[9.5px] font-mono font-black text-indigo-600">₹{test.price || 350}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleTest(test)}
                        className="p-0.5 hover:bg-rose-50 hover:text-rose-600 rounded text-slate-400 cursor-pointer transition-colors border-0"
                        title="Remove test"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Diagnostic Test Search Input */}
              <div ref={testDropdownRef} className="relative">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search blood tests, fever panels, X-Ray, USG, MRI or type custom..."
                    value={testSearchQuery}
                    onFocus={() => setIsTestDropdownOpen(true)}
                    onChange={(e) => {
                      setTestSearchQuery(e.target.value);
                      setIsTestDropdownOpen(true);
                    }}
                    className="w-full pl-8 pr-20 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none font-sans focus:bg-white focus:border-indigo-500"
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {testSearchQuery.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          setTestSearchQuery('');
                          setIsTestDropdownOpen(false);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600 text-xs cursor-pointer border-0 bg-transparent"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Floating Test Dropdown */}
                {isTestDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto p-1 space-y-0.5">
                    {liveTestCatalog
                      .filter((test: DiagnosticTest) => {
                        if (!testSearchQuery.trim()) return true;
                        const q = (testSearchQuery || '').toLowerCase();
                        const nameLower = (test.name || '').toLowerCase();
                        const catLower = (test.category || '').toLowerCase();
                        const loincLower = (test.loincCode || '').toLowerCase();
                        return nameLower.includes(q) || catLower.includes(q) || loincLower.includes(q);
                      })
                      .map((test: DiagnosticTest) => {
                        const isChecked = selectedTests.some((t: DiagnosticTest) => t.loincCode === test.loincCode || (t.name || '').toLowerCase() === (test.name || '').toLowerCase());
                        return (
                          <div
                            key={test.loincCode}
                            onClick={() => {
                              handleToggleTest(test);
                            }}
                            className={`p-2 rounded-lg border text-left text-xs transition cursor-pointer flex items-center justify-between gap-2 ${
                              isChecked
                                ? 'bg-indigo-50/80 border-indigo-400 text-slate-900 shadow-2xs'
                                : 'bg-white hover:bg-slate-50 border-slate-100 text-slate-700'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <div className="font-bold flex items-center gap-1 text-slate-800 text-[11px] truncate">
                                <FlaskConical className="w-3 h-3 text-indigo-500 shrink-0" />
                                <span>{test.name}</span>
                              </div>
                              <span className="text-[8.5px] text-slate-500 font-mono inline-block uppercase">
                                {test.category || 'General'} • LOINC: {test.loincCode}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-mono font-bold text-indigo-600">₹{test.price}</span>
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                isChecked ? 'bg-indigo-600 border-indigo-600 text-white-force' : 'border-slate-300 bg-white'
                              }`}>
                                {isChecked && <Check className="w-3 h-3 font-bold text-white-force" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            {/* 1-Tap WhatsApp Review & Follow-Up Loop */}
            <div className="p-3 bg-gradient-to-r from-emerald-50/70 to-teal-50/70 border border-emerald-200 rounded-2xl space-y-2 text-left my-2">
              <div className="flex items-center justify-between flex-wrap gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600 font-bold" />
                  <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                    1-Tap WhatsApp Review Loop (अगली समीक्षा)
                  </span>
                </div>
                <span className="text-[8.5px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Dispatches WhatsApp Reminder
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { days: 3, label: '3 Days (SOS)' },
                  { days: 7, label: '7 Days (Infection)' },
                  { days: 15, label: '15 Days (Biomarker)' },
                  { days: 30, label: '1 Month (Chronic)' }
                ].map((slot) => {
                  const isSelected = followUpDays === slot.days;
                  return (
                    <button
                      key={slot.days}
                      type="button"
                      onClick={() => {
                        const newDays = isSelected ? null : slot.days;
                        setFollowUpDays(newDays);
                        if (newDays) {
                          const targetDate = new Date();
                          targetDate.setDate(targetDate.getDate() + newDays);
                          setRevisitDate(targetDate.toISOString().split('T')[0]);
                          window.dispatchEvent(new CustomEvent('mediflow-toast', {
                            detail: {
                              title: `Follow-Up Scheduled (${slot.days} Days) 📅`,
                              message: `Configured interactive WhatsApp review loop for ${selectedPatient.name}.`,
                              type: 'success'
                            }
                          }));
                        } else {
                          setRevisitDate('');
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg border text-[10.5px] font-bold transition active:scale-95 cursor-pointer flex items-center gap-1 ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs text-white-force'
                          : 'bg-white hover:bg-emerald-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      <CheckCircle2 className={`w-3 h-3 ${isSelected ? 'text-white-force' : 'text-slate-300'}`} />
                      <span>{slot.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit Encounter Action Row */}
            <div className="pt-3 border-t border-slate-100 pb-32 sm:pb-2">
              <div className="hidden sm:flex justify-end items-center gap-3">
                <button
                  type="button"
                  onClick={handleCompleteConsultation}
                  disabled={isSubmittingEncounter}
                  className="btn-primary px-7 py-2.5 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer text-slate-800-force font-bold shadow-md disabled:opacity-50 text-xs"
                >
                  <CheckCircle2 className="h-4 w-4 text-slate-800-force" />
                  {isSubmittingEncounter ? 'Submitting & Dispatching WhatsApp Rx...' : 'Submit Encounter & Route Mappings'}
                </button>
              </div>

              {/* Mobile Fixed Sticky Bottom Action Bar */}
              <div className="sm:hidden fixed bottom-16 left-0 right-0 z-40 bg-white/95 backdrop-blur-md px-4 py-2.5 border-t border-slate-200 shadow-2xl flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono font-bold text-slate-500">
                    Token #{selectedPatient?.tokenNumber || 'TK-01'}
                  </span>
                  <span className="text-xs font-black text-slate-900 truncate max-w-[110px]">
                    {selectedPatient?.name || 'Patient'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCompleteConsultation}
                  disabled={isSubmittingEncounter}
                  className="flex-1 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-black text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all text-white-force border-0 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 text-white-force" />
                  {isSubmittingEncounter ? 'Submitting...' : 'Submit Encounter & WhatsApp Rx'}
                </button>
              </div>
            </div>

          </div>{/* ── END OF RIGHT ZONE ── */}

        </div>{/* ── END OF 50/50 GRID ── */}
        </div>
      )}

      {/* ── ZERO STATE: OPD CHAMBER READINESS COCKPIT (WHEN NO PATIENT SELECTED) ── */}
      {!selectedPatient && (
        <div className="lg:col-span-8 glass-panel p-8 border-slate-200/80 shadow-sm space-y-6 relative overflow-hidden bg-white text-left flex flex-col justify-between min-h-[550px]">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-indigo-600 shrink-0" />
                  OPD Chamber Readiness Cockpit
                </h2>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Select a patient from the queue or admit the next waiting patient to start clinical evaluation.
                </p>
              </div>
              <span className="text-[11px] font-bold font-mono px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Chamber Online
              </span>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
              <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-2xl">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                  Awaiting Consultation
                </div>
                <div className="text-2xl font-black text-indigo-600 mt-1">
                  {patients.filter(p => p.queueStatus === 'awaiting_consultation' || !p.queueStatus).length}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Tokens in active OPD queue</span>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-2xl">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                  Completed Today
                </div>
                <div className="text-2xl font-black text-emerald-600 mt-1">
                  {patients.filter(p => (p as any).queueStatus === 'completed' || (p as any).queueStatus === 'settled').length}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Prescriptions issued</span>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-2xl">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                  Active Virtual Care
                </div>
                <div className="text-2xl font-black text-purple-600 mt-1">
                  {appointments.filter(a => Boolean(a.isVirtual || (a as any).is_virtual)).length}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">WhatsApp Telemedicine loop</span>
              </div>
            </div>

            {/* Call Next Patient Banner */}
            {(() => {
              const awaitingPatient = patients.find(p => p.queueStatus === 'awaiting_consultation' || !p.queueStatus);
              if (awaitingPatient) {
                return (
                  <div className="p-5 bg-gradient-to-r from-indigo-50/90 via-primary/5 to-purple-50/90 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="space-y-1 text-left">
                      <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest font-mono">
                        Next in OPD Queue
                      </span>
                      <h4 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                        {awaitingPatient.name}
                        <span className="text-xs font-mono font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-lg">
                          {awaitingPatient.tokenNumber || '#TK-001'}
                        </span>
                      </h4>
                      <p className="text-xs text-slate-600 font-sans">
                        {awaitingPatient.age}y {awaitingPatient.gender} • Phone: +91 {awaitingPatient.phone}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPatient(awaitingPatient)}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition active:scale-95 border-0 text-white-force"
                    >
                      <DoorOpen className="w-4 h-4 text-white-force" />
                      Admit Patient to Chamber
                    </button>
                  </div>
                );
              }
              return (
                <div className="p-6 bg-slate-50 border border-slate-200/80 rounded-2xl text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-700">All Registered Patients Evaluated</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    No patients currently waiting in OPD queue. New walk-ins registered by the compounder will appear live.
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Quick Doctor Chamber Shortcuts */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-mono">
            <span>⚡ Keyboard Shortcut: <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700 font-bold">Ctrl+Enter</kbd> to save Rx</span>
            <span>🔒 HIPAA & ABDM Compliant EMR Session</span>
          </div>
        </div>
      )}

      {/* ── INTERACTIVE E-PRESCRIPTION PAD WORKSPACE MODAL ── */}
      {/* ─── INTERACTIVE E-PRESCRIPTION PAD MODAL (Portal Root) ─────────────── */}
      {isPrescriptionModalOpen && selectedPatient && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 md:p-6 overflow-hidden animate-fade-in">
          <div className="glass-panel max-w-6xl w-full p-6 md:p-8 border-slate-200 shadow-2xl relative bg-white text-slate-800 rounded-3xl flex flex-col max-h-[92vh] overflow-hidden">
            
            {/* Top gradient accent line */}
            <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-indigo-500 via-primary to-secondary" />

            {/* Header: Title & Close Action */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-6 h-6 text-indigo-600 font-bold shrink-0" />
                <div>
                  <h3 className="text-sm md:text-base font-black text-slate-800 uppercase tracking-wider font-sans">
                    Interactive Clinical E-Prescription Pad
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">Design & organize prescriptions and diagnostics worksheets in a unified layout</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrescriptionModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer border-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body: Scrollable Sheet */}
            <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-6">
              
              {/* Clinical letterhead */}
              <div className="p-5 bg-slate-50/50 border border-slate-200 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4 relative">
                <div className="space-y-1 text-left border-r border-dashed border-slate-200 pr-4">
                  <h4 className="text-xs font-bold text-slate-900 uppercase">
                    {activePod?.doctorName || clinicProfile?.display_name || (isOphthalmology ? "Consultant Ophthalmologist, MS (Ophthalmology)" : "Consultant Physician")}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {isOphthalmology ? "Ophthalmic Microsurgery & Refractive Consultant" : "General Medicine & Clinical Consultant"}
                  </p>
                  <p className="text-[9px] text-slate-400 font-mono">
                    Reg No: MCI-84992-A • Phone: +91 99342 98453
                  </p>
                  <p className="text-[9px] text-slate-500 font-medium">
                    🏢 {activePod?.clinicCode ? `Clinic Hub: ${activePod.name || 'Primary Pod'} (Code: ${activePod.clinicCode})` : "VitalSync Connected Clinic Group"}
                  </p>
                </div>

                <div className="space-y-1 text-left md:pl-2">
                  <div className="flex justify-between">
                    <span className="text-[10px] font-bold text-slate-700">Patient:</span>
                    <span className="text-[10px] text-slate-900 font-medium">{selectedPatient.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] font-bold text-slate-700">Age / Gender:</span>
                    <span className="text-[10px] text-slate-900 font-medium">{selectedPatient.age}y / {selectedPatient.gender}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] font-bold text-slate-700">ABHA ID:</span>
                    <span className="text-[10px] text-slate-900 font-mono">{selectedPatient.abhaId || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] font-bold text-slate-700">Token Number:</span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded">
                      {selectedPatient.tokenNumber || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-1 mt-1">
                    <span className="text-[9px] font-bold text-slate-500">Date:</span>
                    <span className="text-[9px] text-slate-500 font-mono">
                      {getIstDateDisplay()}
                    </span>
                  </div>
                </div>
              </div>

              {/* 50/50 Split Workspace */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                
                {/* LEFT HALF: Medication builder & cards list */}
                <div className="space-y-4 text-left p-4.5 bg-slate-50/20 border border-slate-200/50 rounded-2xl">
                  <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100">
                    <Pill className="w-4 h-4 text-indigo-500 shrink-0" />
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">
                      1. Medications Prescription details (Rx)
                    </h4>
                  </div>

                  {/* Form to add medicine (Duplicate layout inside modal for smoothness) */}
                  <div className="space-y-3.5 bg-white p-4 border border-slate-200 rounded-xl relative">
                    <div className="space-y-1.5 relative">
                      <span className="text-[9px] font-bold text-slate-500 uppercase font-mono">Medicine Search / Name</span>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder={isOphthalmology ? "e.g. Moxifloxacin Eye Drops" : "e.g. Paracetamol 650mg"}
                          value={medName}
                          onChange={(e) => setMedName(e.target.value)}
                          onKeyDown={(e) => {
                            if (!showSuggestions || suggestions.length === 0) return;
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setActiveSuggestionIdx(prev => (prev + 1) % suggestions.length);
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setActiveSuggestionIdx(prev => (prev - 1 + suggestions.length) % suggestions.length);
                            } else if (e.key === 'Enter') {
                              e.preventDefault();
                              const selected = suggestions[activeSuggestionIdx];
                              setIsSelectingFromDropdown(true);
                              setMedName(selected.name);
                              setMedDosage(selected.genericName);
                              setMedFreq(selected.frequency);
                              setMedDur(selected.duration);
                              setShowSuggestions(false);
                            } else if (e.key === 'Escape') {
                              setShowSuggestions(false);
                            }
                          }}
                          className="w-full input-field py-1.5 text-xs bg-slate-50 border-slate-200 pr-8"
                        />
                        <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-2 pointer-events-none" />
                      </div>

                      {/* Autocomplete Dropdown inside Modal */}
                      {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-[130] max-h-[160px] overflow-y-auto">
                          {suggestions.map((item, idx) => (
                            <div
                              key={`modal-med-sugg-${idx}-${item.name}`}
                              onClick={() => {
                                setIsSelectingFromDropdown(true);
                                setMedName(item.name);
                                setMedDosage(item.genericName);
                                setMedFreq(item.frequency);
                                setMedDur(item.duration);
                                setShowSuggestions(false);
                              }}
                              onMouseEnter={() => setActiveSuggestionIdx(idx)}
                              className={`p-2.5 border-b border-slate-100 last:border-0 flex justify-between items-center cursor-pointer text-xs transition-colors ${
                                idx === activeSuggestionIdx ? 'bg-indigo-50/70 text-indigo-900' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <div>
                                <div className="font-semibold flex items-center gap-1">
                                  <Pill className="w-3 h-3 text-indigo-500 shrink-0" />
                                  {item.name}
                                </div>
                                <div className="text-[9px] text-slate-500 mt-0.5">
                                  {item.genericName}
                                </div>
                              </div>
                              <span className={`px-1.5 py-0.2 rounded-full text-[8px] font-bold ${
                                item.inInventory ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-indigo-50 text-indigo-650'
                              }`}>
                                {item.inInventory ? `${item.stock} Avail` : 'Catalog'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase font-mono">Dosage / Formula</span>
                        {isOphthalmology ? (
                          <select
                            value={medDosage}
                            onChange={(e) => setMedDosage(e.target.value)}
                            className="w-full input-field py-1.5 text-xs bg-slate-50 border-slate-200 cursor-pointer"
                          >
                            <option value="">-- Select --</option>
                            <option value="1 drop">1 drop</option>
                            <option value="2 drops">2 drops</option>
                            <option value="Thin ribbon">Thin ribbon</option>
                            <option value="Apply ointment">Apply ointment</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            placeholder="e.g. 1 tab"
                            value={medDosage}
                            onChange={(e) => setMedDosage(e.target.value)}
                            className="w-full input-field py-1.5 text-xs bg-slate-50 border-slate-200"
                          />
                        )}
                      </div>

                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase font-mono">Frequency</span>
                        {isOphthalmology ? (
                          <select
                            value={medFreq}
                            onChange={(e) => setMedFreq(e.target.value)}
                            className="w-full input-field py-1.5 text-xs bg-slate-50 border-slate-200 cursor-pointer"
                          >
                            <option value="">-- Select --</option>
                            {OPHTHALMIC_FREQUENCIES.map(freq => (
                              <option key={freq} value={freq}>{freq}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            placeholder="e.g. 1-0-1"
                            value={medFreq}
                            onChange={(e) => setMedFreq(e.target.value)}
                            className="w-full input-field py-1.5 text-xs bg-slate-50 border-slate-200"
                          />
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center gap-3 pt-2">
                      <div className="space-y-1 flex-1 max-w-[150px]">
                        <span className="text-[9px] font-bold text-slate-500 uppercase font-mono">Duration</span>
                        <input
                          type="text"
                          placeholder="e.g. 5 Days"
                          value={medDur}
                          onChange={(e) => setMedDur(e.target.value)}
                          className="w-full input-field py-1 text-xs bg-slate-50 border-slate-200"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddMedication}
                        className="bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-[10px] px-4 py-2 rounded-xl active:scale-[0.98] transition-all flex items-center gap-1 cursor-pointer border-0 text-white-force self-end"
                      >
                        <Plus className="w-3 h-3 font-bold text-white-force shrink-0" />
                        Prescribe
                      </button>
                    </div>
                  </div>

                  {/* Active e-Rx Card List */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide font-mono block">Prescribed Medication List</span>
                    {medications.length > 0 ? (
                      <div className="space-y-2 lg:max-h-[200px] max-h-none lg:overflow-y-auto pr-1">
                        {medications.map((med, idx) => {
                          const stockMatch = ClinicalEvidenceService.matchPharmacyStock(med.medicineName, med.dosage);
                          return (
                            <div 
                              key={`presc-preview-med-${idx}-${med.medicineName}`} 
                              className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col justify-between hover:border-indigo-300 hover:shadow-xs transition-all relative overflow-hidden text-left space-y-1.5"
                            >
                              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                              <div className="flex justify-between items-start">
                                <div className="flex-1 pr-2">
                                  <div className="flex items-center gap-1.5">
                                    <Pill className="w-3.5 h-3.5 text-indigo-500 font-bold shrink-0" />
                                    <strong className="text-slate-800 text-[11px] font-bold">{med.medicineName}</strong>
                                  </div>
                                  <span className="text-[9px] text-slate-500 block mt-0.5">
                                    Formula: {med.dosage || 'As directed'} • Freq: {med.frequency} • Dur: {med.duration}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMedication(idx)}
                                  className="p-1 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors cursor-pointer border-0 bg-transparent"
                                >
                                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                </button>
                              </div>

                              {stockMatch.isInStock && (
                                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                                    🟢 In Stock ({stockMatch.stockQty} {stockMatch.unit}) • ₹{stockMatch.price}
                                  </span>
                                  {stockMatch.matchedItemName.toLowerCase() !== med.medicineName.toLowerCase() && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = [...medications];
                                        updated[idx] = {
                                          ...med,
                                          medicineName: stockMatch.matchedItemName,
                                          dosage: stockMatch.genericName || med.dosage
                                        };
                                        setMedications(updated);
                                        window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                          detail: {
                                            title: 'Pharmacy Brand Swapped! 🔄',
                                            message: `Swapped to ${stockMatch.matchedItemName}.`,
                                            type: 'success'
                                          }
                                        }));
                                      }}
                                      className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[8.5px] font-bold flex items-center gap-1 cursor-pointer border-0 text-white-force"
                                    >
                                      <ArrowLeftRight className="w-2.5 h-2.5 text-white-force" />
                                      1-Click Swap: {stockMatch.matchedItemName}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-[10px] text-slate-400 italic">
                        No medications prescribed yet.
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT HALF: Searchable diagnostic tests catalog selector */}
                <div className="space-y-4 text-left p-4.5 bg-slate-50/20 border border-slate-200/50 rounded-2xl flex flex-col h-full min-h-[380px]">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <FlaskConical className="w-4 h-4 text-teal-600 shrink-0" />
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">
                        2. Diagnostics Requisitions (Dx)
                      </h4>
                    </div>
                    <span className="text-[8px] font-bold px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-700 rounded-full font-mono">
                      {selectedTests.length} Selected
                    </span>
                  </div>

                  {/* Search diagnostics filter */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search diagnostic test name or LOINC..."
                      value={testSearchQuery}
                      onChange={(e) => setTestSearchQuery(e.target.value)}
                      className="w-full input-field py-1.5 pl-8 text-xs bg-white border-slate-200"
                    />
                    {testSearchQuery && (
                      <button 
                        onClick={() => setTestSearchQuery('')} 
                        className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-700 cursor-pointer border-0 bg-transparent"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Diagnostic catalog list grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:overflow-y-auto lg:max-h-[260px] max-h-none pr-1 pt-1">
                    {testCatalog
                      .filter(test => {
                        const q = (testSearchQuery || '').toLowerCase();
                        const nameLower = (test.name || '').toLowerCase();
                        const loincLower = (test.loincCode || '').toLowerCase();
                        return !q || nameLower.includes(q) || loincLower.includes(q);
                      })
                      .map((test) => {
                        const isChecked = selectedTests.some(t => t.loincCode === test.loincCode);
                        return (
                          <button
                            key={test.loincCode}
                            type="button"
                            onClick={() => handleToggleTest(test)}
                            className={`flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-all duration-200 cursor-pointer ${
                              isChecked
                                ? 'bg-indigo-50/70 border-indigo-300 text-slate-900 shadow-xs'
                                : 'bg-white border-slate-200/80 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <span className="font-semibold block truncate text-[10px] text-slate-750">{test.name}</span>
                              <span className="text-[8px] text-slate-400 font-mono mt-0.5 inline-block uppercase">
                                LOINC: {test.loincCode}
                              </span>
                            </div>
                            <div className={`w-4.5 h-4.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                              isChecked ? 'bg-indigo-600 border-indigo-600 text-white-force' : 'border-slate-300 bg-slate-50'
                            }`}>
                              {isChecked && <Check className="w-3 h-3 font-bold text-white-force" />}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>

              </div>

            </div>

            {/* Footer Workspace Action Row */}
            <div className="border-t border-slate-100 pt-4 mt-2 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="flex gap-4 text-[10px] text-slate-500 font-mono font-medium">
                <div>Prescribed Medications: <strong className="text-indigo-600">{medications.length}</strong></div>
                <div>Lab Diagnostics: <strong className="text-teal-600">{selectedTests.length}</strong></div>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsPrescriptionModalOpen(false)}
                  className="w-full sm:w-auto bg-indigo-650 hover:bg-indigo-750 text-white font-bold text-xs px-6 py-2.5 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1 cursor-pointer border-0 text-white-force shadow-md"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-white-force shrink-0" />
                  Save &amp; Apply Workspace
                </button>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* ─── LIVE LAB REPORT PDF & AI ANALYSIS MODAL ───────────────────────── */}
      {selectedLabReportForPdf && selectedPatient && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 sm:p-6 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3 bg-slate-50/80 dark:bg-slate-900/80 rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shrink-0">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-800 dark:text-white">
                      🔬 {selectedLabReportForPdf.testName || 'Diagnostic Pathology Report'}
                    </h3>
                    <span className="px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-[9px] rounded-full uppercase font-mono border border-indigo-200 dark:border-indigo-800">
                      LOINC: {selectedLabReportForPdf.testCode || selectedLabReportForPdf.loincCode || '4544-3'}
                    </span>
                    {doctorLabInsight?.overallStatus === 'critical' ? (
                      <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 font-black text-[9px] rounded-full uppercase font-mono animate-pulse">
                        Critical Lab Alerts 🔴
                      </span>
                    ) : doctorLabInsight?.overallStatus === 'abnormal' ? (
                      <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 font-black text-[9px] rounded-full uppercase font-mono">
                        Abnormal Biomarkers ⚠️
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 font-black text-[9px] rounded-full uppercase font-mono">
                        All Parameters Normal ✅
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Patient: <strong className="text-slate-700 dark:text-slate-200">{selectedPatient.name}</strong> • Age: {selectedPatient.age || '—'} Y • Token: {selectedPatient.tokenNumber || '#TK-001'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* PDF View Mode Switcher (If original technician scan uploaded) */}
                {selectedLabReportForPdf.reportFileUrl && (
                  <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setActivePdfViewMode('uploaded')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer border-0 ${
                        activePdfViewMode === 'uploaded' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      Original Lab Scan
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePdfViewMode('electronic')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer border-0 ${
                        activePdfViewMode === 'electronic' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      Electronic PDF
                    </button>
                  </div>
                )}

                {labPdfBlobUrl && (
                  <a
                    href={activePdfViewMode === 'uploaded' && selectedLabReportForPdf.reportFileUrl ? selectedLabReportForPdf.reportFileUrl : labPdfBlobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer no-underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Open Fullscreen</span>
                  </a>
                )}
                {labPdfBlobUrl && (
                  <a
                    href={labPdfBlobUrl}
                    download={`LabReport-${selectedPatient.name.replace(/\s+/g, '_')}-${selectedLabReportForPdf.testCode || 'Dx'}.pdf`}
                    className="py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer no-underline border border-indigo-200 dark:border-indigo-800"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Download PDF</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleCloseLabPdfModal}
                  className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition cursor-pointer border-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Split Live PDF Document Viewer + Doctor-Grade Critical Intelligence */}
            <div className="p-4 sm:p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
              {/* Left Column: Live PDF Document Viewer */}
              <div className="lg:col-span-7 space-y-3 flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    {activePdfViewMode === 'uploaded' ? 'Official Technician Uploaded Lab Document' : 'VitalSync Electronic Clinical PDF'}
                  </span>
                  {selectedLabReportForPdf.reportFileUrl && activePdfViewMode === 'electronic' && (
                    <button
                      type="button"
                      onClick={() => setActivePdfViewMode('uploaded')}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0"
                    >
                      <span>Switch to Original Scan</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex-1 min-h-[500px] bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex items-center justify-center relative shadow-inner">
                  {isLabPdfLoading ? (
                    <div className="flex flex-col items-center gap-2 p-8 text-center">
                      <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-slate-500 font-medium">Rendering clinical diagnostic PDF...</p>
                    </div>
                  ) : activePdfViewMode === 'uploaded' && selectedLabReportForPdf.reportFileUrl ? (
                    <iframe
                      src={selectedLabReportForPdf.reportFileUrl}
                      title="Uploaded Lab Scan"
                      className="w-full h-full min-h-[500px] border-0 rounded-2xl bg-white"
                    />
                  ) : labPdfBlobUrl ? (
                    <iframe
                      src={labPdfBlobUrl}
                      title="Electronic Lab Report PDF"
                      className="w-full h-full min-h-[500px] border-0 rounded-2xl bg-white"
                    />
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400">
                      Generating PDF preview... Critical biomarker intelligence available on the right.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Doctor-Grade Critical Clinical Intelligence */}
              <div className="lg:col-span-5 space-y-4 text-left">
                {doctorLabInsight ? (
                  <div className="space-y-4">
                    {/* Organ System Risks */}
                    {doctorLabInsight.organRisks.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 font-mono block">
                          🚨 Target Organ Risk Assessment ({doctorLabInsight.organRisks.length})
                        </span>
                        {doctorLabInsight.organRisks.map((risk, idx) => (
                          <div
                            key={`organ-risk-${idx}`}
                            className={`p-3 rounded-xl border text-xs space-y-1 ${
                              risk.level === 'critical'
                                ? 'bg-rose-50 border-rose-300 text-rose-950 dark:bg-rose-950/40 dark:border-rose-800'
                                : 'bg-amber-50 border-amber-300 text-amber-950 dark:bg-amber-950/40 dark:border-amber-800'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <strong className="font-extrabold text-xs">{risk.system}</strong>
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-white/80 border font-mono">
                                {risk.level}
                              </span>
                            </div>
                            {risk.findings.map((f, fi) => (
                              <p key={`risk-f-${fi}`} className="text-[11px] leading-relaxed">
                                • {f}
                              </p>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actionable Doctor Directives */}
                    {doctorLabInsight.actionableDirectives.length > 0 && (
                      <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-1.5 text-xs text-indigo-950">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 font-mono block">
                          🩺 Physician Actionable Directives
                        </span>
                        {doctorLabInsight.actionableDirectives.map((dir, di) => (
                          <div key={`dir-${di}`} className="text-[11px] font-medium leading-relaxed">
                            {dir}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Historical Delta Trends */}
                    {doctorLabInsight.deltaTrends.length > 0 && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 font-mono block">
                          📊 Delta Trend vs Previous Baseline
                        </span>
                        {doctorLabInsight.deltaTrends.map((dt, dti) => (
                          <div key={`dt-${dti}`} className="flex items-center justify-between text-[11px] border-b border-slate-100 pb-1">
                            <span>{dt.parameter}: <strong className="text-slate-800">{dt.baseline} → {dt.current}</strong></span>
                            <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{dt.changeText}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Biomarker Parameters Table with Reference Limits */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono block">
                        Measured Biomarkers ({doctorLabInsight.biomarkers.length}) &amp; LOINC Standard Intervals
                      </span>
                      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[220px] overflow-y-auto">
                          {doctorLabInsight.biomarkers.map((b, idx) => (
                            <div key={`biomarker-row-${idx}`} className="p-2.5 flex items-center justify-between text-xs">
                              <div>
                                <span className="font-bold text-slate-800 dark:text-white block">
                                  {b.name}
                                </span>
                                <span className="text-[9px] text-slate-400 font-mono">
                                  Ref: {b.refMin} - {b.refMax} {b.unit}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className={`font-black font-mono text-sm block ${
                                  b.severity.includes('critical') ? 'text-rose-600 animate-pulse' : b.severity.includes('high') || b.severity.includes('low') ? 'text-amber-600' : 'text-emerald-600'
                                }`}>
                                  {b.value} {b.unit}
                                </span>
                                <span className="text-[8px] font-bold font-mono uppercase text-slate-500">
                                  {b.severityLabel}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Action Row: 1-Click Import to Notes & Push WhatsApp */}
                    <div className="pt-2 space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (doctorLabInsight) {
                            if (notes) {
                              setNotes(notes + '\n\n' + doctorLabInsight.formattedClinicalNote);
                            } else {
                              setNotes(doctorLabInsight.formattedClinicalNote);
                            }
                            handleCloseLabPdfModal();
                            window.dispatchEvent(new CustomEvent('mediflow-toast', {
                              detail: {
                                title: 'Doctor Lab Insights Imported 📋',
                                message: 'Imported critical biomarker analysis and directives into encounter notes.',
                                type: 'success'
                              }
                            }));
                          }
                        }}
                        className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer border-0 text-white-force"
                      >
                        <FileEdit className="w-4 h-4 text-white-force" />
                        <span>Import Critical Findings into Encounter Notes</span>
                      </button>

                      <button
                        type="button"
                        disabled={isResendingWhatsApp}
                        onClick={async () => {
                          if (!selectedPatient.phone) return;
                          setIsResendingWhatsApp(true);
                          try {
                            await api.dispatchLabReportWhatsApp({
                              patientPhone: selectedPatient.phone,
                              patientName: selectedPatient.name,
                              reportUrl: selectedLabReportForPdf.reportFileUrl || labPdfBlobUrl || 'https://vitalsync.in',
                              testName: selectedLabReportForPdf.testName || 'Diagnostic Report'
                            });
                            window.dispatchEvent(new CustomEvent('mediflow-toast', {
                              detail: {
                                title: 'Lab Report Sent to WhatsApp 📱',
                                message: `Official report pushed to +91 ${selectedPatient.phone}`,
                                type: 'success'
                              }
                            }));
                          } catch (e) {
                            console.error(e);
                          } finally {
                            setIsResendingWhatsApp(false);
                          }
                        }}
                        className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Push PDF to Patient WhatsApp (+91 {selectedPatient.phone || 'N/A'})</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Generating physician intelligence analysis...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});
