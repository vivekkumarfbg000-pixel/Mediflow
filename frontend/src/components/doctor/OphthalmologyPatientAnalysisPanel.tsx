import React from 'react';
import type { HistoricalBiomarker, Patient } from '../../types';
import { getAcuityRank, OPHTHALMIC_EYE_CARE_COPY } from '../../types/ophthalmic';

interface OphthalmologyPatientAnalysisPanelProps {
  selectedPatient: Patient | null;
  history: HistoricalBiomarker[] | null;
  analyzingReport: HistoricalBiomarker | null;
  baselineDate: string | null;
  comparisonDate: string | null;
  onAnalyzeReport: (report: HistoricalBiomarker) => void;
  onCloseAnalysis: () => void;
}

export const OphthalmologyPatientAnalysisPanel: React.FC<OphthalmologyPatientAnalysisPanelProps> = ({
  selectedPatient,
  history,
  analyzingReport,
  baselineDate,
  comparisonDate,
  onAnalyzeReport,
  onCloseAnalysis
}) => {
  if (!selectedPatient) {
    return null;
  }

  const entries = history ?? [];
  const baseReport = entries.find((item) => item.date === baselineDate) ?? null;
  const compReport = entries.find((item) => item.date === comparisonDate) ?? (entries.length > 0 ? entries[entries.length - 1] : null);

  const renderAnalysisModal = () => {
    if (!analyzingReport) return null;

    const report = analyzingReport;
    const iop = report.pulseRate ?? OPHTHALMIC_EYE_CARE_COPY.iopFallback;
    const vaOD = report.temperature ?? OPHTHALMIC_EYE_CARE_COPY.odFallback;
    const vaOS = report.bloodPressure ?? OPHTHALMIC_EYE_CARE_COPY.osFallback;
    const baseOD = baseReport?.temperature ?? OPHTHALMIC_EYE_CARE_COPY.odFallback;
    const baseOS = baseReport?.bloodPressure ?? OPHTHALMIC_EYE_CARE_COPY.osFallback;
    const baseODRank = getAcuityRank(baseOD);
    const compODRank = getAcuityRank(vaOD);
    const baseOSRank = getAcuityRank(baseOS);
    const compOSRank = getAcuityRank(vaOS);
    const odDropped = baseODRank > 0 && compODRank > baseODRank;
    const osDropped = baseOSRank > 0 && compOSRank > baseOSRank;
    const isAcuityDropped = odDropped || osDropped;
    const isIopHigh = iop > 21;

    let riskTier = 'Low Risk';
    let riskReason = 'Intraocular pressures and visual acuity parameters are stable within normal physiological boundaries.';
    const complications: string[] = [];

    if (isIopHigh && isAcuityDropped) {
      riskTier = 'Critical Risk';
      riskReason = `Glaucoma Progression Risk: Intraocular Pressure is elevated at ${iop} mmHg. Avoid dilating drops. Trajectory Decline detected: Visual Acuity decreased from ${baseOD} (OD) / ${baseOS} (OS) to ${vaOD} (OD) / ${vaOS} (OS).`;
      complications.push('Severe Glaucoma Progression & Visual Field Loss');
      complications.push('Optic Nerve Cupping & Retinal Ganglion Cell Damage');
    } else if (isIopHigh) {
      riskTier = 'Critical Risk';
      riskReason = `Glaucoma Progression Risk: Intraocular Pressure is elevated at ${iop} mmHg. Avoid dilating drops. Close tracking and visual field scans required.`;
      complications.push('Ocular Hypertension / Suspicious Glaucoma');
    } else if (isAcuityDropped) {
      riskTier = 'High Risk';
      riskReason = `Visual Acuity Trajectory Decline: Vision dropped from ${baseOD} (OD) / ${baseOS} (OS) to ${vaOD} (OD) / ${vaOS} (OS). Reroute for immediate refraction mapping or dilated retinal exam.`;
      complications.push('Progressive Myopia / Refractive Error Shifts');
      complications.push('Retinal Pathology / Cataract Development');
    }

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-md p-4 md:p-8 animate-fade-in overflow-y-auto">
        <div className="glass-panel max-w-4xl w-full p-6 md:p-8 border-slate-200 shadow-2xl relative bg-white text-slate-800 rounded-3xl space-y-6 max-h-[90vh] overflow-y-auto">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 via-primary to-secondary" />

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200/80 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-400 text-2xl font-bold">clinical_notes</span>
                <h2 className="text-lg font-black text-slate-100 uppercase tracking-wider font-sans">{OPHTHALMIC_EYE_CARE_COPY.analysisTitle}</h2>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Eye-care review for patient: <strong className="text-slate-200 font-bold">{selectedPatient.name}</strong> ({selectedPatient.age}y, {selectedPatient.gender})
              </p>
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
                onClick={onCloseAnalysis}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-600 hover:text-slate-800 transition-colors cursor-pointer border-0 text-slate-800-force"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-6">
              <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest font-mono">1. Reference Range Audit & Diagnostics</h3>
              <div className="space-y-4">
                <div className="p-4 bg-white/40 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-slate-200">{OPHTHALMIC_EYE_CARE_COPY.odLabel}</span>
                    <span className="text-[10px] text-slate-600 font-mono">Ref Range: {OPHTHALMIC_EYE_CARE_COPY.odRefRange}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="text-xl font-black font-mono tracking-tight">{report.temperature || OPHTHALMIC_EYE_CARE_COPY.odFallback}</span>
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded font-mono ${getAcuityRank(report.temperature || OPHTHALMIC_EYE_CARE_COPY.odFallback) > 2 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {getAcuityRank(report.temperature || OPHTHALMIC_EYE_CARE_COPY.odFallback) > 2 ? 'Abnormal (Low)' : 'Normal'}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-white/40 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-slate-200">{OPHTHALMIC_EYE_CARE_COPY.iopLabel}</span>
                    <span className="text-[10px] text-slate-600 font-mono">Ref Range: {OPHTHALMIC_EYE_CARE_COPY.iopRefRange}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="text-xl font-black font-mono tracking-tight">{iop} mmHg</span>
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded font-mono ${iop > 21 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {iop > 21 ? 'Glaucoma Risk (High)' : 'Normal'}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-white/40 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-slate-200">{OPHTHALMIC_EYE_CARE_COPY.osLabel}</span>
                    <span className="text-[10px] text-slate-600 font-mono">Ref Range: {OPHTHALMIC_EYE_CARE_COPY.osRefRange}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="text-xl font-black font-mono tracking-tight">{report.bloodPressure || OPHTHALMIC_EYE_CARE_COPY.osFallback}</span>
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded font-mono ${getAcuityRank(report.bloodPressure || OPHTHALMIC_EYE_CARE_COPY.osFallback) > 3 ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {getAcuityRank(report.bloodPressure || OPHTHALMIC_EYE_CARE_COPY.osFallback) > 3 ? 'Abnormal (Low)' : 'Borderline'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest font-mono">2. AI Clinical Correlations</h3>
                <div className="p-4 bg-white/60 border border-slate-200 rounded-2xl text-xs space-y-2 leading-relaxed">
                  <strong className="text-indigo-400 block font-bold">Biomarker Interaction Profile</strong>
                  <p className="text-slate-600 text-[11px] font-medium leading-relaxed">{riskReason}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest font-mono">3. Future Potential Disease Forecasts</h3>
                {complications.length === 0 ? (
                  <div className="p-4 bg-white/20 border border-slate-200 rounded-2xl text-slate-600 text-xs italic">
                    No future potential risk patterns identified.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {complications.map((item, index) => (
                      <div key={index} className="p-3 bg-rose-950/20 border border-rose-900/30 rounded-xl flex items-center gap-2.5 text-xs text-rose-200">
                        <span className="material-symbols-outlined text-rose-400 text-sm shrink-0">warning</span>
                        <span className="font-bold">{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest font-mono">4. Safe Prescribing Directives</h3>
                <div className="p-4 bg-indigo-950/20 border border-indigo-900/30 rounded-2xl text-[11px] text-indigo-200 space-y-2">
                  <div className="flex gap-2 animate-fade-in">
                    <span className="material-symbols-outlined text-xs text-indigo-400 shrink-0 font-bold">check_circle</span>
                    <span>{isIopHigh ? 'STRICT CONFLICT: Avoid dilating drops (Atropine/Tropicamide) to prevent acute angle closure.' : 'Dilating drops cleared within safe intraocular pressure thresholds.'}</span>
                  </div>
                  <div className="flex gap-2 animate-fade-in">
                    <span className="material-symbols-outlined text-xs text-indigo-400 shrink-0 font-bold">check_circle</span>
                    <span>{isAcuityDropped ? 'Review spectacle prescription. Reroute to Optical Shop for lens grinding.' : 'Visual acuity cleared within functional limits.'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-200 pt-4 gap-3">
            <button
              onClick={onCloseAnalysis}
              className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-800 rounded-xl transition-colors cursor-pointer border-0 text-slate-800-force animate-fade-in"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="glass-panel p-6 border-slate-200/80 shadow-sm relative overflow-hidden bg-white mt-4">
        <h2 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">folder_zip</span>
          {OPHTHALMIC_EYE_CARE_COPY.timelineTitle}
        </h2>
        <p className="text-[10px] text-slate-600 mb-4">{OPHTHALMIC_EYE_CARE_COPY.timelineSubtitle}</p>

        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {entries.length === 0 ? (
            <div className="text-center py-6 text-slate-600 text-xs italic">
              No historical biomarker reports found.
            </div>
          ) : (
            entries.slice().reverse().map((report, index) => (
              <button
                key={index}
                onClick={() => onAnalyzeReport(report)}
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
                    <span className="text-slate-600 font-medium block">VA (OD)</span>
                    <span className="font-mono font-bold text-slate-700">{report.temperature || OPHTHALMIC_EYE_CARE_COPY.odFallback}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 font-medium block">IOP</span>
                    <span className="font-mono font-bold text-slate-700">{report.pulseRate ?? OPHTHALMIC_EYE_CARE_COPY.iopFallback} mmHg</span>
                  </div>
                  <div>
                    <span className="text-slate-600 font-medium block">VA (OS)</span>
                    <span className="font-mono font-bold text-slate-700">{report.bloodPressure || OPHTHALMIC_EYE_CARE_COPY.osFallback}</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {renderAnalysisModal()}
    </>
  );
};
