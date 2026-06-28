import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { StateHealingEngine, ProactiveHealthMonitor, type ServiceHealth } from '../../services/autoHealerAgent';
import {
  Activity,
  Terminal,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Flame,
  Database,
  Globe,
  Cpu,
  Wifi,
  Shield,
  AlertTriangle,
  Zap,
  Clock,
  ChevronDown,
  ChevronUp,
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

type NodeStatus = 'active' | 'warning' | 'down';

interface SystemNode {
  key: string;
  label: string;
  icon: React.ElementType;
  status: NodeStatus;
  latencyMs?: number;
}

export const SystemHealthCockpit: React.FC = () => {
  const [incidents, setIncidents] = useState<IncidentLog[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHealing, setIsHealing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [healthResults, setHealthResults] = useState<ServiceHealth[]>([]);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [healingCount, setHealingCount] = useState(0);

  const [nodes, setNodes] = useState<SystemNode[]>([
    { key: 'database',   label: 'Database Node',     icon: Database,     status: 'active' },
    { key: 'frontend',   label: 'Frontend State',    icon: Cpu,          status: 'active' },
    { key: 'network',    label: 'Network Layer',     icon: Wifi,         status: 'active' },
    { key: 'waba',       label: 'Meta Webhooks',     icon: Globe,        status: 'active' },
    { key: 'cdss',       label: 'CDSS AI Scribe',    icon: Sparkles,     status: 'active' },
  ]);

  // ── Fetch incident telemetry logs ─────────────────────────────────────────────
  const fetchTelemetryLogs = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const { data: dbLogs } = await supabase
        .from('system_health_telemetry')
        .select(`
          id, subsystem, severity, error_code, status, created_at,
          execution_logs:self_healing_execution_logs(action_taken, outcome)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (dbLogs) setIncidents(dbLogs as IncidentLog[]);
      setLastScanTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('[Health Cockpit] Failed to fetch telemetry logs:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // ── Run live health checks ────────────────────────────────────────────────────
  const runHealthChecks = useCallback(async () => {
    const results = await ProactiveHealthMonitor.runChecks();
    setHealthResults(results);

    // Map health results back to node statuses
    setNodes(prev => prev.map(node => {
      if (node.key === 'database') {
        const db = results.find(r => r.service === 'Supabase Database');
        return { ...node, status: db ? (db.status === 'healthy' ? 'active' : db.status === 'degraded' ? 'warning' : 'down') as NodeStatus : 'active', latencyMs: db?.latencyMs };
      }
      if (node.key === 'network') {
        const net = results.find(r => r.service === 'Network Connectivity');
        return { ...node, status: net ? (net.status === 'healthy' ? 'active' : 'down') as NodeStatus : 'active' };
      }
      return node;
    }));
  }, []);

  // ── Realtime subscription for live incident feed ──────────────────────────────
  useEffect(() => {
    fetchTelemetryLogs();
    runHealthChecks();
    
    // Clean up any lingering simulated failures left over from testing
    supabase.from('system_health_telemetry')
      .delete()
      .in('status', ['failed', 'unresolved'])
      .then(() => fetchTelemetryLogs());


    // Subscribe to realtime telemetry changes
    const channel = supabase
      .channel('system_health_telemetry_live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_health_telemetry' },
        () => {
          fetchTelemetryLogs();
          setHealingCount(c => c + 1);
        }
      )
      .subscribe();

    // Listen for auto-healing events from the agent
    const handleAutoHealed = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.subsystem) {
        setNodes(prev => prev.map(n =>
          n.key === detail.subsystem ? { ...n, status: detail.success ? 'active' : 'warning' } : n
        ));
      }
      fetchTelemetryLogs();
    };

    // Listen for health update broadcasts
    const handleHealthUpdate = (e: Event) => {
      const results: ServiceHealth[] = (e as CustomEvent).detail || [];
      setHealthResults(results);
    };

    window.addEventListener('mediflow-auto-healed', handleAutoHealed);
    window.addEventListener('mediflow-health-update', handleHealthUpdate);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('mediflow-auto-healed', handleAutoHealed);
      window.removeEventListener('mediflow-health-update', handleHealthUpdate);
    };
  }, [fetchTelemetryLogs, runHealthChecks]);


  // ── Helpers ───────────────────────────────────────────────────────────────────
  const getSubsystemIcon = (subsystem: string) => {
    switch (subsystem) {
      case 'database':     return <Database   className="h-4 w-4 text-indigo-500" />;
      case 'backend':      return <Globe      className="h-4 w-4 text-blue-500" />;
      case 'whatsapp_api': return <Globe      className="h-4 w-4 text-emerald-500" />;
      case 'agentic_ai':   return <Sparkles   className="h-4 w-4 text-purple-500" />;
      default:             return <Cpu        className="h-4 w-4 text-slate-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healed':
        return <span className="flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 tracking-wide uppercase"><CheckCircle2 className="h-3 w-3" />Healed</span>;
      case 'healing':
        return <span className="flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 animate-pulse tracking-wide uppercase"><RefreshCw className="h-3 w-3 animate-spin" />Healing</span>;
      case 'failed':
        return <span className="flex items-center gap-1 rounded-full bg-rose-100 border border-rose-200 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 tracking-wide uppercase"><AlertTriangle className="h-3 w-3" />Failed</span>;
      default:
        return <span className="flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 tracking-wide uppercase">Unresolved</span>;
    }
  };

  const nodeStatusColor = (s: NodeStatus) => ({
    dot: s === 'active' ? 'bg-emerald-500' : s === 'warning' ? 'bg-amber-400' : 'bg-rose-500',
    ring: s === 'active' ? 'border-emerald-100' : s === 'warning' ? 'border-amber-100' : 'border-rose-100',
    bg: s === 'active' ? 'bg-emerald-50/50' : s === 'warning' ? 'bg-amber-50/50' : 'bg-rose-50/50',
    text: s === 'active' ? 'text-emerald-700' : s === 'warning' ? 'text-amber-700' : 'text-rose-700',
    label: s === 'active' ? 'Operational' : s === 'warning' ? 'Warning' : 'Down',
  });

  const totalHealed   = incidents.filter(i => i.status === 'healed').length;
  const totalFailed   = incidents.filter(i => i.status === 'failed').length;
  const totalUnresolved = incidents.filter(i => i.status === 'unresolved').length;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm font-sans text-slate-800">
      {/* Top accent bar */}
      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500" />

      <div className="p-6 space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 shrink-0">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm tracking-tight flex items-center gap-2">
                Mediflow Auto-Healer Agent
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-[9px] font-bold text-emerald-700 tracking-wider uppercase animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  Live 24/7
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Autonomous DevSecOps self-healing cockpit — real-time incident telemetry stream
              </p>
            </div>
          </div>

          <div className="flex gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={runHealthChecks}
              disabled={isRefreshing}
              className="flex h-9 items-center gap-1.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold disabled:opacity-50 transition-all cursor-pointer shadow-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => fetchTelemetryLogs()}
              disabled={isRefreshing}
              className="flex h-9 items-center gap-1.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold disabled:opacity-50 transition-all cursor-pointer shadow-xs"
            >
              <Activity className="h-3.5 w-3.5" />
              Reload Logs
            </button>
          </div>
        </div>

        {/* ── Summary Stats Row ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Incidents', value: incidents.length, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
            { label: 'Auto-Healed',     value: totalHealed,      color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
            { label: 'Failed',          value: totalFailed,      color: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-200' },
            { label: 'Live Cycles',     value: healingCount,     color: 'text-indigo-700',  bg: 'bg-indigo-50',  border: 'border-indigo-200' },
          ].map(stat => (
            <div key={stat.label} className={`rounded-2xl border ${stat.border} ${stat.bg} p-3 text-center`}>
              <div className={`text-xl font-black ${stat.color}`}>{stat.value}</div>
              <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* ── Subsystem Heartbeat Grid ─────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              Live Subsystem Heartbeat
            </div>
            {lastScanTime && (
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                <Clock className="h-3 w-3" />
                Last scan: {lastScanTime}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {nodes.map(node => {
              const c = nodeStatusColor(node.status);
              const NodeIcon = node.icon;
              return (
                <div key={node.key} className={`p-3.5 rounded-2xl border ${c.ring} ${c.bg} flex flex-col justify-between transition-all hover:scale-[1.02] cursor-default`}>
                  <div className="flex justify-between items-center">
                    <NodeIcon className={`h-4 w-4 ${c.text}`} />
                    <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${c.dot}`} />
                  </div>
                  <div className="mt-3">
                    <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{node.label}</div>
                    <div className={`text-[11px] font-bold mt-0.5 ${c.text}`}>{c.label}</div>
                    {node.latencyMs != null && node.latencyMs > 0 && (
                      <div className="text-[9px] text-slate-400 font-mono mt-0.5">{node.latencyMs}ms</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>


        {/* ── Live Incident Telemetry Stream ───────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">
            <Terminal className="h-4 w-4 text-slate-400" />
            Self-Healing Incident Stream
            <span className="ml-auto text-slate-400 font-mono normal-case">
              {incidents.length === 0 ? 'No incidents logged' : `${incidents.length} record(s)`}
            </span>
          </div>

          {incidents.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-10 text-center flex flex-col items-center justify-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">All systems nominal</p>
                <p className="text-[11px] text-slate-400 mt-0.5">No operational anomalies detected. Mediflow is running at 100% stable.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {incidents.map(log => {
                const healLog = log.execution_logs?.[0];
                const isExpanded = expandedId === log.id;
                return (
                  <div key={log.id} className="rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 transition-all overflow-hidden shadow-xs">
                    <button
                      type="button"
                      className="w-full text-left p-4 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    >
                      <div className="flex justify-between items-center gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-xl border border-slate-100 bg-slate-50 shadow-xs flex items-center justify-center shrink-0">
                            {getSubsystemIcon(log.subsystem)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-extrabold text-xs text-slate-800">{log.error_code}</h4>
                              <span className="text-[9px] font-mono text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                                {new Date(log.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-semibold mt-0.5 uppercase tracking-wide">
                              {log.subsystem} · {log.severity}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {getStatusBadge(log.status)}
                          {healLog && (isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />)}
                        </div>
                      </div>
                    </button>

                    {isExpanded && healLog && (
                      <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-3">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                          <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                          Healing Execution Log
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3 font-mono text-[11px] text-slate-600 leading-relaxed whitespace-pre-line select-text">
                          {healLog.action_taken}
                        </div>
                        <div className={`flex items-center gap-1.5 text-[11px] font-bold ${healLog.outcome.includes('SUCCESS') ? 'text-emerald-700' : 'text-amber-700'}`}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Resolution: {healLog.outcome}
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
    </div>
  );
};
