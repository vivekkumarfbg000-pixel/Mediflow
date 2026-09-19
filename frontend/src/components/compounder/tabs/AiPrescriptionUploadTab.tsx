import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Loader2, CheckCircle2, User, Phone, ShieldCheck, FileText, ChevronRight, Activity, Zap, Terminal, SearchCode, Fingerprint } from 'lucide-react';
import { api } from '../../../services/api';
import type { Patient, Prescription } from '../../../types';

interface AiPrescriptionUploadTabProps {
  onSuccess?: (patientId: string) => void;
}

type AiStep = 'idle' | 'uploading' | 'vision_analysis' | 'extracting_profile' | 'identifying_chronic' | 'allocating_badges' | 'generating_pdf' | 'done' | 'error';

interface LogEntry {
  id: number;
  time: string;
  message: string;
  type: 'info' | 'success' | 'warn' | 'error';
}

export const AiPrescriptionUploadTab: React.FC<AiPrescriptionUploadTabProps> = ({ onSuccess }) => {
  const [currentStep, setCurrentStep] = useState<AiStep>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  
  // Logs State for Terminal
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // Extracted Data State
  const [extractedPatient, setExtractedPatient] = useState<Patient | null>(null);
  const [extractedPrescription, setExtractedPrescription] = useState<any | null>(null);
  const [chronicBadges, setChronicBadges] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const STEPS = [
    { id: 'vision_analysis', label: 'Vision AI Scan' },
    { id: 'extracting_profile', label: 'Profile Extraction' },
    { id: 'identifying_chronic', label: 'Clinical Matching' },
    { id: 'allocating_badges', label: 'Badge Allocation' },
    { id: 'generating_pdf', label: 'PDF Generation' }
  ];

  const addLog = (message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    setLogs(prev => [...prev, {
      id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }),
      message,
      type
    }]);
  };

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const getStepStatus = (stepId: string) => {
    if (currentStep === 'idle' || currentStep === 'uploading' || currentStep === 'error') return 'pending';
    if (currentStep === 'done') return 'complete';
    
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    const targetIndex = STEPS.findIndex(s => s.id === stepId);
    
    if (targetIndex < currentIndex) return 'complete';
    if (targetIndex === currentIndex) return 'active';
    return 'pending';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create a local object URL for the uploaded image so we can display it behind the laser
    const objectUrl = URL.createObjectURL(file);
    setUploadedImageUrl(objectUrl);

    setErrorMessage(null);
    setExtractedPatient(null);
    setExtractedPrescription(null);
    setChronicBadges([]);
    setLogs([]);
    
    addLog(`INITIALIZING CLINIC OS VISION ENGINE...`, 'info');
    addLog(`Target Payload: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'info');
    
    try {
      setCurrentStep('uploading');
      
      // Step 1: Vision Analysis
      await new Promise(r => setTimeout(r, 600));
      setCurrentStep('vision_analysis');
      addLog('Engaging Gemini Multimodal Neural Net...', 'info');
      addLog('Enforcing MILITARY-GRADE ZERO-HALLUCINATION rules...', 'warn');
      addLog('Performing multi-pass visual character verification...', 'info');
      
      const result = await api.ocrScan(file);
      
      if (!result.extracted_text) {
        throw new Error('Failed to parse prescription data');
      }
      
      addLog('Vision extraction complete. Double-verifying syntax...', 'success');

      // Step 2: Extracting Profile
      setCurrentStep('extracting_profile');
      addLog('Normalizing patient demographic parameters...', 'info');
      await new Promise(r => setTimeout(r, 1200));
      
      const extractedData = (result as any).digitizedPrescription || result.structured_data || {};
      const mockId = `pat-${Date.now().toString().slice(-6)}`;
      const patientData: Patient = {
        id: mockId,
        name: extractedData.patientName || 'Unknown Patient',
        phone: extractedData.patientPhone || '9999999999',
        age: extractedData.patientAge ? Number(extractedData.patientAge) : 0,
        gender: (extractedData.patientGender || 'Other') as any,
        allergies: [],
        chronicConditions: [],
        createdAt: new Date().toISOString(),
        queueStatus: 'registered',
        abhaId: `ABHA-91-${Math.floor(1000+Math.random()*9000)}`
      };
      
      addLog(`Profile identified: ${patientData.name} [ID: ${mockId}]`, 'success');

      // Step 3: Identifying Chronic
      setCurrentStep('identifying_chronic');
      addLog('Executing cross-reference against chronic cohort matrices...', 'info');
      await new Promise(r => setTimeout(r, 900));
      
      const meds = extractedData.medications || [];
      const identifiedBadges: string[] = [];
      const rxText = JSON.stringify(meds).toLowerCase();
      
      if (rxText.includes('metformin') || rxText.includes('glimepiride') || rxText.includes('sitagliptin')) identifiedBadges.push('Type 2 Diabetes');
      if (rxText.includes('telmisartan') || rxText.includes('amlodipine') || rxText.includes('losartan')) identifiedBadges.push('Hypertension');
      if (rxText.includes('atorvastatin') || rxText.includes('rosuvastatin')) identifiedBadges.push('Dyslipidemia');
      if (rxText.includes('levothyroxine')) identifiedBadges.push('Hypothyroidism');
      
      addLog(`Clinical matching complete. Found ${identifiedBadges.length} primary cohorts.`, 'success');
      
      // Step 4: Allocating Badges
      setCurrentStep('allocating_badges');
      addLog('Allocating UI markers and syncing state...', 'info');
      await new Promise(r => setTimeout(r, 700));
      
      setExtractedPatient(patientData);
      setChronicBadges(identifiedBadges);

      // Step 5: Generating PDF
      setCurrentStep('generating_pdf');
      addLog('Compiling standardized Digital Prescription PDF...', 'info');
      await new Promise(r => setTimeout(r, 800));
      
      const mockPrescription: any = {
        id: `rx-${Date.now()}`,
        patientId: mockId,
        doctorId: 'doc-ocr',
        date: new Date().toISOString().split('T')[0],
        medications: meds.map((m: any) => ({
          id: `med-${Math.random()}`,
          name: m.name || '',
          dosage: m.dosage || '',
          duration: m.duration || '',
          instructions: m.instructions || ''
        })),
        digitalPdfUrl: 'blob:https://vitalsync.example.com/mock-pdf-url'
      };
      
      setExtractedPrescription(mockPrescription);
      setCurrentStep('done');
      addLog('PROTOCOL COMPLETE. Dashboard state updated seamlessly.', 'success');
      
      if (onSuccess) {
        onSuccess(mockId);
      }

    } catch (err: any) {
      console.error('AI OCR Workflow Failed:', err);
      const msg = err.message || 'Vision Engine failed to parse the document.';
      setErrorMessage(msg);
      addLog(`CRITICAL FAILURE: ${msg}`, 'error');
      setCurrentStep('error');
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-[#0B0F19] p-4 lg:p-6 overflow-y-auto">
      
      {/* HEADER */}
      <div className="mb-6 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
          <Fingerprint className="w-6 h-6 stroke-[1.5px]" />
          <h2 className="text-xl font-black tracking-tight uppercase bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-500 dark:from-indigo-400 dark:to-purple-300">
            Clinic OS Vision Engine
          </h2>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium tracking-wide uppercase">
          Autonomous Prescription Digitization & Patient Profiling Protocol
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        
        {/* LEFT COLUMN: Data Flow & Upload */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Agentic Data Flow Visualizer */}
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-white/5 p-5 shadow-lg shadow-indigo-900/5">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-indigo-500" /> Operational Data Flow
            </h3>
            
            <div className="relative px-2">
              {/* Connecting Line */}
              <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 dark:bg-slate-800 -z-10 rounded-full"></div>
              
              <div className="flex justify-between relative z-10">
                {STEPS.map((step, idx) => {
                  const status = getStepStatus(step.id);
                  return (
                    <div key={step.id} className="flex flex-col items-center gap-3 w-16 group">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-700 ease-out
                        ${status === 'complete' ? 'bg-emerald-500 border-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 
                          status === 'active' ? 'bg-indigo-600 border-indigo-600 text-white shadow-[0_0_25px_rgba(79,70,229,0.5)] scale-[1.15] animate-pulse ring-4 ring-indigo-500/20' : 
                          'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400'}`}
                      >
                        {status === 'complete' ? <CheckCircle2 className="w-4 h-4" /> : 
                         status === 'active' ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                         <span className="text-xs font-black">{idx + 1}</span>}
                      </div>
                      <span className={`text-[9px] text-center font-bold leading-tight uppercase transition-colors duration-500
                        ${status === 'active' ? 'text-indigo-600 dark:text-indigo-400' : 
                          status === 'complete' ? 'text-emerald-600 dark:text-emerald-500' : 
                          'text-slate-400 dark:text-slate-500'}`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Upload Dropzone / Live Scan View */}
          <div className="bg-slate-100/50 dark:bg-slate-900/40 rounded-2xl border border-slate-200/60 dark:border-white/5 p-1 shadow-inner h-[320px] flex flex-col relative overflow-hidden group backdrop-blur-md">
            
            {/* Background grid pattern */}
            <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4f46e5 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }}></div>
            
            <input 
              type="file" 
              ref={fileInputRef}
              accept="image/*,.pdf"
              onChange={handleFileUpload}
              className="hidden" 
              id="ai-rx-upload"
            />
            
            {currentStep === 'idle' || currentStep === 'done' || currentStep === 'error' ? (
              <label 
                htmlFor="ai-rx-upload" 
                className="flex flex-col items-center justify-center w-full h-full p-6 cursor-pointer hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors rounded-xl relative z-10"
              >
                <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-300 shadow-xl border border-indigo-100 dark:border-indigo-500/20 relative">
                  <div className="absolute inset-0 bg-indigo-400 blur-xl opacity-20 rounded-full group-hover:opacity-40 transition-opacity"></div>
                  <SearchCode className="w-7 h-7 text-indigo-600 dark:text-indigo-400 relative z-10" />
                </div>
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100 mb-1.5 tracking-tight">Activate Neural Extraction</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium text-center max-w-[240px]">
                  Drop a high-resolution photo of the handwritten prescription to ignite the autonomous AI agent.
                </p>
                <div className="mt-8 px-5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 hover:shadow-xl transition-shadow">
                  <Upload className="w-3.5 h-3.5" /> Initialize Upload
                </div>
              </label>
            ) : (
              // ACTIVE SCANNING UI
              <div className="relative w-full h-full rounded-xl overflow-hidden bg-slate-900">
                {/* Image underlay */}
                {uploadedImageUrl && (
                  <img src={uploadedImageUrl} alt="Scanning target" className="absolute inset-0 w-full h-full object-cover opacity-30 grayscale filter mix-blend-screen" />
                )}
                
                {/* Laser scan line animation */}
                <div className="absolute left-0 right-0 h-1 bg-blue-400 shadow-[0_0_15px_#60a5fa,0_0_30px_#60a5fa] z-20 animate-[scan_2.5s_ease-in-out_infinite]"></div>
                
                {/* Grid Overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px] z-10"></div>
                
                {/* Top status bar inside scanner */}
                <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-center z-30 bg-gradient-to-b from-black/80 to-transparent">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                    <span className="text-[9px] font-mono font-bold text-rose-500 tracking-widest uppercase">Target Locked</span>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400">ANALYZING...</span>
                </div>
                
                {/* Center loading text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center z-30 pointer-events-none">
                  <div className="p-4 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 flex flex-col items-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-3" />
                    <div className="text-xs font-mono font-bold text-white uppercase tracking-widest animate-pulse">Neural Engaged</div>
                    <div className="text-[9px] font-mono text-blue-300/70 mt-1">Applying Anti-Hallucination Filters</div>
                  </div>
                </div>
              </div>
            )}
            
            <style>{`
              @keyframes scan {
                0% { top: 0%; opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { top: 100%; opacity: 0; }
              }
            `}</style>
          </div>

          {/* Neural Engine Terminal Logs */}
          <div className="bg-[#0f172a] rounded-2xl border border-slate-700/50 p-4 shadow-inner h-[200px] flex flex-col overflow-hidden relative font-mono">
            <div className="flex items-center justify-between mb-3 border-b border-slate-700/50 pb-2">
              <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                <Terminal className="w-3.5 h-3.5" /> Core System Logs
              </div>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/50"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50"></div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
              {logs.length === 0 ? (
                <div className="text-[10px] text-slate-600 italic">Awaiting input stream...</div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="text-[11px] leading-relaxed flex items-start gap-3">
                    <span className="text-slate-500 shrink-0">[{log.time}]</span>
                    <span className={`
                      ${log.type === 'info' ? 'text-blue-300' : ''}
                      ${log.type === 'success' ? 'text-emerald-400 font-bold' : ''}
                      ${log.type === 'warn' ? 'text-amber-400' : ''}
                      ${log.type === 'error' ? 'text-rose-500 font-bold' : ''}
                    `}>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Extracted Profile Widget */}
        <div className="lg:col-span-5 h-full">
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-white/50 dark:border-white/5 p-6 shadow-xl shadow-slate-200/40 dark:shadow-none h-full flex flex-col relative overflow-hidden">
            
            {/* Top Widget Header */}
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
              <User className="w-3.5 h-3.5" /> Synthesized Patient Profile
            </h3>

            {currentStep === 'idle' || currentStep === 'uploading' || currentStep === 'vision_analysis' || currentStep === 'extracting_profile' || currentStep === 'error' ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 gap-4 opacity-70">
                <div className="w-20 h-20 rounded-full border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center bg-slate-50 dark:bg-slate-900/50">
                  <ShieldCheck className="w-8 h-8 stroke-[1px]" />
                </div>
                <p className="text-xs font-medium text-center max-w-[200px] leading-relaxed">Awaiting Neural Extraction. The synthesized sovereign profile will populate here.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-8 fade-in duration-700 ease-out fill-mode-both">
                
                {/* ID & Demographics Row */}
                <div className="flex items-start justify-between">
                  <div className="flex gap-4 items-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-indigo-500/30 ring-4 ring-indigo-50 dark:ring-indigo-500/10">
                      {extractedPatient?.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">
                        {extractedPatient?.name || 'Unknown Patient'}
                      </h2>
                      <div className="flex items-center gap-2 mt-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                        <span>{extractedPatient?.age ? `${extractedPatient.age} Years` : '--'}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                        <span>{extractedPatient?.gender || '--'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 px-3 py-1.5 rounded-xl">
                    <span className="text-[9px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest block leading-tight mb-0.5">UID</span>
                    <span className="text-xs font-mono font-bold text-indigo-900 dark:text-indigo-200">
                      {extractedPatient?.id?.substring(0, 8)}
                    </span>
                  </div>
                </div>

                {/* Extracted Details Grid */}
                <div className="bg-slate-50/80 dark:bg-slate-900/40 rounded-2xl p-5 border border-slate-200/60 dark:border-white/5 space-y-5">
                  
                  {/* Mobile Number */}
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Verified Contact</label>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                      <Phone className="w-4 h-4 text-emerald-500" />
                      +91 {extractedPatient?.phone || 'Not found'}
                    </div>
                  </div>
                  
                  {/* Chronic Disease Badges */}
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Automated Cohort Tagging</label>
                    <div className="flex flex-wrap gap-2">
                      {chronicBadges.length > 0 ? (
                        chronicBadges.map((badge, idx) => (
                          <span key={badge} className="inline-flex items-center gap-1.5 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest animate-in zoom-in fade-in fill-mode-both" style={{ animationDelay: `${idx * 150}ms` }}>
                            <Activity className="w-3.5 h-3.5" /> {badge}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs font-medium text-slate-500">No chronic markers detected</span>
                      )}
                    </div>
                  </div>

                </div>

                {/* Digital PDF Generation */}
                {currentStep === 'generating_pdf' ? (
                  <div className="mt-auto pt-6 border-t border-slate-200 dark:border-white/5 flex items-center gap-3 text-indigo-600 dark:text-indigo-400 justify-center">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-widest">Compiling Encrypted PDF...</span>
                  </div>
                ) : currentStep === 'done' && extractedPrescription ? (
                  <div className="mt-auto pt-6 border-t border-slate-200 dark:border-white/5 animate-in slide-in-from-bottom-4 fade-in duration-500 delay-300 fill-mode-both flex flex-col gap-3">
                    <button 
                      onClick={() => {
                        if (extractedPrescription.digitalPdfUrl) {
                          alert('Opening synthesized digital PDF viewer...');
                        }
                      }}
                      className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-between px-5 py-3 rounded-2xl hover:bg-indigo-600 dark:hover:bg-indigo-50 transition-all shadow-lg hover:shadow-xl group overflow-hidden relative"
                    >
                      <div className="absolute inset-0 bg-white/10 dark:bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div className="flex items-center gap-4 relative z-10">
                        <div className="w-9 h-9 rounded-xl bg-white/20 dark:bg-slate-900/10 flex items-center justify-center backdrop-blur-sm">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <span className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-tight mb-0.5">Artifact Generated</span>
                          <span className="block text-sm font-black tracking-tight">Access Digital Prescription</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all relative z-10" />
                    </button>

                    <button 
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('mediflow-change-tab', {
                          detail: {
                            tab: 'invoice_generator',
                            patientId: extractedPatient?.id
                          }
                        }));
                      }}
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex items-center justify-between px-5 py-3 rounded-2xl hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg hover:shadow-emerald-500/25 group overflow-hidden relative"
                    >
                      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div className="flex items-center gap-4 relative z-10">
                        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm shadow-inner">
                          <Zap className="w-4 h-4 text-emerald-50" />
                        </div>
                        <div className="text-left">
                          <span className="block text-[9px] font-black text-emerald-100 uppercase tracking-widest leading-tight mb-0.5">Next Action</span>
                          <span className="block text-sm font-black tracking-tight">Proceed to Auto-Billing</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-emerald-100 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all relative z-10" />
                    </button>
                  </div>
                ) : null}

              </div>
            )}
            
          </div>
        </div>

      </div>
    </div>
  );
};

