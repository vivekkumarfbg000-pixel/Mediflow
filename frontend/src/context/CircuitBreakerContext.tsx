import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerStatus {
  whatsapp: CircuitState;
  payment: CircuitState;
  edgeFunctions: CircuitState;
}

interface CircuitBreakerContextType {
  status: CircuitBreakerStatus;
  reportFailure: (service: keyof CircuitBreakerStatus) => void;
  reportSuccess: (service: keyof CircuitBreakerStatus) => void;
  resetCircuit: (service: keyof CircuitBreakerStatus) => void;
}

const CircuitBreakerContext = createContext<CircuitBreakerContextType | undefined>(undefined);

const FAILURE_THRESHOLD = 3;
const RESET_TIMEOUT_MS = 30000; // 30 seconds before HALF_OPEN

export const CircuitBreakerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<CircuitBreakerStatus>({
    whatsapp: 'CLOSED',
    payment: 'CLOSED',
    edgeFunctions: 'CLOSED'
  });

  // Track consecutive failures per service outside of React state to avoid race conditions
  const failuresRef = React.useRef<Record<keyof CircuitBreakerStatus, number>>({
    whatsapp: 0,
    payment: 0,
    edgeFunctions: 0
  });

  const tripCircuit = useCallback((service: keyof CircuitBreakerStatus) => {
    setStatus(prev => {
      if (prev[service] === 'OPEN') return prev; // Already open
      
      // Dispatch global event for non-react services
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('circuit-breaker-tripped', { detail: { service } }));
      }
      
      return { ...prev, [service]: 'OPEN' };
    });

    // Start auto-heal timeout
    setTimeout(() => {
      setStatus(prev => {
        if (prev[service] === 'OPEN') {
          console.log(`[CircuitBreaker] ${service} transitioning to HALF_OPEN for probing.`);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('circuit-breaker-half-open', { detail: { service } }));
          }
          return { ...prev, [service]: 'HALF_OPEN' };
        }
        return prev;
      });
    }, RESET_TIMEOUT_MS);
  }, []);

  const reportFailure = useCallback((service: keyof CircuitBreakerStatus) => {
    failuresRef.current[service] += 1;
    console.warn(`[CircuitBreaker] ${service} failure reported. Count: ${failuresRef.current[service]}`);
    if (failuresRef.current[service] >= FAILURE_THRESHOLD) {
      tripCircuit(service);
    }
  }, [tripCircuit]);

  const reportSuccess = useCallback((service: keyof CircuitBreakerStatus) => {
    if (failuresRef.current[service] > 0 || status[service] !== 'CLOSED') {
      failuresRef.current[service] = 0;
      setStatus(prev => {
        if (prev[service] !== 'CLOSED') {
          console.log(`[CircuitBreaker] ${service} recovered. Circuit CLOSED.`);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('circuit-breaker-closed', { detail: { service } }));
          }
          return { ...prev, [service]: 'CLOSED' };
        }
        return prev;
      });
    }
  }, [status]);

  const resetCircuit = useCallback((service: keyof CircuitBreakerStatus) => {
    failuresRef.current[service] = 0;
    setStatus(prev => ({ ...prev, [service]: 'CLOSED' }));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('circuit-breaker-closed', { detail: { service } }));
    }
  }, []);

  // Listen for external non-React failures
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleGlobalFailure = (e: any) => {
      if (e.detail?.service) {
        reportFailure(e.detail.service as keyof CircuitBreakerStatus);
      }
    };
    
    const handleGlobalSuccess = (e: any) => {
      if (e.detail?.service) {
        reportSuccess(e.detail.service as keyof CircuitBreakerStatus);
      }
    };

    window.addEventListener('report-service-failure', handleGlobalFailure);
    window.addEventListener('report-service-success', handleGlobalSuccess);

    return () => {
      window.removeEventListener('report-service-failure', handleGlobalFailure);
      window.removeEventListener('report-service-success', handleGlobalSuccess);
    };
  }, [reportFailure, reportSuccess]);

  return (
    <CircuitBreakerContext.Provider value={{ status, reportFailure, reportSuccess, resetCircuit }}>
      {children}
    </CircuitBreakerContext.Provider>
  );
};

export const useCircuitBreaker = () => {
  const context = useContext(CircuitBreakerContext);
  if (context === undefined) {
    throw new Error('useCircuitBreaker must be used within a CircuitBreakerProvider');
  }
  return context;
};
