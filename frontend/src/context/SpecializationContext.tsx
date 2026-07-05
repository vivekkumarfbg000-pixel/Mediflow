import React, { createContext, useContext, useMemo } from 'react';
import type { DiagnosticTest } from '../types';
import { OPHTHALMIC_TEST_CATALOG, DENTAL_TEST_CATALOG } from '../services/api';
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

const DENTAL_NOMENCLATURE: SpecializationNomenclature = {
  labTitle: 'Dental Imaging Center',
  pharmacyTitle: 'Dental POS / Supplies',
  vitalsTitle: 'Oral Examination Vitals',
  careLoopLabStep: 'Imaging Analysis',
  careLoopPharmacyStep: 'Materials Check',
};

// ─── SPECIALIZATION CONTEXT ──────────────────────────────────────────────────

interface SpecializationContextType {
  specialization: string;
  isOphthalmology: boolean;
  isDental: boolean;
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
    // Allow localStorage override for Demo Sandbox sessions (e.g. demo=eye URL param)
    const demoOverride = typeof window !== 'undefined'
      ? window.localStorage.getItem('mediflow_demo_specialization')
      : null;

    const spec: string = demoOverride
      || activeProfile?.user_metadata?.specialization
      || activeProfile?.raw_user_meta_data?.specialization
      || 'General Medicine';

    const isOphthalmology = spec === 'Ophthalmology';
    const isDental = spec === 'Dentistry';

    let testCatalog = MASTER_TEST_CATALOG;
    if (isOphthalmology) testCatalog = OPHTHALMIC_TEST_CATALOG;
    else if (isDental) testCatalog = DENTAL_TEST_CATALOG;

    let nomenclature = GP_NOMENCLATURE;
    if (isOphthalmology) nomenclature = OPHTHALMIC_NOMENCLATURE;
    else if (isDental) nomenclature = DENTAL_NOMENCLATURE;

    return {
      specialization: spec,
      isOphthalmology,
      isDental,
      testCatalog,
      nomenclature,
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
      isDental: false,
      testCatalog: MASTER_TEST_CATALOG,
      nomenclature: GP_NOMENCLATURE,
    };
  }
  return context;
};
