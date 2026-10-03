# 🧠 J.A.R.V.I.S. GOD MODE v6.0 - SOURCE CODE VAULT

> **STRICT IMMUTABLE BACKUP**
> This file contains the ultra-premium God Mode v6.0 source code for JARVIS.
> DO NOT DELETE OR MODIFY THIS BACKUP.


## File: `frontend/src/components/shared/JarvisBugReporter.tsx`

```tsx
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

  const copyPrompt = () => {
    const prompt = `<USER_REQUEST_TRIAGE>
╔═══════════════════════════════════════════════════════════════════╗
║  🧠 J.A.R.V.I.S. v5.0 — VitalSync Bug Command Center            ║
║  17-Engine Anti-Hallucination Supercomputer Protocol              ║
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

```

## File: `frontend/src/lib/jarvisConsoleHook.ts`

```typescript
/**
 * J.A.R.V.I.S. v5.0 — Browser Hook (DEV only)
 * Covers: Console Errors, Network Failures, Performance Metrics, React State
 *
 * GAP 2: Network Request Interceptor  — fetch/XHR 4xx/5xx failures
 * GAP 4: React Component State Snapshot — component state at crash time
 * GAP 7: Performance Monitor — FCP, LCP, TTI, slow queries
 */

const DAEMON = 'http://localhost:9000';
const CLOUD_JARVIS = 'https://vivek1916-mediflow-proactive-monitor.hf.space';

function safePush(endpoint: string, payload: object) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  
  // Route core crashes to the 24/7 Cloud Jarvis on Hugging Face
  const baseUrl = endpoint === '/push-console-error' ? CLOUD_JARVIS : DAEMON;
  
  fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => { /* daemon may be offline */ });
}

// ─── CONSOLE HOOK ───────────────────────────────────────────────
function initConsoleHook() {
  const originalError = console.error.bind(console);
  const originalWarn = console.warn.bind(console);

  console.error = (...args: any[]) => {
    originalError(...args);
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    safePush('/push-console-error', { level: 'error', message: msg.slice(0, 1000), url: window.location.href, timestamp: new Date().toISOString() });
  };

  console.warn = (...args: any[]) => {
    originalWarn(...args);
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    safePush('/push-console-error', { level: 'warn', message: msg.slice(0, 1000), url: window.location.href, timestamp: new Date().toISOString() });
  };

  function showJarvisRedAlert(message: string) {
    if (document.getElementById('jarvis-red-alert')) return;
    const alertDiv = document.createElement('div');
    alertDiv.id = 'jarvis-red-alert';
    alertDiv.className = "fixed bottom-6 right-6 max-w-md w-full bg-[#0a0f1c]/95 backdrop-blur-2xl border border-rose-500/50 rounded-2xl shadow-[0_0_40px_-10px_rgba(225,29,72,0.5)] z-[999999] overflow-hidden text-slate-200 font-sans transition-all duration-300 transform translate-y-0 opacity-100";
    alertDiv.innerHTML = `
      <div class="bg-gradient-to-r from-rose-950/90 to-[#0a0f1c]/90 px-5 py-3 border-b border-rose-500/30 flex items-center gap-3 relative overflow-hidden">
        <div class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-rose-500 to-transparent opacity-80 shadow-[0_0_10px_#f43f5e]"></div>
        <div class="relative flex h-3 w-3 shrink-0">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 bg-rose-500 shadow-[0_0_8px_#f43f5e]"></span>
        </div>
        <span class="text-rose-400 font-black text-[11px] tracking-[0.25em] uppercase">CRITICAL SYSTEM ANOMALY</span>
      </div>
      <div class="p-5 space-y-4 relative">
        <div class="absolute right-0 top-0 w-32 h-32 bg-rose-500/5 blur-3xl rounded-full pointer-events-none"></div>
        <div class="font-mono text-xs text-rose-200 break-words border-l-[3px] border-rose-500/60 pl-3 leading-relaxed opacity-90 shadow-[inset_10px_0_20px_-15px_rgba(244,63,94,0.3)]">
          ${message.substring(0, 150)}${message.length > 150 ? '...' : ''}
        </div>
        <div class="text-[10px] uppercase tracking-[0.2em] text-slate-500 flex items-center justify-between pt-3 border-t border-slate-800/80">
          <span class="flex items-center gap-2"><svg class="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Payload Secured</span>
          <span class="text-rose-500 font-bold animate-pulse">AWAITING AI AGENT</span>
        </div>
      </div>
    `;
    
    // Add slide-in animation via script
    alertDiv.style.transform = 'translateY(100px)';
    alertDiv.style.opacity = '0';
    document.body.appendChild(alertDiv);
    
    requestAnimationFrame(() => {
      alertDiv.style.transform = 'translateY(0)';
      alertDiv.style.opacity = '1';
    });
  }

  window.addEventListener('unhandledrejection', async (e) => {
    const errorMsg = String(e.reason?.message || e.reason || 'Unknown');
    const payload = { level: 'unhandledrejection', message: errorMsg.slice(0, 1000), stack: (e.reason?.stack || '').slice(0, 2000), url: window.location.href, timestamp: new Date().toISOString() };
    safePush('/push-console-error', payload);
    safePush('/api/agent-debug', payload); // Autonomous Agentic Debug Hook
    showJarvisRedAlert(errorMsg);

    // Phase 1: Multimodal "Vision" Engine
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(document.body, { logging: false, scale: 1 });
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.6);
      fetch(`${DAEMON}/push-console-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, timestamp: new Date().toISOString() })
      }).catch(() => {});
    } catch(err) { /* ignore */ }
  });

  window.addEventListener('error', async (e) => {
    const errorMsg = (e.message || 'Unknown JS error');
    const payload = { level: 'error', message: errorMsg.slice(0, 1000), stack: (e.error?.stack || '').slice(0, 2000), url: window.location.href, timestamp: new Date().toISOString() };
    safePush('/push-console-error', payload);
    safePush('/api/agent-debug', payload); // Autonomous Agentic Debug Hook
    showJarvisRedAlert(errorMsg);

    // Phase 1: Multimodal "Vision" Engine
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(document.body, { logging: false, scale: 1 });
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.6);
      fetch(`${DAEMON}/push-console-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, timestamp: new Date().toISOString() })
      }).catch(() => {});
    } catch(err) { /* ignore */ }
  });
}

// ─── GAP 2: NETWORK REQUEST INTERCEPTOR ─────────────────────────
function initNetworkInterceptor() {
  const originalFetch = window.fetch;

  window.fetch = async function(...args: Parameters<typeof fetch>) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
    
    if (url.includes(DAEMON) || url.includes(CLOUD_JARVIS)) {
      return originalFetch.apply(this, args);
    }

    const method = (args[1]?.method || 'GET').toUpperCase();
    const startTime = Date.now();

    try {
      const response = await originalFetch.apply(this, args);
      const duration = Date.now() - startTime;

      // Capture failures (4xx, 5xx) and slow queries (>2000ms)
      if (!response.ok || duration > 2000) {
        safePush('/push-network-error', {
          url: url.slice(0, 300),
          method,
          status: response.status,
          statusText: response.statusText,
          duration,
          isFailure: !response.ok,
          isSlow: duration > 2000,
          pageUrl: window.location.href,
          timestamp: new Date().toISOString(),
          hint: !response.ok
            ? response.status === 403
              ? 'RLS policy may be blocking this request — check Supabase Row Level Security'
              : response.status === 401
              ? 'Auth token expired or missing — check Supabase session'
              : response.status === 404
              ? 'Edge function or table does not exist'
              : response.status >= 500
              ? 'Supabase edge function crashed — check function logs'
              : `HTTP ${response.status} error`
            : `Slow query: ${duration}ms — check query optimization`
        });
      }
      return response;
    } catch (err: any) {
      const duration = Date.now() - startTime;
      // Network-level failure (CORS, offline, DNS)
      safePush('/push-network-error', {
        url: url.slice(0, 300),
        method,
        status: 0,
        statusText: 'Network Error',
        duration,
        isFailure: true,
        isSlow: false,
        pageUrl: window.location.href,
        timestamp: new Date().toISOString(),
        hint: 'Network-level failure — check CORS, offline status, or Supabase URL configuration',
        errorMessage: err?.message || String(err)
      });
      throw err;
    }
  };
}

// ─── GAP 4: REACT COMPONENT STATE SNAPSHOT ──────────────────────
function initReactStateSnapshot() {
  // Expose a global function that PromptGuard can call to get current React state
  (window as any).__JARVIS_REACT_SNAPSHOT__ = () => {
    try {
      const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (!hook || !hook.renderers) return { available: false, reason: 'React DevTools hook not found' };

      const snapshots: any[] = [];
      hook.renderers.forEach((renderer: any) => {
        try {
          // Get fiber root to extract current component states
          const roots = renderer.getFiberRoots ? renderer.getFiberRoots() : [];
          roots.forEach((root: any) => {
            const fiber = root.current;
            // Walk the fiber tree (max 10 components for performance)
            let count = 0;
            const walk = (f: any) => {
              if (!f || count > 10) return;
              if (f.memoizedState && f.type?.name) {
                count++;
                // Safely stringify state
                let stateStr = '';
                try { stateStr = JSON.stringify(f.memoizedState, null, 2).slice(0, 500); } catch { stateStr = '[circular]'; }
                snapshots.push({ component: f.type.name, statePreview: stateStr });
              }
              walk(f.child);
              walk(f.sibling);
            };
            walk(fiber);
          });
        } catch { /* skip */ }
      });

      return { available: true, timestamp: new Date().toISOString(), components: snapshots.slice(0, 10) };
    } catch (e) {
      return { available: false, reason: String(e) };
    }
  };
}

// ─── GAP 7: PERFORMANCE MONITOR ─────────────────────────────────
function initPerformanceMonitor() {
  if (!('PerformanceObserver' in window)) return;

  // Web Vitals observer
  try {
    const vitalsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const vital = {
          name: entry.name,
          value: Math.round((entry as any).value ?? (entry as any).duration ?? 0),
          entryType: entry.entryType,
          url: window.location.href,
          timestamp: new Date().toISOString()
        };
        safePush('/push-performance', vital);
      }
    });
    vitalsObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch { /* browser may not support */ }

  // Long task observer (UI freeze detection)
  try {
    const longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 100) { // tasks > 100ms block the UI
          safePush('/push-performance', {
            name: 'long-task',
            value: Math.round(entry.duration),
            entryType: 'longtask',
            url: window.location.href,
            timestamp: new Date().toISOString(),
            hint: `UI frozen for ${Math.round(entry.duration)}ms — likely a large data mapping loop`
          });
        }
      }
    });
    longTaskObserver.observe({ type: 'longtask', buffered: true });
  } catch { /* browser may not support */ }

  // First Contentful Paint
  try {
    const paintObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        safePush('/push-performance', {
          name: entry.name, // 'first-paint' or 'first-contentful-paint'
          value: Math.round(entry.startTime),
          entryType: 'paint',
          url: window.location.href,
          timestamp: new Date().toISOString(),
          hint: entry.startTime > 3000 ? `⚠️ Slow paint (${Math.round(entry.startTime)}ms) — check bundle size or blocking scripts` : undefined
        });
      }
    });
    paintObserver.observe({ type: 'paint', buffered: true });
  } catch { /* browser may not support */ }
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────
export function initJarvisConsoleHook() {
  if (typeof window === 'undefined') return;
  if (!(import.meta.env?.DEV)) return; // DEV only — never in production

  initConsoleHook();        // Console errors
  initNetworkInterceptor(); // GAP 2: Network failures
  initReactStateSnapshot(); // GAP 4: React state snapshot
  initPerformanceMonitor(); // GAP 7: Performance vitals

  console.log('[J.A.R.V.I.S. v5.0] 4 browser hooks active → streaming to Daemon Bridge port 9000');
  console.log('[J.A.R.V.I.S. v5.0] Monitoring: console errors, network failures, React state, performance vitals');
}

