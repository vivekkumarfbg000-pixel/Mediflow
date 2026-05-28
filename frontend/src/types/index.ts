export interface PatientVitals {
  temperature: string;       // °F
  bloodPressure: string;     // Systolic/Diastolic e.g. "120/80"
  pulseRate: string;         // bpm
  weight: string;            // kg
  bloodSugar?: string;       // mg/dL (glucometer)
  recordedAt: string;
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  allergies: string[];
  chronicConditions: string[];
  abhaId?: string;
  vitals?: PatientVitals;
  tokenNumber?: string;
  queueStatus?: 'awaiting_vitals' | 'awaiting_consultation' | 'completed';
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
  currentState:
    | 'AWAITING_WELCOME'
    | 'AWAITING_CONFIRMATION'
    | 'AWAITING_PAYMENT'
    | 'BOOKING_VIRTUAL'
    | 'COMPLETED'
    | 'FAILED_DELIVERY'
    | 'MEDICINE_ORDERING'
    | 'MEDICINE_AWAITING_PAYMENT'
    | 'MEDICINE_READY_FOR_PICKUP';
  lastInteraction: string;
  sessionData: WhatsAppSessionData;
}

export interface MedicationRequest {
  id: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  expiryDate?: string;
  batchNumber?: string;
}

export interface FHIRMedicationRequest {
  resourceType: "MedicationRequest";
  id: string;
  status: "active" | "completed" | "on-hold" | "stopped";
  intent: "order";
  subject: {
    reference: string;
    display: string;
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
  price?: number;
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
  volumeDeducted: number;
  unit: string;
}

export interface LabRequisition {
  id: string;
  encounterId: string;
  patientId: string;
  patientName: string;
  testCode: string;
  testName: string;
  barcode: string;
  status: 'pending' | 'collected' | 'processed' | 'completed';
  quantitativeResult?: string;
  reagentDeductions: ReagentDeduction[];
  prescriptionFileUrl?: string;   // Supabase Storage URL for scanned Rx
  revisitScheduledAt?: string;    // ISO datetime compounder scheduled revisit
  revisitNote?: string;           // Compounder's revisit instruction note
  createdAt: string;
}

export interface InventoryHold {
  id: string;
  pharmacyId: string;
  patientId: string;
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

export interface FinancialLedgerEntry {
  id: string;
  invoiceId: string;
  sourceEntityId: string;
  destinationEntityId: string;
  transactionType: 'appointment_fee' | 'medicine_commission' | 'lab_commission' | 'platform_fee';
  grossAmount: number;
  commissionRate: number;
  netPayout: number;
  paymentStatus: 'pending' | 'cleared' | 'disputed';
  settledAt: string | null;
  createdAt: string;
}

export interface Pod {
  id: string;
  name: string;
  location?: string;
  clinicCode: string;
  isActive: boolean;
  createdAt: string;
}

export interface Entity {
  id: string;
  podId: string;
  entityType: 'clinic' | 'lab' | 'pharmacy';
  name: string;
  address?: string;
  phone?: string;
  gstin?: string;
  subscriptionTier?: string;
  monthlyFee?: number;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  isActive: boolean;
  createdAt: string;
}

// ─── PHARMACY INVENTORY (Extended with batch/expiry/threshold) ──────────────
export interface PharmacyInventoryItem {
  id: string;
  name: string;                // Brand name e.g. "Metformin 500mg"
  genericName: string;         // Generic e.g. "Metformin Hydrochloride"
  category: string;            // "Antidiabetic" | "Antibiotic" etc.
  manufacturer: string;        // "Sun Pharma", "Cipla"
  batchNumber: string;         // Required for FEFO + expiry tracking
  expiryDate: string;          // ISO date string "YYYY-MM-DD"
  mrp: number;                 // Maximum Retail Price ₹
  price: number;               // Selling Price ₹
  stock: number;               // Current units available
  unit: 'tabs' | 'caps' | 'vials' | 'ml' | 'gm' | 'strips';
  threshold: number;           // Low-stock alert trigger level
  dosage: string;              // e.g. "500mg"
  addedAt: string;             // ISO datetime when batch was entered
  hsn?: string;                // HSN code for GST bracket
}

// ─── CSV / BILL IMPORT ROW ───────────────────────────────────────────────────
export interface MedicineImportRow {
  name: string;
  batchNumber: string;
  expiryDate: string;
  mrp: number;
  price: number;
  stock: number;
  unit: string;
  threshold: number;
  dosage: string;
  manufacturer?: string;
  genericName?: string;
  category?: string;
  hsn?: string;
}

// ─── COUNTER LOYALTY DISCOUNT TRACKING ──────────────────────────────────────
export interface CounterTransaction {
  id: string;
  patientId: string;
  patientPhone: string;
  patientName: string;
  appointmentBookedAtCounter: boolean;
  labBookedAtCounter: boolean;
  discountEligible: boolean;   // true when both appointment + lab booked at counter
  discountPercent: number;     // 10 if eligible, else 0
  createdAt: string;
}

// ─── MEDICINE BILL (Compounder generates, sent to WhatsApp) ─────────────────
export interface MedicineBillItem {
  inventoryItemId: string;
  name: string;
  genericName: string;
  dosage: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  mrp: number;
  sellingPrice: number;
  discountPercent: number;         // item-level discount %
  gstPercent: number;              // 5% or 12% based on HSN
  lineTotal: number;               // qty × price × (1 - disc) × (1 + gst)
  alternativeSuggested?: string;   // alternative brand from inventory
  alternativeInventoryId?: string;
}

export interface MedicineBill {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  encounterId?: string;             // linked prescription encounter if any
  items: MedicineBillItem[];
  subtotal: number;
  loyaltyDiscountPercent: number;   // 0 or 10
  loyaltyDiscountAmount: number;
  itemDiscountAmount: number;
  gstAmount: number;
  totalAmount: number;
  paymentMode: 'cash' | 'upi' | 'card' | 'whatsapp_pay';
  upiQrPayload?: string;
  status: 'draft' | 'confirmed' | 'paid' | 'cancelled';
  source: 'counter' | 'whatsapp';
  deliveryType?: 'pickup' | 'shiprocket';
  deliveryAddress?: string;
  deliveryCharge?: number;
  shiprocketOrderId?: string;
  createdAt: string;
}

// ─── WHATSAPP DRUG ORDERS (existing) ────────────────────────────────────────
export interface WhatsAppDrugOrder {
  id: string;
  patientName: string;
  patientPhone: string;
  drugNames: string[];
  amount: number;
  location: string;
  deliveryStatus: 'pending' | 'dispatching' | 'enroute' | 'delivered';
  timestamp: string;
}

export interface PathologyReport {
  id: string;
  patientId: string;
  patientName: string;
  loincCode: string;
  testName: string;
  status: 'pending' | 'approved';
  compounderScanned: boolean;
  results?: string;
  timestamp: string;
}

export interface ClinicSop {
  id: string;
  entityId: string;
  sopFileName: string;
  sopText: string;
  extractedConfig: {
    doctor_fee: number;
    test_prices: Record<string, number>;
    splits: {
      doctor: number;
      platform: number;
      lab: number;
    };
    guidelines: string[];
  };
  isActive: boolean;
  createdAt: string;
}

// ─── SaaS 3-GATE WORKFLOW ENTITIES ───────────────────────────────────────────
export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  status: 'pending_payment' | 'ready_for_consult' | 'completed';
  createdAt: string;
}

export interface Invoice {
  id: string;
  appointmentId: string;
  type: 'consult' | 'lab' | 'pharmacy';
  amount: number;
  status: 'unpaid' | 'paid';
  createdAt: string;
}

export interface LabReport {
  id: string;
  requisitionId: string;           // FK → LabRequisition
  patientId: string;
  patientName: string;
  reportFileUrl?: string;          // Supabase Storage URL for uploaded PDF/image
  biomarkerJson?: any;             // Numeric result payload (JSON)
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;             // User ID of compounder who approved
  approvedAt?: string;
  rejectionReason?: string;
  revisitScheduledAt?: string;     // Set by compounder on approval
  revisitNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Prescription {
  id: string;
  appointmentId: string;
  extractedMedicines?: Array<{
    name: string;
    dosage: string;
    frequency: string;
  }>;
  extractedTests?: string[];
  prescriptionFileUrl?: string;
  createdAt: string;
}
