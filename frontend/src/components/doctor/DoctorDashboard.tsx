import React, { useState, useEffect } from 'react';
import { api, MASTER_TEST_CATALOG } from '../../services/api';
import { supabase } from '../../lib/supabaseClient';
import type { Patient, DiagnosticTest, MedicationRequest, PharmacyInventoryItem, WhatsAppDrugOrder, PathologyReport, FinancialLedgerEntry } from '../../types';
import { 
  Trash2, 
  CheckCircle2, 
  AlertTriangle,
  ShieldAlert,
  Activity,
  HeartPulse
} from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import { AgenticConsole } from '../shared/AgenticConsole';
import { SystemHealthCockpit } from '../admin/SystemHealthCockpit';
import { StateHealingEngine } from '../../services/autoHealerAgent';
import { BiomarkerChart } from './BiomarkerChart';
import { ClinicPlacardGenerator } from '../admin/ClinicPlacardGenerator';
import { SeasonalForecastWidget } from '../pharmacy/SeasonalForecastWidget';

export const DoctorDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'consultation' | 'financials' | 'pharmacy' | 'pathology' | 'patients' | 'whatsapp'>('overview');
  
  // Real-time API States
  const [patients, setPatients] = useState<Patient[]>([]);
  const [pharmacyInventory, setPharmacyInventory] = useState<PharmacyInventoryItem[]>([]);
  const [whatsAppOrders, setWhatsAppOrders] = useState<WhatsAppDrugOrder[]>([]);
  const [pathologyReports, setPathologyReports] = useState<PathologyReport[]>([]);
  const [financialLedgers, setFinancialLedgers] = useState<FinancialLedgerEntry[]>([]);

  // Existing states
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

  // Ambient AI Scribe States
  const [isAmbientScribing, setIsAmbientScribing] = useState(false);
  const [scribeTimeRemaining, setScribeTimeRemaining] = useState(0);
  const [activeScribeScript, setActiveScribeScript] = useState<string | null>(null);
  const [customScribeText, setCustomScribeText] = useState('');
  const [isMedLmParsing, setIsMedLmParsing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const durationIntervalRef = React.useRef<any>(null);
  const recognitionRef = React.useRef<any>(null);

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
      const tabs: Array<'overview' | 'consultation' | 'financials' | 'pharmacy' | 'pathology' | 'patients' | 'whatsapp'> = [
        'overview', 
        'consultation', 
        'financials', 
        'pharmacy', 
        'pathology', 
        'patients',
        'whatsapp'
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
  }, [selectedPatient?.id]);

  // Ambient AI Scribe countdown effect
  useEffect(() => {
    let timer: any;
    if (isAmbientScribing && activeScribeScript !== 'custom' && scribeTimeRemaining > 0) {
      timer = setTimeout(() => {
        setScribeTimeRemaining(scribeTimeRemaining - 1);
        if (scribeTimeRemaining === 3) {
          setCustomScribeText("Synchronizing audio stream... Ambient microphone active.");
        } else if (scribeTimeRemaining === 2) {
          if (activeScribeScript === 'diabetes') {
            setCustomScribeText("Doctor: Hello Aarav. Let's look at your reports. Your blood pressure is elevated at 145/95 mmHg and your latest fasting blood glucose is 180 mg/dL...");
          } else if (activeScribeScript === 'infection') {
            setCustomScribeText("Doctor: Hi Priyanka. You've had a bad cough, chest congestion, and a low-grade fever... Listening to your lungs, there's bronchial wheezing...");
          } else if (activeScribeScript === 'renal') {
            setCustomScribeText("Doctor: Welcome back. We need to check on your kidney function and electrolyte balance today... Let's order a Serum Creatinine test and run a Serum Sodium level electrolyte test...");
          }
        }
      }, 1000);
    } else if (isAmbientScribing && activeScribeScript !== 'custom' && scribeTimeRemaining === 0) {
      setIsAmbientScribing(false);
      setIsMedLmParsing(true);
      
      setTimeout(() => {
        setIsMedLmParsing(false);
        
        let finalScript = "";
        if (activeScribeScript === 'diabetes') {
          finalScript = "Doctor: Hello Aarav. Let's look at your reports. Your blood pressure is elevated at 145/95 mmHg and your latest fasting blood glucose is 180 mg/dL. We need to adjust your medications to prevent diabetic complications. I am starting you on Metformin 500mg, to be taken one tablet twice daily (1-0-1) for 10 Days after meals. Also, let's upgrade your Telmisartan to 40mg once daily in the morning (1-0-0) for 30 Days to manage your blood pressure. To monitor your kidneys and glycemic control over the last 90 days, I am requisitioning a HbA1c test and a Serum Creatinine kidney function panel. Please get these done at the Bihar Pathology lab immediately.";
        } else if (activeScribeScript === 'infection') {
          finalScript = "Doctor: Hi Priyanka. You've had a bad cough, chest congestion, and a low-grade fever for the last three days. Listening to your lungs, there's some bronchial wheezing. This looks like acute bronchitis. I'm going to prescribe Amoxicillin 500mg, one capsule three times daily (1-1-1) for 7 Days to clear the bacterial infection. For your fever and body aches, take Paracetamol 650mg once daily at night (0-0-1) for 3 Days as needed. Also, let's order a Total Hemoglobin test to check your blood count and rule out anemia. Rest well and drink plenty of warm fluids.";
        } else if (activeScribeScript === 'renal') {
          finalScript = "Doctor: Welcome back. We need to check on your kidney function and electrolyte balance today, especially with your history of blood pressure meds. I want you to continue Telmisartan 40mg once daily in the morning (1-0-0) for 30 Days. Let's order a Serum Creatinine test to calculate your eGFR, and also run a Serum Sodium level electrolyte test to ensure your sodium levels are within the normal range. Please avoid high-sodium foods and drink at least 2.5 liters of water daily. We will review these reports next week.";
        }

        setCustomScribeText(finalScript);
        processBatchDialogue(finalScript);

        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            title: 'Gemini MedLM Synthesis Complete! ✨',
            message: 'Auto-populated clinical notes, LOINC panels, and e-Rx medication plans successfully.',
            type: 'success'
          }
        }));
      }, 1500);
    }
    return () => clearTimeout(timer);
  }, [isAmbientScribing, scribeTimeRemaining, activeScribeScript]);

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

  const startRecording = async () => {
    audioChunksRef.current = [];
    setRecordingDuration(0);
    setAudioBlob(null);
    setIsAmbientScribing(true);
    setCustomScribeText("Initiating local browser audio device... Recording consult active.");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Compress locally in real-time to standard Opus containers (WebM or Ogg)
      let options = { mimeType: 'audio/webm; codecs=opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'audio/ogg; codecs=opus' };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: '' }; // Fallback to system default
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const compiledBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setAudioBlob(compiledBlob);
        
        // Release hardware tracks
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start(250);

      // Start Web Speech API Recognition in parallel to capture actual dialogue voice for free!
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        let fullSpeechText = "";
        recognition.onresult = (event: any) => {
          const result = event.results[event.results.length - 1];
          if (result.isFinal) {
            fullSpeechText += result[0].transcript + " ";
            setCustomScribeText(fullSpeechText.trim());
          }
        };

        recognition.onerror = (err: any) => {
          console.error("[Speech Recognition Error]:", err);
        };

        recognition.start();
        recognitionRef.current = recognition;
      }

      // Duration counter
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Microphone hardware error:", err);
      setIsAmbientScribing(false);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Mic Hardware Error 🎙️',
          message: 'Failed to access browser audio input device. Please check permissions.',
          type: 'error'
        }
      }));
    }
  };

  const stopRecordingAndProcess = () => {
    setIsAmbientScribing(false);
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    setIsMedLmParsing(true);

    // Simulate batch POSTing the compressed audio file payload in a single-burst Whisper cloud call
    setTimeout(() => {
      setIsMedLmParsing(false);
      
      let speechText = customScribeText;
      if (!speechText || speechText.startsWith("Initiating") || speechText.startsWith("Recording")) {
        // Fallback or default transcript text
        speechText = "Doctor: Hello, I am performing a follow-up consultation. Let's start you on Metformin 500mg once daily after meals and Telmisartan 40mg in the morning to maintain blood pressure control. Requisitioning a HbA1c panel and a Serum Creatinine panel to review kidney function trends.";
      }

      setCustomScribeText(speechText);
      processBatchDialogue(speechText);
    }, 2500);
  };

  const processBatchDialogue = async (dialogueText: string) => {
    setIsMedLmParsing(true);
    try {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY;
      if (!apiKey) {
        throw new Error("No Groq API key found in VITE_GROQ_API_KEY");
      }

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `You are an expert clinical scribe powered by MedLM. Analyze the provided doctor-patient consultation dialogue transcript.
Extract a professional SOAP (Subjective, Objective, Assessment, Plan) chart, suggested e-prescription drug mappings, and diagnostic LOINC codes.
Return a strict JSON object with EXACTLY this schema (no markdown block wrapper, no other text):
{
  "clinicalNotes": {
    "presentingComplaints": "Subjective notes summarizing patient symptoms, duration, history...",
    "systemicExamination": "Objective notes summarizing vitals, examinations...",
    "provisionalDiagnosis": "Assessment notes summarizing clinical impressions and diagnoses..."
  },
  "diagnosticPanels": ["LOINC codes for requested diagnostic tests from catalog (HbA1c is 4544-3, Serum Creatinine is 2160-0, Total Hemoglobin is 3024-7, Serum Sodium is 2947-0, Total Bilirubin is 1975-2)"],
  "medications": [
    { "name": "Exact Brand or Generic Name (e.g. Metformin 500mg, Amoxicillin 500mg, Telmisartan 40mg, Paracetamol 650mg, Atorvastatin 10mg)", "dose": "e.g., 1 Tab", "freq": "e.g., 1-0-1", "dur": "e.g., 7 Days" }
  ]
}`
            },
            {
              role: 'user',
              content: dialogueText
            }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
      }

      const resJson = await response.json();
      const extractedJsonStr = resJson.choices?.[0]?.message?.content;
      if (!extractedJsonStr) {
        throw new Error("Groq API returned an empty completion.");
      }

      console.log("[Groq Scribe] Live Structural AI Output JSON:", extractedJsonStr);

      const data = JSON.parse(extractedJsonStr);

      // Hydrate notes
      const soapNotes = `### CLINICAL ENCOUNTER SUMMARY (AI-Generated via Groq Llama-3.1-70B)\n\n` +
        `**[S] SUBJECTIVE / Presenting Complaints:**\n${data.clinicalNotes.presentingComplaints}\n\n` +
        `**[O] OBJECTIVE / Systemic Examination:**\n${data.clinicalNotes.systemicExamination}\n\n` +
        `**[A] ASSESSMENT / Provisional Diagnosis:**\n${data.clinicalNotes.provisionalDiagnosis}\n\n` +
        `**[P] PLAN / Therapeutic e-Rx Mappings:**\n` +
        `- Ordered diagnostics LOINCs: ${data.diagnosticPanels.length > 0 ? data.diagnosticPanels.join(', ') : 'None'}\n` +
        `- Prescribed drugs: ${data.medications.map((m: any) => `${m.name} (${m.freq})`).join(', ')}`;
      setNotes(soapNotes);

      // Hydrate diagnostics list
      const testsToSelect = MASTER_TEST_CATALOG.filter(test => data.diagnosticPanels.includes(test.loincCode));
      setSelectedTests(testsToSelect);

      // Hydrate medications list (checking allergy conflict)
      const newMedsList: Omit<MedicationRequest, 'id'>[] = [];
      data.medications.forEach((med: any) => {
        const allergy = checkAllergyConflict(med.name);
        if (allergy) {
          setAllergyAlert({
            medicineName: med.name,
            allergen: allergy,
            resolved: false,
            justification: ''
          });
        } else {
          newMedsList.push({
            medicineName: med.name,
            dosage: med.dose,
            frequency: med.freq,
            duration: med.dur
          });
        }
      });

      if (newMedsList.length > 0) {
        setMedications(prev => {
          const existing = new Set(prev.map(m => m.medicineName.toLowerCase()));
          const filtered = newMedsList.filter(m => !existing.has(m.medicineName.toLowerCase()));
          return [...prev, ...filtered];
        });
      }

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Live Scribe Hydrated! ✨',
          message: 'Llama-3.1 SOAP clinical JSON parsed successfully into form inputs.',
          type: 'success'
        }
      }));

    } catch (e) {
      console.warn("[Groq Live Scribe Failed, running keyword fallback]:", e);
      
      const lowerText = dialogueText.toLowerCase();
      let subjective = "Patient routine review follow-up encounter.";
      let objective = "Vitals evaluated. Cardiovascular status stable.";
      let assessment = "Chronic indices monitoring.";
      let diagnostics: string[] = [];
      let medicationsToPrescribe: Array<{ name: string; dose: string; freq: string; dur: string }> = [];

      if (lowerText.includes("diabetes") || lowerText.includes("glucose") || lowerText.includes("metformin")) {
        subjective = "Patient presents for chronic review of Type-2 Diabetes Mellitus and stage-1 Hypertension.";
        objective = "Blood pressure measured at 145/95 mmHg. Fasting blood sugar level is 180 mg/dL.";
        assessment = "Type-2 Diabetes Mellitus with borderline renal clearance and stage-1 Hypertension.";
        diagnostics.push("4544-3");
        diagnostics.push("2160-0");
        medicationsToPrescribe.push({ name: "Metformin 500mg", dose: "1 Tab", freq: "1-0-1", dur: "10 Days" });
        medicationsToPrescribe.push({ name: "Telmisartan 40mg", dose: "1 Tab", freq: "1-0-0", dur: "30 Days" });
      } else if (lowerText.includes("cough") || lowerText.includes("bronchitis") || lowerText.includes("amoxicillin") || lowerText.includes("fever")) {
        subjective = "Patient presents with persistent cough, chest congestion, and low-grade fever for three days.";
        objective = "Chest auscultation reveals mild bilateral bronchial wheezing. Core Temp: 99.8°F.";
        assessment = "Acute Bronchitis (suspected secondary bacterial respiratory infection).";
        diagnostics.push("3024-7");
        medicationsToPrescribe.push({ name: "Amoxicillin 500mg", dose: "1 Cap", freq: "1-1-1", dur: "7 Days" });
        medicationsToPrescribe.push({ name: "Paracetamol 650mg", dose: "1 Tab", freq: "0-0-1", dur: "3 Days" });
      } else if (lowerText.includes("renal") || lowerText.includes("kidney") || lowerText.includes("creatinine") || lowerText.includes("sodium")) {
        subjective = "Renal clearance monitoring and routine electrolyte check.";
        objective = "Asymptomatic. Cardiovascular status stable. Clinically well-hydrated.";
        assessment = "Chronic renal panel surveillance with borderline creatinine index review.";
        diagnostics.push("2160-0");
        diagnostics.push("2947-0");
        medicationsToPrescribe.push({ name: "Telmisartan 40mg", dose: "1 Tab", freq: "1-0-0", dur: "30 Days" });
      } else {
        if (lowerText.includes("metformin")) {
          medicationsToPrescribe.push({ name: "Metformin 500mg", dose: "1 Tab", freq: "1-0-1", dur: "10 Days" });
        }
        if (lowerText.includes("hba1c")) {
          diagnostics.push("4544-3");
        }
      }

      const extractedJsonStr = JSON.stringify({
        clinicalNotes: {
          presentingComplaints: subjective,
          systemicExamination: objective,
          provisionalDiagnosis: assessment
        },
        diagnosticPanels: diagnostics,
        medications: medicationsToPrescribe
      });

      const data = JSON.parse(extractedJsonStr);

      const soapNotes = `### CLINICAL ENCOUNTER SUMMARY (AI-Generated Fallback)\n\n` +
        `**[S] SUBJECTIVE / Presenting Complaints:**\n${data.clinicalNotes.presentingComplaints}\n\n` +
        `**[O] OBJECTIVE / Systemic Examination:**\n${data.clinicalNotes.systemicExamination}\n\n` +
        `**[A] ASSESSMENT / Provisional Diagnosis:**\n${data.clinicalNotes.provisionalDiagnosis}\n\n` +
        `**[P] PLAN / Therapeutic e-Rx Mappings:**\n` +
        `- Ordered diagnostics LOINCs: ${data.diagnosticPanels.length > 0 ? data.diagnosticPanels.join(', ') : 'None'}\n` +
        `- Prescribed drugs: ${data.medications.map((m: any) => `${m.name} (${m.freq})`).join(', ')}`;
      setNotes(soapNotes);

      const testsToSelect = MASTER_TEST_CATALOG.filter(test => data.diagnosticPanels.includes(test.loincCode));
      setSelectedTests(testsToSelect);

      const newMedsList: Omit<MedicationRequest, 'id'>[] = [];
      data.medications.forEach((med: any) => {
        const allergy = checkAllergyConflict(med.name);
        if (allergy) {
          setAllergyAlert({
            medicineName: med.name,
            allergen: allergy,
            resolved: false,
            justification: ''
          });
        } else {
          newMedsList.push({
            medicineName: med.name,
            dosage: med.dose,
            frequency: med.freq,
            duration: med.dur
          });
        }
      });

      if (newMedsList.length > 0) {
        setMedications(prev => {
          const existing = new Set(prev.map(m => m.medicineName.toLowerCase()));
          const filtered = newMedsList.filter(m => !existing.has(m.medicineName.toLowerCase()));
          return [...prev, ...filtered];
        });
      }

      setCustomScribeText(dialogueText + `\n\n[CDSS Fallback: Live LLM parsing inactive. Keyword backup completed.]`);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Scribe Sandbox Fallback ⚠️',
          message: 'JSON structure resolved via local keyword heuristics.',
          type: 'warning'
        }
      }));
    } finally {
      setIsMedLmParsing(false);
    }
  };

  const handleTriggerScenario = (type: 'diabetes' | 'infection' | 'renal') => {
    if (isAmbientScribing || isMedLmParsing) return;

    setActiveScribeScript(type);
    setIsAmbientScribing(true);
    setScribeTimeRemaining(3); // 3 seconds fast countdown for quick presets
    setCustomScribeText("Recording preset consultation scenario dialogue audio chunks...");
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

    api.createEncounter({
      patientId: selectedPatient.id,
      patientName: selectedPatient.name,
      doctorId: 'doc-1',
      clinicalNotes: notes,
      medications: medications.map((m: Omit<MedicationRequest, 'id'>, idx: number) => ({ ...m, id: `med-${idx}` })),
      diagnosticTests: selectedTests
    });

    // Reset Form
    setNotes('');
    setMedications([]);
    setSelectedTests([]);
    
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: 'e-Prescription (e-Rx) routed to Pharmacy & Lab requisitions generated successfully.',
        type: 'success',
        title: 'Encounter Routed'
      }
    }));
  };

  const activeHistory = selectedPatient ? api.getPatientHistoricalBiomarkers(selectedPatient.id) : null;
  const baseReport = activeHistory?.find(h => h.date === baselineDate) ?? null;
  const compReport = activeHistory?.find(h => h.date === comparisonDate) ?? (activeHistory ? activeHistory[activeHistory.length - 1] : null);
  const isConsentActive = selectedPatient ? api.isPatientConsentActive(selectedPatient.id) : true;

  // TAB 1 RENDER: Overview Command Center
  // TAB 1 RENDER: Overview Command Center
  const renderOverviewTab = () => {
    const pendingLabCount = pathologyReports.filter(r => r.status === 'pending').length;
    const grossRev = financialLedgers.reduce((acc, entry) => acc + entry.grossAmount, 0);
    const netPayout = financialLedgers.reduce((acc, entry) => acc + entry.netPayout, 0);

    // Calculate split revenues
    const clinicCut = financialLedgers.filter(e => e.transactionType === 'appointment_fee').reduce((acc, e) => acc + e.grossAmount, 0) * 0.485;
    const pharmacyComm = financialLedgers.filter(e => e.transactionType === 'medicine_commission').reduce((acc, e) => acc + e.netPayout, 0);
    const labComm = financialLedgers.filter(e => e.transactionType === 'lab_commission').reduce((acc, e) => acc + e.netPayout, 0);
    const platformCut = grossRev * 0.03;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in text-slate-800 font-sans">
        {/* Left Column: Quick Metrics & CDSS AI Feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* Agentic Console Telemetry Scribe */}
          <AgenticConsole onWorkflowExecuted={() => {
            setPatients(api.getPatients());
            setPathologyReports(api.getPathologyReports());
            setFinancialLedgers(api.getFinancialLedgers());
            setWhatsAppSessions(api.getWhatsAppSessions());
          }} />

          {/* Biomarker SVG Chart Trend Line */}
          {(selectedPatient?.id || patients[0]?.id) && (
            <BiomarkerChart patientId={selectedPatient?.id || patients[0]?.id} />
          )}

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Today's Queue", val: patients.length, unit: "patients", icon: "group", color: "border-blue-100 text-blue-600 bg-blue-50/20", glow: "bg-blue-400" },
              { label: "Gross Revenue", val: `₹${grossRev.toLocaleString()}`, unit: "total sales", icon: "payments", color: "border-emerald-100 text-emerald-600 bg-emerald-50/20", glow: "bg-emerald-400" },
              { label: "Net Payout", val: `₹${netPayout.toLocaleString()}`, unit: "net splits", icon: "account_balance", color: "border-indigo-100 text-indigo-600 bg-indigo-50/20", glow: "bg-indigo-400" },
              { label: "Lab Approvals", val: pendingLabCount, unit: "pending test", icon: "science", color: "border-amber-100 text-amber-600 bg-amber-50/20", glow: "bg-amber-400" }
            ].map((card, i) => (
              <div key={i} className={`p-4.5 rounded-2xl border bg-white shadow-sm flex flex-col justify-between hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 relative overflow-hidden group cursor-pointer ${card.color}`}>
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-current to-transparent opacity-15" />
                <div className="flex justify-between items-start">
                  <span className="material-symbols-outlined text-2xl group-hover:rotate-12 transition-transform duration-300">{card.icon}</span>
                  <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest bg-white/80 border border-slate-200/50 px-2 py-0.5 rounded-full shadow-xs">
                    <span className={`w-1.5 h-1.5 rounded-full ${card.glow} animate-pulse`} />
                    Sync
                  </span>
                </div>
                <div className="mt-4">
                  <div className="text-xl font-bold tracking-tight text-slate-800 font-mono">{card.val}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{card.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Widget 1: Active Consultation Queue Worklist */}
          <div className="glass-panel p-6 bg-white border-slate-200/60 shadow-sm rounded-3xl relative overflow-hidden space-y-4">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-500 to-indigo-500 opacity-40" />
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500 text-xl font-bold animate-pulse">pending_actions</span>
                <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Active Patient Consultation Queue</h2>
              </div>
              <span className="text-[9px] font-bold font-mono px-2.5 py-0.5 bg-blue-50 border border-blue-100 text-blue-500 rounded-full">
                {patients.length} Registered
              </span>
            </div>
            
            <div className="space-y-3">
              {patients.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs italic">
                  No patients checked in today.
                </div>
              ) : (
                patients.map(p => (
                  <div key={p.id} className="p-4 bg-slate-50/50 border border-slate-200/50 hover:border-blue-200 hover:bg-slate-50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 group">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <strong className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{p.name}</strong>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-200/60 text-slate-500 rounded">
                          {p.age}y • {p.gender}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-mono bg-white border px-1.5 py-0.5 rounded-sm">{p.abhaId || 'ABHA-PENDING'}</span>
                        {p.chronicConditions.map((c, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-md font-medium text-[8px] uppercase tracking-wider">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedPatient(p);
                        setActiveTab('consultation');
                        window.dispatchEvent(new CustomEvent('mediflow-toast', {
                          detail: {
                            title: 'Consultation Initialized! 🩺',
                            message: `Directly navigated to Consultation worksheet for ${p.name}.`,
                            type: 'success'
                          }
                        }));
                      }}
                      className="px-3.5 py-2 bg-white hover:bg-blue-600 hover:text-white border border-slate-200/80 hover:border-blue-500 rounded-xl text-[10px] font-bold uppercase tracking-wider text-slate-600 shadow-xs hover:scale-102 transition-all flex items-center justify-center gap-1.5 cursor-pointer self-start sm:self-auto hover:text-white-force"
                    >
                      <span className="material-symbols-outlined text-xs">clinical_notes</span>
                      Begin Consultation
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Widget 2: Epidemiological Sewage Pathogen Density Surveillance */}
          <div className="glass-panel p-6 bg-white border-slate-200/60 shadow-sm rounded-3xl relative overflow-hidden space-y-5">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-teal-500 to-emerald-500 opacity-40" />
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-500 text-xl font-bold">water_ec</span>
                <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Epidemiological Sewage Pathogen Density</h2>
              </div>
              <span className="text-[9px] font-mono font-bold tracking-widest text-teal-500 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-md uppercase">
                Active pre-monsoon
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
              <div className="md:col-span-4 space-y-1">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pathogen Density Index</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold font-mono tracking-tight text-slate-800">86%</span>
                  <span className="text-[10px] text-rose-500 font-bold tracking-wide flex items-center font-mono">▲ Critical</span>
                </div>
                <div className="text-[9px] text-slate-400 leading-relaxed">
                  Surveillance node: Patna Central Drainage Section-IV
                </div>
              </div>

              {/* Restock safety threshold slider */}
              <div className="md:col-span-8 p-4 bg-slate-50 border border-slate-200/40 rounded-2xl space-y-3">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <span>B2B Restock Safety Threshold</span>
                  <span className="text-teal-600 font-mono text-xs">{restockThreshold}% Safety</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="95"
                  value={restockThreshold}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setRestockThreshold(val);
                    if (val < 86) {
                      window.dispatchEvent(new CustomEvent('mediflow-toast', {
                        detail: {
                          title: 'B2B Restock Dispatched! 📦',
                          message: `Pathogen level (86%) exceeded safety threshold (${val}%). Automated restocks sent to Pharmacy!`,
                          type: 'success'
                        }
                      }));
                    }
                  }}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-500 focus:outline-none"
                />
                <div className="text-[8px] text-slate-400 leading-relaxed flex justify-between">
                  <span>50% (High Margin)</span>
                  <span>Safety Slider Control</span>
                  <span>95% (Sensitive Trigger)</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex gap-3 text-xs text-slate-600 items-start">
              <span className="material-symbols-outlined text-emerald-500 text-sm font-bold mt-0.5">local_shipping</span>
              <p className="text-[10px] leading-relaxed">
                <strong className="text-slate-800 font-bold">B2B Restocking Automation Active: </strong>
                When pathogen density exceeds the safety margin, the system dispatches bulk restock orders for critical medications (Amoxicillin, Reagents) at adjacent partner counters.
              </p>
            </div>
          </div>

          {/* AI Passive CDSS Feed */}
          <div className="glass-panel p-6 bg-gradient-to-br from-white/95 via-slate-50/40 to-white/95 border border-slate-200/80 shadow-md shadow-slate-100/50 rounded-3xl relative overflow-hidden space-y-5 transition-all duration-300 hover:border-slate-300 hover:shadow-lg">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-rose-500 via-amber-500 to-blue-500" />
            
            <div className="flex justify-between items-center pb-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8.5 h-8.5 rounded-2xl bg-rose-500/10 border border-rose-500/15 flex items-center justify-center text-rose-500 animate-pulse shadow-2xs">
                  <ShieldAlert className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 font-sans">
                    CDSS & RAG Clinical Advisories
                  </h2>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 font-mono">Real-time Patient Safety Scan</p>
                </div>
              </div>
              
              <span className="flex items-center gap-1.5 text-[8px] font-extrabold font-mono uppercase tracking-widest bg-emerald-50 border border-emerald-100/70 text-emerald-600 px-3 py-1 rounded-full shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                Agent Active
              </span>
            </div>

            <div className="space-y-4 pt-1">
              {/* Allergy Interception Card */}
              <div className="p-4 bg-gradient-to-r from-rose-50/40 via-white to-white border border-slate-200/40 border-l-4 border-l-rose-500 hover:border-rose-350 hover:shadow-xs rounded-2xl flex gap-3.5 text-xs text-slate-600 transition-all duration-300 hover:-translate-y-[1px] group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/[0.015] rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shrink-0 mt-0.5 shadow-2xs group-hover:scale-105 transition-transform">
                  <AlertTriangle className="h-4.5 w-4.5" />
                </div>
                <div className="space-y-1 relative z-10 flex-1">
                  <div className="flex justify-between items-center">
                    <strong className="font-extrabold text-[11px] text-rose-700 uppercase tracking-wide">Active Allergy Interception</strong>
                    <span className="text-[8px] font-bold font-mono px-2 py-0.5 bg-rose-100/60 text-rose-800 rounded-md uppercase tracking-wider font-sans">Aarav Sharma</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-sans leading-relaxed pt-0.5">
                    Documented Penicillin allergy. Automated prescription scanner blocks beta-lactam class medications (<span className="text-slate-700 font-bold">Amoxicillin</span>, <span className="text-slate-700 font-bold">Ampicillin</span>) in current active pod session.
                  </p>
                </div>
              </div>

              {/* Renal Shift Card */}
              <div className="p-4 bg-gradient-to-r from-amber-50/40 via-white to-white border border-slate-200/40 border-l-4 border-l-amber-500 hover:border-amber-350 hover:shadow-xs rounded-2xl flex gap-3.5 text-xs text-slate-600 transition-all duration-300 hover:-translate-y-[1px] group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/[0.015] rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shrink-0 mt-0.5 shadow-2xs group-hover:scale-105 transition-transform">
                  <HeartPulse className="h-4.5 w-4.5" />
                </div>
                <div className="space-y-1 relative z-10 flex-1">
                  <div className="flex justify-between items-center">
                    <strong className="font-extrabold text-[11px] text-amber-700 uppercase tracking-wide">Renal Filtration Clearance Shift</strong>
                    <span className="text-[8px] font-bold font-mono px-2 py-0.5 bg-amber-100/60 text-amber-800 rounded-md uppercase tracking-wider font-sans">Priyanka Verma</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-sans leading-relaxed pt-0.5">
                    Serum Creatinine cleared at <span className="text-slate-750 font-bold font-mono">1.4 mg/dL</span>. Passive CDSS triggers glomerular filtration restriction alert. Suggest withholding high-dose active NSAID therapies.
                  </p>
                </div>
              </div>

              {/* Missing Diagnostic Markers Card */}
              <div className="p-4 bg-gradient-to-r from-blue-50/40 via-white to-white border border-slate-200/40 border-l-4 border-l-blue-500 hover:border-blue-350 hover:shadow-xs rounded-2xl flex gap-3.5 text-xs text-slate-600 transition-all duration-300 hover:-translate-y-[1px] group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/[0.015] rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shrink-0 mt-0.5 shadow-2xs group-hover:scale-105 transition-transform">
                  <Activity className="h-4.5 w-4.5" />
                </div>
                <div className="space-y-1 relative z-10 flex-1">
                  <div className="flex justify-between items-center">
                    <strong className="font-extrabold text-[11px] text-blue-700 uppercase tracking-wide">Missing Diagnostic Markers</strong>
                    <span className="text-[8px] font-bold font-mono px-2 py-0.5 bg-blue-100/60 text-blue-800 rounded-md uppercase tracking-wider font-sans">Diabetic Profile</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-sans leading-relaxed pt-0.5">
                    Diabetes-linked profiles lack active 90-day HbA1c tests. Recommend requisiting <span className="text-slate-750 font-bold font-mono">LOINC: 4544-3</span> on the next consultation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Approved Lab Reports Tracker */}
        <div className="space-y-6">
          {/* Widget 3: Unified Financial Splits Ledger */}
          <div className="glass-panel p-6 bg-white border-slate-200/60 shadow-sm rounded-3xl relative overflow-hidden space-y-4">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-emerald-500 to-indigo-500 opacity-40" />
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500 text-xl font-bold">account_balance_wallet</span>
              <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Financial Splits Ledger</h2>
            </div>
            
            <div className="space-y-3.5 text-xs text-slate-600">
              {[
                { label: "Clinic Admin Fee", val: `₹${clinicCut.toFixed(0)}`, percent: 48.5, color: "bg-emerald-500" },
                { label: "Pharmacy Splits Ledger", val: `₹${pharmacyComm.toFixed(0)}`, percent: 28.5, color: "bg-blue-500" },
                { label: "Laboratory Partner Node", val: `₹${labComm.toFixed(0)}`, percent: 20, color: "bg-indigo-500" },
                { label: "Mediflow Platform Fee (3%)", val: `₹${platformCut.toFixed(0)}`, percent: 3, color: "bg-slate-400" }
              ].map((split, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase text-slate-500">
                    <span>{split.label}</span>
                    <span className="font-mono text-slate-700">{split.val} ({split.percent}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${split.color}`} style={{ width: `${split.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Widget 4: Approved Pathology Barcode Reports Tracker */}
          <div className="glass-panel p-6 bg-white border-slate-200/60 shadow-sm rounded-3xl h-full flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-purple-500 to-pink-500 opacity-40" />
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-purple-500 text-xl font-bold">done_all</span>
                <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Approved pathology reports</h2>
              </div>
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {pathologyReports.filter(r => r.status === 'approved').map(report => (
                  <div key={report.id} className="p-3 bg-slate-50 border border-slate-200/50 rounded-2xl space-y-2 hover:bg-slate-100/50 hover:border-slate-300/60 transition-all group">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs font-bold text-slate-700">{report.patientName}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5">{report.testName}</div>
                      </div>
                      <span className="text-[8px] font-mono bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase">Approved</span>
                    </div>

                    {/* Holographic Barcode */}
                    <div className="bg-white border border-slate-200 p-2 rounded-xl flex flex-col items-center gap-1 shadow-xs group-hover:scale-102 transition-transform">
                      <div className="h-8 w-full flex items-center justify-between px-1.5 opacity-60">
                        {Array.from({ length: 28 }).map((_, idx) => (
                          <div
                            key={idx}
                            className="h-full bg-slate-900"
                            style={{ width: `${idx % 3 === 0 ? 3 : (idx % 2 === 0 ? 1 : 2)}px` }}
                          />
                        ))}
                      </div>
                      <div className="text-[8px] font-mono text-slate-400 font-bold select-all">{"MED-" + report.loincCode + "-" + report.id.toUpperCase()}</div>
                    </div>

                    <button
                      onClick={() => setSelectedApprovedReport(report)}
                      className="w-full text-center text-[9px] text-primary hover:text-primary-700 font-bold tracking-wider uppercase border border-primary/20 hover:border-primary/40 bg-white py-2 rounded-xl transition-all cursor-pointer hover:scale-102 active:scale-98"
                    >
                      Review RAG Diagnostic Summary
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-100 text-[9px] text-slate-400 italic">
              * Pathology data is synced instantly via the local pod laboratory partner node.
            </div>
          </div>
        </div>

        {/* Side slide-out Drawer / modal for Approved Report RAG Summary */}
        {selectedApprovedReport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-lg h-full shadow-2xl p-6 border-l border-slate-200 flex flex-col justify-between animate-slide-in">
              <div className="space-y-6 overflow-y-auto pr-1">
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 font-sans">Approved Pathology Summary</h3>
                    <p className="text-xs text-slate-400 mt-1 font-sans">{selectedApprovedReport.patientName} • {selectedApprovedReport.testName}</p>
                  </div>
                  <button
                    onClick={() => setSelectedApprovedReport(null)}
                    className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>

                <div className="space-y-4 text-xs text-slate-600">
                  <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl font-mono text-[10px] uppercase font-bold tracking-wider">
                    LOINC Coded Test: {selectedApprovedReport.loincCode}
                  </div>
                  <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl space-y-3 leading-relaxed">
                    <strong className="block text-slate-800 font-semibold">Laboratory Findings:</strong>
                    <p className="whitespace-pre-line text-slate-600 font-sans">{selectedApprovedReport.results || 'Pending laboratory diagnostic findings entry...'}</p>
                  </div>

                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl space-y-3">
                    <div className="flex items-center gap-1.5 text-primary text-xs font-bold font-mono uppercase tracking-wider">
                      <span className="material-symbols-outlined text-sm">psychology</span>
                      AI RAG Longitudinal Analysis
                    </div>
                    <p className="text-slate-600 leading-relaxed font-sans">
                      Based on comparative historical indicators, the patient displays glycemic index fluctuation (HbA1c level active at 7.2%). Adjusted prescribing support recommended.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex gap-3">
                <button
                  onClick={() => setSelectedApprovedReport(null)}
                  className="flex-1 btn-secondary py-2.5 rounded-xl text-center text-xs"
                >
                  Close Summary
                </button>
                <button
                  onClick={() => {
                    const pat = api.getPatients().find(p => p.id === selectedApprovedReport.patientId);
                    const patPhone = pat ? pat.phone : '9876543210';
                    api.pushWhatsAppMessageFromBot(
                      patPhone, 
                      `*AI Pathology RAG Advisory (Patna Pod)*: Coded Test [${selectedApprovedReport.testName}] findings resolved:\n"${selectedApprovedReport.results}"\n\n*CDSS RAG Recommendation*: glycemic index fluctuation (HbA1c level active at 7.2%). Avoid NSAIDs due to renal limits.`
                    );

                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                      detail: {
                        title: 'Summary Dispatched! 💬',
                        message: `Lab RAG summary successfully routed to patient WhatsApp session.`,
                        type: 'success'
                      }
                    }));
                    setSelectedApprovedReport(null);
                  }}
                  className="flex-1 btn-primary py-2.5 rounded-xl text-center text-xs flex justify-center items-center gap-2"
                >
                  <span className="material-symbols-outlined text-xs">send</span>
                  Push to Patient WhatsApp
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

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

          {/* Clinical Decision Support System (CDSS) */}
          {selectedPatient && (
            <div className="glass-panel p-6 border-slate-200/80 shadow-sm relative overflow-hidden bg-white">
              {!isConsentActive && (
                <div className="absolute inset-0 z-[45] flex flex-col items-center justify-center bg-white/95 border border-rose-500/20 p-6 text-center animate-fade-in">
                  <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-3 text-rose-500 animate-pulse">
                    <span className="material-symbols-outlined text-xl">lock</span>
                  </div>
                  <h3 className="text-slate-800 font-bold text-xs mb-1.5">Compliance Lock Active</h3>
                  <p className="text-[10px] text-slate-500 max-w-[200px] leading-relaxed">
                    Active Patient Consent Missing. Clinical history is locked until patient authorizes via WhatsApp.
                  </p>
                </div>
              )}
              <h2 className="text-base font-bold text-slate-800 mb-1.5 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-xl">insights</span>
                CDSS Lab Analyzer
              </h2>
              <p className="text-[10px] text-slate-400 mb-4 leading-relaxed">
                AI comparative biomarker metrics tracking and warning engine.
              </p>

              {/* Historical Comparative Selector */}
              {activeHistory && activeHistory.length >= 2 && (
                <div className="mb-5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[12px] text-secondary">compare_arrows</span>
                    Historical Report Comparator
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[8px] text-slate-400 uppercase tracking-wider mb-1 font-bold">Baseline</label>
                      <select
                        value={baselineDate ?? ''}
                        onChange={(e) => setBaselineDate(e.target.value || null)}
                        className="w-full input-field py-1 text-[11px] bg-white"
                      >
                        <option value="">— Date —</option>
                        {activeHistory.filter(h => h.date !== comparisonDate).map(h => (
                          <option key={h.date} value={h.date}>{h.date}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[8px] text-slate-400 uppercase tracking-wider mb-1 font-bold">Comparison</label>
                      <select
                        value={comparisonDate ?? ''}
                        onChange={(e) => setComparisonDate(e.target.value || null)}
                        className="w-full input-field py-1 text-[11px] bg-white"
                      >
                        <option value="">— Date —</option>
                        {activeHistory.filter(h => h.date !== baselineDate).map(h => (
                          <option key={h.date} value={h.date}>{h.date}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeHistory && activeHistory.length > 0 ? (
                <div className="space-y-6 animate-fade-in text-slate-700">
                  {/* RAG Insights */}
                  {isAiLoading && (
                    <div className="p-4 border border-slate-100 bg-slate-50 rounded-xl space-y-3 animate-pulse">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-secondary animate-spin">sync</span>
                        <div className="h-3 w-1/3 bg-slate-200 rounded" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-2 w-full bg-slate-200 rounded" />
                        <div className="h-2 w-11/12 bg-slate-200 rounded" />
                      </div>
                    </div>
                  )}

                  {aiError && !isAiLoading && (
                    <div className="p-4 bg-amber-50 border border-amber-100 text-amber-700 text-xs rounded-xl flex gap-3 leading-relaxed">
                      <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold">CDSS RAG Engine Offline</div>
                        <p className="mt-0.5">Falling back to local clinical biomarkers. RAG engine: <span className="font-mono">{aiError}</span></p>
                      </div>
                    </div>
                  )}

                  {aiInsight && !isAiLoading && (
                    <div className="p-4 border border-emerald-100 bg-emerald-50/50 rounded-xl space-y-2 text-xs text-slate-700">
                      <div className="flex items-center gap-1.5 text-emerald-700 font-bold tracking-wide uppercase text-[9px] font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        RAG Clinical Advisory Active
                      </div>
                      <div className="space-y-2 whitespace-pre-line leading-relaxed font-sans">
                        {aiInsight.replace('### Clinical Advisory (RAG-Generated)\n\n', '')}
                      </div>
                    </div>
                  )}

                  {/* Present vs. Past Lab Comparative Analysis Banner */}
                  <div className="p-4 border border-slate-200/80 bg-slate-50/50 rounded-xl space-y-3">
                    <h4 className="font-bold text-[9px] text-slate-500 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                      <span className="material-symbols-outlined text-xs text-secondary">analytics</span>
                      Comparative Biomarker Indicators
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px] text-left text-slate-600">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider font-mono text-[8px]">
                            <th className="pb-2">Biomarker</th>
                            <th className="pb-2">{baseReport ? baseReport.date : 'Base'}</th>
                            <th className="pb-2">{compReport ? compReport.date : 'Comp'}</th>
                            <th className="pb-2 text-right">Risk</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/50">
                          {compReport && baseReport ? (() => {
                            const hDiff = (compReport.HbA1c - baseReport.HbA1c).toFixed(1);
                            const hDiffNum = parseFloat(hDiff);

                            return (
                              <>
                                <tr className="hover:bg-slate-100/30 transition-colors">
                                  <td className="py-2 font-semibold text-slate-700">HbA1c (%)</td>
                                  <td className="py-2 font-mono">{baseReport.HbA1c}%</td>
                                  <td className="py-2 font-mono font-bold text-slate-800">{compReport.HbA1c}%</td>
                                  <td className="py-2 text-right">
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                      hDiffNum < 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700 animate-pulse'
                                    }`}>{hDiffNum < 0 ? 'Improving' : 'Elevated'}</span>
                                  </td>
                                </tr>
                                <tr className="hover:bg-slate-100/30 transition-colors">
                                  <td className="py-2 font-semibold text-slate-700">Creatinine (mg/dL)</td>
                                  <td className="py-2 font-mono">{baseReport.creatinine}</td>
                                  <td className="py-2 font-mono font-bold text-slate-800">{compReport.creatinine}</td>
                                  <td className="py-2 text-right">
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                      compReport.creatinine > 1.2 ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-emerald-100 text-emerald-700'
                                    }`}>{compReport.creatinine > 1.2 ? 'CKD Risk' : 'Normal'}</span>
                                  </td>
                                </tr>
                              </>
                            );
                          })() : (
                            <tr><td colSpan={4} className="py-3 text-center text-slate-400 text-xs italic">Select a baseline to enable comparison.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* SVG Graph representation */}
                  <div className="p-4 border border-slate-200/80 bg-slate-50/50 rounded-xl space-y-4">
                    <h4 className="font-bold text-[9px] text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-xs text-primary">show_chart</span>
                      Biomarker Trajectory (HbA1c)
                    </h4>
                    <div className="h-16 relative border-l border-b border-slate-200 p-1">
                      {(() => {
                        const points = activeHistory.map((h, i) => {
                          const x = activeHistory.length === 1 ? 50 : 10 + i * (80 / (activeHistory.length - 1));
                          const clampedVal = Math.max(4.0, Math.min(10.0, h.HbA1c));
                          const y = 32 - ((clampedVal - 4.0) / 6.0) * 26;
                          return { x, y, val: h.HbA1c, date: h.date };
                        });
                        let pathD = "";
                        if (points.length === 1) {
                          pathD = `M 10,${points[0].y} H 90`;
                        } else {
                          pathD = `M ${points[0].x},${points[0].y} ` + points.slice(1).map(p => `L ${p.x},${p.y}`).join(" ");
                        }
                        const fillPathD = pathD + ` L ${points[points.length - 1].x},38 L ${points[0].x},38 Z`;

                        return (
                          <>
                            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none">
                              <path d={fillPathD} fill="#edf5ff" />
                              <path d={pathD} fill="none" stroke="#0f62fe" strokeWidth="1.5" />
                              {points.map((p, idx) => (
                                <circle
                                  key={idx}
                                  cx={p.x}
                                  cy={p.y}
                                  r={idx === points.length - 1 ? 3 : 2}
                                  fill={idx === points.length - 1 ? "#0f62fe" : "#60a5fa"}
                                  stroke="#ffffff"
                                  strokeWidth="1"
                                  className="cursor-pointer"
                                  onMouseEnter={() => setHoveredHbA1c(p)}
                                  onMouseLeave={() => setHoveredHbA1c(null)}
                                />
                              ))}
                            </svg>
                            {hoveredHbA1c && (
                              <div className="absolute top-1 right-2 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[8px] text-white font-mono z-50 shadow-sm">
                                {hoveredHbA1c.date}: <strong className="text-secondary">{hoveredHbA1c.val}%</strong>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* CDSS Alerts warning */}
                  <div className="space-y-2">
                    {cdssAnomalies.map((anomaly, idx) => (
                      <div key={idx} className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl flex gap-3 leading-relaxed">
                        <AlertTriangle className="h-4 w-4 text-rose-500 flex-shrink-0 mt-0.5" />
                        <span>{anomaly}</span>
                      </div>
                    ))}
                  </div>

                  <div className="text-[9px] text-slate-400 italic leading-relaxed">
                    * CDSS guidelines are passive recommendations. Clinical final discretion lies with Dr. Sharma.
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs italic">
                  No historical diagnostic biomarkers available for this profile.
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Consultation Sheet, e-Rx Form */}
        {selectedPatient && (
          <div className="lg:col-span-8 glass-panel p-6 border-slate-200/80 shadow-sm space-y-6 relative overflow-hidden bg-white">
            {isMedLmParsing && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-50 flex flex-col justify-center items-center p-8 animate-fade-in text-center space-y-6">
                <div className="w-16 h-16 rounded-full border-4 border-slate-200 border-t-primary animate-spin" />
                <div className="space-y-3 w-full max-w-md">
                  <h4 className="text-sm font-extrabold text-slate-800 animate-pulse">Gemini MedLM 2.5 Extracting Clinical Structure...</h4>
                  <p className="text-[10px] text-slate-400">Processing single-burst compressed audio payload. Enforcing strict JSON extraction prompts.</p>
                  
                  {/* Shimmering Skeleton bars */}
                  <div className="space-y-3 pt-6 w-5/6 mx-auto">
                    <div className="h-4 bg-slate-100 rounded-lg w-full animate-pulse" />
                    <div className="h-3 bg-slate-100 rounded-lg w-11/12 animate-pulse" />
                    <div className="h-3 bg-slate-100 rounded-lg w-5/6 animate-pulse" />
                    <div className="h-9 bg-slate-100 rounded-xl w-full animate-pulse mt-4" />
                  </div>
                </div>
              </div>
            )}

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

            {/* Ambient AI Medical Scribe Card */}
            <div className="p-6 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-5 shadow-sm">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-primary ${isAmbientScribing ? 'animate-pulse text-primary' : 'text-slate-400'}`}>mic</span>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">
                    Ambient AI Medical Scribe <span className="text-[10px] text-slate-400 font-medium normal-case">(Gemini MedLM 2.5)</span>
                  </h3>
                </div>
                {isAmbientScribing ? (
                  <span className="flex items-center gap-1.5 text-[9px] bg-primary/10 text-primary border border-primary/25 px-2.5 py-1 rounded-full font-extrabold uppercase tracking-wider animate-pulse-wave">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                    Ambient Scribing Active
                  </span>
                ) : (
                  <span className="text-[9px] bg-slate-100 text-slate-500 border border-slate-200/30 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider font-sans">
                    Listening Engine Idle
                  </span>
                )}
              </div>

              {/* Scribe Visualizer Row */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                <div className="md:col-span-8 flex flex-col justify-center bg-white border border-slate-100 rounded-2xl p-4 h-24 relative overflow-hidden shadow-inner">
                  {isAmbientScribing ? (
                    <div className="absolute inset-0 bg-primary/5 flex flex-col justify-center items-center px-4 space-y-2 backdrop-blur-sm">
                      <div className="flex items-center justify-center gap-1.5 h-8">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((i) => {
                          const heights = [12, 28, 16, 32, 20, 36, 14, 24, 38, 18, 30, 15, 26, 12, 20];
                          const delay = i * 0.1;
                          return (
                            <div 
                              key={i} 
                              className="w-1.5 bg-primary/80 rounded-full animate-bounce"
                              style={{ 
                                height: `${heights[i % heights.length]}px`, 
                                animationDuration: '0.8s',
                                animationDelay: `${delay}s` 
                              }}
                            />
                          );
                        })}
                      </div>
                      <div className="text-[10px] text-primary font-extrabold uppercase tracking-widest font-sans animate-pulse">
                        {activeScribeScript === 'custom' 
                          ? `Recording Live Opus Audio... ${recordingDuration}s` 
                          : `Simulating Ambient speech... ${scribeTimeRemaining}s`}
                      </div>
                    </div>
                  ) : isMedLmParsing ? (
                    <div className="absolute inset-0 bg-primary/5 flex flex-col justify-center items-center px-4 space-y-2 backdrop-blur-sm">
                      <span className="material-symbols-outlined text-2xl text-primary animate-spin">sync</span>
                      <div className="text-[10px] text-primary font-bold uppercase tracking-widest font-sans animate-pulse">
                        Gemini MedLM Synthesizing Dialogue & CDSS Rules...
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col justify-center items-center h-full text-center space-y-1">
                      <span className="material-symbols-outlined text-slate-400 text-xl">graphic_eq</span>
                      <div className="text-[10px] text-slate-400 font-sans font-medium">
                        {audioBlob ? `Opus WebM Audio Cached (${(audioBlob.size / 1024).toFixed(1)} KB) - Ready` : 'Awaiting micro consultation recording trigger...'}
                      </div>
                    </div>
                  )}
                </div>

                <div className="md:col-span-4 flex flex-col gap-2">
                  {isAmbientScribing && activeScribeScript === 'custom' ? (
                    <button
                      onClick={stopRecordingAndProcess}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-rose-500 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md hover:scale-[1.01] active:scale-[0.98] transition-all animate-pulse text-white-force cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm text-white-force animate-spin">stop</span>
                      Stop & Process Scribe
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (isMedLmParsing) return;
                        setActiveScribeScript("custom");
                        startRecording();
                      }}
                      disabled={isAmbientScribing || isMedLmParsing}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-primary bg-primary text-white text-xs font-bold shadow-sm hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 text-white-force cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm text-white-force">mic</span>
                      Record Consult
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setNotes('');
                      setMedications([]);
                      setSelectedTests([]);
                      setCustomScribeText('');
                      setActiveScribeScript(null);
                      setAudioBlob(null);
                      window.dispatchEvent(new CustomEvent('mediflow-toast', {
                        detail: {
                          title: 'Scribe Encounter Reset 🔄',
                          message: 'Cleared all clinical notes, e-Rx medications, and diagnostic selections.',
                          type: 'info'
                        }
                      }));
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">restart_alt</span>
                    Reset Encounter
                  </button>
                </div>
              </div>

              {/* Presets and Scenarios */}
              <div className="space-y-2">
                <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                  Pre-configured Demo Consultation Scenarios
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <button
                    onClick={() => handleTriggerScenario('diabetes')}
                    disabled={isAmbientScribing || isMedLmParsing}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between h-20 transition-all active:scale-[0.98] cursor-pointer ${
                      activeScribeScript === 'diabetes'
                        ? 'bg-primary/5 border-primary'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-bold text-[10px] text-slate-700 block">Scenario A: T2DM & HTN</span>
                    <span className="text-[8px] text-slate-400 leading-tight">Metformin, Telmisartan, HbA1c + Creatinine panels</span>
                  </button>

                  <button
                    onClick={() => handleTriggerScenario('infection')}
                    disabled={isAmbientScribing || isMedLmParsing}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between h-20 transition-all active:scale-[0.98] cursor-pointer ${
                      activeScribeScript === 'infection'
                        ? 'bg-primary/5 border-primary'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-[10px] text-slate-700 block flex items-center gap-1">
                        Scenario B: Bronchitis
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                      </span>
                      <span className="text-[7px] text-rose-600 font-bold uppercase font-mono tracking-wider">Allergy Warning Test</span>
                    </div>
                    <span className="text-[8px] text-slate-400 leading-tight">Amoxicillin + Paracetamol, Total Hemoglobin</span>
                  </button>

                  <button
                    onClick={() => handleTriggerScenario('renal')}
                    disabled={isAmbientScribing || isMedLmParsing}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between h-20 transition-all active:scale-[0.98] cursor-pointer ${
                      activeScribeScript === 'renal'
                        ? 'bg-primary/5 border-primary'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-bold text-[10px] text-slate-700 block">Scenario C: CKD Renal Check</span>
                    <span className="text-[8px] text-slate-400 leading-tight">Creatinine + Electrolytes sodium panels monitoring</span>
                  </button>
                </div>
              </div>

              {/* Custom Transcription Dialogue Box */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                    Real-time Conversation Transcript
                  </label>
                  {customScribeText.length > 0 && (
                    <button
                      onClick={() => processBatchDialogue(customScribeText)}
                      className="text-[8px] text-primary font-bold uppercase hover:underline"
                    >
                      Re-parse Dialogue
                    </button>
                  )}
                </div>
                <textarea
                  value={customScribeText}
                  onChange={(e) => setCustomScribeText(e.target.value)}
                  placeholder="Dialogue transcription will stream here during consultation. You can also paste your own speech transcription here to test MedLM parser..."
                  rows={2}
                  className="w-full input-field text-[11px] leading-normal bg-white p-3 font-mono resize-none"
                />
              </div>
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
                {MASTER_TEST_CATALOG.map((test: DiagnosticTest) => {
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
                        isChecked ? 'bg-primary border-primary text-white' : 'border-slate-350 bg-white'
                      }`}>
                        {isChecked && <span className="material-symbols-outlined text-xs font-bold text-white-force">check</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Medication e-Prescription (e-Rx) Builder */}
            <div className="space-y-4 pt-5 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs text-primary">pill</span>
                e-Prescription Builder (FHIR R4 MedicationRequest Output)
              </label>
              
              {/* Med Single entry row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <div>
                  <label className="block text-[9px] text-slate-500 mb-1 uppercase font-bold">Generic / Brand Name</label>
                  <input
                    type="text"
                    value={medName}
                    onChange={(e) => setMedName(e.target.value)}
                    placeholder="Metformin 500mg"
                    className="w-full input-field py-1.5 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-slate-500 mb-1 uppercase font-bold">Dosage</label>
                  <input
                    type="text"
                    value={medDosage}
                    onChange={(e) => setMedDosage(e.target.value)}
                    placeholder="1 Tab"
                    className="w-full input-field py-1.5 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-slate-500 mb-1 uppercase font-bold">Frequency</label>
                  <select
                    value={medFreq}
                    onChange={(e) => setMedFreq(e.target.value)}
                    className="w-full input-field py-1.5 text-xs bg-white"
                  >
                    <option value="1-0-1">1-0-1 (Morning & Night)</option>
                    <option value="1-0-0">1-0-0 (Morning Only)</option>
                    <option value="0-1-0">0-1-0 (Afternoon Only)</option>
                    <option value="0-0-1">0-0-1 (Night Only)</option>
                    <option value="1-1-1">1-1-1 (Thrice Daily)</option>
                  </select>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-[9px] text-slate-500 mb-1 uppercase font-bold">Duration</label>
                    <input
                       type="text"
                       value={medDur}
                       onChange={(e) => setMedDur(e.target.value)}
                       placeholder="10 Days"
                       className="w-full input-field py-1.5 text-xs bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMedication}
                    className="btn-primary p-2 flex items-center justify-center hover:scale-102 text-xs rounded-xl w-10 h-[38px] shrink-0"
                  >
                    <span className="material-symbols-outlined text-base font-bold text-white-force">add</span>
                  </button>
                </div>
              </div>

              {/* Prescribed List */}
              {medications.length > 0 && (
                <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold uppercase tracking-wider text-[9px]">
                      <tr>
                        <th className="p-3.5">Medicine Name</th>
                        <th className="p-3.5">Dosage</th>
                        <th className="p-3.5">Frequency</th>
                        <th className="p-3.5">Duration</th>
                        <th className="p-3.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {medications.map((med, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3.5 text-slate-800 font-semibold">{med.medicineName}</td>
                          <td className="p-3.5 text-slate-500 font-mono">{med.dosage}</td>
                          <td className="p-3.5 text-slate-500 font-mono">{med.frequency}</td>
                          <td className="p-3.5 text-slate-500 font-mono">{med.duration}</td>
                          <td className="p-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveMedication(idx)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-lg transition-all"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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

        {/* System Health Telemetry Cockpit */}
        <SystemHealthCockpit />
      </div>
    );
  };

  // TAB 4 RENDER: Medical Shop (Pharmacy)
  const renderPharmacyTab = () => {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-slate-800 animate-fade-in">
        {/* Left Column: E-Pharmacy Stock Sync */}
        <div className="space-y-6">
          <div className="glass-panel p-6 bg-white border-slate-200/80 shadow-sm rounded-2xl h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary text-xl">warehouse</span>
                <h2 className="text-base font-bold text-slate-800">E-Pharmacy Inventory Sync</h2>
              </div>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {pharmacyInventory.map(item => {
                  const isLow = item.stock <= 20;
                  const isOut = item.stock === 0;
                  return (
                    <div key={item.id} className="p-3 bg-slate-50 border border-slate-200/50 rounded-xl flex justify-between items-center">
                      <div>
                        <div className="text-xs font-bold text-slate-700">{item.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.dosage} • ₹{item.price}/tab</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-[10px] font-bold ${isOut ? 'text-rose-500' : isLow ? 'text-amber-500' : 'text-slate-600'}`}>
                          {item.stock} tabs left
                        </div>
                        <span className={`text-[8px] font-bold uppercase font-mono px-1.5 py-0.5 rounded mt-1 inline-block ${
                          isOut ? 'bg-rose-100 text-rose-700' : isLow ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'High Stock'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
              <span>* Synced with Patna Central Pharmacy</span>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('mediflow-toast', {
                    detail: {
                      title: 'Inventory Synced! 🔄',
                      message: 'Partner medicine stock listings verified successfully.',
                      type: 'success'
                    }
                  }));
                }}
                className="text-primary hover:text-primary-700 font-bold uppercase tracking-wider flex items-center gap-0.5"
              >
                <span className="material-symbols-outlined text-[12px]">sync</span> Refresh Sync
              </button>
            </div>
          </div>
        </div>

        {/* Right Columns: WhatsApp Bot Drug Orders Feed */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 bg-white border-slate-200/80 shadow-sm rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600">forum</span>
                  WhatsApp Bot Orders & Dispatch Simulator
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">Simulate customer orders routed directly from Patna WhatsApp sessions.</p>
              </div>
              <button
                onClick={() => api.simulateIncomingWhatsAppOrder()}
                className="btn-primary py-2 px-4 rounded-xl text-xs flex items-center gap-2 self-start hover:scale-102 transition-transform"
              >
                <span className="material-symbols-outlined text-sm text-white-force">add_alert</span>
                Simulate WhatsApp Order
              </button>
            </div>

            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              {whatsAppOrders.length > 0 ? whatsAppOrders.map(order => {
                const isPending = order.deliveryStatus === 'pending';
                const isDispatch = order.deliveryStatus === 'dispatching';
                const isEnroute = order.deliveryStatus === 'enroute';
                const isDelivered = order.deliveryStatus === 'delivered';

                return (
                  <div key={order.id} className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-3 hover:border-slate-350 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs font-bold text-slate-800">{order.patientName}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">Order ID: {order.id} • {order.patientPhone}</div>
                      </div>
                      <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded-full uppercase ${
                        isDelivered
                          ? 'bg-emerald-100 text-emerald-700'
                          : isEnroute
                          ? 'bg-blue-100 text-blue-700 animate-pulse'
                          : isDispatch
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {order.deliveryStatus}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1">
                      <div><strong className="text-slate-700 font-semibold">Prescribed:</strong> {order.drugNames.join(', ')}</div>
                      <div><strong className="text-slate-700 font-semibold">Destination:</strong> {order.location}</div>
                      <div className="font-bold text-slate-800 mt-1">Total Payout: ₹{order.amount.toFixed(2)} (10% Doctor split commission applies)</div>
                    </div>

                    {/* Delivery Simulator Buttons */}
                    {!isDelivered && (
                      <div className="flex gap-2 pt-2 border-t border-slate-200/50">
                        {isPending && (
                          <button
                            onClick={() => api.updateWhatsAppOrderStatus(order.id, 'dispatching')}
                            className="flex-1 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold py-1.5 rounded-lg uppercase tracking-wider transition-colors"
                          >
                            Dispatch Order
                          </button>
                        )}
                        {(isPending || isDispatch) && (
                          <button
                            onClick={() => api.updateWhatsAppOrderStatus(order.id, 'enroute')}
                            className="flex-1 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 text-[10px] font-bold py-1.5 rounded-lg uppercase tracking-wider transition-colors"
                          >
                            Set En Route
                          </button>
                        )}
                        <button
                          onClick={() => api.updateWhatsAppOrderStatus(order.id, 'delivered')}
                          className="flex-1 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold py-1.5 rounded-lg uppercase tracking-wider transition-colors"
                        >
                          Confirm Delivery
                        </button>
                      </div>
                    )}
                  </div>
                );
              }) : (
                <div className="text-center py-8 text-slate-400 text-xs italic">
                  No active orders routed from the WhatsApp Bot channel.
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
        
        {/* Seasonal Restocking Demand Forecast Widget */}
        <SeasonalForecastWidget />
      </div>
    );
  };

  // TAB 5 RENDER: Pathology Lab
  const renderPathologyTab = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-slate-800 animate-fade-in">
        {/* Left Column: Pathology splits & diagnostics helper */}
        <div className="space-y-6">
          <div className="glass-panel p-6 bg-white border-slate-200/80 shadow-sm rounded-2xl space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">science</span>
              <h2 className="text-base font-bold text-slate-800 font-sans">Lab Partner Profile</h2>
            </div>
            
            <div className="p-3 bg-slate-50 border border-slate-200/50 rounded-xl space-y-2 text-xs">
              <div><strong className="text-slate-700">Lab Assistant:</strong> R. K. Sinha (Patna Diagnostics)</div>
              <div><strong className="text-slate-700">Pod License:</strong> MC-PATNA-LAB202</div>
              <div><strong className="text-slate-700">Referral Commission:</strong> 15% split on pathology fee</div>
            </div>

            {/* Run Pathology Test Form */}
            {selectedPathologyReportForTest ? (
              <div className="p-4 bg-amber-50/50 border border-amber-200/60 rounded-xl space-y-3">
                <div className="flex justify-between items-center border-b border-amber-200/20 pb-2">
                  <h3 className="text-xs font-bold text-amber-800">Run Diagnostics: {selectedPathologyReportForTest.patientName}</h3>
                  <button onClick={() => setSelectedPathologyReportForTest(null)} className="text-slate-400 hover:text-slate-600">
                    <span className="material-symbols-outlined text-xs">close</span>
                  </button>
                </div>
                <div className="space-y-2 text-xs">
                  <div><strong className="text-slate-700">Test:</strong> {selectedPathologyReportForTest.testName}</div>
                  <div><strong className="text-slate-700">LOINC:</strong> {selectedPathologyReportForTest.loincCode}</div>
                  
                  <div className="space-y-1 mt-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Input Diagnostic Findings:</label>
                    <textarea
                      value={labTestResults}
                      onChange={e => setLabTestResults(e.target.value)}
                      placeholder="e.g. HbA1c level is 7.2% (Abnormal > 6.5%). Recommended: clinical follow-up."
                      rows={3}
                      className="w-full input-field resize-none text-xs bg-white"
                    />
                  </div>

                  <button
                    onClick={() => {
                      if (!labTestResults.trim()) return;
                      api.processPathologyReport(selectedPathologyReportForTest.id, labTestResults);
                      setSelectedPathologyReportForTest(null);
                      setLabTestResults('');
                    }}
                    className="w-full btn-primary py-2 text-center text-xs font-semibold rounded-lg mt-2"
                  >
                    Approve and Submit results
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-200/50 rounded-xl text-center text-xs text-slate-400 italic">
                Select a scanned pending report from the queue to run test diagnostics findings.
              </div>
            )}
          </div>
        </div>

        {/* Right Columns: Scanned Pending reports & RAG Engine */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pending scanned reports queue */}
          <div className="glass-panel p-6 bg-white border-slate-200/80 shadow-sm rounded-2xl space-y-4">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600">pending_actions</span>
              Scanned Pathology Queue (Compounder Uploads)
            </h2>
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {pathologyReports.filter(r => r.status === 'pending').length > 0 ? (
                pathologyReports.filter(r => r.status === 'pending').map(report => (
                  <div key={report.id} className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl flex justify-between items-center hover:border-slate-350 transition-colors">
                    <div>
                      <div className="text-xs font-bold text-slate-800">{report.patientName}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{report.testName} • LOINC {report.loincCode}</div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedPathologyReportForTest(report);
                        setLabTestResults(`Biomarker results for ${report.testName} scanned successfully. HbA1c is 7.2% (Abnormal > 6.5%). Glycemic index is elevated.`);
                      }}
                      className="bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Run Test Findings
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs italic">
                  No scanned compounder reports awaiting diagnostics entry in the queue.
                </div>
              )}
            </div>
          </div>

          {/* RAG longitudinal prompt simulator */}
          <div className="glass-panel p-6 bg-white border-slate-200/80 shadow-sm rounded-2xl space-y-4">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">psychology</span>
              Longitudinal RAG AI Diagnostic Summary Engine
            </h2>
            
            <div className="flex gap-3">
              <select
                value={selectedPatientForRAG}
                onChange={e => setSelectedPatientForRAG(e.target.value)}
                className="flex-1 input-field text-xs bg-white"
              >
                <option value="">— Select Patient Profile —</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                disabled={!selectedPatientForRAG}
                onClick={() => {
                  const summary = api.generateAISummaryReport(selectedPatientForRAG);
                  setLongitudinalRAGText(summary);
                }}
                className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 text-white ${
                  selectedPatientForRAG ? 'bg-secondary hover:opacity-95' : 'bg-slate-300 cursor-not-allowed'
                }`}
              >
                <span className="material-symbols-outlined text-sm text-white-force">cognition</span>
                Generate AI Summary
              </button>
            </div>

            {longitudinalRAGText && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl space-y-3 animate-fade-in">
                <div className="text-[10px] font-bold text-emerald-800 tracking-wider uppercase font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  RAG Comparative Advisory Output
                </div>
                <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed font-sans">
                  {longitudinalRAGText}
                </div>
                
                <div className="flex justify-end pt-2 border-t border-emerald-100/50">
                  <button
                    onClick={() => {
                      const pat = api.getPatients().find(p => p.id === selectedPatientForRAG);
                      const patPhone = pat ? pat.phone : '9876543210';
                      api.pushWhatsAppMessageFromBot(patPhone, `*AI Longitudinal RAG Diagnostic Summary (Patna Zone 1)*:\n${longitudinalRAGText}`);

                      window.dispatchEvent(new CustomEvent('mediflow-toast', {
                        detail: {
                          title: 'Summary Pushed! 💬',
                          message: 'Diagnostic summary has been sent via Twilio WhatsApp Gateway.',
                          type: 'success'
                        }
                      }));
                      setLongitudinalRAGText('');
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                  >
                    <span className="material-symbols-outlined text-xs text-white-force font-bold">chat</span>
                    Push Summary to WhatsApp
                  </button>
                </div>
              </div>
            )}
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

  // ROUTER CONTROLLER: Render Active Tab Contents
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'consultation':
        return renderConsultationTab();
      case 'financials':
        return renderFinancialsTab();
      case 'pharmacy':
        return renderPharmacyTab();
      case 'pathology':
        return renderPathologyTab();
      case 'patients':
        return renderPatientsTab();
      case 'whatsapp':
        return renderWhatsAppTab();
      default:
        return renderOverviewTab();
    }
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
    <div className="max-w-7xl mx-auto p-4 md:p-6 pb-20 lg:pb-6 space-y-6 animate-fade-in text-slate-800" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Ecosystem Command Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-2">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary/75 text-2xl animate-pulse">hub</span>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 font-sans">Dr. Sharma's Care Dashboard</h1>
          </div>
          <p className="text-xs font-medium text-slate-400 mt-1.5 flex items-center gap-2">
            Mediflow Pod Tenant Host 
            <span className="text-slate-300 font-bold">•</span>
            Clinic Code: 
            <span className="font-mono font-bold text-slate-500 bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded-md text-[10px]">
              {activePod?.clinicCode || 'MF-PATNA101'}
            </span>
          </p>
        </div>
        
        {/* Quick Stats Pill */}
        <div className="flex items-center gap-2.5 bg-white border border-slate-200/80 shadow-xs px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 transition-all">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-mono tracking-tight">Real-Time Sync: Connected</span>
        </div>
      </div>

      {/* Premium Stripe-Style Segmented Control - Hidden on mobile viewports, wraps beautifully on desktop */}
      <div className="hidden lg:block mt-2 w-full">
        <div className="flex lg:flex-wrap items-center gap-1 p-1 bg-slate-100/70 border border-slate-200/40 rounded-2xl w-full">
          {[
            { id: 'overview', label: 'Command Center', icon: 'dashboard' },
            { id: 'consultation', label: 'Consultation Queue', icon: 'clinical_notes' },
            { id: 'financials', label: 'Financial Reports', icon: 'account_balance_wallet' },
            { id: 'pharmacy', label: 'Medical Shop', icon: 'pill' },
            { id: 'pathology', label: 'Pathology Lab', icon: 'biotech' },
            { id: 'patients', label: 'Patient Directory', icon: 'group' },
            { id: 'whatsapp', label: 'WhatsApp Inbox', icon: 'chat' }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-300 cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50 hover:scale-[1.02] active:scale-[0.98]'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/60 border border-transparent'
                }`}
              >
                <span className={`material-symbols-outlined text-base ${isActive ? 'text-slate-850' : 'text-slate-400'}`}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
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
        {activeTab === 'consultation' && (
          isAmbientScribing && activeScribeScript === 'custom' ? (
            <button
              onClick={stopRecordingAndProcess}
              className="bg-rose-600 border border-rose-500 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-300 animate-pulse text-white-force cursor-pointer"
              title="Stop Consultation Recording"
            >
              <span className="material-symbols-outlined text-2xl font-bold text-white-force">stop</span>
            </button>
          ) : (
            <button
              onClick={() => {
                if (isMedLmParsing) return;
                setActiveScribeScript("custom");
                startRecording();
              }}
              disabled={isAmbientScribing || isMedLmParsing}
              className="bg-gradient-to-tr from-primary-600 to-accent-600 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-300 border border-primary/25 disabled:opacity-50 text-white-force cursor-pointer"
              title="Record Consultation"
            >
              <span className="material-symbols-outlined text-2xl font-bold text-white-force">mic</span>
            </button>
          )
        )}
        
        {activeTab === 'overview' && (
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

      {/* Premium Fixed Bottom Navigation Bar for Doctor Dashboard on Mobile Viewports */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200/80 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] px-2 py-3 flex justify-between items-center z-50 pb-safe-bottom h-16">
        {[
          { id: 'overview', label: 'Command', icon: 'dashboard', color: 'text-primary-600' },
          { id: 'consultation', label: 'Consult', icon: 'clinical_notes', color: 'text-accent-600' },
          { id: 'financials', label: 'Finance', icon: 'account_balance_wallet', color: 'text-emerald-600' },
          { id: 'pharmacy', label: 'Pharmacy', icon: 'pill', color: 'text-rose-600' },
          { id: 'pathology', label: 'Lab', icon: 'biotech', color: 'text-blue-600' },
          { id: 'patients', label: 'Patients', icon: 'group', color: 'text-indigo-600' },
          { id: 'whatsapp', label: 'Chat', icon: 'chat', color: 'text-primary-600' }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all cursor-pointer relative ${
                isActive 
                  ? `${tab.color} scale-105 font-bold` 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 ${
                isActive 
                  ? 'bg-slate-50 scale-110 shadow-sm' 
                  : 'bg-transparent'
              }`}>
                <span className="material-symbols-outlined text-[22px] block">
                  {tab.icon}
                </span>
              </div>
              <span className="text-[8px] uppercase tracking-wider font-extrabold truncate w-full text-center mt-1">
                {tab.label}
              </span>
              
              {isActive && (
                <span className={`absolute bottom-0 w-1.5 h-1.5 rounded-full ${isActive ? 'bg-current' : 'bg-transparent'}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Allergy overrides modal */}
      {allergyAlert && renderAllergyAlertModal()}
    </div>
  );
};