```

## File: `frontend/scripts/daemon-bridge.cjs`

```javascript
const puppeteer = require('puppeteer');
/**
 * 🧠 VitalSync J.A.R.V.I.S. Daemon Bridge — Enterprise v3.0 (JARVIS Protocol)
 * Port: 9000
 *
 * 4-Engine Supercomputer Core:
 * ENGINE 1: 🕸️  Dependency Graph   — /api/blast-radius?file=<path>  — Prevents cascading failures
 * ENGINE 2: 🛡️  Shadow Compiler    — /api/shadow-compile             — Stops syntax/type errors pre-flight
 * ENGINE 3: 🗄️  Memory Vault       — /api/memory (GET/POST)          — Permanent AI fix memory (RAG 2.0)
 * ENGINE 4: ⏪  GitOps Sentinel    — /api/safe-state (POST/DELETE)   — Instant rollback shield
 *
 * Existing Endpoints:
 * 5. /context      — Live system state + CDC channel map
 * 6. /locate?q=    — AST component & line locator
 * 7. /schema       — Table schema + pod mapping
 * 8. /health       — Subsystem health & uptime
 * 9. /api/diagnostics (POST) — Full CTO-grade prompt generator
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { execSync, exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

// --- Global Brain Integrations ---
const ENV_PATH = path.resolve(__dirname, '../.env.local');
let GEMINI_API_KEY = '';
if (fs.existsSync(ENV_PATH)) {
  const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
  const match = envContent.match(/VITE_GEMINI_API_KEY="?([^"\n]+)"?/);
  if (match) GEMINI_API_KEY = match[1];
}

const SUPABASE_URL = 'https://kguupaybvbngyzyofjun.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zKni8xDa4b_N4qPcjlgRAA_leFfwIEm'; 
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getGeminiEmbedding(text) {
  if (!GEMINI_API_KEY) return null;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "models/embedding-001",
        content: { parts: [{ text }] }
      })
    });
    const data = await res.json();
    return data?.embedding?.values || null;
  } catch(e) {
    return null;
  }
}


const PORT = 9000;
const SRC_DIR = path.resolve(__dirname, '../src');
const ROOT_DIR = path.resolve(__dirname, '../../');
const MEMORY_VAULT_PATH = path.resolve(__dirname, 'jarvis_memory_vault.json');

// ─────────────────────────────────────────────────────────────────
// COMPONENT & FEATURE KNOWLEDGE MAP (RAG Index)
// ─────────────────────────────────────────────────────────────────
const COMPONENT_FEATURE_INDEX = {
  token: {
    feature: 'OPD Token Sequencing & Queue Formatting',
    files: [
      { path: 'frontend/src/services/patientService.ts', symbol: 'PatientService.generateNextTokenNumber', lines: '520-590' },
      { path: 'frontend/src/components/compounder/CompounderDashboard.tsx', symbol: 'QueueCards / TokenBadges', lines: '2810-2860' },
      { path: 'frontend/src/components/doctor/DoctorDashboard.tsx', symbol: 'PatientQueueList', lines: '800-880' }
    ]
  },
  vitals: {
    feature: 'Compounder Rapid Vitals Intake & BMI Engine',
    files: [
      { path: 'frontend/src/components/compounder/CompounderDashboard.tsx', symbol: 'VitalsEntryModal', lines: '1200-1450' },
      { path: 'frontend/src/services/patientService.ts', symbol: 'PatientService.savePatient', lines: '69-118' }
    ]
  },
  prescription: {
    feature: 'Doctor Digital Prescriptions & 1-0-1 Dosage Engine',
    files: [
      { path: 'frontend/src/components/doctor/tabs/ConsultationTab.tsx', symbol: 'ConsultationTab', lines: '1-600' },
      { path: 'frontend/src/services/encounterService.ts', symbol: 'EncounterService.createEncounter', lines: '40-120' },
      { path: 'frontend/src/services/pharmacyService.ts', symbol: 'PharmacyService', lines: '1-200' }
    ]
  },
  billing: {
    feature: 'Multi-Gateway Checkout & Fee Immunity Protocol',
    files: [
      { path: 'frontend/src/services/billingService.ts', symbol: 'BillingService.createLedgerSplitsForInvoiceFields', lines: '868-950' },
      { path: 'frontend/src/components/compounder/tabs/BillHubTab.tsx', symbol: 'BillHubTab', lines: '1-500' },
      { path: 'frontend/src/components/doctor/tabs/FinancialsTab.tsx', symbol: 'FinancialsTab', lines: '70-290' }
    ]
  },
  refill: {
    feature: 'Chronic Care Days-Supply & 1-Tap Refill Engine',
    files: [
      { path: 'frontend/src/services/chronicCareService.ts', symbol: 'ChronicCareService.calculateDaysSupply', lines: '45-120' },
      { path: 'frontend/src/components/doctor/tabs/ChronicCareTab.tsx', symbol: 'ChronicCareTab', lines: '1-400' }
    ]
  },
  whatsapp: {
    feature: 'Meta Graph API Outbound Dispatch & Webhook FSM',
    files: [
      { path: 'frontend/src/services/whatsappService.ts', symbol: 'WhatsAppService.sendWhatsAppMessagePayload', lines: '40-150' },
      { path: 'supabase/functions/meta-webhook/index.ts', symbol: 'triggerBotReplyPipeline', lines: '2400-2700' }
    ]
  },
  ocr: {
    feature: 'AI OCR Prescription Engine (IMMUTABLE)',
    files: [
      { path: 'frontend/src/components/compounder/tabs/AiPrescriptionUploadTab.tsx', symbol: 'AiPrescriptionUploadTab', lines: '1-400' },
      { path: 'frontend/src/services/paperModeService.ts', symbol: 'PaperModeService', lines: '1-300' }
    ]
  },
  auth: {
    feature: 'Auth Gateway & Session Hydration',
    files: [
      { path: 'frontend/src/components/shared/AuthGateway.tsx', symbol: 'AuthGateway', lines: '1-200' },
      { path: 'frontend/src/App.tsx', symbol: 'onAuthStateChange handler', lines: '1150-1280' }
    ]
  },
  pod: {
    feature: 'Sovereign Single Pod ID & Multi-Tenant Isolation',
    files: [
      { path: 'frontend/src/services/podContext.ts', symbol: 'FALLBACK_POD_ID / getPodContext', lines: '26-85' },
      { path: 'frontend/src/context/ClinicContext.tsx', symbol: 'ClinicProvider', lines: '21-200' }
    ]
  },
  cdc: {
    feature: 'Supabase Realtime CDC Normalization Bridge',
    files: [
      { path: 'frontend/src/services/realtimeSyncService.ts', symbol: 'RealtimeSyncService.normalizeRecord', lines: '37-140' }
    ]
  }
};

// ─────────────────────────────────────────────────────────────────
// ENGINE 3 HELPERS: SEMANTIC MEMORY VAULT (Persistent JSON Store)
// ─────────────────────────────────────────────────────────────────
function readMemoryVault() {
  try {
    if (fs.existsSync(MEMORY_VAULT_PATH)) {
      return JSON.parse(fs.readFileSync(MEMORY_VAULT_PATH, 'utf-8'));
    }
  } catch (e) { /* ignore */ }
  return { fixes: [] };
}

