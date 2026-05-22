export interface Patient {
  id: string;
  name: string;
  phone: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  allergies: string[];
  chronicConditions: string[];
  abhaId?: string;
  createdAt: string;
}

export interface ClinicStaff {
  id: string;
  entityId: string;
  userId?: string;
  staffName: string;
  role: 'compounder' | 'receptionist' | 'admin';
  isActive: boolean;
  createdAt: string;
}

export interface HistoricalBiomarker {
  date: string;
  HbA1c: number;
  creatinine: number;
  hemoglobin: number;
}

export interface ChatMessage {
  sender: 'bot' | 'patient';
  text: string;
  timestamp?: string;
  time?: string;
}

export interface WhatsAppSessionData {
  chatHistory?: ChatMessage[];
  consentGranted?: boolean;
  consentTime?: string | null;
  [key: string]: any;
}

export interface WhatsAppSession {
  id: string;
  patientPhone: string;
  currentState: 'AWAITING_WELCOME' | 'AWAITING_CONFIRMATION' | 'AWAITING_PAYMENT' | 'BOOKING_VIRTUAL' | 'COMPLETED' | 'FAILED_DELIVERY';
  lastInteraction: string;
  sessionData: WhatsAppSessionData;
}

export interface MedicationRequest {
  id: string;
  medicineName: string;
  dosage: string; // e.g., "500mg"
  frequency: string; // e.g., "1-0-1" or "Once Daily"
  duration: string; // e.g., "5 days"
  expiryDate?: string;
  batchNumber?: string;
}

export interface FHIRMedicationRequest {
  resourceType: "MedicationRequest";
  id: string;
  status: "active" | "completed" | "on-hold" | "stopped";
  intent: "order";
  subject: {
    reference: string; // Patient ID
    display: string; // Patient Name
  };
  medicationCodeableConcept: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  };
  dosageInstruction: Array<{
    text: string;
    timing: {
      repeat: {
        frequency: number;
        period: number;
        periodUnit: "d" | "wk" | "mo";
      };
    };
  }>;
}

export interface DiagnosticTest {
  loincCode: string;
  name: string;
  category: string;
  normalRange: string;
  unit: string;
}

export interface Encounter {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  clinicalNotes: string;
  medications: MedicationRequest[];
  diagnosticTests: DiagnosticTest[];
  status: 'active' | 'completed';
  createdAt: string;
}

export interface ReagentDeduction {
  reagentName: string;
  volumeDeducted: number; // e.g., 5
  unit: string; // e.g., "ml"
}

export interface LabRequisition {
  id: string;
  encounterId: string;
  patientId: string;
  patientName: string;
  testCode: string; // LOINC Code
  testName: string;
  barcode: string;
  status: 'pending' | 'collected' | 'processed' | 'completed';
  quantitativeResult?: string;
  reagentDeductions: ReagentDeduction[];
  createdAt: string;
}

export interface InventoryHold {
  id: string;
  pharmacyId: string;
  medicineName: string;
  dosage: string;
  quantity: number;
  holdStatus: 'held' | 'dispensed' | 'cancelled';
  expiryDate: string;
  batchNumber: string;
  createdAt: string;
}

export interface UnifiedInvoice {
  id: string;
  encounterId: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  doctorFee: number;
  labFee: number;
  pharmacyFee: number;
  platformFee: number;
  totalAmount: number;
  upiQrPayload: string;
  paymentStatus: 'pending' | 'cleared' | 'disputed';
  createdAt: string;
}

export interface SeasonalForecast {
  id: string;
  pharmacyId: string;
  medicineName: string;
  suggestedIncreasePercentage: number;
  reason: string;
  forecastConfidence: number;
  isActedUpon: boolean;
  createdAt: string;
}
