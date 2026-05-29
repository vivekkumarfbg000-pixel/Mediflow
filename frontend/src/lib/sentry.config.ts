import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN || '';
  
  if (!dsn) {
    console.log('[Sentry Warning] No VITE_SENTRY_DSN provided. Telemetry will log locally to console instead.');
  }

  Sentry.init({
    dsn: dsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: 1.0, 
    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    
    environment: import.meta.env.MODE || 'development',
    
    beforeSend(event) {
      // Graceful fallback to console in local sandbox
      if (!dsn) {
        console.warn('[Sentry Simulated Event Captured]:', event.exception?.values?.[0] || event.message);
      }
      return event;
    }
  });
}