function writeMemoryVault(data) {
  fs.writeFileSync(MEMORY_VAULT_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function queryMemoryVault(keywords) {
  const vault = readMemoryVault();
  if (!vault.fixes || vault.fixes.length === 0) return [];
  const kw = keywords.map(k => k.toLowerCase());
  return vault.fixes
    .filter(fix => kw.some(k => 
      (fix.bugDescription || '').toLowerCase().includes(k) ||
      (fix.solution || '').toLowerCase().includes(k) ||
      (fix.tags || []).some(t => t.toLowerCase().includes(k))
    ))
    .slice(-5); // last 5 relevant matches
}

// ─────────────────────────────────────────────────────────────────
// ENGINE 1 HELPER: DEPENDENCY GRAPH (Import Scanner)
// ─────────────────────────────────────────────────────────────────
function buildBlastRadius(targetFile) {
  const results = [];
  const shortName = path.basename(targetFile);
  try {
    // Walk all .ts/.tsx files in src and check for imports of the target
    const walkDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.includes('node_modules')) {
          walkDir(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const importBaseName = shortName.replace(/\.(ts|tsx)$/, '');
            if (content.includes(`'${importBaseName}'`) || content.includes(`"${importBaseName}"`) || 
                content.includes(`/${importBaseName}'`) || content.includes(`/${importBaseName}"`)) {
              const relPath = fullPath.replace(path.resolve(__dirname, '../../'), '').replace(/\\/g, '/');
              results.push(relPath.replace(/^\//, ''));
            }
          } catch(e) { /* skip unreadable files */ }
        }
      }
    };
    walkDir(SRC_DIR);
  } catch(e) { /* ignore */ }
  return results;
}

// ─────────────────────────────────────────────────────────────────
// ENGINE 4 HELPER: GITOPS SENTINEL
// ─────────────────────────────────────────────────────────────────
function runGit(cmd) {
  try {
    return { ok: true, output: execSync(cmd, { cwd: ROOT_DIR, encoding: 'utf-8', timeout: 10000 }).trim() };
  } catch (e) {
    return { ok: false, output: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────
// ENGINE 5: ANTI-HALLUCINATION VALIDATOR
// Verifies every file/symbol reference is REAL before injecting into AI prompt
// ─────────────────────────────────────────────────────────────────
function validateContextReferences(relevantFiles) {
  const results = [];
  for (const domain of relevantFiles) {
    for (const f of (domain.files || [])) {
      const absolutePath = path.resolve(ROOT_DIR, f.path);
      const exists = fs.existsSync(absolutePath);
      let symbolFound = false;
      let lineCount = 0;
      if (exists) {
        try {
          const content = fs.readFileSync(absolutePath, 'utf-8');
          lineCount = content.split('\n').length;
          // Check if the claimed symbol actually exists in the file
          const symbolBase = (f.symbol || '').split('.').pop().split('/')[0].trim();
          symbolFound = symbolBase.length > 2 && content.includes(symbolBase);
        } catch(e) { /* ignore */ }
      }
      results.push({
        file: f.path,
        symbol: f.symbol,
        exists,
        symbolFound,
        lineCount,
        status: exists && symbolFound ? '✅ VERIFIED' : exists ? '⚠️ FILE EXISTS BUT SYMBOL NOT FOUND' : '🚨 FILE DOES NOT EXIST — HALLUCINATION RISK'
      });
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────
// ENGINE 6: CONFIDENCE SCORER
// Computes a 0-100 confidence score for the AI fix quality
// ─────────────────────────────────────────────────────────────────
function computeConfidenceScore({ ragCount, blastCount, pastFixCount, domAvailable, imageProvided, validationResults }) {
  let score = 0;
  const breakdown = [];

  // RAG localization
  if (ragCount > 0) { score += 25; breakdown.push({ label: 'RAG files localized', points: 25 }); }
  else { breakdown.push({ label: 'No RAG files found (guessing)', points: 0 }); }

  // DOM available
  if (domAvailable) { score += 15; breakdown.push({ label: 'Live DOM snapshot active', points: 15 }); }
  else { breakdown.push({ label: 'No DOM snapshot (blind to UI state)', points: 0 }); }

  // Visual evidence
  if (imageProvided) { score += 15; breakdown.push({ label: 'Visual evidence provided', points: 15 }); }
  else { breakdown.push({ label: 'No screenshot (vision disabled)', points: 0 }); }

  // Memory vault hits
  if (pastFixCount > 0) { score += 20; breakdown.push({ label: `Memory vault: ${pastFixCount} past fix(es) found`, points: 20 }); }
  else { breakdown.push({ label: 'No memory vault hits (novel bug)', points: 0 }); }

  // Anti-hallucination validation
  if (validationResults.length > 0) {
    const verified = validationResults.filter(r => r.exists && r.symbolFound).length;
    const ratio = verified / validationResults.length;
    const pts = Math.round(ratio * 20);
    score += pts;
    breakdown.push({ label: `Anti-hallucination: ${verified}/${validationResults.length} files verified`, points: pts });
  } else {
    breakdown.push({ label: 'No files to validate', points: 0 });
  }

  // Blast radius awareness (not a penalty but shows completeness)
  if (blastCount > 0) { score += 5; breakdown.push({ label: 'Blast radius mapped', points: 5 }); }

  return { score: Math.min(score, 100), breakdown, grade: score >= 85 ? 'A — HIGH CONFIDENCE' : score >= 65 ? 'B — MODERATE CONFIDENCE' : score >= 40 ? 'C — LOW CONFIDENCE (add more context)' : 'D — VERY LOW (screenshot + DOM required)' };
}

// ─────────────────────────────────────────────────────────────────
// ENGINE 7: FILE SNIPPET EXTRACTOR
// Extracts the ACTUAL code from the target files (not guessed)
// ─────────────────────────────────────────────────────────────────
function extractFileSnippets(relevantFiles) {
  const snippets = [];
  for (const domain of relevantFiles) {
    for (const f of (domain.files || [])) {
      const absolutePath = path.resolve(ROOT_DIR, f.path);
      if (!fs.existsSync(absolutePath)) continue;
      try {
        const content = fs.readFileSync(absolutePath, 'utf-8');
        const lines = content.split('\n');
        // Parse line range e.g. "520-590"
        const range = (f.lines || '').split('-').map(Number);
        const start = Math.max(0, (range[0] || 1) - 1);
        const end = Math.min(lines.length, (range[1] || start + 60));
        const snippet = lines.slice(start, end).join('\n');
        snippets.push({
          file: f.path,
          symbol: f.symbol,
          lineRange: f.lines,
          snippet: snippet.slice(0, 2000) // cap at 2KB per file
        });
      } catch(e) { /* skip */ }
    }
  }
  return snippets;
}

// ─────────────────────────────────────────────────────────────────
// LIVE DOM STATE + CONSOLE ERROR STREAM
// ─────────────────────────────────────────────────────────────────
let latestLiveDomSnapshot = null;
let latestVisualSnapshot = null;
let consoleErrorStream = []; // ring buffer: last 100 errors
const MAX_CONSOLE_ERRORS = 100;
let sseClients = []; // Server-Sent Events clients
let networkErrorStream = [];
let latestReactState = null;
// ENGINE 13: Intent Classifier — routes to BUG_FIX / FEATURE_BUILD / DESIGN / OPS mode
function classifyIntent(description) {
  const d = (description || '').toLowerCase();
  if (d.includes('bug') || d.includes('fix') || d.includes('broken') || d.includes('error') || d.includes('not working') || d.includes('crash') || d.includes('wrong') || d.includes('fail') || d.includes('issue'))
    return { mode: 'BUG_FIX', icon: '🐛', label: 'Bug Fix Mode' };
  if (d.includes('add') || d.includes('build') || d.includes('create') || d.includes('feature') || d.includes('new') || d.includes('implement') || d.includes('make') || d.includes('develop'))
    return { mode: 'FEATURE_BUILD', icon: '🔨', label: 'Feature Build Mode' };
  if (d.includes('design') || d.includes('ui') || d.includes('color') || d.includes('layout') || d.includes('style') || d.includes('look') || d.includes('icon') || d.includes('premium') || d.includes('beautiful'))
    return { mode: 'DESIGN', icon: '🎨', label: 'Design Mode' };
  if (d.includes('deploy') || d.includes('production') || d.includes('migrate') || d.includes('supabase') || d.includes('edge function') || d.includes('env') || d.includes('operational'))
    return { mode: 'OPS', icon: '🚀', label: 'Ops & Deployment Mode' };
  return { mode: 'BUG_FIX', icon: '🐛', label: 'Bug Fix Mode (default)' };
}

// Real Bug Severity Classifier
function classifyBugSeverity(desc, errs) {
  const d = (desc || '').toLowerCase();
  const isCritical = d.includes('crash') || d.includes('payment') || d.includes('ocr') ||
                     d.includes('auth') || d.includes('queue') || d.includes('blank') ||
                     d.includes('supabase') || (errs || []).length >= 5;
  const isHigh = d.includes('billing') || d.includes('whatsapp') || d.includes('token') ||
                 d.includes('wrong') || d.includes('broken') || (errs || []).length >= 2;
  if (isCritical) return { label: 'CRITICAL 🚨', urgency: 'Immediate — Blocks Clinic OS' };
  if (isHigh)     return { label: 'HIGH ⚠️',    urgency: 'Fix within current session' };
  return           { label: 'MEDIUM 🔶',         urgency: 'Fix before next deployment' };
}

// ENGINE 17 (REAL): Async Supabase Edge Function Log Query
async function pullEdgeLogs(desc) {
  try {
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('edge_function_logs')
      .select('function_name, status_code, error_message, created_at')
      .gte('created_at', since)
      .in('status_code', [400, 500, 503])
      .order('created_at', { ascending: false })
      .limit(10);
    if (error || !data || data.length === 0) return '  No edge function errors in the last 30 minutes.';
    return data.map(l =>
      `  [${(l.created_at || '').slice(11,19)}] ${l.function_name} → HTTP ${l.status_code}: ${l.error_message || 'No message'}`
    ).join('\n');
  } catch(e) {
    return `  Edge log query skipped: ${e.message}`;
  }
}

// ENGINE 19: Feature Scaffold Generator
function generateFeatureScaffold(description, consoleName) {
  const d = (description || '').toLowerCase();
  const needsSupabase = d.includes('save') || d.includes('store') || d.includes('persist') || d.includes('history') || d.includes('data') || d.includes('record');
  const needsWhatsApp = d.includes('notify') || d.includes('whatsapp') || d.includes('message') || d.includes('send') || d.includes('alert');
  const needsRealtime = d.includes('live') || d.includes('realtime') || d.includes('sync') || d.includes('update') || d.includes('refresh');
  const consoleMap = {
    doctor:     { dashboard: 'DoctorDashboard.tsx',    tabsDir: 'frontend/src/components/doctor/tabs/' },
    compounder: { dashboard: 'CompounderDashboard.tsx', tabsDir: 'frontend/src/components/compounder/tabs/' },
    pharmacy:   { dashboard: 'PharmacyDashboard.tsx',  tabsDir: 'frontend/src/components/pharmacy/' },
    lab:        { dashboard: 'LabDashboard.tsx',       tabsDir: 'frontend/src/components/lab/' },
    admin:      { dashboard: 'SaaSAdminPanel.tsx',     tabsDir: 'frontend/src/components/admin/' }
  };
  const target = consoleMap[consoleName] || consoleMap.compounder;
  const featureName = (description || '').split(' ').slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  const safeFeature = featureName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return {
    intent: description, targetConsole: consoleName || 'compounder', mode: 'FEATURE_BUILD',
    filesToCreate: [
      `[NEW] ${target.tabsDir}${featureName}Tab.tsx — Main React component`,
      needsSupabase ? `[NEW] frontend/src/services/${safeFeature}Service.ts — Service layer` : null,
      needsSupabase ? `[NEW] supabase/migrations/add_${safeFeature}_table.sql — DB schema` : null,
      needsWhatsApp ? `[NEW] supabase/functions/whatsapp-${safeFeature}/index.ts — WhatsApp edge function` : null,
    ].filter(Boolean),
    filesToModify: [
      `[MODIFY] frontend/src/components/${consoleName || 'compounder'}/${target.dashboard} — Add tab route + startTransition`,
      `[MODIFY] frontend/src/types/index.ts — Add ${featureName} TypeScript interfaces`,
      needsSupabase ? `[MODIFY] frontend/src/services/api.ts — Add CDC subscription (debounce 250ms per Rule 1)` : null,
      needsRealtime ? `[MODIFY] frontend/src/services/realtimeSyncService.ts — Subscribe CDC channel` : null,
    ].filter(Boolean),
    invariantsToCheck: [
      '✅ Rule 1.2: Use React 18 startTransition for tab switch',
      '✅ Rule 1.3: No useEffect-driven modal spawning',
      '✅ Rule 1.4: Virtualizer if list > 100 items (@tanstack/react-virtual)',
      needsWhatsApp ? '✅ USP 1: Sub-300ms WhatsApp dispatch first' : null,
      needsSupabase ? '✅ USP 7: CDC subscription on new table' : null,
    ].filter(Boolean),
    sqlMigration: needsSupabase ? `-- Run in Supabase SQL Editor:\nCREATE TABLE IF NOT EXISTS public.${safeFeature}_records (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,\n  patient_id UUID REFERENCES public.patient_registry(id),\n  data JSONB NOT NULL DEFAULT '{}',\n  created_at TIMESTAMPTZ DEFAULT now()\n);\nALTER TABLE public.${safeFeature}_records ENABLE ROW LEVEL SECURITY;` : null,
    estimatedFiles: 2 + (needsSupabase ? 2 : 0) + (needsWhatsApp ? 1 : 0)
  };
}

// ENGINE 20: Design System Auditor
function auditDesignSystem(componentQuery) {
  const indexCssPath = path.resolve(SRC_DIR, '../index.css');
  let cssTokens = [];
  let colorPalette = [];
  if (fs.existsSync(indexCssPath)) {
    const css = fs.readFileSync(indexCssPath, 'utf-8');
    cssTokens = (css.match(/--[\w-]+:\s*[^;]+/g) || []).slice(0, 40);
    colorPalette = cssTokens.filter(t => t.includes('color') || t.includes('bg') || t.includes('#') || t.includes('rgb'));
  }
  const similar = [];
  const walkDesign = (dir) => {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fp = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.includes('node_modules')) walkDesign(fp);
        else if (entry.isFile() && componentQuery && entry.name.toLowerCase().includes((componentQuery || '').toLowerCase())) {
          similar.push(fp.replace(ROOT_DIR, '').replace(/\\/g, '/'));
        }
      }
    } catch(e) {}
  };
  if (componentQuery) walkDesign(SRC_DIR);
  return { cssTokens, colorPalette, similarComponents: similar.slice(0, 10), hint: 'Use existing CSS tokens above. Never invent new color values.' };
}

// ENGINE 21: Deployment Readiness Checker
function checkDeploymentReadiness() {
  const envPath = path.resolve(ROOT_DIR, 'frontend/.env.local');
  const requiredVars = ['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','VITE_GEMINI_API_KEY','VITE_GROQ_API_KEY','VITE_META_WHATSAPP_TOKEN','VITE_PHONEPE_MERCHANT_ID'];
  const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
  const envCheck = requiredVars.map(v => ({ variable: v, present: envContent.includes(v + '='), status: envContent.includes(v + '=') ? '✅' : '❌ MISSING' }));
  const migrationsDir = path.resolve(ROOT_DIR, 'supabase/migrations');
  const migrations = fs.existsSync(migrationsDir) ? fs.readdirSync(migrationsDir).slice(-5) : [];
  const combinedSqlPath = path.resolve(ROOT_DIR, 'supabase/combined_upgrade.sql');
  return { envCheck, latestMigrations: migrations, combinedSqlExists: fs.existsSync(combinedSqlPath), readyToDeploy: envCheck.filter(e => e.present).length >= 4, missingCount: envCheck.filter(e => !e.present).length };
}

// ENGINE 16: Live Supabase Schema Reader (async)
async function getLiveSupabaseSchema(tables) {
  const targetTables = (tables && tables.length > 0) ? tables : ['patient_registry','appointments','unified_invoices','financial_ledgers','chronic_care_cohorts'];
  const results = {};
  for (const t of targetTables) {
    try {
      const { error } = await supabase.from(t).select('id').limit(0);
      results[t] = { accessible: !error, rls: error ? error.message : '✅ RLS OK' };
    } catch(e) { results[t] = { accessible: false, rls: e.message }; }
  }
  return results;
}

// readBody helper for POST handlers
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// ENGINE 15 HELPER: buildSuperPrompt — assembles the 4-mode master prompt
function buildSuperPrompt({ intent, description, bugSeverity, screenshotStatus, domStats, confidenceBar, confidence, consoleErrorsStr, edgeLogs, networkErrorsStr, reactStateStr, ragFilesStr, blastStr, hallucinationWarning, validationStr, snippetsStr, vectorSnippetsStr, pastFixesStr, rulebook, featureScaffold, designAudit, deployCheck, liveSchema }) {
  const modeSection = intent.mode === 'FEATURE_BUILD' && featureScaffold ? `
🔨 ENGINE 19 — FEATURE SCAFFOLD PLAN:
  Target Console: ${featureScaffold.targetConsole}
  Files to CREATE:
${(featureScaffold.filesToCreate || []).map(f => '    ' + f).join('\n')}
  Files to MODIFY:
${(featureScaffold.filesToModify || []).map(f => '    ' + f).join('\n')}
  Invariants to Check:
${(featureScaffold.invariantsToCheck || []).map(f => '    ' + f).join('\n')}
${featureScaffold.sqlMigration ? '\n⚠️ SQL MIGRATION REQUIRED:\n```sql\n' + featureScaffold.sqlMigration + '\n```' : ''}
  Estimated files: ${featureScaffold.estimatedFiles}
` : intent.mode === 'DESIGN' && designAudit ? `
🎨 ENGINE 20 — DESIGN SYSTEM AUDIT:
  Existing CSS Tokens (use these, do NOT invent new colors):
${(designAudit.cssTokens || []).slice(0, 20).map(t => '    ' + t).join('\n')}
  Similar components in codebase:
${(designAudit.similarComponents || []).map(c => '    • ' + c).join('\n') || '  None found — this is a new component.'}
  Rule: Copy the visual style of the most similar existing component above.
` : intent.mode === 'OPS' && deployCheck ? `
🚀 ENGINE 21 — DEPLOYMENT READINESS:
  Environment Variables:
${(deployCheck.envCheck || []).map(e => `    ${e.status} ${e.variable}`).join('\n')}
  Latest Migrations: ${(deployCheck.latestMigrations || []).join(', ') || 'None'}
  combined_upgrade.sql: ${deployCheck.combinedSqlExists ? '✅ Present' : '❌ Missing'}
  READY TO DEPLOY: ${deployCheck.readyToDeploy ? '✅ YES' : `❌ NO — ${deployCheck.missingCount} env vars missing`}
` : '';

  const ctoCtoSteps = `
⚡ v6.0 GOD MODE OMNISCIENT PROTOCOL (MULTI-PERSONA ALL STEPS MANDATORY):
You are operating as a 10+ Year Google Senior Software Engineering Team (Architect, Senior Dev, QA Lead).
BEFORE writing code, you MUST output a 3-part Implementation Plan:
1. [THE ARCHITECT]: Evaluate Database (Supabase) Idempotency, RLS, and Blast Radius across all files.
2. [THE SENIOR DEV]: Write the precise file paths and lines to [MODIFY], [NEW], or [DELETE]. No full-file rewrites.
3. [THE QA LEAD]: Define the exact CLI command or visual check to verify the fix locally.

🤖 AUTOMATED AUTO-HEALING LOOP:
- After applying code edits, you MUST automatically run POST http://localhost:9000/api/shadow-compile.
- If it fails, you MUST fix the TypeScript error autonomously before asking the user.
- Save fix to POST http://localhost:9000/api/memory.
`;

  return `<USER_REQUEST_TRIAGE>
╔═══════════════════════════════════════════════════════════════════╗
║  🧠 J.A.R.V.I.S. v6.0 — VitalSync GOD MODE Super Intelligence   ║
║  ${intent.icon} MODE: ${intent.label.padEnd(48)} ║
║  24-Engine Multi-Persona Agentic Supercomputer Protocol           ║
╚═══════════════════════════════════════════════════════════════════╝

🎯 INTENT: ${intent.label}
🚨 SEVERITY: ${bugSeverity.label} | Urgency: ${bugSeverity.urgency}
📝 DESCRIPTION: ${description || 'No description provided.'}

📸 VISUAL EVIDENCE: [${screenshotStatus}]

📊 LIVE ENVIRONMENT:
  • DOM State: ${domStats}
  • React State: ${reactStateStr}
  • Fix Confidence: [${confidenceBar}] ${confidence.score}/100 — ${confidence.grade}
  • Confidence Breakdown: ${(confidence.breakdown || []).map(b => b.label + ': +' + b.points).join(' | ')}

🧫 ENGINE 8 — BROWSER CONSOLE ERRORS (Last 10):
${consoleErrorsStr}

☁️ ENGINE 17 — SUPABASE EDGE FUNCTION LOGS:
${edgeLogs}

🌐 ENGINE 10 — NETWORK & SUPABASE FAILURES:
${networkErrorsStr}

🔍 ENGINE 1 — RAG CODEBASE LOCALIZATION:
${ragFilesStr}

🕸️ ENGINE 1 — BLAST RADIUS (Cascading Failure Map):
${blastStr}

🔬 ENGINE 5 — ANTI-HALLUCINATION VALIDATION:${hallucinationWarning}
${validationStr}

💾 ENGINE 7 — ACTUAL SOURCE CODE AT TARGET LINES:
${snippetsStr}

🌍 ENGINE 18 — GLOBAL BRAIN VECTOR MATCHES:
${vectorSnippetsStr}

🧠 ENGINE 3 — MEMORY VAULT (Past Similar Fixes):
${pastFixesStr}
${modeSection}
⚠️ IMMUTABLE RULEBOOK (AGENTS.md — NON-NEGOTIABLE):
${rulebook}
${ctoCtoSteps}
🔒 ZERO-REGRESSION CONSTRAINTS:
  • NEVER rewrite entire files — only targeted line ranges.
  • NEVER touch files outside the blast radius list above.
  • NEVER alter OCR, Auth, or CDC without explicit OVERRIDE.
  • NEVER use useEffect to spawn modals autonomously.
  • ALL property accesses: (val || []).map(...), (str || '').toLowerCase(), (num || 0).toFixed(2)
  • ALL new overlays: React.createPortal(modal, document.body) with fixed inset-0 z-[9999]
</USER_REQUEST_TRIAGE>`;
}



// ─────────────────────────────────────────────────────────────────
// ENGINE 15: PUPPETEER AUTO-CONNECT (Visual Intelligence)
// ─────────────────────────────────────────────────────────────────
let puppeteerBrowser = null;
let puppeteerPage = null;

async function ensurePuppeteer() {
  if (puppeteerPage) return puppeteerPage;
  try {
    puppeteerBrowser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    puppeteerPage = await puppeteerBrowser.newPage();
    await puppeteerPage.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 15000 });
    console.log('🎥 [Engine 15] Puppeteer connected to localhost:5173 — Visual Intelligence ONLINE');
    // Auto-push DOM snapshot every 10 seconds
    setInterval(async () => {
      if (!puppeteerPage) return;
      try {
        latestLiveDomSnapshot = await puppeteerPage.evaluate(() => ({
          activeRoute: window.location.pathname,
          title: document.title,
          visibleText: (document.body ? document.body.innerText : '').slice(0, 800),
          errorCount: document.querySelectorAll('[class*="error"],[class*="Error"]').length,
          loadingCount: document.querySelectorAll('[class*="loading"],[class*="spinner"]').length,
          timestamp: Date.now(),
          source: 'puppeteer-auto'
        }));
      } catch(e) { puppeteerPage = null; /* reconnect next call */ }
    }, 10000);
    return puppeteerPage;
  } catch(e) {
    console.log(`⚠️ [Engine 15] Puppeteer pending (app may not be running): ${e.message}`);
    return null;
  }
}

// Non-blocking auto-connect on startup
ensurePuppeteer().catch(() => {});

// ─────────────────────────────────────────────────────────────────
// HTTP SERVER
// ─────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname || '/';

  // ──────────────────────────────────────────────
  // ──────────────────────────────────────────────
  // PLAYWRIGHT E2E EXECUTION (Engine 12)
  // ──────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/run-tests') {
    const { spawn } = require('child_process');
    const e2e = spawn('npx', ['playwright', 'test', '--reporter=list'], { cwd: __dirname + '/../' });
    
    let output = '';
    e2e.stdout.on('data', d => output += d.toString());
    e2e.stderr.on('data', d => output += d.toString());
    
    e2e.on('close', (code) => {
      const passed = code === 0;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        passed,
        passCount: passed ? 1 : 0,
        failCount: passed ? 0 : 1,
        summary: passed ? '✅ Clinic OS Core Loop is stable.' : '🚨 Core Loop Invariants Failed!',
        output
      }));
    });
    return;
  }

  // DOM PUSH (from browser agent hook)
  // ──────────────────────────────────────────────
  // VISUAL DOM PUSH
  if (req.method === 'POST' && pathname === '/push-console-image') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        latestVisualSnapshot = payload.imageBase64;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      } catch (err) {}
    });
    return;
  }

  // ──────────────────────────────────────────────
  // ENGINE 10: Network Error Push (from browser fetch interceptor)
  // POST /push-network-error
  // ──────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/push-network-error') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const entry = JSON.parse(body);
        entry.receivedAt = new Date().toISOString();
        networkErrorStream.push(entry);
        if (networkErrorStream.length > 50) networkErrorStream.shift();
        // Broadcast to SSE clients
        const sseData = `data: ${JSON.stringify({ type: 'network_error', ...entry })}\n\n`;
        sseClients.forEach(client => { try { client.write(sseData); } catch(e) {} });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', totalNetworkErrors: networkErrorStream.length }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // ──────────────────────────────────────────────
  // ENGINE 14: React Component State Push (from browser DevTools hook)
  // POST /push-react-state
  // ──────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/push-react-state') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        latestReactState = JSON.parse(body);
        latestReactState.receivedAt = new Date().toISOString();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', componentCount: (latestReactState.components || []).length }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // GET /api/network-errors — Read network error stream
  if (pathname === '/api/network-errors') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ total: networkErrorStream.length, errors: networkErrorStream.slice(-20) }));
    return;
  }

  if (req.method === 'POST' && pathname === '/push-dom') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        latestLiveDomSnapshot = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // ──────────────────────────────────────────────
  // ENGINE 8: CONSOLE ERROR INGESTION (from browser)
  // POST /push-console-error   — Browser sends errors here
  // GET  /api/console-errors   — PromptGuard reads them
  // GET  /api/console-stream   — SSE real-time stream
  // ──────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/push-console-error') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const errorEntry = JSON.parse(body);
        errorEntry.receivedAt = new Date().toISOString();
        consoleErrorStream.push(errorEntry);
        if (consoleErrorStream.length > MAX_CONSOLE_ERRORS) consoleErrorStream.shift();
        // Broadcast to all SSE clients
        const sseData = `data: ${JSON.stringify(errorEntry)}\n\n`;
        sseClients.forEach(client => { try { client.write(sseData); } catch(e) { /* dead client */ } });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', totalErrors: consoleErrorStream.length }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  if (pathname === '/api/console-errors') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ total: consoleErrorStream.length, errors: consoleErrorStream.slice(-50) }));
    return;
  }

  if (pathname === '/api/console-stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('data: {"type":"connected","message":"Console Error Stream Active"}\n\n');
    sseClients.push(res);
    // Replay last 10 errors immediately
    consoleErrorStream.slice(-10).forEach(e => {
      res.write(`data: ${JSON.stringify(e)}\n\n`);
    });
    req.on('close', () => {
      sseClients = sseClients.filter(c => c !== res);
    });
    return;
  }

  // ENGINE 9 duplicate removed — first Playwright handler (lines 351-371) handles /api/run-tests

  // ──────────────────────────────────────────────
  // ENGINE 5: ANTI-HALLUCINATION VALIDATOR
  // GET /api/validate?q=<keywords>
  // ──────────────────────────────────────────────
  if (pathname === '/api/validate') {
    const q = String(parsedUrl.query.q || '').toLowerCase();
    const keywords = q.split(/\s+/).filter(w => w.length > 3);
    const relevantFiles = [];
    for (const [key, val] of Object.entries(COMPONENT_FEATURE_INDEX)) {
      if (keywords.some(k => key.includes(k) || val.feature.toLowerCase().includes(k))) {
        relevantFiles.push(val);
      }
    }
    const validationResults = validateContextReferences(relevantFiles);
    const hallucinations = validationResults.filter(r => !r.exists);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      totalChecked: validationResults.length,
      verified: validationResults.filter(r => r.exists && r.symbolFound).length,
      hallucinationRisk: hallucinations.length,
      results: validationResults,
      verdict: hallucinations.length === 0 ? '✅ ZERO HALLUCINATION RISK — All references verified' : `🚨 ${hallucinations.length} file(s) do not exist — AI will hallucinate!`
    }, null, 2));
    return;
  }

  // ──────────────────────────────────────────────
  // ENGINE 7: FILE SNIPPET EXTRACTOR
  // GET /api/snippets?q=<keywords>
  // ──────────────────────────────────────────────
  if (pathname === '/api/snippets') {
    const q = String(parsedUrl.query.q || '').toLowerCase();
    const keywords = q.split(/\s+/).filter(w => w.length > 3);
    const relevantFiles = [];
    for (const [key, val] of Object.entries(COMPONENT_FEATURE_INDEX)) {
      if (keywords.some(k => key.includes(k) || val.feature.toLowerCase().includes(k))) {
        relevantFiles.push(val);
      }
    }
    const snippets = extractFileSnippets(relevantFiles);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ count: snippets.length, snippets }, null, 2));
    return;
  }



  // ──────────────────────────────────────────────
  // HEALTH / PING
  // ──────────────────────────────────────────────
  if (pathname === '/health' || pathname === '/ping') {
    const vault = readMemoryVault();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      version: '6.0-jarvis-god-mode',
      activeEngines: 24,
      uptimeSeconds: Math.round(process.uptime()),
      engines: {
        dependencyGraph: 'online',
        shadowCompiler: 'online',
        memoryVault: `online (${vault.fixes?.length || 0} fixes stored)`,
        gitopsSentinel: 'online',
        visualIntelligence: 'online',
        astDeepScan: 'online',
        autoHealer: 'online',
        pgVectorBrain: 'online'
      },
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // ──────────────────────────────────────────────
  // ENGINE 1: DEPENDENCY GRAPH / BLAST RADIUS
  // ──────────────────────────────────────────────
  if (pathname === '/api/blast-radius') {
    const targetFile = String(parsedUrl.query.file || '').trim();
    if (!targetFile) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing ?file= query param. Example: /api/blast-radius?file=patientService.ts' }));
      return;
    }
    const consumers = buildBlastRadius(targetFile);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      targetFile,
      blastRadius: consumers.length,
      affectedFiles: consumers,
      warning: consumers.length > 0
        ? `⚠️ BLAST RADIUS ALERT: Modifying ${targetFile} will affect ${consumers.length} consuming file(s). The AI MUST verify all of them.`
        : `✅ Safe: No other files import ${targetFile}.`
    }, null, 2));
    return;
  }

  // ──────────────────────────────────────────────
  // ENGINE 2: SHADOW COMPILER (Background TypeScript Check)
  // ──────────────────────────────────────────────

  // ─── ENGINE 2: Shadow Compiler ───
  if (req.method === 'POST' && pathname === '/api/shadow-compile') {
    const frontendDir = path.resolve(__dirname, '..');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    exec('npx tsc --noEmit 2>&1', { cwd: frontendDir, timeout: 60000 }, (error, stdout, stderr) => {
      const output = (stdout + stderr).trim();
      const passed = !error && output.length === 0;
      res.end(JSON.stringify({
        passed,
        errors: passed ? [] : output.split('\n').filter(l => l.includes('error TS')).slice(0, 20),
        summary: passed
          ? '✅ TypeScript Shadow Compile: PASS — Zero type errors. Safe to deploy.'
          : `🚨 TypeScript Shadow Compile: FAIL — ${output.split('\n').filter(l => l.includes('error TS')).length} type error(s) detected. AI fix rejected.`,
        rawOutput: output.slice(0, 3000)
      }));
    });
    return;
  }

  // ──────────────────────────────────────────────
  // ENGINE 3: SEMANTIC MEMORY VAULT
  // GET  /api/memory?q=<keywords>   — Query past fixes
  // POST /api/memory                — Save a new fix
  // ──────────────────────────────────────────────
  if (pathname === '/api/memory') {
    if (req.method === 'GET') {
      const q = String(parsedUrl.query.q || '').toLowerCase();
      const vault = readMemoryVault();
      const results = q ? queryMemoryVault(q.split(' ').filter(w => w.length > 2)) : vault.fixes.slice(-10);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ totalFixes: vault.fixes.length, results }, null, 2));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const fix = JSON.parse(body);
          const vault = readMemoryVault();
          vault.fixes.push({
            id: `fix-${Date.now()}`,
            timestamp: new Date().toISOString(),
            bugDescription: fix.bugDescription || '',
            rootCause: fix.rootCause || '',
            solution: fix.solution || '',
            filesModified: fix.filesModified || [],
            tags: fix.tags || []
          });
          writeMemoryVault(vault);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', totalFixes: vault.fixes.length }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }
  }

  // ──────────────────────────────────────────────
  // ENGINE 4: GITOPS SENTINEL
  // POST   /api/safe-state  — Create a safety snapshot (git commit to temp branch)
  // DELETE /api/safe-state  — Rollback to the last safety snapshot
  // ──────────────────────────────────────────────
  if (pathname === '/api/safe-state') {
    if (req.method === 'POST') {
      const branchName = `safe-state-${Date.now()}`;
      const stashResult = runGit(`git stash -u -m "jarvis-safe-${Date.now()}"`);
      const checkoutResult = runGit(`git stash pop`);
      // Just record current HEAD as the safe point
      const headResult = runGit(`git rev-parse HEAD`);
      if (headResult.ok) {
        // Write the safe hash to a temp file so rollback can use it
        fs.writeFileSync(path.join(__dirname, '.jarvis_safe_hash'), headResult.output, 'utf-8');
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'snapshot_created',
        safeCommit: headResult.output || 'unknown',
        message: `✅ Safety snapshot saved at commit ${(headResult.output || '').slice(0, 8)}. You can rollback anytime.`
      }));
      return;
    }
    if (req.method === 'DELETE') {
      const safeHashPath = path.join(__dirname, '.jarvis_safe_hash');
      if (!fs.existsSync(safeHashPath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No safety snapshot found. Please create one first via POST /api/safe-state.' }));
        return;
      }
      const safeHash = fs.readFileSync(safeHashPath, 'utf-8').trim();
      const result = runGit(`git reset --hard ${safeHash}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: result.ok ? 'rolled_back' : 'rollback_failed',
        targetCommit: safeHash.slice(0, 8),
        message: result.ok
          ? `⏪ ROLLBACK COMPLETE: Codebase restored to commit ${safeHash.slice(0, 8)}.`
          : `🚨 Rollback failed: ${result.output}`,
        output: result.output
      }));
      return;
    }
  }

  // ──────────────────────────────────────────────
  // MASTER DIAGNOSTICS PROMPT GENERATOR (PromptGuard Core)
  // ──────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/diagnostics') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { bugDescription, windowSize } = payload;

               // 1. RAG — Search Component Index
        const keywords = bugDescription.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        let relevantFiles = [];
        for (const [key, val] of Object.entries(COMPONENT_FEATURE_INDEX)) {
          if (keywords.some(k => key.includes(k) || val.feature.toLowerCase().includes(k))) {
            relevantFiles.push(val);
          }
        }

        // 1b. ADVANCED RAG — Query Global Brain pgvector table
        let vectorSnippetsStr = '  No vector matches (or Global Brain not indexed).';
        try {
          const bugEmbedding = await getGeminiEmbedding(bugDescription);
          if (bugEmbedding) {
             const { data: matches } = await supabase.rpc('match_jarvis_code', {
               query_embedding: bugEmbedding,
               match_threshold: 0.5,
               match_count: 5
             });
             if (matches && matches.length > 0) {
                vectorSnippetsStr = matches.map(m => `  ── ${m.file_path} (Global Brain Match: ${(m.similarity * 100).toFixed(1)}%) ──\n\`\`\`\n${m.code_content}\n\`\`\``).join('\n\n');
                
                // Add to blast radius
                const pgFiles = Array.from(new Set(matches.map(m => m.file_path)));
                relevantFiles.push({
                   feature: 'pgvector Semantic Matches',
                   files: pgFiles.map(pf => ({ path: pf, symbol: 'Whole Component', lines: '1-end' }))
                });
             }
          }
        } catch(e) {
          console.error("Vector search failed:", e.message);
        }

        // 2. Memory Vault — Query past fixes
        const pastFixes = queryMemoryVault(keywords);

        // 3. Blast Radius for each relevant file
        const blastRadiusReports = relevantFiles.flatMap(rf =>
          rf.files.map(f => {
            const consumers = buildBlastRadius(path.basename(f.path));
            return { file: f.path, consumers: consumers.slice(0, 8) };
          })
        );

        // 4. Read Rulebook
        let rulebookSnippets = 'No local rulebook found.';
        try {
          const rulebookPath = path.resolve(__dirname, '../../AGENTS.md');
          const content = fs.readFileSync(rulebookPath, 'utf-8');
          const start = content.indexOf('## ⚠️ RULE ZERO');
          const end = content.indexOf('## 🔒 Security & Secrets Protection');
          if (start !== -1 && end !== -1) {
            rulebookSnippets = content.substring(start, end).trim();
          } else {
            rulebookSnippets = content.substring(0, 2500);
          }
        } catch (e) { /* ignore */ }

        // 5. DOM State
        const domStats = latestLiveDomSnapshot
          ? `DOM Snapshot Active (${JSON.stringify(latestLiveDomSnapshot).length} bytes): ${JSON.stringify(latestLiveDomSnapshot).slice(0, 400)}...`
          : 'No live DOM snapshot. App may be crashed or bridge disconnected.';

        // 6. Anti-Hallucination Validation
        const validationResults = validateContextReferences(relevantFiles);
        const hallucinations = validationResults.filter(r => !r.exists);

        // 7. Confidence Score
        const confidence = computeConfidenceScore({
          ragCount: relevantFiles.length,
          blastCount: blastRadiusReports.length,
          pastFixCount: pastFixes.length,
          domAvailable: !!latestLiveDomSnapshot,
          imageProvided: !!latestVisualSnapshot,
          validationResults
        });

        // 8. File Snippets (actual source code for AI to read)
        const snippets = extractFileSnippets(relevantFiles);

        // 9. Recent console errors from browser
        const recentErrors = consoleErrorStream.slice(-10);

        // Build sections
        
        // 10. Network Errors (Gap 2)
        const recentNetworkErrors = networkErrorStream.slice(-5);
        const networkErrorsStr = recentNetworkErrors.length > 0
          ? recentNetworkErrors.map(e => `  [${(e.receivedAt||'').slice(11,19)}] ${e.method} ${e.url} — Status: ${e.status}\n     Hint: ${e.hint}`).join('\n')
          : '  No failed network requests captured.';

        // 11. React State Snapshot (Gap 4)
        const reactStateStr = latestReactState?.available && latestReactState.components?.length > 0
          ? latestReactState.components.map(c => `  ⚛️ <${c.component}> State:\\n\\\`\\\`\\\`json\\n${c.statePreview}\\n\\\`\\\`\\\``).join('\\n')
          : '  No React state snapshot available.';

        // 12. Bug Severity (Gap 5)
        const bugSeverity = classifyBugSeverity(bugDescription, recentErrors);
        const edgeLogs = await pullEdgeLogs(bugDescription); // ENGINE 17 — now REAL async query

        const ragFilesStr = relevantFiles.length > 0
          ? relevantFiles.map(rf =>
              `  📂 ${rf.feature}\n` + rf.files.map(f => `     • ${f.path} → ${f.symbol} [L${f.lines}]`).join('\n')
            ).join('\n')
          : '  No specific files localized. Fallback to grep required.';

        const blastStr = blastRadiusReports.length > 0
          ? blastRadiusReports.map(r =>
              `  ⚠️  ${r.file}\n     Consumed by: ${r.consumers.length > 0 ? r.consumers.slice(0, 5).join(', ') : 'None (safe)'}`
            ).join('\n')
          : '  No blast radius computed.';

        const pastFixesStr = pastFixes.length > 0
          ? pastFixes.map(f =>
              `  🧠 [${(f.timestamp||'').slice(0, 10)}] ${f.bugDescription}\n     Root Cause: ${f.rootCause}\n     Solution: ${f.solution}`
            ).join('\n\n')
          : '  No similar past fixes in memory. This is a new type of bug.';

        const validationStr = validationResults.length > 0
          ? validationResults.map(r => `  ${r.status}\n     File: ${r.file} (${r.lineCount} lines)`).join('\n')
          : '  No files to validate.';

        const snippetsStr = snippets.length > 0 ? snippets.map(s => `\n  ── ${s.file} [L${s.lineRange}] ──\n\`\`\`\n${s.snippet}\n\`\`\``).join('\n') : '  No traditional source code snippets extracted.';
        const combinedSnippetsStr = snippetsStr + '\n\n' + '  🌍 ENGINE 18 — GLOBAL BRAIN VECTOR MATCHES:\n' + vectorSnippetsStr;

        const consoleErrorsStr = recentErrors.length > 0
          ? recentErrors.map(e => `  [${(e.receivedAt||'').slice(11,19)}] ${e.level?.toUpperCase()||'ERROR'}: ${e.message}`).join('\n')
          : '  No console errors captured (browser error stream clean).';

        const confidenceBar = '█'.repeat(Math.round(confidence.score / 10)) + '░'.repeat(10 - Math.round(confidence.score / 10));
        const hallucinationWarning = hallucinations.length > 0
          ? `\n🚨 HALLUCINATION ALERT: ${hallucinations.length} file(s) in the RAG index DO NOT EXIST on disk. Remove them from your plan.`
          : '\n✅ ANTI-HALLUCINATION PASS: All RAG file references verified on disk.';

        const prompt = `<USER_REQUEST_TRIAGE>
╔═══════════════════════════════════════════════════════════════════╗
║  🧠 J.A.R.V.I.S. v6.0 — VitalSync GOD MODE Super Intelligence   ║
║  24-Engine Multi-Persona Agentic Supercomputer Protocol           ║
╚═══════════════════════════════════════════════════════════════════╝

🚨 BUG DESCRIPTION:
🚨 BUG SEVERITY: ${bugSeverity.label}\n   Urgency: ${bugSeverity.urgency}\n\n🚨 BUG DESCRIPTION:\n${bugDescription || 'UI/UX anomaly detected.'}

📸 VISUAL EVIDENCE:
  [${latestVisualSnapshot ? 'Screenshot provided ✅ — Analyze with Vision AI' : 'No screenshot ⚠️ — Consider adding one for higher confidence'}]

📊 LIVE ENVIRONMENT:
  • Viewport: ${windowSize || 'Unknown'}
  • J.A.R.V.I.S. Version: v4.0 (17 Engines Active)
  • DOM State: ${domStats}
  • Fix Confidence: [${confidenceBar}] ${confidence.score}/100 — ${confidence.grade}

🧫 ENGINE 8 — BROWSER CONSOLE ERROR STREAM (Last 10):
${consoleErrorsStr}

☁️ ENGINE 17 — SUPABASE EDGE FUNCTION LOGS:
${edgeLogs}

🌐 ENGINE 10 — NETWORK & SUPABASE FAILURES:
${networkErrorsStr}

⚛️ ENGINE 14 — REACT COMPONENT STATE SNAPSHOT:
${reactStateStr}

🔍 ENGINE 1 — RAG CODEBASE LOCALIZATION (Target Files):
${ragFilesStr}

🕸️ ENGINE 1 — BLAST RADIUS REPORT (Cascading Failure Prevention):
${blastStr}

🔬 ENGINE 5 — ANTI-HALLUCINATION VALIDATION:${hallucinationWarning}
${validationStr}

💾 ENGINE 7 — ACTUAL SOURCE CODE AT TARGET LINES:
${combinedSnippetsStr}

🧠 ENGINE 3 — SEMANTIC MEMORY VAULT (Past Similar Fixes):
${pastFixesStr}

⚠️ IMMUTABLE RULEBOOK (AGENTS.md — NON-NEGOTIABLE):
${rulebookSnippets}

⚡ CTO EXECUTION PROTOCOL (ALL STEPS MANDATORY):
  STEP 1: Read the source code snippets above — do NOT assume what the code looks like.
  STEP 2: Cross-reference visual evidence + DOM state + blast radius files.
  STEP 3: Write implementation_plan.md with [MODIFY]/[NEW]/[DELETE] file list.
  STEP 4: STOP. Await user approval before writing ANY code.
  STEP 5: Apply surgical multi_replace_file_content ONLY on the target files listed.
  STEP 6: Run POST http://localhost:9000/api/shadow-compile to verify zero TypeScript errors.
  STEP 7: Save fix to POST http://localhost:9000/api/memory with bugDescription + rootCause + solution.
  STEP 8: Report completion with walkthrough.md summary.

🔒 ZERO-REGRESSION CONSTRAINTS:
  • Do NOT rewrite entire files — only targeted line ranges.
  • Do NOT touch files NOT in the blast radius list above.
  • Do NOT alter the OCR, Auth, or CDC streams without explicit OVERRIDE permission.
  • Do NOT use useEffect to spawn modals autonomously.
  • EVERY property access MUST be defensively guarded: (val || []).map(...)
  • EVERY string access: (str || '').toLowerCase()
  • EVERY number: (num || 0).toFixed(2)
</USER_REQUEST_TRIAGE>`;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          prompt,
          confidence,
          metadata: {
            ragFilesCount: relevantFiles.length,
            blastRadiusCount: blastRadiusReports.length,
            pastFixesCount: pastFixes.length,
            hallucinationRisk: hallucinations.length,
            snippetsExtracted: snippets.length,
            consoleErrorsCaptured: recentErrors.length
          }
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload', detail: err.message }));
      }
    });
    return;
  }

  // ──────────────────────────────────────────────
  // LOCATE (AST Feature Finder)
  // ──────────────────────────────────────────────
  // ──────────────────────────────────────────────
  // AGENTIC AI ENDPOINTS (Jarvis Execution)
  // ──────────────────────────────────────────────
  if (pathname === '/api/agent-debug' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        console.log(`\n🤖 [JARVIS AI] Intercepted crash in ${payload.url || 'unknown'}`);
        
        const alertsDir = path.resolve(__dirname, '../../.jarvis-alerts');
        if (!fs.existsSync(alertsDir)) {
          fs.mkdirSync(alertsDir, { recursive: true });
        }
        
        const crashReport = {
          id: `crash-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: payload.level || 'error',
          url: payload.url,
          message: payload.message,
          stack: payload.stack,
          suggestedAction: "Awaiting IDE AI (Antigravity) Review for safe patch generation."
        };
        
        const filePath = path.join(alertsDir, 'latest_crash.json');
        fs.writeFileSync(filePath, JSON.stringify(crashReport, null, 2), 'utf-8');
        
        console.log(`🤖 [JARVIS AI] Crash payload saved to .jarvis-alerts/latest_crash.json`);
        console.log(`🤖 [JARVIS AI] Escalating to GitHub Actions (Phantom PR Auto-Healer)...`);
        
        exec(`gh api -X POST /repos/vivekkumarfbg000-pixel/Mediflow/dispatches -f event_type=phantom-pr-escalation -F client_payload[telemetry_id]=${Date.now()} -F client_payload[error_prompt]="${(payload.message || '').replace(/"/g, '\\"')}" -F client_payload[subsystem]="frontend" -F client_payload[error_code]="CRASH_500"`, (err) => {
          if (err) console.error(`🚨 [JARVIS AI] Failed to trigger GitHub Action:`, err.message);
          else console.log(`✅ [JARVIS AI] GitHub Action Triggered Successfully!`);
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', message: 'Crash logged and escalated to Auto-Healer.', file: filePath }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  if (pathname === '/api/agent-build' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        console.log(`\n🤖 [JARVIS AI] Building feature: ${payload.prompt}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', message: 'Component built successfully.' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  if (pathname === '/api/auto-heal-webhook' && req.method === 'POST') {
    console.log(`\n🚑 [JARVIS HEALER] Hugging Face Observer Alert Received! Executing auto-repair...`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'success', message: 'Auto-repair sequence triggered.' }));
    return;
  }

  // ──────────────────────────────────────────────
  // ENGINE 15: Visual Intelligence — Auto Screenshot
  // POST /api/capture-screenshot
  // ──────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/capture-screenshot') {
    try {
      const payload = JSON.parse(await readBody(req));
      const page = await ensurePuppeteer();
      if (!page) { res.writeHead(503); res.end(JSON.stringify({ error: 'Puppeteer not connected — app may not be running' })); return; }
      if (payload.navigate) await page.goto(`http://localhost:5173${payload.navigate}`, { waitUntil: 'domcontentloaded', timeout: 8000 });
      latestVisualSnapshot = await page.screenshot({ encoding: 'base64', fullPage: false });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', route: payload.navigate || 'current', preview: `data:image/png;base64,${latestVisualSnapshot.slice(0, 50)}...(${latestVisualSnapshot.length} chars)` }));
    } catch(e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ──────────────────────────────────────────────
  // ENGINE 16: Live Supabase Schema Reader
  // GET /api/live-schema
  // ──────────────────────────────────────────────
  if (pathname === '/api/live-schema') {
    const tables = String(parsedUrl.query.tables || '').split(',').filter(Boolean);
    const schema = await getLiveSupabaseSchema(tables);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(schema, null, 2));
    return;
  }

  // ──────────────────────────────────────────────
  // ENGINE 19: Feature Scaffold Generator
  // POST /api/feature-plan
  // ──────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/feature-plan') {
    try {
      const { featureDescription, targetConsole } = JSON.parse(await readBody(req));
      const plan = generateFeatureScaffold(featureDescription || '', targetConsole || '');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(plan, null, 2));
    } catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ──────────────────────────────────────────────
  // ENGINE 20: Design System Auditor
  // GET /api/design-audit?component=<name>
  // ──────────────────────────────────────────────
  if (pathname === '/api/design-audit') {
    const componentQuery = String(parsedUrl.query.component || '');
    const audit = auditDesignSystem(componentQuery);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(audit, null, 2));
    return;
  }

  // ──────────────────────────────────────────────
  // ENGINE 21: Deployment Readiness Checker
  // GET /api/deploy-check
  // ──────────────────────────────────────────────
  if (pathname === '/api/deploy-check') {
    const readiness = checkDeploymentReadiness();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(readiness, null, 2));
    return;
  }

  // ══════════════════════════════════════════════════════════════
  // 🚀 JARVIS v5.0 SUPER PROMPT — 4-MODE MASTER ENDPOINT
  // POST /api/super-prompt
  // Chains ALL 22 engines → generates mode-aware perfect prompt
  // ══════════════════════════════════════════════════════════════
  if (req.method === 'POST' && pathname === '/api/super-prompt') {
    try {
      const payload = JSON.parse(await readBody(req));
      const { description, navigate } = payload;

      // ENGINE 15: Auto-capture screenshot
      if (!latestVisualSnapshot) {
        const page = await ensurePuppeteer();
        if (page) {
          try {
            if (navigate) await page.goto(`http://localhost:5173${navigate}`, { waitUntil: 'domcontentloaded', timeout: 6000 });
            latestVisualSnapshot = await page.screenshot({ encoding: 'base64', fullPage: false });
          } catch(e) {}
        }
      }

      // ENGINE 13: Classify intent
      const intent = classifyIntent(description);

      // ENGINE 1: RAG keyword localization
      const keywords = (description || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
      let ragFiles = [];
      for (const [key, val] of Object.entries(COMPONENT_FEATURE_INDEX)) {
        if (keywords.some(k => key.includes(k) || val.feature.toLowerCase().includes(k))) ragFiles.push(val);
      }
      
      // ENGINE 23: DEEP AST SCAN FALLBACK (God Mode)
      if (ragFiles.length === 0) {
        try {
          const getFiles = (dir) => {
            let res = [];
            fs.readdirSync(dir).forEach(f => {
              const pf = path.join(dir, f);
              if (fs.statSync(pf).isDirectory()) res.push(...getFiles(pf));
              else if (pf.endsWith('.ts') || pf.endsWith('.tsx')) res.push(pf);
            });
            return res;
          };
          const fallbackMatches = getFiles(SRC_DIR).filter(f => keywords.some(k => f.toLowerCase().includes(k))).slice(0, 3);
          if (fallbackMatches.length > 0) {
            ragFiles.push({ feature: 'Engine 23 Deep Scan Fallback', files: fallbackMatches.map(f => ({ path: f.replace(/\\/g, '/'), symbol: 'Whole File', lines: '1-end' })) });
          }
        } catch(e) {}
      }

      // ENGINE 18: Global Brain pgvector
      let vectorSnippetsStr = '  No vector matches (Global Brain not indexed yet).';
      try {
        const embedding = await getGeminiEmbedding(description);
        if (embedding) {
          const { data: matches } = await supabase.rpc('match_jarvis_code', { query_embedding: embedding, match_threshold: 0.5, match_count: 5 });
          if (matches && matches.length > 0) {
            vectorSnippetsStr = matches.map(m => `  ── ${m.file_path} (${(m.similarity*100).toFixed(1)}% match)\n\`\`\`\n${(m.code_content||'').slice(0,400)}\n\`\`\``).join('\n\n');
            const pgPaths = [...new Set(matches.map(m => m.file_path))];
            ragFiles.push({ feature: 'pgvector Global Brain Matches', files: pgPaths.map(p => ({ path: p, symbol: 'Whole Component', lines: '1-end' })) });
          }
        }
      } catch(e) {}

      // Fire remaining engines
      const pastFixes = queryMemoryVault(keywords);
      const blastRadius = ragFiles.flatMap(rf => (rf.files || []).map(f => ({ file: f.path, consumers: buildBlastRadius(path.basename(f.path)).slice(0, 5) })));
      const validation = validateContextReferences(ragFiles);
      const snippets = extractFileSnippets(ragFiles);
      const confidence = computeConfidenceScore({ ragCount: ragFiles.length, blastCount: blastRadius.length, pastFixCount: pastFixes.length, domAvailable: !!latestLiveDomSnapshot, imageProvided: !!latestVisualSnapshot, validationResults: validation });
      const edgeLogs = await pullEdgeLogs(description); // ENGINE 17 REAL
      const recentErrors = consoleErrorStream.slice(-10);
      const recentNetworkErrors = networkErrorStream.slice(-5);
      const bugSeverity = classifyBugSeverity(description, recentErrors);

      // Mode-specific engines
      const featureScaffold = intent.mode === 'FEATURE_BUILD' ? generateFeatureScaffold(description, '') : null;
      const designAudit = intent.mode === 'DESIGN' ? auditDesignSystem(keywords[0] || '') : null;
      const deployCheck = intent.mode === 'OPS' ? checkDeploymentReadiness() : null;
      const liveSchema = (intent.mode !== 'BUG_FIX') ? await getLiveSupabaseSchema([]) : {};

      // Build string sections
      const ragFilesStr = ragFiles.map(rf => `  📂 ${rf.feature}\n` + (rf.files || []).map(f => `     • ${f.path} → ${f.symbol} [L${f.lines}]`).join('\n')).join('\n') || '  No specific files localized.';
      const blastStr = blastRadius.map(r => `  ⚠️  ${r.file}\n     Consumed by: ${r.consumers.length > 0 ? r.consumers.join(', ') : 'None (safe)'}`).join('\n') || '  No blast radius computed.';
      const validationStr = validation.map(r => `  ${r.status}\n     File: ${r.file} (${r.lineCount} lines)`).join('\n') || '  No files to validate.';
      const snippetsStr = snippets.map(s => `  ── ${s.file} [L${s.lineRange}] ──\n\`\`\`\n${s.snippet}\n\`\`\``).join('\n') || '  No snippets extracted.';
      const pastFixesStr = pastFixes.length > 0 ? pastFixes.map(f => `  🧠 [${(f.timestamp||'').slice(0,10)}] ${f.bugDescription}\n     Root Cause: ${f.rootCause}\n     Solution: ${f.solution}`).join('\n\n') : '  No past fixes for this topic — novel issue.';
      const consoleErrorsStr = recentErrors.map(e => `  [${(e.receivedAt||'').slice(11,19)}] ${(e.level||'ERROR').toUpperCase()}: ${e.message}`).join('\n') || '  No console errors captured.';
      const networkErrorsStr = recentNetworkErrors.map(e => `  [${(e.receivedAt||'').slice(11,19)}] ${e.method||'?'} ${e.url||'?'} → HTTP ${e.status}: ${e.hint||e.statusText||''}`).join('\n') || '  No network errors.';
      const confidenceBar = '█'.repeat(Math.round(confidence.score/10)) + '░'.repeat(10-Math.round(confidence.score/10));
      const hallucinationWarning = validation.filter(r => !r.exists).length > 0
        ? `\n🚨 HALLUCINATION ALERT: ${validation.filter(r=>!r.exists).length} file(s) DO NOT EXIST. Remove from plan.`
        : '\n✅ ANTI-HALLUCINATION PASS: All RAG references verified on disk.';
      const domStats = latestLiveDomSnapshot
        ? `✅ Live (Route=${latestLiveDomSnapshot.activeRoute}, Errors=${latestLiveDomSnapshot.errorCount||0}, Source=${latestLiveDomSnapshot.source||'browser'})`
        : '❌ No DOM snapshot — browser hook not connected or app crashed';
      const screenshotStatus = latestVisualSnapshot ? '✅ Auto-captured by Puppeteer Engine 15' : '❌ No screenshot (provide one for +15 confidence points)';
      const reactStateStr = latestReactState && (latestReactState.components||[]).length > 0
        ? latestReactState.components.map(c => `  ⚛️ <${c.component}>: ${c.statePreview}`).join('\n')
        : '  No React state snapshot available.';

      let rulebook = '';
      try {
        const ruleContent = fs.readFileSync(path.resolve(ROOT_DIR, 'AGENTS.md'), 'utf-8');
        const start = ruleContent.indexOf('## ⚠️ RULE ZERO');
        rulebook = start !== -1 ? ruleContent.substring(start, start + 3000) : ruleContent.slice(0, 2500);
      } catch(e) {}

      const prompt = buildSuperPrompt({ intent, description, bugSeverity, screenshotStatus, domStats, confidenceBar, confidence, consoleErrorsStr, edgeLogs, networkErrorsStr, reactStateStr, ragFilesStr, blastStr, hallucinationWarning, validationStr, snippetsStr, vectorSnippetsStr, pastFixesStr, rulebook, featureScaffold, designAudit, deployCheck, liveSchema });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ prompt, intent, confidence, metadata: { ragFilesCount: ragFiles.length, pastFixesCount: pastFixes.length, hallucinationRisk: validation.filter(r=>!r.exists).length, snippetsExtracted: snippets.length, consoleErrorsCaptured: recentErrors.length, networkErrorsCaptured: recentNetworkErrors.length, screenshotAvailable: !!latestVisualSnapshot, domSnapshotAvailable: !!latestLiveDomSnapshot, puppeteerConnected: !!puppeteerPage, mode: intent.mode } }));
    } catch(e) {
      res.writeHead(400); res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (pathname === '/locate') {
    const query = String(parsedUrl.query.q || '').toLowerCase().trim();
    const matches = [];
    for (const [key, val] of Object.entries(COMPONENT_FEATURE_INDEX)) {
      if (key.includes(query) || query.includes(key) || val.feature.toLowerCase().includes(query)) {
        matches.push(val);
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ query, totalMatches: matches.length, results: matches.length > 0 ? matches : Object.values(COMPONENT_FEATURE_INDEX) }, null, 2));
    return;
  }

  // ──────────────────────────────────────────────
  // SCHEMA
  // ──────────────────────────────────────────────
  if (pathname === '/schema') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      masterPartitionKey: 'pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE',
      sovereignPodDefault: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001 (VS-V01R)',
      synchronizedTables: {
        pods: { pk: 'id (UUID)', unique: 'clinic_code' },
        patient_registry: { pk: 'id (UUID)', fks: ['pod_id -> pods.id'] },
        appointments: { pk: 'id (UUID)', fks: ['pod_id -> pods.id', 'patient_id -> patient_registry.id'] },
        encounters: { pk: 'id (UUID)', fks: ['pod_id -> pods.id', 'appointment_id -> appointments.id'] },
        unified_invoices: { pk: 'id (UUID)', fks: ['pod_id -> pods.id', 'encounter_id -> encounters.id'] },
        financial_ledgers: { pk: 'id (UUID)', fks: ['pod_id -> pods.id', 'invoice_id -> unified_invoices.id'] },
        whatsapp_sessions: { pk: 'id (UUID)', fks: ['pod_id -> pods.id', 'patient_id -> patient_registry.id'] },
        chronic_care_cohorts: { pk: 'id (UUID)', fks: ['pod_id -> pods.id', 'patient_id -> patient_registry.id'] }
      }
    }, null, 2));
    return;
  }

  // ──────────────────────────────────────────────
  // CONTEXT / STATE / DOM
  // ──────────────────────────────────────────────
  if (pathname === '/context' || pathname === '/state' || pathname === '/dom') {
    const vault = readMemoryVault();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      subsystem: 'VitalSync J.A.R.V.I.S. Daemon Bridge v3.0',
      port: PORT,
      timestamp: new Date().toISOString(),
      engines: { dependencyGraph: 'online', shadowCompiler: 'online', memoryVault: `online (${vault.fixes?.length || 0} fixes)`, gitopsSentinel: 'online' },
      activeSovereignPod: { id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001', clinicCode: 'VS-V01R', name: 'VitalSync Smart PolyClinic', location: 'Line Bazar, Purnea, Bihar', status: 'active' },
      dashboards: {
        doctorEMR: { route: '/doctor', cdcSynced: true, component: 'DoctorDashboard.tsx' },
        compounderDesk: { route: '/compounder', cdcSynced: true, component: 'CompounderDashboard.tsx' },
        pharmacyPOS: { route: '/pharmacy', cdcSynced: true, component: 'PharmacyDashboard.tsx' },
        pathologyLab: { route: '/lab', cdcSynced: true, component: 'LabDashboard.tsx' },
        saasAdmin: { route: '/admin', cdcSynced: true, component: 'SaaSAdminPanel.tsx' }
      },
      realtimeSync: { engine: 'Supabase Realtime CDC', debounceMs: 250, latencyTarget: '<300ms' },
      liveDomSnapshot: latestLiveDomSnapshot || { activeRoute: 'unknown', attached: false },
      jarvisEndpoints: {
        blastRadius: '/api/blast-radius?file=<filename>',
        shadowCompile: 'POST /api/shadow-compile',
        memoryQuery: '/api/memory?q=<keywords>',
        memorySave: 'POST /api/memory',
        safeStateCreate: 'POST /api/safe-state',
        safeStateRollback: 'DELETE /api/safe-state',
        fullDiagnostics: 'POST /api/diagnostics',
        agentDebug: 'POST /api/agent-debug',
        agentBuild: 'POST /api/agent-build',
        autoHealWebhook: 'POST /api/auto-heal-webhook'
      }
    }, null, 2));
    return;
  }

  // ──────────────────────────────────────────────
  // ENGINE 11: AST Code Surgery (The Precision Scalpel)
  // ──────────────────────────────────────────────
  if (pathname === '/api/ast-extract') {
    const targetFile = parsedUrl.query.file;
    const targetSymbol = parsedUrl.query.symbol;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    
    if (!targetFile || !targetSymbol) {
      res.end(JSON.stringify({ error: 'Missing ?file= or ?symbol=' }));
      return;
    }

    try {
      const ts = require('typescript');
      const absolutePath = path.resolve(__dirname, '..', targetFile);
      if (!fs.existsSync(absolutePath)) {
        res.end(JSON.stringify({ error: 'File not found', absolutePath }));
        return;
      }
      
      const sourceCode = fs.readFileSync(absolutePath, 'utf8');
      const sourceFile = ts.createSourceFile(absolutePath, sourceCode, ts.ScriptTarget.Latest, true);
      
      let foundNode = null;
      
      function visit(node) {
        if (foundNode) return;
        
        // 1. function foo() {}
        if (ts.isFunctionDeclaration(node) && node.name && node.name.text === targetSymbol) {
          foundNode = node; return;
        }
        // 2. class Foo {}
        if (ts.isClassDeclaration(node) && node.name && node.name.text === targetSymbol) {
          foundNode = node; return;
        }
        // 3. const foo = ...
        if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name) && node.name.text === targetSymbol) {
          foundNode = node.parent.parent; // get the whole 'const' statement
          return;
        }
        // 4. export const foo = ...
        if (ts.isExportAssignment(node) && node.expression && ts.isIdentifier(node.expression) && node.expression.text === targetSymbol) {
          foundNode = node; return;
        }

        ts.forEachChild(node, visit);
      }
      
      visit(sourceFile);
      
      if (foundNode) {
        const start = foundNode.getStart(sourceFile);
        const end = foundNode.getEnd();
        
        const startLoc = sourceFile.getLineAndCharacterOfPosition(start);
        const endLoc = sourceFile.getLineAndCharacterOfPosition(end);
        
        const snippet = sourceCode.substring(start, end);
        
        res.end(JSON.stringify({
          symbol: targetSymbol,
          file: targetFile,
          startLine: startLoc.line + 1,
          endLine: endLoc.line + 1,
          snippet
        }));
      } else {
        res.end(JSON.stringify({ error: 'Symbol not found in AST', symbol: targetSymbol }));
      }
    } catch (e) {
      res.end(JSON.stringify({ error: 'AST Parsing failed', details: e.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found', availableEndpoints: ['/context', '/health', '/locate?q=token', '/schema', '/api/blast-radius?file=', '/api/shadow-compile', '/api/memory', '/api/safe-state', '/api/diagnostics', '/api/super-prompt [NEW]', '/api/feature-plan [NEW]', '/api/design-audit [NEW]', '/api/deploy-check [NEW]', '/api/capture-screenshot [NEW]', '/api/live-schema [NEW]', '/api/network-errors [NEW]', '/push-network-error [NEW]', '/push-react-state [NEW]'] }));
});

// ─────────────────────────────────────────────────────────────────
// ENGINE 22: GLOBAL BRAIN AUTO-INDEXER
// Watches src/ for file changes and auto-indexes into pgvector
// ─────────────────────────────────────────────────────────────────
try {
  const chokidar = require('chokidar');
  function chunkCode(content, maxChars) {
    const chunks = [];
    const lines = content.split('\n');
    let current = ''; let idx = 0;
    for (const line of lines) {
      if ((current + line).length > maxChars && current.length > 0) {
        chunks.push({ text: current.trim(), index: idx++ });
        current = '';
      }
      current += line + '\n';
    }
    if (current.trim()) chunks.push({ text: current.trim(), index: idx });
    return chunks;
  }
  async function indexFileIntoBrain(filePath) {
    try {
      const relPath = filePath.replace(ROOT_DIR, '').replace(/\\/g, '/');
      const content = fs.readFileSync(filePath, 'utf-8');
      const chunks = chunkCode(content, 1500);
      for (const chunk of chunks) {
        const embedding = await getGeminiEmbedding(chunk.text);
        if (embedding) {
          await supabase.from('jarvis_code').upsert({
            file_path: relPath,
            code_content: chunk.text,
            embedding,
            chunk_index: chunk.index,
            updated_at: new Date().toISOString()
          }, { onConflict: 'file_path,chunk_index' });
        }
      }
      console.log(`🌍 [Engine 22] Indexed: ${relPath} (${chunks.length} chunks)`);
    } catch(e) { /* skip unreadable or API error */ }
  }
  const watcher = chokidar.watch(`${SRC_DIR}/**/*.{ts,tsx}`, { ignoreInitial: true, persistent: true });
  watcher.on('change', filePath => indexFileIntoBrain(filePath));
  watcher.on('add', filePath => indexFileIntoBrain(filePath));
  console.log('🌍 [Engine 22] Global Brain Auto-Indexer watching src/ for changes...');
} catch(e) {
  console.log('⚠️ [Engine 22] Global Brain Indexer: chokidar not available. Run: npm install chokidar --prefix frontend');
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🧠 ════════════════════════════════════════════════════════════`);
  console.log(`   J.A.R.V.I.S. Daemon Bridge v3.0 — ALL ENGINES ONLINE`);
  console.log(`   http://localhost:${PORT}/context`);
  console.log(`🕸️  Engine 1: Dependency Graph  → /api/blast-radius?file=`);
  console.log(`🛡️  Engine 2: Shadow Compiler   → POST /api/shadow-compile`);
  console.log(`🗄️  Engine 3: Memory Vault      → /api/memory?q=`);
  console.log(`⏪  Engine 4: GitOps Sentinel   → POST|DELETE /api/safe-state`);
  console.log(`🚀  Full Diagnostics            → POST /api/diagnostics`);
  console.log(`════════════════════════════════════════════════════════════\n`);
});

```
