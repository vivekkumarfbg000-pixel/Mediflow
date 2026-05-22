import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { ReagentStock } from '../../services/api';
import type { LabRequisition } from '../../types';


export const LabDashboard: React.FC = () => {
  const [requisitions, setRequisitions] = useState<LabRequisition[]>([]);
  const [reagents, setReagents] = useState<ReagentStock[]>([]);
  
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

  const handleCollectSample = React.useCallback((id: string) => {
    api.collectLabSample(id);
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: 'Specimen sample collected and barcoded. Routing to Analyzer.',
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

    api.submitLabResult(activeReqId, jsonPayload);
    
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Diagnostic report verified and published. LOINC: ${activeReq?.testCode || 'N/A'}`,
        type: 'success',
        title: 'Report Published'
      }
    }));
    
    setActiveReqId(null);
    setGenericVal('');
    setGenericUnit('');
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
                  {pendingList.map(req => (
                    <div key={req.id} className="p-5 bg-surface-container rounded-xl border border-outline-variant flex flex-col justify-between gap-4 hover:border-outline/50 transition-all duration-300">
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
                        onClick={() => handleCollectSample(req.id)}
                        className="btn-primary py-2 text-xs flex items-center justify-center gap-2 active:scale-95 transition-all w-full font-bold"
                      >
                        <span className="material-symbols-outlined text-sm font-bold">print</span>
                        Print Barcode & Collect Sample
                      </button>
                    </div>
                  ))}
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
                  {collectedList.map(req => (
                    <div key={req.id} className="p-5 bg-surface-container rounded-xl border border-outline-variant flex flex-col justify-between gap-4 hover:border-outline/50 transition-all duration-300">
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
                  ))}
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
        <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary to-secondary opacity-50" />
          <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">database</span>
            Reagent Chemical Ledger
          </h2>
          <p className="text-[11px] text-clinical-400 mb-5 leading-relaxed">
            Real-time analyzer chemical stock tracking with auto-deduction.
          </p>

          <div className="space-y-4">
            {reagents.map((reag, idx) => {
              const percentage = (reag.stockVolume / 1000) * 100;
              const isLow = reag.stockVolume < 100;
              return (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-clinical-300">{reag.reagentName}</span>
                    <span className={`font-mono text-xs ${isLow ? 'text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded' : 'text-clinical-300'}`}>
                      {reag.stockVolume} {reag.unit}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-surface-container-lowest rounded-full overflow-hidden border border-outline-variant p-[1px]">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isLow ? 'bg-rose-500' : 'bg-gradient-to-r from-primary to-secondary'
                      }`}
                      style={{ width: `${Math.min(100, percentage)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex items-start gap-2 bg-primary/5 border border-primary/10 p-3 rounded-lg text-[10px] text-primary leading-relaxed">
            <span className="material-symbols-outlined text-sm mt-0.5 flex-shrink-0">info</span>
            <span>Automatic Reagent Deduction Trigger <code>on_lab_test_completed</code> is active on the database broker. Reagent stocks deduct seamlessly upon submission.</span>
          </div>
        </div>

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
    </div>
  );
};
