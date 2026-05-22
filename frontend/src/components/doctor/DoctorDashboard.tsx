import React, { useState, useEffect } from 'react';
import { api, MASTER_TEST_CATALOG, HISTORICAL_BIOMARKERS } from '../../services/api';
import type { Patient, DiagnosticTest, MedicationRequest } from '../../types';
import { 
  Stethoscope, 
  Activity, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';

export const DoctorDashboard: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  
  // Encounter Form state
  const [notes, setNotes] = useState('');
  const [medications, setMedications] = useState<Omit<MedicationRequest, 'id'>[]>([]);
  const [selectedTests, setSelectedTests] = useState<DiagnosticTest[]>([]);
  
  // Single medication builder inputs
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medFreq, setMedFreq] = useState('1-0-1');
  const [medDur, setMedDur] = useState('5 Days');

  // CDSS Biomarker metrics
  const [cdssAnomalies, setCdssAnomalies] = useState<string[]>([]);

  useEffect(() => {
    // Standard loading
    const registered = api.getPatients();
    setPatients(registered);
    if (registered.length > 0) {
      setSelectedPatient(registered[0]);
    }
  }, []);

  useEffect(() => {
    if (!selectedPatient) return;
    
    // Evaluate clinical risks for CDSS anomalies (HbA1c & Creatinine)
    const history = (HISTORICAL_BIOMARKERS as any)[selectedPatient.id];
    const anomalies: string[] = [];
    
    if (history && history.length > 0) {
      const latest = history[history.length - 1];
      const previous = history[history.length - 2];
      
      if (latest.creatinine > 1.2) {
        anomalies.push(`Warning: Serum Creatinine is ${latest.creatinine} mg/dL (Abnormal > 1.2). Significant upward trend from ${previous.creatinine} mg/dL observed over 30 days.`);
      }
      if (latest.HbA1c > 6.5) {
        anomalies.push(`Alert: HbA1c is ${latest.HbA1c}% (Diabetic threshold > 6.5%). Although HbA1c has improved from ${previous.HbA1c}%, glycemic levels remain elevated.`);
      }
    }
    
    setCdssAnomalies(anomalies);
  }, [selectedPatient]);

  const handleAddMedication = () => {
    if (!medName || !medDosage) return;
    setMedications([
      ...medications,
      { medicineName: medName, dosage: medDosage, frequency: medFreq, duration: medDur }
    ]);
    setMedName('');
    setMedDosage('');
  };

  const handleRemoveMedication = (idx: number) => {
    setMedications(medications.filter((_, i) => i !== idx));
  };

  const handleToggleTest = (test: DiagnosticTest) => {
    const exists = selectedTests.find(t => t.loincCode === test.loincCode);
    if (exists) {
      setSelectedTests(selectedTests.filter(t => t.loincCode !== test.loincCode));
    } else {
      setSelectedTests([...selectedTests, test]);
    }
  };

  const handleSaveEncounter = () => {
    if (!selectedPatient) return;

    api.createEncounter({
      patientId: selectedPatient.id,
      patientName: selectedPatient.name,
      doctorId: 'doc-1',
      clinicalNotes: notes,
      medications: medications.map((m, idx) => ({ ...m, id: `med-${idx}` })),
      diagnosticTests: selectedTests
    });

    // Reset Form
    setNotes('');
    setMedications([]);
    setSelectedTests([]);
    alert(`Encounter successfully saved! e-Prescription (e-Rx) routed to Pharmacy & Lab requisitions generated.`);
  };

  const activeHistory = selectedPatient ? (HISTORICAL_BIOMARKERS as any)[selectedPatient.id] : null;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* LEFT COLUMN: Patient queue, CDSS Analyzer */}
      <div className="lg:col-span-4 space-y-8">
        
        {/* Patient Consultation Queue */}
        <div className="glass-panel p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary-500 animate-pulse-subtle" /> Consultation Queue
          </h2>
          <div className="space-y-3">
            {patients.map(p => {
              const isSelected = selectedPatient?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPatient(p)}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-300 ${
                    isSelected 
                      ? 'bg-primary-950/40 border-primary-500 shadow-md' 
                      : 'bg-clinical-900/40 border-clinical-800 hover:border-clinical-700'
                  }`}
                >
                  <div className="font-bold text-sm text-white">{p.name}</div>
                  <div className="text-xs text-clinical-400 mt-1 flex justify-between items-center">
                    <span>{p.gender}, {p.age} years</span>
                    {p.abhaId && <span className="bg-clinical-950 text-clinical-400 px-2 py-0.5 rounded border border-clinical-800 text-[10px]">ABHA</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Clinical Decision Support System (CDSS) */}
        {selectedPatient && (
          <div className="glass-panel border-primary-500/20 p-6">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary-500" /> CDSS Lab Analyzer
            </h2>
            <p className="text-xs text-clinical-400 mb-6">
              AI comparative biomarker metrics tracking and warning engine.
            </p>

            {activeHistory ? (
              <div className="space-y-6">
                
                {/* SVG Visual graph charts */}
                <div className="bg-clinical-950/80 border border-clinical-800 p-4 rounded-xl">
                  <h4 className="font-bold text-xs text-clinical-300 uppercase tracking-wider mb-4">Biomarker Trajectory (3 Months)</h4>
                  
                  {/* HbA1c SVG representation */}
                  <div className="mb-4">
                    <div className="flex justify-between text-[10px] text-clinical-400 mb-1">
                      <span>HbA1c (%)</span>
                      <span className="font-semibold text-emerald-400">Trend: Downward (6.9%)</span>
                    </div>
                    <div className="h-16 relative border-l border-b border-clinical-800">
                      <svg className="w-full h-full" viewBox="0 0 100 40">
                        <polyline
                          fill="none"
                          stroke="#6366f1"
                          strokeWidth="2"
                          points="10,32 50,25 90,16"
                        />
                        {/* Data dots */}
                        <circle cx="10" cy="32" r="2.5" fill="#6366f1" />
                        <circle cx="50" cy="25" r="2.5" fill="#6366f1" />
                        <circle cx="90" cy="16" r="2.5" fill="#14b8a6" />
                      </svg>
                    </div>
                  </div>

                  {/* Creatinine SVG representation */}
                  <div>
                    <div className="flex justify-between text-[10px] text-clinical-400 mb-1">
                      <span>Serum Creatinine (mg/dL)</span>
                      <span className="font-semibold text-rose-500">Trend: Rising (1.4)</span>
                    </div>
                    <div className="h-16 relative border-l border-b border-clinical-800">
                      <svg className="w-full h-full" viewBox="0 0 100 40">
                        <polyline
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="2"
                          points="10,12 50,20 90,32"
                        />
                        {/* Data dots */}
                        <circle cx="10" cy="12" r="2.5" fill="#ef4444" />
                        <circle cx="50" cy="20" r="2.5" fill="#ef4444" />
                        <circle cx="90" cy="32" r="2.5" fill="#ef4444" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Passive Warnings Panel */}
                <div className="space-y-3">
                  {cdssAnomalies.map((anomaly, idx) => (
                    <div key={idx} className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex gap-3 leading-relaxed">
                      <AlertTriangle className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" />
                      <span>{anomaly}</span>
                    </div>
                  ))}
                </div>

                <div className="text-[10px] text-clinical-500 italic bg-clinical-900 border border-clinical-800 p-2.5 rounded-lg">
                  * CDSS alerts are passive recommendations based on LOINC references. Final prescribing decision lies with the registered clinician.
                </div>

              </div>
            ) : (
              <div className="text-center py-8 text-clinical-500 text-sm">
                No historical diagnostic biomarkers available for this profile.
              </div>
            )}
          </div>
        )}

      </div>

      {/* RIGHT COLUMN: Consultation Sheet, e-Rx Form */}
      {selectedPatient && (
        <div className="lg:col-span-8 glass-panel p-6 space-y-6">
          <div className="border-b border-clinical-800 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary-500" /> Electronic Consultation Record
              </h2>
              <p className="text-xs text-clinical-400 mt-1">
                Selected: <strong className="text-white">{selectedPatient.name}</strong> ({selectedPatient.age}y, {selectedPatient.gender})
              </p>
            </div>
            {selectedPatient.abhaId && (
              <span className="text-xs bg-primary-500/10 text-primary-400 border border-primary-500/30 px-3 py-1 rounded-full font-semibold">
                ABHA Verified
              </span>
            )}
          </div>

          {/* Clinical Notes */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-clinical-400 uppercase">Consultation & Clinical Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Presenting complaints, systemic examination notes, and diagnosis..."
              rows={4}
              className="w-full input-field resize-none"
            />
          </div>

          {/* Diagnostic Requisitions Section */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-clinical-400 uppercase">Diagnostic Panel Requisition (LOINC-Coded)</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {MASTER_TEST_CATALOG.map(test => {
                const isChecked = selectedTests.some(t => t.loincCode === test.loincCode);
                return (
                  <button
                    key={test.loincCode}
                    onClick={() => handleToggleTest(test)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left text-xs transition-all duration-300 ${
                      isChecked
                        ? 'bg-primary-950/30 border-primary-500 text-white'
                        : 'bg-clinical-950/80 border-clinical-800 text-clinical-400 hover:border-clinical-700'
                    }`}
                  >
                    <div>
                      <span className="font-bold block">{test.name}</span>
                      <span className="text-[10px] text-clinical-500 uppercase mt-0.5 block">LOINC: {test.loincCode}</span>
                    </div>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                      isChecked ? 'bg-primary-500 border-primary-500 text-white' : 'border-clinical-700'
                    }`}>
                      {isChecked && <CheckCircle2 className="h-3 w-3" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Medication e-Prescription (e-Rx) Builder */}
          <div className="space-y-4 pt-4 border-t border-clinical-800">
            <label className="block text-xs font-semibold text-clinical-400 uppercase">e-Prescription Builder (FHIR R4 MedicationRequest Output)</label>
            
            {/* Med Single entry row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-clinical-950/60 p-4 rounded-2xl border border-clinical-800/80">
              <div>
                <label className="block text-[10px] text-clinical-400 mb-1.5 uppercase">Generic / Brand Name</label>
                <input
                  type="text"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  placeholder="Metformin 500mg"
                  className="w-full input-field py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-clinical-400 mb-1.5 uppercase">Dosage</label>
                <input
                  type="text"
                  value={medDosage}
                  onChange={(e) => setMedDosage(e.target.value)}
                  placeholder="1 Tab"
                  className="w-full input-field py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-clinical-400 mb-1.5 uppercase">Frequency</label>
                <select
                  value={medFreq}
                  onChange={(e) => setMedFreq(e.target.value)}
                  className="w-full input-field py-2 bg-clinical-950 text-xs"
                >
                  <option value="1-0-1">1-0-1 (Morning & Night)</option>
                  <option value="1-0-0">1-0-0 (Morning Only)</option>
                  <option value="0-1-0">0-1-0 (Afternoon Only)</option>
                  <option value="0-0-1">0-0-1 (Night Only)</option>
                  <option value="1-1-1">1-1-1 (Thrice Daily)</option>
                </select>
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] text-clinical-400 mb-1.5 uppercase">Duration</label>
                  <input
                    type="text"
                    value={medDur}
                    onChange={(e) => setMedDur(e.target.value)}
                    placeholder="10 Days"
                    className="w-full input-field py-2 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddMedication}
                  className="btn-primary py-2 px-3 hover:scale-105 active:scale-95 text-xs rounded-xl"
                >
                  <Plus className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            {/* Prescribed List */}
            {medications.length > 0 && (
              <div className="border border-clinical-800 rounded-2xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-clinical-900 text-clinical-400 border-b border-clinical-800 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Medicine Name</th>
                      <th className="p-3">Dosage</th>
                      <th className="p-3">Frequency</th>
                      <th className="p-3">Duration</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-clinical-800/80 bg-clinical-950/20">
                    {medications.map((med, idx) => (
                      <tr key={idx} className="hover:bg-clinical-900/20">
                        <td className="p-3 text-white font-semibold">{med.medicineName}</td>
                        <td className="p-3 text-clinical-300">{med.dosage}</td>
                        <td className="p-3 text-clinical-300">{med.frequency}</td>
                        <td className="p-3 text-clinical-300">{med.duration}</td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveMedication(idx)}
                            className="p-1.5 bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="flex justify-end pt-4 border-t border-clinical-800">
            <button
              onClick={handleSaveEncounter}
              className="btn-primary px-8 flex items-center gap-2"
            >
              <CheckCircle2 className="h-5 w-5" /> Submit Encounter & Route Mappings
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
