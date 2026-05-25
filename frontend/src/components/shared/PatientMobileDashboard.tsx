import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { Patient, UnifiedInvoice, PathologyReport, Encounter } from '../../types';
import { 
  Smartphone, 
  Home, 
  FileText, 
  Wallet, 
  RefreshCw, 
  Heart, 
  Activity, 
  AlertCircle, 
  ChevronRight, 
  CheckCircle2, 
  Lock, 
  Unlock, 
  Coins,
  ShieldCheck,
  Award,
  Flame
} from 'lucide-react';

export const PatientMobileDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'records' | 'wallet' | 'refills'>('home');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string>('9876543210'); // Default Aarav Sharma
  const [invoices, setInvoices] = useState<UnifiedInvoice[]>([]);
  const [reports, setReports] = useState<PathologyReport[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  
  // RAG plain language state
  const [isRagTranslating, setIsRagTranslating] = useState(false);
  const [translatedRagReportId, setTranslatedRagReportId] = useState<string | null>(null);
  const [ragTranslationText, setRagTranslationText] = useState<string>('');

  // UPI payment sheet modal states
  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);
  const [activeUpiInvoice, setActiveUpiInvoice] = useState<UnifiedInvoice | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [upiPin, setUpiPin] = useState('');

  // ABHA locking state
  const [isAbhaLocked, setIsAbhaLocked] = useState(false);

  // Vitals input states
  const [loggedGlucose, setLoggedGlucose] = useState<number | ''>('');
  const [loggedBpSystolic, setLoggedBpSystolic] = useState<number | ''>('');
  const [loggedBpDiastolic, setLoggedBpDiastolic] = useState<number | ''>('');

  useEffect(() => {
    const syncData = () => {
      setPatients(api.getPatients());
      setInvoices(api.getUnifiedInvoices());
      setReports(api.getPathologyReports());
      setEncounters(api.getEncounters());
    };

    syncData();
    const unsubscribe = api.subscribe(syncData);
    return () => unsubscribe();
  }, []);

  const activePatient = patients.find(p => p.phone === selectedPhone) || patients[0];
  const activeInvoices = invoices.filter(i => i.patientId === activePatient?.id);
  const activeReports = reports.filter(r => r.patientId === activePatient?.id);
  const activeEncounters = encounters.filter(e => e.patientId === activePatient?.id);

  const pendingInvoice = activeInvoices.find(i => i.paymentStatus === 'pending');

  const handleTranslateRAG = (reportId: string, testName: string, results: string) => {
    setIsRagTranslating(true);
    setTranslatedRagReportId(reportId);
    setRagTranslationText('');

    setTimeout(() => {
      setIsRagTranslating(false);
      let summary = `*AI Companion Diagnostic RAG Translation* (Language: Plain English)\n\n`;
      summary += `🧪 **Test Analyzed**: ${testName}\n`;
      summary += `📊 **Qualitative Result**: "${results}"\n\n`;
      summary += `💡 **RAG CDSS Clinical Guideline Summary**:\n`;
      if (testName.toLowerCase().includes('hba1c')) {
        summary += `• Your HbA1c is at a borderline level. This confirms mild Glycemic Fluctuation.\n`;
        summary += `• **CDSS Guideline**: Avoid any sudden dose switches. Avoid nephrotoxic painkillers (like ibuprofen/NSAIDs) due to borderline renal clearance trends.\n`;
        summary += `• **Action Plan**: Dr. Sharma recommends continuous capillary blood glucose logs and home microalbuminuria screening.`;
      } else {
        summary += `• Your indices are stable but require lifestyle coordination. Keep daily schedules aligned.\n`;
        summary += `• **CDSS Guideline**: Continuously sync logs to the care pod network.\n`;
        summary += `• **Action Plan**: Review updates directly inside the refills console.`;
      }
      setRagTranslationText(summary);
    }, 1500);
  };

  const handleTriggerUpiSheet = (invoice: UnifiedInvoice) => {
    setActiveUpiInvoice(invoice);
    setIsUpiModalOpen(true);
    setIsPaying(false);
    setPaymentSuccess(false);
    setUpiPin('');
  };

  const handleConfirmUpiPayment = () => {
    if (!activeUpiInvoice) return;
    setIsPaying(true);
    
    setTimeout(async () => {
      setIsPaying(false);
      setPaymentSuccess(true);
      
      // Settle payment in Supabase & cache reactively
      api.clearInvoice(activeUpiInvoice.id);

      // Trigger bot session transition to COMPLETED/COMPLETED chat logs
      await api.processIncomingWhatsAppMessage(selectedPhone, 'pay');

      setTimeout(() => {
        setIsUpiModalOpen(false);
        setActiveUpiInvoice(null);
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            title: 'UPI Payment Cleared! 🎉',
            message: `₹${activeUpiInvoice.totalAmount} cleared. Ledger commissions splits settled.`,
            type: 'success'
          }
        }));
      }, 1500);

    }, 2000);
  };

  const handleOneClickRefill = async (medicineName: string) => {
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: 'Refill Request Received! 🔄',
        message: `Auto-refill triggered for ${medicineName}. Routing holds directly to Pharmacy POS...`,
        type: 'info'
      }
    }));

    // Trigger refills flow in WhatsApp bot logs and sync holds
    await api.processIncomingWhatsAppMessage(selectedPhone, 'refill');
  };

  const handleLogVitals = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggedGlucose && !loggedBpSystolic) return;

    let logMessage = `Vitals logged successfully. `;
    if (loggedGlucose) logMessage += `Glucose: ${loggedGlucose} mg/dL. `;
    if (loggedBpSystolic && loggedBpDiastolic) logMessage += `BP: ${loggedBpSystolic}/${loggedBpDiastolic} mmHg.`;

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: 'Vitals Synced to Pod! 💓',
        message: logMessage,
        type: 'success'
      }
    }));

    // Reset inputs
    setLoggedGlucose('');
    setLoggedBpSystolic('');
    setLoggedBpDiastolic('');
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in text-slate-800 font-sans">
      
      {/* LEFT COLUMN: Setup details */}
      <div className="lg:col-span-4 space-y-6">
        <div className="glass-panel p-6 border-slate-200 shadow-xl relative overflow-hidden bg-white">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-emerald-500 to-primary" />
          <h2 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-emerald-500" />
            Companion Patient App Simulator
          </h2>
          <p className="text-slate-500 text-xs leading-relaxed mb-4">
            This module models the **Patient Companion Mobile App**. Toggle the patient below to inspect e-prescriptions, RAG medical logs, settle bills, and auto-refill chronic medications!
          </p>

          <div className="space-y-4 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Active Patient profile:</label>
              <select
                value={selectedPhone}
                onChange={e => setSelectedPhone(e.target.value)}
                className="w-full input-field py-2 text-xs bg-slate-50 border-slate-200"
              >
                {patients.map(p => (
                  <option key={p.id} value={p.phone}>{p.name} ({p.phone})</option>
                ))}
              </select>
            </div>

            {activePatient && (
              <div className="p-3.5 bg-slate-50 border border-slate-200/50 rounded-xl space-y-2">
                <span className="text-[9px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold uppercase">ABHA Profile Active</span>
                <h4 className="font-bold text-slate-800 text-xs">{activePatient.name}</h4>
                <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
                  <strong>Chronic list</strong>: {activePatient.chronicConditions.join(', ') || 'None'}<br/>
                  <strong>Allergies</strong>: {activePatient.allergies.join(', ') || 'NKDA'}<br/>
                  <strong>ABHA Card ID</strong>: {activePatient.abhaId || 'Not set'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Home Vitals Logging Form */}
        <div className="glass-panel p-6 border-slate-200 shadow-xl bg-white relative">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Heart className="h-4 w-4 text-rose-500" />
            Home Telehealth logger
          </h3>
          <form onSubmit={handleLogVitals} className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Capillary Blood Glucose (mg/dL)</label>
              <input
                type="number"
                placeholder="e.g. 130"
                value={loggedGlucose}
                onChange={e => setLoggedGlucose(e.target.value !== '' ? Number(e.target.value) : '')}
                className="w-full input-field text-xs py-2 border-slate-200 bg-slate-50"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">BP Systolic</label>
                <input
                  type="number"
                  placeholder="e.g. 120"
                  value={loggedBpSystolic}
                  onChange={e => setLoggedBpSystolic(e.target.value !== '' ? Number(e.target.value) : '')}
                  className="w-full input-field text-xs py-2 border-slate-200 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">BP Diastolic</label>
                <input
                  type="number"
                  placeholder="e.g. 80"
                  value={loggedBpDiastolic}
                  onChange={e => setLoggedBpDiastolic(e.target.value !== '' ? Number(e.target.value) : '')}
                  className="w-full input-field text-xs py-2 border-slate-200 bg-slate-50"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full btn-primary bg-primary hover:opacity-95 text-xs py-2 flex justify-center items-center gap-1 text-white-force font-bold rounded-lg cursor-pointer"
            >
              <Activity className="h-3.5 w-3.5 text-white-force animate-pulse" />
              Sync Vitals to Care Pod
            </button>
          </form>
        </div>
      </div>

      {/* RIGHT COLUMN: Mobile Viewport Container */}
      <div className="lg:col-span-8 flex justify-center items-center">
        
        {/* Smartphone Bezel */}
        <div className="w-full max-w-[360px] h-[640px] bg-slate-900 border-[7px] border-slate-950 rounded-[44px] shadow-2xl flex flex-col relative overflow-hidden ring-1 ring-slate-800">
          
          {/* iOS Dynamic Island Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5.5 bg-slate-950 rounded-b-2xl z-50 flex justify-center items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800" />
            <div className="w-10 h-1 bg-slate-900 rounded-full ml-4" />
          </div>

          {/* Smartphone Screen Canvas */}
          <div className="flex-1 bg-slate-50 flex flex-col justify-between overflow-hidden relative">
            
            {/* Mock Top Status bar */}
            <div className="pt-6.5 pb-2.5 px-6 bg-white flex justify-between items-center text-[10px] text-slate-600 font-semibold shrink-0 z-40">
              <span>12:51 PM</span>
              <div className="flex items-center gap-1 text-slate-800 font-mono">
                <span className="text-[8px] font-bold uppercase text-emerald-600">5G</span>
                <span className="material-symbols-outlined text-[10px] font-bold">wifi</span>
                <span className="material-symbols-outlined text-[10px] text-emerald-500 font-bold">battery_full</span>
              </div>
            </div>

            {/* Simulated App Screens container */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              
              {/* TAB 1: HOME */}
              {activeTab === 'home' && (
                <div className="space-y-4 animate-fade-in text-slate-800">
                  {/* Dashboard header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">My Care companion</span>
                      <h3 className="text-sm font-extrabold text-slate-900 mt-0.5">Namaste, {activePatient?.name.split(' ')[0]} 👋</h3>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                      {activePatient?.name.substring(0, 2).toUpperCase() || 'MF'}
                    </div>
                  </div>

                  {/* Active Care pod status block */}
                  <div className="bg-gradient-to-br from-emerald-500 to-[#075e54] rounded-2xl p-3.5 text-white shadow-lg space-y-2 relative overflow-hidden border border-emerald-400/20">
                    <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-emerald-400/10" />
                    <span className="text-[8px] bg-emerald-400/25 text-emerald-100 border border-emerald-400/30 px-2 py-0.5 rounded font-mono font-bold tracking-widest uppercase">
                      Connected Pod Network
                    </span>
                    <h4 className="text-xs font-extrabold flex items-center gap-1.5 text-white-force">
                      Patna Zone Pod
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                    </h4>
                    <p className="text-[10px] text-emerald-100/90 leading-relaxed font-sans">
                      All clinical files, invoices, and drug auto-refills are secure-synced via pod.
                    </p>
                  </div>

                  {/* Active Vitals panel */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Health Vitals</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded-2xl border border-slate-200/50 shadow-sm flex flex-col justify-between">
                        <div className="flex justify-between items-center text-rose-500">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Glucose</span>
                          <Flame className="h-3.5 w-3.5 animate-pulse" />
                        </div>
                        <div className="mt-2.5">
                          <span className="text-base font-extrabold text-slate-900">142</span>
                          <span className="text-[9px] text-slate-400 ml-1">mg/dL</span>
                        </div>
                        <span className="text-[8px] text-slate-400 mt-1">Post-prandial • Normal</span>
                      </div>

                      <div className="bg-white p-3 rounded-2xl border border-slate-200/50 shadow-sm flex flex-col justify-between">
                        <div className="flex justify-between items-center text-primary">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">BP Index</span>
                          <Activity className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="mt-2.5">
                          <span className="text-base font-extrabold text-slate-900">128/82</span>
                          <span className="text-[9px] text-slate-400 ml-1">mmHg</span>
                        </div>
                        <span className="text-[8px] text-slate-400 mt-1">Borderline-normal</span>
                      </div>
                    </div>
                  </div>

                  {/* Daily Medication schedule (Pill trackers) */}
                  <div className="bg-white border border-slate-200/50 shadow-sm rounded-2xl p-3.5 space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today's Pill Scheduler</h4>
                      <span className="text-[8px] text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded font-bold">2 Remaining</span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-2">
                          <div className="w-7 h-7 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 shrink-0 mt-0.5">
                            <span className="material-symbols-outlined text-sm font-bold">pill</span>
                          </div>
                          <div>
                            <h5 className="font-extrabold text-slate-800 text-[11px]">Metformin 500mg</h5>
                            <p className="text-[9px] text-slate-400 mt-0.5">1-0-1 • Take with breakfast & dinner</p>
                          </div>
                        </div>
                        <span className="text-[8px] font-bold text-slate-500 font-mono">Next: 2h</span>
                      </div>

                      <div className="flex justify-between items-start">
                        <div className="flex gap-2">
                          <div className="w-7 h-7 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 shrink-0 mt-0.5">
                            <span className="material-symbols-outlined text-sm font-bold">pill</span>
                          </div>
                          <div>
                            <h5 className="font-extrabold text-slate-800 text-[11px]">Atorvastatin 10mg</h5>
                            <p className="text-[9px] text-slate-400 mt-0.5">0-0-1 • Take before bed</p>
                          </div>
                        </div>
                        <span className="text-[8px] font-bold text-slate-500 font-mono">Next: 8h</span>
                      </div>
                    </div>
                  </div>

                  {/* Pending Action item quick shortcut */}
                  {pendingInvoice && (
                    <div 
                      onClick={() => setActiveTab('wallet')}
                      className="p-3 bg-amber-50 border border-amber-200/50 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-amber-100/50 transition-colors animate-pulse"
                    >
                      <div className="flex gap-2 items-center text-amber-800">
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                        <div>
                          <h4 className="font-bold text-[10px]">Unified Invoice Settle Pending</h4>
                          <p className="text-[8.5px] text-amber-600 mt-0.5">Dr. Sharma signed off your e-Rx. Settle dues.</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-amber-500" />
                    </div>
                  )}

                </div>
              )}

              {/* TAB 2: MEDICAL RECORDS */}
              {activeTab === 'records' && (
                <div className="space-y-4 animate-fade-in text-slate-800">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                    <FileText className="h-4 w-4 text-primary" />
                    My Health Locker Logs
                  </h3>

                  {/* e-Prescriptions list section */}
                  <div className="space-y-2.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">e-Prescriptions History</span>
                    {activeEncounters.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic bg-white p-3 rounded-2xl border border-slate-200/50 text-center">No active prescriptions locked in the pod.</p>
                    ) : (
                      activeEncounters.map(enc => (
                        <div key={enc.id} className="bg-white p-3.5 rounded-2xl border border-slate-200/50 shadow-sm space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-slate-800 text-[11px]">Encounter & e-Rx Record</h4>
                              <span className="text-[8px] text-slate-400 block font-mono mt-0.5">{new Date(enc.createdAt).toLocaleDateString()}</span>
                            </div>
                            <span className="text-[8px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold uppercase">SIGNED OFF</span>
                          </div>
                          
                          {enc.clinicalNotes && (
                            <p className="text-[9.5px] text-slate-500 italic border-l-2 border-slate-200 pl-2 leading-relaxed bg-slate-50 py-1 pr-1 rounded">
                              " {enc.clinicalNotes} "
                            </p>
                          )}

                          <div className="text-[9.5px] space-y-1">
                            <span className="block text-[8px] font-bold text-slate-400 uppercase">Prescribed Generic Meds:</span>
                            {enc.medications.map((m, idx) => (
                              <div key={idx} className="flex justify-between font-semibold text-slate-700 text-[9px]">
                                <span>💊 {m.medicineName}</span>
                                <span>{m.frequency} ({m.duration})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Pathology report with RAG interpretation drawer */}
                  <div className="space-y-2.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Qualitative Pathology Lab results</span>
                    {activeReports.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic bg-white p-3 rounded-2xl border border-slate-200/50 text-center">No pathological records reported yet.</p>
                    ) : (
                      activeReports.map(rep => (
                        <div key={rep.id} className="bg-white p-3.5 rounded-2xl border border-slate-200/50 shadow-sm space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-slate-800 text-[11px]">{rep.testName}</h4>
                              <span className="text-[8px] text-slate-400 block font-mono mt-0.5">LOINC Code: {rep.loincCode}</span>
                            </div>
                            <span className="text-[8px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold uppercase">Approved</span>
                          </div>

                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/50 font-mono text-[10px] text-slate-700 leading-normal">
                            <strong>Lab Finding:</strong> {rep.results || 'No quantitative diagnostics details resolved.'}
                          </div>

                          {/* Plain-Language RAG interpreter trigger */}
                          <div className="space-y-2">
                            {translatedRagReportId === rep.id ? (
                              isRagTranslating ? (
                                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl animate-pulse text-center space-y-2 text-primary">
                                  <span className="material-symbols-outlined text-lg animate-spin">sync</span>
                                  <p className="text-[9px] font-bold font-mono tracking-wider uppercase">Running Vector RAG Translation...</p>
                                </div>
                              ) : (
                                <div className="p-3.5 bg-blue-50 border border-blue-100 text-blue-900 rounded-xl space-y-2 animate-fade-in text-[10px] leading-relaxed">
                                  <div className="flex items-center gap-1.5 text-primary text-[9px] font-bold tracking-widest uppercase font-mono border-b border-blue-200/50 pb-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                    AI RAG plain language summary
                                  </div>
                                  <p className="whitespace-pre-line font-medium text-slate-700">{ragTranslationText}</p>
                                  <button
                                    onClick={() => setTranslatedRagReportId(null)}
                                    className="text-[8.5px] text-slate-400 hover:text-slate-600 block mt-1.5 font-bold uppercase tracking-wider underline cursor-pointer"
                                  >
                                    Close AI Advisory
                                  </button>
                                </div>
                              )
                            ) : (
                              <button
                                onClick={() => handleTranslateRAG(rep.id, rep.testName, rep.results || '')}
                                className="w-full btn-primary bg-primary hover:opacity-95 border-primary py-2 text-[9.5px] font-bold tracking-wider rounded-xl transition-all shadow-md flex justify-center items-center gap-1.5 text-white-force cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-xs">psychology</span>
                                Run plain-language RAG AI Advisor
                              </button>
                            )}
                          </div>

                        </div>
                      ))
                    )}
                  </div>

                </div>
              )}

              {/* TAB 3: WALLET & BILLING */}
              {activeTab === 'wallet' && (
                <div className="space-y-4 animate-fade-in text-slate-800">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                    <Wallet className="h-4 w-4 text-emerald-500" />
                    Digital Wallet & Insurance
                  </h3>

                  {/* ABHA Wallet Pass */}
                  <div className="bg-gradient-to-tr from-cyan-600 to-indigo-600 rounded-2xl p-4 text-white shadow-lg space-y-4 relative border border-cyan-400/20">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <span className="text-[7.5px] bg-white/20 border border-white/20 px-2 py-0.5 rounded font-mono font-bold tracking-widest uppercase">
                          NDHM • Health ID Pass
                        </span>
                        <h4 className="text-xs font-extrabold tracking-wide mt-1.5 text-white-force">Aarav Sharma</h4>
                        <p className="text-[8px] text-cyan-200">ABHA No: 12-3456-7890-1234</p>
                      </div>
                      <div className="w-8 h-8 bg-white/10 border border-white/10 rounded-xl flex items-center justify-center">
                        <span className="material-symbols-outlined text-lg text-cyan-300 font-bold">badge</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-end pt-2 border-t border-cyan-500/30">
                      <div>
                        <span className="text-[7px] text-cyan-200 block uppercase font-mono font-bold">Ecosystem Status</span>
                        <span className="text-[9.5px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-cyan-300" />
                          Pod Connected
                        </span>
                      </div>

                      {/* ABHA Lock Access toggles */}
                      <button
                        onClick={() => {
                          setIsAbhaLocked(!isAbhaLocked);
                          window.dispatchEvent(new CustomEvent('mediflow-toast', {
                            detail: {
                              title: isAbhaLocked ? 'ABHA Locker Unlocked! 🔓' : 'ABHA Locker Secured! 🔒',
                              message: isAbhaLocked 
                                ? 'Permission access opened for clinical staff sync.' 
                                : 'Access locked. Non-checked staff cannot view demographic lockers.',
                              type: isAbhaLocked ? 'info' : 'success'
                            }
                          }));
                        }}
                        className={`px-2 py-1 rounded text-[8px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                          isAbhaLocked 
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {isAbhaLocked ? (
                          <>
                            <Lock className="h-2.5 w-2.5" />
                            Locker Locked
                          </>
                        ) : (
                          <>
                            <Unlock className="h-2.5 w-2.5" />
                            Lock access
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Invoice listing */}
                  <div className="space-y-2.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Unified Care Invoices</span>
                    {activeInvoices.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic bg-white p-3 rounded-2xl border border-slate-200/50 text-center">No care invoices recorded.</p>
                    ) : (
                      activeInvoices.map(inv => (
                        <div key={inv.id} className="bg-white p-3.5 rounded-2xl border border-slate-200/50 shadow-sm space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-extrabold text-slate-800 text-[11px]">Mediflow Care Invoice</h4>
                              <span className="text-[8px] text-slate-400 block font-mono mt-0.5">ID: {inv.id.substring(0, 8)}...</span>
                            </div>
                            <span className={`text-[8.5px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                              inv.paymentStatus === 'cleared'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800 animate-pulse'
                            }`}>
                              {inv.paymentStatus}
                            </span>
                          </div>

                          <div className="text-[10px] space-y-1 text-slate-600">
                            <div className="flex justify-between"><span>Doctor Consultation:</span><span className="font-mono text-slate-800">₹{inv.doctorFee}.00</span></div>
                            <div className="flex justify-between"><span>Laboratory Pathology:</span><span className="font-mono text-slate-800">₹{inv.labFee}.00</span></div>
                            <div className="flex justify-between"><span>Pharmacy prescription:</span><span className="font-mono text-slate-800">₹{inv.pharmacyFee}.00</span></div>
                            <div className="flex justify-between font-bold text-slate-900 border-t border-slate-100 pt-1.5 text-[11px]">
                              <span>Total Amount:</span>
                              <span className="font-mono text-primary">₹{inv.totalAmount}.00</span>
                            </div>
                          </div>

                          {/* UPI payment trigger button */}
                          {inv.paymentStatus === 'pending' && (
                            <button
                              onClick={() => handleTriggerUpiSheet(inv)}
                              className="w-full btn-primary bg-emerald-500 hover:bg-emerald-600 border-emerald-500 py-2.5 text-xs font-bold rounded-xl transition-all shadow-md flex justify-center items-center gap-1.5 text-white-force cursor-pointer"
                            >
                              <Coins className="h-4 w-4 text-white-force animate-spin-slow" />
                              Settle Invoice via UPI (₹{inv.totalAmount})
                            </button>
                          )}

                        </div>
                      ))
                    )}
                  </div>

                </div>
              )}

              {/* TAB 4: REFILL PLANNER */}
              {activeTab === 'refills' && (
                <div className="space-y-4 animate-fade-in text-slate-800">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                    <RefreshCw className="h-4 w-4 text-amber-500" />
                    Chronic Refill Planner
                  </h3>

                  {/* Refills details card */}
                  <div className="bg-white border border-slate-200/50 shadow-sm rounded-2xl p-4 space-y-3">
                    <div className="flex gap-3 items-start text-amber-600 font-bold text-xs">
                      <Award className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-[11px]">Loyalty Auto-Refill Benefits</h4>
                        <p className="text-[9px] text-slate-400 font-normal leading-relaxed mt-0.5">
                          Patients managing active chronic management logs inside the pod qualify for instant auto-refill holds.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">My Prescribed Chronics</span>
                    
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200/50 shadow-sm space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 shrink-0">
                            <span className="material-symbols-outlined text-sm font-bold">pill</span>
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-800 text-[11px]">Metformin 500mg</h4>
                            <p className="text-[8.5px] text-slate-400 mt-0.5">Type-2 Diabetes Management</p>
                          </div>
                        </div>
                        <span className="text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold font-mono">10 Days left</span>
                      </div>
                      <button
                        onClick={() => handleOneClickRefill('Metformin 500mg')}
                        className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-primary py-2 text-[9.5px] font-bold tracking-wider rounded-xl transition-all flex justify-center items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        1-Tap Auto-Refill (Patna Pharmacy)
                      </button>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200/50 shadow-sm space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 shrink-0">
                            <span className="material-symbols-outlined text-sm font-bold">pill</span>
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-800 text-[11px]">Atorvastatin 10mg</h4>
                            <p className="text-[8.5px] text-slate-400 mt-0.5">Hypertension Management</p>
                          </div>
                        </div>
                        <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold font-mono">30 Days left</span>
                      </div>
                      <button
                        onClick={() => handleOneClickRefill('Atorvastatin 10mg')}
                        className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-primary py-2 text-[9.5px] font-bold tracking-wider rounded-xl transition-all flex justify-center items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        1-Tap Auto-Refill (Patna Pharmacy)
                      </button>
                    </div>
                  </div>

                </div>
              )}

            </div>

            {/* Simulated smartphone bottom tab bar navigation */}
            <div className="bg-white border-t border-slate-200 py-2.5 px-6 flex justify-between items-center shrink-0 z-40">
              {[
                { id: 'home', label: 'Home', icon: Home },
                { id: 'records', label: 'Records', icon: FileText },
                { id: 'wallet', label: 'Wallet', icon: Wallet },
                { id: 'refills', label: 'Refills', icon: RefreshCw }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      isActive 
                        ? 'text-primary scale-105' 
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                    <span className="text-[8px] font-bold uppercase tracking-wider">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Google Pay Style mobile sheet modal backdrop */}
            {isUpiModalOpen && activeUpiInvoice && (
              <div className="absolute inset-0 bg-black/60 z-50 flex flex-col justify-end animate-fade-in">
                <div className="bg-white rounded-t-[32px] p-5 space-y-4 animate-slide-up shadow-2xl">
                  
                  {/* Modal Header */}
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div className="flex gap-2 items-center">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs">
                        G
                      </div>
                      <h4 className="font-extrabold text-[11px] text-slate-800">Unified UPI Gateway (Patna Pod)</h4>
                    </div>
                    <button
                      onClick={() => setIsUpiModalOpen(false)}
                      className="p-1 hover:bg-slate-100 rounded-full text-slate-400"
                    >
                      <span className="material-symbols-outlined text-sm font-bold">close</span>
                    </button>
                  </div>

                  {/* Payment success sheets */}
                  {paymentSuccess ? (
                    <div className="py-6 text-center space-y-3 animate-fade-in">
                      <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500 animate-bounce" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm">Payment Approved!</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Unified Care Split Ledgers Settled Successfully.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-center bg-slate-50 p-4 rounded-2xl border border-slate-200/50">
                        <span className="text-[8px] text-slate-400 block uppercase font-bold tracking-widest font-mono">Invoice Settle Total</span>
                        <h2 className="text-xl font-extrabold text-primary font-mono mt-1">₹{activeUpiInvoice.totalAmount}.00</h2>
                      </div>

                      {/* Split calculations break logs */}
                      <div className="text-[9px] bg-slate-50/50 p-3.5 border border-slate-200/50 rounded-2xl space-y-2">
                        <span className="block text-[8px] font-bold text-slate-400 uppercase font-mono tracking-widest">Ecosystem Split Ledger settling</span>
                        <div className="flex justify-between"><span>👩‍⚕️ Doctor Appt (doc-1):</span><span className="font-mono text-slate-700">₹{activeUpiInvoice.doctorFee}.00</span></div>
                        <div className="flex justify-between"><span>🧪 Lab pathology (15% split):</span><span className="font-mono text-slate-700">₹{activeUpiInvoice.labFee}.00</span></div>
                        <div className="flex justify-between"><span>💊 Pharmacy Inventory (10% split):</span><span className="font-mono text-slate-700">₹{activeUpiInvoice.pharmacyFee}.00</span></div>
                      </div>

                      {/* Pin code entering input sheet */}
                      <div>
                        <label className="block text-[8.5px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 text-center">Enter 4-Digit UPI PIN</label>
                        <input
                          type="password"
                          maxLength={4}
                          placeholder="••••"
                          value={upiPin}
                          onChange={e => setUpiPin(e.target.value)}
                          className="w-24 mx-auto text-center font-extrabold font-mono tracking-widest text-lg bg-slate-50 border border-slate-200 focus:outline-none focus:border-primary rounded-lg py-1 flex justify-center"
                        />
                      </div>

                      <button
                        onClick={handleConfirmUpiPayment}
                        disabled={isPaying || upiPin.length < 4}
                        className={`w-full py-3 text-xs font-bold rounded-xl transition-all shadow-md flex justify-center items-center gap-1.5 text-white-force ${
                          upiPin.length === 4 && !isPaying
                            ? 'bg-emerald-600 hover:bg-emerald-500 cursor-pointer text-white-force'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {isPaying ? (
                          <>
                            <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                            Processing secure split payout...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-xs text-white-force font-bold">lock</span>
                            Pay UPI splits (₹{activeUpiInvoice.totalAmount}.00)
                          </>
                        )}
                      </button>
                    </div>
                  )}

                </div>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
};
