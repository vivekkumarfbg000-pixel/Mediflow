// Mediflow — Premium Dark-Mode Empty State System
// Context-aware zero-data states that feel intentionally designed,
// not unrendered. Each variant has a unique icon, gradient glow, and
// contextual description matched to the clinical workspace.
//
// NEW in this version:
//   - Full dark-mode surface (panel-card + panel-surface-inner)
//   - Animated icon glow ring tuned per variant
//   - .alert-subgrid-compatible inline empty states
//   - InlineEmptyState for compact list zero-states (replaces raw text)
//   - ZeroQueueState — specialised for patient/lab queue empty view

import React from 'react';
import {
  Users, FlaskConical, Package, FileText, MessageSquare,
  TrendingUp, ClipboardList, Stethoscope, AlertTriangle,
  Wifi, DatabaseZap, RefreshCw, Plus, TestTube2,
  Syringe, Calendar, CreditCard, Bot, ShieldOff
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  variant: EmptyStateVariant;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** If true, renders with dark panel-card surface instead of transparent bg */
  surfaced?: boolean;
}

export type EmptyStateVariant =
  | 'patients'
  | 'encounters'
  | 'lab_requisitions'
  | 'pharmacy_inventory'
  | 'invoices'
  | 'whatsapp_sessions'
  | 'forecasts'
  | 'search_results'
  | 'error'
  | 'offline'
  | 'no_permission'
  | 'coming_soon'
  | 'queue_clear'
  | 'no_medications'
  | 'no_appointments'
  | 'no_surgeries'
  | 'no_lab_results'
  | 'no_billing'
  | 'ai_not_ready';

// ─── Variant Config ───────────────────────────────────────────────────────────

interface VariantConfig {
  Icon: React.FC<{ className?: string; size?: number; strokeWidth?: number }>;
  defaultTitle: string;
  defaultDescription: string;
  // Dark-mode icon ring gradient
  glowClass: string;
  iconClass: string;
  // Light-mode icon bg
  iconBgLight: string;
  iconColorLight: string;
}

