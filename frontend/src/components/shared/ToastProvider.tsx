// Mediflow — Centralized Toast Notification System
// Production-grade toast provider with queue management, ARIA live regions,
// smooth animations, and auto-dismiss with configurable timeouts.
//
// Usage:
//   const { toast } = useToast();
//   toast.success('Patient registered successfully');
//   toast.error('Failed to sync with database', { title: 'Sync Error' });
//   toast.warning('Lab reagent stock is critically low');
//   toast.info('Realtime connection restored');

import React, { createContext, useContext, useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  title?: string;
  duration?: number;  // ms, default 4500
  persistent?: boolean; // Don't auto-dismiss
}

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  title?: string;
  duration: number;
  persistent: boolean;
  createdAt: number;
}

interface ToastContextValue {
  toast: {
    success: (message: string, options?: ToastOptions) => string;
    error: (message: string, options?: ToastOptions) => string;
    warning: (message: string, options?: ToastOptions) => string;
    info: (message: string, options?: ToastOptions) => string;
    dismiss: (id: string) => void;
    dismissAll: () => void;
  };
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Config ──────────────────────────────────────────────────────────────────

const TOAST_CONFIG: Record<ToastVariant, {
  icon: React.FC<{ className?: string }>;
  bgClass: string;
  borderClass: string;
  iconClass: string;
  titleClass: string;
  textClass: string;
  dotClass: string;
}> = {
  success: {
    icon: ({ className }) => <CheckCircle2 className={className} />,
    bgClass: 'bg-slate-950/95 text-white',
    borderClass: 'border-emerald-500/40 shadow-[0_8px_30px_rgb(0,0,0,0.35)] shadow-emerald-500/10',
    iconClass: 'text-emerald-400',
    titleClass: 'text-emerald-300 font-semibold',
    textClass: 'text-slate-200',
    dotClass: 'bg-emerald-400 shadow-[0_0_8px_#34d399]',
  },
  error: {
    icon: ({ className }) => <XCircle className={className} />,
    bgClass: 'bg-slate-950/95 text-white',
    borderClass: 'border-rose-500/40 shadow-[0_8px_30px_rgb(0,0,0,0.35)] shadow-rose-500/10',
    iconClass: 'text-rose-400',
    titleClass: 'text-rose-300 font-semibold',
    textClass: 'text-slate-200',
    dotClass: 'bg-rose-400 shadow-[0_0_8px_#f43f5e]',
  },
  warning: {
    icon: ({ className }) => <AlertTriangle className={className} />,
    bgClass: 'bg-slate-950/95 text-white',
    borderClass: 'border-amber-500/40 shadow-[0_8px_30px_rgb(0,0,0,0.35)] shadow-amber-500/10',
    iconClass: 'text-amber-400',
    titleClass: 'text-amber-300 font-semibold',
    textClass: 'text-slate-200',
    dotClass: 'bg-amber-400 shadow-[0_0_8px_#fbbf24]',
  },
  info: {
    icon: ({ className }) => <Info className={className} />,
    bgClass: 'bg-slate-950/95 text-white',
    borderClass: 'border-cyan-500/40 shadow-[0_8px_30px_rgb(0,0,0,0.35)] shadow-cyan-500/10',
    iconClass: 'text-cyan-400',
    titleClass: 'text-cyan-300 font-semibold',
    textClass: 'text-slate-200',
    dotClass: 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]',
  },
};

const MAX_VISIBLE = 1; // Strict single-pill display for zero UI clutter
const DEFAULT_DURATION = 2600; // Swift 2.6s auto-dismiss

// Intelligent Noise Gate: drops noisy background automated/telemetry toasts
const NOISE_FILTER_KEYWORDS = [
  'forecast', 'copilot', 'telemetry', 'cache', 'pwa', 'recording started',
  'ping', 'status check', 'template copied', 'draft stored'
];

function isNoisyToast(message: string, title?: string): boolean {
  const text = `${title || ''} ${message || ''}`.toLowerCase();
  return NOISE_FILTER_KEYWORDS.some(kw => text.includes(kw));
}

// ─── Individual Toast Pill Component ──────────────────────────────────────────

