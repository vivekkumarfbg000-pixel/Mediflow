import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { ReagentStock } from '../../services/api';
import type { LabRequisition } from '../../types';


export const LabDashboard: React.FC = () => {
  const [requisitions, setRequisitions] = useState<LabRequisition[]>([]);
  const [reagents, setReagents] = useState<ReagentStock[]>([]);

  // Autopilot and Gauge states
  const [autopilotEnabled, setAutopilotEnabled] = useState(() => localStorage.getItem('reagent_autopilot_enabled') !== 'false');
  const [autopilotLogs, setAutopilotLogs] = useState<{ reagentName: string; volume: number; timestamp: string }[]>([]);

  useEffect(() => {
    // Generate initial autopilot logs to simulate premium clinical history
    setAutopilotLogs([
      { reagentName: 'HbA1c Enzyme Reagent A', volume: 500, timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString() },
      { reagentName: 'Bilirubin Diazo Reagent', volume: 500, timestamp: new Date(Date.now() - 3600000 * 14.2).toISOString() }
    ]);
  }, []);

  useEffect(() => {
    const handleAutopilotEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setAutopilotLogs(prev => [
        {
          reagentName: detail.reagentName,
          volume: detail.replenishedVolume,
          timestamp: detail.timestamp
        },
        ...prev
      ]);
    };
    window.addEventListener('mediflow-reagent-autopilot', handleAutopilotEvent);
    return () => window.removeEventListener('mediflow-reagent-autopilot', handleAutopilotEvent);
  }, []);

  const toggleAutopilot = () => {
    const nextVal = !autopilotEnabled;
    setAutopilotEnabled(nextVal);
    localStorage.setItem('reagent_autopilot_enabled', String(nextVal));
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: nextVal ? 'Autopilot armed and activated! Under-threshold volumes will auto-replenish.' : 'Autopilot deactivated. Manual stock replenishment required.',
        type: nextVal ? 'success' : 'info',
        title: nextVal ? 'Autopilot Armed' : 'Autopilot Offline'
      }
    }));
  };

  // Reagent Replenishment state
  const [replenishReagent, setReplenishReagent] = useState('');
  const [replenishVol, setReplenishVol] = useState<number | ''>('');
  const [replenishBusy, setReplenishBusy] = useState(false);

  // V2.0 Printable Specimen Label & simulation states
  const [printLabelReq, setPrintLabelReq] = useState<LabRequisition | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleReplenish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replenishReagent || !replenishVol || Number(replenishVol) <= 0) return;
    setReplenishBusy(true);
    api.replenishReagentStock(replenishReagent, Number(replenishVol));
    setTimeout(() => {
      setReplenishBusy(false);
      setReplenishVol('');
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: `Replenished ${replenishVol}ml of ${replenishReagent}. Stock updated in Supabase.`,
          type: 'success',
          title: 'Reagent Replenished'
        }
      }));
    }, 600);
  };
  
  // Single result form input
  const [activeReqId, setActiveReqId] = useState<string | null>(null);

  // Structured Biomarker Form States
  const [hba1cVal, setHba1cVal] = useState('6.5');
  const [eagVal, setEagVal] = useState('140');
  const [creatinineVal, setCreatinineVal] = useState('1.1');
  const [egfrVal, setEgfrVal] = useState('85');
  const [bunVal, setBunVal] = useState('14');
  const [hbVal, setHbVal] = useState('13.5');
  const [hctVal, setHctVal] = useState('41');
  const [genericVal, setGenericVal] = useState('');
  const [genericUnit, setGenericUnit] = useState('');
  const [jsonPayload, setJsonPayload] = useState('{}');

  const activeReq = requisitions.find(r => r.id === activeReqId);

  // Formula for eAG: eAG = 28.7 * HbA1c - 46.7
  const handleHba1cChange = React.useCallback((val: string) => {
    setHba1cVal(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      const calculatedEag = Math.round(28.7 * parsed - 46.7);
      setEagVal(calculatedEag.toString());
    } else {
      setEagVal('');
    }
  }, []);

  // Hematocrit = Hb * 3 roughly
  const handleHbChange = React.useCallback((val: string) => {
    setHbVal(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      setHctVal(Math.round(parsed * 3).toString());
    } else {
      setHctVal('');
    }
  }, []);

  useEffect(() => {
    if (!activeReq) return;
    let data: Record<string, any> = {
      testCode: activeReq.testCode,
      testName: activeReq.testName,
      patientId: activeReq.patientId,
      timestamp: new Date().toISOString(),
    };

    switch (activeReq.testCode) {
      case '4544-3': // HbA1c
        data.biomarkers = {
          HbA1c: parseFloat(hba1cVal) || 0,
          HbA1c_unit: '%',
          estimatedAverageGlucose: parseFloat(eagVal) || 0,
          eAG_unit: 'mg/dL'
        };
        break;
      case '2160-0': // Serum Creatinine
        data.biomarkers = {
          serumCreatinine: parseFloat(creatinineVal) || 0,
          creatinine_unit: 'mg/dL',
          eGFR: parseFloat(egfrVal) || 0,
          eGFR_unit: 'mL/min/1.73m2',
          bloodUreaNitrogen: parseFloat(bunVal) || 0,
          BUN_unit: 'mg/dL'
        };
        break;
      case '3024-7': // Total Hemoglobin
        data.biomarkers = {
          hemoglobin: parseFloat(hbVal) || 0,
          hemoglobin_unit: 'g/dL',
          hematocrit: parseFloat(hctVal) || 0,
          hematocrit_unit: '%'
        };
        break;
      default:
        data.biomarkers = {
          resultValue: genericVal,
          unit: genericUnit || 'N/A'
        };
        break;
    }
    setJsonPayload(JSON.stringify(data, null, 2));
  }, [activeReqId, hba1cVal, eagVal, creatinineVal, egfrVal, bunVal, hbVal, hctVal, genericVal, genericUnit, activeReq]);

  useEffect(() => {
    const syncLab = () => {
      setRequisitions(api.getLabRequisitions());
      setReagents(api.getReagentStocks());
    };

    syncLab();
    return api.subscribe(syncLab);
  }, []);

  useEffect(() => {
    if (activeReq) {
      const patients = api.getPatients();
      const patient = patients.find(p => p.id === activeReq.patientId);
      if (patient) {
        api.setActivePatient(patient);
      }
    }
  }, [activeReqId, requisitions]);
  const handleCollectSample = React.useCallback((req: LabRequisition) => {
    api.collectLabSample(req.id);
    setPrintLabelReq(req);
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: 'Specimen sample collected and barcoded. Specimen label ready for printing.',
        type: 'success',
        title: 'Sample Collected'
      }
    }));
  }, []);

  const handleOpenSubmit = React.useCallback((req: LabRequisition) => {
    setActiveReqId(req.id);
    // Initialize default biomarker values if needed
    if (req.testCode === '4544-3') {
      setHba1cVal('6.5');
      setEagVal('140');
    } else if (req.testCode === '2160-0') {
      setCreatinineVal('1.1');
      setEgfrVal('85');
      setBunVal('14');
    } else if (req.testCode === '3024-7') {
      setHbVal('13.5');
      setHctVal('41');
    } else {
      setGenericVal('');
      setGenericUnit('');
    }
  }, []);

  const handlePublishReport = React.useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReqId) return;

    setIsProcessing(true);
    setTimeout(() => {
      api.submitLabResult(activeReqId, jsonPayload);
      
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: `Diagnostic report verified and published. LOINC: ${activeReq?.testCode || 'N/A'}`,
          type: 'success',
          title: 'Report Published'
        }
      }));
      
      setIsProcessing(false);
      setActiveReqId(null);
      setGenericVal('');
      setGenericUnit('');
    }, 2000);
  }, [activeReqId, jsonPayload, activeReq]);

  // Reusable visual 4-state stepper tracker
  const renderRequisitionStepper = (status: 'pending' | 'collected' | 'processed' | 'completed') => {
    const steps = [
      { label: 'Pending', desc: 'Issued', key: 'pending' },
      { label: 'Collected', desc: 'Drawn', key: 'collected' },
      { label: 'Processing', desc: 'Analyzer', key: 'processed' },
      { label: 'Approved', desc: 'Published', key: 'completed' },
    ];

    let activeIdx = 0;
    if (status === 'collected') activeIdx = 1;
    else if (status === 'processed') activeIdx = 2;
    else if (status === 'completed') activeIdx = 3;

    return (
      <div className="w-full py-3">
        <div className="flex items-center justify-between relative px-2">
          {/* Connecting Line */}
          <div className="absolute left-6 right-6 top-3 h-[2px] bg-white/10 z-0" />
          <div 
            className="absolute left-6 top-3 h-[2px] bg-gradient-to-r from-primary to-secondary transition-all duration-500 z-0" 
            style={{ width: `${activeIdx === 0 ? 0 : activeIdx === 1 ? 33 : activeIdx === 2 ? 66 : 100}%` }}
          />

          {/* Steps */}
          {steps.map((step, idx) => {
            const isCompleted = idx < activeIdx;
            const isActive = idx === activeIdx;
            
            return (
              <div key={step.key} className="flex flex-col items-center z-10 relative">
                <div 
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all duration-300 font-mono ${
                    isCompleted 
                      ? 'bg-primary border-primary text-white shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)]' 
                      : isActive 
                        ? 'bg-surface-container border-secondary text-secondary shadow-[0_0_12px_rgba(var(--secondary-rgb),0.6)]'
                        : 'bg-surface-container-lowest border-outline-variant text-clinical-400'
                  }`}
                >
                  {isCompleted ? (
                    <span className="material-symbols-outlined text-xs font-bold">check</span>
                  ) : (
                    idx + 1
                  )}
                </div>
                <span className={`text-[9px] mt-1.5 font-bold tracking-tight ${isActive ? 'text-secondary' : isCompleted ? 'text-primary' : 'text-clinical-400'}`}>
                  {step.label}
                </span>
                <span className="text-[7px] text-clinical-500 font-mono hidden md:block">
                  {step.desc}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Reusable biomarker results renderer
  const renderResultValue = (resultStr?: string) => {
    if (!resultStr) return <span className="text-clinical-500 font-mono">N/A</span>;
    
    try {
      if (resultStr.trim().startsWith('{')) {
        const data = JSON.parse(resultStr);
        if (data.biomarkers) {
          return (
            <div className="space-y-1 font-mono text-[10px]">
              {Object.entries(data.biomarkers).map(([key, val]) => {
                if (
                  key.endsWith('_unit') || 
                  key === 'unit' || 
                  key === 'HbA1c_unit' || 
                  key === 'eAG_unit' || 
                  key === 'creatinine_unit' || 
                  key === 'eGFR_unit' || 
                  key === 'BUN_unit' || 
                  key === 'hemoglobin_unit' || 
                  key === 'hematocrit_unit'
                ) return null;
                
                let unit = '';
                if (key === 'HbA1c') unit = '%';
                else if (key === 'estimatedAverageGlucose') unit = ' mg/dL';
                else if (key === 'serumCreatinine') unit = ' mg/dL';
                else if (key === 'eGFR') unit = ' mL/min';
                else if (key === 'bloodUreaNitrogen') unit = ' mg/dL';
                else if (key === 'hemoglobin') unit = ' g/dL';
                else if (key === 'hematocrit') unit = '%';
                else if (key === 'resultValue') unit = ` ${data.biomarkers.unit || ''}`;
                
                const label = key
                  .replace(/([A-Z])/g, ' $1')
                  .replace(/^./, str => str.toUpperCase())
                  .replace('Estimated Average Glucose', 'eAG')
                  .replace('Serum Creatinine', 'Creatinine')
                  .replace('Blood Urea Nitrogen', 'BUN')
                  .replace('Result Value', 'Result');

                return (
                  <div key={key} className="flex justify-between items-center gap-2 bg-secondary/5 border border-secondary/10 px-1.5 py-0.5 rounded text-secondary font-bold">
                    <span>{label}:</span>
                    <span>{String(val)}{unit}</span>
                  </div>
                );
              })}
            </div>
          );
        }
      }
    } catch (e) {
      // Fail silently and render standard fallback
    }

    return (
      <span className="font-bold text-secondary bg-secondary/10 border border-secondary/20 px-3 py-1 rounded-lg font-mono text-center block">
        {resultStr}
      </span>
    );
  };

  const pendingList = React.useMemo(() => requisitions.filter(r => r.status === 'pending'), [requisitions]);
  const collectedList = React.useMemo(() => requisitions.filter(r => r.status === 'collected' || r.status === 'processed'), [requisitions]);
  const completedList = React.useMemo(() => requisitions.filter(r => r.status === 'completed'), [requisitions]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
      {/* LEFT COLUMN: Test Requisition queue (Pending, Collected) */}
      <div className="lg:col-span-8 space-y-6">
        
        {/* Active Test Requisitions */}
        <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary to-secondary opacity-50" />
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">biotech</span>
            Active Pathology Specimen & Requisition Queue
          </h2>

          <div className="space-y-6">
            
            {/* 1. Samples pending collection */}
            <div>
              <h3 className="font-bold text-xs text-clinical-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                Awaiting Sample Collection ({pendingList.length})
              </h3>
              
              {pendingList.length === 0 ? (
                <div className="p-5 bg-surface-container-lowest/40 border border-outline-variant rounded-xl text-center text-xs text-clinical-500">
                  No pending sample draws.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingList.map(req => {
                    const isConsentActive = api.isPatientConsentActive(req.patientId);
                    return (
                      <div key={req.id} className="p-5 bg-surface-container rounded-xl border border-outline-variant flex flex-col justify-between gap-4 hover:border-outline/50 transition-all duration-300 relative overflow-hidden">
                        {!isConsentActive && (
                          <div className="absolute inset-0 z-[45] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm border border-rose-500/20 p-4 text-center animate-fade-in">
                            <div className="w-8 h-8 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-2 text-rose-500 animate-pulse">
                              <span className="material-symbols-outlined text-base">lock</span>
                            </div>
                            <h4 className="text-white font-bold text-xs">Consent Lock</h4>
                            <p className="text-[9px] text-clinical-400 mt-1 max-w-[150px]">
                              Authorized Patient Consent is missing. Lock active.
                            </p>
                          </div>
                        )}
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="font-bold text-sm text-white">{req.patientName}</h4>
                            <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                              Pending Draw
                            </span>
                          </div>
                          <p className="text-xs font-bold text-primary mt-2 flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">science</span>
                            {req.testName}
                          </p>
                          
                          {/* 4-State Stepper */}
                          <div className="mt-3 p-2 bg-surface-container-lowest/50 border border-outline-variant/40 rounded-lg">
                            {renderRequisitionStepper(req.status)}
                          </div>
                          
                          {/* Simulated Barcode Sticker sticker decal */}
                          <div className="mt-3 p-3 bg-surface-container-lowest/80 border border-outline-variant rounded-lg space-y-2">
                            <div className="flex justify-between text-[8px] text-clinical-400 font-mono font-bold tracking-widest uppercase">
                              <span>REQUISITION MAPPED</span>
                              <span>ID: {req.id.toUpperCase()}</span>
                            </div>
                            <div className="simulated-barcode h-8 w-full" />
                            <p className="text-[9px] text-center text-clinical-300 font-mono tracking-wider font-bold">
                              *{req.barcode}*
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleCollectSample(req)}
                          className="btn-primary py-2 text-xs flex items-center justify-center gap-2 active:scale-95 transition-all w-full font-bold"
                        >
                          <span className="material-symbols-outlined text-sm font-bold">print</span>
                          Print Barcode & Collect Sample
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Collected / Processing Requisitions */}
            <div className="border-t border-outline-variant pt-6">
              <h3 className="font-bold text-xs text-clinical-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                Drawn Samples in Process ({collectedList.length})
              </h3>
              {collectedList.length === 0 ? (
                <div className="p-5 bg-surface-container-lowest/40 border border-outline-variant rounded-xl text-center text-xs text-clinical-500">
                  No samples ready for testing.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {collectedList.map(req => {
                    const isConsentActive = api.isPatientConsentActive(req.patientId);
                    return (
                      <div key={req.id} className="p-5 bg-surface-container rounded-xl border border-outline-variant flex flex-col justify-between gap-4 hover:border-outline/50 transition-all duration-300 relative overflow-hidden">
                        {!isConsentActive && (
                          <div className="absolute inset-0 z-[45] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm border border-rose-500/20 p-4 text-center animate-fade-in">
                            <div className="w-8 h-8 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-2 text-rose-500 animate-pulse">
                              <span className="material-symbols-outlined text-base">lock</span>
                            </div>
                            <h4 className="text-white font-bold text-xs">Consent Lock</h4>
                            <p className="text-[9px] text-clinical-400 mt-1 max-w-[150px]">
                              Authorized Patient Consent is missing. Lock active.
                            </p>
                          </div>
                        )}
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="font-bold text-sm text-white">{req.patientName}</h4>
                            <span className="text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                              Processing
                            </span>
                          </div>
                          <p className="text-xs font-bold text-secondary mt-2 flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">science</span>
                            {req.testName}
                          </p>

                          {/* 4-State Stepper */}
                          <div className="mt-3 p-2 bg-surface-container-lowest/50 border border-outline-variant/40 rounded-lg">
                            {renderRequisitionStepper(req.status)}
                          </div>

                          <div className="mt-3 flex items-center gap-2 bg-surface-container-lowest/70 border border-outline-variant/60 p-2.5 rounded-lg">
                            <span className="material-symbols-outlined text-sm text-primary">label</span>
                            <div className="text-[10px] text-clinical-300 font-medium">
                              Specimen Barcode <strong className="text-white font-mono">{req.barcode}</strong> matches catalog trigger
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleOpenSubmit(req)}
                          className="btn-primary py-2 text-xs flex items-center justify-center gap-2 active:scale-95 transition-all w-full font-bold bg-gradient-to-r from-primary to-secondary"
                        >
                          <span className="material-symbols-outlined text-sm font-bold">input</span>
                          Input Analyzer Result
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Diagnostic completed reports card */}
        <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-secondary to-primary opacity-50" />
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-xl">verified</span>
            Completed Diagnostic Report Cards & Reagent Logs
          </h2>
          
          {completedList.length === 0 ? (
            <div className="text-center py-8 text-clinical-500 text-sm">No completed tests logged today.</div>
          ) : (
            <div className="border border-outline-variant rounded-xl overflow-hidden glass-panel-inner">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-container text-clinical-300 border-b border-outline-variant font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Patient</th>
                    <th className="p-3.5">Lab Requisition</th>
                    <th className="p-3.5">Analyzer Value</th>
                    <th className="p-3.5 text-right">Reagent Stock Deduction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant bg-surface-container-lowest/30">
                  {completedList.map(req => (
                    <tr key={req.id} className="hover:bg-surface-container/50 transition-colors">
                      <td className="p-3.5 font-semibold text-white">{req.patientName}</td>
                      <td className="p-3.5 text-clinical-300">
                        <div className="font-semibold text-white">{req.testName}</div>
                        <div className="text-[9px] text-clinical-400 mt-1 uppercase font-mono tracking-wider">
                          Barcode: {req.barcode}
                        </div>
                      </td>
                      <td className="p-3.5">
                        {renderResultValue(req.quantitativeResult)}
                      </td>
                      <td className="p-3.5 text-right">
                        {req.reagentDeductions && req.reagentDeductions.map((ded, idx) => (
                          <div key={idx} className="text-right text-[10px] text-rose-400 flex items-center justify-end gap-1.5 font-bold tracking-wide uppercase font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                            -{ded.volumeDeducted}{ded.unit} {ded.reagentName}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* RIGHT COLUMN: Reagent stocks, Result Input Modal */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Reagent Chemical Inventory Ledger */}
        <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden space-y-6">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary to-secondary opacity-50" />
          
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">biotech</span>
                Volumetric Reagent Ledger
              </h2>
              <p className="text-[11px] text-clinical-400 leading-relaxed">
                Real-time analyzer chemical stock volumetric liquid gauges.
              </p>
            </div>
            {/* AUTOPILOT COCKPIT TOGGLE */}
            <button
              onClick={toggleAutopilot}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-[10px] font-extrabold cursor-pointer hover:scale-105 active:scale-95 ${
                autopilotEnabled
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                  : 'bg-clinical-950 border-outline-variant text-clinical-400'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${autopilotEnabled ? 'bg-emerald-400 animate-ping' : 'bg-clinical-500'}`}></span>
              <span>{autopilotEnabled ? 'AUTOPILOT ARMED' : 'ARM AUTOPILOT'}</span>
            </button>
          </div>

          {/* DYNAMIC 3D VOLUMETRIC CYLINDER GAUGES */}
          <div className="grid grid-cols-5 gap-2.5 pt-4 bg-black/25 p-4 rounded-2xl border border-white/5 relative">
            
            {/* Tick marks on left side */}
            <div className="absolute left-2.5 top-4 bottom-4 flex flex-col justify-between text-[8px] text-clinical-500 font-mono font-bold select-none h-[120px] pointer-events-none">
              <span>1000ml</span>
              <span>750ml</span>
              <span>500ml</span>
              <span>250ml</span>
              <span>0ml</span>
            </div>

            {reagents.map((reag, idx) => {
              const vol = reag.stockVolume;
              const percent = Math.min(100, Math.max(0, (vol / 1000) * 100));
              const isLow = vol < 100;
              const isWarning = vol < 200;

              // Determine gradient colors based on volume status
              let fluidColor = 'from-emerald-500/70 to-teal-500/80';
              let glowColor = 'shadow-[inset_0_0_12px_rgba(16,185,129,0.5)]';
              let badgeColor = 'text-emerald-400 bg-emerald-500/10';
              if (isLow) {
                fluidColor = 'from-rose-500/80 to-red-600/90 animate-pulse';
                glowColor = 'shadow-[inset_0_0_15px_rgba(239,68,68,0.7),0_0_10px_rgba(239,68,68,0.3)]';
                badgeColor = 'text-rose-400 bg-rose-500/10 border border-rose-500/20';
              } else if (isWarning) {
                fluidColor = 'from-amber-400/80 to-orange-500/80';
                glowColor = 'shadow-[inset_0_0_12px_rgba(245,158,11,0.6)]';
                badgeColor = 'text-amber-400 bg-amber-500/10 border border-amber-500/20';
              }

              return (
                <div key={idx} className="flex flex-col items-center group relative cursor-pointer" title={`${reag.reagentName}: ${vol}ml`}>
                  {/* Cylinder Tube */}
                  <div className="w-6.5 h-[120px] bg-slate-900/60 rounded-full border border-white/10 relative overflow-hidden shadow-inner flex items-end">
                    
                    {/* Glass Reflection stripe */}
                    <div className="absolute top-0 bottom-0 left-[20%] w-[1.5px] bg-white/15 z-20 pointer-events-none" />
                    
                    {/* Tick Mark Overlays */}
                    <div className="absolute inset-0 flex flex-col justify-between py-1 z-10 opacity-30 select-none pointer-events-none">
                      <div className="w-full h-[1px] bg-white/30" />
                      <div className="w-full h-[1px] bg-white/30" />
                      <div className="w-full h-[1px] bg-white/30" />
                      <div className="w-full h-[1px] bg-white/30" />
                      <div className="w-full h-[1px] bg-white/30" />
                    </div>

                    {/* Autopilot trigger indicator line at 200ml */}
                    <div className="absolute bottom-[20%] left-0 right-0 h-[1px] border-b border-dashed border-cyan-400/40 z-10 pointer-events-none" title="Autopilot safety threshold (200ml)" />

                    {/* Fluid Liquid with gradients and wave animation */}
                    <div 
                      className={`w-full bg-gradient-to-t ${fluidColor} ${glowColor} transition-all duration-700 relative z-0`}
                      style={{ height: `${percent}%`, animation: 'wave 3s ease-in-out infinite' }}
                    >
                      {/* Rising bubbling particles */}
                      <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <span className="bubble absolute w-1 h-1 bg-white/40 rounded-full bottom-0 left-[20%] animate-rise duration-3000"></span>
                        <span className="bubble absolute w-1.5 h-1.5 bg-white/35 rounded-full bottom-0 left-[50%] animate-rise duration-2000"></span>
                        <span className="bubble absolute w-0.8 h-0.8 bg-white/50 rounded-full bottom-0 left-[75%] animate-rise duration-4000"></span>
                      </div>
                    </div>
                  </div>

                  {/* Reagent Mini Name (Hover tooltip/Label) */}
                  <span className="text-[7px] text-clinical-400 text-center font-bold tracking-tight mt-2 line-clamp-2 leading-[8px] h-4">
                    {reag.reagentName.replace(' Reagent', '').replace('Picrate B', 'Picrate')}
                  </span>
                  
                  {/* Floating Volume Badge */}
                  <span className={`text-[8px] font-mono font-bold mt-1 px-1.5 py-0.5 rounded ${badgeColor}`}>
                    {vol}ml
                  </span>
                </div>
              );
            })}
          </div>

          {/* Autopilot action timeline */}
          {autopilotLogs.length > 0 && (
            <div className="border-t border-outline-variant pt-3.5 space-y-2 select-none">
              <h4 className="text-[9px] font-bold text-clinical-300 uppercase tracking-widest flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs text-emerald-400 fill-current animate-pulse">history</span>
                Autopilot Replenishment Logs
              </h4>
              <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                {autopilotLogs.map((log, i) => (
                  <div key={i} className="flex justify-between items-center p-1.5 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-[9px] font-mono text-emerald-300">
                    <span className="truncate max-w-[150px]">{log.reagentName}</span>
                    <span className="shrink-0 font-bold">+500ml Auto-Restored</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Bubble Gauge CSS Keyframe Animations */}
          <style>{`
            @keyframes rise {
              0% { transform: translateY(100%) scale(0.5); opacity: 0; }
              20% { opacity: 0.8; }
              80% { opacity: 0.8; }
              100% { transform: translateY(-100px) scale(1.1); opacity: 0; }
            }
            .bubble {
              display: block;
              animation: rise infinite linear;
            }
            .animate-rise {
              animation: rise 3s infinite linear;
            }
            .duration-2000 { animation-duration: 2s; }
            .duration-3000 { animation-duration: 3s; }
            .duration-4000 { animation-duration: 4s; }
            @keyframes wave {
              0%, 100% { border-top-left-radius: 4px; border-top-right-radius: 4px; }
              50% { border-top-left-radius: 12px; border-top-right-radius: 12px; }
            }
          `}</style>

          {/* Manual Reagent Replenishment Form */}
          <div className="border-t border-outline-variant pt-4">
            <h4 className="text-[10px] font-bold text-clinical-300 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[12px] text-secondary">add_circle</span>
              Manual Stock Override
            </h4>
            <form onSubmit={handleReplenish} className="space-y-3">
              <select
                required
                value={replenishReagent}
                onChange={(e) => setReplenishReagent(e.target.value)}
                className="w-full input-field bg-clinical-950 text-xs py-2 focus:ring-1 focus:ring-secondary border border-outline-variant"
              >
                <option value="">— Select Reagent —</option>
                {reagents.map(r => (
                  <option key={r.reagentName} value={r.reagentName}>{r.reagentName}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  type="number"
                  required
                  min={1}
                  max={5000}
                  placeholder="Volume (ml)"
                  value={replenishVol}
                  onChange={(e) => setReplenishVol(e.target.value !== '' ? Number(e.target.value) : '')}
                  className="flex-1 input-field text-xs py-2 focus:ring-1 focus:ring-secondary border border-outline-variant"
                />
                <button
                  type="submit"
                  disabled={replenishBusy}
                  className="btn-primary py-2 px-3 text-xs font-bold bg-secondary hover:bg-secondary/80 border-secondary text-black hover:scale-105 active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
                >
                  {replenishBusy ? (
                    <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                  ) : (
                    <span className="material-symbols-outlined text-sm font-bold">add</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="mt-4 flex items-start gap-2 bg-primary/5 border border-primary/10 p-3 rounded-lg text-[10px] text-primary leading-relaxed">
            <span className="material-symbols-outlined text-sm mt-0.5 flex-shrink-0">info</span>
            <span>Autopilot deductions and safety triggers synchronize automatically in the background.</span>
          </div>
        </div>

        {/* Deduction Audit Log Feed */}
        {completedList.length > 0 && (
          <div className="glass-panel p-5 border-white/10 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-rose-500 to-amber-500 opacity-40" />
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400 text-base">receipt_long</span>
              Chemical Deduction Audit Log
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {completedList.flatMap(req => 
                (req.reagentDeductions || []).map((ded, i) => (
                  <div key={`${req.id}-${i}`} className="flex items-center justify-between p-2.5 bg-surface-container-lowest/60 border border-outline-variant/40 rounded-lg">
                    <div className="text-[10px]">
                      <span className="font-bold text-white">{req.testName}</span>
                      <span className="text-clinical-500 mx-1">→</span>
                      <span className="text-amber-300 font-mono">{ded.reagentName}</span>
                    </div>
                    <span className="text-[10px] font-bold text-rose-400 font-mono">-{ded.volumeDeducted}{ded.unit}</span>
                  </div>
                ))
              )}
              {completedList.flatMap(r => r.reagentDeductions || []).length === 0 && (
                <p className="text-[10px] text-clinical-500 text-center py-2">No deductions logged yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Structured Analyzer Submission Form */}
        {activeReqId && activeReq && (
          <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden animate-fade-in">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-secondary to-primary opacity-50" />
            <h3 className="font-bold text-white mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-xl">edit_document</span>
              Biomarker Data Entry Form
            </h3>
            <p className="text-xs text-clinical-400 mb-4 leading-relaxed">
              Enter structured clinical metrics to generate verified JSON report cards.
            </p>

            <form onSubmit={handlePublishReport} className="space-y-4">
              <div className="p-3 bg-surface-container rounded-lg border border-outline-variant/60">
                <div className="text-[10px] text-clinical-300 font-mono font-bold uppercase tracking-wider">
                  Test: {activeReq.testName}
                </div>
                <div className="text-[9px] text-clinical-400 font-mono uppercase mt-1">
                  LOINC: {activeReq.testCode}
                </div>
              </div>

              {/* Dynamic Inputs Based on LOINC Code */}
              {activeReq.testCode === '4544-3' ? (
                /* HbA1c Panel */
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-clinical-200 mb-1">
                      HbA1c Value (%)
                    </label>
                    <input
                      type="number"
                      required
                      step="0.1"
                      min="3"
                      max="20"
                      value={hba1cVal}
                      onChange={(e) => handleHba1cChange(e.target.value)}
                      className="w-full input-field text-sm focus:ring-1 focus:ring-secondary focus:border-secondary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-clinical-200 mb-1">
                      Estimated Average Glucose (eAG) (mg/dL)
                    </label>
                    <input
                      type="number"
                      required
                      value={eagVal}
                      onChange={(e) => setEagVal(e.target.value)}
                      className="w-full input-field text-sm focus:ring-1 focus:ring-secondary focus:border-secondary"
                    />
                    <span className="text-[8px] text-clinical-400 font-mono mt-1 block">
                      Auto-calculated: eAG = 28.7 * HbA1c - 46.7
                    </span>
                  </div>
                </div>
              ) : activeReq.testCode === '2160-0' ? (
                /* Renal Panel */
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-clinical-200 mb-1">
                      Serum Creatinine (mg/dL)
                    </label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0.1"
                      max="15"
                      value={creatinineVal}
                      onChange={(e) => setCreatinineVal(e.target.value)}
                      className="w-full input-field text-sm focus:ring-1 focus:ring-secondary focus:border-secondary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-clinical-200 mb-1">
                      eGFR (mL/min/1.73m²)
                    </label>
                    <input
                      type="number"
                      required
                      value={egfrVal}
                      onChange={(e) => setEgfrVal(e.target.value)}
                      className="w-full input-field text-sm focus:ring-1 focus:ring-secondary focus:border-secondary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-clinical-200 mb-1">
                      Blood Urea Nitrogen (BUN) (mg/dL)
                    </label>
                    <input
                      type="number"
                      required
                      value={bunVal}
                      onChange={(e) => setBunVal(e.target.value)}
                      className="w-full input-field text-sm focus:ring-1 focus:ring-secondary focus:border-secondary"
                    />
                  </div>
                </div>
              ) : activeReq.testCode === '3024-7' ? (
                /* Total Hemoglobin */
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-clinical-200 mb-1">
                      Hemoglobin (g/dL)
                    </label>
                    <input
                      type="number"
                      required
                      step="0.1"
                      min="2"
                      max="25"
                      value={hbVal}
                      onChange={(e) => handleHbChange(e.target.value)}
                      className="w-full input-field text-sm focus:ring-1 focus:ring-secondary focus:border-secondary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-clinical-200 mb-1">
                      Hematocrit (%)
                    </label>
                    <input
                      type="number"
                      required
                      value={hctVal}
                      onChange={(e) => setHctVal(e.target.value)}
                      className="w-full input-field text-sm focus:ring-1 focus:ring-secondary focus:border-secondary"
                    />
                    <span className="text-[8px] text-clinical-400 font-mono mt-1 block">
                      Auto-calculated: Hematocrit = Hemoglobin * 3
                    </span>
                  </div>
                </div>
              ) : (
                /* Generic Test */
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-clinical-200 mb-1">
                      Result Value
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., 98.4"
                      value={genericVal}
                      onChange={(e) => setGenericVal(e.target.value)}
                      className="w-full input-field text-sm focus:ring-1 focus:ring-secondary focus:border-secondary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-clinical-200 mb-1">
                      Unit
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., °F or mg/dL"
                      value={genericUnit}
                      onChange={(e) => setGenericUnit(e.target.value)}
                      className="w-full input-field text-sm focus:ring-1 focus:ring-secondary focus:border-secondary"
                    />
                  </div>
                </div>
              )}

              {/* High-fidelity clinical quantitative reference range markers */}
              <div className="bg-surface-container-lowest/80 p-3.5 border border-outline-variant rounded-lg space-y-2">
                <span className="text-[10px] text-clinical-300 font-bold uppercase tracking-wider font-mono">LOINC Reference Range</span>
                <div className="h-[2px] w-full bg-outline-variant relative rounded-full">
                  <div className="absolute left-[25%] right-[25%] h-full bg-secondary" />
                  <span className="absolute left-[25%] -top-[3px] w-2 h-2 rounded-full bg-secondary" />
                  <span className="absolute right-[25%] -top-[3px] w-2 h-2 rounded-full bg-secondary" />
                </div>
                <div className="flex justify-between text-[8px] text-clinical-400 font-mono">
                  {activeReq.testCode === '4544-3' ? (
                    <>
                      <span>&lt; 5.7% (Normal)</span>
                      <span className="text-secondary font-bold">5.7% - 6.4% (Pre-diab)</span>
                      <span>&ge; 6.5% (Diabetic)</span>
                    </>
                  ) : activeReq.testCode === '2160-0' ? (
                    <>
                      <span>&lt; 0.6 mg/dL</span>
                      <span className="text-secondary font-bold">0.6 - 1.2 mg/dL</span>
                      <span>&gt; 1.2 mg/dL</span>
                    </>
                  ) : activeReq.testCode === '3024-7' ? (
                    <>
                      <span>&lt; 12.0 g/dL</span>
                      <span className="text-secondary font-bold">12.0 - 16.0 g/dL</span>
                      <span>&gt; 16.0 g/dL</span>
                    </>
                  ) : (
                    <>
                      <span>Low</span>
                      <span className="text-secondary font-bold">Normal Range</span>
                      <span>High</span>
                    </>
                  )}
                </div>
              </div>

              {/* Dark Terminal Live Code Preview */}
              <div className="border border-outline-variant/60 rounded-lg overflow-hidden bg-black/40">
                <div className="bg-surface-container px-3 py-1.5 border-b border-outline-variant/60 flex items-center justify-between">
                  <span className="text-[9px] text-green-400 font-mono font-bold tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    chemistry_analyzer_output.json
                  </span>
                  <span className="text-[7px] text-clinical-400 font-mono font-bold">LIVE PREVIEW</span>
                </div>
                <pre className="p-3 text-[9px] font-mono text-green-400 overflow-x-auto max-h-40 leading-relaxed scrollbar-thin">
                  {jsonPayload}
                </pre>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setActiveReqId(null)}
                  className="btn-secondary py-1.5 px-3 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary py-1.5 px-4 text-xs font-bold bg-gradient-to-r from-secondary to-primary hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                >
                  Publish & Verify
                </button>
              </div>
            </form>
          </div>
        )}

      </div>

      {printLabelReq && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in print-hidden">
          <div className="glass-panel max-w-md w-full p-6 border-primary/20 shadow-2xl space-y-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-primary" />
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">label</span>
                Specimen Label Printer
              </h3>
              <button
                onClick={() => setPrintLabelReq(null)}
                className="text-clinical-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* HIGH FIDELITY SPECIMEN CARD PRINT LAYER */}
            <div id="specimen-label-print-area" className="p-4 bg-white text-black rounded-lg border-2 border-dashed border-black/30 font-sans shadow-inner space-y-4">
              <div className="flex justify-between items-center border-b border-black/20 pb-2">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-black">Mediflow Clinical Labs</div>
                <div className="text-[8px] bg-black text-white px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wide">Specimen Card</div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
                <div>
                  <span className="text-[8px] text-black/50 block font-bold uppercase">Patient Name</span>
                  <strong className="text-black font-extrabold text-xs">{printLabelReq.patientName}</strong>
                </div>
                <div>
                  <span className="text-[8px] text-black/50 block font-bold uppercase">ABHA ID</span>
                  <strong className="text-black font-mono font-bold">{api.getPatients().find(p => p.id === printLabelReq.patientId)?.abhaId || '12-3456-7890-1234'}</strong>
                </div>
                <div>
                  <span className="text-[8px] text-black/50 block font-bold uppercase">Biomarker Test</span>
                  <strong className="text-black font-bold">{printLabelReq.testName}</strong>
                </div>
                <div>
                  <span className="text-[8px] text-black/50 block font-bold uppercase">LOINC Reference</span>
                  <strong className="text-black font-mono font-bold">{printLabelReq.testCode}</strong>
                </div>
                <div>
                  <span className="text-[8px] text-black/50 block font-bold uppercase">Assigned Pathologist</span>
                  <strong className="text-black font-bold">Lalit Prasad (Tech-ID)</strong>
                </div>
                <div>
                  <span className="text-[8px] text-black/50 block font-bold uppercase">Drawn Timestamp</span>
                  <strong className="text-black font-mono font-bold">{new Date(printLabelReq.createdAt).toLocaleString()}</strong>
                </div>
              </div>

              {/* Barcode Render */}
              <div className="border-t border-black/20 pt-3 text-center space-y-1.5">
                <div className="bg-black p-2 rounded flex justify-center items-center">
                  <svg viewBox="0 0 100 30" className="w-full h-10" preserveAspectRatio="none">
                    <rect x="5" y="2" width="2" height="26" fill="#ffffff" />
                    <rect x="9" y="2" width="1" height="26" fill="#ffffff" />
                    <rect x="12" y="2" width="3" height="26" fill="#ffffff" />
                    <rect x="17" y="2" width="2" height="26" fill="#ffffff" />
                    <rect x="21" y="2" width="4" height="26" fill="#ffffff" />
                    <rect x="27" y="2" width="1" height="26" fill="#ffffff" />
                    <rect x="30" y="2" width="2" height="26" fill="#ffffff" />
                    <rect x="34" y="2" width="3" height="26" fill="#ffffff" />
                    <rect x="39" y="2" width="1" height="26" fill="#ffffff" />
                    <rect x="42" y="2" width="4" height="26" fill="#ffffff" />
                    <rect x="48" y="2" width="2" height="26" fill="#ffffff" />
                    <rect x="52" y="2" width="3" height="26" fill="#ffffff" />
                    <rect x="57" y="2" width="1" height="26" fill="#ffffff" />
                    <rect x="60" y="2" width="2" height="26" fill="#ffffff" />
                    <rect x="64" y="2" width="4" height="26" fill="#ffffff" />
                    <rect x="70" y="2" width="1" height="26" fill="#ffffff" />
                    <rect x="73" y="2" width="3" height="26" fill="#ffffff" />
                    <rect x="78" y="2" width="2" height="26" fill="#ffffff" />
                    <rect x="82" y="2" width="4" height="26" fill="#ffffff" />
                    <rect x="88" y="2" width="1" height="26" fill="#ffffff" />
                    <rect x="91" y="2" width="3" height="26" fill="#ffffff" />
                  </svg>
                </div>
                <div className="text-[10px] font-mono tracking-widest font-extrabold text-black">
                  *{printLabelReq.barcode}*
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPrintLabelReq(null)}
                className="px-4 py-2 rounded-lg bg-surface-container border border-outline-variant hover:bg-surface-container-high text-xs text-clinical-300 font-semibold"
              >
                Close Printer
              </button>
              <button
                type="button"
                onClick={() => {
                  const printContent = document.getElementById('specimen-label-print-area')?.innerHTML;
                  if (printContent) {
                    const printWindow = window.open('', '', 'height=500,width=500');
                    if (printWindow) {
                      printWindow.document.write('<html><head><title>Print Specimen Label</title>');
                      printWindow.document.write('<style>body{font-family:sans-serif;padding:20px;color:black;background:white;} #specimen-label-print-area{width:350px;border:2px dashed black;padding:15px;margin:auto;} svg{filter:invert(0)!important;} rect{fill:black!important;}</style>');
                      printWindow.document.write('</head><body>');
                      printWindow.document.write('<div id="specimen-label-print-area">');
                      printWindow.document.write(printContent);
                      printWindow.document.write('</div>');
                      printWindow.document.write('</body></html>');
                      printWindow.document.close();
                      printWindow.focus();
                      setTimeout(() => {
                        printWindow.print();
                        printWindow.close();
                      }, 500);
                    }
                  }
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-black bg-secondary hover:bg-secondary/80 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm font-bold">print</span>
                Print Label Card
              </button>
            </div>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="glass-panel max-w-sm w-full p-8 border-primary/20 shadow-2xl text-center space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-primary to-secondary animate-pulse" />
            
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-primary/10 border-t-primary animate-spin" />
              <div className="absolute inset-2 rounded-full border-4 border-secondary/10 border-b-secondary animate-spin [animation-direction:reverse] [animation-duration:1.5s]" />
              <div className="absolute inset-4 rounded-full bg-clinical-950 flex items-center justify-center text-primary animate-pulse">
                <span className="material-symbols-outlined text-2xl">science</span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-white font-bold text-base">Pathology Analyzer Active</h3>
              <p className="text-xs text-clinical-400 font-mono animate-pulse tracking-wide uppercase">
                CALIBRATING LOINC-{activeReq?.testCode || 'SPECIMEN'}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-black/40 border border-outline-variant/40 font-mono text-[9px] text-emerald-400 text-left space-y-1 max-h-24 overflow-y-auto animate-fade-in">
              <div>&gt; Specimen Barcode verified: {activeReq?.barcode}</div>
              <div>&gt; Injecting chemical reagent...</div>
              <div>&gt; Reading optical absorption values...</div>
              <div className="animate-pulse">&gt; Compiling biomarker quantitative report...</div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
