/**
 * 🏛️ VitalSync Doctor-Grade Critical Lab Intelligence Service
 * 
 * Physician-oriented clinical diagnostic analysis engine:
 * 1. Categorizes measured biomarkers into Critical High, High, Normal, Low, Critical Low.
 * 2. Compares against previous baseline reports to compute exact Delta % variance and clinical trajectory.
 * 3. Evaluates Target Organ Risks (Renal AKI/CKD, Hepatic Injury, Metabolic Glycemia, Hematological).
 * 4. Generates Actionable Pharmacotherapy Directives for the attending physician.
 * 5. Generates structured clinical findings for 1-Click insertion into encounter notes.
 */

export type BiomarkerSeverity = 'critical_high' | 'high' | 'normal' | 'low' | 'critical_low';

export interface ReferenceRange {
  min: number;
  max: number;
  criticalMin?: number;
  criticalMax?: number;
  unit: string;
  organSystem: 'Renal' | 'Hepatic' | 'Metabolic' | 'Hematology' | 'Cardiovascular' | 'Endocrine' | 'General';
  description: string;
}

export interface AnalyzedBiomarker {
  name: string;
  key: string;
  value: number | string;
  numericValue: number | null;
  unit: string;
  refMin: number;
  refMax: number;
  severity: BiomarkerSeverity;
  severityLabel: string;
  organSystem: string;
  deltaPercent?: number | null;
  deltaDirection?: 'increased' | 'decreased' | 'stable';
  baselineValue?: number | string | null;
  clinicalSignificance: string;
}

export interface DoctorLabInsightReport {
  testName: string;
  loincCode: string;
  patientName: string;
  date: string;
  totalParameters: number;
  abnormalCount: number;
  criticalCount: number;
  overallStatus: 'critical' | 'abnormal' | 'normal';
  biomarkers: AnalyzedBiomarker[];
  organRisks: {
    system: string;
    level: 'critical' | 'moderate' | 'low';
    findings: string[];
  }[];
  deltaTrends: {
    parameter: string;
    baseline: string | number;
    current: string | number;
    changeText: string;
    clinicalMeaning: string;
  }[];
  actionableDirectives: string[];
  suggestedPrescriptionAdjustments: string[];
  rxAdjustments?: string[];
  formattedClinicalNote: string;
}