function ToastItem({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const config = TOAST_CONFIG[toast.variant];
  const IconComponent = config.icon;
  const [visible, setVisible] = useState(false);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Smooth slide-in
    const showTimeout = setTimeout(() => setVisible(true), 10);

    if (!toast.persistent) {
      dismissRef.current = setTimeout(() => {
        setVisible(false);
        setTimeout(() => onDismiss(toast.id), 250);
      }, toast.duration);
    }

    return () => {
      clearTimeout(showTimeout);
      if (dismissRef.current) clearTimeout(dismissRef.current);
    };
  }, [toast.id, toast.duration, toast.persistent, onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 250);
  };

  return (
    <div
      role="alert"
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={`
        relative flex items-center gap-3 px-4 py-2.5 rounded-full
        ${config.bgClass} ${config.borderClass}
        border backdrop-blur-2xl
        transition-all duration-300 ease-out
        ${visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-3'}
      `}
    >
      {/* Status Dot / Icon */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`w-2 h-2 rounded-full ${config.dotClass} animate-pulse`} />
        <IconComponent className={`h-4 w-4 ${config.iconClass}`} />
      </div>

      {/* Message */}
      <div className="flex items-center gap-2 min-w-0 pr-1">
        {toast.title && (
          <span className={`text-xs ${config.titleClass} shrink-0`}>
            {toast.title}:
          </span>
        )}
        <span className={`text-xs font-medium ${config.textClass} truncate max-w-[280px] sm:max-w-md`}>
          {toast.message}
        </span>
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="shrink-0 p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const lastToastTimeRef = useRef<number>(0);
  const lastToastMsgRef = useRef<string>('');

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const addToast = useCallback((
    message: string,
    variant: ToastVariant,
    options: ToastOptions = {}
  ): string => {
    // 1. Noise Filter Guard
    if (isNoisyToast(message, options.title) && variant !== 'error') {
      return ''; // Drop background automated spam quietly
    }

    // 2. Throttle Guard: Drop duplicate message fired within 2.5s
    const now = Date.now();
    if (lastToastMsgRef.current === message && now - lastToastTimeRef.current < 2500) {
      return '';
    }
    lastToastMsgRef.current = message;
    lastToastTimeRef.current = now;

    const id = `toast-${now}-${Math.random().toString(36).slice(2, 7)}`;
    const item: ToastItem = {
      id,
      message,
      variant,
      title: options.title,
      duration: options.duration ?? DEFAULT_DURATION,
      persistent: options.persistent ?? false,
      createdAt: now,
    };

    setToasts(prev => {
      // Deduplicate: prevent identical messages
      const isDuplicate = prev.some(t => t.message === message);
      if (isDuplicate) return prev;

      // Single visible pill: newest replaces oldest smoothly
      return [item];
    });

    return id;
  }, []);

  useEffect(() => {
    const handleMediflowToast = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string; type?: ToastVariant; title?: string; duration?: number }>;
      if (customEvent.detail && customEvent.detail.message) {
        const variant = customEvent.detail.type || 'info';
        addToast(customEvent.detail.message, variant, {
          title: customEvent.detail.title,
          duration: customEvent.detail.duration
        });
      }
    };
    window.addEventListener('mediflow-toast', handleMediflowToast);
    return () => window.removeEventListener('mediflow-toast', handleMediflowToast);
  }, [addToast]);

  const toast = useMemo(() => ({
    success: (message: string, options?: ToastOptions) => addToast(message, 'success', options),
    error: (message: string, options?: ToastOptions) => addToast(message, 'error', { duration: 4500, ...options }),
    warning: (message: string, options?: ToastOptions) => addToast(message, 'warning', options),
    info: (message: string, options?: ToastOptions) => addToast(message, 'info', options),
    dismiss,
    dismissAll,
  }), [addToast, dismiss, dismissAll]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Ultra-Sleek Floating Pill Stack — Top-Center */}
      <div
        className="fixed top-5 left-1/2 -translate-x-1/2 z-[100000] flex flex-col items-center gap-2 pointer-events-none w-auto max-w-[90vw]"
        aria-label="Notifications"
      >
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>. Wrap your app root with <ToastProvider>.');
  }
  return ctx;
}
