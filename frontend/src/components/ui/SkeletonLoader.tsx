import React from 'react';

interface SkeletonLoaderProps {
  className?: string;
}

export const SkeletonMetric: React.FC<SkeletonLoaderProps> = ({ className = '' }) => {
  return (
    <div className={`bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 rounded-xl p-4 flex flex-col gap-1.5 animate-shimmer ${className}`}>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800" />
        <div className="w-16 h-3 bg-slate-200 dark:bg-slate-800 rounded" />
      </div>
      <div className="w-10 h-7 bg-slate-200 dark:bg-slate-800 rounded mt-1" />
      <div className="w-20 h-2.5 bg-slate-200 dark:bg-slate-850 rounded mt-0.5" />
    </div>
  );
};

export const SkeletonCard: React.FC<SkeletonLoaderProps> = ({ className = '' }) => {
  return (
    <div className={`bg-white/90 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/5 rounded-2xl p-5 shadow-xs animate-shimmer ${className}`}>
      <div className="flex justify-between items-center mb-5">
        <div className="w-32 h-5 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="w-16 h-4 bg-slate-200 dark:bg-slate-800 rounded-full" />
      </div>
      <div className="space-y-3">
        <div className="w-full h-12 bg-slate-100 dark:bg-slate-900/40 rounded-xl" />
        <div className="w-full h-12 bg-slate-100 dark:bg-slate-900/40 rounded-xl" />
        <div className="w-full h-12 bg-slate-100 dark:bg-slate-900/40 rounded-xl" />
      </div>
    </div>
  );
};

export const SkeletonRow: React.FC<SkeletonLoaderProps> = ({ className = '' }) => {
  return (
    <div className={`p-4 bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/5 rounded-xl flex items-center justify-between animate-shimmer ${className}`}>
      <div className="flex items-center gap-3 flex-1">
        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800" />
        <div className="space-y-1.5 flex-1 max-w-[200px]">
          <div className="w-full h-3.5 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="w-2/3 h-2.5 bg-slate-200 dark:bg-slate-850 rounded" />
        </div>
      </div>
      <div className="w-20 h-7 bg-indigo-100/50 dark:bg-indigo-950/20 border border-indigo-200/40 dark:border-indigo-900/30 rounded-lg" />
    </div>
  );
};
