import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { StateHealingEngine } from '../../services/autoHealerAgent';
import { 
  Activity, 
  Terminal, 
  Sparkles, 
  CheckCircle2, 
  RefreshCw, 
  Flame, 
  Database, 
  Globe, 
  Cpu 
} from 'lucide-react';

interface IncidentLog {
  id: string;
  subsystem: string;
  severity: string;
  error_code: string;
  status: string;
  created_at: string;
  execution_logs?: {
    action_taken: string;
    outcome: string;
  }[];
}

export const SystemHealthCockpit: React.FC = () => {
  const [incidents, setIncidents] = useState<IncidentLog[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nodes, setNodes] = useState({
    database: 'active',
    frontend: 'active',
    deno: 'active',
    waba: 'active',
    scribe: 'active'
  });

  // Pull incident telemetry logs from database
  const fetchTelemetryLogs = async () => {
    setIsRefreshing(true);
    try {
      const { data: dbLogs } = await supabase
        .from('system_health_telemetry')
        .select(`
          id,
          subsystem,
          severity,
          error_code,
          status,
          created_at,
          execution_logs:self_healing_execution_logs(action_taken, outcome)
        `)
        .order('created_at', { ascending: false })
        .limit(6);
      
      if (dbLogs) {
        setIncidents(dbLogs as any[]);
      }
    } catch (err) {
      console.error('[Health Cockpit] Failed to fetch telemetry logs:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTelemetryLogs();
    
    // Listen to local auto-healing triggers to automatically reload logs
    const handleAutoHealed = () => {
      fetchTelemetryLogs();
    };

    window.addEventListener('mediflow-auto-healed', handleAutoHealed);
    return () => window.removeEventListener('mediflow-auto-healed', handleAutoHealed);
  }, []);

  const triggerFaultInjection = async () => {
    // Generate simulated local storage state corruption error
    const simulatedError = new Error('CRITICAL State drift caught: Corrupted localStorage cache key path in reagents volume array');
    simulatedError.name = 'StateDriftException';
    
    setNodes(prev => ({ ...prev, frontend: 'warning' }));
    
    // Fire to the Auto-Healing agent
    await StateHealingEngine.handleException(simulatedError);
    
    setTimeout(() => {
      setNodes(prev => ({ ...prev, frontend: 'active' }));
      fetchTelemetryLogs();
    }, 800);
  };

  const getSubsystemIcon = (subsystem: string) => {
    switch (subsystem) {
      case 'database': return <Database className="h-4 w-4 text-indigo-400" />;
      case 'backend': return <Globe className="h-4 w-4 text-blue-400" />;
      default: return <Cpu className="h-4 w-4 text-emerald-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healed':
        return (
          <span className="flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-bold text-emerald-400 tracking-wider uppercase">
            Healed
          </span>
        );
      case 'healing':
        return (
          <span className="flex items-center gap-1 rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[9px] font-bold text-amber-400 animate-pulse tracking-wider uppercase">
            Healing
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 rounded bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[9px] font-bold text-rose-400 tracking-wider uppercase">
            Unresolved
          </span>
        );
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm font-sans text-slate-800 space-y-6">
      {/* Top visual accents */}
      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 opacity-60" />

      {/* Header telemetry details */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 shadow-sm shadow-emerald-500/5">
            <Activity className="h-5.5 w-5.5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
              Mediflow Auto-Healer Dashboard 
              <span className="flex items-center gap-1 rounded bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[9px] font-bold text-emerald-600 tracking-wider uppercase animate-pulse">
                Online 24/7
              </span>
            </h3>
            <p className="text-[11px] text-slate-600 font-medium">Proactive DevSecOps telemetry monitor & self-healing cockpit.</p>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchTelemetryLogs}
            disabled={isRefreshing}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 disabled:opacity-50 transition-all cursor-pointer"
            title="Reload telemetry logs"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            type="button"
            onClick={triggerFaultInjection}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-white text-white hover:bg-slate-800 text-xs font-bold px-4 border border-slate-200 transition-all shadow-md shadow-slate-950/10 cursor-pointer"
          >
            <Flame className="h-3.5 w-3.5 text-rose-400 fill-current" />
            <span>Simulate Fault Injection</span>
          </button>
        </div>
      </div>

      {/* Subsystem Heartbeat Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Database Node', key: 'database', icon: Database, color: 'bg-indigo-500 border-indigo-500/20' },
          { label: 'Frontend State', key: 'frontend', icon: Cpu, color: 'bg-emerald-500 border-emerald-500/20' },
          { label: 'Deno Edge Chal.', key: 'deno', icon: Globe, color: 'bg-blue-500 border-blue-500/20' },
          { label: 'Meta Webhooks', key: 'waba', icon: CheckCircle2, color: 'bg-teal-500 border-teal-500/20' },
          { label: 'CDSS AI Scribe', key: 'scribe', icon: Sparkles, color: 'bg-purple-500 border-purple-500/20' }
        ].map(node => {
          const val = (nodes as any)[node.key];
          const isWarning = val === 'warning';
          const NodeIcon = node.icon;
          return (
            <div key={node.label} className={`p-3.5 rounded-2xl border bg-slate-50/50 flex flex-col justify-between transition-all hover:scale-[1.02] shadow-xs cursor-pointer ${isWarning ? 'border-amber-200' : 'border-slate-100'}`}>
              <div className="flex justify-between items-center">
                <NodeIcon className={`h-4.5 w-4.5 ${isWarning ? 'text-amber-500 animate-pulse' : 'text-slate-500'}`} />
                <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${isWarning ? 'bg-amber-400' : 'bg-emerald-500'}`} />
              </div>
              <div className="mt-3.5">
                <div className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">{node.label}</div>
                <div className="text-xs font-bold text-slate-700 mt-0.5 tracking-tight">{isWarning ? 'Warning' : 'Operational'}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Incident logs and Healing executions stream */}
      <div className="space-y-3.5">
        <div className="flex items-center gap-2 text-slate-600 pl-1 font-bold text-[10px] uppercase tracking-wider">
          <Terminal className="h-4 w-4" />
          <span>Self-Healing Action Incident Logs</span>
        </div>

        {incidents.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-slate-50/20 p-8 text-center text-slate-600 flex flex-col items-center justify-center gap-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500/60" />
            <p className="text-xs font-semibold">No operational anomalies logged. Mediflow is running at 100% stable.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {incidents.map(log => {
              const healLog = log.execution_logs?.[0];
              return (
                <div key={log.id} className="relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/40 p-4 transition-all hover:border-slate-200/80">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-start gap-2.5">
                      <div className="h-7 w-7 rounded-lg border border-slate-200 bg-white shadow-xs flex items-center justify-center shrink-0">
                        {getSubsystemIcon(log.subsystem)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-xs text-slate-700 tracking-tight">{log.error_code}</h4>
                          <span className="text-[9px] font-mono text-slate-600">{new Date(log.created_at).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider mt-0.5">Subsystem: {log.subsystem} | Severity: {log.severity}</p>
                      </div>
                    </div>
                    {getStatusBadge(log.status)}
                  </div>

                  {healLog && (
                    <div className="mt-3.5 pt-3 border-t border-slate-200/50 text-[11px] font-mono text-slate-500 leading-relaxed bg-white/5 p-3 rounded-xl border border-slate-200/20 select-none">
                      <div className="text-[9px] font-extrabold text-slate-600 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-emerald-500 fill-current animate-pulse" /> Healing telemetry logs
                      </div>
                      <div className="whitespace-pre-line text-slate-600 font-sans">{healLog.action_taken}</div>
                      <div className="mt-2 text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 fill-current" /> Resolution Outcome: {healLog.outcome}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
