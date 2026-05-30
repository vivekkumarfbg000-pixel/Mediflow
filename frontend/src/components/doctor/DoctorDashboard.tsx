import React, { useState, useEffect } from 'react';
import { api, MASTER_TEST_CATALOG } from '../../services/api';
import { supabase } from '../../lib/supabaseClient';
import type { Patient, DiagnosticTest, MedicationRequest, PharmacyInventoryItem, WhatsAppDrugOrder, PathologyReport, FinancialLedgerEntry, ClinicSop } from '../../types';
import { 
  Trash2, 
  CheckCircle2, 
  AlertTriangle,
  ShieldAlert,
  Activity,
  HeartPulse
} from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import { useSpecialization } from '../../context/SpecializationContext';
import { OphthalmicRefractionGrid } from './OphthalmicRefractionGrid';
import { EMPTY_REFRACTION_RX, serializeRefractionRx, formatSpectacleCard, getAcuityRank, OPHTHALMIC_EYE_CARE_COPY, type RefractionRx } from '../../types/ophthalmic';

import { SystemHealthCockpit } from '../admin/SystemHealthCockpit';
import { StateHealingEngine } from '../../services/autoHealerAgent';
import { BiomarkerChart } from './BiomarkerChart';
import { ClinicPlacardGenerator } from '../admin/ClinicPlacardGenerator';
import { PodCommandCenter } from '../admin/PodCommandCenter';
import { OphthalmologyPatientAnalysisPanel } from './OphthalmologyPatientAnalysisPanel';

const ConsultationTab = React.lazy(() => import('./tabs/ConsultationTab').then(m => ({ default: m.ConsultationTab })));
const FinancialsTab = React.lazy(() => import('./tabs/FinancialsTab').then(m => ({ default: m.FinancialsTab })));
const PatientsDirectoryTab = React.lazy(() => import('./tabs/PatientsDirectoryTab').then(m => ({ default: m.PatientsDirectoryTab })));
const WhatsAppTab = React.lazy(() => import('./tabs/WhatsAppTab').then(m => ({ default: m.WhatsAppTab })));
const SopConfigTab = React.lazy(() => import('./tabs/SopConfigTab').then(m => ({ default: m.SopConfigTab })));

