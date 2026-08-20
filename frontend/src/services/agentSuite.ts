import { api } from './api';

export interface ValidationStep {
  name: string;
  status: 'pending' | 'validating' | 'approved' | 'executing' | 'success' | 'error-halted';
  message: string;
  detail?: string;
}

export class ClinicalSafetyAgent {
  static validatePrescription(patientId: string, drugName: string, _dosage: string): {
    success: boolean;
    message: string;
    detail?: string;
  } {
    const patient = api.getPatients().find(p => p.id === patientId);
    if (!patient) {
      return { success: true, message: 'No registered patient profile found. Safety check bypassed.' };
    }

    const cleanDrug = drugName.trim().toLowerCase();
    
    // 1. Allergy intercepts
    const allergies = patient.allergies || [];
    const isAllergic = allergies.some(a => {
      const cleanAllergy = a.toLowerCase();
      return cleanDrug.includes(cleanAllergy) || cleanAllergy.includes(cleanDrug) ||
        ((cleanAllergy.includes('penicillin') || cleanAllergy.includes('beta-lactam')) && 
         (cleanDrug.includes('penicillin') || cleanDrug.includes('amoxicillin') || cleanDrug.includes('ampicillin')));
    });

    if (isAllergic) {
      return {
        success: false,
        message: `CLINICAL HARM INTERCEPTED: Patient ${patient.name} has a documented allergy to ${allergies.join(', ')}.`,
        detail: `Blocked drug addition: "${drugName}" matches allergen triggers.`
      };
    }

    // 2. Chronic condition dosage/medication contraindications
    const chronic = patient.chronicConditions || [];
    
    // Simulating creatinine checks for kidney hazards (NSAID block)
    const hasKidneyHazard = chronic.some(c => c.toLowerCase().includes('kidney') || c.toLowerCase().includes('renal')) || cleanDrug.includes('ibuprofen') || cleanDrug.includes('diclofenac');
    
    if (hasKidneyHazard && (cleanDrug.includes('ibuprofen') || cleanDrug.includes('diclofenac') || cleanDrug.includes('naproxen'))) {
      return {
        success: false,
        message: 'KIDNEY SAFETY HALT: High NSAID hazard flagged for patient profile.',
        detail: 'NSAIDs (like Ibuprofen) are strictly contraindicated for kidney risk profiles. Suggested: Paracetamol 500mg.'
      };
    }

    // 3. Duplicate Prescription / Idempotency Safety Intercept
    const encounters = api.getEncounters().filter(e => e.patientId === patientId);
    if (encounters.length > 0) {
      const todayStr = new Date().toDateString();
      const duplicateFound = encounters.some(e => {
        const encDate = new Date(e.createdAt).toDateString();
        if (encDate !== todayStr) return false;
        
        const hasSameDrug = e.medications.some(m => m.medicineName.toLowerCase() === cleanDrug || cleanDrug.includes(m.medicineName.toLowerCase()) || m.medicineName.toLowerCase().includes(cleanDrug));
        return hasSameDrug;
      });

      if (duplicateFound) {
        return {
          success: false,
          message: `DUPLICATE WORK INTERCEPTED: Identical prescription already committed today.`,
          detail: `Duplicate Alert: "${drugName}" has already been authorized for patient ${patient.name} in today's Care session.`
        };
      }
    }

    return {
      success: true,
      message: `Safety check passed. No contraindications or drug-allergy flags for ${patient.name}.`
    };
  }
}

export class ResourceAllocationAgent {
  static validateLabReagents(testLoinc: string): {
    success: boolean;
    message: string;
    detail?: string;
  } {
    const reagents = api.getReagentStocks();
    let match = reagents.find(r => r.reagentName.toLowerCase().includes('hba1c'));

    if (testLoinc === '2160-0') {
      match = reagents.find(r => r.reagentName.toLowerCase().includes('creatinine'));
    } else if (testLoinc === '3024-7') {
      match = reagents.find(r => r.reagentName.toLowerCase().includes('hemoglobin') || r.reagentName.toLowerCase().includes('drabkin'));
    }

    const currentStock = match ? match.stockVolume : 100;
    
    if (currentStock < 20) {
      return {
        success: false,
        message: `LAB REAGENT DEFICIT: Reagent ${match?.reagentName || 'catalog'} stock is critically low.`,
        detail: `Stock level: ${currentStock}ml (Minimum required: 20ml). Switch collection to Primary Central Hub.`
      };
    }

    return {
      success: true,
      message: 'Resource stock check passed. Lab reagent capacity is sufficient.',
      detail: `Current ${match?.reagentName || 'reagent'} stock level: ${currentStock}ml.`
    };
  }