// ── Standard Clinical Reference Range Catalog ───────────────────────────
const STANDARD_REFERENCE_INTERVALS: Record<string, ReferenceRange> = {
  hba1c: { min: 4.0, max: 5.6, criticalMax: 8.5, unit: '%', organSystem: 'Metabolic', description: 'Glycated Hemoglobin' },
  glucose: { min: 70, max: 99, criticalMin: 55, criticalMax: 200, unit: 'mg/dL', organSystem: 'Metabolic', description: 'Fasting Blood Sugar' },
  fastingbloodsugar: { min: 70, max: 99, criticalMin: 55, criticalMax: 200, unit: 'mg/dL', organSystem: 'Metabolic', description: 'Fasting Blood Sugar' },
  fbs: { min: 70, max: 99, criticalMin: 55, criticalMax: 200, unit: 'mg/dL', organSystem: 'Metabolic', description: 'Fasting Blood Sugar' },
  ppbs: { min: 70, max: 140, criticalMax: 250, unit: 'mg/dL', organSystem: 'Metabolic', description: 'Post-Prandial Blood Sugar' },
  creatinine: { min: 0.7, max: 1.2, criticalMax: 1.8, unit: 'mg/dL', organSystem: 'Renal', description: 'Serum Creatinine' },
  serumcreatinine: { min: 0.7, max: 1.2, criticalMax: 1.8, unit: 'mg/dL', organSystem: 'Renal', description: 'Serum Creatinine' },
  egfr: { min: 90, max: 150, criticalMin: 30, unit: 'mL/min/1.73m²', organSystem: 'Renal', description: 'Estimated GFR' },
  bun: { min: 7, max: 20, criticalMax: 40, unit: 'mg/dL', organSystem: 'Renal', description: 'Blood Urea Nitrogen' },
  urea: { min: 15, max: 40, criticalMax: 80, unit: 'mg/dL', organSystem: 'Renal', description: 'Serum Urea' },
  uricacid: { min: 3.5, max: 7.2, criticalMax: 9.0, unit: 'mg/dL', organSystem: 'Renal', description: 'Uric Acid' },
  bilirubin: { min: 0.2, max: 1.2, criticalMax: 2.5, unit: 'mg/dL', organSystem: 'Hepatic', description: 'Total Bilirubin' },
  totalbilirubin: { min: 0.2, max: 1.2, criticalMax: 2.5, unit: 'mg/dL', organSystem: 'Hepatic', description: 'Total Bilirubin' },
  sgpt: { min: 7, max: 56, criticalMax: 150, unit: 'U/L', organSystem: 'Hepatic', description: 'ALT / SGPT' },
  alt: { min: 7, max: 56, criticalMax: 150, unit: 'U/L', organSystem: 'Hepatic', description: 'ALT / SGPT' },
  sgot: { min: 8, max: 48, criticalMax: 150, unit: 'U/L', organSystem: 'Hepatic', description: 'AST / SGOT' },
  ast: { min: 8, max: 48, criticalMax: 150, unit: 'U/L', organSystem: 'Hepatic', description: 'AST / SGOT' },
  alkalinephosphatase: { min: 44, max: 147, criticalMax: 300, unit: 'U/L', organSystem: 'Hepatic', description: 'Alkaline Phosphatase (ALP)' },
  alp: { min: 44, max: 147, criticalMax: 300, unit: 'U/L', organSystem: 'Hepatic', description: 'Alkaline Phosphatase (ALP)' },
  hemoglobin: { min: 13.0, max: 17.5, criticalMin: 8.0, criticalMax: 19.0, unit: 'g/dL', organSystem: 'Hematology', description: 'Hemoglobin (Hb)' },
  hb: { min: 13.0, max: 17.5, criticalMin: 8.0, criticalMax: 19.0, unit: 'g/dL', organSystem: 'Hematology', description: 'Hemoglobin (Hb)' },
  wbc: { min: 4000, max: 11000, criticalMin: 2500, criticalMax: 20000, unit: '/µL', organSystem: 'Hematology', description: 'Total Leucocyte Count (TLC)' },
  tlc: { min: 4000, max: 11000, criticalMin: 2500, criticalMax: 20000, unit: '/µL', organSystem: 'Hematology', description: 'Total Leucocyte Count (TLC)' },
  platelets: { min: 150000, max: 450000, criticalMin: 50000, criticalMax: 800000, unit: '/µL', organSystem: 'Hematology', description: 'Platelet Count' },
  plateletcount: { min: 150000, max: 450000, criticalMin: 50000, criticalMax: 800000, unit: '/µL', organSystem: 'Hematology', description: 'Platelet Count' },
  cholesterol: { min: 125, max: 200, criticalMax: 260, unit: 'mg/dL', organSystem: 'Cardiovascular', description: 'Total Cholesterol' },
  totalcholesterol: { min: 125, max: 200, criticalMax: 260, unit: 'mg/dL', organSystem: 'Cardiovascular', description: 'Total Cholesterol' },
  triglycerides: { min: 50, max: 150, criticalMax: 300, unit: 'mg/dL', organSystem: 'Cardiovascular', description: 'Serum Triglycerides' },
  ldl: { min: 50, max: 100, criticalMax: 160, unit: 'mg/dL', organSystem: 'Cardiovascular', description: 'LDL Cholesterol' },
  hdl: { min: 40, max: 60, criticalMin: 30, unit: 'mg/dL', organSystem: 'Cardiovascular', description: 'HDL Cholesterol' },
  tsh: { min: 0.4, max: 4.0, criticalMin: 0.1, criticalMax: 10.0, unit: 'mIU/L', organSystem: 'Endocrine', description: 'Thyroid Stimulating Hormone' },
  sodium: { min: 135, max: 145, criticalMin: 125, criticalMax: 155, unit: 'mEq/L', organSystem: 'Renal', description: 'Serum Sodium (Na+)' },
  potassium: { min: 3.5, max: 5.1, criticalMin: 2.8, criticalMax: 6.0, unit: 'mEq/L', organSystem: 'Renal', description: 'Serum Potassium (K+)' }
};

