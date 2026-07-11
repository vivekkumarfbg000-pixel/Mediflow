import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { supabase } from '../../lib/supabaseClient';
import { useSpecialization } from '../../context/SpecializationContext';
import { useClinic } from '../../context/ClinicContext';
import { OphthalmicRefractionGrid } from './OphthalmicRefractionGrid';
import { BiometryWorksheet } from './BiometryWorksheet';
import { 
  VISUAL_ACUITY_OPTIONS, 
  EMPTY_REFRACTION_RX, 
  EMPTY_BIOMETRY, 
  type RefractionRx, 
  type BiometryData 
} from '../../types/ophthalmic';
import type { Patient, PatientVitals } from '../../types';
import { 
  Activity, 
  Smartphone, 
  CheckCircle2, 
  Search, 
  Eye, 
  Clock, 
  ChevronRight,
  TrendingUp,
  Inbox
} from 'lucide-react';

export const RefractionDashboard: React.FC = () => {
  const { isOphthalmology, nomenclature } = useSpecialization();
  const { activePod, activeEntity } = useClinic();

  // Registry state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Workspace Patient
  const [refractionPatient, setRefractionPatient] = useState<Patient | null>(null);

  // Vitals & Diagnostics States
  const [vaOD, setVaOD] = useState('6/6');
  const [vaOS, setVaOS] = useState('6/6');
  const [vaAidedOD, setVaAidedOD] = useState('');
  const [vaAidedOS, setVaAidedOS] = useState('');
  const [iopOD, setIopOD] = useState('');
  const [iopOS, setIopOS] = useState('');
  const [arODSph, setArODSph] = useState('');
  const [arODCyl, setArODCyl] = useState('');
  const [arODAxis, setArODAxis] = useState('');
  const [arOSSph, setArOSSph] = useState('');
  const [arOSCyl, setArOSCyl] = useState('');
  const [arOSAxis, setArOSAxis] = useState('');
  const [subjectiveRx, setSubjectiveRx] = useState<RefractionRx>(EMPTY_REFRACTION_RX);
  const [biometryRx, setBiometryRx] = useState<BiometryData>(EMPTY_BIOMETRY);
  const [dilationDrops, setDilationDrops] = useState('Tropicamide 1%');

  // Load and subscribe to API changes
  const syncData = () => {
    setPatients(api.getPatients());
  };

  useEffect(() => {
    syncData();
    return api.subscribe(syncData);
  }, []);

  // Filter queue for Refractionist
  const filteredPatients = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    
    // In Ophthalmology, refraction queue contains patients who need or are undergoing refraction,
    // or who have completed it (awaiting consultation).
    const list = patients.filter(p => 
      p.queueStatus === 'awaiting_refraction' || 
      p.queueStatus === 'refraction_in_progress' || 
      p.queueStatus === 'awaiting_consultation' || 
      p.queueStatus === 'in_consultation'
    );

    if (!query) return list;
    return list.filter(p => 
      p.name.toLowerCase().includes(query) || 
      (p.tokenNumber && p.tokenNumber.toLowerCase().includes(query)) ||
      p.phone.includes(query)
    );
  }, [patients, searchQuery]);

  // Queue Metrics
  const metrics = useMemo(() => {
    const awaiting = patients.filter(p => p.queueStatus === 'awaiting_refraction').length;
    const inProgress = patients.filter(p => p.queueStatus === 'refraction_in_progress').length;
    const completed = patients.filter(p => p.queueStatus === 'awaiting_consultation' || p.queueStatus === 'in_consultation').length;
    return { awaiting, inProgress, completed };
  }, [patients]);

  const handleStartRefraction = (patient: Patient) => {
    setRefractionPatient(patient);
    
    // Load pre-existing values if available
    const v = patient.vitals;
    setVaOD(v?.visualAcuityOD || '6/6');
    setVaOS(v?.visualAcuityOS || '6/6');
    setVaAidedOD(v?.visualAcuityAidedOD || '');
    setVaAidedOS(v?.visualAcuityAidedOS || '');
    setIopOD(v?.iopOD || '');
    setIopOS(v?.iopOS || '');
    setArODSph(v?.arOD_sph || '');
    setArODCyl(v?.arOD_cyl || '');
    setArODAxis(v?.arOD_axis || '');
    setArOSSph(v?.arOS_sph || '');
    setArOSCyl(v?.arOS_cyl || '');
    setArOSAxis(v?.arOS_axis || '');
    setSubjectiveRx((v?.refractionRx || EMPTY_REFRACTION_RX) as RefractionRx);
    setBiometryRx(v?.biometryRx || EMPTY_BIOMETRY);
    
    // Mark as in-progress if not already consultation
    if (patient.queueStatus === 'awaiting_refraction') {
      api.updatePatientQueueStatus(patient.id, 'refraction_in_progress');
    }
  };

  const handleRecordRefractionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refractionPatient) return;

    const refractionData: Partial<PatientVitals> = {
      visualAcuityOD: vaOD,
      visualAcuityOS: vaOS,
      visualAcuityAidedOD: vaAidedOD || undefined,
      visualAcuityAidedOS: vaAidedOS || undefined,
      iopOD: iopOD || undefined,
      iopOS: iopOS || undefined,
      arOD_sph: arODSph || undefined,
      arOD_cyl: arODCyl || undefined,
      arOD_axis: arODAxis || undefined,
      arOS_sph: arOSSph || undefined,
      arOS_cyl: arOSCyl || undefined,
      arOS_axis: arOSAxis || undefined,
      refractionRx: subjectiveRx,
      biometryRx: biometryRx,
      dilationStatus: refractionPatient.vitals?.dilationStatus || 'not_started',
      dilationStartTime: refractionPatient.vitals?.dilationStartTime,
      dilationDropsUsed: refractionPatient.vitals?.dilationDropsUsed
    };

    api.saveRefractionDiagnostics(refractionPatient.id, refractionData);

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Eye test diagnostics completed for ${refractionPatient.name}! Dispatched to Doctor chamber. 🩺`,
        type: 'success',
        title: 'Refraction Desk Dispatch Successful'
      }
    }));

    // Reset Form & Workspace
    setRefractionPatient(null);
    setVaOD('6/6');
    setVaOS('6/6');
    setVaAidedOD('');
    setVaAidedOS('');
    setIopOD('');
    setIopOS('');
    setArODSph('');
    setArODCyl('');
    setArODAxis('');
    setArOSSph('');
    setArOSCyl('');
    setArOSAxis('');
    setSubjectiveRx(EMPTY_REFRACTION_RX);
    setBiometryRx(EMPTY_BIOMETRY);

    syncData();
  };

  const handleInstillDrops = (patient: Patient) => {
    const updatedVitals = {
      ...(patient.vitals || {
        temperature: '6/6',
        bloodPressure: '6/6',
        pulseRate: '16',
        weight: '',
        recordedAt: new Date().toISOString()
      }),
      dilationStatus: 'instilled' as const,
      dilationStartTime: new Date().toISOString(),
      dilationDropsUsed: dilationDrops
    };
    api.updatePatientVitalsAndToken(patient.id, updatedVitals as any, patient.tokenNumber || 'TK-1');
    syncData();
    
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Instilled ${dilationDrops} in ${patient.name}'s eyes. Timer active. ⏳`,
        type: 'info',
        title: 'Mydriatic Instilled'
      }
    }));
  };

  const handleMarkDilated = (patient: Patient) => {
    const updatedVitals = {
      ...patient.vitals,
      temperature: patient.vitals?.temperature || '6/6',
      bloodPressure: patient.vitals?.bloodPressure || '6/6',
      pulseRate: patient.vitals?.pulseRate || '16',
      weight: patient.vitals?.weight || '',
      recordedAt: patient.vitals?.recordedAt || new Date().toISOString(),
      dilationStatus: 'dilated' as const,
      dilationStartTime: patient.vitals?.dilationStartTime
    };
    api.updatePatientVitalsAndToken(patient.id, updatedVitals as any, patient.tokenNumber || 'TK-1');
    syncData();
    
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `${patient.name} is fully dilated and ready for refraction.`,
        type: 'success',
        title: 'Dilation Complete'
      }
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 bg-white border border-slate-200/80 shadow-sm flex items-center justify-between rounded-2xl">
          <div className="text-left">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Awaiting Refraction</span>
            <span className="text-xl font-extrabold text-indigo-755 mt-1 block">{metrics.awaiting} Patients</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-panel p-4 bg-white border border-slate-200/80 shadow-sm flex items-center justify-between rounded-2xl">
          <div className="text-left">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">In Progress</span>
            <span className="text-xl font-extrabold text-indigo-755 mt-1 block">{metrics.inProgress} Patients</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
            <Activity className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-panel p-4 bg-white border border-slate-200/80 shadow-sm flex items-center justify-between rounded-2xl">
          <div className="text-left">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Done / Active Consult</span>
            <span className="text-xl font-extrabold text-indigo-755 mt-1 block">{metrics.completed} Patients</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-panel p-4 bg-white border border-slate-200/80 shadow-sm flex items-center justify-between rounded-2xl">
          <div className="text-left">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Optometry Hub</span>
            <span className="text-[11px] font-bold text-indigo-650 mt-1 block">Mediflow Refraction Desk</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-500">
            <Eye className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Refractionist Patient Queue */}
        <div className="lg:col-span-4 glass-panel p-5 bg-white border border-slate-200/80 shadow-sm rounded-2xl flex flex-col h-[650px] text-left">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Eye className="h-4.5 w-4.5 text-indigo-550" />
              Refraction Queue (अपवर्तन कतार)
            </h2>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-705 rounded-full">
              {filteredPatients.length} Active
            </span>
          </div>

          {/* Search Queue */}
          <div className="relative mb-3">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name, token or phone..."
              className="w-full bg-slate-50 border border-slate-200 text-[11px] px-8 py-2 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-all outline-none"
            />
          </div>

          {/* Queue List */}
          <div className="space-y-2.5 flex-1 overflow-y-auto pr-0.5">
            {filteredPatients.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12 text-center">
                <Inbox className="h-8 w-8 mb-2 text-slate-300" />
                <span className="text-xs font-medium">No patients in refraction queue</span>
              </div>
            ) : (
              filteredPatients.map(p => {
                const isSelected = refractionPatient?.id === p.id;
                
                return (
                  <div
                    key={p.id}
                    className={`p-3 border rounded-xl flex flex-col gap-2 transition-all cursor-pointer ${
                      isSelected 
                        ? 'border-indigo-500 bg-indigo-50/25 shadow-xs' 
                        : 'border-slate-200/80 hover:bg-slate-50/80 bg-white'
                    }`}
                    onClick={() => handleStartRefraction(p)}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                          {p.name}
                          {p.tokenNumber && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded border border-indigo-200">
                              {p.tokenNumber}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {p.age}y · {p.gender} · {p.phone}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {p.vitals?.dilationStatus === 'dilated' ? (
                          <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded uppercase tracking-wider">👁️ Dilated</span>
                        ) : p.vitals?.dilationStatus === 'instilled' ? (
                          <span className="text-[8px] font-bold text-amber-605 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded uppercase tracking-wider">⏳ Dilating</span>
                        ) : null}
                      </div>
                    </div>

                    {/* Action Panel for row */}
                    <div className="flex gap-1.5 justify-end pt-1 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                      {(!p.vitals?.dilationStatus || p.vitals.dilationStatus === 'not_started') ? (
                        <div className="flex items-center gap-1.5 w-full justify-between">
                          <select
                            value={dilationDrops}
                            onChange={(e) => setDilationDrops(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[9px] text-slate-600 outline-none"
                          >
                            <option value="Tropicamide 1%">Tropicamide 1%</option>
                            <option value="Homotropine 2%">Homotropine 2%</option>
                            <option value="Cyclopentolate 1%">Cyclopentolate 1%</option>
                            <option value="Phenylephrine 5%">Phenylephrine 5%</option>
                          </select>
                          <button
                            onClick={() => handleInstillDrops(p)}
                            className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500 text-amber-700 hover:text-white border border-amber-500/20 rounded font-bold uppercase tracking-wider text-[8px] transition-all cursor-pointer border-0"
                          >
                            💧 Drops
                          </button>
                        </div>
                      ) : p.vitals.dilationStatus === 'instilled' ? (
                        <div className="flex items-center gap-2 w-full justify-between">
                          {p.vitals.dilationStartTime && (
                            <span className="text-[9px] text-slate-500 font-mono">
                              Instilled: {new Date(p.vitals.dilationStartTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          )}
                          <button
                            onClick={() => handleMarkDilated(p)}
                            className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-bold uppercase tracking-wider text-[8px] transition-all cursor-pointer border-0"
                          >
                            👁️ Mark Dilated
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartRefraction(p)}
                          className="w-full text-center px-2 py-1 bg-indigo-500 text-white hover:bg-indigo-600 rounded font-bold uppercase tracking-wider text-[8px] transition-all cursor-pointer border-0"
                        >
                          Perform Refraction
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Diagnostic & Refraction Workspace */}
        <div className="lg:col-span-8 glass-panel p-6 bg-white border border-slate-200/80 shadow-sm rounded-2xl h-[650px] overflow-y-auto text-left relative">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-violet-500" />
          
          {refractionPatient ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-905 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-indigo-650 text-base font-bold">visibility</span>
                    Refraction & Eye Diagnostics (अपवर्तन जांच)
                  </h2>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Recording ophthalmic metrics for: <strong>{refractionPatient.name}</strong></p>
                </div>
                <button
                  type="button"
                  onClick={() => setRefractionPatient(null)}
                  className="text-slate-400 hover:text-slate-650 text-xs font-semibold cursor-pointer bg-transparent border-0"
                >
                  Close Workspace
                </button>
              </div>

              <form onSubmit={handleRecordRefractionSubmit} className="space-y-5">
                {/* Visual Acuity */}
                <div className="space-y-3 bg-slate-50 p-4 border border-slate-200 rounded-2xl">
                  <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-indigo-500 text-xs font-black">visibility</span>
                    Visual Acuity (दृष्टि तीक्ष्णता)
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Unaided Right Eye (OD)</label>
                      <select
                        value={vaOD}
                        onChange={(e) => setVaOD(e.target.value)}
                        className="w-full bg-white border border-slate-250 focus:border-indigo-400 rounded-lg py-1.5 px-2 text-xs text-slate-850 cursor-pointer"
                      >
                        {VISUAL_ACUITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Unaided Left Eye (OS)</label>
                      <select
                        value={vaOS}
                        onChange={(e) => setVaOS(e.target.value)}
                        className="w-full bg-white border border-slate-250 focus:border-indigo-400 rounded-lg py-1.5 px-2 text-xs text-slate-850 cursor-pointer"
                      >
                        {VISUAL_ACUITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Aided / Glasses Right Eye (OD)</label>
                      <select
                        value={vaAidedOD}
                        onChange={(e) => setVaAidedOD(e.target.value)}
                        className="w-full bg-white border border-slate-250 focus:border-indigo-400 rounded-lg py-1.5 px-2 text-xs text-slate-850 cursor-pointer"
                      >
                        <option value="">No Spectacles</option>
                        {VISUAL_ACUITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Aided / Glasses Left Eye (OS)</label>
                      <select
                        value={vaAidedOS}
                        onChange={(e) => setVaAidedOS(e.target.value)}
                        className="w-full bg-white border border-slate-250 focus:border-indigo-400 rounded-lg py-1.5 px-2 text-xs text-slate-850 cursor-pointer"
                      >
                        <option value="">No Spectacles</option>
                        {VISUAL_ACUITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Autorefraction */}
                <div className="space-y-3 bg-slate-50 p-4 border border-slate-200 rounded-2xl">
                  <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-indigo-500 text-xs font-black">computer</span>
                    Autorefractometer (AR) Readings (कंप्यूटर जांच)
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-6 pt-1">
                    <div className="space-y-2">
                      <span className="text-[9px] font-bold text-indigo-650 block uppercase tracking-wider">OD (Right Eye)</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        <input type="text" placeholder="SPH" value={arODSph} onChange={e=>setArODSph(e.target.value)} className="w-full text-center bg-white border border-slate-250 rounded py-1.5 px-1.5 text-xs text-slate-805 font-mono focus:border-indigo-400 outline-none" />
                        <input type="text" placeholder="CYL" value={arODCyl} onChange={e=>setArODCyl(e.target.value)} className="w-full text-center bg-white border border-slate-250 rounded py-1.5 px-1.5 text-xs text-slate-805 font-mono focus:border-indigo-400 outline-none" />
                        <input type="text" placeholder="AXIS" value={arODAxis} onChange={e=>setArODAxis(e.target.value)} className="w-full text-center bg-white border border-slate-250 rounded py-1.5 px-1.5 text-xs text-slate-805 font-mono focus:border-indigo-400 outline-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <span className="text-[9px] font-bold text-indigo-650 block uppercase tracking-wider">OS (Left Eye)</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        <input type="text" placeholder="SPH" value={arOSSph} onChange={e=>setArOSSph(e.target.value)} className="w-full text-center bg-white border border-slate-250 rounded py-1.5 px-1.5 text-xs text-slate-805 font-mono focus:border-indigo-400 outline-none" />
                        <input type="text" placeholder="CYL" value={arOSCyl} onChange={e=>setArOSCyl(e.target.value)} className="w-full text-center bg-white border border-slate-250 rounded py-1.5 px-1.5 text-xs text-slate-805 font-mono focus:border-indigo-400 outline-none" />
                        <input type="text" placeholder="AXIS" value={arOSAxis} onChange={e=>setArOSAxis(e.target.value)} className="w-full text-center bg-white border border-slate-250 rounded py-1.5 px-1.5 text-xs text-slate-805 font-mono focus:border-indigo-400 outline-none" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subjective Spectacle Power */}
                <div className="space-y-3 bg-slate-50 p-4 border border-slate-200 rounded-2xl">
                  <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-indigo-500 text-xs font-black">eyeglasses</span>
                    Subjective Spec Trial (चश्मा फाइनल पावर)
                  </h3>
                  <OphthalmicRefractionGrid value={subjectiveRx} onChange={setSubjectiveRx} />
                </div>

                {/* Intraocular Pressure */}
                <div className="space-y-3 bg-slate-50 p-4 border border-slate-200 rounded-2xl">
                  <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-indigo-500 text-xs font-black">speed</span>
                    Tonometry / Intraocular Pressure (IOP)
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">IOP - Right Eye (OD - mmHg)</label>
                      <input
                        type="text"
                        placeholder="e.g. 15"
                        value={iopOD}
                        onChange={(e) => setIopOD(e.target.value)}
                        className="w-full bg-white border border-slate-250 focus:border-indigo-400 rounded-lg py-1.5 px-3 text-xs text-slate-850 font-mono outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">IOP - Left Eye (OS - mmHg)</label>
                      <input
                        type="text"
                        placeholder="e.g. 16"
                        value={iopOS}
                        onChange={(e) => setIopOS(e.target.value)}
                        className="w-full bg-white border border-slate-250 focus:border-indigo-400 rounded-lg py-1.5 px-3 text-xs text-slate-850 font-mono outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Cataract Biometry */}
                <div className="space-y-3">
                  <BiometryWorksheet value={biometryRx} onChange={setBiometryRx} />
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-650 hover:bg-indigo-700 text-white font-black tracking-wider uppercase border-0 rounded-xl text-xs cursor-pointer transition-all shadow-md shadow-indigo-600/10 active:scale-[0.98] text-white-force"
                >
                  Dispatch Refraction Report & Route to Doctor chamber 🩺
                </button>
              </form>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12 text-center">
              <Eye className="h-10 w-10 text-indigo-400 mx-auto mb-3 animate-pulse" />
              <p className="text-xs font-semibold text-slate-700">Select an active patient from the Refraction Queue to perform eye tests.</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-xs">You can instill dilation drops, mark dilation complete, and record Visual Acuity, AR, Spectacle Power, Tonometry, and Biometry.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
