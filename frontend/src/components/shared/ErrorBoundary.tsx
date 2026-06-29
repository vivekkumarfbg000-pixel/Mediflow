import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { StateHealingEngine } from '../../services/autoHealerAgent';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Mediflow Boundary] Unhandled error captured:', error, errorInfo);
    // Send telemetry to the self-healing engine
    StateHealingEngine.handleException(error).catch(err => {
      console.error('[Mediflow Boundary] Failed to send telemetry:', err);
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
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
