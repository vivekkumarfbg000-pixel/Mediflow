/**
 * J.A.R.V.I.S. Browser Console Hook
 * Intercepts console.error, console.warn, and unhandledrejection
 * Streams them in real-time to the Daemon Bridge (port 9000)
 * 
 * Usage: Import this file once in main.tsx (DEV mode only)
 */

const DAEMON_URL = 'http://localhost:9000/push-console-error';

function sendToDaemon(level: string, message: string, stack?: string) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  fetch(DAEMON_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level, message: String(message).slice(0, 1000), stack: (stack || '').slice(0, 2000), url: window.location.href, timestamp: new Date().toISOString() })
  }).catch(() => { /* bridge may be offline */ });
}

export function initJarvisConsoleHook() {
  if (typeof window === 'undefined') return;
  if (!(import.meta.env?.DEV)) return; // DEV only — never in production

  const originalError = console.error.bind(console);
  const originalWarn = console.warn.bind(console);

  console.error = (...args: any[]) => {
    originalError(...args);
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    sendToDaemon('error', msg);
  };

  console.warn = (...args: any[]) => {
    originalWarn(...args);
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    sendToDaemon('warn', msg);
  };

  window.addEventListener('unhandledrejection', (event) => {
    sendToDaemon('unhandledrejection', String(event.reason?.message || event.reason || 'Unknown Promise rejection'), event.reason?.stack || '');
  });

  window.addEventListener('error', (event) => {
    sendToDaemon('error', event.message || 'Unknown JS error', event.error?.stack || '');
  });

  console.log('[J.A.R.V.I.S.] Console Error Hook active → streaming to Daemon Bridge port 9000');
}
