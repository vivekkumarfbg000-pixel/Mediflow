import { useState, useEffect, lazy, Suspense, startTransition, useRef } from 'react';
import { Navbar } from './components/shared/Navbar';
import type { UserRole } from './components/shared/Navbar';
import { api } from './services/api';
import { StateHealingEngine, ProactiveHealthMonitor } from './services/autoHealerAgent';
import { PwaSyncManager } from './pwa';

function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      const component = await factory();
      sessionStorage.removeItem('vitalsync_chunk_refreshed');
      return component;
    } catch (error: any) {
      console.warn('[Auto-Healer] Dynamic chunk import failed. Triggering seamless page refresh...');
      const hasRefreshed = sessionStorage.getItem('vitalsync_chunk_refreshed');
      if (!hasRefreshed) {
        sessionStorage.setItem('vitalsync_chunk_refreshed', 'true');
        window.location.reload();
      }
      throw error;
    }
  });
}

const CompounderDashboard = lazyWithRetry(() => import('./components/compounder/CompounderDashboard').then(m => ({ default: m.CompounderDashboard })));
const DoctorDashboard = lazyWithRetry(() => import('./components/doctor/DoctorDashboard').then(m => ({ default: m.DoctorDashboard })));
const LabDashboard = lazyWithRetry(() => import('./components/lab/LabDashboard').then(m => ({ default: m.LabDashboard })));
const PharmacyDashboard = lazyWithRetry(() => import('./components/pharmacy/PharmacyDashboard').then(m => ({ default: m.PharmacyDashboard })));
const BillingDashboard = lazyWithRetry(() => import('./components/billing/BillingDashboard').then(m => ({ default: m.BillingDashboard })));
const SaaSAdminPanel = lazyWithRetry(() => import('./components/admin/SaaSAdminPanel').then(m => ({ default: m.SaaSAdminPanel })));
const RefractionDashboard = lazyWithRetry(() => import('./components/doctor/RefractionDashboard').then(m => ({ default: m.RefractionDashboard })));

import { LandingPage } from './components/shared/LandingPage';
import { AuthGateway } from './components/shared/AuthGateway';
import { BrandMark } from './components/shared/BrandMark';
import { supabase } from './lib/supabaseClient';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X, Loader2, Shield, Lock, Eye, EyeOff, ArrowRight, Sun, Moon } from 'lucide-react';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { RequireRole } from './components/ui/RequireRole';
import { PendingApprovalScreen } from './components/shared/PendingApprovalScreen';
import { ClinicProvider, useClinic } from './context/ClinicContext';
import { SpecializationProvider } from './context/SpecializationContext';
import { PatientWhatsAppSimulator } from './components/shared/PatientWhatsAppSimulator';
import { PatientMobileDashboard } from './components/shared/PatientMobileDashboard';
import { CommandBar } from './components/shared/CommandBar';
import { ToastProvider } from './components/shared/ToastProvider';
import { resolvePodContext, clearPodContext } from './services/podContext';
import {
  DashboardSkeleton,
  DoctorDashboardSkeleton,
  LabDashboardSkeleton,
  PharmacyDashboardSkeleton,
  FullPageLoader
} from './components/shared/LoadingSkeleton';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
}

interface AppContentProps {
  session: any;
  activeProfile: any;
  currentRole: UserRole;
  toasts: Toast[];
  isBypassMode: boolean;
  handleSignOut: () => void;
  handleToggleBypass: (bypass: boolean) => void;
  handleRoleChange: (role: UserRole) => void;
  removeToast: (id: string) => void;
}