function normalizeKey(key: string): string {
  return (key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export class DoctorLabIntelligenceService {

  /**
   * Generates a comprehensive physician-grade critical lab insight report.
   */
  public static analyzeLabReport(params: {
    reportItem: any;
    patientName: string;
    patientAge?: number;
    patientGender?: string;
    historicalReports?: any[];
  }): DoctorLabInsightReport {
    const { reportItem, patientName, patientAge = 45, patientGender = 'Male', historicalReports = [] } = params;

    // Extract raw biomarkers
    let rawBiomarkers: Record<string, any> = {};
    if (reportItem.biomarkerJson) {
      rawBiomarkers = reportItem.biomarkerJson.biomarkers || reportItem.biomarkerJson;
    } else if (reportItem.quantitativeResult) {
      try {
        const parsed = JSON.parse(reportItem.quantitativeResult);
        rawBiomarkers = parsed.biomarkers || parsed;
      } catch {
        rawBiomarkers = { resultValue: reportItem.quantitativeResult };
      }
    }

    const testName = reportItem.testName || 'Diagnostic Pathology Panel';
    const loincCode = reportItem.testCode || reportItem.loincCode || '4544-3';
    const dateStr = reportItem.createdAt || reportItem.created_at || new Date().toISOString().split('T')[0];

    // Find baseline historical report for delta trend
    const baselineReport = historicalReports && historicalReports.length >= 2
      ? historicalReports[historicalReports.length - 2]
      : null;
    let baselineBiomarkers: Record<string, any> = {};
    if (baselineReport) {
      if (baselineReport.biomarkerJson) {
        baselineBiomarkers = baselineReport.biomarkerJson.biomarkers || baselineReport.biomarkerJson;
      } else if (baselineReport.quantitativeResult) {
        try {
          const parsed = JSON.parse(baselineReport.quantitativeResult);
          baselineBiomarkers = parsed.biomarkers || parsed;
        } catch {
          baselineBiomarkers = baselineReport;
        }
      } else {
        baselineBiomarkers = baselineReport;
      }
    }

    const analyzedBiomarkers: AnalyzedBiomarker[] = [];
    const deltaTrends: DoctorLabInsightReport['deltaTrends'] = [];
    const directives: string[] = [];
    const rxAdjustments: string[] = [];

    let hasCritical = false;
    let abnormalCount = 0;
    let criticalCount = 0;

    // Evaluate each biomarker
    for (const [rawKey, rawVal] of Object.entries(rawBiomarkers)) {
      if (rawKey.endsWith('_unit') || rawKey === 'unit' || rawKey === 'testCode' || rawKey === 'timestamp' || rawKey === 'patientId' || rawKey === 'testName' || rawKey === 'status') {
        continue;
      }

      const normKey = normalizeKey(rawKey);
      const ref = STANDARD_REFERENCE_INTERVALS[normKey] || {
        min: 0,
        max: 100,
        unit: rawBiomarkers[`${rawKey}_unit`] || '',
        organSystem: 'General',
        description: rawKey
      };

      const extractedVal = typeof rawVal === 'object' && rawVal !== null ? (rawVal.value ?? rawVal.val ?? rawVal.result ?? '') : rawVal;
      const extractedUnit = typeof rawVal === 'object' && rawVal !== null && rawVal.unit ? String(rawVal.unit) : (rawBiomarkers[`${rawKey}_unit`] || rawBiomarkers.unit || ref.unit || '');
      const numericVal = typeof extractedVal === 'number' ? extractedVal : parseFloat(String(extractedVal));
      const isValidNum = !isNaN(numericVal);

      let severity: BiomarkerSeverity = 'normal';
      let severityLabel = 'NORMAL';
      let clinicalSignificance = 'Within standard biological reference intervals.';

      if (isValidNum) {
        if (ref.criticalMax && numericVal >= ref.criticalMax) {
          severity = 'critical_high';
          severityLabel = 'CRITICAL HIGH 🔴';
          clinicalSignificance = `Severely elevated above critical threshold (${ref.criticalMax} ${ref.unit}). Immediate clinical review required.`;
          hasCritical = true;
          criticalCount++;
          abnormalCount++;
        } else if (ref.criticalMin && numericVal <= ref.criticalMin) {
          severity = 'critical_low';
          severityLabel = 'CRITICAL LOW 🔴';
          clinicalSignificance = `Critically depressed below life-support safety range (${ref.criticalMin} ${ref.unit}).`;
          hasCritical = true;
          criticalCount++;
          abnormalCount++;
        } else if (numericVal > ref.max) {
          severity = 'high';
          severityLabel = 'ELEVATED ⚠️';
          clinicalSignificance = `Above normal reference limit (${ref.max} ${ref.unit}).`;
          abnormalCount++;
        } else if (numericVal < ref.min) {
          severity = 'low';
          severityLabel = 'LOW ⚠️';
          clinicalSignificance = `Below normal reference limit (${ref.min} ${ref.unit}).`;
          abnormalCount++;
        }
      }

      // Delta Variance Calculation
      let deltaPercent: number | null = null;
      let deltaDir: 'increased' | 'decreased' | 'stable' = 'stable';
      let baseVal: any = null;

      // Look up baseline
      const baseRawVal = baselineBiomarkers[rawKey] || baselineBiomarkers[normKey];
      if (baseRawVal !== undefined) {
        const baseNum = typeof baseRawVal === 'number' ? baseRawVal : parseFloat(String(baseRawVal));
        if (isValidNum && !isNaN(baseNum) && baseNum > 0) {
          baseVal = baseNum;
          deltaPercent = Math.round(((numericVal - baseNum) / baseNum) * 100);
          if (deltaPercent > 5) deltaDir = 'increased';
          else if (deltaPercent < -5) deltaDir = 'decreased';
          else deltaDir = 'stable';

          if (Math.abs(deltaPercent) >= 10) {
            deltaTrends.push({
              parameter: ref.description || rawKey,
              baseline: `${baseNum} ${ref.unit}`,
              current: `${numericVal} ${ref.unit}`,
              changeText: `${deltaPercent > 0 ? '↑ +' : '↓ '}${deltaPercent}%`,
              clinicalMeaning: deltaPercent > 0
                ? (severity.includes('high') ? 'Significant clinical worsening vs previous baseline.' : 'Upward trajectory noted.')
                : (severity.includes('high') ? 'Positive therapeutic response (improving toward normal).' : 'Downward trajectory noted.')
            });
          }
        }
      }

      analyzedBiomarkers.push({
        name: ref.description || rawKey.replace(/([A-Z])/g, ' $1').trim(),
        key: rawKey,
        value: rawVal,
        numericValue: isValidNum ? numericVal : null,
        unit: ref.unit,
        refMin: ref.min,
        refMax: ref.max,
        severity,
        severityLabel,
        organSystem: ref.organSystem,
        deltaPercent,
        deltaDirection: deltaDir,
        baselineValue: baseVal,
        clinicalSignificance
      });
    }

    // ── Generate Organ System Risk Matrix ──────────────────────────────
    const organRisks: DoctorLabInsightReport['organRisks'] = [];

    // 1. Renal System Risk (Creatinine / GFR / Urea)
    const creatBio = analyzedBiomarkers.find(b => normalizeKey(b.key).includes('creatinine'));
    if (creatBio && creatBio.numericValue) {
      const scr = creatBio.numericValue;
      const isFemale = patientGender.toLowerCase() === 'female';
      const k = isFemale ? 0.7 : 0.9;
      const alpha = isFemale ? -0.241 : -0.302;
      const genderMult = isFemale ? 1.012 : 1.0;
      const calcGfr = Math.round(142 * Math.pow(Math.min(scr / k, 1), alpha) * Math.pow(Math.max(scr / k, 1), -1.200) * Math.pow(0.9938, patientAge) * genderMult);

      if (scr > 1.4 || calcGfr < 60) {
        organRisks.push({
          system: 'Renal / Nephrotoxicity Risk',
          level: scr > 1.8 || calcGfr < 30 ? 'critical' : 'moderate',
          findings: [
            `Serum Creatinine elevated at ${scr.toFixed(2)} mg/dL (eGFR ~${calcGfr} mL/min/1.73m² - CKD Stage ${calcGfr < 30 ? 'G4/G5' : 'G3'}).`,
            'Afferent glomerular filtration compromised. Absolute risk of contrast/NSAID induced acute tubular necrosis.'
          ]
        });
        directives.push(`🚨 RENAL ALERT: eGFR is ${calcGfr} mL/min. Strictly withhold nephrotoxic NSAIDs (Ibuprofen, Diclofenac, Aceclofenac).`);
        rxAdjustments.push('Substitute NSAIDs with Paracetamol 650mg.');
        if (calcGfr < 30) {
          directives.push('🚨 Biguanide Alert: Discontinue Metformin due to lactic acidosis risk; switch to Linagliptin 5mg.');
          rxAdjustments.push('Switch Metformin to Linagliptin 5mg (no renal adjustment).');
        }
      }
    }

    // 2. Hepatic System Risk (Bilirubin / SGPT / SGOT)
    const biliBio = analyzedBiomarkers.find(b => normalizeKey(b.key).includes('bilirubin'));
    const sgptBio = analyzedBiomarkers.find(b => normalizeKey(b.key).includes('sgpt') || normalizeKey(b.key).includes('alt'));
    if ((biliBio && Number(biliBio.value) > 1.5) || (sgptBio && Number(sgptBio.value) > 70)) {
      organRisks.push({
        system: 'Hepatic / Liver Injury Risk',
        level: (biliBio && Number(biliBio.value) > 2.5) || (sgptBio && Number(sgptBio.value) > 150) ? 'critical' : 'moderate',
        findings: [
          `Total Bilirubin: ${biliBio?.value || '—'} mg/dL, SGPT/ALT: ${sgptBio?.value || '—'} U/L.`,
          'Hepatocellular / cholestatic strain detected. Hepatic drug clearance capacity impaired.'
        ]
      });
      directives.push('⚠️ HEPATIC ALERT: Elevated liver enzymes. Cap daily Paracetamol dose to ≤ 2,000mg/day.');
      rxAdjustments.push('Avoid high-dose Statins (Atorvastatin 80mg) and hepatotoxic antibiotics (Amoxicillin-Clavulanate) if jaundice present.');
    }

    // 3. Metabolic & Glycemic Risk (HbA1c / Glucose)
    const hba1cBio = analyzedBiomarkers.find(b => normalizeKey(b.key).includes('hba1c'));
    const fbsBio = analyzedBiomarkers.find(b => normalizeKey(b.key).includes('glucose') || normalizeKey(b.key).includes('fbs'));
    if (hba1cBio && Number(hba1cBio.value) >= 6.5) {
      const val = Number(hba1cBio.value);
      organRisks.push({
        system: 'Glycemic / Metabolic Control',
        level: val >= 8.5 ? 'critical' : 'moderate',
        findings: [
          `HbA1c: ${val}% (Target: < 7.0%). Average blood glucose ~${Math.round(28.7 * val - 46.7)} mg/dL.`,
          val >= 8.5 ? 'Severe uncontrolled hyperglycemic exposure with microvascular complication acceleration.' : 'Sub-optimal glycemic control.'
        ]
      });
      directives.push(`🩸 GLYCEMIC ALERT: HbA1c is ${val}%. Intensify anti-diabetic regimen (Dual therapy / SGLT2i addition).`);
      rxAdjustments.push('Consider adding Dapagliflozin 10mg or Teneligliptin 20mg if monotherapy failing.');
    } else if (fbsBio && Number(fbsBio.value) < 70) {
      directives.push('⚠️ HYPOGLYCEMIA ALERT: Fasting sugar < 70 mg/dL. Review Sulfonylurea dosage to avoid neuroglycopenia.');
    }

    // 4. Hematological Risk (Hemoglobin / Platelets)
    const hbBio = analyzedBiomarkers.find(b => normalizeKey(b.key).includes('hemoglobin') || normalizeKey(b.key) === 'hb');
    const pltBio = analyzedBiomarkers.find(b => normalizeKey(b.key).includes('platelet'));
    if (hbBio && Number(hbBio.value) < 11.0) {
      const hbVal = Number(hbBio.value);
      organRisks.push({
        system: 'Hematology / Anemia Severity',
        level: hbVal < 8.0 ? 'critical' : 'moderate',
        findings: [
          `Hemoglobin: ${hbVal} g/dL (${hbVal < 8.0 ? 'Severe Anemia' : 'Moderate Anemia'}).`,
          'Tissue oxygen delivery capacity impaired. Screen for iron deficiency / occult GI blood loss.'
        ]
      });
      directives.push(`🩸 ANEMIA ALERT: Hb ${hbVal} g/dL. Initiate oral Iron (Ferrous Ascorbate + Folic Acid) and dietary counseling.`);
      rxAdjustments.push('Prescribe Ferrous Ascorbate 100mg + Folic Acid 1.5mg OD.');
    }
    if (pltBio && Number(pltBio.value) < 100000) {
      organRisks.push({
        system: 'Hematology / Thrombocytopenia',
        level: Number(pltBio.value) < 50000 ? 'critical' : 'moderate',
        findings: [
          `Platelets: ${pltBio.value} /µL. Elevated spontaneous bleeding risk.`,
          'Avoid intramuscular injections and antiplatelet / anticoagulant agents.'
        ]
      });
      directives.push('🚨 THROMBOCYTOPENIA ALERT: Platelets < 100k. Avoid Aspirin, Clopidogrel, and NSAIDs.');
    }

    // Default directive if clean
    if (directives.length === 0) {
      directives.push('✅ All analyzed parameters are within biological reference limits. Maintain current therapeutic protocol.');
    }

    // Generate Formatted Doctor Encounter Note
    let formattedNote = `[LAB INTELLIGENCE FINDINGS - ${testName.toUpperCase()}] (${dateStr})\n`;
    if (analyzedBiomarkers.length > 0) {
      formattedNote += `• Key Biomarkers: ` + analyzedBiomarkers.map(b => `${b.name}: ${b.value} ${b.unit} [${b.severityLabel}]`).join(', ') + `\n`;
    }
    if (deltaTrends.length > 0) {
      formattedNote += `• Historical Trend Delta: ` + deltaTrends.map(d => `${d.parameter} (${d.baseline} → ${d.current}, ${d.changeText})`).join('; ') + `\n`;
    }
    if (organRisks.length > 0) {
      formattedNote += `• Clinical Organ Risk: ` + organRisks.map(r => `${r.system} (${r.level.toUpperCase()})`).join('; ') + `\n`;
    }
    if (directives.length > 0) {
      formattedNote += `• Doctor Guidance: ` + directives.join(' ') + `\n`;
    }

    return {
      testName,
      loincCode,
      patientName,
      date: dateStr,
      totalParameters: analyzedBiomarkers.length,
      abnormalCount,
      criticalCount,
      overallStatus: hasCritical ? 'critical' : abnormalCount > 0 ? 'abnormal' : 'normal',
      biomarkers: analyzedBiomarkers,
      organRisks,
      deltaTrends,
      actionableDirectives: directives,
      suggestedPrescriptionAdjustments: rxAdjustments,
      formattedClinicalNote: formattedNote
    };
  }
}
