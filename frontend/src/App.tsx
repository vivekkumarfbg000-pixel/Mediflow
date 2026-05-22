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
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
}

function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>('compounder');
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let apiRole: string = currentRole;
    if (currentRole === 'lab') apiRole = 'lab_technician';
    else if (currentRole === 'pharmacy') apiRole = 'pharmacist';
    else if (currentRole === 'billing') apiRole = 'admin';
    api.setSimulatedRole(apiRole);
  }, [currentRole]);

  useEffect(() => {
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
      window.removeEventListener('mediflow-toast', handleToast);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

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
      default:
        return <CompounderDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-clinical-950 text-clinical-100 flex flex-col font-sans select-none">
      {/* Shared Ecosystem Navigation Header */}
      <Navbar currentRole={currentRole} onChangeRole={setCurrentRole} />

      {/* Primary Dashboard viewport wrapper */}
      <main className="flex-1 pb-16">
        <div className="animate-fade-in">
          {renderDashboard()}
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
    </div>
  );
}

export default App;

