import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useSpecialization } from '../../context/SpecializationContext';
import { supabase } from '../../lib/supabaseClient';
import { 
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
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Settings,
  FileText,
  Sun,
  Moon
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
  const { isOphthalmology, nomenclature } = useSpecialization();
  const displayRole = (role: string) => {
    const clean = role.replace('_', ' ');
    if (!isOphthalmology) return clean;
    if (role === 'lab_technician') return 'Diagnostics Tech';
    if (role === 'pharmacist') return 'Optician / Pharmacist';
    return clean;
  };
  const { activePod, activeEntity } = useClinic();
  const [isSyncing, setIsSyncing] = useState(api.isSyncing);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeDoctorTab, setActiveDoctorTab] = useState<string>('pod_view');

  useEffect(() => {
    const handleDoctorTabChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setActiveDoctorTab(customEvent.detail);
      }
    };
    window.addEventListener('mediflow-doctor-tab-changed', handleDoctorTabChange);
    return () => {
      window.removeEventListener('mediflow-doctor-tab-changed', handleDoctorTabChange);
    };
  }, []);
  
  const isDark = false;

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.body?.classList.remove('dark');
    localStorage.setItem('theme', 'light');
    window.dispatchEvent(new CustomEvent('mediflow-theme-change', { detail: { isDark: false } }));
  }, []);

  const toggleTheme = () => {};
  
  const activeSop = api.getActiveSop();

  const handleCollapsedSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSidebarCollapse?.(false);
    setIsSettingsOpen(true);
  };
  const [activePatient, setActivePatient] = useState<any>(null);
  const [activePatientStage, setActivePatientStage] = useState<string>('registered');
  const [logs, setLogs] = useState<any[]>([]);
  const [isHudExpanded, setIsHudExpanded] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [offlineCount, setOfflineCount] = useState(0);

  useEffect(() => {
    const handlePwaSync = () => {
      try {
        const queue = JSON.parse(localStorage.getItem('offline_sync_queue') || '[]');
        setOfflineCount(queue.length);
      } catch {
        setOfflineCount(0);
      }
    };

    handlePwaSync();
    window.addEventListener('mediflow-pwa-sync-change', handlePwaSync);
    window.addEventListener('online', handlePwaSync);
    window.addEventListener('offline', handlePwaSync);
    return () => {
      window.removeEventListener('mediflow-pwa-sync-change', handlePwaSync);
      window.removeEventListener('online', handlePwaSync);
      window.removeEventListener('offline', handlePwaSync);
    };
  }, []);

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
    { id: 'lab', name: nomenclature.labTitle, icon: Beaker, color: 'text-blue-500 bg-blue-500/10' },
    { id: 'pharmacy', name: nomenclature.pharmacyTitle, icon: ShoppingBag, color: 'text-emerald-500 bg-emerald-500/10' },
    { id: 'billing', name: 'UPI Ledger', icon: QrCode, color: 'text-rose-500 bg-rose-500/10' },
  ];

  const allowedRolesMap: Record<string, string[]> = {
    'doctor': ['doctor', 'compounder', 'lab', 'pharmacy', 'billing', 'patient'],
    'compounder': ['compounder'],
    'lab_technician': ['lab'],
    'pharmacist': ['pharmacy'],
    'patient': ['patient'],
    'admin': ['billing', 'compounder', 'doctor', 'lab', 'pharmacy', 'patient'],
    'platform_admin': ['billing', 'compounder', 'doctor', 'lab', 'pharmacy', 'patient']
  };

  const activeUserRole = activeProfile?.role || 'compounder';
  const allowedList = allowedRolesMap[activeUserRole] || [];

  const visibleRoles = isBypassMode 
    ? roles 
    : roles.filter(r => allowedList.includes(r.id));

  return (
    <>
      {/* Premium Desktop Left Sidebar Navigation */}
      <aside 
        onClick={() => {
          if (isSidebarCollapsed) {
            onToggleSidebarCollapse?.(false);
          }
        }}
        className={`hidden md:flex flex-col fixed top-0 bottom-0 left-0 ${isSidebarCollapsed ? 'w-20 p-3 items-center' : 'w-64 p-5'} bg-white dark:bg-slate-900/95 border-r border-slate-200/50 dark:border-slate-800 z-40 justify-between transition-all duration-300 ${isSidebarCollapsed ? 'cursor-pointer' : ''}`}
      >
        {/* Collapse Toggle Button (Circular) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSidebarCollapse?.(!isSidebarCollapsed);
          }}
          className="hidden md:flex absolute -right-3 top-8 w-6 h-6 rounded-full bg-white border border-slate-200/80 shadow-sm items-center justify-center text-slate-600 hover:text-slate-700 hover:scale-105 transition-all z-50 cursor-pointer"
          title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Top: Brand Logo and Connected Info */}
        <div className={`space-y-3 w-full ${isSidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center w-full' : 'gap-3'}`}>
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shrink-0 shadow-sm shadow-indigo-600/10">
              <svg className="h-4.5 w-4.5 animate-pulse-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            {!isSidebarCollapsed && (
              <div className="animate-fade-in flex flex-col">
                <h1 className="text-base font-semibold tracking-tight text-slate-900 leading-none">
                  Mediflow Care
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                  <span className={`flex items-center gap-1 text-[8px] font-mono font-semibold px-1 py-0.2 rounded border ${
                    offlineCount > 0
                      ? 'text-amber-600 bg-amber-50/60 border-amber-200/60 animate-pulse'
                      : 'text-cyan-600 bg-cyan-50/60 border-cyan-200/60'
                  }`}>
                    <span>{offlineCount > 0 ? `Queue: ${offlineCount}` : 'Synced'}</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Connection Status Card */}
          {activePod && (
            isSidebarCollapsed ? (
              <div 
                className="w-9 h-9 rounded-lg bg-white border border-slate-200/60 flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                title={`Active Workspace: ${activeEntity?.name} (Code: ${activePod.clinicCode})`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            ) : (
              <div className="p-3 bg-white border border-slate-200/50 rounded-lg space-y-1 shadow-[0_1px_2px_rgba(0,0,0,0.02)] animate-fade-in">
                <span className="block text-[9px] text-slate-600 font-semibold uppercase tracking-wider">Active Workspace</span>
                <span className="block text-xs font-semibold text-slate-800 truncate">{activeEntity?.name}</span>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                  Code: <span className="font-semibold text-slate-700 font-mono">{activePod.clinicCode}</span>
                </div>
              </div>
            )
          )}

          {/* Unified Care Loop Stepper in Sidebar */}
          {activePatient && (
            isSidebarCollapsed ? (
              <div 
                className="flex flex-col items-center gap-2 p-2 bg-white border border-slate-200/50 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors"
                title={`Active Patient Loop: ${activePatient.name}`}
              >
                {[
                  { id: 'registered', label: 'Registered' },
                  { id: 'diagnosing', label: 'Diagnosing (CDSS)' },
                  { id: 'lab', label: nomenclature.careLoopLabStep },
                  { id: 'pharmacy', label: nomenclature.careLoopPharmacyStep },
                  { id: 'settled', label: 'Ledger Settled' }
                ].map((step, idx, arr) => {
                  const stages = arr.map(s => s.id);
                  const currentIdx = stages.indexOf(activePatientStage);
                  const isCompleted = idx < currentIdx;
                  const isActive = idx === currentIdx;
                  
                  return (
                    <div 
                      key={step.id} 
                      title={step.label}
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-semibold border transition-all duration-300 ${
                        isActive 
                          ? 'bg-indigo-50 border-indigo-600 text-indigo-600 shadow-sm' 
                          : isCompleted 
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-600' 
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      {isCompleted ? '✓' : idx + 1}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-2.5 bg-white border border-slate-200/50 rounded-lg space-y-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] animate-fade-in">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-slate-600 font-semibold uppercase tracking-wider">Active Patient Loop</span>
                  <span className="text-[11px] font-semibold text-slate-800 truncate">{activePatient.name}</span>
                </div>
                
                <div className="flex flex-col gap-1.5 font-medium text-[10px]">
                  {[
                    { id: 'registered', label: 'Registered' },
                    { id: 'diagnosing', label: 'Diagnosing (CDSS)' },
                    { id: 'lab', label: nomenclature.careLoopLabStep },
                    { id: 'pharmacy', label: nomenclature.careLoopPharmacyStep },
                    { id: 'settled', label: 'Ledger Settled' }
                  ].map((step, idx, arr) => {
                    const stages = arr.map(s => s.id);
                    const currentIdx = stages.indexOf(activePatientStage);
                    const isCompleted = idx < currentIdx;
                    const isActive = idx === currentIdx;
                    
                    return (
                      <div key={step.id} className="flex items-center gap-2">
                        <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center border text-[9px] font-semibold shrink-0 transition-all duration-300 ${
                          isActive 
                            ? 'bg-indigo-50 border-indigo-600 text-indigo-600 shadow-sm' 
                            : isCompleted 
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-600' 
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}>
                          {isCompleted ? '✓' : idx + 1}
                        </div>
                        <span className={`truncate leading-none ${isActive ? 'text-indigo-600 font-semibold' : isCompleted ? 'text-emerald-700 font-medium' : 'text-slate-600 font-normal'}`}>
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
          <div className="space-y-0.5 pt-2 w-full">
            {!isSidebarCollapsed && (
              <span className="block text-[9px] text-slate-600 font-semibold uppercase tracking-wider pl-2 mb-1.5 animate-fade-in">Ecosystem Modules</span>
            )}
            {visibleRoles.map((r) => {
              const Icon = r.icon;
              const isActive = currentRole === r.id && (r.id !== 'doctor' || activeDoctorTab !== 'sop');
              return (
                <button
                  key={r.id}
                  onClick={(e) => {
                    if (r.id === 'doctor' && activeDoctorTab === 'sop') {
                      window.dispatchEvent(new CustomEvent('mediflow-change-tab', { detail: 'pod_view' }));
                    }
                    if (isSidebarCollapsed) {
                      e.stopPropagation();
                      onChangeRole(r.id as UserRole);
                      onToggleSidebarCollapse?.(false);
                    } else {
                      onChangeRole(r.id as UserRole);
                    }
                  }}
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center py-1.5 px-2 rounded-lg' : 'gap-2.5 px-2.5 py-1.5 rounded-lg'} text-[11px] font-medium transition-all duration-200 relative group cursor-pointer ${
                    isActive
                      ? 'bg-indigo-50/80 text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                  }`}
                  title={r.name}
                >
                  {/* Left accent indicator line on active */}
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-indigo-600 rounded-r" />
                  )}
                  
                  <Icon className={`h-4 w-4 shrink-0 transition-colors ${
                    isActive 
                      ? 'text-indigo-600' 
                      : 'text-slate-600 group-hover:text-slate-600'
                  }`} />
                  
                  {!isSidebarCollapsed && (
                    <span className="flex-1 text-left animate-fade-in">{r.name}</span>
                  )}
                </button>
              );
            })}
            
            {currentRole === 'doctor' && (
              <button
                onClick={(e) => {
                  if (isSidebarCollapsed) {
                    e.stopPropagation();
                    onToggleSidebarCollapse?.(false);
                  }
                  window.dispatchEvent(new CustomEvent('mediflow-change-tab', { detail: 'sop' }));
                }}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center py-1.5 px-2 rounded-lg' : 'gap-2.5 px-2.5 py-1.5 rounded-lg'} text-[11px] font-medium transition-all duration-200 relative group cursor-pointer ${
                  activeDoctorTab === 'sop'
                    ? 'bg-indigo-50/80 text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                }`}
                title="Clinic SOP"
              >
                {/* Left accent indicator line on active */}
                {activeDoctorTab === 'sop' && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-indigo-600 rounded-r" />
                )}
                
                <FileText className={`h-4 w-4 shrink-0 transition-colors ${
                  activeDoctorTab === 'sop' 
                    ? 'text-indigo-600' 
                    : 'text-slate-600 group-hover:text-slate-600'
                }`} />
                
                {!isSidebarCollapsed && (
                  <span className="flex-1 text-left animate-fade-in">Clinic SOP</span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Bottom: Active Profile Badge & Workspace Actions */}
        <div className={`space-y-4 pt-4 border-t border-slate-200/60 w-full ${isSidebarCollapsed ? 'flex flex-col items-center gap-3 pt-3' : ''}`}>
          {activeProfile && (
            isSidebarCollapsed ? (
              <div className="flex flex-col items-center gap-3 w-full">
                {/* Collapsed Profile Avatar */}
                <div 
                  className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  title={`Active Profile: ${activeProfile.display_name} (${activeProfile.role})`}
                >
                  {activeProfile.display_name.charAt(0)}
                </div>

                {/* Collapsed Settings Trigger */}
                <button
                  onClick={handleCollapsedSettingsClick}
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-600 transition-all duration-250 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  title="Open Settings & SOPs"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-3 animate-fade-in w-full">
                {/* Profile Details Badge */}
                <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-slate-200/50 font-sans shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                    {activeProfile.display_name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-slate-800 truncate leading-tight">{activeProfile.display_name}</span>
                    <span className="block text-[9px] text-slate-600 font-semibold uppercase tracking-wider mt-0.5">{displayRole(activeProfile.role)}</span>
                  </div>
                </div>

                {/* Settings & SOP Section (Collapsible Accordion) */}
                <div className="border border-slate-200/60 rounded-lg overflow-hidden bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] w-full">
                  <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100/50 text-[11px] font-semibold text-slate-700 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Settings className="h-3.5 w-3.5 text-slate-500" />
                      Settings & SOP
                    </span>
                    {isSettingsOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 text-slate-600" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                    )}
                  </button>

                  {isSettingsOpen && (
                    <div className="p-2.5 space-y-2.5 border-t border-slate-200/40 bg-white animate-fade-in w-full">

                      {/* Dev Bypass Trigger */}
                      <button 
                        onClick={() => onToggleBypass(!isBypassMode)}
                        className={`w-full flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-md border text-[9px] font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                          isBypassMode 
                            ? 'bg-amber-50/60 border-amber-200/60 text-amber-700 shadow-sm' 
                            : 'bg-white border-slate-200/60 text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {isBypassMode ? (
                          <>
                            <ShieldAlert className="h-3 w-3 text-amber-600 animate-pulse" />
                            Bypass Active
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-3 w-3 text-slate-600" />
                            Secure Mode
                          </>
                        )}
                      </button>

                      {/* Relocated SOP Info Section */}
                      <div className="p-2 bg-slate-50/50 dark:bg-slate-800/50 rounded-md border border-slate-100 dark:border-slate-800/80 space-y-1.5 text-[9px] w-full">
                        <div className="flex items-center gap-1.5 font-bold text-slate-600 uppercase tracking-wider">
                          <FileText className="h-3 w-3 text-indigo-500" />
                          <span>Active SOP Details</span>
                        </div>
                        
                        {activeSop ? (
                          <div className="space-y-1 font-medium text-slate-500 leading-normal">
                            <div className="text-slate-700 font-semibold truncate" title={activeSop.sopFileName}>
                              📄 {activeSop.sopFileName}
                            </div>
                            <div className="text-[8.5px] bg-white p-1 rounded border border-slate-200/50 break-words max-h-16 overflow-y-auto font-mono">
                              {activeSop.sopText}
                            </div>
                          </div>
                        ) : (
                          <span className="block text-slate-600 italic">No active SOP loaded</span>
                        )}

                        <div className="pt-1.5 border-t border-slate-200/50 flex flex-col gap-1 text-[8px] font-semibold text-slate-600 uppercase tracking-wide">
                          <span>Pod: Patna Zone 1</span>
                          <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/30 w-fit">
                            <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                            Ecosystem Core Active
                          </span>
                        </div>
                      </div>

                      {/* Relocated Log Out Button */}
                      <button
                        onClick={onSignOut}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 hover:text-rose-800 rounded-md transition-all duration-200 font-semibold text-[10px] cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.01)]"
                      >
                        <LogOut className="h-3 w-3" />
                        Sign Out Workspace
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </aside>

      {/* Mobile Top Header Navigation */}
      <nav className="md:hidden border-b border-slate-200/50 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl sticky top-0 z-50 px-3 py-1.5 shadow-[0_1px_6px_rgba(15,23,42,0.02)] w-full">
        <div className="max-w-7xl mx-auto flex flex-col gap-2">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 min-w-0">
              {/* Mobile Sidebar Drawer Hamburger Trigger */}
              <button 
                onClick={() => setIsMobileDrawerOpen(true)}
                className="p-1 bg-white hover:bg-slate-50 border border-slate-200/60 rounded-md text-slate-500 hover:text-slate-800 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.01)] cursor-pointer"
                aria-label="Open Sidebar Drawer"
              >
                <Menu className="h-4 w-4" />
              </button>

              <div className="flex flex-col min-w-0">
                <h1 className="font-bold text-[9px] uppercase tracking-wider text-slate-700 truncate flex items-center gap-1 leading-none">
                  {activeProfile?.display_name 
                    ? (activeProfile.display_name.toLowerCase().startsWith('dr.') 
                        ? `${activeProfile.display_name}'s Care Dashboard` 
                        : `Dr. ${activeProfile.display_name}'s Care Dashboard`)
                    : 'Doctor Dashboard'}
                  <span className={`flex items-center gap-0.5 text-[7px] font-mono px-1 py-0.2 rounded border transition-all duration-300 shrink-0 ${
                    isSyncing 
                      ? 'bg-primary/10 text-primary border-primary/25'
                      : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25'
                  }`}>
                    <span className={`w-1 h-1 rounded-full ${isSyncing ? 'bg-primary' : 'bg-emerald-500 animate-pulse'}`} />
                    {isSyncing ? 'Sync' : 'Live'}
                  </span>
                </h1>
                {activePod && (
                  <p className="text-slate-600 text-[8px] font-medium leading-none mt-0.5 truncate">
                    Connected: <strong className="text-slate-500 font-semibold">{activeEntity?.name}</strong>
                  </p>
                )}
              </div>
            </div>

            {/* Mobile Actions */}
            <div className="flex items-center gap-1.5">

              <button 
                onClick={() => onToggleBypass(!isBypassMode)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[8px] font-semibold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  isBypassMode 
                    ? 'bg-amber-50 border-amber-200 text-amber-600' 
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                {isBypassMode ? <ShieldAlert className="h-2.5 w-2.5" /> : <ShieldCheck className="h-2.5 w-2.5" />}
                Bypass
              </button>
            </div>
          </div>

          {/* Unified Care Loop Progress Ribbon */}
          {activePatient && (
            <div className="mt-1 pt-2 border-t border-slate-200/50 flex flex-col gap-2 text-[10px] animate-fade-in">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-600 font-semibold uppercase tracking-wider text-[8px]">Active Loop:</span>
                <span className="text-slate-700 font-semibold">{activePatient.name}</span>
                <span className="text-slate-600 font-mono">({activePatient.id.substring(0, 8)})</span>
              </div>
              
              {/* Stepper Steps inside pure white container card */}
              <div className="bg-white border border-slate-200/50 rounded-lg p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center gap-1.5 overflow-x-auto scrollbar-none font-semibold text-[9px]">
                {[
                  { id: 'registered', label: 'Registered' },
                  { id: 'diagnosing', label: 'Diagnosing (CDSS)' },
                  { id: 'lab', label: nomenclature.careLoopLabStep },
                  { id: 'pharmacy', label: nomenclature.careLoopPharmacyStep },
                  { id: 'settled', label: 'Ledger Settled' }
                ].map((step, idx, arr) => {
                  const stages = arr.map(s => s.id);
                  const currentIdx = stages.indexOf(activePatientStage);
                  const isCompleted = idx < currentIdx;
                  const isActive = idx === currentIdx;
                  
                  return (
                    <React.Fragment key={step.id}>
                      <div className={`flex items-center gap-1 transition-all duration-500 ${
                        isActive 
                          ? 'text-indigo-600' 
                          : isCompleted 
                            ? 'text-emerald-600' 
                            : 'text-slate-600'
                      }`}>
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center border text-[8px] font-semibold transition-all duration-500 ${
                          isActive 
                            ? 'bg-indigo-50 border-indigo-600 text-indigo-600 shadow-sm' 
                            : isCompleted 
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-600' 
                              : 'bg-slate-50 border-slate-100 text-slate-600'
                        }`}>
                          {isCompleted ? '✓' : idx + 1}
                        </div>
                        <span className="whitespace-nowrap">{step.label}</span>
                      </div>
                      
                      {idx < arr.length - 1 && (
                        <div className={`w-2 h-[1px] rounded transition-all duration-500 shrink-0 ${
                          idx < currentIdx 
                            ? 'bg-emerald-400' 
                            : 'bg-slate-200'
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
            className="fixed inset-0 bg-white/40 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setIsMobileDrawerOpen(false)}
          />

          {/* Drawer Content Sheet */}
          <aside className="relative flex flex-col w-72 bg-white dark:bg-slate-900 h-full p-5 justify-between shadow-2xl animate-slide-in-left z-50 border-r border-slate-200/50 dark:border-slate-800">
            <div className="space-y-6">
              {/* Header inside drawer */}
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-8.5 w-8.5 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shrink-0 shadow-sm">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-semibold text-sm tracking-tight text-slate-900 leading-none">Mediflow Care</h2>
                    <span className="text-[9px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </span>
                  </div>
                </div>

                <button 
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-1 hover:bg-slate-200/60 rounded-lg text-slate-600 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Active Workspace */}
              {activePod && (
                <div className="p-3 bg-white border border-slate-200/50 rounded-lg space-y-1 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <span className="block text-[9px] text-slate-600 font-semibold uppercase tracking-wider">Active Workspace</span>
                  <span className="block text-xs font-semibold text-slate-800 truncate">{activeEntity?.name}</span>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                    Code: <span className="font-semibold text-slate-700 font-mono">{activePod.clinicCode}</span>
                  </div>
                </div>
              )}

              {/* Patient Care loop inside drawer */}
              {activePatient && (
                <div className="p-3 bg-white border border-slate-200/50 rounded-lg space-y-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] text-slate-600 font-semibold uppercase tracking-wider">Active Patient Loop</span>
                    <span className="text-xs font-semibold text-slate-800 truncate">{activePatient.name}</span>
                  </div>
                  
                  <div className="flex flex-col gap-2 font-medium text-[11px]">
                    {[
                      { id: 'registered', label: 'Registered' },
                      { id: 'diagnosing', label: 'Diagnosing (CDSS)' },
                      { id: 'lab', label: nomenclature.careLoopLabStep },
                      { id: 'pharmacy', label: nomenclature.careLoopPharmacyStep },
                      { id: 'settled', label: 'Ledger Settled' }
                    ].map((step, idx, arr) => {
                      const stages = arr.map(s => s.id);
                      const currentIdx = stages.indexOf(activePatientStage);
                      const isCompleted = idx < currentIdx;
                      const isActive = idx === currentIdx;
                      
                      return (
                        <div key={step.id} className="flex items-center gap-2">
                          <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center border text-[9px] font-semibold shrink-0 transition-all duration-300 ${
                            isActive 
                              ? 'bg-indigo-50 border-indigo-600 text-indigo-600 shadow-sm' 
                              : isCompleted 
                                ? 'bg-emerald-50 border-emerald-500 text-emerald-600' 
                                : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}>
                            {isCompleted ? '✓' : idx + 1}
                          </div>
                          <span className={`truncate leading-none ${isActive ? 'text-indigo-600 font-semibold' : isCompleted ? 'text-emerald-700 font-medium' : 'text-slate-600 font-normal'}`}>
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
                <span className="block text-[9px] text-slate-600 font-semibold uppercase tracking-wider pl-3 mb-2">Ecosystem Modules</span>
                {visibleRoles.map((r) => {
                  const Icon = r.icon;
                  const isActive = currentRole === r.id && (r.id !== 'doctor' || activeDoctorTab !== 'sop');
                  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        if (r.id === 'doctor' && activeDoctorTab === 'sop') {
                          window.dispatchEvent(new CustomEvent('mediflow-change-tab', { detail: 'pod_view' }));
                        }
                        onChangeRole(r.id as UserRole);
                        setIsMobileDrawerOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative group cursor-pointer ${
                        isActive
                          ? 'bg-indigo-50/80 text-indigo-600 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-indigo-600 rounded-r" />
                      )}
                      <Icon className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                        isActive ? 'text-indigo-600' : 'text-slate-600 group-hover:text-slate-600'
                      }`} />
                      <span className="flex-1 text-left">{r.name}</span>
                    </button>
                  );
                })}
                
                {currentRole === 'doctor' && (
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('mediflow-change-tab', { detail: 'sop' }));
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative group cursor-pointer ${
                      activeDoctorTab === 'sop'
                        ? 'bg-indigo-50/80 text-indigo-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                    }`}
                  >
                    {activeDoctorTab === 'sop' && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-indigo-600 rounded-r" />
                    )}
                    <FileText className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                      activeDoctorTab === 'sop' ? 'text-indigo-600' : 'text-slate-600 group-hover:text-slate-600'
                    }`} />
                    <span className="flex-1 text-left">Clinic SOP</span>
                  </button>
                )}
              </div>
            </div>

            {/* Bottom active profile and workspace actions inside drawer */}
            <div className="space-y-4 pt-4 border-t border-slate-200/60">
              {activeProfile && (
                <div className="space-y-3">
                  {/* Profile Card */}
                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-slate-200/50 font-sans shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                      {activeProfile.display_name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-slate-800 truncate leading-tight">{activeProfile.display_name}</span>
                      <span className="block text-[9px] text-slate-600 font-semibold uppercase tracking-wider mt-0.5">{displayRole(activeProfile.role)}</span>
                    </div>
                  </div>

                  {/* Settings & SOP Section (Collapsible Accordion) */}
                  <div className="border border-slate-200/60 rounded-lg overflow-hidden bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] w-full">
                    <button
                      onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100/50 text-[11px] font-semibold text-slate-700 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Settings className="h-3.5 w-3.5 text-slate-500" />
                        Settings & SOP
                      </span>
                      {isSettingsOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 text-slate-600" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                      )}
                    </button>

                    {isSettingsOpen && (
                      <div className="p-2.5 space-y-2.5 border-t border-slate-200/40 bg-white animate-fade-in w-full">

                        {/* Dev Bypass Trigger */}
                        <button 
                          onClick={() => {
                            onToggleBypass(!isBypassMode);
                            setIsMobileDrawerOpen(false);
                          }}
                          className={`w-full flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-md border text-[9px] font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                            isBypassMode 
                              ? 'bg-amber-50/60 border-amber-200/60 text-amber-700 shadow-sm' 
                              : 'bg-white border-slate-200/60 text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {isBypassMode ? (
                            <>
                              <ShieldAlert className="h-3 w-3 text-amber-600 animate-pulse" />
                              Bypass Active
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-3 w-3 text-slate-600" />
                              Secure Mode
                            </>
                          )}
                        </button>

                        {/* SOP Info Section */}
                        <div className="p-2 bg-slate-50/50 dark:bg-slate-800/50 rounded-md border border-slate-100 dark:border-slate-800/80 space-y-1.5 text-[9px] w-full">
                          <div className="flex items-center gap-1.5 font-bold text-slate-600 uppercase tracking-wider">
                            <FileText className="h-3 w-3 text-indigo-500" />
                            <span>Active SOP Details</span>
                          </div>
                          
                          {activeSop ? (
                            <div className="space-y-1 font-medium text-slate-500 leading-normal">
                              <div className="text-slate-700 font-semibold truncate" title={activeSop.sopFileName}>
                                📄 {activeSop.sopFileName}
                              </div>
                              <div className="text-[8.5px] bg-white p-1 rounded border border-slate-200/50 break-words max-h-16 overflow-y-auto font-mono">
                                {activeSop.sopText}
                              </div>
                            </div>
                          ) : (
                            <span className="block text-slate-600 italic">No active SOP loaded</span>
                          )}

                          <div className="pt-1.5 border-t border-slate-200/50 flex flex-col gap-1 text-[8px] font-semibold text-slate-600 uppercase tracking-wide">
                            <span>Pod: Patna Zone 1</span>
                            <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/30 w-fit">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Ecosystem Core Active
                            </span>
                          </div>
                        </div>

                        {/* Relocated Log Out Button */}
                        <button
                          onClick={() => {
                            onSignOut();
                            setIsMobileDrawerOpen(false);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 hover:text-rose-800 rounded-md transition-all duration-200 font-semibold text-[10px] cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.01)]"
                        >
                          <LogOut className="h-3 w-3" />
                          Sign Out Workspace
                        </button>
                      </div>
                    )}
                  </div>
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
            <span className="text-[9px] font-mono text-slate-600">
              {logs.length} events logged
            </span>
            <div className="text-slate-600 hover:text-slate-700 transition-colors">
              {isHudExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </div>
          </div>
        </div>

        {/* HUD Log Output Panel */}
        {isHudExpanded && (
          <div className="flex-1 p-4 overflow-y-auto font-mono text-[10.5px] leading-relaxed space-y-2 bg-slate-50/50">
            {logs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-600 text-xs italic">
                Scanning database pipeline... Listening for Postgres CDC mutations.
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex flex-col sm:flex-row sm:items-center gap-2 hover:bg-slate-100/30 py-0.5 px-2 rounded transition-colors group">
                  {/* Timestamp */}
                  <span className="text-slate-600 shrink-0 select-none">[{log.timestamp}]</span>
                  
                  {/* Event tag */}
                  <span className={`text-[8.5px] font-bold tracking-widest px-1.5 py-0.5 rounded shrink-0 uppercase ${getLogTagStyle(log.action_type)}`}>
                    {getLogTagLabel(log.action_type)}
                  </span>
                  
                  {/* Role descriptor */}
                  {log.role && log.role !== 'system' && (
                    <span className="text-slate-600 font-bold uppercase text-[8px] bg-slate-50 px-1 py-0.2 rounded border border-slate-100">
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
      {currentRole !== 'doctor' && currentRole !== 'compounder' && currentRole !== 'lab' && currentRole !== 'pharmacy' && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200/50 dark:border-slate-800 shadow-[0_-4px_12px_rgba(0,0,0,0.02)] px-2 pb-safe-bottom">
          <div className="flex items-center justify-around h-16">
            {visibleRoles.map((r) => {
              const Icon = r.icon;
              const isActive = currentRole === r.id;
              
              // Map role ID to a short professional label for the bottom nav
              let label = r.name;
              if (r.id === 'compounder') label = 'Comp.';
              else if (r.id === 'doctor') label = 'Doctor';
              else if (r.id === 'lab') label = isOphthalmology ? 'Diag.' : 'Lab';
              else if (r.id === 'pharmacy') label = isOphthalmology ? 'Optical' : 'Pharmacy';
              else if (r.id === 'billing') label = 'Ledger';
              else if (r.id === 'patient') label = 'Patient';

              return (
                <button
                  key={r.id}
                  onClick={() => onChangeRole(r.id as UserRole)}
                  className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-200 cursor-pointer relative ${
                    isActive 
                      ? 'text-indigo-600' 
                      : 'text-slate-600 hover:text-slate-600'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg transition-all duration-200 ${
                    isActive 
                      ? 'bg-indigo-50 text-indigo-600 scale-105 shadow-sm' 
                      : 'bg-transparent text-slate-600'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`text-[9px] font-semibold mt-1 tracking-tight transition-colors duration-200 ${
                    isActive ? 'text-indigo-600 font-bold' : 'text-slate-600'
                  }`}>
                    {label}
                  </span>
                  
                  {/* Active Indicator dot */}
                  {isActive && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-600" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};

