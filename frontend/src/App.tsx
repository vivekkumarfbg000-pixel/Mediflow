// Mediflow Connected Care Ecosystem - Premium Dashboard v1.0.0
import { useState, useEffect, lazy, Suspense } from 'react';
import { Navbar } from './components/shared/Navbar';
import type { UserRole } from './components/shared/Navbar';
import { api } from './services/api';
import { StateHealingEngine, ProactiveHealthMonitor } from './services/autoHealerAgent';

const CompounderDashboard = lazy(() => import('./components/compounder/CompounderDashboard').then(m => ({ default: m.CompounderDashboard })));
const DoctorDashboard = lazy(() => import('./components/doctor/DoctorDashboard').then(m => ({ default: m.DoctorDashboard })));
const LabDashboard = lazy(() => import('./components/lab/LabDashboard').then(m => ({ default: m.LabDashboard })));
const PharmacyDashboard = lazy(() => import('./components/pharmacy/PharmacyDashboard').then(m => ({ default: m.PharmacyDashboard })));
const BillingDashboard = lazy(() => import('./components/billing/BillingDashboard').then(m => ({ default: m.BillingDashboard })));
const SaaSAdminPanel = lazy(() => import('./components/admin/SaaSAdminPanel').then(m => ({ default: m.SaaSAdminPanel })));

import { LandingPage } from './components/shared/LandingPage';
import { supabase } from './lib/supabaseClient';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X, Loader2 } from 'lucide-react';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { RequireRole } from './components/ui/RequireRole';
import { ClinicProvider, useClinic } from './context/ClinicContext';
import { SpecializationProvider } from './context/SpecializationContext';
import { PendingApprovalScreen } from './components/shared/PendingApprovalScreen';
import { PatientWhatsAppSimulator } from './components/shared/PatientWhatsAppSimulator';
import { PatientMobileDashboard } from './components/shared/PatientMobileDashboard';
import { CommandBar } from './components/shared/CommandBar';
import { PwaSyncManager } from './pwa';
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
  setCurrentRole: (role: UserRole) => void;
  toasts: Toast[];
  setToasts: React.Dispatch<React.SetStateAction<Toast[]>>;
  isBypassMode: boolean;
  setIsBypassMode: (bypass: boolean) => void;
  handleAuthSuccess: (session: any, profile: any) => void;
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
  handleAuthSuccess,
  handleSignOut,
  handleToggleBypass,
  handleRoleChange,
  removeToast
}: AppContentProps) {
  const { partnerStatus } = useClinic();
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);

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
      default: return <DashboardSkeleton />;
    }
  };

  const renderDashboard = () => {
    switch (currentRole) {
      case 'compounder':
        return (
          <RequireRole allowedRoles={['compounder']} role={currentRole} bypass={isBypassMode}>
            <CompounderDashboard />
          </RequireRole>
        );
      case 'doctor':
        return (
          <RequireRole allowedRoles={['doctor']} role={currentRole} bypass={isBypassMode}>
            <DoctorDashboard />
          </RequireRole>
        );
      case 'lab':
        return (
          <RequireRole allowedRoles={['lab']} role={currentRole} bypass={isBypassMode}>
            <LabDashboard />
          </RequireRole>
        );
      case 'pharmacy':
        return (
          <RequireRole allowedRoles={['pharmacy']} role={currentRole} bypass={isBypassMode}>
            <PharmacyDashboard />
          </RequireRole>
        );
      case 'billing':
        return <BillingDashboard />;
      case 'saas_admin':
        return <SaaSAdminPanel />;
      case 'patient':
        return <PatientMobileDashboard />;
      default:
        return <CompounderDashboard />;
    }
  };

  // Block viewport rendering if not securely authenticated
  if (!session || !activeProfile) {
    return (
      <>
        <LandingPage onAuthSuccess={handleAuthSuccess} />
        {/* Render fallback toast overlay for auth portal status info */}
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto flex items-start gap-3 p-4 rounded-2xl bg-clinical-950/80 backdrop-blur-xl border border-rose-500/20 shadow-lg shadow-rose-500/10 transition-all duration-300 animate-slide-in">
              <AlertCircle className="h-5 w-5 text-rose-400 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-white tracking-wide">{t.title}</h4>
                <p className="text-xs text-clinical-300 mt-1">{t.message}</p>
              </div>
            </div>
          ))}
        </div>
      </>
    );
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
    <div className="min-h-screen bg-white dark:bg-slate-50 text-slate-800 dark:text-slate-100 flex flex-col font-sans select-none">
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
      <main className={`flex-1 pb-32 md:pb-16 ${isSidebarCollapsed ? 'md:pl-20' : 'md:pl-64'} transition-all duration-300 dense-theme`}>
        <div className="animate-fade-in">
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



      {/* Floating WhatsApp Sandbox Trigger Button */}
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

