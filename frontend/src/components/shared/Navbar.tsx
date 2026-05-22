import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
  Activity, 
  UserPlus, 
  Stethoscope, 
  Beaker, 
  ShoppingBag, 
  QrCode 
} from 'lucide-react';

export type UserRole = 'compounder' | 'doctor' | 'lab' | 'pharmacy' | 'billing';

interface NavbarProps {
  currentRole: UserRole;
  onChangeRole: (role: UserRole) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentRole, onChangeRole }) => {
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

  return (
    <nav className="border-b border-clinical-800/80 bg-clinical-950/70 backdrop-blur-md sticky top-0 z-50 px-4 md:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Brand Header */}
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
                <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-primary animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
                {isSyncing ? 'Syncing' : 'Live'}
              </span>
            </h1>
            <p className="text-clinical-400 text-xs font-medium">Hyper-Local Connected Care Network</p>
          </div>
        </div>

        {/* Switcher Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-clinical-900 border border-clinical-800/60 max-w-full overflow-x-auto scrollbar-none">
          {roles.map((r) => {
            const Icon = r.icon;
            const isActive = currentRole === r.id;
            return (
              <button
                key={r.id}
                onClick={() => onChangeRole(r.id as UserRole)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all duration-300 ${
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
      </div>
    </nav>
  );
};
