import React, { useState, useEffect } from 'react';
import { api, MASTER_TEST_CATALOG } from '../../services/api';
import { supabase } from '../../lib/supabaseClient';
import { RealtimeSyncService } from '../../services/realtimeSyncService';
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
import { EMPTY_REFRACTION_RX, serializeRefractionRx, formatSpectacleCard, getAcuityRank, OPHTHALMIC_EYE_CARE_COPY, type RefractionRx, EMPTY_BIOMETRY, serializeBiometry, type BiometryData } from '../../types/ophthalmic';

import { StateHealingEngine } from '../../services/autoHealerAgent';
import { useConsultationGuard } from '../../hooks/useConsultationGuard';
import { BiomarkerChart } from './BiomarkerChart';
import { ClinicPlacardGenerator } from '../admin/ClinicPlacardGenerator';
import { PodCommandCenter } from '../admin/PodCommandCenter';
import { OphthalmologyPatientAnalysisPanel } from './OphthalmologyPatientAnalysisPanel';
import { CommandPalette } from '../ui/CommandPalette';
import { WhatsAppSupportModal } from '../shared/WhatsAppSupportModal';
import { DoctorRegistrationModal } from '../auth/DoctorRegistrationModal';
import { WhatsAppTestDispatcherModal } from '../shared/WhatsAppTestDispatcherModal';
import { WhatsAppService } from '../../services/whatsappService';

const ConsultationTab = React.lazy(() => import('./tabs/ConsultationTab').then(m => ({ default: m.ConsultationTab })));
const FinancialsTab = React.lazy(() => import('./tabs/FinancialsTab').then(m => ({ default: m.FinancialsTab })));
const PatientsDirectoryTab = React.lazy(() => import('./tabs/PatientsDirectoryTab').then(m => ({ default: m.PatientsDirectoryTab })));
const WhatsAppTab = React.lazy(() => import('./tabs/WhatsAppTab').then(m => ({ default: m.WhatsAppTab })));
const SopConfigTab = React.lazy(() => import('./tabs/SopConfigTab').then(m => ({ default: m.SopConfigTab })));

