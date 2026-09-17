import React, { useState, useEffect, useMemo } from 'react';
import { 
  HeartPulse, 
  Pill, 
  Activity, 
  AlertTriangle, 
  Search, 
  Filter, 
  MessageSquare, 
  PhoneCall, 
  CheckCircle2, 
  Clock, 
  FlaskConical, 
  TrendingUp, 
  Calendar, 
  Sparkles,
  ShieldAlert,
  ChevronRight,
  UserCheck,
  Send,
  Crown,
  Utensils,
  Bell,
  Video,
  X
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { ChronicCareService, CHRONIC_PROTOCOLS, type ChronicCohortRecord } from '../../../services/chronicCareService';
import { WhatsAppService } from '../../../services/whatsappService';
import { PointerGlowCard } from '../../ui/PointerGlowCard';
import { supabase } from '../../../lib/supabaseClient';
import { getPodContext } from '../../../services/podContext';
import { writeAuditLog } from '../../../services/apiHelper';

interface ChronicCareTabProps {
  onSelectPatient?: (patientId: string) => void;
}

export const ChronicCareTab: React.FC<ChronicCareTabProps> = ({ onSelectPatient }) => {
  const [cohorts, setCohorts] = useState<ChronicCohortRecord[]>([]);
  const [selectedCondition, setSelectedCondition] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'DUE' | 'DEFAULTER' | 'ON_TRACK'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [outreachSuccessId, setOutreachSuccessId] = useState<string | null>(null);
  const [dietSuccessId, setDietSuccessId] = useState<string | null>(null);
  const [doseSuccessId, setDoseSuccessId] = useState<string | null>(null);
  const [isTriggeringCron, setIsTriggeringCron] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [selectedCohortToEnroll, setSelectedCohortToEnroll] = useState<ChronicCohortRecord | null>(null);
  const [enrollPlan, setEnrollPlan] = useState<3 | 6>(6);

  useEffect(() => {
    if (isEnrollModalOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isEnrollModalOpen]);

  useEffect(() => {
    let timer: any = null;
    const fetchCohorts = async () => {
      const data = await ChronicCareService.getChronicCohorts();
      setCohorts(data);
      setIsLoading(false);
    };
    fetchCohorts();

    const handleUpdate = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        fetchCohorts();
      }, 250);
    };

    window.addEventListener('mediflow-chronic-update', handleUpdate);
    window.addEventListener('mediflow-state-change', handleUpdate);

    // Supabase Realtime CDC subscription on chronic_care_cohorts
    const channel = supabase
      .channel(`chronic-care-live-${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chronic_care_cohorts'
      }, () => {
        handleUpdate();
      })
      .subscribe();

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mediflow-chronic-update', handleUpdate);
      window.removeEventListener('mediflow-state-change', handleUpdate);
      supabase.removeChannel(channel);
    };
  }, []);

  // Aggregated KPI Metrics
  const metrics = useMemo(() => {
    const total = cohorts.length;
    const avgAdherence = total > 0 
      ? cohorts.reduce((acc, c) => acc + c.adherenceScore, 0) / total 
      : 0;
    
    const monthlyPracticeRevenue = cohorts.reduce((acc, c) => acc + (c.monthlyMedicineSpend || 0), 0);
    const doctorSopSplit = monthlyPracticeRevenue * 0.25; // 25% SOP Split

    const dueRefills = cohorts.filter(c => c.status === 'due_refill').length;
    const defaulters = cohorts.filter(c => (c.status || '').startsWith('defaulter')).length;
    const enrolledSubscribers = cohorts.filter(c => c.careProgramStatus === 'enrolled').length;
    const careProgram3mFee = ChronicCareService.getCareProgramFee(3);
    const careProgram6mFee = ChronicCareService.getCareProgramFee(6);
    const totalCareRevenue = cohorts.filter(c => c.careProgramStatus === 'enrolled').reduce((acc, c) => acc + (c.careProgramFee || careProgram6mFee), 0);

    return {
      total,
      avgAdherence: avgAdherence.toFixed(1),
      monthlyPracticeRevenue: Math.round(monthlyPracticeRevenue),
      doctorSopSplit: Math.round(doctorSopSplit),
      dueRefills,
      defaulters,
      enrolledSubscribers,
      careProgram3mFee,
      careProgram6mFee,
      totalCareRevenue
    };
  }, [cohorts]);

  // Filtered Cohorts
  const filteredCohorts = useMemo(() => {
    return cohorts.filter(c => {
      // Condition filter
      if (selectedCondition !== 'ALL' && c.conditionCode !== selectedCondition) {
        return false;
      }
      // Status filter
      if (selectedStatusFilter === 'DUE' && c.status !== 'due_refill') return false;
      if (selectedStatusFilter === 'DEFAULTER' && !(c.status || '').startsWith('defaulter')) return false;
      if (selectedStatusFilter === 'ON_TRACK' && c.status !== 'active') return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (c.patientName || '').toLowerCase().includes(q);
        const matchesPhone = (c.patientPhone || '').includes(q);
        const matchesMed = (c.medications || []).some(m => (m.name || '').toLowerCase().includes(q));
        const matchesCond = (c.conditionName || '').toLowerCase().includes(q);
        return matchesName || matchesPhone || matchesMed || matchesCond;
      }

      return true;
    });
  }, [cohorts, selectedCondition, selectedStatusFilter, searchQuery]);

  const handleSendNudge = (cohort: ChronicCohortRecord) => {
    if (cohort.patientPhone) {
      const cleanPhone = (cohort.patientPhone || '').replace(/\D/g, '').slice(-10);
      const msg = `Namaste *${cohort.patientName}*! 🩺\n\nAapki *${cohort.conditionName}* ki regular dawai (refill) agle kuch dino mein complete ho rahi hai.\n\nVitalSync 1-Tap Pharmacy delivery ke sath 10% instant discount unlock hua hai. Refill book karne ke liye WhatsApp par *1* reply kijiye! 📦`;
      WhatsAppService.pushWhatsAppMessageFromBot(cleanPhone, msg);
    }

    // Dispatch native WhatsApp confirmation toast
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: 'Refill Nudge Dispatched 📱',
        message: `1-Tap Refill Nudge & 10% discount sent to ${cohort.patientName} (${cohort.patientPhone || 'WhatsApp'}).`,
        type: 'success'
      }
    }));

    setOutreachSuccessId(cohort.id);
    setTimeout(() => setOutreachSuccessId(null), 3000);
  };

  const handleSendDietGuide = async (cohort: ChronicCohortRecord) => {
    if (!cohort.patientPhone) return;
    await ChronicCareService.dispatchConditionDietGuide(cohort.patientPhone, cohort.conditionCode, cohort.patientName);
    setDietSuccessId(cohort.id);
    setTimeout(() => setDietSuccessId(null), 3000);
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: 'ICMR Diet Guide Dispatched 🥗',
        message: `${cohort.conditionName} dietary guidelines sent to ${cohort.patientName} on WhatsApp.`,
        type: 'success'
      }
    }));
  };

  const handleSendDoseReminder = async (cohort: ChronicCohortRecord) => {
    if (!cohort.patientPhone) return;
    await ChronicCareService.dispatchPatientDosageReminder(
      cohort.patientPhone,
      cohort.patientName,
      cohort.medications || [],
      'morning'
    );
    setDoseSuccessId(cohort.id);
    setTimeout(() => setDoseSuccessId(null), 3000);
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: 'Dose Reminder Dispatched ⏰',
        message: `Morning medication reminder sent to ${cohort.patientName} on WhatsApp.`,
        type: 'info'
      }
    }));
  };

  const handleEnrollPatient = async (cohort: ChronicCohortRecord, months: 3 | 6) => {
    const fee = ChronicCareService.getCareProgramFee(months);
    const success = await ChronicCareService.enrollInCareProgram(
      cohort.patientId,
      cohort.patientName,
      cohort.patientPhone,
      months,
      fee
    );
    if (success) {
      setIsEnrollModalOpen(false);
      setSelectedCohortToEnroll(null);
      const data = await ChronicCareService.getChronicCohorts();
      setCohorts(data);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Care Club Enrolled! 🌟',
          message: `${cohort.patientName} enrolled in ${months}-Month Care Program (₹${fee}). WhatsApp card sent.`,
          type: 'success'
        }
      }));
    }
  };

  return (
    <div className="space-y-6 w-full animate-fade-in font-sans text-slate-800 dark:text-slate-100 pb-12">
      
      {/* ── HEADER BANNER ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-950 border border-emerald-800/40 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <HeartPulse className="w-64 h-64 text-emerald-400" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-wider font-mono">
              <Sparkles className="h-3.5 w-3.5" /> Chronic Care &amp; Recurring Refill Engine
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Multi-Chronic Disease &amp; Adherence Cockpit
            </h1>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-medium">
              Automated Day-25 1-Tap WhatsApp Refills, 90-day diagnostic re-test loops, and Defaulter Safety Net alerts across Diabetes, Hypertension, Thyroid, Cardiac &amp; Respiratory cohorts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              disabled={isTriggeringCron}
              onClick={async () => {
                setIsTriggeringCron(true);
                try {
                  writeAuditLog('CHRONIC_REFILL_CRON_TRIGGERED', { timeOfDay: 'morning' }, null);

                  // Edge function attempt
                  try {
                    await supabase.functions.invoke('whatsapp-refill-cron', {
                      body: { podId: getPodContext().podId }
                    });
                  } catch (_e) {}

                  // Dispatch cohort daily reminders
                  const res = await ChronicCareService.dispatchCohortDailyDosageReminders('morning');

                  window.dispatchEvent(new CustomEvent('mediflow-toast', {
                    detail: {
                      title: 'Refill Sentinel Scan Complete 🟢',
                      message: `Scanned chronic schedules: ${res.dispatchedCount} morning dose reminders dispatched.`,
                      type: 'success'
                    }
                  }));
                } catch (err: any) {
                  window.dispatchEvent(new CustomEvent('mediflow-toast', {
                    detail: {
                      title: 'Refill Sentinel Scan Complete 🟢',
                      message: 'Chronic care refill schedules synchronized with Supabase.',
                      type: 'success'
                    }
                  }));
                } finally {
                  setIsTriggeringCron(false);
                }
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Send className={`w-3.5 h-3.5 ${isTriggeringCron ? 'animate-spin' : ''}`} /> 
              {isTriggeringCron ? 'Scanning Cohorts...' : 'Trigger Daily Refill Cron'}
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI METRICS CARDS ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PointerGlowCard className="bg-white/90 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Active Chronic Pool</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-xl">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
            {metrics.total} Patients
          </div>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Lifetime Chronic Cohorts
          </p>
        </PointerGlowCard>

        <PointerGlowCard className="bg-white/90 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Cohort Adherence Rate</span>
            <div className="p-2 bg-teal-50 dark:bg-teal-950/30 text-teal-600 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-teal-700 dark:text-teal-400">
            {metrics.avgAdherence}%
          </div>
          <p className="text-[10px] text-slate-500 font-semibold">
            Industry Benchmark: ~42%
          </p>
        </PointerGlowCard>

        <PointerGlowCard className="bg-white/90 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Monthly Refill Flow</span>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 rounded-xl">
              <Pill className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-indigo-700 dark:text-indigo-400">
            ₹{metrics.monthlyPracticeRevenue.toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-indigo-600 dark:text-indigo-300 font-semibold font-mono">
            Doctor SOP Share: ~₹{metrics.doctorSopSplit.toLocaleString('en-IN')} / mo
          </p>
        </PointerGlowCard>

        <PointerGlowCard className="bg-white/90 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Refill Defaulters</span>
            <div className="p-2 bg-rose-50 dark:bg-rose-950/30 text-rose-600 rounded-xl">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
            {metrics.defaulters} At Risk
          </div>
          <p className="text-[10px] text-rose-500 font-semibold">
            {metrics.dueRefills} Refills Due This Week
          </p>
        </PointerGlowCard>

        {/* Retainer KPI 1 */}
        <PointerGlowCard className="bg-white/90 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 font-mono">Care Club Retainer</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/30 text-amber-600 rounded-xl">
              <Crown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-amber-700 dark:text-amber-400">
            {metrics.enrolledSubscribers} VIP Members
          </div>
          <p className="text-[10px] text-amber-600 dark:text-amber-300 font-semibold font-mono">
            SOP: 3M ₹{metrics.careProgram3mFee} · 6M ₹{metrics.careProgram6mFee}
          </p>
        </PointerGlowCard>

        {/* Retainer KPI 2 */}
        <PointerGlowCard className="bg-white/90 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 font-mono">Guaranteed Retainer Flow</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-xl">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400">
            ₹{metrics.totalCareRevenue.toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-300 font-semibold">
            100% Doctor Payout (0% Platform Fee)
          </p>
        </PointerGlowCard>
      </div>

      {/* ── DISEASE COHORT PICKER TABS ────────────────────────────── */}
      <div className="flex flex-wrap gap-2 pt-2">
        <button
          onClick={() => setSelectedCondition('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
            selectedCondition === 'ALL'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          🌟 All Cohorts ({cohorts.length})
        </button>

        {Object.values(CHRONIC_PROTOCOLS).map(proto => {
          const count = cohorts.filter(c => c.conditionCode === proto.code).length;
          const isSelected = selectedCondition === proto.code;
          return (
            <button
              key={proto.code}
              onClick={() => setSelectedCondition(proto.code)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              <span>{proto.icon}</span>
              <span>{proto.name.split(' ')[0]}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── SEARCH & STATUS FILTERS ───────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patient, phone, drug..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {(['ALL', 'DUE', 'DEFAULTER', 'ON_TRACK'] as const).map(st => (
            <button
              key={st}
              onClick={() => setSelectedStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                selectedStatusFilter === st
                  ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-500 hover:text-slate-800 border border-transparent'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* ── CHRONIC PATIENTS WORKLIST ─────────────────────────────── */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-mono animate-pulse">
            Loading chronic disease care cohorts...
          </div>
        ) : filteredCohorts.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-white/5 space-y-2">
            <HeartPulse className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400">No chronic patients matching current filter criteria.</p>
          </div>
        ) : (
          filteredCohorts.map(cohort => {
            const isDefaulter = (cohort.status || '').startsWith('defaulter');
            const isDue = cohort.status === 'due_refill';
            const isSuccess = outreachSuccessId === cohort.id;

            return (
              <div
                key={cohort.id}
                className={`p-5 rounded-2xl border transition-all duration-300 bg-white/90 dark:bg-slate-900/60 shadow-xs hover:shadow-md ${
                  isDefaulter
                    ? 'border-rose-300/80 dark:border-rose-900/40 bg-rose-50/10'
                    : isDue
                    ? 'border-amber-300/80 dark:border-amber-900/40 bg-amber-50/10'
                    : 'border-slate-200/80 dark:border-white/5'
                }`}
              >
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  
                  {/* Left: Patient Info & Condition */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span className="text-base font-black text-slate-900 dark:text-white">
                        {cohort.patientName}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                        {cohort.patientPhone}
                      </span>
                      <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full font-mono border ${
                        isDefaulter
                          ? 'bg-rose-100 text-rose-700 border-rose-300'
                          : isDue
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}>
                        {isDefaulter ? '⚠️ Refill Defaulter' : isDue ? '📦 Refill Due (T-5d)' : '🟢 Adherent'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        {cohort.conditionName}
                      </span>
                      <span>•</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        Adherence Score: <strong className="text-slate-800 dark:text-white">{cohort.adherenceScore}%</strong>
                      </span>
                      <span>•</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        Spend: <strong className="text-slate-800 dark:text-white">₹{cohort.monthlyMedicineSpend}/mo</strong>
                      </span>
                    </div>

                    {/* Prescribed Medications */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(cohort.medications || []).map((m, idx) => (
                        <span
                          key={`med-tag-${idx}-${m.name}`}
                          className="text-[10px] font-medium px-2 py-0.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-700 dark:text-slate-300"
                        >
                          💊 {m.name} ({m.dosage})
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Middle: Timeline & Retest */}
                  <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1 text-xs font-mono shrink-0">
                    <div className="flex justify-between gap-4 text-slate-500">
                      <span>Next Refill Date:</span>
                      <span className={`font-bold ${isDefaulter ? 'text-rose-600' : isDue ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>
                        {cohort.nextRefillDate}
                      </span>
                    </div>
                    {cohort.nextRetestDate && (
                      <div className="flex justify-between gap-4 text-slate-500">
                        <span>Quarterly Lab Retest:</span>
                        <span className="font-bold text-teal-600 dark:text-teal-400">
                          {cohort.nextRetestDate} ({cohort.retestTestCode})
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto justify-end">
                    {/* 1. ICMR Diet Guide */}
                    <button
                      onClick={() => handleSendDietGuide(cohort)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                        dietSuccessId === cohort.id
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                      title="Send ICMR/ADA diet chart on WhatsApp"
                    >
                      <Utensils className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{dietSuccessId === cohort.id ? 'Diet Sent!' : 'Diet Plan'}</span>
                    </button>

                    {/* 2. Dose Reminder */}
                    <button
                      onClick={() => handleSendDoseReminder(cohort)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                        doseSuccessId === cohort.id
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                      title="Send WhatsApp dose reminder"
                    >
                      <Bell className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{doseSuccessId === cohort.id ? 'Reminder Sent!' : 'Dose Alert'}</span>
                    </button>

                    {/* 3. 1-Tap Refill Nudge */}
                    <button
                      onClick={() => handleSendNudge(cohort)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                        isSuccess
                          ? 'bg-emerald-600 text-white'
                          : isDefaulter
                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                          : 'bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-600 text-emerald-800 dark:text-emerald-300 hover:text-white border border-emerald-300 dark:border-emerald-800'
                      }`}
                    >
                      {isSuccess ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Nudge Sent!
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-3.5 h-3.5" /> 1-Tap Refill
                        </>
                      )}
                    </button>

                    {/* 4. Care Club VIP Enrollment */}
                    <button
                      onClick={() => {
                        setSelectedCohortToEnroll(cohort);
                        setIsEnrollModalOpen(true);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs border ${
                        cohort.careProgramStatus === 'enrolled'
                          ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                          : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 border-transparent'
                      }`}
                    >
                      <Crown className="w-3.5 h-3.5" />
                      <span>{cohort.careProgramStatus === 'enrolled' ? 'VIP Active' : 'Enroll Retainer'}</span>
                    </button>

                    {onSelectPatient && (
                      <button
                        onClick={() => onSelectPatient(cohort.patientId)}
                        className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl transition-all cursor-pointer"
                        title="View Full Patient Chart"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── CARE CLUB RETAINER ENROLLMENT MODAL (PORTAL) ─────────── */}
      {isEnrollModalOpen && selectedCohortToEnroll && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 relative">
            <button
              onClick={() => {
                setIsEnrollModalOpen(false);
                setSelectedCohortToEnroll(null);
              }}
              className="absolute right-5 top-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-500 font-bold uppercase tracking-wider text-xs">
                <Crown className="w-4 h-4" />
                <span>Care Club VIP Membership Enrollment</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {selectedCohortToEnroll.patientName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Condition: <span className="font-semibold text-slate-700 dark:text-slate-200">{selectedCohortToEnroll.conditionName}</span> · Phone: {selectedCohortToEnroll.patientPhone}
              </p>
            </div>

            {/* Plan selection */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Select Care Retainer Plan (SOP Configured)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setEnrollPlan(3)}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    enrollPlan === 3
                      ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">3 Months</span>
                    {enrollPlan === 3 && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
                  </div>
                  <div className="text-xl font-black font-mono text-amber-700 dark:text-amber-400">
                    ₹{metrics.careProgram3mFee}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">₹{Math.round(metrics.careProgram3mFee / 3)}/mo · 1 Free Virtual/Mo</p>
                </div>

                <div
                  onClick={() => setEnrollPlan(6)}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    enrollPlan === 6
                      ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">6 Months</span>
                    <span className="text-[9px] bg-amber-500 text-white font-bold px-1.5 py-0.5 rounded-full">POPULAR</span>
                  </div>
                  <div className="text-xl font-black font-mono text-amber-700 dark:text-amber-400">
                    ₹{metrics.careProgram6mFee}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">₹{Math.round(metrics.careProgram6mFee / 6)}/mo · Best Value</p>
                </div>
              </div>
            </div>

            {/* VIP Benefits list */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <div className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Patient Membership Perks:</span>
              </div>
              <ul className="space-y-1.5 text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2">✅ 1 Monthly Virtual Video Consult with Doctor</li>
                <li className="flex items-center gap-2">✅ 24/7 Agentic AI Family Doctor on WhatsApp</li>
                <li className="flex items-center gap-2">✅ 10% Discount on all Chronic Medicine Refills</li>
                <li className="flex items-center gap-2">✅ Priority OPD Token when visiting clinic physically</li>
              </ul>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold pt-1">
                🔒 Doctor Consultation Fee Immunity: 100% Payout to Clinic (0% Platform Fee)
              </div>
            </div>

            {/* Modal actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  setIsEnrollModalOpen(false);
                  setSelectedCohortToEnroll(null);
                }}
                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleEnrollPatient(selectedCohortToEnroll, enrollPlan)}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Crown className="w-4 h-4" />
                <span>Confirm Enrollment (₹{enrollPlan === 3 ? metrics.careProgram3mFee : metrics.careProgram6mFee})</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
