import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bug, Target, Copy, X, Camera } from 'lucide-react';

export const JarvisBugReporter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTargeting, setIsTargeting] = useState(false);
  const [capturedElement, setCapturedElement] = useState<{ html: string, id: string, className: string } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [networkErrors, setNetworkErrors] = useState<string[]>([]);
  const [appContext, setAppContext] = useState<any>({});
  const [bugDescription, setBugDescription] = useState("");
  const [fps, setFps] = useState(60);
  const [performanceWarning, setPerformanceWarning] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

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
      
      setCapturedElement({
        html: target.outerHTML.slice(0, 500) + (target.outerHTML.length > 500 ? '...' : ''),
        id: target.id || 'none',
        className: target.className || 'none'
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
      const res = await fetch('http://localhost:9000/api/super-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: bugDescription || `UI Anomaly at ${appContext.url || 'current route'}: Element ${capturedElement?.id || 'targeted'}`,
          windowSize: `${window.innerWidth}x${window.innerHeight}`
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.prompt) {
          await navigator.clipboard.writeText(data.prompt);
          window.dispatchEvent(new CustomEvent('mediflow-toast', {
            detail: { title: 'J.A.R.V.I.S. v8.0 Super Prompt Copied!', message: 'All 24 engines compiled to clipboard.', type: 'success' }
          }));
          return;
        }
      }
    } catch(e) {
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
    <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-rose-600 to-rose-500 text-white px-8 py-3 rounded-full font-bold shadow-[0_10px_40px_-10px_rgba(225,29,72,0.6)] z-[99999] flex items-center gap-3 animate-bounce cursor-pointer border border-rose-400/50 backdrop-blur-xl" onClick={() => setIsTargeting(false)}>
      <Target className="h-5 w-5 animate-[spin_3s_linear_infinite]" />
      <span className="tracking-wide">JARVIS TARGETING ACTIVE: Click Element</span>
      <X className="h-4 w-4 opacity-70 hover:opacity-100 transition-opacity ml-2" />
    </div>
  ) : (
    <div ref={overlayRef} className="fixed bottom-6 left-6 w-[420px] bg-[#0a0f1c]/90 backdrop-blur-2xl border border-cyan-500/30 rounded-3xl shadow-[0_0_50px_-12px_rgba(6,182,212,0.25)] z-[99999] overflow-hidden text-slate-200 font-sans transition-all duration-500 ease-out translate-y-0 opacity-100 scale-100">
      
      {/* HEADER */}
      <div className="bg-gradient-to-r from-cyan-950/80 to-[#0a0f1c]/90 px-5 py-4 border-b border-cyan-500/20 flex items-center justify-between relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50"></div>
        <div className="flex items-center gap-3 text-cyan-400 font-bold text-sm tracking-[0.2em] uppercase z-10">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
          </div>
          J.A.R.V.I.S. Command Center
        </div>
        <button onClick={() => setIsOpen(false)} className="text-cyan-600 hover:text-cyan-300 transition-colors z-10 p-1 hover:bg-cyan-950/50 rounded-full">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* FPS & PERFORMANCE */}
        {performanceWarning ? (
          <div className="bg-rose-950/40 border border-rose-500/50 rounded-xl p-3 text-xs text-rose-400 font-bold flex items-center justify-between animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.15)]">
            <span className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-rose-500 animate-ping"></div> {performanceWarning}</span>
            <span className="uppercase tracking-wider opacity-80 border border-rose-500/30 px-2 py-1 rounded">Action Required</span>
          </div>
        ) : (
          <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-400 font-bold flex items-center justify-between shadow-inner">
            <span className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div> SYSTEM HEALTHY</span>
            <span className="font-mono tracking-widest">{fps} FPS</span>
          </div>
        )}

        {/* INPUT */}
        <div className="space-y-2 group">
          <label className="text-[10px] text-cyan-500/70 font-bold uppercase tracking-[0.15em] group-focus-within:text-cyan-400 transition-colors">Mission Directive / Bug Description</label>
          <textarea 
            value={bugDescription}
            onChange={(e) => setBugDescription(e.target.value)}
            placeholder="E.g., 'Make this button glow on hover' or 'Fix the overlapping text'"
            className="w-full bg-[#050810]/80 border border-slate-700/60 rounded-xl p-3 text-sm text-cyan-50 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 resize-none h-20 transition-all shadow-inner font-medium"
          />
        </div>

        {/* TARGETING */}
        <button 
          onClick={() => { setIsOpen(false); setIsTargeting(true); }}
          className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_-5px_rgba(79,70,229,0.5)] border border-indigo-400/30 group hover:scale-[1.02]"
        >
          <Target className="h-4 w-4 group-hover:rotate-90 transition-transform duration-500" /> 
          <span className="tracking-wide text-white">Select UI Element to Modify</span>
        </button>

        {/* CAPTURED */}
        {capturedElement && (
          <div className="bg-[#050810]/80 rounded-xl p-4 text-xs space-y-2 overflow-hidden border border-emerald-500/40 relative group shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]">
            <div className="absolute top-0 left-0 w-1 bg-emerald-500 h-full shadow-[0_0_10px_#10b981]"></div>
            <div className="text-emerald-400 font-black mb-2 flex items-center gap-2 tracking-wider"><Camera className="h-3.5 w-3.5"/> DOM CAPTURED LOCKED</div>
            <p className="flex justify-between border-b border-slate-800/80 pb-1"><span className="text-slate-500 font-semibold uppercase tracking-wider">ID</span> <span className="font-mono text-slate-300">{capturedElement.id}</span></p>
            <p className="flex flex-col gap-1 pt-1"><span className="text-slate-500 font-semibold uppercase tracking-wider">Classes</span> <span className="font-mono text-slate-300 truncate opacity-80">{capturedElement.className}</span></p>
          </div>
        )}

        {/* LOGS */}
        <div className="bg-[#050810]/80 border border-slate-800/80 rounded-xl p-3 text-[11px] space-y-2 h-28 overflow-y-auto font-mono relative">
          <div className="text-slate-500 font-bold mb-2 uppercase tracking-widest sticky top-0 bg-[#050810]/90 py-1 backdrop-blur-md z-10 border-b border-slate-800/50">System Logs</div>
          {logs.length === 0 ? (
            <div className="text-emerald-500/50 flex items-center gap-2 mt-4"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50"></span> Zero anomalies detected.</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="text-rose-400 break-words border-l-2 border-rose-500/30 pl-2 opacity-80 hover:opacity-100">{log}</div>
            ))
          )}
        </div>

        {/* ACTION */}
        <button 
          onClick={copyPrompt}
          className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_-5px_rgba(16,185,129,0.5)] border border-emerald-400/40 group text-white hover:scale-[1.02]"
        >
          <Copy className="h-4 w-4 group-hover:scale-110 transition-transform" /> 
          <span className="tracking-wide">Generate God-Mode Prompt</span>
        </button>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
};