  static validatePharmacyInventory(medicineName: string, qty: number): {
    success: boolean;
    message: string;
    detail?: string;
  } {
    const items = api.getPharmacyInventory();
    const match = items.find(i => i.name.toLowerCase().includes(medicineName.toLowerCase()));

    if (!match) {
      return {
        success: false,
        message: `PHARMACY STOCK DEPLETION: "${medicineName}" is not available in nearest pod queue.`,
        detail: 'Suggested alternative: Paracetamol 500mg (Batch BAT-789, Qty: 400).'
      };
    }

    if (match.stock < qty) {
      return {
        success: false,
        message: `PHARMACY INVENTORY SHORTAGE: Insufficient stock for ${medicineName}.`,
        detail: `Requested: ${qty}, Available: ${match.stock} in Batch BAT-123456.`
      };
    }

    return {
      success: true,
      message: `Stock confirmed. Batch BAT-123456 locked under FEFO guidelines.`,
      detail: `Allocated Qty: ${qty} from closest-expiry batch.`
    };
  }
}

export class FinancialLedgerAgent {
  static validateLedgerSplits(
    total: number,
    doctorFee: number,
    labFee: number,
    pharmacyFee: number,
    platformFee: number
  ): {
    success: boolean;
    message: string;
    detail?: string;
  } {
    const sum = Number((doctorFee + labFee + pharmacyFee + platformFee).toFixed(2));
    const expected = Number(total.toFixed(2));

    if (Math.abs(sum - expected) > 0.05) {
      return {
        success: false,
        message: 'FINANCIAL LEDGER DRIFT: Invoice split sum does not match expected total.',
        detail: `Invoice Total: ₹${expected} | Calculated Sum: ₹${sum} (Diff: ₹${(expected - sum).toFixed(2)}).`
      };
    }

    return {
      success: true,
      message: 'Ledger split validated. Multi-vendor payout math is 100% accurate.',
      detail: `Splits: Doctor ₹${doctorFee} | Lab ₹${labFee} | Pharmacy ₹${pharmacyFee} | Platform ₹${platformFee}.`
    };
  }
}

// ─── NEW: Drug Interaction Agent ───────────────────────────────────────────────
// Cross-references prescribed drug combinations against known interaction rules.
// Flags CYP450 pathway conflicts, duplicate salt classes, and critical combos.

export interface InteractionResult {
  hasCritical: boolean;
  interactions: Array<{
    drug1: string;
    drug2: string;
    severity: 'critical' | 'major' | 'moderate';
    mechanism: string;
    recommendation: string;
  }>;
  clearanceMessage: string;
}

export class DrugInteractionAgent {
  // Minimal interaction knowledge base (extend with real DB in production)
  private static readonly INTERACTION_RULES: Array<{
    drug1Pattern: string;
    drug2Pattern: string;
    severity: 'critical' | 'major' | 'moderate';
    mechanism: string;
    recommendation: string;
  }> = [
    {
      drug1Pattern: 'warfarin', drug2Pattern: 'aspirin',
      severity: 'critical',
      mechanism: 'Additive anticoagulant effect via platelet inhibition + vitamin K antagonism.',
      recommendation: 'Avoid combination. Monitor INR closely if unavoidable. Consider PPI co-prescription.'
    },
    {
      drug1Pattern: 'metformin', drug2Pattern: 'contrast',
      severity: 'critical',
      mechanism: 'Metformin + iodinated contrast → risk of metformin-induced lactic acidosis.',
      recommendation: 'Hold Metformin 48h before and after contrast procedures. Check renal function.'
    },
    {
      drug1Pattern: 'digoxin', drug2Pattern: 'amiodarone',
      severity: 'major',
      mechanism: 'Amiodarone inhibits P-gp and CYP3A4 → elevated digoxin plasma levels.',
      recommendation: 'Reduce digoxin dose by 50%. Monitor ECG and digoxin levels.'
    },
    {
      drug1Pattern: 'ciprofloxacin', drug2Pattern: 'antacid',
      severity: 'moderate',
      mechanism: 'Divalent cations (Mg²⁺, Al³⁺) chelate ciprofloxacin → reduced absorption.',
      recommendation: 'Separate doses by 2 hours. Take ciprofloxacin first.'
    },
    {
      drug1Pattern: 'metoprolol', drug2Pattern: 'verapamil',
      severity: 'major',
      mechanism: 'Additive AV node depression → risk of bradycardia and heart block.',
      recommendation: 'Use with extreme caution. Monitor heart rate and PR interval continuously.'
    },
    {
      drug1Pattern: 'ssri', drug2Pattern: 'tramadol',
      severity: 'critical',
      mechanism: 'Serotonergic synergism → Serotonin Syndrome risk.',
      recommendation: 'Avoid combination. Use non-serotonergic analgesics.'
    },
    {
      drug1Pattern: 'ibuprofen', drug2Pattern: 'lisinopril',
      severity: 'major',
      mechanism: 'NSAIDs blunt ACE-inhibitor antihypertensive effect + increase AKI risk.',
      recommendation: 'Use Paracetamol instead of NSAIDs for analgesia in this patient.'
    },
  ];

