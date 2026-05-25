import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { supabase } from '../../lib/supabaseClient';
import { 
  Activity, 
  UserPlus, 
  Stethoscope, 
  Beaker, 
  ShoppingBag, 
  QrCode,
  LogOut,
  ShieldCheck,
  ShieldAlert,
  Terminal,
  ChevronUp,
  ChevronDown,
  Smartphone
} from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';

export type UserRole = 'compounder' | 'doctor' | 'lab' | 'pharmacy' | 'billing' | 'patient';

interface NavbarProps {
  currentRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  activeProfile: any;
  onSignOut: () => void;
  isBypassMode: boolean;
  onToggleBypass: (bypass: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  currentRole, 
  onChangeRole, 
  activeProfile, 
  onSignOut,
  isBypassMode,
  onToggleBypass
}) => {
  const { activePod, activeEntity } = useClinic();
  const [isSyncing, setIsSyncing] = useState(api.isSyncing);
  const [activePatient, setActivePatient] = useState<any>(null);
  const [activePatientStage, setActivePatientStage] = useState<string>('registered');
  const [logs, setLogs] = useState<any[]>([]);
  const [isHudExpanded, setIsHudExpanded] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  // Sync active patient and bypass states
  useEffect(() => {
    const updateNavbarState = () => {
      setIsSyncing(api.isSyncing);
      const patient = api.getActivePatient();
      setActivePatient(patient);
      if (patient) {
        setActivePatientStage(api.getActivePatientCareStage(patient.id));
      } else {
        setActivePatientStage('registered');
      }
    };
    
    updateNavbarState();
    return api.subscribe(updateNavbarState);
  }, []);

  // Format activity log entries to show descriptive text in Telemetry console
  const formatLogEntry = (log: any) => {
    const details = log.details || {};
    const timestamp = details.timestamp 
      ? new Date(details.timestamp).toLocaleTimeString() 
      : new Date(log.created_at).toLocaleTimeString();
    
    let text = '';
    const action = log.action_type;
    
    switch (action) {
      case 'patient_registered':
        text = `New Patient registered: ${details.name || 'Anonymous'} (PID: ${details.patientId || details.patient_id || 'N/A'})`;
        break;
      case 'encounter_created':
        text = `Clinical e-Prescription (e-Rx) & encounter signed off for Patient ID ${details.patientId || 'N/A'}`;
        break;
      case 'lab_sample_collected':
        text = `Lab Sample Collected for Requisition ID ${details.reqId || 'N/A'}`;
        break;
      case 'lab_result_submitted':
        text = `Pathology Lab test processed for Requisition ID ${details.reqId || 'N/A'}: ${details.resultValue || 'Approved'}`;
        break;
      case 'pharmacy_inventory_dispensed':
        text = `Pharmacy inventory dispensed and FEFO allocated for Hold ID ${details.holdId || 'N/A'}`;
        break;
      case 'pharmacy_inventory_hold_cancelled':
        text = `Pharmacy inventory hold cancelled for Hold ID ${details.holdId || 'N/A'}`;
        break;
      case 'invoice_payment_cleared':
        text = `Split billing invoice payment cleared for Invoice ID ${details.invoiceId || 'N/A'}. Ledger settled.`;
        break;
      case 'seasonal_forecast_acted_upon':
        text = `CDSS acting on seasonal epidemiologic forecast ID ${details.forecastId || 'N/A'}`;
        break;
      case 'clinic_staff_registered':
        text = `Workspace User ${details.name || 'N/A'} registered with role: ${details.role || 'N/A'}`;
        break;
      case 'clinic_staff_shift_toggled':
        text = `Staff ID ${details.staffId || 'N/A'} shift status updated to ${details.isActive ? 'ACTIVE' : 'INACTIVE'}`;
        break;
      case 'reagent_replenished':
        text = `Pathology Reagent [${details.reagentName || 'N/A'}] replenished by ${details.replenishedVolume}ml (New level: ${details.newVolume}ml)`;
        break;
      case 'SYSTEM_ERROR':
        text = `🚨 Clinical CDSS error in [${details.action || 'N/A'}]: ${details.error || 'Unknown'}`;
        break;
      case 'PATIENT_CONSENT_GRANTED':
        text = `Consent GRANTED via WhatsApp simulator for Patient ID: ${details.patientId || 'N/A'}`;
        break;
      case 'PATIENT_CONSENT_REVOKED':
        text = `Consent REVOKED via WhatsApp simulator for Patient ID: ${details.patientId || 'N/A'}`;
        break;
      default:
        text = `DB Activity: [${action}] details: ${JSON.stringify(details)}`;
    }

    return {
      id: log.id || `log-${Date.now()}-${Math.random()}`,
      timestamp,
      type: 'ACTIVITY',
      action_type: action,
      text,
      role: details.simulated_role || 'system'
    };
  };

  // Fetch initial activity logs
  useEffect(() => {
    const fetchInitialLogs = async () => {
      try {
        const { data, error } = await supabase
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);
          
        if (!error && data) {
          const formattedLogs = data.map((log: any) => formatLogEntry(log));
          setLogs(formattedLogs);
        }
      } catch (err) {
        console.error('Failed to load initial telemetry logs:', err);
      }
    };
    
    fetchInitialLogs();
  }, []);

  // Set up Supabase Realtime channel for CDC and Activity logs
  useEffect(() => {
    const activityChannel = supabase
      .channel('navbar-telemetry-hud')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_logs' },
        (payload) => {
          const newLog = formatLogEntry(payload.new);
          setLogs(prev => [newLog, ...prev].slice(0, 55));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          if (payload.table === 'activity_logs') return; // Handled by INSERT above
          
          const timestamp = new Date().toLocaleTimeString();
          const table = payload.table.toUpperCase();
          const event = payload.eventType;
          let text = `CDC Broadcast: Row ${event.toLowerCase()}d in table ${table}.`;
          
          const record = (payload.new || {}) as any;
          if (payload.table === 'encounters') {
            text = `CDC Broadcast: Encounter ${event}d for Patient ID ${record.patientId || record.patient_id || 'N/A'}`;
          } else if (payload.table === 'lab_requisitions') {
            text = `CDC Broadcast: Lab Requisition status changed to ${record.status || 'N/A'} (PID: ${record.patientId || 'N/A'})`;
          } else if (payload.table === 'inventory_holds') {
            text = `CDC Broadcast: Pharmacy Hold status changed to ${record.holdStatus || 'N/A'} (PID: ${record.patientId || 'N/A'})`;
          } else if (payload.table === 'unified_invoices') {
            text = `CDC Broadcast: Invoice status changed to ${record.paymentStatus || 'N/A'} (Amount: ₹${record.totalAmount || '0'})`;
          } else if (payload.table === 'whatsapp_sessions') {
            text = `CDC Broadcast: WhatsApp Session state transitioned to: ${record.currentState || 'N/A'}`;
          }
          
          const newCdcLog = {
            id: `cdc-${Date.now()}-${Math.random()}`,
            timestamp,
            type: 'CDC_STREAM',
            action_type: `CDC_${table}_${event}`,
            text,
            role: 'system'
          };
          
          setLogs(prev => [newCdcLog, ...prev].slice(0, 55));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        } else {
          setIsConnected(false);
        }
      });

    return () => {
      supabase.removeChannel(activityChannel);
    };
  }, []);

  const getLogTagStyle = (actionType: string) => {
    if (actionType.startsWith('CDC_')) {
      return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    }
    switch (actionType) {
      case 'patient_registered':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'encounter_created':
        return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
      case 'lab_sample_collected':
      case 'lab_result_submitted':
        return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      case 'pharmacy_inventory_dispensed':
      case 'pharmacy_inventory_hold_cancelled':
        return 'bg-pink-500/10 text-pink-400 border border-pink-500/20';
      case 'invoice_payment_cleared':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'SYSTEM_ERROR':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/25 animate-pulse';
      case 'PATIENT_CONSENT_GRANTED':
        return 'bg-teal-500/10 text-teal-400 border border-teal-500/20';
      case 'PATIENT_CONSENT_REVOKED':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      default:
        return 'bg-clinical-800 text-clinical-400 border border-clinical-700/50';
    }
  };

  const getLogTagLabel = (actionType: string) => {
    if (actionType.startsWith('CDC_')) {
      return 'CDC_EVENT';
    }
    switch (actionType) {
      case 'patient_registered': return 'REGISTRY';
      case 'encounter_created': return 'ENCOUNTER';
      case 'lab_sample_collected': return 'LAB_COLLECT';
      case 'lab_result_submitted': return 'LAB_RESULT';
      case 'pharmacy_inventory_dispensed': return 'RX_DISPENSE';
      case 'pharmacy_inventory_hold_cancelled': return 'RX_HOLD_DEL';
      case 'invoice_payment_cleared': return 'UPI_SETTLE';
      case 'SYSTEM_ERROR': return 'SYS_ERROR';
      case 'PATIENT_CONSENT_GRANTED': return 'CONSENT_OK';
      case 'PATIENT_CONSENT_REVOKED': return 'CONSENT_REV';
      default: return 'ACTIVITY';
    }
  };

  const roles = [
    { id: 'compounder', name: 'Compounder', icon: UserPlus, color: 'text-accent-500 bg-accent-500/10' },
    { id: 'doctor', name: 'Doctor Dashboard', icon: Stethoscope, color: 'text-primary-500 bg-primary-500/10' },
    { id: 'lab', name: 'Pathology Lab', icon: Beaker, color: 'text-blue-500 bg-blue-500/10' },
    { id: 'pharmacy', name: 'Pharmacy POS', icon: ShoppingBag, color: 'text-emerald-500 bg-emerald-500/10' },
    { id: 'billing', name: 'UPI Ledger', icon: QrCode, color: 'text-rose-500 bg-rose-500/10' },
    { id: 'patient', name: 'Patient App', icon: Smartphone, color: 'text-emerald-400 bg-emerald-500/10' },
  ];

  const getProfileTheme = () => {
    if (!activeProfile) return 'border-clinical-800 text-clinical-400';
    switch (activeProfile.role) {
      case 'doctor': return 'border-primary-500/30 text-primary-400 bg-primary-500/5';
      case 'lab_technician': return 'border-blue-500/30 text-blue-400 bg-blue-500/5';
      case 'pharmacist': return 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5';
      case 'patient': return 'border-purple-500/30 text-purple-400 bg-purple-500/5';
      default: return 'border-accent-500/30 text-accent-400 bg-accent-500/5';
    }
  };

  return (
    <nav className="border-b border-clinical-800/80 bg-clinical-950/70 backdrop-blur-md sticky top-0 z-50 px-4 md:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col gap-4">
        {/* Main Nav Items */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Brand Header */}
          <div className="flex items-center justify-between w-full lg:w-auto">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-primary-600 to-accent-600 shadow-md">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="font-extrabold text-xl tracking-tight text-white flex items-center gap-2">
                  Mediflow <span className="text-accent-400 font-medium text-xs bg-accent-950 border border-accent-800 px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse-subtle">Pod Hub</span>
                  <span className={`flex items-center gap-1.5 text-[9px] px-2 py-0.5 rounded-full border transition-all duration-300 font-mono tracking-wider font-bold ${
                    isSyncing 
                      ? 'bg-primary-500/15 text-primary border-primary/25'
                      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-primary' : 'bg-emerald-400 animate-pulse'}`} />
                    {isSyncing ? 'Syncing' : 'Live'}
                  </span>
                </h1>
                <p className="text-clinical-400 text-xs font-semibold">
                  {activePod ? (
                    <>
                      Connected to <strong className="text-white">{activeEntity?.name}</strong> • Code: <strong className="text-primary font-mono">{activePod.clinicCode}</strong>
                    </>
                  ) : (
                    'Hyper-Local Connected Care Network'
                  )}
                </p>
              </div>
            </div>

            {/* Mobile Header Action Row */}
            <div className="lg:hidden flex items-center gap-2">
              {/* Dev Bypass Trigger on Mobile */}
              <button 
                onClick={() => onToggleBypass(!isBypassMode)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  isBypassMode 
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                    : 'bg-clinical-900 border-clinical-800 text-clinical-400'
                }`}
              >
                {isBypassMode ? <ShieldAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                Bypass
              </button>

              {/* Sign Out Trigger on Mobile */}
              {activeProfile && (
                <button
                  onClick={onSignOut}
                  className="p-1.5 bg-clinical-900 hover:bg-rose-500/10 border border-clinical-800 hover:border-rose-500/30 text-clinical-400 hover:text-rose-400 rounded-lg transition-all duration-300 cursor-pointer"
                  title="Sign out of professional workspace"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Switcher Navigation - Hidden on Mobile Viewports, Shown on Desktop */}
          <div className="hidden lg:flex flex-wrap items-center gap-3 w-full lg:w-auto justify-start lg:justify-end">
            <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-full bg-clinical-900 border border-clinical-800/60 max-w-full overflow-x-auto scrollbar-none">
              {roles.map((r) => {
                const Icon = r.icon;
                const isActive = currentRole === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => onChangeRole(r.id as UserRole)}
                    className={`flex items-center gap-2.5 px-3 py-1 rounded-full text-xs md:text-sm font-bold transition-all duration-300 cursor-pointer ${
                      isActive
                        ? 'bg-clinical-800 text-white border border-clinical-700/80 shadow-md scale-[1.02]'
                        : 'text-clinical-400 hover:text-clinical-100 hover:bg-clinical-800/40 border border-transparent'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${r.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="pr-1">{r.name}</span>
                  </button>
                );
              })}
            </div>

            {/* User Profile Console & Sign Out */}
            {activeProfile && (
              <div className="flex items-center gap-3">
                {/* Bypass Mode Toggle for Demos */}
                <button 
                  onClick={() => onToggleBypass(!isBypassMode)}
                  className={`hidden lg:flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                    isBypassMode 
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/5' 
                      : 'bg-clinical-900 border-clinical-800 text-clinical-400 hover:text-clinical-200'
                  }`}
                  title="Toggle authorization check bypass for demonstrating full pod loop transitions in a single window"
                >
                  {isBypassMode ? (
                    <>
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-400 animate-pulse-subtle" />
                      Bypass Active
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5 text-clinical-400" />
                      Secure Mode
                    </>
                  )}
                </button>

                {/* Active Profile Info Badge */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${getProfileTheme()} text-xs font-semibold`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  <span>{activeProfile.display_name}</span>
                  <span className="text-[9px] uppercase opacity-75 font-bold tracking-widest pl-1 border-l border-clinical-800 ml-1">
                    {activeProfile.role.replace('_', ' ')}
                  </span>
                </div>

                {/* Sign Out Trigger */}
                <button
                  onClick={onSignOut}
                  className="p-2.5 bg-clinical-900 hover:bg-rose-500/10 border border-clinical-800 hover:border-rose-500/30 text-clinical-400 hover:text-rose-400 rounded-xl transition-all duration-300 cursor-pointer"
                  title="Sign out of professional workspace"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Unified Care Loop Progress Ribbon */}
        {activePatient && (
          <div className="mt-2 pt-2.5 border-t border-clinical-800/40 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs animate-fade-in pb-1">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider">Active Loop:</span>
              <span className="text-white font-bold">{activePatient.name}</span>
              <span className="text-[10px] text-clinical-500 font-mono">({activePatient.id.substring(0, 8)})</span>
            </div>
            
            {/* Stepper Steps */}
            <div className="flex items-center gap-1.5 md:gap-4 max-w-full overflow-x-auto scrollbar-none font-semibold text-[9.5px] md:text-xs">
              {[
                { id: 'registered', label: 'Registered' },
                { id: 'diagnosing', label: 'Diagnosing (CDSS)' },
                { id: 'lab', label: 'Lab Processing' },
                { id: 'pharmacy', label: 'Pharmacy Verification' },
                { id: 'settled', label: 'Ledger Settled' }
              ].map((step, idx, arr) => {
                const stages = arr.map(s => s.id);
                const currentIdx = stages.indexOf(activePatientStage);
                const isCompleted = idx < currentIdx;
                const isActive = idx === currentIdx;
                
                return (
                  <React.Fragment key={step.id}>
                    <div className={`flex items-center gap-1.5 transition-all duration-500 ${
                      isActive 
                        ? 'text-secondary drop-shadow-[0_0_8px_rgba(79,219,200,0.5)] scale-[1.02]' 
                        : isCompleted 
                          ? 'text-emerald-400' 
                          : 'text-clinical-500'
                    }`}>
                      <div className={`w-4.5 h-4.5 md:w-5 md:h-5 rounded-full flex items-center justify-center border text-[9px] font-mono font-bold transition-all duration-500 ${
                        isActive 
                          ? 'bg-secondary/10 border-secondary text-secondary' 
                          : isCompleted 
                            ? 'bg-emerald-500/10 border-emerald-400 text-emerald-400' 
                            : 'bg-clinical-950 border-clinical-800 text-clinical-500'
                      }`}>
                        {isCompleted ? '✓' : idx + 1}
                      </div>
                      <span className="whitespace-nowrap">{step.label}</span>
                    </div>
                    
                    {idx < arr.length - 1 && (
                      <div className={`w-2 md:w-8 h-[1.5px] rounded transition-all duration-500 shrink-0 ${
                        idx < currentIdx 
                          ? 'bg-emerald-500/50' 
                          : 'bg-clinical-800'
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Ecosystem Live Pipeline Telemetry HUD Bottom Drawer */}
      <div 
        className={`fixed left-0 right-0 z-40 transition-all duration-500 ease-in-out border-t border-clinical-800 bg-clinical-950/95 backdrop-blur-md shadow-2xl flex flex-col lg:bottom-0 ${
          isHudExpanded ? 'h-[230px]' : 'h-[36px]'
        } bottom-16`}
      >
        {/* HUD Top Bar Toggler */}
        <div 
          onClick={() => setIsHudExpanded(!isHudExpanded)}
          className="h-[35px] shrink-0 px-4 md:px-8 border-b border-clinical-800/40 flex items-center justify-between cursor-pointer hover:bg-clinical-900/40 select-none transition-colors"
        >
          <div className="flex items-center gap-2 md:gap-3.5">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-[10px] md:text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-secondary" />
                Ecosystem Live Pipeline Telemetry HUD
              </span>
            </div>
            
            <div className="hidden sm:flex items-center gap-1.5 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-clinical-900 border border-clinical-800 text-clinical-400">
              CDC Channels: active
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-[9px] font-mono text-clinical-400">
              {logs.length} events logged in this session
            </span>
            <div className="text-clinical-400 hover:text-white transition-colors">
              {isHudExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </div>
          </div>
        </div>

        {/* HUD Log Output Panel */}
        {isHudExpanded && (
          <div className="flex-1 p-4 overflow-y-auto font-mono text-[10.5px] leading-relaxed space-y-2 bg-clinical-950/50">
            {logs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-clinical-500 text-xs italic">
                Scanning database pipeline... Listening for Postgres CDC mutations.
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex flex-col sm:flex-row sm:items-center gap-2 hover:bg-clinical-900/30 py-0.5 px-2 rounded transition-colors group">
                  {/* Timestamp */}
                  <span className="text-clinical-500 shrink-0 select-none">[{log.timestamp}]</span>
                  
                  {/* Event tag */}
                  <span className={`text-[8.5px] font-bold tracking-widest px-1.5 py-0.5 rounded shrink-0 uppercase ${getLogTagStyle(log.action_type)}`}>
                    {getLogTagLabel(log.action_type)}
                  </span>
                  
                  {/* Role descriptor */}
                  {log.role && log.role !== 'system' && (
                    <span className="text-clinical-400 font-bold uppercase text-[8px] bg-clinical-900 px-1 py-0.2 rounded border border-clinical-800">
                      {log.role}
                    </span>
                  )}
                  
                  {/* Log body */}
                  <span className="text-clinical-100 font-medium break-all">{log.text}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Premium PWA Mobile Fixed Bottom Tab Bar Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-clinical-200 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] px-2 pb-safe-bottom">
        <div className="flex items-center justify-around h-16">
          {roles.map((r) => {
            const Icon = r.icon;
            const isActive = currentRole === r.id;
            
            // Map role ID to a short professional label for the bottom nav
            let label = r.name;
            if (r.id === 'compounder') label = 'Comp.';
            else if (r.id === 'doctor') label = 'Doctor';
            else if (r.id === 'lab') label = 'Lab';
            else if (r.id === 'pharmacy') label = 'Pharmacy';
            else if (r.id === 'billing') label = 'Ledger';
            else if (r.id === 'patient') label = 'Patient';

            return (
              <button
                key={r.id}
                onClick={() => onChangeRole(r.id as UserRole)}
                className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-300 cursor-pointer relative ${
                  isActive 
                    ? 'text-primary' 
                    : 'text-clinical-400 hover:text-clinical-200'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? 'bg-primary/10 text-primary scale-110 shadow-sm' 
                    : 'bg-transparent text-clinical-400'
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={`text-[9px] font-bold mt-1 tracking-tight transition-colors duration-300 ${
                  isActive ? 'text-primary font-extrabold' : 'text-clinical-400'
                }`}>
                  {label}
                </span>
                
                {/* Active Indicator dot */}
                {isActive && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

