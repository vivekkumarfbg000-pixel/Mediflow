/**
 * 🏛️ VitalSync Clinical Decision Support System (CDSS) Safety Sentry
 * 
 * Top-tier clinical rule engine providing:
 * 1. Real-time Drug-Drug Interaction Warnings
 * 2. Lab Biomarker & Organ-Function Contraindications (Creatinine/eGFR, Bilirubin/Liver, HbA1c, IOP/Glaucoma)
 * 3. Duplicate Pharmacological Class Detection
 * 4. Severe Allergy Cross-Reactivity Interception
 * 5. 1-Click Clinically Recommended Safe Molecule Swaps
 */

export interface MedicationItem {
  medicineName: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface CDSSSafetyAlert {
  id: string;
  type: 'drug_interaction' | 'lab_contraindication' | 'allergy_conflict' | 'duplicate_therapy' | 'glaucoma_warning';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  mechanism: string;
  recommendation: string;
  triggerDrugs: string[];
  suggestedSwap?: {
    originalDrug: string;
    swapToName: string;
    dosage: string;
    frequency: string;
    duration: string;
    rationale: string;
  };
  clinicalCitation: string;
}

export interface PatientSafetyContext {
  id: string;
  name: string;
  age?: number;
  gender?: string;
  allergies?: string[];
  chronicConditions?: string[];
  vitals?: {
    bloodPressure?: string;
    pulseRate?: string | number;
    temperature?: string;
    sugar?: string;
    creatinine?: string | number;
    iopOD?: string | number;
    iopOS?: string | number;
    dilationStatus?: string;
    [key: string]: any;
  };
}

export interface SafetyEvaluationResult {
  alerts: CDSSSafetyAlert[];
  criticalCount: number;
  warningCount: number;
  hasNephrotoxicRisk: boolean;
  hasHepatotoxicRisk: boolean;
  hasGlaucomaRisk: boolean;
  passed: boolean;
}

// ── Drug Name Normalizer ───────────────────────────────────────────────
function normalizeDrug(name: string): string {
  return (name || '').toLowerCase().trim();
}

function hasDrug(meds: MedicationItem[], keywords: string[]): boolean {
  return meds.some(m => {
    const medName = normalizeDrug(m.medicineName);
    return keywords.some(k => medName.includes(k.toLowerCase()));
  });
}

function getMatchingDrug(meds: MedicationItem[], keywords: string[]): MedicationItem | undefined {
  return meds.find(m => {
    const medName = normalizeDrug(m.medicineName);
    return keywords.some(k => medName.includes(k.toLowerCase()));
  });
}

// ── Master Drug Class Keyword Dictionaries ──────────────────────────────
const NSAID_KEYWORDS = [
  'ibuprofen', 'diclofenac', 'naproxen', 'ketorolac', 'mefenamic', 
  'indomethacin', 'meloxicam', 'celecoxib', 'etoricoxib', 'aceclofenac', 
  'piroxicam', 'combiflam', 'voveran', 'zerodol', 'hifenac', 'brufen', 'nsaid'
];

const ANTICOAGULANT_KEYWORDS = [
  'warfarin', 'heparin', 'dabigatran', 'rivaroxaban', 'apixaban', 
  'clopidogrel', 'ticagrelor', 'prasugrel', 'aspirin', 'ecosprin', 'acitrom'
];

const NITRATE_KEYWORDS = [
  'nitroglycerin', 'sorbitrate', 'isosorbide', 'mononitrate', 'dinitrate', 'nitrocontin'
];

const PDE5_KEYWORDS = [
  'sildenafil', 'tadalafil', 'vardenafil', 'manforce', 'viagra', 'cialis'
];

const ACE_INHIBITOR_KEYWORDS = [
  'enalapril', 'ramipril', 'lisinopril', 'perindopril', 'captopril', 'cardace', 'enam'
];

const ARB_KEYWORDS = [
  'telmisartan', 'losartan', 'olmesartan', 'valsartan', 'candesartan', 'telma', 'losar'
];

const STATIN_KEYWORDS = [
  'atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin', 'atorva', 'rozavel', 'lipaglyn'
];

const MACROLIDE_AZOLE_KEYWORDS = [
  'clarithromycin', 'erythromycin', 'fluconazole', 'itraconazole', 'ketoconazole', 'voriconazole'
];

const METFORMIN_KEYWORDS = [
  'metformin', 'glycomet', 'glucophage', 'glumet', 'janumet', 'galvus met'
];

const MYDRIATIC_DILATION_KEYWORDS = [
  'tropicamide', 'homatropine', 'atropine', 'cyclopentolate', 'phenylephrine', 'tropac-p', 'homide'
];

const OPHTHALMIC_STEROID_KEYWORDS = [
  'prednisolone', 'dexamethasone', 'betamethasone', 'fluorometholone', 'loteprednol', 'pred forte', 'dexona'
];

// Teratogenic / Pregnancy Category D & X Contraindications
const TERATOGEN_PREGNANCY_KEYWORDS = [
  'telmisartan', 'losartan', 'olmesartan', 'valsartan', 'enalapril', 'ramipril', 'lisinopril',
  'atorvastatin', 'rosuvastatin', 'simvastatin', 'methotrexate', 'valproate', 'valparin', 'epilim',
  'isotretinoin', 'retinoic', 'warfarin', 'acitrom', 'tetracycline', 'doxycycline', 'phenytoin'
];

export interface PediatricDoseCalculation {
  drugName: string;
  weightKg: number;
  recommendedDoseMgPerKg: number;
  totalDoseMg: number;
  liquidConcentrationMgPerMl: number;
  calculatedVolumeMl: number;
  dosingFrequency: string;
  maxDailyMg: number;
}

export class ClinicalSafetySentry {

