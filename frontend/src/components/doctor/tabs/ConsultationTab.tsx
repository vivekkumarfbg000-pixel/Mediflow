import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import type { Patient, DiagnosticTest, MedicationRequest, Appointment } from '../../../types';
import { CheckCircle2 } from 'lucide-react';
import { OphthalmologyPatientAnalysisPanel } from '../OphthalmologyPatientAnalysisPanel';
import { OphthalmicRefractionGrid } from '../OphthalmicRefractionGrid';
import { BiometryWorksheet } from '../BiometryWorksheet';
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
  isRecording: boolean;
  recordingSeconds: number;
  audioUrl: string | null;
  isTranscribing: boolean;
  startAudioRecording: () => void;
  stopAudioRecording: () => void;
  executeAudioScribeTranscription: () => void;
  handleAddMedication: () => void;
  handleRemoveMedication: (idx: number) => void;
  handleToggleTest: (test: DiagnosticTest) => void;
  handleSaveEncounter: () => void;
  handleLaunchVideoConsult?: () => void;
}

export const ConsultationTab: React.FC<ConsultationTabProps> = React.memo(({
  patients,
  selectedPatient,
  setSelectedPatient,
  medications,
  setMedications,
  selectedTests,
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
  isRecording,
  recordingSeconds,
  audioUrl,
  isTranscribing,
  startAudioRecording,
  stopAudioRecording,
  executeAudioScribeTranscription,
  handleAddMedication,
  handleRemoveMedication,
  handleToggleTest,
  handleSaveEncounter,
  handleLaunchVideoConsult
}) => {
  const appointments: Appointment[] = api.getAppointments();
  const [aiHistory, setAiHistory] = useState<any[]>([]);

  useEffect(() => {
    const refreshHistory = () => {
      if (selectedPatient) {
        setAiHistory(api.getAIResults(selectedPatient.id));
      } else {
        setAiHistory([]);
      }
    };
    refreshHistory();
    return api.subscribe(refreshHistory);
  }, [selectedPatient, hinglishSummary, comparativeTrend, aiInsight]);

  const [virtualDateInput, setVirtualDateInput] = useState('');
  const [virtualTimeInput, setVirtualTimeInput] = useState('');
  const [expandedCitationPmid, setExpandedCitationPmid] = useState<string | null>(null);
  const [flashPrescriptionPanel, setFlashPrescriptionPanel] = useState(false);
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
          <div style="text-align: right; margin-bottom: 20px;">
            <button onclick="window.print()" style="background: #e11d48; color: white; border: 0; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer;">Print Document</button>
          </div>
          <div class="header">
            <h1>MEDIFLOW CLINICAL DECISION SUPPORT SYSTEM (CDSS)</h1>
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
                <p><strong>Reference Date:</strong> ${new Date().toLocaleDateString('en-IN')}</p>
                <p><strong>Clinic Entity:</strong> Mediflow Clinical Hub</p>
                <p><strong>Chronic Conditions:</strong> ${selectedPatient?.chronicConditions.join(', ') || 'None'}</p>
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
            <p>&copy; 2026 Mediflow Ecosystem - Hospital SaaS Solutions</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };


  useEffect(() => {
    if (selectedPatient) {
      const patientAppts = appointments.filter((a: Appointment) => a.patientId === selectedPatient.id);
      const virtualAppt = patientAppts.find((a: Appointment) => a.isVirtual);
      if (virtualAppt) {
        setVirtualDateInput(virtualAppt.virtualDate || '');
        setVirtualTimeInput(virtualAppt.virtualTime || '');
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in text-slate-800">
      {/* LEFT COLUMN: Patient queue, CDSS Analyzer */}
      <div className={`${selectedPatient ? 'hidden lg:block' : 'block'} lg:col-span-4 space-y-6`}>
        {/* Patient Consultation Queue */}
        <div className="glass-panel p-6 border-slate-200/80 shadow-sm relative overflow-hidden bg-white">
          <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">group</span>
            Consultation Queue
          </h2>
          
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {(() => {
              const parseTokenNum = (token?: string) => {
                if (!token) return Infinity;
                const match = token.match(/\d+/);
                return match ? parseInt(match[0], 10) : Infinity;
              };

              const queuePatients = patients
                .filter(p => p.queueStatus === 'awaiting_consultation' || p.queueStatus === 'in_consultation' || p.id === selectedPatient?.id)
                .sort((a, b) => {
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
                  <div className="text-center py-8 text-xs text-slate-400 font-medium">
                    No active patients in queue
                  </div>
                );
              }

              return queuePatients.map((p: Patient) => {
                const isSelected = selectedPatient?.id === p.id;
                const patientAppts = appointments.filter(a => a.patientId === p.id);
                const virtualAppt = patientAppts.find(a => a.isVirtual);

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
                      <div className="font-bold text-xs text-slate-700 group-hover:text-primary transition-colors flex items-center gap-1.5">
                        {p.name}
                        {p.tokenNumber && (
                          <span className="text-[8px] font-mono px-1 py-0.2 bg-indigo-50 border border-indigo-200/50 text-indigo-700 rounded shrink-0">
                            {p.tokenNumber}
                          </span>
                        )}
                      </div>
                      <span className="text-[8px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-mono">
                        {p.id.toUpperCase().substring(0, 8)}
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
                            {p.vitals.dilationStatus === 'instilled' && p.vitals.dilationStartTime && (
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
                            <span className="material-symbols-outlined text-[10px] text-emerald-700">check_circle</span>
                            📹 Virtual {virtualAppt.virtualTimeAllocated ? `(${virtualAppt.virtualTime})` : 'Appt'}
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

        {/* Laboratory Report History (Past & Present) */}
        {selectedPatient && !isOphthalmology && (
          <div className="glass-panel p-6 border-slate-200/80 shadow-sm relative overflow-hidden bg-white mt-4">
            <h2 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">folder_zip</span>
              Biomarker Reports History
            </h2>
            <p className="text-[10px] text-slate-600 mb-4">Click a report to open a full-screen clinical AI analysis</p>
            
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
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
                    key={idx}
                    onClick={() => setAnalyzingReport(report)}
                    className="w-full text-left p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl hover:bg-slate-100 hover:border-slate-300 transition-all group relative overflow-hidden flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-indigo-500">labs</span>
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
            <span className="material-symbols-outlined text-sm font-bold">arrow_back</span>
            Back to Patients Queue
          </button>
          {!isConsentActive && (
                <div className="absolute inset-0 z-[45] flex flex-col items-center justify-center bg-white/95 border border-rose-500/20 p-8 text-center animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-rose-50/50 border border-rose-500/20 flex items-center justify-center mb-4 text-rose-500 animate-pulse">
                <span className="material-symbols-outlined text-2xl">lock</span>
              </div>
              <h3 className="text-slate-800 font-bold text-sm mb-2">Compliance Lock: Active Consent Missing</h3>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed mb-5">
                Access to clinical records, diagnostics ordering, and medication prescribing is locked. Please direct the patient to reply <strong className="text-secondary font-mono">"1" (Grant Access)</strong> on their WhatsApp simulator interface, or authorize physical consent.
              </p>
              {/* Time-Bound Physical Consent Form */}
              <div className="w-full max-w-sm bg-slate-50 border border-slate-200/60 p-4.5 rounded-2xl text-left space-y-4 animate-fade-in shadow-sm select-none">
                <div className="flex gap-2 items-center text-slate-800 font-bold text-xs">
                  <span className="material-symbols-outlined text-indigo-600 text-base">shield_with_heart</span>
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
                      } catch (err: any) {
                        console.error('[Consent Bypass] Failed to record physical consent:', err);
                      }
                    }}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-750 active:scale-[0.97] text-white text-[10px] font-bold uppercase tracking-wider py-2 rounded-xl transition-all shadow flex justify-center items-center gap-1.5 cursor-pointer border-0 text-white-force bg-indigo-600-force"
                  >
                    <span className="material-symbols-outlined text-[13px] text-white-force">check_circle</span>
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
                <span className="material-symbols-outlined text-amber-600 text-lg">shield_with_heart</span>
                <div className="text-[10px] text-amber-955 leading-relaxed font-sans">
                  <span className="font-bold text-amber-955">Active Physical Consent</span> • Purpose: <span className="font-semibold text-amber-900">{activePhysicalConsent.consent_purpose.replace(/_/g, ' ')}</span>
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
                <span className="material-symbols-outlined text-primary text-xl">clinical_notes</span>
                Electronic Consultation Record
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Selected Profile: <strong className="text-slate-700 font-bold">{selectedPatient.name}</strong> ({selectedPatient.age}y, {selectedPatient.gender})
              </p>
            </div>
            <div className="flex items-center gap-2">
              {handleLaunchVideoConsult && (
                <button
                  type="button"
                  onClick={handleLaunchVideoConsult}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[9px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border-0 text-white-force bg-indigo-600-force"
                >
                  <span className="material-symbols-outlined text-[12px] text-white-force animate-pulse">video_call</span>
                  Launch Video Consult
                </button>
              )}
              {selectedPatient.abhaId && (
                <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full font-bold tracking-wider uppercase font-mono">
                  ABHA Verified
                </span>
              )}
            </div>
          </div>

          {/* Handwritten prescription workflow notice */}
          <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-start gap-2.5 my-3">
            <span className="material-symbols-outlined text-indigo-600 text-lg mt-0.5">edit_note</span>
            <div className="text-[10px] text-indigo-950 leading-relaxed">
              <strong className="font-bold text-[11px] text-indigo-950 block mb-0.5">Handwritten Rx Support Enabled</strong>
              Prefer paper? Write the prescription by hand as usual. The compounder will scan it at the counter, and our clinical AI will automatically reserve medicine inventory and queue pathology tests.
            </div>
          </div>

          {/* Virtual Appointment Timing Allocator */}
          {(() => {
            const patientAppts = appointments.filter(a => a.patientId === selectedPatient.id);
            const virtualAppt = patientAppts.find(a => a.isVirtual);
            if (!virtualAppt) return null;

            return (
              <div className="p-4 bg-emerald-50/50 border border-emerald-200/60 rounded-2xl space-y-3 animate-fade-in my-4 text-left">
                <div className="flex items-center justify-between border-b border-emerald-100/80 pb-2">
                  <div className="flex items-center gap-1.5 text-[#075e54] font-bold text-xs">
                    <span className="material-symbols-outlined text-sm font-bold">video_call</span>
                    Virtual Consultation Timing Scheduler
                  </div>
                  <span className={`text-[8px] font-bold px-2 py-0.5 rounded font-mono uppercase tracking-wider ${
                    virtualAppt.virtualTimeAllocated ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-900 animate-pulse'
                  }`}>
                    {virtualAppt.virtualTimeAllocated ? 'Timing Confirmed' : 'Awaiting timing'}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Allocate Meeting Date</label>
                    <input
                      type="date"
                      value={virtualDateInput || virtualAppt.virtualDate || ''}
                      onChange={(e) => setVirtualDateInput(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 focus:border-emerald-500/50 rounded-xl outline-none bg-white text-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Allocate Slot / Time</label>
                    <input
                      type="text"
                      placeholder="e.g. 10:30 AM"
                      value={virtualTimeInput || virtualAppt.virtualTime || ''}
                      onChange={(e) => setVirtualTimeInput(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 focus:border-emerald-500/50 rounded-xl outline-none bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono select-none">
                    <span className="material-symbols-outlined text-xs">link</span>
                    Meet: {virtualAppt.virtualMeetingUrl || `https://meet.jit.si/mediflow-consult-${virtualAppt.id}`}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const finalDate = virtualDateInput || virtualAppt.virtualDate || new Date().toISOString().split('T')[0];
                      const finalTime = virtualTimeInput || virtualAppt.virtualTime || '10:30 AM';
                      
                      // Update appointment
                      const updatedAppt = {
                        ...virtualAppt,
                        virtualDate: finalDate,
                        virtualTime: finalTime,
                        virtualTimeAllocated: true
                      };
                      api.saveAppointment(updatedAppt);
                      
                      // Notify patient on WhatsApp
                      const patient = patients.find(p => p.id === selectedPatient.id);
                      if (patient) {
                        const notificationText = `📅 *Virtual Consultation Confirmed!* \n\nDr. Vivek has allocated your virtual consultation timing: \n🗓️ *Date:* ${finalDate} \n⏰ *Time:* ${finalTime} \n\nPlease join the meeting using this link when scheduled: \n🔗 ${virtualAppt.virtualMeetingUrl || `https://meet.jit.si/mediflow-consult-${virtualAppt.id}`}`;
                        api.pushWhatsAppMessageFromBot(patient.phone, notificationText);
                      }

                      window.dispatchEvent(new CustomEvent('mediflow-toast', {
                        detail: {
                          title: 'Timing Allocated! 📅',
                          message: `Virtual consultation slot saved and patient notified via WhatsApp.`,
                          type: 'success'
                        }
                      }));
                    }}
                    className="px-4.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer border-0 active:scale-95 text-white-force bg-emerald-600-force"
                  >
                    Confirm & Send WhatsApp
                  </button>
                </div>
              </div>
            );
          })()}

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
              <div className="p-6 bg-white text-slate-800 rounded-3xl border border-slate-200 shadow-xl relative overflow-hidden space-y-6 animate-fade-in my-2">
                <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-indigo-500/10 to-purple-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="flex justify-between items-start pb-2 border-b border-slate-200/80">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-indigo-600 text-xl font-bold">query_stats</span>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">AI Predictive Lab Pattern & Risk Disease Analyzer</h3>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1">Advanced multi-biomarker trajectory & disease prediction engine</p>
                  </div>
                  <span className="text-[8px] font-black font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">
                    Predictive Model: Active
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      color: getAcuityRank(recent.temperature || '6/6') > 2 ? 'from-rose-50 to-rose-100/50 border-rose-200 text-rose-800' : 'from-emerald-50 to-emerald-100/50 border-emerald-200 text-emerald-700'
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
                      color: (recent.pulseRate || 16) > 21 ? 'from-rose-50 to-rose-100/50 border-rose-200 text-rose-800' : 'from-emerald-50 to-emerald-100/50 border-emerald-200 text-emerald-700'
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
                      color: getAcuityRank(recent.bloodPressure || '6/9') > 3 ? 'from-rose-50 to-rose-100/50 border-rose-200 text-rose-800' : 'from-emerald-50 to-emerald-100/50 border-emerald-200 text-emerald-700'
                    }
                  ].map((item, idx) => (
                    <div key={idx} className={`p-3.5 rounded-2xl border bg-gradient-to-b ${item.color} flex flex-col justify-between space-y-2`}>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] text-slate-700 font-bold uppercase tracking-wider">{item.name}</span>
                        <span className="text-[9px] text-slate-600 font-mono">Normal: {item.normal}</span>
                      </div>
                      <div className="flex justify-between items-baseline pt-1">
                        <span className="text-lg font-black font-mono tracking-tight text-slate-800">{item.val}</span>
                        {baseline && item.diff !== 0 && (
                          <span className={`text-[10px] font-extrabold font-mono flex items-center gap-0.5 ${
                            (item.diff > 0 && item.status !== 'normal')
                              ? 'text-rose-750'
                              : 'text-emerald-750'
                          }`}>
                            {item.diff > 0 ? '▲' : '▼'} {Math.abs(item.diff).toFixed(0)}
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-slate-600 pt-1 border-t border-slate-200/50 flex justify-between">
                        <span>Base: {item.base}</span>
                        <span className="font-bold text-[8px] uppercase tracking-wider">{item.status}</span>
                      </div>
                    </div>
                  )) : [
                    {
                      name: 'HbA1c (Glycated Hb)',
                      val: `${recent.HbA1c}%`,
                      base: baseline ? `${baseline.HbA1c}%` : 'N/A',
                      diff: hba1cDiff,
                      unit: '%',
                      normal: '4.0 - 5.6',
                      status: recent.HbA1c > 6.5 ? 'critical' : recent.HbA1c > 5.7 ? 'warning' : 'normal',
                      icon: 'water_drop',
                      color: recent.HbA1c > 6.5 ? 'from-rose-50 to-rose-100/50 border-rose-200 text-rose-800' : recent.HbA1c > 5.7 ? 'from-amber-50 to-amber-100/50 border-amber-200 text-amber-900' : 'from-emerald-50 to-emerald-100/50 border-emerald-200 text-emerald-700',
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
                      color: recent.creatinine > 1.2 ? 'from-rose-50 to-rose-100/50 border-rose-200 text-rose-800' : recent.creatinine > 1.0 ? 'from-amber-50 to-amber-100/50 border-amber-200 text-amber-900' : 'from-emerald-50 to-emerald-100/50 border-emerald-200 text-emerald-700',
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
                      color: calculatedGfr < 60 ? 'from-rose-50 to-rose-100/50 border-rose-200 text-rose-800' : calculatedGfr < 90 ? 'from-amber-50 to-amber-100/50 border-amber-200 text-amber-900' : 'from-emerald-50 to-emerald-100/50 border-emerald-200 text-emerald-700',
                      zones: [
                        { start: 10, end: 30, color: 'bg-rose-500' },
                        { start: 30, end: 60, color: 'bg-orange-400' },
                        { start: 60, end: 90, color: 'bg-amber-400' },
                        { start: 90, end: 130, color: 'bg-emerald-500' }
                      ],
                      min: 10,
                      max: 130,
                      numericVal: calculatedGfr
                    }] : []),
                    {
                      name: 'Total Hemoglobin',
                      val: `${recent.hemoglobin} g/dL`,
                      base: baseline ? `${baseline.hemoglobin} g/dL` : 'N/A',
                      diff: hemoglobinDiff,
                      unit: 'g/dL',
                      normal: '12.0 - 16.0',
                      status: recent.hemoglobin < 12.0 ? 'warning' : 'normal',
                      icon: 'bloodtype',
                      color: recent.hemoglobin < 12.0 ? 'from-amber-50 to-amber-100/50 border-amber-200 text-amber-900' : 'from-emerald-50 to-emerald-100/50 border-emerald-200 text-emerald-700'
                    }
                  ].map((item: any, idx) => (
                    <div key={idx} className={`p-3.5 rounded-2xl border bg-gradient-to-b ${item.color} flex flex-col justify-between space-y-2.5`}>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">{item.name}</span>
                        <span className="text-[9px] text-slate-600 font-mono">Normal: {item.normal}</span>
                      </div>
                      <div className="flex justify-between items-baseline pt-1">
                        <span className="text-lg font-black font-mono tracking-tight text-slate-800">{item.val}</span>
                        {baseline && item.diff !== 0 && (
                          <span className={`text-[10px] font-extrabold font-mono flex items-center gap-0.5 ${
                            (item.diff > 0 && item.status !== 'normal') || (item.diff < 0 && item.name.includes('Hemoglobin'))
                              ? 'text-rose-800'
                              : 'text-emerald-700'
                          }`}>
                            {item.diff > 0 ? '▲' : '▼'} {Math.abs(item.diff).toFixed(item.name.includes('Creatinine') ? 2 : 1)}
                          </span>
                        )}
                      </div>

                      {/* Visual Sparkline Range indicator */}
                      {item.zones && item.min !== undefined && item.max !== undefined && item.numericVal !== undefined && (
                        <div className="mt-1 pb-1">
                          <div className="relative h-1.5 w-full bg-slate-200/50 rounded-full overflow-hidden flex">
                            {item.zones.map((zone: any, zIdx: number) => {
                              const zoneWidth = ((zone.end - zone.start) / (item.max! - item.min!)) * 100;
                              return (
                                <div
                                  key={zIdx}
                                  className={`${zone.color}`}
                                  style={{ width: `${zoneWidth}%` }}
                                />
                              );
                            })}
                          </div>
                          <div className="relative w-full h-1.5 mt-0.5">
                            <div 
                              className="absolute top-[-3px] -translate-x-1/2" 
                              style={{ left: `${Math.min(100, Math.max(0, ((item.numericVal! - item.min!) / (item.max! - item.min!)) * 100))}%` }}
                            >
                              <div className="w-2 h-2 rounded-full bg-slate-855 border border-white shadow-sm" />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="text-[9px] text-slate-600 pt-1 border-t border-slate-200/50 flex justify-between">
                        <span>Base: {item.base}</span>
                        <span className="font-bold text-[8px] uppercase tracking-wider">{item.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                    <span className="material-symbols-outlined text-xs text-indigo-600">warning</span>
                    AI Predictive Disease & Pattern Warnings
                  </h4>
                  {riskAlerts.length === 0 ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-xs italic">
                      No critical disease risks flagged based on biomarker trajectories.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5">
                      {riskAlerts.map((alert, i) => (
                        <div key={i} className={`p-3 rounded-xl border flex gap-3 text-xs leading-relaxed ${
                          alert.type === 'critical'
                            ? 'bg-rose-50 border-rose-200 text-rose-800'
                            : alert.type === 'warning'
                            ? 'bg-amber-50 border-amber-200/60 text-amber-900'
                            : 'bg-indigo-50 border-indigo-200 text-indigo-800'
                        }`}>
                          <span className="material-symbols-outlined text-base font-bold mt-0.5 shrink-0">
                            {alert.type === 'critical' ? 'gavel' : alert.type === 'warning' ? 'error' : 'info'}
                          </span>
                          <div>
                            <strong className="font-extrabold text-[11px] uppercase tracking-wider block">{alert.title}</strong>
                            <p className="text-[10px] text-slate-700 pt-0.5 font-sans leading-relaxed">{alert.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
 
                <div className="p-4 bg-indigo-50/20 border border-indigo-100/80 rounded-2xl space-y-1.5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                  <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest font-mono flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping" />
                    Professional AI Consultation Summary
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed font-sans font-medium italic pt-1">
                    "{summaryText}"
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Electronic Consultation Record Gating, Suggestions, and AI Summaries */}
          <div className="p-6 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-6 shadow-sm text-left">
            {/* Live AI Clinical RAG Advisory */}
            {isAiLoading ? (
              <div className="p-5 bg-indigo-50/40 border border-indigo-100 rounded-2xl animate-pulse space-y-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-500 animate-spin text-sm">sync</span>
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider font-mono">Running Live RAG Clinical Advisory Prompt...</span>
                </div>
                <div className="h-2 bg-slate-200/60 rounded w-3/4 animate-pulse"></div>
                <div className="h-2 bg-slate-200/60 rounded w-5/6 animate-pulse"></div>
                <div className="h-2 bg-slate-200/60 rounded w-1/2 animate-pulse"></div>
              </div>
            ) : aiInsight ? (
              <div className="p-5 bg-indigo-50/40 border border-indigo-150 rounded-2xl space-y-3 animate-fade-in text-left">
                <div className="flex justify-between items-center border-b border-indigo-100 pb-2">
                  <h3 className="text-xs font-black text-indigo-800 uppercase tracking-widest font-mono flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm font-bold text-indigo-700">psychology</span>
                    Live RAG Clinical Advisory (Active Care Support)
                  </h3>
                  <span className="text-[8px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-mono">
                    PERSISTED CACHE
                  </span>
                </div>
                <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-medium max-h-[300px] overflow-y-auto pr-1">
                  {aiInsight}
                </div>
              </div>
            ) : null}

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
            <div className="p-4.5 bg-white border border-slate-200 rounded-2xl space-y-4 animate-fade-in text-slate-800">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs">mic</span>
                  Audio Suggestion Scribe (Local Recording first)
                </span>
                <span className="text-[9px] font-bold font-mono px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-md">
                  Zero API Cost Idle
                </span>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {isRecording ? (
                    <button
                      type="button"
                      onClick={stopAudioRecording}
                      className="w-full sm:w-auto px-5 py-2.5 bg-rose-650 hover:bg-rose-600 active:scale-95 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2 uppercase transition-all shadow-md animate-pulse cursor-pointer border-0 text-slate-800-force"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping shrink-0" />
                      Stop Recording ({recordingSeconds}s)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startAudioRecording}
                      className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 uppercase transition-all shadow-md cursor-pointer border-0 text-white-force"
                    >
                      <span className="material-symbols-outlined text-sm font-bold shrink-0">mic</span>
                      Record Clinical Advice
                    </button>
                  )}
                </div>

                {audioUrl && (
                  <div className="w-full sm:flex-1 bg-slate-900 border border-slate-200 p-2 rounded-xl flex items-center justify-between gap-3">
                    <audio src={audioUrl} controls className="w-full h-8 shrink" />
                    
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

              <p className="text-[9px] text-slate-600 leading-normal text-left">
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
                    
                    const taskId = `task-hinglish-${selectedPatient.id}-${Date.now()}`;
                    await api.saveAIResult({
                      id: crypto.randomUUID(),
                      user_id: 'demo-doctor-uuid',
                      task_id: taskId,
                      patient_id: selectedPatient.id,
                      input_data: notes,
                      output_data: summary,
                      output_type: 'HINGLISH_SUMMARY',
                      status: 'SUCCESS',
                      created_at: new Date().toISOString(),
                      model_used: 'gemini-1.5-flash',
                      duration_ms: 1000
                    });

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
                className="w-full bg-primary hover:bg-primary-600 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 text-white-force cursor-pointer border-0"
              >
                {isGeneratingSummary ? 'Generating...' : '🤖 Generate AI Hinglish Summary'}
              </button>
            </div>

            {hinglishSummary && (
              <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3 animate-fade-in text-left">
                <h4 className="font-bold text-[10px] text-indigo-700 uppercase tracking-widest font-mono flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs">chat</span>
                  Hinglish Clinical Summary
                </h4>
                <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed font-semibold italic">
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
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 uppercase transition-colors cursor-pointer border-0"
                >
                  <span className="material-symbols-outlined text-xs text-white-force">send</span>
                  Send to Patient WhatsApp
                </button>
              </div>
            )}

            {/* REVISIT LAB TREND COMPARISON */}
            {activeHistory && activeHistory.length > 0 && (
              <div className="border-t border-slate-200/80 pt-4 space-y-4 text-left">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-500 text-sm">analytics</span>
                  Revisit Mode: Comparative Lab Trend Analysis
                </h3>
                <p className="text-[10px] text-slate-600 leading-relaxed font-sans">
                  Compare current biomarkers with historical reports to analyze improvement metrics.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans my-2">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Baseline Report Date</label>
                    <select
                      value={baselineDate || ''}
                      onChange={(e) => setBaselineDate(e.target.value || null)}
                      className="w-full px-3.5 py-2 border border-slate-200 focus:border-indigo-500/50 rounded-xl outline-none bg-white text-slate-800"
                    >
                      <option value="">(Select Baseline Date)</option>
                      {activeHistory.map((h: any) => (
                        <option key={h.date} value={h.date}>{h.date}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Comparison Report Date</label>
                    <select
                      value={comparisonDate || ''}
                      onChange={(e) => setComparisonDate(e.target.value || null)}
                      className="w-full px-3.5 py-2 border border-slate-200 focus:border-indigo-500/50 rounded-xl outline-none bg-white text-slate-800"
                    >
                      <option value="">(Select Comparison Date)</option>
                      {activeHistory.map((h: any) => (
                        <option key={h.date} value={h.date}>{h.date}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      if (!compReport) return;
                      setIsGeneratingTrend(true);
                      try {
                        const trend = await api.generateComparativeLabTrend(selectedPatient.id, baselineDate, comparisonDate);
                        setComparativeTrend(trend);
                        
                        const taskId = `task-trend-${selectedPatient.id}-${Date.now()}`;
                        await api.saveAIResult({
                          id: crypto.randomUUID(),
                          user_id: 'demo-doctor-uuid',
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

                        api.writeAuditLog('CDSS_LAB_TREND_ANALYSIS', {
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
                    }}
                    disabled={isGeneratingTrend}
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer text-white-force border-0"
                  >
                    {isGeneratingTrend ? 'Analyzing...' : '📊 Generate Comparative AI Summary'}
                  </button>
                </div>

                {comparativeTrend && (
                  <div className="p-5 bg-gradient-to-br from-rose-50/70 to-indigo-50/50 border border-slate-200/80 rounded-2xl space-y-5 animate-fade-in text-left shadow-sm">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-[10px] text-rose-800 uppercase tracking-widest font-mono flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-xs">analytics</span>
                        Evidence-Based Comparative CDSS Report
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handlePrintClinicalReferral}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-rose-200/50 flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <span className="material-symbols-outlined text-[11px]">print</span>
                          Print Referral Note
                        </button>
                        <span className="text-[9px] bg-indigo-500/10 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Active</span>
                      </div>
                    </div>

                    {/* Summary Text */}
                    <div className="bg-white/80 border border-white/40 p-4 rounded-xl space-y-2">
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-medium">
                        {comparativeTrend.summaryText}
                      </p>
                    </div>

                    {/* Suggested Compositions Grid */}
                    {comparativeTrend.suggestedCompositions && comparativeTrend.suggestedCompositions.length > 0 && (
                      <div className="space-y-2.5">
                        <h5 className="font-extrabold text-[10px] text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-rose-600">medication</span>
                          Suggested Medicine Compositions & Dosages
                        </h5>
                        <div className="grid grid-cols-1 gap-3">
                          {comparativeTrend.suggestedCompositions.map((comp: any, idx: number) => (
                            <div key={idx} className="p-3.5 bg-white/95 border border-slate-200/80 rounded-xl flex flex-col md:flex-row justify-between gap-3 shadow-xs hover:shadow-md transition-shadow">
                              <div className="space-y-1.5 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <strong className="text-xs font-bold text-slate-800">{comp.medicine_name}</strong>
                                  <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200/40 font-mono">{comp.composition}</span>
                                </div>
                                <p className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[10px]">schedule</span>
                                  Dosage: {comp.suggested_dosage}
                                </p>
                                <p className="text-[10px] text-slate-500 leading-normal">
                                  <span className="font-bold text-slate-600">Justification: </span>{comp.justification}
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  const alreadyAdded = medications.some(m => m.medicineName.toLowerCase() === comp.medicine_name.toLowerCase());
                                  if (alreadyAdded) {
                                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                      detail: {
                                        title: 'Already Added',
                                        message: `${comp.medicine_name} is already in the prescription list.`,
                                        type: 'warning'
                                      }
                                    }));
                                    return;
                                  }
                                  setMedications([
                                    ...medications,
                                    {
                                      medicineName: comp.medicine_name,
                                      dosage: comp.composition,
                                      frequency: comp.suggested_dosage,
                                      duration: '30 Days'
                                    }
                                  ]);
                                  
                                  setTimeout(() => {
                                    const container = document.getElementById('doctor-tab-container') || document.querySelector('.doctor-dashboard-main-content');
                                    const panel = document.getElementById('prescription-panel');
                                    if (container && panel) {
                                      const offsetTop = panel.offsetTop;
                                      container.scrollTop = offsetTop - 120;
                                    }
                                    setFlashPrescriptionPanel(true);
                                    setTimeout(() => setFlashPrescriptionPanel(false), 1500);
                                  }, 100);

                                  window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                    detail: {
                                      title: 'e-Rx Appended 💊',
                                      message: `Added ${comp.medicine_name} to prescription list.`,
                                      type: 'success'
                                    }
                                  }));
                                }}
                                className="self-start md:self-center bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-indigo-200/50 flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap"
                              >
                                <span className="material-symbols-outlined text-[11px]">add</span>
                                Add to Rx
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* NCBI PubMed Reference Library */}
                    {comparativeTrend.citations && comparativeTrend.citations.length > 0 && (
                      <div className="space-y-2.5">
                        <h5 className="font-extrabold text-[10px] text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-rose-600">library_books</span>
                          NCBI PubMed Reference Library
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {comparativeTrend.citations.map((c: any, idx: number) => (
                            <div
                              key={idx}
                              className="p-3.5 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-all flex flex-col justify-between text-left shadow-xs"
                            >
                              <div className="space-y-1">
                                <h6 className="text-[11px] font-bold text-slate-800 leading-snug">
                                  {c.title}
                                </h6>
                                <p className="text-[9px] text-slate-500 font-mono">
                                  {c.journal} ({c.year})
                                </p>
                              </div>
                              
                              {c.abstract && (
                                <div className="mt-2.5 pt-2 border-t border-slate-100">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setExpandedCitationPmid(expandedCitationPmid === c.pmid ? null : c.pmid);
                                    }}
                                    className="text-[9px] font-bold text-indigo-600 hover:text-indigo-850 flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
                                  >
                                    <span className="material-symbols-outlined text-[11px]">
                                      {expandedCitationPmid === c.pmid ? 'keyboard_arrow_up' : 'quick_reference_all'}
                                    </span>
                                    {expandedCitationPmid === c.pmid ? 'Hide Abstract' : 'Quick Summary (Abstract)'}
                                  </button>
                                  {expandedCitationPmid === c.pmid && (
                                    <p className="text-[10px] text-slate-600 mt-2 bg-slate-55 p-2.5 rounded-lg border border-slate-100 leading-relaxed transition-all animate-fade-in font-medium">
                                      {c.abstract}
                                    </p>
                                  )}
                                </div>
                              )}

                              <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-slate-100">
                                <span className="text-[9px] text-slate-500 font-bold font-mono">
                                  PMID: {c.pmid}
                                </span>
                                <a
                                  href={c.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[9px] text-indigo-600 hover:text-indigo-850 font-bold flex items-center gap-0.5 no-underline"
                                >
                                  Full Paper <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* CDSS Medical Disclaimer */}
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex gap-2.5">
                      <span className="material-symbols-outlined text-rose-600 text-xs shrink-0 font-bold">gavel</span>
                      <p className="text-[9px] text-rose-800/90 leading-relaxed">
                        <strong>CDSS Legal Disclaimer:</strong> The suggested drug compositions, active compounds, target dosages, and medical literature citations are provided strictly for clinical decision support. They do not constitute formal prescription directives. The attending licensed practitioner retains full clinical responsibility and absolute prescribing authority.
                      </p>
                    </div>

                    {/* WhatsApp Action Buttons */}
                    <button
                      onClick={() => {
                        api.pushWhatsAppMessageFromBot(selectedPatient.phone, comparativeTrend.summaryText);
                        window.dispatchEvent(new CustomEvent('mediflow-toast', {
                          detail: {
                            title: 'Trend Sent! 📱',
                            message: `Comparative lab trend pushed to +91 ${selectedPatient.phone} via WhatsApp.`,
                            type: 'success'
                          }
                        }));
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 uppercase transition-colors cursor-pointer border-0"
                    >
                      <span className="material-symbols-outlined text-xs text-white-force">send</span>
                      Push Trend report to Patient WhatsApp
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* AI Generation History List */}
            <div className="mt-4 p-5 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="font-bold text-[10px] text-slate-700 uppercase tracking-widest font-mono flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs">history</span>
                  AI Generation History ({aiHistory.length})
                </h4>
                {aiHistory.length > 0 && (
                  <span className="text-[8px] bg-slate-200 text-slate-650 px-2 py-0.5 rounded font-mono">
                    Offline Resilient
                  </span>
                )}
              </div>
              {aiHistory.length === 0 ? (
                <p className="text-[10px] text-slate-400 italic">No previously saved AI outputs for this patient.</p>
              ) : (
                <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-1">
                  {aiHistory.map((h: any) => (
                    <div key={h.id} className="p-3 bg-white border border-slate-200/60 rounded-xl text-[10px] text-slate-650 leading-relaxed font-sans space-y-2 hover:shadow-xs transition-all">
                      <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 font-mono">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          {h.output_type.replace(/_/g, ' ')}
                        </span>
                        <span>{new Date(h.created_at).toLocaleString()}</span>
                      </div>
                      <div className="text-slate-800 font-medium whitespace-pre-line bg-slate-50/50 p-2.5 rounded-lg border border-slate-100 max-h-40 overflow-y-auto text-[10px] leading-relaxed">
                        {h.output_data}
                      </div>
                      <div className="flex justify-between items-center text-[8px] text-slate-400 font-medium">
                        <span>Model: {h.model_used}</span>
                        {h.input_data && (
                          <span className="truncate max-w-[200px]" title={h.input_data}>
                            Input: "{h.input_data}"
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Prescribe Medications */}
          <div 
            id="prescription-panel" 
            className={`space-y-4 text-left border-t border-slate-100 pt-5 transition-all duration-500 p-2.5 rounded-2xl ${
              flashPrescriptionPanel ? 'bg-indigo-50/80 border border-indigo-200 ring-4 ring-indigo-500/20' : ''
            }`}
          >
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-xs text-primary font-bold">medication</span>
              Prescribe Medications (e-Rx)
            </label>

            {/* Smart Drug Swap Banner */}
            {(() => {
              if (!selectedPatient) return null;
              const hasNSAID = medications.some(m => {
                const name = m.medicineName.toLowerCase();
                return name.includes('ibuprofen') || 
                       name.includes('diclofenac') || 
                       name.includes('naproxen') || 
                       name.includes('ketorolac') || 
                       name.includes('mefenamic') || 
                       name.includes('indomethacin') || 
                       name.includes('meloxicam') || 
                       name.includes('celecoxib') ||
                       name.includes('nsaid');
              });

              if (!hasNSAID) return null;

              const hist = api.getPatientHistoricalBiomarkers(selectedPatient.id);
              const recentReport = hist.length > 0 ? hist[hist.length - 1] : null;
              const currentCreatinine = recentReport?.creatinine ?? 0.0;
              
              let currentGfr = 90;
              if (recentReport && recentReport.creatinine) {
                const scr = recentReport.creatinine;
                const ageVal = selectedPatient.age ?? 45;
                const genderVal = selectedPatient.gender || 'Male';
                const isFemale = genderVal.toLowerCase() === 'female';
                const k = isFemale ? 0.7 : 0.9;
                const alpha = isFemale ? -0.241 : -0.302;
                const genderMult = isFemale ? 1.012 : 1.0;
                currentGfr = 142 * Math.pow(Math.min(scr / k, 1), alpha) * Math.pow(Math.max(scr / k, 1), -1.200) * Math.pow(0.9938, ageVal) * genderMult;
              }

              if (currentCreatinine > 1.2 || currentGfr < 60) {
                return (
                  <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3 animate-fade-in shadow-xs">
                    <div className="flex gap-2.5 items-start">
                      <span className="material-symbols-outlined text-amber-600 text-base font-bold shrink-0">warning</span>
                      <div className="space-y-1">
                        <h5 className="font-extrabold text-[11px] text-amber-850 uppercase tracking-wide">Nephrotoxic NSAID Alert (Renal Risk)</h5>
                        <p className="text-[10px] text-amber-700 leading-relaxed font-medium">
                          Attending patient has elevated Serum Creatinine ({currentCreatinine} mg/dL) or GFR ({Math.round(currentGfr * 10) / 10} mL/min). Clinical decision guidelines suggest avoiding nephrotoxic NSAIDs to prevent acute renal failure.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updatedMeds = medications.map(m => {
                          const name = m.medicineName.toLowerCase();
                          if (name.includes('ibuprofen') || name.includes('diclofenac') || name.includes('naproxen') || name.includes('ketorolac') || name.includes('mefenamic') || name.includes('indomethacin') || name.includes('meloxicam') || name.includes('celecoxib') || name.includes('nsaid')) {
                            return {
                              ...m,
                              medicineName: 'Paracetamol 500mg',
                              dosage: 'Paracetamol IP 500mg',
                              frequency: '1 tablet twice daily after meals as needed',
                              duration: m.duration || '5 Days'
                            };
                          }
                          return m;
                        });
                        setMedications(updatedMeds);
                        window.dispatchEvent(new CustomEvent('mediflow-toast', {
                          detail: {
                            title: 'Renal-Safe Swap Applied 🔄',
                            message: 'Substituted nephrotoxic NSAID with Paracetamol 500mg.',
                            type: 'success'
                          }
                        }));
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg border-0 flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap self-stretch md:self-auto text-center justify-center text-white-force"
                    >
                      <span className="material-symbols-outlined text-[11px]">swap_horiz</span>
                      Swap with Paracetamol
                    </button>
                  </div>
                );
              }
              return null;
            })()}

            {/* List of current medications */}
            {medications.length > 0 ? (
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {medications.map((med, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs">
                    <div>
                      <strong className="text-slate-800 text-xs">{med.medicineName}</strong>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Dosage: {med.dosage} | Frequency: {med.frequency} | Duration: {med.duration}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveMedication(idx)}
                      className="p-1 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors cursor-pointer border-0 bg-transparent"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic bg-slate-50/50 p-4 border border-dashed border-slate-200 rounded-xl text-center">
                No medications prescribed yet. Add a medication below.
              </p>
            )}

            {/* Form to add medication */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50/30 p-4 border border-slate-200/50 rounded-xl">
              <div className="sm:col-span-2 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-555 uppercase">Medicine Name</span>
                  {isOphthalmology && (
                    <div className="flex gap-1">
                      {['OD', 'OS', 'OU'].map(eye => (
                        <button
                          key={eye}
                          type="button"
                          onClick={() => {
                            let cleanName = medName.replace(/\s*\((OD|OS|OU)\)/i, '').trim();
                            if (cleanName) {
                              setMedName(`${cleanName} (${eye})`);
                            }
                          }}
                          className="px-1.5 py-0.2 bg-indigo-50 hover:bg-indigo-500 hover:text-white text-indigo-700 rounded text-[7.5px] font-black border border-indigo-200/50 cursor-pointer"
                        >
                          {eye}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  placeholder={isOphthalmology ? "e.g. Moxifloxacin Eye Drops" : "e.g. Paracetamol 650mg"}
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  className="w-full input-field py-1.5 text-xs bg-white border-slate-200"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-555 uppercase">Dosage</span>
                {isOphthalmology ? (
                  <select
                    value={medDosage}
                    onChange={(e) => setMedDosage(e.target.value)}
                    className="w-full input-field py-1.5 text-xs bg-white border-slate-200 cursor-pointer"
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
                    className="w-full input-field py-1.5 text-xs bg-white border-slate-200"
                  />
                )}
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-555 uppercase">Frequency</span>
                {isOphthalmology ? (
                  <select
                    value={medFreq}
                    onChange={(e) => setMedFreq(e.target.value)}
                    className="w-full input-field py-1.5 text-xs bg-white border-slate-200 cursor-pointer"
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
                    className="w-full input-field py-1.5 text-xs bg-white border-slate-200"
                  />
                )}
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-550 uppercase">Duration</span>
                <input
                  type="text"
                  placeholder="e.g. 5 Days"
                  value={medDur}
                  onChange={(e) => setMedDur(e.target.value)}
                  className="w-full input-field py-1.5 text-xs bg-white border-slate-200"
                />
              </div>
              <div className="sm:col-span-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleAddMedication}
                  className="bg-[#075e54] hover:bg-[#0c4e46] text-white font-bold text-xs px-4 py-2 rounded-xl active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer border-0 text-white-force bg-indigo-600-force"
                >
                  <span className="material-symbols-outlined text-xs font-bold text-white-force">add</span>
                  Add to Prescription
                </button>
              </div>
            </div>
          </div>

          {/* Clinical Notes */}
          <div className="space-y-2 text-left">
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
          <div className="space-y-3 text-left">
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
                      isChecked ? 'bg-primary border-primary text-slate-800' : 'border-slate-300 bg-white'
                    }`}>
                      {isChecked && <span className="material-symbols-outlined text-xs font-bold text-slate-800-force">check</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ophthalmology Refraction Rx Grid */}
          {isOphthalmology && (
            <div className="space-y-4 pt-5 border-t border-slate-100 animate-fade-in text-left">
              <OphthalmicRefractionGrid 
                value={refractionRx} 
                onChange={setRefractionRx} 
              />
              
              <BiometryWorksheet 
                value={biometryRx} 
                onChange={setBiometryRx} 
              />
            </div>
          )}



          {/* Pod-to-Pod Network Referral */}
          <div className="border-t border-slate-100 pt-5 mt-5 space-y-3 text-left">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-xs text-primary font-bold">groups</span>
              Refer to Pod Partner Specialist
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
                <span className="material-symbols-outlined text-slate-600 absolute right-3 top-2.5 text-sm pointer-events-none">arrow_drop_down</span>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex justify-end pt-5 border-t border-slate-100">
            <button
              onClick={handleSaveEncounter}
              className="btn-primary px-8 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer text-slate-800-force"
            >
              <CheckCircle2 className="h-5 w-5 text-slate-800-force" /> Submit Encounter & Route Mappings
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
