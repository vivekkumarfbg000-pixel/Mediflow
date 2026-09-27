import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bug, Target, Copy, X, Camera } from 'lucide-react';

interface JarvisHUDProps {
  apiKey: string;
}

export const JarvisHUD: React.FC<JarvisHUDProps> = ({ apiKey }) => {
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
  const [isActive, setIsActive] = useState(true);

  // --- API KEY LICENSING CHECK ---
  useEffect(() => {
    // In production, this verifies the API key with your Stripe server
    if (!apiKey) {
      console.error('JARVIS-OS: Missing API Key.');
      setIsActive(false);
    }
    // fetch('https://api.jarvis-os.com/verify', { headers: { Authorization: apiKey } })
    //   .then(res => res.json())
    //   .then(data => { if (!data.active) setIsActive(false); });
  }, [apiKey]);

  useEffect(() => {
    if (!isActive || !import.meta.env.DEV) return;

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
      setLogs(prev => [...prev, msg].slice(-5));
    };

    // Capture Network Errors
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

    const captureContext = () => {
      try {
        setAppContext({
          userAgent: navigator.userAgent,
          url: window.location.href,
          localStorageKeys: Object.keys(localStorage).length
        });
      } catch (e) {}
    };
    captureContext();

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      console.error = originalError;
      window.fetch = originalFetch;
    };
  }, [isActive]);

  // --- 60-FPS ENFORCER ---
  useEffect(() => {
    if (!isActive) return;
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
  }, [isActive]);

  useEffect(() => {
    if (!isTargeting || !isActive) return;

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
  }, [isTargeting, isActive]);

  const copyPrompt = () => {
    const prompt = `<USER_REQUEST_TRIAGE>
╔═══════════════════════════════════════════════════════════════════╗
║  🧠 JARVIS-OS — Bug Command Center                                ║
║  17-Engine Anti-Hallucination Supercomputer Protocol              ║
╚═══════════════════════════════════════════════════════════════════╝

🚨 BUG DESCRIPTION:
${bugDescription || '[User did not provide a description. Analyze context to deduce.]'}

🎯 VISUAL TARGET (Captured Element):
ID: ${capturedElement?.id || 'N/A'}
Classes: ${capturedElement?.className || 'N/A'}
HTML Snippet:
\`\`\`html
${capturedElement?.html || 'No element targeted'}
\`\`\`

🌐 APP CONTEXT:
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
1. Execute a 360° Root Cause Analysis across the full stack.
2. Cross-reference the attached screenshot with the Captured DOM Element above.
3. Check the local BLAST_RADIUS.md file before touching shared state.
4. Provide the EXACT, minimal surgical diff required to fix this bug in ONE attempt.
</USER_REQUEST_TRIAGE>`;

    navigator.clipboard.writeText(prompt);
    alert('JARVIS Prompt Copied! Paste it into your AI.');
  };

  if (!isActive) return null;
  if (!isOpen && !isTargeting) return null;

  const content = isTargeting ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-rose-500 text-white px-6 py-3 rounded-full font-bold shadow-2xl z-[99999] flex items-center gap-3 animate-pulse cursor-pointer" onClick={() => setIsTargeting(false)}>
      <Target className="h-5 w-5" />
      <span>Click any element to capture its code</span>
      <X className="h-4 w-4 opacity-50 hover:opacity-100" />
    </div>
  ) : (
    <div ref={overlayRef} className="fixed bottom-6 left-6 w-96 bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl z-[99999] overflow-hidden text-slate-200 font-sans">
      <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm tracking-widest uppercase">
          <Bug className="h-4 w-4" /> JARVIS HUD
        </div>
        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {performanceWarning && (
          <div className="bg-rose-500/20 border border-rose-500/50 rounded-lg p-3 text-xs text-rose-400 font-bold flex items-center justify-between animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.4)]">
            <span>⚠️ {performanceWarning}</span>
            <span>Needs Optimization</span>
          </div>
        )}
        <div className="space-y-2">
          <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Bug Description</label>
          <textarea 
            value={bugDescription}
            onChange={(e) => setBugDescription(e.target.value)}
            placeholder="Describe the bug here (e.g., 'Button is cut off on small screens')"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none h-16"
          />
        </div>
        <button onClick={() => { setIsOpen(false); setIsTargeting(true); }} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20">
          <Target className="h-4 w-4" /> Target Element in UI
        </button>
        {capturedElement && (
          <div className="bg-slate-800 rounded-lg p-3 text-xs space-y-1 overflow-hidden border border-emerald-500/30">
            <div className="text-emerald-400 font-bold mb-2 flex items-center gap-2"><Camera className="h-3 w-3"/> Element Captured!</div>
            <p><span className="text-slate-400">ID:</span> {capturedElement.id}</p>
            <p className="truncate"><span className="text-slate-400">Class:</span> {capturedElement.className}</p>
          </div>
        )}
        <button onClick={copyPrompt} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20">
          <Copy className="h-4 w-4" /> Copy JARVIS Prompt
        </button>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
};