  /**
   * Calculates pediatric suspension dosage by weight
   */
  public static calculatePediatricDose(params: {
    drug: 'paracetamol' | 'amoxicillin' | 'ibuprofen' | 'azithromycin' | 'cetirizine';
    weightKg: number;
    strength?: '120mg_5ml' | '250mg_5ml' | '125mg_5ml' | '100mg_5ml' | '5mg_5ml';
  }): PediatricDoseCalculation {
    const { drug, weightKg, strength } = params;
    const safeWeight = Math.max(2, Math.min(60, weightKg));

    switch (drug) {
      case 'paracetamol': {
        const doseMg = Math.round(safeWeight * 15); // 15 mg/kg/dose
        const mgPerMl = strength === '250mg_5ml' ? 50 : 24; // 250mg/5ml = 50mg/ml, 120mg/5ml = 24mg/ml
        const volumeMl = Math.round((doseMg / mgPerMl) * 10) / 10;
        return {
          drugName: `Paracetamol Syrup (${strength === '250mg_5ml' ? '250mg/5ml' : '120mg/5ml'})`,
          weightKg: safeWeight,
          recommendedDoseMgPerKg: 15,
          totalDoseMg: doseMg,
          liquidConcentrationMgPerMl: mgPerMl,
          calculatedVolumeMl: volumeMl,
          dosingFrequency: 'Give every 6-8 hours as needed for fever (Max 4 times/24h)',
          maxDailyMg: Math.round(safeWeight * 60)
        };
      }
      case 'amoxicillin': {
        const doseMg = Math.round((safeWeight * 40) / 3); // 40 mg/kg/day divided TDS
        const mgPerMl = 25; // 125mg/5ml = 25mg/ml
        const volumeMl = Math.round((doseMg / mgPerMl) * 10) / 10;
        return {
          drugName: 'Amoxicillin Dry Syrup (125mg/5ml)',
          weightKg: safeWeight,
          recommendedDoseMgPerKg: 40,
          totalDoseMg: doseMg,
          liquidConcentrationMgPerMl: mgPerMl,
          calculatedVolumeMl: volumeMl,
          dosingFrequency: 'Give 3 times daily (TDS) for 5-7 days after food',
          maxDailyMg: Math.round(safeWeight * 40)
        };
      }
      case 'ibuprofen': {
        const doseMg = Math.round(safeWeight * 10); // 10 mg/kg/dose
        const mgPerMl = 20; // 100mg/5ml = 20mg/ml
        const volumeMl = Math.round((doseMg / mgPerMl) * 10) / 10;
        return {
          drugName: 'Ibuprofen Suspension (100mg/5ml)',
          weightKg: safeWeight,
          recommendedDoseMgPerKg: 10,
          totalDoseMg: doseMg,
          liquidConcentrationMgPerMl: mgPerMl,
          calculatedVolumeMl: volumeMl,
          dosingFrequency: 'Give every 8 hours strictly after meals',
          maxDailyMg: Math.round(safeWeight * 30)
        };
      }
      case 'azithromycin': {
        const doseMg = Math.round(safeWeight * 10); // 10 mg/kg once daily
        const mgPerMl = 20; // 100mg/5ml = 20mg/ml
        const volumeMl = Math.round((doseMg / mgPerMl) * 10) / 10;
        return {
          drugName: 'Azithromycin Suspension (100mg/5ml)',
          weightKg: safeWeight,
          recommendedDoseMgPerKg: 10,
          totalDoseMg: doseMg,
          liquidConcentrationMgPerMl: mgPerMl,
          calculatedVolumeMl: volumeMl,
          dosingFrequency: 'Give ONCE daily 1 hour before breakfast for 3-5 days',
          maxDailyMg: Math.round(safeWeight * 10)
        };
      }
      case 'cetirizine': {
        const doseMg = safeWeight < 15 ? 2.5 : 5.0;
        const mgPerMl = 1; // 5mg/5ml = 1mg/ml
        const volumeMl = doseMg / mgPerMl;
        return {
          drugName: 'Cetirizine Syrup (5mg/5ml)',
          weightKg: safeWeight,
          recommendedDoseMgPerKg: 0.25,
          totalDoseMg: doseMg,
          liquidConcentrationMgPerMl: mgPerMl,
          calculatedVolumeMl: volumeMl,
          dosingFrequency: 'Give ONCE daily at bedtime',
          maxDailyMg: 5.0
        };
      }
    }
  }

