import React from 'react';
import { api } from '../../../services/api';
import type { Patient, DiagnosticTest, MedicationRequest } from '../../../types';
import { CheckCircle2 } from 'lucide-react';
import { OphthalmologyPatientAnalysisPanel } from '../OphthalmologyPatientAnalysisPanel';
import { OphthalmicRefractionGrid } from '../OphthalmicRefractionGrid';
import { 
  EMPTY_REFRACTION_RX, 
  getAcuityRank, 
  OPHTHALMIC_EYE_CARE_COPY, 
  type RefractionRx 
} from '../../../types/ophthalmic';

interface ConsultationTabProps {
  patients: Patient[];
  selectedPatient: Patient | null;
  setSelectedPatient: (p: Patient | null) => void;
  medications: Omit<MedicationRequest, 'id'>[];
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
  comparativeTrend: string;
  setComparativeTrend: (s: string) => void;
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
  const activeHistory = selectedPatient ? api.getPatientHistoricalBiomarkers(selectedPatient.id) : null;
  const baseReport = activeHistory?.find(h => h.date === baselineDate) ?? null;
  const compReport = activeHistory?.find(h => h.date === comparisonDate) ?? (activeHistory ? activeHistory[activeHistory.length - 1] : null);
  const isConsentActive = selectedPatient ? api.isPatientConsentActive(selectedPatient.id) : true;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in text-slate-855">
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
                    <span className="text-[8px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-mono">
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
                      <span className="text-[8px] bg-indigo-50 border border-indigo-150 text-indigo-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-mono">
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
            <div className="flex items-center gap-2">
              {handleLaunchVideoConsult && (
                <button
                  type="button"
                  onClick={handleLaunchVideoConsult}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-slate-800 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border-0 text-slate-800-force bg-indigo-600-force"
                >
                  <span className="material-symbols-outlined text-[12px] text-slate-800-force animate-pulse">video_call</span>
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
                      color: getAcuityRank(recent.temperature || '6/6') > 2 ? 'from-rose-50 to-rose-100/50 border-rose-200 text-rose-700' : 'from-emerald-50 to-emerald-100/50 border-emerald-200 text-emerald-700'
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
                      color: (recent.pulseRate || 16) > 21 ? 'from-rose-50 to-rose-100/50 border-rose-200 text-rose-700' : 'from-emerald-50 to-emerald-100/50 border-emerald-200 text-emerald-700'
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
                      color: getAcuityRank(recent.bloodPressure || '6/9') > 3 ? 'from-rose-50 to-rose-100/50 border-rose-200 text-rose-700' : 'from-emerald-50 to-emerald-100/50 border-emerald-200 text-emerald-700'
                    }
                  ].map((item, idx) => (
                    <div key={idx} className={`p-3.5 rounded-2xl border bg-gradient-to-b ${item.color} flex flex-col justify-between space-y-2`}>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] text-slate-650 font-bold uppercase tracking-wider">{item.name}</span>
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
                      color: recent.HbA1c > 6.5 ? 'from-rose-50 to-rose-100/50 border-rose-200 text-rose-700' : recent.HbA1c > 5.7 ? 'from-amber-50 to-amber-100/50 border-amber-250 text-amber-900' : 'from-emerald-50 to-emerald-100/50 border-emerald-200 text-emerald-700'
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
                      color: recent.creatinine > 1.2 ? 'from-rose-50 to-rose-100/50 border-rose-200 text-rose-700' : recent.creatinine > 1.0 ? 'from-amber-50 to-amber-100/50 border-amber-250 text-amber-900' : 'from-emerald-50 to-emerald-100/50 border-emerald-200 text-emerald-700'
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
                      color: recent.hemoglobin < 12.0 ? 'from-amber-50 to-amber-100/50 border-amber-250 text-amber-900' : 'from-emerald-50 to-emerald-100/50 border-emerald-200 text-emerald-700'
                    }
                  ].map((item, idx) => (
                    <div key={idx} className={`p-3.5 rounded-2xl border bg-gradient-to-b ${item.color} flex flex-col justify-between space-y-2`}>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] text-slate-650 font-bold uppercase tracking-wider">{item.name}</span>
                        <span className="text-[9px] text-slate-600 font-mono">Normal: {item.normal}</span>
                      </div>
                      <div className="flex justify-between items-baseline pt-1">
                        <span className="text-lg font-black font-mono tracking-tight text-slate-800">{item.val}</span>
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
                            : 'bg-indigo-50 border-indigo-200 text-indigo-850'
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
                      className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-505 active:scale-95 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2 uppercase transition-all shadow-md cursor-pointer border-0 text-slate-800-force"
                    >
                      <span className="material-symbols-outlined text-sm font-bold shrink-0">mic</span>
                      Record Clinical Advice
                    </button>
                  )}
                </div>

                {audioUrl && (
                  <div className="w-full sm:flex-1 bg-slate-955 border border-slate-850 p-2 rounded-xl flex items-center justify-between gap-3">
                    <audio src={audioUrl} controls className="w-full h-8 shrink" />
                    
                    <button
                      type="button"
                      onClick={executeAudioScribeTranscription}
                      disabled={isTranscribing}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 active:scale-95 disabled:opacity-50 text-slate-800 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1.5 uppercase transition-all shadow-xs cursor-pointer shrink-0 border-0 text-slate-800-force"
                    >
                      <span className="material-symbols-outlined text-xs font-bold text-slate-800-force">psychology</span>
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
                className="w-full bg-primary hover:bg-primary-505 text-slate-800 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 text-slate-800-force cursor-pointer border-0"
              >
                {isGeneratingSummary ? 'Generating...' : '🤖 Generate AI Hinglish Summary'}
              </button>
            </div>

            {hinglishSummary && (
              <div className="p-4 bg-indigo-50/60 border border-indigo-150 rounded-xl space-y-3 animate-fade-in text-left">
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
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-800 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 uppercase transition-colors cursor-pointer border-0"
                >
                  <span className="material-symbols-outlined text-xs text-slate-800-force">send</span>
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
                    className="w-full bg-rose-600 hover:bg-rose-550 text-slate-800 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer text-slate-800-force border-0"
                  >
                    {isGeneratingTrend ? 'Analyzing...' : '📊 Generate Comparative AI Summary'}
                  </button>
                </div>

                {comparativeTrend && (
                  <div className="p-4 bg-rose-55 border border-rose-100 rounded-xl space-y-3 animate-fade-in text-left">
                    <h4 className="font-bold text-[10px] text-rose-700 uppercase tracking-widest font-mono flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-xs">trending_down</span>
                      Biomarker Improvement Trend
                    </h4>
                    <p className="text-xs text-slate-755 leading-relaxed font-semibold italic">
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
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-800 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 uppercase transition-colors cursor-pointer border-0"
                    >
                      <span className="material-symbols-outlined text-xs text-slate-800-force">send</span>
                      Push Trend report to Patient WhatsApp
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Prescribe Medications */}
          <div className="space-y-4 text-left border-t border-slate-100 pt-5">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-xs text-primary font-bold">medication</span>
              Prescribe Medications (e-Rx)
            </label>

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
              <p className="text-xs text-slate-505 italic bg-slate-50/50 p-4 border border-dashed border-slate-200 rounded-xl text-center">
                No medications prescribed yet. Add a medication below.
              </p>
            )}

            {/* Form to add medication */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50/30 p-4 border border-slate-200/50 rounded-xl">
              <div className="sm:col-span-2 space-y-1">
                <span className="text-[10px] font-bold text-slate-550 uppercase">Medicine Name</span>
                <input
                  type="text"
                  placeholder="e.g. Paracetamol 650mg"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  className="w-full input-field py-1.5 text-xs bg-white border-slate-200"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-550 uppercase">Dosage</span>
                <input
                  type="text"
                  placeholder="e.g. 1 tab"
                  value={medDosage}
                  onChange={(e) => setMedDosage(e.target.value)}
                  className="w-full input-field py-1.5 text-xs bg-white border-slate-200"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-550 uppercase">Frequency</span>
                <input
                  type="text"
                  placeholder="e.g. 1-0-1"
                  value={medFreq}
                  onChange={(e) => setMedFreq(e.target.value)}
                  className="w-full input-field py-1.5 text-xs bg-white border-slate-200"
                />
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
                        : 'bg-slate-50 border-slate-200/50 text-slate-505 hover:bg-slate-100'
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
            <div className="space-y-3 pt-5 border-t border-slate-100 animate-fade-in text-left">
              <OphthalmicRefractionGrid 
                value={refractionRx} 
                onChange={setRefractionRx} 
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
