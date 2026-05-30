// Mediflow — Professional Empty State Components
// Context-aware zero-data illustrations for each dashboard section.
// Prevents blank/confusing UI when tables or lists have no data.

import React from 'react';
import {
  Users, FlaskConical, Package, FileText, MessageSquare,
  TrendingUp, ClipboardList, Stethoscope, AlertTriangle,
  Wifi, DatabaseZap, RefreshCw, Plus
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
  size?: 'sm' | 'md' | 'lg';
}

type EmptyStateVariant =
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
  | 'coming_soon';

// ─── Variant Config ───────────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<EmptyStateVariant, {
  Icon: React.FC<{ className?: string }>;
  defaultTitle: string;
  defaultDescription: string;
  iconBg: string;
  iconColor: string;
}> = {
  patients: {
    Icon: ({ className }) => <Users className={className} />,
    defaultTitle: 'No Patients Registered',
    defaultDescription: 'Use the registration form to add a new patient to the care loop.',
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
  },
  encounters: {
    Icon: ({ className }) => <Stethoscope className={className} />,
    defaultTitle: 'No Active Encounters',
    defaultDescription: 'Patient encounters routed by the compounder will appear here.',
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
  },
  lab_requisitions: {
    Icon: ({ className }) => <FlaskConical className={className} />,
    defaultTitle: 'No Pending Lab Tests',
    defaultDescription: 'Diagnostic requisitions from the doctor\'s desk will appear here.',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
  },
  pharmacy_inventory: {
    Icon: ({ className }) => <Package className={className} />,
    defaultTitle: 'Inventory Empty',
    defaultDescription: 'Add medicines using the bulk CSV import or manual entry form.',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  invoices: {
    Icon: ({ className }) => <FileText className={className} />,
    defaultTitle: 'No Invoices Yet',
    defaultDescription: 'Unified bills will appear here after consultations are settled.',
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
  },
  whatsapp_sessions: {
    Icon: ({ className }) => <MessageSquare className={className} />,
    defaultTitle: 'No Active WhatsApp Sessions',
    defaultDescription: 'Patient bot sessions start when the compounder initiates the care loop.',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
  },
  forecasts: {
    Icon: ({ className }) => <TrendingUp className={className} />,
    defaultTitle: 'No AI Forecasts Generated',
    defaultDescription: 'Click "Generate Forecast" to run the seasonal demand prediction engine.',
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
  },
  search_results: {
    Icon: ({ className }) => <ClipboardList className={className} />,
    defaultTitle: 'No Results Found',
    defaultDescription: 'Try adjusting your search term or filter criteria.',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-500',
  },
  error: {
    Icon: ({ className }) => <AlertTriangle className={className} />,
    defaultTitle: 'Something Went Wrong',
    defaultDescription: 'An unexpected error occurred. Please try refreshing or contact support.',
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-600',
  },
  offline: {
    Icon: ({ className }) => <Wifi className={className} />,
    defaultTitle: 'Working Offline',
    defaultDescription: 'No internet connection. Showing cached data. Changes will sync when reconnected.',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
  },
  no_permission: {
    Icon: ({ className }) => <DatabaseZap className={className} />,
    defaultTitle: 'Access Restricted',
    defaultDescription: 'Your role does not have permission to view this section.',
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-600',
  },
  coming_soon: {
    Icon: ({ className }) => <TrendingUp className={className} />,
    defaultTitle: 'Coming Soon',
    defaultDescription: 'This feature is under development and will be available shortly.',
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
  },
};

const SIZE_CONFIG = {
  sm: { wrapper: 'py-8', icon: 'h-10 w-10', iconContainer: 'w-16 h-16', title: 'text-sm', desc: 'text-xs' },
  md: { wrapper: 'py-12', icon: 'h-12 w-12', iconContainer: 'w-20 h-20', title: 'text-base', desc: 'text-sm' },
  lg: { wrapper: 'py-16', icon: 'h-14 w-14', iconContainer: 'w-24 h-24', title: 'text-lg', desc: 'text-sm' },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function EmptyState({
  variant,
  title,
  description,
  action,
  size = 'md',
}: EmptyStateProps) {
  const config = VARIANT_CONFIG[variant];
  const sizeConfig = SIZE_CONFIG[size];
  const Icon = config.Icon;

  return (
    <div className={`flex flex-col items-center justify-center text-center ${sizeConfig.wrapper} px-6`} role="status">
      {/* Icon container with subtle gradient ring */}
      <div className="relative mb-5">
        <div
          className={`${sizeConfig.iconContainer} ${config.iconBg} rounded-2xl flex items-center justify-center shadow-sm`}
        >
          <Icon className={`${sizeConfig.icon} ${config.iconColor}`} />
        </div>
        {/* Subtle glow ring */}
        <div className={`absolute inset-0 rounded-2xl ${config.iconBg} opacity-40 blur-lg scale-110`} />
      </div>

      {/* Text */}
      <h3 className={`font-bold text-slate-800 tracking-tight mb-2 ${sizeConfig.title}`}>
        {title ?? config.defaultTitle}
      </h3>
      <p className={`text-slate-500 leading-relaxed max-w-xs font-medium ${sizeConfig.desc}`}>
        {description ?? config.defaultDescription}
      </p>

      {/* Action button */}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all duration-200"
        >
          {action.icon ?? <Plus className="h-4 w-4" />}
          {action.label}
        </button>
      )}
    </div>
  );
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export function ErrorState({
  onRetry,
  message,
}: {
  onRetry?: () => void;
  message?: string;
}) {
  return (
    <EmptyState
      variant="error"
      description={message}
      action={onRetry ? { label: 'Retry', onClick: onRetry, icon: <RefreshCw className="h-4 w-4" /> } : undefined}
      size="md"
    />
  );
}

export function OfflineState() {
  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50">
      <div className="flex items-center gap-3 px-4 py-3 bg-orange-950/90 border border-orange-500/30 backdrop-blur-xl rounded-2xl shadow-xl">
        <Wifi className="h-4 w-4 text-orange-400 flex-shrink-0 animate-pulse" />
        <div>
          <p className="text-xs font-bold text-orange-100">Working Offline</p>
          <p className="text-xs text-orange-300/70 font-medium">Showing cached data. Will sync when reconnected.</p>
        </div>
      </div>
    </div>
  );
}
