import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { Patient, UnifiedInvoice, PathologyReport, Encounter, Invoice } from '../../types';
import { BillingService } from '../../services/billingService';
import { PaymentService } from '../../services/paymentService';
import { RealtimeSyncService } from '../../services/realtimeSyncService';
import { 
  Smartphone, 
  Home, 
  FileText, 
  CreditCard, 
  RefreshCw, 
  Activity, 
  AlertCircle, 
  ChevronRight, 
  CheckCircle2, 
  Lock, 
  Unlock, 
  Coins,
  ShieldCheck,
  Award,
  Flame,
  Clock,
  Sparkles,
  LogOut,
  X,
  User,
  Pill,
  Brain,
  Calendar,
  QrCode,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import { MobileNav } from './MobileNav';
import { MetricCard } from './MetricCard';
import { MobileChart } from './MobileChart';

export interface PatientMobileDashboardProps {
  onSignOut?: () => void;
}

export const PatientMobileDashboard: React.FC<PatientMobileDashboardProps> = ({ onSignOut }) => {
  const { activePod } = useClinic();
  const [activeTab, setActiveTab] = useState<'home' | 'records' | 'wallet' | 'refills' | 'vitals' | 'book_appointment'>('home');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string>('');
  const [invoices, setInvoices] = useState<UnifiedInvoice[]>([]);
  const [reports, setReports] = useState<PathologyReport[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  
  // Book Appointment Tab States
  const [bookName, setBookName] = useState('');
  const [bookPhone, setBookPhone] = useState('');
  const [bookAge, setBookAge] = useState('');
  const [bookGender, setBookGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [bookTime, setBookTime] = useState('');
  const [bookDate, setBookDate] = useState('');

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
      const allPatients = api.getPatients();
      setPatients(allPatients);
      setInvoices(api.getUnifiedInvoices());
      setReports(api.getPathologyReports());
      setEncounters(api.getEncounters());
      if (!selectedPhone && allPatients.length > 0) {
        setSelectedPhone(allPatients[0].phone || '');
      }
    };

    syncData();
    window.addEventListener('mediflow-state-change', syncData);
    window.addEventListener('storage', syncData);
    const unsubscribe = api.subscribe(syncData);
    const unsubscribeRealtime = RealtimeSyncService.subscribeToLiveClinicUpdates({
      onPatientChange: () => syncData(),
      onAppointmentChange: () => syncData(),
      onUnifiedInvoiceChange: () => syncData(),
      onMedicineBillChange: () => syncData(),
      onLabRequisitionChange: () => syncData(),
      onPathologyReportChange: () => syncData(),
      onFinancialLedgerChange: () => syncData(),
      onWhatsAppSessionChange: () => syncData(),
      onEncounterChange: () => syncData(),
      onSaaSPrescriptionChange: () => syncData(),
    });

    return () => {
      window.removeEventListener('mediflow-state-change', syncData);
      window.removeEventListener('storage', syncData);
      unsubscribe();
      unsubscribeRealtime();
    };
  }, [selectedPhone]);

  const cleanSelectedPhone = (selectedPhone || '').replace(/\D/g, '').slice(-10);
  const activePatient = patients.find(p => (p.phone || (p as any).patient_phone || '').replace(/\D/g, '').slice(-10) === cleanSelectedPhone) || patients[0];
  const activeInvoices = invoices.filter(i => (i.patientId || (i as any).patient_id) === activePatient?.id);
  const activeReports = reports.filter(r => (r.patientId || (r as any).patient_id) === activePatient?.id);
  const activeEncounters = encounters.filter(e => (e.patientId || (e as any).patient_id) === activePatient?.id);

  const pendingInvoice = activeInvoices.find(i => i.paymentStatus === 'pending' || (i as any).payment_status === 'pending');

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
      if ((testName || '').toLowerCase().includes('hba1c')) {
        summary += `• Your HbA1c is at a borderline level. This confirms mild Glycemic Fluctuation.\n`;
        summary += `• **CDSS Guideline**: Avoid any sudden dose switches. Avoid ibuprofen/NSAIDs due to borderline renal clearance.\n`;
        summary += `• **Action Plan**: Your attending physician recommends continuous capillary blood glucose logs and home screening.`;
      } else {
        summary += `• Your indices are stable but require lifestyle coordination. Keep daily schedules aligned.\n`;
        summary += `• **CDSS Guideline**: Continuously sync logs to the care pod network.\n`;
        summary += `• **Action Plan**: Review updates directly inside the refills console.`;
      }
      setRagTranslationText(summary);
    }, 1200);
  };

  const handleTriggerUpiSheet = (invoice: UnifiedInvoice) => {
    setActiveUpiInvoice(invoice);
    setIsUpiModalOpen(true);
    setIsPaying(false);
    setPaymentSuccess(false);
    setUpiPin('');
  };

  const handleConfirmUpiPayment = () => {
    if (!activeUpiInvoice || isPaying) return;
    setIsPaying(true);
    
    setTimeout(async () => {
      setIsPaying(false);
      setPaymentSuccess(true);
      
      api.clearInvoice(activeUpiInvoice.id);
      await api.processIncomingWhatsAppMessage(selectedPhone, 'pay');

      setTimeout(() => {
        setIsUpiModalOpen(false);
        setActiveUpiInvoice(null);
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            title: 'UPI Payment Cleared! 🎉',
            message: `₹${activeUpiInvoice.totalAmount} cleared. Split payouts settled successfully.`,
            type: 'success'
          }
        }));
      }, 1200);

    }, 1500);
  };

  const handleOneClickRefill = async (medicineName: string) => {
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: 'Refill Request Dispatched! 🔄',
        message: `Auto-refill holds prepared for ${medicineName}. Synchronized to Pharmacy POS.`,
        type: 'info'
      }
    }));
    await api.processIncomingWhatsAppMessage(selectedPhone, 'refill');
  };

  const handleLogVitals = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggedGlucose && !loggedBpSystolic) return;

    let logMessage = `Synced: `;
    if (loggedGlucose) logMessage += `Glucose: ${loggedGlucose} mg/dL. `;
    if (loggedBpSystolic && loggedBpDiastolic) logMessage += `BP: ${loggedBpSystolic}/${loggedBpDiastolic}.`;

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: 'Health Vitals Synced! 💓',
        message: logMessage,
        type: 'success'
      }
    }));

    setLoggedGlucose('');
    setLoggedBpSystolic('');
    setLoggedBpDiastolic('');
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in text-slate-600 font-sans select-none">
      
      {/* LEFT COLUMN: Simulation controller */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-zinc-900 border border-white/5 p-6 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-500 to-indigo-500" />
          <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-cyan-400" />
            Ecosystem Device Simulator
          </h2>
          <p className="text-zinc-400 text-xs leading-relaxed mb-4">
            Toggle patient simulation profiles to inspect e-prescriptions, RAG medical summaries, settle bills via UPI, and trigger auto-refills within the pod network.
          </p>

          <div className="space-y-4 pt-3 border-t border-white/5">
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                Simulated Patient Profile
              </label>
              <select
                value={selectedPhone}
                onChange={e => setSelectedPhone(e.target.value)}
                className="w-full bg-zinc-950 border border-slate-200/60 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-cyan-500/30"
              >
                {patients.map(p => (
                  <option key={p.id} value={p.phone} className="bg-zinc-900">{p.name} ({p.phone})</option>
                ))}
              </select>
            </div>

            {activePatient && (
              <div className="p-3.5 bg-zinc-950/80 border border-white/5 rounded-xl space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    ABHA Profile Connected
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (onSignOut) {
                        onSignOut();
                      } else {
                        localStorage.clear();
                        window.location.href = '/';
                      }
                    }}
                    className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 hover:text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <LogOut className="h-3 w-3" />
                    Sign Out
                  </button>
                </div>
                <h4 className="font-bold text-white">{activePatient.name}</h4>
                <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                  <strong>Chronic list</strong>: {(activePatient.chronicConditions || []).join(', ') || 'None'}<br/>
                  <strong>Allergies</strong>: {(activePatient.allergies || []).join(', ') || 'NKDA'}<br/>
                  <strong>ABHA Card ID</strong>: {activePatient.abhaId || 'Not set'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Home Vitals Logger panel */}
        <div className="bg-zinc-900 border border-white/5 p-6 rounded-2xl shadow-xl space-y-4">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-white/5 pb-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            Telehealth Vital Logger
          </h3>
          <form onSubmit={handleLogVitals} className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wide">
                Glucose (mg/dL)
              </label>
              <input
                type="number"
                placeholder="e.g. 130"
                value={loggedGlucose}
                onChange={e => setLoggedGlucose(e.target.value !== '' ? Number(e.target.value) : '')}
                className="w-full bg-zinc-950 border border-slate-200/60 focus:border-cyan-500/30 rounded-xl py-2 px-3 text-xs text-white outline-none transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wide">BP Systolic</label>
                <input
                  type="number"
                  placeholder="e.g. 120"
                  value={loggedBpSystolic}
                  onChange={e => setLoggedBpSystolic(e.target.value !== '' ? Number(e.target.value) : '')}
                  className="w-full bg-zinc-950 border border-slate-200/60 focus:border-cyan-500/30 rounded-xl py-2 px-3 text-xs text-white outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wide">BP Diastolic</label>
                <input
                  type="number"
                  placeholder="e.g. 80"
                  value={loggedBpDiastolic}
                  onChange={e => setLoggedBpDiastolic(e.target.value !== '' ? Number(e.target.value) : '')}
                  className="w-full bg-zinc-950 border border-slate-200/60 focus:border-cyan-500/30 rounded-xl py-2 px-3 text-xs text-white outline-none transition-all"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer font-sans"
            >
              <CheckCircle2 className="h-4 w-4" />
              Sync Vitals to Care Pod
            </button>
          </form>
        </div>
      </div>

      {/* RIGHT COLUMN: Mobile Viewport Container */}
      <div className="lg:col-span-8 flex justify-center items-center">
        
        {/* Smartphone Bezel Bezel-950 */}
        <div className="w-full max-w-[360px] h-[640px] bg-zinc-950 border-[7px] border-zinc-900 rounded-[44px] shadow-2xl flex flex-col relative overflow-hidden ring-1 ring-white/10">
          
          {/* iOS Dynamic Island Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5.5 bg-zinc-900 rounded-b-2xl z-50 flex justify-center items-center border-b border-white/5">
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-950 border border-slate-200/60" />
            <div className="w-10 h-1 bg-zinc-950 rounded-full ml-4" />
          </div>

          {/* Smartphone Screen Canvas (Dark Mode zinc-950 First) */}
          <div className="flex-1 bg-zinc-950 flex flex-col justify-between overflow-hidden relative">
            
            {/* Top Navigation & Status Monitor */}
            <MobileNav 
              activeTab={activeTab} 
              onTabChange={setActiveTab} 
              patientName={activePatient?.name || ''} 
              isPodConnected={true}
              onMenuClick={() => setIsMobileDrawerOpen(true)}
            />

            {/* Mobile Account Profile & Sign Out Drawer Overlay */}
            {isMobileDrawerOpen && (
              <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur-xl z-50 flex flex-col justify-between p-5 animate-fade-in">
                <div className="space-y-6">
                  {/* Drawer Header */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-sm font-mono">
                        {(activePatient?.name || 'Patient').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white font-sans">{activePatient?.name || 'Patient User'}</h4>
                        <span className="text-[10px] text-zinc-400 font-mono">{selectedPhone}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMobileDrawerOpen(false)}
                      className="p-2 rounded-xl bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Patient Account Quick Summary */}
                  <div className="bg-zinc-900/80 border border-white/5 p-4 rounded-2xl space-y-3">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest block font-mono">
                      ABHA Digital Health Pass
                    </span>
                    <div className="flex justify-between items-center text-xs text-zinc-300 font-sans">
                      <span>Card Status</span>
                      <span className="text-emerald-400 font-semibold font-mono">Verified Active</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-zinc-300 font-sans">
                      <span>Care Pod ID</span>
                      <span className="text-zinc-400 font-mono">POD-2026-X1</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-zinc-300 font-sans">
                      <span>Refill Delivery</span>
                      <span className="text-cyan-400 font-mono">1-Click Enabled</span>
                    </div>
                  </div>
                </div>

                {/* Drawer Footer Actions */}
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileDrawerOpen(false);
                      if (onSignOut) {
                        onSignOut();
                      } else {
                        localStorage.clear();
                        window.location.href = '/';
                      }
                    }}
                    className="w-full py-3.5 px-4 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 hover:text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-lg shadow-rose-500/10 active:scale-95 font-sans"
                  >
                    <LogOut className="h-4 w-4 text-rose-400" />
                    Sign Out Account
                  </button>
                  <p className="text-[9px] text-center text-zinc-500 font-mono">
                    VitalSync Patient Telehealth Companion • v2.5.0
                  </p>
                </div>
              </div>
            )}

            {/* Simulated App Screens Container */}
            <div className="flex-1 overflow-y-auto px-4 py-3.5 pb-24 space-y-4">
              
              {/* TAB 1: HOME */}
              {activeTab === 'home' && (
                <div className="space-y-4 animate-fade-in text-white">
                  
                  {/* Dashboard header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
                        Patient Workspace
                      </span>
                      <h3 className="text-sm font-black text-white mt-0.5">
                        Namaste, {(activePatient?.name || 'Patient').split(' ')[0]} 👋
                      </h3>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 font-black text-xs">
                      {(activePatient?.name || 'MF').substring(0, 2).toUpperCase()}
                    </div>
                  </div>

                  {/* Above-the-fold Telehealth Alerts (Datadog Style) */}
                  {pendingInvoice ? (
                    <div 
                      onClick={() => setActiveTab('wallet')}
                      className="p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-rose-500/15 transition-all animate-pulse"
                    >
                      <div className="flex gap-2.5 items-center text-rose-300">
                        <AlertCircle className="h-4.5 w-4.5 text-rose-400 shrink-0" />
                        <div>
                          <h4 className="font-extrabold text-[10px] tracking-wide uppercase">Critical Invoice Pending Settle</h4>
                          <p className="text-[8.5px] text-rose-400 mt-0.5 leading-none">e-Rx generated. Settle pod dues immediately.</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4.5 w-4.5 text-rose-400" />
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-2.5 text-emerald-300">
                      <ShieldCheck className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
                      <div>
                        <h4 className="font-extrabold text-[10px] uppercase">Ecosystem Health Safe</h4>
                        <p className="text-[8.5px] text-emerald-400 leading-none mt-0.5">No critical care warnings resolved.</p>
                      </div>
                    </div>
                  )}

                  {/* Stripe Progressive Disclosure Metric Cards */}
                  <div className="space-y-3">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Core Telehealth Biomarkers</span>
                    
                    {/* Glucose card */}
                    <MetricCard 
                      title="Capillary Glucose" 
                      value="142" 
                      unit="mg/dL" 
                      subtitle="Post-prandial • Clinical Grade" 
                      icon={Flame} 
                      iconColorClass="text-rose-400" 
                      accentColorClass="from-rose-500/10 to-transparent"
                      detailsTitle="Glucose Diagnostic Summary"
                    >
                      <p>Active wellness logs reveal stable glycemic clearance. Recommended daily self-checks. Keep carbohydrates below 50g per meal.</p>
                    </MetricCard>

                    {/* BP Index card */}
                    <MetricCard 
                      title="BP Systolic / Diastolic" 
                      value="128/82" 
                      unit="mmHg" 
                      subtitle="Stable pod connection telemetry" 
                      icon={Activity} 
                      iconColorClass="text-cyan-400" 
                      accentColorClass="from-cyan-500/10 to-transparent"
                      detailsTitle="BP Clinical Summary"
                    >
                      <p>Cardiovascular indices are within borderline-normal limits. {activePod?.doctorName || 'Doctor'} advises a standard low-sodium diet regime.</p>
                    </MetricCard>
                  </div>

                  {/* Sparkline Visualization */}
                  <MobileChart 
                    title="Glucose Level" 
                    points={[130, 145, 125, 142, 138, 142]} 
                    labels={['May 22', 'Today']} 
                  />

                  {/* Daily Medicine scheduler */}
                  <div className="bg-zinc-900 border border-white/5 rounded-2xl p-3.5 space-y-3.5">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <h4 className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Active e-Rx Pill Scheduler</h4>
                      <span className="text-[8px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/25 px-2 py-0.5 rounded font-bold font-mono">2 ACTIVE</span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex gap-2.5 items-center">
                          <div className="w-8 h-8 rounded-xl bg-white/5 border border-slate-200/60 flex items-center justify-center text-cyan-400 shrink-0">
                            <Pill className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="font-extrabold text-white text-[11px]">Metformin 500mg</h5>
                            <p className="text-[8.5px] text-zinc-400 mt-0.5">1-0-1 • Take with breakfast & dinner</p>
                          </div>
                        </div>
                        <span className="text-[8.5px] font-bold text-zinc-500 font-mono">Next: 2h</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="flex gap-2.5 items-center">
                          <div className="w-8 h-8 rounded-xl bg-white/5 border border-slate-200/60 flex items-center justify-center text-emerald-400 shrink-0">
                            <Pill className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="font-extrabold text-white text-[11px]">Atorvastatin 10mg</h5>
                            <p className="text-[8.5px] text-zinc-400 mt-0.5">0-0-1 • Take before bed</p>
                          </div>
                        </div>
                        <span className="text-[8.5px] font-bold text-zinc-500 font-mono">Next: 8h</span>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 2: MEDICAL RECORDS */}
              {activeTab === 'records' && (
                <div className="space-y-4 animate-fade-in text-white">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wide">
                    <FileText className="h-4 w-4 text-cyan-400" />
                    Clinical Record Vault
                  </h3>

                  {/* e-Prescriptions history */}
                  <div className="space-y-2.5">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Active e-Prescriptions</span>
                    {activeEncounters.length === 0 ? (
                      <p className="text-[10px] text-zinc-500 italic bg-zinc-900 p-3 rounded-2xl border border-white/5 text-center">No active prescriptions locked in the pod.</p>
                    ) : (
                      activeEncounters.map(enc => (
                        <div key={enc.id} className="bg-zinc-900 p-3.5 rounded-2xl border border-white/5 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-extrabold text-white text-[11px]">e-Rx Prescription</h4>
                              <span className="text-[8px] text-zinc-500 block font-mono mt-0.5">{new Date(enc.createdAt).toLocaleDateString()}</span>
                            </div>
                            <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded font-mono font-bold uppercase">SIGNED OFF</span>
                          </div>
                          
                          {enc.clinicalNotes && (
                            <p className="text-[9.5px] text-zinc-400 italic border-l-2 border-cyan-500/30 pl-2 leading-relaxed bg-zinc-950/40 p-2 rounded">
                              " {enc.clinicalNotes} "
                            </p>
                          )}

                          <div className="text-[9.5px] space-y-1.5">
                            <span className="block text-[8px] font-bold text-zinc-500 uppercase font-mono tracking-wider">Prescribed Generic Meds:</span>
                            {enc.medications?.map((m, idx) => (
                              <div key={m.id || idx} className="flex justify-between font-semibold text-zinc-300 text-[9px]">
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
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Pathology Lab Reports</span>
                    {activeReports.length === 0 ? (
                      <p className="text-[10px] text-zinc-500 italic bg-zinc-900 p-3 rounded-2xl border border-white/5 text-center">No pathological records reported yet.</p>
                    ) : (
                      activeReports.map(rep => (
                        <div key={rep.id} className="bg-zinc-900 p-3.5 rounded-2xl border border-white/5 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-extrabold text-white text-[11px]">{rep.testName}</h4>
                              <span className="text-[8px] text-zinc-500 block font-mono mt-0.5">LOINC Code: {rep.loincCode}</span>
                            </div>
                            <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded font-mono font-bold uppercase">Approved</span>
                          </div>

                          <div className="bg-zinc-950/80 p-2.5 rounded-xl border border-white/5 font-mono text-[9.5px] text-zinc-300 leading-normal">
                            <strong>Diagnostic Finding:</strong> {rep.results || 'No quantitative diagnostics details resolved.'}
                          </div>

                          {/* Plain-Language RAG interpreter trigger */}
                          <div className="space-y-2">
                            {translatedRagReportId === rep.id ? (
                              isRagTranslating ? (
                                <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl animate-pulse text-center space-y-2 text-cyan-400">
                                  <RefreshCw className="w-5 h-5 mx-auto animate-spin" />
                                  <p className="text-[8px] font-bold font-mono tracking-widest uppercase">Running Vector RAG Translation...</p>
                                </div>
                              ) : (
                                <div className="p-3.5 bg-cyan-950/80 border border-cyan-500/20 text-cyan-100 rounded-xl space-y-2.5 animate-fade-in text-[9.5px] leading-relaxed">
                                  <div className="flex items-center gap-1.5 text-cyan-400 text-[8px] font-bold tracking-widest uppercase font-mono border-b border-white/5 pb-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                    AI RAG plain language summary
                                  </div>
                                  <p className="whitespace-pre-line font-medium text-zinc-300">{ragTranslationText}</p>
                                  <button
                                    onClick={() => setTranslatedRagReportId(null)}
                                    className="text-[8px] text-zinc-500 hover:text-zinc-300 block mt-1.5 font-bold uppercase tracking-wider underline cursor-pointer"
                                  >
                                    Close AI Advisory
                                  </button>
                                </div>
                              )
                            ) : (
                              <button
                                onClick={() => handleTranslateRAG(rep.id, rep.testName, rep.results || '')}
                                className="w-full py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-bold text-[9px] uppercase tracking-wider rounded-xl transition-all shadow-md flex justify-center items-center gap-1 cursor-pointer"
                              >
                                <Brain className="w-3.5 h-3.5" />
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

              {/* TAB 3: PAYMENTS & INSURANCE */}
              {activeTab === 'wallet' && (
                <div className="space-y-4 animate-fade-in text-white">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wide">
                    <CreditCard className="h-4 w-4 text-cyan-400" />
                    Payments & Insurance
                  </h3>

                  {/* ABHA Health Pass */}
                  <div className="bg-gradient-to-tr from-cyan-600 to-indigo-600 rounded-2xl p-4 text-white shadow-lg space-y-4 relative border border-cyan-400/20 overflow-hidden">
                    <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-white/5" />
                    <div className="flex justify-between items-start relative">
                      <div className="space-y-1">
                        <span className="text-[7.5px] bg-white/20 border border-white/20 px-2 py-0.5 rounded font-mono font-bold tracking-widest uppercase">
                          NDHM • Health ID Pass
                        </span>
                        <h4 className="text-xs font-extrabold tracking-wide mt-1.5 text-white-force">{activePatient?.name || 'Verified Patient'}</h4>
                        <p className="text-[8px] text-cyan-200">ABHA No: 12-3456-7890-1234</p>
                      </div>
                      <div className="w-8 h-8 bg-white/10 border border-slate-200/60 rounded-xl flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-cyan-300 font-bold" />
                      </div>
                    </div>

                    <div className="flex justify-between items-end pt-2 border-t border-cyan-500/30 relative">
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
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Unified Care Invoices</span>
                    {activeInvoices.length === 0 ? (
                      <p className="text-[10px] text-zinc-500 italic bg-zinc-900 p-3 rounded-2xl border border-white/5 text-center">No care invoices recorded.</p>
                    ) : (
                      activeInvoices.map(inv => (
                        <div key={inv.id} className="bg-zinc-900 p-3.5 rounded-2xl border border-white/5 space-y-3.5">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-extrabold text-white text-[11px]">VitalSync Pod Invoice</h4>
                              <span className="text-[8px] text-zinc-500 block font-mono mt-0.5">ID: {(inv.id || '').substring(0, 8)}...</span>
                            </div>
                            <span className={`text-[8.5px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                              inv.paymentStatus === 'cleared'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/25 animate-pulse'
                            }`}>
                              {inv.paymentStatus}
                            </span>
                          </div>

                          <div className="text-[9.5px] space-y-1 text-zinc-400">
                            <div className="flex justify-between"><span>Doctor Consultation:</span><span className="font-mono text-zinc-300">₹{inv.doctorFee}.00</span></div>
                            <div className="flex justify-between"><span>Laboratory Pathology:</span><span className="font-mono text-zinc-300">₹{inv.labFee}.00</span></div>
                            <div className="flex justify-between"><span>Pharmacy prescription:</span><span className="font-mono text-zinc-300">₹{inv.pharmacyFee}.00</span></div>
                            <div className="flex justify-between font-bold text-white border-t border-white/5 pt-1.5 text-[11px]">
                              <span>Total Amount:</span>
                              <span className="font-mono text-cyan-400">₹{inv.totalAmount}.00</span>
                            </div>
                          </div>

                          {/* UPI payment trigger button */}
                          {inv.paymentStatus === 'pending' && (
                            <button
                              onClick={() => handleTriggerUpiSheet(inv)}
                              className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-bold text-[10px] uppercase tracking-wider shadow-lg shadow-emerald-500/10 transition-all flex justify-center items-center gap-1.5 cursor-pointer text-white-force"
                            >
                              <Coins className="h-4 w-4 text-white-force" />
                              Settle Invoice via UPI (₹{inv.totalAmount})
                            </button>
                          )}

                        </div>
                      ))
                    )}
                  </div>

                  {/* 0% MDR Direct UPI Settle Instructions */}
                  <div className="bg-zinc-900 border border-emerald-500/20 rounded-2xl p-4 space-y-3 relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-16 h-16 bg-emerald-500/5 rounded-bl-full flex items-center justify-center">
                      <Coins className="h-5 w-5 text-emerald-400/30" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[7.5px] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold text-emerald-400 uppercase">
                        0% MDR Platform VPA
                      </span>
                      <h4 className="text-xs font-extrabold tracking-wide mt-1.5 text-white">Direct UPI Settle</h4>
                      <p className="text-[9px] text-zinc-400">Avoid gateway charges by paying directly to the clinic's official VPA:</p>
                    </div>

                    <div className="flex items-center justify-between bg-zinc-950 px-3 py-2 rounded-xl border border-white/5">
                      <span className="text-xs font-mono font-bold text-cyan-400 tracking-wide select-all">{activePod?.upiVpa || 'vitalsync@axl'}</span>
                      <button
                        onClick={async () => {
                          const vpaToCopy = activePod?.upiVpa || 'vitalsync@axl';
                          try {
                            if (navigator?.clipboard?.writeText) {
                              await navigator.clipboard.writeText(vpaToCopy);
                            }
                          } catch {
                            /* ignore permission errors */
                          }
                          window.dispatchEvent(new CustomEvent('mediflow-toast', {
                            detail: {
                              title: 'VPA Copied! 📋',
                              message: `${vpaToCopy} has been copied to your clipboard.`,
                              type: 'success'
                            }
                          }));
                        }}
                        className="p-1.5 text-[9px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                      >
                        Copy
                      </button>
                    </div>

                    <div className="text-[9px] text-zinc-400 space-y-1.5 pt-1 border-t border-white/5">
                      <div className="flex gap-1.5">
                        <span className="text-emerald-400 font-bold">1.</span>
                        <span>Copy VPA above & pay the exact Invoice amount from GPay/PhonePe.</span>
                      </div>
                      <div className="flex gap-1.5">
                        <span className="text-emerald-400 font-bold">2.</span>
                        <span>Take a screenshot of the payment receipt.</span>
                      </div>
                      <div className="flex gap-1.5">
                        <span className="text-emerald-400 font-bold">3.</span>
                        <span>Open WhatsApp chat & upload the screenshot. Our AI will automatically verify the UTR and issue your Token!</span>
                      </div>
                    </div>
                  </div>

                  {/* Policies & Compliance Links */}
                  <div className="bg-zinc-900/60 p-4 border border-white/5 rounded-2xl text-zinc-400 space-y-3 mt-4">
                    <h4 className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
                      Patient Legal & Refund Policy
                    </h4>
                    <p className="text-[8.5px] leading-relaxed">
                      Consultation bookings, medical prescription billing, and diagnostic reports follow strict healthcare merchant compliance.
                    </p>
                    <div className="flex flex-wrap gap-3 text-[9px] font-semibold text-cyan-400 border-t border-white/5 pt-2">
                      <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-300 flex items-center gap-1">
                        Terms & Conditions <ChevronRight className="h-2.5 w-2.5" />
                      </a>
                      <span className="text-zinc-650">•</span>
                      <a href="/refund-policy" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-300 flex items-center gap-1">
                        Refund & Cancellation <ChevronRight className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 4: REFILL PLANNER */}
              {activeTab === 'refills' && (
                <div className="space-y-4 animate-fade-in text-white">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wide">
                    <RefreshCw className="h-4 w-4 text-cyan-400" />
                    Chronic Refill Planner
                  </h3>

                  {/* Refills details card */}
                  <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 space-y-3">
                    <div className="flex gap-3 items-start text-cyan-400 font-bold text-xs">
                      <Award className="h-4.5 w-4.5 text-cyan-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-[11px]">Ecosystem Auto-Refill Benefits</h4>
                        <p className="text-[9px] text-zinc-400 font-normal leading-relaxed mt-0.5">
                          Unified chronic refills are prepared automatically based on active clinical records. Dispatch refills in 1-Tap!
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">My Prescribed Chronics</span>
                    
                    <div className="bg-zinc-900 p-3.5 rounded-2xl border border-white/5 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-white/5 border border-slate-200/60 flex items-center justify-center text-cyan-400 shrink-0">
                            <Pill className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-white text-[11px]">Metformin 500mg</h4>
                            <p className="text-[8.5px] text-zinc-400 mt-0.5">Type-2 Diabetes Management</p>
                          </div>
                        </div>
                        <span className="text-[8px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 px-1.5 py-0.5 rounded font-bold font-mono">10 Days left</span>
                      </div>
                      <button
                        onClick={() => handleOneClickRefill('Metformin 500mg')}
                        className="w-full bg-zinc-950 hover:bg-zinc-900 border border-slate-200/60 text-cyan-400 py-2.5 text-[9px] font-bold uppercase tracking-wider rounded-xl transition-all flex justify-center items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        1-Tap Auto-Refill (Clinic Counter)
                      </button>
                    </div>

                    <div className="bg-zinc-900 p-3.5 rounded-2xl border border-white/5 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-white/5 border border-slate-200/60 flex items-center justify-center text-emerald-400 shrink-0">
                            <Pill className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-white text-[11px]">Atorvastatin 10mg</h4>
                            <p className="text-[8.5px] text-zinc-400 mt-0.5">Hypertension Management</p>
                          </div>
                        </div>
                        <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded font-bold font-mono">30 Days left</span>
                      </div>
                      <button
                        onClick={() => handleOneClickRefill('Atorvastatin 10mg')}
                        className="w-full bg-zinc-950 hover:bg-zinc-900 border border-slate-200/60 text-cyan-400 py-2.5 text-[9px] font-bold uppercase tracking-wider rounded-xl transition-all flex justify-center items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        1-Tap Auto-Refill (Clinic Counter)
                      </button>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 5: VITALS & SIM STATUS */}
              {activeTab === 'vitals' && (
                <div className="space-y-4 animate-fade-in text-white">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wide">
                    <Activity className="h-4 w-4 text-cyan-400" />
                    Simulation Status & Logs
                  </h3>

                  {/* Active Patient Switcher inside mobile */}
                  <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 space-y-3">
                    <div>
                      <label className="block text-[8.5px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                        Simulation Active Profile
                      </label>
                      <select
                        value={selectedPhone}
                        onChange={e => setSelectedPhone(e.target.value)}
                        className="w-full bg-zinc-950 border border-slate-200/60 rounded-xl py-2 px-3 text-xs text-white outline-none"
                      >
                        {patients.map(p => (
                          <option key={p.id} value={p.phone} className="bg-zinc-900">{p.name} ({p.phone})</option>
                        ))}
                      </select>
                    </div>

                    {activePatient && (
                      <div className="text-[9.5px] text-zinc-400 font-sans leading-relaxed pt-2 border-t border-white/5">
                        <strong>Chronic list</strong>: {(activePatient.chronicConditions || []).join(', ') || 'None'}<br/>
                        <strong>Allergies</strong>: {(activePatient.allergies || []).join(', ') || 'NKDA'}<br/>
                        <strong>ABHA ID</strong>: {activePatient.abhaId || 'Not set'}
                      </div>
                    )}
                  </div>

                  {/* Form to log vitals */}
                  <form onSubmit={handleLogVitals} className="space-y-3.5 bg-zinc-900 border border-white/5 rounded-2xl p-4">
                    <span className="block text-[8.5px] font-bold text-zinc-500 uppercase tracking-widest">
                      Record Biomarkers
                    </span>
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 mb-1 uppercase tracking-wide">Glucose (mg/dL)</label>
                      <input
                        type="number"
                        placeholder="e.g. 130"
                        value={loggedGlucose}
                        onChange={e => setLoggedGlucose(e.target.value !== '' ? Number(e.target.value) : '')}
                        className="w-full bg-zinc-950 border border-slate-200/60 focus:border-cyan-500/30 rounded-xl py-2 px-3 text-xs text-white outline-none transition-all"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-400 mb-1 uppercase tracking-wide">BP Systolic</label>
                        <input
                          type="number"
                          placeholder="e.g. 120"
                          value={loggedBpSystolic}
                          onChange={e => setLoggedBpSystolic(e.target.value !== '' ? Number(e.target.value) : '')}
                          className="w-full bg-zinc-950 border border-slate-200/60 focus:border-cyan-500/30 rounded-xl py-2 px-3 text-xs text-white outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-400 mb-1 uppercase tracking-wide">BP Diastolic</label>
                        <input
                          type="number"
                          placeholder="e.g. 80"
                          value={loggedBpDiastolic}
                          onChange={e => setLoggedBpDiastolic(e.target.value !== '' ? Number(e.target.value) : '')}
                          className="w-full bg-zinc-950 border border-slate-200/60 focus:border-cyan-500/30 rounded-xl py-2 px-3 text-xs text-white outline-none transition-all"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl font-bold text-[10px] uppercase tracking-wider py-2.5 transition-all shadow-md flex justify-center items-center gap-1 cursor-pointer"
                    >
                      <Activity className="h-3.5 w-3.5 animate-pulse" />
                      Sync Vitals to Care Pod
                    </button>
                  </form>

                  {/* PWA capabilities status bar */}
                  <div className="bg-zinc-900 border border-white/5 text-white rounded-2xl p-4 space-y-2.5">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-[8px] text-cyan-400 font-bold uppercase tracking-widest font-mono">
                        PWA Capabilities Status
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-semibold">
                      <span>Service Worker Active:</span>
                      <span className="text-emerald-400 font-bold font-mono">ONLINE</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('mediflow-toast', {
                          detail: {
                            title: 'PWA Connected successfully! 📱',
                            message: 'VitalSync Care shortcut committed to smartphone home screen.',
                            type: 'success'
                          }
                        }));
                      }}
                      className="w-full py-2 bg-white/5 hover:bg-white/10 border border-slate-200/60 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer text-zinc-300"
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      Add to Mobile Home Screen
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 6: BOOK APPOINTMENT FOR NEW PATIENT */}
              {activeTab === 'book_appointment' && (
                <div className="space-y-4 animate-fade-in text-white text-left">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wide">
                    <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
                    Book Family/Friend Appointment
                  </h3>
                  
                  <div className="bg-zinc-900 border border-white/5 p-4 rounded-2xl space-y-3">
                    <p className="text-[10px] text-zinc-400 leading-relaxed">
                      Register a new family member or friend and book a clinic consultation slot by paying the OPD consultation fee.
                    </p>

                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!bookName || !bookPhone || !bookAge) return;

                        try {
                          // 1. Register new patient
                          const newPat = api.registerPatient({
                            id: `pat-${bookPhone}`,
                            name: bookName,
                            phone: bookPhone,
                            age: Number(bookAge),
                            gender: bookGender,
                            allergies: [],
                            chronicConditions: [],
                            queueStatus: 'awaiting_vitals'
                          } as any);

                          // 2. Create the consult invoice (source: whatsapp / patient) with scheduled date
                          api.createGate1Consult(newPat.id, 'whatsapp', bookDate || undefined, bookTime || undefined);

                          // 3. Reset form
                          setBookName('');
                          setBookPhone('');
                          setBookAge('');
                          setBookGender('Male');
                          setBookDate('');
                          setBookTime('');

                          // 4. Update local state
                          setPatients(api.getPatients());

                          // 5. Retrieve just-created invoice and open UPI modal
                          const createdInv = BillingService.getInvoices()
                            .filter(inv => inv.patientId === newPat.id && inv.status === 'unpaid' && inv.type === 'consult')
                            .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
                          if (createdInv) {
                            const uInvShape: UnifiedInvoice = {
                              id: createdInv.id,
                              encounterId: createdInv.appointmentId,
                              patientId: newPat.id,
                              patientName: bookName,
                              patientPhone: bookPhone,
                              doctorFee: createdInv.amount,
                              labFee: 0,
                              pharmacyFee: 0,
                              platformFee: 0,
                              totalAmount: createdInv.amount,
                              upiQrPayload: '',
                              paymentStatus: 'pending',
                              createdAt: createdInv.createdAt,
                            } as UnifiedInvoice;
                            BillingService.saveUnifiedInvoice(uInvShape);
                            handleTriggerUpiSheet(uInvShape);
                          }
                        } catch (error) {
                          console.error('[Patient Mobile] Booking failed:', error);
                          window.dispatchEvent(new CustomEvent('mediflow-toast', {
                            detail: {
                              title: 'Booking Failed',
                              message: 'Unable to process your request. Please try again.',
                              type: 'error'
                            }
                          }));
                        }
                      }} 
                      className="space-y-3"
                    >
                      <div className="space-y-1">
                        <label className="block text-[9px] text-zinc-400 font-bold uppercase tracking-wider font-mono font-bold">Patient Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Rahul Verma"
                          value={bookName}
                          onChange={e => setBookName(e.target.value)}
                          className="w-full bg-zinc-950 border border-slate-200/60 focus:border-cyan-500/30 rounded-xl py-2 px-3 text-xs text-white outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[9px] text-zinc-400 font-bold uppercase tracking-wider font-mono font-bold">Phone Number *</label>
                        <input
                          type="tel"
                          required
                          placeholder="e.g. 9876541122"
                          value={bookPhone}
                          onChange={e => setBookPhone(e.target.value)}
                          className="w-full bg-zinc-950 border border-slate-200/60 focus:border-cyan-500/30 rounded-xl py-2 px-3 text-xs text-white outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[9px] text-zinc-400 font-bold uppercase tracking-wider font-mono font-bold">Age *</label>
                          <input
                            type="number"
                            required
                            placeholder="e.g. 28"
                            value={bookAge}
                            onChange={e => setBookAge(e.target.value)}
                            className="w-full bg-zinc-950 border border-slate-200/60 focus:border-cyan-500/30 rounded-xl py-2 px-3 text-xs text-white outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[9px] text-zinc-400 font-bold uppercase tracking-wider font-mono font-bold">Gender</label>
                          <select
                            value={bookGender}
                            onChange={e => setBookGender(e.target.value as any)}
                            className="w-full bg-zinc-950 border border-slate-200/60 focus:border-cyan-500/30 rounded-xl py-2 px-3 text-xs text-white outline-none"
                          >
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[9px] text-zinc-400 font-bold uppercase tracking-wider font-mono font-bold">Consultation Date</label>
                          <input
                            type="date"
                            value={bookDate}
                            onChange={e => setBookDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full bg-zinc-950 border border-slate-200/60 focus:border-cyan-500/30 rounded-xl py-2 px-3 text-xs text-white outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[9px] text-zinc-400 font-bold uppercase tracking-wider font-mono font-bold">Time Slot</label>
                          <select
                            value={bookTime}
                            onChange={e => setBookTime(e.target.value)}
                            className="w-full bg-zinc-950 border border-slate-200/60 focus:border-cyan-500/30 rounded-xl py-2 px-3 text-xs text-white outline-none"
                          >
                            <option value="10:00 AM - 12:00 PM">Morning (10 AM - 12 PM)</option>
                            <option value="02:00 PM - 04:00 PM">Afternoon (2 PM - 4 PM)</option>
                            <option value="06:00 PM - 08:00 PM">Evening (6 PM - 8 PM)</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          className="w-full bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl font-bold text-[10px] uppercase tracking-wider py-2.5 transition-all shadow-md flex justify-center items-center gap-1.5 cursor-pointer text-white-force"
                        >
                          <Lock className="w-3.5 h-3.5 text-white-force" />
                          Register & Pay OPD Fee (₹500)
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

            </div>

            {/* Google Pay Style mobile sheet modal backdrop */}
            {isUpiModalOpen && activeUpiInvoice && (
              <div className="absolute inset-0 bg-slate-800/80 z-50 flex flex-col justify-end animate-fade-in">
                <div className="bg-zinc-900 rounded-t-[32px] p-5 space-y-4 border-t border-slate-200/60 animate-slide-up shadow-2xl">
                  
                  {/* Modal Header */}
                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <div className="flex gap-2 items-center text-white">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 flex items-center justify-center font-bold text-xs">
                        G
                      </div>
                      <h4 className="font-extrabold text-[11px] uppercase tracking-wider font-mono">Unified UPI split payout</h4>
                    </div>
                    <button
                      onClick={() => setIsUpiModalOpen(false)}
                      className="p-1 hover:bg-white/5 rounded-full text-zinc-400"
                    >
                      <X className="w-4 h-4 font-bold" />
                    </button>
                  </div>

                  {/* Payment success sheet */}
                  {paymentSuccess ? (
                    <div className="py-6 text-center space-y-3 animate-fade-in">
                      <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
                        <CheckCircle2 className="h-8 w-8 text-emerald-400 animate-bounce" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-white text-sm">Payment Approved!</h4>
                        <p className="text-[10px] text-zinc-400 mt-0.5">Unified Care Split Ledgers Settled Successfully.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-center bg-zinc-950/80 p-4 rounded-2xl border border-white/5">
                        <span className="text-[8px] text-zinc-500 block uppercase font-bold tracking-widest font-mono">Invoice Settle Total</span>
                        <h2 className="text-xl font-extrabold text-cyan-400 font-mono mt-1">₹{(activeUpiInvoice.totalAmount || 0).toFixed(2)}</h2>
                      </div>

                      {/* Split calculations break logs */}
                      <div className="text-[9.5px] bg-zinc-950/50 p-3.5 border border-white/5 rounded-2xl space-y-2 text-zinc-400">
                        <span className="block text-[8px] font-bold text-zinc-500 uppercase font-mono tracking-widest">Ecosystem Split Ledger Settles</span>
                        <div className="flex justify-between"><span>👩‍⚕️ Doctor Consultation:</span><span className="font-mono text-zinc-300">₹{(activeUpiInvoice.doctorFee || 0).toFixed(2)}</span></div>
                        {((activeUpiInvoice.labFee || 0) > 0) && (
                          <div className="flex justify-between"><span>🧪 Lab Pathology:</span><span className="font-mono text-zinc-300">₹{(activeUpiInvoice.labFee || 0).toFixed(2)}</span></div>
                        )}
                        {((activeUpiInvoice.pharmacyFee || 0) > 0) && (
                          <div className="flex justify-between"><span>💊 Pharmacy Medication:</span><span className="font-mono text-zinc-300">₹{(activeUpiInvoice.pharmacyFee || 0).toFixed(2)}</span></div>
                        )}
                        <div className="flex justify-between border-t border-white/5 pt-1.5 font-bold text-white text-[10px]">
                          <span>🛡️ VitalSync Platform Fee (3%):</span>
                          <span className="font-mono text-cyan-400">₹{(activeUpiInvoice.platformFee || 0).toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Pin code entering input sheet */}
                      <div>
                        <label className="block text-[8.5px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 text-center">Enter 4-Digit UPI PIN</label>
                        <input
                          type="password"
                          maxLength={4}
                          placeholder="••••"
                          value={upiPin}
                          onChange={e => setUpiPin(e.target.value)}
                          className="w-24 mx-auto text-center font-extrabold font-mono tracking-widest text-lg bg-zinc-950 border border-slate-200/60 text-white focus:outline-none focus:border-cyan-500/50 rounded-lg py-1 flex justify-center"
                        />
                      </div>

                      <button
                        onClick={handleConfirmUpiPayment}
                        disabled={isPaying || upiPin.length < 4}
                        className={`w-full py-3 text-xs font-bold rounded-xl transition-all shadow-md flex justify-center items-center gap-1.5 text-white-force ${
                          upiPin.length === 4 && !isPaying
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 cursor-pointer text-white-force'
                            : 'bg-zinc-800 text-zinc-500 border border-white/5 cursor-not-allowed'
                        }`}
                      >
                        {isPaying ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Processing secure split payout...
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5 text-white-force font-bold" />
                            Pay UPI splits (₹{(activeUpiInvoice.totalAmount || 0).toFixed(2)})
                          </>
                        )}
                      </button>

                      <div className="relative flex py-1 items-center">
                        <div className="flex-grow border-t border-white/10"></div>
                        <span className="flex-shrink mx-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">OR</span>
                        <div className="flex-grow border-t border-white/10"></div>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          if (!activeUpiInvoice) return;
                          setIsPaying(true);
                          try {
                            const res = await PaymentService.initiatePaymentOrder({
                              gateway: 'razorpay',
                              invoiceId: activeUpiInvoice.id,
                              amount: activeUpiInvoice.totalAmount,
                              patientName: activePatient?.name || 'Patient',
                              patientPhone: activePatient?.phone || ''
                            });

                            if (res.success && res.orderId) {
                              await PaymentService.launchRazorpayModal({
                                orderId: res.orderId,
                                amount: activeUpiInvoice.totalAmount,
                                invoiceId: activeUpiInvoice.id,
                                name: activePatient?.name || 'Patient',
                                phone: activePatient?.phone || '',
                                onSuccess: () => {
                                  setPaymentSuccess(true);
                                  BillingService.clearInvoice(activeUpiInvoice.id, 'razorpay');
                                  setTimeout(() => {
                                    setIsUpiModalOpen(false);
                                    setActiveUpiInvoice(null);
                                    setInvoices(api.getUnifiedInvoices());
                                  }, 1500);
                                },
                                onError: (err) => {
                                  console.warn('[Razorpay Checkout Error]:', err);
                                  window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                    detail: { title: 'Payment Incomplete', message: err.message || 'Payment not completed.', type: 'error' }
                                  }));
                                }
                              });
                            } else {
                              window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                detail: { title: 'Gateway Connection Failed', message: 'Unable to initialize Razorpay checkout order.', type: 'error' }
                              }));
                            }
                          } catch (e: any) {
                            console.warn('[Razorpay Patient Checkout Error]:', e);
                            window.dispatchEvent(new CustomEvent('mediflow-toast', {
                              detail: { title: 'Checkout Error', message: e.message || 'Payment initiation failed.', type: 'error' }
                            }));
                          } finally {
                            setIsPaying(false);
                          }
                        }}
                        disabled={isPaying}
                        className="w-full py-3 text-xs font-bold rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white-force cursor-pointer shadow-md flex justify-center items-center gap-2"
                      >
                        <QrCode className="w-4 h-4 text-white-force" />
                        <span>Pay via Razorpay (Online Payment)</span>
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
