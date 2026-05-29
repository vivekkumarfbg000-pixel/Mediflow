import React, { createContext, useContext, useMemo } from 'react';
import type { DiagnosticTest } from '../types';
import { OPHTHALMIC_TEST_CATALOG } from '../services/api';
import { MASTER_TEST_CATALOG } from '../services/api';

// ─── SPECIALIZATION NOMENCLATURE & CONFIGURATION ─────────────────────────────

interface SpecializationNomenclature {
  labTitle: string;
  pharmacyTitle: string;
  vitalsTitle: string;
  careLoopLabStep: string;
  careLoopPharmacyStep: string;
}

const GP_NOMENCLATURE: SpecializationNomenclature = {
  labTitle: 'Pathology Lab',
  pharmacyTitle: 'Pharmacy POS',
  vitalsTitle: 'Patient Vitals',
  careLoopLabStep: 'Lab Processing',
  careLoopPharmacyStep: 'Pharmacy Verif.',
};

const OPHTHALMIC_NOMENCLATURE: SpecializationNomenclature = {
  labTitle: 'Diagnostics Center',
  pharmacyTitle: 'Optical / Pharmacy',
  vitalsTitle: 'Eye Examination Vitals',
  careLoopLabStep: 'Scan Processing',
  careLoopPharmacyStep: 'Optical Verif.',
};

// ─── SPECIALIZATION CONTEXT ──────────────────────────────────────────────────

interface SpecializationContextType {
  specialization: string;
  isOphthalmology: boolean;
  testCatalog: DiagnosticTest[];
  nomenclature: SpecializationNomenclature;
}

const SpecializationContext = createContext<SpecializationContextType | undefined>(undefined);

interface SpecializationProviderProps {
  children: React.ReactNode;
  activeProfile: any;
}

export const SpecializationProvider: React.FC<SpecializationProviderProps> = ({ children, activeProfile }) => {
  const value = useMemo(() => {
    // Extract specialization from user metadata (set during doctor registration in AuthGateway)
    const spec: string = activeProfile?.user_metadata?.specialization
      || activeProfile?.raw_user_meta_data?.specialization
      || 'General Medicine';

    const isOphthalmology = spec === 'Ophthalmology';

    return {
      specialization: spec,
      isOphthalmology,
      testCatalog: isOphthalmology ? OPHTHALMIC_TEST_CATALOG : MASTER_TEST_CATALOG,
      nomenclature: isOphthalmology ? OPHTHALMIC_NOMENCLATURE : GP_NOMENCLATURE,
    };
  }, [activeProfile]);

  return (
    <SpecializationContext.Provider value={value}>
      {children}
    </SpecializationContext.Provider>
  );
};

export const useSpecialization = (): SpecializationContextType => {
  const context = useContext(SpecializationContext);
  if (context === undefined) {
    // Graceful fallback for components rendered outside the provider (e.g. auth screens)
    return {
      specialization: 'General Medicine',
      isOphthalmology: false,
      testCatalog: MASTER_TEST_CATALOG,
      nomenclature: GP_NOMENCLATURE,
    };
  }
  return context;
};
