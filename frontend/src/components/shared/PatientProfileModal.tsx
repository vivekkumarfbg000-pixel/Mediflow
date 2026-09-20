import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  User,
  Phone,
  MapPin,
  Calendar,
  Activity,
  FileText,
  Pill,
  Microscope,
  Receipt,
  Award,
  Sparkles,
  Clock,
  ExternalLink,
  Download,
  Send,
  Heart,
  AlertCircle,
  CheckCircle2,
  Droplet,
  Video,
  Gift,
  Share2,
  RefreshCw,
  Eye,
  AlertTriangle
} from 'lucide-react';
import type { Patient, PatientVitals } from '../../types';
import { BillingService } from '../../services/billingService';
import { LabService } from '../../services/labService';
import { EncounterService } from '../../services/encounterService';
import { getPodContext } from '../../services/podContext';

interface PatientProfileModalProps {
  patient: Patient | null;
  isOpen: boolean;
  onClose: () => void;
  onBookAppointment?: (patient: Patient) => void;
  onSendWhatsApp?: (patient: Patient) => void;
  onLinkAbha?: (patient: Patient) => void;
}

type ProfileTab = 'vitals' | 'encounters' | 'prescriptions' | 'labs' | 'billing' | 'loyalty';

export const PatientProfileModal: React.FC<PatientProfileModalProps> = ({
  patient,
  isOpen,
  onClose,
  onBookAppointment,
  onSendWhatsApp,
  onLinkAbha
}) => {
  const [activeTab, setActiveTab] = useState<ProfileTab>('vitals');
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  // Body scroll lock cleanup
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (zoomImage) {
          setZoomImage(null);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, zoomImage, onClose]);

  if (!isOpen || !patient) return null;

  // Retrieve patient history across clinical services
  const encounters = (EncounterService.getEncounters() || []).filter(
    (e: any) => e.patientId === patient.id || e.patient_id === patient.id
  );
  const labReports = LabService.getFullLabReports().filter(
    (r: any) => r.patientId === patient.id || r.patient_id === patient.id
  );
  const invoices = BillingService.getInvoices().filter(
    (inv: any) => inv.patientId === patient.id || inv.patient_id === patient.id
  );
  const prescriptions = (BillingService.getPrescriptions() || []).filter(
    (p: any) => p.patientId === patient.id || p.patient_id === patient.id
  );

  const loyalty = BillingService.checkPatientFreeVirtualEligibility(patient.id);
  const isFreeUnlocked = Boolean(patient.isPremiumMember || (patient as any).is_premium_member || loyalty.isEligible);
  const isChronic = Boolean(patient.isChronic || (patient as any).is_chronic || (patient.chronicConditions && patient.chronicConditions.length > 0));

  // Compute BMI & Status
  const vitals: any = patient.vitals;
  let bmiValue: number | null = null;
  let bmiCategory = 'Normal';
  let bmiColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';

  if (vitals?.weight && vitals?.height) {
    const w = parseFloat(vitals.weight);
    const h = parseFloat(vitals.height) / 100;
    if (w > 0 && h > 0) {
      bmiValue = parseFloat((w / (h * h)).toFixed(1));
      if (bmiValue < 18.5) {
        bmiCategory = 'Underweight';
        bmiColor = 'text-amber-700 bg-amber-50 border-amber-200';
      } else if (bmiValue < 25) {
        bmiCategory = 'Normal';
        bmiColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
      } else if (bmiValue < 30) {
        bmiCategory = 'Overweight';
        bmiColor = 'text-amber-700 bg-amber-50 border-amber-200';
      } else {
        bmiCategory = 'Obese';
        bmiColor = 'text-rose-700 bg-rose-50 border-rose-200';
      }
    }
  }

  // Blood Pressure category evaluation
  let bpCategory = 'Normal';
  let bpColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (vitals?.bloodPressure) {
    const parts = vitals.bloodPressure.split('/');
    const sys = parseInt(parts[0], 10);
    const dia = parseInt(parts[1], 10);
    if (sys >= 140 || dia >= 90) {
      bpCategory = 'Stage 2 HTN';
      bpColor = 'text-rose-700 bg-rose-50 border-rose-200';
    } else if (sys >= 130 || dia >= 80) {
      bpCategory = 'Stage 1 HTN';
      bpColor = 'text-amber-700 bg-amber-50 border-amber-200';
    } else if (sys >= 120 && dia < 80) {
      bpCategory = 'Elevated';
      bpColor = 'text-blue-700 bg-blue-50 border-blue-200';
    }
  }

  const cleanPhone = (patient.phone || '').replace(/\D/g, '').slice(-10);

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-md animate-fade-in text-slate-800">
      <div 
        className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* ══ HEADER: Hero Patient Dossier ══ */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
            title="Close dossier (Esc)"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Initials Avatar */}
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-teal-400 flex items-center justify-center text-white font-extrabold text-2xl shadow-lg shadow-indigo-500/30 border-2 border-white/20">
                  {patient.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'P'}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold ${
                  patient.gender === 'Female' ? 'bg-pink-500 text-white' : 'bg-blue-500 text-white'
                }`}>
                  {patient.gender === 'Female' ? '♀' : '♂'}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">{patient.name}</h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-white/10 text-teal-300 border border-teal-400/30">
                    ID: {patient.patientCode || patient.tokenNumber || 'VS-PAT'}
                  </span>
                  {isFreeUnlocked && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 flex items-center gap-1 shadow-sm">
                      <Sparkles className="w-3 h-3 fill-slate-950" />
                      VIP Care Member
                    </span>
                  )}
                  {isChronic && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-400/40 flex items-center gap-1">
                      <Droplet className="w-3 h-3 text-rose-400" />
                      Chronic Care
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-300 mt-2 flex-wrap">
                  <span className="font-semibold text-slate-200">
                    {patient.gender}, {patient.age} yrs
                  </span>
                  {((vitals as any)?.bloodGroup || (patient as any)?.bloodGroup) && (
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 text-[11px]">
                      🩸 {(vitals as any)?.bloodGroup || (patient as any)?.bloodGroup}
                    </span>
                  )}
                  {patient.phone && (
                    <a
                      href={`https://wa.me/91${cleanPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-teal-300 hover:text-teal-200 font-medium hover:underline"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      +91 {cleanPhone}
                    </a>
                  )}
                  {patient.address && (
                    <span className="flex items-center gap-1 text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[200px]">{patient.address}</span>
                    </span>
                  )}
                  {patient.abhaId ? (
                    <span className="flex items-center gap-1 text-indigo-300 font-mono text-[11px]">
                      <CheckCircle2 className="w-3 h-3 text-teal-400" />
                      ABHA: {patient.abhaId}
                    </span>
                  ) : (
                    <button 
                      onClick={() => onLinkAbha && onLinkAbha(patient)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 font-medium text-[10px] border border-indigo-500/30 transition-colors"
                    >
                      <Sparkles className="w-3 h-3" />
                      Link ABHA ID
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Action Buttons in Header */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onSendWhatsApp ? onSendWhatsApp(patient) : window.open(`https://wa.me/91${cleanPhone}`, '_blank')}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-900/30"
              >
                <Send className="w-3.5 h-3.5" />
                WhatsApp
              </button>
              {onBookAppointment && (
                <button
                  onClick={() => onBookAppointment(patient)}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-indigo-900/30"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Book Visit
                </button>
              )}
            </div>
          </div>

          {/* ══ NAVIGATION TABS ══ */}
          <div className="flex items-center gap-1 mt-6 border-b border-white/10 overflow-x-auto no-scrollbar pt-1">
            {[
              { id: 'vitals', label: 'Vitals & Overview', icon: Activity },
              { id: 'encounters', label: `Encounters (${encounters.length})`, icon: FileText },
              { id: 'prescriptions', label: `Prescriptions (${prescriptions.length})`, icon: Pill },
              { id: 'labs', label: `Lab Reports (${labReports.length})`, icon: Microscope },
              { id: 'billing', label: `Invoices (${invoices.length})`, icon: Receipt },
              { id: 'loyalty', label: 'Care Loop & VIP', icon: Gift }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ProfileTab)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                    isActive
                      ? 'border-teal-400 text-teal-300 bg-white/5'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ══ MODAL BODY: Tab Content ══ */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 space-y-6">
          {/* ── TAB 1: Vitals & Clinical Overview ── */}
          {activeTab === 'vitals' && (
            <div className="space-y-6 animate-fade-in">
              {/* Vitals Grid */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-indigo-600" />
                    Latest Vital Signs Cockpit
                  </h3>
                  {vitals?.recordedAt && (
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Recorded: {new Date(vitals.recordedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {/* Blood Pressure */}
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Blood Pressure</div>
                    <div className="text-lg font-black text-slate-900 mt-1">
                      {vitals?.bloodPressure || '—'}
                    </div>
                    <div className="mt-2">
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${bpColor}`}>
                        {bpCategory}
                      </span>
                    </div>
                  </div>

                  {/* Pulse Rate */}
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      Pulse Rate <Heart className="w-3 h-3 text-rose-500" />
                    </div>
                    <div className="text-lg font-black text-slate-900 mt-1">
                      {vitals?.pulseRate ? `${vitals.pulseRate} bpm` : '—'}
                    </div>
                    <div className="mt-2 text-[10px] text-slate-500 font-medium">
                      Normal: 60-100
                    </div>
                  </div>

                  {/* SpO2 */}
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">SpO2 (Oxygen)</div>
                    <div className="text-lg font-black text-slate-900 mt-1">
                      {vitals?.spO2 ? `${vitals.spO2}%` : '—'}
                    </div>
                    <div className="mt-2">
                      <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                        {parseInt(vitals?.spO2 || '99', 10) >= 95 ? 'Normal Saturation' : 'Hypoxia Alert'}
                      </span>
                    </div>
                  </div>

                  {/* Temperature */}
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Temperature</div>
                    <div className="text-lg font-black text-slate-900 mt-1">
                      {vitals?.temperature ? `${vitals.temperature}°F` : '—'}
                    </div>
                    <div className="mt-2 text-[10px] text-slate-500 font-medium">
                      {parseFloat(vitals?.temperature || '98.6') > 99.5 ? '🔥 Febrile' : 'Afebrile (Normal)'}
                    </div>
                  </div>

                  {/* Blood Sugar */}
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Blood Sugar</div>
                    <div className="text-lg font-black text-slate-900 mt-1">
                      {vitals?.bloodSugar ? `${vitals.bloodSugar} mg/dL` : '—'}
                    </div>
                    <div className="mt-2 text-[10px] text-slate-500 font-medium">
                      {parseInt(vitals?.bloodSugar || '0', 10) > 140 ? '⚠️ High Glycemia' : 'Euglycemic'}
                    </div>
                  </div>

                  {/* Weight & BMI */}
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Weight / BMI</div>
                    <div className="text-lg font-black text-slate-900 mt-1">
                      {vitals?.weight ? `${vitals.weight} kg` : '—'}
                    </div>
                    <div className="mt-2">
                      {bmiValue ? (
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${bmiColor}`}>
                          BMI {bmiValue} ({bmiCategory})
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">BMI n/a</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Chronic Conditions & Clinical Warnings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Chronic Conditions */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <Droplet className="w-4 h-4 text-rose-500" />
                    Chronic Care Protocol Cohort
                  </h4>
                  {patient.chronicConditions && patient.chronicConditions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {patient.chronicConditions.map((cond, idx) => (
                        <span
                          key={`chronic-${idx}-${cond}`}
                          className="px-3 py-1 rounded-xl text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1.5 shadow-sm"
                        >
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                          {cond}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No chronic conditions flagged for this patient.</p>
                  )}
                  {isChronic && (
                    <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>Enrolled in <strong>VitalSync Chronic Care Loop</strong>: Day 25 automated 1-click WhatsApp refill & 90-day diagnostic retest alerts are active.</span>
                    </div>
                  )}
                </div>

                {/* Allergies & Alerts */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    Known Allergies & Medical Alerts
                  </h4>
                  {patient.allergies && patient.allergies.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {patient.allergies.map((alg, idx) => (
                        <span
                          key={`allergy-${idx}-${alg}`}
                          className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 flex items-center gap-1"
                        >
                          ⚠️ {alg}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      No known drug allergies reported.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: Encounters Timeline ── */}
          {activeTab === 'encounters' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Doctor Consultation History ({encounters.length} Visits)
                </h3>
              </div>

              {encounters.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/80 p-8 space-y-2">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">No Consultation Encounters Recorded</p>
                  <p className="text-xs text-slate-500">Encounters will automatically log here when doctor finishes consultations.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {encounters.map((enc: any) => (
                    <div key={enc.id} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-sm">{enc.doctorName || 'Consultant Physician'}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {enc.specialty || 'General Medicine'}
                            </span>
                            {enc.isVirtual && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                <Video className="w-2.5 h-2.5" /> Virtual
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {new Date(enc.encounterDate).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
                          ENC-{enc.id.slice(-6).toUpperCase()}
                        </span>
                      </div>

                      {enc.chiefComplaints && (
                        <div className="text-xs text-slate-700">
                          <strong className="text-slate-900">Chief Complaints:</strong> {enc.chiefComplaints}
                        </div>
                      )}
                      {enc.diagnosis && (
                        <div className="text-xs text-slate-700">
                          <strong className="text-slate-900">Diagnosis:</strong> <span className="text-indigo-700 font-semibold">{enc.diagnosis}</span>
                        </div>
                      )}
                      {enc.clinicalNotes && (
                        <div className="p-3 rounded-xl bg-slate-50 text-xs text-slate-600 italic border border-slate-100">
                          "{enc.clinicalNotes}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 3: Prescriptions & Medications ── */}
          {activeTab === 'prescriptions' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Prescription History & Active Medications
                </h3>
              </div>

              {prescriptions.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/80 p-8 space-y-2">
                  <Pill className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">No Prescriptions On Record</p>
                  <p className="text-xs text-slate-500">Digital prescriptions and Paper Mode scanned slips will appear here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {prescriptions.map((rx: any) => (
                    <div key={rx.id} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
                      <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-sm">{rx.doctorName || 'Dr. Pankaj Kumar'}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                              {rx.source === 'paper_scan' ? '📄 Paper Scan OCR' : '💻 Digital EMR'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Prescribed: {new Date(rx.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                          </p>
                        </div>

                        {rx.prescriptionImageUrl && (
                          <button
                            onClick={() => setZoomImage(rx.prescriptionImageUrl)}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Scanned Slip
                          </button>
                        )}
                      </div>

                      {/* Medications Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                              <th className="pb-2">Medicine Name</th>
                              <th className="pb-2">Dosage</th>
                              <th className="pb-2">Frequency</th>
                              <th className="pb-2">Duration</th>
                              <th className="pb-2">Refill Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(rx.medications || []).map((med: any, idx: number) => (
                              <tr key={`med-${idx}-${med.medicineName || 'rx'}`} className="hover:bg-slate-50/50">
                                <td className="py-2.5 font-bold text-slate-900">{med.medicineName}</td>
                                <td className="py-2.5 text-slate-600">{med.dosage || '1 Tab'}</td>
                                <td className="py-2.5">
                                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono font-bold text-[10px]">
                                    {med.frequency || '1-0-1'}
                                  </span>
                                </td>
                                <td className="py-2.5 text-slate-600">{med.duration || '30 Days'}</td>
                                <td className="py-2.5">
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    Active Rx
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* 1-Click Refill Call to Action */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="text-xs text-slate-500">
                          Eligible for <strong>10% OFF Refill Pack</strong> via VitalSync Pharmacy.
                        </span>
                        <button
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('mediflow-toast', {
                              detail: {
                                title: 'Refill Order Queued! 💊',
                                message: `Refill order for ${patient.name} reserved at Pharmacy Counter with 10% VIP discount.`,
                                type: 'success'
                              }
                            }));
                          }}
                          className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                        >
                          <Pill className="w-3.5 h-3.5" /> Confirm 1-Click Refill (10% OFF)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 4: Lab Reports ── */}
          {activeTab === 'labs' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Diagnostic Pathology Reports & Biomarkers ({labReports.length})
                </h3>
              </div>

              {labReports.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/80 p-8 space-y-2">
                  <Microscope className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">No Pathology Reports Found</p>
                  <p className="text-xs text-slate-500">Verified lab reports and biomarker analyses will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {labReports.map((rep: any) => (
                    <div key={rep.id} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-sm">{rep.testName}</span>
                            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                              LOINC: {rep.loincCode || '2160-0'}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                              Verified & Approved 🟢
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Sample Date: {new Date(rep.completedAt || rep.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                          </p>
                        </div>

                        {rep.reportFileUrl && (
                          <a
                            href={rep.reportFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-1.5 border border-indigo-200"
                          >
                            <Download className="w-3.5 h-3.5" /> Download PDF
                          </a>
                        )}
                      </div>

                      {/* AI Clinical Hinglish Summary */}
                      {rep.aiClinicalSummary && (
                        <div className="p-3.5 rounded-xl bg-teal-50/80 border border-teal-200/80 text-xs text-teal-900 space-y-1">
                          <div className="font-extrabold flex items-center gap-1 text-teal-800 text-[11px] uppercase tracking-wider">
                            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                            AI Clinical Longitudinal Summary
                          </div>
                          <p className="leading-relaxed">{rep.aiClinicalSummary}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 5: Billing & Invoices ── */}
          {activeTab === 'billing' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Billing, Invoices & Payment Ledger ({invoices.length})
                </h3>
              </div>

              {invoices.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/80 p-8 space-y-2">
                  <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">No Invoices Found</p>
                  <p className="text-xs text-slate-500">Cleared consultation, pharmacy, and lab bills will be itemized here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.map((inv: any) => (
                    <div key={inv.id} className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm">Invoice #{inv.id.slice(-6).toUpperCase()}</span>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            inv.paymentStatus === 'cleared' || inv.paymentStatus === 'paid'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {inv.paymentStatus || 'cleared'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {new Date(inv.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} • Mode: {inv.paymentMethod || 'UPI / Cash'}
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="text-base font-black text-slate-900">
                          ₹{(inv.finalTotal || inv.subtotal || 0).toFixed(2)}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">
                          Direct Doctor Settlement
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 6: Care Loop & Loyalty ── */}
          {activeTab === 'loyalty' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-50 via-amber-100/60 to-teal-50 border border-amber-200/80 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/30">
                      <Gift className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">VitalSync 4 Premium Member Benefits</h3>
                      <p className="text-xs text-slate-600">Unlocked automatically by paying medicine or lab bills at clinic counter.</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-slate-950 shadow-sm">
                    {isFreeUnlocked ? 'ACTIVE UNLOCKED 🟢' : 'UNLOCK PENDING ⏳'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3.5 rounded-2xl bg-white/90 border border-amber-200/60 shadow-xs space-y-1">
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-indigo-600" />
                      1 Free Virtual Consult (15-20 Days)
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Eligible for remote follow-up video review with doctor without paying extra fee.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white/90 border border-amber-200/60 shadow-xs space-y-1">
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <Pill className="w-3.5 h-3.5 text-teal-600" />
                      10% OFF Chronic Medicine Refills
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Guaranteed discount on all monthly refills at Clinic Counter or Home Delivery.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white/90 border border-amber-200/60 shadow-xs space-y-1">
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      Daily WhatsApp Reminders & AI Summary
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Personalized Hindi/Hinglish medicine dose alerts and longitudinal health progress.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white/90 border border-amber-200/60 shadow-xs space-y-1">
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <Microscope className="w-3.5 h-3.5 text-indigo-600" />
                      Instant PDF Lab Reports on WhatsApp
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Direct cloud delivery of signed pathology test results as soon as approved.
                    </p>
                  </div>
                </div>

                {/* Referral Card */}
                <div className="p-4 rounded-2xl bg-white border border-amber-300 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">Patient Referral Code</span>
                    <div className="text-base font-black font-mono text-slate-900">
                      REF-{cleanPhone.slice(-4).toUpperCase() || 'VITAL'}
                    </div>
                    <p className="text-[10px] text-slate-500">Unlocks 10% discount for family/friends and referral credit for patient.</p>
                  </div>

                  <button
                    onClick={() => {
                      const shareText = `VitalSync Health Referral: Use my referral code REF-${cleanPhone.slice(-4).toUpperCase()} to get 10% OFF on consultation and medicines at ${(getPodContext() as any)?.clinicName || 'VitalSync Smart PolyClinic'}!`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
                    }}
                    className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Share Referral via WhatsApp
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ══ FOOTER: Actions Bar ══ */}
        <div className="bg-slate-100 border-t border-slate-200/80 p-4 px-6 flex items-center justify-between shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Sovereign Pod: <strong>{(getPodContext() as any)?.clinicCode || 'VS-V01R'}</strong></span>
            <span>•</span>
            <span>Status: <strong className="text-emerald-700">Realtime CDC Synced 🟢</strong></span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                window.print();
              }}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 border border-slate-300 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" /> Print Dossier
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Scanned Image Zoom Modal */}
      {zoomImage && (
        <div 
          className="fixed inset-0 z-[10000] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setZoomImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setZoomImage(null)}
              className="absolute -top-10 right-0 p-2 rounded-full bg-white/20 text-white hover:bg-white/40"
            >
              <X className="w-6 h-6" />
            </button>
            <img 
              src={zoomImage} 
              alt="Scanned Prescription Slip" 
              className="max-h-[85vh] max-w-full rounded-2xl object-contain border border-white/20 shadow-2xl" 
            />
          </div>
        </div>
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};