const VARIANT_CONFIG: Record<EmptyStateVariant, VariantConfig> = {
  patients: {
    Icon: Users,
    defaultTitle: 'No Patients Registered',
    defaultDescription: 'Use the registration form to add a new patient to the care loop.',
    glowClass: 'from-violet-500/20 to-violet-900/5',
    iconClass: 'text-violet-400 dark:text-violet-400',
    iconBgLight: 'bg-violet-100',
    iconColorLight: 'text-violet-600',
  },
  encounters: {
    Icon: Stethoscope,
    defaultTitle: 'No Active Encounters',
    defaultDescription: 'Patient encounters routed by the compounder will appear here.',
    glowClass: 'from-indigo-500/20 to-indigo-900/5',
    iconClass: 'text-indigo-400',
    iconBgLight: 'bg-indigo-100',
    iconColorLight: 'text-indigo-600',
  },
  lab_requisitions: {
    Icon: FlaskConical,
    defaultTitle: 'No Pending Lab Tests',
    defaultDescription: 'Diagnostic requisitions from the doctor\'s desk will appear here.',
    glowClass: 'from-emerald-500/20 to-emerald-900/5',
    iconClass: 'text-emerald-400',
    iconBgLight: 'bg-emerald-100',
    iconColorLight: 'text-emerald-600',
  },
  pharmacy_inventory: {
    Icon: Package,
    defaultTitle: 'Inventory Empty',
    defaultDescription: 'Add medicines using the bulk CSV import or manual entry form.',
    glowClass: 'from-amber-500/20 to-amber-900/5',
    iconClass: 'text-amber-400',
    iconBgLight: 'bg-amber-100',
    iconColorLight: 'text-amber-600',
  },
  invoices: {
    Icon: FileText,
    defaultTitle: 'No Invoices Yet',
    defaultDescription: 'Unified bills will appear after consultations are settled.',
    glowClass: 'from-sky-500/20 to-sky-900/5',
    iconClass: 'text-sky-400',
    iconBgLight: 'bg-sky-100',
    iconColorLight: 'text-sky-600',
  },
  whatsapp_sessions: {
    Icon: MessageSquare,
    defaultTitle: 'No Active WhatsApp Sessions',
    defaultDescription: 'Patient bot sessions start when the compounder initiates the care loop.',
    glowClass: 'from-green-500/20 to-green-900/5',
    iconClass: 'text-green-400',
    iconBgLight: 'bg-green-100',
    iconColorLight: 'text-green-600',
  },
  forecasts: {
    Icon: TrendingUp,
    defaultTitle: 'No AI Forecasts Generated',
    defaultDescription: 'Click "Generate Forecast" to run the seasonal demand prediction engine.',
    glowClass: 'from-purple-500/20 to-purple-900/5',
    iconClass: 'text-purple-400',
    iconBgLight: 'bg-purple-100',
    iconColorLight: 'text-purple-600',
  },
  search_results: {
    Icon: ClipboardList,
    defaultTitle: 'No Results Found',
    defaultDescription: 'Try adjusting your search term or filter criteria.',
    glowClass: 'from-slate-500/15 to-slate-900/5',
    iconClass: 'text-slate-400',
    iconBgLight: 'bg-slate-100',
    iconColorLight: 'text-slate-500',
  },
  error: {
    Icon: AlertTriangle,
    defaultTitle: 'Something Went Wrong',
    defaultDescription: 'An unexpected error occurred. Please try refreshing or contact support.',
    glowClass: 'from-rose-500/20 to-rose-900/5',
    iconClass: 'text-rose-400',
    iconBgLight: 'bg-rose-100',
    iconColorLight: 'text-rose-600',
  },
  offline: {
    Icon: Wifi,
    defaultTitle: 'Working Offline',
    defaultDescription: 'No internet connection. Showing cached data. Changes will sync when reconnected.',
    glowClass: 'from-orange-500/20 to-orange-900/5',
    iconClass: 'text-orange-400',
    iconBgLight: 'bg-orange-100',
    iconColorLight: 'text-orange-500',
  },
  no_permission: {
    Icon: ShieldOff,
    defaultTitle: 'Access Restricted',
    defaultDescription: 'Your role does not have permission to view this section.',
    glowClass: 'from-rose-500/20 to-rose-900/5',
    iconClass: 'text-rose-400',
    iconBgLight: 'bg-rose-100',
    iconColorLight: 'text-rose-600',
  },
  coming_soon: {
    Icon: DatabaseZap,
    defaultTitle: 'Coming Soon',
    defaultDescription: 'This feature is under development and will be available shortly.',
    glowClass: 'from-indigo-500/20 to-indigo-900/5',
    iconClass: 'text-indigo-400',
    iconBgLight: 'bg-indigo-100',
    iconColorLight: 'text-indigo-600',
  },
  queue_clear: {
    Icon: TestTube2,
    defaultTitle: 'Queue is Clear',
    defaultDescription: 'All pending draws have been processed. No further action required.',
    glowClass: 'from-teal-500/20 to-teal-900/5',
    iconClass: 'text-teal-400',
    iconBgLight: 'bg-teal-100',
    iconColorLight: 'text-teal-600',
  },
  no_medications: {
    Icon: Syringe,
    defaultTitle: 'No Medications Prescribed',
    defaultDescription: 'Add medications using the prescription pad when a patient is selected.',
    glowClass: 'from-cyan-500/20 to-cyan-900/5',
    iconClass: 'text-cyan-400',
    iconBgLight: 'bg-cyan-100',
    iconColorLight: 'text-cyan-600',
  },
  no_appointments: {
    Icon: Calendar,
    defaultTitle: 'No Appointments Today',
    defaultDescription: 'Appointments booked via WhatsApp or the clinic portal will appear here.',
    glowClass: 'from-blue-500/20 to-blue-900/5',
    iconClass: 'text-blue-400',
    iconBgLight: 'bg-blue-100',
    iconColorLight: 'text-blue-600',
  },
  no_surgeries: {
    Icon: Stethoscope,
    defaultTitle: 'No Surgeries Scheduled',
    defaultDescription: 'Surgical cases will appear here once listed by the doctor.',
    glowClass: 'from-slate-500/15 to-slate-900/5',
    iconClass: 'text-slate-400',
    iconBgLight: 'bg-slate-100',
    iconColorLight: 'text-slate-500',
  },
  no_lab_results: {
    Icon: FlaskConical,
    defaultTitle: 'No Lab Results Yet',
    defaultDescription: 'Processed pathology results will appear here after lab technician sign-off.',
    glowClass: 'from-emerald-500/20 to-emerald-900/5',
    iconClass: 'text-emerald-400',
    iconBgLight: 'bg-emerald-100',
    iconColorLight: 'text-emerald-600',
  },
  no_billing: {
    Icon: CreditCard,
    defaultTitle: 'No Pending Bills',
    defaultDescription: 'Billing invoices from completed consultations will appear here.',
    glowClass: 'from-violet-500/20 to-violet-900/5',
    iconClass: 'text-violet-400',
    iconBgLight: 'bg-violet-100',
    iconColorLight: 'text-violet-600',
  },
  ai_not_ready: {
    Icon: Bot,
    defaultTitle: 'AI Advisory Not Yet Generated',
    defaultDescription: 'Select a patient and run the clinical analysis to get AI insights.',
    glowClass: 'from-indigo-500/20 to-indigo-900/5',
    iconClass: 'text-indigo-400',
    iconBgLight: 'bg-indigo-100',
    iconColorLight: 'text-indigo-600',
  },
};