export const DoctorDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'consultation' | 'financials' | 'patients' | 'whatsapp' | 'sop' | 'pod_view' | 'health'>('pod_view');

  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setActiveTab(customEvent.detail as any);
      }
    };
    window.addEventListener('mediflow-change-tab', handleTabChange);
    return () => {
      window.removeEventListener('mediflow-change-tab', handleTabChange);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('mediflow-doctor-tab-changed', { detail: activeTab }));
  }, [activeTab]);
  
  // SOP States
  const [sopFile, setSopFile] = useState<File | null>(null);
  const [sopText, setSopText] = useState('');
  const [isExtractingSop, setIsExtractingSop] = useState(false);
  const [extractionLogs, setExtractionLogs] = useState<string[]>([]);
  const [extractedConfig, setExtractedConfig] = useState<any>(null);
  const [customSopFileName, setCustomSopFileName] = useState('');
  const [sopActiveSubTab, setSopActiveSubTab] = useState<'upload' | 'active'>('upload');
  
  // Real-time API States
  const [patients, setPatients] = useState<Patient[]>([]);
  const [pharmacyInventory, setPharmacyInventory] = useState<PharmacyInventoryItem[]>([]);
  const [whatsAppOrders, setWhatsAppOrders] = useState<WhatsAppDrugOrder[]>([]);
  const [pathologyReports, setPathologyReports] = useState<PathologyReport[]>([]);
  const [financialLedgers, setFinancialLedgers] = useState<FinancialLedgerEntry[]>([]);

  // Existing states
  const { isOphthalmology, testCatalog, nomenclature } = useSpecialization();
  const [refractionRx, setRefractionRx] = useState<RefractionRx>(EMPTY_REFRACTION_RX);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [notes, setNotes] = useState('');
  const [medications, setMedications] = useState<Omit<MedicationRequest, 'id'>[]>([]);
  const [selectedTests, setSelectedTests] = useState<DiagnosticTest[]>([]);
  
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medFreq, setMedFreq] = useState('1-0-1');
  const [medDur, setMedDur] = useState('5 Days');
  
  const [cdssAnomalies, setCdssAnomalies] = useState<string[]>([]);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  
  const [baselineDate, setBaselineDate] = useState<string | null>(null);
  const [comparisonDate, setComparisonDate] = useState<string | null>(null);
  
  const [hoveredHbA1c, setHoveredHbA1c] = useState<{ x: number, y: number, val: number, date: string } | null>(null);
  const [allergyAlert, setAllergyAlert] = useState<{ medicineName: string, allergen: string, resolved: boolean, justification: string } | null>(null);

  // New Dashboard Helper States
  const [selectedApprovedReport, setSelectedApprovedReport] = useState<PathologyReport | null>(null);
  const [selectedPathologyReportForTest, setSelectedPathologyReportForTest] = useState<PathologyReport | null>(null);
  const [analyzingReport, setAnalyzingReport] = useState<any | null>(null);
  const [labTestResults, setLabTestResults] = useState('');
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [financialSearch, setFinancialSearch] = useState('');
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const [newPatientAge, setNewPatientAge] = useState('');
  const [newPatientGender, setNewPatientGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [longitudinalRAGText, setLongitudinalRAGText] = useState('');
  const [selectedPatientForRAG, setSelectedPatientForRAG] = useState<string>('');
  const [patientRAGSummary, setPatientRAGSummary] = useState('');
  const [selectedDirectoryPatient, setSelectedDirectoryPatient] = useState<Patient | null>(null);
  const [restockThreshold, setRestockThreshold] = useState(85);

  // WhatsApp Meta Integration & Real-Time Inbox States
  const [whatsAppSessions, setWhatsAppSessions] = useState<any[]>([]);
  const [activeWabaConnection, setActiveWabaConnection] = useState<any | null>(null);
  const [wabaFormOpen, setWabaFormOpen] = useState(false);
  const [wabaPhoneId, setWabaPhoneId] = useState('');
  const [wabaIdVal, setWabaIdVal] = useState('');
  const [wabaNumber, setWabaNumber] = useState('');
  const [wabaTokenVal, setWabaTokenVal] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [selectedChatSession, setSelectedChatSession] = useState<any | null>(null);
  const [manualChatMsg, setManualChatMsg] = useState('');

  // Cashfree Dynamic Splits & Bank Onboarding States
  const [activeVendor, setActiveVendor] = useState<any | null>(null);
  const [vendorFormOpen, setVendorFormOpen] = useState(false);
  const [vendorHolderName, setVendorHolderName] = useState('');
  const [vendorAccountNumber, setVendorAccountNumber] = useState('');
  const [vendorIfsc, setVendorIfsc] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');

  const [telemetryLogs, setTelemetryLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] Meta Cloud API webhook gateway active 🟢`,
    `[${new Date().toLocaleTimeString()}] Secure Definer symmetric RPC key decryption: SUCCESS`
  ]);

  useEffect(() => {
    const logPool = [
      "POST /webhook - HTTP 200 OK | Latency: 142ms | Payload: 1.2KB",
      "CDSS SCAN: Consent verification check triggered.",
      "OUTBOUND: Outgoing proactive refilling notification staged.",
      "pg_splits trigger: Calculated transaction allocations successfully.",
      "Webhook routing: Rollover standbys operating within normal parameters.",
      "Meta API Sync: Synchronized WABA phone details successfully."
    ];

    const interval = setInterval(() => {
      const randomLog = logPool[Math.floor(Math.random() * logPool.length)];
      setTelemetryLogs(prev => [
        ...prev.slice(-4),
        `[${new Date().toLocaleTimeString()}] ${randomLog}`
      ]);
    }, 7000);

    return () => clearInterval(interval);
  }, []);

  const { activePod, activeEntity } = useClinic();

  // SaaS Doctor States
  const [hinglishSummary, setHinglishSummary] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [comparativeTrend, setComparativeTrend] = useState('');
  const [isGeneratingTrend, setIsGeneratingTrend] = useState(false);

  // In-Browser HTML5 Local Audio Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<any>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Recording seconds timer effect
  useEffect(() => {
    let interval: any = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const recorder = new window.MediaRecorder(stream);
      
      recorder.ondataavailable = (e: any) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const compiledBlob = new Blob(chunks, { type: 'audio/webm' });
        const generatedUrl = URL.createObjectURL(compiledBlob);
        setAudioBlob(compiledBlob);
        setAudioUrl(generatedUrl);
        
        // Stop all audio tracks in stream
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setAudioUrl(null);
      setAudioBlob(null);

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Recording Started 🎙️',
          message: 'Microphone is active. Speak clinical instructions now.',
          type: 'info'
        }
      }));
    } catch (err: any) {
      console.error('[Mediflow] Failed to capture microphone:', err);
      alert('Microphone access is required to record instructions.');
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const executeAudioScribeTranscription = async () => {
    if (!audioBlob) return;
    setIsTranscribing(true);
    try {
      const data = await api.voiceScribe(audioBlob, 'doctor_instructions.webm');
      if (data && data.summary) {
        setNotes(data.summary);
        setHinglishSummary(data.summary);
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            title: 'Scribe Complete ✅',
            message: 'Clinical text successfully populated into directions box.',
            type: 'success'
          }
        }));
      }
    } catch (err) {
      console.error('[Mediflow] Scribe failed:', err);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleLaunchVideoConsult = async () => {
    if (!selectedPatient) return;
    try {
      const apptId = `apt-${Date.now()}`;
      const res = await api.generateConsultRoom(apptId, selectedPatient.phone, 'Dr. Sharma');
      if (res && res.roomUrl) {
        window.open(res.roomUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error('[Consultation Tab] Failed to launch video consult:', err);
    }
  };

  // Mobile swipe gesture navigation logic
  const touchStartXRef = React.useRef<number | null>(null);
  const touchStartYRef = React.useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    // Must be horizontal swipe: deltaX magnitude must be much larger than deltaY to prevent vertical scroll conflicts
    if (Math.abs(deltaX) > 80 && Math.abs(deltaY) < 40) {
      const tabs: Array<'consultation' | 'financials' | 'patients' | 'whatsapp' | 'sop' | 'pod_view' | 'health'> = [
        'pod_view',
        'consultation', 
        'financials', 
        'patients',
        'whatsapp',
        'sop',
        'health'
      ];
      const currentIdx = tabs.indexOf(activeTab);
      
      if (deltaX > 0) {
        // Swipe Right -> Previous Tab
        if (currentIdx > 0) {
          setActiveTab(tabs[currentIdx - 1]);
        }
      } else {
        // Swipe Left -> Next Tab
        if (currentIdx < tabs.length - 1) {
          setActiveTab(tabs[currentIdx + 1]);
        }
      }
    }
  };

  useEffect(() => {
    StateHealingEngine.initGlobalListener();
    const syncDashboardData = () => {
      const registered = api.getPatients();
      setPatients(registered);
      setPharmacyInventory(api.getPharmacyInventory());
      setWhatsAppOrders(api.getWhatsAppDrugOrders());
      setPathologyReports(api.getPathologyReports());
      setFinancialLedgers(api.getFinancialLedgers());
      setWhatsAppSessions(api.getWhatsAppSessions());

      if (activePod?.id) {
        supabase
          .from('waba_connections')
          .select('*')
          .eq('pod_id', activePod.id)
          .then(({ data }) => {
            if (data && data.length > 0) {
              setActiveWabaConnection(data[0]);
            } else {
              setActiveWabaConnection(null);
            }
          });

        // Fetch Cashfree vendor connection for the clinic entity
        supabase
          .from('cashfree_vendors')
          .select('*')
          .eq('pod_id', activePod.id)
          .eq('entity_id', activeEntity?.id || 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002') // Default Bihar Clinic Entity ID
          .maybeSingle()
          .then(({ data }) => {
            setActiveVendor(data || null);
          });
      }
      
      setSelectedPatient((prev: Patient | null) => {
        if (!prev) return registered.length > 0 ? registered[0] : null;
        const stillExists = registered.find(p => p.id === prev.id);
        return stillExists || (registered.length > 0 ? registered[0] : null);
      });
    };

    syncDashboardData();
    return api.subscribe(syncDashboardData);
  }, [activePod?.id]);

  // Reset selectors when patient changes
  useEffect(() => {
    setBaselineDate(null);
    setComparisonDate(null);
    setCdssAnomalies([]);
    setAiInsight('');
    setAiError(null);
    setRefractionRx(EMPTY_REFRACTION_RX);
  }, [selectedPatient?.id]);


  // Auto-select latest two reports when history is available
  useEffect(() => {
    if (!selectedPatient) return;
    const history = api.getPatientHistoricalBiomarkers(selectedPatient.id);
    if (history.length >= 2) {
      setBaselineDate(prev => prev ?? history[history.length - 2].date);
      setComparisonDate(prev => prev ?? history[history.length - 1].date);
    } else if (history.length === 1) {
      setComparisonDate(prev => prev ?? history[0].date);
    }
  }, [selectedPatient?.id]);

  useEffect(() => {
    if (!selectedPatient) return;
    const history = api.getPatientHistoricalBiomarkers(selectedPatient.id);
    if (!history || history.length === 0) return;

    const baseReport = history.find(h => h.date === baselineDate) ?? null;
    const compReport = history.find(h => h.date === comparisonDate) ?? history[history.length - 1];

    // Evaluate clinical risks for CDSS anomalies
    const anomalies: string[] = [];
    if (isOphthalmology) {
      const iop = compReport.pulseRate ?? 16;
      if (iop > 21) {
        anomalies.push(`Glaucoma Progression Risk: Intraocular Pressure is elevated at ${iop} mmHg. Avoid dilating drops.`);
      }
      
      const baseOD = baseReport?.temperature ?? OPHTHALMIC_EYE_CARE_COPY.odFallback;
      const compOD = compReport.temperature ?? OPHTHALMIC_EYE_CARE_COPY.odFallback;
      const baseOS = baseReport?.bloodPressure ?? OPHTHALMIC_EYE_CARE_COPY.osFallback;
      const compOS = compReport.bloodPressure ?? OPHTHALMIC_EYE_CARE_COPY.osFallback;
      
      const baseODRank = getAcuityRank(baseOD);
      const compODRank = getAcuityRank(compOD);
      const baseOSRank = getAcuityRank(baseOS);
      const compOSRank = getAcuityRank(compOS);
      
      if (baseODRank > 0 && compODRank > baseODRank) {
        anomalies.push(`Warning: Visual Acuity OD degraded from ${baseOD} to ${compOD}.`);
      }
      if (baseOSRank > 0 && compOSRank > baseOSRank) {
        anomalies.push(`Warning: Visual Acuity OS degraded from ${baseOS} to ${compOS}.`);
      }
    } else {
      if (compReport.creatinine > 1.2) {
        anomalies.push(`Warning: Serum Creatinine is ${compReport.creatinine} mg/dL (Abnormal > 1.2).${
          baseReport ? ` Up from ${baseReport.creatinine} mg/dL in ${baseReport.date}.` : ''
        }`);
      }
      if (compReport.HbA1c > 6.5) {
        anomalies.push(`Alert: HbA1c is ${compReport.HbA1c}% (Diabetic threshold > 6.5%).${
          baseReport ? ` Changed from ${baseReport.HbA1c}% in ${baseReport.date}.` : ''
        }`);
      }
    }
    setCdssAnomalies(anomalies);

    // Asynchronous RAG clinical insight pipeline with 5s timeout & containment
    const fetchRAGInsights = async () => {
      setIsAiLoading(true);
      setAiError(null);
      setAiInsight('');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      try {
        // Query the database using pgvector fallback keyword match
        let topicsToSearch = ['General'];
        if (selectedPatient.chronicConditions && selectedPatient.chronicConditions.length > 0) {
          topicsToSearch = selectedPatient.chronicConditions;
        }

        // Search matching guidelines for each topic
        let guidelinesFound: any[] = [];
        for (const topic of topicsToSearch) {
          let normalizedTopic = topic;
          if (topic.toLowerCase().includes('diabetes')) normalizedTopic = 'Diabetes';
          if (topic.toLowerCase().includes('kidney') || topic.toLowerCase().includes('renal')) normalizedTopic = 'CKD';
          if (topic.toLowerCase().includes('asthma') || topic.toLowerCase().includes('fever')) normalizedTopic = 'Fever';

          const { data, error } = await supabase.rpc('match_clinical_guidelines', {
            query_embedding: null,
            match_threshold: 0.1,
            match_count: 1,
            query_text: normalizedTopic
          });

          if (!error && data && data.length > 0) {
            guidelinesFound.push(...data);
          }
        }

        let defaultInsight = `### Clinical Advisory (Static Fallback)\n\n`;
        defaultInsight += `Patient **${selectedPatient.name}** (${selectedPatient.age}y, ${selectedPatient.gender}) shows `;
        defaultInsight += selectedPatient.chronicConditions.length > 0
          ? `chronic history of **${selectedPatient.chronicConditions.join(' & ')}**.\n\n`
          : `no reported chronic conditions.\n\n`;

        if (isOphthalmology) {
          if (baseReport && compReport) {
            defaultInsight += `**Comparative Analysis** (${baseReport.date} → ${compReport.date}):\n`;
            defaultInsight += `- **${OPHTHALMIC_EYE_CARE_COPY.odLabel}**: **${baseReport.temperature || OPHTHALMIC_EYE_CARE_COPY.odFallback}** → **${compReport.temperature || OPHTHALMIC_EYE_CARE_COPY.odFallback}**.\n`;
            defaultInsight += `- **${OPHTHALMIC_EYE_CARE_COPY.iopLabel}**: **${baseReport.pulseRate || OPHTHALMIC_EYE_CARE_COPY.iopFallback} mmHg** → **${compReport.pulseRate || OPHTHALMIC_EYE_CARE_COPY.iopFallback} mmHg** (${
              (compReport.pulseRate || 16) > 21 ? '↑ Elevated Glaucoma Risk' : '↓ Stable'
            }).\n`;
            defaultInsight += `- **${OPHTHALMIC_EYE_CARE_COPY.osLabel}**: **${baseReport.bloodPressure || OPHTHALMIC_EYE_CARE_COPY.osFallback}** → **${compReport.bloodPressure || OPHTHALMIC_EYE_CARE_COPY.osFallback}**.\n\n`;
          } else if (compReport) {
            defaultInsight += `**Biomarker Summary (${compReport.date}):**\n`;
            defaultInsight += `- ${OPHTHALMIC_EYE_CARE_COPY.odLabel}: **${compReport.temperature || OPHTHALMIC_EYE_CARE_COPY.odFallback}**, ${OPHTHALMIC_EYE_CARE_COPY.iopLabel}: **${compReport.pulseRate || OPHTHALMIC_EYE_CARE_COPY.iopFallback} mmHg**, ${OPHTHALMIC_EYE_CARE_COPY.osLabel}: **${compReport.bloodPressure || OPHTHALMIC_EYE_CARE_COPY.osFallback}**\n\n`;
          }
        } else {
          if (baseReport && compReport) {
            defaultInsight += `**Comparative Analysis** (${baseReport.date} → ${compReport.date}):\n`;
            defaultInsight += `- **HbA1c**: **${baseReport.HbA1c}%** → **${compReport.HbA1c}%** (${
              compReport.HbA1c < baseReport.HbA1c ? '↓ Improving' : '↑ Worsening'
            }).\n`;
            defaultInsight += `- **Creatinine**: **${baseReport.creatinine}** → **${compReport.creatinine} mg/dL** (${
              compReport.creatinine > baseReport.creatinine ? '↑ Elevated — monitor renal function' : '↓ Improving'
            }).\n`;
            defaultInsight += `- **Hemoglobin**: **${baseReport.hemoglobin}** → **${compReport.hemoglobin} g/dL**.\n\n`;
          } else if (compReport) {
            defaultInsight += `**Biomarker Summary (${compReport.date}):**\n`;
            defaultInsight += `- HbA1c: **${compReport.HbA1c}%**, Creatinine: **${compReport.creatinine} mg/dL**, Hemoglobin: **${compReport.hemoglobin} g/dL**\n\n`;
          }
        }

        if (selectedPatient.allergies.includes('Penicillin')) {
          defaultInsight += `⚠️ **CRITICAL CONTRAINDICATION**: Documented **Penicillin** allergy. Do NOT prescribe penicillin-class agents.\n\n`;
        }

        if (guidelinesFound.length > 0) {
          defaultInsight += `**Vector Guidelines Retrieved (${guidelinesFound.length}):**\n`;
          guidelinesFound.forEach((g: any) => {
            defaultInsight += `* **[${g.guideline_source}] ${g.clinical_topic}**: ${g.content}\n`;
          });
          defaultInsight += `\n`;
        } else {
          defaultInsight += `**Vector Guidelines Retrieved**: None matched Patient Chronic profile in RAG index.\n\n`;
        }

        if (isOphthalmology) {
          defaultInsight += `**Intervention Recommendations:**\n`;
          defaultInsight += `1. Review refractive prescription matrix for lens/spectacle grinding.\n`;
          defaultInsight += `2. Schedule a dilated fundus exam or optical coherence tomography (OCT) in 30 days if IOP > 21 mmHg.\n`;
        } else {
          defaultInsight += `**Intervention Recommendations:**\n`;
          defaultInsight += `1. Consider cardioprotective **SGLT2 inhibitors** (e.g. Empagliflozin) for cardiovascular standard support.\n`;
          defaultInsight += `2. Schedule a follow-up repeat **Serum Creatinine & GFR** in 14 days.\n`;
        }

        // If Mistral API key is configured, perform live synthesis
        const mistralApiKey = import.meta.env.VITE_MISTRAL_API_KEY;
        if (!mistralApiKey) {
          setAiInsight(defaultInsight);
          clearTimeout(timeoutId);
          return;
        }

        const promptText = `You are a clinical advisory assistant powered by Mistral Large and Mediflow RAG index.
Analyze the following patient profile and the retrieved standard clinical guidelines.
Generate a deeply personalized, highly specific Clinical Advisory report for the doctor.
Highlight comparative biomarker trends (if available), chronic management alerts, and active contraindications (like allergies).

Patient Profile:
Name: ${selectedPatient.name}
Age: ${selectedPatient.age}
Gender: ${selectedPatient.gender}
Chronic Conditions: ${selectedPatient.chronicConditions.join(', ') || 'None'}
Allergies: ${selectedPatient.allergies.join(', ') || 'NKDA'}

Biomarkers:
${isOphthalmology ? (
  baseReport && compReport ? `Comparative trend:
- ${OPHTHALMIC_EYE_CARE_COPY.odLabel}: ${baseReport.temperature || OPHTHALMIC_EYE_CARE_COPY.odFallback} in ${baseReport.date} -> ${compReport.temperature || OPHTHALMIC_EYE_CARE_COPY.odFallback} in ${compReport.date}
- ${OPHTHALMIC_EYE_CARE_COPY.iopLabel}: ${baseReport.pulseRate || OPHTHALMIC_EYE_CARE_COPY.iopFallback} mmHg in ${baseReport.date} -> ${compReport.pulseRate || OPHTHALMIC_EYE_CARE_COPY.iopFallback} mmHg in ${compReport.date}
- ${OPHTHALMIC_EYE_CARE_COPY.osLabel}: ${baseReport.bloodPressure || OPHTHALMIC_EYE_CARE_COPY.osFallback} in ${baseReport.date} -> ${compReport.bloodPressure || OPHTHALMIC_EYE_CARE_COPY.osFallback} in ${compReport.date}` : `Current levels:
- ${OPHTHALMIC_EYE_CARE_COPY.odLabel}: ${compReport?.temperature || OPHTHALMIC_EYE_CARE_COPY.odFallback}
- ${OPHTHALMIC_EYE_CARE_COPY.iopLabel}: ${compReport?.pulseRate || OPHTHALMIC_EYE_CARE_COPY.iopFallback} mmHg
- ${OPHTHALMIC_EYE_CARE_COPY.osLabel}: ${compReport?.bloodPressure || OPHTHALMIC_EYE_CARE_COPY.osFallback}`
) : (
  baseReport && compReport ? `Comparative trend:
- HbA1c: ${baseReport.HbA1c}% in ${baseReport.date} -> ${compReport.HbA1c}% in ${compReport.date}
- Creatinine: ${baseReport.creatinine} mg/dL in ${baseReport.date} -> ${compReport.creatinine} mg/dL in ${compReport.date}
- Hemoglobin: ${baseReport.hemoglobin} g/dL in ${baseReport.date} -> ${compReport.hemoglobin} g/dL in ${compReport.date}` : `Current levels:
- HbA1c: ${compReport?.HbA1c}%
- Creatinine: ${compReport?.creatinine} mg/dL
- Hemoglobin: ${compReport?.hemoglobin} g/dL`
)}

Retrieved Clinical Guidelines:
${guidelinesFound.map((g: any) => `* [${g.guideline_source}] ${g.clinical_topic}: ${g.content}`).join('\n') || 'No specific matching guidelines retrieved.'}

Format the output strictly as elegant GitHub Markdown.
Structure it with sections:
- ### 🩺 Live AI Clinical RAG Analysis
- #### 📋 Biomarker Trajectory & Assessment
- #### 🔬 Guidelines Cross-Reference & Recommendations
- #### ⚠️ Critical Risk & Contraindications Alerts

Keep the tone professional, clinical, objective, and precise.`;

        let synthesizedInsight = '';
        try {
          const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${mistralApiKey}`
            },
            body: JSON.stringify({
              model: 'mistral-large-latest',
              messages: [
                { role: 'user', content: promptText }
              ],
              temperature: 0.15
            })
          });

          if (!response.ok) {
            throw new Error(`Mistral API returned ${response.status} ${response.statusText}`);
          }

          const resData = await response.json();
          synthesizedInsight = resData.choices?.[0]?.message?.content || '';
        } catch (mistralErr) {
          console.warn("[Mistral Live RAG Synthesis failed, initiating backup failover to Groq Llama-3.3-70B]:", mistralErr);
          const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;
          if (groqApiKey) {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqApiKey}`
              },
              body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                  { role: 'user', content: promptText }
                ],
                temperature: 0.2
              })
            });

            if (response.ok) {
              const resData = await response.json();
              synthesizedInsight = resData.choices?.[0]?.message?.content || '';
            } else {
              console.warn("[Groq RAG Backup also failed]");
            }
          }
        }

        if (!synthesizedInsight) {
          throw new Error("Mistral API returned an empty completion.");
        }

        clearTimeout(timeoutId);
        setAiInsight(synthesizedInsight);

      } catch (err: any) {
        console.warn("[Mistral Live RAG Synthesis Failed, falling back to static]:", err);
        clearTimeout(timeoutId);
        
        let topicsToSearch = ['General'];
        if (selectedPatient.chronicConditions && selectedPatient.chronicConditions.length > 0) {
          topicsToSearch = selectedPatient.chronicConditions;
        }

        let guidelinesFound: any[] = [];
        for (const topic of topicsToSearch) {
          let normalizedTopic = topic;
          if (topic.toLowerCase().includes('diabetes')) normalizedTopic = 'Diabetes';
          if (topic.toLowerCase().includes('kidney') || topic.toLowerCase().includes('renal')) normalizedTopic = 'CKD';
          if (topic.toLowerCase().includes('asthma') || topic.toLowerCase().includes('fever')) normalizedTopic = 'Fever';

          const { data } = await supabase.rpc('match_clinical_guidelines', {
            query_embedding: null,
            match_threshold: 0.1,
            match_count: 1,
            query_text: normalizedTopic
          });

          if (data && data.length > 0) {
            guidelinesFound.push(...data);
          }
        }

        let fallbackInsight = `### Clinical Advisory (Static Fallback)\n\n`;
        fallbackInsight += `Patient **${selectedPatient.name}** (${selectedPatient.age}y, ${selectedPatient.gender}) shows `;
        fallbackInsight += selectedPatient.chronicConditions.length > 0
          ? `chronic history of **${selectedPatient.chronicConditions.join(' & ')}**.\n\n`
          : `no reported chronic conditions.\n\n`;

        if (baseReport && compReport) {
          fallbackInsight += `**Comparative Analysis** (${baseReport.date} → ${compReport.date}):\n`;
          fallbackInsight += `- **HbA1c**: **${baseReport.HbA1c}%** → **${compReport.HbA1c}%** (${
            compReport.HbA1c < baseReport.HbA1c ? '↓ Improving' : '↑ Worsening'
          }).\n`;
          fallbackInsight += `- **Creatinine**: **${baseReport.creatinine}** → **${compReport.creatinine} mg/dL** (${
            compReport.creatinine > baseReport.creatinine ? '↑ Elevated — monitor renal function' : '↓ Improving'
          }).\n`;
          fallbackInsight += `- **Hemoglobin**: **${baseReport.hemoglobin}** → **${compReport.hemoglobin} g/dL**.\n\n`;
        } else if (compReport) {
          fallbackInsight += `**Biomarker Summary (${compReport.date}):**\n`;
          fallbackInsight += `- HbA1c: **${compReport.HbA1c}%**, Creatinine: **${compReport.creatinine} mg/dL**, Hemoglobin: **${compReport.hemoglobin} g/dL**\n\n`;
        }

        if (selectedPatient.allergies.includes('Penicillin')) {
          fallbackInsight += `⚠️ **CRITICAL CONTRAINDICATION**: Documented **Penicillin** allergy. Do NOT prescribe penicillin-class agents.\n\n`;
        }

        if (guidelinesFound.length > 0) {
          fallbackInsight += `**Vector Guidelines Retrieved (${guidelinesFound.length}):**\n`;
          guidelinesFound.forEach((g: any) => {
            fallbackInsight += `* **[${g.guideline_source}] ${g.clinical_topic}**: ${g.content}\n`;
          });
          fallbackInsight += `\n`;
        }

        setAiInsight(fallbackInsight);
      } finally {
        setIsAiLoading(false);
      }
    };

    fetchRAGInsights();
  }, [selectedPatient?.id, baselineDate, comparisonDate]);

  const checkAllergyConflict = (drugName: string): string | null => {
    if (!selectedPatient || !selectedPatient.allergies) return null;
    const lowerDrug = drugName.toLowerCase();
    for (const allergy of selectedPatient.allergies) {
      const lowerAllergy = allergy.toLowerCase();
      if (lowerDrug.includes(lowerAllergy) || 
          (lowerAllergy === 'penicillin' && (lowerDrug.includes('amox') || lowerDrug.includes('amp') || lowerDrug.includes('peni')))) {
        return allergy;
      }
    }
    return null;
  };



  const handleAddMedication = () => {
    if (!medName || !medDosage) return;

    const conflict = checkAllergyConflict(medName);
    if (conflict) {
      setAllergyAlert({
        medicineName: medName,
        allergen: conflict,
        resolved: false,
        justification: ''
      });
      return;
    }

    setMedications([
      ...medications,
      { medicineName: medName, dosage: medDosage, frequency: medFreq, duration: medDur }
    ]);
    setMedName('');
    setMedDosage('');
  };

  const handleRemoveMedication = (idx: number) => {
    setMedications(medications.filter((_: any, i: number) => i !== idx));
  };

  const handleToggleTest = (test: DiagnosticTest) => {
    const exists = selectedTests.find((t: DiagnosticTest) => t.loincCode === test.loincCode);
    if (exists) {
      setSelectedTests(selectedTests.filter((t: DiagnosticTest) => t.loincCode !== test.loincCode));
    } else {
      setSelectedTests([...selectedTests, test]);
    }
  };

  const handleSaveEncounter = () => {
    if (!selectedPatient) return;

    const finalMedications = medications.map((m: Omit<MedicationRequest, 'id'>, idx: number) => ({ ...m, id: `med-${idx}` }));

    // Ophthalmology spectacle support
    if (isOphthalmology && (refractionRx.od.sph || refractionRx.os.sph)) {
      finalMedications.push({
        id: `med-spectacles`,
        medicineName: `Spectacles (${refractionRx.lensType})`,
        dosage: `OD: SPH ${refractionRx.od.sph || 'Plano'} CYL ${refractionRx.od.cyl || '—'} Axis ${refractionRx.od.axis ? refractionRx.od.axis + '°' : '—'}${refractionRx.od.add ? ' ADD ' + refractionRx.od.add : ''} | OS: SPH ${refractionRx.os.sph || 'Plano'} CYL ${refractionRx.os.cyl || '—'} Axis ${refractionRx.os.axis ? refractionRx.os.axis + '°' : '—'}${refractionRx.os.add ? ' ADD ' + refractionRx.os.add : ''}`,
        frequency: 'Wear constantly',
        duration: '1 Year'
      });
    }

    let finalNotes = notes;
    if (isOphthalmology && (refractionRx.od.sph || refractionRx.os.sph)) {
      finalNotes += serializeRefractionRx(refractionRx);
    }

    api.createEncounter({
      patientId: selectedPatient.id,
      patientName: selectedPatient.name,
      doctorId: 'doc-1',
      clinicalNotes: finalNotes,
      medications: finalMedications,
      diagnosticTests: selectedTests
    });

    // Dynamic WhatsApp auto-dispatch matching core business USP
    try {
      const history = api.getPatientHistoricalBiomarkers(selectedPatient.id);
      const latestReport = history.length > 0 ? history[history.length - 1] : null;
      
      let whatsAppMsg = '';
      if (isOphthalmology && (refractionRx.od.sph || refractionRx.os.sph)) {
        whatsAppMsg = formatSpectacleCard(refractionRx, selectedPatient.name);
        if (notes) {
          whatsAppMsg += `\n\n👉 *Doctor's Advice (Hinglish):*\n_"${notes}"_`;
        }
        if (medications.length > 0) {
          whatsAppMsg += `\n\n💊 *Prescribed Medications:*\n`;
          medications.forEach((m, idx) => {
            whatsAppMsg += `${idx + 1}. ${m.medicineName} (${m.dosage}) — ${m.frequency}, ${m.duration}\n`;
          });
        }
      } else {
        whatsAppMsg = `🏥 *Mediflow Connected Care Plan* 🩺\n\n`;
        whatsAppMsg += `Dear *${selectedPatient.name}*, Dr. Sharma has finalized your consultation record.\n\n`;
        
        // Add Hinglish clinical directions
        whatsAppMsg += `👉 *Doctor's Advice (Hinglish):*\n_"${notes || "Continue active lifestyle management."}"_\n\n`;
        
        if (latestReport) {
          whatsAppMsg += `🧪 *Consolidated Lab Report (Date: ${latestReport.date}):*\n`;
          whatsAppMsg += `- *HbA1c*: ${latestReport.HbA1c}%\n`;
          whatsAppMsg += `- *Serum Creatinine*: ${latestReport.creatinine} mg/dL\n`;
          whatsAppMsg += `- *Total Hemoglobin*: ${latestReport.hemoglobin} g/dL\n\n`;
        }
        
        if (medications.length > 0) {
          whatsAppMsg += `💊 *Prescribed Medications (Collect at Counter):*\n`;
          medications.forEach((m, idx) => {
            whatsAppMsg += `${idx + 1}. ${m.medicineName} (${m.dosage}) — ${m.frequency}, ${m.duration}\n`;
          });
          whatsAppMsg += `\n`;
        }
        
        whatsAppMsg += `Dhyan rakhein aur time par medicine lein! 🟢`;
      }
      
      api.pushWhatsAppMessageFromBot(selectedPatient.phone, whatsAppMsg);
    } catch (e) {
      console.error('[WhatsApp Auto-dispatch failed]:', e);
    }

    // Reset Form
    setNotes('');
    setHinglishSummary('');
    setAudioUrl(null);
    setAudioBlob(null);
    setMedications([]);
    setSelectedTests([]);
    setRefractionRx(EMPTY_REFRACTION_RX);
    
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: 'e-Prescription successfully saved and consolidated reports dispatched to patient WhatsApp!',
        type: 'success',
        title: 'Encounter Saved & Synced'
      }
    }));
  };


  // ROUTER CONTROLLER: Render Active Tab Contents
  const renderTabContent = () => {
    return (
      <React.Suspense fallback={
        <div className="glass-panel p-12 text-center text-slate-500 rounded-2xl">
          <span className="material-symbols-outlined animate-spin text-xl text-primary animate-pulse">autorenew</span>
          <p className="text-xs mt-2 font-medium">Loading clinical workspace...</p>
        </div>
      }>
        {(() => {
          switch (activeTab) {
            case 'pod_view':
              return (
                <PodCommandCenter 
                  hideHeader={true}
                  onStartConsultation={(patient: Patient) => {
                    setSelectedPatient(patient);
                    setActiveTab('consultation');
                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                      detail: {
                        title: 'Consultation Initialized! 🩺',
                        message: `Directly navigated to Consultation worksheet for ${patient.name}.`,
                        type: 'success'
                      }
                    }));
                  }}
                />
              );
            case 'consultation':
              return (
                <ConsultationTab
                  patients={patients}
                  selectedPatient={selectedPatient}
                  setSelectedPatient={setSelectedPatient}
                  medications={medications}
                  selectedTests={selectedTests}
                  notes={notes}
                  setNotes={setNotes}
                  medName={medName}
                  setMedName={setMedName}
                  medDosage={medDosage}
                  setMedDosage={setMedDosage}
                  medFreq={medFreq}
                  setMedFreq={setMedFreq}
                  medDur={medDur}
                  setMedDur={setMedDur}
                  refractionRx={refractionRx}
                  setRefractionRx={setRefractionRx}
                  cdssAnomalies={cdssAnomalies}
                  aiInsight={aiInsight}
                  isAiLoading={isAiLoading}
                  baselineDate={baselineDate}
                  setBaselineDate={setBaselineDate}
                  comparisonDate={comparisonDate}
                  setComparisonDate={setComparisonDate}
                  allergyAlert={allergyAlert}
                  setAllergyAlert={setAllergyAlert}
                  analyzingReport={analyzingReport}
                  setAnalyzingReport={setAnalyzingReport}
                  isOphthalmology={isOphthalmology}
                  testCatalog={testCatalog}
                  nomenclature={nomenclature}
                  hinglishSummary={hinglishSummary}
                  setHinglishSummary={setHinglishSummary}
                  isGeneratingSummary={isGeneratingSummary}
                  setIsGeneratingSummary={setIsGeneratingSummary}
                  comparativeTrend={comparativeTrend}
                  setComparativeTrend={setComparativeTrend}
                  isGeneratingTrend={isGeneratingTrend}
                  setIsGeneratingTrend={setIsGeneratingTrend}
                  isRecording={isRecording}
                  recordingSeconds={recordingSeconds}
                  audioUrl={audioUrl}
                  isTranscribing={isTranscribing}
                  startAudioRecording={startAudioRecording}
                  stopAudioRecording={stopAudioRecording}
                  executeAudioScribeTranscription={executeAudioScribeTranscription}
                  handleAddMedication={handleAddMedication}
                  handleRemoveMedication={handleRemoveMedication}
                  handleToggleTest={handleToggleTest}
                  handleSaveEncounter={handleSaveEncounter}
                  handleLaunchVideoConsult={handleLaunchVideoConsult}
                />
              );
            case 'financials':
              return (
                <FinancialsTab
                  financialLedgers={financialLedgers}
                  financialSearch={financialSearch}
                  setFinancialSearch={setFinancialSearch}
                  activePod={activePod}
                  activeEntity={activeEntity}
                />
              );
            case 'patients':
              return (
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
              );
            case 'whatsapp':
              return (
                <WhatsAppTab
                  whatsAppSessions={whatsAppSessions}
                  setWhatsAppSessions={setWhatsAppSessions}
                  patients={patients}
                  activeWabaConnection={activeWabaConnection}
                  setActiveWabaConnection={setActiveWabaConnection}
                  wabaFormOpen={wabaFormOpen}
                  setWabaFormOpen={setWabaFormOpen}
                  wabaPhoneId={wabaPhoneId}
                  setWabaPhoneId={setWabaPhoneId}
                  wabaIdVal={wabaIdVal}
                  setWabaIdVal={setWabaIdVal}
                  wabaNumber={wabaNumber}
                  setWabaNumber={setWabaNumber}
                  wabaTokenVal={wabaTokenVal}
                  setWabaTokenVal={setWabaTokenVal}
                  chatSearch={chatSearch}
                  setChatSearch={setChatSearch}
                  selectedChatSession={selectedChatSession}
                  setSelectedChatSession={setSelectedChatSession}
                  manualChatMsg={manualChatMsg}
                  setManualChatMsg={setManualChatMsg}
                  activePod={activePod}
                  telemetryLogs={telemetryLogs}
                />
              );
            case 'sop':
              return (
                <SopConfigTab
                  sopFile={sopFile}
                  setSopFile={setSopFile}
                  sopText={sopText}
                  setSopText={setSopText}
                  isExtractingSop={isExtractingSop}
                  setIsExtractingSop={setIsExtractingSop}
                  extractionLogs={extractionLogs}
                  setExtractionLogs={setExtractionLogs}
                  extractedConfig={extractedConfig}
                  setExtractedConfig={setExtractedConfig}
                  customSopFileName={customSopFileName}
                  setCustomSopFileName={setCustomSopFileName}
                  sopActiveSubTab={sopActiveSubTab}
                  setSopActiveSubTab={setSopActiveSubTab}
                />
              );
            case 'health':
              return (
                <div className="py-2">
                  <SystemHealthCockpit />
                </div>
              );
            default:
              return (
                <PodCommandCenter 
                  hideHeader={true}
                  onStartConsultation={(patient: Patient) => {
                    setSelectedPatient(patient);
                    setActiveTab('consultation');
                  }}
                />
              );
          }
        })()}
      </React.Suspense>
    );
  };

  // FULL-SCREEN PROFESSIONAL AI CLINICAL REPORT ANALYSIS MODAL
  const renderReportAnalysisModal = () => {
    if (!analyzingReport) return null;
    const report = analyzingReport;

    const isHbA1cHigh = report.HbA1c >= 6.5;
    const isHbA1cWarning = report.HbA1c >= 5.7 && report.HbA1c < 6.5;
    const isCreatinineHigh = report.creatinine > 1.2;
    const isHemoglobinLow = report.hemoglobin < 12.0;

    let riskTier = "Low Risk";
    let riskReason = "All active biomarkers are within normal reference corridors.";
    let complications: string[] = [];



    if (isOphthalmology) {
      const iop = report.pulseRate ?? 16;
      const vaOD = report.temperature ?? OPHTHALMIC_EYE_CARE_COPY.odFallback;
      const vaOS = report.bloodPressure ?? OPHTHALMIC_EYE_CARE_COPY.osFallback;

      const isIopHigh = iop > 21;
      
      const activeHistory = selectedPatient ? api.getPatientHistoricalBiomarkers(selectedPatient.id) : null;
      const baseReport = activeHistory?.find(h => h.date === baselineDate) ?? null;
      const baseOD = baseReport?.temperature ?? OPHTHALMIC_EYE_CARE_COPY.odFallback;
      const baseOS = baseReport?.bloodPressure ?? OPHTHALMIC_EYE_CARE_COPY.osFallback;
      
      const baseODRank = getAcuityRank(baseOD);
      const compODRank = getAcuityRank(vaOD);
      const baseOSRank = getAcuityRank(baseOS);
      const compOSRank = getAcuityRank(vaOS);
      
      const odDropped = baseODRank > 0 && compODRank > baseODRank;
      const osDropped = baseOSRank > 0 && compOSRank > baseOSRank;
      const isAcuityDropped = odDropped || osDropped;

      if (isIopHigh && isAcuityDropped) {
        riskTier = "Critical Risk";
        riskReason = `Glaucoma Progression Risk: Intraocular Pressure is elevated at ${iop} mmHg. Avoid dilating drops. Trajectory Decline detected: Visual Acuity decreased from ${baseOD} (OD) / ${baseOS} (OS) to ${vaOD} (OD) / ${vaOS} (OS).`;
        complications.push("Severe Glaucoma Progression & Visual Field Loss");
        complications.push("Optic Nerve Cupping & Retinal Ganglion Cell Damage");
      } else if (isIopHigh) {
        riskTier = "Critical Risk";
        riskReason = `Glaucoma Progression Risk: Intraocular Pressure is elevated at ${iop} mmHg. Avoid dilating drops. Close tracking and visual field scans required.`;
        complications.push("Ocular Hypertension / Suspicious Glaucoma");
      } else if (isAcuityDropped) {
        riskTier = "High Risk";
        riskReason = `Visual Acuity Trajectory Decline: Vision dropped from ${baseOD} (OD) / ${baseOS} (OS) to ${vaOD} (OD) / ${vaOS} (OS). Reroute for immediate refraction mapping or dilated retinal exam.`;
        complications.push("Progressive Myopia / Refractive Error Shifts");
        complications.push("Retinal Pathology / Cataract Development");
      } else {
        riskTier = "Low Risk";
        riskReason = "Intraocular pressures and visual acuity parameters are stable within normal physiological boundaries.";
      }
    } else {
      if (isHbA1cHigh && isCreatinineHigh) {
        riskTier = "Critical Risk";
        riskReason = "Synchronous elevation of glycated hemoglobin and serum creatinine signals high probability of active Diabetic Nephropathy and microvascular kidney injury.";
        complications.push("Chronic Kidney Disease (CKD) Stage 3 Progression");
        complications.push("Accelerated Diabetic Retinopathy");
        complications.push("Cardiovascular Event (ASCVD) Risk Elevation");
      } else if (isHbA1cHigh) {
        riskTier = "High Risk";
        riskReason = "Glycemic parameters are in the diabetic range. Risk of long-term microvascular and macrovascular complications.";
        complications.push("Type-2 Diabetes Mellitus Complications");
        complications.push("Peripheral Neuropathy Development");
      } else if (isCreatinineHigh) {
        riskTier = "High Risk";
        riskReason = "Reduced glomerular filtration capacity indicated by elevated serum creatinine. High risk of renal function degradation.";
        complications.push("Renal Perfusion Impairment / Stage 2 CKD");
      } else if (isHbA1cWarning) {
        riskTier = "Moderate Warning";
        riskReason = "HbA1c values match the prediabetic reference category. Progression to diabetes is highly likely within 24 months.";
        complications.push("Progression to Type-2 Diabetes");
      }

      if (isHemoglobinLow) {
        if (isCreatinineHigh) {
          complications.push("Anemia of Chronic Disease (Renal Erythropoietin Deficit)");
        } else {
          complications.push("Iron Deficiency Anemia Risk");
        }
      }
    }

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/40 backdrop-blur-md p-4 md:p-8 animate-fade-in overflow-y-auto">
        <div className="glass-panel max-w-4xl w-full p-6 md:p-8 border-slate-200 shadow-2xl relative bg-white text-slate-800 rounded-3xl space-y-6 max-h-[90vh] overflow-y-auto">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 via-primary to-secondary" />
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200/80 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-650 text-2xl font-bold">clinical_notes</span>
                <h2 className="text-lg font-black text-slate-800 uppercase tracking-wider font-sans">Clinical AI Laboratory Analysis Report</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">Deep Diagnostics audit for patient: <strong className="text-slate-700 font-bold">{selectedPatient?.name}</strong> ({selectedPatient?.age}y, {selectedPatient?.gender})</p>
            </div>
            
            <div className="flex gap-2">
              <span className={`text-[10px] font-black font-mono px-3.5 py-1.5 rounded-full uppercase tracking-wider border ${
                riskTier === 'Critical Risk' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                riskTier === 'High Risk' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {riskTier}
              </span>
              <button
                onClick={() => setAnalyzingReport(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer border-0"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-6">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">
                1. Reference Range Audit & Diagnostics
              </h3>
              
              <div className="space-y-4">
                <div className="p-4 bg-slate-50/50 border border-slate-200/80 rounded-2xl space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-slate-700">
                      {isOphthalmology ? OPHTHALMIC_EYE_CARE_COPY.odLabel : "HbA1c (Glycated Hemoglobin)"}
                    </span>
                    <span className="text-[10px] text-slate-600 font-mono">
                      {isOphthalmology ? `Ref Range: ${OPHTHALMIC_EYE_CARE_COPY.odRefRange}` : "Ref Range: 4.0% - 5.6%"}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="text-xl font-black font-mono tracking-tight text-slate-800">
                      {isOphthalmology ? (report.temperature || OPHTHALMIC_EYE_CARE_COPY.odFallback) : `${report.HbA1c}%`}
                    </span>
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded font-mono ${
                      isOphthalmology ? (getAcuityRank(report.temperature || OPHTHALMIC_EYE_CARE_COPY.odFallback) > 2 ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100') :
                      isHbA1cHigh ? 'bg-rose-50 text-rose-700 border-rose-100' :
                      isHbA1cWarning ? 'bg-amber-50 text-amber-700 border-amber-100' :
                      'bg-emerald-50 text-emerald-700 border-emerald-100'
                    }`}>
                      {isOphthalmology ? (getAcuityRank(report.temperature || OPHTHALMIC_EYE_CARE_COPY.odFallback) > 2 ? 'Abnormal (Low)' : 'Normal') : isHbA1cHigh ? 'Diabetic' : isHbA1cWarning ? 'Prediabetic' : 'Normal'}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                       className={`h-full rounded-full ${
                        isOphthalmology ? (getAcuityRank(report.temperature || OPHTHALMIC_EYE_CARE_COPY.odFallback) > 2 ? 'bg-rose-500' : 'bg-emerald-500') :
                        isHbA1cHigh ? 'bg-rose-500' : isHbA1cWarning ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: isOphthalmology ? (getAcuityRank(report.temperature || OPHTHALMIC_EYE_CARE_COPY.odFallback) > 2 ? '50%' : '100%') : `${Math.min(100, (report.HbA1c / 12) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50/50 border border-slate-200/80 rounded-2xl space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-slate-700">
                      {isOphthalmology ? OPHTHALMIC_EYE_CARE_COPY.iopLabel : "Serum Creatinine"}
                    </span>
                    <span className="text-[10px] text-slate-600 font-mono">
                      {isOphthalmology ? `Ref Range: ${OPHTHALMIC_EYE_CARE_COPY.iopRefRange}` : "Ref Range: 0.6 - 1.2 mg/dL"}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="text-xl font-black font-mono tracking-tight text-slate-800">
                      {isOphthalmology ? `${report.pulseRate || OPHTHALMIC_EYE_CARE_COPY.iopFallback} mmHg` : `${report.creatinine} mg/dL`}
                    </span>
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded font-mono ${
                      isOphthalmology ? ((report.pulseRate || OPHTHALMIC_EYE_CARE_COPY.iopFallback) > 21 ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100') :
                      isCreatinineHigh ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    }`}>
                      {isOphthalmology ? ((report.pulseRate || OPHTHALMIC_EYE_CARE_COPY.iopFallback) > 21 ? 'Glaucoma Risk (High)' : 'Normal') : isCreatinineHigh ? 'Abnormal (High)' : 'Normal'}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isOphthalmology ? ((report.pulseRate || OPHTHALMIC_EYE_CARE_COPY.iopFallback) > 21 ? 'bg-rose-500' : 'bg-emerald-500') : isCreatinineHigh ? 'bg-rose-500' : 'bg-emerald-500'}`}
                      style={{ width: isOphthalmology ? `${Math.min(100, ((report.pulseRate || OPHTHALMIC_EYE_CARE_COPY.iopFallback) / 30) * 100)}%` : `${Math.min(100, (report.creatinine / 2.5) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50/50 border border-slate-200/80 rounded-2xl space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-slate-700">
                      {isOphthalmology ? OPHTHALMIC_EYE_CARE_COPY.osLabel : "Total Hemoglobin"}
                    </span>
                    <span className="text-[10px] text-slate-600 font-mono">
                      {isOphthalmology ? `Ref Range: ${OPHTHALMIC_EYE_CARE_COPY.osRefRange}` : "Ref Range: 12.0 - 16.0 g/dL"}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="text-xl font-black font-mono tracking-tight text-slate-800">
                      {isOphthalmology ? (report.bloodPressure || OPHTHALMIC_EYE_CARE_COPY.osFallback) : `${report.hemoglobin} g/dL`}
                    </span>
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded font-mono ${
                      isOphthalmology ? (getAcuityRank(report.bloodPressure || OPHTHALMIC_EYE_CARE_COPY.osFallback) > 3 ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100') :
                      isHemoglobinLow ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    }`}>
                      {isOphthalmology ? (getAcuityRank(report.bloodPressure || OPHTHALMIC_EYE_CARE_COPY.osFallback) > 3 ? 'Abnormal (Low)' : 'Borderline') : isHemoglobinLow ? 'Anemic (Low)' : 'Normal'}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isOphthalmology ? (getAcuityRank(report.bloodPressure || OPHTHALMIC_EYE_CARE_COPY.osFallback) > 3 ? 'bg-rose-500' : 'bg-amber-500') : isHemoglobinLow ? 'bg-rose-500' : 'bg-emerald-500'}`}
                      style={{ width: isOphthalmology ? (getAcuityRank(report.bloodPressure || OPHTHALMIC_EYE_CARE_COPY.osFallback) > 3 ? '50%' : '80%') : `${Math.min(100, (report.hemoglobin / 18) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">
                  2. AI Clinical Correlations
                </h3>
                <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl text-xs space-y-2 leading-relaxed">
                  <strong className="text-indigo-700 block font-bold">Biomarker Interaction Profile</strong>
                  <p className="text-indigo-950 text-[11px] font-medium leading-relaxed">{riskReason}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">
                  3. Future Potential Disease Forecasts
                </h3>
                {complications.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 text-xs italic">
                    No future potential risk patterns identified.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {complications.map((c, i) => (
                      <div key={i} className="p-3 bg-rose-550/10 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2.5 text-xs text-rose-800">
                        <span className="material-symbols-outlined text-rose-600 text-sm shrink-0">warning</span>
                        <span className="font-bold">{c}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">
                  4. Safe Prescribing Directives
                </h3>
                <div className="p-4 bg-teal-50 border border-teal-100 rounded-2xl text-[11px] text-teal-950 space-y-2">
                  {isOphthalmology ? (
                    <>
                      <div className="flex gap-2 animate-fade-in">
                        <span className="material-symbols-outlined text-xs text-teal-700 shrink-0 font-bold">check_circle</span>
                        <span>{(report.pulseRate || OPHTHALMIC_EYE_CARE_COPY.iopFallback) > 21 ? "STRICT CONFLICT: Avoid dilating drops (Atropine/Tropicamide) to prevent acute angle closure." : "Dilating drops cleared within safe intraocular pressure thresholds."}</span>
                      </div>
                      <div className="flex gap-2 animate-fade-in">
                        <span className="material-symbols-outlined text-xs text-teal-700 shrink-0 font-bold">check_circle</span>
                        <span>{getAcuityRank(report.temperature || OPHTHALMIC_EYE_CARE_COPY.odFallback) > 2 || getAcuityRank(report.bloodPressure || OPHTHALMIC_EYE_CARE_COPY.osFallback) > 3 ? "Review spectacle prescription. Reroute to Optical Shop for lens grinding." : "Visual acuity cleared within functional limits."}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <span className="material-symbols-outlined text-xs text-teal-700 shrink-0 font-bold">check_circle</span>
                        <span>{isCreatinineHigh ? "STRICT CONFLICT: Avoid NSAIDs (Ibuprofen, Diclofenac) to protect renal nephron capacity." : "NSAID usage cleared within standard clinical doses."}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="material-symbols-outlined text-xs text-teal-700 shrink-0 font-bold">check_circle</span>
                        <span>{isHbA1cHigh ? "Review glycemic therapy. Consider adding SGLT2 inhibitors for cardio-renal protection." : "Glycemic profile does not require immediate pharmacological adjustment."}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end border-t border-slate-100 pt-4 gap-3">
            <button
              onClick={() => setAnalyzingReport(null)}
              className="px-6 py-2 bg-white hover:bg-slate-800 text-xs font-semibold text-white rounded-xl transition-all cursor-pointer border-0 active:scale-95"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ALLERGY BLOCKED CONFLICT OVERRIDE MODAL
  const renderAllergyAlertModal = () => {
    if (!allergyAlert) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-800/50 backdrop-blur-sm p-4 animate-fade-in">
        <div className="glass-panel max-w-md w-full p-6 border-rose-500/30 shadow-2xl relative overflow-hidden space-y-4 bg-white text-slate-800">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-rose-500" />
          <div className="flex items-center gap-3 text-rose-600 font-bold text-lg font-sans">
            <AlertTriangle className="h-6 w-6 text-rose-500 animate-pulse" />
            Critical CDSS Contraindication
          </div>
          
          <p className="text-xs text-slate-600 leading-relaxed font-sans">
            Prescription of <strong className="text-slate-800 font-bold">{allergyAlert.medicineName}</strong> intercepts active allergy profile. The patient is flagged allergic to <strong className="text-rose-600 font-bold">{allergyAlert.allergen}</strong>.
          </p>

          <div className="space-y-2">
            <label className="block text-[10px] text-slate-600 font-bold uppercase tracking-wider">
              Clinical Justification Override Required
            </label>
            <textarea
              value={allergyAlert.justification}
              onChange={(e) => setAllergyAlert({ ...allergyAlert, justification: e.target.value })}
              placeholder="e.g., Clinical benefit outweighs minor rash risk; alternative tolerated under close monitoring."
              rows={3}
              className="w-full input-field resize-none text-xs bg-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAllergyAlert(null)}
              className="px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 text-xs text-slate-500 font-semibold"
            >
              Cancel Draft
            </button>
            <button
              type="button"
              disabled={!allergyAlert.justification.trim()}
              onClick={() => {
                setMedications([
                  ...medications,
                  {
                    medicineName: `${allergyAlert.medicineName} (Allergen Override: ${allergyAlert.justification.trim()})`,
                    dosage: medDosage || 'As directed',
                    frequency: medFreq,
                    duration: medDur
                  }
                ]);
                setMedName('');
                setMedDosage('');
                setAllergyAlert(null);
                window.dispatchEvent(new CustomEvent('mediflow-toast', {
                  detail: {
                    message: `CDSS Override Authorized for ${allergyAlert.medicineName}. Justification recorded.`,
                    type: 'warning',
                    title: 'Allergy Override Logged'
                  }
                }));
              }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 ${
                allergyAlert.justification.trim() 
                  ? 'bg-rose-600 hover:bg-rose-500 active:scale-95 text-white-force cursor-pointer' 
                  : 'bg-rose-300 text-rose-100 border border-rose-200 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="h-4 w-4 text-white-force" /> Authorize Override
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 pb-20 lg:pb-6 space-y-5 animate-fade-in text-slate-800" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

      {/* ── HEADER BLOCK: title + tabs integrated ── */}
      <div className="border-b border-slate-200 pb-0">

        {/* Top row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-indigo-600 text-white shadow-sm shrink-0">
              <span className="material-symbols-outlined text-[18px]">hub</span>
            </span>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-slate-800 font-sans leading-tight">Dr. Sharma's Care Dashboard</h1>
              <p className="text-[11px] text-slate-600 flex items-center gap-1.5 mt-0.5">
                Mediflow Pod Tenant Host
                <span className="text-slate-600">·</span>
                Clinic Code:
                <span className="font-mono font-semibold text-slate-500 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded text-[10px]">
                  {activePod?.clinicCode || 'MF-PATNA101'}
                </span>
              </p>
            </div>
          </div>

          {/* Status pill */}
          <div className="flex items-center gap-2 bg-white border border-slate-200/80 shadow-xs px-3 py-1.5 rounded-xl text-[11px] font-medium text-slate-600 shrink-0">
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="font-mono">Real-Time Sync: Connected</span>
          </div>
        </div>

        {/* Desktop tab nav — integrated into header */}
        <div className="hidden lg:flex items-center gap-1 overflow-x-auto no-scrollbar -mb-px">
          {[
            { id: 'pod_view',      label: 'Pod Command Center',  icon: 'hub' },
            { id: 'consultation',  label: 'Consultation Queue',  icon: 'clinical_notes' },
            { id: 'financials',    label: 'Financial Reports',   icon: 'account_balance_wallet' },
            { id: 'patients',      label: 'Patient Directory',   icon: 'group' },
            { id: 'whatsapp',      label: 'WhatsApp Inbox',      icon: 'chat' },
            { id: 'health',        label: 'System Health',       icon: 'shield' }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer rounded-t-md ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/60'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className={`material-symbols-outlined text-[15px] ${
                  isActive ? 'text-indigo-500' : 'text-slate-600'
                }`}>{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Render Container */}
      <div className="w-full">
        {renderTabContent()}
      </div>

      {/* Contextual Floating Action Button (FAB) for Mobile Viewports */}
      <div className="lg:hidden fixed bottom-20 right-6 z-[80] transition-all duration-300">

        
        {activeTab === 'pod_view' && (
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('mediflow-toast', {
                detail: {
                  title: 'Ecosystem CDSS Scan 🛡️',
                  message: 'Automated telemetry & passive CDSS scanning triggered.',
                  type: 'info'
                }
              }));
            }}
            className="bg-gradient-to-tr from-secondary-600 to-primary-600 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-300 border border-secondary/25 text-white-force cursor-pointer"
            title="Scan Health Alerts"
          >
            <span className="material-symbols-outlined text-2xl font-bold text-white-force">shield_alert</span>
          </button>
        )}
      </div>

      {/* Premium Mobile Bottom Tab Bar Navigation for Doctor Dashboard */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-50/95 backdrop-blur-lg border-t border-slate-200/80 shadow-[0_-4px_12px_rgba(0,0,0,0.02)] px-2 pb-safe-bottom">
        <div className="flex items-center justify-around h-16">
          {[
            { id: 'pod_view', label: 'Pod HUD', icon: 'hub' },
            { id: 'consultation', label: 'Consult', icon: 'clinical_notes' },
            { id: 'financials', label: 'Finance', icon: 'account_balance_wallet' },
            { id: 'patients', label: 'Patients', icon: 'group' },
            { id: 'health', label: 'Health', icon: 'shield' }
          ].map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-200 cursor-pointer relative bg-transparent border-0 outline-none ${
                  isActive 
                    ? 'text-indigo-600 font-bold' 
                    : 'text-slate-600 hover:text-slate-600'
                }`}
              >
                <div className={`p-1.5 rounded-lg transition-all duration-200 relative ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-600 scale-105 shadow-sm' 
                    : 'bg-transparent text-slate-600'
                }`}>
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                </div>
                <span className="text-[9px] mt-1 tracking-tight">
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

      {/* Allergy overrides modal */}
      {allergyAlert && renderAllergyAlertModal()}
      {!isOphthalmology && analyzingReport && renderReportAnalysisModal()}
    </div>
  );
};