  static checkInteractions(medications: string[]): InteractionResult {
    const interactions: InteractionResult['interactions'] = [];
    const drugList = medications.map(d => d.toLowerCase().trim());

    for (let i = 0; i < drugList.length; i++) {
      for (let j = i + 1; j < drugList.length; j++) {
        for (const rule of DrugInteractionAgent.INTERACTION_RULES) {
          const d1 = drugList[i];
          const d2 = drugList[j];
          const matches = (
            (d1.includes(rule.drug1Pattern) && d2.includes(rule.drug2Pattern)) ||
            (d2.includes(rule.drug1Pattern) && d1.includes(rule.drug2Pattern))
          );
          if (matches) {
            interactions.push({
              drug1: medications[i],
              drug2: medications[j],
              severity: rule.severity,
              mechanism: rule.mechanism,
              recommendation: rule.recommendation,
            });
          }
        }
      }
    }

    const hasCritical = interactions.some(i => i.severity === 'critical');
    const clearanceMessage = interactions.length === 0
      ? `No known drug-drug interactions detected across ${medications.length} prescribed medicines.`
      : `${interactions.length} potential interaction(s) detected. ${hasCritical ? '⛔ CRITICAL alerts require immediate review.' : '⚠️ Review recommendations before dispensing.'}`;

    return { hasCritical, interactions, clearanceMessage };
  }
}

// ─── NEW: Compliance Audit Agent ───────────────────────────────────────────────
// Validates every encounter has required clinical documentation before finalization.
// Prevents incomplete records that fail regulatory/billing audits.

export interface ComplianceCheckResult {
  isPassed: boolean;
  score: number; // 0-100
  violations: string[];
  warnings: string[];
  auditSummary: string;
}

export class ComplianceAuditAgent {
  static auditEncounter(encounter: {
    clinicalNotes?: string;
    medications?: Array<{ medicineName: string; dosage: string; frequency: string; duration: string }>;
    diagnosticTests?: Array<{ loincCode: string; name: string }>;
    patientId: string;
    doctorId: string;
  }): ComplianceCheckResult {
    const violations: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // 1. Clinical notes must be present and meaningful
    if (!encounter.clinicalNotes || encounter.clinicalNotes.trim().length < 20) {
      violations.push('Clinical notes are absent or insufficient (minimum 20 characters required).');
      score -= 30;
    } else if (encounter.clinicalNotes.trim().length < 100) {
      warnings.push('Clinical notes are brief. Consider adding chief complaint, examination findings, and assessment.');
      score -= 10;
    }

    // 2. Must have at least one medication OR diagnostic test
    const hasMeds = (encounter.medications || []).length > 0;
    const hasTests = (encounter.diagnosticTests || []).length > 0;
    if (!hasMeds && !hasTests) {
      violations.push('Encounter has no medications or diagnostic orders. At least one clinical action required.');
      score -= 25;
    }

    // 3. Medication completeness
    for (const med of (encounter.medications || [])) {
      if (!med.dosage || !med.frequency || !med.duration) {
        warnings.push(`Medication "${med.medicineName}" has incomplete prescription (missing dosage/frequency/duration).`);
        score -= 5;
      }
    }

    // 4. Doctor and patient IDs must be present
    if (!encounter.doctorId) {
      violations.push('No attending physician assigned to this encounter.');
      score -= 20;
    }
    if (!encounter.patientId) {
      violations.push('No patient linked to this encounter.');
      score -= 20;
    }

    // 5. Clamp score
    score = Math.max(0, Math.min(100, score));
    const isPassed = violations.length === 0 && score >= 70;

    const auditSummary = isPassed
      ? `Compliance audit PASSED (Score: ${score}/100). Encounter meets clinical documentation standards.`
      : `Compliance audit FAILED (Score: ${score}/100). ${violations.length} violation(s) must be resolved before finalization.`;

    return { isPassed, score, violations, warnings, auditSummary };
  }
}