const SIZE_CONFIG = {
  xs: { wrapper: 'py-5 px-3',  icon: 18, iconContainer: 'w-10 h-10 rounded-xl', title: 'text-[11px]', desc: 'text-[10px]', gap: 'gap-2.5' },
  sm: { wrapper: 'py-8 px-4',  icon: 22, iconContainer: 'w-14 h-14 rounded-2xl', title: 'text-xs',     desc: 'text-[11px]', gap: 'gap-3' },
  md: { wrapper: 'py-12 px-5', icon: 28, iconContainer: 'w-18 h-18 rounded-2xl', title: 'text-sm',     desc: 'text-xs',     gap: 'gap-3.5' },
  lg: { wrapper: 'py-16 px-6', icon: 34, iconContainer: 'w-24 h-24 rounded-3xl', title: 'text-base',   desc: 'text-sm',     gap: 'gap-4' },
};

// ─── Main EmptyState Component ────────────────────────────────────────────────

export function EmptyState({
  variant,
  title,
  description,
  action,
  size = 'md',
  surfaced = false,
}: EmptyStateProps) {
  const config = VARIANT_CONFIG[variant];
  const sz = SIZE_CONFIG[size];
  const Icon = config.Icon;

  const content = (
    <div
      className={`flex flex-col items-center justify-center text-center ${sz.wrapper} ${sz.gap}`}
      role="status"
      aria-label={title ?? config.defaultTitle}
    >
      {/* Icon with layered glow */}
      <div className="relative flex items-center justify-center mb-1">
        {/* Diffuse background glow — dark mode only */}
        <div
          className={`absolute inset-0 scale-[2] rounded-full bg-gradient-radial ${config.glowClass} blur-2xl opacity-0 dark:opacity-100 pointer-events-none`}
        />
        {/* Icon container */}
        <div
          className={`
            relative z-10 flex items-center justify-center ${sz.iconContainer}
            bg-white/5 dark:bg-white/[0.04]
            border border-white/10 dark:border-white/[0.07]
            shadow-inner
            ${config.iconBgLight} dark:bg-transparent
          `}
        >
          <Icon
            className={`${config.iconColorLight} dark:${config.iconClass}`}
            size={sz.icon}
            strokeWidth={1.5}
          />
        </div>
      </div>

      {/* Title */}
      <h3
        className={`font-bold text-slate-800 dark:text-slate-300 tracking-tight leading-tight ${sz.title}`}
      >
        {title ?? config.defaultTitle}
      </h3>

      {/* Description */}
      <p
        className={`text-slate-500 dark:text-slate-600 leading-relaxed max-w-[22ch] font-medium ${sz.desc}`}
      >
        {description ?? config.defaultDescription}
      </p>

      {/* Action CTA */}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all duration-200 border-0"
        >
          {action.icon ?? <Plus size={13} />}
          {action.label}
        </button>
      )}
    </div>
  );

  if (surfaced) {
    return (
      <div className="panel-card w-full">
        {content}
      </div>
    );
  }

  return content;
}

// ─── InlineEmptyState — replaces raw text strings in compact lists ─────────────
// Use instead of: <p className="text-xs text-slate-500">No pending draws. Queue is clear ✓</p>

interface InlineEmptyStateProps {
  icon?: string;  // material-symbols-outlined icon name
  label: string;
  sublabel?: string;
  variant?: 'neutral' | 'success' | 'warning';
  className?: string;
}

