import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  FlaskConical, 
  QrCode, 
  MessageSquare, 
  ShieldCheck, 
  AlertTriangle, 
  Pill 
} from 'lucide-react';
import { api } from '../../../services/api';
import { LabService } from '../../../services/labService';
import { SearchInput } from '../../ui/SearchInput';
import type { Patient } from '../../../types';

interface ClinicalHubTabProps {
  clinicalSubTab?: 'labs' | 'pharmacy';
  setClinicalSubTab?: (tab: 'labs' | 'pharmacy') => void;
  isOphthalmology: boolean;
  patients: Patient[];
  activePod: any;
  clinicTitle: string;
  fullLabReports: any[];
  activeInventory?: any[];
  medSearchQuery?: string;
  setMedSearchQuery?: (q: string) => void;
}

export const ClinicalHubTab: React.FC<ClinicalHubTabProps> = ({
  isOphthalmology,
  patients,
  activePod,
  clinicTitle,
  fullLabReports
}) => {
  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Executive Diagnostics & Pathology Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 sm:p-4 bg-slate-100/90 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-white/5 select-none mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-teal-500/20 shrink-0">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {isOphthalmology ? 'Diagnostic Labs & Ophthalmic Biometry' : 'Diagnostic Labs & Pathology Hub'}
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60">
                100% Viewport
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Sample collection barcodes, LOINC test orders, unverified report review & Smart Queue slot allocation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            Pathology Worklist Active
          </span>
        </div>
      </div>

      {/* Diagnostics & Pathology Worklist Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          {/* Left Column: Scheduled Pathology Tests Queue */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="glass-panel p-4 sm:p-6 border-slate-200/80 dark:border-white/10 shadow-xl relative overflow-hidden bg-white dark:bg-slate-900/90 text-slate-800 dark:text-white rounded-3xl">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-teal-500 to-indigo-600 opacity-80" />
              <div className="flex items-center justify-between gap-3 mb-2">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  Pathology Lab Requisition Queue
                </h2>
                <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/80 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
                  Live Worklist
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Clinical operational queue showing all laboratory orders, sample collection tracking, and processing status.
              </p>

              {(() => {
                const reqs = LabService.getLabRequisitions();
                if (reqs.length === 0) {
                  return (
                    <div className="p-8 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30">
                      <FlaskConical className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">No Lab Orders Today</div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Doctor-ordered pathology tests and sample collection requests will appear here.</p>
                    </div>
                  );
                }
                return (
                  <div className="border border-slate-200/80 dark:border-white/10 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/50 shadow-xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/90 dark:bg-slate-900 border-b border-slate-200/80 dark:border-white/10">
                          <th className="p-3 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase tracking-wider font-mono">Patient</th>
                          <th className="p-3 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase tracking-wider font-mono">Test Order</th>
                          <th className="p-3 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase tracking-wider font-mono text-center">Status</th>
                          <th className="p-3 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase tracking-wider font-mono text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                        {reqs.map((req) => {
                          let statusClass = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
                          if (req.status === 'pending') statusClass = "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-700 animate-pulse";
                          else if (req.status === 'collected') statusClass = "bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-700";
                          else if ((req as any).status === 'processed') statusClass = "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700";
                          else if ((req as any).status === 'completed' || Boolean(req.quantitativeResult)) statusClass = "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700";

                          const isReady = (req as any).status === 'completed' || Boolean(req.quantitativeResult);

                          return (
                            <tr key={req.id} className="hover:bg-white/60 dark:hover:bg-white/5 transition-colors">
                              <td className="p-3">
                                <div className="font-extrabold text-slate-900 dark:text-white">{req.patientName}</div>
                                <span className="text-[9px] text-slate-400 font-mono block">ID: {(req.patientId || '').substring(0, 8)}</span>
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-slate-800 dark:text-slate-200">{req.testName}</div>
                                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono block">LOINC: {req.testCode}</span>
                              </td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 border rounded-full text-[9px] font-bold uppercase tracking-wider ${statusClass}`}>
                                  {req.status}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                {isReady ? (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const p = patients.find(pt => pt.id === req.patientId);
                                      if (p?.phone) {
                                        await api.dispatchLabArrivalRevisitAlert({
                                          patientPhone: p.phone,
                                          patientName: req.patientName,
                                          testName: req.testName,
                                          revisitSlotTime: '04:30 PM - 05:30 PM',
                                          doctorName: activePod?.doctor_name,
                                          clinicName: clinicTitle
                                        });
                                        window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                          detail: {
                                            title: 'Revisit WhatsApp Sent 📲',
                                            message: `Doctor re-visit timing alert sent to ${req.patientName} on WhatsApp!`,
                                            type: 'success'
                                          }
                                        }));
                                      }
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-[10px] font-bold cursor-pointer transition active:scale-95 shadow-sm border-0"
                                  >
                                    <MessageSquare className="w-3 h-3 text-white" />
                                    <span>WhatsApp Alert</span>
                                  </button>
                                ) : (
                                  <span className="font-mono text-slate-500 dark:text-slate-400 text-[10px] font-bold">
                                    {req.barcode || 'SAMPLE-AWAITING'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Right Column: Approved Lab Reports Timeline */}
          <div className="lg:col-span-5 space-y-6 text-left select-none">
            <div className="glass-panel p-4 sm:p-6 border-slate-200/80 dark:border-white/10 shadow-xl relative overflow-hidden bg-white dark:bg-slate-900/90 text-slate-800 dark:text-white rounded-3xl">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-emerald-500 to-teal-500 opacity-80" />
              
              <div className="flex items-center justify-between gap-3 mb-2">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Approved Diagnostics
                </h2>
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  Verified
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Chronological log of verified diagnostic outcomes, critical biomarkers, and scheduled physician final review timings.
              </p>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {(() => {
                  const approved = (fullLabReports || []).filter(r => r && (r.status === 'approved' || (r as any).status === 'completed'));
                  if (approved.length === 0) {
                    return (
                      <div className="p-8 bg-slate-50/50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                        No verified pathology reports logged today.
                      </div>
                    );
                  }

                  return approved.map((report) => {
                    let biomarkers: Record<string, any> = {};
                    try {
                      if (typeof report.biomarkerJson === 'string') {
                        const parsed = JSON.parse(report.biomarkerJson);
                        biomarkers = parsed?.biomarkers || parsed || {};
                      } else if (report.biomarkerJson && typeof report.biomarkerJson === 'object') {
                        biomarkers = report.biomarkerJson.biomarkers || report.biomarkerJson;
                      }
                    } catch (_e) {
                      biomarkers = {};
                    }
                    if (typeof biomarkers !== 'object' || biomarkers === null) {
                      biomarkers = {};
                    }

                    return (
                      <div key={report.id} className="p-3.5 border border-slate-200/80 dark:border-white/10 rounded-2xl bg-slate-50/60 dark:bg-slate-800/60 space-y-2.5 shadow-xs">
                        <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-white/10 pb-2">
                          <div>
                            <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">{report.patientName || 'Patient'}</h4>
                            <span className="text-[9px] text-slate-400 font-mono block">ID: {(report.patientId || '').substring(0, 8)}</span>
                          </div>
                          <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full font-mono font-bold uppercase">
                            Verified ✅
                          </span>
                        </div>

                        <div className="space-y-1">
                          <span className="block text-[8px] font-black text-slate-500 dark:text-slate-400 tracking-widest uppercase font-mono">Biomarker Log</span>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {Object.keys(biomarkers).filter(k => !k.endsWith('_unit')).map(key => {
                              const val = biomarkers[key];
                              const unit = biomarkers[`${key}_unit`] || biomarkers.unit || '';
                              return (
                                <span key={key} className="bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10px] px-2 py-0.5 rounded-lg font-mono font-bold">
                                  {key}: {String(val)} {unit}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        {report.revisitScheduledAt && (
                          <div className="p-2.5 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-[10px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
                            <strong>📅 Locked Revisit Consult:</strong> {new Date(report.revisitScheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                            {report.revisitNote && <p className="mt-0.5 text-slate-600 dark:text-slate-400 italic">Note: {report.revisitNote}</p>}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
