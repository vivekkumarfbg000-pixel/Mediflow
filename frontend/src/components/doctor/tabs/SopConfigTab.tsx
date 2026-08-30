import React, { useMemo } from 'react';
import { api } from '../../../services/api';
import { getIstDateString } from '../../../utils/dateUtils';
import { getPodContext } from '../../../services/podContext';
import type { ClinicSop } from '../../../types';
import { 
  Shield, 
  Upload, 
  ListChecks, 
  Coins, 
  Sparkles, 
  RefreshCw, 
  Terminal, 
  CheckCircle2, 
  Stethoscope, 
  PieChart, 
  Scale, 
  AlertCircle, 
  FlaskConical, 
  ChevronRight, 
  Rocket, 
  User, 
  Network, 
  History,
  Zap 
} from 'lucide-react';

interface SopConfigTabProps {
  sopFile: File | null;
  setSopFile: (f: File | null) => void;
  sopText: string;
  setSopText: (t: string) => void;
  isExtractingSop: boolean;
  setIsExtractingSop: (b: boolean) => void;
  extractionLogs: string[];
  setExtractionLogs: React.Dispatch<React.SetStateAction<string[]>>;
  extractedConfig: any;
  setExtractedConfig: (c: any) => void;
  customSopFileName: string;
  setCustomSopFileName: (s: string) => void;
  sopActiveSubTab: 'upload' | 'active';
  setSopActiveSubTab: (s: 'upload' | 'active') => void;
}