function AppContent({
  session,
  activeProfile,
  currentRole,
  toasts,
  isBypassMode,
  handleSignOut,
  handleToggleBypass,
  handleRoleChange,
  removeToast
}: AppContentProps) {
  const { partnerStatus } = useClinic();
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);
  const [activeDoctorTab, setActiveDoctorTab] = useState('pod_view');
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ isDark: boolean }>;
      if (customEvent.detail) {
        setIsDark(customEvent.detail.isDark);
      }
    };
    window.addEventListener('mediflow-theme-change', handleThemeChange as any);
    return () => window.removeEventListener('mediflow-theme-change', handleThemeChange as any);
  }, []);

  useEffect(() => {
    const handleDoctorTabChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setActiveDoctorTab(customEvent.detail);
      }
    };
    window.addEventListener('mediflow-doctor-tab-changed', handleDoctorTabChange);
    return () => window.removeEventListener('mediflow-doctor-tab-changed', handleDoctorTabChange);
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandBarOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Role-aware skeleton for contextual loading states
  const getSkeleton = () => {
    switch (currentRole) {
      case 'doctor': return <DoctorDashboardSkeleton />;
      case 'lab': return <LabDashboardSkeleton />;
      case 'pharmacy': return <PharmacyDashboardSkeleton />;
      case 'refraction': return <DoctorDashboardSkeleton />;
      default: return <DashboardSkeleton />;
    }
  };

  const getBreadcrumbs = () => {
    const items = [{ label: 'Ecosystem' }];
    
    const roleNames: Record<UserRole, string> = {
      doctor: 'Doctor Console',
      compounder: 'Compounder Operations',
      lab: 'Pathology Lab',
      pharmacy: 'Pharmacy POS',
      billing: 'UPI Ledger',
      saas_admin: 'Platform Admin',
      patient: 'Patient Portal',
      refraction: 'Refraction Desk'
    };

    items.push({ label: roleNames[currentRole] || currentRole });

    if (currentRole === 'doctor') {
      const tabNames: Record<string, string> = {
        pod_view: 'Pod Workspace',
        consultation: 'Patient Consultation',
        patients: 'Directory',
        financials: 'Financial Reports',
        whatsapp: 'WhatsApp Integration',
        sop: 'Clinic SOP'
      };
      items.push({ label: tabNames[activeDoctorTab] || 'Workspace' });
    }

    return items;
  };

  const renderDashboard = () => {
    switch (currentRole) {
      case 'compounder':
        return (
          <ErrorBoundary fallbackTitle="Compounder Dashboard">
            <RequireRole allowedRoles={['compounder']} role={currentRole} bypass={isBypassMode}>
              <CompounderDashboard />
            </RequireRole>
          </ErrorBoundary>
        );
      case 'doctor':
        return (
          <ErrorBoundary fallbackTitle="Doctor Consultation Dashboard">
            <RequireRole allowedRoles={['doctor']} role={currentRole} bypass={isBypassMode}>
              <DoctorDashboard />
            </RequireRole>
          </ErrorBoundary>
        );
      case 'refraction':
        return (
          <ErrorBoundary fallbackTitle="Refraction Operations Desk">
            <RequireRole allowedRoles={['refraction', 'doctor']} role={currentRole} bypass={isBypassMode}>
              <RefractionDashboard />
            </RequireRole>
          </ErrorBoundary>
        );
      case 'lab':
        return (
          <ErrorBoundary fallbackTitle="Laboratory Diagnostic Console">
            <RequireRole allowedRoles={['lab']} role={currentRole} bypass={isBypassMode}>
              <LabDashboard />
            </RequireRole>
          </ErrorBoundary>
        );
      case 'pharmacy':
        return (
          <ErrorBoundary fallbackTitle="Pharmacy Inventory & POS Dashboard">
            <RequireRole allowedRoles={['pharmacy']} role={currentRole} bypass={isBypassMode}>
              <PharmacyDashboard />
            </RequireRole>
          </ErrorBoundary>
        );
      case 'billing':
        return (
          <ErrorBoundary fallbackTitle="Billing & Ledgers Module">
            <BillingDashboard />
          </ErrorBoundary>
        );
      case 'saas_admin':
        return (
          <ErrorBoundary fallbackTitle="SaaS Platform Operations Panel">
            <SaaSAdminPanel />
          </ErrorBoundary>
        );
      case 'patient':
        return (
          <ErrorBoundary fallbackTitle="Patient Companion Viewport">
            <PatientMobileDashboard />
          </ErrorBoundary>
        );
      default:
        return (
          <ErrorBoundary fallbackTitle="Compounder Dashboard">
            <CompounderDashboard />
          </ErrorBoundary>
        );
    }
  };

  // Block viewport rendering if not securely authenticated (fallback)
  if (!session || !activeProfile) {
    return null;
  }

  // Intercept and show pending approval screen if partner registration is pending
  if (partnerStatus === 'pending' && !isBypassMode) {
    return (
      <>
        <PendingApprovalScreen onSignOut={handleSignOut} />
        {/* Toast notifications for real-time status updates */}
        <div className="fixed top-24 right-4 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
          {toasts.map(toast => (
            <div key={toast.id} className="pointer-events-auto flex items-start gap-3 p-4 rounded-2xl bg-clinical-950/80 backdrop-blur-xl border border-amber-500/20 shadow-lg shadow-amber-500/10 transition-all duration-300 animate-slide-in w-full">
              <ClockIcon className="h-5 w-5 text-amber-400 mt-0.5 animate-pulse" />
              <div className="flex-1">
                <h4 className="text-sm font-bold text-white tracking-wide">{toast.title || 'Status'}</h4>
                <p className="text-xs text-clinical-300 mt-1 leading-relaxed font-medium">{toast.message}</p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 text-clinical-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </>
    );
  }

  // Helper inside PendingApprovalScreen for toast icon rendering
  function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f1a] text-slate-800 dark:text-zinc-100 flex flex-col font-sans select-none relative overflow-hidden">
      {/* Ambient Glowing Blobs for Premium SaaS Aesthetic */}
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/15 dark:bg-indigo-500/10 blur-[120px] pointer-events-none z-0 animate-ambient-float-1" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-teal-500/15 dark:bg-teal-500/10 blur-[130px] pointer-events-none z-0 animate-ambient-float-2" />
      
      {/* Shared Ecosystem Navigation Header */}
      <Navbar 
        currentRole={currentRole} 
        onChangeRole={handleRoleChange}
        activeProfile={activeProfile}
        onSignOut={handleSignOut}
        isBypassMode={isBypassMode}
        onToggleBypass={handleToggleBypass}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebarCollapse={setIsSidebarCollapsed}
      />

      {/* Primary Dashboard viewport wrapper wrapped in secure telemetry isolated ErrorBoundary */}
      <main className={`flex-1 pb-32 md:pb-16 ${isSidebarCollapsed ? 'md:pl-20' : 'md:pl-64'} transition-all duration-300 dense-theme flex flex-col`}>
        {/* Premium Breadcrumb Navigator Bar */}
        {currentRole !== 'doctor' && (
          <div className="hidden md:flex bg-slate-50/80 backdrop-blur-md border-b border-slate-200/40 px-6 py-3 items-center justify-between shrink-0 select-none">
            <nav className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
              {getBreadcrumbs().map((item, idx, arr) => (
                <span key={idx} className="flex items-center gap-1.5">
                  {idx > 0 && <span className="text-slate-300">/</span>}
                  <span className={idx === arr.length - 1 ? 'text-indigo-600 font-extrabold' : 'text-slate-650 hover:text-slate-900 transition-colors'}>
                    {item.label}
                  </span>
                </span>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-bold text-emerald-600 font-mono uppercase tracking-wider">Sync Active</span>
            </div>
          </div>
        )}

        <div className="animate-fade-in flex-1">
          <ErrorBoundary>
            <Suspense fallback={getSkeleton()}>
              {renderDashboard()}
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      {/* Premium Glassmorphic Toast Notifications Overlay */}
      <div className="fixed top-24 right-4 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none dense-theme">
        {toasts.map(toast => {
          let icon = <Info className="h-5 w-5 text-blue-400" />;
          let borderClass = 'border-blue-500/30';
          let glowClass = 'shadow-blue-500/10';
          let title = toast.title || 'Notification';
          
          if (toast.type === 'success') {
            icon = <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
            borderClass = 'border-emerald-500/30';
            glowClass = 'shadow-emerald-500/10';
            title = toast.title || 'Success';
          } else if (toast.type === 'error') {
            icon = <AlertCircle className="h-5 w-5 text-rose-400" />;
            borderClass = 'border-rose-500/30';
            glowClass = 'shadow-rose-500/10';
            title = toast.title || 'Error';
          } else if (toast.type === 'warning') {
            icon = <AlertTriangle className="h-5 w-5 text-amber-400" />;
            borderClass = 'border-amber-500/30';
            glowClass = 'shadow-amber-500/10';
            title = toast.title || 'Warning';
          }
          
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl bg-clinical-950/80 backdrop-blur-xl border ${borderClass} shadow-lg ${glowClass} transition-all duration-300 animate-slide-in w-full`}
            >
              <div className="flex-shrink-0 mt-0.5">{icon}</div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-white tracking-wide">{title}</h4>
                <p className="text-xs text-clinical-300 mt-1 leading-relaxed font-medium">{toast.message}</p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 text-clinical-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>



      {/* Floating WhatsApp Sandbox Trigger Button (Dev-Only) */}
      {typeof window !== 'undefined' && getIsLocal(window.location.hostname) && (
        <button
          onClick={() => setIsSimulatorOpen(true)}
          className="fixed bottom-14 right-6 z-[80] bg-emerald-500 hover:bg-emerald-600 text-white p-3.5 rounded-full shadow-2xl flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all group duration-300 border border-emerald-400/25 cursor-pointer text-white-force"
          title="Open Patient WhatsApp Simulator"
        >
          <span className="material-symbols-outlined text-2xl font-bold animate-pulse text-white-force">chat</span>
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 ease-out whitespace-nowrap text-xs font-bold uppercase tracking-wider text-white-force">
            Simulate WhatsApp Sandbox
          </span>
        </button>
      )}

      <PatientWhatsAppSimulator isOpen={isSimulatorOpen} onClose={() => setIsSimulatorOpen(false)} />
      <CommandBar 
        isOpen={isCommandBarOpen}
        onClose={() => setIsCommandBarOpen(false)}
        currentRole={currentRole}
        onChangeRole={handleRoleChange}
        isBypassMode={isBypassMode}
        onToggleBypass={handleToggleBypass}
      />
    </div>
  );
}

function getIsLocal(hostname: string): boolean {
  return (
    hostname === 'localhost' || 
    hostname === '127.0.0.1' || 
    hostname.endsWith('.localhost') || 
    hostname.includes('192.168.') || 
    hostname.includes('10.') || 
    hostname.includes('172.') || 
    hostname.endsWith('.local') || 
    !hostname.includes('.')
  );
}

const setCrossDomainCookie = (active: boolean) => {
  if (typeof window === 'undefined') return;
  const hostname = window.location.hostname;
  const isLocal = getIsLocal(hostname);
  let cookieDomain = '';
  
  if (hostname.endsWith('.vitalsync.in')) {
    cookieDomain = '; domain=.vitalsync.in';
  } else if (hostname.includes('localhost')) {
    cookieDomain = '; domain=localhost';
  }
  
  const secureFlag = isLocal ? '' : '; Secure';
  if (active) {
    document.cookie = `vitalsync_session_active=true; path=/${cookieDomain}; max-age=31536000; SameSite=Lax${secureFlag}`;
  } else {
    document.cookie = `vitalsync_session_active=; path=/${cookieDomain}; max-age=0; SameSite=Lax${secureFlag}`;
    // Self-healing cleanup for legacy/orphaned subdomain cookies
    document.cookie = `vitalsync_session_active=; path=/; domain=.localhost; max-age=0; SameSite=Lax${secureFlag}`;
    document.cookie = `vitalsync_session_active=; path=/; domain=.vitalsync.in; max-age=0; SameSite=Lax${secureFlag}`;
  }
};

export default function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>('doctor');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [session, setSession] = useState<any>(null);
  const [activeProfile, setActiveProfile] = useState<any>(null);
  const [isBypassMode, setIsBypassMode] = useState<boolean>(false); // Production default (bypass mode disabled)
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);
  const [initialSignupTab, setInitialSignupTab] = useState<'signin' | 'register' | 'join'>('signin');
  const watchdogTriggered = useRef(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('recovery') === 'true';
    }
    return false;
  });

  useEffect(() => {
    // Eagerly redirect to app subdomain if cross-subdomain session cookie is active
    // Disabled to prevent stale cookie redirection traps (e.g. redirecting to login page when session expires)
    // const curHostname = typeof window !== 'undefined' ? window.location.hostname : '';
    // const isLandingPage = curHostname === 'vitalsync.in' || curHostname === 'www.vitalsync.in' || curHostname === 'localhost' || curHostname === '127.0.0.1';
    
    // if (isLandingPage && typeof window !== 'undefined') {
    //   const isSessionActive = document.cookie.includes('vitalsync_session_active=true');
    //   if (isSessionActive) {
    //     console.log('[VitalSync Auth] Active cookie session detected on landing page. Eagerly redirecting to app subdomain...');
    //     const isLocal = getIsLocal(curHostname);
    //     const redirectUrl = isLocal
    //       ? `http://app.localhost:${window.location.port || '5173'}`
    //       : 'https://app.vitalsync.in';
    //     window.location.replace(redirectUrl);
    //     return;
    //   }
    // }

    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'register' || tabParam === 'join') {
      setInitialSignupTab(tabParam);
    }

  }, []);

  useEffect(() => {
    PwaSyncManager.registerServiceWorker();
    StateHealingEngine.initGlobalListener();
    // Delay health monitor startup by 10 seconds so it doesn't compete with auth
    // session initialization and the first critical render on page load.
    setTimeout(() => ProactiveHealthMonitor.start(), 10_000);
    // Signal to Emergency Startup Shield that the React app successfully loaded and initialized
    if (typeof window !== 'undefined') {
      (window as any).__mediflow_startup_healthy = true;
      console.log('[Mediflow App] Startup shield disarmed: application successfully initialized.');
    }
  }, []);

  useEffect(() => {
    // Sync the active role with MediflowApiService simulated checks
    let apiRole: string = currentRole;
    if (currentRole === 'lab') apiRole = 'lab_technician';
    else if (currentRole === 'pharmacy') apiRole = 'pharmacy';
    else if (currentRole === 'billing') apiRole = 'admin';
    else if (currentRole === 'patient') apiRole = 'patient';
    api.setSimulatedRole(apiRole);
  }, [currentRole]);

  // Specialization Switch Handler for demonstration and dev bypass
  useEffect(() => {
    const handleSwitchSpecialization = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const newSpec = customEvent.detail;
      if (activeProfile) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('mediflow_demo_specialization', newSpec);
        }
        const updatedProfile = {
          ...activeProfile,
          user_metadata: {
            ...activeProfile.user_metadata,
            specialization: newSpec
          },
          raw_user_meta_data: {
            ...activeProfile.raw_user_meta_data,
            specialization: newSpec
          }
        };
        setActiveProfile(updatedProfile);

        // Dispatches global toast
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            title: 'Specialization Switch Activated',
            message: `Switched clinical module context to ${newSpec}.`,
            type: 'info'
          }
        }));

        // Persist update in DB if logged in
        if (activeProfile.id) {
          supabase
            .from('profiles')
            .update({
              user_metadata: updatedProfile.user_metadata,
              raw_user_meta_data: updatedProfile.raw_user_meta_data
            })
            .eq('id', activeProfile.id)
            .then(({ error }) => {
              if (error) {
                console.warn('[Specialization Switch] Failed to persist in DB:', error);
              }
            });
        }
      }
    };
    window.addEventListener('mediflow-switch-specialization', handleSwitchSpecialization);
    return () => {
      window.removeEventListener('mediflow-switch-specialization', handleSwitchSpecialization);
    };
  }, [activeProfile]);

  // Loading watchdog: If session exists but we are stuck loading for more than 12 seconds, trigger self-healing
  useEffect(() => {
    if (!session) {
      watchdogTriggered.current = false;
      return;
    }
    if (typeof window !== 'undefined' && (window as any).__mediflow_registering) return;
    if (watchdogTriggered.current) return;
    
    const timer = setTimeout(() => {
      const isStillLoading = isLoadingSession || isOnboarding;
      if (isStillLoading && !watchdogTriggered.current) {
        watchdogTriggered.current = true;
        console.warn('[Loading Watchdog] Stuck loading state detected for >12 seconds. Triggering State Healing Engine...');
        StateHealingEngine.handleException(new Error('LoadingWatchdogException: Dashboard loading state hung or profiles query blocked'))
          .then(healed => {
            if (healed) {
              console.log('[Loading Watchdog] State healed. Refreshing session...');
              supabase.auth.getSession().then(({ data: { session: newSession } }) => {
                if (newSession) {
                  window.dispatchEvent(new CustomEvent('mediflow-profile-updated'));
                }
              });
            }
          });
      }
    }, 12000);

    return () => clearTimeout(timer);
  }, [session, isLoadingSession, isOnboarding]);

  // Role Watchdog: Detect profile role discrepancies against auth metadata role and align them
  useEffect(() => {
    if (!session || !activeProfile) return;

    const authEmail = session.user?.email;
    const metadataRole = session.user?.user_metadata?.role;
    const profileRole = activeProfile.role;

    const isOwner = authEmail === 'owner@mediflow.com';
    const isOwnerRoleDiscrepancy = isOwner && profileRole !== 'platform_admin';
    const isGeneralRoleDiscrepancy = !isOwner && metadataRole && profileRole !== metadataRole && !(metadataRole === 'admin' && profileRole === 'platform_admin') && !(metadataRole === 'platform_admin' && profileRole === 'platform_admin');

    if (isOwnerRoleDiscrepancy || isGeneralRoleDiscrepancy) {
      console.warn('[Loading Watchdog] Profile role discrepancy detected:', { authEmail, metadataRole, profileRole });
      StateHealingEngine.handleException(new Error(`RoleMismatchException: Auth metadata role is ${metadataRole || 'unknown'} but DB profile role is ${profileRole}`));
    }
  }, [session, activeProfile]);

  // Deferred, self-healing onboarding router for email confirmation flows
  const checkAndCompleteOnboarding = async (currentSession: any, currentProfile: any): Promise<any> => {
    if (!currentSession?.user || !currentProfile) return currentProfile;
    
    if (typeof window !== 'undefined' && (window as any).__mediflow_registering) {
      console.log('[Mediflow Onboarding] Registration in progress inside AuthGateway. Deferring automatic onboarding.');
      return currentProfile;
    }
    
    const metadata = currentSession.user.user_metadata;
    if (!currentProfile.entity_id && metadata?.pending_registration) {
      setIsOnboarding(true);
      
      try {
        console.log('[Mediflow Onboarding] Detected pending registration in session metadata. Running RPC onboarding...');
        
        if (currentProfile.role === 'doctor') {
          // Call register_clinic_network
          const { data: rpcData, error: rpcError } = await supabase.rpc('register_clinic_network', {
            p_clinic_name: metadata.clinic_name || 'My Clinic',
            p_clinic_phone: metadata.clinic_phone || '',
            p_clinic_address: metadata.clinic_address || '',
            p_specialization: metadata.specialization || 'General Medicine'
          });
          
          if (rpcError) throw rpcError;
          const generatedCode = Array.isArray(rpcData) ? rpcData[0]?.clinic_code : rpcData?.clinic_code;
          console.log('[Mediflow Onboarding] Clinic registered successfully. Code:', generatedCode);
        } else {
          // Partner (pharmacist, lab_technician, compounder)
          const { error: rpcError } = await supabase.rpc('join_clinic_network', {
            p_clinic_code: metadata.clinic_code || '',
            p_partner_type: metadata.partner_type || (currentProfile.role === 'pharmacist' ? 'pharmacy' : currentProfile.role === 'lab_technician' ? 'lab' : 'compounder'),
            p_partner_name: metadata.display_name || currentProfile.display_name || '',
            p_partner_phone: metadata.partner_phone || '',
            p_partner_address: metadata.partner_address || ''
          });
          
          if (rpcError) throw rpcError;
          console.log('[Mediflow Onboarding] Partner join request submitted successfully.');
        }
        
        // Clear pending registration metadata
        await supabase.auth.updateUser({
          data: { pending_registration: false }
        });
        
        // Fetch updated profile
        const { data: updatedProfile, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentSession.user.id)
          .single();
          
        if (profileErr) throw profileErr;
        
        console.log('[Mediflow Onboarding] Onboarding complete. Profile updated.');
        
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            title: 'Onboarding Completed! 🎉',
            message: 'Your account has been successfully configured.',
            type: 'success'
          }
        }));
        
        return updatedProfile;
      } catch (_err) {
        const err = _err as any;
        console.error('[Mediflow Onboarding] Onboarding process failed:', err);
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            title: 'Onboarding Failed ⚠️',
            message: err.message || 'Onboarding process failed.',
            type: 'error'
          }
        }));
      } finally {
        setIsOnboarding(false);
      }
    }
    
    return currentProfile;
  };

  const loadOrHealProfile = async (session: any): Promise<any> => {
    if (!session?.user) return null;
    
    // Developer bypass for offline testing on localhost
    if (typeof window !== 'undefined' && localStorage.getItem('mediflow_dev_bypass') === 'true') {
      console.log('[Dev Bypass] Bypassing profile fetch. Loading mock doctor profile.');
      return {
        id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101',
        entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
        role: 'doctor',
        display_name: 'Dr. Vivek Kumar (Mock)',
        email: 'doctor@mediflow.com'
      };
    }
    
    // 1. Try to fetch profile
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id);
      
    let activeProfile = profiles && profiles.length > 0 ? profiles[0] : null;
    
    // Check if it's an admin email but has non-admin role, or is missing
    const isPlatformAdminEmail = session.user?.email === 'owner@mediflow.com' || session.user?.email === 'vivekkumarfbg000@gmail.com';
    const isStaleAdminRole = activeProfile && isPlatformAdminEmail && activeProfile.role !== 'platform_admin';

    // 2. If profile is missing or has stale admin role, trigger auto-healing RPC
    if (!activeProfile || isStaleAdminRole) {
      console.log('[Profile Loader] Profile missing or stale admin role. Triggering reconcile_profile_role...');
      try {
        await supabase.rpc('reconcile_profile_role');
        // Re-query
        const { data: healedProfiles } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id);
        activeProfile = healedProfiles && healedProfiles.length > 0 ? healedProfiles[0] : null;
      } catch (err) {
        console.error('[Profile Loader] Profile reconciliation failed:', err);
      }
    }

    // 3. JWT Metadata fallback for admin/ops accounts.
    //    Admin users created directly in the Supabase Dashboard may not have a
    //    row in the profiles table. Read role from JWT claims so they can still
    //    reach admin.vitalsync.in without being bounced to the login form.
    if (!activeProfile) {
      const jwtRole: string | undefined =
        session.user?.user_metadata?.role ||
        session.user?.app_metadata?.role;
      if (jwtRole === 'admin' || jwtRole === 'platform_admin') {
        console.log('[Profile Loader] No DB profile found but JWT role is admin. Synthesizing minimal ops profile.');
        activeProfile = {
          id: session.user.id,
          role: jwtRole,
          display_name: session.user?.user_metadata?.display_name || session.user?.email?.split('@')[0] || 'Admin',
          email: session.user.email,
        };
      }
    }

    if (activeProfile) {
      activeProfile = {
        ...activeProfile,
        user_metadata: {
          ...session.user?.user_metadata,
          ...activeProfile.user_metadata
        }
      };
    }

    // 3a. Demo Doctor Profile Overrides for sandbox consistency
    // Reads localStorage demo specialization to apply the correct clinic identity
    if (activeProfile) {
      // 4. Complete onboarding if needed
      return await checkAndCompleteOnboarding(session, activeProfile);
    }
    
    return null;
  };


  useEffect(() => {
    let active = true;

    // Deferred initialization of API Service to prevent deadlocks during module evaluation
    api.initialize();

    // Safety timeout: If session loading takes more than 25 seconds (e.g. invalid refresh token fetch hangs), force loader removal
    const safetyTimeout = setTimeout(() => {
      if (active) {
        console.warn('[Mediflow Auth] Session initialization timed out. Forcing loader removal.');
        setIsLoadingSession(false);
      }
    }, 25000);

    // 1. Check existing Supabase session and load active profile
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      
      let currentSession = session;
      if (!currentSession && typeof window !== 'undefined' && localStorage.getItem('mediflow_dev_bypass') === 'true') {
        console.log('[Dev Bypass] Bypassing session check. Creating mock session.');
        currentSession = {
          user: {
            id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101',
            email: 'doctor@mediflow.com',
            user_metadata: {
              display_name: 'Dr. Vivek Kumar (Mock)',
              role: 'doctor',
              specialization: 'General Medicine'
            }
          }
        } as any;
      }

      setSession(currentSession);
      if (currentSession?.user) {
        setCrossDomainCookie(true);
        const finalProfile = await loadOrHealProfile(currentSession);
        if (active) {
          clearTimeout(safetyTimeout);
          if (finalProfile) {
            setActiveProfile(finalProfile);
            let defaultRole: UserRole = 'doctor';
            if (finalProfile.role === 'doctor') defaultRole = 'doctor';
            else if (finalProfile.role === 'compounder') defaultRole = 'compounder';
            else if (finalProfile.role === 'lab_technician') defaultRole = 'lab';
            else if (finalProfile.role === 'pharmacist') defaultRole = 'pharmacy';
            else if (finalProfile.role === 'patient') defaultRole = 'patient';
            else if (finalProfile.role === 'admin' || finalProfile.role === 'platform_admin') defaultRole = 'saas_admin';
            setCurrentRole(defaultRole);
          }
          setIsLoadingSession(false);
        }
      } else {
        setCrossDomainCookie(false);
        clearTimeout(safetyTimeout);
        setIsLoadingSession(false);
      }
    }).catch(() => {
      if (active) {
        clearTimeout(safetyTimeout);
        setIsLoadingSession(false);
      }
    });

    // 2. Setup auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') {
        console.log('[Mediflow Auth] PASSWORD_RECOVERY event triggered. Entering recovery mode.');
        setIsRecoveryMode(true);
      }
      setSession(session);
      if (!session) {
        setCrossDomainCookie(false);
        setActiveProfile(null);
        setIsLoadingSession(false);
        // Clear pod context so next user gets fresh real IDs
        clearPodContext();
      } else {
        setCrossDomainCookie(true);
        if (event === 'SIGNED_IN' && activeProfile) {
          console.log('[Mediflow Auth] SIGNED_IN event detected with active profile. Deferring profile load to form handler.');
          // Eagerly resolve pod context in background on sign-in
          resolvePodContext().catch(() => {});
          return;
        }
        if (typeof window !== 'undefined' && (window as any).__mediflow_registering) {
          console.log('[Mediflow Auth] Registration in progress. Deferring profile loading in onAuthStateChange.');
          return;
        }
        if (typeof window !== 'undefined' && (window as any).__vitalsync_ops_redirect) {
          console.log('[VitalSync Auth] Ops redirect in progress. Standing down — LandingPage will handle navigation.');
          return;
        }
        // For TOKEN_REFRESHED, USER_UPDATED, etc., load profile and refresh pod context
        resolvePodContext().catch(() => {});
        const finalProfile = await loadOrHealProfile(session);
        if (active) {
          if (finalProfile) {
            setActiveProfile(finalProfile);
            let defaultRole: UserRole = 'doctor';
            if (finalProfile.role === 'doctor') defaultRole = 'doctor';
            else if (finalProfile.role === 'compounder') defaultRole = 'compounder';
            else if (finalProfile.role === 'lab_technician') defaultRole = 'lab';
            else if (finalProfile.role === 'pharmacist') defaultRole = 'pharmacy';
            else if (finalProfile.role === 'patient') defaultRole = 'patient';
            else if (finalProfile.role === 'admin' || finalProfile.role === 'platform_admin') defaultRole = 'saas_admin';
            setCurrentRole(defaultRole);
          }
          setIsLoadingSession(false);
        }
      }
    });

    // 3. Listen to incoming application toast triggers
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent<Omit<Toast, 'id'>>;
      if (!customEvent.detail) return;
      const { message, type, title } = customEvent.detail;
      const id = crypto.randomUUID();
      const newToast: Toast = { id, message, type, title };
      
      setToasts(prev => [...prev, newToast]);
      
      // Auto dismiss after 1 second
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 1000);
    };

    window.addEventListener('mediflow-toast', handleToast);

    const handleProfileUpdate = () => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
            .then(({ data: profile }) => {
              if (profile) setActiveProfile(profile);
            });
        }
      });
    };
    window.addEventListener('mediflow-profile-updated', handleProfileUpdate);
    
    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener('mediflow-toast', handleToast);
      window.removeEventListener('mediflow-profile-updated', handleProfileUpdate);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleAuthSuccess = async (session: any, profile: any) => {
    const finalProfile = await checkAndCompleteOnboarding(session, profile);
    if (!finalProfile) {
      console.error('[Mediflow Auth] handleAuthSuccess: profile is null after onboarding check. Skipping state update.');
      return;
    }
    setCrossDomainCookie(true);
    setSession(session);
    setActiveProfile(finalProfile);
    
    let defaultRole: UserRole = 'doctor';
    if (finalProfile.role === 'doctor') defaultRole = 'doctor';
    else if (finalProfile.role === 'compounder') defaultRole = 'compounder';
    else if (finalProfile.role === 'lab_technician') defaultRole = 'lab';
    else if (finalProfile.role === 'pharmacist') defaultRole = 'pharmacy';
    else if (finalProfile.role === 'patient') defaultRole = 'patient';
    else if (finalProfile.role === 'admin' || finalProfile.role === 'platform_admin') defaultRole = 'saas_admin';
    
    setCurrentRole(defaultRole);

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: 'Professional Portal Initialized',
        message: `Successfully authenticated as ${finalProfile.display_name}. Role: ${finalProfile.role.toUpperCase()}`,
        type: 'success'
      }
    }));
  };


  const handleSignOut = async () => {
    setCrossDomainCookie(false);
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.error('Error during Supabase signout:', err);
    }
    setSession(null);
    setActiveProfile(null);
    setCurrentRole('doctor');
    
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: 'Workspace De-authenticated',
        message: 'Logged out of Mediflow Clinical Connected Care.',
        type: 'info'
      }
    }));
  };

  const handleToggleBypass = (bypass: boolean) => {
    setIsBypassMode(bypass);
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: bypass ? 'Bypass Mode Enabled' : 'Strict Mode Enforced',
        message: bypass
          ? 'Authorization checks bypassed. Dynamic switcher active for E2E testing.'
          : 'Enterprise security constraints active. Dashboards locked to professional profile role.',
        type: bypass ? 'warning' : 'success'
      }
    }));
  };

  const handleRoleChange = (role: UserRole) => {
    if (!isBypassMode && activeProfile) {
      const allowedRoles: Record<string, UserRole[]> = {
        'doctor': ['doctor', 'compounder', 'lab', 'pharmacy', 'billing', 'patient', 'refraction'],
        'compounder': ['compounder'],
        'lab_technician': ['lab'],
        'pharmacist': ['pharmacy'],
        'patient': ['patient'],
        'admin': ['saas_admin'],
        'platform_admin': ['saas_admin']
      };

      const userRole = activeProfile.role;
      const allowed = allowedRoles[userRole] || [];

      if (!allowed.includes(role)) {
        const errorMsg = `De-authorization: Account role (${userRole.replace('_', ' ')}) is not permitted to view the ${role.toUpperCase()} module under active compliance policy.`;
        
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            title: 'Access Restricted',
            message: errorMsg,
            type: 'error'
          }
        }));

        api.writeAuditLog('SECURITY_VIOLATION_ROUTING_ATTEMPT', {
          failedRoleSwitch: role,
          activeRole: userRole,
          displayName: activeProfile.display_name
        });
        return;
      }
    }
    startTransition(() => {
      setCurrentRole(role);
    });
  };

  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isAdminSubdomain = hostname === 'admin.vitalsync.in' || hostname.startsWith('admin.');
  const isDashboardSubdomain = hostname === 'app.vitalsync.in' || hostname.startsWith('app.');
  const isLandingPageDomain = hostname === 'vitalsync.in' || hostname === 'www.vitalsync.in' || hostname === 'localhost' || hostname === '127.0.0.1';

  // 1a. Password Recovery/Reset Mode Gate
  if (isRecoveryMode) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden text-slate-800 font-sans">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-teal-500/10 blur-[120px] pointer-events-none" />
        
        <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-6 z-10 animate-fade-in">
          <div className="flex flex-col items-center space-y-2 text-center">
            <BrandMark size={52} title="VitalSync" />
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Create New Password</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">Set a secure password for your clinical portal</p>
            </div>
          </div>
          
          <ResetPasswordForm 
            onSuccess={() => {
              setIsRecoveryMode(false);
              // Clean URL query params
              const newUrl = window.location.pathname;
              window.history.replaceState({}, document.title, newUrl);
            }} 
          />
        </div>
      </div>
    );
  }

  // 1. Session Loading Gate
  if (isLoadingSession) {
    return <FullPageLoader message="Initializing clinical session..." />;
  }

  // 2. Landing Page Domain Routing
  // vitalsync.in always shows the landing page — on ALL devices (desktop and mobile).
  // Users reach app.vitalsync.in via the "Console Login" or "Get Started" buttons.
  if (isLandingPageDomain) {
    // Disabled to prevent cross-origin redirect traps (e.g. redirecting to login page when session is expired on app subdomain)
    // if (session && activeProfile) {
    //   const userRole = activeProfile.role;
    //   const isAdmin = userRole === 'admin' || userRole === 'platform_admin';
    //   const redirectUrl = hostname === 'localhost' || hostname === '127.0.0.1'
    //     ? (isAdmin 
    //         ? `http://admin.localhost:${window.location.port || '5173'}` 
    //         : `http://app.localhost:${window.location.port || '5173'}`)
    //     : (isAdmin 
    //         ? 'https://admin.vitalsync.in' 
    //         : 'https://app.vitalsync.in');
    //   
    //   console.log(`[Mediflow Auth] Active session found on landing page. Redirecting to: ${redirectUrl}`);
    //   window.location.replace(redirectUrl);
    //   return <FullPageLoader message="Redirecting to dashboard..." />;
    // }
    return <LandingPage onAuthSuccess={handleAuthSuccess} />;
  }

  // 2a. Fallback Routing for single-domain environments (Vercel previews, custom domains, direct IPs)
  // If the host is not one of the pre-configured subdomains, we check query params:
  // - ?console=true or ?tab=register/join: Render the dashboard login page / signup flow.
  // - If session exists: Fall through and render the dashboard workspace.
  // - Otherwise: Render the Landing Page.
  const isSingleDomain = !isLandingPageDomain && !isDashboardSubdomain && !isAdminSubdomain;
  const isConsoleRequested = new URLSearchParams(window.location.search).get('console') === 'true' || new URLSearchParams(window.location.search).get('tab') !== null;

  if (isSingleDomain) {
    if (!session || !activeProfile) {
      if (isConsoleRequested) {
        return (
          <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden text-slate-800 font-sans">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-teal-500/10 blur-[120px] pointer-events-none" />
            
            <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-6 z-10 animate-fade-in">
              <div className="flex flex-col items-center space-y-2 text-center">
                <BrandMark size={52} title="VitalSync" />
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">VitalSync Dashboard</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">Enterprise Care Connected Console</p>
                </div>
              </div>
              
              <AuthGateway 
                onAuthSuccess={handleAuthSuccess} 
                allowSignup={true} 
                initialSignupTab={initialSignupTab}
              />
            </div>
          </div>
        );
      }
      return <LandingPage onAuthSuccess={handleAuthSuccess} />;
    }
  }


  // 3. Super Admin Dashboard Subdomain Routing
  if (isAdminSubdomain) {
    // Session exists but profile hasn't loaded yet (e.g. arriving via ops-modal redirect).
    // Show a loader instead of the login form to give loadOrHealProfile time to finish.
    if (session && !activeProfile && isLoadingSession) {
      return <FullPageLoader message="Verifying operations credentials..." />;
    }

    if (!session || !activeProfile) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden text-slate-100 font-sans">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
          
          <div className="w-full max-w-md bg-slate-900 border border-slate-800/80 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-6 z-10 animate-fade-in">
            <div className="flex flex-col items-center space-y-2 text-center">
              <BrandMark size={52} title="VitalSync" />
              <div>
                <h3 className="text-xl font-extrabold text-white">VitalSync Super Admin</h3>
                <p className="text-xs text-slate-400 mt-1">Secure Operations Management Console</p>
              </div>
            </div>
            
            <AuthGateway 
              onAuthSuccess={handleAuthSuccess} 
              allowSignup={false} 
              initialSignupTab="ops"
            />
          </div>
        </div>
      );
    }

    const userRole = activeProfile?.role;
    if (userRole !== 'admin' && userRole !== 'platform_admin') {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100 font-sans">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center space-y-6">
            <AlertCircle className="h-16 w-16 text-rose-500 mx-auto" />
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Access Denied</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your profile role ({userRole || 'None'}) does not have permission to access the VitalSync operations console.
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      );
    }

    return (
      <ToastProvider>
        <div className="min-h-screen bg-white text-slate-800 flex flex-col font-sans select-none">
          <Suspense fallback={<FullPageLoader message="Loading Admin Workspace..." />}>
            <SaaSAdminPanel />
          </Suspense>
        </div>
      </ToastProvider>
    );
  }

  // 4. Redirect operations accounts logged in on any non-admin subdomain to admin.vitalsync.in
  const isNonAdminSubdomain = !isAdminSubdomain;
  
  if (!isSingleDomain && isNonAdminSubdomain && session && activeProfile) {
    const userRole = activeProfile.role;
    if (userRole === 'admin' || userRole === 'platform_admin') {
      const adminUrl = hostname === 'localhost' || hostname === '127.0.0.1'
        ? `http://admin.localhost:${window.location.port || '5173'}`
        : 'https://admin.vitalsync.in';
      // Auto-redirect immediately — do not leave admin session on wrong origin
      window.location.replace(adminUrl);
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-slate-100 font-sans">
          <div className="w-full max-w-md bg-slate-950 border border-slate-800 p-8 rounded-3xl text-center space-y-6 animate-fade-in shadow-2xl">
            <Shield className="h-10 w-10 text-cyan-400 mx-auto animate-pulse" />
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Redirecting to Admin Console</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sending you to admin.vitalsync.in where your session will work correctly...
              </p>
            </div>
          </div>
        </div>
      );
    }
  }

  // 5. Onboarding Screen Gate
  if (isOnboarding) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background Subtle Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-cyan-100/50 blur-[120px] pointer-events-none animate-pulse-subtle"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-100/50 blur-[120px] pointer-events-none animate-pulse-subtle" style={{ animationDelay: '2s' }}></div>

        <div className="w-full max-w-md bg-white border border-slate-200/60 p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center space-y-6 text-center z-10 animate-fade-in">
          <Loader2 className="h-12 w-12 text-cyan-600 animate-spin" />
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-slate-800">Configuring Your Workspace</h3>
            <p className="text-xs text-slate-500">
              Please wait while we initialize your clinical care network and apply secure tenant isolation keys...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 6. Dashboard Domain Gated View (app.vitalsync.in / app.localhost)
  if (isDashboardSubdomain && (!session || !activeProfile)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden text-slate-800 font-sans">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-teal-500/10 blur-[120px] pointer-events-none" />
        
        <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-6 z-10 animate-fade-in">
          <div className="flex flex-col items-center space-y-2 text-center">
            <BrandMark size={52} title="VitalSync" />
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">VitalSync Dashboard</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">Enterprise Care Connected Console</p>
            </div>
          </div>
          
          <AuthGateway 
            onAuthSuccess={handleAuthSuccess} 
            allowSignup={true} 
            initialSignupTab={initialSignupTab}
          />
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <ClinicProvider activeProfile={activeProfile}>
        <SpecializationProvider activeProfile={activeProfile}>
          <AppContent
            session={session}
            activeProfile={activeProfile}
            currentRole={currentRole}
            toasts={toasts}
            isBypassMode={isBypassMode}
            handleSignOut={handleSignOut}
            handleToggleBypass={handleToggleBypass}
            handleRoleChange={handleRoleChange}
            removeToast={removeToast}
          />
        </SpecializationProvider>
      </ClinicProvider>
    </ToastProvider>
  );
}

