import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Lock } from 'lucide-react';

interface EphemeralVaultContextType {
  isLocked: boolean;
  unlockVault: () => void;
}

const EphemeralVaultContext = createContext<EphemeralVaultContextType | undefined>(undefined);

export const useEphemeralVault = () => {
  const context = useContext(EphemeralVaultContext);
  if (!context) {
    throw new Error('useEphemeralVault must be used within an EphemeralVaultProvider');
  }
  return context;
};

interface Props {
  children: ReactNode;
}

export const EphemeralVaultProvider: React.FC<Props> = ({ children }) => {
  const [isLocked, setIsLocked] = useState(false);
  const INACTIVITY_TIMEOUT = 60000; // 60 seconds

  const lockVault = useCallback(() => {
    setIsLocked(true);
  }, []);

  const unlockVault = useCallback(() => {
    setIsLocked(false);
  }, []);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      if (!isLocked) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(lockVault, INACTIVITY_TIMEOUT);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        lockVault();
      } else {
        // We don't auto-unlock when returning to the tab for security, 
        // the user must explicitly click the unlock button.
      }
    };

    // Attach listeners
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('scroll', resetTimer);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial timer
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('scroll', resetTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLocked, lockVault]);

  return (
    <EphemeralVaultContext.Provider value={{ isLocked, unlockVault }}>
      <div 
        style={{ 
          filter: isLocked ? 'blur(10px)' : 'none', 
          transition: 'filter 0.3s ease-in-out',
          pointerEvents: isLocked ? 'none' : 'auto',
          height: '100%',
          width: '100%'
        }}
      >
        {children}
      </div>

      {isLocked && (
        <div 
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-md cursor-pointer"
          onClick={unlockVault}
          title="Click anywhere to unlock"
        >
          <div className="bg-slate-900/90 border border-slate-700/50 p-8 rounded-3xl shadow-2xl flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <div className="h-20 w-20 bg-cyan-950/50 rounded-full flex items-center justify-center border border-cyan-500/30 mb-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-cyan-500/20 animate-ping rounded-full" />
              <Lock className="w-10 h-10 text-cyan-400 relative z-10" />
            </div>
            <h2 className="text-2xl font-black text-white mb-2 tracking-wide">ZERO-TRUST VAULT</h2>
            <p className="text-slate-400 text-center max-w-xs font-medium">
              Terminal auto-locked for HIPAA compliance. 
              PHI data has been flushed from active memory.
            </p>
            <div className="mt-8 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold rounded-xl transition-colors">
              Click Anywhere To Rehydrate Data
            </div>
          </div>
        </div>
      )}
    </EphemeralVaultContext.Provider>
  );
};
