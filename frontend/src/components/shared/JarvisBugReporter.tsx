import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bug, Target, Copy, X, Camera } from 'lucide-react';

export const JarvisBugReporter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTargeting, setIsTargeting] = useState(false);
  const [capturedElement, setCapturedElement] = useState<{ html: string, id: string, className: string } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
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

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      console.error = originalError;
    };
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
[Please describe what went wrong]

🚨 BUG SEVERITY: CRITICAL
   Urgency: High

👣 STEPS TO REPRODUCE:
1. 
2. 

🎯 VISUAL TARGET (Captured Element):
ID: ${capturedElement?.id || 'N/A'}
Classes: ${capturedElement?.className || 'N/A'}
HTML Snippet:
\`\`\`html
${capturedElement?.html || 'No element targeted'}
\`\`\`

🖥️ CONSOLE LOGS:
\`\`\`
${logs.join('\n') || 'No recent errors captured.'}
\`\`\`
</USER_REQUEST_TRIAGE>`;

    navigator.clipboard.writeText(prompt);
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: { title: 'Copied to Clipboard!', message: 'Paste this into the AI Agent chat.', type: 'success' }
    }));
  };

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
        <button 
          onClick={() => { setIsOpen(false); setIsTargeting(true); }}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
        >
          <Target className="h-4 w-4" /> Visual Target Element
        </button>

        {capturedElement && (
          <div className="bg-slate-800 rounded-lg p-3 text-xs space-y-1 overflow-hidden border border-emerald-500/30">
            <div className="text-emerald-400 font-bold mb-2 flex items-center gap-2"><Camera className="h-3 w-3"/> Element Captured!</div>
            <p><span className="text-slate-400">ID:</span> {capturedElement.id}</p>
            <p className="truncate"><span className="text-slate-400">Class:</span> {capturedElement.className}</p>
          </div>
        )}

        <div className="bg-slate-800 rounded-lg p-3 text-xs space-y-2 h-32 overflow-y-auto font-mono">
          <div className="text-slate-400 font-bold mb-1">Recent Errors:</div>
          {logs.length === 0 ? (
            <div className="text-emerald-500/70">No errors detected.</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="text-rose-400 break-words">{log}</div>
            ))
          )}
        </div>

        <button 
          onClick={copyPrompt}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
        >
          <Copy className="h-4 w-4" /> Copy JARVIS Prompt
        </button>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
};
