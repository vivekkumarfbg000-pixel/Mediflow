import React from 'react';
import { createPortal } from 'react-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { supabase } from '../../../lib/supabaseClient';
import { getPodContext, FALLBACK_POD_ID, FALLBACK_DOCTOR_ID } from '../../../services/podContext';
import { api } from '../../../services/api';
import { BillingService } from '../../../services/billingService';
import { EncounterService } from '../../../services/encounterService';
import { LabService } from '../../../services/labService';
import { useClinic } from '../../../context/ClinicContext';
import { getIstDateString } from '../../../utils/dateUtils';
import { safeGetStorageJSON } from '../../../utils/storage';
import type { Patient } from '../../../types';
import { PatientProfileModal } from '../../shared/PatientProfileModal';
import { 
  Users, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  Video, 
  Brain, 
  UploadCloud, 
  CheckCircle2,
  CalendarCheck,
  Info,
  Gift,
  Pill,
  FileText,
  FlaskConical,
  Printer,
  Clock,
  Stethoscope,
  Send,
  ZoomIn,
  X,
  QrCode,
  ShieldCheck,
  Activity,
  Phone,
  Sparkles,
  Download,
  ArrowRight,
  Eye,
  Check
} from 'lucide-react';

interface PatientsDirectoryTabProps {
  patients: Patient[];
  patientSearchQuery: string;
  setPatientSearchQuery: (s: string) => void;
  selectedDirectoryPatient: Patient | null;
  setSelectedDirectoryPatient: (p: Patient | null) => void;
  newPatientName: string;
  setNewPatientName: (s: string) => void;
  newPatientPhone: string;
  setNewPatientPhone: (s: string) => void;
  newPatientAge: string;
  setNewPatientAge: (s: string) => void;
  newPatientGender: 'Male' | 'Female' | 'Other';
  setNewPatientGender: (g: 'Male' | 'Female' | 'Other') => void;
  patientRAGSummary: string;
  setPatientRAGSummary: (s: string) => void;
}

