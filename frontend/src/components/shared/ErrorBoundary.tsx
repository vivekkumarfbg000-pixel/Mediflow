import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, WifiOff, CloudDownload } from 'lucide-react';
import { StateHealingEngine } from '../../services/autoHealerAgent';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isOfflineChunkMiss: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    isOfflineChunkMiss: false
  };

  private handleOnlineAutoRetry = () => {
    if (this.state.hasError && this.state.isOfflineChunkMiss) {
      console.log('[ErrorBoundary] Connection restored online 🟢 — Auto-recovering clinical module...');
      this.setState({ hasError: false, error: null, isOfflineChunkMiss: false });
    }
  };

  public componentDidMount() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnlineAutoRetry);
    }
  }

  public componentWillUnmount() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnlineAutoRetry);
    }
  }

  public static getDerivedStateFromError(error: Error): State {
    const isChunkLoadError = error.message?.includes('dynamically imported module') ||
                             error.message?.includes('Failed to fetch') ||
                             error.message?.includes('Importing a module script failed') ||
                             error.message?.includes('Loading chunk');
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    return { 
      hasError: true, 
      error,
      isOfflineChunkMiss: isChunkLoadError && isOffline
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Mediflow Boundary] Unhandled error captured:', error, errorInfo);
    
    // Check if error is due to stale JS build chunk after a new deployment
    const isChunkLoadError = error.message?.includes('dynamically imported module') ||
                             error.message?.includes('Failed to fetch') ||
                             error.message?.includes('Importing a module script failed') ||
                             error.message?.includes('Loading chunk');
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isChunkLoadError && !isOffline) {
      let hasReloaded = false;
      try {
        if (typeof window !== 'undefined') {
          hasReloaded = sessionStorage.getItem('vitalsync_chunk_reloaded_guard') === 'true';
        }
      } catch {
        /* ignore storage security restrictions */
      }
      if (!hasReloaded) {
        try {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('vitalsync_chunk_reloaded_guard', 'true');
          }
        } catch {
          /* ignore storage security restrictions */
        }
        console.warn('[ErrorBoundary] Stale JS build chunk detected while online. Executing 1-time cache refresh...');
        const cleanUrl = window.location.origin + window.location.pathname;
        window.location.replace(cleanUrl);
        return;
      }
    }

    // 1. Run Autonomous State Self-Healing to fix any corruptions in localStorage/memory
    StateHealingEngine.autoHealStateCorruptions();

    // 2. Send telemetry log to self-healing engine (if online)
    if (!isOffline) {
      StateHealingEngine.handleException(error).catch(err => {
        console.error('[Mediflow Boundary] Failed to send telemetry:', err);
      });
    }

    // 3. Autonomous Recovery: Auto-reset non-chunk errors after 400ms self-healing
    if (!isChunkLoadError) {
      setTimeout(() => {
        if (this.state.hasError) {
          console.log('[Auto-Healer ErrorBoundary] Autonomous self-recovery triggered 🟢');
          this.setState({ hasError: false, error: null, isOfflineChunkMiss: false });
        }
      }, 400);
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, isOfflineChunkMiss: false });
  };

  public render() {
    if (this.state.hasError) {
      if (this.state.isOfflineChunkMiss) {
        return (
          <div className="p-8 my-6 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-500/20 rounded-3xl space-y-4 max-w-xl mx-auto text-left shadow-sm backdrop-blur-sm animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <WifiOff className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-amber-900 dark:text-amber-300 uppercase tracking-wider font-mono">
                  {this.props.fallbackTitle || 'Module'} • Offline Cache Pending
                </h3>
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                  This clinical desk was not loaded while online to download its offline bundle.
                </p>
              </div>
            </div>
            <div className="p-4 bg-white/80 dark:bg-slate-900/80 border border-amber-200/50 dark:border-amber-500/20 rounded-2xl text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
              <p className="font-semibold mb-1 flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <CloudDownload className="w-3.5 h-3.5" /> Offline Pre-Cache Guide:
              </p>
              Please connect to Wi-Fi/Internet once. Mediflow will automatically download all clinical modules into permanent offline storage. Once cached, you can operate 100% offline indefinitely.
            </div>
            <div className="flex items-center justify-between gap-3 pt-2">
              <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                Listening for Reconnection
              </span>
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer border-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Module
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="p-8 my-4 bg-rose-50/40 border border-rose-100/70 rounded-3xl space-y-4 max-w-xl mx-auto text-left shadow-sm backdrop-blur-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-rose-800 uppercase tracking-wider font-mono">
                {this.props.fallbackTitle || 'Subsystem Outage'}
              </h3>
              <p className="text-xs text-rose-600 font-medium">An unexpected exception occurred in this module.</p>
            </div>
          </div>
          <div className="p-4 bg-white/60 border border-rose-100 rounded-2xl text-[10px] text-slate-650 leading-relaxed font-mono whitespace-pre-wrap max-h-[120px] overflow-y-auto">
            {this.state.error?.message || 'Unknown runtime error'}
          </div>
          <div className="flex items-center justify-between gap-3 pt-2">
            <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest font-mono">
              Auto-Healer Telemetry Dispatched
            </span>
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer border-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Restore View
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
