import type { 
  Patient, 
  Encounter, 
  LabRequisition, 
  InventoryHold, 
  UnifiedInvoice, 
  WhatsAppSession, 
  SeasonalForecast,
  DiagnosticTest
} from '../types';

// Standard master test catalog based on LOINC codes
export const MASTER_TEST_CATALOG: DiagnosticTest[] = [
  { loincCode: '4544-3', name: 'HbA1c (Glycated Hemoglobin)', category: 'Diabetology', normalRange: '4.0 - 5.6', unit: '%' },
  { loincCode: '2160-0', name: 'Serum Creatinine', category: 'Renal Panel', normalRange: '0.6 - 1.2', unit: 'mg/dL' },
  { loincCode: '3024-7', name: 'Total Hemoglobin', category: 'Hematology', normalRange: '12.0 - 16.0', unit: 'g/dL' },
  { loincCode: '2947-0', name: 'Serum Sodium', category: 'Electrolytes', normalRange: '135 - 145', unit: 'mEq/L' },
  { loincCode: '1975-2', name: 'Total Bilirubin', category: 'Liver Function', normalRange: '0.2 - 1.2', unit: 'mg/dL' }
];

export interface ReagentStock {
  reagentName: string;
  stockVolume: number;
  unit: string;
}

const DEFAULT_REAGENT_STOCKS: ReagentStock[] = [
  { reagentName: 'HbA1c Enzyme Reagent A', stockVolume: 500, unit: 'ml' },
  { reagentName: 'Creatinine Alkaline Picrate B', stockVolume: 1000, unit: 'ml' },
  { reagentName: 'Drabkin Reagent (Hemoglobin)', stockVolume: 800, unit: 'ml' },
  { reagentName: 'Sodium Ion Reagent', stockVolume: 400, unit: 'ml' },
  { reagentName: 'Bilirubin Diazo Reagent', stockVolume: 600, unit: 'ml' }
];

