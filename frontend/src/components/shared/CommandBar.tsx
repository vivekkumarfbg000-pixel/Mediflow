import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { Search, Terminal, CornerDownLeft, Shield, User, Activity, Beaker, ShoppingBag, QrCode } from 'lucide-react';
import type { UserRole } from './Navbar';

interface CommandBarProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  isBypassMode: boolean;
  onToggleBypass: (bypass: boolean) => void;
}

export const CommandBar: React.FC<CommandBarProps> = ({
  isOpen,
  onClose,
  onChangeRole,
  isBypassMode,
  onToggleBypass,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Unified actions list
  const actions = [
    // Modules/Roles
    { id: 'role_compounder', title: 'Switch to Compounder Workdesk', category: 'Roles / Modules', icon: User, action: () => onChangeRole('compounder') },
    { id: 'role_doctor', title: 'Switch to Doctor Care Dashboard', category: 'Roles / Modules', icon: Activity, action: () => onChangeRole('doctor') },
    { id: 'role_lab', title: 'Switch to Pathology Lab Console', category: 'Roles / Modules', icon: Beaker, action: () => onChangeRole('lab') },
    { id: 'role_pharmacy', title: 'Switch to Pharmacy POS Desk', category: 'Roles / Modules', icon: ShoppingBag, action: () => onChangeRole('pharmacy') },
    { id: 'role_billing', title: 'Switch to UPI Split Ledger Portal', category: 'Roles / Modules', icon: QrCode, action: () => onChangeRole('billing') },
    
    // Security/Developer bypass
    { id: 'toggle_bypass', title: isBypassMode ? 'Deactivate Developer Bypass (Enforce Strict RLS)' : 'Activate Developer Bypass (E2E Testing Mode)', category: 'Security & DevTools', icon: Shield, action: () => onToggleBypass(!isBypassMode) },
  ];

  // Dynamic patient results from registry API
  const dbPatients = api.getPatients();
  const patientActions = dbPatients.map(p => ({
    id: `patient_${p.id}`,
    title: `Active Patient Registry: ${p.name} (Phone: ${p.phone})`,
    category: 'Patients Registry',
    icon: User,
    action: () => {
      api.setActivePatient(p);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Patient Loop Linked 🎯',
          message: `Linked care telemetry loop to patient ${p.name}.`,
          type: 'success'
        }
      }));
    }
  }));

  const allItems = [...actions, ...patientActions];

  const filteredItems = allItems.filter(item =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-white/60 backdrop-blur-md flex items-start justify-center p-4 md:p-12 transition-all animate-fade-in"
      onClick={onClose}
    >
      {/* Command dialog panel */}
      <div 
        className="w-full max-w-2xl bg-white border border-slate-200/80 shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[85vh] mt-12 md:mt-24 animate-slide-in relative font-sans text-slate-800"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-primary-600 via-accent-600 to-emerald-500" />
        
        {/* Search header input */}
        <div className="relative border-b border-slate-100/60 px-5 py-4 flex items-center gap-3.5">
          <Search className="h-5 w-5 text-slate-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, look up a patient, or switch roles..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full bg-transparent border-0 outline-none text-slate-800 placeholder-slate-400 font-bold text-sm tracking-wide focus:ring-0 focus:border-transparent py-1.5"
          />
          <span className="hidden sm:flex text-[9px] font-bold font-mono px-2 py-0.5 bg-slate-100 border border-slate-200/80 rounded-lg text-slate-600 select-none shadow-sm">
            ESC
          </span>
        </div>

        {/* Action / Results list */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 max-h-[50vh]">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-600 text-xs italic flex flex-col items-center gap-2">
              <Terminal className="h-7 w-7 text-slate-600 animate-pulse" />
              Scanning database... No matching commands or patients found.
            </div>
          ) : (
            // Group by category
            Object.entries(
              filteredItems.reduce<Record<string, typeof filteredItems>>((acc, item) => {
                acc[item.category] = acc[item.category] || [];
                acc[item.category].push(item);
                return acc;
              }, {})
            ).map(([category, items]) => (
              <div key={category} className="space-y-1.5 animate-fade-in">
                <span className="block text-[8px] text-slate-600 font-extrabold uppercase tracking-widest pl-2.5 mb-2">{category}</span>
                <div className="space-y-1">
                  {items.map(item => {
                    const globalIndex = filteredItems.indexOf(item);
                    const isSelected = selectedIndex === globalIndex;
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          item.action();
                          onClose();
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-300 relative text-left group cursor-pointer ${
                          isSelected
                            ? 'bg-slate-50 border border-slate-100 shadow-sm'
                            : 'bg-transparent border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                            isSelected
                              ? 'bg-primary text-white shadow-md shadow-primary/10'
                              : 'bg-slate-50 text-slate-600'
                          }`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className={`text-xs font-bold transition-all ${
                            isSelected ? 'text-slate-900 font-extrabold' : 'text-slate-600'
                          }`}>
                            {item.title}
                          </span>
                        </div>

                        {isSelected && (
                          <div className="flex items-center gap-1 text-[9px] font-bold font-mono px-2 py-0.5 bg-white border border-slate-100 rounded-lg text-slate-600 animate-fade-in shadow-xs select-none">
                            <CornerDownLeft className="h-2.5 w-2.5" />
                            ENTER
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Global Footer shortcuts bar */}
        <div className="border-t border-slate-100/60 bg-slate-50 px-5 py-3.5 flex justify-between items-center text-[10px] text-slate-600 font-semibold tracking-wide select-none">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-xs text-[9px]">↑↓</span>
              Navigate
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-xs text-[9px]">↵</span>
              Select
            </span>
          </div>
          <span className="text-[9px] font-extrabold tracking-wider text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-full uppercase">
            Mediflow Core OS v1.0.0
          </span>
        </div>
      </div>
    </div>
  );
};
