import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useSpecialization } from '../../context/SpecializationContext';

import { 
  Receipt,
  UserPlus, 
  User,
  Stethoscope, 
  Beaker, 
  ShoppingBag, 
  QrCode,
  LogOut,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Settings,
  FileText,
  Eye,
  Sun,
  Moon,
  LayoutDashboard,
  ClipboardList,
  CreditCard,
  Users,
  MessageSquare,
  FlaskConical,
  UploadCloud,
  Activity,
  Bot,
  Building,
  Coins,
  Sliders
} from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import { ProfileSettingsModal, type SettingsTabType } from './ProfileSettingsModal';
import { BrandMark } from './BrandMark';
import { SyncStatusPill } from './SyncStatusPill';
import { safeGetStorageJSON } from '../../utils/storage';

export type UserRole = 'compounder' | 'doctor' | 'lab' | 'pharmacy' | 'billing' | 'patient' | 'saas_admin' | 'refraction';

interface NavbarProps {
  currentRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  activeProfile: any;
  onSignOut: () => void;
  isBypassMode: boolean;
  onToggleBypass: (bypass: boolean) => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebarCollapse?: (collapsed: boolean) => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  currentRole, 
  onChangeRole, 
  activeProfile, 
  onSignOut,
  isBypassMode,
  onToggleBypass,
  isSidebarCollapsed = false,
  onToggleSidebarCollapse,
  isDarkMode = false,
  onToggleDarkMode
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [activeDoctorTab, setActiveDoctorTab] = useState<string>('pod_view');
  const [activeCompounderTab, setActiveCompounderTab] = useState<string>('overview');
  const [activePharmacyTab, setActivePharmacyTab] = useState<string>('prescription_queue');
  const [activeLabTab, setActiveLabTab] = useState<string>('queue');
  const [activeAdminTab, setActiveAdminTab] = useState<string>('saas_health');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalInitialTab, setProfileModalInitialTab] = useState<SettingsTabType>('profile');
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('connected');

  useEffect(() => {
    const handleStatus = (e: any) => {
      if (e.detail?.status) {
        setRealtimeStatus(e.detail.status);
      }
    };
    window.addEventListener('vitalsync-realtime-status', handleStatus);
    return () => window.removeEventListener('vitalsync-realtime-status', handleStatus);
  }, []);

  useEffect(() => {
    const handleDoctorTabChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) setActiveDoctorTab(customEvent.detail);
    };
    const handleCompounderTabChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) setActiveCompounderTab(customEvent.detail);
    };
    const handlePharmacyTabChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) setActivePharmacyTab(customEvent.detail);
    };
    const handleLabTabChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) setActiveLabTab(customEvent.detail);
    };
    const handleAdminTabChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) setActiveAdminTab(customEvent.detail);
    };

    window.addEventListener('mediflow-doctor-tab-changed', handleDoctorTabChange);
    window.addEventListener('mediflow-compounder-tab-changed', handleCompounderTabChange);
    window.addEventListener('mediflow-pharmacy-tab-changed', handlePharmacyTabChange);
    window.addEventListener('mediflow-lab-tab-changed', handleLabTabChange);
    window.addEventListener('mediflow-admin-tab-changed', handleAdminTabChange);

    return () => {
      window.removeEventListener('mediflow-doctor-tab-changed', handleDoctorTabChange);
      window.removeEventListener('mediflow-compounder-tab-changed', handleCompounderTabChange);
      window.removeEventListener('mediflow-pharmacy-tab-changed', handlePharmacyTabChange);
      window.removeEventListener('mediflow-lab-tab-changed', handleLabTabChange);
      window.removeEventListener('mediflow-admin-tab-changed', handleAdminTabChange);
    };
  }, []);

  useEffect(() => {
    if (currentRole === 'compounder') {
      setActiveCompounderTab('overview');
    } else if (currentRole === 'pharmacy') {
      setActivePharmacyTab('prescription_queue');
    } else if (currentRole === 'lab') {
      setActiveLabTab('queue');
    } else if (currentRole === 'saas_admin') {
      setActiveAdminTab('saas_health');
    } else if (currentRole === 'doctor') {
      setActiveDoctorTab('pod_view');
    }
  }, [currentRole]);
  
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return isDarkMode ?? (localStorage.getItem('theme') === 'dark');
    }
    return isDarkMode ?? false;
  });

  useEffect(() => {
    if (isDarkMode !== undefined) {
      setIsDark(isDarkMode);
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body?.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body?.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    window.dispatchEvent(new CustomEvent('mediflow-theme-change', { detail: { isDark } }));
  }, [isDark]);

  const handleToggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      document.body?.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body?.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    if (onToggleDarkMode) {
      onToggleDarkMode();
    }
    window.dispatchEvent(new CustomEvent('mediflow-theme-change', { detail: { isDark: next } }));
  };

  useEffect(() => {
    const handleThemeToggle = () => {
      handleToggleTheme();
    };
    window.addEventListener('mediflow-theme-toggle', handleThemeToggle);
    return () => {
      window.removeEventListener('mediflow-theme-toggle', handleThemeToggle);
    };
  }, [isDark]);
  
  const activeSop = api.getActiveSop();

  const handleCollapsedSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSidebarCollapse?.(false);
    setIsSettingsOpen(true);
  };
  const [activePatient, setActivePatient] = useState<any>(null);
  const [activePatientStage, setActivePatientStage] = useState<string>('registered');
  const [offlineCount, setOfflineCount] = useState(0);

  useEffect(() => {
    const handlePwaSync = () => {
      try {
        const queue = safeGetStorageJSON<any[]>('offline_sync_queue', []);
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



  const roles = [
    { id: 'compounder', name: 'Compounder', icon: UserPlus, color: 'text-accent-500 bg-accent-500/10' },
    { id: 'doctor', name: 'Doctor Dashboard', icon: Stethoscope, color: 'text-primary-500 bg-primary-500/10' },
    ...(isOphthalmology ? [
      { id: 'refraction', name: 'Refraction Desk', icon: Eye, color: 'text-violet-500 bg-violet-500/10' }
    ] : []),
    { id: 'lab', name: nomenclature.labTitle, icon: Beaker, color: 'text-blue-500 bg-blue-500/10' },
    { id: 'pharmacy', name: nomenclature.pharmacyTitle, icon: ShoppingBag, color: 'text-emerald-500 bg-emerald-500/10' },
    { id: 'billing', name: 'UPI Ledger', icon: QrCode, color: 'text-rose-500 bg-rose-500/10' },
    { id: 'saas_admin', name: 'Platform Operations', icon: ShieldAlert, color: 'text-cyan-500 bg-cyan-500/10' },
  ];

  const allowedRolesMap: Record<string, string[]> = {
    'doctor': ['doctor', 'compounder', 'lab', 'pharmacy', 'billing', 'patient', 'refraction'],
    'compounder': ['compounder'],
    'lab_technician': ['lab'],
    'pharmacist': ['pharmacy'],
    'patient': ['patient'],
    'admin': ['saas_admin'],
    'platform_admin': ['saas_admin'],
    'refraction': ['refraction'],
  };

  const activeUserRole = activeProfile?.role || (currentRole === 'lab' ? 'lab_technician' : currentRole === 'pharmacy' ? 'pharmacist' : currentRole);
  const allowedList = allowedRolesMap[activeUserRole] || [currentRole];

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
        className={`hidden md:flex flex-col fixed top-0 bottom-0 left-0 ${isSidebarCollapsed ? 'w-20 p-3 items-center' : 'w-64 p-5'} bg-white/70 dark:bg-slate-950/60 backdrop-blur-md border-r border-slate-200/50 dark:border-white/5 z-40 transition-all duration-300 overflow-y-auto no-scrollbar ${isSidebarCollapsed ? 'cursor-pointer' : ''}`}
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
        <div className={`flex-1 space-y-3 w-full ${isSidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center w-full' : 'gap-3'}`}>
            <div className="flex items-center justify-center h-9 w-9 shrink-0">
              <BrandMark size={32} title="VitalSync logo" />
            </div>
            {!isSidebarCollapsed && (
              <div className="animate-fade-in flex flex-col">
                <h1 className="text-base font-black tracking-tight leading-none font-sans">
                  <span className="text-[#1A7B8F]">Vital</span>
                  <span className="text-[#7AC47F]">Sync</span>
                </h1>
                <span className="text-[7.5px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 mt-0.5">Virtual Hospital Network</span>
                <div className="flex items-center gap-2 mt-1">
                  <SyncStatusPill compact={false} />
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
                <div className="flex items-center justify-between gap-1 text-[10px] text-slate-500 font-medium">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                    Code: <span className="font-semibold text-slate-700 font-mono">{activePod.clinicCode}</span>
                  </div>
                  <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-md border flex items-center gap-1 uppercase ${
                    realtimeStatus === 'connected'
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-600 border-amber-500/20 animate-pulse'
                  }`}>
                    <span className={`w-1 h-1 rounded-full ${realtimeStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {realtimeStatus === 'connected' ? '360° Live' : 'Reconnecting'}
                  </span>
                </div>
              </div>
            )
          )}



          {/* Vertical Menu Options */}
          <div className="space-y-0.5 pt-2 w-full">
            {visibleRoles.length > 1 && (
              <div className="space-y-0.5 w-full">
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
                      className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center py-1.5 px-2 rounded-lg' : 'gap-2.5 px-2.5 py-1.5 rounded-lg'} text-[11px] font-medium transition-all duration-300 relative group cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                        isActive
                          ? 'bg-indigo-50/80 text-indigo-600 shadow-[0_2px_8px_rgba(79,70,229,0.08)] border border-indigo-100/40'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                      }`}
                      title={isSidebarCollapsed ? undefined : r.name}
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

                      {/* Collapsed Tooltip Overlay */}
                      {isSidebarCollapsed && (
                        <div className="absolute left-16 bg-slate-900/95 backdrop-blur-md text-white text-[9px] font-bold px-2.5 py-1.5 rounded-lg shadow-lg border border-slate-700/50 opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0 z-[100] whitespace-nowrap">
                          {r.name}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            
            {currentRole === 'doctor' && (
              <button
                onClick={(e) => {
                  if (isSidebarCollapsed) {
                    e.stopPropagation();
                    onToggleSidebarCollapse?.(false);
                  }
                  window.dispatchEvent(new CustomEvent('mediflow-change-tab', { detail: 'sop' }));
                }}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center py-1.5 px-2 rounded-lg' : 'gap-2.5 px-2.5 py-1.5 rounded-lg'} text-[11px] font-medium transition-all duration-300 relative group cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                  activeDoctorTab === 'sop'
                    ? 'bg-indigo-50/80 text-indigo-600 shadow-[0_2px_8px_rgba(79,70,229,0.08)] border border-indigo-100/40'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                }`}
                title={isSidebarCollapsed ? undefined : "Clinic SOP"}
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

                {/* Collapsed Tooltip Overlay */}
                {isSidebarCollapsed && (
                  <div className="absolute left-16 bg-slate-900/95 backdrop-blur-md text-white text-[9px] font-bold px-2.5 py-1.5 rounded-lg shadow-lg border border-slate-700/50 opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0 z-[100] whitespace-nowrap">
                    Clinic SOP
                  </div>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Bottom: Active Profile Badge & Workspace Actions */}
        <div className={`space-y-4 pt-4 border-t border-slate-200/60 w-full ${isSidebarCollapsed ? 'flex flex-col items-center gap-3 pt-3' : ''}`}>
          {/* Persistent Theme Toggle (Always visible, even if activeProfile is loading/null) */}
          <div className="w-full">
            {isSidebarCollapsed ? (
              <button
                onClick={handleToggleTheme}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200/60 dark:border-white/5 text-slate-650 dark:text-zinc-400 transition-all duration-200 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)] relative group hover:scale-105 active:scale-95 mb-1"
                title={isDark ? "Light Mode" : "Dark Mode"}
              >
                {isDark ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-indigo-500" />}
              </button>
            ) : (
              <button
                onClick={handleToggleTheme}
                className="w-full flex items-center justify-between py-2 px-3 bg-slate-100 hover:bg-slate-200/60 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200/60 dark:border-white/5 text-slate-700 dark:text-zinc-300 rounded-lg transition-all duration-200 font-semibold text-[11px] cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.01)]"
              >
                <span className="flex items-center gap-2">
                  {isDark ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-indigo-500" />}
                  Theme Mode
                </span>
                <span className="text-[9px] uppercase tracking-wider text-slate-500">{isDark ? 'Dark' : 'Light'}</span>
              </button>
            )}
          </div>

          {activeProfile && (
            isSidebarCollapsed ? (
              <div className="flex flex-col items-center gap-3 w-full">
                {/* Collapsed Profile Avatar */}
                <div 
                  className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)] relative group hover:scale-105 transition-all duration-200"
                >
                  {activeProfile.display_name.charAt(0)}
                  <div className="absolute left-12 bg-slate-900/95 backdrop-blur-md text-white text-[9px] font-bold px-2.5 py-1.5 rounded-lg shadow-lg border border-slate-700/50 opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0 z-[100] whitespace-nowrap">
                    {activeProfile.display_name} ({displayRole(activeProfile.role)})
                  </div>
                </div>

                {/* Collapsed Settings Trigger */}
                <button
                  onClick={handleCollapsedSettingsClick}
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-white hover:bg-slate-50 border border-slate-200 text-slate-650 hover:text-slate-700 transition-all duration-200 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)] relative group hover:scale-105 active:scale-95"
                >
                  <Settings className="h-4 w-4" />
                  <div className="absolute left-12 bg-slate-900/95 backdrop-blur-md text-white text-[9px] font-bold px-2.5 py-1.5 rounded-lg shadow-lg border border-slate-700/50 opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0 z-[100] whitespace-nowrap">
                    Open Settings
                  </div>
                </button>
              </div>
            ) : (
              <div className="space-y-3 animate-fade-in w-full">
                {/* Profile Details Badge */}
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/5 font-sans shadow-2xs">
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white font-black text-xs flex items-center justify-center shadow-xs">
                      {activeProfile.display_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-slate-900 dark:text-zinc-100 truncate leading-snug">{activeProfile.display_name}</span>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="inline-block px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-widest bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-200/60 dark:border-indigo-800/40">{displayRole(activeProfile.role)}</span>
                    </div>
                  </div>
                </div>

                {/* Settings & Workspace Control Center */}
                <div className="border border-slate-200/60 dark:border-white/5 rounded-xl overflow-hidden bg-white/80 dark:bg-slate-900/40 shadow-2xs w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileModalInitialTab('profile');
                      setIsProfileModalOpen(true);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-50/50 dark:bg-slate-950/20 hover:bg-slate-100/50 dark:hover:bg-slate-950/40 text-[11px] font-bold text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Settings className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      Settings & Control Center
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  </button>

                  <div className="p-2.5 space-y-2.5 border-t border-slate-200/40 dark:border-white/5 bg-transparent animate-fade-in w-full">
                    {/* Dev Bypass Trigger — DEV ONLY */}
                    {import.meta.env.DEV && (
                      <button 
                        type="button"
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
                            Secure Mode [DEV]
                          </>
                        )}
                      </button>
                    )}

                    {/* Profile & Enterprise Settings button */}
                    <button
                      type="button"
                      onClick={() => {
                        setProfileModalInitialTab('profile');
                        setIsProfileModalOpen(true);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-2.5 bg-indigo-50/80 hover:bg-indigo-100/80 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 border border-indigo-200/80 dark:border-indigo-800/40 text-indigo-700 dark:text-indigo-300 rounded-lg transition-all duration-200 font-bold text-xs cursor-pointer shadow-2xs"
                    >
                      <User className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      Open Settings Hub
                    </button>

                    {/* Log Out Action Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSettingsOpen(false);
                        onSignOut();
                      }}
                      className="w-full group flex items-center justify-center gap-2 py-2 px-3 bg-rose-50/80 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200/80 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 rounded-lg transition-all duration-200 font-bold text-xs cursor-pointer shadow-2xs hover:shadow-rose-500/10 active:scale-[0.98]"
                    >
                      <LogOut className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 group-hover:-translate-x-0.5 transition-transform" />
                      <span>Sign Out Workspace</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </aside>

      {/* Mobile Top Header Navigation */}
      <nav 
        className="md:hidden border-b border-slate-200/50 dark:border-white/5 bg-white/70 dark:bg-slate-950/60 backdrop-blur-xl sticky top-0 z-50 px-3 py-1.5 shadow-[0_1px_4px_rgba(15,23,42,0.02)] w-full"
        style={{ paddingTop: 'env(safe-area-inset-top, 16px)' }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Mobile Sidebar Drawer Hamburger Trigger */}
            <button 
              onClick={() => setIsMobileDrawerOpen(true)}
              className="p-1 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/5 rounded-lg text-slate-550 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white transition-all shadow-[0_1px_2px_rgba(0,0,0,0.01)] cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center border-0 outline-none"
              aria-label="Open Sidebar Drawer"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>

            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <h1 className="font-bold text-[9px] uppercase tracking-wider text-slate-700 dark:text-slate-350 truncate flex items-center gap-1.5 leading-none">
                {activeProfile?.display_name 
                  ? (activeProfile.role === 'doctor' && !(activeProfile.display_name || '').toLowerCase().startsWith('dr.')
                      ? `Dr. ${activeProfile.display_name}`
                      : activeProfile.display_name)
                  : 'VitalSync'}
                {' · '}
                {currentRole === 'doctor' ? 'Doctor Dashboard' :
                 currentRole === 'compounder' ? 'Compounder Operations' :
                 currentRole === 'lab' ? (isOphthalmology ? 'Diagnostics' : 'Pathology Lab') :
                 currentRole === 'pharmacy' ? (isOphthalmology ? 'Optician' : 'Pharmacy POS') :
                 currentRole === 'billing' ? 'UPI Ledger' :
                 currentRole === 'saas_admin' ? 'Platform Admin' : 'Care Dashboard'}
              </h1>
            </div>
          </div>

          {/* SRE Live Sync Status Pill & Theme Toggle */}
          <div className="flex items-center gap-1.5 shrink-0">
            <SyncStatusPill compact={true} />

          {/* Quick Mobile Theme Toggle Button */}
          <button
            type="button"
            onClick={handleToggleTheme}
            className="p-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-lg text-slate-700 dark:text-amber-400 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center shrink-0 min-h-[32px] min-w-[32px]"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle Theme Mode"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
          </button>
        </div>
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
          <aside className="relative flex flex-col w-72 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md h-full p-5 shadow-2xl animate-slide-in-left z-50 border-r border-slate-200/50 dark:border-white/5 overflow-y-auto no-scrollbar">
            <div className="flex-1 space-y-6">
              {/* Header inside drawer */}
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-9 w-9 shrink-0">
                    <BrandMark size={32} title="VitalSync logo" />
                  </div>
                  <div>
                    <h2 className="font-black text-sm tracking-tight leading-none font-sans">
                      <span className="text-[#1A7B8F]">Vital</span>
                      <span className="text-[#7AC47F]">Sync</span>
                    </h2>
                    <span className="text-[9px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleToggleTheme}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg text-slate-600 dark:text-zinc-300 transition-all cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center border-0 outline-none"
                    aria-label="Toggle Dark Mode"
                    title="Toggle Dark Mode"
                  >
                    {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
                  </button>

                  <button 
                    type="button"
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg text-slate-550 dark:text-zinc-400 transition-all cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center border-0 outline-none"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
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

              {/* Modules Switcher */}
              {visibleRoles.length > 1 && (
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
                </div>
              )}
                
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

            {/* Bottom active profile and workspace actions inside drawer */}
            <div className="space-y-3 pt-4 border-t border-slate-200/60">
              {/* Log Out Action for Mobile Drawer (Full Width) */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  onSignOut();
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-rose-50/90 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-xl transition-all duration-200 font-bold text-xs cursor-pointer shadow-xs active:scale-[0.98]"
              >
                <LogOut className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                <span>Sign Out Workspace</span>
              </button>

              {activeProfile && (
                <div className="space-y-3 animate-fade-in w-full">
                  {/* Profile Card */}
                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white/80 dark:bg-slate-900/40 border border-slate-200/50 dark:border-white/5 font-sans shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                      {activeProfile.display_name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate leading-tight">{activeProfile.display_name}</span>
                      <span className="block text-[9px] text-slate-600 dark:text-zinc-400 font-semibold uppercase tracking-wider mt-0.5">{displayRole(activeProfile.role)}</span>
                    </div>
                  </div>

                  {/* Settings Control Center (Direct Open & Quick Tiles) */}
                  <div className="border border-slate-200/60 dark:border-white/5 rounded-lg overflow-hidden bg-white/80 dark:bg-slate-900/40 shadow-[0_1px_2px_rgba(0,0,0,0.02)] w-full">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileModalInitialTab('profile');
                        setIsProfileModalOpen(true);
                        setIsMobileDrawerOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 bg-slate-50/50 dark:bg-slate-950/20 hover:bg-slate-100/50 dark:hover:bg-slate-950/40 text-[11px] font-bold text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Settings className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                        Settings & Control Center
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    </button>

                    <div className="p-2 space-y-2 border-t border-slate-200/40 dark:border-white/5 bg-transparent w-full">
                        {/* 1. Appearance / Dark Mode Tile */}
                        <button
                          type="button"
                          onClick={handleToggleTheme}
                          className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-white/5 text-[10px] font-bold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            {isDark ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-indigo-500" />}
                            Appearance & Theme
                          </span>
                          <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-mono text-[9px]">
                            {isDark ? 'Dark' : 'Light'}
                          </span>
                        </button>

                        {/* 2. Doctor Identity Profile Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setProfileModalInitialTab('profile');
                            setIsProfileModalOpen(true);
                            setIsMobileDrawerOpen(false);
                          }}
                          className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-white/5 text-[10px] font-bold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                            Doctor Profile & License
                          </span>
                          <ChevronRight className="h-3 w-3 text-slate-400" />
                        </button>

                        {/* 3. Clinic Pod Workspace Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setProfileModalInitialTab('clinic');
                            setIsProfileModalOpen(true);
                            setIsMobileDrawerOpen(false);
                          }}
                          className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-white/5 text-[10px] font-bold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                            Clinic Pod & Storefront
                          </span>
                          <ChevronRight className="h-3 w-3 text-slate-400" />
                        </button>

                        {/* 4. Display & Vernacular Preferences Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setProfileModalInitialTab('preferences');
                            setIsProfileModalOpen(true);
                            setIsMobileDrawerOpen(false);
                          }}
                          className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-white/5 text-[10px] font-bold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <Settings className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                            Vernacular & Display
                          </span>
                          <ChevronRight className="h-3 w-3 text-slate-400" />
                        </button>

                        {/* 5. Security & Password Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setProfileModalInitialTab('security');
                            setIsProfileModalOpen(true);
                            setIsMobileDrawerOpen(false);
                          }}
                          className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-white/5 text-[10px] font-bold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <ShieldCheck className="h-3.5 w-3.5 text-rose-500" />
                            Security & Password
                          </span>
                          <ChevronRight className="h-3 w-3 text-slate-400" />
                        </button>

                        {/* Dev Bypass Trigger — DEV ONLY */}
                        {import.meta.env.DEV && (
                          <button 
                            type="button"
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
                                Secure Mode [DEV]
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

      {/* Premium Floating Root-Level Mobile Bottom Navigation Dock (Outside <main>) */}
      <div 
        className="md:hidden fixed bottom-2 left-3 right-3 z-[9999] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] rounded-2xl px-2 py-1.5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 4px) + 4px)' }}
      >
        <div className="flex items-center justify-between h-12 max-w-md mx-auto gap-1">
          {(() => {
            if (currentRole === 'doctor') {
              const docTabs = [
                { id: 'pod_view', label: 'Pod', icon: LayoutDashboard },
                { id: 'consultation', label: 'Consult', icon: ClipboardList },
                { id: 'financials', label: 'Finance', icon: CreditCard },
                { id: 'patients', label: 'Patients', icon: Users },
                { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare }
              ];
              return docTabs.map(t => {
                const Icon = t.icon;
                const isActive = activeDoctorTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setActiveDoctorTab(t.id);
                      window.dispatchEvent(new CustomEvent('mediflow-doctor-tab-changed', { detail: t.id }));
                      window.dispatchEvent(new CustomEvent('mediflow-change-tab', { detail: t.id }));
                    }}
                    className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-200 cursor-pointer bg-transparent border-0 outline-none select-none relative rounded-xl ${
                      isActive ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute inset-0 bg-indigo-50/80 dark:bg-indigo-950/60 rounded-xl -z-10 border border-indigo-200/40 dark:border-indigo-800/40" />
                    )}
                    <div className={`flex items-center justify-center h-4.5 w-4.5 shrink-0 overflow-hidden transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                      <Icon className="h-4 w-4 shrink-0" />
                    </div>
                    <span className={`text-[9px] tracking-tight leading-tight whitespace-nowrap mt-0.5 ${isActive ? 'font-black text-indigo-600 dark:text-indigo-400' : 'font-semibold'}`}>
                      {t.label}
                    </span>
                  </button>
                );
              });
            }

            if (currentRole === 'compounder') {
              const compTabs = [
                { id: 'overview', label: 'Overview', icon: LayoutDashboard },
                { id: 'opd_patients', label: 'OPD Queue', icon: Users },
                { id: 'clinical_hub', label: isOphthalmology ? 'Biometry/Rx' : 'Labs & Rx', icon: FlaskConical },
                { id: 'billing_daycare', label: isOphthalmology ? 'Bill/Daycare' : 'Bill & OT', icon: Receipt }
              ];
              return compTabs.map(t => {
                const Icon = t.icon;
                const isActive = activeCompounderTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setActiveCompounderTab(t.id);
                      window.dispatchEvent(new CustomEvent('mediflow-compounder-tab-changed', { detail: t.id }));
                      window.dispatchEvent(new CustomEvent('mediflow-change-tab', { detail: t.id }));
                    }}
                    className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-200 cursor-pointer bg-transparent border-0 outline-none select-none relative rounded-xl ${
                      isActive 
                        ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute inset-0 bg-indigo-50 dark:bg-indigo-950/80 rounded-xl -z-10 border border-indigo-200/50 dark:border-indigo-800/50 shadow-sm" />
                    )}
                    <div className={`flex items-center justify-center h-4.5 w-4.5 shrink-0 overflow-hidden transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                      <Icon className="h-4 w-4 shrink-0" />
                    </div>
                    <span className={`text-[9.5px] tracking-tight leading-tight whitespace-nowrap mt-0.5 ${isActive ? 'font-black text-indigo-600 dark:text-indigo-400' : 'font-semibold'}`}>
                      {t.label}
                    </span>
                    {isActive && (
                      <span className="w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400 mt-0.5 animate-pulse" />
                    )}
                  </button>
                );
              });
            }

            if (currentRole === 'pharmacy') {
              const pharmaTabs = [
                { id: 'prescription_queue', label: 'Queue', icon: FileText },
                { id: 'inventory_catalog', label: 'Catalog', icon: ShoppingBag },
                { id: 'expiry_tracker', label: 'Expiry', icon: ShieldAlert },
                { id: 'settlements', label: 'Ledger', icon: QrCode },
                { id: 'profile_settings', label: 'Settings', icon: Settings }
              ];
              return pharmaTabs.map(t => {
                const Icon = t.icon;
                const isActive = activePharmacyTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      if (t.id === 'profile_settings') {
                        setIsProfileModalOpen(true);
                      } else {
                        setActivePharmacyTab(t.id);
                        window.dispatchEvent(new CustomEvent('mediflow-pharmacy-tab-changed', { detail: t.id }));
                      }
                    }}
                    className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-150 cursor-pointer bg-transparent border-0 outline-none select-none ${
                      isActive 
                        ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <div className={`flex items-center justify-center h-5 w-5 shrink-0 overflow-hidden transition-transform duration-150 ${isActive ? 'scale-110' : ''}`}>
                      <Icon className="h-4 w-4 shrink-0" />
                    </div>
                    <span className={`text-[9.5px] tracking-tight leading-tight whitespace-nowrap mt-1 ${isActive ? 'font-black text-emerald-600 dark:text-emerald-400' : 'font-semibold'}`}>
                      {t.label}
                    </span>
                  </button>
                );
              });
            }

            if (currentRole === 'lab') {
              const labTabs = [
                { id: 'queue', label: 'Queue', icon: FlaskConical },
                { id: 'walkin', label: 'Walk-in', icon: UserPlus },
                { id: 'upload_report', label: 'Upload', icon: UploadCloud },
                { id: 'settlements', label: 'Ledger', icon: CreditCard }
              ];
              return labTabs.map(t => {
                const Icon = t.icon;
                const isActive = activeLabTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setActiveLabTab(t.id);
                      window.dispatchEvent(new CustomEvent('mediflow-lab-tab-changed', { detail: t.id }));
                    }}
                    className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-150 cursor-pointer bg-transparent border-0 outline-none select-none ${
                      isActive 
                        ? 'text-teal-600 dark:text-teal-400 font-extrabold' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <div className={`flex items-center justify-center h-5 w-5 shrink-0 overflow-hidden transition-transform duration-150 ${isActive ? 'scale-110' : ''}`}>
                      <Icon className="h-4 w-4 shrink-0" />
                    </div>
                    <span className={`text-[9.5px] tracking-tight leading-tight whitespace-nowrap mt-1 ${isActive ? 'font-black text-teal-600 dark:text-teal-400' : 'font-semibold'}`}>
                      {t.label}
                    </span>
                  </button>
                );
              });
            }

            if (currentRole === 'saas_admin') {
              const adminTabs = [
                { id: 'saas_health', label: 'Health', icon: Activity },
                { id: 'ai_fleet', label: 'AI Fleet', icon: Bot },
                { id: 'onboarding', label: 'Pods', icon: Building },
                { id: 'revenue', label: 'Finance', icon: Coins },
                { id: 'costs', label: 'Costs', icon: Sliders },
                { id: 'firewall', label: 'Sentry', icon: ShieldAlert }
              ];
              return adminTabs.map(t => {
                const Icon = t.icon;
                const isActive = activeAdminTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setActiveAdminTab(t.id);
                      window.dispatchEvent(new CustomEvent('mediflow-admin-tab-changed', { detail: t.id }));
                    }}
                    className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-150 cursor-pointer bg-transparent border-0 outline-none select-none active:scale-95 ${
                      isActive 
                        ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <div className={`flex items-center justify-center h-5 w-5 shrink-0 overflow-hidden transition-transform duration-150 ${isActive ? 'scale-110' : ''}`}>
                      <Icon className="h-4 w-4 shrink-0" />
                    </div>
                    <span className={`text-[9px] tracking-tight leading-tight whitespace-nowrap mt-1 ${isActive ? 'font-black text-indigo-600 dark:text-indigo-400' : 'font-semibold'}`}>
                      {t.label}
                    </span>
                  </button>
                );
              });
            }

            // Default role switcher view for billing / patient / fallback
            return visibleRoles.map((r) => {
              const Icon = r.icon;
              const isActive = currentRole === r.id;
              
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
                  type="button"
                  onClick={() => onChangeRole(r.id as UserRole)}
                  className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-150 cursor-pointer bg-transparent border-0 outline-none select-none ${
                    isActive 
                      ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <div className={`flex items-center justify-center h-5 w-5 shrink-0 overflow-hidden transition-transform duration-150 ${isActive ? 'scale-110' : ''}`}>
                    <Icon className="h-4 w-4 shrink-0" />
                  </div>
                  <span className={`text-[9.5px] tracking-tight leading-tight whitespace-nowrap mt-1 ${isActive ? 'font-black text-indigo-600 dark:text-indigo-400' : 'font-semibold'}`}>
                    {label}
                  </span>
                </button>
              );
            });
          })()}
        </div>
      </div>

      <ProfileSettingsModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
        initialTab={profileModalInitialTab}
        isDarkMode={isDark}
        onToggleDarkMode={handleToggleTheme}
      />
    </>
  );
};
