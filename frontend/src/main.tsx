import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initSentry } from './lib/sentry.config'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { initJarvisConsoleHook } from './lib/jarvisConsoleHook'
import { JarvisBugReporter } from './components/shared/JarvisBugReporter'

// Initialize Sentry continuous crash diagnostics
initSentry();

// Initialize J.A.R.V.I.S. console error stream (DEV only — no-op in production)
initJarvisConsoleHook();

// Remove initial HTML/SVG loader so body only contains the mounted React root
const initialLoader = document.getElementById('vitalsync-initial-loader');
if (initialLoader) {
  initialLoader.remove();
}

// Signal to index.html boot watchdog that JS bundle executed successfully
(window as any).__mediflow_startup_healthy = true;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <JarvisBugReporter />
    </ErrorBoundary>
  </StrictMode>,
)