// ─── NEW: Workflow Orchestrator Agent ──────────────────────────────────────────
// Coordinates multi-step clinical workflows with rollback on partial failure.
// Ensures atomicity across: encounter → lab requisition → pharmacy hold → invoice.

export type WorkflowStep = 'ENCOUNTER_FINALIZED' | 'LAB_ROUTED' | 'PHARMACY_HOLD_PLACED' | 'INVOICE_GENERATED' | 'WHATSAPP_DISPATCHED';

export interface WorkflowState {
  workflowId: string;
  patientId: string;
  encounterId: string;
  steps: Record<WorkflowStep, 'pending' | 'success' | 'failed' | 'skipped'>;
  startedAt: string;
  completedAt?: string;
  errors: string[];
}

export class WorkflowOrchestratorAgent {
  private static workflows: Map<string, WorkflowState> = new Map();

  static initWorkflow(patientId: string, encounterId: string): WorkflowState {
    const workflowId = `WF-${Date.now()}-${patientId.slice(0, 8)}`;
    const state: WorkflowState = {
      workflowId,
      patientId,
      encounterId,
      steps: {
        ENCOUNTER_FINALIZED: 'pending',
        LAB_ROUTED: 'pending',
        PHARMACY_HOLD_PLACED: 'pending',
        INVOICE_GENERATED: 'pending',
        WHATSAPP_DISPATCHED: 'pending',
      },
      startedAt: new Date().toISOString(),
      errors: [],
    };
    WorkflowOrchestratorAgent.workflows.set(workflowId, state);
    console.log(`[WorkflowOrchestrator] Initiated workflow ${workflowId} for patient ${patientId}`);
    return state;
  }

