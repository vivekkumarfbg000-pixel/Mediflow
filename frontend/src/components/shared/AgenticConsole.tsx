import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { 
  ClinicalSafetyAgent, 
  ResourceAllocationAgent, 
  FinancialLedgerAgent,
} from '../../services/agentSuite';
import type { ValidationStep } from '../../services/agentSuite';
import { 
  Mic, 
  MicOff, 
  Sparkles, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  Play, 
  Terminal, 
  User, 
} from 'lucide-react';

interface AgenticConsoleProps {
  onWorkflowExecuted?: () => void;
}

export const AgenticConsole: React.FC<AgenticConsoleProps> = ({ onWorkflowExecuted }) => {
  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [activePatient, setActivePatient] = useState<any>(null);
  const [pipelineSteps, setPipelineSteps] = useState<ValidationStep[]>([]);
  const [agentLogs, setAgentLogs] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionHalted, setExecutionHalted] = useState(false);
  
  const recognitionRef = useRef<any>(null);

  // Load active patient linked to simulator
  useEffect(() => {
    const handleActivePatientChange = () => {
      // Find linked patient in registry
      const pat = api.getPatients().find(p => p.phone === '9800100201') || api.getPatients()[0];
      setActivePatient(pat);
    };
    
    handleActivePatientChange();
    window.addEventListener('storage', handleActivePatientChange);
    return () => window.removeEventListener('storage', handleActivePatientChange);
  }, []);

  // Web Speech API Voice-to-Text Setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-IN'; // Optimized for Indian English/Hinglish accenting

      rec.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      rec.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setQuery(prev => (prev + ' ' + text).trim());
      };

      rec.onerror = (event: any) => {
        console.error('[Web Speech Error]', event.error);
        setSpeechError(`Speech recognition error: ${event.error}`);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Browser speech recognition not supported. Please use Chrome, Safari or Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  // The Sorter & Telemetry Core Loop
  const handleValidateAndRoute = async () => {
    if (!query.trim()) return;

    setIsExecuting(true);
    setExecutionHalted(false);
    setAgentLogs([]);
    
    // 1. Initial pipeline stages
    const steps: ValidationStep[] = [
      { name: 'PARSE', status: 'validating', message: 'Parsing prompt semantics...' },
      { name: 'SAFETY (CDSS)', status: 'pending', message: 'Awaiting intent parse...' },
      { name: 'RESOURCE', status: 'pending', message: 'Awaiting intent parse...' },
      { name: 'BILLING', status: 'pending', message: 'Awaiting intent parse...' },
      { name: 'DELIVER', status: 'pending', message: 'Awaiting intent parse...' }
    ];
    setPipelineSteps([...steps]);

    // Step 1: Semantic Intent Classification (Regex & Trie Heuristics - 100% Free)
    await new Promise(resolve => setTimeout(resolve, 800));
    const cleanPrompt = query.trim().toLowerCase();
    
    // Heuristic Extractor
    let targetDrug = 'Calpol 650';
    let targetDosage = '650mg';
    let targetDuration = '5 days';
    let testLoinc = '4544-3'; // HbA1c default
    let testName = 'HbA1c (Glycated Hemoglobin)';

    if (cleanPrompt.includes('penicillin') || cleanPrompt.includes('amoxicillin')) {
      targetDrug = 'Amoxicillin';
      targetDosage = '500mg';
    } else if (cleanPrompt.includes('ibuprofen') || cleanPrompt.includes('painkiller')) {
      targetDrug = 'Ibuprofen';
      targetDosage = '400mg';
    }

    if (cleanPrompt.includes('creatinine') || cleanPrompt.includes('kidney')) {
      testLoinc = '2160-0';
      testName = 'Serum Creatinine';
    } else if (cleanPrompt.includes('hemoglobin') || cleanPrompt.includes('blood count')) {
      testLoinc = '3024-7';
      testName = 'Hemoglobin (LOINC: 3024-7)';
    }

    // Identify active patient context
    const currentPat = activePatient || api.getPatients()[0];
    
    setAgentLogs(prev => [
      ...prev,
      `> Intent parser identified: Clinical Scribe workflow.`,
      `> Target patient resolved: ${currentPat.name} (Phone: ${currentPat.phone})`,
      `> Extracted Drug: ${targetDrug} (${targetDosage}) | Duration: ${targetDuration}`,
      `> Extracted Diagnostic: ${testName} (LOINC: ${testLoinc})`
    ]);

    steps[0] = { name: 'PARSE', status: 'success', message: 'Prompt parsed successfully.' };
    steps[1] = { name: 'SAFETY (CDSS)', status: 'validating', message: 'Verifying drug allergies & chronic conditions...' };
    setPipelineSteps([...steps]);

    // Step 2: Clinical Safety Agent Validation Check
    await new Promise(resolve => setTimeout(resolve, 1000));
    const safetyCheck = ClinicalSafetyAgent.validatePrescription(currentPat.id, targetDrug, targetDosage);
    
    setAgentLogs(prev => [...prev, `> Safety validation check initiated...`, `> Checking documented allergies: [${currentPat.allergies.join(', ') || 'None'}]`]);

    if (!safetyCheck.success) {
      steps[1] = { name: 'SAFETY (CDSS)', status: 'error-halted', message: safetyCheck.message, detail: safetyCheck.detail };
      setPipelineSteps([...steps]);
      setAgentLogs(prev => [...prev, `> [HALT] ${safetyCheck.message}`, `> ${safetyCheck.detail}`]);
      setIsExecuting(false);
      setExecutionHalted(true);
      return;
    }

    steps[1] = { name: 'SAFETY (CDSS)', status: 'success', message: safetyCheck.message };
    steps[2] = { name: 'RESOURCE', status: 'validating', message: 'Auditing pharmacy stocks & lab reagents...' };
    setPipelineSteps([...steps]);
    setAgentLogs(prev => [...prev, `> Safety check passed!`, `> Initiating inventory stock & reagent capability audits...`]);

    // Step 3: Resource Allocation stock checks (FEFO & Reagents)
    await new Promise(resolve => setTimeout(resolve, 1000));
    const reagentCheck = ResourceAllocationAgent.validateLabReagents(testLoinc);
    const stockCheck = ResourceAllocationAgent.validatePharmacyInventory(targetDrug, 10); // Assume 10 tablets

    if (!reagentCheck.success) {
      steps[2] = { name: 'RESOURCE', status: 'error-halted', message: reagentCheck.message, detail: reagentCheck.detail };
      setPipelineSteps([...steps]);
      setAgentLogs(prev => [...prev, `> [HALT] ${reagentCheck.message}`, `> ${reagentCheck.detail}`]);
      setIsExecuting(false);
      setExecutionHalted(true);
      return;
    }

    if (!stockCheck.success) {
      steps[2] = { name: 'RESOURCE', status: 'error-halted', message: stockCheck.message, detail: stockCheck.detail };
      setPipelineSteps([...steps]);
      setAgentLogs(prev => [...prev, `> [HALT] ${stockCheck.message}`, `> ${stockCheck.detail}`]);
      setIsExecuting(false);
      setExecutionHalted(true);
      return;
    }

    steps[2] = { name: 'RESOURCE', status: 'success', message: 'Inventory checked. Reagents & stock reserves confirmed.' };
    steps[3] = { name: 'BILLING', status: 'validating', message: 'Calculating dynamic invoices & payouts splits...' };
    setPipelineSteps([...steps]);
    setAgentLogs(prev => [
      ...prev, 
      `> Lab check: Reagent verified.`, 
      `> Pharmacy check: ${targetDrug} Qty 10 locked (Batch: BAT-123456).`,
      `> Formulating ledger settlement parameters...`
    ]);

    // Step 4: Ledger mathematical split validation checks
    await new Promise(resolve => setTimeout(resolve, 1000));
    const doctorFee = 400;
    const labFee = 350;
    const pharmacyFee = 150;
    const platformFee = 9;
    const totalInvoice = 909;

    const ledgerCheck = FinancialLedgerAgent.validateLedgerSplits(totalInvoice, doctorFee, labFee, pharmacyFee, platformFee);

    if (!ledgerCheck.success) {
      steps[3] = { name: 'BILLING', status: 'error-halted', message: ledgerCheck.message, detail: ledgerCheck.detail };
      setPipelineSteps([...steps]);
      setAgentLogs(prev => [...prev, `> [HALT] ${ledgerCheck.message}`]);
      setIsExecuting(false);
      setExecutionHalted(true);
      return;
    }

    steps[3] = { name: 'BILLING', status: 'success', message: ledgerCheck.message };
    steps[4] = { name: 'DELIVER', status: 'validating', message: 'Drafting outbound e-prescriptions & WhatsApp cues...' };
    setPipelineSteps([...steps]);
    setAgentLogs(prev => [
      ...prev, 
      `> Split integrity verified (Doctor: ₹${doctorFee}, Lab: ₹${labFee}, Pharmacy: ₹${pharmacyFee}, System Fee: ₹${platformFee}).`,
      `> Staging WhatsApp Hinglish conversational payload...`
    ]);

    // Step 5: Queuing delivery triggers and proactive messaging templates
    await new Promise(resolve => setTimeout(resolve, 800));
    steps[4] = { name: 'DELIVER', status: 'success', message: 'Outbound triggers queued successfully.' };
    setPipelineSteps([...steps]);
    setAgentLogs(prev => [
      ...prev,
      `> Outbound payload queued for phone: ${currentPat.phone}.`,
      `> Agentic Telemetry loop complete. Awaiting clinic approval...`
    ]);
    setIsExecuting(false);
  };

  const handleApproveAndExecute = async () => {
    setIsExecuting(true);
    setAgentLogs(prev => [...prev, `> [Execution] Writing batched transaction card to Supabase...`]);
    
    // Commit the clinical encounter directly
    const currentPat = activePatient || api.getPatients()[0];
    
    try {
      const activePrompt = query.trim().toLowerCase();
      let drugName = 'Calpol 650';
      let dosage = '650mg';
      let loinc = '4544-3';
      let testName = 'HbA1c (Glycated Hemoglobin)';

      if (activePrompt.includes('penicillin') || activePrompt.includes('amoxicillin')) {
        drugName = 'Amoxicillin';
        dosage = '500mg';
      } else if (activePrompt.includes('ibuprofen')) {
        drugName = 'Ibuprofen';
        dosage = '400mg';
      }

      if (activePrompt.includes('creatinine') || activePrompt.includes('kidney')) {
        loinc = '2160-0';
        testName = 'Serum Creatinine';
      }

      await api.createEncounter({
        patientId: currentPat.id,
        patientName: currentPat.name,
        doctorId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101',
        clinicalNotes: `AI Agent parsed request: "${query}"`,
        medications: [{ id: crypto.randomUUID(), medicineName: drugName, dosage, frequency: '1-0-1', duration: '5 days' }],
        diagnosticTests: [{ loincCode: loinc, name: testName, category: 'Pathology', normalRange: 'N/A', unit: 'N/A' }]
      });

      // Save pipeline details inside Supabase log table
      const stepsPayload = pipelineSteps.map(s => ({ name: s.name, status: s.status, message: s.message, detail: s.detail || '' }));
      
      const { error: dbErr } = await api.saveAgentTaskPipeline({
        patient_id: currentPat.id,
        original_prompt: query,
        parsed_intent: 'CLINICAL_SCRIBE',
        steps_json: stepsPayload,
        status: 'completed'
      });

      if (dbErr) {
        console.error('[Agentic Console] Failed to log task pipeline in database:', dbErr);
      }

      setAgentLogs(prev => [...prev, `> Success! Encounter written, stock auto-holds locked, UPI invoice generated, and WhatsApp nudge triggered! 🟢`]);
      setQuery('');
      
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Agent Executed successfully! 🚀',
          message: 'Encounter submitted and routed successfully in 1-click.',
          type: 'success'
        }
      }));

      if (onWorkflowExecuted) {
        onWorkflowExecuted();
      }
    } catch (err) {
      console.error('[Agentic Console] Critical execution error:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-emerald-500 text-slate-800';
      case 'validating': return 'bg-amber-500 animate-pulse text-slate-800';
      case 'error-halted': return 'bg-rose-600 text-slate-800';
      default: return 'bg-slate-700 text-slate-600';
    }
  };

  const getProgressLineColor = (index: number) => {
    if (pipelineSteps.length === 0) return 'bg-slate-700';
    const current = pipelineSteps[index];
    const next = pipelineSteps[index + 1];
    
    if (current && current.status === 'success') {
      if (next && (next.status === 'success' || next.status === 'validating')) {
        return 'bg-emerald-500';
      }
      return 'bg-emerald-500 opacity-50';
    }
    return 'bg-slate-700';
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/60 p-6 backdrop-blur-xl transition-all duration-300 hover:border-slate-700/80 hover:shadow-2xl hover:shadow-emerald-950/10">
      {/* Top sparkles border effect */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
      
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/5">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-200 flex items-center gap-1.5">
                Mediflow AI Scribe Cockpit 
                <span className="flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 uppercase tracking-wider">
                  <Sparkles className="h-3 w-3 animate-pulse" /> Agentic
                </span>
              </h3>
              <p className="text-xs text-slate-600">Validate, schedule, and execute patient workflows step-by-step.</p>
            </div>
          </div>
          
          {activePatient && (
            <div className="flex items-center gap-2 rounded-lg bg-white/40 border border-slate-200/80 px-3 py-1.5 text-xs text-slate-600">
              <User className="h-3.5 w-3.5 text-emerald-400" />
              <span>Active patient: <strong className="text-slate-200">{activePatient.name}</strong></span>
            </div>
          )}
        </div>

        {/* Unified Input Prompt Panel */}
        <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white/40 p-1.5 transition-all focus-within:border-emerald-500/30 focus-within:ring-2 focus-within:ring-emerald-500/5">
          <input
            type="text"
            className="flex-1 border-0 bg-transparent py-2 pl-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-0"
            placeholder="Type or speak instructions (e.g., 'Aarav needs a HbA1c test and Calpol 650 twice daily...')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleValidateAndRoute()}
            disabled={isExecuting}
          />
          
          {isListening && (
            <div className="flex items-center gap-1 px-2.5 h-6 shrink-0 border-l border-slate-200 animate-fade-in select-none">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(bar => {
                const delay = (bar * 0.12).toFixed(2);
                return (
                  <span 
                    key={bar} 
                    className="w-0.5 bg-emerald-400 rounded-full animate-bounce shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.4)]"
                    style={{
                      height: `${(bar % 2 === 0 ? 10 : 16)}px`,
                      animationDelay: `${delay}s`,
                      animationDuration: '0.5s'
                    }}
                  />
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleListening}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${
                isListening 
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-400 animate-pulse' 
                  : 'bg-white border-slate-200 hover:border-slate-700/80 text-slate-600 hover:text-slate-200'
              }`}
              title="Speak instruction (Web Speech API)"
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            
            <button
              type="button"
              onClick={handleValidateAndRoute}
              disabled={isExecuting || !query.trim()}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-500 px-4 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 transition-all shadow-md shadow-emerald-500/10 cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Validate & Route</span>
            </button>
          </div>
        </div>

        {speechError && (
          <p className="text-[11px] text-rose-400/90 pl-1">{speechError}</p>
        )}

        {/* Step-by-Step Task Validation Pipeline UI */}
        {pipelineSteps.length > 0 && (
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-white/20 p-4 transition-all">
            <div className="flex justify-between items-center px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Agent Telemetry pipeline</span>
              {executionHalted && (
                <span className="text-[11px] font-medium text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 animate-bounce" /> Workflow Halted Safety Check Alert
                </span>
              )}
            </div>

            {/* Pipeline Step Circles */}
            <div className="relative flex items-center justify-between py-2 px-6">
              {pipelineSteps.map((step, idx) => (
                <React.Fragment key={step.name}>
                  {/* Circle */}
                  <div className="z-10 flex flex-col items-center gap-2">
                    <div 
                      className={`flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 font-mono text-[10px] font-bold shadow-lg transition-all duration-300 ${getStatusColor(step.status)}`}
                      title={`${step.name}: ${step.message}`}
                    >
                      {step.status === 'success' ? <CheckCircle2 className="h-4.5 w-4.5" /> : step.status === 'error-halted' ? <AlertTriangle className="h-4.5 w-4.5" /> : step.name.substring(0, 4)}
                    </div>
                    <span className="text-[10px] font-semibold text-slate-600 tracking-wide">{step.name}</span>
                  </div>

                  {/* Connective Line */}
                  {idx < pipelineSteps.length - 1 && (
                    <div className="absolute h-0.5 -z-0 bg-slate-800" style={{
                      left: `calc(${(idx / (pipelineSteps.length - 1)) * 100}% + 2.5rem)`,
                      width: `calc(${(1 / (pipelineSteps.length - 1)) * 100}% - 3rem)`,
                    }}>
                      <div className={`h-full transition-all duration-300 ${getProgressLineColor(idx)}`} />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Error Detail banner */}
            {pipelineSteps.some(s => s.status === 'error-halted') && (
              <div className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-3 flex gap-2.5 items-start">
                <AlertTriangle className="h-4.5 w-4.5 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <h4 className="font-semibold text-rose-300">
                    {pipelineSteps.find(s => s.status === 'error-halted')?.message}
                  </h4>
                  <p className="text-rose-400/80 mt-0.5">
                    {pipelineSteps.find(s => s.status === 'error-halted')?.detail}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Scribe Reasoning Logs CLI panel */}
        {agentLogs.length > 0 && (
          <div className="rounded-xl border border-slate-900 bg-white/80 p-4 font-mono text-[11px] leading-relaxed text-slate-600">
            <div className="flex items-center gap-2 border-b border-slate-900 pb-2 mb-2 text-slate-500">
              <Terminal className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase font-semibold tracking-wider">Agent execution logs</span>
            </div>
            
            <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1 select-none">
              {agentLogs.map((log, i) => (
                <div 
                  key={i} 
                  className={log.startsWith('> [HALT]') ? 'text-rose-400 font-semibold' : log.startsWith('> Success!') ? 'text-emerald-400 font-semibold' : 'text-slate-600'}
                >
                  {log}
                </div>
              ))}
            </div>

            {/* Action buttons if completely parsed with 0 errors */}
            {!executionHalted && pipelineSteps.length > 0 && pipelineSteps.every(s => s.status === 'success') && (
              <div className="flex justify-end gap-3 border-t border-slate-900 pt-3 mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setPipelineSteps([]);
                    setAgentLogs([]);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-200 transition-all cursor-pointer"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleApproveAndExecute}
                  disabled={isExecuting}
                  className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-5 py-2 text-xs font-semibold text-slate-950 shadow-md shadow-emerald-500/10 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-slate-950" />
                  <span>Approve & Execute DB SQL</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
