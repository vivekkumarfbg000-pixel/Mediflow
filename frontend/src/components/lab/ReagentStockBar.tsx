import React from 'react';

// =============================================================================
// ReagentStockBar — Defensive volumetric stock bar for lab reagents
// Handles null telemetry, zero stock, and normal volume states gracefully.
// Prevents NaN%, broken bars, or empty renders from invalid analyzer readings.
// =============================================================================

export type ReagentStatus = 'normal' | 'low' | 'critical' | 'empty' | 'awaiting' | 'error';

interface ReagentStockBarProps {
  /** Reagent display name */
  label: string;
  /** Current volume in mL — null/undefined = awaiting telemetry */
  currentVolume: number | null | undefined;
  /** Maximum capacity in mL */
  maxVolume: number;
  /** Unit label (default: 'mL') */
  unit?: string;
  /** Low threshold % (default: 25) */
  lowThreshold?: number;
  /** Critical threshold % (default: 10) */
  criticalThreshold?: number;
  /** Optional: last telemetry timestamp */
  lastUpdated?: string | null;
}

function getStatus(
  current: number | null | undefined,
  max: number,
  lowPct: number,
  critPct: number
): ReagentStatus {
  if (current === null || current === undefined) return 'awaiting';
  if (typeof current !== 'number' || isNaN(current)) return 'error';
  if (current <= 0) return 'empty';
  const pct = (current / max) * 100;
  if (pct <= critPct) return 'critical';
  if (pct <= lowPct) return 'low';
  return 'normal';
}

const STATUS_CONFIG: Record<
  ReagentStatus,
  { barColor: string; labelColor: string; badgeColor: string; badgeText: string }
> = {
  normal: {
    barColor: 'bg-emerald-500',
    labelColor: 'text-emerald-600 dark:text-emerald-400',
    badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    badgeText: 'OK',
  },
  low: {
    barColor: 'bg-amber-400',
    labelColor: 'text-amber-600 dark:text-amber-400',
    badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    badgeText: 'Low',
  },
  critical: {
    barColor: 'bg-rose-500',
    labelColor: 'text-rose-600 dark:text-rose-400',
    badgeColor: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    badgeText: 'Critical',
  },
  empty: {
    barColor: 'bg-rose-700',
    labelColor: 'text-rose-700 dark:text-rose-400',
    badgeColor: 'bg-rose-200 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
    badgeText: 'Empty',
  },
  awaiting: {
    barColor: 'bg-slate-300 dark:bg-slate-700',
    labelColor: 'text-slate-400 dark:text-slate-500',
    badgeColor: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    badgeText: 'Awaiting',
  },
  error: {
    barColor: 'bg-purple-400',
    labelColor: 'text-purple-600 dark:text-purple-400',
    badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    badgeText: 'Error',
  },
};

export const ReagentStockBar: React.FC<ReagentStockBarProps> = React.memo(({
  label,
  currentVolume,
  maxVolume,
  unit = 'mL',
  lowThreshold = 25,
  criticalThreshold = 10,
  lastUpdated,
}) => {
  const status = getStatus(currentVolume, maxVolume, lowThreshold, criticalThreshold);
  const config = STATUS_CONFIG[status];

  // Safe percentage — never NaN, never > 100
  const safeMax = maxVolume > 0 ? maxVolume : 1;
  const pct = status === 'awaiting' || status === 'error'
    ? 0
    : Math.min(100, Math.max(0, ((currentVolume ?? 0) / safeMax) * 100));

  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="space-y-1.5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">
          {label}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {formattedTime && (
            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">
              {formattedTime}
            </span>
          )}
          <span className={`text-[8px] font-bold font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full ${config.badgeColor}`}>
            {config.badgeText}
          </span>
        </div>
      </div>

      {/* Bar track */}
      <div className="relative h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        {status === 'awaiting' || status === 'error' ? (
          // Animated pulse skeleton for pending/error telemetry
          <div className="absolute inset-0 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-pulse rounded-full" />
        ) : (
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${config.barColor}`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>

      {/* Volume label */}
      <div className={`text-[9px] font-mono ${config.labelColor}`}>
        {status === 'awaiting' && (
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[11px] animate-spin">sync</span>
            Awaiting Telemetry...
          </span>
        )}
        {status === 'error' && (
          <span className="flex items-center gap-1 text-purple-500 dark:text-purple-400">
            <span className="material-symbols-outlined text-[11px]">error</span>
            Invalid analyzer reading
          </span>
        )}
        {status === 'empty' && (
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[11px]">warning</span>
            Empty — Refill Required
          </span>
        )}
        {(status === 'normal' || status === 'low' || status === 'critical') && (
          <span>
            {currentVolume?.toFixed(1)} / {maxVolume} {unit}
            <span className="ml-1 opacity-60">({pct.toFixed(0)}%)</span>
          </span>
        )}
      </div>
    </div>
  );
});

ReagentStockBar.displayName = 'ReagentStockBar';

// ─── Companion: ReagentStockGrid ──────────────────────────────────────────────
// Renders a grid of reagent bars from a data array with full null-safety.

export interface ReagentItem {
  id: string;
  label: string;
  currentVolume: number | null | undefined;
  maxVolume: number;
  unit?: string;
  lastUpdated?: string | null;
}

interface ReagentStockGridProps {
  reagents: ReagentItem[];
  lowThreshold?: number;
  criticalThreshold?: number;
  className?: string;
}

export const ReagentStockGrid: React.FC<ReagentStockGridProps> = React.memo(({
  reagents,
  lowThreshold = 25,
  criticalThreshold = 10,
  className = '',
}) => {
  if (!reagents || reagents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400 dark:text-slate-600">
        <span className="material-symbols-outlined text-3xl">science</span>
        <p className="text-xs font-medium">No reagents configured</p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${className}`}>
      {reagents.map((r) => (
        <ReagentStockBar
          key={r.id}
          label={r.label}
          currentVolume={r.currentVolume}
          maxVolume={r.maxVolume}
          unit={r.unit}
          lastUpdated={r.lastUpdated}
          lowThreshold={lowThreshold}
          criticalThreshold={criticalThreshold}
        />
      ))}
    </div>
  );
});

ReagentStockGrid.displayName = 'ReagentStockGrid';
