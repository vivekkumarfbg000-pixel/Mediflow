import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bug, Target, Copy, X, Camera, Crosshair, Activity, Cpu, Radio, Terminal, Sparkles } from 'lucide-react';

export const JarvisBugReporter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTargeting, setIsTargeting] = useState(false);
  const [capturedElement, setCapturedElement] = useState<{ html: string, id: string, className: string, fiber?: any } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [networkErrors, setNetworkErrors] = useState<string[]>([]);
  const [appContext, setAppContext] = useState<any>({});
  const [bugDescription, setBugDescription] = useState("");
  const [fps, setFps] = useState(60);
  const [performanceWarning, setPerformanceWarning] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // React 18 Fiber Node Introspection Engine
  const extractReactFiber = (target: HTMLElement) => {
    try {
      const fiberKey = Object.keys(target).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
      if (!fiberKey) return null;
      const fiber = (target as any)[fiberKey];
      let compName = 'UnknownComponent';
      let debugSource: any = null;
      const propsSummary: Record<string, any> = {};
      const stateSummary: Record<string, any> = {};

      let curr = fiber;
      let depth = 0;
      while (curr && depth < 25) {
        if (curr.type && (typeof curr.type === 'function' || typeof curr.type === 'object')) {
          const candidateName = curr.type.displayName || curr.type.name || (curr.type.render && curr.type.render.name);
          if (candidateName && !candidateName.startsWith('_')) {
            compName = candidateName;
            if (curr._debugSource) debugSource = curr._debugSource;

            if (curr.memoizedProps && typeof curr.memoizedProps === 'object') {
              for (const [pk, pv] of Object.entries(curr.memoizedProps)) {
                if (pk === 'children') continue;
                if (typeof pv === 'string' || typeof pv === 'number' || typeof pv === 'boolean') {
                  propsSummary[pk] = pv;
                } else if (Array.isArray(pv)) {
                  propsSummary[pk] = `Array(${pv.length})`;
                } else if (pv && typeof pv === 'object') {
                  propsSummary[pk] = '{...}';
                }
              }
            }

            if (curr.memoizedState) {
              let hookIdx = 0;
              let hook = curr.memoizedState;
              while (hook && hookIdx < 8) {
                const val = hook.memoizedState;
                if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
                  stateSummary[`hook_${hookIdx}`] = val;
                } else if (Array.isArray(val)) {
                  stateSummary[`hook_${hookIdx}`] = `Array(${val.length})`;
                } else if (val && typeof val === 'object') {
                  stateSummary[`hook_${hookIdx}`] = '{...}';
                }
                hook = hook.next;
                hookIdx++;
              }
            }
            break;
          }
        }
        curr = curr.return;
        depth++;
      }

      return {
        componentName: compName,
        sourceFile: debugSource ? `${debugSource.fileName}:${debugSource.lineNumber}` : undefined,
        props: Object.keys(propsSummary).length > 0 ? propsSummary : undefined,
        state: Object.keys(stateSummary).length > 0 ? stateSummary : undefined
      };
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    // Listen for Ctrl+J or Cmd+J
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);

    // Capture console errors locally for the HUD
    const originalError = console.error.bind(console);
    console.error = (...args: any[]) => {
      originalError(...args);
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      setLogs(prev => [...prev, msg].slice(-5)); // Keep last 5
    };

    // Capture Network Errors (Fetch Interceptor)
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        if (!response.ok) {
          const cloned = response.clone();
          const body = await cloned.text().catch(() => 'No Body');
          const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
          setNetworkErrors(prev => [...prev, `[${response.status}] ${url} - ${body.substring(0, 200)}`].slice(-3));
        }
        return response;
      } catch (err) {
        setNetworkErrors(prev => [...prev, `[Network Fail] ${String(err)}`].slice(-3));
        throw err;
      }
    };

    // Capture App Context (Supabase Auth / LocalStorage)
    const captureContext = () => {
      try {
        const keys = Object.keys(localStorage);
        const sbKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        let user = 'Unauthenticated';
        if (sbKey) {
          const tokenData = JSON.parse(localStorage.getItem(sbKey) || '{}');
          user = tokenData?.user?.id ? `Authenticated (${tokenData.user.id})` : 'Invalid Token';
        }
        setAppContext({
          user,
          userAgent: navigator.userAgent,
          url: window.location.href
        });
      } catch (e) {}
    };
    captureContext();

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      console.error = originalError;
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animationFrameId: number;

    const measureFPS = () => {
      const now = performance.now();
      frameCount++;
      
      if (now - lastTime >= 1000) {
        const currentFps = Math.round((frameCount * 1000) / (now - lastTime));
        setFps(currentFps);
        if (currentFps < 30) {
          setPerformanceWarning(`CRITICAL LAG: ${currentFps} FPS`);
        } else if (currentFps < 50) {
          setPerformanceWarning(`LAG WARNING: ${currentFps} FPS`);
        } else {
          setPerformanceWarning(null);
        }
        frameCount = 0;
        lastTime = now;
      }
      animationFrameId = requestAnimationFrame(measureFPS);
    };

    animationFrameId = requestAnimationFrame(measureFPS);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  useEffect(() => {
    if (!isTargeting) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (overlayRef.current && overlayRef.current.contains(e.target as Node)) return;
      
      document.querySelectorAll('.jarvis-highlight').forEach(el => el.classList.remove('jarvis-highlight'));
      
      const target = e.target as HTMLElement;
      if (target && target.classList) {
        target.classList.add('jarvis-highlight');
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (overlayRef.current && overlayRef.current.contains(e.target as Node)) return;
      e.preventDefault();
      e.stopPropagation();

      const target = e.target as HTMLElement;
      document.querySelectorAll('.jarvis-highlight').forEach(el => el.classList.remove('jarvis-highlight'));
      
      const fiber = extractReactFiber(target);
      setCapturedElement({
        html: target.outerHTML.slice(0, 500) + (target.outerHTML.length > 500 ? '...' : ''),
        id: target.id || 'none',
        className: target.className || 'none',
        fiber
      });
      setIsTargeting(false);
      setIsOpen(true);
    };

    const style = document.createElement('style');
    style.innerHTML = `.jarvis-highlight { outline: 3px solid #ef4444 !important; outline-offset: -3px !important; background-color: rgba(239, 68, 68, 0.2) !important; cursor: crosshair !important; }`;
    document.head.appendChild(style);

    window.addEventListener('mousemove', handleMouseMove, true);
    window.addEventListener('click', handleClick, true);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove, true);
      window.removeEventListener('click', handleClick, true);
      document.querySelectorAll('.jarvis-highlight').forEach(el => el.classList.remove('jarvis-highlight'));
      document.head.removeChild(style);
    };
  }, [isTargeting]);

  const copyPrompt = async () => {
    try {
      const compTarget = capturedElement?.fiber?.componentName ? `<${capturedElement.fiber.componentName} />` : (capturedElement?.id !== 'none' ? `#${capturedElement?.id}` : 'Target');
      const res = await fetch('http://localhost:9000/api/super-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: bugDescription || `UI Anomaly at ${appContext.url || 'current route'}: Component ${compTarget}`,
          windowSize: `${window.innerWidth}x${window.innerHeight}`,
          targetFile: capturedElement?.fiber?.sourceFile || '',
          fiberContext: capturedElement?.fiber || null,
          targetedElement: capturedElement ? {
            id: capturedElement.id,
            className: capturedElement.className,
            html: capturedElement.html
          } : null
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.prompt) {
          await navigator.clipboard.writeText(data.prompt);
          window.dispatchEvent(new CustomEvent('mediflow-toast', {
            detail: { title: 'J.A.R.V.I.S. v9.0 Super Prompt Copied!', message: 'All 24 engines + React 18 Fiber compiled to clipboard.', type: 'success' }
          }));
          return;
        }
      }
    } catch {
      // Fallback to local prompt if daemon offline
    }

    const prompt = `<USER_REQUEST_TRIAGE>
╔═══════════════════════════════════════════════════════════════════╗
║  🧠 J.A.R.V.I.S. v8.0 — VitalSync Bug Command Center             ║
║  24-Engine Anti-Hallucination Supercomputer Protocol              ║
╚═══════════════════════════════════════════════════════════════════╝

🚨 BUG DESCRIPTION:
${bugDescription || '[User did not provide a description. Analyze context to deduce.]'}

🚨 BUG SEVERITY: CRITICAL
   Urgency: High

📸 VISUAL CONTEXT & SCREENSHOT DIRECTIVE:
[⚠️ USER WILL ATTACH A SCREENSHOT WITH THIS PROMPT. YOU MUST USE YOUR VISION MODEL TO ANALYZE IT AND CROSS-REFERENCE IT WITH THE DOM BELOW TO AVOID HALLUCINATION]

🎯 VISUAL TARGET (Captured Element):
ID: ${capturedElement?.id || 'N/A'}
Classes: ${capturedElement?.className || 'N/A'}
HTML Snippet:
\`\`\`html
${capturedElement?.html || 'No element targeted'}
\`\`\`

🌐 APP CONTEXT:
User State: ${appContext.user || 'Unknown'}
URL: ${appContext.url || 'Unknown'}

⏱️ PERFORMANCE METRICS (60-FPS Enforcer):
Current FPS: ${fps}
Status: ${performanceWarning || 'Healthy (60 FPS)'}

🖥️ CONSOLE LOGS & ERRORS:
\`\`\`
${logs.join('\n') || 'No console errors captured.'}
\`\`\`

📡 NETWORK FAILURES:
\`\`\`
${networkErrors.join('\n') || 'No network failures captured.'}
\`\`\`

⚠️ MISSION CRITICAL DIRECTIVE (SINGLE-ATTEMPT FIX REQUIRED):
1. Execute a 360° Root Cause Analysis across the full stack (Frontend DOM, React State, Supabase CDC, Edge Functions).
2. Do NOT guess blindly. Cross-reference the attached screenshot with the Captured DOM Element above.
3. Ensure no structural regressions (e.g. Rule 1.1 / Rule 1.2 in AGENTS.md).
4. Provide the EXACT, minimal surgical diff required to fix this bug in ONE attempt.
</USER_REQUEST_TRIAGE>`;

    navigator.clipboard.writeText(prompt);
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: { title: 'Copied to Clipboard!', message: 'Paste this into the AI Agent chat.', type: 'success' }
    }));
  };

  if (!isOpen && !isTargeting) return null;

  const content = isTargeting ? (
    <div 
      className="fixed top-5 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-3.5 px-6 py-2.5 rounded-xl bg-[#020617]/95 backdrop-blur-2xl border border-cyan-400/60 shadow-[0_0_40px_rgba(6,182,212,0.45),inset_0_0_15px_rgba(6,182,212,0.15)] text-cyan-300 font-mono text-xs font-bold tracking-wider cursor-pointer group hover:border-cyan-300 transition-all select-none animate-pulse"
      onClick={() => setIsTargeting(false)}
    >
      <div className="relative flex h-3 w-3 items-center justify-center">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400 shadow-[0_0_10px_#22d3ee]"></span>
      </div>
      <Crosshair className="h-4 w-4 text-cyan-400 animate-[spin_6s_linear_infinite]" />
      <span className="tracking-[0.18em] uppercase text-cyan-200">
        STARK VISOR // TARGET LOCK ACTIVE <span className="text-cyan-400/70 font-normal">| CLICK ANY ELEMENT</span>
      </span>
      <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 font-mono">
        ESC / CANCEL
      </span>
    </div>
  ) : (
    <div ref={overlayRef} className="fixed bottom-6 left-6 w-[420px] bg-[#020617]/95 backdrop-blur-3xl border border-cyan-500/40 rounded-2xl shadow-[0_0_60px_-10px_rgba(6,182,212,0.35),inset_0_0_25px_rgba(6,182,212,0.06)] z-[99999] overflow-hidden text-slate-200 font-sans transition-all duration-300 ease-out select-none">
      {/* CORNER RETICLES */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400 pointer-events-none z-20"></div>
      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400 pointer-events-none z-20"></div>
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400 pointer-events-none z-20"></div>
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400 pointer-events-none z-20"></div>

      {/* SCANLINE OVERLAY */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.25)_51%)] bg-[length:100%_4px] pointer-events-none opacity-20 z-0"></div>
      
      {/* ARC REACTOR HEADER */}
      <div className="relative bg-gradient-to-r from-cyan-950/90 via-[#030712]/95 to-slate-950/90 px-4 py-3 border-b border-cyan-500/30 flex items-center justify-between overflow-hidden z-10">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>
        <div className="flex items-center gap-2.5 z-10">
          <div className="relative flex items-center justify-center w-6 h-6">
            <div className="absolute inset-0 rounded-full border border-cyan-400/40 animate-[spin_8s_linear_infinite]"></div>
            <div className="absolute inset-1 rounded-full border border-dashed border-cyan-400/70 animate-[spin_4s_linear_infinite_reverse]"></div>
            <div className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]"></div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-mono text-xs font-black tracking-[0.22em] text-cyan-300 uppercase drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]">
              J.A.R.V.I.S. HUD
            </div>
            <div className="font-mono text-[9px] tracking-widest text-cyan-400/60 uppercase">
              MARK IX // TACTICAL OMNI-SYSTEM
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 z-10">
          <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-semibold tracking-wider flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            24-ENG
          </span>
          <button 
            onClick={() => setIsOpen(false)} 
            className="text-cyan-500 hover:text-cyan-200 transition-colors p-1 hover:bg-cyan-900/40 rounded-lg border border-transparent hover:border-cyan-500/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative p-4 space-y-3.5 z-10">
        {/* TACTICAL TELEMETRY STRIP */}
        <div className="grid grid-cols-3 gap-2 font-mono text-[10px]">
          <div className="bg-[#010409]/90 border border-cyan-900/50 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
            <span className="text-slate-400 text-[9px] tracking-wider uppercase">REFRESH</span>
            <span className={`font-bold flex items-center gap-1 ${
              fps >= 50 ? 'text-emerald-400' : fps >= 30 ? 'text-amber-400' : 'text-rose-400'
            }`}>
              <Activity className="h-3 w-3" />
              {fps} FPS
            </span>
          </div>
          <div className="bg-[#010409]/90 border border-cyan-900/50 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
            <span className="text-slate-400 text-[9px] tracking-wider uppercase">CORE</span>
            <span className="text-cyan-400 font-bold flex items-center gap-1">
              <Cpu className="h-3 w-3 text-cyan-400" />
              24/24
            </span>
          </div>
          <div className="bg-[#010409]/90 border border-cyan-900/50 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
            <span className="text-slate-400 text-[9px] tracking-wider uppercase">BRIDGE</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
              :9000
            </span>
          </div>
        </div>

        {/* DIRECTIVE INPUT */}
        <div className="space-y-1.5 group">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-cyan-400/80 font-mono font-bold uppercase tracking-[0.18em] flex items-center gap-1.5">
              <Terminal className="h-3 w-3 text-cyan-400" />
              TACTICAL DIRECTIVE
            </label>
            <span className="text-[9px] text-slate-400 font-mono tracking-widest">[AUTO-REVERT ARMED]</span>
          </div>
          <div className="relative">
            <textarea 
              value={bugDescription}
              onChange={(e) => setBugDescription(e.target.value)}
              placeholder="Enter directive: e.g., 'Make this button glow on hover' or 'Fix POS cart alignment'..."
              className="w-full bg-[#010409]/90 border border-cyan-900/60 rounded-xl p-3 text-xs text-cyan-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 resize-none h-16 transition-all shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)] font-sans font-medium"
            />
            <div className="absolute bottom-2 right-2.5 text-[9px] font-mono text-cyan-500/40 pointer-events-none">
              STARK-AI
            </div>
          </div>
        </div>

        {/* TARGETING TRIGGER */}
        <button 
          onClick={() => { setIsOpen(false); setIsTargeting(true); }}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-950/60 via-blue-950/50 to-slate-900/80 hover:from-cyan-900/60 hover:to-blue-900/60 rounded-xl font-mono text-xs font-bold flex items-center justify-between transition-all duration-200 border border-cyan-500/40 hover:border-cyan-300 shadow-[0_0_20px_-5px_rgba(6,182,212,0.25)] hover:shadow-[0_0_25px_rgba(6,182,212,0.45)] group cursor-pointer"
        >
          <div className="flex items-center gap-2 text-cyan-300 group-hover:text-cyan-100">
            <Crosshair className="h-4 w-4 text-cyan-400 group-hover:rotate-90 transition-transform duration-300" /> 
            <span className="tracking-[0.14em] uppercase text-[11px]">LOCK TARGET ELEMENT</span>
          </div>
          <span className="text-[9px] tracking-wider text-cyan-400/80 bg-cyan-950/80 border border-cyan-500/30 px-2 py-0.5 rounded font-mono">
            FIBER INTROSPECT
          </span>
        </button>

        {/* CAPTURED TARGET */}
        {capturedElement && (
          <div className="bg-[#010409]/90 rounded-xl p-3 text-xs space-y-1.5 border border-cyan-500/50 relative overflow-hidden shadow-[inset_0_0_20px_rgba(6,182,212,0.08)] font-mono">
            <div className="flex items-center justify-between text-cyan-300 text-[10px] font-black tracking-wider pb-1 border-b border-cyan-900/50">
              <span className="flex items-center gap-1.5"><Camera className="h-3 w-3 text-cyan-400"/> TARGET LOCKED</span>
              <button 
                onClick={() => setCapturedElement(null)} 
                className="text-[9px] text-slate-400 hover:text-rose-400 transition-colors uppercase cursor-pointer"
              >
                CLEAR
              </button>
            </div>
            <div className="text-[11px] text-emerald-400 font-bold truncate">
              {capturedElement.fiber?.componentName ? `<${capturedElement.fiber.componentName} />` : 'DOM Node'}
            </div>
            {capturedElement.fiber?.sourceFile && (
              <div className="text-[9px] text-slate-400 truncate">
                <span className="text-cyan-500/70">SRC:</span> {capturedElement.fiber.sourceFile}
              </div>
            )}
            <div className="flex justify-between text-[9px] text-slate-400 pt-0.5">
              <span>ID: <span className="text-slate-300">{capturedElement.id}</span></span>
              <span className="truncate max-w-[180px]">CLS: <span className="text-slate-300">{capturedElement.className}</span></span>
            </div>
          </div>
        )}

        {/* SYSTEM LOGS TERMINAL */}
        <div className="bg-[#010409]/95 border border-cyan-950 rounded-xl p-2.5 text-[10px] font-mono space-y-1 h-24 overflow-y-auto relative shadow-inner">
          <div className="text-cyan-500/70 font-bold text-[9px] uppercase tracking-widest sticky top-0 bg-[#010409]/95 py-0.5 backdrop-blur-md z-10 border-b border-cyan-950 flex items-center justify-between">
            <span className="flex items-center gap-1"><Terminal className="h-2.5 w-2.5 text-cyan-400"/> TELEMETRY LOGS</span>
            <span className="text-[8px] text-slate-500">REALTIME</span>
          </div>
          {logs.length === 0 ? (
            <div className="text-cyan-500/50 flex items-center gap-1.5 pt-2 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]"></span>
              Telemetry nominal. Zero anomalies.
            </div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="text-rose-400/90 break-words border-l border-rose-500/40 pl-1.5 py-0.5 text-[9px]">
                {log}
              </div>
            ))
          )}
        </div>

        {/* COMPILE GOD-MODE ACTION BUTTON */}
        <button 
          onClick={copyPrompt}
          className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 rounded-xl font-mono font-black text-xs flex items-center justify-center gap-2 text-white shadow-[0_0_25px_-5px_rgba(6,182,212,0.55)] border border-cyan-400/60 transition-all duration-200 hover:shadow-[0_0_35px_rgba(6,182,212,0.7)] group cursor-pointer relative overflow-hidden active:scale-[0.99]"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none"></div>
          <Sparkles className="h-4 w-4 text-cyan-200 group-hover:scale-110 transition-transform" /> 
          <span className="tracking-[0.16em] uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            COMPILE 24-ENGINE GOD PROMPT
          </span>
        </button>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
};