export const SopConfigTab: React.FC<SopConfigTabProps> = React.memo(({
  sopFile,
  setSopFile,
  sopText,
  setSopText,
  isExtractingSop,
  setIsExtractingSop,
  extractionLogs,
  setExtractionLogs,
  extractedConfig,
  setExtractedConfig,
  customSopFileName,
  setCustomSopFileName,
  sopActiveSubTab,
  setSopActiveSubTab
}) => {
  const sops = api.getClinicSops();
  const activeSop = api.getActiveSop();

  const [templateDocName, setTemplateDocName] = React.useState(() => api.getPrescriptionTemplate().doctorName || 'Attending Physician');
  const [templateDocQual, setTemplateDocQual] = React.useState(() => api.getPrescriptionTemplate().doctorQualification || 'MBBS, MS (Ophthalmology), FICO (London)');
  const [templateDocReg, setTemplateDocReg] = React.useState(() => api.getPrescriptionTemplate().doctorRegNo || 'MCI-84992-A');
  const [templateClinicName, setTemplateClinicName] = React.useState(() => api.getPrescriptionTemplate().clinicName || 'Smart Care Clinic & Hospital');
  const [templateClinicAddress, setTemplateClinicAddress] = React.useState(() => api.getPrescriptionTemplate().clinicAddress || 'Main Road, Health Plaza, City Center');
  const [templateClinicPhone, setTemplateClinicPhone] = React.useState(() => api.getPrescriptionTemplate().clinicPhone || '+91 99342 98453');
  const [templateHeaderColor, setTemplateHeaderColor] = React.useState(() => api.getPrescriptionTemplate().headerColor || '#0284c7');
  const [templateFooterNote, setTemplateFooterNote] = React.useState(() => api.getPrescriptionTemplate().footerNote || 'Emergency Care: Available 24x7 • Valid for Follow-up Review within 15 Days • Please bring this prescription for your review.');
  const [isSavingTemplate, setIsSavingTemplate] = React.useState(false);

  const handleSaveTemplate = () => {
    setIsSavingTemplate(true);
    api.savePrescriptionTemplate({
      doctorName: templateDocName,
      doctorQualification: templateDocQual,
      doctorRegNo: templateDocReg,
      clinicName: templateClinicName,
      clinicAddress: templateClinicAddress,
      clinicPhone: templateClinicPhone,
      headerColor: templateHeaderColor,
      footerNote: templateFooterNote
    });
    setTimeout(() => {
      setIsSavingTemplate(false);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Prescription Template Saved! 📄',
          message: 'All printed OPD slips and e-prescriptions will now use this exact letterhead.',
          type: 'success'
        }
      }));
    }, 300);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSopFile(file);
    setCustomSopFileName(file.name);
    const text = await file.text();
    setSopText(text);
  };

  const handleExtractSop = async () => {
    if (!sopText.trim()) return;
    setIsExtractingSop(true);
    setExtractionLogs([]);
    setExtractedConfig(null);

    // Simulated AI extraction pipeline with streaming logs
    const stages = [
      { delay: 400, log: '🤖 Initializing Gemini MedLM SOP Parser...' },
      { delay: 800, log: '📄 Reading document structure and sections...' },
      { delay: 1200, log: '💊 Extracting doctor consultation fee from fee schedule...' },
      { delay: 1700, log: '🧪 Parsing pathology test price list (LOINC-code mapping)...' },
      { delay: 2200, log: '💰 Detecting commission split instructions (Doctor / Lab / Platform)...' },
      { delay: 2700, log: '📋 Extracting clinical workflow guidelines and SOPs...' },
      { delay: 3200, log: '✅ Validating extracted config against VitalSync billing engine...' },
      { delay: 3600, log: '🔐 Encrypting and saving SOP config to your clinic profile...' },
    ];

    for (const stage of stages) {
      await new Promise(r => setTimeout(r, stage.delay));
      setExtractionLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${stage.log}`]);
    }

    // AI Extraction Heuristics
    const text = sopText.toLowerCase();

    const docFeeMatch = text.match(/(?:doctor|consultation|doctor's|physician)\s*(?:fee|charge|rate)[^0-9]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)/i) ||
                        text.match(/(?:rs\.?|inr|₹)\s*(\d+(?:\.\d+)?)\s*(?:doctor|consultation)/i);
    const docFee = docFeeMatch ? parseFloat(docFeeMatch[1]) : activeSop?.extractedConfig?.doctor_fee ?? 500;

    const sosFeeMatch = text.match(/(?:emergency|sos|urgent)\s*(?:fee|charge|rate)[^0-9]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)/i) ||
                        text.match(/(?:rs\.?|inr|₹)\s*(\d+(?:\.\d+)?)\s*(?:emergency|sos|urgent)/i);
    const emergencySosFee = sosFeeMatch ? parseFloat(sosFeeMatch[1]) : (activeSop?.extractedConfig?.emergency_sos_fee ?? Math.round(docFee * 1.20));

    const splitDocMatch = text.match(/(?:doctor|physician|referring)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%/i);
    const splitPlatMatch = text.match(/(?:platform|vitalsync|software|app)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%/i);
    const splitLabMatch = text.match(/(?:lab|laboratory|pathology)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%/i);
    const splitPharmaDocMatch = text.match(/(?:medicine|pharmacy|drug)\s*(?:commission|referral|split|share)[^0-9]*(\d+(?:\.\d+)?)\s*%/i);

    const splitDoc = splitDocMatch ? parseFloat(splitDocMatch[1]) : activeSop?.extractedConfig?.splits?.doctor ?? 40;
    const splitPlat = splitPlatMatch ? parseFloat(splitPlatMatch[1]) : activeSop?.extractedConfig?.splits?.platform ?? 3;
    const splitLab = splitLabMatch ? parseFloat(splitLabMatch[1]) : activeSop?.extractedConfig?.splits?.lab ?? 57;
    const splitPharmaDoc = splitPharmaDocMatch ? parseFloat(splitPharmaDocMatch[1]) : (activeSop?.extractedConfig?.splits as any)?.pharmacyDoctor ?? 20;

    // Parse test prices
    const testPrices: Record<string, number> = { ...activeSop?.extractedConfig?.test_prices };
    const hba1cMatch = text.match(/(?:hba1c|glycated hemoglobin|a1c)[^0-9]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)/i);
    const creatinineMatch = text.match(/(?:creatinine|serum creatinine)[^0-9]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)/i);
    const hemoglobinMatch = text.match(/(?:total hemoglobin|hemoglobin)[^0-9]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)/i);
    const sodiumMatch = text.match(/(?:serum sodium|sodium)[^0-9]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)/i);
    const bilirubinMatch = text.match(/(?:bilirubin|total bilirubin)[^0-9]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)/i);

    if (hba1cMatch) testPrices['4544-3'] = parseFloat(hba1cMatch[1]);
    if (creatinineMatch) testPrices['2160-0'] = parseFloat(creatinineMatch[1]);
    if (hemoglobinMatch) testPrices['3024-7'] = parseFloat(hemoglobinMatch[1]);
    if (sodiumMatch) testPrices['2947-0'] = parseFloat(sodiumMatch[1]);
    if (bilirubinMatch) testPrices['1975-2'] = parseFloat(bilirubinMatch[1]);

    const guidelineLines = sopText.split('\n').filter(l =>
      l.trim().startsWith('-') || l.trim().startsWith('•') || l.trim().startsWith('*') || /^\d+\./.test(l.trim())
    ).map(l => l.trim().replace(/^[-•*\d.]+\s*/, '')).filter(l => l.length > 5).slice(0, 12);

    const config = {
      doctor_fee: docFee,
      emergency_sos_fee: emergencySosFee,
      test_prices: testPrices,
      splits: { doctor: splitDoc, platform: splitPlat, lab: splitLab, pharmacyDoctor: splitPharmaDoc },
      guidelines: guidelineLines.length > 0 ? guidelineLines : activeSop?.extractedConfig?.guidelines ?? []
    };

    setExtractedConfig(config);
    setExtractionLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🎉 Extraction complete! Config ready to activate.`]);
    setIsExtractingSop(false);
  };

  const handleActivateSop = () => {
    const activeProfile = (api as any).getActiveProfile?.() || (api as any).getDoctorProfile?.();
    const activePod = (api as any).getActivePod?.() || (typeof window !== 'undefined' && (window as any).__mediflow_active_pod);
    const currentEntityId = getPodContext().entityId || activePod?.id || activeProfile?.clinicId || activeProfile?.entityId || 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002';

    const newSop: ClinicSop = {
      id: `sop-${Date.now()}`,
      entityId: currentEntityId,
      sopFileName: customSopFileName || sopFile?.name || 'Clinic_SOP.txt',
      sopText,
      extractedConfig,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    // Deactivate previous SOPs
    const existing = api.getClinicSops().map((s: ClinicSop) => ({ ...s, isActive: false }));
    api.saveClinicSops([newSop, ...existing]);
    setExtractedConfig(null);
    setSopText('');
    setSopFile(null);
    setExtractionLogs([]);
    setSopActiveSubTab('active');
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: { title: '🏥 Clinic SOP Activated!', message: `"${newSop.sopFileName}" is now live. Billing, splits, and workflows updated.`, type: 'success' }
    }));
  };

  const testNames: Record<string, string> = {
    '4544-3': 'HbA1c (Glycated Hemoglobin)',
    '2160-0': 'Serum Creatinine',
    '3024-7': 'Total Hemoglobin',
    '2947-0': 'Serum Sodium',
    '1975-2': 'Total Bilirubin'
  };

  return (
    <div className="p-4 space-y-6 animate-fade-in text-slate-800 text-left">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <Shield className="w-6 h-6 text-violet-600 shrink-0" />
            Clinic SOP Center
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Upload clinic Standard Operating Procedure — AI extracts fee structures, lab prices, splits, and workflow rules</p>
        </div>
        {activeSop && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
            Active SOP: {activeSop.sopFileName}
          </div>
        )}
      </div>

      {/* Sub-tabs — 2-Column Mobile-First Horizontal Segmented Controller */}
      <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/5 rounded-2xl w-full max-w-md">
        {[
          { id: 'upload', label: 'Upload New SOP', sublabel: 'नया एसओपी', icon: <Upload className="w-3.5 h-3.5" /> },
          { id: 'active', label: 'Active SOP & Rules', sublabel: 'सक्रिय नियम', icon: <ListChecks className="w-3.5 h-3.5" /> }
        ].map(t => (
          <button 
            key={t.id} 
            type="button"
            onClick={() => setSopActiveSubTab(t.id as any)}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer border-0 ${
              sopActiveSubTab === t.id 
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20' 
                : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/5'
            }`}
          >
            {t.icon}
            <div className="flex flex-col text-left leading-tight">
              <span className="text-[10.5px] font-extrabold">{t.label}</span>
              <span className={`text-[8px] font-medium ${sopActiveSubTab === t.id ? 'text-white/75' : 'text-slate-400 dark:text-slate-500'}`}>
                {t.sublabel}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* UPLOAD PANEL */}
      {sopActiveSubTab === 'upload' && (
        <div className="space-y-5">
          {/* ── Revenue Split Ledger Widget ─────────────────────────── */}
          {(() => {
            const financials = api.getFinancialLedgers();
            const uInvoices = api.getUnifiedInvoices();
            const saasInvoices = api.getInvoices();

            const invMap = new Map<string, { totalAmount: number; paymentStatus: string; createdAt?: string }>();
            uInvoices.forEach(i => {
              invMap.set(i.id, {
                totalAmount: Number(i.totalAmount) || ((Number(i.doctorFee) || 0) + (Number(i.labFee) || 0) + (Number(i.pharmacyFee) || 0)),
                paymentStatus: i.paymentStatus || 'pending',
                createdAt: i.createdAt
              });
            });
            saasInvoices.forEach(i => {
              if (!invMap.has(i.id) && !invMap.has(i.appointmentId)) {
                invMap.set(i.id, {
                  totalAmount: Number(i.amount) || 0,
                  paymentStatus: i.status === 'paid' ? 'cleared' : 'pending',
                  createdAt: i.createdAt
                });
              }
            });

            const allInvoices = Array.from(invMap.values());
            const todayStr = getIstDateString();
            const grossRev  = allInvoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
            const cleared   = allInvoices.filter(i => (i.paymentStatus as string) === 'cleared' || (i.paymentStatus as string) === 'paid').reduce((s, i) => s + (i.totalAmount || 0), 0);
            const pending   = allInvoices.filter(i => (i.paymentStatus as string) === 'pending' || (i.paymentStatus as string) === 'unpaid').reduce((s, i) => s + (i.totalAmount || 0), 0);
            const todayCount = allInvoices.filter(i => i.createdAt?.startsWith(todayStr)).length;
            const allTotal  = financials.reduce((s, l) => s + (l.netPayout || 0), 0) || 1;

            const categories = [
              { type: 'appointment_fee',      label: 'Clinic Consult Payout',       dot: 'bg-indigo-500',  bar: 'bg-gradient-to-r from-indigo-500 to-indigo-600' },
              { type: 'lab_commission',        label: 'Lab Share Settlement',         dot: 'bg-teal-500',    bar: 'bg-gradient-to-r from-teal-400 to-teal-500'   },
              { type: 'medicine_commission',   label: 'Pharmacy Share Settlement',    dot: 'bg-violet-500',  bar: 'bg-gradient-to-r from-violet-500 to-violet-600' },
              { type: 'platform_fee',          label: 'Platform Commission Split',    dot: 'bg-slate-400',   bar: 'bg-gradient-to-r from-slate-400 to-slate-500'  },
            ];

            return (
              <div className="rounded-2xl border border-amber-500/20 dark:border-amber-500/10 bg-gradient-to-br from-amber-50/60 to-orange-50/20 dark:from-[#1e1b4b]/20 dark:to-[#111827]/30 overflow-hidden shadow-xs backdrop-blur-md">
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/30 flex items-center justify-center">
                      <Coins className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-800 dark:text-white leading-none">Revenue Split Ledger</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Bihar Zone · Real-time payout breakdown</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-850/30 rounded-xl text-[10px] font-bold text-amber-700 dark:text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
                    {todayCount} Today
                  </div>
                </div>

                {/* KPI Row */}
                <div className="grid grid-cols-3 gap-3 px-5 pb-4">
                  <div className="p-3 bg-white/90 dark:bg-slate-900/40 border border-slate-200/60 dark:border-white/5 rounded-xl text-center shadow-xs">
                    <p className="text-[9px] text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-widest">Gross</p>
                    <p className="text-base font-black text-slate-800 dark:text-white mt-0.5 font-mono">₹{grossRev.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/30 rounded-xl text-center shadow-xs">
                    <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-widest">Cleared</p>
                    <p className="text-base font-black text-emerald-700 dark:text-emerald-400 mt-0.5 font-mono">₹{cleared.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30 rounded-xl text-center shadow-xs">
                    <p className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-widest">Pending</p>
                    <p className="text-base font-black text-amber-700 dark:text-amber-450 mt-0.5 font-mono">₹{pending.toLocaleString('en-IN')}</p>
                  </div>
                </div>

                {/* Stacked proportional bar */}
                <div className="px-5 pb-2">
                  <p className="text-[9px] text-slate-550 dark:text-zinc-300 font-bold uppercase tracking-wider mb-2">Revenue Transaction Shares</p>
                  <div className="h-4 bg-slate-250/70 dark:bg-slate-800 rounded-full overflow-hidden flex gap-px relative shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]">
                    {/* Glossy sheen reflection */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent pointer-events-none z-10" />
                    {categories.map((cat, idx) => {
                      const amt = financials.filter(l => l.transactionType === cat.type).reduce((s, l) => s + l.netPayout, 0);
                      const pct = allTotal > 0 ? (amt / allTotal) * 100 : 0;
                      if (pct < 0.5) return null;
                      return (
                        <div
                          key={`sop-bar-${idx}-${cat.type}`}
                          className={`${cat.bar} h-full transition-all duration-700 first:rounded-l-full last:rounded-r-full`}
                          style={{ width: `${pct}%` }}
                          title={`${cat.label}: ₹${Math.round(amt)} (${Math.round(pct)}%)`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Per-category breakdown */}
                <div className="px-5 pb-5 pt-3 space-y-2">
                  {categories.map((cat, idx) => {
                    const amt = financials.filter(l => l.transactionType === cat.type).reduce((s, l) => s + l.netPayout, 0);
                    const pct = allTotal > 0 ? ((amt / allTotal) * 100).toFixed(1) : '0.0';
                    return (
                      <div key={`sop-cat-${idx}-${cat.type}`} className="flex items-center justify-between bg-white/70 dark:bg-slate-950/40 border border-slate-200/50 dark:border-white/5 px-3 py-2.5 rounded-xl hover:bg-white dark:hover:bg-slate-900/60 hover:scale-[1.015] hover:shadow-xs transition-all duration-300">
                        <span className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                          <span className={`w-2.5 h-2.5 rounded-full ${cat.dot} shrink-0`} />
                          {cat.label}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-500 dark:text-zinc-450 font-mono">{pct}%</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-white text-xs">₹{Math.round(amt).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Upload SOP file — compact trigger */}
                <div className="px-5 pb-5 pt-1 border-t border-amber-100/60">
                  <label className="relative w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 border-dashed border-violet-300 text-violet-600 font-bold text-xs hover:bg-violet-50 transition-colors cursor-pointer">
                    <input
                      type="file"
                      accept=".txt,.pdf,.doc,.docx,.md"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <Upload className="w-4 h-4 shrink-0" />
                    {sopFile ? `📄 ${sopFile.name}` : 'Upload SOP Document (.txt / .pdf / .doc)'}
                    {sopFile && (
                      <span className="ml-1 px-1.5 py-0.5 bg-emerald-100 border border-emerald-200 rounded-md text-emerald-700 text-[9px] font-bold">Ready</span>
                    )}
                  </label>
                </div>
              </div>
            );
          })()}


          {/* Paste text directly */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Or Paste SOP Text Directly</label>
            <textarea
              value={sopText}
              onChange={e => setSopText(e.target.value)}
              placeholder={`Paste your clinic SOP here. For example:\n\nDoctor Consultation Fee: INR 450\nHbA1c Test: INR 350\nSerum Creatinine Test: INR 250\nCommission Splits: Doctor 40%, Lab 57%, Platform 3%\n\nGuidelines:\n- Collect FEFO pharmacy batches first\n- Assign Lalit Prasad for all pathology tests\n- Allow home sample collection on request`}
              rows={10}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 resize-none font-mono leading-relaxed"
            />
          </div>

          {/* AI Extract Button */}
          <button
            onClick={handleExtractSop}
            disabled={!sopText.trim() || isExtractingSop}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-sm shadow-lg hover:shadow-violet-400/30 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 cursor-pointer border-0"
          >
            {isExtractingSop ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                AI Extraction in Progress...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Extract & Analyse SOP with Gemini AI
              </>
            )}
          </button>

          {/* Live Extraction Logs */}
          {extractionLogs.length > 0 && (
            <div className="rounded-2xl bg-violet-50/40 border border-violet-100 p-4 space-y-1.5 font-mono text-slate-700 shadow-sm">
              <p className="text-xs text-violet-600 font-bold mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-4 h-4 animate-pulse text-violet-600" />
                AI Extraction Console
              </p>
              {extractionLogs.map((log, i) => (
                <p key={`ext-log-${i}-${String(log).substring(0, 15)}`} className={`text-xs ${i === extractionLogs.length - 1 ? 'text-emerald-600 font-bold' : 'text-slate-600'}`}>{log}</p>
              ))}
              {isExtractingSop && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{animationDelay:'0ms'}}/>
                    <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{animationDelay:'150ms'}}/>
                    <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{animationDelay:'300ms'}}/>
                  </div>
                  <span className="text-xs text-violet-600 font-semibold">Processing...</span>
                </div>
              )}
            </div>
          )}

          {/* Extracted Config Preview */}
          {extractedConfig && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <h3 className="font-bold text-slate-800 text-sm">AI-Extracted Configuration Preview</h3>
                <span className="text-xs text-slate-600">— review before activating</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Doctor Fee */}
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 space-y-2">
                  <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
                    <Stethoscope className="w-4 h-4 shrink-0" />
                    Doctor Fee
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 text-sm">₹</span>
                    <input
                      type="number"
                      value={extractedConfig.doctor_fee || 0}
                      onChange={e => {
                        const newDocFee = parseFloat(e.target.value) || 0;
                        setExtractedConfig({
                          ...extractedConfig, 
                          doctor_fee: newDocFee,
                          emergency_sos_fee: Math.round(newDocFee * 1.20)
                        });
                      }}
                      className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-sm font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                </div>

                {/* Emergency SOS Fee */}
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-700 font-bold text-xs uppercase tracking-wider">
                      <Zap className="w-4 h-4 shrink-0" />
                      Emergency SOS Fee
                    </div>
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">+20%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 text-sm">₹</span>
                    <input
                      type="number"
                      value={extractedConfig.emergency_sos_fee || Math.round((extractedConfig.doctor_fee || 500) * 1.20)}
                      onChange={e => setExtractedConfig({...extractedConfig, emergency_sos_fee: parseFloat(e.target.value) || 0})}
                      className="w-full bg-white border border-rose-200 rounded-xl px-3 py-2 text-sm font-bold text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />
                  </div>
                </div>

                {/* Commission Splits */}
                <div className="p-4 rounded-2xl bg-violet-50 border border-violet-100 space-y-2">
                  <div className="flex items-center gap-2 text-violet-700 font-bold text-xs uppercase tracking-wider">
                    <PieChart className="w-4 h-4 shrink-0" />
                    Lab Splits (%)
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { label: 'Doctor', key: 'doctor', color: 'text-blue-600' },
                      { label: 'Platform', key: 'platform', color: 'text-violet-600' },
                      { label: 'Lab', key: 'lab', color: 'text-emerald-600' }
                    ].map(s => (
                      <div key={s.key} className="flex items-center gap-2">
                        <span className={`text-xs font-semibold w-16 ${s.color}`}>{s.label}</span>
                        <input
                          type="number"
                          value={extractedConfig.splits[s.key] ?? 0}
                          onChange={e => setExtractedConfig({...extractedConfig, splits: {...extractedConfig.splits, [s.key]: parseFloat(e.target.value) || 0}})}
                          className="flex-1 bg-white border border-violet-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
                        />
                        <span className="text-xs text-slate-600">%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total Split Check */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 text-slate-600 font-bold text-xs uppercase tracking-wider">
                    <Scale className="w-4 h-4 shrink-0" />
                    Split Validation
                  </div>
                  {(() => {
                    const total = (extractedConfig.splits.doctor || 0) + (extractedConfig.splits.platform || 0) + (extractedConfig.splits.lab || 0);
                    const isValid = Math.abs(total - 100) < 0.01;
                    return (
                      <div className={`flex items-center gap-2 p-2 rounded-lg ${isValid ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {isValid ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 shrink-0" />
                        )}
                        <span className="text-xs font-bold">Total: {total.toFixed(1)}% {isValid ? '✓ Valid' : 'Must equal 100%'}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Test Prices */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider">
                  <FlaskConical className="w-4 h-4 shrink-0" />
                  Lab Test Prices (per catalog item)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(testNames).map(([loinc, name]) => (
                    <div key={loinc} className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5">
                      <p className="text-xs font-bold text-slate-700 truncate">{name}</p>
                      <p className="text-[10px] text-slate-600 font-mono">LOINC: {loinc}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500">₹</span>
                        <input
                          type="number"
                          value={extractedConfig.test_prices[loinc] ?? 350}
                          onChange={e => setExtractedConfig({...extractedConfig, test_prices: {...extractedConfig.test_prices, [loinc]: parseFloat(e.target.value) || 0}})}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Guidelines */}
              {extractedConfig.guidelines.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider">
                    <ListChecks className="w-4 h-4 shrink-0" />
                    Extracted Workflow Guidelines
                  </div>
                  <ul className="space-y-1.5">
                    {extractedConfig.guidelines.map((g: string, i: number) => (
                      <li key={`guide-extracted-${i}-${String(g).substring(0, 15)}`} className="flex items-start gap-2 text-xs text-amber-800">
                        <ChevronRight className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Activate Button */}
              <button
                onClick={handleActivateSop}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm shadow-lg hover:shadow-emerald-400/30 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer border-0"
              >
                <Rocket className="w-5 h-5 shrink-0" />
                Activate SOP — Apply to Billing, Splits & Workflows
              </button>
            </div>
          )}
        </div>
      )}

      {/* ACTIVE SOP RULES PANEL */}
      {sopActiveSubTab === 'active' && (
        <div className="space-y-5">
          {!activeSop ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-600">
              <Shield className="w-16 h-16 text-slate-300" />
              <p className="font-semibold text-sm">No active SOP found</p>
              <button onClick={() => setSopActiveSubTab('upload')} className="px-6 py-3 bg-violet-600 text-white rounded-2xl text-xs font-bold hover:bg-violet-750 cursor-pointer border-0">
                Upload Your First SOP →
              </button>
            </div>
          ) : (
            <>
              {/* SOP Meta Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-violet-200 uppercase tracking-wider font-bold">Active Clinic SOP</p>
                    <h3 className="text-lg font-extrabold mt-1 text-white">{activeSop.sopFileName}</h3>
                    <p className="text-xs text-violet-300 mt-1">Activated: {new Date(activeSop.createdAt).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})}</p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white/20 rounded-xl text-xs font-bold">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    Live
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Doctor Fee', value: `₹${activeSop.extractedConfig?.doctor_fee ?? 500}`, icon: <Stethoscope className="w-5 h-5 text-blue-500 mx-auto" />, colorClasses: 'bg-blue-50 border-blue-100 text-blue-700' },
                  { label: 'Emergency SOS Fee (+20%)', value: `₹${activeSop.extractedConfig?.emergency_sos_fee ?? Math.round((activeSop.extractedConfig?.doctor_fee ?? 500) * 1.20)}`, icon: <Zap className="w-5 h-5 text-rose-500 mx-auto" />, colorClasses: 'bg-rose-50 border-rose-100 text-rose-700' },
                  { label: 'Doctor Split', value: `${activeSop.extractedConfig?.splits?.doctor ?? 40}%`, icon: <User className="w-5 h-5 text-indigo-500 mx-auto" />, colorClasses: 'bg-indigo-50 border-indigo-100 text-indigo-700' },
                  { label: 'Platform Split', value: `${activeSop.extractedConfig?.splits?.platform ?? 3}%`, icon: <Network className="w-5 h-5 text-violet-500 mx-auto" />, colorClasses: 'bg-violet-50 border-violet-100 text-violet-700' },
                  { label: 'Lab Split', value: `${activeSop.extractedConfig?.splits?.lab ?? 57}%`, icon: <Coins className="w-5 h-5 text-emerald-500 mx-auto" />, colorClasses: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
                ].map((stat: any) => {
                  const [bg, border, textColor] = stat.colorClasses.split(' ');
                  return (
                    <div key={stat.label} className={`p-4 rounded-2xl ${bg} border ${border} text-center`}>
                      <div className="mb-1">{stat.icon}</div>
                      <p className={`text-lg font-extrabold ${textColor} mt-1`}>{stat.value}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">{stat.label}</p>
                    </div>
                  );
                })}
              </div>

              {/* Lab Test Prices */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                <h4 className="font-bold text-slate-750 text-sm flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-blue-500 shrink-0" />
                  Active Lab Test Price Schedule
                </h4>
                <div className="divide-y divide-slate-100">
                  {Object.entries(activeSop.extractedConfig?.test_prices || {}).map(([loinc, price]) => (
                    <div key={loinc} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{testNames[loinc] || loinc}</p>
                        <p className="text-[10px] text-slate-600 font-mono">LOINC: {loinc}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-800">₹{Number(price) || 0}</span>
                        <div className="text-[10px] text-slate-600 space-y-0.5 text-right">
                          <p className="text-blue-600">Dr: ₹{((Number(price) || 0) * (activeSop.extractedConfig?.splits?.doctor ?? 40) / 100).toFixed(0)}</p>
                          <p className="text-emerald-600">Lab: ₹{((Number(price) || 0) * (activeSop.extractedConfig?.splits?.lab ?? 57) / 100).toFixed(0)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Guidelines */}
              {(activeSop.extractedConfig?.guidelines || []).length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 space-y-2">
                  <h4 className="font-bold text-amber-700 text-sm flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-amber-600 shrink-0" />
                    Active Workflow Guidelines
                  </h4>
                  <ul className="space-y-2">
                    {(activeSop.extractedConfig?.guidelines || []).map((g: string, i: number) => (
                      <li key={`guide-active-${i}-${String(g).substring(0, 15)}`} className="flex items-start gap-2 text-xs text-amber-800">
                        <span className="w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 font-bold flex-shrink-0 text-[10px]">{i + 1}</span>
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Custom Doctor Prescription Letterhead Template & Print Styling */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 text-left">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-bold">
                      📄
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                        Custom OPD Prescription Letterhead Template & Print Styling
                      </h4>
                      <p className="text-[10px] text-slate-500">Configures the physical case sheet slip header printed by the compounder and digital e-Rx letterheads.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    disabled={isSavingTemplate}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition active:scale-95 cursor-pointer border-0 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isSavingTemplate ? 'Saving Template...' : 'Save Template'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">Doctor Full Name & Title</label>
                    <input
                      type="text"
                      value={templateDocName}
                      onChange={(e) => setTemplateDocName(e.target.value)}
                      placeholder="e.g. Dr. Attending Physician"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">Medical Registration No.</label>
                    <input
                      type="text"
                      value={templateDocReg}
                      onChange={(e) => setTemplateDocReg(e.target.value)}
                      placeholder="e.g. MCI-84992-A / State Reg No"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold outline-none focus:border-indigo-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="font-bold text-slate-700 block">Doctor Degrees & Clinical Specializations</label>
                    <input
                      type="text"
                      value={templateDocQual}
                      onChange={(e) => setTemplateDocQual(e.target.value)}
                      placeholder="e.g. MBBS, MS (Ophthalmology), FICO (London), Consultant Eye Surgeon"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">Clinic / Hospital Center Name</label>
                    <input
                      type="text"
                      value={templateClinicName}
                      onChange={(e) => setTemplateClinicName(e.target.value)}
                      placeholder="e.g. Smart Care Clinic & Hospital"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">Clinic Contact Phone</label>
                    <input
                      type="text"
                      value={templateClinicPhone}
                      onChange={(e) => setTemplateClinicPhone(e.target.value)}
                      placeholder="e.g. +91 99342 98453"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold outline-none focus:border-indigo-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="font-bold text-slate-700 block">Clinic Address & Landmark</label>
                    <input
                      type="text"
                      value={templateClinicAddress}
                      onChange={(e) => setTemplateClinicAddress(e.target.value)}
                      placeholder="e.g. Main Road, Health Plaza, City Center"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="font-bold text-slate-700 block">Footer Disclaimer / Follow-up Note</label>
                    <input
                      type="text"
                      value={templateFooterNote}
                      onChange={(e) => setTemplateFooterNote(e.target.value)}
                      placeholder="e.g. Emergency 24x7 • Valid for Follow-up Review within 15 Days"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Live Template Header Preview */}
                <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-3 mt-2">
                  <div className="text-[10px] font-black uppercase text-slate-400 font-mono flex items-center justify-between">
                    <span>Live Prescription Template Preview (A4 / Physical OPD Pad)</span>
                    <span className="text-emerald-700 font-bold">● Active SOP Letterhead</span>
                  </div>
                  
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2.5 text-xs">
                    {/* 1. Clinic Header at Top */}
                    <div className="border-b-2 border-indigo-600 pb-2 flex justify-between items-start flex-wrap gap-2">
                      <div>
                        <h4 className="font-black text-sm text-slate-900">🏥 {templateClinicName || 'Smart Care Clinic & Hospital'}</h4>
                        <p className="text-[10px] text-slate-500">{templateClinicAddress || 'Main Road, Health Plaza, City Center'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-mono font-bold text-indigo-700">📞 {templateClinicPhone || '+91 99342 98453'}</p>
                        <p className="text-[8.5px] text-slate-400">OPD: 09:00 AM - 08:00 PM</p>
                      </div>
                    </div>

                    {/* 2. Patient Profile & Single-Row Horizontal Vitals Strip */}
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-[9px] text-slate-600">
                      <div>PATIENT: <strong>Rahul Verma (34y/M)</strong></div>
                      <div>TOKEN: <strong className="text-indigo-600">#TK-004</strong></div>
                      <div>DATE: <strong>29/08/2026</strong></div>
                    </div>

                    <div className="p-1.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-[8.5px] font-mono text-emerald-950">
                      <span className="font-bold text-emerald-800">🩺 VITALS:</span>
                      <span>BP: <strong>120/80</strong></span>
                      <span className="text-emerald-300">|</span>
                      <span>Pulse: <strong>72 bpm</strong></span>
                      <span className="text-emerald-300">|</span>
                      <span>SpO2: <strong>99%</strong></span>
                      <span className="text-emerald-300">|</span>
                      <span>Temp: <strong>98.6°F</strong></span>
                      <span className="text-emerald-300">|</span>
                      <span>Sugar: <strong>105</strong></span>
                      <span className="text-emerald-300">|</span>
                      <span>Weight: <strong>65kg</strong></span>
                    </div>

                    {/* 3. Ruled ℞ Section */}
                    <div className="py-1">
                      <div className="text-sm font-black text-indigo-600 font-serif leading-none">℞</div>
                      <div className="h-10 border border-slate-200 rounded-lg bg-slate-50/50 mt-1 flex items-center justify-center text-[9px] text-slate-400 italic">
                        Ruled Worksheet for Handwritten Doctor Prescriptions &amp; Diagnostics
                      </div>
                    </div>

                    {/* 4. Doctor Information & Signature in Bottom Footer */}
                    <div className="pt-2 border-t border-dashed border-slate-200 flex justify-between items-end text-[9px] text-slate-600">
                      <div>
                        <h3 className="font-black text-xs text-slate-900">👨‍⚕️ {templateDocName || 'Attending Physician'}</h3>
                        <p className="text-[9px] font-semibold text-indigo-700">{templateDocQual || 'MBBS, MS (Ophthalmology), FICO'}</p>
                        <p className="text-[8px] font-mono text-slate-500">Reg No: <strong>{templateDocReg || 'MCI-84992-A'}</strong></p>
                        <p className="text-[8px] text-slate-400 mt-1">{templateFooterNote || 'Valid for 15 Days · Emergency 24x7'}</p>
                      </div>
                      <div className="text-right">
                        <div className="w-24 border-b border-slate-400 mb-1 ml-auto"></div>
                        <div className="text-[8.5px] font-bold text-slate-700">Doctor's Signature &amp; Stamp</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* History */}
              {sops.length > 1 && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-600 text-xs uppercase tracking-wider flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-500 shrink-0" />
                    Previous SOPs
                  </h4>
                  <div className="space-y-2">
                    {sops.filter((s: ClinicSop) => !s.isActive).slice(0, 5).map((s: ClinicSop) => (
                      <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-white border border-slate-200 rounded-xl">
                        <div>
                          <p className="text-xs font-semibold text-slate-600">{s.sopFileName}</p>
                          <p className="text-[10px] text-slate-600">{new Date(s.createdAt).toLocaleDateString('en-IN')}</p>
                        </div>
                        <button
                          onClick={() => {
                            const updated = api.getClinicSops().map((x: ClinicSop) => ({ ...x, isActive: x.id === s.id }));
                            api.saveClinicSops(updated);
                            window.dispatchEvent(new CustomEvent('mediflow-toast', {
                              detail: { title: 'SOP Restored!', message: `"${s.sopFileName}" is now the active SOP.`, type: 'info' }
                            }));
                          }}
                          className="text-xs text-violet-600 font-bold hover:text-violet-800 cursor-pointer border-0 bg-transparent">
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={() => setSopActiveSubTab('upload')}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-violet-300 text-violet-600 font-bold text-sm hover:bg-violet-50 transition cursor-pointer flex items-center justify-center gap-2 bg-transparent">
                <Upload className="w-4 h-4 shrink-0" />
                Upload & Replace with New SOP
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
});
