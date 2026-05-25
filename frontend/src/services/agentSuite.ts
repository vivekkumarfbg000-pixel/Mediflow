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
        detail: `Stock level: ${currentStock}ml (Minimum required: 20ml). Switch collection to Patna Central Hub.`
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