export default function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>('doctor');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [session, setSession] = useState<any>(null);
  const [activeProfile, setActiveProfile] = useState<any>(null);
  const [isBypassMode, setIsBypassMode] = useState<boolean>(false); // Production default (bypass mode disabled)
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);

  useEffect(() => {
    PwaSyncManager.registerServiceWorker();
    StateHealingEngine.initGlobalListener();
    ProactiveHealthMonitor.start();
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
    else if (currentRole === 'pharmacy') apiRole = 'pharmacist';
    else if (currentRole === 'billing') apiRole = 'admin';
    else if (currentRole === 'patient') apiRole = 'patient';
    api.setSimulatedRole(apiRole);
  }, [currentRole]);

  // Loading watchdog: If session exists but we are stuck loading for more than 4 seconds, trigger self-healing
  useEffect(() => {
    if (!session) return;
    if (typeof window !== 'undefined' && (window as any).__mediflow_registering) return;
    
    const timer = setTimeout(() => {
      const isStillLoading = isLoadingSession || isOnboarding;
      if (isStillLoading) {
        console.warn('[Loading Watchdog] Stuck loading state detected for >4 seconds. Triggering State Healing Engine...');
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
    }, 4000);

    return () => clearTimeout(timer);
  }, [session, isLoadingSession, isOnboarding]);

  // Role Watchdog: Detect profile role discrepancies against auth metadata role and align them
  useEffect(() => {
    if (!session || !activeProfile) return;

    const authEmail = session.user?.email;
    const metadataRole = session.user?.user_metadata?.role;
    const profileRole = activeProfile.role;

    const isOwner = authEmail === 'owner@mediflow.com' || authEmail === 'vivekkumarfbg000@gmail.com';
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
      } catch (err: any) {
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
    
    // 1. Try to fetch profile
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id);
      
    let activeProfile = profiles && profiles.length > 0 ? profiles[0] : null;
    
    // 2. If profile is missing, trigger auto-healing RPC
    if (!activeProfile) {
      console.log('[Profile Loader] Profile missing. Triggering reconcile_profile_role...');
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
    
    if (activeProfile) {
      // 3. Complete onboarding if needed
      return await checkAndCompleteOnboarding(session, activeProfile);
    }
    
    return null;
  };

  useEffect(() => {
    let active = true;

    // Safety timeout: If session loading takes more than 3.5 seconds (e.g. invalid refresh token fetch hangs), force loader removal
    const safetyTimeout = setTimeout(() => {
      if (active) {
        console.warn('[Mediflow Auth] Session initialization timed out. Forcing loader removal.');
        setIsLoadingSession(false);
      }
    }, 3500);

    // 1. Check existing Supabase session and load active profile
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      setSession(session);
      if (session?.user) {
        const finalProfile = await loadOrHealProfile(session);
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
      setSession(session);
      if (!session) {
        setActiveProfile(null);
        setIsLoadingSession(false);
        // Clear pod context so next user gets fresh real IDs
        clearPodContext();
      } else {
        if (event === 'SIGNED_IN') {
          console.log('[Mediflow Auth] SIGNED_IN event detected. Deferring profile load to form handler.');
          // Eagerly resolve pod context in background on sign-in
          resolvePodContext().catch(() => {});
          return;
        }
        if (typeof window !== 'undefined' && (window as any).__mediflow_registering) {
          console.log('[Mediflow Auth] Registration in progress. Deferring profile loading in onAuthStateChange.');
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
    try {
      await supabase.auth.signOut();
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
        'doctor': ['doctor', 'compounder', 'lab', 'pharmacy', 'billing', 'patient'],
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
    setCurrentRole(role);
  };

  if (isLoadingSession) {
    return <FullPageLoader message="Initializing clinical session..." />;
  }

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

  return (
    <ToastProvider>
      <ClinicProvider activeProfile={activeProfile}>
        <SpecializationProvider activeProfile={activeProfile}>
          <AppContent
            session={session}
            activeProfile={activeProfile}
            currentRole={currentRole}
            setCurrentRole={setCurrentRole}
            toasts={toasts}
            setToasts={setToasts}
            isBypassMode={isBypassMode}
            setIsBypassMode={setIsBypassMode}
            handleAuthSuccess={handleAuthSuccess}
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