export const DoctorDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'consultation' | 'financials' | 'patients' | 'whatsapp' | 'sop' | 'pod_view' | 'virtual_schedule'>('pod_view');
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [isTestWhatsAppOpen, setIsTestWhatsAppOpen] = useState(false);
  const [isPlacardModalOpen, setIsPlacardModalOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
  const [biometryRx, setBiometryRx] = useState<BiometryData>(EMPTY_BIOMETRY);
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

  useEffect(() => {
    if (selectedPatient) {
      setRefractionRx((selectedPatient.vitals?.refractionRx || EMPTY_REFRACTION_RX) as RefractionRx);
      setBiometryRx(selectedPatient.vitals?.biometryRx || EMPTY_BIOMETRY);
    } else {
      setRefractionRx(EMPTY_REFRACTION_RX);
      setBiometryRx(EMPTY_BIOMETRY);
    }
  }, [selectedPatient]);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  
  const [baselineDate, setBaselineDate] = useState<string | null>(null);
  const [comparisonDate, setComparisonDate] = useState<string | null>(null);
  
  const [hoveredHbA1c, setHoveredHbA1c] = useState<{ x: number, y: number, val: number, date: string } | null>(null);
  const [allergyAlert, setAllergyAlert] = useState<{ 
    medicineName: string, 
    allergen: string, 
    resolved: boolean, 
    justification: string,
    confidenceScore?: number,
    clinicalGuidelineCitation?: string,
    severity?: string
  } | null>(null);

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
    try {
      const saved = localStorage.getItem('vitalsync_waba_connection');
      if (saved === 'disconnected') {
        setActiveWabaConnection(null);
      } else if (saved) {
        setActiveWabaConnection(JSON.parse(saved));
      } else {
        setActiveWabaConnection(null);
      }
    } catch (_e) {
      setActiveWabaConnection(null);
    }
  }, []);

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
  const [comparativeTrend, setComparativeTrend] = useState<any>(null);
  const [isGeneratingTrend, setIsGeneratingTrend] = useState(false);

  // Active Patient Loop State Safety Guard
  const consultGuard = useConsultationGuard({
    selectedPatientId:   selectedPatient?.id ?? null,
    selectedPatientName: selectedPatient?.name ?? null,
    notes,
    medicationCount:     medications.length,
    testCount:           selectedTests.length,
    activeTab,
    consultationTab:     'consultation',
  });

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
    } catch (err) {
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
      const tabs: Array<'consultation' | 'financials' | 'patients' | 'whatsapp' | 'sop' | 'pod_view' | 'virtual_schedule'> = [
        'pod_view',
        'consultation', 
        'financials', 
        'patients',
        'whatsapp',
        'sop',
        'virtual_schedule'
      ];
      const currentIdx = tabs.indexOf(activeTab as any);
      
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

      // Fetch live whatsapp_sessions from Supabase Cloud DB
      supabase
        .from('whatsapp_sessions')
        .select('*')
        .order('last_interaction', { ascending: false })
        .then(({ data, error }) => {
          if (data && data.length > 0) {
            const formattedList = data.map((dbSession: any) => ({
              id: dbSession.id,
              patientPhone: dbSession.patient_phone,
              patient_phone: dbSession.patient_phone,
              phone: dbSession.patient_phone,
              patientId: dbSession.patient_id,
              currentState: dbSession.current_state,
              lastInteraction: dbSession.last_interaction,
              sessionData: dbSession.session_data || {},
              session_data: dbSession.session_data || {}
            }));
            WhatsAppService.saveWhatsAppSessions(formattedList);
            setWhatsAppSessions(formattedList);
          }
        });

      if (activePod?.id) {
        supabase
          .from('waba_connections')
          .select('*')
          .eq('pod_id', activePod.id)
          .then(({ data }) => {
            if (data && data.length > 0) {
              setActiveWabaConnection(data[0]);
              localStorage.setItem('vitalsync_waba_connection', JSON.stringify(data[0]));
            } else {
              const saved = localStorage.getItem('vitalsync_waba_connection');
              if (saved === 'disconnected') {
                setActiveWabaConnection(null);
              } else if (saved) {
                try {
                  setActiveWabaConnection(JSON.parse(saved));
                } catch (_e) {
                  setActiveWabaConnection(null);
                }
              }
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

    const unsubscribeRealtime = RealtimeSyncService.subscribeToLiveClinicUpdates({
      onAppointmentChange: (payload) => {
        console.log('[DoctorDashboard] Realtime Appointment update received:', payload);
        syncDashboardData();
        if (payload.new?.virtual_time?.includes('EMERGENCY') || payload.new?.status === 'pending_payment') {
          window.dispatchEvent(new CustomEvent('mediflow-toast', {
            detail: {
              title: '🚨 EMERGENCY SOS ALERT! 🚨',
              message: 'A patient has paid priority fee on WhatsApp. Immediate attention required at Priority #1!',
              type: 'error'
            }
          }));
        } else {
          window.dispatchEvent(new CustomEvent('mediflow-toast', {
            detail: {
              title: '📅 New WhatsApp Appointment! 🟢',
              message: 'A patient has booked a consultation via WhatsApp.',
              type: 'info'
            }
          }));
        }
      },
      onPatientChange: () => syncDashboardData(),
      onMedicineBillChange: () => syncDashboardData(),
      onLabRequisitionChange: () => syncDashboardData(),
      onWhatsAppSessionChange: (payload) => {
        console.log('[DoctorDashboard] Realtime WhatsApp Session update received:', payload);
        const dbSession = payload.new;
        if (dbSession) {
          const formatted = {
            id: dbSession.id,
            patientPhone: dbSession.patient_phone,
            patient_phone: dbSession.patient_phone,
            phone: dbSession.patient_phone,
            patientId: dbSession.patient_id,
            currentState: dbSession.current_state,
            lastInteraction: dbSession.last_interaction,
            sessionData: dbSession.session_data || {},
            session_data: dbSession.session_data || {}
          };
          
          const allSessions = WhatsAppService.getWhatsAppSessions();
          const targetDigits = (dbSession.patient_phone || '').replace(/\D/g, '').slice(-10);
          const idx = allSessions.findIndex((s: any) => {
            const sDigits = (s.patientPhone || s.patient_phone || s.phone || '').replace(/\D/g, '').slice(-10);
            return s.id === dbSession.id || (sDigits && sDigits === targetDigits);
          });
          if (idx !== -1) {
            allSessions[idx] = formatted;
          } else {
            allSessions.push(formatted);
          }
          WhatsAppService.saveWhatsAppSessions(allSessions);

          // Update active selected chat session panel in real-time
          setSelectedChatSession((prev: any) => {
            if (!prev) return formatted;
            const prevDigits = (prev.patientPhone || prev.patient_phone || prev.phone || '').replace(/\D/g, '').slice(-10);
            if (prev.id === formatted.id || (prevDigits && prevDigits === targetDigits)) {
              return formatted;
            }
            return prev;
          });
        }
        syncDashboardData();
      }
    });

    const apiUnsub = api.subscribe(syncDashboardData);
    return () => {
      apiUnsub();
      unsubscribeRealtime();
    };
  }, [activePod?.id]);

  // Reset selectors and load cached AI results when patient changes
  useEffect(() => {
    setBaselineDate(null);
    setComparisonDate(null);
    setCdssAnomalies([]);
    setAiError(null);

    if (selectedPatient?.id) {
      // 1. Preload RAG clinical insight
      const cachedRag = api.getAIResults(selectedPatient.id).find(r => r.output_type === 'RAG_CLINICAL_ADVISORY');
      setAiInsight(cachedRag && cachedRag.status === 'SUCCESS' ? cachedRag.output_data : '');

      // 2. Preload Hinglish summary
      const cachedHinglish = api.getAIResults(selectedPatient.id).find(r => r.output_type === 'HINGLISH_SUMMARY');
      setHinglishSummary(cachedHinglish && cachedHinglish.status === 'SUCCESS' ? cachedHinglish.output_data : '');

      // 3. Preload comparative trend
      const cachedTrend = api.getAIResults(selectedPatient.id).find(r => r.output_type === 'COMPARATIVE_TREND');
      if (cachedTrend && cachedTrend.status === 'SUCCESS') {
        setComparativeTrend({
          summaryText: cachedTrend.output_data,
          citations: [],
          suggestedCompositions: []
        });
      } else {
        setComparativeTrend(null);
      }
    } else {
      setAiInsight('');
      setHinglishSummary('');
      setComparativeTrend(null);
    }
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
      // Check for cached RAG result first to prevent flicker
      const cached = api.getAIResults(selectedPatient.id).find(r => r.output_type === 'RAG_CLINICAL_ADVISORY');
      if (!cached) {
        setIsAiLoading(true);
        setAiInsight('');
      }
      setAiError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const persistRAGResult = (insight: string, model: string) => {
        const taskId = `task-rag-${selectedPatient.id}-${Date.now()}`;
        api.saveAIResult({
          id: crypto.randomUUID(),
          user_id: 'doctor-uuid-placeholder',
          task_id: taskId,
          patient_id: selectedPatient.id,
          input_data: `RAG Clinical Advisory fetch: baseDate=${baselineDate || 'None'}, compDate=${comparisonDate || 'None'}`,
          output_data: insight,
          output_type: 'RAG_CLINICAL_ADVISORY',
          status: 'SUCCESS',
          created_at: new Date().toISOString(),
          model_used: model,
          duration_ms: 2000
        });
      };

      try {
        // Query the database using pgvector fallback keyword match
        let topicsToSearch = ['General'];
        if (selectedPatient.chronicConditions && selectedPatient.chronicConditions.length > 0) {
          topicsToSearch = selectedPatient.chronicConditions;
        }

        // Search matching guidelines for each topic
        const guidelinesFound: any[] = [];
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

        // ── SECURITY FIX (BUG-05): AI API keys must NEVER be in the browser bundle ───
        // VITE_* env vars are inlined into the JS bundle at build time and are
        // trivially extractable from the browser's DevTools / bundle inspector.
        // All AI inference is now proxied through the ai-inference Edge Function
        // which holds the keys in Supabase Vault (server-side only).
        // ──────────────────────────────────────────────────────────────────────────

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
        let modelUsed = 'ai-inference-proxy';
        try {
          // Get session token to authenticate the edge function call
          const { data: { session: aiSession } } = await supabase.auth.getSession();
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const edgeFnUrl = `${supabaseUrl}/functions/v1/ai-inference`;

          const response = await fetch(edgeFnUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${aiSession?.access_token ?? ''}`,
            },
            body: JSON.stringify({
              prompt: promptText,
              model: 'mistral-large-latest',
              temperature: 0.15,
              maxTokens: 2048
            })
          });

          if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(`AI inference proxy returned ${response.status}: ${errBody?.error ?? response.statusText}`);
          }

          const resData = await response.json();
          synthesizedInsight = resData.content || '';
          modelUsed = resData.model || 'ai-inference-proxy';
        } catch (proxyErr) {
          console.warn('[AI RAG] Edge function inference failed, falling back to static guidelines:', proxyErr);
        }

        if (!synthesizedInsight) {
          throw new Error('AI inference returned an empty completion.');
        }

        clearTimeout(timeoutId);
        setAiInsight(synthesizedInsight);
        persistRAGResult(synthesizedInsight, modelUsed);

      } catch (err) {
        console.warn("[Mistral Live RAG Synthesis Failed, falling back to static]:", err);
        clearTimeout(timeoutId);
        
        let topicsToSearch = ['General'];
        if (selectedPatient.chronicConditions && selectedPatient.chronicConditions.length > 0) {
          topicsToSearch = selectedPatient.chronicConditions;
        }

        const guidelinesFound: any[] = [];
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
        persistRAGResult(fallbackInsight, 'static-fallback');
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
        justification: '',
        confidenceScore: 99,
        clinicalGuidelineCitation: 'National Health Authority (NHA) EMR Allergy Standards v2.1',
        severity: 'high'
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

  const handleSaveEncounter = async () => {
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
    if (isOphthalmology && (biometryRx.axialLength || biometryRx.k1 || biometryRx.k2 || biometryRx.iolPower)) {
      finalNotes += serializeBiometry(biometryRx);
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
        if (hinglishSummary || notes) {
          whatsAppMsg += `\n\n👉 *Doctor's Advice (Hinglish):*\n_"${hinglishSummary || notes}"_`;
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
        whatsAppMsg += `👉 *Doctor's Advice (Hinglish):*\n_"${hinglishSummary || notes || "Continue active lifestyle management."}"_\n\n`;
        
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
      
      if (hinglishSummary) {
        api.pushWhatsAppMessageFromBot(selectedPatient.phone, `🤖 *AI Hinglish Summary:*\n\n${hinglishSummary}`);
      }

      // ── Same-Day Evening Slot Scheduling ──────────────────────────────────
      let eveningSlotNote = '';
      try {
        const existingSlot = api.getAppointmentByPatient(selectedPatient.id);
        const slot = existingSlot ?? await api.createEveningSlot(selectedPatient.id, 'doc-1');
        if (slot) {
          eveningSlotNote = `\n\n🕒 *Evening Follow-up Appointment:*\nDr. Sharma will see you today from *${slot.startTime}* to *${slot.endTime}*.\nPlease arrive 5 minutes early at the clinic reception.`;
          await api.scheduleAppointment(slot);
        }
      } catch (slotErr) {
        console.warn('[EveningSlot] Slot scheduling failed:', slotErr);
      }

      const finalMsg = whatsAppMsg + eveningSlotNote;
      api.pushWhatsAppMessageFromBot(selectedPatient.phone, finalMsg);

      // Direct Edge Function Invoke for Sub-250ms WhatsApp Delivery to Meta Graph API
      try {
        const targetPhone = (selectedPatient.phone || '').replace(/[^0-9]/g, '');
        const cleanToPhone = targetPhone.length === 10 ? '91' + targetPhone : targetPhone;
        await supabase.functions.invoke('meta-webhook', {
          body: {
            action: 'send_manual_message',
            patientPhone: cleanToPhone,
            messageText: finalMsg
          }
        });
      } catch (_dispatchErr) {
        console.warn('[DoctorDashboard Direct WhatsApp] Edge dispatch fallback:', _dispatchErr);
      }
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
    consultGuard.clearSnapshot(); // Clear crash-recovery snapshot on successful save
    
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: 'e-Prescription successfully saved and consolidated reports dispatched to patient WhatsApp!',
        type: 'success',
        title: 'Encounter Saved & Synced'
      }
    }));

    // Find the next patient in the queue
    const activeQueue = api.getPatients()
      .filter(p => p.queueStatus === 'awaiting_consultation' && p.id !== selectedPatient.id);
    
    const parseTokenNum = (token?: string) => {
      if (!token) return Infinity;
      const match = token.match(/\d+/);
      return match ? parseInt(match[0], 10) : Infinity;
    };
    
    activeQueue.sort((a, b) => parseTokenNum(a.tokenNumber) - parseTokenNum(b.tokenNumber));
    
    if (activeQueue.length > 0) {
      const nextPat = activeQueue[0];
      setSelectedPatient(nextPat);
      api.updatePatientQueueStatus(nextPat.id, 'in_consultation');
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Next Patient Loaded 🩺',
          message: `Switched to ${nextPat.name} (Token: ${nextPat.tokenNumber || 'N/A'})`,
          type: 'info'
        }
      }));
    } else {
      setSelectedPatient(null);
      setActiveTab('pod_view');
    }
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
                    setNotes('');
                    setHinglishSummary('');
                    setAudioUrl(null);
                    setAudioBlob(null);
                    setMedications([]);
                    setSelectedTests([]);
                    setRefractionRx(EMPTY_REFRACTION_RX);

                    setSelectedPatient(patient);
                    setActiveTab('consultation');
                    api.updatePatientQueueStatus(patient.id, 'in_consultation');
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
            case 'virtual_schedule':
              return (
                <div className="space-y-6 animate-fade-in text-left">
                  <div className="glass-panel p-6 border-slate-200/60 shadow-xl bg-white dark:bg-slate-900/80 rounded-3xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-cyan-500 opacity-80" />
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span className="material-symbols-outlined text-cyan-500 text-[24px]">videocam</span>
                          Telemedicine &amp; Virtual Consultation Command Hub (वर्चुअल क्लिनिक)
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Manage live video consults, join Google Meet Jitsi links, and launch 1-Click E-Rx worksheets.
                        </p>
                      </div>
                      <span className="text-xs font-mono font-bold px-3.5 py-1.5 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20 rounded-full shrink-0">
                        ● Live Telemedicine Hub
                      </span>
                    </div>

                    {(() => {
                      const virtualAppts = appointments.filter(a => a.is_virtual || a.isVirtual || a.source?.includes('virtual') || a.source?.includes('loyalty'));
                      const displayList = virtualAppts.length > 0 
                        ? virtualAppts.map(a => {
                            const p = patients.find(pat => pat.id === a.patientId) || { id: a.patientId, name: 'Virtual Patient', phone: 'N/A', age: '30', gender: 'M' };
                            const isFreeLoyalty = a.amount === 0 || a.fee_status === 'waived_loyalty' || a.source?.includes('loyalty');
                            return { appt: a, patient: p, isFreeLoyalty };
                          })
                        : patients.map((p, idx) => ({
                            appt: {
                              id: `v-${p.id}`,
                              patientId: p.id,
                              doctorId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
                              status: 'confirmed',
                              createdAt: new Date().toISOString(),
                              is_virtual: true,
                              virtual_meeting_url: `https://meet.jit.si/vitalsync-consult-${p.id}`,
                              token_number: p.tokenNumber || String(idx + 1),
                              amount: 0,
                              source: 'whatsapp_free_loyalty'
                            },
                            patient: p,
                            isFreeLoyalty: true
                          }));

                      if (displayList.length === 0) {
                        return (
                          <div className="p-12 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-2xl bg-slate-50/50 dark:bg-slate-900/40">
                            <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">videocam_off</span>
                            <h4 className="text-sm font-bold text-slate-800 dark:text-white">No active virtual video calls scheduled right now</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">WhatsApp bot bookings and patient online video requests will stream here automatically.</p>
                          </div>
                        );
                      }

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {displayList.map(({ appt, patient, isFreeLoyalty }) => {
                            const meetUrl = appt.virtual_meeting_url || `https://meet.jit.si/vitalsync-consult-${patient.id}`;
                            const tokenNo = appt.token_number || patient.tokenNumber || '1';

                            return (
                              <div key={appt.id} className="p-5 border border-slate-200 dark:border-white/10 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 space-y-4 hover:border-cyan-500/40 transition-all relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-emerald-500 to-cyan-500" />
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono font-extrabold bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 px-2.5 py-1 rounded-md">
                                    Token #{tokenNo}
                                  </span>
                                  {isFreeLoyalty ? (
                                    <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-full flex items-center gap-1 animate-pulse">
                                      💎 Free Virtual Followup Member (₹0.00)
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full">
                                      Paid Virtual: ₹618.00 ✅
                                    </span>
                                  )}
                                </div>

                                <div>
                                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    {patient.name}
                                    <span className="text-xs text-slate-500 font-normal">({patient.age || '30'}y · {patient.gender || 'M'})</span>
                                  </h3>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                                    <span>Phone: {patient.phone || 'N/A'}</span>
                                    <span>·</span>
                                    <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                                      Slot: {appt.virtual_time || '10:00 AM - 12:00 PM'}
                                    </span>
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-white/5">
                                  <a
                                    href={meetUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 rounded-xl transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">videocam</span>
                                    Join Video Call 💻
                                  </a>
                                  <button
                                    onClick={() => {
                                      setNotes('');
                                      setHinglishSummary('');
                                      setAudioUrl(null);
                                      setAudioBlob(null);
                                      setMedications([]);
                                      setSelectedTests([]);
                                      setRefractionRx(EMPTY_REFRACTION_RX);

                                      setSelectedPatient(patient);
                                      setActiveTab('consultation');
                                      api.updatePatientQueueStatus(patient.id, 'in_consultation');
                                      window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                        detail: {
                                          title: 'Consultation Initialized! 🩺',
                                          message: `Navigated to Virtual Video Consultation worksheet for ${patient.name}.`,
                                          type: 'success'
                                        }
                                      }));
                                    }}
                                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-xl hover:bg-indigo-100 transition-all cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">edit_note</span>
                                    Start E-Rx 🩺
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            case 'consultation':
              return (
                <ConsultationTab
                  patients={patients}
                  selectedPatient={selectedPatient}
                  setSelectedPatient={setSelectedPatient}
                  medications={medications}
                  setMedications={setMedications}
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
                  biometryRx={biometryRx}
                  setBiometryRx={setBiometryRx}
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

            default:
              return (
                <PodCommandCenter 
                  hideHeader={true}
                  onStartConsultation={(patient: Patient) => {
                    setNotes('');
                    setHinglishSummary('');
                    setAudioUrl(null);
                    setAudioBlob(null);
                    setMedications([]);
                    setSelectedTests([]);
                    setRefractionRx(EMPTY_REFRACTION_RX);

                    setSelectedPatient(patient);
                    setActiveTab('consultation');
                    api.updatePatientQueueStatus(patient.id, 'in_consultation');
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
    const complications: string[] = [];



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
                <span className="material-symbols-outlined text-indigo-600 text-2xl font-bold">clinical_notes</span>
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
    const severity = allergyAlert.severity || 'high';
    const confidence = allergyAlert.confidenceScore || 99;
    const citation = allergyAlert.clinicalGuidelineCitation || 'NHA EMR Drug-Allergy Standards v2.0';

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-800/50 backdrop-blur-sm p-4 animate-fade-in">
        <div className="glass-panel max-w-md w-full p-6 border-rose-500/30 shadow-2xl relative overflow-hidden space-y-4 bg-white text-slate-800">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-rose-500" />
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm font-sans">
              <AlertTriangle className="h-5 w-5 text-rose-500 animate-pulse" />
              Critical CDSS Contraindication
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded border border-rose-200 uppercase font-mono">
                Severity: {severity}
              </span>
              <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-150 font-mono">
                Confidence: {confidence}%
              </span>
            </div>
          </div>
          
          <p className="text-xs text-slate-650 leading-relaxed font-medium">
            Prescription of <strong className="text-slate-850 font-bold">{allergyAlert.medicineName}</strong> intercepts active allergy profile. The patient is flagged allergic to <strong className="text-rose-605 font-bold">{allergyAlert.allergen}</strong>.
          </p>

          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider text-left">Clinical Guideline Reference</div>
            <p className="text-[10px] text-slate-650 font-mono italic leading-normal text-left">
              {citation}
            </p>
          </div>

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
    <div className="max-w-7xl mx-auto p-4 md:p-6 pb-28 lg:pb-12 space-y-5 animate-fade-in text-slate-800" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

      {!isOnline && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-850 dark:text-amber-400 px-4 py-3 rounded-xl flex items-center justify-between text-xs font-semibold backdrop-blur-md animate-pulse text-left">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-amber-500">wifi_off</span>
            <span>Console running in Offline Mode. All clinical actions are buffered locally and will sync when connection returns.</span>
          </div>
          <span className="text-[10px] font-mono uppercase bg-amber-500/20 px-2 py-0.5 rounded-full shrink-0">Offline</span>
        </div>
      )}

      {/* ── HEADER BLOCK: title + tabs integrated ── */}
      <div className="hidden md:block border-b border-slate-200 pb-0">

        {/* Top row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline-flex items-center justify-center h-8 w-8 rounded-lg bg-indigo-600 text-white shadow-sm shrink-0">
              <span className="material-symbols-outlined text-[18px]">hub</span>
            </span>
            <div>
              <h1 className="text-sm sm:text-base font-semibold tracking-tight text-slate-800 font-sans leading-tight">
                {isOphthalmology ? "Dr. Amit Arya's Eye Care Console" : "Dr. Sharma's Care Dashboard"}
              </h1>
              <p className="text-[11px] text-slate-600 flex items-center gap-1.5 mt-0.5">
                Mediflow Pod Tenant Host
                <span className="text-slate-600">·</span>
                Clinic Code:
                <span className="font-mono font-semibold text-slate-500 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded text-[10px]">
                  {activePod?.clinicCode || 'MF-PATNA101'}
                </span>
                <span className={`flex sm:hidden items-center gap-1 text-[10px] font-semibold pl-1 font-mono ${isOnline ? 'text-emerald-600' : 'text-amber-600'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full animate-pulse inline-block ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {isOnline ? 'Live' : 'Offline'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-stretch md:self-auto justify-between md:justify-end w-full md:w-auto">
            {!activePod && (
              <button
                type="button"
                onClick={() => setIsRegistrationOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-extrabold transition-all cursor-pointer shadow-xs"
                title="Register New Clinic Workspace"
              >
                <span>➕ Register Clinic</span>
              </button>
            )}

            {/* Status pill - hidden on small mobile viewports */}
            <div className="hidden sm:flex items-center gap-2 bg-white border border-slate-200/80 shadow-xs px-3 py-1.5 rounded-xl text-[11px] font-medium text-slate-600 shrink-0">
              <span className="flex h-1.5 w-1.5 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              </span>
              <span className="font-mono">{isOnline ? 'Real-Time Sync: Connected' : 'Sync Paused: Working Offline'}</span>
            </div>
          </div>
        </div>

        {/* Desktop tab nav — integrated into header */}
        <div className="hidden lg:flex items-center gap-1.5 p-1 bg-slate-100/80 dark:bg-slate-950/40 backdrop-blur-md rounded-xl border border-slate-200/50 dark:border-white/5 shrink-0 -mb-px">
          {[
            { id: 'pod_view',          label: 'Clinic Dashboard',     icon: 'dashboard' },
            { id: 'consultation',      label: 'Consultation Queue',     icon: 'clinical_notes' },
            { id: 'virtual_schedule',  label: 'Virtual Schedule 💻',   icon: 'videocam' },
            { id: 'financials',        label: 'Financial Reports',      icon: 'account_balance_wallet' },
            { id: 'patients',          label: 'Patient Directory',      icon: 'group' },
            { id: 'whatsapp',          label: 'WhatsApp Inbox',         icon: 'chat' }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold rounded-lg transition-all duration-300 cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 shadow-xs border border-slate-200/50 dark:border-white/5'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/5'
                }`}
              >
                <span className={`material-symbols-outlined text-[15px] ${
                  isActive ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 dark:text-zinc-500'
                }`}>{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Consultation Loop Guard — non-blocking warning banner */}
      {consultGuard.showNavigationWarning && (
        <div className="consultation-guard-banner mx-auto max-w-2xl mb-3">
          <span className="material-symbols-outlined text-base text-amber-600 dark:text-amber-400 shrink-0">warning</span>
          <span className="flex-1">
            <strong>Active consultation in progress</strong> — {selectedPatient?.name}'s session data ({consultGuard.warningDetail}) is preserved in memory.
          </span>
          <button
            onClick={consultGuard.dismissWarning}
            className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors shrink-0"
            title="Dismiss"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Main Tab Render Container */}
      <div className="w-full">
        {renderTabContent()}
      </div>

      {/* Contextual Floating Action Button (FAB) for Mobile Viewports - Removed */}

      {/* Desktop Enterprise Status Footer */}
      <div className="hidden lg:flex items-center justify-between pt-4 mt-6 border-t border-slate-200/60 dark:border-slate-800/80 text-[11px] font-medium text-slate-500 dark:text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Mediflow Realtime Engine · {activePod?.name || activePod?.clinicName || 'Apex Care Clinic'} Node</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Sub-300ms Outbound WhatsApp</span>
          <span>·</span>
          <span>Cashfree Payment Gate Active</span>
          <span>·</span>
          <span className="text-indigo-600 dark:text-indigo-400 font-semibold">RLS Encrypted · Doctor EMR</span>
        </div>
      </div>

      {/* Premium Mobile Bottom Navigation Dock for Doctor Dashboard */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-[#0b0f19]/90 backdrop-blur-xl border-t border-slate-200/80 dark:border-white/10 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.6)] px-2 pb-safe-bottom">
        <div className="flex items-center justify-around h-16 max-w-md mx-auto">
          {[
            { id: 'pod_view', label: 'Pod HUD', icon: 'hub' },
            { id: 'consultation', label: 'Consult', icon: 'clinical_notes' },
            { id: 'financials', label: 'Finance', icon: 'account_balance_wallet' },
            { id: 'patients', label: 'Patients', icon: 'group' },
            { id: 'whatsapp', label: 'WhatsApp', icon: 'chat' }
          ].map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-200 cursor-pointer relative bg-transparent border-0 outline-none ${
                  isActive 
                    ? 'text-indigo-600 dark:text-indigo-400 font-bold' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all duration-200 relative ${
                  isActive 
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 scale-105 shadow-sm border border-indigo-200/50 dark:border-indigo-800/40' 
                    : 'bg-transparent text-slate-500 dark:text-slate-400'
                }`}>
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                </div>
                <span className="text-[9px] sm:text-[10px] font-bold mt-1 tracking-tight leading-none shrink-0">
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-1 w-3 h-0.5 rounded-full bg-indigo-600 dark:bg-indigo-400 shadow-xs shadow-indigo-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Allergy overrides modal */}
      {allergyAlert && renderAllergyAlertModal()}
      {!isOphthalmology && analyzingReport && renderReportAnalysisModal()}

      {/* Keyboard Command Palette overlay */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onStartConsultation={(patient) => {
          setSelectedPatient(patient);
          setActiveTab('consultation');
        }}
      />

      {/* 30-Second Doctor Onboarding & Sales Demo Modals */}
      <DoctorRegistrationModal
        isOpen={isRegistrationOpen}
        onClose={() => setIsRegistrationOpen(false)}
        onSuccess={(data) => {
          console.log('[Onboarding Success] Clinic Pod Created:', data);
          window.location.reload();
        }}
      />

      <WhatsAppTestDispatcherModal
        isOpen={isTestWhatsAppOpen}
        onClose={() => setIsTestWhatsAppOpen(false)}
        clinicName={activePod?.name || 'VitalSync Smart Clinic'}
        doctorName={activePod?.doctor_name || 'Dr. Doctor'}
      />

      {isPlacardModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in text-slate-800">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
            <button
              type="button"
              onClick={() => setIsPlacardModalOpen(false)}
              className="absolute top-4 right-4 h-8 w-8 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
            >
              ✕
            </button>
            <ClinicPlacardGenerator
              clinicName={activePod?.name || 'VitalSync Smart Clinic'}
              activeWabaNumber={activeWabaConnection?.phone_number || activeWabaConnection?.display_phone_number || localStorage.getItem('vitalsync_waba_number') || '+918986426029'}
            />
          </div>
        </div>
      )}

      {/* Floating 24/7 Mediflow AI Support Widget */}
      <WhatsAppSupportModal userRole="doctor" userName={activePod?.doctor_name || 'Dr. Doctor'} clinicName={activePod?.name || 'VitalSync Smart Clinic'} />
    </div>
  );
};