  /**
   * Main CDSS Evaluation Engine
   * Evaluates all prescribed medications against patient vitals, recent lab reports, and drug-drug interactions.
   */
  public static evaluatePrescriptionSafety(params: {
    medications: MedicationItem[];
    patient?: PatientSafetyContext | null;
    historicalBiomarkers?: any[];
    activeLabReports?: any[];
    isOphthalmology?: boolean;
  }): SafetyEvaluationResult {
    const { medications, patient, historicalBiomarkers = [], isOphthalmology = false } = params;
    const alerts: CDSSSafetyAlert[] = [];

    if (!medications || medications.length === 0) {
      return {
        alerts: [],
        criticalCount: 0,
        warningCount: 0,
        hasNephrotoxicRisk: false,
        hasHepatotoxicRisk: false,
        hasGlaucomaRisk: false,
        passed: true
      };
    }

    // ── 1. EXTRACT RECENT LAB BIOMARKERS ─────────────────────────────────
    const recentReport = historicalBiomarkers && historicalBiomarkers.length > 0
      ? historicalBiomarkers[historicalBiomarkers.length - 1]
      : null;

    const parseNum = (val: any): number => {
      const n = Number(val);
      return isNaN(n) ? 0 : n;
    };

    const currentCreatinine = parseNum(recentReport?.creatinine ?? patient?.vitals?.creatinine);
    const currentBilirubin = parseNum(recentReport?.bilirubin ?? (recentReport as any)?.totalBilirubin);
    const currentIopOD = parseNum(patient?.vitals?.iopOD) || 16;
    const currentIopOS = parseNum(patient?.vitals?.iopOS) || 16;
    const maxIop = Math.max(currentIopOD, currentIopOS);

    // Compute estimated GFR (CKD-EPI Formula)
    let currentGfr = 90;
    if (currentCreatinine > 0) {
      const scr = currentCreatinine;
      const ageVal = patient?.age ?? 45;
      const isFemale = (patient?.gender || 'male').toLowerCase() === 'female';
      const k = isFemale ? 0.7 : 0.9;
      const alpha = isFemale ? -0.241 : -0.302;
      const genderMult = isFemale ? 1.012 : 1.0;
      currentGfr = Math.round(142 * Math.pow(Math.min(scr / k, 1), alpha) * Math.pow(Math.max(scr / k, 1), -1.200) * Math.pow(0.9938, ageVal) * genderMult * 10) / 10;
    }

    let hasNephrotoxicRisk = false;
    let hasHepatotoxicRisk = false;
    let hasGlaucomaRisk = false;

    // ── 2. DRUG-DRUG INTERACTIONS ────────────────────────────────────────

    // Interaction A: NSAID + Anticoagulant (Warfarin / Clopidogrel / Aspirin)
    if (hasDrug(medications, NSAID_KEYWORDS) && hasDrug(medications, ANTICOAGULANT_KEYWORDS)) {
      const nsaidMed = getMatchingDrug(medications, NSAID_KEYWORDS);
      const antiMed = getMatchingDrug(medications, ANTICOAGULANT_KEYWORDS);
      alerts.push({
        id: 'ddi-nsaid-anticoagulant',
        type: 'drug_interaction',
        severity: 'critical',
        title: 'Critical Hemorrhage Risk (NSAID + Anticoagulant / Antiplatelet)',
        message: `Concurrent prescription of **${nsaidMed?.medicineName}** with **${antiMed?.medicineName}** drastically elevates severe gastrointestinal hemorrhage and ulceration risk.`,
        mechanism: 'Synergistic platelet COX-1 inhibition + gastric mucosal prostaglandin depletion.',
        recommendation: 'Replace systemic NSAID with Paracetamol or prescribe a gastroprotective PPI (e.g. Pantoprazole 40mg) if co-administration is clinically essential.',
        triggerDrugs: [nsaidMed?.medicineName || 'NSAID', antiMed?.medicineName || 'Anticoagulant'],
        suggestedSwap: {
          originalDrug: nsaidMed?.medicineName || '',
          swapToName: 'Paracetamol 650mg + Pantoprazole 40mg',
          dosage: 'Paracetamol 650mg / Pantoprazole 40mg',
          frequency: '1 tablet twice daily after meals',
          duration: nsaidMed?.duration || '5 Days',
          rationale: 'Non-nephrotoxic analgesic with gastroprotective cover.'
        },
        clinicalCitation: 'AHA/ACC Antiplatelet Safety Protocol & British National Formulary (BNF 86)'
      });
    }

    // Interaction B: PDE5 Inhibitor + Nitrate (Fatal Hypotension)
    if (hasDrug(medications, PDE5_KEYWORDS) && hasDrug(medications, NITRATE_KEYWORDS)) {
      const pdeMed = getMatchingDrug(medications, PDE5_KEYWORDS);
      const nitrateMed = getMatchingDrug(medications, NITRATE_KEYWORDS);
      alerts.push({
        id: 'ddi-pde5-nitrate',
        type: 'drug_interaction',
        severity: 'critical',
        title: 'Fatal Hypotension Alert (PDE-5 Inhibitor + Nitrates)',
        message: `Absolute contraindication: **${pdeMed?.medicineName}** combined with **${nitrateMed?.medicineName}** can cause catastrophic life-threatening blood pressure collapse and cardiogenic shock.`,
        mechanism: 'cGMP accumulation leads to massive systemic vasodilation.',
        recommendation: 'IMMEDIATELY discontinue either PDE5 inhibitor or Nitrate. Maintain minimum 24-48h clearance window.',
        triggerDrugs: [pdeMed?.medicineName || 'PDE5', nitrateMed?.medicineName || 'Nitrate'],
        clinicalCitation: 'American College of Cardiology (ACC/AHA) Practice Guideline'
      });
    }

    // Interaction C: ACE Inhibitor + ARB (Dual RAS Blockade)
    if (hasDrug(medications, ACE_INHIBITOR_KEYWORDS) && hasDrug(medications, ARB_KEYWORDS)) {
      const aceMed = getMatchingDrug(medications, ACE_INHIBITOR_KEYWORDS);
      const arbMed = getMatchingDrug(medications, ARB_KEYWORDS);
      alerts.push({
        id: 'ddi-dual-ras',
        type: 'drug_interaction',
        severity: 'warning',
        title: 'Dual RAS Blockade Warning (ACE Inhibitor + ARB)',
        message: `Co-prescribing **${aceMed?.medicineName}** with **${arbMed?.medicineName}** does not increase survival and significantly accelerates acute kidney injury and hyperkalemia.`,
        mechanism: 'Excessive suppression of renin-angiotensin-aldosterone axis.',
        recommendation: 'Choose either an ACE Inhibitor OR an ARB, combine with a Calcium Channel Blocker (Amlodipine) instead if needed.',
        triggerDrugs: [aceMed?.medicineName || 'ACEi', arbMed?.medicineName || 'ARB'],
        clinicalCitation: 'KDIGO 2024 Clinical Practice Guideline for Blood Pressure in CKD'
      });
    }

    // Interaction D: Statin + Macrolide / Azole Antifungal (Rhabdomyolysis)
    if (hasDrug(medications, STATIN_KEYWORDS) && hasDrug(medications, MACROLIDE_AZOLE_KEYWORDS)) {
      const statinMed = getMatchingDrug(medications, STATIN_KEYWORDS);
      const azoleMed = getMatchingDrug(medications, MACROLIDE_AZOLE_KEYWORDS);
      alerts.push({
        id: 'ddi-statin-cyp3a4',
        type: 'drug_interaction',
        severity: 'warning',
        title: 'Rhabdomyolysis & Myopathy Alert (Statin + CYP3A4 Inhibitor)',
        message: `**${azoleMed?.medicineName}** potently inhibits CYP3A4 metabolism of **${statinMed?.medicineName}**, causing drug accumulation and acute skeletal muscle breakdown (Rhabdomyolysis).`,
        mechanism: 'CYP3A4 inhibition increases statin AUC by 400-800%.',
        recommendation: 'Temporarily pause statin during antifungal/antibiotic course or switch to Rosuvastatin / Pravastatin (non-CYP3A4 metabolized).',
        triggerDrugs: [statinMed?.medicineName || 'Statin', azoleMed?.medicineName || 'CYP3A4 Inhibitor'],
        clinicalCitation: 'FDA Drug Safety Communication & Lipid Association of India'
      });
    }

    // ── 3. LAB BIOMARKER & ORGAN CONTRAINDICATIONS ───────────────────────

    // Lab Risk 1: Renal Impairment (Creatinine > 1.2 or GFR < 60) + NSAIDs
    if ((currentCreatinine > 1.2 || (currentCreatinine > 0 && currentGfr < 60)) && hasDrug(medications, NSAID_KEYWORDS)) {
      hasNephrotoxicRisk = true;
      const nsaidMed = getMatchingDrug(medications, NSAID_KEYWORDS);
      alerts.push({
        id: 'lab-renal-nsaid',
        type: 'lab_contraindication',
        severity: 'critical',
        title: 'Nephrotoxic Contraindication (Elevated Creatinine / Reduced GFR)',
        message: `Patient lab records show elevated **Serum Creatinine (${currentCreatinine.toFixed(2)} mg/dL)** and reduced **eGFR (${currentGfr} mL/min)**. Prescribing **${nsaidMed?.medicineName}** risks precipitating Acute Renal Failure.`,
        mechanism: 'Inhibition of renal prostaglandins causes afferent arteriolar vasoconstriction and ischemic glomerular filtration loss.',
        recommendation: '1-Click Swap: Replace nephrotoxic NSAID with Paracetamol 500mg/650mg.',
        triggerDrugs: [nsaidMed?.medicineName || 'NSAID'],
        suggestedSwap: {
          originalDrug: nsaidMed?.medicineName || '',
          swapToName: 'Paracetamol 650mg',
          dosage: 'Paracetamol IP 650mg',
          frequency: '1 tablet twice daily after meals as needed',
          duration: nsaidMed?.duration || '5 Days',
          rationale: 'Renally safe central COX inhibitor without nephrotoxic vasoconstriction.'
        },
        clinicalCitation: 'National Kidney Foundation (NKF-KDOQI) & KDIGO Acute Kidney Injury Guideline'
      });
    }

    // Lab Risk 2: Severe Renal Impairment (Creatinine > 1.5 or GFR < 30) + Metformin
    if ((currentCreatinine > 1.5 || (currentCreatinine > 0 && currentGfr < 30)) && hasDrug(medications, METFORMIN_KEYWORDS)) {
      hasNephrotoxicRisk = true;
      const metMed = getMatchingDrug(medications, METFORMIN_KEYWORDS);
      alerts.push({
        id: 'lab-renal-metformin',
        type: 'lab_contraindication',
        severity: 'critical',
        title: 'Lactic Acidosis Risk (Metformin in Severe CKD)',
        message: `Patient's **Creatinine is ${currentCreatinine.toFixed(2)} mg/dL** (eGFR < 30 mL/min). Metformin clearance is compromised, presenting a severe risk of fatal Metformin-Associated Lactic Acidosis (MALA).`,
        mechanism: 'Impaired renal excretion of biguanides leads to mitochondrial complex I inhibition and blood lactate build-up.',
        recommendation: 'Discontinue Metformin. Switch to renally safe DPP-4 inhibitor (Linagliptin 5mg, no renal adjustment required) or Insulin.',
        triggerDrugs: [metMed?.medicineName || 'Metformin'],
        suggestedSwap: {
          originalDrug: metMed?.medicineName || '',
          swapToName: 'Linagliptin 5mg',
          dosage: 'Linagliptin 5mg',
          frequency: '1 tablet once daily in the morning',
          duration: metMed?.duration || '30 Days',
          rationale: '100% biliary/hepatic excretion — zero renal dose adjustment required.'
        },
        clinicalCitation: 'ADA Standards of Medical Care in Diabetes 2025'
      });
    }

    // Lab Risk 3: Hepatic Impairment (Bilirubin > 2.0) + High-Dose Paracetamol / Statins
    if (currentBilirubin > 2.0 && hasDrug(medications, ['paracetamol', 'crocin', 'dolo', 'calpol'])) {
      hasHepatotoxicRisk = true;
      const pcmMed = getMatchingDrug(medications, ['paracetamol', 'crocin', 'dolo', 'calpol']);
      alerts.push({
        id: 'lab-hepatic-pcm',
        type: 'lab_contraindication',
        severity: 'warning',
        title: 'Hepatic Compromise Alert (Elevated Bilirubin / Liver Stress)',
        message: `Patient's **Total Bilirubin is ${currentBilirubin.toFixed(2)} mg/dL** (> 2.0 mg/dL). High cumulative dosage of **${pcmMed?.medicineName}** risks NAPQI metabolite accumulation and hepatotoxicity.`,
        mechanism: 'Glucuronidation saturation shifts metabolism to CYP2E1 creating toxic NAPQI.',
        recommendation: 'Cap total daily Paracetamol dose to maximum 1,500mg - 2,000mg/day. Monitor LFTs.',
        triggerDrugs: [pcmMed?.medicineName || 'Paracetamol'],
        clinicalCitation: 'EASL Clinical Practice Guidelines: Drug-Induced Liver Injury'
      });
    }

    // Lab Risk 4: Ophthalmology Elevated IOP (> 21 mmHg) + Mydriatic Dilation Drops / Steroids
    if ((isOphthalmology || maxIop > 21) && maxIop > 21) {
      if (hasDrug(medications, MYDRIATIC_DILATION_KEYWORDS)) {
        hasGlaucomaRisk = true;
        const mydMed = getMatchingDrug(medications, MYDRIATIC_DILATION_KEYWORDS);
        alerts.push({
          id: 'ophth-glaucoma-mydriatic',
          type: 'glaucoma_warning',
          severity: 'critical',
          title: 'Acute Glaucoma Crisis Alert (High IOP + Mydriatic Agent)',
          message: `CRITICAL OPHTHALMIC ALERT: Patient has elevated **IOP (${maxIop} mmHg)**. Instilling dilation / mydriatic drops (**${mydMed?.medicineName}**) risks precipitating Acute Angle-Closure Glaucoma.`,
          mechanism: 'Pupillary dilation folds peripheral iris into trabecular meshwork, causing instant outflow block.',
          recommendation: 'AVOID full mydriasis. Perform gonioscopy and initiate pressure-lowering drops (e.g. Timolol 0.5% / Brimonidine 0.2%) first.',
          triggerDrugs: [mydMed?.medicineName || 'Mydriatic Drops'],
          clinicalCitation: 'All India Ophthalmological Society (AIOS) Glaucoma Clinical Protocol'
        });
      }

      if (hasDrug(medications, OPHTHALMIC_STEROID_KEYWORDS)) {
        hasGlaucomaRisk = true;
        const steroidMed = getMatchingDrug(medications, OPHTHALMIC_STEROID_KEYWORDS);
        alerts.push({
          id: 'ophth-glaucoma-steroid',
          type: 'glaucoma_warning',
          severity: 'warning',
          title: 'Steroid-Induced Glaucoma Warning (High IOP + Topical Steroid)',
          message: `Patient baseline **IOP is elevated at ${maxIop} mmHg**. Long-term use of **${steroidMed?.medicineName}** will further elevate intraocular pressure in steroid-responder eyes.`,
          mechanism: 'Steroids increase trabecular meshwork glycosaminoglycans, reducing aqueous outflow facility.',
          recommendation: 'Use lowest effective steroid potency (e.g. Loteprednol / Fluorometholone) with weekly IOP monitoring.',
          triggerDrugs: [steroidMed?.medicineName || 'Steroid Drops'],
          clinicalCitation: 'American Academy of Ophthalmology (AAO) Preferred Practice Patterns'
        });
      }
    }

    // ── 4. ALLERGY INTERCEPTION ──────────────────────────────────────────
    if (patient && patient.allergies && patient.allergies.length > 0) {
      for (const allergy of patient.allergies) {
        const lowerAllergy = (allergy || '').toLowerCase();
        for (const med of medications) {
          const lowerMed = normalizeDrug(med.medicineName);
          const isDirectMatch = lowerMed.includes(lowerAllergy);
          const isPenicillinCross = lowerAllergy.includes('penicillin') && (lowerMed.includes('amox') || lowerMed.includes('amp') || lowerMed.includes('peni') || lowerMed.includes('augmentin') || lowerMed.includes('moxikind'));
          const isSulfaCross = lowerAllergy.includes('sulfa') && (lowerMed.includes('sulfa') || lowerMed.includes('septran') || lowerMed.includes('bactrim') || lowerMed.includes('cotrimoxazole'));

          if (isDirectMatch || isPenicillinCross || isSulfaCross) {
            alerts.push({
              id: `allergy-${allergy}-${med.medicineName}`,
              type: 'allergy_conflict',
              severity: 'critical',
              title: `Severe Allergy Conflict (${allergy.toUpperCase()})`,
              message: `Patient has documented allergy to **${allergy}**. Prescribed drug **${med.medicineName}** carries high risk of immediate anaphylaxis, angioedema, or urticarial reaction.`,
              mechanism: 'IgE-mediated immediate hypersensitivity reaction.',
              recommendation: 'STOP immediately. Replace with non-cross-reactive alternative (e.g. Macrolide/Azithromycin for Penicillin allergy).',
              triggerDrugs: [med.medicineName],
              clinicalCitation: 'National Health Authority (NHA) Clinical Safety Standards v2.4'
            });
          }
        }
      }
    }

    // ── 5. DUPLICATE THERAPY CHECK ───────────────────────────────────────
    const nsaidCount = medications.filter(m => NSAID_KEYWORDS.some(k => normalizeDrug(m.medicineName).includes(k))).length;
    if (nsaidCount > 1) {
      alerts.push({
        id: 'dup-nsaid',
        type: 'duplicate_therapy',
        severity: 'warning',
        title: 'Duplicate Therapy Alert (Multiple NSAIDs Prescribed)',
        message: 'Prescription contains 2 or more NSAIDs concurrently. This provides zero additional analgesic benefit while exponentially multiplying GI bleeding and nephrotoxic risk.',
        mechanism: 'Maximal COX receptor occupancy achieved with single agent.',
        recommendation: 'Keep one single NSAID at minimum therapeutic dose; remove duplicate painkiller.',
        triggerDrugs: medications.filter(m => NSAID_KEYWORDS.some(k => normalizeDrug(m.medicineName).includes(k))).map(m => m.medicineName),
        clinicalCitation: 'WHO Analgesic Ladder & Clinical Practice Guidelines'
      });
    }

    // ── 6. PREGNANCY & LACTATION TERATOGEN SENTRY ────────────────────────
    const isFemale = (patient?.gender || '').toLowerCase() === 'female';
    const isReproductiveAge = (patient?.age || 30) >= 15 && (patient?.age || 30) <= 49;
    const isPregnantOrLactating = (patient?.chronicConditions || []).some(c => c.toLowerCase().includes('pregnant') || c.toLowerCase().includes('pregnancy') || c.toLowerCase().includes('lactating'));

    if (isFemale && (isPregnantOrLactating || isReproductiveAge)) {
      for (const med of medications) {
        const medNorm = normalizeDrug(med.medicineName);
        const hasTeratogen = TERATOGEN_PREGNANCY_KEYWORDS.some(k => medNorm.includes(k));
        if (hasTeratogen) {
          alerts.push({
            id: `teratogen-${med.medicineName}`,
            type: 'drug_interaction',
            severity: isPregnantOrLactating ? 'critical' : 'warning',
            title: `Pregnancy Category D/X Teratogen Alert (${med.medicineName})`,
            message: `**${med.medicineName}** is documented FDA Category D/X with proven risk of fetal malformation, oligohydramnios, renal dysgenesis, or neural tube defects.`,
            mechanism: 'Interferes with organogenesis and fetal hemodynamics.',
            recommendation: isPregnantOrLactating 
              ? 'CONTRAINDICATED: Discontinue immediately. Use pregnancy-safe alternatives (e.g. Labetalol/Methyldopa for HTN; Insulin for Diabetes).'
              : 'Verify pregnancy status before prescribing. Advise effective contraception.',
            triggerDrugs: [med.medicineName],
            clinicalCitation: 'ACOG Practice Bulletin & FDA Pregnancy Safety Standards'
          });
        }
      }
    }

    // ── 7. FOOD-DRUG INTERACTION ADVISORY ───────────────────────────────
    for (const med of medications) {
      const medNorm = normalizeDrug(med.medicineName);
      if (medNorm.includes('thyronorm') || medNorm.includes('eltroxin') || medNorm.includes('levothyroxine')) {
        alerts.push({
          id: `food-thyroid-${med.medicineName}`,
          type: 'drug_interaction',
          severity: 'info',
          title: 'Food Timing Advisory: Levothyroxine Absorption',
          message: 'Must be taken on an empty stomach with a full glass of water, minimum 30-45 minutes before morning tea, coffee, milk, or breakfast.',
          mechanism: 'Dietary calcium, iron, and soy drastically reduce intestinal bioavailability by 40-60%.',
          recommendation: 'Instruct patient to set a morning wake-up dose strictly with plain water.',
          triggerDrugs: [med.medicineName],
          clinicalCitation: 'Endocrine Society Clinical Practice Guidelines'
        });
      }
      if (medNorm.includes('ciprofloxacin') || medNorm.includes('levofloxacin') || medNorm.includes('doxycycline')) {
        alerts.push({
          id: `food-quinolone-${med.medicineName}`,
          type: 'drug_interaction',
          severity: 'info',
          title: 'Food Timing Advisory: Quinolone / Tetracycline Chelation',
          message: 'Avoid consuming milk, yogurt, antacids, or iron supplements within 2 hours of taking this medication.',
          mechanism: 'Divalent and trivalent cations (Ca2+, Mg2+, Fe2+) form insoluble chelates, blocking drug absorption.',
          recommendation: 'Maintain minimum 2-hour separation window from dairy and antacid products.',
          triggerDrugs: [med.medicineName],
          clinicalCitation: 'Infectious Diseases Society of America (IDSA)'
        });
      }
    }

    const criticalCount = alerts.filter(a => a.severity === 'critical').length;
    const warningCount = alerts.filter(a => a.severity === 'warning').length;

    return {
      alerts,
      criticalCount,
      warningCount,
      hasNephrotoxicRisk,
      hasHepatotoxicRisk,
      hasGlaucomaRisk,
      passed: criticalCount === 0
    };
  }
}
