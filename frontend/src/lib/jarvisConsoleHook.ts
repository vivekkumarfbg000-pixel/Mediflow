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
    alertDiv.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#ef4444;color:white;padding:16px;border-radius:8px;z-index:99999;font-weight:bold;box-shadow:0 4px 6px -1px rgb(0 0 0 / 0.1);max-width:400px;font-family:sans-serif;animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;';
    alertDiv.innerHTML = `🚨 <b>JARVIS BUG DETECTED</b><br/><span style="font-size:0.875rem;font-weight:normal;opacity:0.9">${message.substring(0, 100)}...</span><br/><br/><span style="font-size:0.75rem;opacity:0.8">Crash Payload saved. Open Antigravity AI to auto-fix.</span>`;
    document.body.appendChild(alertDiv);
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