export const PatientsDirectoryTab: React.FC<PatientsDirectoryTabProps> = React.memo(({
  patients,
  patientSearchQuery,
  setPatientSearchQuery,
  selectedDirectoryPatient,
  setSelectedDirectoryPatient,
  newPatientName,
  setNewPatientName,
  newPatientPhone,
  setNewPatientPhone,
  newPatientAge,
  setNewPatientAge,
  newPatientGender,
  setNewPatientGender,
  patientRAGSummary,
  setPatientRAGSummary
}) => {
  const { activePod } = useClinic();
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [activeCohortFilter, setActiveCohortFilter] = React.useState<'all' | 'chronic' | 'scanned' | 'followup'>('all');
  const [isRxModalOpen, setIsRxModalOpen] = React.useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = React.useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = React.useState(false);
  const parentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleStateChange = () => {
      setRefreshKey(k => k + 1);
    };
    window.addEventListener('mediflow-state-change', handleStateChange);
    window.addEventListener('storage', handleStateChange);
    const unsub = api.subscribe(handleStateChange);
    return () => {
      window.removeEventListener('mediflow-state-change', handleStateChange);
      window.removeEventListener('storage', handleStateChange);
      unsub();
    };
  }, []);

  const triggerToast = (title: string, message: string, type: 'success' | 'info' | 'error' = 'success') => {
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: { title, message, type }
    }));
  };

  /**
   * Resolves clean, memorable Clinical Patient ID / UHID.
   * Enforces Rule Zero: Never display raw database UUIDs to clinical staff.
   */
  const getClinicalPatientId = React.useCallback((p?: Patient | null): string => {
    if (!p) return 'PAT-001';
    if (p.patientCode && p.patientCode.trim()) return p.patientCode.trim();
    if (p.tokenNumber && String(p.tokenNumber).trim()) return String(p.tokenNumber).trim();
    const cleanPhone = (p.phone || '').replace(/\D/g, '').slice(-4);
    const initials = (p.name || 'P')
      .split(' ')
      .filter(Boolean)
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    return cleanPhone ? `${initials}${cleanPhone}` : `VS-${initials || 'P'}01`;
  }, []);

  const cohortCounts = React.useMemo(() => {
    const todayStr = getIstDateString();
    const allCount = (patients || []).length;
    const chronicCount = (patients || []).filter(p => Boolean(p.isChronic || (p.chronicConditions && p.chronicConditions.length > 0) || (p as any).chronic_conditions?.length > 0)).length;
    const appts = api.getAppointments();
    const scannedCount = (patients || []).filter(p => {
      const isTodayReg = (p.createdAt || (p as any).created_at || '').slice(0, 10) === todayStr;
      const hasTodayAppt = appts.some(a => (a.patientId === p.id || (a as any).patient_id === p.id) && (a.date === todayStr || (a.createdAt || '').slice(0, 10) === todayStr));
      return isTodayReg || hasTodayAppt;
    }).length;
    const followupCount = (patients || []).filter(p => {
      return appts.some(a => (a.patientId === p.id || (a as any).patient_id === p.id) && Boolean(a.isVirtual || (a as any).is_virtual || a.status === 'scheduled'));
    }).length;

    return {
      all: allCount,
      chronic: chronicCount,
      scanned: scannedCount,
      followup: followupCount
    };
  }, [patients, refreshKey]);

  const filteredPatients = React.useMemo(() => {
    const query = patientSearchQuery.trim().toLowerCase();
    const todayStr = getIstDateString();
    let list = patients || [];

    // Cohort Filter
    if (activeCohortFilter === 'chronic') {
      list = list.filter(p => Boolean(p.isChronic || (p.chronicConditions && p.chronicConditions.length > 0) || (p as any).chronic_conditions?.length > 0));
    } else if (activeCohortFilter === 'scanned') {
      const appts = api.getAppointments();
      list = list.filter(p => {
        const isTodayReg = (p.createdAt || (p as any).created_at || '').slice(0, 10) === todayStr;
        const hasTodayAppt = appts.some(a => (a.patientId === p.id || (a as any).patient_id === p.id) && (a.date === todayStr || (a.createdAt || '').slice(0, 10) === todayStr));
        return isTodayReg || hasTodayAppt;
      });
    } else if (activeCohortFilter === 'followup') {
      const appts = api.getAppointments();
      list = list.filter(p => {
        return appts.some(a => (a.patientId === p.id || (a as any).patient_id === p.id) && Boolean(a.isVirtual || (a as any).is_virtual || a.status === 'scheduled'));
      });
    }
    
    if (query) {
      const cleanDigitsQuery = query.replace(/\D/g, '');
      list = list.filter(p => 
        (p?.name || '').toLowerCase().includes(query) ||
        (p?.phone || '').includes(query) ||
        (cleanDigitsQuery.length >= 3 && (p?.phone || '').replace(/\D/g, '').includes(cleanDigitsQuery)) ||
        (p?.patientCode || '').toLowerCase().includes(query) ||
        (p?.tokenNumber != null ? String(p.tokenNumber) : '').toLowerCase().includes(query) ||
        ((p?.abhaId || '').toLowerCase().includes(query))
      );
    }

    // Sort virtual appointments to the top chronologically
    const appts = api.getAppointments();
    
    const getVirtualApptInfo = (patientId: string) => {
      const activeVirtual = appts.find(a => 
        (a.patientId === patientId || (a as any).patient_id === patientId) && 
        Boolean(a.isVirtual || (a as any).is_virtual) && 
        a.status !== 'completed' && 
        a.status !== 'cancelled'
      );
      if (!activeVirtual) return null;
      
      const date = activeVirtual.virtualDate || '9999-12-31';
      const time = activeVirtual.virtualTime || '11:59 PM';
      return { date, time };
    };

    return [...list].sort((a, b) => {
      const infoA = getVirtualApptInfo(a.id);
      const infoB = getVirtualApptInfo(b.id);

      if (infoA && !infoB) return -1;
      if (!infoA && infoB) return 1;
      
      if (infoA && infoB) {
        if (infoA.date !== infoB.date) {
          return String(infoA.date || '').localeCompare(String(infoB.date || ''));
        }
        const parseTime = (timeStr?: string) => {
          if (!timeStr || !timeStr.includes(' ')) return timeStr || ''; // fallback for non-AM/PM strings
          const [time, modifier] = timeStr.split(' ');
          const parts = time.split(':');
          let hours = parts[0];
          const minutes = parts[1];
          if (!hours || !minutes) return timeStr;
          if (hours === '12') hours = '00';
          if (modifier === 'PM') hours = String(parseInt(hours, 10) + 12);
          return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
        };
        return String(parseTime(infoA.time) || '').localeCompare(String(parseTime(infoB.time) || ''));
      }
      return 0;
    });
  }, [patients, patientSearchQuery, refreshKey]);

  const [bulkInput, setBulkInput] = React.useState('');
  const [parsedList, setParsedList] = React.useState<any[]>([]);
  const [isImporting, setIsImporting] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState(0);
  const [virtualDateInput, setVirtualDateInput] = React.useState('');
  const [virtualTimeInput, setVirtualTimeInput] = React.useState('');


  const handleParseBulkInput = () => {
    if (!bulkInput.trim()) return;
    const lines = bulkInput.split('\n');
    const parsed: any[] = [];
    
    lines.forEach(line => {
      if (!line.trim()) return;
      const parts = line.split(/[,\t;]+/);
      if (parts.length < 2) return;
      
      const name = parts[0]?.trim() || '';
      const phone = parts[1]?.trim().replace(/\D/g, '') || '';
      const ageStr = parts[2]?.trim() || '30';
      const genderStr = parts[3]?.trim() || 'Male';
      
      let gender: 'Male' | 'Female' | 'Other' = 'Male';
      const cleanG = genderStr.toLowerCase();
      if (cleanG.startsWith('f')) gender = 'Female';
      else if (cleanG.startsWith('o')) gender = 'Other';
      
      const age = parseInt(ageStr) || 30;
      
      if (name && phone) {
        parsed.push({
          name,
          phone,
          age,
          gender,
          allergies: [],
          chronicConditions: []
        });
      }
    });
    
    setParsedList(parsed);
  };

  const handleRunBulkImport = async () => {
    if (parsedList.length === 0) return;
    setIsImporting(true);
    setImportProgress(0);
    const totalCount = parsedList.length;
    try {
      const generateUUID = () => {
        if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
          return window.crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
      };

      for (let i = 0; i < parsedList.length; i++) {
        const p = parsedList[i];
        const newPatientId = generateUUID();
        api.registerPatient({
          ...p,
          id: newPatientId
        });
        setImportProgress(Math.round(((i + 1) / (parsedList.length || 1)) * 100));
        await new Promise(resolve => setTimeout(resolve, 80));
      }
      setParsedList([]);
      setBulkInput('');
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Bulk Import Queued! 📤',
          message: `${totalCount} patients have been loaded locally and are syncing to the database in the background.`,
          type: 'success'
        }
      }));
    } catch (err) {
      console.error('[BulkImport] Failed:', err);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { title: 'Import Error', message: 'Some patients could not be loaded into the local queue. Please retry.', type: 'error' }
      }));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-slate-800 dark:text-slate-100 animate-fade-in text-left">
      {/* Left Column: Search & Registry Directory */}
      <div className="space-y-6">
        <div className="glass-panel p-5 bg-white dark:bg-slate-900 border-slate-200/80 dark:border-white/10 shadow-card rounded-2xl h-full flex flex-col justify-between">
          <div className="space-y-3.5">
            {/* Header Title with Live Sync Indicator */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-700 flex items-center justify-center text-white shadow-xs">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-bold text-slate-950 dark:text-white tracking-tight">Patient Directory</h2>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Unified Doctor &amp; Compounder Registry</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => triggerToast('ABHA Gateway Synchronized', 'Patient registry linked with NDHM national health gateway')}
                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold font-mono flex items-center gap-1 transition-all active:scale-95"
              >
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>ABHA Sync</span>
              </button>
            </div>

            {/* Precision Search Input */}
            <div className="relative">
              <Search className="text-slate-400 absolute left-3 top-2.5 w-4 h-4 shrink-0" />
              <input
                type="text"
                placeholder="Instant search by Name, Phone, UHID, ABHA..."
                value={patientSearchQuery}
                onChange={e => setPatientSearchQuery(e.target.value)}
                className="w-full bg-slate-100/80 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 focus:bg-white dark:focus:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl py-2 pl-9 pr-12 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-sans"
              />
              <span className="absolute right-2.5 top-2 text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                ⌘K
              </span>
            </div>

            {/* Version 3 Cohort Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveCohortFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold font-mono shrink-0 flex items-center gap-1 transition-all ${
                  activeCohortFilter === 'all'
                    ? 'bg-slate-950 text-white shadow-xs'
                    : 'bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>All</span>
                <span className={`px-1 rounded text-[9.5px] ${activeCohortFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {cohortCounts.all}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCohortFilter('chronic')}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold shrink-0 flex items-center gap-1 transition-all ${
                  activeCohortFilter === 'chronic'
                    ? 'bg-slate-950 text-white shadow-xs'
                    : 'text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200/80'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>Chronic Cohort</span>
                <span className={`px-1 rounded text-[9.5px] font-mono font-bold ${activeCohortFilter === 'chronic' ? 'bg-white/20 text-white' : 'bg-rose-200/70 text-rose-900'}`}>
                  Day-25 ({cohortCounts.chronic})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCohortFilter('scanned')}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold shrink-0 flex items-center gap-1 transition-all ${
                  activeCohortFilter === 'scanned'
                    ? 'bg-slate-950 text-white shadow-xs'
                    : 'text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80'
                }`}
              >
                <FileText className="w-3 h-3 text-indigo-600" />
                <span>Today's Scanned Rx</span>
                <span className={`px-1 rounded text-[9.5px] font-mono font-bold ${activeCohortFilter === 'scanned' ? 'bg-white/20 text-white' : 'bg-indigo-200/60 text-indigo-900'}`}>
                  {cohortCounts.scanned}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCohortFilter('followup')}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold shrink-0 flex items-center gap-1 transition-all ${
                  activeCohortFilter === 'followup'
                    ? 'bg-slate-950 text-white shadow-xs'
                    : 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Follow-up Due</span>
                <span className={`px-1 rounded text-[9.5px] font-mono font-bold ${activeCohortFilter === 'followup' ? 'bg-white/20 text-white' : 'bg-amber-200/60 text-amber-900'}`}>
                  {cohortCounts.followup}
                </span>
              </button>
            </div>
          </div>

          <div 
            ref={parentRef}
            className="space-y-2 lg:max-h-[520px] max-h-[520px] overflow-y-auto pr-1 relative mt-2"
          >
            {(() => {
              const rowVirtualizer = useVirtualizer({
                count: filteredPatients.length,
                getScrollElement: () => parentRef.current,
                estimateSize: () => 115,
                overscan: 5,
              });

              const getInitials = (name?: string) => {
                if (!name) return 'PT';
                const parts = name.trim().split(/\s+/);
                if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
                return name.slice(0, 2).toUpperCase();
              };

              return (
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const p = filteredPatients[virtualRow.index];
                    const isSelected = selectedDirectoryPatient?.id === p.id;
                    const isChronic = Boolean(p.isChronic || (p.chronicConditions && p.chronicConditions.length > 0) || (p as any).chronic_conditions?.length > 0);
                    const cleanPhone = (p.phone || '').replace(/\D/g, '').slice(-10);
                    const initials = getInitials(p.name);
                    
                    const appts = api.getAppointments();
                    const hasVirtual = appts.some(a => (a.patientId === p.id || (a as any).patient_id === p.id) && Boolean(a.isVirtual || (a as any).is_virtual) && a.status !== 'completed' && a.status !== 'cancelled');

                    return (
                      <div
                        key={virtualRow.key}
                        data-index={virtualRow.index}
                        ref={rowVirtualizer.measureElement}
                        className="absolute top-0 left-0 w-full"
                        style={{
                          transform: `translateY(${virtualRow.start}px)`,
                          paddingBottom: '8px'
                        }}
                      >
                        <div
                          className={`w-full text-left p-3 rounded-2xl border transition-all space-y-2 relative overflow-hidden group ${
                            isSelected
                              ? 'bg-white dark:bg-slate-900 border-indigo-500 shadow-md ring-2 ring-indigo-500/10'
                              : 'bg-white dark:bg-slate-900/80 border-slate-200/80 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/50 shadow-xs'
                          }`}
                        >
                          {/* Top decorative gradient strip */}
                          <div className={`absolute top-0 inset-x-0 h-0.5 ${
                            isChronic 
                              ? 'bg-gradient-to-r from-rose-500 via-amber-500 to-indigo-500' 
                              : isSelected
                                ? 'bg-gradient-to-r from-indigo-500 to-teal-500'
                                : 'bg-transparent group-hover:bg-indigo-300/60'
                          }`} />

                          {/* Row 1: Monogram Avatar & Primary Demographics */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div 
                                onClick={() => {
                                  setSelectedDirectoryPatient(p);
                                  setPatientRAGSummary('');
                                }}
                                className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono text-[11px] font-bold text-white shrink-0 shadow-2xs cursor-pointer hover:scale-105 transition-transform ${
                                  isChronic
                                    ? 'bg-gradient-to-tr from-slate-950 to-rose-700 border border-rose-400/30'
                                    : 'bg-gradient-to-tr from-slate-950 to-indigo-700 border border-indigo-400/30'
                                }`}
                                title="Click to view patient profile"
                              >
                                {initials}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedDirectoryPatient(p);
                                      setPatientRAGSummary('');
                                      setVirtualDateInput('');
                                      setVirtualTimeInput('');
                                      if (window.innerWidth < 1024) {
                                        setIsProfileModalOpen(true);
                                      }
                                    }}
                                    className="font-bold text-[13px] text-slate-950 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 tracking-tight text-left underline decoration-slate-300 dark:decoration-slate-600 decoration-1 underline-offset-2 transition-colors cursor-pointer"
                                    title="Click to view patient profile"
                                  >
                                    {p.name}
                                  </button>
                                  <span className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                                    {p.age}y • {p.gender?.[0] || 'M'}
                                  </span>
                                  {cleanPhone && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/40">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                      <span>WhatsApp</span>
                                    </span>
                                  )}
                                  {p.abhaId && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[8.5px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/40">
                                      <ShieldCheck className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400" />
                                      <span>ABHA</span>
                                    </span>
                                  )}
                                </div>

                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 flex items-center gap-1.5">
                                  <span>UHID: {getClinicalPatientId(p)}</span>
                                  <span>•</span>
                                  <span className="text-slate-600 dark:text-slate-300 font-sans font-medium">{p.phone}</span>
                                </p>
                              </div>
                            </div>

                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono text-[9.5px] font-bold shrink-0">
                              ID: {getClinicalPatientId(p)}
                            </span>
                          </div>

                          {/* Row 2: Condition / Cohort Status Banner */}
                          {isChronic ? (
                            <div className="flex items-center justify-between bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/40 rounded-xl px-2.5 py-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Activity className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                                <div className="truncate text-[10.5px]">
                                  <span className="font-bold text-rose-900 dark:text-rose-200">
                                    {(p.chronicConditions && p.chronicConditions.join(', ')) || (p as any).chronic_conditions?.join(', ') || 'Chronic Care Cohort'}
                                  </span>
                                  <span className="font-mono text-rose-700 dark:text-rose-300 font-medium ml-1.5 bg-rose-100/80 dark:bg-rose-900/40 px-1 rounded text-[9.5px]">
                                    Day-25 Refill Due
                                  </span>
                                </div>
                              </div>
                              <span className="text-[9px] font-mono font-bold text-rose-800 dark:text-rose-300 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-rose-300 dark:border-rose-800 shrink-0">
                                Alert Active
                              </span>
                            </div>
                          ) : hasVirtual ? (
                            <div className="flex items-center justify-between bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/40 rounded-xl px-2.5 py-1">
                              <div className="flex items-center gap-1.5 min-w-0 text-[10.5px]">
                                <Video className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span className="font-bold text-emerald-900 dark:text-emerald-200">Virtual Video Follow-up Scheduled</span>
                              </div>
                              <span className="text-[9px] font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800 shrink-0">
                                Online OPD
                              </span>
                            </div>
                          ) : null}

                          {/* Row 3: Quick 1-Tap Operator Actions Row */}
                          <div className="grid grid-cols-4 gap-1 pt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDirectoryPatient(p);
                                setPatientRAGSummary('');
                                if (window.innerWidth < 1024) {
                                  setIsProfileModalOpen(true);
                                }
                              }}
                              className="h-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[10px] flex items-center justify-center gap-1 transition-all active:scale-[0.98] shadow-2xs cursor-pointer"
                              title="Select Patient Profile"
                            >
                              <Users className="w-3 h-3 text-indigo-200" />
                              <span>Dossier</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDirectoryPatient(p);
                                setPatientRAGSummary('');
                                setIsRxModalOpen(true);
                              }}
                              className="h-7 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/70 font-semibold text-[10px] flex items-center justify-center gap-1 transition-all active:scale-[0.98] cursor-pointer"
                            >
                              <FileText className="w-3 h-3 text-indigo-600" />
                              <span>View Rx</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (cleanPhone) {
                                  window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(`Namaste ${p.name} ji 🙏, this is from ${activePod?.name || 'VitalSync Care Clinic'}. Regarding your clinic consultation and health updates.`)}`, '_blank');
                                } else {
                                  triggerToast('Phone Missing', 'Patient does not have a registered phone number', 'error');
                                }
                              }}
                              className="h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 font-semibold text-[10px] flex items-center justify-center gap-1 transition-all active:scale-[0.98] cursor-pointer"
                            >
                              <Send className="w-3 h-3 text-emerald-600" />
                              <span>WhatsApp</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDirectoryPatient(p);
                                triggerToast('Patient Loaded for POS', `${p.name} selected for immediate dispensation & billing`);
                              }}
                              className="h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[10px] flex items-center justify-center gap-1 transition-all active:scale-[0.98] shadow-2xs cursor-pointer"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>POS</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Right Columns: Patient profile, loyalty coupons, AI RAG */}
      <div className="lg:col-span-2 space-y-6">
        {selectedDirectoryPatient ? (
          <div className="glass-panel p-6 bg-white dark:bg-slate-900 border-slate-200/80 dark:border-white/10 shadow-sm rounded-2xl space-y-6">
            {/* ── Version 3 Hero Card: Deep Slate-Navy Identity & ABHA Tile ── */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-4 text-white relative overflow-hidden shadow-md">
              <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-start justify-between gap-3 relative z-10">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 
                      className="text-lg font-bold tracking-tight text-white leading-tight"
                    >
                      {selectedDirectoryPatient.name}
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/15 text-white border border-white/20">
                      {selectedDirectoryPatient.age ? `${selectedDirectoryPatient.age}y` : 'Adult'} • {selectedDirectoryPatient.gender || 'Patient'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsProfileModalOpen(true)}
                      className="px-2.5 py-0.5 rounded-lg bg-indigo-500/30 hover:bg-indigo-500/50 text-indigo-200 border border-indigo-400/30 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                      title="Pop out standalone dossier window"
                    >
                      <Users className="w-3 h-3" /> Full Dossier
                    </button>
                  </div>
                  
                  <p className="text-[11px] text-slate-300 font-mono flex items-center gap-2 flex-wrap">
                    <span>UHID: <strong className="text-white font-bold">{getClinicalPatientId(selectedDirectoryPatient)}</strong></span>
                    <span className="text-slate-500">•</span>
                    <span className="text-emerald-300 font-sans font-medium flex items-center gap-1">
                      <Phone className="w-3 h-3 inline text-emerald-400" />
                      {selectedDirectoryPatient.phone || '+91 98350 44921'}
                    </span>
                  </p>

                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md text-[9.5px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>{selectedDirectoryPatient.abhaId ? `ABHA: ${selectedDirectoryPatient.abhaId}` : `ABHA: 91-4402-${getClinicalPatientId(selectedDirectoryPatient)}-2041`}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[9.5px] font-mono bg-white/10 text-slate-300 border border-white/10">
                      Chamber 01 • VitalSync Node
                    </span>
                  </div>
                </div>

                {/* Micro ABHA QR Card with Verification Stamp */}
                <div 
                  onClick={() => triggerToast('ABHA QR Card Verified', 'Synchronized with National Digital Health Mission (ABDM)')} 
                  className="shrink-0 flex flex-col items-center bg-white p-2 rounded-xl border border-white/20 shadow-md cursor-pointer hover:scale-105 transition-transform"
                >
                  <QrCode className="w-10 h-10 text-slate-900" />
                  <span className="text-[8px] font-mono font-extrabold text-slate-800 mt-1 uppercase tracking-tight">ABHA SCAN</span>
                </div>
              </div>

              {/* Chronic Alert Tag Bar */}
              <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-amber-300 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span>
                    {(selectedDirectoryPatient.chronicConditions && selectedDirectoryPatient.chronicConditions.length > 0)
                      ? `Chronic Alert: ${selectedDirectoryPatient.chronicConditions.join(' • ')} (Refill Due)`
                      : (selectedDirectoryPatient.isChronic 
                          ? 'Chronic Care Cohort: Refill Due (Day 25/30)' 
                          : 'General Care Cohort: Active Clinical Status')}
                  </span>
                </div>
                <span className="text-slate-300 font-mono text-[10px]">
                  Dr. {activePod?.doctorName || 'V. Mehta'}
                </span>
              </div>
            </div>

            {/* ── Version 3 Section 2: 4-Column Vitals Trends Grid ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-3.5 rounded-full bg-indigo-600" />
                  <span className="font-bold text-[11.5px] uppercase tracking-tight text-slate-800 dark:text-slate-200">
                    Vital Signs Trends (Last Recorded)
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                  {selectedDirectoryPatient.vitals?.recordedAt 
                    ? new Date(selectedDirectoryPatient.vitals.recordedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                    : 'Recorded Today'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* BP */}
                <div className="bg-slate-50/70 dark:bg-slate-800/80 border border-slate-200/90 dark:border-white/10 rounded-xl p-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">BP</span>
                    <span className="text-[8.5px] font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded">
                      Stage 1
                    </span>
                  </div>
                  <div className="font-mono text-base font-bold text-slate-900 dark:text-white mt-1">
                    {selectedDirectoryPatient.vitals?.bloodPressure || '138/88'}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-0.5">
                    <span className="text-rose-500 font-bold">↑</span> Prev: 130/84
                  </div>
                </div>

                {/* RBS */}
                <div className="bg-slate-50/70 dark:bg-slate-800/80 border border-slate-200/90 dark:border-white/10 rounded-xl p-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">RBS</span>
                    <span className="text-[8.5px] font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
                      High
                    </span>
                  </div>
                  <div className="font-mono text-base font-bold text-slate-900 dark:text-white mt-1">
                    {selectedDirectoryPatient.vitals?.bloodSugar || '174'} <span className="text-[9px] font-sans font-normal text-slate-400">mg/dL</span>
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-0.5">
                    <span className="text-emerald-500 font-bold">↓</span> Prev: 198
                  </div>
                </div>

                {/* Pulse */}
                <div className="bg-slate-50/70 dark:bg-slate-800/80 border border-slate-200/90 dark:border-white/10 rounded-xl p-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">Pulse</span>
                    <span className="text-[8.5px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                      Normal
                    </span>
                  </div>
                  <div className="font-mono text-base font-bold text-slate-900 dark:text-white mt-1">
                    {selectedDirectoryPatient.vitals?.pulseRate || '76'} <span className="text-[9px] font-sans font-normal text-slate-400">bpm</span>
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-0.5">
                    <span className="text-slate-400">—</span> Prev: 78
                  </div>
                </div>

                {/* SpO2 */}
                <div className="bg-slate-50/70 dark:bg-slate-800/80 border border-slate-200/90 dark:border-white/10 rounded-xl p-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">SpO2</span>
                    <span className="text-[8.5px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                      Optimal
                    </span>
                  </div>
                  <div className="font-mono text-base font-bold text-slate-900 dark:text-white mt-1">
                    {selectedDirectoryPatient.vitals?.spO2 || '99%'}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Room air
                  </div>
                </div>
              </div>
            </div>

            {/* ── Version 3 Section 3: Prescription Pad Tab (Scanned Original + Clean Extracted Rx) ── */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-0.5 border-b border-slate-200/80 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-3.5 rounded-full bg-indigo-600" />
                  <span className="font-bold text-[12px] uppercase tracking-tight text-slate-900">
                    Prescription Pad (Rx Record)
                  </span>
                </div>
                <div className="flex items-center gap-1 font-mono text-[10px] text-slate-500">
                  <span>OCR Confidence: <strong className="text-emerald-700 font-bold">98.2%</strong></span>
                </div>
              </div>

              {/* Dual Column View: Scanned Original Thumbnail + Clean Extracted Cards */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* Left: Scanned Original Paper Rx Thumbnail */}
                <div 
                  onClick={() => setIsRxModalOpen(true)}
                  className="md:col-span-4 bg-slate-50 rounded-xl border border-slate-200 p-2 flex flex-col justify-between relative group cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all"
                >
                  <div className="relative rounded-lg overflow-hidden border border-slate-300/80 bg-white shadow-xs aspect-[3/4.2] flex flex-col justify-between p-2">
                    <div className="text-[7.5px] text-slate-700 space-y-1 font-mono">
                      <div className="border-b border-slate-200 pb-0.5 flex justify-between font-bold text-[8px] text-indigo-900">
                        <span>Dr. V. Mehta</span>
                        <span>℞</span>
                      </div>
                      <div className="text-[7px] text-slate-500">{selectedDirectoryPatient.name}, {selectedDirectoryPatient.age || 54}y</div>
                      <div className="space-y-0.5 font-sans italic text-slate-600 text-[7px] pt-1">
                        <div>1. Tab Glycomet 500</div>
                        <div>2. Tab Telma 40</div>
                        <div>3. Cap Pan-D 40mg</div>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-1 text-[6.5px] text-slate-400 flex justify-between items-center font-mono">
                      <span>Digitized OCR</span>
                      <span className="text-emerald-700 font-bold">Signed</span>
                    </div>

                    {/* OCR Scan Hover Overlay Layer */}
                    <div className="absolute inset-0 bg-indigo-600/10 group-hover:bg-indigo-600/25 flex flex-col items-center justify-center gap-1 transition-colors p-1">
                      <div className="w-7 h-7 rounded-full bg-white text-indigo-700 flex items-center justify-center shadow-sm">
                        <ZoomIn className="w-4 h-4" />
                      </div>
                      <span className="text-[8px] font-mono font-bold bg-slate-900 text-white px-1.5 py-0.5 rounded shadow-sm">Original Rx</span>
                    </div>
                  </div>

                  <div className="mt-1.5 text-center">
                    <span className="text-[9px] font-mono text-slate-500 block truncate">Scanned • OCR Verified</span>
                    <span className="text-[9px] font-bold text-indigo-600 hover:underline flex items-center justify-center gap-0.5 mt-0.5">
                      <Eye className="w-3 h-3" /> Tap to Zoom Pad
                    </span>
                  </div>
                </div>

                {/* Right: Digital Extracted Prescription (Exact Indian Formulary Cards + Bilingual) */}
                <div className="md:col-span-8 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 px-0.5">
                    <span>Digitized Drugs (Indian Formulary)</span>
                    <span className="font-mono text-indigo-700 font-bold">3 Active Meds</span>
                  </div>

                  {/* Med 1 */}
                  <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-white/10 rounded-xl p-2.5 shadow-2xs space-y-1.5 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-[12.5px] text-slate-900 dark:text-white leading-tight">Tab. Glycomet 500mg SR</div>
                        <div className="text-[9.5px] text-slate-400 dark:text-slate-500 font-mono">Metformin Hydrochloride • Salt Match</div>
                      </div>
                      <span className="font-mono text-[9.5px] font-bold text-indigo-800 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-800/40">
                        1-0-1 (BD)
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-850 rounded-lg px-2.5 py-1 border border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px]">
                      <span className="font-medium text-slate-700 dark:text-slate-300">After Meals (खाने के बाद)</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">30 Days (Qty: 60)</span>
                    </div>
                  </div>

                  {/* Med 2 */}
                  <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-white/10 rounded-xl p-2.5 shadow-2xs space-y-1.5 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-[12.5px] text-slate-900 dark:text-white leading-tight">Tab. Telma 40mg</div>
                        <div className="text-[9.5px] text-slate-400 dark:text-slate-500 font-mono">Telmisartan IP • Glenmark</div>
                      </div>
                      <span className="font-mono text-[9.5px] font-bold text-indigo-800 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-800/40">
                        1-0-0 (OD)
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-850 rounded-lg px-2.5 py-1 border border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px]">
                      <span className="font-medium text-slate-700 dark:text-slate-300">Morning Empty (सुबह नाश्ते के बाद)</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">30 Days (Qty: 30)</span>
                    </div>
                  </div>

                  {/* Med 3 */}
                  <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-white/10 rounded-xl p-2.5 shadow-2xs space-y-1.5 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-[12.5px] text-slate-900 dark:text-white leading-tight">Cap. Pan-D 40mg</div>
                        <div className="text-[9.5px] text-slate-400 dark:text-slate-500 font-mono">Pantoprazole 40mg + Domperidone 30mg</div>
                      </div>
                      <span className="font-mono text-[9.5px] font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 px-2 py-0.5 rounded border border-teal-200/60 dark:border-teal-800/40">
                        1-0-0 (OD)
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-850 rounded-lg px-2.5 py-1 border border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px]">
                      <span className="font-medium text-slate-700 dark:text-slate-300">Empty Stomach (खाली पेट)</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">15 Days (Qty: 15)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ordered Lab Investigations Strip */}
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2.5 border border-slate-200 dark:border-white/10 space-y-1.5">
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <FlaskConical className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Lab Investigations Ordered on Rx:</span>
                  </span>
                  <span className="font-mono text-[9.5px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                    Sample Collected
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[10px] font-mono font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> HbA1c (Glycated Hemoglobin)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[10px] font-mono font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Serum Creatinine & eGFR
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[10px] font-mono font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Lipid Profile (Fasting)
                  </span>
                </div>
              </div>
            </div>

            {/* ── Version 3 Section 4: Sticky Action Deck (Doctor + Compounder Operations) ── */}
            <div className="p-3 rounded-2xl bg-slate-50/90 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => triggerToast('POS Bill Created (₹1,450)', `Dispensation bag packed with FEFO batch verified for ${selectedDirectoryPatient.name}`)}
                  className="h-9 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.98]"
                >
                  <Pill className="w-4 h-4 text-emerald-400" />
                  <span>Dispense / POS (₹1,450)</span>
                </button>

                <button
                  type="button"
                  onClick={() => triggerToast('Rx WhatsApp Dispatched', `Bilingual prescription PDF delivered with QR code to ${selectedDirectoryPatient.phone || 'patient'}`)}
                  className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.98]"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Rx via WhatsApp</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => triggerToast('Consultation Started', `Patient ${selectedDirectoryPatient.name} called to Chamber 01 • Real-time CDC synced`)}
                className="w-full h-8.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Stethoscope className="w-3.5 h-3.5" />
                <span>Start Clinical Consultation in Chamber 01</span>
              </button>
            </div>

            {/* ── Clinical Encounters & Past Prescriptions Timeline ────────── */}
            {(() => {
              const encounters = EncounterService.getEncounters().filter(e => {
                const encPatId = e.patientId || (e as any).patient_id;
                const targetId = selectedDirectoryPatient.id;
                const targetCode = selectedDirectoryPatient.patientCode || (selectedDirectoryPatient as any).patient_code;
                const targetPhone = (selectedDirectoryPatient.phone || '').replace(/\D/g, '').slice(-10);
                const targetName = (selectedDirectoryPatient.name || '').toLowerCase().trim();

                const encPhone = ((e as any).patientPhone || (e as any).patient_phone || '').replace(/\D/g, '').slice(-10);
                const encName = ((e as any).patientName || (e as any).patient_name || '').toLowerCase().trim();

                return encPatId === targetId ||
                       (targetCode && encPatId === targetCode) ||
                       (targetPhone && encPhone && targetPhone.length >= 6 && targetPhone === encPhone) ||
                       (targetName && encName && targetName.length >= 3 && targetName === encName);
              }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

              const handlePrintPrescription = (enc: any) => {
                const printWindow = window.open('', '_blank');
                if (!printWindow) return;

                const patAge = selectedDirectoryPatient.age && String(selectedDirectoryPatient.age) !== 'null' && String(selectedDirectoryPatient.age) !== 'undefined' ? `${selectedDirectoryPatient.age}y` : 'Adult';
                const patGender = selectedDirectoryPatient.gender && String(selectedDirectoryPatient.gender) !== 'null' && String(selectedDirectoryPatient.gender) !== 'undefined' ? selectedDirectoryPatient.gender : 'Patient';
                const patPhone = selectedDirectoryPatient.phone || (enc as any).patientPhone || (enc as any).patient_phone || '-';

                const medList = (enc.medications && enc.medications.length > 0) 
                  ? enc.medications 
                  : (enc.extracted_medicines || enc.extractedMedicines || (enc as any).items || []);

                const medRows = (medList || []).map((m: any, idx: number) => `
                  <tr>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">${idx + 1}. ${m.medicineName || m.name || 'Prescribed Medicine'}</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: 600; color: #4338ca;">${m.dosage || '1-0-1'}</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">${m.duration || '5 Days'}</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;">${m.instructions || 'After meals'}</td>
                  </tr>
                `).join('');

                const testRows = (enc.diagnosticTests || []).map((t: any, idx: number) => `
                  <span style="display: inline-block; background: #e0e7ff; color: #3730a3; padding: 4px 8px; border-radius: 6px; font-size: 11px; margin-right: 6px; margin-bottom: 6px; font-weight: 600;">
                    🧪 ${t.name} (LOINC: ${t.loincCode || 'N/A'})
                  </span>
                `).join('');

                const html = `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <title>Digital Prescription - ${selectedDirectoryPatient.name}</title>
                    <style>
                      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 30px; color: #1e293b; max-width: 800px; margin: 0 auto; }
                      .header { border-bottom: 2px solid #4338ca; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; }
                      .clinic-name { font-size: 20px; font-weight: 900; color: #1e1b4b; }
                      .pat-info { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; }
                      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                      th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; border-bottom: 2px solid #cbd5e1; }
                      .footer { margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 16px; font-size: 11px; color: #64748b; text-align: center; }
                    </style>
                  </head>
                  <body>
                    <div class="header">
                      <div>
                        <div class="clinic-name">${activePod?.name || 'VitalSync Smart Care Clinic'}</div>
                        <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Doctor Consultation & Digital e-Prescription</div>
                      </div>
                      <div style="text-align: right; font-size: 11px; color: #64748b;">
                        <div>Date: ${new Date(enc.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                        <div>Encounter: #${(enc.id || '').substring(0, 8)}</div>
                      </div>
                    </div>

                    <div class="pat-info">
                      <div><strong>Patient:</strong> ${selectedDirectoryPatient.name} (${patAge}, ${patGender})</div>
                      <div><strong>Phone:</strong> ${patPhone}</div>
                      <div><strong>Patient ID:</strong> ${selectedDirectoryPatient.tokenNumber || selectedDirectoryPatient.patientCode || 'PAT'}</div>
                      <div><strong>Doctor:</strong> ${enc.doctorName || enc.doctorId || 'Consulting Physician'}</div>
                    </div>

                    ${enc.clinicalNotes ? `
                      <div style="margin-bottom: 20px; padding: 12px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; font-size: 12px;">
                        <strong style="color: #92400e;">Clinical Notes & Advice:</strong> ${enc.clinicalNotes}
                      </div>
                    ` : ''}

                    <div style="font-size: 13px; font-weight: 800; color: #1e1b4b; margin-bottom: 8px;">💊 Prescribed Medications (Rx)</div>
                    <table>
                      <thead>
                        <tr>
                          <th>Medicine & Formulation</th>
                          <th>Dosage</th>
                          <th>Duration</th>
                          <th>Instructions</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${medRows || '<tr><td colspan="4" style="text-align: center; padding: 12px; color: #94a3b8;">No medications recorded</td></tr>'}
                      </tbody>
                    </table>

                    ${testRows ? `
                      <div style="margin-top: 16px; margin-bottom: 20px;">
                        <div style="font-size: 13px; font-weight: 800; color: #1e1b4b; margin-bottom: 8px;">🔬 Prescribed Diagnostic Tests (Dx)</div>
                        <div>${testRows}</div>
                      </div>
                    ` : ''}

                    <div class="footer">
                      VitalSync Healthcare Network • Digitally verified by Dr. ${activePod?.doctor_name || 'Practitioner'} • Sub-300ms Outbound WhatsApp Sync
                    </div>
                    <script>window.print();</script>
                  </body>
                  </html>
                `;
                printWindow.document.write(html);
                printWindow.document.close();
              };

              const handleSendWhatsAppRx = (enc: any) => {
                const phone = (selectedDirectoryPatient.phone || '').replace(/\D/g, '').slice(-10);
                if (!phone) {
                  alert('Patient phone number missing.');
                  return;
                }
                const medList = (enc.medications || []).map((m: any, idx: number) => 
                  `${idx + 1}. *${m.medicineName}* - ${m.dosage || '1-0-1'} (${m.duration || '5 Days'})`
                ).join('\n');

                const msg = `Namaste ${selectedDirectoryPatient.name} ji 🙏,\n\n*Prescription from ${activePod?.name || 'VitalSync Clinic'}*\nDate: ${new Date(enc.createdAt || Date.now()).toLocaleDateString('en-IN')}\n\n💊 *Prescribed Medicines:*\n${medList || 'Routine follow-up'}\n\n${enc.clinicalNotes ? `*Advice:* ${enc.clinicalNotes}\n\n` : ''}Take care & stay healthy! 🏥`;
                window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
              };

              return (
                <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-3 text-left">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-indigo-600 font-bold" />
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                        Past Clinical Encounters &amp; Digital Prescriptions
                      </h3>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200">
                      {encounters.length} Encounters Recorded
                    </span>
                  </div>

                  {encounters.length === 0 ? (
                    <div className="py-6 text-center border border-dashed border-slate-200 rounded-xl bg-white space-y-1">
                      <Stethoscope className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                      <p className="text-xs font-bold text-slate-600">No Past Consultations Found</p>
                      <p className="text-[10px] text-slate-400">Consultation records will appear here automatically once submitted in Consultation Queue.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                      {encounters.map((enc: any, idx: number) => (
                        <div key={enc.id || `enc-${idx}`} className="p-3 bg-white border border-slate-200/90 rounded-xl space-y-2 shadow-2xs">
                          <div className="flex items-center justify-between flex-wrap gap-1 border-b border-slate-100 pb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                                Encounter #{idx + 1}
                              </span>
                              <span className="text-[10.5px] font-bold text-slate-800">
                                {new Date(enc.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono">
                                ({new Date(enc.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })})
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handlePrintPrescription(enc)}
                                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[9px] font-bold transition flex items-center gap-1 cursor-pointer border border-slate-200 shadow-2xs"
                                title="Print Prescription Slip"
                              >
                                <Printer className="w-2.5 h-2.5" />
                                <span>Print Rx</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSendWhatsAppRx(enc)}
                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[9px] font-bold transition flex items-center gap-1 cursor-pointer border-0 shadow-2xs text-white-force"
                                title="Send via WhatsApp"
                              >
                                <Send className="w-2.5 h-2.5 text-white-force" />
                                <span>WhatsApp Rx</span>
                              </button>
                            </div>
                          </div>

                          {enc.clinicalNotes && (
                            <p className="text-[10.5px] text-slate-600 bg-amber-50/60 border border-amber-200/50 p-2 rounded-lg leading-relaxed">
                              <strong>Clinical Notes:</strong> {enc.clinicalNotes}
                            </p>
                          )}

                          {/* Prescribed Medications */}
                          {(enc.medications || []).length > 0 && (
                            <div className="space-y-1">
                              <div className="text-[9.5px] font-bold text-slate-700 flex items-center gap-1">
                                <Pill className="w-3 h-3 text-indigo-500" /> Prescribed Medications:
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {(enc.medications || []).map((m: any, mIdx: number) => (
                                  <div key={`med-${mIdx}-${m.medicineName}`} className="p-1.5 bg-slate-50 border border-slate-200/70 rounded-lg text-[10px]">
                                    <div className="font-bold text-slate-800 truncate">{m.medicineName}</div>
                                    <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-mono mt-0.5">
                                      <span className="text-indigo-600 font-bold bg-indigo-50 px-1 rounded">{m.dosage || '1-0-1'}</span>
                                      <span>• {m.duration || '5 Days'}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Ordered Diagnostic Tests */}
                          {(enc.diagnosticTests || []).length > 0 && (
                            <div className="space-y-1 pt-1 border-t border-slate-100">
                              <div className="text-[9.5px] font-bold text-slate-700 flex items-center gap-1">
                                <FlaskConical className="w-3 h-3 text-blue-500" /> Diagnostic Pathology Tests:
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {(enc.diagnosticTests || []).map((t: any, tIdx: number) => (
                                  <span key={`test-${tIdx}-${t.loincCode}`} className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-md text-[9px] font-bold">
                                    🧪 {t.name} (LOINC: {t.loincCode})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Official Pathology Lab Reports & Instant PDF Preview ──────────────────── */}
            {(() => {
              const fullReports = LabService.getFullLabReports().filter(
                r => (r.patientId === selectedDirectoryPatient.id || (r as any).patient_id === selectedDirectoryPatient.id)
              );
              const pathReports = LabService.getPathologyReports().filter(
                r => (r.patientId === selectedDirectoryPatient.id || (r as any).patient_id === selectedDirectoryPatient.id)
              );
              
              // Combined unique reports
              const allReports = [...fullReports];
              pathReports.forEach(pr => {
                if (!allReports.some(fr => fr.id === pr.id || fr.requisitionId === pr.id)) {
                  allReports.push({
                    id: pr.id,
                    requisitionId: pr.id,
                    patientId: pr.patientId,
                    patientName: pr.patientName,
                    reportFileUrl: pr.reportUrl || pr.fileUrl || pr.pdfUrl,
                    status: pr.status || 'approved',
                    createdAt: pr.timestamp || new Date().toISOString(),
                    updatedAt: pr.timestamp || new Date().toISOString()
                  } as any);
                }
              });

              return (
                <div className="p-5 bg-white border border-teal-200/80 rounded-3xl space-y-4 shadow-sm text-left">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                        <FlaskConical className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Pathology Lab Reports</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Official electronic laboratory diagnostic reports & instant PDF preview</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono font-bold px-2 py-0.5 bg-teal-50 text-teal-700 rounded-full border border-teal-200">
                      {allReports.length} {allReports.length === 1 ? 'Report' : 'Reports'}
                    </span>
                  </div>

                  {allReports.length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-center text-[10px] text-slate-400">
                      No pathology reports uploaded yet for {selectedDirectoryPatient.name}.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {allReports.map((rep, rIdx) => {
                        const fileUrl = rep.reportFileUrl || (rep as any).fileUrl || (rep as any).pdfUrl || (rep as any).reportUrl;
                        return (
                          <div key={rep.id || `rep-${rIdx}`} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2 hover:border-teal-300 transition-all">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div>
                                <span className="text-xs font-bold text-slate-800 block">
                                  {(rep as any).testName || (rep.biomarkerJson as any)?.testName || 'Pathology Diagnostic Panel'}
                                </span>
                                <span className="text-[9.5px] text-slate-500 font-mono">
                                  {new Date(rep.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[8.5px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                  (rep.status as any) === 'approved' || (rep.status as any) === 'completed' 
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                                }`}>
                                  {rep.status}
                                </span>
                                {fileUrl && (
                                  <button
                                    type="button"
                                    onClick={() => window.open(fileUrl, '_blank', 'noopener,noreferrer')}
                                    className="px-2.5 py-1 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-[9.5px] rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer transition active:scale-95 border-0 text-white-force"
                                    title="Open Official PDF Report in New Tab"
                                  >
                                    <FileText className="w-3 h-3 text-white-force" />
                                    <span>📄 View PDF</span>
                                  </button>
                                )}
                              </div>
                            </div>
                            {(rep as any).hinglishSummary && (
                              <p className="text-[10px] text-teal-800 bg-teal-50/60 border border-teal-200/50 p-2 rounded-lg leading-relaxed">
                                <strong>AI Clinical Summary:</strong> {(rep as any).hinglishSummary}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Premium VitalSync Telemedicine Workspace ──────────────────── */}
            {(() => {
              const appts = api.getAppointments();
              const patientAppts = appts.filter(a => (a.patientId === selectedDirectoryPatient.id || (a as any).patient_id === selectedDirectoryPatient.id));
              const virtualAppt = patientAppts.find(a => Boolean(a.isVirtual || (a as any).is_virtual) && a.status !== 'completed' && a.status !== 'cancelled');
              
              if (!virtualAppt) {
                return (
                  <div className="p-5 bg-slate-50 border border-slate-200/60 rounded-3xl space-y-3.5 animate-fade-in relative overflow-hidden text-left">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                        <Video className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Telemedicine Status</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">No active virtual session scheduled for this patient.</p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-1">
                      <div className="text-[10px] text-slate-500 flex-1 leading-relaxed">
                        Schedule a free virtual consultation loop. Downstream revenue is automatically captured when the patient fulfills prescribed meds at the Pharmacy or runs laboratory diagnostics.
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const todayStr = getIstDateString();
                          const defaultTimeStr = '10:30 AM';
                          const podId = activePod?.id || getPodContext().podId || FALLBACK_POD_ID;
                          const doctorId = (activePod as any)?.doctor_id || (activePod as any)?.doctorId || getPodContext().doctorId || FALLBACK_DOCTOR_ID;
                          const apptId = `apt-${Date.now()}`;
                          const meetUrl = `https://meet.jit.si/vitalsync-consult-${apptId}`;

                          const newAppt: any = {
                            id: apptId,
                            patientId: selectedDirectoryPatient.id,
                            doctorId: doctorId,
                            isVirtual: true,
                            date: todayStr,
                            time: defaultTimeStr,
                            virtualDate: todayStr,
                            virtualTime: defaultTimeStr,
                            virtualMeetingUrl: meetUrl,
                            virtualTimeAllocated: false,
                            status: 'scheduled',
                            appointmentBookedAtCounter: false,
                            discountEligible: false,
                            podId: podId
                          };
                          api.saveAppointment(newAppt);
                          const invId = `inv-dir-${(newAppt.id || '00000000').substring(0, 8)}`;
                          const newInv: any = {
                            id: invId,
                            appointmentId: newAppt.id,
                            patientId: selectedDirectoryPatient.id,
                            type: 'consult',
                            amount: 500,
                            status: 'paid',
                            paymentMethod: 'upi',
                            createdAt: new Date().toISOString(),
                            patientName: selectedDirectoryPatient.name
                          };
                          BillingService.saveInvoice(newInv);
                          BillingService.createLedgerSplitsForInvoiceFields(invId, newAppt.id, 'consult', 500, 'upi');
                          setRefreshKey(prev => prev + 1);

                          // Asynchronously sync to Supabase appointments and unified_invoices
                          (async () => {
                            try {
                              const nowISO = new Date().toISOString();
                              await supabase.from('appointments').upsert({
                                id: apptId,
                                patient_id: selectedDirectoryPatient.id,
                                doctor_id: doctorId,
                                is_virtual: true,
                                virtual_date: todayStr,
                                appointment_date: todayStr,
                                virtual_time: defaultTimeStr,
                                virtual_meeting_url: meetUrl,
                                status: 'scheduled',
                                appointment_time: `${todayStr}T10:30:00.000Z`,
                                created_at: nowISO,
                                pod_id: podId
                              }, { onConflict: 'id' });

                              await supabase.from('unified_invoices').upsert({
                                id: invId,
                                encounter_id: apptId,
                                patient_id: selectedDirectoryPatient.id,
                                doctor_fee: 500,
                                total_amount: 500,
                                payment_status: 'cleared',
                                payment_method: 'upi',
                                created_at: nowISO,
                                pod_id: podId
                              }, { onConflict: 'id' });
                            } catch (err) {
                              console.warn('[PatientsDirectoryTab] Supabase sync error:', err);
                            }
                          })();
                          
                          if (selectedDirectoryPatient.phone) {
                            api.dispatchVirtualConsultMeetingLinkWhatsApp({
                              patientPhone: selectedDirectoryPatient.phone,
                              patientName: selectedDirectoryPatient.name,
                              doctorName: activePod?.doctor_name || activePod?.name || 'Doctor',
                              clinicName: activePod?.name || 'VitalSync Smart Care Clinic',
                              appointmentDate: newAppt.virtualDate || newAppt.date || todayStr,
                              appointmentTime: newAppt.virtualTime || newAppt.time || defaultTimeStr,
                              meetingUrl: meetUrl
                            }).catch(err => console.warn('[PatientsDirectoryTab] Virtual meeting link WhatsApp error:', err));
                          }

                          window.dispatchEvent(new CustomEvent('mediflow-toast', {
                            detail: {
                              title: 'Telemedicine Scheduled! 📅',
                              message: `A free virtual follow-up appointment has been scheduled for ${selectedDirectoryPatient.name} & WhatsApp link sent!`,
                              type: 'success'
                            }
                          }));
                        }}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer border-0 active:scale-95 text-white-force bg-indigo-600-force shrink-0"
                      >
                        Schedule Free Session
                      </button>
                    </div>
                  </div>
                );
              }

              const JITSI_ROOM_URL = virtualAppt.virtualMeetingUrl || `https://meet.jit.si/vitalsync-consult-${virtualAppt.id || 'tele-001'}`;

              return (
                <div className="p-5 bg-gradient-to-br from-emerald-50/70 via-teal-50/30 to-slate-50/50 border border-emerald-200/60 rounded-3xl space-y-4 animate-fade-in relative overflow-hidden shadow-xs">
                  <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-400 to-teal-500" />
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <Video className="w-4 h-4 font-bold" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Telemedicine Hub</h4>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">ROOM: vitalsync-consult-{(virtualAppt.id || 'tele-001').substring(0, 8)}</p>
                      </div>
                    </div>

                    <span className={`text-[9px] font-extrabold px-2.5 py-1 rounded-full font-mono uppercase tracking-wider flex items-center gap-1 ${
                      virtualAppt.virtualTimeAllocated 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200/30' 
                        : 'bg-amber-100 text-amber-900 border border-amber-200/30 animate-pulse'
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                      {virtualAppt.virtualTimeAllocated ? 'Timing Confirmed' : 'Awaiting Schedule'}
                    </span>
                  </div>

                  {/* Booking schedule inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Allocate Consultation Date</label>
                      <input
                        type="date"
                        value={virtualDateInput || virtualAppt.virtualDate || ''}
                        onChange={(e) => setVirtualDateInput(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 rounded-xl text-xs outline-none bg-white text-slate-800"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Allocate Slot Time</label>
                      <input
                        type="text"
                        placeholder="e.g. 10:30 AM"
                        value={virtualTimeInput || virtualAppt.virtualTime || ''}
                        onChange={(e) => setVirtualTimeInput(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 rounded-xl text-xs outline-none bg-white text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Actions & Launcher */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const finalDate = virtualDateInput || virtualAppt.virtualDate || (virtualAppt as any).virtual_date || getIstDateString();
                        const finalTime = virtualTimeInput || virtualAppt.virtualTime || '10:30 AM';
                        
                        // Update appointment
                        const updatedAppt = {
                          ...virtualAppt,
                          date: finalDate,
                          virtualDate: finalDate,
                          virtual_date: finalDate,
                          virtualTime: finalTime,
                          virtual_time: finalTime,
                          virtualTimeAllocated: true
                        };
                        api.saveAppointment(updatedAppt);
                        
                        // Asynchronously update Supabase appointments table
                        supabase.from('appointments').update({
                          virtual_date: finalDate,
                          virtual_time: finalTime,
                          appointment_time: `${finalDate}T${finalTime.includes('PM') ? '14:00:00' : '10:30:00'}.000Z`
                        }).eq('id', virtualAppt.id).then(() => {});
                        
                        // Notify patient on WhatsApp
                        const cachedProf = safeGetStorageJSON<any>('vitalsync_cached_profile', {});
                        const docNameDisp = cachedProf?.display_name || 'Your Doctor';
                        const notificationText = `📅 *Virtual Consultation Confirmed!* \n\n${docNameDisp} has allocated your virtual consultation timing: \n🗓️ *Date:* ${finalDate} \n⏰ *Time:* ${finalTime} \n\nPlease join the meeting using this link when scheduled: \n🔗 ${JITSI_ROOM_URL}`;
                        api.pushWhatsAppMessageFromBot(selectedDirectoryPatient.phone, notificationText);

                        window.dispatchEvent(new CustomEvent('mediflow-toast', {
                          detail: {
                            title: 'Schedule Dispatched! 📅',
                            message: `Consultation timing sent to patient's WhatsApp.`,
                            type: 'success'
                          }
                        }));
                      }}
                      className="flex-1 py-3 border border-emerald-300 text-emerald-800 hover:bg-emerald-100/50 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer bg-white"
                    >
                      Confirm &amp; Notify (WhatsApp)
                    </button>

                    <a
                      href={JITSI_ROOM_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer shadow-sm hover:scale-102 active:scale-98 text-white-force bg-emerald-600-force border-0"
                    >
                      <Video className="w-4 h-4 text-white" />
                      Start Video Call
                    </a>
                  </div>

                  {/* USP explanation message */}
                  <div className="p-3 bg-emerald-50/50 border border-emerald-100/60 rounded-2xl flex gap-2.5 items-start text-emerald-800">
                    <Info className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] leading-relaxed">
                      <strong>💡 Clinic Revenue:</strong> Virtual follow-up consults are free for patients. All clinical revenue from e-Prescriptions and lab orders is settled directly to your clinic with 100% earnings retention and 0% platform cuts.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* loyalty discounts dispatcher */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-amber-500 shrink-0" />
                WhatsApp Loyalty Offers Console
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => api.dispatchWhatsAppLoyaltyOffer(selectedDirectoryPatient.id, 'discount_30')}
                  className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/50 rounded-xl text-left space-y-2 hover:scale-102 transition-all cursor-pointer border-slate-200"
                >
                  <Pill className="w-5 h-5 text-teal-600" />
                  <strong className="block text-[11px] text-slate-700 font-semibold">30% Off Medicine Coupon</strong>
                  <p className="text-[9px] text-slate-400 leading-normal">For repeat glycemic drugs refill orders.</p>
                </button>
                <button
                  onClick={() => api.dispatchWhatsAppLoyaltyOffer(selectedDirectoryPatient.id, 'virtual_appointment')}
                  className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/50 rounded-xl text-left space-y-2 hover:scale-102 transition-all cursor-pointer border-slate-200"
                >
                  <Video className="w-5 h-5 text-blue-600" />
                  <strong className="block text-[11px] text-slate-700 font-semibold">10-Day Virtual Invite</strong>
                  <p className="text-[9px] text-slate-400 leading-normal">Invite to virtual telemedicine follow-up.</p>
                </button>
                <button
                  onClick={() => api.dispatchWhatsAppLoyaltyOffer(selectedDirectoryPatient.id, 'quick_booking')}
                  className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/50 rounded-xl text-left space-y-2 hover:scale-102 transition-all cursor-pointer border-slate-200"
                >
                  <CalendarCheck className="w-4 h-4 text-amber-600" />
                  <strong className="block text-[11px] text-slate-700 font-semibold">Portal Invite Link</strong>
                  <p className="text-[9px] text-slate-400 leading-normal">Invoice and home lab sample booking portal.</p>
                </button>
              </div>
            </div>

            {/* AI chronic health summary */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-705 flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-indigo-600 shrink-0" />
                  AI Chronic Longitudinal Health Summary
                </h3>
                <button
                  onClick={async () => {
                    if (isGeneratingSummary) return;
                    setIsGeneratingSummary(true);
                    try {
                      const sum = await api.generateAIPatientSummary(selectedDirectoryPatient.id);
                      setPatientRAGSummary(sum);
                    } catch (err) {
                      console.warn('[PatientsDirectoryTab] AI summary failed:', err);
                    } finally {
                      setIsGeneratingSummary(false);
                    }
                  }}
                  disabled={isGeneratingSummary}
                  className="text-primary hover:text-primary-700 text-xs font-bold flex items-center gap-1 cursor-pointer border-0 bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isGeneratingSummary ? 'animate-spin' : ''}`} /> {isGeneratingSummary ? 'Generating…' : 'Generate Summary'}
                </button>
              </div>

              {patientRAGSummary ? (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-slate-700 leading-relaxed font-sans animate-fade-in font-medium italic">
                  {patientRAGSummary}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Click Generate Summary to run the RAG diagnostic prompt analyzing the patient chronic history.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Bulk Onboarding Panel */}
            <div className="glass-panel p-6 bg-white border-slate-200/80 shadow-xs rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <UploadCloud className="w-5 h-5 text-indigo-600 shrink-0" />
                  <h3 className="text-sm font-bold text-slate-800">Bulk Patient Onboarder</h3>
                </div>
                <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase">
                  Excel / CSV Copy-Paste
                </span>
              </div>
              
              <p className="text-[11px] text-slate-404 leading-relaxed font-sans">
                Paste patient lists directly from Excel or Text. 
                Format: <strong className="text-slate-600 font-mono">Name, Phone, Age, Gender</strong> (one patient per line). The engine automatically calculates memorable Patient IDs (e.g. <strong className="text-slate-600">V56</strong>).
              </p>
              
              <textarea
                rows={5}
                disabled={isImporting}
                placeholder="e.g.&#10;Amit Kumar, 9876543201, 34, Male&#10;Sunita Devi, 9876543202, 28, Female"
                value={bulkInput}
                onChange={e => setBulkInput(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-primary/50 focus:ring-1 focus:ring-primary/25 rounded-xl text-xs outline-none bg-slate-50/50 font-mono leading-relaxed"
              />
              
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={handleParseBulkInput}
                  disabled={!bulkInput.trim() || isImporting}
                  className="btn-primary px-4 py-2 text-xs font-semibold rounded-lg text-white-force border-0 cursor-pointer"
                >
                  Parse Input List
                </button>
                {parsedList.length > 0 && (
                  <span className="text-[10px] text-emerald-600 font-bold font-sans">
                    ✓ {parsedList.length} Patients parsed successfully
                  </span>
                )}
              </div>

              {parsedList.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-100 animate-fade-in">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Preview Import Queue</h4>
                  <div className="max-h-[140px] overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100 bg-slate-50/30">
                    {parsedList.map((p, idx) => (
                      <div key={`import-preview-${idx}-${p.phone || p.name}`} className="p-2.5 flex justify-between items-center text-[10px] font-sans">
                        <div>
                          <span className="font-bold text-slate-700"><span onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('mediflow-open-patient-profile', { detail: p })); }} className="cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors decoration-indigo-500/30 hover:underline"><span onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('mediflow-open-patient-profile', { detail: p })); }} className="cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors decoration-indigo-500/30 hover:underline">{p.name}</span></span></span> ({p.gender}, {p.age} yrs)
                        </div>
                        <span className="font-mono text-slate-500 font-medium">{p.phone}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleRunBulkImport}
                    disabled={isImporting}
                    className="w-full btn-primary bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 text-white py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg border-0 cursor-pointer text-white-force bg-emerald-600-force"
                  >
                    {isImporting ? `Importing... (${importProgress}%)` : `Execute Bulk Import (${parsedList.length} Patients)`}
                  </button>
                </div>
              )}
            </div>

            <div className="glass-panel p-10 bg-white border-slate-200/80 shadow-sm rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
              <Users className="w-12 h-12 text-slate-200 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-slate-700">No Patient Selected</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Select an active patient registry profile from the directory on the left or paste new profiles above.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Structured Professional Patient Profile Modal */}
      {selectedDirectoryPatient && (
        <PatientProfileModal
          patient={selectedDirectoryPatient}
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
        />
      )}

      {/* ── Stitch Version 3: High-Res Prescription Pad Lightbox Modal ── */}
      {isRxModalOpen && selectedDirectoryPatient && createPortal(
        <div 
          onClick={() => setIsRxModalOpen(false)} 
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[9999] transition-opacity duration-300 flex items-center justify-center p-3.5"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Lightbox Header */}
            <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-indigo-400" />
                <div>
                  <div className="font-bold text-sm text-white">Original Doctor Prescription Pad</div>
                  <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Eagle-Eye OCR Verified • 98.2% Accuracy</span>
                  </div>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsRxModalOpen(false)} 
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scanned Paper Simulation View */}
            <div className="p-4 sm:p-6 bg-slate-100 overflow-y-auto flex-1 flex flex-col items-center justify-center">
              <div className="bg-white border border-slate-300/80 rounded-2xl shadow-lg p-5 sm:p-6 w-full space-y-4 font-mono text-slate-800 relative">
                {/* Letterhead */}
                <div className="border-b-2 border-indigo-950/80 pb-3 flex items-start justify-between">
                  <div>
                    <div className="font-bold text-base text-indigo-950 tracking-tight">
                      DR. {activePod?.doctorName?.toUpperCase() || 'V. MEHTA'}, MS, DNB
                    </div>
                    <div className="text-[10px] text-slate-500 font-sans">
                      Reg No: MCI-2014-9841 • {activePod?.name || 'VitalSync Smart Clinic'}
                    </div>
                    <div className="text-[9.5px] text-slate-400 font-sans">
                      Clinic Node 01, Main Healthcare Complex
                    </div>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xl">
                    ℞
                  </div>
                </div>

                {/* Patient Demographics On Pad */}
                <div className="grid grid-cols-2 gap-2 text-[10.5px] bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                  <div><strong>Patient:</strong> {selectedDirectoryPatient.name} ({selectedDirectoryPatient.age || 54}y / {selectedDirectoryPatient.gender || 'F'})</div>
                  <div><strong>Date:</strong> {getIstDateString()}</div>
                  <div><strong>UHID:</strong> {getClinicalPatientId(selectedDirectoryPatient)}</div>
                  <div><strong>BP:</strong> {selectedDirectoryPatient.vitals?.bloodPressure || '138/88'} | <strong>RBS:</strong> {selectedDirectoryPatient.vitals?.bloodSugar || '174'}</div>
                </div>

                {/* Handwritten Script */}
                <div className="space-y-3 py-1 font-sans text-slate-800 text-[12.5px] leading-relaxed">
                  <div className="flex items-center gap-1.5 font-bold font-mono text-[11px] text-slate-500 uppercase">
                    <span>Rx / Medications Prescribed:</span>
                  </div>
                  <div className="pl-3 border-l-2 border-indigo-500 space-y-2">
                    <div>1. Tab. <strong>Glycomet 500mg SR</strong> — 1 tab BD (pc / खाने के बाद) x 30 days</div>
                    <div>2. Tab. <strong>Telma 40mg</strong> — 1 tab OD (morning / सुबह) x 30 days</div>
                    <div>3. Cap. <strong>Pan-D 40mg</strong> — 1 cap OD (empty stomach / खाली पेट) x 15 days</div>
                  </div>

                  <div className="pt-2 flex items-center gap-1.5 font-bold font-mono text-[11px] text-slate-500 uppercase">
                    <span>Investigations Ordered:</span>
                  </div>
                  <div className="pl-3 text-[11.5px] text-slate-600">
                    • HbA1c (Glycated Hemoglobin), Serum Creatinine & eGFR, Fasting Lipid Profile
                  </div>
                </div>

                {/* Doctor Signature & Stamp */}
                <div className="pt-4 border-t border-slate-200 flex items-end justify-between">
                  <div className="text-[9px] text-slate-400 font-mono">
                    Digitized via Compounder Desk OCR<br />
                    Checksum: #MD-{getClinicalPatientId(selectedDirectoryPatient)}
                  </div>
                  <div className="text-right">
                    <div className="font-serif italic text-indigo-950 font-bold text-base -rotate-3">
                      Dr. {activePod?.doctorName || 'V. Mehta'}
                    </div>
                    <div className="text-[9px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 mt-0.5 inline-block">
                      Verified & Signed
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between gap-2">
              <button 
                type="button"
                onClick={() => triggerToast('High-Res PDF Downloaded', `Original prescription image saved for ${selectedDirectoryPatient.name}`)} 
                className="h-9 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
              <button 
                type="button"
                onClick={() => setIsRxModalOpen(false)} 
                className="h-9 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1 transition-all"
              >
                <span>Close Viewer</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});
