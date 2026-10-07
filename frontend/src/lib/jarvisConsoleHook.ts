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
    alertDiv.className = "fixed bottom-6 right-6 max-w-md w-full bg-[#0a0f1c]/95 backdrop-blur-2xl border border-rose-500/50 rounded-2xl shadow-[0_0_40px_-10px_rgba(225,29,72,0.5)] z-[999999] overflow-hidden text-slate-200 font-sans transition-all duration-300 transform translate-y-0 opacity-100 cursor-pointer hover:border-rose-400";
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

    // Auto-dismiss and click-to-dismiss logic
    const dismissAlert = () => {
      alertDiv.style.opacity = '0';
      alertDiv.style.transform = 'translateY(100px)';
      setTimeout(() => alertDiv.remove(), 300);
    };
    alertDiv.onclick = dismissAlert;
    setTimeout(dismissAlert, 8000);
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

// ─── GAP 8: DOM TELEMETRY HEARTBEAT ──────────────────────────────
function initDomHeartbeat() {
  if (typeof window === 'undefined') return;

  const pushLiveDom = () => {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      const snapshot = {
        activeRoute: window.location.pathname + window.location.search + window.location.hash,
        title: document.title,
        nodeCount: document.querySelectorAll('*').length,
        url: window.location.href,
        source: 'browser_heartbeat',
        timestamp: new Date().toISOString()
      };
      safePush('/push-dom', snapshot);
    } catch { /* ignore */ }
  };

  // Immediate push on load
  setTimeout(pushLiveDom, 1500);

  // Periodic heartbeat every 15 seconds
  setInterval(pushLiveDom, 15000);

  // Push on navigation events
  window.addEventListener('popstate', pushLiveDom);
  window.addEventListener('hashchange', pushLiveDom);
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────
export function initJarvisConsoleHook() {
  if (typeof window === 'undefined') return;
  if (!(import.meta.env?.DEV)) return; // DEV only — never in production

  initConsoleHook();        // Console errors
  initNetworkInterceptor(); // GAP 2: Network failures
  initReactStateSnapshot(); // GAP 4: React state snapshot
  initPerformanceMonitor(); // GAP 7: Performance vitals
  initDomHeartbeat();       // GAP 8: DOM Telemetry Heartbeat

  console.log('[J.A.R.V.I.S. v5.0] 5 browser hooks active → streaming to Daemon Bridge port 9000');
  console.log('[J.A.R.V.I.S. v5.0] Monitoring: console errors, network failures, React state, performance vitals, DOM heartbeat');
}