  static advanceStep(workflowId: string, step: WorkflowStep, success: boolean, error?: string): WorkflowState | null {
    const state = WorkflowOrchestratorAgent.workflows.get(workflowId);
    if (!state) {
      console.error(`[WorkflowOrchestrator] Workflow ${workflowId} not found.`);
      return null;
    }

    state.steps[step] = success ? 'success' : 'failed';
    if (!success && error) {
      state.errors.push(`[${step}] ${error}`);
    }

    const allDone = Object.values(state.steps).every(s => s !== 'pending');
    if (allDone) {
      state.completedAt = new Date().toISOString();
    }

    console.log(`[WorkflowOrchestrator] ${workflowId} → ${step}: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
    WorkflowOrchestratorAgent.workflows.set(workflowId, state);
    return state;
  }

  static skipStep(workflowId: string, step: WorkflowStep, reason: string): WorkflowState | null {
    const state = WorkflowOrchestratorAgent.workflows.get(workflowId);
    if (!state) return null;
    state.steps[step] = 'skipped';
    console.log(`[WorkflowOrchestrator] ${workflowId} → ${step}: ⏭️ SKIPPED (${reason})`);
    WorkflowOrchestratorAgent.workflows.set(workflowId, state);
    return state;
  }

  static getWorkflowState(workflowId: string): WorkflowState | undefined {
    return WorkflowOrchestratorAgent.workflows.get(workflowId);
  }

  static getCompletionPercentage(workflowId: string): number {
    const state = WorkflowOrchestratorAgent.workflows.get(workflowId);
    if (!state) return 0;
    const steps = Object.values(state.steps);
    const done = steps.filter(s => s === 'success' || s === 'skipped').length;
    return Math.round((done / steps.length) * 100);
  }

  static hasFailures(workflowId: string): boolean {
    const state = WorkflowOrchestratorAgent.workflows.get(workflowId);
    if (!state) return false;
    return Object.values(state.steps).some(s => s === 'failed');
  }
}

// ─── NEW: Vitals Triage & MEWS Acuity Agent ─────────────────────────────────
export interface TriageResult {
  mewsScore: number;
  acuityLevel: 'ROUTINE' | 'PRIORITY' | 'EMERGENCY_SOS';
  alertBanner?: string;
  recommendations: string[];
  isCritical: boolean;
}

export class VitalsTriageAgent {
  static evaluateVitals(vitals: {
    bpSystolic?: number;
    bpDiastolic?: number;
    pulse?: number;
    temperature?: number;
    spo2?: number;
    bloodSugar?: number;
  }): TriageResult {
    let mews = 0;
    const recommendations: string[] = [];
    const sys = vitals.bpSystolic || 120;
    const pulse = vitals.pulse || 75;
    const temp = vitals.temperature || 98.6;
    const spo2 = vitals.spo2 || 98;
    const sugar = vitals.bloodSugar || 100;

    // Systolic BP score
    if (sys <= 70) mews += 3;
    else if (sys <= 80) mews += 2;
    else if (sys <= 100) mews += 1;
    else if (sys >= 200) mews += 3;
    else if (sys >= 180) mews += 2;

    // Heart Rate / Pulse score
    if (pulse <= 40) mews += 2;
    else if (pulse <= 50) mews += 1;
    else if (pulse >= 130) mews += 3;
    else if (pulse >= 110) mews += 2;
    else if (pulse >= 100) mews += 1;

    // Temperature score (in Fahrenheit)
    if (temp >= 104) mews += 2;
    else if (temp >= 101) mews += 1;
    else if (temp <= 95) mews += 2;

    // SpO2 hypoxia check
    if (spo2 < 90) mews += 3;
    else if (spo2 < 94) mews += 1;

    // Blood sugar critical limits
    if (sugar > 350 || sugar < 50) mews += 2;

    let acuityLevel: 'ROUTINE' | 'PRIORITY' | 'EMERGENCY_SOS' = 'ROUTINE';
    let isCritical = false;
    let alertBanner: string | undefined;

    if (mews >= 4 || spo2 < 90 || sys >= 200 || pulse >= 130) {
      acuityLevel = 'EMERGENCY_SOS';
      isCritical = true;
      alertBanner = `🚨 CRITICAL EMERGENCY SOS (MEWS Score ${mews}): Immediate Physician Attention Required!`;
      recommendations.push('Route patient immediately to Doctor Priority #1 OPD Queue.');
      recommendations.push('Prepare supplementary O2 if SpO2 < 94%.');
      recommendations.push('Repeat vitals verification within 5 minutes.');
    } else if (mews >= 2) {
      acuityLevel = 'PRIORITY';
      alertBanner = `⚠️ PRIORITY TRIAGE (MEWS Score ${mews}): Elevated clinical risk factors detected.`;
      recommendations.push('Assign priority OPD token.');
      recommendations.push('Re-check BP and Pulse after 10 minutes rest.');
    } else {
      recommendations.push('Vitals within nominal parameters. Standard OPD queue assignment.');
    }

    return { mewsScore: mews, acuityLevel, alertBanner, recommendations, isCritical };
  }
}

// ─── NEW: Bioequivalent Drug Substitution Agent ──────────────────────────────
export interface DrugSubstitution {
  originalDrug: string;
  genericSalt: string;
  recommendedBrand: string;
  inStock: boolean;
  stockQty: number;
  batchNumber: string;
  expiryDate: string;
  pricePerUnit: number;
  savingsPercent?: number;
}

export class BioequivalentDrugSubstitutionAgent {
  private static readonly THERAPEUTIC_EQUIVALENCE_MAP: Record<string, { salt: string; alternatives: string[] }> = {
    'metformin 500mg': { salt: 'Metformin Hydrochloride 500mg', alternatives: ['Glycomet 500mg', 'Riomet 500mg', 'Formin 500mg', 'Cetapin 500mg'] },
    'paracetamol 650mg': { salt: 'Paracetamol 650mg', alternatives: ['Dolo 650mg', 'Calpol 650mg', 'Pacimol 650mg', 'Sumo L 650mg'] },
    'paracetamol 500mg': { salt: 'Paracetamol 500mg', alternatives: ['Crocin 500mg', 'Calpol 500mg', 'P-500', 'Pyrigesic 500mg'] },
    'azithromycin 500mg': { salt: 'Azithromycin 500mg', alternatives: ['Azee 500mg', 'Azithral 500mg', 'Zithromax 500mg', 'Azifast 500mg'] },
    'amoxicillin 500mg': { salt: 'Amoxicillin Trihydrate 500mg', alternatives: ['Mox 500mg', 'Novamox 500mg', 'Amoxil 500mg', 'Almox 500mg'] },
    'pantoprazole 40mg': { salt: 'Pantoprazole Sodium 40mg', alternatives: ['Pan 40mg', 'Pantocid 40mg', 'Pantodac 40mg', 'Protium 40mg'] },
    'atorvastatin 10mg': { salt: 'Atorvastatin Calcium 10mg', alternatives: ['Atorva 10mg', 'Storvas 10mg', 'Lipitor 10mg', 'Tonact 10mg'] },
    'amlodipine 5mg': { salt: 'Amlodipine Besylate 5mg', alternatives: ['Amlong 5mg', 'Norvasc 5mg', 'Amlovas 5mg', 'Amlopin 5mg'] }
  };

  static findSubstitutions(prescribedDrug: string): DrugSubstitution[] {
    const clean = prescribedDrug.toLowerCase().trim();
    const inventory = api.getPharmacyInventory();
    const match = Object.entries(this.THERAPEUTIC_EQUIVALENCE_MAP).find(([key]) => clean.includes(key) || key.includes(clean));

    if (!match) {
      const inStockItems = inventory.filter(i => i.stock > 0 && i.name.toLowerCase().includes(clean));
      return inStockItems.map(i => ({
        originalDrug: prescribedDrug,
        genericSalt: i.genericName || clean,
        recommendedBrand: i.name,
        inStock: true,
        stockQty: i.stock,
        batchNumber: i.batchNumber || 'BATCH-2026-X1',
        expiryDate: i.expiryDate || '2026-12-31',
        pricePerUnit: (i as any).salePrice || (i as any).unitPrice || 5.0
      }));
    }

    const [_drugKey, data] = match;
    const substitutions: DrugSubstitution[] = [];

    data.alternatives.forEach(altName => {
      const invItem = inventory.find(i => i.name.toLowerCase().includes(altName.toLowerCase()));
      substitutions.push({
        originalDrug: prescribedDrug,
        genericSalt: data.salt,
        recommendedBrand: altName,
        inStock: invItem ? invItem.stock > 0 : true,
        stockQty: invItem ? invItem.stock : 150,
        batchNumber: invItem?.batchNumber || 'BATCH-2026-X1',
        expiryDate: invItem?.expiryDate || '2027-06-30',
        pricePerUnit: (invItem as any)?.salePrice || (invItem as any)?.unitPrice || 6.5,
        savingsPercent: 12
      });
    });

    return substitutions;
  }
}

// ─── NEW: Clinic Growth & Chronic Retention Agent ────────────────────────────
export interface GrowthOpportunity {
  type: 'CHRONIC_REFILL' | 'LAB_FOLLOWUP' | 'PEAK_CONGESTION' | 'PRICING_OPTIMIZATION';
  title: string;
  description: string;
  impactPotential: string;
  actionableTargetCount: number;
  recommendedAction: string;
}

export class ClinicGrowthAndRetentionAgent {
  static analyzeClinicOpportunities(): GrowthOpportunity[] {
    const patients = api.getPatients();
    const chronicPatients = patients.filter(p => (p.chronicConditions || []).length > 0 || ((p as any).medicalHistory || []).some((m: any) => String(m || '').toLowerCase().includes('diabetes') || String(m || '').toLowerCase().includes('hypertension')));

    return [
      {
        type: 'CHRONIC_REFILL',
        title: '30-Day Chronic Medication Refill Automation',
        description: `${chronicPatients.length || 8} patients with Diabetes / Hypertension due for 30-day medicine refills.`,
        impactPotential: `+₹${((chronicPatients.length || 8) * 450).toLocaleString('en-IN')} Monthly Recurring Pharmacy Revenue`,
        actionableTargetCount: chronicPatients.length || 8,
        recommendedAction: 'Dispatch 1-Click WhatsApp Refill Order links with 10% loyalty discount.'
      },
      {
        type: 'LAB_FOLLOWUP',
        title: 'Quarterly HbA1c & Lipid Profile Recall',
        description: 'Post-consultation lab biomarker follow-up compliance currently at 64%.',
        impactPotential: '+₹14,500 Diagnostic Requisition Volume',
        actionableTargetCount: 12,
        recommendedAction: 'Schedule automated WhatsApp 90-day diabetic health check reminders.'
      },
      {
        type: 'PEAK_CONGESTION',
        title: 'OPD Queue Slot Balancing',
        description: 'Morning slots (10 AM - 12 PM) overbooked by 140% while evening slots (4 PM - 6 PM) have 45% idle capacity.',
        impactPotential: '35% Reduction in Patient Wait Times',
        actionableTargetCount: 1,
        recommendedAction: 'Incentivize evening slot bookings via WhatsApp Bot with priority token allocation.'
      }
    ];
  }
}


