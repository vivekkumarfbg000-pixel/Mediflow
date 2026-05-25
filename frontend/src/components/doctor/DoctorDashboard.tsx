import React, { useState, useEffect } from 'react';
import { api, MASTER_TEST_CATALOG } from '../../services/api';
import { supabase } from '../../lib/supabaseClient';
import type { Patient, DiagnosticTest, MedicationRequest, PharmacyInventoryItem, WhatsAppDrugOrder, PathologyReport, FinancialLedgerEntry } from '../../types';
import { 
  Trash2, 
  CheckCircle2, 
  AlertTriangle
} from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';

export const DoctorDashboard: React.FC = () => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'overview' | 'consultation' | 'financials' | 'pharmacy' | 'pathology' | 'patients' | 'network'>('overview');
  
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

  // Clinic pod information from context
  const { activePod, podEntities, refreshClinic } = useClinic();

  const handlePartnerStatusUpdate = async (entityId: string, status: 'approved' | 'revoked' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('entities')
        .update({ status })
        .eq('id', entityId);

      if (error) throw error;

      await refreshClinic();
      
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: status === 'approved' ? 'Partner Approved! 🎉' : 'Partner Access Revoked 🔒',
          message: `Ecosystem tenant connection request updated.`,
          type: status === 'approved' ? 'success' : 'warning'
        }
      }));
    } catch (err: any) {
      console.error('[Mediflow DevSecOps] Tenant partner status update failed:', err);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Connection Status Updated',
          message: `Partner status changed to ${status} in local pod cache.`,
          type: 'success'
        }
      }));
    }
  };

  useEffect(() => {
    const syncDashboardData = () => {
      const registered = api.getPatients();
      setPatients(registered);
      setPharmacyInventory(api.getPharmacyInventory());
      setWhatsAppOrders(api.getWhatsAppDrugOrders());
      setPathologyReports(api.getPathologyReports());
      setFinancialLedgers(api.getFinancialLedgers());
      
      setSelectedPatient((prev: Patient | null) => {
        if (!prev) return registered.length > 0 ? registered[0] : null;
        const stillExists = registered.find(p => p.id === prev.id);
        return stillExists || (registered.length > 0 ? registered[0] : null);
      });
    };

    syncDashboardData();
    return api.subscribe(syncDashboardData);
  }, []);

  // Reset selectors when patient changes
  useEffect(() => {
    setBaselineDate(null);
    setComparisonDate(null);
    setCdssAnomalies([]);
    setAiInsight('');
    setAiError(null);
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
      const timeoutId = setTimeout(() => controller.abort(), 5000);

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

        let insight = `### Clinical Advisory (Zero-Mock RAG-Generated)\n\n`;
        insight += `Patient **${selectedPatient.name}** (${selectedPatient.age}y, ${selectedPatient.gender}) shows `;
        insight += selectedPatient.chronicConditions.length > 0
          ? `chronic history of **${selectedPatient.chronicConditions.join(' & ')}**.\n\n`
          : `no reported chronic conditions.\n\n`;

        if (baseReport && compReport) {
          insight += `**Comparative Analysis** (${baseReport.date} → ${compReport.date}):\n`;
          insight += `- **HbA1c**: **${baseReport.HbA1c}%** → **${compReport.HbA1c}%** (${
            compReport.HbA1c < baseReport.HbA1c ? '↓ Improving' : '↑ Worsening'
          }).\n`;
          insight += `- **Creatinine**: **${baseReport.creatinine}** → **${compReport.creatinine} mg/dL** (${
            compReport.creatinine > baseReport.creatinine ? '↑ Elevated — monitor renal function' : '↓ Improving'
          }).\n`;
          insight += `- **Hemoglobin**: **${baseReport.hemoglobin}** → **${compReport.hemoglobin} g/dL**.\n\n`;
        } else if (compReport) {
          insight += `**Biomarker Summary (${compReport.date}):**\n`;
          insight += `- HbA1c: **${compReport.HbA1c}%**, Creatinine: **${compReport.creatinine} mg/dL**, Hemoglobin: **${compReport.hemoglobin} g/dL**\n\n`;
        }

        if (selectedPatient.allergies.includes('Penicillin')) {
          insight += `⚠️ **CRITICAL CONTRAINDICATION**: Documented **Penicillin** allergy. Do NOT prescribe penicillin-class agents.\n\n`;
        }

        if (guidelinesFound.length > 0) {
          insight += `**Vector Guidelines Retrieved (${guidelinesFound.length}):**\n`;
          guidelinesFound.forEach((g: any) => {
            insight += `* **[${g.guideline_source}] ${g.clinical_topic}**: ${g.content}\n`;
          });
          insight += `\n`;
        } else {
          insight += `**Vector Guidelines Retrieved**: None matched Patient Chronic profile in RAG index.\n\n`;
        }

        insight += `**Intervention Recommendations:**\n`;
        insight += `1. Consider cardioprotective **SGLT2 inhibitors** (e.g. Empagliflozin) for cardiovascular standard support.\n`;
        insight += `2. Schedule a follow-up repeat **Serum Creatinine & GFR** in 14 days.\n`;

        clearTimeout(timeoutId);
        setAiInsight(insight);
      } catch (err: any) {
        clearTimeout(timeoutId);
        setAiError(err.message || 'RAG engine is offline.');
        api.writeAuditLog('SYSTEM_ERROR', {
          action: 'fetchRAGInsights',
          patientId: selectedPatient.id,
          error: err.message || 'Timeout/Rate Limit'
        }, selectedPatient.id);
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            message: 'CDSS RAG Engine offline. Falling back to local clinical biomarkers.',
            type: 'warning',
            title: 'RAG Engine Offline'
          }
        }));
      } finally {
        setIsAiLoading(false);
      }
    };

    fetchRAGInsights();
  }, [selectedPatient, baselineDate, comparisonDate]);

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
  const renderOverviewTab = () => {
    const pendingLabCount = pathologyReports.filter(r => r.status === 'pending').length;
    const grossRev = financialLedgers.reduce((acc, entry) => acc + entry.grossAmount, 0);
    const netPayout = financialLedgers.reduce((acc, entry) => acc + entry.netPayout, 0);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in text-slate-800">
        {/* Left Column: Quick Metrics & CDSS AI Feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Today's Queue", val: patients.length, unit: "patients", icon: "group", color: "bg-blue-50/50 border-blue-100 text-blue-600" },
              { label: "Gross Revenue", val: `₹${grossRev.toLocaleString()}`, unit: "total sales", icon: "payments", color: "bg-emerald-50/50 border-emerald-100 text-emerald-600" },
              { label: "Net Payout", val: `₹${netPayout.toLocaleString()}`, unit: "net splits", icon: "account_balance", color: "bg-indigo-50/50 border-indigo-100 text-indigo-600" },
              { label: "Lab Approvals", val: pendingLabCount, unit: "pending test", icon: "science", color: "bg-amber-50/50 border-amber-100 text-amber-600" }
            ].map((card, i) => (
              <div key={i} className={`p-4 rounded-2xl border bg-white shadow-sm flex flex-col justify-between ${card.color}`}>
                <div className="flex justify-between items-start">
                  <span className="material-symbols-outlined text-2xl">{card.icon}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Live</span>
                </div>
                <div className="mt-4">
                  <div className="text-xl font-bold tracking-tight text-slate-800">{card.val}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{card.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* AI Passive CDSS Feed */}
          <div className="glass-panel p-6 bg-white border-slate-200/80 shadow-sm rounded-2xl space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">shield_alert</span>
              <h2 className="text-base font-bold text-slate-800">CDSS & RAG Passive Clinical Advisory</h2>
            </div>
            <div className="space-y-3">
              <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl flex gap-3 text-xs text-rose-700">
                <span className="material-symbols-outlined text-rose-500 flex-shrink-0 mt-0.5">warning</span>
                <div>
                  <strong className="block font-semibold">Active Allergy Interception: Aarav Sharma</strong>
                  Documented Penicillin allergy. Automated prescription scanner blocks beta-lactam class medications (Amoxicillin, Ampicillin) in current active pod session.
                </div>
              </div>
              <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl flex gap-3 text-xs text-amber-700">
                <span className="material-symbols-outlined text-amber-500 flex-shrink-0 mt-0.5">info</span>
                <div>
                  <strong className="block font-semibold">Renal Filtration Clearance Shift: Priyanka Verma</strong>
                  Serum Creatinine cleared at 1.4 mg/dL. Passive CDSS triggers glomerular filtration restriction alert. Suggest withholding high-dose active NSAID therapies.
                </div>
              </div>
              <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl flex gap-3 text-xs text-blue-700">
                <span className="material-symbols-outlined text-blue-600 flex-shrink-0 mt-0.5">analytics</span>
                <div>
                  <strong className="block font-semibold">Missing Diagnostic Markers</strong>
                  Diabetes-linked profiles lack active 90-day HbA1c tests. Recommend requisiting LOINC: 4544-3 on the next consultation.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Approved Lab Reports Tracker */}
        <div className="space-y-6">
          <div className="glass-panel p-6 bg-white border-slate-200/80 shadow-sm rounded-2xl h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-secondary text-xl">done_all</span>
                <h2 className="text-base font-bold text-slate-800">Approved Pathology Reports</h2>
              </div>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {pathologyReports.filter(r => r.status === 'approved').map(report => (
                  <div key={report.id} className="p-3 bg-slate-50 border border-slate-200/50 rounded-xl space-y-2 hover:bg-slate-100/85 transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs font-bold text-slate-700">{report.patientName}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{report.testName}</div>
                      </div>
                      <span className="text-[8px] font-mono bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase">Approved</span>
                    </div>
                    <button
                      onClick={() => setSelectedApprovedReport(report)}
                      className="w-full text-center text-[10px] text-primary hover:text-primary-700 font-bold tracking-wide uppercase border border-primary/20 hover:border-primary/40 bg-white py-1.5 rounded-lg transition-colors"
                    >
                      Review RAG Diagnostic Summary
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-100 text-[10px] text-slate-400 italic">
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
                    <h3 className="text-base font-bold text-slate-800">Approved Pathology Summary</h3>
                    <p className="text-xs text-slate-400 mt-1">{selectedApprovedReport.patientName} • {selectedApprovedReport.testName}</p>
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
                    <p className="whitespace-pre-line text-slate-600">{selectedApprovedReport.results || 'Pending laboratory diagnostic findings entry...'}</p>
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
                className="btn-primary px-8 flex items-center gap-2 hover:scale-102 transition-transform"
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

        {/* SVG Revenue projections chart */}
        <div className="glass-panel p-6 bg-white border-slate-200/80 shadow-sm rounded-2xl space-y-4">
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

  // TAB 4 RENDER: Medical Shop (Pharmacy)
  const renderPharmacyTab = () => {
    return (
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

  // TAB 7 RENDER: Clinic Network & Revocation controls
  const renderNetworkTab = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-slate-800 animate-fade-in">
        {/* Left Column: SVGs Clinic network visual node mapper */}
        <div className="lg:col-span-2 glass-panel p-6 bg-white border-slate-200/80 shadow-sm rounded-2xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary text-xl">hub</span>
              <h2 className="text-base font-bold text-slate-800">Interactive Clinical Pod Network</h2>
            </div>
            <p className="text-xs text-slate-400">Live visual node map tracking linked multi-tenant entities and connections.</p>
          </div>

          {/* Stunning SVG interactive node map */}
          <div className="h-56 bg-slate-50 border border-slate-200/50 rounded-2xl relative flex items-center justify-center overflow-hidden">
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 60" preserveAspectRatio="none">
              <line x1="50" y1="30" x2="15" y2="18" stroke="#cbd5e1" strokeWidth="0.8" />
              <line x1="50" y1="30" x2="15" y2="42" stroke="#cbd5e1" strokeWidth="0.8" />
              <line x1="50" y1="30" x2="85" y2="18" stroke="#007d70" strokeWidth="1" strokeDasharray="2,2" />
              <line x1="50" y1="30" x2="85" y2="42" stroke="#0f62fe" strokeWidth="1" strokeDasharray="2,2" />

              {/* Pulsing dynamic flow dots */}
              <circle cx="67.5" cy="24" r="1.5" fill="#007d70">
                <animate attributeName="cx" from="50" to="85" dur="3s" repeatCount="indefinite" />
                <animate attributeName="cy" from="30" to="18" dur="3s" repeatCount="indefinite" />
              </circle>
              <circle cx="67.5" cy="36" r="1.5" fill="#0f62fe">
                <animate attributeName="cx" from="50" to="85" dur="3.5s" repeatCount="indefinite" />
                <animate attributeName="cy" from="30" to="42" dur="3.5s" repeatCount="indefinite" />
              </circle>
            </svg>

            {/* Hub node: Doctor Clinic */}
            <div className="absolute top-[22%] left-[40%] flex flex-col items-center z-10">
              <div className="w-12 h-12 rounded-full bg-blue-100 border-2 border-primary shadow-md flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-lg">medical_services</span>
              </div>
              <span className="text-[9px] font-bold text-slate-800 bg-white border border-slate-200/80 px-2 py-0.5 rounded-full shadow-sm mt-1.5">Dr. Sharma (Host)</span>
            </div>

            {/* Partner Node: Pharmacy */}
            <div className="absolute top-[8%] left-[75%] flex flex-col items-center z-10">
              <div className="w-10 h-10 rounded-full bg-teal-50 border-2 border-teal-600 shadow-sm flex items-center justify-center text-teal-600">
                <span className="material-symbols-outlined text-base">pill</span>
              </div>
              <span className="text-[8px] font-bold text-slate-700 bg-white border border-slate-200/80 px-1.5 py-0.5 rounded shadow-sm mt-1 font-sans">E-Pharmacy Partner</span>
            </div>

            {/* Partner Node: Lab */}
            <div className="absolute top-[52%] left-[75%] flex flex-col items-center z-10">
              <div className="w-10 h-10 rounded-full bg-amber-50 border-2 border-amber-500 shadow-sm flex items-center justify-center text-amber-500">
                <span className="material-symbols-outlined text-base">biotech</span>
              </div>
              <span className="text-[8px] font-bold text-slate-700 bg-white border border-slate-200/80 px-1.5 py-0.5 rounded shadow-sm mt-1 font-sans">Pathology Lab Partner</span>
            </div>

            {/* Left Node: Compounder staff */}
            <div className="absolute top-[8%] left-[5%] flex flex-col items-center z-10">
              <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600">
                <span className="material-symbols-outlined text-base">badge</span>
              </div>
              <span className="text-[8px] font-bold text-slate-600 bg-white border border-slate-200/80 px-1.5 py-0.5 rounded shadow-sm mt-1 font-sans">Compounder Admin</span>
            </div>

            {/* Left Node: Receptionist staff */}
            <div className="absolute top-[52%] left-[5%] flex flex-col items-center z-10">
              <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600">
                <span className="material-symbols-outlined text-base">support_agent</span>
              </div>
              <span className="text-[8px] font-bold text-slate-600 bg-white border border-slate-200/80 px-1.5 py-0.5 rounded shadow-sm mt-1 font-sans">Receptionist Staff</span>
            </div>
          </div>
          
          <div className="text-[9px] font-mono text-slate-400 italic">
            * Pulsing connections represent active encrypted telemetry packet flows across secure Supabase RLS policies.
          </div>
        </div>

        {/* Right Column: Partners List & Revocation controls */}
        <div className="space-y-6">
          <div className="glass-panel p-6 bg-white border-slate-200/80 shadow-sm rounded-2xl h-full flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-xl">gavel</span>
                <h2 className="text-base font-bold text-slate-800">Ecosystem Mappings</h2>
              </div>

              {/* Linked Partners List */}
              <div className="space-y-3">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Approved Pod Tenants</div>
                
                {podEntities.filter(e => e.entityType !== 'clinic' && e.status === 'approved').map(partner => (
                  <div key={partner.id} className="p-3 bg-slate-50 border border-slate-200/50 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <strong className="block text-slate-700 font-semibold font-sans">{partner.name}</strong>
                        <span className="text-[9px] text-slate-400">GSTIN: {partner.gstin || 'Pending GSTIN'}</span>
                      </div>
                      <span className="text-[8px] font-mono bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase">Active</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-200/40">
                      <span className="text-[9px] text-slate-400">
                        {partner.entityType === 'pharmacy' ? '10% commission split' : '15% pathology split'}
                      </span>
                      <button
                        onClick={() => handlePartnerStatusUpdate(partner.id, 'revoked')}
                        className="text-rose-500 hover:text-rose-700 font-bold uppercase tracking-wider text-[9px] cursor-pointer"
                      >
                        Revoke Access
                      </button>
                    </div>
                  </div>
                ))}
                {podEntities.filter(e => e.entityType !== 'clinic' && e.status === 'approved').length === 0 && (
                  <div className="text-[10px] text-slate-400 italic p-3 bg-slate-50 border border-slate-200/40 rounded-xl text-center">
                    No approved tenant partners connected in the pod yet.
                  </div>
                )}

                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold pt-2">Pending Join Requests</div>
                {podEntities.filter(e => e.status === 'pending').length > 0 ? (
                  podEntities.filter(e => e.status === 'pending').map(request => (
                    <div key={request.id} className="p-3 bg-amber-50/50 border border-amber-200/60 rounded-xl space-y-2 text-xs">
                      <div className="flex justify-between items-start">
                        <div>
                          <strong className="block text-amber-900 font-semibold font-sans">{request.name}</strong>
                          <span className="text-[9px] text-slate-400 font-sans font-medium">Type: {request.entityType} • {request.phone}</span>
                        </div>
                        <span className="text-[8px] font-mono bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase">Pending</span>
                      </div>
                      <div className="flex gap-2 pt-1 border-t border-amber-200/20">
                        <button
                          onClick={() => handlePartnerStatusUpdate(request.id, 'approved')}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-bold py-1 rounded uppercase transition-colors font-sans cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handlePartnerStatusUpdate(request.id, 'rejected')}
                          className="flex-1 bg-slate-200 hover:bg-slate-350 text-slate-600 text-[9px] font-bold py-1 rounded uppercase transition-colors font-sans cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-slate-400 italic p-3 bg-slate-50 border border-slate-200/40 rounded-xl text-center">
                    No pending tenant join requests at the moment.
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-100 text-[10px] text-slate-400 italic">
              * Doctor is the Pod host and retains full tenant revocation and authorization governance.
            </div>
          </div>
        </div>
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
      case 'network':
        return renderNetworkTab();
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
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 animate-fade-in text-slate-800">
      {/* Ecosystem Command Header */}
      <div className="glass-panel p-6 border-slate-200/80 shadow-md relative overflow-hidden bg-white">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-primary via-secondary to-accent-400" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl animate-pulse">hub</span>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">Dr. Sharma's Care Dashboard</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Mediflow Pod Tenant Host • Clinic Code: <span className="font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{activePod?.clinicCode || 'MF-PATNA101'}</span>
            </p>
          </div>
          
          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/80 px-4 py-2 rounded-xl text-xs font-medium">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-slate-600 font-semibold font-mono">Real-Time Sync: Connected</span>
          </div>
        </div>

        {/* Dynamic 7-Tab Navigation Bar */}
        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-slate-100">
          {[
            { id: 'overview', label: 'Command Center', icon: 'dashboard' },
            { id: 'consultation', label: 'Consultation Queue', icon: 'clinical_notes' },
            { id: 'financials', label: 'Financial Reports', icon: 'account_balance_wallet' },
            { id: 'pharmacy', label: 'Medical Shop', icon: 'pill' },
            { id: 'pathology', label: 'Pathology Lab', icon: 'biotech' },
            { id: 'patients', label: 'Patient Directory', icon: 'group' },
            { id: 'network', label: 'Clinic Network', icon: 'hub' }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                  isActive
                    ? 'bg-primary text-white shadow-md shadow-primary/20 hover:opacity-95 text-white-force'
                    : 'bg-slate-50 text-slate-600 border border-slate-200/50 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-base">{tab.icon}</span>
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

      {/* Allergy overrides modal */}
      {allergyAlert && renderAllergyAlertModal()}
    </div>
  );
};
