import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon: LucideIcon;
  iconColorClass?: string;
  accentColorClass?: string;
  detailsTitle?: string;
  children?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  icon: Icon,
  iconColorClass = 'text-cyan-400',
  accentColorClass = 'from-cyan-500/10 to-indigo-500/10',
  detailsTitle = 'Clinical Insights',
  children
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full glass-panel glass-panel-hover overflow-hidden transition-all duration-300 relative group">
      
      {/* Decorative Accent Glow */}
      <div className={`absolute inset-0 bg-gradient-to-br ${accentColorClass} opacity-[0.12] dark:opacity-20 pointer-events-none`} />

      {/* Main card interface block */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="p-4 flex items-center justify-between cursor-pointer select-none min-h-[44px]"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center border border-slate-200/40 dark:border-white/5">
            <Icon className={`h-4.5 w-4.5 ${iconColorClass}`} />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-widest block font-mono">
              {title}
            </span>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className="text-lg font-black text-slate-900 dark:text-white leading-none tracking-tight">
                {value}
              </span>
              {unit && (
                <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400">
                  {unit}
                </span>
              )}
            </div>
            {subtitle && (
              <span className="text-[8px] text-slate-500 dark:text-zinc-400 block mt-0.5 leading-none">
                {subtitle}
              </span>
            )}
          </div>
        </div>

        {/* Dynamic height toggle trigger */}
        <div className="w-11 h-11 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white rounded-full bg-transparent hover:bg-slate-100 dark:hover:bg-white/5 active:scale-95 transition-all">
          {isOpen ? <ChevronUp className="h-4.5 w-4.5" /> : <ChevronDown className="h-4.5 w-4.5" />}
        </div>
      </div>

      {/* Stripe Progressive Disclosure Panel */}
      {isOpen && children && (
        <div className="border-t border-slate-200/50 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/40 p-4 space-y-3.5 animate-fade-in">
          <div className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 text-[8px] font-bold tracking-widest uppercase font-mono border-b border-slate-200/50 dark:border-white/5 pb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400 animate-pulse" />
            {detailsTitle}
          </div>
          <div className="text-[10px] text-slate-700 dark:text-zinc-300 leading-relaxed font-medium">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};
