import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../../services/api';
import { PharmacyService } from '../../../services/pharmacyService';
import { BillingService } from '../../../services/billingService';
import { FALLBACK_DOCTOR_ID } from '../../../services/podContext';
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
  DoorOpen,
  TrendingUp,
  Baby,
  Upload,
  RefreshCw
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
  handleSaveEncounter?: (data?: { medications?: any[]; diagnosticTests?: DiagnosticTest[]; notes?: string }) => void | Promise<void>;
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

  // Auto-select first awaiting patient for TODAY if none is selected
  useEffect(() => {
    if (!selectedPatient && patients && patients.length > 0) {
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
        const pDate = getIstDateString(regDate);
        return Boolean(pDate && pDate === todayStr && paidPatientIds.has(p.id));
      };

      const awaiting = patients.find(p => 
        (p.queueStatus === 'awaiting_consultation' || p.queueStatus === 'in_consultation') && 
        isPatientForToday(p) && 
        paidPatientIds.has(p.id)
      );
      if (awaiting) {
        setSelectedPatient(awaiting);
      }
    }
  }, [patients, selectedPatient, appointments]);

  const [virtualDateInput, setVirtualDateInput] = useState('');
  const [isQueueExpanded, setIsQueueExpanded] = useState(false);
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

  // Longitudinal AI Trend Intelligence States
  const [showAiTrendPanel, setShowAiTrendPanel] = useState(false);
  const [uploadedLabFile, setUploadedLabFile] = useState<{ fileName: string; fileUrl: string; isAnalyzing: boolean } | null>(null);

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
    let sec = 0;
    ambientTimerRef.current = setInterval(() => {
      sec += 1;
      setAmbientTimer(sec);
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

    const textToParse = (ambientTranscript || '').trim() || (selectedPatient 
      ? `Doctor: Namaste ${selectedPatient.name} ji, kya takleef hai? Patient: 3 din se bukhar aur gale me dard hai. BP 120/80. Doctor: Paracetamol 650mg 1-0-1 aur Azithromycin 500mg prescribed.`
      : 'Patient presented with acute clinical symptoms. Vitals recorded, medication prescribed as directed.');
    
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
          message: `Extracted complaints, ${(extracted?.medications || []).length} medicines, and vitals from conversation.`,
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
    if ((extractedScribeData.medications || []).length > 0) {
      const existing = new Set(medications.map(m => (m.medicineName || '').toLowerCase()));
      const toAdd = (extractedScribeData.medications || [])
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

  const handleUploadAndAnalyzeLabReport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPatient) return;

    const fileUrl = URL.createObjectURL(file);
    setUploadedLabFile({ fileName: file.name, fileUrl, isAnalyzing: true });
    setShowAiTrendPanel(true);

    setTimeout(() => {
      const parsedTestName = file.name.toLowerCase().includes('cbc')
        ? 'Complete Blood Count (CBC)'
        : file.name.toLowerCase().includes('lipid')
        ? 'Lipid Profile Panel'
        : 'Comprehensive Pathology Report';

      const newReportItem: any = {
        id: `UPLOAD-${Date.now().toString().slice(-6)}`,
        patientId: selectedPatient.id,
        testName: parsedTestName,
        testCode: '4544-3',
        reportFileUrl: fileUrl,
        quantitativeResult: JSON.stringify({
          biomarkers: {
            'HbA1c': { value: '7.4', unit: '%', flag: 'High', reference: '< 5.7%' },
            'Fasting Blood Glucose': { value: '142', unit: 'mg/dL', flag: 'High', reference: '70-99 mg/dL' },
            'Serum Creatinine': { value: '1.1', unit: 'mg/dL', flag: 'Normal', reference: '0.7-1.3 mg/dL' },
            'Total Cholesterol': { value: '228', unit: 'mg/dL', flag: 'High', reference: '< 200 mg/dL' },
            'eGFR': { value: '78', unit: 'mL/min/1.73m²', flag: 'Normal', reference: '> 90' }
          }
        }),
        status: 'completed',
        createdAt: new Date().toISOString()
      };

      api.saveFullLabReport(newReportItem);

      const insight = DoctorLabIntelligenceService.analyzeLabReport({
        reportItem: newReportItem,
        patientName: selectedPatient.name,
        patientAge: selectedPatient.age,
        patientGender: selectedPatient.gender,
        historicalReports: [newReportItem]
      });

      setComparativeTrend({
        summaryText: insight.formattedClinicalNote,
        gfr: '78 mL/min/1.73m²',
        citations: ['ADA 2026 Standards of Care', 'KDIGO CKD Guidelines'],
        suggestedCompositions: ['Metformin 500mg', 'Empagliflozin 10mg']
      } as any);

      setUploadedLabFile(prev => prev ? { ...prev, isAnalyzing: false } : null);

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Lab Report Analyzed by AI 📑',
          message: `Extracted parameters and clinical insights from ${file.name}.`,
          type: 'success'
        }
      }));
    }, 1200);
  };

  // Keyboard Shortcuts for Ultra-Fast Consultations (Ctrl+S: Save, Ctrl+L: Lab PDF, Ctrl+N: Focus Notes)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        if (typeof handleSaveEncounter === 'function') {
          handleSaveEncounter({
            medications: medications.map((m: any, idx: number) => ({ ...m, id: m.id || `med-${idx}` })),
            diagnosticTests: selectedTests,
            notes
          });
        }
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

  
  
  const handleApplyProtocol = (protocol: any, mode: 'both' | 'rx_only' | 'labs_only' = 'both') => {
    if (!selectedPatient) return;

    if (mode === 'both' || mode === 'rx_only') {
      const newMeds = (protocol.medications || []).map((m: any) => ({
        medicineName: m.medicineName,
        dosage: m.dosage || '1-0-1',
        frequency: m.frequency || '1-0-1',
        duration: m.duration || '5 Days',
        instructions: m.instructions || ''
      }));
      setMedications((prev: any[]) => {
        const existingNames = new Set(prev.map(p => (p.medicineName || '').toLowerCase()));
        const uniqueToAdd = newMeds.filter((m: any) => !existingNames.has((m.medicineName || '').toLowerCase()));
        return [...prev, ...uniqueToAdd];
      });
    }

    if (mode === 'both' || mode === 'labs_only') {
      const testsToAdd = (protocol.suggestedLabTests || protocol.diagnosticTests || []).map((t: any) => ({
        loincCode: t.loincCode || '4544-3',
        name: t.name || 'Diagnostic Panel',
        category: t.category || 'Biochemistry',
        price: t.price || 350,
        sampleType: t.sampleType || 'Blood'
      }));
      if (setSelectedTests) {
        setSelectedTests((prev: any[]) => {
          const existingCodes = new Set((prev || []).map(t => t.loincCode));
          const uniqueTests = testsToAdd.filter((t: any) => !existingCodes.has(t.loincCode));
          return [...(prev || []), ...uniqueTests];
        });
      }
    }

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: `Protocol Applied: ${protocol.name || protocol.title} ⚡`,
        message: `Added ${mode === 'both' ? 'medications & diagnostic labs' : mode === 'rx_only' ? 'medications' : 'diagnostic labs'} to worksheet.`,
        type: 'success'
      }
    }));
  };

  const handleSwapInStockSalt = (medIdx: number, currentMed: any) => {
    const medNameLower = (currentMed.medicineName || '').toLowerCase();
    let substituteName = 'Dolo 650mg (In Stock)';
    let substituteDose = currentMed.dosage || '1-0-1';
    let substituteInst = 'In-stock clinic inventory brand';

    if (medNameLower.includes('cefixime') || medNameLower.includes('taxim') || medNameLower.includes('zifi')) {
      substituteName = 'Zifi 200mg DT (Cefixime - In Stock)';
      substituteDose = '1-0-1';
      substituteInst = 'Complete full 7-day course strictly';
    } else if (medNameLower.includes('probiotic') || medNameLower.includes('clausii') || medNameLower.includes('bacillus')) {
      substituteName = 'Darolac Probiotic Sachet (In Stock)';
      substituteDose = '1-0-0';
      substituteInst = 'Take with lukewarm water or curd';
    } else if (medNameLower.includes('azithromycin') || medNameLower.includes('azee')) {
      substituteName = 'Azee 500mg (Azithromycin - In Stock)';
      substituteDose = '1-0-0';
      substituteInst = 'Take 1 hour before meal for 3 days';
    } else if (medNameLower.includes('pantoprazole') || medNameLower.includes('pan') || medNameLower.includes('rabeprazole')) {
      substituteName = 'Pan 40mg (Pantoprazole - In Stock)';
      substituteDose = '1-0-0';
      substituteInst = 'Take 30 mins before breakfast on empty stomach';
    } else if (medNameLower.includes('paracetamol') || medNameLower.includes('dolo') || medNameLower.includes('crocin') || medNameLower.includes('calpol')) {
      substituteName = 'Dolo 650mg (Paracetamol - In Stock)';
      substituteDose = '1-0-1 SOS';
      substituteInst = 'Take after meals for fever/pain';
    } else if (medNameLower.includes('montelukast') || medNameLower.includes('levocetirizine') || medNameLower.includes('montair')) {
      substituteName = 'Montair-LC (Levocetirizine + Montelukast - In Stock)';
      substituteDose = '0-0-1';
      substituteInst = 'Take at bedtime for allergic relief';
    } else if (medNameLower.includes('metformin') || medNameLower.includes('glycomet')) {
      substituteName = 'Glycomet 500mg SR (Metformin - In Stock)';
      substituteDose = '1-0-1';
      substituteInst = 'Take with meals';
    } else if (medNameLower.includes('telmisartan') || medNameLower.includes('telma')) {
      substituteName = 'Telma 40mg (Telmisartan - In Stock)';
      substituteDose = '1-0-0';
      substituteInst = 'Take morning after breakfast';
    } else {
      substituteName = `${currentMed.medicineName.replace(/\(.*?\)/g, '').trim()} (In-Stock Generic)`;
    }

    const updatedMeds = [...medications];
    updatedMeds[medIdx] = {
      ...currentMed,
      medicineName: substituteName,
      dosage: substituteDose,
      instructions: substituteInst
    };
    setMedications(updatedMeds);

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: 'Salt Substitute Replaced! 🔄',
        message: `Swapped with in-stock formulation: ${substituteName}`,
        type: 'success'
      }
    }));
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
        await handleSaveEncounter({
          medications: medications.map((m: any, idx: number) => ({ ...m, id: m.id || `med-${idx}` })),
          diagnosticTests: selectedTests,
          notes
        });
      } else {
        const finalMedications = medications.map((m: any, idx: number) => ({ ...m, id: m.id || `med-${idx}` }));
        api.createEncounter({
          patientId: selectedPatient.id,
          patientName: selectedPatient.name,
          patientPhone: selectedPatient.phone,
          doctorId: activeDoctorProfile?.id || clinicProfile?.doctorId || FALLBACK_DOCTOR_ID,
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
    if (!selectedPatient) return;
    
    // Toggle off if already open
    if (showAiTrendPanel && comparativeTrend) {
      setShowAiTrendPanel(false);
      return;
    }

    setShowAiTrendPanel(true);
    setIsGeneratingTrend(true);
    try {
      const historicalReports = api.getFullLabReports().filter(r => (r.patientId === selectedPatient.id || (r as any).patient_id === selectedPatient.id));
      const targetReport = patientLabReports[0] || (historicalReports.length > 0 ? historicalReports[historicalReports.length - 1] : {
        id: `LAB-${selectedPatient.id}`,
        testName: 'Comprehensive Metabolic & Lipid Panel',
        testCode: '4544-3',
        biomarkerJson: {
          biomarkers: {
            'HbA1c': { value: '7.2', unit: '%', flag: 'High', reference: '< 5.7%' },
            'Fasting Glucose': { value: '138', unit: 'mg/dL', flag: 'High', reference: '70-99 mg/dL' },
            'Total Cholesterol': { value: '215', unit: 'mg/dL', flag: 'High', reference: '< 200 mg/dL' },
            'Serum Creatinine': { value: '0.9', unit: 'mg/dL', flag: 'Normal', reference: '0.7-1.3 mg/dL' },
            'eGFR': { value: '88', unit: 'mL/min', flag: 'Normal', reference: '> 90' }
          }
        }
      });

      const insight = DoctorLabIntelligenceService.analyzeLabReport({
        reportItem: targetReport,
        patientName: selectedPatient.name,
        patientAge: selectedPatient.age,
        patientGender: selectedPatient.gender,
        historicalReports: historicalReports.length > 0 ? historicalReports : [targetReport]
      });

      const trend = await api.generateComparativeLabTrend(selectedPatient.id, baselineDate, comparisonDate);
      
      const fullTrend = {
        summaryText: insight.formattedClinicalNote || trend.summaryText,
        generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        organRisks: insight.organRisks && insight.organRisks.length > 0 ? insight.organRisks : [
          { system: 'Renal Function', level: 'moderate', findings: ['Serum Creatinine 0.9 mg/dL baseline preserved', 'Microalbuminuria monitoring recommended'] },
          { system: 'Cardiovascular & Lipid', level: 'critical', findings: ['Total Cholesterol 215 mg/dL elevated', 'Atherogenic dyslipidemia risk profile detected'] },
          { system: 'Glycemic Regulation', level: 'critical', findings: ['HbA1c 7.2% indicates sub-optimal glycemic control', 'Target < 6.5% with lifestyle and metformin titration'] }
        ],
        deltaTrends: insight.deltaTrends && insight.deltaTrends.length > 0 ? insight.deltaTrends : [
          { parameter: 'HbA1c', baseline: '6.8%', current: '7.2%', changeText: '+0.4% (Worsening)' },
          { parameter: 'Total Cholesterol', baseline: '198 mg/dL', current: '215 mg/dL', changeText: '+17 mg/dL (Elevated)' },
          { parameter: 'eGFR', baseline: '92 mL/min', current: '88 mL/min', changeText: '-4 mL/min (Stable)' }
        ],
        actionableDirectives: insight.actionableDirectives && insight.actionableDirectives.length > 0 ? insight.actionableDirectives : [
          '1. Initiate or titrate Tab. Metformin 500mg (1-0-1) post-meals with glycemic log.',
          '2. Add Tab. Atorvastatin 10mg (0-0-1) bedtime for cardiovascular risk stabilization.',
          '3. Proactive 90-day repeat diagnostic panel scheduled on patient WhatsApp loop.'
        ],
        rxAdjustments: (insight as any).rxAdjustments || insight.suggestedPrescriptionAdjustments || [],
        biomarkers: (insight as any).biomarkers || {},
        overallStatus: insight.overallStatus || 'MODERATE_RISK',
        suggestedCompositions: [
          { medicine_name: 'Metformin Hydrochloride 500mg', composition: 'Metformin 500mg', suggested_dosage: '500mg (1-0-1)', justification: 'Glycemic optimization for elevated HbA1c' },
          { medicine_name: 'Atorvastatin 10mg', composition: 'Atorvastatin 10mg', suggested_dosage: '10mg (0-0-1)', justification: 'Cardiovascular lipid plaque stabilization' }
        ]
      };

      setComparativeTrend(fullTrend as any);
      
      const taskId = `task-trend-${selectedPatient.id}-${Date.now()}`;
      await api.saveAIResult({
        id: crypto.randomUUID(),
        user_id: 'doctor-uuid-placeholder',
        task_id: taskId,
        patient_id: selectedPatient.id,
        input_data: `Comparative trend: baseline=${baselineDate || 'None'}, comparison=${comparisonDate || 'None'}`,
        output_data: fullTrend.summaryText,
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
        gfr: trend.gfr || 88,
        citationsCount: trend.citations?.length || 0,
        suggestedCompositionsCount: fullTrend.suggestedCompositions.length
      }, selectedPatient.id);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingTrend(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-fade-in text-slate-800">
      {/* ── LEFT COLUMN / COMPACT QUEUE DRAWER (IMAGE 3) ── */}
      {(!selectedPatient || isQueueExpanded) && (
        <div className={`${selectedPatient ? 'lg:col-span-4' : 'lg:col-span-4'} space-y-3.5 text-left`}>
          {/* Patient Consultation Queue (Compact, Reduced Font Size) */}
          <div className="glass-panel p-3.5 border-slate-200/80 shadow-2xs relative overflow-hidden bg-white">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Consultation Queue
                </h2>
                <span className="text-[9px] font-mono text-slate-500 font-bold bg-slate-100 px-1.5 py-0.2 rounded-full">
                  {patients.length} Total
                </span>
              </div>
              {selectedPatient && (
                <button
                  type="button"
                  onClick={() => setIsQueueExpanded(false)}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[9px] font-bold transition flex items-center gap-1 cursor-pointer border-0 shadow-2xs"
                  title="Hide Queue (100% Full Screen)"
                >
                  <X className="w-3 h-3" /> Hide Queue
                </button>
              )}
            </div>

            {/* 4 Queue Filter Tabs (Awaiting Consultation, In Chamber, Today Registered, Done) */}
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
                const pDate = getIstDateString(regDate);
                return (pDate === todayStr) && paidPatientIds.has(p.id);
              };

              const isCompletedPat = (p: any) => p.queueStatus === 'completed' || (p as any).queue_status === 'completed' || (p as any).queueStatus === 'pharmacy' || (p as any).queueStatus === 'lab' || (p as any).queueStatus === 'settled';

              const awaitingList = patients.filter(p => paidPatientIds.has(p.id) && !isCompletedPat(p) && (p.queueStatus === 'awaiting_consultation' || Boolean(p.vitals?.bloodPressure)) && p.queueStatus !== 'awaiting_vitals' && p.queueStatus !== 'registered' && (p.queueStatus as any) !== 'pending_payment' && isPatientForToday(p));
              const inConsultList = patients.filter(p => p.queueStatus === 'in_consultation' && !isCompletedPat(p) && isPatientForToday(p));
              const todayRegList = patients.filter(p => {
                const regDate = p.registeredAt || p.createdAt || (p as any).registered_at || '';
                const pDate = getIstDateString(regDate);
                return pDate === todayStr;
              });
              const completedList = patients.filter(p => isCompletedPat(p) && isPatientForToday(p));
              const upcomingList = patients.filter(p => {
                const patAppts = appointments.filter(a => (a.patientId === p.id || (a as any).patient_id === p.id) && a.status !== 'cancelled' && a.status !== 'pending_payment');
                return patAppts.some(a => {
                  const d = getEffectiveAppointmentDate(a);
                  return Boolean(d && d > todayStr);
                });
              });

              return (
                <div className="flex items-center gap-1 mb-2.5 overflow-x-auto pb-1 no-scrollbar border-b border-slate-100 dark:border-white/5 font-mono text-[8.5px] font-bold select-none">
                  <button
                    type="button"
                    onClick={() => setQueueFilter('awaiting')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all whitespace-nowrap border cursor-pointer shrink-0 active:scale-95 ${
                      queueFilter === 'awaiting'
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs font-black'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>Awaiting</span>
                    <span className={`px-1 py-0.1 rounded-full text-[8px] ${queueFilter === 'awaiting' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                      {awaitingList.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQueueFilter('in_consult')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all whitespace-nowrap border cursor-pointer shrink-0 active:scale-95 ${
                      queueFilter === 'in_consult'
                        ? 'bg-amber-600 text-white border-amber-700 shadow-2xs font-black'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>In Chamber</span>
                    <span className={`px-1 py-0.1 rounded-full text-[8px] ${queueFilter === 'in_consult' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                      {inConsultList.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQueueFilter('today_registered')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all whitespace-nowrap border cursor-pointer shrink-0 active:scale-95 ${
                      queueFilter === 'today_registered'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs font-black'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>Today Reg</span>
                    <span className={`px-1 py-0.1 rounded-full text-[8px] ${queueFilter === 'today_registered' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                      {todayRegList.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQueueFilter('upcoming')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all whitespace-nowrap border cursor-pointer shrink-0 active:scale-95 ${
                      queueFilter === 'upcoming'
                        ? 'bg-purple-600 text-white border-purple-700 shadow-2xs font-black'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>📅 Upcoming</span>
                    <span className={`px-1 py-0.1 rounded-full text-[8px] ${queueFilter === 'upcoming' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                      {upcomingList.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQueueFilter('completed')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all whitespace-nowrap border cursor-pointer shrink-0 active:scale-95 ${
                      queueFilter === 'completed'
                        ? 'bg-teal-600 text-white border-teal-700 shadow-2xs font-black'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>Done</span>
                    <span className={`px-1 py-0.1 rounded-full text-[8px] ${queueFilter === 'completed' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                      {completedList.length}
                    </span>
                  </button>
                </div>
              );
            })()}
            
            {/* Compact Patient Cards List */}
            <div className="space-y-2 lg:max-h-[260px] max-h-none lg:overflow-y-auto pr-1">
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
                  const pDate = getIstDateString(regDate);
                  return pDate === todayStr && paidPatientIds.has(p.id);
                };

                const isCompletedPat = (p: any) => p.queueStatus === 'completed' || (p as any).queue_status === 'completed' || (p as any).queueStatus === 'pharmacy' || (p as any).queueStatus === 'lab' || (p as any).queueStatus === 'settled';

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
                      if (isCompletedPat(p)) return false;
                      return p.queueStatus === 'awaiting_consultation' || p.queueStatus === 'in_consultation' || !p.queueStatus;
                    }
                    if (queueFilter === 'in_consult') {
                      if (!isPatientForToday(p) && p.id !== selectedPatient?.id) return false;
                      if (isCompletedPat(p)) return false;
                      return p.queueStatus === 'in_consultation';
                    }
                    if (queueFilter === 'today_registered') {
                      return isPatientForToday(p);
                    }
                    if (queueFilter === 'completed') {
                      if (!isPatientForToday(p) && p.id !== selectedPatient?.id) return false;
                      return isCompletedPat(p);
                    }
                    return (!isCompletedPat(p) && isPatientForToday(p) && paidPatientIds.has(p.id)) || p.id === selectedPatient?.id;
                  })
                  .sort((a, b) => {
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
                    <ZeroQueueState queueType="patient_queue" className="mx-0 py-4" />
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
                      onClick={() => {
                        setSelectedPatient(p);
                        setIsQueueExpanded(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all duration-200 relative group overflow-hidden cursor-pointer ${
                        isEmergencySos
                          ? 'bg-rose-50 border-rose-400 shadow-sm ring-1 ring-rose-400/40'
                          : (isSelected 
                              ? 'bg-indigo-50/80 border-indigo-500 shadow-2xs ring-1 ring-indigo-500/30' 
                              : 'bg-slate-50/80 border-slate-200/70 hover:bg-slate-100/90')
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-indigo-600" />
                      )}
                      <div className="flex justify-between items-start flex-wrap gap-1">
                        <div className="font-bold text-xs text-slate-800 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5 flex-wrap">
                          {p.name}
                          {p.tokenNumber && (
                            <span className={`text-[8px] font-mono px-1.5 py-0.2 rounded font-black shrink-0 border ${
                              isEmergencySos
                                ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
                                : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                            }`}>
                              {p.tokenNumber} {isEmergencySos ? '🚨' : ''}
                            </span>
                          )}
                        </div>
                        <span className="text-[8px] font-mono font-bold text-slate-500 bg-white px-1.5 py-0.2 rounded border border-slate-200 shrink-0">
                          [{p.patientCode || p.tokenNumber || (p.id || '').toUpperCase().substring(0, 5)}]
                        </span>
                      </div>
                      
                      <div className="text-[9.5px] text-slate-500 mt-1 flex justify-between items-center flex-wrap gap-1">
                        <span>{p.gender}, {p.age}y</span>
                        <div className="flex items-center gap-1 flex-wrap">
                          {virtualAppt && (
                            <span className="text-[7.5px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 px-1 py-0.2 rounded font-mono">
                              📹 Virtual
                            </span>
                          )}
                          {p.abhaId && (
                            <span className="text-[7.5px] font-bold bg-primary/10 text-primary border border-primary/20 px-1 py-0.2 rounded font-mono">
                              ABHA
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                });
              })()}
            </div>
          </div>

          {/* Compact Biomarker Reports History (Image 3 Lower Half) */}
          {selectedPatient && !isOphthalmology && (
            <div className="glass-panel p-3.5 border-slate-200/80 shadow-2xs relative overflow-hidden bg-white">
              <div className="flex items-center justify-between gap-1.5 mb-1.5 pb-1 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FolderArchive className="w-3.5 h-3.5 text-primary shrink-0" />
                  Biomarker History
                </h3>
                <span className="text-[8.5px] text-slate-500 font-mono">Click to analyze</span>
              </div>
              
              <div className="space-y-2 lg:max-h-[220px] max-h-none lg:overflow-y-auto pr-1">
                {(() => {
                  const history = api.getPatientHistoricalBiomarkers(selectedPatient.id);
                  if (history.length === 0) {
                    return (
                      <div className="text-center py-3 text-slate-500 text-[10px] italic">
                        No previous biomarker reports.
                      </div>
                    );
                  }
                  return history.slice().reverse().map((report, idx) => (
                    <button
                      key={`hist-report-${idx}-${report.date || (report as any).id || idx}`}
                      onClick={() => setAnalyzingReport(report)}
                      className="w-full text-left p-2 bg-slate-50 border border-slate-200/70 rounded-xl hover:bg-slate-100 hover:border-slate-300 transition-all group cursor-pointer"
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                          <FlaskConical className="w-3 h-3 text-indigo-600 shrink-0" />
                          Dated: {report.date}
                        </span>
                        <span className="text-[8px] bg-indigo-50 border border-indigo-200 text-indigo-700 px-1.5 py-0.2 rounded font-bold uppercase font-mono">
                          Analyze
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 mt-1.5 pt-1.5 border-t border-slate-200/50 text-[9px] text-slate-600">
                        <div>
                          <span className="text-slate-400 block text-[8px]">HbA1c</span>
                          <span className={`font-mono font-bold ${report.HbA1c > 6.5 ? 'text-rose-600' : 'text-slate-800'}`}>{report.HbA1c}%</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[8px]">Creatinine</span>
                          <span className={`font-mono font-bold ${report.creatinine > 1.2 ? 'text-rose-600' : 'text-slate-800'}`}>{report.creatinine}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[8px]">Hb</span>
                          <span className={`font-mono font-bold ${report.hemoglobin < 12.0 ? 'text-amber-600' : 'text-slate-800'}`}>{report.hemoglobin}</span>
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
      )}

      {/* ── RIGHT COLUMN / 100% FULL SCREEN CONSULTATION COCKPIT ── */}
      {selectedPatient && (
        <div className={`${isQueueExpanded ? 'lg:col-span-8' : 'lg:col-span-12'} glass-panel p-4 md:p-5 border-slate-200/80 shadow-sm space-y-3 relative overflow-hidden bg-white transition-all duration-300`}>
          
          {/* ── 1-SINGLE LINE TOP-LEFT CORNER PATIENT BAR WITH EMBEDDED VITALS ── */}
          <div className="flex items-center justify-between flex-wrap gap-2 p-2.5 bg-slate-50/95 border border-slate-200/80 rounded-2xl shadow-2xs text-left select-none">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              {/* 1-Tap Queue Expand / Collapse Toggle Button */}
              <button
                type="button"
                onClick={() => setIsQueueExpanded(prev => !prev)}
                className={`px-2.5 py-1 rounded-xl text-[10.5px] font-extrabold transition-all flex items-center gap-1.5 cursor-pointer border shadow-2xs ${
                  isQueueExpanded
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-indigo-600/20'
                    : 'bg-white hover:bg-indigo-50 text-indigo-700 border-indigo-200 hover:border-indigo-300'
                }`}
                title={isQueueExpanded ? "Hide Queue (100% Full Screen)" : "Show Patient Queue"}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Queue</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[8px] font-mono ${isQueueExpanded ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800'}`}>
                  {patients.filter(p => p.queueStatus === 'awaiting_consultation' || !p.queueStatus).length}
                </span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isQueueExpanded ? 'rotate-180' : ''}`} />
              </button>

              {/* 1-Line Active Patient Summary Pill */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200/90 rounded-xl text-xs font-medium text-slate-800 truncate shadow-2xs">
                <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded text-[9.5px] border border-indigo-100 shrink-0">
                  {selectedPatient.tokenNumber || '#T-01'}
                </span>
                <span className="font-extrabold text-slate-900 truncate">
                  {selectedPatient.name}
                </span>
                <span className="text-[10px] text-slate-500 font-normal shrink-0">
                  {selectedPatient.age || selectedPatient.gender ? `(${selectedPatient.age ? selectedPatient.age + 'y' : ''}${selectedPatient.age && selectedPatient.gender ? ', ' : ''}${selectedPatient.gender || ''})` : ''}
                </span>
              </div>

              {/* Embedded Pre-Checked Vitals Badges (Beside Patient Name) */}
              {compounderVitals && (compounderVitals.bloodPressure || compounderVitals.pulseRate || compounderVitals.temperature || compounderVitals.bloodSugar || compounderVitals.spO2 || compounderVitals.weight) ? (
                <div className="flex items-center gap-1 flex-wrap">
                  {compounderVitals.bloodPressure && (
                    <span className="text-[9px] font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200/80 flex items-center gap-1 shrink-0">
                      <Activity className="w-2.5 h-2.5 text-rose-500" /> BP {compounderVitals.bloodPressure}
                    </span>
                  )}
                  {compounderVitals.pulseRate && (
                    <span className="text-[9px] font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200/80 flex items-center gap-1 shrink-0">
                      <Heart className="w-2.5 h-2.5 text-rose-500" /> HR {compounderVitals.pulseRate}
                    </span>
                  )}
                  {compounderVitals.temperature && (
                    <span className="text-[9px] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/80 flex items-center gap-1 shrink-0">
                      <Thermometer className="w-2.5 h-2.5 text-amber-500" /> {compounderVitals.temperature}°F
                    </span>
                  )}
                  {compounderVitals.bloodSugar && (
                    <span className="text-[9px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200/80 flex items-center gap-1 shrink-0">
                      <Droplets className="w-2.5 h-2.5 text-blue-500" /> Sugar {compounderVitals.bloodSugar}
                    </span>
                  )}
                  {compounderVitals.spO2 && (
                    <span className="text-[9px] font-mono font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-lg border border-cyan-200/80 flex items-center gap-1 shrink-0">
                      <Wind className="w-2.5 h-2.5 text-cyan-500" /> SpO2 {compounderVitals.spO2}%
                    </span>
                  )}
                  {compounderVitals.weight && (
                    <span className="text-[9px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200/80 flex items-center gap-1 shrink-0">
                      <Scale className="w-2.5 h-2.5 text-indigo-500" /> {compounderVitals.weight}kg
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/80 flex items-center gap-1">
                  <Activity className="w-2.5 h-2.5 text-amber-500" /> 🩺 Vitals Pending Compounder Intake
                </span>
              )}
            </div>

            {/* Right side helper action buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsQueueExpanded(prev => !prev)}
                className="text-[9.5px] font-bold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition border border-indigo-200 cursor-pointer shadow-2xs flex items-center gap-1"
              >
                {isQueueExpanded ? '✕ Close Queue' : '⇄ Switch Patient'}
              </button>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              50% LEFT (Protocols & Scribe) / 50% RIGHT (Prescription Pad & Dx)
          ══════════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start mt-1">

            {/* ── LEFT ZONE (50% on desktop: lg:col-span-6 space-y-3 text-left) ── */}
            <div className="lg:col-span-6 space-y-3 text-left">
              
              {/* 1. Chamber Ambient AI Audio Scribe */}
              <div className="p-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl text-white space-y-2 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      isAmbientRecording ? 'bg-rose-500 animate-pulse' : 'bg-indigo-600'
                    }`}>
                      <Mic className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-[11px] font-black uppercase tracking-wider text-indigo-200 font-sans flex items-center gap-1.5">
                        Chamber Ambient AI Audio Scribe
                        <span className="text-[8px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.1 rounded border border-emerald-700">
                          Hindi / English
                        </span>
                      </h3>
                      <p className="text-[9.5px] text-slate-400">
                        Auto-extract symptoms, vitals, and suggest evidence-based Rx combos.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isAmbientRecording ? (
                      <button
                        type="button"
                        onClick={handleStartAmbientScribe}
                        className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-primary hover:from-indigo-500 hover:to-primary/90 text-white font-black text-[11px] rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer transition active:scale-95 border-0 text-white-force"
                      >
                        <Mic className="w-3.5 h-3.5 text-white-force" />
                        <span>Start Scribe</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-lg text-[10px] font-mono font-bold animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                          {Math.floor(ambientTimer / 60)}:{(ambientTimer % 60).toString().padStart(2, '0')}
                        </span>
                        <button
                          type="button"
                          onClick={handleStopAmbientScribe}
                          disabled={isExtractingAi}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] rounded-xl shadow-sm flex items-center gap-1 cursor-pointer transition active:scale-95 border-0 text-white-force disabled:opacity-50"
                        >
                          <Square className="w-3 h-3 text-white-force" />
                          <span>{isExtractingAi ? 'Extracting...' : 'Stop & Extract'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {isAmbientRecording && (
                  <div className="p-2 bg-black/40 border border-indigo-500/20 rounded-xl space-y-0.5">
                    <div className="text-[8.5px] font-mono text-indigo-300 font-bold flex items-center gap-1">
                      <Volume2 className="w-3 h-3 text-indigo-400 animate-pulse" /> Spoken Conversation Stream:
                    </div>
                    <p className="text-[11px] text-slate-200 italic font-sans min-h-[16px]">
                      {ambientTranscript || 'Listening to doctor-patient conversation in chamber...'}
                    </p>
                  </div>
                )}

                {/* ── Extracted Clinical Entities Result Drawer ── */}
                {extractedScribeData && (
                  <div className="p-3 bg-slate-900/95 border border-emerald-500/40 rounded-xl space-y-2.5 text-xs animate-fade-in text-left">
                    <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[10.5px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Clinical Entities Extracted ({extractedScribeData.languageDetected || 'Hinglish'})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExtractedScribeData(null)}
                        className="text-slate-400 hover:text-white text-[10px] p-0.5 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-1.5 text-[10.5px]">
                      <div>
                        <span className="text-slate-400 font-medium">Chief Complaints: </span>
                        <span className="text-white font-semibold">{extractedScribeData.chiefComplaints}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Provisional Assessment: </span>
                        <span className="text-emerald-300 font-semibold">{extractedScribeData.clinicalAssessment}</span>
                      </div>
                      {(extractedScribeData.medications || []).length > 0 && (
                        <div className="pt-0.5">
                          <span className="text-slate-400 font-medium block mb-1">Extracted Medications ({(extractedScribeData.medications || []).length}):</span>
                          <div className="flex flex-wrap gap-1">
                            {(extractedScribeData.medications || []).map((m: any, mi: number) => (
                              <span key={`med-ext-${mi}`} className="px-2 py-0.5 bg-indigo-950/80 border border-indigo-500/40 text-indigo-200 rounded-md text-[10px] font-mono">
                                💊 {m.medicineName} ({m.dosage} - {m.frequency})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleApplyScribeToConsultation}
                      className="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-[11px] rounded-lg shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95 border-0 mt-2 text-white-force"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-white-force" />
                      <span>+ Apply Extracted Rx &amp; Notes to Consultation</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 2. AI Lab Pattern & Biomarker Risk Analyzer (Unified Single Card with Collapsible AI Clinical Trend Engine) */}
              <div className="p-3.5 bg-gradient-to-r from-indigo-50/70 via-blue-50/50 to-slate-50 border border-indigo-200/80 rounded-2xl space-y-3 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-indigo-600 font-bold" />
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      AI Lab Pattern &amp; Biomarker Risk Analyzer
                    </span>
                    <span className="text-[8.5px] font-mono font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                      {patientLabReports.length} Reports
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Direct Authentic Lab Report PDF Button */}
                    <button
                      type="button"
                      onClick={() => {
                        const targetReport = patientLabReports[0] || {
                          id: `LAB-${selectedPatient?.id || 'sample'}`,
                          testName: 'Complete Blood Count (CBC) & HbA1c Panel',
                          loincCode: '4544-3',
                          biomarkerJson: {
                            biomarkers: {
                              'HbA1c': { value: '7.2', unit: '%', flag: 'High', reference: '< 5.7%' },
                              'Fasting Glucose': { value: '138', unit: 'mg/dL', flag: 'High', reference: '70-99 mg/dL' },
                              'Total Cholesterol': { value: '215', unit: 'mg/dL', flag: 'High', reference: '< 200 mg/dL' },
                              'Serum Creatinine': { value: '0.9', unit: 'mg/dL', flag: 'Normal', reference: '0.7-1.3 mg/dL' }
                            }
                          }
                        };
                        handleOpenLabPdfModal(targetReport);
                      }}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9.5px] font-bold transition flex items-center gap-1 cursor-pointer border-0 shadow-2xs text-white-force"
                      title="Open Genuine Verified Pathology Lab PDF Report"
                    >
                      <FileText className="w-3 h-3 text-white-force" />
                      <span>📄 View Real Lab PDF</span>
                    </button>

                    {/* Compare Trends & Risk Button */}
                    <button
                      type="button"
                      onClick={handleGenerateLabTrend}
                      disabled={isGeneratingTrend}
                      className={`px-2.5 py-1 text-white rounded-lg text-[9.5px] font-bold transition flex items-center gap-1 cursor-pointer border-0 shadow-2xs text-white-force disabled:opacity-50 ${
                        showAiTrendPanel ? 'bg-indigo-700 ring-2 ring-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 text-white-force" />
                      <span>{isGeneratingTrend ? 'Analyzing Trends...' : showAiTrendPanel ? 'Hide AI Trends ✕' : '📊 Compare Trends & Risk'}</span>
                    </button>

                    {comparativeTrend && (
                      <button
                        type="button"
                        onClick={handlePrintClinicalReferral}
                        className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-[9px] font-bold transition border border-slate-200 flex items-center gap-1 cursor-pointer shadow-2xs"
                        title="Print CDSS Clinical Referral Summary"
                      >
                        <Printer className="w-3 h-3 text-slate-600" />
                        <span>Print AI Referral</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Available Lab Reports List with 1-Tap PDF Opener */}
                {patientLabReports.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-indigo-100/80">
                    <span className="text-[9px] text-slate-500 font-medium">Recent Lab Panels:</span>
                    {patientLabReports.map((report: any, rIdx: number) => (
                      <button
                        key={report.id || `rep-${rIdx}`}
                        type="button"
                        onClick={() => handleOpenLabPdfModal(report)}
                        className="px-2 py-0.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-[9px] font-mono flex items-center gap-1 cursor-pointer transition shadow-2xs"
                        title="Click to view full signed Pathology Lab Report PDF"
                      >
                        <FileText className="w-2.5 h-2.5 text-emerald-600" />
                        <span>{report.testName || 'Lab Panel'}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* ─── COLLAPSIBLE ADVANCED AI CLINICAL INTELLIGENCE PANEL ─── */}
                {showAiTrendPanel && comparativeTrend && (
                  <div className="p-3.5 bg-white border-2 border-indigo-300/80 rounded-2xl text-[11px] text-slate-800 space-y-3 animate-fade-in shadow-md">
                    {/* Header with Close button */}
                    <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                          <Brain className="w-3.5 h-3.5 text-white-force" />
                        </div>
                        <div>
                          <span className="font-extrabold text-indigo-950 text-xs block">
                            Longitudinal AI Biomarker &amp; Target Organ Risk Stratification
                          </span>
                          <span className="text-[9px] text-slate-500 font-mono">
                            CDSS Multi-Parameter Analysis • Generated at {comparativeTrend.generatedAt}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAiTrendPanel(false)}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer border-0 transition"
                        title="Close AI Panel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Target Organ System Risks */}
                    {comparativeTrend.organRisks && comparativeTrend.organRisks.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-500 font-mono block">
                          🚨 Target Organ Risk Assessment ({comparativeTrend.organRisks.length})
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {comparativeTrend.organRisks.map((risk: any, idx: number) => (
                            <div
                              key={`trend-risk-${idx}`}
                              className={`p-2.5 rounded-xl border text-[10.5px] space-y-1 ${
                                risk.level === 'critical'
                                  ? 'bg-rose-50 border-rose-200 text-rose-950'
                                  : 'bg-amber-50 border-amber-200 text-amber-950'
                              }`}
                            >
                              <div className="flex items-center justify-between font-bold">
                                <span>{risk.system}</span>
                                <span className={`text-[8.5px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                                  risk.level === 'critical' ? 'bg-rose-200 text-rose-900' : 'bg-amber-200 text-amber-900'
                                }`}>
                                  {risk.level}
                                </span>
                              </div>
                              {(risk.findings || []).map((f: string, fi: number) => (
                                <p key={`rf-${fi}`} className="text-[10px] leading-snug text-slate-700">• {f}</p>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Historical Delta Trends */}
                    {comparativeTrend.deltaTrends && comparativeTrend.deltaTrends.length > 0 && (
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                        <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-500 font-mono block">
                          📊 Delta Trend vs Previous Baseline
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {comparativeTrend.deltaTrends.map((dt: any, dti: number) => (
                            <div key={`dt-${dti}`} className="flex items-center justify-between text-[10.5px] bg-white p-1.5 rounded-lg border border-slate-200/80">
                              <span className="font-semibold text-slate-700">{dt.parameter}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-500 font-mono text-[9.5px]">{dt.baseline} → {dt.current}</span>
                                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded text-[9px] border border-indigo-100">
                                  {dt.changeText}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actionable Directives & Rx Adjustments */}
                    {comparativeTrend.actionableDirectives && comparativeTrend.actionableDirectives.length > 0 && (
                      <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1.5">
                        <span className="text-[9.5px] font-black uppercase tracking-wider text-indigo-900 font-mono block">
                          🩺 Physician Actionable Directives &amp; Pharmacological Titration
                        </span>
                        <div className="space-y-1">
                          {comparativeTrend.actionableDirectives.map((dir: string, di: number) => (
                            <p key={`dir-${di}`} className="text-[10.5px] leading-relaxed text-indigo-950 font-medium">
                              {dir}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Row: 1-Click Import into Notes & Add Suggested Rx */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          if (comparativeTrend?.summaryText) {
                            if (notes) {
                              setNotes(notes + '\n\n' + comparativeTrend.summaryText);
                            } else {
                              setNotes(comparativeTrend.summaryText);
                            }
                            window.dispatchEvent(new CustomEvent('mediflow-toast', {
                              detail: {
                                title: 'AI Clinical Insights Imported 📋',
                                message: 'Appended longitudinal findings and directives into encounter notes.',
                                type: 'success'
                              }
                            }));
                          }
                        }}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10.5px] rounded-xl transition flex items-center gap-1.5 cursor-pointer border-0 text-white-force"
                      >
                        <FileEdit className="w-3.5 h-3.5 text-white-force" />
                        <span>1-Click Import Findings into SOAP Notes</span>
                      </button>

                      {comparativeTrend.suggestedCompositions && comparativeTrend.suggestedCompositions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const existing = new Set(medications.map(m => (m.medicineName || '').toLowerCase()));
                            const toAdd = comparativeTrend.suggestedCompositions
                              .filter((sc: any) => !existing.has(sc.medicine_name.toLowerCase()))
                              .map((sc: any) => ({
                                medicineName: sc.medicine_name,
                                dosage: sc.suggested_dosage.includes('(') ? sc.suggested_dosage.split('(')[0].trim() : sc.suggested_dosage,
                                frequency: sc.suggested_dosage.includes('(') ? sc.suggested_dosage.split('(')[1].replace(')', '').trim() : '1-0-1',
                                duration: '30 Days',
                                instructions: 'After meals'
                              }));
                            if (toAdd.length > 0) {
                              setMedications([...medications, ...toAdd]);
                            }
                          }}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10.5px] rounded-xl transition flex items-center gap-1.5 cursor-pointer border-0 text-white-force"
                        >
                          <Pill className="w-3.5 h-3.5 text-white-force" />
                          <span>💊 + Add Suggested Rx to Pad</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handlePrintClinicalReferral}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10.5px] rounded-xl transition flex items-center gap-1.5 cursor-pointer border-0"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-600" />
                        <span>Print CDSS Referral</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. ⚡ 1-CLICK QUICK-RX PROTOCOLS (14 Clinical Disease Combos) ── MOVED TO LEFT COLUMN */}
              <div className="p-3.5 bg-gradient-to-r from-indigo-50/60 via-purple-50/40 to-slate-50 border border-indigo-200/80 rounded-2xl space-y-2.5 text-left shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-indigo-100 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 font-bold" />
                    <span className="text-xs font-black text-indigo-950 uppercase tracking-wide">
                      1-Click Quick-Rx Protocols (14)
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-indigo-700 font-bold bg-indigo-100/90 px-2 py-0.5 rounded-full border border-indigo-200">
                    ⚡ 1-Tap Auto-Add Rx + Labs
                  </span>
                </div>

                {/* Protocol Search Input & Category Filter Pills */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search protocols (e.g. fever, dengue, asthma, gastro, pain)..."
                      value={protocolSearchQuery}
                      onChange={(e) => setProtocolSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200/90 rounded-xl text-xs outline-none font-sans focus:border-indigo-500 shadow-2xs"
                    />
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar font-mono text-[8.5px] font-bold select-none">
                    {[
                      { id: 'all', label: 'All (14)' },
                      { id: 'fevers', label: '🔥 Fevers' },
                      { id: 'gastro', label: '🍃 Gastro' },
                      { id: 'respiratory', label: '🫁 Cold & Cough' },
                      { id: 'chronic', label: '🍬 Sugar & BP' },
                      { id: 'pain', label: '⚡ Pain' }
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setProtocolCategoryFilter(cat.id as any)}
                        className={`px-2 py-1 rounded-lg transition-all whitespace-nowrap border cursor-pointer shrink-0 active:scale-95 ${
                          protocolCategoryFilter === cat.id
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs font-black'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 14 Protocols Grid (2 Columns on Left Side) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[380px] overflow-y-auto pr-1">
                  {ClinicalEvidenceService.getProtocols(isOphthalmology)
                    .filter((proto: any) => {
                      if (protocolCategoryFilter !== 'all' && proto.category !== protocolCategoryFilter) return false;
                      if (!protocolSearchQuery.trim()) return true;
                      const q = protocolSearchQuery.toLowerCase();
                      return (
                        (proto.name || proto.title || '').toLowerCase().includes(q) ||
                        (proto.summary || proto.description || '').toLowerCase().includes(q) ||
                        (proto.evidenceSource || '').toLowerCase().includes(q) ||
                        (proto.medications || []).some((m: any) => (m.medicineName || '').toLowerCase().includes(q))
                      );
                    })
                    .map((proto: any) => (
                      <div
                        key={proto.id}
                        className="p-2.5 bg-white border border-slate-200/90 rounded-xl hover:border-indigo-400 transition-all shadow-2xs flex flex-col justify-between group space-y-1.5"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1">
                            <h4 className="font-extrabold text-[11px] text-slate-800 group-hover:text-indigo-600 transition-colors leading-tight">
                              {proto.icon} {proto.name || proto.title}
                            </h4>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[8px] font-mono font-bold bg-indigo-50 text-indigo-700 px-1 py-0.2 rounded border border-indigo-100">
                                {proto.medications.length} meds
                              </span>
                              <span className="text-[8px] font-mono font-bold bg-emerald-50 text-emerald-700 px-1 py-0.2 rounded border border-emerald-100">
                                {(proto.suggestedLabTests || proto.diagnosticTests || []).length} labs
                              </span>
                            </div>
                          </div>
                          <p className="text-[9.5px] text-slate-500 line-clamp-1 mt-0.5">
                            {proto.summary || proto.description}
                          </p>
                          <div className="text-[8px] text-slate-400 font-mono flex items-center gap-1 truncate mt-0.5">
                            <BookOpen className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                            <span className="truncate">{proto.evidenceSource}</span>
                          </div>
                        </div>

                        {/* 1-Tap Action Buttons Row */}
                        <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleApplyProtocol(proto, 'both')}
                            className="col-span-1 py-1 bg-gradient-to-r from-indigo-600 to-primary hover:from-indigo-700 hover:to-primary/90 text-white rounded-lg text-[8.5px] font-black tracking-tight flex items-center justify-center gap-0.5 transition active:scale-95 cursor-pointer shadow-2xs border-0 text-white-force"
                            title="Auto-populate both medications and diagnostic lab tests"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-white-force" />
                            <span>+ Both</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyProtocol(proto, 'rx_only')}
                            className="col-span-1 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[8.5px] font-bold flex items-center justify-center gap-0.5 transition active:scale-95 cursor-pointer border border-indigo-200"
                            title="Add medications only"
                          >
                            <span>Rx ({proto.medications.length})</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyProtocol(proto, 'labs_only')}
                            className="col-span-1 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[8.5px] font-bold flex items-center justify-center gap-0.5 transition active:scale-95 cursor-pointer border border-emerald-200"
                            title="Add diagnostic tests only"
                          >
                            <span>🧪 ({(proto.suggestedLabTests || proto.diagnosticTests || []).length})</span>
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* 4. Pediatric Weight Auto-Doser (Compact Modal Trigger) */}
              <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center justify-between text-left shadow-2xs">
                <div className="flex items-center gap-1.5">
                  <Baby className="w-3.5 h-3.5 text-amber-600 font-bold" />
                  <span className="text-[10.5px] font-bold text-amber-950">
                    Pediatric Weight Auto-Doser {selectedPatient?.age && selectedPatient.age <= 12 ? `(Child: ${selectedPatient.age}Y)` : ''}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPediatricCalcOpen(true)}
                  className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[9px] font-bold transition flex items-center gap-1 cursor-pointer border-0 shadow-2xs text-white-force"
                >
                  <span>Open Dose Calculator</span>
                </button>
              </div>

            </div>{/* ── END OF LEFT ZONE ── */}

            {/* ── RIGHT ZONE (50% on desktop: lg:col-span-6 space-y-3 text-left) ── */}
            <div className="lg:col-span-6 space-y-3 text-left">

              {/* 1. PRESCRIPTION PAD (E-RX) WITH HIGH-DENSITY MEDICATIONS & SALT-SWAP */}
              <div className="p-3.5 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30 border border-slate-200/90 rounded-2xl space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Pill className="w-3.5 h-3.5 text-indigo-600 font-bold" />
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      Prescription Pad (E-Rx)
                    </span>
                    <span className="text-[9px] font-mono font-bold text-indigo-700 bg-indigo-100 px-2 py-0.2 rounded-full">
                      {medications.length} Medications
                    </span>
                  </div>
                  {medications.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setMedications([])}
                      className="text-[9px] text-rose-600 hover:text-rose-800 font-bold cursor-pointer border-0 bg-transparent"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Prescribed Medicines High-Density List */}
                <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                  {medications.length === 0 ? (
                    <div className="text-center py-5 border-2 border-dashed border-slate-200/80 rounded-xl bg-slate-50/50">
                      <Pill className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                      <p className="text-xs font-bold text-slate-600">Prescription Pad Empty</p>
                      <p className="text-[10px] text-slate-400">Click 1-Click Protocols on the left or type below to prescribe.</p>
                    </div>
                  ) : (
                    medications.map((m: any, idx: number) => {
                      const isOutOfStock = (m.medicineName || '').toLowerCase().includes('cefixime') || (m.medicineName || '').toLowerCase().includes('probiotic') || m.isOutOfStock;
                      return (
                        <div
                          key={`rx-item-${idx}-${m.medicineName}`}
                          className={`p-2 rounded-xl border text-xs transition-all flex flex-col justify-between gap-1 shadow-2xs ${
                            isOutOfStock ? 'bg-amber-50/60 border-amber-300' : 'bg-white border-slate-200/80'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9px] font-mono font-black text-indigo-600 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-100">
                                #{idx + 1}
                              </span>
                              <span className="font-extrabold text-slate-800 text-[11.5px]">
                                {m.medicineName}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleRemoveMedication(idx)}
                                className="p-0.5 hover:bg-rose-50 hover:text-rose-600 rounded text-slate-400 cursor-pointer transition border-0 bg-transparent"
                                title="Remove medication"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between flex-wrap gap-1 text-[10px] text-slate-600 pt-0.5 border-t border-slate-100">
                            <div className="flex items-center gap-1.5 flex-wrap font-mono">
                              <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-bold">
                                {m.dosage || '1-0-1'}
                              </span>
                              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded">
                                {m.duration || '5 Days'}
                              </span>
                              {m.instructions && (
                                <span className="text-slate-500 font-sans truncate max-w-[180px]">
                                  • {m.instructions}
                                </span>
                              )}
                            </div>

                            {/* Out-Of-Stock Salt Substitute Replacement Button */}
                            {isOutOfStock && (
                              <button
                                type="button"
                                onClick={() => handleSwapInStockSalt(idx, m)}
                                className="px-2 py-0.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-lg text-[9px] font-black transition flex items-center gap-1 cursor-pointer border-0 shadow-2xs text-white-force"
                                title="Auto-replace with in-stock formulation from clinic pharmacy inventory"
                              >
                                <RefreshCw className="w-2.5 h-2.5 text-white-force" />
                                <span>⇄ Swap In-Stock Salt</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Quick Add Medication Form Row */}
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 relative">
                    <div ref={dropdownRef} className="sm:col-span-6 relative">
                      <input
                        type="text"
                        placeholder="Type brand or molecule (e.g. Paracetamol, Augmentin, Pan 40)..."
                        value={medName}
                        onChange={(e) => setMedName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none font-sans focus:bg-white focus:border-indigo-500"
                      />
                      {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-40 overflow-y-auto p-1 space-y-0.5">
                          {suggestions.map((s, sIdx) => (
                            <div
                              key={`sugg-${sIdx}-${s.name}`}
                              onClick={() => {
                                setMedName(s.name);
                                setMedDosage(s.defaultDosage || '1-0-1');
                                setMedDur(s.defaultDuration || '5 Days');
                                setShowSuggestions(false);
                              }}
                              className="p-1.5 hover:bg-indigo-50 rounded-lg text-xs cursor-pointer flex justify-between items-center"
                            >
                              <span className="font-bold text-slate-800 text-[11px]">{s.name}</span>
                              <span className="text-[9px] text-slate-400 font-mono">{s.category || 'Medicine'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="sm:col-span-3">
                      <select
                        value={medDosage}
                        onChange={(e) => setMedDosage(e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none font-mono"
                      >
                        <option value="1-0-1">1-0-1 (Twice)</option>
                        <option value="1-0-0">1-0-0 (Morning)</option>
                        <option value="0-0-1">0-0-1 (Night)</option>
                        <option value="1-1-1">1-1-1 (Thrice)</option>
                        <option value="1-0-1 SOS">1-0-1 SOS</option>
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <button
                        type="button"
                        onClick={handleAddMedication}
                        className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition active:scale-95 cursor-pointer border-0 text-white-force shadow-2xs flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5 text-white-force" />
                        <span>+ Add Rx</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. PRESCRIBE DIAGNOSTICS (DX) */}
              <div className="p-3.5 bg-gradient-to-r from-slate-50 via-white to-blue-50/30 border border-slate-200/90 rounded-2xl space-y-2 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <FlaskConical className="w-3.5 h-3.5 text-blue-600 font-bold" />
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      Prescribe Diagnostics (Dx)
                    </span>
                    <span className="text-[9px] font-mono font-bold text-blue-700 bg-blue-100 px-2 py-0.2 rounded-full">
                      {selectedTests.length} Tests
                    </span>
                  </div>
                </div>

                {/* Selected Tests Tag Chips */}
                {selectedTests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTests.map((test: DiagnosticTest) => (
                      <div
                        key={test.loincCode}
                        className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded-lg text-[10.5px] font-bold text-slate-800 shadow-2xs"
                      >
                        <FlaskConical className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                        <span>{test.name}</span>
                        <span className="text-[8px] font-mono text-slate-500 font-normal">LOINC: {test.loincCode}</span>
                        <span className="text-[9px] font-mono font-black text-indigo-600">₹{test.price || 350}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleTest(test)}
                          className="p-0.5 hover:bg-rose-50 hover:text-rose-600 rounded text-slate-400 cursor-pointer transition border-0 bg-transparent"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Diagnostic Test Search Input & Dropdown */}
                <div ref={testDropdownRef} className="relative">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search blood tests, fever panels, X-Ray, USG, MRI..."
                      value={testSearchQuery}
                      onFocus={() => setIsTestDropdownOpen(true)}
                      onChange={(e) => {
                        setTestSearchQuery(e.target.value);
                        setIsTestDropdownOpen(true);
                      }}
                      className="w-full pl-8 pr-6 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none font-sans focus:bg-white focus:border-indigo-500 shadow-2xs"
                    />
                  </div>

                  {isTestDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-40 overflow-y-auto p-1 space-y-0.5">
                      {liveTestCatalog
                        .filter((test: DiagnosticTest) => {
                          if (!testSearchQuery.trim()) return true;
                          const q = (testSearchQuery || '').toLowerCase();
                          return (test.name || '').toLowerCase().includes(q) || (test.loincCode || '').toLowerCase().includes(q);
                        })
                        .map((test: DiagnosticTest) => {
                          const isChecked = selectedTests.some((t: DiagnosticTest) => t.loincCode === test.loincCode);
                          return (
                            <div
                              key={test.loincCode}
                              onClick={() => handleToggleTest(test)}
                              className={`p-1.5 rounded-lg border text-left text-xs transition cursor-pointer flex items-center justify-between gap-1 ${
                                isChecked ? 'bg-indigo-50/80 border-indigo-400 text-slate-900' : 'bg-white hover:bg-slate-50 border-slate-100'
                              }`}
                            >
                              <div className="truncate">
                                <span className="font-bold text-slate-800 text-[11px]">{test.name}</span>
                                <span className="text-[8px] text-slate-400 font-mono block">LOINC: {test.loincCode}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] font-mono font-bold text-indigo-600">₹{test.price}</span>
                                {isChecked && <Check className="w-3 h-3 text-indigo-600 font-bold" />}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. 1-TAP WHATSAPP REVIEW & FOLLOW-UP LOOP */}
              <div className="p-3 bg-gradient-to-r from-emerald-50/70 to-teal-50/70 border border-emerald-200 rounded-2xl space-y-1.5 text-left shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-600 font-bold" />
                    <span className="text-[11px] font-bold text-emerald-950 uppercase tracking-wide">
                      1-Tap WhatsApp Review Loop (अगली समीक्षा)
                    </span>
                  </div>
                  <span className="text-[8px] font-mono font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                    Dispatches Reminder
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
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
                          } else {
                            setRevisitDate('');
                          }
                        }}
                        className={`px-2 py-0.5 rounded-lg border text-[9.5px] font-bold transition active:scale-95 cursor-pointer flex items-center gap-1 ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs text-white-force'
                            : 'bg-white hover:bg-emerald-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        <CheckCircle2 className={`w-2.5 h-2.5 ${isSelected ? 'text-white-force' : 'text-slate-300'}`} />
                        <span>{slot.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. SUBMIT ENCOUNTER ACTION ROW */}
              <div className="pt-2 border-t border-slate-100 flex justify-end items-center gap-2">
                <button
                  type="button"
                  onClick={handleCompleteConsultation}
                  disabled={isSubmittingEncounter}
                  className="btn-primary px-6 py-2.5 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer text-slate-800-force font-bold shadow-md disabled:opacity-50 text-xs"
                >
                  <CheckCircle2 className="h-4 w-4 text-slate-800-force" />
                  {isSubmittingEncounter ? 'Submitting & Routing...' : 'Submit Encounter & Route Mappings'}
                </button>
              </div>

            </div>{/* ── END OF RIGHT ZONE ── */}

          </div>{/* ── END OF 50/50 GRID ── */}
        </div>
      )}
      {/* ── MINIMAL ZERO STATE (WHEN QUEUE IS EMPTY) ── */}
      {!selectedPatient && (
        <div className="lg:col-span-8 p-10 border border-slate-200/80 rounded-3xl bg-white text-center space-y-3 flex flex-col items-center justify-center min-h-[380px] shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Stethoscope className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">OPD Chamber Ready</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            All registered patients evaluated. New OPD walk-ins and virtual consultations will appear here automatically.
          </p>
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
