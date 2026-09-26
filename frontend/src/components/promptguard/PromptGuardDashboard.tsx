import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bug, Camera, Cpu, Copy, Check, Zap, Loader2, Shield,
  GitBranch, Database, Network, AlertTriangle, RotateCcw,
  ChevronRight, Terminal, BookOpen, Search, Brain,
  Activity, FlaskConical, CheckCircle2, XCircle, Radio,
  Save, Trash2, Eye, Power
} from 'lucide-react';

const DAEMON = 'http://localhost:9000';

interface ConfidenceBreakdown { label: string; points: number; }
interface Confidence { score: number; grade: string; breakdown: ConfidenceBreakdown[]; }
interface DiagnosticsMeta { ragFilesCount: number; blastRadiusCount: number; pastFixesCount: number; hallucinationRisk: number; snippetsExtracted: number; consoleErrorsCaptured: number; }
interface ShadowCompile { passed: boolean; errors: string[]; summary: string; }
interface MemoryFix { id: string; timestamp: string; bugDescription: string; rootCause: string; solution: string; filesModified: string[]; tags: string[]; }
interface ConsoleEntry { level: string; message: string; url?: string; receivedAt?: string; timestamp?: string; }
interface TestResult { passed: boolean; passCount: number; failCount: number; summary: string; output: string; }

const BUG_TEMPLATES = [
  { id: 'ui', label: 'UI Bug', icon: '🎨', desc: 'Layout broken, element missing, wrong styles', prompt: 'UI Bug: [Describe what looks wrong visually]. The component appears in the [screen/tab] at [location]. Expected behavior: [what should happen]. Actual behavior: [what I see].' },
  { id: 'auth', label: 'Auth Error', icon: '🔐', desc: 'Login fails, session drops, role wrong', prompt: 'Auth Bug: The user [cannot login / gets logged out / sees wrong role dashboard]. Console error: [paste error]. Steps: 1. [what was done] 2. [what happened].' },
  { id: 'crash', label: 'App Crash', icon: '💥', desc: 'White screen, React error boundary', prompt: 'Fatal Crash: The app shows a white screen / error boundary on [which route / action]. Console error: [paste stack trace]. The crash happens when [specific action].' },
  { id: 'data', label: 'Data Not Showing', icon: '📊', desc: 'Patient list empty, queue not updating', prompt: 'Data Bug: [What data] is not appearing in [which console/tab]. The [table/list] appears empty but there are records in Supabase. Last seen working: [when]. CDC subscription: [active/inactive].' },
  { id: 'payment', label: 'Payment Issue', icon: '💳', desc: 'Invoice wrong, gateway error, fee calculation', prompt: 'Payment Bug: [Invoice amount / fee calculation / gateway error]. Expected total: ₹[amount]. Actual total: ₹[amount]. Payment method: [UPI/Cash/PhonePe]. Error in console: [paste error].' },
  { id: 'whatsapp', label: 'WhatsApp Issue', icon: '💬', desc: 'Message not sent, webhook error, bot broken', prompt: 'WhatsApp Bug: Messages are [not sending / sending wrong content / not triggering]. The Meta webhook [is / is not] receiving events. Error in edge function logs: [paste error]. Patient phone: [masked number].' },
];

const PREFLIGHT_CHECKS = [
  { id: 'screenshot', label: 'Screenshot / screen recording uploaded', required: true },
  { id: 'description', label: 'Bug described in plain language', required: true },
  { id: 'steps', label: 'Steps to reproduce included', required: false },
  { id: 'console', label: 'Console error message noted or captured', required: false },
  { id: 'safe_state', label: 'GitOps Safety Snapshot created', required: true },
  { id: 'daemon', label: 'Daemon Bridge is ONLINE', required: true },
];

