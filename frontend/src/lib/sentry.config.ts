import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN || '';
  
  if (!dsn) {
    // Sentry is optional; in development/preview without a DSN, do not initialize to avoid overhead or SDK errors
    return;
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
