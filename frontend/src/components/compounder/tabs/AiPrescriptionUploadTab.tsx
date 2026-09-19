import React, { useState, useRef } from 'react';
import { Camera, Upload, Loader2, CheckCircle2, User, Phone, ShieldCheck, FileText, ChevronRight, Activity, Zap } from 'lucide-react';
import { api } from '../../../services/api';
import type { Patient, Prescription } from '../../../types';

interface AiPrescriptionUploadTabProps {
  onSuccess?: (patientId: string) => void;
}

type AiStep = 'idle' | 'uploading' | 'vision_analysis' | 'extracting_profile' | 'identifying_chronic' | 'allocating_badges' | 'generating_pdf' | 'done' | 'error';

export const AiPrescriptionUploadTab: React.FC<AiPrescriptionUploadTabProps> = ({ onSuccess }) => {
  const [currentStep, setCurrentStep] = useState<AiStep>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Extracted Data State
  const [extractedPatient, setExtractedPatient] = useState<Patient | null>(null);
  const [extractedPrescription, setExtractedPrescription] = useState<Prescription | null>(null);
  const [chronicBadges, setChronicBadges] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const STEPS = [
    { id: 'vision_analysis', label: 'Vision AI Scan' },
    { id: 'extracting_profile', label: 'Profile Extraction' },
    { id: 'identifying_chronic', label: 'Clinical Matching' },
    { id: 'allocating_badges', label: 'Badge Allocation' },
    { id: 'generating_pdf', label: 'PDF Generation' }
  ];

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

    setErrorMessage(null);
    setExtractedPatient(null);
    setExtractedPrescription(null);
    setChronicBadges([]);
    
    try {
      setCurrentStep('uploading');
      
      // Step 1: Vision Analysis
      await new Promise(r => setTimeout(r, 600)); // UI delay for smooth transition
      setCurrentStep('vision_analysis');
      
      const result = await api.ocrScan(file);
      
      if (!result.success || !result.extractedData) {
        throw new Error(result.error || 'Failed to parse prescription data');
      }

      // Step 2: Extracting Profile
      setCurrentStep('extracting_profile');
      await new Promise(r => setTimeout(r, 1200));
      
      // Creating temporary mock patient based on OCR data for immediate UI rendering
      // In a real flow, this hooks into your backend creation loop.
      const mockId = `pat-${Date.now().toString().slice(-6)}`;
      const patientData: Patient = {
        id: mockId,
        name: result.extractedData.patientName || 'Unknown Patient',
        phone: result.extractedData.patientPhone || '9999999999',
        age: result.extractedData.patientAge ? String(result.extractedData.patientAge) : undefined,
        gender: result.extractedData.patientGender,
        createdAt: new Date().toISOString(),
        queueStatus: 'registered',
        abhaId: `ABHA-91-${Math.floor(1000+Math.random()*9000)}`
      };

      // Step 3: Identifying Chronic
      setCurrentStep('identifying_chronic');
      await new Promise(r => setTimeout(r, 900));
      
      const meds = result.extractedData.medications || [];
      const identifiedBadges: string[] = [];
      const rxText = JSON.stringify(meds).toLowerCase();
      
      if (rxText.includes('metformin') || rxText.includes('glimepiride') || rxText.includes('sitagliptin')) {
        identifiedBadges.push('Type 2 Diabetes');
      }
      if (rxText.includes('telmisartan') || rxText.includes('amlodipine') || rxText.includes('losartan')) {
        identifiedBadges.push('Hypertension');
      }
      if (rxText.includes('atorvastatin') || rxText.includes('rosuvastatin')) {
        identifiedBadges.push('Dyslipidemia');
      }
      if (rxText.includes('levothyroxine')) {
        identifiedBadges.push('Hypothyroidism');
      }
      
      // Step 4: Allocating Badges
      setCurrentStep('allocating_badges');
      await new Promise(r => setTimeout(r, 700));
      
      setExtractedPatient(patientData);
      setChronicBadges(identifiedBadges);

      // Step 5: Generating PDF
      setCurrentStep('generating_pdf');
      await new Promise(r => setTimeout(r, 800));
      
      const mockPrescription: Prescription = {
        id: `rx-${Date.now()}`,
        patientId: mockId,
        doctorId: 'doc-ocr',
        date: new Date().toISOString().split('T')[0],
        medications: meds.map(m => ({
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
      
      if (onSuccess) {
        onSuccess(mockId);
      }

    } catch (err: any) {
      console.error('AI OCR Workflow Failed:', err);
      setErrorMessage(err.message || 'Vision Engine failed to parse the document.');
      setCurrentStep('error');
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50 p-4 lg:p-6 overflow-y-auto">
      
      {/* HEADER */}
      <div className="mb-6 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
          <Zap className="w-5 h-5 fill-current" />
          <h2 className="text-xl font-black tracking-tight uppercase">Clinic OS Vision Engine</h2>
        </div>
        <p className="text-[11px] text-slate-500 font-medium">Autonomous Prescription Digitization & Patient Profiling Protocol</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Data Flow & Upload */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Agentic Data Flow Visualizer */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-white/5 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" /> Live Agentic Data Flow
            </h3>
            
            <div className="relative">
              {/* Connecting Line */}
              <div className="absolute top-4 left-4 right-4 h-0.5 bg-slate-100 dark:bg-slate-700/50 -z-10 rounded-full"></div>
              
              <div className="flex justify-between relative z-10">
                {STEPS.map((step, idx) => {
                  const status = getStepStatus(step.id);
                  return (
                    <div key={step.id} className="flex flex-col items-center gap-2 w-16 group">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500
                        ${status === 'complete' ? 'bg-emerald-500 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 
                          status === 'active' ? 'bg-indigo-600 border-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.6)] scale-110 animate-pulse' : 
                          'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'}`}
                      >
                        {status === 'complete' ? <CheckCircle2 className="w-4 h-4" /> : 
                         status === 'active' ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                         <span className="text-xs font-black">{idx + 1}</span>}
                      </div>
                      <span className={`text-[9px] text-center font-bold leading-tight uppercase transition-colors
                        ${status === 'active' ? 'text-indigo-600 dark:text-indigo-400' : 
                          status === 'complete' ? 'text-emerald-600 dark:text-emerald-400' : 
                          'text-slate-400'}`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {currentStep === 'error' && (
              <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-medium text-center">
                {errorMessage}
              </div>
            )}
          </div>

          {/* Upload Dropzone */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-white/5 p-1 shadow-sm h-[280px] flex items-center justify-center relative overflow-hidden group">
            
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
            
            <input 
              type="file" 
              ref={fileInputRef}
              accept="image/*,.pdf"
              onChange={handleFileUpload}
              className="hidden" 
              id="ai-rx-upload"
            />
            
            {currentStep !== 'idle' && currentStep !== 'error' && currentStep !== 'done' ? (
              <div className="flex flex-col items-center gap-4 text-indigo-600 dark:text-indigo-400">
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-400 blur-xl opacity-30 rounded-full animate-pulse"></div>
                  <Loader2 className="w-12 h-12 animate-spin relative z-10" />
                </div>
                <div className="text-sm font-black uppercase tracking-widest animate-pulse">Running AI Protocol...</div>
              </div>
            ) : (
              <label 
                htmlFor="ai-rx-upload" 
                className="flex flex-col items-center justify-center w-full h-full p-6 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors rounded-xl"
              >
                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-sm border border-indigo-100 dark:border-indigo-500/20">
                  <Camera className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100 mb-1">Upload Rx / Capture Image</h3>
                <p className="text-xs text-slate-500 font-medium text-center max-w-[200px]">
                  Drop a photo of the handwritten prescription to ignite the autonomous AI agent.
                </p>
                <div className="mt-6 px-4 py-1.5 bg-indigo-600 text-white rounded-full text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5" /> Select File
                </div>
              </label>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Extracted Profile Widget */}
        <div className="lg:col-span-5 h-full">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-white/5 p-5 shadow-sm h-full flex flex-col relative overflow-hidden">
            
            {/* Top Widget Header */}
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
              <User className="w-3.5 h-3.5" /> Synthesized Patient Profile
            </h3>

            {currentStep === 'idle' || currentStep === 'uploading' || currentStep === 'vision_analysis' || currentStep === 'extracting_profile' || currentStep === 'error' ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4 opacity-50">
                <ShieldCheck className="w-12 h-12 stroke-[1px]" />
                <p className="text-xs font-medium text-center max-w-[200px]">Awaiting AI Extraction. The synthesized profile will appear here.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-4 fade-in duration-700">
                
                {/* ID & Demographics Row */}
                <div className="flex items-start justify-between">
                  <div className="flex gap-4 items-center">
                    <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg shadow-indigo-500/30">
                      {extractedPatient?.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                        {extractedPatient?.name || 'Unknown Patient'}
                      </h2>
                      <div className="flex items-center gap-2 mt-1 text-xs font-bold text-slate-500">
                        <span>{extractedPatient?.age ? `${extractedPatient.age} Y` : '--'}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span>{extractedPatient?.gender || '--'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 px-2.5 py-1 rounded-lg">
                    <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wider block leading-tight">ID</span>
                    <span className="text-xs font-mono font-bold text-indigo-900 dark:text-indigo-200">
                      {extractedPatient?.id?.substring(0, 8)}
                    </span>
                  </div>
                </div>

                {/* Extracted Details Grid */}
                <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl p-4 border border-slate-100 dark:border-white/5 space-y-4">
                  
                  {/* Mobile Number */}
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Extracted Contact</label>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                      <Phone className="w-4 h-4 text-emerald-500" />
                      +91 {extractedPatient?.phone || 'Not found'}
                    </div>
                  </div>
                  
                  {/* Chronic Disease Badges */}
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Automated Cohort Tagging</label>
                    <div className="flex flex-wrap gap-2">
                      {chronicBadges.length > 0 ? (
                        chronicBadges.map(badge => (
                          <span key={badge} className="inline-flex items-center gap-1 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wide">
                            <Activity className="w-3 h-3" /> {badge}
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
                  <div className="mt-auto pt-4 border-t border-slate-100 dark:border-white/5 flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-wider">Compiling Digital PDF...</span>
                  </div>
                ) : currentStep === 'done' && extractedPrescription ? (
                  <div className="mt-auto pt-4 border-t border-slate-100 dark:border-white/5 animate-in slide-in-from-left-4 fade-in">
                    <button 
                      onClick={() => {
                        if (extractedPrescription.digitalPdfUrl) {
                          alert('Opening synthesized digital PDF viewer...');
                        }
                      }}
                      className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-sm group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/10 dark:bg-slate-900/10 flex items-center justify-center">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-tight">Artifact Generated</span>
                          <span className="block text-sm font-black">View Digital Prescription PDF</span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
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
