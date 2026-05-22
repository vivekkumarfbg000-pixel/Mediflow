import React, { useState, useEffect } from 'react';
import { api, MASTER_TEST_CATALOG } from '../../services/api';
import type { Patient, DiagnosticTest, MedicationRequest } from '../../types';
import { 
  Trash2, 
  CheckCircle2, 
  AlertTriangle
} from 'lucide-react';

export const DoctorDashboard: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  
  // Encounter Form state
  const [notes, setNotes] = useState('');
  const [medications, setMedications] = useState<Omit<MedicationRequest, 'id'>[]>([]);
  const [selectedTests, setSelectedTests] = useState<DiagnosticTest[]>([]);
  
  // Single medication builder inputs
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medFreq, setMedFreq] = useState('1-0-1');
  const [medDur, setMedDur] = useState('5 Days');

  // CDSS Biomarker metrics
  const [cdssAnomalies, setCdssAnomalies] = useState<string[]>([]);

  // RAG Clinical Insight Engine states
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    const syncPatients = () => {
      const registered = api.getPatients();
      setPatients(registered);
      setSelectedPatient((prev: Patient | null) => {
        if (!prev) return registered.length > 0 ? registered[0] : null;
        const stillExists = registered.find(p => p.id === prev.id);
        return stillExists || (registered.length > 0 ? registered[0] : null);
      });
    };

    syncPatients();
    return api.subscribe(syncPatients);
  }, []);

  useEffect(() => {
    if (!selectedPatient) return;
    
    // Evaluate clinical risks for CDSS anomalies (HbA1c & Creatinine)
    const history = api.getPatientHistoricalBiomarkers(selectedPatient.id);
    const anomalies: string[] = [];
    
    if (history && history.length > 0) {
      const latest = history[history.length - 1];
      const previous = history[history.length - 2];
      
      if (latest.creatinine > 1.2) {
        anomalies.push(`Warning: Serum Creatinine is ${latest.creatinine} mg/dL (Abnormal > 1.2). Significant upward trend from ${previous.creatinine} mg/dL observed over 30 days.`);
      }
      if (latest.HbA1c > 6.5) {
        anomalies.push(`Alert: HbA1c is ${latest.HbA1c}% (Diabetic threshold > 6.5%). Although HbA1c has improved from ${previous.HbA1c}%, glycemic levels remain elevated.`);
      }
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
        const apiCall = new Promise<string>((resolve, reject) => {
          setTimeout(() => {
            // 15% rate of transient failures (HTTP 429/503) to prove fallback behavior
            if (Math.random() < 0.15) {
              reject(new Error("RAG engine timed out or returned HTTP 429 Rate Limit."));
              return;
            }
            
            const latest = history ? history[history.length - 1] : null;
            const previous = history ? history[history.length - 2] : null;
            
            let insight = `### Clinical Advisory (RAG-Generated)\n\n`;
            insight += `Patient **${selectedPatient.name}** (${selectedPatient.age}y, ${selectedPatient.gender}) shows `;
            if (selectedPatient.chronicConditions.length > 0) {
              insight += `chronic history of **${selectedPatient.chronicConditions.join(' & ')}**.\n\n`;
            } else {
              insight += `no reported chronic conditions.\n\n`;
            }
            
            if (latest) {
              insight += `**Biomarker Summary:**\n`;
              insight += `- **HbA1c**: Currently **${latest.HbA1c}%** (previously **${previous?.HbA1c}%**). Glycemic control is improving but elevated.\n`;
              insight += `- **Creatinine**: Elevated at **${latest.creatinine} mg/dL** (previously **${previous?.creatinine} mg/dL**). Significant upward trajectory indicates high cardiorenal strain.\n`;
              insight += `- **Hemoglobin**: **${latest.hemoglobin} g/dL**, GFR protection is highly recommended.\n\n`;
            }
            
            if (selectedPatient.allergies.includes('Penicillin')) {
              insight += `⚠️ **CRITICAL CONTRAINDICATION**: Documented **Penicillin** allergy. Do NOT prescribe penicillin-class agents.\n\n`;
            }
            
            insight += `**Intervention Recommendations:**\n`;
            insight += `1. Consider cardioprotective **SGLT2 inhibitors** (e.g. Empagliflozin).\n`;
            insight += `2. Schedule a follow-up repeat **Serum Creatinine & GFR** in 14 days.\n`;
            
            resolve(insight);
          }, 1200);
        });
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error("RAG Engine connection timed out after 5000ms."));
          });
        });
        
        const result = await Promise.race([apiCall, timeoutPromise]);
        clearTimeout(timeoutId);
        setAiInsight(result);
      } catch (err: any) {
        clearTimeout(timeoutId);
        console.error("[Mediflow CDSS] RAG Insight fetch failed:", err);
        setAiError(err.message || "RAG engine is offline.");
        
        // Log in immutable activity_logs
        api.writeAuditLog('SYSTEM_ERROR', {
          action: 'fetchRAGInsights',
          patientId: selectedPatient.id,
          error: err.message || 'Timeout/Rate Limit'
        }, selectedPatient.id);
        
        // Dispatch warning toast
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
  }, [selectedPatient]);

  const handleAddMedication = () => {
    if (!medName || !medDosage) return;
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

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
      {/* LEFT COLUMN: Patient queue, CDSS Analyzer */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Patient Consultation Queue */}
        <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary to-secondary opacity-50" />
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary animate-pulse text-xl">group</span>
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
                      ? 'bg-surface-container border-primary shadow-lg ring-1 ring-primary/20' 
                      : 'bg-surface-container-lowest border-outline-variant hover:border-outline hover:bg-surface-container-low'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-primary" />
                  )}
                  <div className="flex justify-between items-start">
                    <div className="font-bold text-sm text-white group-hover:text-primary transition-colors">{p.name}</div>
                    <span className="text-[10px] text-clinical-400 bg-surface-container-highest px-2 py-0.5 rounded font-mono">
                      {p.id.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="text-xs text-clinical-300 mt-2 flex justify-between items-center">
                    <span>{p.gender}, {p.age} years</span>
                    {p.abhaId && (
                      <span className="bg-secondary/10 text-secondary border border-secondary/20 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider font-mono">
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
          <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-secondary to-primary opacity-50" />
            <h2 className="text-lg font-bold text-white mb-1.5 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-xl">insights</span>
              CDSS Lab Analyzer
            </h2>
            <p className="text-[11px] text-clinical-400 mb-5 leading-relaxed">
              AI comparative biomarker metrics tracking and warning engine.
            </p>

            {activeHistory ? (
              <div className="space-y-6 animate-fade-in">
                
                {/* RAG Clinical Insight States */}
                {isAiLoading && (
                  <div className="glass-panel-inner p-4 border-white/5 bg-surface-container-lowest/30 rounded-xl space-y-3 animate-pulse">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-secondary animate-spin">sync</span>
                      <div className="h-3 w-1/3 bg-white/10 rounded" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 w-full bg-white/5 rounded" />
                      <div className="h-2 w-11/12 bg-white/5 rounded" />
                      <div className="h-2 w-4/5 bg-white/5 rounded" />
                    </div>
                  </div>
                )}

                {aiError && !isAiLoading && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs rounded-xl flex gap-3 leading-relaxed animate-fade-in">
                    <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5 animate-pulse" />
                    <div className="space-y-1">
                      <div className="font-bold text-amber-200">CDSS RAG Engine Offline</div>
                      <p>Falling back to local clinical biomarkers. RAG engine offline: <span className="text-[11px] font-mono text-amber-400 font-semibold">{aiError}</span></p>
                    </div>
                  </div>
                )}

                {aiInsight && !isAiLoading && (
                  <div className="glass-panel-inner p-4 border-emerald-500/15 bg-emerald-500/5 rounded-xl space-y-2 animate-fade-in text-xs text-clinical-200">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold tracking-wide uppercase text-[9px] font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      RAG Clinical Advisory Active
                    </div>
                    <div className="space-y-2 whitespace-pre-line leading-relaxed">
                      {aiInsight.replace('### Clinical Advisory (RAG-Generated)\n\n', '')}
                    </div>
                  </div>
                )}

                {/* Present vs. Past Lab Comparative Analysis Banner */}
                <div className="glass-panel-inner p-4 border-white/5 bg-surface-container-lowest/50 rounded-xl space-y-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-secondary to-transparent opacity-45" />
                  <h4 className="font-bold text-[10px] text-clinical-300 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                    <span className="material-symbols-outlined text-xs text-secondary">analytics</span>
                    Present vs. Past Lab Comparative Analysis
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px] text-left text-clinical-300">
                      <thead>
                        <tr className="border-b border-outline-variant text-clinical-400 font-bold uppercase tracking-wider font-mono text-[8px]">
                          <th className="pb-2">Biomarker</th>
                          <th className="pb-2">Past (30d)</th>
                          <th className="pb-2">Present (2026-05-22)</th>
                          <th className="pb-2">Change</th>
                          <th className="pb-2 text-right">Clinical Risk</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/30">
                        {(() => {
                          const latest = activeHistory[activeHistory.length - 1];
                          const previous = activeHistory[activeHistory.length - 2];
                          
                          const hDiff = (latest.HbA1c - previous.HbA1c).toFixed(1);
                          const hDiffNum = parseFloat(hDiff);
                          
                          const cDiff = (latest.creatinine - previous.creatinine).toFixed(2);
                          const cDiffNum = parseFloat(cDiff);

                          const hbDiff = (latest.hemoglobin - previous.hemoglobin).toFixed(1);
                          const hbDiffNum = parseFloat(hbDiff);

                          return (
                            <>
                              <tr className="hover:bg-surface-container/30 transition-colors">
                                <td className="py-2 font-semibold text-white">HbA1c (%)</td>
                                <td className="py-2 font-mono text-clinical-400">{previous.HbA1c}%</td>
                                <td className="py-2 font-mono text-white font-bold">{latest.HbA1c}%</td>
                                <td className={`py-2 font-mono font-bold ${hDiffNum < 0 ? 'text-emerald-400' : hDiffNum > 0 ? 'text-rose-400' : 'text-clinical-400'}`}>
                                  {hDiffNum > 0 ? `+${hDiff}` : hDiff}%
                                </td>
                                <td className="py-2 text-right">
                                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">
                                    Improving
                                  </span>
                                </td>
                              </tr>
                              <tr className="hover:bg-surface-container/30 transition-colors">
                                <td className="py-2 font-semibold text-white">Creatinine (mg/dL)</td>
                                <td className="py-2 font-mono text-clinical-400">{previous.creatinine}</td>
                                <td className="py-2 font-mono text-white font-bold">{latest.creatinine}</td>
                                <td className={`py-2 font-mono font-bold ${cDiffNum > 0 ? 'text-rose-400' : cDiffNum < 0 ? 'text-emerald-400' : 'text-clinical-400'}`}>
                                  {cDiffNum > 0 ? `+${cDiff}` : cDiff}
                                </td>
                                <td className="py-2 text-right">
                                  <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider animate-pulse">
                                    CKD Stage 2 Risk
                                  </span>
                                </td>
                              </tr>
                              <tr className="hover:bg-surface-container/30 transition-colors">
                                <td className="py-2 font-semibold text-white">Hemoglobin (g/dL)</td>
                                <td className="py-2 font-mono text-clinical-400">{previous.hemoglobin}</td>
                                <td className="py-2 font-mono text-white font-bold">{latest.hemoglobin}</td>
                                <td className={`py-2 font-mono font-bold ${hbDiffNum > 0 ? 'text-emerald-400' : hbDiffNum < 0 ? 'text-rose-400' : 'text-clinical-400'}`}>
                                  {hbDiffNum > 0 ? `+${hbDiff}` : hbDiff}
                                </td>
                                <td className="py-2 text-right">
                                  <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">
                                    Mild Anemia
                                  </span>
                                </td>
                              </tr>
                            </>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SVG Visual graph charts */}
                <div className="glass-panel-inner p-4 border-white/5 bg-surface-container-lowest/50 rounded-xl space-y-5">
                  <h4 className="font-bold text-[10px] text-clinical-300 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-xs text-primary">show_chart</span>
                    Biomarker Trajectory (30-Day Intervals)
                  </h4>
                  
                  {/* HbA1c SVG representation */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-clinical-400 font-medium">
                        HbA1c (%) <span className="text-[10px] text-clinical-500 font-mono block mt-0.5">Ref: 4.0 - 5.6% (LOINC 4544-3)</span>
                      </span>
                      <span className="font-semibold text-secondary flex items-center gap-1 text-[10px] bg-secondary/10 px-1.5 py-0.5 rounded self-start">
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                        Downward Trend
                      </span>
                    </div>
                    <div className="h-16 relative border-l border-b border-outline-variant p-1">
                      <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="hba1c-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#4fdbc8" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#4fdbc8" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M 10,32 Q 50,22 90,16 L 90,40 L 10,40 Z"
                          fill="url(#hba1c-grad)"
                        />
                        <path
                          className="svg-graph-line"
                          d="M 10,32 Q 50,22 90,16"
                          fill="none"
                          stroke="#4fdbc8"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <circle cx="10" cy="32" r="2.5" fill="#4fdbc8" />
                        <circle cx="50" cy="22" r="2.5" fill="#4fdbc8" />
                        <circle cx="90" cy="16" r="3.5" fill="#04b4a2" stroke="#ffffff" strokeWidth="1" className="animate-pulse" />
                      </svg>
                    </div>
                  </div>

                  {/* Creatinine SVG representation */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-clinical-400 font-medium">
                        Serum Creatinine (mg/dL) <span className="text-[10px] text-clinical-500 font-mono block mt-0.5">Ref: 0.6 - 1.2 mg/dL (LOINC 2160-0)</span>
                      </span>
                      <span className="font-semibold text-rose-400 flex items-center gap-1 text-[10px] bg-rose-500/10 px-1.5 py-0.5 rounded self-start">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        Rising Trend
                      </span>
                    </div>
                    <div className="h-16 relative border-l border-b border-outline-variant p-1">
                      <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="creat-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ffb4ab" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#ffb4ab" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M 10,32 Q 50,25 90,12 L 90,40 L 10,40 Z"
                          fill="url(#creat-grad)"
                        />
                        <path
                          className="svg-graph-line"
                          d="M 10,32 Q 50,25 90,12"
                          fill="none"
                          stroke="#ff897d"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <circle cx="10" cy="32" r="2.5" fill="#ff897d" />
                        <circle cx="50" cy="25" r="2.5" fill="#ff897d" />
                        <circle cx="90" cy="12" r="3.5" fill="#93000a" stroke="#ffb4ab" strokeWidth="1" className="animate-pulse" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Passive Warnings Panel */}
                <div className="space-y-3">
                  {cdssAnomalies.map((anomaly: string, idx: number) => (
                    <div key={idx} className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex gap-3 leading-relaxed">
                      <AlertTriangle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
                      <span>{anomaly}</span>
                    </div>
                  ))}
                </div>

                <div className="text-[10px] text-clinical-500 italic bg-surface-container-lowest/80 border border-outline-variant p-3 rounded-lg leading-relaxed flex gap-2">
                  <span className="material-symbols-outlined text-[12px] text-primary flex-shrink-0 mt-0.5">info</span>
                  <span>CDSS alerts are passive recommendations based on LOINC references. Final prescribing decision lies with the registered clinician.</span>
                </div>

              </div>
            ) : (
              <div className="text-center py-8 text-clinical-500 text-sm">
                No historical diagnostic biomarkers available for this profile.
              </div>
            )}
          </div>
        )}

      </div>

      {/* RIGHT COLUMN: Consultation Sheet, e-Rx Form */}
      {selectedPatient && (
        <div className="lg:col-span-8 glass-panel p-6 border-white/10 shadow-xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary via-secondary to-primary opacity-50" />
          <div className="border-b border-outline-variant pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">clinical_notes</span>
                Electronic Consultation Record
              </h2>
              <p className="text-xs text-clinical-400 mt-1">
                Selected: <strong className="text-white font-semibold">{selectedPatient.name}</strong> ({selectedPatient.age}y, {selectedPatient.gender})
              </p>
            </div>
            {selectedPatient.abhaId && (
              <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full font-bold tracking-wider uppercase font-mono">
                ABHA Verified
              </span>
            )}
          </div>

          {/* Clinical Notes */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-clinical-300 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-xs text-primary">edit_note</span>
              Consultation & Clinical Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Presenting complaints, systemic examination notes, and diagnosis..."
              rows={4}
              className="w-full input-field resize-none focus:ring-1 focus:ring-primary focus:border-primary text-sm leading-relaxed"
            />
          </div>

          {/* Diagnostic Requisitions Section */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-clinical-300 uppercase tracking-wider flex items-center gap-1.5">
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
                    className={`flex items-center justify-between p-4 rounded-xl border text-left text-xs transition-all duration-300 ${
                      isChecked
                        ? 'bg-primary-container/20 border-primary text-white shadow-md'
                        : 'bg-surface-container-lowest border-outline-variant text-clinical-400 hover:border-outline hover:bg-surface-container-low'
                    }`}
                  >
                    <div>
                      <span className="font-bold block text-white">{test.name}</span>
                      <span className="text-[9px] text-clinical-400 uppercase mt-1 block font-mono bg-surface-container-high px-1.5 py-0.5 rounded w-max">
                        LOINC: {test.loincCode}
                      </span>
                    </div>
                    <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                      isChecked ? 'bg-primary border-primary text-white shadow-sm' : 'border-outline-variant bg-surface-container'
                    }`}>
                      {isChecked && <span className="material-symbols-outlined text-xs font-bold">check</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Medication e-Prescription (e-Rx) Builder */}
          <div className="space-y-4 pt-5 border-t border-outline-variant">
            <label className="block text-xs font-bold text-clinical-300 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-xs text-primary">pill</span>
              e-Prescription Builder (FHIR R4 MedicationRequest Output)
            </label>
            
            {/* Med Single entry row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-surface-container-lowest/80 p-4 rounded-xl border border-outline-variant">
              <div>
                <label className="block text-[10px] text-clinical-400 mb-1.5 uppercase font-semibold">Generic / Brand Name</label>
                <input
                  type="text"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  placeholder="Metformin 500mg"
                  className="w-full input-field py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-clinical-400 mb-1.5 uppercase font-semibold">Dosage</label>
                <input
                  type="text"
                  value={medDosage}
                  onChange={(e) => setMedDosage(e.target.value)}
                  placeholder="1 Tab"
                  className="w-full input-field py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-clinical-400 mb-1.5 uppercase font-semibold">Frequency</label>
                <select
                  value={medFreq}
                  onChange={(e) => setMedFreq(e.target.value)}
                  className="w-full input-field py-2 bg-clinical-950 text-xs"
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
                  <label className="block text-[10px] text-clinical-400 mb-1.5 uppercase font-semibold">Duration</label>
                  <input
                     type="text"
                     value={medDur}
                     onChange={(e) => setMedDur(e.target.value)}
                     placeholder="10 Days"
                     className="w-full input-field py-2 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddMedication}
                  className="btn-primary p-2 flex items-center justify-center hover:scale-105 active:scale-95 text-xs rounded-lg w-10 h-9.5 shrink-0"
                >
                  <span className="material-symbols-outlined text-base font-bold">add</span>
                </button>
              </div>
            </div>

            {/* Prescribed List */}
            {medications.length > 0 && (
              <div className="border border-outline-variant rounded-xl overflow-hidden glass-panel-inner">
                <table className="w-full text-xs text-left">
                  <thead className="bg-surface-container text-clinical-300 border-b border-outline-variant font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3.5">Medicine Name</th>
                      <th className="p-3.5">Dosage</th>
                      <th className="p-3.5">Frequency</th>
                      <th className="p-3.5">Duration</th>
                      <th className="p-3.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant bg-surface-container-lowest/30">
                    {medications.map((med: Omit<MedicationRequest, 'id'>, idx: number) => (
                      <tr key={idx} className="hover:bg-surface-container/50 transition-colors">
                        <td className="p-3.5 text-white font-semibold">{med.medicineName}</td>
                        <td className="p-3.5 text-clinical-300 font-mono">{med.dosage}</td>
                        <td className="p-3.5 text-clinical-300 font-mono">{med.frequency}</td>
                        <td className="p-3.5 text-clinical-300 font-mono">{med.duration}</td>
                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveMedication(idx)}
                            className="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg hover:bg-rose-500/20 transition-all active:scale-90"
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
          <div className="flex justify-end pt-5 border-t border-outline-variant">
            <button
              onClick={handleSaveEncounter}
              className="btn-primary px-8 flex items-center gap-2"
            >
              <CheckCircle2 className="h-5 w-5" /> Submit Encounter & Route Mappings
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