const INITIAL_PATIENTS: Patient[] = [
  {
    id: 'p-1',
    name: 'Aarav Sharma',
    phone: '9876543210',
    age: 45,
    gender: 'Male',
    allergies: ['Penicillin'],
    chronicConditions: ['Type-2 Diabetes', 'Hypertension'],
    abhaId: '12-3456-7890-1234',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'p-2',
    name: 'Priyanka Verma',
    phone: '8765432109',
    age: 38,
    gender: 'Female',
    allergies: [],
    chronicConditions: ['Asthma'],
    abhaId: '98-7654-3210-9876',
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Seed some historical lab records for aarav sharma to test CDSS
export const HISTORICAL_BIOMARKERS = {
  'p-1': [
    { date: '2026-03-10', HbA1c: 7.8, creatinine: 0.9, hemoglobin: 13.5 },
    { date: '2026-04-15', HbA1c: 7.4, creatinine: 1.1, hemoglobin: 13.1 },
    { date: '2026-05-22', HbA1c: 6.9, creatinine: 1.4, hemoglobin: 12.8 } // Worsening creatinine, improving HbA1c
  ]
};

const INITIAL_FORECASTS: SeasonalForecast[] = [
  {
    id: 'f-1',
    pharmacyId: 'ph-1',
    medicineName: 'Paracetamol 650mg',
    suggestedIncreasePercentage: 50,
    reason: 'Predicted surge in waterborne & viral infections based on early Bihar pre-monsoon showers and sewage testing data.',
    forecastConfidence: 0.88,
    isActedUpon: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'f-2',
    pharmacyId: 'ph-1',
    medicineName: 'ORS Sachets',
    suggestedIncreasePercentage: 75,
    reason: 'Patna district heatwave warning - expected rise in dehydration cases and localized cholera warnings.',
    forecastConfidence: 0.92,
    isActedUpon: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'f-3',
    pharmacyId: 'ph-1',
    medicineName: 'Artesunate IV Injection',
    suggestedIncreasePercentage: 40,
    reason: 'Vector-borne malaria surge tracking based on vector pool surveillance inside Patna central block.',
    forecastConfidence: 0.82,
    isActedUpon: true,
    createdAt: new Date().toISOString()
  }
];

class MediflowApiService {
  private getStorageKey(key: string): string {
    return `mediflow_${key}`;
  }

  private load<T>(key: string, defaultValue: T): T {
    const data = localStorage.getItem(this.getStorageKey(key));
    return data ? JSON.parse(data) : defaultValue;
  }

  private save<T>(key: string, value: T): void {
    localStorage.setItem(this.getStorageKey(key), JSON.stringify(value));
  }

  // Patients
  getPatients(): Patient[] {
    return this.load<Patient[]>('patients', INITIAL_PATIENTS);
  }

  registerPatient(patientData: Omit<Patient, 'id' | 'createdAt'>): Patient {
    const patients = this.getPatients();
    const newPatient: Patient = {
      ...patientData,
      id: `p-${patients.length + 1}`,
      createdAt: new Date().toISOString()
    };
    patients.push(newPatient);
    this.save('patients', patients);
    return newPatient;
  }

  // WhatsApp bot sessions
  getWhatsAppSessions(): WhatsAppSession[] {
    return this.load<WhatsAppSession[]>('whatsapp_sessions', []);
  }

  initiateWhatsAppSession(phone: string): WhatsAppSession {
    const sessions = this.getWhatsAppSessions();
    const existing = sessions.find(s => s.patientPhone === phone);
    
    if (existing) {
      existing.currentState = 'AWAITING_WELCOME';
      existing.lastInteraction = new Date().toISOString();
      this.save('whatsapp_sessions', sessions);
      return existing;
    }

    const newSession: WhatsAppSession = {
      id: `ws-${sessions.length + 1}`,
      patientPhone: phone,
      currentState: 'AWAITING_WELCOME',
      lastInteraction: new Date().toISOString(),
      sessionData: {}
    };
    sessions.push(newSession);
    this.save('whatsapp_sessions', sessions);
    return newSession;
  }

  updateWhatsAppState(phone: string, state: WhatsAppSession['currentState'], data: Record<string, any> = {}): void {
    const sessions = this.getWhatsAppSessions();
    const idx = sessions.findIndex(s => s.patientPhone === phone);
    if (idx !== -1) {
      sessions[idx].currentState = state;
      sessions[idx].lastInteraction = new Date().toISOString();
      sessions[idx].sessionData = { ...sessions[idx].sessionData, ...data };
      this.save('whatsapp_sessions', sessions);
    }
  }

  // Encounters & Routing Trigger
  getEncounters(): Encounter[] {
    return this.load<Encounter[]>('encounters', []);
  }

  createEncounter(encounterData: Omit<Encounter, 'id' | 'createdAt' | 'status'>): Encounter {
    const encounters = this.getEncounters();
    const newEncounter: Encounter = {
      ...encounterData,
      id: `e-${encounters.length + 1}`,
      status: 'completed',
      createdAt: new Date().toISOString()
    };
    encounters.push(newEncounter);
    this.save('encounters', encounters);

    // --- AUTOMATIC SYSTEM Webhook/Triggers mapping to SOP section Phase 2 ---
    
    // Trigger A: Create Requisitions for Laboratory Dashboard
    if (newEncounter.diagnosticTests.length > 0) {
      const requisitions = this.load<LabRequisition[]>('lab_requisitions', []);
      newEncounter.diagnosticTests.forEach(test => {
        const req: LabRequisition = {
          id: `lr-${requisitions.length + 1}`,
          encounterId: newEncounter.id,
          patientId: newEncounter.patientId,
          patientName: newEncounter.patientName,
          testCode: test.loincCode,
          testName: test.name,
          barcode: `BAR-${newEncounter.id.toUpperCase()}-${test.loincCode}`,
          status: 'pending',
          reagentDeductions: [],
          createdAt: new Date().toISOString()
        };
        requisitions.push(req);
      });
      this.save('lab_requisitions', requisitions);
    }

    // Trigger B: Create Inventory Holds for Pharmacy Dashboard (FEFO sorting ready)
    if (newEncounter.medications.length > 0) {
      const holds = this.load<InventoryHold[]>('inventory_holds', []);
      newEncounter.medications.forEach(med => {
        const hold: InventoryHold = {
          id: `ih-${holds.length + 1}`,
          pharmacyId: 'ph-1', // Default pharmacy
          medicineName: med.medicineName,
          dosage: med.dosage,
          quantity: 10, // Default dosage cycle pack
          holdStatus: 'held',
          expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 6 months expiry
          batchNumber: `BAT-${Math.floor(100000 + Math.random() * 900000)}`,
          createdAt: new Date().toISOString()
        };
        holds.push(hold);
      });
      this.save('inventory_holds', holds);
    }

    // Trigger C: Generate Unified Invoice (Split Billing)
    const doctorFee = 400; // Standard base consultation
    const labFee = newEncounter.diagnosticTests.length * 350; // Standard lab test fee
    const pharmacyFee = newEncounter.medications.length * 150; // Standard pharmacy hold estimate
    const platformFee = 50; // Flat platform commission
    const totalAmount = doctorFee + labFee + pharmacyFee + platformFee;

    const invoices = this.load<UnifiedInvoice[]>('unified_invoices', []);
    const upiQrPayload = `upi://pay?pa=mediflow@icici&pn=Mediflow&am=${totalAmount}&cu=INR&tn=Mediflow-Encounter-${newEncounter.id}`;
    
    const invoice: UnifiedInvoice = {
      id: `inv-${invoices.length + 1}`,
      encounterId: newEncounter.id,
      patientId: newEncounter.patientId,
      patientName: newEncounter.patientName,
      patientPhone: newPatientPhone(newEncounter.patientId),
      doctorFee,
      labFee,
      pharmacyFee,
      platformFee,
      totalAmount,
      upiQrPayload,
      paymentStatus: 'pending',
      createdAt: new Date().toISOString()
    };
    invoices.push(invoice);
    this.save('unified_invoices', invoices);

    // Update WhatsApp Bot Session state to AWAITING_PAYMENT
    this.updateWhatsAppState(invoice.patientPhone, 'AWAITING_PAYMENT', {
      invoiceId: invoice.id,
      totalAmount
    });

    return newEncounter;
  }

  // Laboratory Requisitions & Reagent Deduction Logic
  getLabRequisitions(): LabRequisition[] {
    return this.load<LabRequisition[]>('lab_requisitions', []);
  }

  collectLabSample(reqId: string): void {
    const requisitions = this.getLabRequisitions();
    const idx = requisitions.findIndex(r => r.id === reqId);
    if (idx !== -1) {
      requisitions[idx].status = 'collected';
      this.save('lab_requisitions', requisitions);
    }
  }

  getReagentStocks(): ReagentStock[] {
    return this.load<ReagentStock[]>('reagents', DEFAULT_REAGENT_STOCKS);
  }

  submitLabResult(reqId: string, resultValue: string): void {
    const requisitions = this.getLabRequisitions();
    const idx = requisitions.findIndex(r => r.id === reqId);
    if (idx !== -1) {
      const req = requisitions[idx];
      req.quantitativeResult = resultValue;
      req.status = 'completed';

      // --- AUTOMATIC REAGENT DEDUCTION TRIGGER mapping to SOP Phase 3 ---
      // Decide reagent deduction based on LOINC code
      let reagentName = 'General Reagent X';
      let volume = 5; // standard 5ml
      
      if (req.testCode === '4544-3') {
        reagentName = 'HbA1c Enzyme Reagent A';
        volume = 10;
      } else if (req.testCode === '2160-0') {
        reagentName = 'Creatinine Alkaline Picrate B';
        volume = 15;
      } else if (req.testCode === '3024-7') {
        reagentName = 'Drabkin Reagent (Hemoglobin)';
        volume = 8;
      } else if (req.testCode === '2947-0') {
        reagentName = 'Sodium Ion Reagent';
        volume = 6;
      } else if (req.testCode === '1975-2') {
        reagentName = 'Bilirubin Diazo Reagent';
        volume = 12;
      }

      req.reagentDeductions = [{ reagentName, volumeDeducted: volume, unit: 'ml' }];

      // Perform deduction in stock public ledger
      const reagents = this.getReagentStocks();
      const rIdx = reagents.findIndex(r => r.reagentName === reagentName);
      if (rIdx !== -1) {
        reagents[rIdx].stockVolume = Math.max(0, reagents[rIdx].stockVolume - volume);
        this.save('reagents', reagents);
      }

      this.save('lab_requisitions', requisitions);

      // Trigger D: Log and trigger WhatsApp lab report card update
      const session = this.getWhatsAppSessions().find(s => s.patientPhone === newPatientPhone(req.patientId));
      if (session) {
        this.updateWhatsAppState(session.patientPhone, 'BOOKING_VIRTUAL', {
          latestReportId: req.id,
          latestReportName: req.testName,
          latestReportResult: resultValue
        });
      }
    }
  }

  // Pharmacy Inventory holds (FEFO sorted)
  getInventoryHolds(): InventoryHold[] {
    const holds = this.load<InventoryHold[]>('inventory_holds', []);
    // Ensure strict FEFO: First-Expiry-First-Out sorting
    return holds.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }

  dispenseInventoryHold(holdId: string): void {
    const holds = this.getInventoryHolds();
    const idx = holds.findIndex(h => h.id === holdId);
    if (idx !== -1) {
      holds[idx].holdStatus = 'dispensed';
      this.save('inventory_holds', holds);
    }
  }

  cancelInventoryHold(holdId: string): void {
    const holds = this.getInventoryHolds();
    const idx = holds.findIndex(h => h.id === holdId);
    if (idx !== -1) {
      holds[idx].holdStatus = 'cancelled';
      this.save('inventory_holds', holds);
    }
  }

  // Unified invoices (split billing ledger)
  getUnifiedInvoices(): UnifiedInvoice[] {
    return this.load<UnifiedInvoice[]>('unified_invoices', []);
  }

  clearInvoice(invoiceId: string): void {
    const invoices = this.getUnifiedInvoices();
    const idx = invoices.findIndex(i => i.id === invoiceId);
    if (idx !== -1) {
      invoices[idx].paymentStatus = 'cleared';
      this.save('unified_invoices', invoices);

      // WhatsApp session transitions to virtual followup booking at 50% discount
      this.updateWhatsAppState(invoices[idx].patientPhone, 'BOOKING_VIRTUAL', {
        paymentCleared: true
      });
    }
  }

  // Seasonal inventory forecasts
  getSeasonalForecasts(): SeasonalForecast[] {
    return this.load<SeasonalForecast[]>('seasonal_forecasts', INITIAL_FORECASTS);
  }

  actOnSeasonalForecast(forecastId: string): void {
    const forecasts = this.getSeasonalForecasts();
    const idx = forecasts.findIndex(f => f.id === forecastId);
    if (idx !== -1) {
      forecasts[idx].isActedUpon = true;
      this.save('seasonal_forecasts', forecasts);
    }
  }
}

// Helper to resolve patient phone mock mapping
function newPatientPhone(patientId: string): string {
  if (patientId === 'p-1') return '9876543210';
  if (patientId === 'p-2') return '8765432109';
  return '9999999999';
}

export const api = new MediflowApiService();
