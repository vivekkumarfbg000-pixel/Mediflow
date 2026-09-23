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
  clinicalSubTab: 'labs' | 'pharmacy';
  setClinicalSubTab: (tab: 'labs' | 'pharmacy') => void;
  isOphthalmology: boolean;
  patients: Patient[];
  activePod: any;
  clinicTitle: string;
  fullLabReports: any[];
  activeInventory: any[];
  medSearchQuery: string;
  setMedSearchQuery: (q: string) => void;
}

export const ClinicalHubTab: React.FC<ClinicalHubTabProps> = ({
  clinicalSubTab,
  setClinicalSubTab,
  isOphthalmology,
  patients,
  activePod,
  clinicTitle,
  fullLabReports,
  activeInventory,
  medSearchQuery,
  setMedSearchQuery
}) => {
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Consolidated Clinical Sub-Tab Header — 2-Column Mobile-First Horizontal Icon Grid */}
      <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200/60 dark:border-white/5 backdrop-blur-md mb-2">
        <button
          type="button"
          onClick={() => setClinicalSubTab('labs')}
          className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer border-0 ${
            clinicalSubTab === 'labs'
              ? 'bg-gradient-to-r from-teal-600 to-indigo-600 text-white shadow-md shadow-teal-500/20'
              : 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5'
          }`}
        >
          <FlaskConical className={`w-4 h-4 shrink-0 ${clinicalSubTab === 'labs' ? 'text-white' : 'text-teal-500'}`} />
          <div className="flex flex-col text-left leading-tight">
            <span className="text-[10px] font-extrabold">{isOphthalmology ? 'Biometry & Labs' : 'Pathology Labs'}</span>
            <span className={`text-[8px] font-medium ${clinicalSubTab === 'labs' ? 'text-white/75' : 'text-slate-400 dark:text-slate-500'}`}>
              {isOphthalmology ? 'Biometry / Labs' : 'Diagnostics & Worklist'}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setClinicalSubTab('pharmacy')}
          className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer border-0 ${
            clinicalSubTab === 'pharmacy'
              ? 'bg-gradient-to-r from-amber-600 to-indigo-600 text-white shadow-md shadow-amber-500/20'
              : 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5'
          }`}
        >
          <QrCode className={`w-4 h-4 shrink-0 ${clinicalSubTab === 'pharmacy' ? 'text-white' : 'text-amber-500'}`} />
          <div className="flex flex-col text-left leading-tight">
            <span className="text-[10px] font-extrabold">{isOphthalmology ? 'Optics & Pharmacy' : 'Pharmacy Dispensing'}</span>
            <span className={`text-[8px] font-medium ${clinicalSubTab === 'pharmacy' ? 'text-white/75' : 'text-slate-400 dark:text-slate-500'}`}>
              {isOphthalmology ? 'Optics / Pharmacy Counter' : 'Medicine Counter'}
            </span>
          </div>
        </button>
      </div>

      {/* Sub-View 1: Pathology & Biometry */}
      {clinicalSubTab === 'labs' && (
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
                  const approved = fullLabReports.filter(r => r.status === 'approved');
                  if (approved.length === 0) {
                    return (
                      <div className="p-8 bg-slate-50/50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                        No verified pathology reports logged today.
                      </div>
                    );
                  }

                  return approved.map((report) => {
                    const biomarkers = report.biomarkerJson?.biomarkers || {};
                    return (
                      <div key={report.id} className="p-3.5 border border-slate-200/80 dark:border-white/10 rounded-2xl bg-slate-50/60 dark:bg-slate-800/60 space-y-2.5 shadow-xs">
                        <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-white/10 pb-2">
                          <div>
                            <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">{report.patientName}</h4>
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
                                  {key}: {val} {unit}
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
      )}

      {/* Sub-View 2: Pharmacy Dispensing & Stock */}
      {clinicalSubTab === 'pharmacy' && (
        <div className="space-y-6 text-left animate-fade-in">
          {/* Reorder limit alerts banner */}
          {(() => {
            const lowStockItems = activeInventory.filter(item => item.stock <= item.threshold);
            if (lowStockItems.length === 0) return null;
            return (
              <div className="glass-panel p-4 border-amber-200/80 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/30 rounded-2xl flex items-start gap-3 shadow-md">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-bounce" />
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200">⚠️ Low Stock &amp; Reorder Limit Alerts</h3>
                  <p className="text-[11px] text-amber-800/90 dark:text-amber-300 leading-relaxed">
                    The following {lowStockItems.length} pharmacy items are running below designated safety thresholds. Please notify procurement:
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                    {lowStockItems.map(item => (
                      <span key={item.id} className="bg-amber-600/10 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 border border-amber-600/20 dark:border-amber-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        💊 {item.name} ({item.stock} {item.unit} left | Min: {item.threshold})
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Main inventory stock list catalog */}
          <div className="glass-panel p-4 sm:p-6 border-slate-200/80 dark:border-white/10 shadow-xl relative overflow-hidden bg-white dark:bg-slate-900/90 text-slate-800 dark:text-white rounded-3xl">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500 to-indigo-600 opacity-80" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="space-y-1">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Pill className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  Pharmacy Inventory &amp; Stock Catalog
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Real-time clinic medicine catalog lookup. View expiry dates, FEFO batches, prices, and stock indicators.
                </p>
              </div>

              {/* Search Bar */}
              <div className="w-full sm:w-80 relative select-none">
                <SearchInput
                  value={medSearchQuery}
                  onChange={setMedSearchQuery}
                  placeholder="Search medicine or generic name..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition-all shadow-xs"
                />
              </div>
            </div>

            {(() => {
              const filtered = activeInventory.filter(item => 
                (item.name || '').toLowerCase().includes(medSearchQuery.toLowerCase()) ||
                (item.genericName || '').toLowerCase().includes(medSearchQuery.toLowerCase()) ||
                (item.category || '').toLowerCase().includes(medSearchQuery.toLowerCase())
              );

              if (filtered.length === 0) {
                return (
                  <div className="p-8 bg-slate-50/50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-center text-xs text-slate-500 dark:text-slate-400 font-medium select-none">
                    No medicines matched your search query.
                  </div>
                );
              }

              const rowVirtualizer = useVirtualizer({
                count: filtered.length,
                getScrollElement: () => tableContainerRef.current,
                estimateSize: () => 65,
                overscan: 5,
              });

              return (
                <div 
                  ref={tableContainerRef}
                  className="max-h-[500px] overflow-y-auto border border-slate-200/80 dark:border-white/10 rounded-2xl bg-slate-50/50 dark:bg-slate-950/50 shadow-xs relative"
                >
                  <table className="w-full text-left border-collapse text-xs table-fixed">
                    <thead className="sticky top-0 z-10 bg-slate-100/90 dark:bg-slate-900 border-b border-slate-200/80 dark:border-white/10 shadow-sm backdrop-blur-sm">
                      <tr className="flex w-full">
                        <th className="p-3.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase tracking-wider font-mono w-[25%]">Medicine Details</th>
                        <th className="p-3.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase tracking-wider font-mono w-[20%]">Category / Mfr</th>
                        <th className="p-3.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase tracking-wider font-mono text-center w-[20%]">Stock Level</th>
                        <th className="p-3.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase tracking-wider font-mono w-[20%]">Batch / Expiry</th>
                        <th className="p-3.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase tracking-wider font-mono text-right w-[15%]">Price (MRP)</th>
                      </tr>
                    </thead>
                    <tbody 
                      className="divide-y divide-slate-200/60 dark:divide-white/5 block relative"
                      style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%' }}
                    >
                      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const item = filtered[virtualRow.index];
                        const isLowStock = item.stock <= item.threshold && item.stock > 0;
                        const isOutOfStock = item.stock === 0;
                        
                        let stockStatus = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
                        let stockText = "In Stock";
                        if (isOutOfStock) {
                          stockStatus = "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20";
                          stockText = "Out of Stock";
                        } else if (isLowStock) {
                          stockStatus = "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 animate-pulse";
                          stockText = "Low Stock";
                        }

                        return (
                          <tr 
                            key={item.id} 
                            data-index={virtualRow.index}
                            ref={rowVirtualizer.measureElement}
                            className="absolute top-0 left-0 flex w-full hover:bg-white/60 dark:hover:bg-white/5 transition-colors items-center"
                            style={{
                              transform: `translateY(${virtualRow.start}px)`,
                            }}
                          >
                            <td className="p-3.5 w-[25%] truncate">
                              <div className="font-extrabold text-slate-900 dark:text-white truncate">{item.name}</div>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium truncate">{item.genericName}</span>
                            </td>
                            <td className="p-3.5 w-[20%] truncate">
                              <span className="font-mono bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-1.5 py-0.2 rounded text-[10px] truncate block max-w-fit">{item.category}</span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5 truncate">{item.manufacturer}</span>
                            </td>
                            <td className="p-3.5 text-center w-[20%]">
                              <div className="font-bold text-slate-900 dark:text-white truncate">{item.stock} {item.unit}</div>
                              <span className={`inline-block px-2 py-0.2 mt-0.5 border rounded-full text-[9px] font-bold uppercase tracking-wider ${stockStatus} truncate`}>
                                {stockText}
                              </span>
                            </td>
                            <td className="p-3.5 w-[20%] truncate">
                              <div className="font-mono font-bold text-slate-700 dark:text-slate-300 truncate">Batch: {item.batchNumber}</div>
                              <span className={`text-[10px] font-medium block truncate ${new Date(item.expiryDate) < new Date() ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                                Exp: {new Date(item.expiryDate).toLocaleDateString()}
                              </span>
                            </td>
                            <td className="p-3.5 text-right w-[15%] truncate">
                              <div className="font-extrabold text-slate-900 dark:text-white truncate">₹{(item.price || 0).toFixed(2)}</div>
                              <span className="text-[9px] text-slate-500 dark:text-slate-400 block font-mono truncate">MRP: ₹{(item.mrp || 0).toFixed(2)}</span>
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
      )}
    </div>
  );
};