export function InlineEmptyState({
  icon = 'check_circle',
  label,
  sublabel,
  variant = 'neutral',
  className = '',
}: InlineEmptyStateProps) {
  const colorMap = {
    neutral: {
      container: 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-white/[0.05]',
      icon:      'text-slate-400 dark:text-slate-600',
      label:     'text-slate-500 dark:text-slate-500',
      sublabel:  'text-slate-400 dark:text-slate-600',
    },
    success: {
      container: 'bg-emerald-50/60 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/20',
      icon:      'text-emerald-500 dark:text-emerald-600',
      label:     'text-emerald-700 dark:text-emerald-500',
      sublabel:  'text-emerald-500 dark:text-emerald-700',
    },
    warning: {
      container: 'bg-amber-50/60 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/20',
      icon:      'text-amber-500 dark:text-amber-600',
      label:     'text-amber-700 dark:text-amber-500',
      sublabel:  'text-amber-500 dark:text-amber-700',
    },
  };

  const c = colorMap[variant];

  return (
    <div
      className={`flex flex-col items-center justify-center gap-1.5 py-4 px-4 rounded-xl border ${c.container} ${className}`}
      role="status"
    >
      <span className={`material-symbols-outlined text-2xl ${c.icon}`}>{icon}</span>
      <p className={`text-[11px] font-semibold tracking-wide uppercase text-center leading-tight ${c.label}`}>
        {label}
      </p>
      {sublabel && (
        <p className={`text-[10px] font-medium text-center leading-snug max-w-[26ch] ${c.sublabel}`}>
          {sublabel}
        </p>
      )}
    </div>
  );
}

// ─── ZeroQueueState — for lab draw / patient queue empty views ─────────────────
// Direct replacement for "No pending draws. Queue is clear ✔️" text nodes.

interface ZeroQueueStateProps {
  queueType: 'lab_draws' | 'patient_queue' | 'appointments' | 'prescriptions' | 'billing' | 'lab_orders';
  className?: string;
}

const QUEUE_CONFIGS: Record<ZeroQueueStateProps['queueType'], {
  icon: string;
  label: string;
  sublabel: string;
}> = {
  lab_draws: {
    icon: 'science',
    label: 'Queue is Clear',
    sublabel: 'All pending draws have been processed.',
  },
  patient_queue: {
    icon: 'groups',
    label: 'No Patients in Queue',
    sublabel: 'Patients registered by the compounder will appear here.',
  },
  appointments: {
    icon: 'event_available',
    label: 'No Appointments Today',
    sublabel: 'Bookings via WhatsApp or portal will appear here.',
  },
  prescriptions: {
    icon: 'medication',
    label: 'No Pending Prescriptions',
    sublabel: 'Prescriptions awaiting payment will appear here.',
  },
  billing: {
    icon: 'receipt_long',
    label: 'No Pending Bills',
    sublabel: 'Bills from completed consultations will appear here.',
  },
  lab_orders: {
    icon: 'biotech',
    label: 'No Lab Orders',
    sublabel: 'Doctor-requested test requisitions will appear here.',
  },
};

export function ZeroQueueState({ queueType, className = '' }: ZeroQueueStateProps) {
  const cfg = QUEUE_CONFIGS[queueType];
  return (
    <InlineEmptyState
      icon={cfg.icon}
      label={cfg.label}
      sublabel={cfg.sublabel}
      variant="success"
      className={className}
    />
  );
}

// ─── Convenience wrappers (backward-compatible) ───────────────────────────────

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  return (
    <EmptyState
      variant="error"
      description={message}
      action={onRetry ? { label: 'Retry', onClick: onRetry, icon: <RefreshCw size={13} /> } : undefined}
      size="md"
    />
  );
}

export function OfflineState() {
  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50">
      <div className="flex items-center gap-3 px-4 py-3 bg-orange-950/90 border border-orange-500/30 backdrop-blur-xl rounded-2xl shadow-xl">
        <Wifi size={16} className="text-orange-400 flex-shrink-0 animate-pulse" />
        <div>
          <p className="text-xs font-bold text-orange-100">Working Offline</p>
          <p className="text-xs text-orange-300/70 font-medium">Showing cached data. Will sync when reconnected.</p>
        </div>
      </div>
    </div>
  );
}
