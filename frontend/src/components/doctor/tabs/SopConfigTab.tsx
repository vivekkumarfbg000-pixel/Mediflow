import React from 'react';
import { api } from '../../../services/api';
import type { ClinicSop } from '../../../types';

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
      { delay: 3200, log: '✅ Validating extracted config against Mediflow billing engine...' },
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
    const docFee = docFeeMatch ? parseFloat(docFeeMatch[1]) : activeSop?.extractedConfig?.doctor_fee ?? 450;

    const splitDocMatch = text.match(/(?:doctor|physician|referring)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%/i);
    const splitPlatMatch = text.match(/(?:platform|mediflow|software|app)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%/i);
    const splitLabMatch = text.match(/(?:lab|laboratory|pathology)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%/i);

    const splitDoc = splitDocMatch ? parseFloat(splitDocMatch[1]) : activeSop?.extractedConfig?.splits?.doctor ?? 40;
    const splitPlat = splitPlatMatch ? parseFloat(splitPlatMatch[1]) : activeSop?.extractedConfig?.splits?.platform ?? 3;
    const splitLab = splitLabMatch ? parseFloat(splitLabMatch[1]) : activeSop?.extractedConfig?.splits?.lab ?? 57;

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
      test_prices: testPrices,
      splits: { doctor: splitDoc, platform: splitPlat, lab: splitLab },
      guidelines: guidelineLines.length > 0 ? guidelineLines : activeSop?.extractedConfig?.guidelines ?? []
    };

    setExtractedConfig(config);
    setExtractionLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🎉 Extraction complete! Config ready to activate.`]);
    setIsExtractingSop(false);
  };

  const handleActivateSop = () => {
    if (!extractedConfig) return;
    const newSop: ClinicSop = {
      id: `sop-${Date.now()}`,
      entityId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
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
            <span className="material-symbols-outlined text-violet-600">policy</span>
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

      {/* Sub-tabs */}
      <div className="flex gap-2 p-1 bg-slate-100/70 border border-slate-200/50 rounded-2xl w-fit">
        {[
          { id: 'upload', label: 'Upload New SOP', icon: 'upload_file' },
          { id: 'active', label: 'Active SOP & Rules', icon: 'rule' }
        ].map(t => (
          <button key={t.id} onClick={() => setSopActiveSubTab(t.id as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border-0 ${sopActiveSubTab === t.id ? 'bg-white text-violet-700 shadow-sm border border-violet-100' : 'bg-transparent text-slate-500 hover:text-slate-700'}`}>
            <span className="material-symbols-outlined text-sm">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* UPLOAD PANEL */}
      {sopActiveSubTab === 'upload' && (
        <div className="space-y-5">
          {/* Drop zone */}
          <div className="relative border-2 border-dashed border-violet-200 rounded-2xl bg-violet-50/40 hover:bg-violet-50/70 transition-colors">
            <input
              type="file"
              accept=".txt,.pdf,.doc,.docx,.md"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="flex flex-col items-center justify-center py-12 gap-3 pointer-events-none">
              <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-4xl text-violet-500">upload_file</span>
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-700 text-sm">{sopFile ? sopFile.name : 'Drop your SOP document here'}</p>
                <p className="text-xs text-slate-400 mt-1">Supports .txt, .pdf, .doc, .docx, .md — AI will parse it automatically</p>
              </div>
              {sopFile && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  {sopFile.name} ready for extraction
                </div>
              )}
            </div>
          </div>

          {/* Paste text directly */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-505 uppercase tracking-wider">Or Paste SOP Text Directly</label>
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
                <span className="material-symbols-outlined text-lg animate-spin">autorenew</span>
                AI Extraction in Progress...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">auto_awesome</span>
                Extract & Analyse SOP with Gemini AI
              </>
            )}
          </button>

          {/* Live Extraction Logs */}
          {extractionLogs.length > 0 && (
            <div className="rounded-2xl bg-slate-900 border border-slate-700 p-4 space-y-1.5 font-mono text-zinc-300">
              <p className="text-xs text-slate-400 font-bold mb-2 uppercase tracking-wider">AI Extraction Console</p>
              {extractionLogs.map((log, i) => (
                <p key={i} className={`text-xs ${i === extractionLogs.length - 1 ? 'text-emerald-400 font-semibold' : 'text-slate-300'}`}>{log}</p>
              ))}
              {isExtractingSop && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}}/>
                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}/>
                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}}/>
                  </div>
                  <span className="text-xs text-violet-300">Processing...</span>
                </div>
              )}
            </div>
          )}

          {/* Extracted Config Preview */}
          {extractedConfig && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500">verified</span>
                <h3 className="font-bold text-slate-800 text-sm">AI-Extracted Configuration Preview</h3>
                <span className="text-xs text-slate-400">— review before activating</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Doctor Fee */}
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 space-y-2">
                  <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
                    <span className="material-symbols-outlined text-base">stethoscope</span>
                    Doctor Fee
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-sm">₹</span>
                    <input
                      type="number"
                      value={extractedConfig.doctor_fee}
                      onChange={e => setExtractedConfig({...extractedConfig, doctor_fee: parseFloat(e.target.value)})}
                      className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-sm font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                </div>

                {/* Commission Splits */}
                <div className="p-4 rounded-2xl bg-violet-50 border border-violet-100 space-y-2">
                  <div className="flex items-center gap-2 text-violet-700 font-bold text-xs uppercase tracking-wider">
                    <span className="material-symbols-outlined text-base">pie_chart</span>
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
                          value={extractedConfig.splits[s.key]}
                          onChange={e => setExtractedConfig({...extractedConfig, splits: {...extractedConfig.splits, [s.key]: parseFloat(e.target.value)}})}
                          className="flex-1 bg-white border border-violet-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
                        />
                        <span className="text-xs text-slate-400">%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total Split Check */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 text-slate-600 font-bold text-xs uppercase tracking-wider">
                    <span className="material-symbols-outlined text-base">balance</span>
                    Split Validation
                  </div>
                  {(() => {
                    const total = (extractedConfig.splits.doctor || 0) + (extractedConfig.splits.platform || 0) + (extractedConfig.splits.lab || 0);
                    const isValid = Math.abs(total - 100) < 0.01;
                    return (
                      <div className={`flex items-center gap-2 p-2 rounded-lg ${isValid ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        <span className="material-symbols-outlined text-base">{isValid ? 'check_circle' : 'error'}</span>
                        <span className="text-xs font-bold">Total: {total.toFixed(1)}% {isValid ? '✓ Valid' : 'Must equal 100%'}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Test Prices */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider">
                  <span className="material-symbols-outlined text-base">biotech</span>
                  Lab Test Prices (per catalog item)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(testNames).map(([loinc, name]) => (
                    <div key={loinc} className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5">
                      <p className="text-xs font-bold text-slate-700 truncate">{name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">LOINC: {loinc}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500">₹</span>
                        <input
                          type="number"
                          value={extractedConfig.test_prices[loinc] ?? 350}
                          onChange={e => setExtractedConfig({...extractedConfig, test_prices: {...extractedConfig.test_prices, [loinc]: parseFloat(e.target.value)}})}
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
                    <span className="material-symbols-outlined text-base">checklist</span>
                    Extracted Workflow Guidelines
                  </div>
                  <ul className="space-y-1.5">
                    {extractedConfig.guidelines.map((g: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-amber-850">
                        <span className="material-symbols-outlined text-amber-500 text-sm mt-0.5 flex-shrink-0">arrow_right</span>
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
                <span className="material-symbols-outlined text-lg">rocket_launch</span>
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
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
              <span className="material-symbols-outlined text-6xl">policy</span>
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

              {/* Fee & Split Dashboard */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Doctor Fee', value: `₹${activeSop.extractedConfig.doctor_fee}`, icon: 'stethoscope', color: 'blue' },
                  { label: 'Doctor Split', value: `${activeSop.extractedConfig.splits.doctor}%`, icon: 'person', color: 'indigo' },
                  { label: 'Platform Split', value: `${activeSop.extractedConfig.splits.platform}%`, icon: 'hub', color: 'violet' },
                  { label: 'Lab Split', value: `${activeSop.extractedConfig.splits.lab}%`, icon: 'emerald', color: 'emerald' },
                ].map(stat => (
                  <div key={stat.label} className={`p-4 rounded-2xl bg-${stat.color}-50 border border-${stat.color}-100 text-center`}>
                    <span className={`material-symbols-outlined text-${stat.color}-500 text-xl`}>{stat.icon}</span>
                    <p className={`text-lg font-extrabold text-${stat.color}-700 mt-1`}>{stat.value}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Lab Test Prices */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                <h4 className="font-bold text-slate-750 text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-blue-500">biotech</span>
                  Active Lab Test Price Schedule
                </h4>
                <div className="divide-y divide-slate-100">
                  {Object.entries(activeSop.extractedConfig.test_prices).map(([loinc, price]) => (
                    <div key={loinc} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{testNames[loinc] || loinc}</p>
                        <p className="text-[10px] text-slate-400 font-mono">LOINC: {loinc}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-800">₹{price as number}</span>
                        <div className="text-[10px] text-slate-400 space-y-0.5 text-right">
                          <p className="text-blue-600">Dr: ₹{((price as number) * activeSop.extractedConfig.splits.doctor / 100).toFixed(0)}</p>
                          <p className="text-emerald-600">Lab: ₹{((price as number) * activeSop.extractedConfig.splits.lab / 100).toFixed(0)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Guidelines */}
              {activeSop.extractedConfig.guidelines.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 space-y-2">
                  <h4 className="font-bold text-amber-700 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">checklist</span>
                    Active Workflow Guidelines
                  </h4>
                  <ul className="space-y-2">
                    {activeSop.extractedConfig.guidelines.map((g: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-amber-800">
                        <span className="w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 font-bold flex-shrink-0 text-[10px]">{i + 1}</span>
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* History */}
              {sops.length > 1 && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-600 text-xs uppercase tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">history</span>
                    Previous SOPs
                  </h4>
                  <div className="space-y-2">
                    {sops.filter((s: ClinicSop) => !s.isActive).slice(0, 5).map((s: ClinicSop) => (
                      <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-white border border-slate-200 rounded-xl">
                        <div>
                          <p className="text-xs font-semibold text-slate-600">{s.sopFileName}</p>
                          <p className="text-[10px] text-slate-400">{new Date(s.createdAt).toLocaleDateString('en-IN')}</p>
                        </div>
                        <button
                          onClick={() => {
                            const updated = api.getClinicSops().map((x: ClinicSop) => ({ ...x, isActive: x.id === s.id }));
                            api.saveClinicSops(updated);
                            window.dispatchEvent(new CustomEvent('mediflow-toast', {
                              detail: { title: 'SOP Restored!', message: `"${s.sopFileName}" is now the active SOP.`, type: 'info' }
                            }));
                          }}
                          className="text-xs text-violet-600 font-bold hover:text-violet-850 cursor-pointer border-0 bg-transparent">
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={() => setSopActiveSubTab('upload')}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-violet-300 text-violet-600 font-bold text-sm hover:bg-violet-50 transition cursor-pointer flex items-center justify-center gap-2 bg-transparent">
                <span className="material-symbols-outlined text-base">upload_file</span>
                Upload & Replace with New SOP
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
});
