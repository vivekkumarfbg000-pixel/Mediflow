import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../../services/api';
import { Search, Compass, Zap, User, Command } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  onStartConsultation?: (patient: any) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  onStartConsultation
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [onClose]);

  // Command items definitions
  const staticCommands = useMemo(() => [
    // Tabs Navigation
    { id: 'tab_pod_view',      category: 'Navigation', label: 'Go to Clinic Dashboard',   shortcut: '/tab clinic',    action: () => { setActiveTab('pod_view'); onClose(); } },
    { id: 'tab_consultation',  category: 'Navigation', label: 'Go to Consultation Queue', shortcut: '/tab consult',   action: () => { setActiveTab('consultation'); onClose(); } },
    { id: 'tab_financials',    category: 'Navigation', label: 'Go to Financial Reports',  shortcut: '/tab financials',action: () => { setActiveTab('financials'); onClose(); } },
    { id: 'tab_patients',      category: 'Navigation', label: 'Go to Patient Directory',  shortcut: '/tab directory', action: () => { setActiveTab('patients'); onClose(); } },
    { id: 'tab_whatsapp',      category: 'Navigation', label: 'Go to WhatsApp Inbox',     shortcut: '/tab whatsapp',  action: () => { setActiveTab('whatsapp'); onClose(); } },
    { id: 'tab_sop',           category: 'Navigation', label: 'Go to SOP Config Panel',   shortcut: '/tab sop',       action: () => { setActiveTab('sop'); onClose(); } },
    
    // Actions & Mode Switches
    { id: 'toggle_theme',      category: 'Actions',    label: 'Toggle Visual Theme Mode', shortcut: '/theme',         action: () => {
      const isDark = document.documentElement.classList.contains('dark');
      if (isDark) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      }
      window.dispatchEvent(new Event('storage'));
      onClose();
    } },
    { id: 'simulate_alarm',    category: 'Actions',    label: 'Simulate Vitals Alarm Link',shortcut: '/simulate',      action: () => {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { title: 'Simulated Alarm Active 🚨', message: 'HbA1c vital threshold warning pushed to Bihar Region.', type: 'warning' }
      }));
      onClose();
    } }
  ], [setActiveTab, onClose]);

  // Patients query results
  const patients = useMemo(() => api.getPatients(), []);

  // Filter commands and patients based on search text query
  const filteredItems = useMemo(() => {
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) {
      return [
        ...staticCommands.map(cmd => ({ ...cmd, type: 'command' as const })),
        ...patients.slice(0, 5).map(p => ({
          id: `patient_${p.id}`,
          category: 'Patients (Recent)',
          label: `${p.name} (Token: ${p.tokenNumber || 'N/A'})`,
          shortcut: p.phone,
          type: 'patient' as const,
          payload: p
        }))
      ];
    }

    const commandMatches = staticCommands
      .filter(cmd => cmd.label.toLowerCase().includes(cleanQuery) || cmd.shortcut.toLowerCase().includes(cleanQuery))
      .map(cmd => ({ ...cmd, type: 'command' as const }));

    const patientMatches = patients
      .filter(p => p.name.toLowerCase().includes(cleanQuery) || p.phone.includes(cleanQuery))
      .map(p => ({
        id: `patient_${p.id}`,
        category: 'Patient Match',
        label: `${p.name} (${p.age}y · ${p.gender})`,
        shortcut: p.phone,
        type: 'patient' as const,
        payload: p
      }));

    return [...commandMatches, ...patientMatches];
  }, [query, staticCommands, patients]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Key navigation controller
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        const item = filteredItems[selectedIndex];
        if (item.type === 'command') {
          item.action();
        } else if (item.type === 'patient') {
          if (onStartConsultation) {
            onStartConsultation(item.payload);
          }
          onClose();
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[9999] flex items-start justify-center pt-24 px-4 font-sans select-none animate-fade-in">
      <div 
        ref={paletteRef}
        className="w-full max-w-lg bg-white/95 dark:bg-slate-900/90 border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl flex flex-col max-h-[450px]"
        onKeyDown={handleKeyDown}
      >
        {/* Search header container */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200/60 dark:border-white/5 bg-transparent shrink-0">
          <Search className="h-4 w-4 text-slate-400 dark:text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search patient, type commands (/tab, /theme)..."
            className="w-full bg-transparent text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none border-none leading-none p-0"
          />
          <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-white/5 uppercase tracking-wide shrink-0">
            Esc
          </span>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 select-none">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-slate-400 dark:text-zinc-500 flex flex-col items-center gap-1.5">
              <span className="material-symbols-outlined text-2xl">search_off</span>
              <p className="text-xs font-semibold">No command or patient matches found</p>
            </div>
          ) : (
            (() => {
              let currentCategory = '';
              return filteredItems.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const showCategoryHeader = item.category !== currentCategory;
                currentCategory = item.category;

                return (
                  <React.Fragment key={item.id}>
                    {showCategoryHeader && (
                      <div className="px-3.5 pt-2.5 pb-1 text-[9px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest leading-none">
                        {item.category}
                      </div>
                    )}
                    <button
                      onClick={() => {
                        if (item.type === 'command') {
                          item.action();
                        } else if (item.type === 'patient') {
                          if (onStartConsultation) {
                            onStartConsultation(item.payload);
                          }
                          onClose();
                        }
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold transition-all duration-150 border-0 cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400'
                          : 'bg-transparent text-slate-700 dark:text-zinc-300 hover:bg-slate-100/50 dark:hover:bg-white/5'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        {item.type === 'command' ? (
                          item.category === 'Navigation' ? (
                            <Compass className={`h-4 w-4 ${isSelected ? 'text-indigo-550' : 'text-slate-400 dark:text-zinc-500'}`} />
                          ) : (
                            <Zap className={`h-4 w-4 ${isSelected ? 'text-indigo-550' : 'text-slate-400 dark:text-zinc-500'}`} />
                          )
                        ) : (
                          <User className={`h-4 w-4 ${isSelected ? 'text-indigo-550' : 'text-slate-400 dark:text-zinc-500'}`} />
                        )}
                        <span className="truncate">{item.label}</span>
                      </span>
                      
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border leading-none ${
                        isSelected
                          ? 'bg-indigo-100/60 dark:bg-indigo-900/30 border-indigo-200/50 dark:border-indigo-800/40 text-indigo-600 dark:text-indigo-400'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/60 dark:border-white/5 text-slate-400 dark:text-zinc-500'
                      }`}>
                        {item.shortcut}
                      </span>
                    </button>
                  </React.Fragment>
                );
              });
            })()
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="px-4 py-2 bg-slate-50/50 dark:bg-slate-950/20 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between text-[9px] font-semibold text-slate-400 dark:text-zinc-500 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">keyboard_arrow_up</span>
              <span className="material-symbols-outlined text-[12px]">keyboard_arrow_down</span>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">keyboard_return</span>
              Select
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Command className="h-3 w-3" />
            <span>K to toggle</span>
          </div>
        </div>
      </div>
    </div>
  );
};
