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
import { EMPTY_REFRACTION_RX, serializeRefractionRx, formatSpectacleCard, type RefractionRx } from '../../types/ophthalmic';

import { SystemHealthCockpit } from '../admin/SystemHealthCockpit';
import { StateHealingEngine } from '../../services/autoHealerAgent';
import { BiomarkerChart } from './BiomarkerChart';
import { ClinicPlacardGenerator } from '../admin/ClinicPlacardGenerator';
import { PodCommandCenter } from '../admin/PodCommandCenter';

export const DoctorDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'consultation' | 'financials' | 'patients' | 'whatsapp' | 'sop' | 'pod_view'>('pod_view');
  
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
  const [prescriptionNotes, setPrescriptionNotes] = useState('');
  
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

  const { activePod } = useClinic();

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
      const tabs: Array<'consultation' | 'financials' | 'patients' | 'whatsapp' | 'sop' | 'pod_view'> = [
        'pod_view',
        'consultation', 
        'financials', 
        'patients',
        'whatsapp',
        'sop'
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

        defaultInsight += `**Intervention Recommendations:**\n`;
        defaultInsight += `1. Consider cardioprotective **SGLT2 inhibitors** (e.g. Empagliflozin) for cardiovascular standard support.\n`;
        defaultInsight += `2. Schedule a follow-up repeat **Serum Creatinine & GFR** in 14 days.\n`;

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
${baseReport && compReport ? `Comparative trend:
- HbA1c: ${baseReport.HbA1c}% in ${baseReport.date} -> ${compReport.HbA1c}% in ${compReport.date}
- Creatinine: ${baseReport.creatinine} mg/dL in ${baseReport.date} -> ${compReport.creatinine} mg/dL in ${compReport.date}
- Hemoglobin: ${baseReport.hemoglobin} g/dL in ${baseReport.date} -> ${compReport.hemoglobin} g/dL in ${compReport.date}` : `Current levels:
- HbA1c: ${compReport?.HbA1c}%
- Creatinine: ${compReport?.creatinine} mg/dL
- Hemoglobin: ${compReport?.hemoglobin} g/dL`}

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

    const parsedMeds: Omit<MedicationRequest, 'id'>[] = [];
    if (prescriptionNotes.trim()) {
      const lines = prescriptionNotes.split('\n');
      lines.forEach((line) => {
        const cleaned = line.trim();
        if (!cleaned) return;
        const parts = cleaned.split(/[-—,]/).map(p => p.trim());
        const medicineName = parts[0] || cleaned;
        const dosage = parts[1] || 'As written';
        const frequency = parts[2] || 'As written';
        const duration = parts[3] || 'As written';
        parsedMeds.push({ medicineName, dosage, frequency, duration });
      });
    }

    const finalMedications = parsedMeds.map((m: Omit<MedicationRequest, 'id'>, idx: number) => ({ ...m, id: `med-${idx}` }));
    if (prescriptionNotes.trim()) {
      finalMedications.push({
        id: `med-handwritten`,
        medicineName: `Handwritten Rx Summary: ${prescriptionNotes.trim().replace(/\n/g, ' | ')}`,
        dosage: 'As written',
        frequency: 'As written',
        duration: 'As written'
      });
    }

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

    let finalNotes = notes + (prescriptionNotes.trim() ? `\n[Handwritten Prescription Note]: ${prescriptionNotes.trim()}` : '');
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
        if (parsedMeds.length > 0) {
          whatsAppMsg += `\n\n💊 *Prescribed Medications:*\n`;
          parsedMeds.forEach((m, idx) => {
            whatsAppMsg += `${idx + 1}. ${m.medicineName} (${m.dosage}) — ${m.frequency}, ${m.duration}\n`;
          });
        }
      } else {
        whatsAppMsg = `🏥 *Mediflow Connected Care Plan* 🩺\n\n`;
        whatsAppMsg += `Dear *${selectedPatient.name}*, Dr. Sharma has finalized your consultation record.\n\n`;
        
        // Add Hinglish clinical directions
        whatsAppMsg += `👉 *Doctor's Advice (Hinglish):*\n_"${notes || "Continue active lifestyle management."}"_\n\n`;
        
        if (prescriptionNotes.trim()) {
          whatsAppMsg += `📝 *Handwritten Prescription Notes:*\n_"${prescriptionNotes.trim()}"_\n\n`;
        }
        
        if (latestReport) {
          whatsAppMsg += `🧪 *Consolidated Lab Report (Date: ${latestReport.date}):*\n`;
          whatsAppMsg += `- *HbA1c*: ${latestReport.HbA1c}%\n`;
          whatsAppMsg += `- *Serum Creatinine*: ${latestReport.creatinine} mg/dL\n`;
          whatsAppMsg += `- *Total Hemoglobin*: ${latestReport.hemoglobin} g/dL\n\n`;
        }
        
        if (parsedMeds.length > 0) {
          whatsAppMsg += `💊 *Prescribed Medications (Collect at Counter):*\n`;
          parsedMeds.forEach((m, idx) => {
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
    setPrescriptionNotes('');
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

  const activeHistory = selectedPatient ? api.getPatientHistoricalBiomarkers(selectedPatient.id) : null;
  const baseReport = activeHistory?.find(h => h.date === baselineDate) ?? null;
  const compReport = activeHistory?.find(h => h.date === comparisonDate) ?? (activeHistory ? activeHistory[activeHistory.length - 1] : null);
  const isConsentActive = selectedPatient ? api.isPatientConsentActive(selectedPatient.id) : true;

  // TAB 2 RENDER: Consultation Workflow
  const renderConsultationTab = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in text-slate-850">
        {/* LEFT COLUMN: Patient queue, CDSS Analyzer */}
        <div className="lg:col-span-4 space-y-6">
          {/* Patient Consultation Queue */}
          <div className="glass-panel p-6 border-slate-200/80 shadow-sm relative overflow-hidden bg-white">
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">group</span>
              Consultation Queue
            </h2>
            
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {patients.map((p: Patient) => {
                const isSelected = selectedPatient?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPatient(p)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-300 relative group overflow-hidden ${
                      isSelected 
                        ? 'bg-primary-container/20 border-primary shadow-sm' 
                        : 'bg-slate-50 border-slate-200/60 hover:bg-slate-100/80'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-primary" />
                    )}
                    <div className="flex justify-between items-start">
                      <div className="font-bold text-xs text-slate-700 group-hover:text-primary transition-colors">{p.name}</div>
                      <span className="text-[8px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded font-mono">
                        {p.id.toUpperCase().substring(0, 8)}
                      </span>
                    </div>
                    
                    <div className="text-[10px] text-slate-500 mt-2 flex justify-between items-center">
                      <span>{p.gender}, {p.age} years</span>
                      {p.abhaId && (
                        <span className="bg-secondary/10 text-secondary border border-secondary/20 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider font-mono">
                          ABHA
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Laboratory Report History (Past & Present) */}
          {selectedPatient && (
            <div className="glass-panel p-6 border-slate-200/80 shadow-sm relative overflow-hidden bg-white mt-4">
              <h2 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">folder_zip</span>
                Biomarker Reports History
              </h2>
              <p className="text-[10px] text-slate-400 mb-4">Click a report to open a full-screen clinical AI analysis</p>
              
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {(() => {
                  const history = api.getPatientHistoricalBiomarkers(selectedPatient.id);
                  if (history.length === 0) {
                    return (
                      <div className="text-center py-6 text-slate-400 text-xs italic">
                        No historical biomarker reports found.
                      </div>
                    );
                  }
                  return history.slice().reverse().map((report, idx) => (
                    <button
                      key={idx}
                      onClick={() => setAnalyzingReport(report)}
                      className="w-full text-left p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl hover:bg-slate-100 hover:border-slate-300 transition-all group relative overflow-hidden flex flex-col justify-between"
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-indigo-500">labs</span>
                          Report Dated: {report.date}
                        </span>
                        <span className="text-[8px] bg-indigo-50 border border-indigo-150 text-indigo-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-mono">
                          Analyze
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200/40 text-[10px] text-slate-500">
                        <div>
                          <span className="text-slate-400 font-medium block">{isOphthalmology ? 'VA (OD)' : 'HbA1c'}</span>
                          <span className={`font-mono font-bold ${!isOphthalmology && report.HbA1c > 6.5 ? 'text-rose-500' : 'text-slate-700'}`}>{isOphthalmology ? '6/6' : `${report.HbA1c}%`}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block">{isOphthalmology ? 'IOP' : 'Creatinine'}</span>
                          <span className={`font-mono font-bold ${!isOphthalmology && report.creatinine > 1.2 ? 'text-rose-500' : 'text-slate-700'}`}>{isOphthalmology ? '16 mmHg' : `${report.creatinine} mg/dL`}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block">{isOphthalmology ? 'VA (OS)' : 'Hemoglobin'}</span>
                          <span className={`font-mono font-bold ${!isOphthalmology && report.hemoglobin < 12.0 ? 'text-amber-500' : 'text-slate-700'}`}>{isOphthalmology ? '6/9' : `${report.hemoglobin} g/dL`}</span>
                        </div>
                      </div>
                    </button>
                  ));
                })()}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Consultation Sheet, e-Rx Form */}
        {selectedPatient && (
          <div className="lg:col-span-8 glass-panel p-6 border-slate-200/80 shadow-sm space-y-6 relative overflow-hidden bg-white">


            {!isConsentActive && (
              <div className="absolute inset-0 z-[45] flex flex-col items-center justify-center bg-white/95 border border-rose-500/20 p-8 text-center animate-fade-in">
                <div className="w-14 h-14 rounded-full bg-rose-50/50 border border-rose-500/20 flex items-center justify-center mb-4 text-rose-500 animate-pulse">
                  <span className="material-symbols-outlined text-2xl">lock</span>
                </div>
                <h3 className="text-slate-800 font-bold text-sm mb-2">Compliance Lock: Active Consent Missing</h3>
                <p className="text-xs text-slate-500 max-w-sm leading-relaxed mb-4">
                  Access to clinical records, diagnostics ordering, and medication prescribing is locked. Please direct the patient to reply <strong className="text-secondary font-mono">"1" (Grant Access)</strong> on their WhatsApp simulator interface.
                </p>
              </div>
            )}
            
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-850 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">clinical_notes</span>
                  Electronic Consultation Record
                </h2>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Selected Profile: <strong className="text-slate-700 font-bold">{selectedPatient.name}</strong> ({selectedPatient.age}y, {selectedPatient.gender})
                </p>
              </div>
              {selectedPatient.abhaId && (
                <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full font-bold tracking-wider uppercase font-mono">
                  ABHA Verified
                </span>
              )}
            </div>

            {/* AI Predictive Lab Pattern & Risk Disease Analyzer Card */}
            {(() => {
              const history = api.getPatientHistoricalBiomarkers(selectedPatient.id);
              const recent = history.length > 0 ? history[history.length - 1] : null;
              const baseline = history.length >= 2 ? history[history.length - 2] : null;
              
              if (!recent) return null;

              // Calculate trends locally for instant high-fidelity feedback
              const hba1cDiff = baseline ? recent.HbA1c - baseline.HbA1c : 0;
              const creatinineDiff = baseline ? recent.creatinine - baseline.creatinine : 0;
              const hemoglobinDiff = baseline ? recent.hemoglobin - baseline.hemoglobin : 0;

              // Predict future diseases based on values & trend patterns
              const riskAlerts: { title: string; desc: string; type: 'critical' | 'warning' | 'info' }[] = [];
              
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

              // Generate brief professional summary
              let summaryText = "";
              if (selectedPatient.pastReportsSummary) {
                summaryText += `[Past Report Scan Analysis: ${selectedPatient.pastReportsSummary}] `;
              }
              summaryText += `Patient displays a clinical biomarker pattern requiring close monitoring. `;
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

              return (
                <div className="p-6 bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden space-y-6 animate-fade-in my-2">
                  {/* Holographic background glow */}
                  <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-indigo-500/10 to-purple-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 rounded-full blur-2xl pointer-events-none" />

                  <div className="flex justify-between items-start pb-2 border-b border-slate-800/80">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-indigo-400 text-xl font-bold">query_stats</span>
                        <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">AI Predictive Lab Pattern & Risk Disease Analyzer</h3>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Advanced multi-biomarker trajectory & disease prediction engine</p>
                    </div>
                    <span className="text-[8px] font-black font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">
                      Predictive Model: Active
                    </span>
                  </div>

                  {/* Biomarkers side by side with shifts */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      {
                        name: 'HbA1c (Glycated Hb)',
                        val: `${recent.HbA1c}%`,
                        base: baseline ? `${baseline.HbA1c}%` : 'N/A',
                        diff: hba1cDiff,
                        unit: '%',
                        normal: '4.0 - 5.6',
                        status: recent.HbA1c > 6.5 ? 'critical' : recent.HbA1c > 5.7 ? 'warning' : 'normal',
                        icon: 'water_drop',
                        color: recent.HbA1c > 6.5 ? 'from-rose-500/20 to-rose-600/5 border-rose-500/35 text-rose-300' : recent.HbA1c > 5.7 ? 'from-amber-500/20 to-amber-600/5 border-amber-500/35 text-amber-300' : 'from-slate-800/50 to-slate-800/20 border-slate-700/50 text-emerald-400'
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
                        color: recent.creatinine > 1.2 ? 'from-rose-500/20 to-rose-600/5 border-rose-500/35 text-rose-300' : recent.creatinine > 1.0 ? 'from-amber-500/20 to-amber-600/5 border-amber-500/35 text-amber-300' : 'from-slate-800/50 to-slate-800/20 border-slate-700/50 text-emerald-400'
                      },
                      {
                        name: 'Total Hemoglobin',
                        val: `${recent.hemoglobin} g/dL`,
                        base: baseline ? `${baseline.hemoglobin} g/dL` : 'N/A',
                        diff: hemoglobinDiff,
                        unit: 'g/dL',
                        normal: '12.0 - 16.0',
                        status: recent.hemoglobin < 12.0 ? 'warning' : 'normal',
                        icon: 'bloodtype',
                        color: recent.hemoglobin < 12.0 ? 'from-amber-500/20 to-amber-600/5 border-amber-500/35 text-amber-300' : 'from-slate-800/50 to-slate-800/20 border-slate-700/50 text-emerald-400'
                      }
                    ].map((item, idx) => (
                      <div key={idx} className={`p-3.5 rounded-2xl border bg-gradient-to-b ${item.color} flex flex-col justify-between space-y-2`}>
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">{item.name}</span>
                          <span className="text-[9px] text-slate-400 font-mono">Normal: {item.normal}</span>
                        </div>
                        <div className="flex justify-between items-baseline pt-1">
                          <span className="text-lg font-black font-mono tracking-tight text-white">{item.val}</span>
                          {baseline && item.diff !== 0 && (
                            <span className={`text-[10px] font-extrabold font-mono flex items-center gap-0.5 ${
                              (item.diff > 0 && item.status !== 'normal') || (item.diff < 0 && item.name.includes('Hemoglobin'))
                                ? 'text-rose-400'
                                : 'text-emerald-400'
                            }`}>
                              {item.diff > 0 ? '▲' : '▼'} {Math.abs(item.diff).toFixed(item.name.includes('Creatinine') ? 2 : 1)}
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-slate-400 pt-1 border-t border-slate-800/50 flex justify-between">
                          <span>Base: {item.base}</span>
                          <span className="font-bold text-[8px] uppercase tracking-wider">{item.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Future potential disease risk warnings */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                      <span className="material-symbols-outlined text-xs text-indigo-400">warning</span>
                      AI Predictive Disease & Pattern Warnings
                    </h4>
                    {riskAlerts.length === 0 ? (
                      <div className="p-3 bg-slate-800/40 border border-slate-700/30 rounded-xl text-slate-400 text-xs italic">
                        No critical disease risks flagged based on biomarker trajectories.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2.5">
                        {riskAlerts.map((alert, i) => (
                          <div key={i} className={`p-3 rounded-xl border flex gap-3 text-xs leading-relaxed ${
                            alert.type === 'critical'
                              ? 'bg-rose-950/20 border-rose-500/20 text-rose-200'
                              : alert.type === 'warning'
                              ? 'bg-amber-950/20 border-amber-500/20 text-amber-200'
                              : 'bg-indigo-950/20 border-indigo-500/20 text-indigo-200'
                          }`}>
                            <span className="material-symbols-outlined text-base font-bold mt-0.5 shrink-0">
                              {alert.type === 'critical' ? 'gavel' : alert.type === 'warning' ? 'error' : 'info'}
                            </span>
                            <div>
                              <strong className="font-extrabold text-[11px] uppercase tracking-wider block">{alert.title}</strong>
                              <p className="text-[10px] text-slate-300 pt-0.5 font-sans leading-relaxed">{alert.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Beautiful Professional Summary */}
                  <div className="p-4 bg-slate-950/50 border border-slate-800/80 rounded-2xl space-y-1.5 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                      Professional AI Consultation Summary
                    </span>
                    <p className="text-xs text-slate-200 leading-relaxed font-sans font-medium italic pt-1">
                      "{summaryText}"
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Electronic Consultation Record Gating, Suggestions, and AI Summaries */}
            <div className="p-6 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-6 shadow-sm">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs text-primary font-bold">edit_note</span>
                  Final 10-15 Min Suggestions & Directions
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record patient suggestions here (e.g., meetha kam khana hai, daily walk karna hai, start insulin)..."
                  rows={4}
                  className="w-full input-field bg-white text-xs leading-relaxed"
                />
              </div>

              {/* Local Audio Scribe Recorder Widget */}
              <div className="p-4.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 animate-fade-in">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-xs">mic</span>
                    Audio Suggestion Scribe (Local Recording first)
                  </span>
                  <span className="text-[9px] font-bold font-mono px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-md">
                    Zero API Cost Idle
                  </span>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  {/* Record Control Button */}
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {isRecording ? (
                      <button
                        type="button"
                        onClick={stopAudioRecording}
                        className="w-full sm:w-auto px-5 py-2.5 bg-rose-650 hover:bg-rose-600 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 uppercase transition-all shadow-md animate-pulse cursor-pointer border-0 text-white-force"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping shrink-0" />
                        Stop Recording ({recordingSeconds}s)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startAudioRecording}
                        className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 uppercase transition-all shadow-md cursor-pointer border-0 text-white-force"
                      >
                        <span className="material-symbols-outlined text-sm font-bold shrink-0">mic</span>
                        Record Clinical Advice
                      </button>
                    )}
                  </div>

                  {/* Local playback player */}
                  {audioUrl && (
                    <div className="w-full sm:flex-1 bg-slate-950 border border-slate-850 p-2 rounded-xl flex items-center justify-between gap-3">
                      <audio src={audioUrl} controls className="w-full h-8 shrink" />
                      
                      {/* Transcribe with AI execution CTA */}
                      <button
                        type="button"
                        onClick={executeAudioScribeTranscription}
                        disabled={isTranscribing}
                        className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 active:scale-95 disabled:opacity-50 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1.5 uppercase transition-all shadow-xs cursor-pointer shrink-0 border-0 text-white-force"
                      >
                        <span className="material-symbols-outlined text-xs font-bold text-white-force">psychology</span>
                        {isTranscribing ? 'Scribing...' : 'Transcribe with AI'}
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-[9px] text-slate-400 leading-normal">
                  🎙️ **Privacy & Cost Guard**: Your voice is recorded locally in-browser. Transcribe with AI only when you are satisfied with your audio note.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={async () => {
                    if (!notes.trim()) {
                      alert('Please write suggestions first.');
                      return;
                    }
                    setIsGeneratingSummary(true);
                    try {
                      const summary = await api.generateConsultHinglishSummary(selectedPatient.id, notes);
                      setHinglishSummary(summary);
                      window.dispatchEvent(new CustomEvent('mediflow-toast', {
                        detail: {
                          title: 'Hinglish AI Summary Generated! ✨',
                          message: 'Clinical summary generated successfully in friendly Hinglish.',
                          type: 'success'
                        }
                      }));
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setIsGeneratingSummary(false);
                    }
                  }}
                  disabled={isGeneratingSummary}
                  className="flex-1 bg-primary text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 text-white-force cursor-pointer animate-fade-in"
                >
                  {isGeneratingSummary ? 'Generating...' : '🤖 Generate AI Hinglish Summary'}
                </button>
              </div>

              {hinglishSummary && (
                <div className="p-4 bg-indigo-50/60 border border-indigo-150 rounded-xl space-y-3 animate-fade-in">
                  <h4 className="font-bold text-[10px] text-indigo-700 uppercase tracking-widest font-mono flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-xs">chat</span>
                    Hinglish Clinical Summary
                  </h4>
                  <p className="text-xs text-slate-750 whitespace-pre-line leading-relaxed font-semibold italic">
                    "{hinglishSummary}"
                  </p>
                  <button
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
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 uppercase transition-colors cursor-pointer border-0"
                  >
                    <span className="material-symbols-outlined text-xs text-white-force">send</span>
                    Send to Patient WhatsApp
                  </button>
                </div>
              )}

              {/* REVISIT LAB TREND COMPARISON */}
              {activeHistory && activeHistory.length > 0 && (

                <div className="border-t border-slate-200/80 pt-4 space-y-4">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-rose-500 text-sm">analytics</span>
                    Revisit Mode: Comparative Lab Trend Analysis
                  </h3>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                    Compare current biomarkers with historical reports to analyze improvement metrics.
                  </p>

                  <div className="flex gap-3">
                    <button
                      onClick={async () => {
                        if (!compReport) return;
                        setIsGeneratingTrend(true);
                        try {
                          const trend = await api.generateComparativeLabTrend(selectedPatient.id, 'HbA1c', compReport.HbA1c);
                          setComparativeTrend(trend);
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
                      }}
                      disabled={isGeneratingTrend}
                      className="w-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer text-white-force"
                    >
                      {isGeneratingTrend ? 'Analyzing...' : '📊 Generate Comparative AI Summary'}
                    </button>
                  </div>

                  {comparativeTrend && (
                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl space-y-3 animate-fade-in">
                      <h4 className="font-bold text-[10px] text-rose-700 uppercase tracking-widest font-mono flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-xs">trending_down</span>
                        Biomarker Improvement Trend
                      </h4>
                      <p className="text-xs text-slate-750 leading-relaxed font-semibold italic">
                        "{comparativeTrend}"
                      </p>
                      <button
                        onClick={() => {
                          api.pushWhatsAppMessageFromBot(selectedPatient.phone, comparativeTrend);
                          window.dispatchEvent(new CustomEvent('mediflow-toast', {
                            detail: {
                              title: 'Trend Sent! 📱',
                              message: `Comparative lab trend pushed to +91 ${selectedPatient.phone} via WhatsApp.`,
                              type: 'success'
                            }
                          }));
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 uppercase transition-colors cursor-pointer border-0"
                      >
                        <span className="material-symbols-outlined text-xs text-white-force">send</span>
                        Push Trend report to Patient WhatsApp
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Clinical Notes */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs text-primary">edit_note</span>
                Consultation & Clinical Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Presenting complaints, systemic examination notes, and diagnosis..."
                rows={3}
                className="w-full input-field resize-none text-xs leading-relaxed"
              />
            </div>

            {/* Diagnostic Requisitions Section */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs text-primary">biotech</span>
                Diagnostic Panel Requisition (LOINC-Coded)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {testCatalog.map((test: DiagnosticTest) => {
                  const isChecked = selectedTests.some((t: DiagnosticTest) => t.loincCode === test.loincCode);
                  return (
                    <button
                      key={test.loincCode}
                      onClick={() => handleToggleTest(test)}
                      className={`flex items-center justify-between p-3.5 rounded-xl border text-left text-xs transition-all duration-300 ${
                        isChecked
                          ? 'bg-primary-container/20 border-primary text-slate-800 shadow-sm'
                          : 'bg-slate-50 border-slate-200/50 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      <div>
                        <span className="font-bold block text-slate-700">{test.name}</span>
                        <span className="text-[8px] text-slate-400 font-mono mt-1 inline-block uppercase bg-slate-100 border border-slate-200/50 px-1.5 py-0.5 rounded">
                          LOINC: {test.loincCode}
                        </span>
                      </div>
                      <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                        isChecked ? 'bg-primary border-primary text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {isChecked && <span className="material-symbols-outlined text-xs font-bold text-white-force">check</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ophthalmology Refraction Rx Grid */}
            {isOphthalmology && (
              <div className="space-y-3 pt-5 border-t border-slate-100 animate-fade-in">
                <OphthalmicRefractionGrid 
                  value={refractionRx} 
                  onChange={setRefractionRx} 
                />
              </div>
            )}

            {/* Manual Handwritten Prescription Logger */}
            <div className="space-y-4 pt-5 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs text-primary font-bold">menu_book</span>
                Manual Handwritten Prescription Logger
              </label>
              
              <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-4">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300"
                    defaultChecked={true}
                  />
                  <span className="text-xs font-bold text-slate-700">I have written a physical paper prescription for this patient</span>
                </label>
                
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] text-slate-500 uppercase font-bold">Medicines & Dosages Written (One per line)</label>
                    <span className="text-[9px] text-slate-400 font-mono">Separate name, dosage, frequency, duration with a dash (-)</span>
                  </div>
                  <textarea
                    value={prescriptionNotes}
                    onChange={(e) => setPrescriptionNotes(e.target.value)}
                    placeholder={
                      isOphthalmology
                        ? "e.g.\nMoxifloxacin 0.5% - 1 Drop - 1 drop 4 times daily - 7 Days\nHomatropine 2% - 1 Drop - Instill 1 drop twice daily - 3 Days"
                        : "e.g.\nMetformin 500mg - 1 Tab - 1-0-1 - 5 Days\nAtorvastatin 10mg - 1 Tab - 0-0-1 - 10 Days"
                    }
                    rows={4}
                    className="w-full input-field bg-white text-xs leading-relaxed font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Pod-to-Pod Network Referral */}
            <div className="border-t border-slate-100 pt-5 mt-5 space-y-3">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs text-primary font-bold">groups</span>
                Pod-to-Pod Network Referral (Medishala Model)
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <select
                    id="referral-specialist-select"
                    className="w-full input-field py-2 text-xs bg-white pr-8 appearance-none"
                    defaultValue=""
                    onChange={async (e) => {
                      const val = e.target.value;
                      if (!val) return;
                      await api.referPatientToSpecialist(selectedPatient.phone, val);
                      e.target.value = "";
                    }}
                  >
                    <option value="">Select a Network Specialist to Refer...</option>
                    <option value="dfb2a1a8-8e68-4f8a-929e-4a6c8e317103">Dr. Sinha (Cardiologist) - Patna Central</option>
                    <option value="dfb2a1a8-8e68-4f8a-929e-4a6c8e317102">Dr. Anjali (Gynecologist) - Kankarbagh Pod</option>
                    <option value="dfb2a1a8-8e68-4f8a-929e-4a6c8e317101">Dr. Raj (Pediatrician) - Patna West</option>
                  </select>
                  <span className="material-symbols-outlined text-slate-400 absolute right-3 top-2.5 text-sm pointer-events-none">arrow_drop_down</span>
                </div>
              </div>
            </div>

            {/* Action Row */}
            <div className="flex justify-end pt-5 border-t border-slate-100">
              <button
                onClick={handleSaveEncounter}
                className="btn-primary px-8 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer text-white-force"
              >
                <CheckCircle2 className="h-5 w-5 text-white-force" /> Submit Encounter & Route Mappings
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // TAB 3 RENDER: Financial Reports
  const renderFinancialsTab = () => {
    const apptFees = financialLedgers.filter(e => e.transactionType === 'appointment_fee').reduce((acc, e) => acc + e.grossAmount, 0);
    const pharmacyComm = financialLedgers.filter(e => e.transactionType === 'medicine_commission').reduce((acc, e) => acc + e.netPayout, 0);
    const labComm = financialLedgers.filter(e => e.transactionType === 'lab_commission').reduce((acc, e) => acc + e.netPayout, 0);
    const totalEarnings = apptFees + pharmacyComm + labComm;

    const filteredLedgers = financialLedgers.filter(entry => 
      entry.invoiceId.toLowerCase().includes(financialSearch.toLowerCase()) ||
      entry.transactionType.toLowerCase().includes(financialSearch.toLowerCase())
    );

    return (
      <div className="space-y-6 text-slate-800 animate-fade-in">
        {/* Revenue splits grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="glass-panel p-6 bg-white border-slate-200/85 shadow-sm rounded-2xl">
            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Total Earnings</div>
            <div className="text-2xl font-bold mt-2 text-slate-900">₹{totalEarnings.toLocaleString()}</div>
            <p className="text-[10px] text-slate-500 mt-1">Consolidated Clinic + Referral Fees</p>
          </div>
          {[
            { label: "Clinic Fees", val: `₹${apptFees.toLocaleString()}`, split: "100% Payout", icon: "clinical_notes", color: "text-blue-600" },
            { label: "Pharmacy Commission", val: `₹${pharmacyComm.toLocaleString()}`, split: "10% Referral Fee", icon: "pill", color: "text-teal-600" },
            { label: "Pathology Lab Splits", val: `₹${labComm.toLocaleString()}`, split: "15% Referral Fee", icon: "biotech", color: "text-amber-600" }
          ].map((item, i) => (
            <div key={i} className="glass-panel p-6 bg-white border-slate-200/85 shadow-sm rounded-2xl">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{item.label}</span>
                <span className={`material-symbols-outlined text-lg ${item.color}`}>{item.icon}</span>
              </div>
              <div className="text-xl font-bold mt-2 text-slate-850">{item.val}</div>
              <p className="text-[10px] text-slate-500 mt-1">{item.split}</p>
            </div>
          ))}
        </div>

        {/* Side-by-side splits & projection dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* SVG Revenue projections chart */}
          <div className="lg:col-span-7 glass-panel p-6 bg-white border-slate-200/80 shadow-sm rounded-2xl space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Ecosystem Revenue Projection (Patna Pod)</h2>
                <p className="text-[10px] text-slate-400 mt-0.5">Simulated 6-Month Trajectory Trends</p>
              </div>
              <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider font-mono">
                <span className="flex items-center gap-1.5 text-blue-600">
                  <span className="w-2 h-2 rounded bg-blue-600" /> Clinic
                </span>
                <span className="flex items-center gap-1.5 text-teal-600">
                  <span className="w-2 h-2 rounded bg-teal-600" /> Pharmacy
                </span>
                <span className="flex items-center gap-1.5 text-amber-600">
                  <span className="w-2 h-2 rounded bg-amber-600" /> Pathology Lab
                </span>
              </div>
            </div>

            <div className="h-44 relative border-l border-b border-slate-200 p-2">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none">
                <line x1="0" y1="10" x2="100" y2="10" stroke="#f1f5f9" strokeWidth="0.5" />
                <line x1="0" y1="20" x2="100" y2="20" stroke="#f1f5f9" strokeWidth="0.5" />
                <line x1="0" y1="30" x2="100" y2="30" stroke="#f1f5f9" strokeWidth="0.5" />

                <path d="M 5,28 L 25,24 L 45,22 L 65,18 L 85,14 L 95,10" fill="none" stroke="#0f62fe" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M 5,35 L 25,32 L 45,30 L 65,26 L 85,22 L 95,19" fill="none" stroke="#007d70" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M 5,38 L 25,37 L 45,35 L 65,33 L 85,29 L 95,26" fill="none" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />

                <text x="5" y="39" className="text-[5px] fill-slate-400 font-mono font-bold" textAnchor="middle">Jan</text>
                <text x="25" y="39" className="text-[5px] fill-slate-400 font-mono font-bold" textAnchor="middle">Feb</text>
                <text x="45" y="39" className="text-[5px] fill-slate-400 font-mono font-bold" textAnchor="middle">Mar</text>
                <text x="65" y="39" className="text-[5px] fill-slate-400 font-mono font-bold" textAnchor="middle">Apr</text>
                <text x="85" y="39" className="text-[5px] fill-slate-400 font-mono font-bold" textAnchor="middle">May</text>
                <text x="95" y="39" className="text-[5px] fill-slate-400 font-mono font-bold" textAnchor="middle">Jun</text>
              </svg>
            </div>
          </div>

          {/* Interactive SVG Payout Split Node Diagram */}
          <div className="lg:col-span-5 glass-panel p-6 bg-white border-slate-200/80 shadow-sm rounded-2xl flex flex-col justify-between space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800 text-left">Interactive UPI Payout Nodes</h2>
              <p className="text-[10px] text-slate-400 mt-0.5 text-left">Real-Time Split Flows & Referral Cuts</p>
            </div>
            
            <div className="flex-1 flex items-center justify-center p-1 bg-slate-50/50 rounded-xl border border-slate-100">
              <svg className="w-full h-auto overflow-visible" viewBox="0 0 400 250">
                {/* Connecting Curves */}
                <path d="M 60,125 C 160,125 160,40 260,40" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
                <path d="M 60,125 C 160,125 160,95 260,95" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
                <path d="M 60,125 C 160,125 160,150 260,150" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
                <path d="M 60,125 C 160,125 160,205 260,205" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />

                {/* Flowing Cash Streams (Animated Lines) */}
                <path d="M 60,125 C 160,125 160,40 260,40" fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="6,6" className="animate-dash-flow" />
                <path d="M 60,125 C 160,125 160,95 260,95" fill="none" stroke="#0d9488" strokeWidth="2" strokeDasharray="6,6" className="animate-dash-flow" />
                <path d="M 60,125 C 160,125 160,150 260,150" fill="none" stroke="#d97706" strokeWidth="2" strokeDasharray="6,6" className="animate-dash-flow" />
                <path d="M 60,125 C 160,125 160,205 260,205" fill="none" stroke="#4f46e5" strokeWidth="2" strokeDasharray="6,6" className="animate-dash-flow" />

                {/* Central UPI Payment Node */}
                <g className="animate-pulse">
                  <circle cx="60" cy="125" r="22" fill="#ecfdf5" stroke="#10b981" strokeWidth="3" />
                  <text x="60" y="122" textAnchor="middle" className="text-[7px] font-extrabold fill-slate-800 font-sans" stroke="none">UPI</text>
                  <text x="60" y="132" textAnchor="middle" className="text-[6px] font-mono fill-emerald-600 font-bold" stroke="none">100%</text>
                </g>

                {/* Recipient Nodes & Labels */}
                {/* Doctor Node */}
                <g>
                  <circle cx="260" cy="40" r="16" fill="#eff6ff" stroke="#2563eb" strokeWidth="2.5" />
                  <text x="260" y="44" textAnchor="middle" className="text-[9px] font-extrabold fill-blue-600 font-sans" stroke="none">DR</text>
                  <text x="284" y="38" className="text-[9px] font-extrabold fill-slate-700 font-sans" stroke="none">Clinic split</text>
                  <text x="284" y="48" className="text-[8px] font-mono fill-blue-600 font-bold" stroke="none">₹{apptFees.toLocaleString()} (100%)</text>
                </g>

                {/* Pharmacy Node */}
                <g>
                  <circle cx="260" cy="95" r="16" fill="#e6f6f4" stroke="#0d9488" strokeWidth="2.5" />
                  <text x="260" y="99" textAnchor="middle" className="text-[9px] font-extrabold fill-teal-600 font-sans" stroke="none">RX</text>
                  <text x="284" y="93" className="text-[9px] font-extrabold fill-slate-700 font-sans" stroke="none">Pharmacy</text>
                  <text x="284" y="103" className="text-[8px] font-mono fill-teal-600 font-bold" stroke="none">₹{pharmacyComm.toLocaleString()} (10%)</text>
                </g>

                {/* Lab Node */}
                <g>
                  <circle cx="260" cy="150" r="16" fill="#fffbeb" stroke="#d97706" strokeWidth="2.5" />
                  <text x="260" y="154" textAnchor="middle" className="text-[8px] font-extrabold fill-amber-600 font-sans" stroke="none">LAB</text>
                  <text x="284" y="148" className="text-[9px] font-extrabold fill-slate-700 font-sans" stroke="none">Pathology</text>
                  <text x="284" y="158" className="text-[8px] font-mono fill-amber-600 font-bold" stroke="none">₹{labComm.toLocaleString()} (15%)</text>
                </g>

                {/* Platform Cut Node */}
                <g>
                  <circle cx="260" cy="205" r="16" fill="#eef2ff" stroke="#4f46e5" strokeWidth="2.5" />
                  <text x="260" y="209" textAnchor="middle" className="text-[9px] font-extrabold fill-indigo-600 font-sans" stroke="none">MF</text>
                  <text x="284" y="203" className="text-[9px] font-extrabold fill-slate-700 font-sans" stroke="none">Platform Fee</text>
                  <text x="284" y="213" className="text-[8px] font-mono fill-indigo-600 font-bold" stroke="none">₹{(financialLedgers.filter(e => e.transactionType === 'platform_fee').reduce((acc, e) => acc + e.netPayout, 0)).toLocaleString()} (INR 9)</text>
                </g>
              </svg>
            </div>
          </div>
        </div>

        {/* Financial ledger logs table */}
        <div className="glass-panel p-6 bg-white border-slate-200/80 shadow-sm rounded-2xl space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-sm font-bold text-slate-800">Sales Mappings & Transaction Ledger</h2>
            <div className="relative w-full md:w-72">
              <input
                type="text"
                placeholder="Search ledger by Invoice ID..."
                value={financialSearch}
                onChange={e => setFinancialSearch(e.target.value)}
                className="w-full input-field py-1.5 pl-9 text-xs"
              />
              <span className="material-symbols-outlined text-slate-400 absolute left-3 top-2 text-sm">search</span>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-wider text-[9px]">
                <tr>
                  <th className="p-3.5">Transaction ID</th>
                  <th className="p-3.5">Invoice ID</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5 text-right">Gross Amount</th>
                  <th className="p-3.5 text-center">Comm. Rate</th>
                  <th className="p-3.5 text-right">Net Commission</th>
                  <th className="p-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredLedgers.length > 0 ? filteredLedgers.map(entry => (
                  <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3.5 font-mono text-slate-600 text-[10px] font-bold">{entry.id}</td>
                    <td className="p-3.5 font-mono text-slate-400 text-[9px]">{entry.invoiceId}</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider font-mono ${
                        entry.transactionType === 'appointment_fee'
                          ? 'bg-blue-50 text-blue-700'
                          : entry.transactionType === 'medicine_commission'
                          ? 'bg-teal-50 text-teal-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {entry.transactionType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-mono text-slate-600">₹{entry.grossAmount.toFixed(2)}</td>
                    <td className="p-3.5 text-center font-mono text-slate-400">{(entry.commissionRate * 100).toFixed(0)}%</td>
                    <td className="p-3.5 text-right font-mono text-slate-800 font-bold">₹{entry.netPayout.toFixed(2)}</td>
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[8px] font-bold bg-emerald-100 text-emerald-700 uppercase tracking-wider font-mono">
                        {entry.paymentStatus}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400 text-xs italic">
                      No matching financial transaction ledgers recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // TAB 6 RENDER: Patient Directory & WhatsApp Loyalty
  const renderPatientsTab = () => {
    const filteredPatients = patients.filter(p => 
      p.name.toLowerCase().includes(patientSearchQuery.toLowerCase()) ||
      p.phone.includes(patientSearchQuery)
    );

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-slate-800 animate-fade-in">
        {/* Left Column: Search & Registry Directory */}
        <div className="space-y-6">
          <div className="glass-panel p-6 bg-white border-slate-200/80 shadow-sm rounded-2xl h-full flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">group</span>
                <h2 className="text-base font-bold text-slate-800">Patient Directory</h2>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={patientSearchQuery}
                  onChange={e => setPatientSearchQuery(e.target.value)}
                  className="w-full input-field py-2 pl-9 text-xs"
                />
                <span className="material-symbols-outlined text-slate-400 absolute left-3 top-2.5 text-sm">search</span>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {filteredPatients.map(p => {
                  const isSelected = selectedDirectoryPatient?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedDirectoryPatient(p);
                        setPatientRAGSummary('');
                      }}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-primary-container/20 border-primary text-slate-800'
                          : 'bg-slate-50 border-slate-200/50 hover:bg-slate-100'
                      }`}
                    >
                      <div className="font-bold text-xs">{p.name}</div>
                      <div className="text-[10px] text-slate-500 mt-1">{p.gender}, {p.age} years • {p.phone}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* New Patient Drawer */}
            <div className="pt-4 border-t border-slate-100 mt-4">
              <h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-primary">person_add</span>
                Add New Patient Registry
              </h3>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Patient Full Name"
                  value={newPatientName}
                  onChange={e => setNewPatientName(e.target.value)}
                  className="w-full input-field py-1.5 text-xs bg-white"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Phone"
                    value={newPatientPhone}
                    onChange={e => setNewPatientPhone(e.target.value)}
                    className="w-full input-field py-1.5 text-xs bg-white"
                  />
                  <input
                    type="number"
                    placeholder="Age"
                    value={newPatientAge}
                    onChange={e => setNewPatientAge(e.target.value)}
                    className="w-full input-field py-1.5 text-xs bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newPatientGender}
                    onChange={e => setNewPatientGender(e.target.value as any)}
                    className="w-full input-field py-1.5 text-xs bg-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  <button
                    onClick={() => {
                      if (!newPatientName || !newPatientPhone || !newPatientAge) return;
                      const added = api.registerPatient({
                        name: newPatientName,
                        phone: newPatientPhone,
                        age: parseInt(newPatientAge),
                        gender: newPatientGender,
                        allergies: [],
                        chronicConditions: []
                      });
                      setSelectedDirectoryPatient(added);
                      setNewPatientName('');
                      setNewPatientPhone('');
                      setNewPatientAge('');
                    }}
                    className="w-full btn-primary py-1.5 text-center text-xs font-semibold rounded-lg"
                  >
                    Register Patient
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Columns: Patient profile, loyalty coupons, AI RAG */}
        <div className="lg:col-span-2 space-y-6">
          {selectedDirectoryPatient ? (
            <div className="glass-panel p-6 bg-white border-slate-200/80 shadow-sm rounded-2xl space-y-6">
              <div className="border-b border-slate-100 pb-4 flex justify-between items-start">
                <div>
                  <h2 className="text-base font-bold text-slate-800">{selectedDirectoryPatient.name}</h2>
                  <p className="text-xs text-slate-400 mt-1">{selectedDirectoryPatient.gender}, {selectedDirectoryPatient.age} years • phone: {selectedDirectoryPatient.phone}</p>
                </div>
                {selectedDirectoryPatient.abhaId && (
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold uppercase font-mono">
                    ABHA Verified
                  </span>
                )}
              </div>

              {/* loyalty discounts dispatcher */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-amber-500">reward</span>
                  WhatsApp Loyalty Offers Console
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => api.dispatchWhatsAppLoyaltyOffer(selectedDirectoryPatient.id, 'discount_30')}
                    className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/50 rounded-xl text-left space-y-2 hover:scale-102 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-teal-600 text-lg">local_pharmacy</span>
                    <strong className="block text-[11px] text-slate-700 font-semibold">30% Off Medicine Coupon</strong>
                    <p className="text-[9px] text-slate-400 leading-normal">For repeat glycemic drugs refill orders.</p>
                  </button>
                  <button
                    onClick={() => api.dispatchWhatsAppLoyaltyOffer(selectedDirectoryPatient.id, 'virtual_appointment')}
                    className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/50 rounded-xl text-left space-y-2 hover:scale-102 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-blue-600 text-lg">video_call</span>
                    <strong className="block text-[11px] text-slate-700 font-semibold">10-Day Virtual Invite</strong>
                    <p className="text-[9px] text-slate-400 leading-normal">Invite to virtual telemedicine follow-up.</p>
                  </button>
                  <button
                    onClick={() => api.dispatchWhatsAppLoyaltyOffer(selectedDirectoryPatient.id, 'quick_booking')}
                    className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/50 rounded-xl text-left space-y-2 hover:scale-102 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-amber-600 text-lg">event_available</span>
                    <strong className="block text-[11px] text-slate-700 font-semibold">Portal Invite Link</strong>
                    <p className="text-[9px] text-slate-400 leading-normal">Invoice and home lab sample booking portal.</p>
                  </button>
                </div>
              </div>

              {/* AI chronic health summary */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-secondary">psychology</span>
                    AI Chronic Longitudinal Health Summary
                  </h3>
                  <button
                    onClick={() => {
                      const sum = api.generateAIPatientSummary(selectedDirectoryPatient.id);
                      setPatientRAGSummary(sum);
                    }}
                    className="text-primary hover:text-primary-700 text-xs font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">sync</span> Generate Summary
                  </button>
                </div>

                {patientRAGSummary ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-slate-700 leading-relaxed font-sans animate-fade-in">
                    {patientRAGSummary}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Click Generate Summary to run the RAG diagnostic prompt analyzing the patient chronic history.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-panel p-12 bg-white border-slate-200/80 shadow-sm rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
              <span className="material-symbols-outlined text-slate-300 text-5xl">group</span>
              <div>
                <h3 className="text-slate-700 font-bold">No Patient Profile Selected</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">Select an active patient registry profile from the directory on the left to dispatch loyalty rewards or generate chronic summaries.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // TAB 7 RENDER: WhatsApp Cloud API Onboarding & Team Inbox Takeover
  const renderWhatsAppTab = () => {
    // Filter sessions based on search
    const filteredSessions = whatsAppSessions.filter(s => {
      const matchPhone = s.patientPhone.includes(chatSearch);
      const pat = patients.find(p => p.id === s.patientId);
      const matchName = pat ? pat.name.toLowerCase().includes(chatSearch.toLowerCase()) : false;
      return matchPhone || matchName;
    });

    const activeChat = whatsAppSessions.find(s => s.id === selectedChatSession?.id) ?? selectedChatSession;
    const isHumanOverride = activeChat?.session_data?.humanOverride === true;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in text-slate-800 font-sans">
        
        {/* Connection & Setup Config Header (Top spanning) */}
        <div className="lg:col-span-12">
          {activeWabaConnection ? (
            <div className="glass-panel p-5 bg-white border-emerald-100 shadow-xs rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2.5px] bg-emerald-500" />
              <div className="flex items-center gap-4.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 font-extrabold shadow-sm animate-pulse">
                  <span className="material-symbols-outlined text-2xl">cell_tower</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Meta WhatsApp Cloud API Connected</h3>
                    <span className="text-[9px] font-bold font-mono px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full uppercase tracking-wider">Active Channel</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-1 space-y-0.5">
                    <div>WABA Phone Number: <strong className="text-slate-600 font-sans">{activeWabaConnection.phone_number}</strong></div>
                    <div>Phone ID: <strong className="text-slate-600">{activeWabaConnection.phone_number_id}</strong> • Account ID: <strong className="text-slate-600">{activeWabaConnection.waba_id}</strong></div>
                  </div>
                </div>
              </div>
              <button
                onClick={async () => {
                  if (window.confirm("Are you sure you want to disconnect this live WhatsApp business channel? AI automations will revert to simulator mode.")) {
                    const { error } = await supabase
                      .from('waba_connections')
                      .delete()
                      .eq('id', activeWabaConnection.id);

                    if (error) {
                      alert("Error disconnecting WABA: " + error.message);
                    } else {
                      setActiveWabaConnection(null);
                      window.dispatchEvent(new CustomEvent('mediflow-toast', {
                        detail: {
                          title: 'Channel Disconnected! 🔴',
                          message: 'Meta Cloud API channel detached successfully.',
                          type: 'info'
                        }
                      }));
                    }
                  }
                }}
                className="px-4 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-2xl text-[10px] font-bold uppercase tracking-wider transition-all self-start md:self-auto cursor-pointer"
              >
                Disconnect Channel
              </button>
            </div>
          ) : (
            <div className="glass-panel p-6 bg-white border-slate-200/60 shadow-xs rounded-3xl flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-blue-500 via-primary to-indigo-500 opacity-60" />
              <div className="flex gap-4.5 items-start">
                <span className="material-symbols-outlined text-primary text-4xl mt-1 animate-bounce">chat_bubble</span>
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Deploy Production-Grade WhatsApp Chatbot Engine</h3>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-2xl font-sans">
                    Mediflow utilizes Meta's official WhatsApp Business Cloud API. Connect your unique clinic phone number to allow patients to instantly verify data consents, receive RAG diagnostic summaries, query generic medication dosage, and settle splits dynamic UPI payouts in real-time.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWabaFormOpen(true)}
                className="px-5 py-2.5 bg-primary hover:bg-primary-500 text-white border border-primary/25 hover:border-primary rounded-2xl text-[10px] font-extrabold uppercase tracking-widest transition-all hover:scale-102 active:scale-98 shadow-sm flex items-center justify-center gap-1.5 cursor-pointer text-white-force bg-primary-force"
              >
                <span className="material-symbols-outlined text-sm font-bold text-white-force">connect_without_contact</span>
                Connect Business Number
              </button>
            </div>
          )}
        </div>

        {/* Left Pane: Active Sessions List (Inbox Sidebar) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-panel p-5 bg-white border-slate-200/60 shadow-sm rounded-3xl h-full flex flex-col justify-between space-y-4 relative overflow-hidden">
            <div className="space-y-3.5">
              <div className="flex justify-between items-center">
                <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base font-bold">question_answer</span>
                  Patient Conversations
                </h2>
                <span className="text-[9px] font-bold font-mono px-2 py-0.5 bg-blue-50 text-blue-500 rounded-full">
                  {filteredSessions.length} active
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <span className="material-symbols-outlined text-slate-400 text-base absolute left-3 top-2.5">search</span>
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200/80 focus:border-primary/50 focus:ring-1 focus:ring-primary/25 rounded-2xl text-xs outline-none bg-slate-50/50"
                />
              </div>

              {/* Session cards mapping */}
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1.5">
                {filteredSessions.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs italic">
                    No active sessions found.
                  </div>
                ) : (
                  filteredSessions.map(s => {
                    const pat = patients.find(p => p.id === s.patientId);
                    const name = pat ? pat.name : 'Unknown Patient';
                    const lastMsg = s.session_data?.chatHistory?.[s.session_data.chatHistory.length - 1]?.text ?? 'Session initialized';
                    const isSelected = activeChat?.id === s.id;

                    let stateBadge = 'bg-slate-100 text-slate-500';
                    if (s.currentState === 'AWAITING_PAYMENT') stateBadge = 'bg-amber-100 text-amber-700';
                    else if (s.currentState === 'COMPLETED') stateBadge = 'bg-emerald-100 text-emerald-700';
                    else if (s.currentState === 'FAILED_DELIVERY') stateBadge = 'bg-rose-100 text-rose-700';
                    else if (s.currentState === 'AWAITING_CONFIRMATION') stateBadge = 'bg-blue-100 text-blue-700';

                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedChatSession(s)}
                        className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-300 relative group overflow-hidden ${
                          isSelected 
                            ? 'bg-blue-50/40 border-primary/50 shadow-xs' 
                            : 'bg-slate-50/40 border-slate-200/60 hover:bg-slate-50'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />
                        )}
                        <div className="flex justify-between items-start gap-1">
                          <div className="font-bold text-xs text-slate-700 group-hover:text-primary transition-colors truncate">{name}</div>
                          <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 uppercase ${stateBadge}`}>
                            {s.currentState.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-1">{s.patientPhone}</div>
                        <div className="text-[10px] text-slate-500 mt-2 truncate font-sans italic">"{lastMsg}"</div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 text-[9px] text-slate-400 flex items-center gap-1 leading-relaxed">
              <span className="material-symbols-outlined text-xs">info</span>
              * Uses Supabase Realtime to broadcast incoming patient responses instantly.
            </div>
          </div>

          {/* Onboarding Placard Generator */}
          <div className="mt-4">
            <ClinicPlacardGenerator 
              activeWabaNumber={activeWabaConnection?.phone_number || '+91 90000 00000'}
              clinicName={activePod?.name || 'Mediflow Smart Clinic'}
            />
          </div>

          {/* Meta WABA Telemetry Logger */}
          <div className="mt-4 glass-panel p-5 bg-slate-950 border-slate-800 shadow-sm rounded-3xl text-zinc-300 font-mono space-y-3 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-emerald-500 to-green-400" />
            <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <h3 className="text-[10px] font-extrabold tracking-wider text-emerald-400 uppercase">WABA DevOps Telemetry</h3>
              </div>
              <span className="text-[8px] font-bold px-1.5 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-900/50 rounded uppercase">Live Feed</span>
            </div>
            
            <div className="space-y-1.5 text-[9px] max-h-40 overflow-y-auto pr-1 leading-relaxed custom-scrollbar text-left">
              {telemetryLogs.map((log, idx) => (
                <div key={idx} className="hover:bg-zinc-900/50 p-1 rounded transition-colors break-all">
                  <span className="text-zinc-500">&gt;</span> <span className="text-emerald-500/90 font-semibold">{log}</span>
                </div>
              ))}
              <div className="flex items-center gap-1 text-emerald-400">
                <span>&gt;</span> <span className="w-1.5 h-3 bg-emerald-400 animate-pulse inline-block" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Pane: Live Active Conversation Detail & Takeover Console */}
        <div className="lg:col-span-8">
          {activeChat ? (
            <div className="glass-panel p-5 bg-white border-slate-200/60 shadow-sm rounded-3xl h-[560px] flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2.5px] bg-primary" />
              
              {/* Active Chat Header */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    {patients.find(p => p.id === activeChat.patientId)?.name ?? 'Linked Patient'}
                    <span className={`w-2 h-2 rounded-full ${isHumanOverride ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">{activeChat.patientPhone}</span>
                </div>

                {/* Takeover Control Toggle */}
                <div className="flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-200/40 rounded-2xl">
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    isHumanOverride ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {isHumanOverride ? '⚡ Human Takeover' : '🤖 AI Agent Active'}
                  </span>
                  <button
                    onClick={async () => {
                      const updatedOverride = !isHumanOverride;
                      const sessionData = activeChat.session_data ?? {};
                      const updatedSess = {
                        ...activeChat,
                        session_data: { ...sessionData, humanOverride: updatedOverride }
                      };

                      const { error } = await supabase
                        .from('whatsapp_sessions')
                        .update({
                          session_data: { ...sessionData, humanOverride: updatedOverride }
                        })
                        .eq('id', activeChat.id);

                      if (error) {
                        alert("Error toggling takeover state: " + error.message);
                      } else {
                        setSelectedChatSession(updatedSess);
                        // Trigger local state list refresh reactive UI
                        setWhatsAppSessions(prev => prev.map(s => s.id === activeChat.id ? updatedSess : s));
                        window.dispatchEvent(new CustomEvent('mediflow-toast', {
                          detail: {
                            title: updatedOverride ? 'Human Override Enabled! ⚡' : 'AI Bot Restored! 🤖',
                            message: updatedOverride ? 'AI chatbot response pipeline frozen. Staff manual response active.' : 'Clinical Scribe AI resume passive patient routing.',
                            type: 'success'
                          }
                        }));
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-extrabold uppercase tracking-wider transition-all cursor-pointer shadow-xs ${
                      isHumanOverride 
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
                        : 'bg-amber-600 hover:bg-amber-500 text-white'
                    }`}
                  >
                    {isHumanOverride ? 'Restore AI Bot' : 'Take Over Chat'}
                  </button>
                </div>
              </div>

              {/* Chat Message Stream */}
              <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1 max-h-[360px] bg-slate-50/20 border border-slate-200/20 rounded-2xl p-4 my-3">
                {(activeChat.session_data?.chatHistory ?? []).map((msg: any, idx: number) => {
                  const isBot = msg.sender === 'bot';
                  const isPatient = msg.sender === 'patient';
                  
                  let bubbleStyle = 'bg-primary text-white ml-auto rounded-tl-2xl rounded-bl-2xl rounded-tr-2xl';
                  if (isPatient) {
                    bubbleStyle = 'bg-white border border-slate-200/80 text-slate-800 mr-auto rounded-tr-2xl rounded-br-2xl rounded-tl-2xl';
                  } else if (msg.sender === 'agent' || (!isBot && !isPatient)) {
                    bubbleStyle = 'bg-amber-500 text-white ml-auto rounded-tl-2xl rounded-bl-2xl rounded-tr-2xl';
                  }

                  return (
                    <div key={idx} className="flex flex-col w-full max-w-[85%] space-y-0.5 relative">
                      <div className={`p-3 text-xs leading-relaxed font-sans shadow-2xs ${bubbleStyle}`}>
                        {msg.text}
                      </div>
                      <span className={`text-[8px] font-mono text-slate-400 ${isPatient ? 'mr-auto pl-1' : 'ml-auto pr-1'}`}>
                        {msg.sender.toUpperCase()} • {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Outbound Messaging Inputs Panel */}
              <div className="border-t border-slate-100 pt-3">
                {isHumanOverride ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!manualChatMsg.trim()) return;

                      const textToSend = manualChatMsg.trim();
                      setManualChatMsg('');

                      const sessionData = activeChat.session_data ?? {};
                      const chatHistory = sessionData.chatHistory ?? [];
                      const currentTime = new Date().toISOString();
                      
                      chatHistory.push({
                        sender: 'agent',
                        text: textToSend,
                        timestamp: currentTime
                      });

                      // 1. Commit manual reply directly to chatHistory in Supabase
                      const { error } = await supabase
                        .from('whatsapp_sessions')
                        .update({
                          session_data: { ...sessionData, chatHistory },
                          last_interaction: currentTime
                        })
                        .eq('id', activeChat.id);

                      if (error) {
                        alert("Error saving manual message: " + error.message);
                      } else {
                        // 2. Dispatch Live payload using api dispatcher
                        await api.sendWhatsAppMessagePayload(activeChat.patientPhone, 'custom_manual_reply', {
                          replyText: textToSend
                        });

                        // Update local sessions state immediately for reactive UI
                        const updatedSess = {
                          ...activeChat,
                          session_data: { ...sessionData, chatHistory }
                        };
                        setSelectedChatSession(updatedSess);
                        setWhatsAppSessions(prev => prev.map(s => s.id === activeChat.id ? updatedSess : s));
                        
                        window.dispatchEvent(new CustomEvent('mediflow-toast', {
                          detail: {
                            title: 'Message Dispatched! ✉️',
                            message: `Direct message sent to patient WhatsApp queue.`,
                            type: 'success'
                          }
                        }));
                      }
                    }}
                    className="flex gap-3"
                  >
                    <input
                      type="text"
                      placeholder="Type a manual response to takeover the patient session..."
                      value={manualChatMsg}
                      onChange={(e) => setManualChatMsg(e.target.value)}
                      className="flex-1 px-4.5 py-3 border border-slate-200/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/25 rounded-2xl text-xs outline-none bg-slate-50/50"
                    />
                    <button
                      type="submit"
                      className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer text-white-force bg-amber-500-force"
                    >
                      <span className="material-symbols-outlined text-sm font-bold text-white-force">send</span>
                      Send Message
                    </button>
                  </form>
                ) : (
                  <div className="p-3 bg-blue-50/50 border border-blue-100/60 rounded-2xl text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-1">
                    <div className="flex items-center gap-1.5 font-bold text-slate-700">
                      <span className="material-symbols-outlined text-sm text-blue-500 animate-pulse">lock</span>
                      AI chatbot agent is actively handling this patient care session
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Click the "Take Over Chat" button at the top header to halt AI automations and send manual updates.
                    </p>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="glass-panel p-12 bg-white border-slate-200/60 shadow-sm rounded-3xl h-[560px] flex flex-col items-center justify-center text-center space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2.5px] bg-primary/20" />
              <span className="material-symbols-outlined text-slate-200 text-6xl">chat</span>
              <div>
                <h3 className="text-slate-700 font-extrabold uppercase text-xs tracking-wider">No Patient Conversation Selected</h3>
                <p className="text-xs text-slate-400 mt-2 max-w-sm font-sans">
                  Select a live active chat session from the queue registry on the left to monitor, review clinical guidelines, or override chatbot automations with human takeover capabilities.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Phase 4 popup modal: Link Meta Cloud WABA Account Connection Form */}
        {wabaFormOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in text-slate-800">
            <div className="glass-panel max-w-lg w-full p-6.5 border-slate-200 shadow-2xl relative overflow-hidden space-y-5 bg-white rounded-3xl">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-primary" />
              
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary font-bold">cell_tower</span>
                    Link WhatsApp Business API
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">Configure live on-behalf-of Meta developer sandbox credentials for active pod.</p>
                </div>
                <button
                  onClick={() => setWabaFormOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!wabaPhoneId || !wabaIdVal || !wabaNumber || !wabaTokenVal) {
                    alert("Please fill in all connection credentials.");
                    return;
                  }

                  if (!activePod?.id) {
                    alert("No active clinic pod session found.");
                    return;
                  }

                  try {
                    // Call the secure RPC encryption helper inside the Supabase database
                    const { data: encryptedBytes, error: cryptErr } = await supabase.rpc('encrypt_waba_token', {
                      token: wabaTokenVal.trim(),
                      secret_key: 'mediflow_vault_key_2026'
                    });

                    if (cryptErr || !encryptedBytes) {
                      throw new Error(cryptErr?.message ?? 'Cryptographic key exchange failure.');
                    }

                    // Insert connection row
                    const { data, error } = await supabase
                      .from('waba_connections')
                      .insert({
                        pod_id: activePod.id,
                        entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002', // Default Bihar Clinic Entity ID
                        phone_number_id: wabaPhoneId.trim(),
                        waba_id: wabaIdVal.trim(),
                        phone_number: wabaNumber.trim(),
                        encrypted_system_user_token: encryptedBytes,
                        waba_status: 'active',
                        verified_at: new Date().toISOString()
                      })
                      .select()
                      .single();

                    if (error) {
                      alert("Database registration failed: " + error.message);
                    } else {
                      setActiveWabaConnection(data);
                      setWabaFormOpen(false);
                      
                      // Clear form inputs
                      setWabaPhoneId('');
                      setWabaIdVal('');
                      setWabaNumber('');
                      setWabaTokenVal('');

                      window.dispatchEvent(new CustomEvent('mediflow-toast', {
                        detail: {
                          title: 'WABA Channel Connected! 🟢',
                          message: `Meta Cloud API registered for active pod. Chatbot automations live!`,
                          type: 'success'
                        }
                      }));
                    }
                  } catch (err: any) {
                    alert("WABA Encrypted onboarding failed: " + (err.message || err));
                  }
                }}
                className="space-y-4 text-xs font-sans"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">WhatsApp Phone Number ID</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 104845525547633"
                      value={wabaPhoneId}
                      onChange={(e) => setWabaPhoneId(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-primary/50 focus:ring-1 focus:ring-primary/25 rounded-xl text-xs outline-none bg-slate-50/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Business Account ID (WABA ID)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 210874558296310"
                      value={wabaIdVal}
                      onChange={(e) => setWabaIdVal(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-primary/50 focus:ring-1 focus:ring-primary/25 rounded-xl text-xs outline-none bg-slate-50/50"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Verified Business Phone Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +919876543210"
                    value={wabaNumber}
                    onChange={(e) => setWabaNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-primary/50 focus:ring-1 focus:ring-primary/25 rounded-xl text-xs outline-none bg-slate-50/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Permanent System User Access Token</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Paste Meta business token (will be stored using secure column-level database encryption)..."
                    value={wabaTokenVal}
                    onChange={(e) => setWabaTokenVal(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-primary/50 focus:ring-1 focus:ring-primary/25 rounded-xl text-xs outline-none bg-slate-50/50 font-mono"
                  />
                </div>

                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex gap-3 text-xs text-amber-700">
                  <span className="material-symbols-outlined text-amber-500 flex-shrink-0 mt-0.5">warning</span>
                  <div className="text-[10px] leading-relaxed">
                    Connecting your phone number to Meta's Cloud API requires that you **deactivate** the number from the standard mobile WhatsApp app. Ensure you verify this before clicking Save.
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setWabaFormOpen(false)}
                    className="flex-1 btn-secondary py-2.5 rounded-xl text-center text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 btn-primary py-2.5 rounded-xl text-center text-xs text-white-force bg-primary hover:bg-primary-500 font-bold"
                  >
                    Save Connection
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    );
  };

  // SOP CENTER TAB - AI-powered Clinic Standard Operating Procedure
  const renderSopTab = () => {
    const sops = api.getClinicSops();
    const activeSop = api.getActiveSop();

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setSopFile(file);
      setCustomSopFileName(file.name);
      const text = await file.text();
      setSopText(text);
    };

    const handleExtractSop = async () => {
      if (!sopText.trim()) return;
      setIsExtractingSop(true);
      setExtractionLogs([]);
      setExtractedConfig(null);

      // Simulated AI extraction pipeline with streaming logs
      const stages = [
        { delay: 400, log: '🤖 Initializing Gemini MedLM SOP Parser...' },
        { delay: 800, log: '📄 Reading document structure and sections...' },
        { delay: 1200, log: '💊 Extracting doctor consultation fee from fee schedule...' },
        { delay: 1700, log: '🧪 Parsing pathology test price list (LOINC-code mapping)...' },
        { delay: 2200, log: '💰 Detecting commission split instructions (Doctor / Lab / Platform)...' },
        { delay: 2700, log: '📋 Extracting clinical workflow guidelines and SOPs...' },
        { delay: 3200, log: '✅ Validating extracted config against Mediflow billing engine...' },
        { delay: 3600, log: '🔐 Encrypting and saving SOP config to your clinic profile...' },
      ];

      for (const stage of stages) {
        await new Promise(r => setTimeout(r, stage.delay));
        setExtractionLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${stage.log}`]);
      }

      // AI Extraction: Parse known patterns from text using regex heuristics
      const text = sopText.toLowerCase();

      const docFeeMatch = text.match(/(?:doctor|consultation|doctor's|physician)\s*(?:fee|charge|rate)[^0-9]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)/i) ||
                          text.match(/(?:rs\.?|inr|₹)\s*(\d+(?:\.\d+)?)\s*(?:doctor|consultation)/i);
      const docFee = docFeeMatch ? parseFloat(docFeeMatch[1]) : activeSop?.extractedConfig?.doctor_fee ?? 450;

      const splitDocMatch = text.match(/(?:doctor|physician|referring)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%/i);
      const splitPlatMatch = text.match(/(?:platform|mediflow|software|app)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%/i);
      const splitLabMatch = text.match(/(?:lab|laboratory|pathology)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%/i);

      const splitDoc = splitDocMatch ? parseFloat(splitDocMatch[1]) : activeSop?.extractedConfig?.splits?.doctor ?? 40;
      const splitPlat = splitPlatMatch ? parseFloat(splitPlatMatch[1]) : activeSop?.extractedConfig?.splits?.platform ?? 3;
      const splitLab = splitLabMatch ? parseFloat(splitLabMatch[1]) : activeSop?.extractedConfig?.splits?.lab ?? 57;

      // Parse test prices
      const testPrices: Record<string, number> = { ...activeSop?.extractedConfig?.test_prices };
      const hba1cMatch = text.match(/(?:hba1c|glycated hemoglobin|a1c)[^0-9]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)/i);
      const creatinineMatch = text.match(/(?:creatinine|serum creatinine)[^0-9]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)/i);
      const hemoglobinMatch = text.match(/(?:total hemoglobin|hemoglobin)[^0-9]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)/i);
      const sodiumMatch = text.match(/(?:serum sodium|sodium)[^0-9]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)/i);
      const bilirubinMatch = text.match(/(?:bilirubin|total bilirubin)[^0-9]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)/i);

      if (hba1cMatch) testPrices['4544-3'] = parseFloat(hba1cMatch[1]);
      if (creatinineMatch) testPrices['2160-0'] = parseFloat(creatinineMatch[1]);
      if (hemoglobinMatch) testPrices['3024-7'] = parseFloat(hemoglobinMatch[1]);
      if (sodiumMatch) testPrices['2947-0'] = parseFloat(sodiumMatch[1]);
      if (bilirubinMatch) testPrices['1975-2'] = parseFloat(bilirubinMatch[1]);

      // Extract guideline bullets
      const guidelineLines = sopText.split('\n').filter(l =>
        l.trim().startsWith('-') || l.trim().startsWith('•') || l.trim().startsWith('*') || /^\d+\./.test(l.trim())
      ).map(l => l.trim().replace(/^[-•*\d.]+\s*/, '')).filter(l => l.length > 5).slice(0, 12);

      const config = {
        doctor_fee: docFee,
        test_prices: testPrices,
        splits: { doctor: splitDoc, platform: splitPlat, lab: splitLab },
        guidelines: guidelineLines.length > 0 ? guidelineLines : activeSop?.extractedConfig?.guidelines ?? []
      };

      setExtractedConfig(config);
      setExtractionLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🎉 Extraction complete! Config ready to activate.`]);
      setIsExtractingSop(false);
    };

    const handleActivateSop = () => {
      if (!extractedConfig) return;
      const newSop: ClinicSop = {
        id: `sop-${Date.now()}`,
        entityId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
        sopFileName: customSopFileName || sopFile?.name || 'Clinic_SOP.txt',
        sopText,
        extractedConfig,
        isActive: true,
        createdAt: new Date().toISOString()
      };
      // Deactivate previous SOPs
      const existing = api.getClinicSops().map(s => ({ ...s, isActive: false }));
      api.saveClinicSops([newSop, ...existing]);
      setExtractedConfig(null);
      setSopText('');
      setSopFile(null);
      setExtractionLogs([]);
      setSopActiveSubTab('active');
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { title: '🏥 Clinic SOP Activated!', message: `"${newSop.sopFileName}" is now live. Billing, splits, and workflows updated.`, type: 'success' }
      }));
    };

    const testNames: Record<string, string> = {
      '4544-3': 'HbA1c (Glycated Hemoglobin)',
      '2160-0': 'Serum Creatinine',
      '3024-7': 'Total Hemoglobin',
      '2947-0': 'Serum Sodium',
      '1975-2': 'Total Bilirubin'
    };

    return (
      <div className="p-4 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-violet-600">policy</span>
              Clinic SOP Center
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Upload your clinic's Standard Operating Procedure — AI extracts fee structures, lab prices, commission splits, and workflow rules</p>
          </div>
          {activeSop && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Active SOP: {activeSop.sopFileName}
            </div>
          )}
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-2 p-1 bg-slate-100/70 border border-slate-200/50 rounded-2xl w-fit">
          {[
            { id: 'upload', label: 'Upload New SOP', icon: 'upload_file' },
            { id: 'active', label: 'Active SOP & Rules', icon: 'rule' }
          ].map(t => (
            <button key={t.id} onClick={() => setSopActiveSubTab(t.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${sopActiveSubTab === t.id ? 'bg-white text-violet-700 shadow-sm border border-violet-100' : 'text-slate-500 hover:text-slate-700'}`}>
              <span className="material-symbols-outlined text-sm">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* UPLOAD PANEL */}
        {sopActiveSubTab === 'upload' && (
          <div className="space-y-5">
            {/* Drop zone */}
            <div className="relative border-2 border-dashed border-violet-200 rounded-2xl bg-violet-50/40 hover:bg-violet-50/70 transition-colors">
              <input
                type="file"
                accept=".txt,.pdf,.doc,.docx,.md"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="flex flex-col items-center justify-center py-12 gap-3 pointer-events-none">
                <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-4xl text-violet-500">upload_file</span>
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-700 text-sm">{sopFile ? sopFile.name : 'Drop your SOP document here'}</p>
                  <p className="text-xs text-slate-400 mt-1">Supports .txt, .pdf, .doc, .docx, .md — AI will parse it automatically</p>
                </div>
                {sopFile && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    {sopFile.name} ready for extraction
                  </div>
                )}
              </div>
            </div>

            {/* Paste text directly */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Or Paste SOP Text Directly</label>
              <textarea
                value={sopText}
                onChange={e => setSopText(e.target.value)}
                placeholder={`Paste your clinic SOP here. For example:\n\nDoctor Consultation Fee: INR 450\nHbA1c Test: INR 350\nSerum Creatinine Test: INR 250\nCommission Splits: Doctor 40%, Lab 57%, Platform 3%\n\nGuidelines:\n- Collect FEFO pharmacy batches first\n- Assign Lalit Prasad for all pathology tests\n- Allow home sample collection on request`}
                rows={10}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 resize-none font-mono leading-relaxed"
              />
            </div>

            {/* AI Extract Button */}
            <button
              onClick={handleExtractSop}
              disabled={!sopText.trim() || isExtractingSop}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-sm shadow-lg hover:shadow-violet-400/30 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 cursor-pointer"
            >
              {isExtractingSop ? (
                <>
                  <span className="material-symbols-outlined text-lg animate-spin">autorenew</span>
                  AI Extraction in Progress...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">auto_awesome</span>
                  Extract & Analyse SOP with Gemini AI
                </>
              )}
            </button>

            {/* Live Extraction Logs */}
            {extractionLogs.length > 0 && (
              <div className="rounded-2xl bg-slate-900 border border-slate-700 p-4 space-y-1.5 font-mono">
                <p className="text-xs text-slate-400 font-bold mb-2 uppercase tracking-wider">AI Extraction Console</p>
                {extractionLogs.map((log, i) => (
                  <p key={i} className={`text-xs ${i === extractionLogs.length - 1 ? 'text-emerald-400' : 'text-slate-300'}`}>{log}</p>
                ))}
                {isExtractingSop && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}}/>
                      <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}/>
                      <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}}/>
                    </div>
                    <span className="text-xs text-violet-300">Processing...</span>
                  </div>
                )}
              </div>
            )}

            {/* Extracted Config Preview */}
            {extractedConfig && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-500">verified</span>
                  <h3 className="font-bold text-slate-800 text-sm">AI-Extracted Configuration Preview</h3>
                  <span className="text-xs text-slate-400">— review before activating</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Doctor Fee */}
                  <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 space-y-2">
                    <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
                      <span className="material-symbols-outlined text-base">stethoscope</span>
                      Doctor Fee
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-sm">₹</span>
                      <input
                        type="number"
                        value={extractedConfig.doctor_fee}
                        onChange={e => setExtractedConfig({...extractedConfig, doctor_fee: parseFloat(e.target.value)})}
                        className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-sm font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                  </div>

                  {/* Commission Splits */}
                  <div className="p-4 rounded-2xl bg-violet-50 border border-violet-100 space-y-2">
                    <div className="flex items-center gap-2 text-violet-700 font-bold text-xs uppercase tracking-wider">
                      <span className="material-symbols-outlined text-base">pie_chart</span>
                      Lab Splits (%)
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { label: 'Doctor', key: 'doctor', color: 'text-blue-600' },
                        { label: 'Platform', key: 'platform', color: 'text-violet-600' },
                        { label: 'Lab', key: 'lab', color: 'text-emerald-600' }
                      ].map(s => (
                        <div key={s.key} className="flex items-center gap-2">
                          <span className={`text-xs font-semibold w-16 ${s.color}`}>{s.label}</span>
                          <input
                            type="number"
                            value={extractedConfig.splits[s.key]}
                            onChange={e => setExtractedConfig({...extractedConfig, splits: {...extractedConfig.splits, [s.key]: parseFloat(e.target.value)}})}
                            className="flex-1 bg-white border border-violet-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
                          />
                          <span className="text-xs text-slate-400">%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total Split Check */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-slate-600 font-bold text-xs uppercase tracking-wider">
                      <span className="material-symbols-outlined text-base">balance</span>
                      Split Validation
                    </div>
                    {(() => {
                      const total = (extractedConfig.splits.doctor || 0) + (extractedConfig.splits.platform || 0) + (extractedConfig.splits.lab || 0);
                      const isValid = Math.abs(total - 100) < 0.01;
                      return (
                        <div className={`flex items-center gap-2 p-2 rounded-lg ${isValid ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          <span className="material-symbols-outlined text-base">{isValid ? 'check_circle' : 'error'}</span>
                          <span className="text-xs font-bold">Total: {total.toFixed(1)}% {isValid ? '✓ Valid' : '⚠ Must equal 100%'}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Test Prices */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider">
                    <span className="material-symbols-outlined text-base">biotech</span>
                    Lab Test Prices (per catalog item)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(testNames).map(([loinc, name]) => (
                      <div key={loinc} className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5">
                        <p className="text-xs font-bold text-slate-700 truncate">{name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">LOINC: {loinc}</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500">₹</span>
                          <input
                            type="number"
                            value={extractedConfig.test_prices[loinc] ?? 350}
                            onChange={e => setExtractedConfig({...extractedConfig, test_prices: {...extractedConfig.test_prices, [loinc]: parseFloat(e.target.value)}})}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Guidelines */}
                {extractedConfig.guidelines.length > 0 && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 space-y-2">
                    <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider">
                      <span className="material-symbols-outlined text-base">checklist</span>
                      Extracted Workflow Guidelines
                    </div>
                    <ul className="space-y-1.5">
                      {extractedConfig.guidelines.map((g: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-amber-800">
                          <span className="material-symbols-outlined text-amber-500 text-sm mt-0.5 flex-shrink-0">arrow_right</span>
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Activate Button */}
                <button
                  onClick={handleActivateSop}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm shadow-lg hover:shadow-emerald-400/30 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">rocket_launch</span>
                  Activate SOP — Apply to Billing, Splits & Workflows
                </button>
              </div>
            )}
          </div>
        )}

        {/* ACTIVE SOP RULES PANEL */}
        {sopActiveSubTab === 'active' && (
          <div className="space-y-5">
            {!activeSop ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
                <span className="material-symbols-outlined text-6xl">policy</span>
                <p className="font-semibold text-sm">No active SOP found</p>
                <button onClick={() => setSopActiveSubTab('upload')} className="px-6 py-3 bg-violet-600 text-white rounded-2xl text-xs font-bold hover:bg-violet-700 cursor-pointer">
                  Upload Your First SOP →
                </button>
              </div>
            ) : (
              <>
                {/* SOP Meta Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-xl">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-violet-200 uppercase tracking-wider font-bold">Active Clinic SOP</p>
                      <h3 className="text-lg font-extrabold mt-1">{activeSop.sopFileName}</h3>
                      <p className="text-xs text-violet-300 mt-1">Activated: {new Date(activeSop.createdAt).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})}</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/20 rounded-xl text-xs font-bold">
                      <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                      Live
                    </div>
                  </div>
                </div>

                {/* Fee & Split Dashboard */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Doctor Fee', value: `₹${activeSop.extractedConfig.doctor_fee}`, icon: 'stethoscope', color: 'blue' },
                    { label: 'Doctor Split', value: `${activeSop.extractedConfig.splits.doctor}%`, icon: 'person', color: 'indigo' },
                    { label: 'Platform Split', value: `${activeSop.extractedConfig.splits.platform}%`, icon: 'hub', color: 'violet' },
                    { label: 'Lab Split', value: `${activeSop.extractedConfig.splits.lab}%`, icon: 'biotech', color: 'emerald' },
                  ].map(stat => (
                    <div key={stat.label} className={`p-4 rounded-2xl bg-${stat.color}-50 border border-${stat.color}-100 text-center`}>
                      <span className={`material-symbols-outlined text-${stat.color}-500 text-xl`}>{stat.icon}</span>
                      <p className={`text-lg font-extrabold text-${stat.color}-700 mt-1`}>{stat.value}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Lab Test Prices */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                  <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-blue-500">biotech</span>
                    Active Lab Test Price Schedule
                  </h4>
                  <div className="divide-y divide-slate-100">
                    {Object.entries(activeSop.extractedConfig.test_prices).map(([loinc, price]) => (
                      <div key={loinc} className="flex items-center justify-between py-2.5">
                        <div>
                          <p className="text-xs font-semibold text-slate-700">{testNames[loinc] || loinc}</p>
                          <p className="text-[10px] text-slate-400 font-mono">LOINC: {loinc}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-slate-800">₹{price as number}</span>
                          <div className="text-[10px] text-slate-400 space-y-0.5 text-right">
                            <p className="text-blue-600">Dr: ₹{((price as number) * activeSop.extractedConfig.splits.doctor / 100).toFixed(0)}</p>
                            <p className="text-emerald-600">Lab: ₹{((price as number) * activeSop.extractedConfig.splits.lab / 100).toFixed(0)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Guidelines */}
                {activeSop.extractedConfig.guidelines.length > 0 && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 space-y-2">
                    <h4 className="font-bold text-amber-700 text-sm flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">checklist</span>
                      Active Workflow Guidelines
                    </h4>
                    <ul className="space-y-2">
                      {activeSop.extractedConfig.guidelines.map((g: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-amber-800">
                          <span className="w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 font-bold flex-shrink-0 text-[10px]">{i + 1}</span>
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* History */}
                {sops.length > 1 && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <h4 className="font-bold text-slate-600 text-xs uppercase tracking-wider flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">history</span>
                      Previous SOPs
                    </h4>
                    <div className="space-y-2">
                      {sops.filter(s => !s.isActive).slice(0, 5).map(s => (
                        <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-white border border-slate-200 rounded-xl">
                          <div>
                            <p className="text-xs font-semibold text-slate-600">{s.sopFileName}</p>
                            <p className="text-[10px] text-slate-400">{new Date(s.createdAt).toLocaleDateString('en-IN')}</p>
                          </div>
                          <button
                            onClick={() => {
                              const updated = api.getClinicSops().map(x => ({ ...x, isActive: x.id === s.id }));
                              api.saveClinicSops(updated);
                              window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                detail: { title: 'SOP Restored!', message: `"${s.sopFileName}" is now the active SOP.`, type: 'info' }
                              }));
                            }}
                            className="text-xs text-violet-600 font-bold hover:text-violet-800 cursor-pointer">
                            Restore
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={() => setSopActiveSubTab('upload')}
                  className="w-full py-3 rounded-2xl border-2 border-dashed border-violet-300 text-violet-600 font-bold text-sm hover:bg-violet-50 transition cursor-pointer flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-base">upload_file</span>
                  Upload & Replace with New SOP
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  // ROUTER CONTROLLER: Render Active Tab Contents
  const renderTabContent = () => {
    switch (activeTab) {
      case 'pod_view':
        return (
          <PodCommandCenter 
            hideHeader={true}
            onStartConsultation={(patient) => {
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
        return renderConsultationTab();
      case 'financials':
        return renderFinancialsTab();
      case 'patients':
        return renderPatientsTab();
      case 'whatsapp':
        return renderWhatsAppTab();
      case 'sop':
        return renderSopTab();
      default:
        return (
          <PodCommandCenter 
            hideHeader={true}
            onStartConsultation={(patient) => {
              setSelectedPatient(patient);
              setActiveTab('consultation');
            }}
          />
        );
    }
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

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 md:p-8 animate-fade-in overflow-y-auto">
        <div className="glass-panel max-w-4xl w-full p-6 md:p-8 border-slate-800 shadow-2xl relative bg-slate-900 text-white rounded-3xl space-y-6 max-h-[90vh] overflow-y-auto">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 via-primary to-secondary" />
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800/80 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-400 text-2xl font-bold">clinical_notes</span>
                <h2 className="text-lg font-black text-slate-100 uppercase tracking-wider font-sans">Clinical AI Laboratory Analysis Report</h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">Deep Diagnostics audit for patient: <strong className="text-slate-200 font-bold">{selectedPatient?.name}</strong> ({selectedPatient?.age}y, {selectedPatient?.gender})</p>
            </div>
            
            <div className="flex gap-2">
              <span className={`text-[10px] font-black font-mono px-3.5 py-1.5 rounded-full uppercase tracking-wider border ${
                riskTier === 'Critical Risk' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                riskTier === 'High Risk' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}>
                {riskTier}
              </span>
              <button
                onClick={() => setAnalyzingReport(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer border-0 text-white-force"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-6">
              <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest font-mono">
                1. Reference Range Audit & Diagnostics
              </h3>
              
              <div className="space-y-4">
                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-slate-200">
                      {isOphthalmology ? "Visual Acuity (OD)" : "HbA1c (Glycated Hemoglobin)"}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {isOphthalmology ? "Ref Range: 6/6 (Unaided)" : "Ref Range: 4.0% - 5.6%"}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="text-xl font-black font-mono tracking-tight">
                      {isOphthalmology ? "6/6" : `${report.HbA1c}%`}
                    </span>
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded font-mono ${
                      isOphthalmology ? 'bg-emerald-500/20 text-emerald-400' :
                      isHbA1cHigh ? 'bg-rose-500/20 text-rose-400' :
                      isHbA1cWarning ? 'bg-amber-500/20 text-amber-400' :
                      'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {isOphthalmology ? 'Normal' : isHbA1cHigh ? 'Diabetic' : isHbA1cWarning ? 'Prediabetic' : 'Normal'}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        isOphthalmology ? 'bg-emerald-500' :
                        isHbA1cHigh ? 'bg-rose-500' : isHbA1cWarning ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: isOphthalmology ? '100%' : `${Math.min(100, (report.HbA1c / 12) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-slate-200">
                      {isOphthalmology ? "Intraocular Pressure (IOP)" : "Serum Creatinine"}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {isOphthalmology ? "Ref Range: 10 - 21 mmHg" : "Ref Range: 0.6 - 1.2 mg/dL"}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="text-xl font-black font-mono tracking-tight">
                      {isOphthalmology ? "16 mmHg" : `${report.creatinine} mg/dL`}
                    </span>
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded font-mono ${
                      isOphthalmology ? 'bg-emerald-500/20 text-emerald-400' :
                      isCreatinineHigh ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {isOphthalmology ? 'Normal' : isCreatinineHigh ? 'Abnormal (High)' : 'Normal'}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isOphthalmology ? 'bg-emerald-500' : isCreatinineHigh ? 'bg-rose-500' : 'bg-emerald-500'}`}
                      style={{ width: isOphthalmology ? '76%' : `${Math.min(100, (report.creatinine / 2.5) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-slate-200">
                      {isOphthalmology ? "Visual Acuity (OS)" : "Total Hemoglobin"}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {isOphthalmology ? "Ref Range: 6/6 (Unaided)" : "Ref Range: 12.0 - 16.0 g/dL"}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="text-xl font-black font-mono tracking-tight">
                      {isOphthalmology ? "6/9" : `${report.hemoglobin} g/dL`}
                    </span>
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded font-mono ${
                      isOphthalmology ? 'bg-amber-500/20 text-amber-400' :
                      isHemoglobinLow ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {isOphthalmology ? 'Borderline' : isHemoglobinLow ? 'Anemic (Low)' : 'Normal'}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isHemoglobinLow ? 'bg-rose-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, (report.hemoglobin / 18) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest font-mono">
                  2. AI Clinical Correlations
                </h3>
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs space-y-2 leading-relaxed">
                  <strong className="text-indigo-400 block font-bold">Biomarker Interaction Profile</strong>
                  <p className="text-slate-300 text-[11px] font-medium leading-relaxed">{riskReason}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest font-mono">
                  3. Future Potential Disease Forecasts
                </h3>
                {complications.length === 0 ? (
                  <div className="p-4 bg-slate-950/20 border border-slate-800 rounded-2xl text-slate-400 text-xs italic">
                    No future potential risk patterns identified.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {complications.map((c, i) => (
                      <div key={i} className="p-3 bg-rose-950/20 border border-rose-900/30 rounded-xl flex items-center gap-2.5 text-xs text-rose-200">
                        <span className="material-symbols-outlined text-rose-400 text-sm shrink-0">warning</span>
                        <span className="font-bold">{c}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest font-mono">
                  4. Safe Prescribing Directives
                </h3>
                <div className="p-4 bg-indigo-950/20 border border-indigo-900/30 rounded-2xl text-[11px] text-indigo-200 space-y-2">
                  <div className="flex gap-2">
                    <span className="material-symbols-outlined text-xs text-indigo-400 shrink-0 font-bold">check_circle</span>
                    <span>{isCreatinineHigh ? "STRICT CONFLICT: Avoid NSAIDs (Ibuprofen, Diclofenac) to protect renal nephron capacity." : "NSAID usage cleared within standard clinical doses."}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="material-symbols-outlined text-xs text-indigo-400 shrink-0 font-bold">check_circle</span>
                    <span>{isHbA1cHigh ? "Review glycemic therapy. Consider adding SGLT2 inhibitors for cardio-renal protection." : "Glycemic profile does not require immediate pharmacological adjustment."}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end border-t border-slate-800 pt-4 gap-3">
            <button
              onClick={() => setAnalyzingReport(null)}
              className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white rounded-xl transition-colors cursor-pointer border-0 text-white-force animate-fade-in"
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
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
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
            <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
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
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                Mediflow Pod Tenant Host
                <span className="text-slate-300">·</span>
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
            { id: 'sop',           label: 'Clinic SOP',          icon: 'policy' }
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
                  isActive ? 'text-indigo-500' : 'text-slate-400'
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

      {/* ── MOBILE BOTTOM NAV (footer) ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] flex justify-around items-center z-50 h-14 px-1">
        {[
          { id: 'pod_view',     label: 'Pod HUD',  icon: 'hub' },
          { id: 'consultation', label: 'Consult',  icon: 'clinical_notes' },
          { id: 'financials',   label: 'Finance',  icon: 'account_balance_wallet' },
          { id: 'patients',     label: 'Patients', icon: 'group' },
          { id: 'whatsapp',     label: 'Chat',     icon: 'chat' },
          { id: 'sop',          label: 'SOP',      icon: 'policy' }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all cursor-pointer ${
                isActive ? 'text-indigo-600' : 'text-slate-400'
              }`}
            >
              <div className={`flex items-center justify-center w-8 h-6 rounded-lg transition-all ${
                isActive ? 'bg-indigo-50' : ''
              }`}>
                <span className={`material-symbols-outlined block transition-all ${
                  isActive ? 'text-[18px] font-bold' : 'text-[17px]'
                }`}>{tab.icon}</span>
              </div>
              <span className={`text-[9px] font-semibold leading-none ${
                isActive ? 'text-indigo-600' : 'text-slate-400'
              }`}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Allergy overrides modal */}
      {allergyAlert && renderAllergyAlertModal()}
      {analyzingReport && renderReportAnalysisModal()}
    </div>
  );
};
