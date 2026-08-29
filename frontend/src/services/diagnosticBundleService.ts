/**
 * 🏛️ VitalSync Diagnostic Lab Bundle Service
 * 
 * Pre-configured 1-Click Clinic Pathology Diagnostic Bundles:
 * 1. Acute Fever & Infection Panel
 * 2. Comprehensive Diabetic & Metabolic Panel
 * 3. Cardiovascular & Lipid Assessment Panel
 * 4. Antenatal Care (ANC) Maternal Screening Panel
 * 5. Annual Executive Master Health Checkup
 * 
 * Designed to maximize clinic in-house pathology lab utilization and revenue.
 */

import { LabService } from './labService';
import type { DiagnosticTest } from '../types';

export interface DiagnosticBundleTest {
  id: string;
  testName: string;
  loincCode: string;
  price: number;
  turnaroundHours: number;
  category: string;
  isStatAvailable: boolean;
}

export interface DiagnosticBundle {
  id: string;
  name: string;
  badge: string;
  description: string;
  color: string;
  tests: DiagnosticBundleTest[];
}

export const CLINIC_DIAGNOSTIC_BUNDLES: DiagnosticBundle[] = [
  {
    id: 'fever-panel',
    name: '🌡️ Acute Fever / Infection Panel',
    badge: '5 Core Tests',
    description: 'Complete Blood Count, Dengue NS1/IgM, Malaria Ag, Typhoid Widal, Urine R/M',
    color: 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300',
    tests: [
      { id: 't-cbc', testName: 'Complete Blood Count (CBC / Hemogram)', loincCode: '58410-2', price: 350, turnaroundHours: 4, category: 'Hematology', isStatAvailable: true },
      { id: 't-dengue', testName: 'Dengue NS1 Antigen & IgM/IgG Combo', loincCode: '6855-3', price: 650, turnaroundHours: 2, category: 'Serology', isStatAvailable: true },
      { id: 't-malaria', testName: 'Malaria Rapid Diagnostic Test (Pv/Pf Ag)', loincCode: '50554-5', price: 250, turnaroundHours: 2, category: 'Parasitology', isStatAvailable: true },
      { id: 't-widal', testName: 'Typhoid Widal Slide / Tube Agglutination', loincCode: '2093-3', price: 200, turnaroundHours: 3, category: 'Serology', isStatAvailable: true },
      { id: 't-urine', testName: 'Urine Routine & Microscopic Examination', loincCode: '24356-8', price: 150, turnaroundHours: 2, category: 'Clinical Pathology', isStatAvailable: true }
    ]
  },
  {
    id: 'diabetes-panel',
    name: '🩸 Comprehensive Diabetic Panel',
    badge: '5 Biomarkers',
    description: 'HbA1c Glycated Hemoglobin, Fasting Glucose, Lipid Profile, Creatinine, Urine Microalbumin',
    color: 'bg-blue-100 hover:bg-blue-200 text-blue-900 border-blue-300',
    tests: [
      { id: 't-hba1c', testName: 'HbA1c (Glycated Hemoglobin HPLC)', loincCode: '4544-3', price: 500, turnaroundHours: 4, category: 'Biochemistry', isStatAvailable: true },
      { id: 't-fbs', testName: 'Fasting Blood Sugar (FBS / Glucose)', loincCode: '1558-6', price: 100, turnaroundHours: 2, category: 'Biochemistry', isStatAvailable: true },
      { id: 't-lipid', testName: 'Lipid Profile (Cholesterol, Triglycerides, HDL, LDL)', loincCode: '24331-1', price: 650, turnaroundHours: 6, category: 'Biochemistry', isStatAvailable: false },
      { id: 't-creat', testName: 'Serum Creatinine & Estimated GFR', loincCode: '2160-0', price: 180, turnaroundHours: 3, category: 'Biochemistry', isStatAvailable: true },
      { id: 't-microalb', testName: 'Urine Albumin / Creatinine Ratio (Microalbuminuria)', loincCode: '14959-1', price: 450, turnaroundHours: 6, category: 'Biochemistry', isStatAvailable: false }
    ]
  },
  {
    id: 'cardiac-panel',
    name: '🫀 Cardiovascular & Lipid Panel',
    badge: '4 Tests',
    description: 'Complete Lipid Profile, hs-CRP, Serum Electrolytes (Na/K/Cl), Blood Urea',
    color: 'bg-rose-100 hover:bg-rose-200 text-rose-900 border-rose-300',
    tests: [
      { id: 't-lipid', testName: 'Lipid Profile (Cholesterol, Triglycerides, HDL, LDL)', loincCode: '24331-1', price: 650, turnaroundHours: 6, category: 'Biochemistry', isStatAvailable: false },
      { id: 't-hscrp', testName: 'High Sensitivity C-Reactive Protein (hs-CRP)', loincCode: '30522-7', price: 550, turnaroundHours: 6, category: 'Immunoassay', isStatAvailable: false },
      { id: 't-lytes', testName: 'Serum Electrolytes (Sodium, Potassium, Chloride)', loincCode: '24326-1', price: 400, turnaroundHours: 3, category: 'Biochemistry', isStatAvailable: true },
      { id: 't-urea', testName: 'Blood Urea Nitrogen (BUN)', loincCode: '3094-0', price: 150, turnaroundHours: 3, category: 'Biochemistry', isStatAvailable: true }
    ]
  },
  {
    id: 'anc-panel',
    name: '🤰 Antenatal ANC Maternal Screen',
    badge: '7 Screening Tests',
    description: 'CBC, Blood Grouping & Rh, Blood Sugar, HIV I/II, HBsAg, VDRL, Urine R/M',
    color: 'bg-purple-100 hover:bg-purple-200 text-purple-900 border-purple-300',
    tests: [
      { id: 't-cbc', testName: 'Complete Blood Count (CBC / Hemogram)', loincCode: '58410-2', price: 350, turnaroundHours: 4, category: 'Hematology', isStatAvailable: true },
      { id: 't-bgroup', testName: 'ABO & Rh Blood Grouping', loincCode: '883-9', price: 150, turnaroundHours: 2, category: 'Immunohematology', isStatAvailable: true },
      { id: 't-rbs', testName: 'Random Blood Sugar (RBS)', loincCode: '2339-0', price: 100, turnaroundHours: 1, category: 'Biochemistry', isStatAvailable: true },
      { id: 't-hiv', testName: 'HIV 1 & 2 Rapid Screening Test', loincCode: '68961-7', price: 350, turnaroundHours: 2, category: 'Serology', isStatAvailable: true },
      { id: 't-hbsag', testName: 'Hepatitis B Surface Antigen (HBsAg)', loincCode: '5196-1', price: 300, turnaroundHours: 2, category: 'Serology', isStatAvailable: true },
      { id: 't-vdrl', testName: 'VDRL / RPR Syphilis Screen', loincCode: '20507-0', price: 200, turnaroundHours: 2, category: 'Serology', isStatAvailable: true },
      { id: 't-urine', testName: 'Urine Routine & Microscopic Examination', loincCode: '24356-8', price: 150, turnaroundHours: 2, category: 'Clinical Pathology', isStatAvailable: true }
    ]
  },
  {
    id: 'master-checkup',
    name: '🧪 Executive Master Health Checkup',
    badge: 'Comprehensive Bio Panel',
    description: 'CBC, Liver Function Test (LFT), Kidney Function Test (KFT), Lipid Profile, HbA1c, Thyroid TSH, Urine Analysis',
    color: 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-emerald-300',
    tests: [
      { id: 't-cbc', testName: 'Complete Blood Count (CBC / Hemogram)', loincCode: '58410-2', price: 350, turnaroundHours: 4, category: 'Hematology', isStatAvailable: true },
      { id: 't-lft', testName: 'Liver Function Test (LFT - Bilirubin, SGPT, SGOT, ALP, Proteins)', loincCode: '24325-3', price: 750, turnaroundHours: 6, category: 'Biochemistry', isStatAvailable: false },
      { id: 't-kft', testName: 'Kidney Function Test (KFT - Urea, Creatinine, Uric Acid, Electrolytes)', loincCode: '24362-6', price: 750, turnaroundHours: 6, category: 'Biochemistry', isStatAvailable: false },
      { id: 't-lipid', testName: 'Lipid Profile (Cholesterol, Triglycerides, HDL, LDL)', loincCode: '24331-1', price: 650, turnaroundHours: 6, category: 'Biochemistry', isStatAvailable: false },
      { id: 't-hba1c', testName: 'HbA1c (Glycated Hemoglobin HPLC)', loincCode: '4544-3', price: 500, turnaroundHours: 4, category: 'Biochemistry', isStatAvailable: true },
      { id: 't-tsh', testName: 'Thyroid Stimulating Hormone (Ultrasensitive TSH)', loincCode: '3016-3', price: 350, turnaroundHours: 6, category: 'Endocrine', isStatAvailable: false },
      { id: 't-urine', testName: 'Urine Routine & Microscopic Examination', loincCode: '24356-8', price: 150, turnaroundHours: 2, category: 'Clinical Pathology', isStatAvailable: true }
    ]
  }
];

/**
 * Resolves diagnostic bundles with live clinic/pathology lab rate card prices
 */
export function getClinicDiagnosticBundles(podId?: string): DiagnosticBundle[] {
  const liveCatalog = LabService.getTestCatalog(podId);
  const catalogMap = new Map<string, DiagnosticTest>();
  liveCatalog.forEach(t => catalogMap.set(t.loincCode, t));

  return CLINIC_DIAGNOSTIC_BUNDLES.map(bundle => {
    const updatedTests = bundle.tests.map(t => {
      const live = catalogMap.get(t.loincCode);
      return {
        ...t,
        price: live && typeof live.price === 'number' ? live.price : t.price
      };
    });
    return {
      ...bundle,
      tests: updatedTests
    };
  });
}

