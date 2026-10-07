/**
 * ╔════════════════════════════════════════════════════════════════╗
 * ║  EAGLE-EYE OCR — STAGE 3: POST-EXTRACTION FUZZY CORRECTOR    ║
 * ║  Auto-corrects hallucinated medicine names after Gemini       ║
 * ║  extraction using Levenshtein distance matching.              ║
 * ║  Dependencies: ZERO (pure TypeScript algorithm)               ║
 * ╚════════════════════════════════════════════════════════════════╝
 */

import { MEDICINE_ALIASES, INDIAN_LAB_TESTS } from '../data/indianMedicalContext';
import { PharmacyService } from '../services/pharmacyService';

// ─────────────────────────────────────────────────────────────────────────────
// CONTINUOUS LEARNING: OCR ALIAS MEMORY CACHE
// ─────────────────────────────────────────────────────────────────────────────
export function getOcrAliasMemory(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('vitalsync_ocr_aliases');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {};
}

export function learnOcrAlias(mistake: string, correction: string) {
  if (typeof window === 'undefined') return;
  if (!mistake || !correction || mistake.trim().toLowerCase() === correction.trim().toLowerCase()) return;
  try {
    const mem = getOcrAliasMemory();
    mem[mistake.trim().toLowerCase()] = correction.trim();
    localStorage.setItem('vitalsync_ocr_aliases', JSON.stringify(mem));
    console.log(`[OCR Learning] Learned mapping: "${mistake}" -> "${correction}"`);
  } catch (e) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// LEVENSHTEIN DISTANCE (Edit Distance Algorithm)
// Lower score = more similar strings
// ─────────────────────────────────────────────────────────────────────────────
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = [];

  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMILARITY SCORE (0-100, higher = more similar)
// ─────────────────────────────────────────────────────────────────────────────
export function similarityScore(a: string, b: string): number {
  const cleanA = (a || '').toLowerCase().trim();
  const cleanB = (b || '').toLowerCase().trim();
  const dist = levenshteinDistance(cleanA, cleanB);
  const maxLen = Math.max(cleanA.length, cleanB.length);
  if (maxLen === 0) return 100;
  return Math.round((1 - dist / maxLen) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN DECOUPLER: Splits brand stem from strength numbers & dosage forms
// ─────────────────────────────────────────────────────────────────────────────
export interface ParsedDrugToken {
  cleanStem: string;
  strength?: string;
  dosageForm?: string;
  raw: string;
}

export function splitDrugNameAndStrength(extractedName: string): ParsedDrugToken {
  if (!extractedName) return { cleanStem: '', raw: '' };
  const raw = extractedName.trim();

  // Extract strength numbers (e.g., 625, 650, 500, 40mg, 10, 0.5, 2.5mg, 1g)
  const strengthRegex = /\b(\d+(?:\.\d+)?\s*(?:mg|mcg|gm|g|ml|iu|k)?)\b/i;
  const strengthMatch = raw.match(strengthRegex);
  const strength = strengthMatch ? strengthMatch[1].replace(/\s+/g, '').toLowerCase() : undefined;

  // Extract dosage form tokens
  const formRegex = /\b(tab(?:let)?s?|cap(?:sule)?s?|syp|syrup|inj(?:ection)?s?|drops?|susp(?:ension)?|gel|oint(?:ment)?)\b/i;
  const formMatch = raw.match(formRegex);
  const dosageForm = formMatch ? formMatch[1] : undefined;

  // Remove strength and form to get the pure drug brand stem
  let cleanStem = raw
    .replace(strengthRegex, '')
    .replace(formRegex, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  return { cleanStem, strength, dosageForm, raw };
}

// ─────────────────────────────────────────────────────────────────────────────
// STRENGTH ANCHOR SIGNATURES (Closed-world Indian pharmacology map)
// ─────────────────────────────────────────────────────────────────────────────
const STRENGTH_SIGNATURES: Record<string, string[]> = {
  '625': ['Augmentin', 'Clavam', 'Moxikind-CV', 'Clavam-625'],
  '650': ['Dolo', 'Calpol', 'Paracip', 'Dolopar', 'Dolo-650', 'Calpol-650'],
  '40': ['Pan', 'Pantocid', 'Pantop', 'Telma', 'Cresar', 'Tazloc', 'Nexpro', 'Sompraz', 'Lasix'],
  '20': ['Omez', 'Ocid', 'Rabeloc', 'Rabium', 'Rozavel', 'Atorva'],
  '10': ['Atorva', 'Lipicure', 'Cilacar', 'Jardiance', 'Forxiga', 'Nexito', 'Stalopam', 'Montair'],
  '500': ['Glycomet', 'Azee', 'Azithral', 'Cifran', 'Ciplox', 'Taxim', 'Metrogyl'],
  '250': ['Azee', 'Azithral', 'Ceftum', 'Taxim'],
  '200': ['Taxim-O', 'Zifi', 'Mahacef', 'Monocef-O', 'Gudcef', 'Cepodem']
};

// ─────────────────────────────────────────────────────────────────────────────
// TIER 1: ACTIVE CLINIC PHARMACY INVENTORY GROUNDING
// ─────────────────────────────────────────────────────────────────────────────
function matchClinicInventory(stem: string, raw: string): { corrected: string; wasFixed: boolean; confidence: number } | null {
  try {
    const inventory = PharmacyService.getPharmacyInventory() || [];
    if (!inventory || inventory.length === 0) return null;

    let bestMatch: any = null;
    let highestScore = 0;

    for (const item of inventory) {
      const itemName = (item.name || '').toLowerCase();
      const itemGeneric = (item.genericName || '').toLowerCase();

      const sStem = similarityScore(stem, itemName);
      const sRaw = similarityScore(raw, itemName);
      const sGeneric = similarityScore(stem, itemGeneric);
      const maxS = Math.max(sStem, sRaw, sGeneric);

      if (maxS > highestScore) {
        highestScore = maxS;
        bestMatch = item;
      }
    }

    if (highestScore >= 75 && bestMatch) {
      return {
        corrected: bestMatch.name,
        wasFixed: true,
        confidence: highestScore
      };
    }
  } catch (_e) {
    // Non-blocking fallback
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MEDICINE NAME FUZZY CORRECTOR (Neuro-Symbolic Hybrid)
// ─────────────────────────────────────────────────────────────────────────────
export function fuzzyCorrectMedicineName(extractedName: string): { corrected: string; wasFixed: boolean; confidence: number } {
  if (!extractedName || extractedName.trim().length < 2) {
    return { corrected: extractedName, wasFixed: false, confidence: 0 };
  }

  // 0. TIER 0: Local Continuous Learning Memory (Self-Healing)
  const aliasMemory = getOcrAliasMemory();
  const cleanRaw = extractedName.trim().toLowerCase();
  if (aliasMemory[cleanRaw]) {
    console.log(`[OCR Learning] Tier 0 Memory Match: "${extractedName}" → "${aliasMemory[cleanRaw]}"`);
    return { corrected: aliasMemory[cleanRaw], wasFixed: true, confidence: 100 };
  }

  const { cleanStem, strength, raw } = splitDrugNameAndStrength(extractedName);
  const cleanExtracted = raw.toLowerCase();

  // 1. TIER 1: Check active Clinic Pharmacy Inventory (~800 SKUs)
  const clinicMatch = matchClinicInventory(cleanStem || cleanExtracted, cleanExtracted);
  if (clinicMatch && clinicMatch.confidence >= 75) {
    console.log(`[OCR Fuzzy] Tier 1 Clinic Stock Match: "${extractedName}" → "${clinicMatch.corrected}" (${clinicMatch.confidence}%)`);
    return clinicMatch;
  }

  // 2. TIER 2: Strength-Anchored Quick Match (e.g. 625 -> Amox-Clav, 650 -> Paracetamol)
  if (strength) {
    const numOnly = strength.replace(/\D/g, '');
    const signatures = STRENGTH_SIGNATURES[numOnly];
    if (signatures) {
      for (const candidateBrand of signatures) {
        const score = similarityScore(cleanStem, candidateBrand.toLowerCase());
        if (score >= 60) {
          const resolvedFull = MEDICINE_ALIASES[candidateBrand] || candidateBrand;
          console.log(`[OCR Fuzzy] Strength-Anchored (${numOnly}): "${extractedName}" → "${resolvedFull}" (${score}%)`);
          return { corrected: resolvedFull, wasFixed: true, confidence: Math.max(score, 95) };
        }
      }
    }
  }

  // 3. TIER 3: National Lexicon Matching on Clean Stem and Raw Name
  let bestMatch = { brand: '', full: '', score: 0 };

  for (const [brand, full] of Object.entries(MEDICINE_ALIASES)) {
    const brandLower = brand.toLowerCase();
    const fullLower = full.toLowerCase();

    // Check similarity on clean stem
    const sStemBrand = cleanStem ? similarityScore(cleanStem, brandLower) : 0;
    // Check similarity on full raw name
    const sRawBrand = similarityScore(cleanExtracted, brandLower);
    const sRawFull = similarityScore(cleanExtracted, fullLower);

    const score = Math.max(sStemBrand, sRawBrand, sRawFull);

    if (score > bestMatch.score) {
      bestMatch = { brand, full, score };
    }

    // Substring containment bonus
    if ((cleanStem && cleanStem.includes(brandLower)) || cleanExtracted.includes(brandLower)) {
      if (score > 60) {
        bestMatch = { brand, full, score: Math.max(score, 88) };
      }
    }
  }

  // 75% threshold on decoupled stems avoids false positives while catching handwritten variants
  const CORRECTION_THRESHOLD = 75;
  if (bestMatch.score >= CORRECTION_THRESHOLD) {
    console.log(`[OCR Fuzzy] Lexicon Match: "${extractedName}" → "${bestMatch.full}" (${bestMatch.score}%)`);
    return {
      corrected: bestMatch.full,
      wasFixed: true,
      confidence: bestMatch.score,
    };
  }

  return { corrected: extractedName, wasFixed: false, confidence: bestMatch.score };
}

// ─────────────────────────────────────────────────────────────────────────────
// LAB TEST ACRONYM MAP & FUZZY CORRECTOR
// ─────────────────────────────────────────────────────────────────────────────
const LAB_ACRONYMS: Record<string, { name: string; loincCode: string }> = {
  'cbc': { name: 'Complete Blood Count (CBC)', loincCode: '58410-2' },
  'kft': { name: 'Kidney Function Test (KFT)', loincCode: '2160-0' },
  'rft': { name: 'Renal Function Test (RFT)', loincCode: '2160-0' },
  'lft': { name: 'Liver Function Test (LFT)', loincCode: '1975-2' },
  'hba1c': { name: 'Glycosylated Hemoglobin (HbA1c)', loincCode: '4544-3' },
  'fbs': { name: 'Fasting Blood Sugar (FBS)', loincCode: '14749-6' },
  'ppbs': { name: 'Post Prandial Blood Sugar (PPBS)', loincCode: '2345-7' },
  'rbs': { name: 'Random Blood Sugar (RBS)', loincCode: '2339-0' },
  'tsh': { name: 'Thyroid Stimulating Hormone (TSH)', loincCode: '3016-3' },
  'esr': { name: 'Erythrocyte Sedimentation Rate (ESR)', loincCode: '30341-2' },
  'crp': { name: 'C-Reactive Protein (CRP)', loincCode: '1988-5' },
  'creatinine': { name: 'Serum Creatinine', loincCode: '2160-0' },
  'serum creatinine': { name: 'Serum Creatinine', loincCode: '2160-0' },
  'uric acid': { name: 'Serum Uric Acid', loincCode: '3084-1' },
  'calcium': { name: 'Serum Calcium', loincCode: '17861-6' },
  'urine r/m': { name: 'Urine Routine & Microscopic', loincCode: '5778-6' },
  'urine routine': { name: 'Urine Routine', loincCode: '5778-6' },
  'urine': { name: 'Urine Routine', loincCode: '5778-6' },
  'widal': { name: 'Widal Test (Typhoid)', loincCode: '22313-3' },
  'dengue': { name: 'Dengue Serology (NS1/IgM/IgG)', loincCode: '95673-3' },
  'ns1': { name: 'Dengue NS1 Antigen', loincCode: '95673-3' },
  'malaria': { name: 'Malaria Antigen (Rapid Test)', loincCode: '9825-2' },
  'lipid': { name: 'Lipid Profile', loincCode: '57698-3' },
  'lipid profile': { name: 'Lipid Profile', loincCode: '57698-3' },
  'vitamin d': { name: 'Vitamin D3 (25-Hydroxy)', loincCode: '62292-8' },
  'vit d': { name: 'Vitamin D3', loincCode: '62292-8' },
  'vitamin b12': { name: 'Vitamin B12', loincCode: '2132-9' },
  'vit b12': { name: 'Vitamin B12', loincCode: '2132-9' },
  'ecg': { name: 'Electrocardiogram (ECG)', loincCode: '11524-6' },
  'cxr': { name: 'Chest X-Ray PA View', loincCode: 'XR-CHEST' },
  'usg': { name: 'Ultrasound Whole Abdomen (USG)', loincCode: 'USG-ABDOMEN' }
};

export function fuzzyCorrectLabTest(extractedTest: any): { name: string; loincCode?: string; wasFixed: boolean } {
  const rawName = typeof extractedTest === 'string' ? extractedTest : (extractedTest?.name || '');
  if (!rawName || rawName.trim().length < 2) {
    return { name: rawName, wasFixed: false };
  }

  const cleanName = rawName.trim().toLowerCase();

  // 1. Direct Acronym Match
  if (LAB_ACRONYMS[cleanName]) {
    const item = LAB_ACRONYMS[cleanName];
    return {
      name: item.name,
      loincCode: item.loincCode,
      wasFixed: true
    };
  }

  // 2. Acronym substring check
  for (const [acronym, item] of Object.entries(LAB_ACRONYMS)) {
    if (cleanName === acronym || cleanName.includes(acronym) || acronym.includes(cleanName)) {
      return {
        name: item.name,
        loincCode: item.loincCode,
        wasFixed: true
      };
    }
  }

  // 3. Indian Lab Tests Catalog Fuzzy Match
  let bestMatch = { testName: '', loincCode: '', score: 0 };

  for (const [testName, loincCode] of Object.entries(INDIAN_LAB_TESTS)) {
    const score = similarityScore(cleanName, testName.toLowerCase());
    if (score > bestMatch.score) {
      bestMatch = { testName, loincCode, score };
    }
  }

  if (bestMatch.score >= 75) {
    return {
      name: bestMatch.testName,
      loincCode: bestMatch.loincCode,
      wasFixed: bestMatch.testName.toLowerCase() !== cleanName,
    };
  }

  return {
    name: rawName,
    loincCode: typeof extractedTest === 'object' ? extractedTest?.loincCode : undefined,
    wasFixed: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT: Full OCR Result Fuzzy Corrector
// Intercepts parsed Gemini JSON and corrects all medicine/lab names
// ─────────────────────────────────────────────────────────────────────────────
export function applyOcrFuzzyCorrections(parsedResult: any): any {
  if (!parsedResult || typeof parsedResult !== 'object') return parsedResult;

  let correctionCount = 0;
  const corrected = { ...parsedResult };

  // ── Correct Medications ──────────────────────────────────────────
  const rawMeds = parsedResult.medications || parsedResult.medicines || [];
  if (Array.isArray(rawMeds) && rawMeds.length > 0) {
    corrected.medications = rawMeds.map((med: any) => {
      if (!med || typeof med !== 'object') return med;
      const medName = med.medicineName || med.name || '';
      const { corrected: fixedName, wasFixed, confidence } = fuzzyCorrectMedicineName(medName);
      if (wasFixed) correctionCount++;
      return {
        ...med,
        medicineName: fixedName,
        _fuzzyConfidence: confidence,
        _originalExtracted: wasFixed ? medName : undefined,
      };
    });
  }

  // ── Correct Lab Tests ────────────────────────────────────────────
  const rawLabs = parsedResult.labTests || parsedResult.diagnosticTests || [];
  if (Array.isArray(rawLabs) && rawLabs.length > 0) {
    corrected.labTests = rawLabs.map((test: any) => {
      const { name, loincCode, wasFixed } = fuzzyCorrectLabTest(test);
      if (wasFixed) correctionCount++;
      const original = typeof test === 'object' ? test : { name: test };
      return {
        ...original,
        name,
        loincCode: loincCode || original.loincCode,
      };
    });
  }

  if (correctionCount > 0) {
    console.log(`[OCR Fuzzy] ✅ Applied ${correctionCount} auto-corrections to OCR output.`);
  }

  return corrected;
}
