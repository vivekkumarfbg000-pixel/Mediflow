import React, { createContext, useContext, type ReactNode } from 'react';

interface EphemeralVaultContextType {
  isLocked: boolean;
  unlockVault: () => void;
}

const EphemeralVaultContext = createContext<EphemeralVaultContextType>({
  isLocked: false,
  unlockVault: () => {}
});

export const useEphemeralVault = () => {
  return useContext(EphemeralVaultContext);
};

interface Props {
  children: ReactNode;
}

export const EphemeralVaultProvider: React.FC<Props> = ({ children }) => {
  return (
    <EphemeralVaultContext.Provider value={{ isLocked: false, unlockVault: () => {} }}>
      {children}
    </EphemeralVaultContext.Provider>
  );
};