interface ResetPasswordFormProps {
  onSuccess: () => void;
}

function ResetPasswordForm({ onSuccess }: ResetPasswordFormProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) return;

    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Password Updated! 🎉',
          message: 'Your new security password is now active. Welcome back.',
          type: 'success'
        }
      }));

      onSuccess();
    } catch (_err) {
      const err = _err as any;
      console.error('[Mediflow Auth] Password update failed:', err);
      setErrorMsg(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleUpdatePassword} className="space-y-4">
      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-start gap-2.5">
          <AlertCircle className="h-4.5 w-4.5 text-rose-500 mt-0.5 shrink-0" />
          <span className="text-[11px] text-rose-600 font-semibold">{errorMsg}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
          New Security Password
        </label>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••••••"
            className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3.5 pl-11 pr-12 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 shadow-sm font-medium font-sans"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-655 transition-all cursor-pointer"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
          Confirm New Password
        </label>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••••••"
            className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3.5 pl-11 pr-12 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 shadow-sm font-medium font-sans"
            required
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 bg-gradient-to-r from-cyan-600 to-indigo-650 hover:from-cyan-500 hover:to-indigo-550 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-sans"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Update Password & Sign In <ArrowRight className="h-4 w-4" /></>}
      </button>
    </form>
  );
}
