// Mediflow Connected Care Ecosystem - Premium Dashboard v1.0.0
import { useState, useEffect } from 'react';
import { Navbar } from './components/shared/Navbar';
import type { UserRole } from './components/shared/Navbar';
import { api } from './services/api';
import { CompounderDashboard } from './components/compounder/CompounderDashboard';
import { DoctorDashboard } from './components/doctor/DoctorDashboard';
import { LabDashboard } from './components/lab/LabDashboard';
import { PharmacyDashboard } from './components/pharmacy/PharmacyDashboard';
import { BillingDashboard } from './components/billing/BillingDashboard';
import { AuthGateway } from './components/shared/AuthGateway';
import { supabase } from './lib/supabaseClient';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { ClinicProvider, useClinic } from './context/ClinicContext';
import { PendingApprovalScreen } from './components/shared/PendingApprovalScreen';
import { PatientWhatsAppSimulator } from './components/shared/PatientWhatsAppSimulator';
import { PatientMobileDashboard } from './components/shared/PatientMobileDashboard';

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

  const renderDashboard = () => {
    switch (currentRole) {
      case 'compounder':
        return <CompounderDashboard />;
      case 'doctor':
        return <DoctorDashboard />;
      case 'lab':
        return <LabDashboard />;
      case 'pharmacy':
        return <PharmacyDashboard />;
      case 'billing':
        return <BillingDashboard />;
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
        <AuthGateway onAuthSuccess={handleAuthSuccess} />
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
    <div className="min-h-screen bg-clinical-950 text-clinical-100 flex flex-col font-sans select-none">
      {/* Shared Ecosystem Navigation Header */}
      <Navbar 
        currentRole={currentRole} 
        onChangeRole={handleRoleChange}
        activeProfile={activeProfile}
        onSignOut={handleSignOut}
        isBypassMode={isBypassMode}
        onToggleBypass={handleToggleBypass}
      />

      {/* Primary Dashboard viewport wrapper wrapped in secure telemetry isolated ErrorBoundary */}
      <main className="flex-1 pb-16">
        <div className="animate-fade-in">
          <ErrorBoundary>
            {renderDashboard()}
          </ErrorBoundary>
        </div>
      </main>

      {/* Premium Glassmorphic Toast Notifications Overlay */}
      <div className="fixed top-24 right-4 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
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

      {/* Ecosystem Footer Status bar */}
      <footer className="border-t border-clinical-800/80 bg-clinical-950/80 backdrop-blur-md py-4 text-center text-[10px] text-clinical-500 font-semibold uppercase tracking-wider sticky bottom-0">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Mediflow Clinical Network Pod • Patna Zone 1</span>
          <span className="flex items-center gap-1.5 text-accent-500 bg-accent-500/10 px-2.5 py-0.5 rounded-full border border-accent-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-pulse-subtle"></span>
            Ecosystem Core Active
          </span>
        </div>
      </footer>

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
    </div>
  );
}

export default function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>('compounder');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [session, setSession] = useState<any>(null);
  const [activeProfile, setActiveProfile] = useState<any>(null);
  const [isBypassMode, setIsBypassMode] = useState<boolean>(true); // Dev bypass default for smooth testing

  useEffect(() => {
    // Sync the active role with MediflowApiService simulated checks
    let apiRole: string = currentRole;
    if (currentRole === 'lab') apiRole = 'lab_technician';
    else if (currentRole === 'pharmacy') apiRole = 'pharmacist';
    else if (currentRole === 'billing') apiRole = 'admin';
    else if (currentRole === 'patient') apiRole = 'patient';
    api.setSimulatedRole(apiRole);
  }, [currentRole]);

  useEffect(() => {
    // 1. Check existing Supabase session and load active profile
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile }) => {
            if (profile) {
              setActiveProfile(profile);
              let defaultRole: UserRole = 'compounder';
              if (profile.role === 'doctor') defaultRole = 'doctor';
              else if (profile.role === 'lab_technician') defaultRole = 'lab';
              else if (profile.role === 'pharmacist') defaultRole = 'pharmacy';
              else if (profile.role === 'patient') defaultRole = 'patient';
              else if (profile.role === 'admin' || profile.role === 'platform_admin') defaultRole = 'billing';
              setCurrentRole(defaultRole);
            }
          });
      }
    });

    // 2. Setup auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setActiveProfile(null);
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
      
      // Auto dismiss after 4 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 4000);
    };

    window.addEventListener('mediflow-toast', handleToast);
    
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('mediflow-toast', handleToast);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleAuthSuccess = (session: any, profile: any) => {
    setSession(session);
    setActiveProfile(profile);
    
    let defaultRole: UserRole = 'compounder';
    if (profile.role === 'doctor') defaultRole = 'doctor';
    else if (profile.role === 'lab_technician') defaultRole = 'lab';
    else if (profile.role === 'pharmacist') defaultRole = 'pharmacy';
    else if (profile.role === 'patient') defaultRole = 'patient';
    else if (profile.role === 'admin' || profile.role === 'platform_admin') defaultRole = 'billing';
    
    setCurrentRole(defaultRole);

    const id = crypto.randomUUID();
    setToasts(prev => [...prev, {
      id,
      title: 'Professional Portal Initialized',
      message: `Successfully authenticated as ${profile.display_name}. Role: ${profile.role.toUpperCase()}`,
      type: 'success'
    }]);
  };

  const handleSignOut = () => {
    setSession(null);
    setActiveProfile(null);
    setCurrentRole('compounder');
    
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, {
      id,
      title: 'Workspace De-authenticated',
      message: 'Logged out of Mediflow Clinical Connected Care.',
      type: 'info'
    }]);
  };

  const handleToggleBypass = (bypass: boolean) => {
    setIsBypassMode(bypass);
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, {
      id,
      title: bypass ? 'Bypass Mode Enabled' : 'Strict Mode Enforced',
      message: bypass
        ? 'Authorization checks bypassed. Dynamic switcher active for E2E testing.'
        : 'Enterprise security constraints active. Dashboards locked to professional profile role.',
      type: bypass ? 'warning' : 'success'
    }]);
  };

  const handleRoleChange = (role: UserRole) => {
    if (!isBypassMode && activeProfile) {
      const allowedRoles: Record<string, UserRole[]> = {
        'doctor': ['doctor'],
        'lab_technician': ['lab'],
        'pharmacist': ['pharmacy'],
        'patient': ['patient'],
        'admin': ['billing', 'compounder', 'doctor', 'lab', 'pharmacy', 'patient'],
        'platform_admin': ['billing', 'compounder', 'doctor', 'lab', 'pharmacy', 'patient']
      };

      const userRole = activeProfile.role;
      const allowed = allowedRoles[userRole] || [];

      if (!allowed.includes(role)) {
        const errorMsg = `De-authorization: Account role (${userRole.replace('_', ' ')}) is not permitted to view the ${role.toUpperCase()} module under active compliance policy.`;
        
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, {
          id,
          title: 'Access Restricted',
          message: errorMsg,
          type: 'error'
        }]);

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

  return (
    <ClinicProvider activeProfile={activeProfile}>
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
    </ClinicProvider>
  );
}
