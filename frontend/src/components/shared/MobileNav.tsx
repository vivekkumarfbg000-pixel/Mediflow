import React from 'react';
import { 
  Home, 
  FileText, 
  Wallet, 
  RefreshCw, 
  Activity, 
  Menu,
  ShieldAlert
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface TabItem {
  id: 'home' | 'records' | 'wallet' | 'refills' | 'vitals';
  label: string;
  icon: LucideIcon;
}

interface MobileNavProps {
  activeTab: 'home' | 'records' | 'wallet' | 'refills' | 'vitals';
  onTabChange: (tabId: 'home' | 'records' | 'wallet' | 'refills' | 'vitals') => void;
  patientName: string;
  isPodConnected: boolean;
  onMenuClick?: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  onTabChange,
  patientName,
  isPodConnected = true,
  onMenuClick
}) => {
  const tabs: TabItem[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'records', label: 'Records', icon: FileText },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'refills', label: 'Refills', icon: RefreshCw },
    { id: 'vitals', label: 'Health', icon: Activity }
  ];

  return (
    <>
      {/* 1. Header Bar Component */}
      <header className="pt-7 pb-3.5 px-5 bg-zinc-950 border-b border-white/5 flex justify-between items-center shrink-0 z-40">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <div className={`w-2.5 h-2.5 rounded-full ${isPodConnected ? 'bg-emerald-500 shadow-[0_0_12px_#10b981]' : 'bg-rose-500'}`} />
            {isPodConnected && <span className="absolute w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-75" />}
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none font-mono">
              Mediflow Pod Active
            </h4>
            <span className="text-[8px] text-zinc-500 font-semibold block mt-0.5">
              Secure multi-tenant sync
            </span>
          </div>
        </div>

        <button 
          type="button"
          onClick={onMenuClick}
          className="w-11 h-11 flex items-center justify-center rounded-xl bg-zinc-900 border border-white/5 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer"
          aria-label="Toggle Secondary Menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* 2. Bottom Tab Navigation Bar Component */}
      <nav className="bg-zinc-950/90 backdrop-blur-xl border-t border-slate-200/60 py-2.5 px-4 flex justify-between items-center shrink-0 z-40">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex-1 py-1 flex flex-col items-center justify-center gap-1 group relative transition-all cursor-pointer h-11"
              aria-label={`Navigate to ${tab.label}`}
            >
              {isActive && (
                <span className="absolute -top-2.5 w-8 h-[2px] bg-cyan-400 shadow-[0_0_8px_#22d3ee] rounded-full animate-fade-in" />
              )}
              <Icon className={`h-[18px] w-[18px] transition-transform duration-300 group-active:scale-90 ${
                isActive 
                  ? 'text-cyan-400 filter drop-shadow-[0_0_4px_rgba(34,211,238,0.3)] scale-105' 
                  : 'text-zinc-500 group-hover:text-zinc-300'
              }`} />
              <span className={`text-[8px] font-bold tracking-wider font-sans ${
                isActive 
                  ? 'text-white' 
                  : 'text-zinc-500 group-hover:text-zinc-300'
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
