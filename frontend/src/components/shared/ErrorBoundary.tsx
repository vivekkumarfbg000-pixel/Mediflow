import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { api } from '../../services/api';
import { StateHealingEngine } from '../../services/autoHealerAgent';

interface Props {
  children?: ReactNode;
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
    console.error('[Mediflow Telemetry] Component crashed:', error, errorInfo);
    
    // Log crash asynchronously directly to Supabase activity_logs
    api.writeAuditLog('COMPONENT_CRASH', {
      error_message: error.message || String(error),
      component_stack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    }).catch(err => console.error('Failed to log crash to Supabase:', err));

    // Invoke the Autonomous Healer to flush caches and auto-remount UI
    StateHealingEngine.handleException(error).catch(err => 
      console.error('Failed to invoke auto-healer for component crash:', err)
    );
  }

  // Gap 7 Fix: Auto-healer sends 'mediflow-force-remount' after successful frontend heal.
  // This listener clears the error boundary so the component tree re-mounts automatically.
  private onForceRemount = () => {
    if (this.state.hasError) {
      console.log('[ErrorBoundary] Auto-healer requested force-remount. Recovering UI...');
      this.setState({ hasError: false, error: null });
    }
  };

  public componentDidMount() {
    window.addEventListener('mediflow-force-remount', this.onForceRemount);
  }

  public componentWillUnmount() {
    window.removeEventListener('mediflow-force-remount', this.onForceRemount);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="glass-panel p-8 border-rose-500/20 shadow-2xl relative overflow-hidden max-w-xl mx-auto my-12 text-center animate-fade-in">
          {/* Neon radial glow overlay */}
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />
          
          <div className="w-16 h-16 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-rose-500/5 animate-pulse">
            <AlertCircle className="h-8 w-8 text-rose-400" />
          </div>

          <h2 className="text-xl font-bold text-white tracking-tight mb-2">
            {this.props.fallbackTitle || 'Dashboard Module Offline'}
          </h2>
          
          <p className="text-xs text-clinical-400 mb-6 max-w-sm mx-auto leading-relaxed">
            A runtime error occurred in this workspace block. The system has automatically isolated the failure and recorded diagnostic telemetry.
          </p>

          {this.state.error && (
            <div className="p-4 bg-surface-container-lowest/50 border border-outline-variant/60 rounded-xl mb-6 text-left max-h-32 overflow-y-auto scrollbar-thin">
              <span className="text-[9px] font-bold uppercase tracking-wider font-mono text-rose-400 block mb-1">
                Exception Diagnostics
              </span>
              <code className="text-[10px] text-clinical-300 font-mono break-all leading-normal">
                {this.state.error.message}
              </code>
            </div>
          )}

          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500/90 to-primary/90 hover:from-rose-500 hover:to-primary text-white font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-primary/10 hover:shadow-primary/20 active:scale-95 transition-all text-xs cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reload Workspace Module
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
