import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
  Activity, 
  UserPlus, 
  Stethoscope, 
  Beaker, 
  ShoppingBag, 
  QrCode,
  LogOut,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';

export type UserRole = 'compounder' | 'doctor' | 'lab' | 'pharmacy' | 'billing';

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
  const [isSyncing, setIsSyncing] = useState(api.isSyncing);

  useEffect(() => {
    return api.subscribe(() => {
      setIsSyncing(api.isSyncing);
    });
  }, []);

  const roles = [
    { id: 'compounder', name: 'Compounder', icon: UserPlus, color: 'text-accent-500 bg-accent-500/10' },
    { id: 'doctor', name: 'Doctor Dashboard', icon: Stethoscope, color: 'text-primary-500 bg-primary-500/10' },
    { id: 'lab', name: 'Pathology Lab', icon: Beaker, color: 'text-blue-500 bg-blue-500/10' },
    { id: 'pharmacy', name: 'Pharmacy POS', icon: ShoppingBag, color: 'text-emerald-500 bg-emerald-500/10' },
    { id: 'billing', name: 'UPI Ledger', icon: QrCode, color: 'text-rose-500 bg-rose-500/10' },
  ];

  // Map database profile roles to navbar switcher roles
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
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
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
              <p className="text-clinical-400 text-xs font-medium">Hyper-Local Connected Care Network</p>
            </div>
          </div>

          {/* Dev Bypass Trigger on Mobile */}
          <button 
            onClick={() => onToggleBypass(!isBypassMode)}
            className={`lg:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-bold uppercase tracking-wider transition-all duration-300 ${
              isBypassMode 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                : 'bg-clinical-900 border-clinical-800 text-clinical-400'
            }`}
          >
            {isBypassMode ? <ShieldAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
            Bypass
          </button>
        </div>

        {/* Switcher Navigation */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-start lg:justify-end">
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-clinical-900 border border-clinical-800/60 max-w-full overflow-x-auto scrollbar-none">
            {roles.map((r) => {
              const Icon = r.icon;
              const isActive = currentRole === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => onChangeRole(r.id as UserRole)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs md:text-sm font-semibold transition-all duration-300 ${
                    isActive
                      ? 'bg-clinical-800 text-white border border-clinical-700/80 shadow-md scale-[1.02]'
                      : 'text-clinical-400 hover:text-clinical-100 hover:bg-clinical-800/40 border border-transparent'
                  }`}
                >
                  <div className={`p-1 rounded-lg ${r.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span>{r.name}</span>
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
    </nav>
  );
};