export const PromptGuardDashboard: React.FC = () => {
  const [daemonStatus, setDaemonStatus] = useState<'online' | 'offline'>('offline');
  const [engineMeta, setEngineMeta] = useState<Record<string, string>>({});
  const [bugDescription, setBugDescription] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [diagnosticsMeta, setDiagnosticsMeta] = useState<DiagnosticsMeta | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [activeTab, setActiveTab] = useState<'triage' | 'console' | 'compile' | 'memory' | 'gitops' | 'e2e' | 'network' | 'queue'>('triage');
  const [bugQueue, setBugQueue] = useState<{id: string, desc: string, severity: string}[]>([]);
  const [queueInput, setQueueInput] = useState('');
  const [queueSeverity, setQueueSeverity] = useState('P2');
  const [compileResult, setCompileResult] = useState<ShadowCompile | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [memoryFixes, setMemoryFixes] = useState<MemoryFix[]>([]);
  const [memoryQuery, setMemoryQuery] = useState('');
  const [blastFile, setBlastFile] = useState('');
  const [blastResult, setBlastResult] = useState<any>(null);
  const [isBlasting, setIsBlasting] = useState(false);
  const [safeStateMsg, setSafeStateMsg] = useState('');
  const [isSavingState, setIsSavingState] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [consoleErrors, setConsoleErrors] = useState<ConsoleEntry[]>([]);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [preflight, setPreflight] = useState<Record<string, boolean>>({});
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [saveFixForm, setSaveFixForm] = useState({ rootCause: '', solution: '', filesModified: '', tags: '' });
  const [isSavingFix, setIsSavingFix] = useState(false);
  const [saveFixMsg, setSaveFixMsg] = useState('');
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // ─── Daemon Health Ping ───

  const addToQueue = () => {
    if (!queueInput.trim()) return;
    setBugQueue(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), desc: queueInput.trim(), severity: queueSeverity }]);
    setQueueInput('');
  };
  
  const generateBatchPrompt = async () => {
    if (bugQueue.length === 0) return;
    setIsGenerating(true);
    setGeneratedPrompt('');
    
    // Simple batch format
    const batchDesc = "BATCH FIX SESSIONS:\n" + bugQueue.map(b => `[${b.severity}] ${b.desc}`).join("\n");
    setBugDescription(batchDesc);
    setActiveTab('triage');
    setIsGenerating(false);
    // Note: For full effect, the user would then click "Generate Surgical Prompt" in Triage tab.
  };

  const pingDaemon = useCallback(async () => {
    try {
      const r = await fetch(`${DAEMON}/health`);
      if (r.ok) {
        const d = await r.json();
        setDaemonStatus('online');
        setEngineMeta(d.engines || {});
        setPreflight(prev => ({ ...prev, daemon: true }));
      } else {
        setDaemonStatus('offline');
        setPreflight(prev => ({ ...prev, daemon: false }));
      }
    } catch {
      setDaemonStatus('offline');
      setPreflight(prev => ({ ...prev, daemon: false }));
    }
  }, []);

  useEffect(() => {
    pingDaemon();
    const i = setInterval(pingDaemon, 8000);
    return () => clearInterval(i);
  }, [pingDaemon]);

  // ─── SSE Console Stream ───
  useEffect(() => {
    if (daemonStatus === 'online' && !eventSourceRef.current) {
      // Load initial errors
      fetch(`${DAEMON}/api/console-errors`)
        .then(r => r.json())
        .then(d => setConsoleErrors(d.errors || []))
        .catch(() => {});
      // Connect SSE
      const es = new EventSource(`${DAEMON}/api/console-stream`);
      es.onmessage = (e) => {
        try {
          const entry: ConsoleEntry = JSON.parse(e.data);
          if (entry.level) {
            setConsoleErrors(prev => {
              const next = [...prev, entry].slice(-100);
              return next;
            });
            setTimeout(() => consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          }
        } catch {}
      };
      eventSourceRef.current = es;
    }
    if (daemonStatus === 'offline' && eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    return () => {};
  }, [daemonStatus]);

  // ─── Auto-fill from ErrorBoundary crash ───
  useEffect(() => {
    const autoBug = localStorage.getItem('promptguard_auto_bug');
    if (autoBug) {
      setBugDescription(autoBug);
      localStorage.removeItem('promptguard_auto_bug');
    }
  }, []);

  // ─── Load Memory ───
  useEffect(() => {
    fetch(`${DAEMON}/api/memory`).then(r => r.json()).then(d => setMemoryFixes(d.results || [])).catch(() => {});
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setPreflight(prev => ({ ...prev, screenshot: true }));
      };
      reader.readAsDataURL(file);
    }
  };

  const startDaemon = async () => {
    try {
      setDaemonStatus('online');
      await fetch('/api/start-daemon');
    } catch (err) {
      console.error('Failed to start daemon', err);
      setDaemonStatus('offline');
    }
  };

  const applyTemplate = (t: typeof BUG_TEMPLATES[0]) => {
    setSelectedTemplate(t.id);
    setBugDescription(t.prompt);
    setPreflight(prev => ({ ...prev, description: true }));
  };

  const preflightScore = Object.values(preflight).filter(Boolean).length;
  const preflightTotal = PREFLIGHT_CHECKS.filter(c => c.required).length;

  const generateDiagnosticReport = async () => {
    if (!bugDescription.trim()) return;
    setIsGenerating(true);
    setGeneratedPrompt('');
    setDiagnosticsMeta(null);
    setConfidence(null);
    try {
      const r = await fetch(`${DAEMON}/api/diagnostics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bugDescription, windowSize: `${window.innerWidth}x${window.innerHeight}`, hasImage: !!imagePreview })
      });
      if (!r.ok) throw new Error('Daemon rejected');
      const data = await r.json();
      setGeneratedPrompt(data.prompt);
      setDiagnosticsMeta(data.metadata);
      setConfidence(data.confidence);
      // ENGINE 16: Auto-clipboard
      navigator.clipboard.writeText(data.prompt).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      });
    } catch (err) {
      setGeneratedPrompt(`⚠️ Could not reach J.A.R.V.I.S. Daemon Bridge.\n\nStart it with:\n  node frontend/scripts/daemon-bridge.cjs\n\nError: ${err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const runShadowCompile = async () => {
    setIsCompiling(true);
    setCompileResult(null);
    try {
      const r = await fetch(`${DAEMON}/api/shadow-compile`, { method: 'POST' });
      setCompileResult(await r.json());
    } catch {
      setCompileResult({ passed: false, errors: ['Cannot reach Daemon Bridge'], summary: '🚨 Daemon offline' });
    } finally {
      setIsCompiling(false);
    }
  };

  const runBlastRadius = async () => {
    if (!blastFile.trim()) return;
    setIsBlasting(true);
    setBlastResult(null);
    try {
      const r = await fetch(`${DAEMON}/api/blast-radius?file=${encodeURIComponent(blastFile.trim())}`);
      setBlastResult(await r.json());
    } catch {
      setBlastResult({ error: 'Cannot reach Daemon Bridge' });
    } finally {
      setIsBlasting(false);
    }
  };

  const queryMemory = async () => {
    const q = memoryQuery.trim();
    const u = q ? `${DAEMON}/api/memory?q=${encodeURIComponent(q)}` : `${DAEMON}/api/memory`;
    try {
      const r = await fetch(u);
      const d = await r.json();
      setMemoryFixes(d.results || []);
    } catch {}
  };

  const saveFixToMemory = async () => {
    if (!bugDescription.trim() || !saveFixForm.rootCause.trim()) return;
    setIsSavingFix(true);
    setSaveFixMsg('');
    try {
      const r = await fetch(`${DAEMON}/api/memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bugDescription,
          rootCause: saveFixForm.rootCause,
          solution: saveFixForm.solution,
          filesModified: saveFixForm.filesModified.split(',').map(s => s.trim()).filter(Boolean),
          tags: saveFixForm.tags.split(',').map(s => s.trim()).filter(Boolean)
        })
      });
      const d = await r.json();
      setSaveFixMsg(`✅ Fix saved! Memory Vault now has ${d.totalFixes} fix(es).`);
      setSaveFixForm({ rootCause: '', solution: '', filesModified: '', tags: '' });
    } catch {
      setSaveFixMsg('⚠️ Could not save. Daemon offline?');
    } finally {
      setIsSavingFix(false);
    }
  };

  const createSafeState = async () => {
    setIsSavingState(true);
    setSafeStateMsg('');
    try {
      const r = await fetch(`${DAEMON}/api/safe-state`, { method: 'POST' });
      const d = await r.json();
      setSafeStateMsg(d.message || 'Snapshot created.');
      setPreflight(prev => ({ ...prev, safe_state: true }));
    } catch {
      setSafeStateMsg('⚠️ Could not create snapshot. Daemon offline?');
    } finally {
      setIsSavingState(false);
    }
  };

  const rollback = async () => {
    setIsRollingBack(true);
    setSafeStateMsg('');
    try {
      const r = await fetch(`${DAEMON}/api/safe-state`, { method: 'DELETE' });
      const d = await r.json();
      setSafeStateMsg(d.message || 'Rolled back.');
    } catch {
      setSafeStateMsg('⚠️ Rollback failed. Daemon offline?');
    } finally {
      setIsRollingBack(false);
    }
  };

  const runE2ETests = async () => {
    setIsRunningTests(true);
    setTestResult(null);
    try {
      const r = await fetch(`${DAEMON}/api/run-tests`, { method: 'POST' });
      setTestResult(await r.json());
    } catch {
      setTestResult({ passed: false, passCount: 0, failCount: 1, summary: '⚠️ Could not reach Daemon Bridge', output: '' });
    } finally {
      setIsRunningTests(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedPrompt);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const TABS = [
    { id: 'triage', label: 'Bug Triage', icon: <Bug className="w-4 h-4" /> },
    { id: 'queue', label: 'Multi-Bug Queue', icon: <Database className="w-4 h-4" /> },
    { id: 'console', label: 'Console Stream', icon: <Radio className="w-4 h-4" />, badge: consoleErrors.filter(e => e.level === 'error').length || undefined },
    { id: 'compile', label: 'Shadow Compile', icon: <Shield className="w-4 h-4" /> },
    { id: 'e2e', label: 'E2E Tests', icon: <FlaskConical className="w-4 h-4" /> },
    { id: 'memory', label: 'Memory Vault', icon: <Brain className="w-4 h-4" />, badge: memoryFixes.length || undefined },
    { id: 'gitops', label: 'GitOps Sentinel', icon: <GitBranch className="w-4 h-4" /> },
  ] as const;

  // Confidence color
  const confColor = !confidence ? 'text-slate-400' : confidence.score >= 85 ? 'text-emerald-400' : confidence.score >= 65 ? 'text-amber-400' : confidence.score >= 40 ? 'text-orange-400' : 'text-rose-400';
  const confBg = !confidence ? 'bg-slate-800' : confidence.score >= 85 ? 'bg-emerald-500' : confidence.score >= 65 ? 'bg-amber-500' : confidence.score >= 40 ? 'bg-orange-500' : 'bg-rose-500';

  return (
    <div className="min-h-screen bg-[#060a14] text-slate-200 font-sans">
      {/* HEADER */}
      <div className="border-b border-slate-800/80 bg-[#070c18]/95 backdrop-blur-sm sticky top-0 z-50 shadow-xl shadow-black/20">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Cpu className="w-6 h-6 text-white" />
              </div>
              {daemonStatus === 'online' && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-[#070c18] shadow-[0_0_8px_rgba(52,211,153,0.8)]" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">J.A.R.V.I.S.</h1>
                <span className="text-[9px] font-black bg-gradient-to-r from-indigo-500/20 to-violet-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full tracking-widest">v5.0</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">17-Engine Anti-Hallucination Supercomputer</p>
            </div>
          </div>

          {/* Engine Pills */}
          <div className="hidden lg:flex items-center gap-3 bg-slate-900/40 border border-slate-800/60 px-4 py-2 rounded-2xl">
            {[
              { icon: <Network className="w-3 h-3" />, label: 'Dep Graph', color: 'text-cyan-400' },
              { icon: <Shield className="w-3 h-3" />, label: 'Shadow Compiler', color: 'text-emerald-400' },
              { icon: <Brain className="w-3 h-3" />, label: 'Memory Vault', color: 'text-violet-400' },
              { icon: <GitBranch className="w-3 h-3" />, label: 'GitOps', color: 'text-amber-400' },
              { icon: <Eye className="w-3 h-3" />, label: 'Anti-Hallucination', color: 'text-rose-400' },
              { icon: <Activity className="w-3 h-3" />, label: 'Confidence Score', color: 'text-sky-400' },
              { icon: <Radio className="w-3 h-3" />, label: 'Console Stream', color: 'text-pink-400' },
              { icon: <FlaskConical className="w-3 h-3" />, label: 'E2E Runner', color: 'text-teal-400' },
              { icon: <Terminal className="w-3 h-3" />, label: 'Code Extractor', color: 'text-orange-400' },
            ].map((e, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className={e.color}>{e.icon}</span>
                <span className="text-[9px] font-bold text-slate-500 hidden xl:block">{e.label}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${daemonStatus === 'online' ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.7)]' : 'bg-slate-700'}`} />
              </div>
            ))}
          </div>

          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black shrink-0 ${
            daemonStatus === 'online'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-400 animate-pulse'
          }`}>
            <span className={`w-2 h-2 rounded-full ${daemonStatus === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            {daemonStatus === 'online' ? '17 ENGINES ONLINE' : 'START DAEMON BRIDGE'}
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-[1600px] mx-auto px-6 flex gap-0.5 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer relative ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700'
              }`}
            >
              {tab.icon}
              {tab.label}
              {'badge' in tab && tab.badge && tab.badge > 0 && (
                <span className={`absolute -top-1 right-1 min-w-[16px] h-4 px-1 text-[9px] font-black rounded-full flex items-center justify-center ${activeTab === tab.id ? 'bg-rose-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-8">

        {/* ═══ TAB 1: BUG TRIAGE (SIMPLIFIED & ADVANCED) ═══ */}
        {activeTab === 'triage' && (
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Quick Templates Pills */}
            <div className="flex flex-wrap gap-2">
              {BUG_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                    selectedTemplate === t.id
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                      : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="text-sm">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Main Input Box (Unified Chat Style) */}
            <div className={`bg-slate-900/40 border transition-all duration-300 rounded-3xl overflow-hidden shadow-2xl focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 ${imagePreview ? 'border-indigo-500/30 shadow-indigo-500/10' : 'border-slate-800 shadow-black/40'}`}>
              
              {/* Image Preview Area */}
              {imagePreview && (
                <div className="relative h-40 bg-[#03050a] border-b border-slate-800">
                  <img src={imagePreview} alt="Evidence" className="w-full h-full object-contain p-2 opacity-80" />
                  <button onClick={() => setImagePreview(null)} className="absolute top-3 right-3 bg-rose-500/20 border border-rose-500/50 text-rose-400 p-1.5 rounded-full hover:bg-rose-500/40 transition-colors cursor-pointer">
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              )}

              <textarea
                value={bugDescription}
                onChange={e => setBugDescription(e.target.value)}
                placeholder="Describe the bug clearly, paste a console error, or explain what went wrong..."
                className="w-full min-h-[220px] bg-transparent p-6 text-sm text-slate-200 placeholder-slate-600 leading-relaxed outline-none resize-none"
              />

              {/* Action Footer */}
              <div className="flex items-center justify-between px-5 py-4 bg-slate-950/60 border-t border-slate-800/80">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer transition-colors border border-transparent hover:border-slate-700">
                    <Camera className="w-4 h-4" />
                    <span className="hidden sm:inline">{imagePreview ? 'Change Evidence' : 'Attach Screenshot'}</span>
                    <input type="file" accept="image/*,video/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                  <div className="h-5 w-px bg-slate-800" />
                  {daemonStatus === 'online' ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Daemon Ready
                    </div>
                  ) : (
                    <button onClick={startDaemon} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 transition-colors cursor-pointer shadow-[0_0_15px_rgba(244,63,94,0.15)]">
                      <Power className="w-3.5 h-3.5" />
                      Start Daemon
                    </button>
                  )}
                </div>

                <button
                  onClick={generateDiagnosticReport}
                  disabled={isGenerating || !bugDescription.trim()}
                  className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.97] cursor-pointer text-sm"
                >
                  {isGenerating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing 17 Engines...</>
                  ) : (
                    <><Zap className="w-4 h-4 text-amber-300" /> Generate Prompt</>
                  )}
                </button>
              </div>
            </div>

            {/* Generated Prompt Output */}
            {generatedPrompt && (
              <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out pt-6">
                <div className="bg-[#050810] border border-emerald-500/30 rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(16,185,129,0.08)]">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                        <Terminal className="w-4 h-4 text-emerald-400" />
                      </div>
                      <span className="text-sm font-black text-white tracking-wide">SURGICAL STRIKE PROMPT GENERATED</span>
                    </div>
                    <button onClick={copyToClipboard} className="flex items-center gap-2 px-5 py-2 bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 rounded-xl text-xs font-bold hover:bg-emerald-500/25 transition-all cursor-pointer shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20">
                      {isCopied ? <><Check className="w-4 h-4" /> Copied to Clipboard</> : <><Copy className="w-4 h-4" /> Copy Prompt</>}
                    </button>
                  </div>

                  <div className="p-6 relative group">
                    <textarea
                      readOnly
                      value={generatedPrompt}
                      className="w-full min-h-[350px] bg-transparent text-[13px] font-mono text-emerald-400/90 leading-relaxed outline-none resize-none selection:bg-emerald-500/30 custom-scrollbar"
                    />
                  </div>

                  {/* Sleek Diagnostics Footer */}
                  {diagnosticsMeta && (
                    <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center gap-6 text-xs font-mono text-slate-500">
                      <div className="flex items-center gap-2">
                        <Activity className={`w-4 h-4 ${confidence?.score && confidence.score >= 85 ? 'text-emerald-400' : 'text-amber-400'}`} />
                        Confidence: <span className="text-slate-300 font-bold">{confidence?.score}%</span>
                      </div>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                      <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-sky-400" />
                        RAG Hits: <span className="text-slate-300 font-bold">{diagnosticsMeta.ragFilesCount}</span>
                      </div>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-rose-400" />
                        Blast Radius: <span className="text-slate-300 font-bold">{diagnosticsMeta.blastRadiusCount} files</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Optional Save to Memory */}
                <div className="mt-6 p-5 bg-violet-950/20 border border-violet-500/20 rounded-2xl flex items-center justify-between shadow-lg shadow-violet-500/5 hover:border-violet-500/40 transition-colors">
                   <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                       <Brain className="w-5 h-5 text-violet-400" />
                     </div>
                     <div>
                       <p className="text-sm font-bold text-white">Save this fix to the Memory Vault?</p>
                       <p className="text-[11px] text-slate-500 mt-0.5">Document the root cause so J.A.R.V.I.S never hallucinates this bug again.</p>
                     </div>
                   </div>
                   <button onClick={() => setActiveTab('memory')} className="px-5 py-2.5 bg-violet-600/15 border border-violet-500/30 text-violet-300 rounded-xl text-xs font-bold hover:bg-violet-600/30 transition-colors cursor-pointer">
                     Open Vault &rarr;
                   </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB 2: CONSOLE STREAM ═══ */}
        {activeTab === 'console' && (
          <div className="max-w-5xl mx-auto">
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-sm font-bold text-white ml-2">Engine 8: Live Console Error Stream</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${daemonStatus === 'online' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'}`}>
                    {daemonStatus === 'online' ? '● LIVE' : '○ OFFLINE'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{consoleErrors.length} events</span>
                  <button onClick={() => setConsoleErrors([])} className="p-1.5 text-slate-600 hover:text-rose-400 transition-colors cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="bg-[#050810] h-[580px] overflow-y-auto p-4 font-mono text-xs">
                {consoleErrors.length === 0 ? (
                  <p className="text-slate-600 italic mt-8 text-center">No console errors captured. Stream is clean ✅<br/>Errors from your running app will appear here in real-time.</p>
                ) : (
                  consoleErrors.map((e, i) => (
                    <div key={i} className={`mb-1.5 flex gap-3 px-2 py-1.5 rounded-lg ${e.level === 'error' || e.level === 'unhandledrejection' ? 'bg-rose-950/30 text-rose-400' : e.level === 'warn' ? 'bg-amber-950/30 text-amber-400' : 'text-slate-400'}`}>
                      <span className="text-slate-600 shrink-0">{(e.receivedAt || e.timestamp || '').slice(11, 19)}</span>
                      <span className={`uppercase text-[9px] font-black shrink-0 mt-0.5 ${e.level === 'error' ? 'text-rose-500' : e.level === 'warn' ? 'text-amber-500' : 'text-slate-500'}`}>{e.level}</span>
                      <span className="break-all">{e.message}</span>
                    </div>
                  ))
                )}
                <div ref={consoleEndRef} />
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB 3: SHADOW COMPILE ═══ */}
        {activeTab === 'compile' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Engine 2: Shadow Compiler</h2>
                  <p className="text-xs text-slate-500">AI code is rejected if TypeScript type-check fails.</p>
                </div>
              </div>
              <div className="bg-[#050810] rounded-xl p-4 text-xs font-mono text-slate-500 mb-6 border border-slate-800">
                <span className="text-emerald-400">$</span> npx tsc --noEmit
              </div>
              <button onClick={runShadowCompile} disabled={isCompiling || daemonStatus === 'offline'} className="w-full py-4 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-40 text-white font-black rounded-2xl flex items-center justify-center gap-3 cursor-pointer transition-all">
                {isCompiling ? <><Loader2 className="w-5 h-5 animate-spin" />Compiling...</> : <><Shield className="w-5 h-5" />Run Shadow Compile</>}
              </button>
              {compileResult && (
                <div className={`mt-5 p-5 rounded-2xl border ${compileResult.passed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
                  <p className={`font-black text-sm ${compileResult.passed ? 'text-emerald-400' : 'text-rose-400'}`}>{compileResult.summary}</p>
                  {!compileResult.passed && compileResult.errors.length > 0 && (
                    <div className="mt-3 font-mono text-xs text-rose-400/80 space-y-1 max-h-[280px] overflow-y-auto">
                      {compileResult.errors.map((e, i) => <div key={i}>{e}</div>)}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-8 pt-8 border-t border-slate-800">
                <div className="flex items-center gap-2 mb-4"><Network className="w-4 h-4 text-cyan-400" /><h3 className="font-black text-white">Dependency Blast Radius</h3></div>
                <p className="text-xs text-slate-500 mb-4">Find all files that import a given file. Know your risk before touching anything.</p>
                <div className="flex gap-3">
                  <input value={blastFile} onChange={e => setBlastFile(e.target.value)} onKeyDown={e => e.key === 'Enter' && runBlastRadius()} placeholder="patientService.ts or BillHubTab.tsx" className="flex-1 bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none" />
                  <button onClick={runBlastRadius} disabled={isBlasting || !blastFile.trim() || daemonStatus === 'offline'} className="px-5 py-3 bg-cyan-600/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-600/25 font-bold rounded-xl cursor-pointer disabled:opacity-40">
                    {isBlasting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                </div>
                {blastResult && (
                  <div className={`mt-4 p-5 rounded-2xl border ${(blastResult.blastRadius || 0) > 5 ? 'bg-rose-500/5 border-rose-500/20' : (blastResult.blastRadius || 0) > 0 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                    <p className={`font-bold text-sm ${(blastResult.blastRadius || 0) > 5 ? 'text-rose-400' : (blastResult.blastRadius || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{blastResult.warning || blastResult.error}</p>
                    {blastResult.affectedFiles?.length > 0 && (
                      <ul className="mt-3 space-y-1 font-mono text-xs text-slate-400">
                        {blastResult.affectedFiles.map((f: string, i: number) => <li key={i} className="flex items-center gap-1.5"><ChevronRight className="w-3 h-3 text-amber-500/50" />{f}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB 4: E2E TESTS ═══ */}
        {activeTab === 'e2e' && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                  <FlaskConical className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Engine 9: E2E Test Runner</h2>
                  <p className="text-xs text-slate-500">Verify every clinical workflow passes before you ship the fix.</p>
                </div>
              </div>
              <button onClick={runE2ETests} disabled={isRunningTests || daemonStatus === 'offline'} className="w-full py-4 bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-600 hover:to-emerald-600 disabled:opacity-40 text-white font-black rounded-2xl flex items-center justify-center gap-3 cursor-pointer transition-all mb-6">
                {isRunningTests ? <><Loader2 className="w-5 h-5 animate-spin" />Running E2E Tests...</> : <><FlaskConical className="w-5 h-5" />Run Full E2E Suite</>}
              </button>
              {testResult && (
                <div>
                  <div className={`flex items-center gap-3 p-5 rounded-2xl border mb-4 ${testResult.passed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
                    {testResult.passed ? <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" /> : <XCircle className="w-6 h-6 text-rose-400 shrink-0" />}
                    <div>
                      <p className={`font-black text-sm ${testResult.passed ? 'text-emerald-400' : 'text-rose-400'}`}>{testResult.summary}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{testResult.passCount} passed · {testResult.failCount} failed</p>
                    </div>
                  </div>
                  {testResult.output && (
                    <div className="bg-[#050810] border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-400 max-h-[380px] overflow-y-auto whitespace-pre-wrap">
                      {testResult.output}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ TAB 5: MEMORY VAULT ═══ */}
        {activeTab === 'memory' && (
          <div className="max-w-4xl mx-auto space-y-5">
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center"><Brain className="w-5 h-5 text-violet-400" /></div>
                <div><h2 className="text-lg font-black text-white">Engine 3: Semantic Memory Vault</h2><p className="text-xs text-slate-500">Every bug fixed → stored permanently → AI never repeats the same mistake.</p></div>
                <span className="ml-auto text-xs bg-violet-500/10 border border-violet-500/20 text-violet-400 px-3 py-1.5 rounded-full font-bold">{memoryFixes.length} fixes stored</span>
              </div>
              <div className="flex gap-3 mb-6">
                <input value={memoryQuery} onChange={e => setMemoryQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && queryMemory()} placeholder="Search past fixes... e.g. 'auth session' or 'token'" className="flex-1 bg-slate-950 border border-slate-700 focus:border-violet-500 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none" />
                <button onClick={queryMemory} className="px-5 py-3 bg-violet-600/15 border border-violet-500/30 text-violet-400 hover:bg-violet-600/25 font-bold rounded-xl cursor-pointer"><Search className="w-4 h-4" /></button>
              </div>
              {memoryFixes.length === 0 ? (
                <div className="text-center py-12">
                  <Database className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 font-semibold">Memory Vault is empty</p>
                  <p className="text-slate-600 text-sm mt-1">Fix a bug, save it in the Bug Triage tab, and J.A.R.V.I.S. will remember it forever.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {memoryFixes.map(fix => (
                    <div key={fix.id} className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="text-sm font-bold text-white">{fix.bugDescription}</p>
                        <span className="text-[10px] font-mono text-slate-600 shrink-0">{fix.timestamp?.slice(0, 10)}</span>
                      </div>
                      {fix.rootCause && <p className="text-xs text-amber-400/80 mb-1.5"><span className="font-bold">Root Cause: </span>{fix.rootCause}</p>}
                      {fix.solution && <p className="text-xs text-emerald-400/80 mb-3"><span className="font-bold">Solution: </span>{fix.solution}</p>}
                      {fix.filesModified?.length > 0 && <p className="text-[10px] text-slate-600 font-mono mb-2">{fix.filesModified.join(', ')}</p>}
                      {fix.tags?.length > 0 && <div className="flex flex-wrap gap-1">{fix.tags.map(t => <span key={t} className="text-[9px] bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded-full">{t}</span>)}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        
        {/* ═══ TAB 7: BUG QUEUE ═══ */}
        {activeTab === 'queue' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <Database className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Engine 13: Multi-Bug Queue (Gap 8)</h2>
                  <p className="text-xs text-slate-500">Log multiple bugs during a testing session and generate a single batch prompt.</p>
                </div>
              </div>
              
              <div className="flex gap-3 mb-6">
                <select value={queueSeverity} onChange={e => setQueueSeverity(e.target.value)} className="bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none">
                  <option value="P0">P0 - Critical</option>
                  <option value="P1">P1 - High</option>
                  <option value="P2">P2 - Medium</option>
                  <option value="P3">P3 - Low</option>
                </select>
                <input value={queueInput} onChange={e => setQueueInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addToQueue()} placeholder="Describe the bug..." className="flex-1 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none" />
                <button onClick={addToQueue} className="px-5 py-3 bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/25 font-bold rounded-xl cursor-pointer">Add</button>
              </div>

              {bugQueue.length > 0 ? (
                <div className="space-y-3 mb-6">
                  {bugQueue.map(bug => (
                    <div key={bug.id} className="flex items-center justify-between bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded-md ${bug.severity === 'P0' ? 'bg-rose-500/10 text-rose-400' : bug.severity === 'P1' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-300'}`}>
                          {bug.severity}
                        </span>
                        <span className="text-sm text-slate-300">{bug.desc}</span>
                      </div>
                      <button onClick={() => setBugQueue(q => q.filter(b => b.id !== bug.id))} className="text-slate-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl mb-6">
                  <p className="text-slate-500">Queue is empty. Find some bugs!</p>
                </div>
              )}

              <button onClick={generateBatchPrompt} disabled={bugQueue.length === 0} className="w-full py-4 bg-gradient-to-r from-indigo-700 to-purple-700 hover:from-indigo-600 hover:to-purple-600 disabled:opacity-40 text-white font-black rounded-2xl flex items-center justify-center gap-3 cursor-pointer transition-all">
                <Brain className="w-5 h-5" /> Load Batch into Triage Engine
              </button>
            </div>
          </div>
        )}

        {/* ═══ TAB 6: GITOPS SENTINEL ═══ */}
        {activeTab === 'gitops' && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center"><GitBranch className="w-5 h-5 text-amber-400" /></div>
                <div><h2 className="text-lg font-black text-white">Engine 4: GitOps Sentinel</h2><p className="text-xs text-slate-500">Create a safety snapshot → Roll back instantly if anything breaks.</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button onClick={createSafeState} disabled={isSavingState || daemonStatus === 'offline'} className="py-6 bg-amber-500/8 border border-amber-500/25 hover:bg-amber-500/15 text-amber-400 font-black rounded-2xl flex flex-col items-center gap-2 cursor-pointer disabled:opacity-40 transition-all">
                  {isSavingState ? <Loader2 className="w-7 h-7 animate-spin" /> : <BookOpen className="w-7 h-7" />}
                  <span>Create Safety Snapshot</span>
                  <span className="text-[10px] text-amber-600 font-medium">Records current git HEAD</span>
                </button>
                <button onClick={rollback} disabled={isRollingBack || daemonStatus === 'offline'} className="py-6 bg-rose-500/8 border border-rose-500/25 hover:bg-rose-500/15 text-rose-400 font-black rounded-2xl flex flex-col items-center gap-2 cursor-pointer disabled:opacity-40 transition-all">
                  {isRollingBack ? <Loader2 className="w-7 h-7 animate-spin" /> : <RotateCcw className="w-7 h-7" />}
                  <span>Rollback to Snapshot</span>
                  <span className="text-[10px] text-rose-600 font-medium">git reset --hard to safe state</span>
                </button>
              </div>
              {safeStateMsg && <div className={`p-5 rounded-2xl border text-sm font-bold mb-6 ${safeStateMsg.includes('⚠️') || safeStateMsg.includes('🚨') ? 'bg-rose-500/5 border-rose-500/20 text-rose-400' : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'}`}>{safeStateMsg}</div>}
              <div className="pt-6 border-t border-slate-800">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Recommended Fix Workflow</h3>
                <div className="space-y-2.5">
                  {[
                    ['1', 'Create Safety Snapshot', 'Before every AI fix session'],
                    ['2', 'Generate Surgical Strike Prompt', 'Bug Triage tab → copy'],
                    ['3', 'Paste to Antigravity', 'AI produces implementation_plan.md'],
                    ['4', 'Approve the plan', 'Review and click Proceed'],
                    ['5', 'Run Shadow Compile', 'Zero TypeScript errors = green'],
                    ['6', 'Run E2E Tests', 'All clinical workflows must pass'],
                    ['7', 'Test in browser', 'If broken → Rollback in 1 click'],
                    ['8', 'Save fix to Memory Vault', 'AI never repeats this mistake'],
                  ].map(([step, label, desc]) => (
                    <div key={step} className="flex items-start gap-3 p-3.5 bg-slate-950/50 border border-slate-800 rounded-xl">
                      <div className="w-6 h-6 rounded-lg bg-indigo-600/15 border border-indigo-500/25 flex items-center justify-center text-[10px] font-black text-indigo-400 shrink-0">{step}</div>
                      <div><p className="text-xs font-bold text-white">{label}</p><p className="text-[10px] text-slate-500">{desc}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
