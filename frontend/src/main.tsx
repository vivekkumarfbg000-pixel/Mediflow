import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initSentry } from './lib/sentry.config'
import { ErrorBoundary } from './components/shared/ErrorBoundary'

// Initialize Sentry continuous crash diagnostics
initSentry();

// Remove initial HTML/SVG loader so body only contains the mounted React root
const initialLoader = document.getElementById('vitalsync-initial-loader');
if (initialLoader) {
  initialLoader.remove();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

