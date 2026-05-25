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
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Menu,
  X
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
  isSidebarCollapsed?: boolean;
  onToggleSidebarCollapse?: (collapsed: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  currentRole, 
  onChangeRole, 
  activeProfile, 
  onSignOut,
  isBypassMode,
  onToggleBypass,
  isSidebarCollapsed = false,
  onToggleSidebarCollapse
}) => {
  const { activePod, activeEntity } = useClinic();
  const [isSyncing, setIsSyncing] = useState(api.isSyncing);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
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

  return (
    <>
      {/* Premium Desktop Left Sidebar Navigation */}
      <aside 
        onClick={() => {
          if (isSidebarCollapsed) {
            onToggleSidebarCollapse?.(false);
          }
        }}
        className={`hidden md:flex flex-col fixed top-0 bottom-0 left-0 ${isSidebarCollapsed ? 'w-20 p-3 items-center' : 'w-64 p-5'} bg-white border-r border-slate-100 z-40 justify-between transition-all duration-300 ${isSidebarCollapsed ? 'cursor-pointer' : ''}`}
      >
        {/* Collapse Toggle Button (Circular) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSidebarCollapse?.(!isSidebarCollapsed);
          }}
          className="hidden md:flex absolute -right-3 top-8 w-6 h-6 rounded-full bg-white border border-slate-100 shadow-md items-center justify-center text-slate-400 hover:text-slate-700 hover:scale-105 transition-all z-50 cursor-pointer"
          title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Top: Brand Logo and Connected Info */}
        <div className={`space-y-6 w-full ${isSidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center w-full' : 'gap-3'}`}>
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-primary-600 to-accent-600 shadow-md shrink-0">
              <Activity className="h-5 w-5 text-white" />
            </div>
            {!isSidebarCollapsed && (
              <div className="animate-fade-in">
                <h1 className="font-extrabold text-base tracking-tight text-slate-900 flex items-center gap-1">
                  Mediflow 
                  <span className="text-primary font-bold text-[8px] bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                    POD HUB
                  </span>
                </h1>
                <span className="flex items-center gap-1 text-[9px] font-mono tracking-wider font-bold text-emerald-500 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  SYSTEM LIVE
                </span>
              </div>
            )}
          </div>

          {/* Connection Status Card */}
          {activePod && (
            isSidebarCollapsed ? (
              <div 
                className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors"
                title={`Active Workspace: ${activeEntity?.name} (Code: ${activePod.clinicCode})`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1 animate-fade-in">
                <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-wider">Active Workspace</span>
                <span className="block text-xs font-bold text-slate-700 truncate">{activeEntity?.name}</span>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Code: <span className="font-bold text-slate-700 font-mono">{activePod.clinicCode}</span>
                </div>
              </div>
            )
          )}

          {/* Unified Care Loop Stepper in Sidebar */}
          {activePatient && (
            isSidebarCollapsed ? (
              <div 
                className="flex flex-col items-center gap-2 p-2.5 bg-slate-50 border border-slate-100 rounded-full transition-colors"
                title={`Active Patient Loop: ${activePatient.name}`}
              >
                {[
                  { id: 'registered', label: 'Registered' },
                  { id: 'diagnosing', label: 'Diagnosing' },
                  { id: 'lab', label: 'Lab' },
                  { id: 'pharmacy', label: 'Pharmacy' },
                  { id: 'settled', label: 'Settled' }
                ].map((step, idx, arr) => {
                  const stages = arr.map(s => s.id);
                  const currentIdx = stages.indexOf(activePatientStage);
                  const isCompleted = idx < currentIdx;
                  const isActive = idx === currentIdx;
                  
                  return (
                    <div 
                      key={step.id} 
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-mono font-bold border transition-all duration-350 ${
                        isActive 
                          ? 'bg-primary/10 border-primary text-primary scale-110 shadow-sm' 
                          : isCompleted 
                            ? 'bg-emerald-500/10 border-emerald-400 text-emerald-500' 
                            : 'bg-white border-slate-200 text-slate-300'
                      }`}
                    >
                      {isCompleted ? '✓' : idx + 1}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-3 animate-fade-in">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Active Patient Loop</span>
                  <span className="text-xs font-bold text-slate-700 truncate">{activePatient.name}</span>
                </div>
                
                <div className="flex flex-col gap-2.5 font-semibold text-[10px]">
                  {[
                    { id: 'registered', label: 'Registered' },
                    { id: 'diagnosing', label: 'Diagnosing (CDSS)' },
                    { id: 'lab', label: 'Lab Processing' },
                    { id: 'pharmacy', label: 'Pharmacy Verif.' },
                    { id: 'settled', label: 'Ledger Settled' }
                  ].map((step, idx, arr) => {
                    const stages = arr.map(s => s.id);
                    const currentIdx = stages.indexOf(activePatientStage);
                    const isCompleted = idx < currentIdx;
                    const isActive = idx === currentIdx;
                    
                    return (
                      <div key={step.id} className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border text-[9px] font-bold shrink-0 transition-all duration-350 ${
                          isActive 
                            ? 'bg-primary/10 border-primary text-primary scale-105 shadow-sm' 
                            : isCompleted 
                              ? 'bg-emerald-500/10 border-emerald-400 text-emerald-500' 
                              : 'bg-white border-slate-200 text-slate-300'
                        }`}>
                          {isCompleted ? '✓' : idx + 1}
                        </div>
                        <span className={`truncate leading-none ${isActive ? 'text-primary font-bold' : isCompleted ? 'text-emerald-600 font-medium' : 'text-slate-400 font-medium'}`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}

          {/* Vertical Menu Options */}
          <div className="space-y-1.5 pt-2 w-full">
            {!isSidebarCollapsed && (
              <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-widest pl-2 mb-2 animate-fade-in">Ecosystem Modules</span>
            )}
            {roles.map((r) => {
              const Icon = r.icon;
              const isActive = currentRole === r.id;
              return (
                <button
                  key={r.id}
                  onClick={(e) => {
                    // If collapsed, clicking switch expands sidebar as well
                    if (isSidebarCollapsed) {
                      e.stopPropagation();
                      onChangeRole(r.id as UserRole);
                      onToggleSidebarCollapse?.(false);
                    } else {
                      onChangeRole(r.id as UserRole);
                    }
                  }}
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-2 rounded-full' : 'gap-3 px-3 py-2 rounded-full'} text-xs font-bold transition-all duration-300 relative group cursor-pointer ${
                    isActive
                      ? 'bg-slate-50 text-slate-900 border border-slate-100 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50/50 border border-transparent'
                  }`}
                  title={r.name}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    isActive 
                      ? 'bg-primary text-white shadow-md shadow-primary/20 scale-105' 
                      : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600'
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {!isSidebarCollapsed && (
                    <span className="flex-1 text-left animate-fade-in">{r.name}</span>
                  )}
                  
                  {isActive && !isSidebarCollapsed && (
                    <span className="absolute right-3.5 w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom: Active Profile Badge & Workspace Actions */}
        <div className={`space-y-4 pt-4 border-t border-slate-100 w-full ${isSidebarCollapsed ? 'flex flex-col items-center gap-3 pt-3' : ''}`}>
          {activeProfile && (
            isSidebarCollapsed ? (
              <div className="flex flex-col items-center gap-3 w-full">
                {/* Collapsed Profile Avatar */}
                <div 
                  className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer"
                  title={`Active Profile: ${activeProfile.display_name} (${activeProfile.role})`}
                >
                  {activeProfile.display_name.charAt(0)}
                </div>

                {/* Collapsed Dev Bypass Trigger */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleBypass(!isBypassMode);
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300 cursor-pointer ${
                    isBypassMode 
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-600' 
                      : 'bg-slate-50 border-slate-100 text-slate-400 hover:text-slate-600'
                  }`}
                  title={isBypassMode ? "Bypass Mode Active" : "Secure Mode Active"}
                >
                  {isBypassMode ? (
                    <ShieldAlert className="h-4 w-4 text-amber-500 animate-pulse" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                </button>

                {/* Collapsed Log Out Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSignOut();
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 hover:bg-rose-500/10 border border-slate-100 hover:border-rose-500/25 text-slate-400 hover:text-rose-500 transition-all duration-300 cursor-pointer"
                  title="Sign Out Workspace"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-3 animate-fade-in">
                {/* Profile Details Badge */}
                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50/50 border border-slate-100/60 font-sans">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                    {activeProfile.display_name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-slate-800 truncate leading-tight">{activeProfile.display_name}</span>
                    <span className="block text-[8px] text-slate-400 font-extrabold uppercase tracking-widest mt-0.5">{activeProfile.role.replace('_', ' ')}</span>
                  </div>
                </div>

                {/* Dev Bypass Trigger */}
                <button 
                  onClick={() => onToggleBypass(!isBypassMode)}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-full border text-[9px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                    isBypassMode 
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 shadow-sm shadow-amber-500/5' 
                      : 'bg-slate-50 border-slate-100 text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {isBypassMode ? (
                    <>
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                      Bypass Active
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                      Secure Mode
                    </>
                  )}
                </button>

                {/* Log Out Button */}
                <button
                  onClick={onSignOut}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-50 hover:bg-rose-500/10 border border-slate-100 hover:border-rose-500/25 text-slate-500 hover:text-rose-500 rounded-full transition-all duration-300 font-semibold text-xs cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out Workspace
                </button>
              </div>
            )
          )}
        </div>
      </aside>

      {/* Mobile Top Header Navigation */}
      <nav className="md:hidden border-b border-slate-100 bg-white/75 backdrop-blur-xl sticky top-0 z-50 px-4 py-3 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.03)] w-full">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              {/* Mobile Sidebar Drawer Hamburger Trigger */}
              <button 
                onClick={() => setIsMobileDrawerOpen(true)}
                className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer mr-1"
                aria-label="Open Sidebar Drawer"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-primary-600 to-accent-600 shadow-md">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="font-extrabold text-base tracking-tight text-slate-900 flex items-center gap-1.5">
                  Mediflow <span className="text-accent-600 font-bold text-[8px] bg-accent-50 border border-accent-100 px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse-subtle">POD HUB</span>
                  <span className={`flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded-full border transition-all duration-300 font-mono font-bold ${
                    isSyncing 
                      ? 'bg-primary/10 text-primary border-primary/25'
                      : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25'
                  }`}>
                    <span className={`w-1 h-1 rounded-full ${isSyncing ? 'bg-primary' : 'bg-emerald-500 animate-pulse'}`} />
                    {isSyncing ? 'Syncing' : 'Live'}
                  </span>
                </h1>
                <p className="text-slate-400 text-[10px] font-semibold mt-0.5">
                  {activePod ? (
                    <>
                      Connected to <strong className="text-slate-600 font-bold">{activeEntity?.name}</strong> • Code: <strong className="text-primary font-mono">{activePod.clinicCode}</strong>
                    </>
                  ) : (
                    'Hyper-Local Connected Care Network'
                  )}
                </p>
              </div>
            </div>

            {/* Mobile Actions */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onToggleBypass(!isBypassMode)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  isBypassMode 
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-600' 
                    : 'bg-slate-50 border-slate-100 text-slate-500'
                }`}
              >
                {isBypassMode ? <ShieldAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                Bypass
              </button>

              {activeProfile && (
                <button
                  onClick={onSignOut}
                  className="p-1.5 bg-slate-50 hover:bg-rose-500/10 border border-slate-100 hover:border-rose-500/30 text-slate-500 hover:text-rose-500 rounded-lg transition-all duration-300 cursor-pointer"
                  title="Sign out of professional workspace"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Unified Care Loop Progress Ribbon */}
          {activePatient && (
            <div className="mt-1 pt-2 border-t border-slate-100 flex flex-col gap-2 text-[10px] animate-fade-in">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px]">Active Loop:</span>
                <span className="text-slate-700 font-bold">{activePatient.name}</span>
                <span className="text-slate-400 font-mono">({activePatient.id.substring(0, 8)})</span>
              </div>
              
              {/* Stepper Steps */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none font-semibold text-[9px]">
                {[
                  { id: 'registered', label: 'Registered' },
                  { id: 'diagnosing', label: 'Diagnosing' },
                  { id: 'lab', label: 'Lab' },
                  { id: 'pharmacy', label: 'Pharmacy' },
                  { id: 'settled', label: 'Settled' }
                ].map((step, idx, arr) => {
                  const stages = arr.map(s => s.id);
                  const currentIdx = stages.indexOf(activePatientStage);
                  const isCompleted = idx < currentIdx;
                  const isActive = idx === currentIdx;
                  
                  return (
                    <React.Fragment key={step.id}>
                      <div className={`flex items-center gap-1 transition-all duration-500 ${
                        isActive 
                          ? 'text-primary' 
                          : isCompleted 
                            ? 'text-emerald-500' 
                            : 'text-slate-300'
                      }`}>
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center border text-[8px] font-mono font-bold transition-all duration-500 ${
                          isActive 
                            ? 'bg-primary/10 border-primary text-primary' 
                            : isCompleted 
                              ? 'bg-emerald-500/10 border-emerald-400 text-emerald-500' 
                              : 'bg-white border-slate-100 text-slate-300'
                        }`}>
                          {isCompleted ? '✓' : idx + 1}
                        </div>
                        <span className="whitespace-nowrap">{step.label}</span>
                      </div>
                      
                      {idx < arr.length - 1 && (
                        <div className={`w-2 h-[1px] rounded transition-all duration-500 shrink-0 ${
                          idx < currentIdx 
                            ? 'bg-emerald-400' 
                            : 'bg-slate-100'
                        }`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Drawer Slide-over Panel Sheet */}
      {isMobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-[100] flex animate-fade-in">
          {/* Drawer Backdrop Overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setIsMobileDrawerOpen(false)}
          />

          {/* Drawer Content Sheet */}
          <aside className="relative flex flex-col w-72 bg-white h-full p-5 justify-between shadow-2xl animate-slide-in-left z-50">
            <div className="space-y-6">
              {/* Header inside drawer */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-tr from-primary-600 to-accent-600 shadow-md">
                    <Activity className="h-4.5 w-4.5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-sm tracking-tight text-slate-900">Mediflow</h2>
                    <span className="text-[8px] font-mono tracking-wider font-bold text-emerald-500">SYSTEM LIVE</span>
                  </div>
                </div>

                <button 
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Active Workspace */}
              {activePod && (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-wider">Active Workspace</span>
                  <span className="block text-xs font-bold text-slate-700 truncate">{activeEntity?.name}</span>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Code: <span className="font-bold text-slate-700 font-mono">{activePod.clinicCode}</span>
                  </div>
                </div>
              )}

              {/* Patient Care loop inside drawer */}
              {activePatient && (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Active Patient Loop</span>
                    <span className="text-xs font-bold text-slate-700 truncate">{activePatient.name}</span>
                  </div>
                  
                  <div className="flex flex-col gap-2.5 font-semibold text-[10px]">
                    {[
                      { id: 'registered', label: 'Registered' },
                      { id: 'diagnosing', label: 'Diagnosing (CDSS)' },
                      { id: 'lab', label: 'Lab Processing' },
                      { id: 'pharmacy', label: 'Pharmacy Verif.' },
                      { id: 'settled', label: 'Ledger Settled' }
                    ].map((step, idx, arr) => {
                      const stages = arr.map(s => s.id);
                      const currentIdx = stages.indexOf(activePatientStage);
                      const isCompleted = idx < currentIdx;
                      const isActive = idx === currentIdx;
                      
                      return (
                        <div key={step.id} className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center border text-[9px] font-bold shrink-0 transition-all duration-350 ${
                            isActive 
                              ? 'bg-primary/10 border-primary text-primary scale-105 shadow-sm' 
                              : isCompleted 
                                ? 'bg-emerald-500/10 border-emerald-400 text-emerald-500' 
                                : 'bg-white border-slate-200 text-slate-300'
                          }`}>
                            {isCompleted ? '✓' : idx + 1}
                          </div>
                          <span className={`truncate leading-none ${isActive ? 'text-primary font-bold' : isCompleted ? 'text-emerald-600 font-medium' : 'text-slate-400 font-medium'}`}>
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Modules Switcher */}
              <div className="space-y-1.5 pt-2">
                <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-widest pl-2 mb-2">Ecosystem Modules</span>
                {roles.map((r) => {
                  const Icon = r.icon;
                  const isActive = currentRole === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        onChangeRole(r.id as UserRole);
                        setIsMobileDrawerOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-full text-xs font-bold transition-all duration-300 relative group cursor-pointer ${
                        isActive
                          ? 'bg-slate-50 text-slate-900 border border-slate-100 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50/50 border border-transparent'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                        isActive 
                          ? 'bg-primary text-white shadow-md shadow-primary/20 scale-105' 
                          : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600'
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="flex-1 text-left">{r.name}</span>
                      {isActive && (
                        <span className="absolute right-3.5 w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom active profile and workspace actions inside drawer */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              {activeProfile && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50/50 border border-slate-100/60 font-sans">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                      {activeProfile.display_name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-slate-800 truncate leading-tight">{activeProfile.display_name}</span>
                      <span className="block text-[8px] text-slate-400 font-extrabold uppercase tracking-widest mt-0.5">{activeProfile.role.replace('_', ' ')}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      onToggleBypass(!isBypassMode);
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-full border text-[9px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                      isBypassMode 
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 shadow-sm' 
                        : 'bg-slate-50 border-slate-100 text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {isBypassMode ? (
                      <>
                        <ShieldAlert className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                        Bypass Active
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                        Secure Mode
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      onSignOut();
                      setIsMobileDrawerOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-50 hover:bg-rose-500/10 border border-slate-100 hover:border-rose-500/25 text-slate-500 hover:text-rose-500 rounded-full transition-all duration-300 font-semibold text-xs cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out Workspace
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Ecosystem Live Pipeline Telemetry HUD Bottom Drawer */}
      <div 
        className={`fixed left-0 right-0 ${isSidebarCollapsed ? 'md:left-20' : 'md:left-64'} z-40 transition-all duration-500 ease-in-out border-t border-slate-100 bg-white/95 backdrop-blur-md shadow-[0_-8px_30px_rgba(15,23,42,0.02)] flex flex-col md:bottom-0 ${
          isHudExpanded ? 'h-[230px]' : 'h-[36px]'
        } bottom-16`}
      >
        {/* HUD Top Bar Toggler */}
        <div 
          onClick={() => setIsHudExpanded(!isHudExpanded)}
          className="h-[35px] shrink-0 px-4 md:px-8 border-b border-slate-100/40 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 select-none transition-colors"
        >
          <div className="flex items-center gap-2 md:gap-3.5">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-[10px] md:text-xs font-bold text-slate-700 tracking-wide flex items-center gap-1.5 font-sans">
                <Terminal className="h-3.5 w-3.5 text-primary" />
                Ecosystem Live Telemetry HUD
              </span>
            </div>
            
            <div className="hidden sm:flex items-center gap-1.5 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-50 border border-slate-100 text-slate-500">
              CDC Channels: active
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-[9px] font-mono text-slate-400">
              {logs.length} events logged
            </span>
            <div className="text-slate-400 hover:text-slate-700 transition-colors">
              {isHudExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </div>
          </div>
        </div>

        {/* HUD Log Output Panel */}
        {isHudExpanded && (
          <div className="flex-1 p-4 overflow-y-auto font-mono text-[10.5px] leading-relaxed space-y-2 bg-slate-50/50">
            {logs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                Scanning database pipeline... Listening for Postgres CDC mutations.
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex flex-col sm:flex-row sm:items-center gap-2 hover:bg-slate-100/30 py-0.5 px-2 rounded transition-colors group">
                  {/* Timestamp */}
                  <span className="text-slate-400 shrink-0 select-none">[{log.timestamp}]</span>
                  
                  {/* Event tag */}
                  <span className={`text-[8.5px] font-bold tracking-widest px-1.5 py-0.5 rounded shrink-0 uppercase ${getLogTagStyle(log.action_type)}`}>
                    {getLogTagLabel(log.action_type)}
                  </span>
                  
                  {/* Role descriptor */}
                  {log.role && log.role !== 'system' && (
                    <span className="text-slate-400 font-bold uppercase text-[8px] bg-slate-50 px-1 py-0.2 rounded border border-slate-100">
                      {log.role}
                    </span>
                  )}
                  
                  {/* Log body */}
                  <span className="text-slate-600 font-medium break-all">{log.text}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Premium PWA Mobile Fixed Bottom Tab Bar Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-slate-100 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] px-2 pb-safe-bottom">
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
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? 'bg-primary/10 text-primary scale-110 shadow-sm' 
                    : 'bg-transparent text-slate-400'
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={`text-[9px] font-bold mt-1 tracking-tight transition-colors duration-300 ${
                  isActive ? 'text-primary font-extrabold' : 'text-slate-400'
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
    </>
  );
};

