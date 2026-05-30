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

import React, { createContext, useContext, useCallback, useState, useRef, useEffect } from 'react';
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
  barClass: string;
}> = {
  success: {
    icon: ({ className }) => <CheckCircle2 className={className} />,
    bgClass: 'bg-emerald-950/90',
    borderClass: 'border-emerald-500/30',
    iconClass: 'text-emerald-400',
    titleClass: 'text-emerald-100',
    textClass: 'text-emerald-300/80',
    barClass: 'bg-emerald-500',
  },
  error: {
    icon: ({ className }) => <XCircle className={className} />,
    bgClass: 'bg-rose-950/90',
    borderClass: 'border-rose-500/30',
    iconClass: 'text-rose-400',
    titleClass: 'text-rose-100',
    textClass: 'text-rose-300/80',
    barClass: 'bg-rose-500',
  },
  warning: {
    icon: ({ className }) => <AlertTriangle className={className} />,
    bgClass: 'bg-amber-950/90',
    borderClass: 'border-amber-500/30',
    iconClass: 'text-amber-400',
    titleClass: 'text-amber-100',
    textClass: 'text-amber-300/80',
    barClass: 'bg-amber-500',
  },
  info: {
    icon: ({ className }) => <Info className={className} />,
    bgClass: 'bg-indigo-950/90',
    borderClass: 'border-indigo-500/30',
    iconClass: 'text-indigo-400',
    titleClass: 'text-indigo-100',
    textClass: 'text-indigo-300/80',
    barClass: 'bg-indigo-500',
  },
};

const MAX_VISIBLE = 4;
const DEFAULT_DURATION = 4500;

// ─── Individual Toast Component ───────────────────────────────────────────────

function ToastItem({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const config = TOAST_CONFIG[toast.variant];
  const IconComponent = config.icon;
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const progressRef = useRef<number | null>(null);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Slide in
    const showTimeout = setTimeout(() => setVisible(true), 10);

    if (!toast.persistent) {
      // Progress bar countdown
      const startTime = Date.now();
      const tick = () => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 100 - (elapsed / toast.duration) * 100);
        setProgress(remaining);
        if (remaining > 0) {
          progressRef.current = requestAnimationFrame(tick);
        }
      };
      progressRef.current = requestAnimationFrame(tick);

      // Auto dismiss
      dismissRef.current = setTimeout(() => {
        setVisible(false);
        setTimeout(() => onDismiss(toast.id), 300);
      }, toast.duration);
    }

    return () => {
      clearTimeout(showTimeout);
      if (progressRef.current) cancelAnimationFrame(progressRef.current);
      if (dismissRef.current) clearTimeout(dismissRef.current);
    };
  }, [toast.id, toast.duration, toast.persistent, onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  return (
    <div
      role="alert"
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={`
        relative flex items-start gap-3 p-4 rounded-2xl
        ${config.bgClass} ${config.borderClass}
        border backdrop-blur-xl shadow-xl shadow-black/20
        transition-all duration-300 ease-out overflow-hidden
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}
      `}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <IconComponent className={`h-5 w-5 ${config.iconClass}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className={`text-sm font-semibold tracking-wide leading-tight mb-0.5 ${config.titleClass}`}>
            {toast.title}
          </p>
        )}
        <p className={`text-xs leading-relaxed font-medium ${config.textClass}`}>
          {toast.message}
        </p>
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-150"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Progress bar (bottom edge) */}
      {!toast.persistent && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5 rounded-b-2xl overflow-hidden">
          <div
            className={`h-full ${config.barClass} transition-none`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

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
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const item: ToastItem = {
      id,
      message,
      variant,
      title: options.title,
      duration: options.duration ?? DEFAULT_DURATION,
      persistent: options.persistent ?? false,
      createdAt: Date.now(),
    };

    setToasts(prev => {
      // Cap at MAX_VISIBLE — remove oldest if at capacity
      const next = [...prev, item];
      return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
    });

    return id;
  }, []);

  const toast = {
    success: (message: string, options?: ToastOptions) => addToast(message, 'success', options),
    error: (message: string, options?: ToastOptions) => addToast(message, 'error', { duration: 6000, ...options }),
    warning: (message: string, options?: ToastOptions) => addToast(message, 'warning', options),
    info: (message: string, options?: ToastOptions) => addToast(message, 'info', options),
    dismiss,
    dismissAll,
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast stack — fixed top-right corner */}
      <div
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 w-full max-w-sm pointer-events-none"
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
