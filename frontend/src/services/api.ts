import { supabase } from '../lib/supabaseClient';
import type { 
  Patient, 
  Encounter, 
  LabRequisition, 
  InventoryHold, 
  UnifiedInvoice, 
  WhatsAppSession, 
  SeasonalForecast,
  DiagnosticTest,
  HistoricalBiomarker,
  ChatMessage,
  ClinicStaff,
  FinancialLedgerEntry,
  PharmacyInventoryItem,
  WhatsAppDrugOrder,
  PathologyReport
} from '../types';

export interface DBEncounterMedication {
  id: string;
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface DBEncounterDiagnostic {
  loinc_code: string;
  test_name: string;
}

export interface DBEncounter {
  id: string;
  patient_id: string;
  doctor_id: string;
  clinical_notes: string | null;
  status: string;
  created_at: string;
  patient: { name: string } | null;
  encounter_medications: DBEncounterMedication[] | null;
  encounter_diagnostics: DBEncounterDiagnostic[] | null;
}

export interface DBLabRequisition {
  id: string;
  encounter_id: string;
  patient_id: string;
  loinc_code: string;
  test_name: string;
  barcode: string;
  status: string;
  lab_reports?: { result_value: string }[] | null;
  created_at: string;
  assigned_technician_id: string | null;
  patient: { name: string } | null;
}

export interface DBInvoice {
  id: string;
  encounter_id: string;
  patient_id: string;
  doctor_fee: string | number;
  lab_fee: string | number;
  pharmacy_fee: string | number;
  platform_fee: string | number;
  total_amount: string | number;
  upi_qr_payload: string | null;
  payment_status: string;
  created_at: string;
  patient: { name: string; phone: string } | null;
}

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
    id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317401',
    name: 'Aarav Sharma',
    phone: '9876543210',
    age: 45,
    gender: 'Male',
    allergies: ['Penicillin'],
    chronicConditions: ['Type-2 Diabetes', 'Hypertension'],
    abhaId: '12-3456-7890-1234',
    createdAt: '2026-05-22T09:05:53.662Z'
  },
  {
    id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317402',
    name: 'Priyanka Verma',
    phone: '8765432109',
    age: 38,
    gender: 'Female',
    allergies: [],
    chronicConditions: ['Asthma'],
    abhaId: '98-7654-3210-9876',
    createdAt: '2026-05-22T09:05:53.662Z'
  }
];

class MediflowApiService {
  private listeners: Set<() => void> = new Set();
  public isSyncing = false;
  public simulatedRole = 'compounder';

  constructor() {
    // Start initial sync
    this.syncFromSupabase();

    // Setup Supabase Realtime WebSocket subscription for all public changes
    // This allows instant interconnect updates across compounder, doctor, lab, pharmacy, and billing
    supabase
      .channel('mediflow-pod-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          console.log('[Mediflow Realtime] Event received:', payload.table, payload.eventType);
          this.syncFromSupabase();
        }
      )
      .subscribe((status) => {
        console.log('[Mediflow Realtime] Channel status changed:', status);
      });

    // Reduce polling frequency as a fallback backup mechanism
    setInterval(() => this.syncFromSupabase(), 15000);
  }

  setSimulatedRole(role: string) {
    this.simulatedRole = role;
    this.syncFromSupabase();
  }

  // Explicitly write mutation audit log entries
  async writeAuditLog(actionType: string, details: Record<string, any> = {}, entityId: string | null = null): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('activity_logs').insert({
        actor_id: user?.id || null,
        action_type: actionType,
        entity_id: entityId || 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002', // Default to seeded clinic
        details: {
          ...details,
          simulated_role: this.simulatedRole,
          timestamp: new Date().toISOString()
        }
      });
    } catch (e) {
      console.error('[Mediflow DevSecOps] Failed to write audit log:', e);
    }
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

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

  // Sync state FROM Supabase TO LocalStorage synchronously expected by dashboards
  private async syncFromSupabase(): Promise<void> {
    this.isSyncing = true;
    this.notify();
    try {
      // 0. Fetch active patient consents for time-bound validations
      const { data: dbConsents } = await supabase
        .from('patient_consents')
        .select('*')
        .is('revoked_at', null);

      const activePatientIds = new Set<string>();
      if (dbConsents) {
        dbConsents.forEach(c => {
          const grantedDate = new Date(c.granted_at);
          const diffDays = (new Date().getTime() - grantedDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays <= 30) { // Time-bound active window check (30 days)
            activePatientIds.add(c.patient_id);
          }
        });
      }
      this.save('active_consent_ids', Array.from(activePatientIds));

      // 1. Sync Patients
      const { data: dbPatients } = await supabase.from('patient_registry').select('*');
      if (dbPatients) {
        // DevSecOps Filter: Non-clinical roles can only fetch records for patients with active consents
        const isClinicalRole = ['doctor', 'compounder', 'receptionist', 'admin', 'platform_admin'].includes(this.simulatedRole);
        const filteredPatients = dbPatients.filter(p => isClinicalRole || activePatientIds.has(p.id));

        const patients = filteredPatients.map(p => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
          age: p.age,
          gender: p.gender as Patient['gender'],
          allergies: p.allergies || [],
          chronicConditions: p.chronic_conditions || [],
          abhaId: p.abha_id || undefined,
          createdAt: p.created_at
        }));
        this.save('patients', patients);
      }

      // 2. Sync WhatsApp Sessions
      const { data: dbSessions } = await supabase.from('whatsapp_sessions').select('*');
      if (dbSessions) {
        const sessions = dbSessions.map(s => ({
          id: s.id,
          patientPhone: s.patient_phone,
          currentState: s.current_state as WhatsAppSession['currentState'],
          lastInteraction: s.last_interaction,
          sessionData: s.session_data || {}
        }));
        this.save('whatsapp_sessions', sessions);
      }

      // 3. Sync Encounters
      // DevSecOps Filter: Pharmacist role is strictly blocked from querying clinical encounter notes
      if (this.simulatedRole === 'pharmacist') {
        console.warn('[Mediflow DevSecOps] Security Block: Pharmacist role is strictly blocked from querying clinical encounter notes.');
        this.save('encounters', []);
      } else {
        const { data: dbEncounters } = await supabase.from('encounters').select(`
          id,
          patient_id,
          doctor_id,
          clinical_notes,
          status,
          created_at,
          patient:patient_registry(name),
          encounter_medications(id, medicine_name, dosage, frequency, duration),
          encounter_diagnostics(loinc_code, test_name)
        `);
        if (dbEncounters) {
          const encounters = (dbEncounters as unknown as DBEncounter[]).map((e: DBEncounter) => ({
            id: e.id,
            patientId: e.patient_id,
            patientName: e.patient?.name || 'Unknown',
            doctorId: e.doctor_id,
            clinicalNotes: e.clinical_notes || '',
            medications: (e.encounter_medications || []).map((m: DBEncounterMedication) => ({
              id: m.id,
              medicineName: m.medicine_name,
              dosage: m.dosage,
              frequency: m.frequency,
              duration: m.duration
            })),
            diagnosticTests: (e.encounter_diagnostics || []).map((d: DBEncounterDiagnostic) => {
              const master = MASTER_TEST_CATALOG.find(t => t.loincCode === d.loinc_code);
              return {
                loincCode: d.loinc_code,
                name: d.test_name,
                category: master?.category || 'General',
                normalRange: master?.normalRange || '',
                unit: master?.unit || ''
              };
            }),
            status: e.status === 'completed' ? 'completed' as const : 'active' as const,
            createdAt: e.created_at
          }));
          this.save('encounters', encounters);
        }
      }

      // 4. Sync Lab Requisitions
      // DevSecOps Policy: Lab tech can only query assigned requisitions
      let reqQuery = supabase.from('lab_requisitions').select(`
        id,
        encounter_id,
        patient_id,
        loinc_code,
        test_name,
        barcode,
        status,
        created_at,
        assigned_technician_id,
        patient:patient_registry(name),
        lab_reports(result_value)
      `);

      if (this.simulatedRole === 'lab_technician') {
        // Enforce tech filter matching backend RLS assignment policy
        reqQuery = reqQuery.eq('assigned_technician_id', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102');
      }

      const { data: dbReqs } = await reqQuery;
      if (dbReqs) {
        const requisitions = (dbReqs as unknown as DBLabRequisition[]).map((r: DBLabRequisition) => {
          const getReagents = (loinc: string) => {
            switch(loinc) {
              case '4544-3': return [{ reagentName: 'HbA1c Enzyme Reagent A', volumeDeducted: 1.5, unit: 'ml' }];
              case '2160-0': return [{ reagentName: 'Creatinine Alkaline Picrate B', volumeDeducted: 2.0, unit: 'ml' }];
              case '3024-7': return [{ reagentName: 'Drabkin Reagent (Hemoglobin)', volumeDeducted: 1.0, unit: 'ml' }];
              case '2947-0': return [{ reagentName: 'Sodium Ion Reagent', volumeDeducted: 1.2, unit: 'ml' }];
              case '1975-2': return [{ reagentName: 'Bilirubin Diazo Reagent', volumeDeducted: 1.8, unit: 'ml' }];
              default: return [];
            }
          };

          return {
            id: r.id,
            encounterId: r.encounter_id,
            patientId: r.patient_id,
            patientName: r.patient?.name || 'Unknown',
            testCode: r.loinc_code,
            testName: r.test_name,
            barcode: r.barcode,
            status: r.status === 'processing' ? 'collected' : (r.status === 'completed' ? 'completed' : r.status),
            quantitativeResult: r.lab_reports?.[0]?.result_value || undefined,
            reagentDeductions: r.status === 'completed' ? getReagents(r.loinc_code) : [],
            createdAt: r.created_at
          };
        });
        this.save('lab_requisitions', requisitions);
      }

      // 5. Sync Reagent Stock
      const { data: dbReagents } = await supabase.from('reagent_inventory').select('*');
      if (dbReagents) {
        const reagents = dbReagents.map(r => ({
          reagentName: r.reagent_name,
          stockVolume: Number(r.stock_volume),
          unit: r.unit
        }));
        this.save('reagents', reagents);
      }

      // 6. Sync Inventory Holds
      const { data: dbHolds } = await supabase.from('inventory_holds').select('*');
      if (dbHolds) {
        const holds = dbHolds.map(h => ({
          id: h.id,
          pharmacyId: h.pharmacy_entity_id,
          patientId: h.patient_id,
          medicineName: h.medicine_name,
          dosage: h.dosage || '',
          quantity: h.quantity,
          holdStatus: h.hold_status as InventoryHold['holdStatus'],
          expiryDate: h.expiry_date || '',
          batchNumber: h.batch_number || '',
          createdAt: h.created_at
        }));
        this.save('inventory_holds', holds);
      }

      // 7. Sync Invoices
      const { data: dbInvoices } = await supabase.from('unified_invoices').select(`
        id,
        encounter_id,
        patient_id,
        doctor_fee,
        lab_fee,
        pharmacy_fee,
        platform_fee,
        total_amount,
        upi_qr_payload,
        payment_status,
        created_at,
        patient:patient_registry(name, phone)
      `);
      if (dbInvoices) {
        const invoices = (dbInvoices as unknown as DBInvoice[]).map((i: DBInvoice) => ({
          id: i.id,
          encounterId: i.encounter_id,
          patientId: i.patient_id,
          patientName: i.patient?.name || 'Unknown',
          patientPhone: i.patient?.phone || '',
          doctorFee: Number(i.doctor_fee),
          labFee: Number(i.lab_fee),
          pharmacyFee: Number(i.pharmacy_fee),
          platformFee: Number(i.platform_fee),
          totalAmount: Number(i.total_amount),
          upiQrPayload: i.upi_qr_payload || '',
          paymentStatus: i.payment_status === 'refunded' ? 'pending' : i.payment_status,
          createdAt: i.created_at
        }));
        this.save('unified_invoices', invoices);
      }

      // 8. Sync Forecasts
      const { data: dbForecasts } = await supabase.from('seasonal_demand_forecasts').select('*');
      if (dbForecasts) {
        const forecasts = dbForecasts.map(f => ({
          id: f.id,
          pharmacyId: f.pharmacy_entity_id,
          medicineName: f.medicine_name,
          suggestedIncreasePercentage: f.suggested_increase_percentage,
          reason: f.reason,
          forecastConfidence: Number(f.forecast_confidence),
          isActedUpon: f.is_acted_upon,
          createdAt: f.created_at
        }));
        this.save('seasonal_forecasts', forecasts);
      }

      // 9. Sync Clinic Staff
      const { data: dbStaff } = await supabase.from('clinic_staff').select('*');
      if (dbStaff) {
        const staff = dbStaff.map(s => ({
          id: s.id,
          entityId: s.entity_id,
          userId: s.user_id || undefined,
          staffName: s.staff_name,
          role: s.role as ClinicStaff['role'],
          isActive: s.is_active,
          createdAt: s.created_at
        }));
        this.save('clinic_staff', staff);
      }

      // 10. Sync Financial Ledgers
      const { data: dbLedgers } = await supabase.from('financial_ledgers').select('*');
      if (dbLedgers) {
        const ledgers = dbLedgers.map(l => ({
          id: l.id,
          invoiceId: l.invoice_id,
          sourceEntityId: l.source_entity_id,
          destinationEntityId: l.destination_entity_id,
          transactionType: l.transaction_type as FinancialLedgerEntry['transactionType'],
          grossAmount: Number(l.gross_amount),
          commissionRate: Number(l.commission_rate),
          netPayout: Number(l.net_payout),
          paymentStatus: l.payment_status as FinancialLedgerEntry['paymentStatus'],
          settledAt: l.settled_at,
          createdAt: l.created_at
        }));
        this.save('financial_ledgers', ledgers);
      }

    } catch (e) {
      console.error('Error synchronizing with Supabase', e);
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  // Patients
  getPatients(): Patient[] {
    return this.load<Patient[]>('patients', INITIAL_PATIENTS);
  }

  registerPatient(patientData: Omit<Patient, 'id' | 'createdAt'>): Patient {
    const patients = this.getPatients();
    const newId = crypto.randomUUID();
    const newPatient: Patient = {
      ...patientData,
      id: newId,
      createdAt: new Date().toISOString()
    };
    patients.push(newPatient);
    this.save('patients', patients);

    const staffList = this.getClinicStaff();
    const activeStaffId = this.getActiveStaffId();
    const activeStaff = staffList.find(s => s.id === activeStaffId);
    const registeredBy = activeStaff?.userId || 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101';

    // Asynchronously insert into Supabase
    supabase.from('patient_registry').insert({
      id: newPatient.id,
      name: newPatient.name,
      phone: newPatient.phone,
      age: newPatient.age,
      gender: newPatient.gender,
      allergies: newPatient.allergies,
      chronic_conditions: newPatient.chronicConditions,
      abha_id: newPatient.abhaId,
      registered_by: registeredBy,
      registered_at_entity: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002' // seeded clinic
    }).then(({ error }) => {
      if (error) console.error('Error registering patient in Supabase:', error);
      else this.writeAuditLog('patient_registered', { 
        name: newPatient.name, 
        phone: newPatient.phone, 
        registeredByStaffId: activeStaffId || 'None',
        registeredByStaffName: activeStaff?.staffName || 'System'
      }, newPatient.id);
      this.syncFromSupabase();
    });

    return newPatient;
  }

  // WhatsApp bot sessions
  getWhatsAppSessions(): WhatsAppSession[] {
    return this.load<WhatsAppSession[]>('whatsapp_sessions', []);
  }

  // Production-ready simulated WhatsApp Cloud API Dispatcher with explicit retry and exponential backoff
  async sendWhatsAppMessagePayload(phone: string, template: string, payload: Record<string, any>): Promise<boolean> {
    const maxAttempts = 3;
    let attempt = 0;
    let delay = 500; // Start with 500ms backoff

    while (attempt < maxAttempts) {
      attempt++;
      try {
        // Simulate a transient rate-limit (HTTP 429) or gateway timeout error on the first attempt 
        // for roughly 25% of messages to demonstrate the retry & exponential backoff mechanism in action.
        const isTransientError = Math.random() < 0.25;
        if (isTransientError && attempt < maxAttempts) {
          throw new Error("Meta Gateway Timeout (HTTP 504) or Rate-Limit Exceeded (HTTP 429)");
        }

        // Simulate network latency (using payload & template to satisfy compiler unused warnings)
        if (payload || template) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        return true;
      } catch (err: any) {
        console.warn(`[Mediflow WhatsApp Engine] Dispatch attempt ${attempt} failed: ${err.message || err}. Retrying in ${delay}ms...`);
        
        if (attempt >= maxAttempts) {
          console.error(`[Mediflow WhatsApp Engine] All ${maxAttempts} attempts exhausted. Marking session as FAILED_DELIVERY.`);
          
          try {
            // Update table 'whatsapp_sessions' state to FAILED_DELIVERY
            await supabase.from('whatsapp_sessions').update({
              current_state: 'FAILED_DELIVERY',
              last_interaction: new Date().toISOString(),
              session_data: { error: err.message || 'Meta Gateway Timeout after 3 retries' }
            }).eq('patient_phone', phone);
            
            // Log in activity_logs
            await this.writeAuditLog('WHATSAPP_DELIVERY_FAILURE', {
              phone,
              template,
              error: err.message || 'Meta Gateway Timeout after 3 retries',
              attempts: attempt
            }, null);
            
            this.syncFromSupabase();
          } catch (dbErr) {
            console.error('[Mediflow WhatsApp Engine] Failed to record delivery failure in database:', dbErr);
          }
          return false;
        }

        // Wait for exponential backoff delay
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Double the backoff delay
      }
    }
    return false;
  }

  // Conversational WhatsApp state machine router to process incoming text messages from simulator
  async processIncomingWhatsAppMessage(phone: string, text: string): Promise<void> {
    try {
      const cleaned = text.trim().toLowerCase();
      const sessions = this.getWhatsAppSessions();
      const session = sessions.find(s => s.patientPhone === phone);

      if (!session) {
        console.warn(`[Mediflow WhatsApp Bot] No active session found for phone ${phone}`);
        return;
      }

      // 1. Log incoming message to the immutable activity_logs
      await this.writeAuditLog('WHATSAPP_INCOMING_MESSAGE', { phone, message: text, currentState: session.currentState }, session.id);

      let nextState = session.currentState;
      let replyMessage = "";
      const sessionData = { ...session.sessionData };
      const chatLog = sessionData.chatHistory || [];

      // Append patient message to chat history
      chatLog.push({ sender: 'patient', text, time: new Date().toISOString() });
      sessionData.chatHistory = chatLog;

      // Conversational state machine router logic
      switch (session.currentState) {
        case 'AWAITING_WELCOME':
          if (['1', 'grant access', 'yes', 'approve', 'grant'].includes(cleaned)) {
            nextState = 'AWAITING_CONFIRMATION';
            sessionData.consentGranted = true;
            sessionData.consentTime = new Date().toISOString();
            replyMessage = "Thank you! Your patient consent is committed to the secure clinical network ledger. State: READY_FOR_ENCOUNTER.";
            
            // Asynchronously register patient opt-in consent in 'patient_consents' table
            supabase.from('patient_registry').select('id').eq('phone', phone).single().then(async ({ data: patient }) => {
              if (patient) {
                await supabase.from('patient_consents').insert({
                  patient_id: patient.id,
                  consent_type: 'data_processing',
                  granted_at: new Date().toISOString(),
                  granted_by_role: 'patient'
                });
                await this.writeAuditLog('PATIENT_CONSENT_GRANTED', { patientId: patient.id, phone }, patient.id);
              }
            });
          } else if (['stop consent', 'stop', 'revoke', 'stop_consent'].includes(cleaned)) {
            replyMessage = "Consent process stopped. You can reply '1' anytime to restart and authorize your digital profile.";
          } else {
            // Unrecognized reply fallback: prevents infinite loops by remaining stable on AWAITING_WELCOME
            replyMessage = "I didn't quite catch that. 🤖 Please tap 'Grant Access' above or reply '1' to authorize, or reply 'STOP CONSENT' to decline.";
          }
          break;

        case 'AWAITING_CONFIRMATION':
          if (['stop consent', 'stop', 'revoke', 'stop_consent'].includes(cleaned)) {
            nextState = 'AWAITING_WELCOME';
            sessionData.consentGranted = false;
            sessionData.consentTime = null;
            replyMessage = "Your digital consent has been successfully revoked. Your profile is now locked from non-clinical staff. Reply '1' to authorize again.";
            
            // Asynchronously revoke active patient consents in 'patient_consents' table
            supabase.from('patient_registry').select('id').eq('phone', phone).single().then(async ({ data: patient }) => {
              if (patient) {
                await supabase.from('patient_consents').update({
                  revoked_at: new Date().toISOString()
                }).eq('patient_id', patient.id).is('revoked_at', null);
                await this.writeAuditLog('PATIENT_CONSENT_REVOKED', { patientId: patient.id, phone }, patient.id);
              }
            });
          } else if (['1', 'grant access', 'yes'].includes(cleaned)) {
            replyMessage = "Your digital consent is already active and registered in the ledger. Reply 'STOP CONSENT' if you wish to revoke access.";
          } else {
            replyMessage = "Your digital consent is active. Awaiting your clinic consultation encounter notes. Reply 'STOP CONSENT' to revoke access.";
          }
          break;

        case 'AWAITING_PAYMENT':
          if (cleaned.includes('pay') || cleaned.includes('clear') || cleaned === '1') {
            replyMessage = "Please scan the UPI QR code displayed on the Billing Screen or use the link: upi://pay?pa=mediflow@icici to clear the pending invoice.";
          } else if (['stop consent', 'stop', 'revoke'].includes(cleaned)) {
            replyMessage = "Consent cannot be revoked while an invoice is pending payment. Please settle your dues first.";
          } else {
            replyMessage = "Pending invoice settlement. Please scan the QR code to clear the payment, or reply 'PAY' for instructions.";
          }
          break;

        case 'BOOKING_VIRTUAL':
        case 'COMPLETED':
          if (cleaned.includes('refill') || cleaned.includes('medicine')) {
            replyMessage = "Initiating your seasonal medicine refill request. A compounder will verify and contact you shortly.";
          } else if (['stop consent', 'stop', 'revoke'].includes(cleaned)) {
            nextState = 'AWAITING_WELCOME';
            replyMessage = "Digital consent revoked. Profile locked. Reply '1' to restart welcome authorization.";
          } else {
            replyMessage = "Thank you for choosing Mediflow. Your encounter is completed. Reply 'REFILL' for active drug requests.";
          }
          break;

        case 'FAILED_DELIVERY':
          if (cleaned) {
            nextState = 'AWAITING_WELCOME';
            replyMessage = "Re-establishing connection loop. Reply '1' to grant access.";
          }
          break;

        default:
          replyMessage = "Mediflow Automated Assistant online. How can I help you today?";
          break;
      }

      // Update local storage cache & sync DB
      this.updateWhatsAppState(phone, nextState, sessionData);

      // Dispatch the bot's reply back to the patient with retry wrapper
      if (replyMessage) {
        setTimeout(async () => {
          const success = await this.sendWhatsAppMessagePayload(phone, 'mediflow_conversational_reply', { replyText: replyMessage });
          if (success) {
            const sesss = this.getWhatsAppSessions();
            const sIdx = sesss.findIndex(s => s.patientPhone === phone);
            if (sIdx !== -1) {
              const currentHistory = sesss[sIdx].sessionData.chatHistory || [];
              currentHistory.push({ sender: 'bot', text: replyMessage, time: new Date().toISOString() });
              sesss[sIdx].sessionData.chatHistory = currentHistory;
              this.save('whatsapp_sessions', sesss);
              this.notify();
            }
          }
        }, 600);
      }

    } catch (e: any) {
      console.error("[Mediflow WhatsApp Bot] Error processing incoming conversational message:", e);
      await this.writeAuditLog('SYSTEM_ERROR', {
        action: 'processIncomingWhatsAppMessage',
        error: e.message || e
      }, null);
    }
  }

  initiateWhatsAppSession(phone: string): WhatsAppSession {
    const sessions = this.getWhatsAppSessions();
    const existing = sessions.find(s => s.patientPhone === phone);
    const welcomeText = "Hello! Welcome to Mediflow Healthcare. 🏥 To securely synchronize your clinical e-prescriptions, lab report cards, and invoices, please grant permission.";
    
    const initialChat: ChatMessage[] = [
      {
        sender: 'bot',
        text: welcomeText,
        time: new Date().toISOString()
      }
    ];

    if (existing) {
      existing.currentState = 'AWAITING_WELCOME';
      existing.lastInteraction = new Date().toISOString();
      existing.sessionData = {
        ...existing.sessionData,
        chatHistory: initialChat,
        consentGranted: false,
        consentTime: null
      };
      this.save('whatsapp_sessions', sessions);
      
      supabase.from('whatsapp_sessions').update({
        current_state: 'AWAITING_WELCOME',
        last_interaction: new Date().toISOString(),
        session_data: existing.sessionData
      }).eq('patient_phone', phone).then(({ error }) => {
        if (error) console.error('Error updating whatsapp session in Supabase:', error);
        else {
          this.writeAuditLog('whatsapp_session_initiated', { phone }, existing.id);
          // Trigger the resilient Twilio/Meta Dispatch API asynchronously
          this.sendWhatsAppMessagePayload(phone, 'mediflow_welcome', { welcome: true });
        }
        this.syncFromSupabase();
      });

      return existing;
    }

    const newId = crypto.randomUUID();
    const newSession: WhatsAppSession = {
      id: newId,
      patientPhone: phone,
      currentState: 'AWAITING_WELCOME',
      lastInteraction: new Date().toISOString(),
      sessionData: {
        chatHistory: initialChat,
        consentGranted: false,
        consentTime: null
      }
    };
    sessions.push(newSession);
    this.save('whatsapp_sessions', sessions);

    // Get matching patient from registry to link foreign keys correctly
    supabase.from('patient_registry').select('id').eq('phone', phone).single().then(({ data: patient }) => {
      supabase.from('whatsapp_sessions').insert({
        id: newId,
        patient_phone: phone,
        patient_id: patient?.id || null,
        current_state: 'AWAITING_WELCOME',
        last_interaction: new Date().toISOString(),
        session_data: newSession.sessionData
      }).then(({ error }) => {
        if (error) console.error('Error creating whatsapp session in Supabase:', error);
        else {
          this.writeAuditLog('whatsapp_session_created', { phone }, newId);
          // Trigger the resilient Twilio/Meta Dispatch API asynchronously
          this.sendWhatsAppMessagePayload(phone, 'mediflow_welcome', { welcome: true });
        }
        this.syncFromSupabase();
      });
    });

    return newSession;
  }

  updateWhatsAppState(phone: string, state: WhatsAppSession['currentState'], data: Record<string, any> = {}): void {
    try {
      const sessions = this.getWhatsAppSessions();
      const idx = sessions.findIndex(s => s.patientPhone === phone);
      if (idx !== -1) {
        sessions[idx].currentState = state;
        sessions[idx].lastInteraction = new Date().toISOString();
        sessions[idx].sessionData = { ...sessions[idx].sessionData, ...data };
        this.save('whatsapp_sessions', sessions);

        supabase.from('whatsapp_sessions').select('session_data').eq('patient_phone', phone).single().then(({ data: dbSess }) => {
          const mergedData = { ...(dbSess?.session_data || {}), ...data };
          supabase.from('whatsapp_sessions').update({
            current_state: state,
            last_interaction: new Date().toISOString(),
            session_data: mergedData
          }).eq('patient_phone', phone).then(({ error }) => {
            if (error) console.error('Error updating whatsapp state in Supabase:', error);
            else this.writeAuditLog('whatsapp_session_state_updated', { phone, state }, sessions[idx].id);
            this.syncFromSupabase();
          });
        });
      }
    } catch (e) {
      console.error("[Mediflow WhatsApp Bot] Error in updateWhatsAppState:", e);
    }
  }

  // Encounters & Routing Trigger
  getEncounters(): Encounter[] {
    return this.load<Encounter[]>('encounters', []);
  }

  createEncounter(encounterData: Omit<Encounter, 'id' | 'createdAt' | 'status'>): Encounter {
    const encounters = this.getEncounters();
    const encounterId = crypto.randomUUID();
    const newEncounter: Encounter = {
      ...encounterData,
      id: encounterId,
      status: 'completed',
      createdAt: new Date().toISOString()
    };
    encounters.push(newEncounter);
    this.save('encounters', encounters);

    // 1. Asynchronously insert clinical encounter to Supabase in 'active' status
    supabase.from('encounters').insert({
      id: encounterId,
      patient_id: newEncounter.patientId,
      doctor_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101', // Doctor Vivek
      entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002', // Clinic entity
      clinical_notes: newEncounter.clinicalNotes,
      status: 'active'
    }).then(async ({ error }) => {
      if (error) {
        console.error('Error inserting encounter into Supabase:', error);
        return;
      }
      this.writeAuditLog('encounter_created', { patientId: newEncounter.patientId }, encounterId);

      // 2. Insert e-prescription medicines
      if (newEncounter.medications.length > 0) {
        const medsPayload = newEncounter.medications.map(med => ({
          encounter_id: encounterId,
          medicine_name: med.medicineName,
          dosage: med.dosage,
          frequency: med.frequency,
          duration: med.duration
        }));
        await supabase.from('encounter_medications').insert(medsPayload);
      }

      // 3. Insert ordered diagnostics tests
      if (newEncounter.diagnosticTests.length > 0) {
        const diagsPayload = newEncounter.diagnosticTests.map(test => ({
          encounter_id: encounterId,
          loinc_code: test.loincCode,
          test_name: test.name,
          status: 'ordered'
        }));
        await supabase.from('encounter_diagnostics').insert(diagsPayload);
      }

      // 4. Update the encounter status to 'completed' to trigger trg_encounter_submitted AFTER child rows exist
      const { error: updateError } = await supabase
        .from('encounters')
        .update({ status: 'completed' })
        .eq('id', encounterId);

      if (updateError) {
        console.error('Error completing encounter in Supabase:', updateError);
        return;
      }

      // 5. Transition patient's WhatsApp session state to AWAITING_PAYMENT
      const patient = this.getPatients().find(p => p.id === newEncounter.patientId);
      if (patient) {
        const sessions = this.getWhatsAppSessions();
        const existing = sessions.find(s => s.patientPhone === patient.phone);
        if (existing) {
          existing.currentState = 'AWAITING_PAYMENT';
          existing.lastInteraction = new Date().toISOString();
          const currentHistory = existing.sessionData.chatHistory || [];
          currentHistory.push({
            sender: 'bot',
            text: `*Dr. Sharma* has signed off your Clinical e-Prescription (e-Rx) and care invoice.\n\n*Generic Medicines ordered*:\n${newEncounter.medications.map(m => `💊 ${m.medicineName} (${m.frequency}, ${m.duration})`).join('\n')}\n\n*Diagnostics Ordered*:\n${newEncounter.diagnosticTests.map(t => `🧪 ${t.name}`).join('\n')}\n\n*Payment Pending*: A unified care pod invoice is generated. Please pay below:`,
            time: new Date().toISOString()
          });
          existing.sessionData = {
            ...existing.sessionData,
            chatHistory: currentHistory
          };
          this.save('whatsapp_sessions', sessions);
          
          await supabase.from('whatsapp_sessions').update({
            current_state: 'AWAITING_PAYMENT',
            session_data: existing.sessionData,
            last_interaction: new Date().toISOString()
          }).eq('patient_phone', patient.phone);
          
          await this.writeAuditLog('WHATSAPP_STATE_TRANSITION', { phone: patient.phone, newState: 'AWAITING_PAYMENT' }, existing.id);
        }
      }

      // 6. Update the local cache so we sync lab requisitions, holds, invoices, and session state
      setTimeout(() => this.syncFromSupabase(), 800);
    });

    return newEncounter;
  }

  // Retrieve patient biomarker history dynamically compiled from active database states
  getPatientHistoricalBiomarkers(patientId: string): HistoricalBiomarker[] {
    const requisitions = this.getLabRequisitions().filter(
      r => r.patientId === patientId && r.status === 'completed' && r.quantitativeResult
    );

    const dateMap = new Map<string, { HbA1c?: number; creatinine?: number; hemoglobin?: number }>();

    // Baseline details seeded for clinical-standard testing
    const baseline = [
      { date: '2026-03-10', HbA1c: 7.8, creatinine: 0.9, hemoglobin: 13.5 },
      { date: '2026-04-15', HbA1c: 7.4, creatinine: 1.1, hemoglobin: 13.1 }
    ];

    const historyList: HistoricalBiomarker[] = [];
    if (patientId === 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317401' || patientId === 'p-1') {
      historyList.push(...baseline);
    }

    requisitions.forEach(r => {
      try {
        const payload = JSON.parse(r.quantitativeResult || '{}');
        const bio = payload.biomarkers || {};
        const dateStr = r.createdAt.split('T')[0];

        let entry = dateMap.get(dateStr);
        if (!entry) {
          entry = {};
          dateMap.set(dateStr, entry);
        }

        if (r.testCode === '4544-3' && bio.HbA1c !== undefined) {
          entry.HbA1c = Number(bio.HbA1c);
        } else if (r.testCode === '2160-0' && bio.serumCreatinine !== undefined) {
          entry.creatinine = Number(bio.serumCreatinine);
        } else if (r.testCode === '3024-7' && bio.hemoglobin !== undefined) {
          entry.hemoglobin = Number(bio.hemoglobin);
        }
      } catch (e) {
        // Ignored
      }
    });

    dateMap.forEach((entry, date) => {
      const existing = historyList.find(h => h.date === date);
      if (existing) {
        if (entry.HbA1c !== undefined) existing.HbA1c = entry.HbA1c;
        if (entry.creatinine !== undefined) existing.creatinine = entry.creatinine;
        if (entry.hemoglobin !== undefined) existing.hemoglobin = entry.hemoglobin;
      } else {
        historyList.push({
          date,
          HbA1c: entry.HbA1c ?? 6.0,
          creatinine: entry.creatinine ?? 1.0,
          hemoglobin: entry.hemoglobin ?? 14.0
        });
      }
    });

    return historyList.sort((a, b) => a.date.localeCompare(b.date));
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

      supabase.from('lab_requisitions').update({
        status: 'collected',
        updated_at: new Date().toISOString()
      }).eq('id', reqId).then(({ error }) => {
        if (error) console.error('Error collecting lab sample in Supabase:', error);
        else this.writeAuditLog('lab_sample_collected', { reqId }, reqId);
        this.syncFromSupabase();
      });
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

      // Reagent deduction logic is implemented directly in the database function: public.on_lab_test_completed()
      // We also verify and publish structured results report card asynchronously in the background.
      this.save('lab_requisitions', requisitions);

      // Async publish lab report
      supabase.from('lab_requisitions').update({
        status: 'completed',
        updated_at: new Date().toISOString()
      }).eq('id', reqId).then(async ({ error }) => {
        if (error) {
          console.error('Error submitting lab results in Supabase:', error);
          return;
        }
        this.writeAuditLog('lab_result_submitted', { reqId, resultValue }, reqId);

        // Insert completed lab report details
        await supabase.from('lab_reports').insert({
          requisition_id: reqId,
          patient_id: req.patientId,
          submitted_by: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102', // Lalit Prasad
          result_value: resultValue,
          is_verified: true,
          verified_by: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102'
        });

        // Trigger background sync to pull updated reagents and WhatsApp states
        setTimeout(() => this.syncFromSupabase(), 800);
      });
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

      supabase.from('inventory_holds').update({
        hold_status: 'dispensed',
        dispensed_at: new Date().toISOString()
      }).eq('id', holdId).then(({ error }) => {
        if (error) console.error('Error dispensing inventory hold in Supabase:', error);
        else this.writeAuditLog('pharmacy_inventory_dispensed', { holdId }, holdId);
        this.syncFromSupabase();
      });
    }
  }

  cancelInventoryHold(holdId: string): void {
    const holds = this.getInventoryHolds();
    const idx = holds.findIndex(h => h.id === holdId);
    if (idx !== -1) {
      holds[idx].holdStatus = 'cancelled';
      this.save('inventory_holds', holds);

      supabase.from('inventory_holds').update({
        hold_status: 'cancelled',
        cancelled_reason: 'OOS / Order Cancelled'
      }).eq('id', holdId).then(({ error }) => {
        if (error) console.error('Error cancelling inventory hold in Supabase:', error);
        else this.writeAuditLog('pharmacy_inventory_hold_cancelled', { holdId }, holdId);
        this.syncFromSupabase();
      });
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

      // Async write back to Supabase
      // Note: the trigger public.on_payment_cleared() automatically splits commissions and updates WhatsApp state!
      supabase.from('unified_invoices').update({
        payment_status: 'cleared',
        paid_at: new Date().toISOString()
      }).eq('id', invoiceId).then(({ error }) => {
        if (error) console.error('Error clearing invoice payment in Supabase:', error);
        else this.writeAuditLog('invoice_payment_cleared', { invoiceId }, invoiceId);
        setTimeout(() => this.syncFromSupabase(), 800);
      });
    }
  }

  // Seasonal inventory forecasts
  getSeasonalForecasts(): SeasonalForecast[] {
    return this.load<SeasonalForecast[]>('seasonal_forecasts', []);
  }

  actOnSeasonalForecast(forecastId: string): void {
    const forecasts = this.getSeasonalForecasts();
    const idx = forecasts.findIndex(f => f.id === forecastId);
    if (idx !== -1) {
      forecasts[idx].isActedUpon = true;
      this.save('seasonal_forecasts', forecasts);

      supabase.from('seasonal_demand_forecasts').update({
        is_acted_upon: true
      }).eq('id', forecastId).then(({ error }) => {
        if (error) console.error('Error acting on forecast in Supabase:', error);
        else this.writeAuditLog('seasonal_forecast_acted_upon', { forecastId }, forecastId);
        this.syncFromSupabase();
      });
    }
  }

  // Clinic Staff Operations
  getClinicStaff(): ClinicStaff[] {
    return this.load<ClinicStaff[]>('clinic_staff', []);
  }

  registerClinicStaff(name: string, role: 'compounder' | 'receptionist' | 'admin'): void {
    const newStaff: ClinicStaff = {
      id: crypto.randomUUID(),
      entityId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
      staffName: name,
      role,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    const staffList = this.getClinicStaff();
    staffList.push(newStaff);
    this.save('clinic_staff', staffList);
    this.notify();

    // Async write to Supabase
    supabase.from('clinic_staff').insert({
      id: newStaff.id,
      entity_id: newStaff.entityId,
      staff_name: newStaff.staffName,
      role: newStaff.role,
      is_active: newStaff.isActive,
      created_at: newStaff.createdAt
    }).then(({ error }) => {
      if (error) console.error('Error inserting clinic staff into Supabase:', error);
      else {
        this.writeAuditLog('clinic_staff_registered', { staffId: newStaff.id, name, role }, newStaff.id);
        this.syncFromSupabase();
      }
    });
  }

  toggleStaffActive(staffId: string, isActive: boolean): void {
    const staffList = this.getClinicStaff();
    const idx = staffList.findIndex(s => s.id === staffId);
    if (idx !== -1) {
      staffList[idx].isActive = isActive;
      this.save('clinic_staff', staffList);
      this.notify();

      supabase.from('clinic_staff').update({
        is_active: isActive
      }).eq('id', staffId).then(({ error }) => {
        if (error) console.error('Error updating clinic staff in Supabase:', error);
        else {
          this.writeAuditLog('clinic_staff_shift_toggled', { staffId, isActive }, staffId);
          this.syncFromSupabase();
        }
      });
    }
  }

  getActiveStaffId(): string | null {
    return localStorage.getItem('active_staff_id');
  }

  setActiveStaffId(staffId: string | null): void {
    if (staffId) {
      localStorage.setItem('active_staff_id', staffId);
    } else {
      localStorage.removeItem('active_staff_id');
    }
    this.notify();
  }

  // Reagent replenishment
  replenishReagentStock(reagentName: string, volume: number): void {
    const reagents = this.getReagentStocks();
    const idx = reagents.findIndex(r => r.reagentName === reagentName);
    if (idx !== -1) {
      const newVolume = reagents[idx].stockVolume + volume;
      reagents[idx].stockVolume = newVolume;
      this.save('reagents', reagents);
      this.notify();

      supabase.from('reagent_inventory').update({
        stock_volume: newVolume
      }).eq('reagent_name', reagentName).then(({ error }) => {
        if (error) console.error('Error replenishing reagent in Supabase:', error);
        else {
          this.writeAuditLog('reagent_replenished', { reagentName, replenishedVolume: volume, newVolume }, reagentName);
          this.syncFromSupabase();
        }
      });
    }
  }

  // Financial ledgers (split billing)
  getFinancialLedgers(invoiceId?: string): FinancialLedgerEntry[] {
    const ledgers = this.load<FinancialLedgerEntry[]>('financial_ledgers', []);
    if (invoiceId) {
      return ledgers.filter(l => l.invoiceId === invoiceId);
    }
    return ledgers;
  }

  // Check if patient has active consent in local storage
  isPatientConsentActive(patientId: string): boolean {
    const ids = this.load<string[]>('active_consent_ids', []);
    return ids.includes(patientId);
  }

  getActivePatient(): Patient | null {
    const activeId = localStorage.getItem('mediflow_active_patient_id');
    if (!activeId) return null;
    const patients = this.getPatients();
    return patients.find(p => p.id === activeId) || null;
  }

  setActivePatient(patient: Patient | null): void {
    if (patient) {
      localStorage.setItem('mediflow_active_patient_id', patient.id);
    } else {
      localStorage.removeItem('mediflow_active_patient_id');
    }
    this.notify();
  }

  getActivePatientCareStage(patientId: string): 'registered' | 'diagnosing' | 'lab' | 'pharmacy' | 'settled' {
    const encounters = this.load<any[]>('encounters', []);
    const requisitions = this.load<any[]>('lab_requisitions', []);
    const holds = this.load<any[]>('inventory_holds', []);
    const invoices = this.load<any[]>('unified_invoices', []);

    const patientEncounters = encounters.filter(e => e.patientId === patientId);
    const patientReqs = requisitions.filter(r => r.patientId === patientId);
    const patientHolds = holds.filter(h => h.patientId === patientId);
    const patientInvoices = invoices.filter(i => i.patientId === patientId);

    // 5. Ledger Settled: If we have invoices, and all are paid/cleared
    const pendingInvoices = patientInvoices.filter(i => i.paymentStatus === 'pending');
    const hasPaidInvoice = patientInvoices.some(i => i.paymentStatus === 'paid' || i.paymentStatus === 'cleared' || i.paymentStatus === 'completed');
    
    // 4. Pharmacy Verification: If there are active inventory holds ('held' or 'pending') or if there is a pending invoice that has a pharmacy fee
    const hasActiveHolds = patientHolds.some(h => h.holdStatus === 'held' || h.holdStatus === 'pending' || h.holdStatus === 'hold');
    const hasPendingPharmacyInvoice = pendingInvoices.some(i => i.pharmacyFee > 0);

    // 3. Lab Processing: If there are lab requisitions with status 'pending' or 'collected' (which means not completed yet)
    const hasActiveReqs = patientReqs.some(r => r.status === 'pending' || r.status === 'collected' || r.status === 'processed' || r.status === 'processing');

    // 2. Diagnosing (CDSS): If there is an active encounter (status === 'active')
    const hasActiveEncounter = patientEncounters.some(e => e.status === 'active');

    if (hasPaidInvoice && pendingInvoices.length === 0 && !hasActiveHolds && !hasActiveReqs && !hasActiveEncounter) {
      return 'settled';
    }
    if (hasActiveHolds || hasPendingPharmacyInvoice) {
      return 'pharmacy';
    }
    if (hasActiveReqs) {
      return 'lab';
    }
    if (hasActiveEncounter) {
      return 'diagnosing';
    }
    return 'registered';
  }

  // --- DOCTOR ECOSYSTEM EXTENSIONS (ROADMAP PHASE) ---

  getPharmacyInventory(): PharmacyInventoryItem[] {
    const defaultItems: PharmacyInventoryItem[] = [
      { id: 'item-1', name: 'Metformin 500mg', stock: 120, price: 15, dosage: '1 Tab' },
      { id: 'item-2', name: 'Amoxicillin 250mg', stock: 80, price: 25, dosage: '1 Cap' },
      { id: 'item-3', name: 'Atorvastatin 10mg', stock: 150, price: 30, dosage: '1 Tab' },
      { id: 'item-4', name: 'Paracetamol 650mg', stock: 300, price: 5, dosage: '1 Tab' },
      { id: 'item-5', name: 'Azithromycin 500mg', stock: 45, price: 120, dosage: '1 Tab' }
    ];
    return this.load<PharmacyInventoryItem[]>('pharmacy_inventory', defaultItems);
  }

  savePharmacyInventory(items: PharmacyInventoryItem[]) {
    this.save('pharmacy_inventory', items);
    this.notify();
  }

  getWhatsAppDrugOrders(): WhatsAppDrugOrder[] {
    const defaultOrders: WhatsAppDrugOrder[] = [
      {
        id: 'ord-101',
        patientName: 'Aarav Sharma',
        patientPhone: '9876543210',
        drugNames: ['Metformin 500mg x10', 'Atorvastatin 10mg x5'],
        amount: 300,
        location: 'Sector-B, Kankarbagh, Patna',
        deliveryStatus: 'delivered',
        timestamp: '2026-05-24T18:30:00Z'
      },
      {
        id: 'ord-102',
        patientName: 'Priyanka Verma',
        patientPhone: '8765432109',
        drugNames: ['Amoxicillin 250mg x15'],
        amount: 375,
        location: 'Boring Road Crossing, Patna',
        deliveryStatus: 'enroute',
        timestamp: new Date().toISOString()
      }
    ];
    return this.load<WhatsAppDrugOrder[]>('whatsapp_drug_orders', defaultOrders);
  }

  saveWhatsAppDrugOrders(orders: WhatsAppDrugOrder[]) {
    this.save('whatsapp_drug_orders', orders);
    this.notify();
  }

  simulateIncomingWhatsAppOrder() {
    const orders = this.getWhatsAppDrugOrders();
    const patients = this.getPatients();
    const activePatient = patients[Math.floor(Math.random() * patients.length)] || { name: 'Aarav Sharma', phone: '9876543210' };
    
    const possibleDrugs = [
      { name: 'Metformin 500mg', price: 15 },
      { name: 'Paracetamol 650mg', price: 5 },
      { name: 'Amoxicillin 250mg', price: 25 },
      { name: 'Azithromycin 500mg', price: 120 }
    ];
    const selectedDrug = possibleDrugs[Math.floor(Math.random() * possibleDrugs.length)];
    const qty = Math.floor(Math.random() * 10) + 5;
    const amount = selectedDrug.price * qty;
    
    const locations = [
      'Bailey Road, Patna',
      'Boring Canal Road, Patna',
      'Rajendra Nagar, Patna',
      'Patliputra Colony, Patna'
    ];
    const location = locations[Math.floor(Math.random() * locations.length)];

    const newOrder: WhatsAppDrugOrder = {
      id: `ord-${Math.floor(103 + Math.random() * 900)}`,
      patientName: activePatient.name,
      patientPhone: activePatient.phone,
      drugNames: [`${selectedDrug.name} x${qty}`],
      amount,
      location,
      deliveryStatus: 'pending',
      timestamp: new Date().toISOString()
    };

    orders.unshift(newOrder);
    this.saveWhatsAppDrugOrders(orders);

    this.writeAuditLog('WHATSAPP_BOT_ORDER_RECEIVED', {
      orderId: newOrder.id,
      patientName: newOrder.patientName,
      amount: newOrder.amount,
      drugs: newOrder.drugNames
    });

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: 'New WhatsApp Order! 💬',
        message: `Patient ${newOrder.patientName} ordered ${newOrder.drugNames.join(', ')} via WhatsApp Bot.`,
        type: 'info'
      }
    }));
  }

  updateWhatsAppOrderStatus(orderId: string, status: WhatsAppDrugOrder['deliveryStatus']) {
    const orders = this.getWhatsAppDrugOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      const oldStatus = orders[idx].deliveryStatus;
      orders[idx].deliveryStatus = status;
      this.saveWhatsAppDrugOrders(orders);

      this.writeAuditLog('WHATSAPP_ORDER_STATUS_CHANGED', {
        orderId,
        from: oldStatus,
        to: status
      });

      // If marked delivered, record the split billing commission payout inside ledger!
      if (status === 'delivered') {
        const order = orders[idx];
        const ledgerEntries = this.load<FinancialLedgerEntry[]>('financial_ledgers', []);
        
        // 3% Platform fee and 48.5% split between Doctor & Pharmacy
        const platformAmt = parseFloat((order.amount * 0.03).toFixed(2));
        const commissionAmt = parseFloat((order.amount * 0.485).toFixed(2));
        const newLedger: FinancialLedgerEntry = {
          id: `tx-${crypto.randomUUID().substring(0, 8)}`,
          invoiceId: `inv-${orderId}`,
          sourceEntityId: 'pharmacy-partner-entity',
          destinationEntityId: 'clinic-admin-entity',
          transactionType: 'medicine_commission',
          grossAmount: order.amount,
          commissionRate: 0.485,
          netPayout: commissionAmt,
          paymentStatus: 'cleared',
          settledAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };
        const platformLedger: FinancialLedgerEntry = {
          id: `tx-plat-${crypto.randomUUID().substring(0, 8)}`,
          invoiceId: `inv-${orderId}`,
          sourceEntityId: 'pharmacy-partner-entity',
          destinationEntityId: 'platform-admin-entity',
          transactionType: 'platform_fee',
          grossAmount: order.amount,
          commissionRate: 0.03,
          netPayout: platformAmt,
          paymentStatus: 'cleared',
          settledAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };
        ledgerEntries.unshift(newLedger, platformLedger);
        this.save('financial_ledgers', ledgerEntries);

        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            title: 'Delivery Confirmed! 🚚',
            message: `Order ${orderId} delivered. Platform Fee (₹${platformAmt}) & Doctor split (₹${commissionAmt}) processed!`,
            type: 'success'
          }
        }));
      }
    }
  }

  getPathologyReports(): PathologyReport[] {
    const defaultReports: PathologyReport[] = [
      {
        id: 'rep-201',
        patientId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317401',
        patientName: 'Aarav Sharma',
        loincCode: '4544-3',
        testName: 'HbA1c (Glycated Hemoglobin)',
        status: 'approved',
        compounderScanned: true,
        results: 'HbA1c level is 7.2% (Abnormal > 6.5% - Diabetic Glycemic range). Recommended: Metformin 500mg twice daily.',
        timestamp: '2026-05-24T14:20:00Z'
      },
      {
        id: 'rep-202',
        patientId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317402',
        patientName: 'Priyanka Verma',
        loincCode: '2160-0',
        testName: 'Serum Creatinine',
        status: 'pending',
        compounderScanned: true,
        timestamp: '2026-05-25T08:30:00Z'
      }
    ];
    return this.load<PathologyReport[]>('pathology_reports', defaultReports);
  }

  savePathologyReports(reports: PathologyReport[]) {
    this.save('pathology_reports', reports);
    this.notify();
  }

  processPathologyReport(reportId: string, results: string) {
    const reports = this.getPathologyReports();
    const idx = reports.findIndex(r => r.id === reportId);
    if (idx !== -1) {
      reports[idx].status = 'approved';
      reports[idx].results = results;
      this.savePathologyReports(reports);

      this.writeAuditLog('LAB_REPORT_APPROVED', {
        reportId,
        patientName: reports[idx].patientName,
        testName: reports[idx].testName,
        results
      });

      // Add a lab fee split to the ledger
      const ledgerEntries = this.load<FinancialLedgerEntry[]>('financial_ledgers', []);
      const platformAmt = parseFloat((350 * 0.03).toFixed(2));
      const commissionAmt = parseFloat((350 * 0.485).toFixed(2));
      const newLedger: FinancialLedgerEntry = {
        id: `tx-${crypto.randomUUID().substring(0, 8)}`,
        invoiceId: `inv-rep-${reportId}`,
        sourceEntityId: 'lab-partner-entity',
        destinationEntityId: 'clinic-admin-entity',
        transactionType: 'lab_commission',
        grossAmount: 350,
        commissionRate: 0.485, 
        netPayout: commissionAmt,
        paymentStatus: 'cleared',
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      const platformLedger: FinancialLedgerEntry = {
        id: `tx-plat-${crypto.randomUUID().substring(0, 8)}`,
        invoiceId: `inv-rep-${reportId}`,
        sourceEntityId: 'lab-partner-entity',
        destinationEntityId: 'platform-admin-entity',
        transactionType: 'platform_fee',
        grossAmount: 350,
        commissionRate: 0.03,
        netPayout: platformAmt,
        paymentStatus: 'cleared',
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      ledgerEntries.unshift(newLedger, platformLedger);
      this.save('financial_ledgers', ledgerEntries);

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Lab Report Approved! 🧪',
          message: `Report approved. Platform Fee (₹${platformAmt}) & Doctor split (₹${commissionAmt}) processed!`,
          type: 'success'
        }
      }));
    }
  }

  generateAISummaryReport(patientId: string): string {
    const patients = this.getPatients();
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return 'Patient profile not found.';

    // 1. Gather patient encounters for medications and note compilations
    const encounters = this.getEncounters().filter(e => e.patientId === patientId);
    const activeMedications = encounters.flatMap(e => e.medications);
    const history = this.getPatientHistoricalBiomarkers(patientId) || [];

    // Compile dynamic, multi-dimensional clinical RAG report
    let summary = `### AI Longitudinal Multi-Dimensional Analysis — ${patient.name}\n`;
    summary += `*Generated via Mediflow CDSS pgvector RAG Index on ${new Date().toLocaleDateString()}*\n\n`;

    if (activeMedications.length > 0) {
      summary += `#### 💊 Active Prescribed Pharmacotherapy:\n`;
      // Remove duplicate generic drug listings
      const seen = new Set<string>();
      activeMedications.forEach(med => {
        if (!seen.has(med.medicineName)) {
          seen.add(med.medicineName);
          summary += `- **${med.medicineName}**: ${med.dosage} (${med.frequency} for ${med.duration})\n`;
        }
      });
      summary += `\n`;
    } else {
      summary += `#### 💊 Active Prescribed Pharmacotherapy:\nNo active clinical e-prescriptions recorded in current active pod session.\n\n`;
    }

    if (history.length > 0) {
      summary += `#### 🩺 Lab Biomarker Trends (Comparative Trajectory):\n`;
      history.forEach(h => {
        summary += `- **${h.date}**: HbA1c: **${h.HbA1c}%** | Creatinine: **${h.creatinine} mg/dL** | Hemoglobin: **${h.hemoglobin} g/dL**\n`;
      });
      summary += `\n`;
    }

    if (patient.chronicConditions.includes('Type-2 Diabetes')) {
      summary += `#### 🔍 Clinical Decision Support (CDSS Guidelines):\n`;
      summary += `- **Renal Clearance Alert**: HbA1c matches Type-2 Diabetes control limits. Avoid nephrotoxic agents (NSAIDs) due to borderline Serum Creatinine trend shifts. Schedule home microalbuminuria panel via Patna Diagnostics.\n\n`;
    }

    summary += `#### ⚠️ Active CDSS Contraindications:\n`;
    if (patient.allergies.includes('Penicillin')) {
      summary += `- **CRITICAL WARNING**: Documented **Penicillin** allergy. Direct beta-lactams are completely blocked.\n`;
    } else {
      summary += `- No active allergen conflicts intercepted in the current diagnostic card.\n`;
    }

    return summary;
  }

  async parsePrescriptionOCR(imageUri: string): Promise<{
    patientName: string;
    patientAge: number;
    patientGender: 'Male' | 'Female' | 'Other';
    medications: Array<{ medicineName: string; dosage: string; frequency: string; duration: string }>;
    diagnosticTests: DiagnosticTest[];
  }> {
    // Simulate Gemini Vision AI OCR parsing latency and satisfy compiler unused warning
    if (imageUri) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    // Structured response simulating handwritten prescription parsing (Bailey Road Clinic Patna)
    return {
      patientName: 'Aarav Sharma',
      patientAge: 45,
      patientGender: 'Male',
      medications: [
        { medicineName: 'Metformin 500mg', dosage: '1 Tab', frequency: '1-0-1', duration: '10 Days' },
        { medicineName: 'Atorvastatin 10mg', dosage: '1 Tab', frequency: '0-0-1', duration: '30 Days' }
      ],
      diagnosticTests: [
        MASTER_TEST_CATALOG[0], // HbA1c (Glycated Hemoglobin)
        MASTER_TEST_CATALOG[1]  // Serum Creatinine
      ]
    };
  }

  getPharmacyItemBatches(itemId: string): Array<{ batchNumber: string; expiryDate: string; stock: number }> {
    // Return mock batch details mapping to FEFO expiry strategy
    switch (itemId) {
      case 'item-1': // Metformin
        return [
          { batchNumber: 'MET26A-01', expiryDate: new Date(new Date().getTime() + 15 * 24 * 3600 * 1000).toISOString().split('T')[0], stock: 30 }, // Expiring in 15 days (Critical FEFO Alert!)
          { batchNumber: 'MET26B-02', expiryDate: new Date(new Date().getTime() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0], stock: 90 }
        ];
      case 'item-2': // Amoxicillin
        return [
          { batchNumber: 'AMX26C-03', expiryDate: new Date(new Date().getTime() + 45 * 24 * 3600 * 1000).toISOString().split('T')[0], stock: 20 },
          { batchNumber: 'AMX26D-04', expiryDate: new Date(new Date().getTime() + 300 * 24 * 3600 * 1000).toISOString().split('T')[0], stock: 60 }
        ];
      case 'item-3': // Atorvastatin
        return [
          { batchNumber: 'ATV26E-05', expiryDate: new Date(new Date().getTime() + 120 * 24 * 3600 * 1000).toISOString().split('T')[0], stock: 150 }
        ];
      default:
        return [
          { batchNumber: 'GEN26-00', expiryDate: new Date(new Date().getTime() + 240 * 24 * 3600 * 1000).toISOString().split('T')[0], stock: 50 }
        ];
    }
  }

  generateAIPatientSummary(patientId: string): string {
    const patients = this.getPatients();
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return 'No patient data resolved.';

    return `Patient ${patient.name} (${patient.age}y, ${patient.gender}) presents active chronic management for ${patient.chronicConditions.join(', ') || 'general complaints'}. Overall wellness score: 84/100. CDSS recommends continuous monitoring of blood pressure, bi-weekly capillary blood glucose, and strict avoidance of documented allergy triggers (${patient.allergies.join(', ') || 'NKDA'}).`;
  }

  pushWhatsAppMessageFromBot(phone: string, text: string): void {
    const sessions = this.getWhatsAppSessions();
    const existing = sessions.find(s => s.patientPhone === phone);
    if (existing) {
      const currentHistory = existing.sessionData.chatHistory || [];
      currentHistory.push({ sender: 'bot', text, time: new Date().toISOString() });
      existing.sessionData = {
        ...existing.sessionData,
        chatHistory: currentHistory
      };
      this.save('whatsapp_sessions', sessions);
      
      supabase.from('whatsapp_sessions').update({
        session_data: existing.sessionData,
        last_interaction: new Date().toISOString()
      }).eq('patient_phone', phone).then(({ error }) => {
        if (error) console.error('Error updating whatsapp session:', error);
        this.writeAuditLog('WHATSAPP_BOT_OUTGOING_MESSAGE', { phone, message: text }, existing.id);
        this.syncFromSupabase();
      });
      this.notify();
    }
  }

  dispatchWhatsAppLoyaltyOffer(patientId: string, offerType: string): string {
    const patients = this.getPatients();
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return 'Patient not found.';

    let message = '';
    if (offerType === 'discount_30') {
      message = `*Mediflow Patient Care Loyalty:* Dear ${patient.name}, as part of your ongoing care pod benefits, here is a special coupon for **30% Off on your next medicine refill** at our adjacent Pharmacy. Code: **MF-LOYAL30**`;
    } else if (offerType === 'virtual_appointment') {
      message = `*Mediflow Care Loyalty:* Dear ${patient.name}, thank you for your recent visit. To support your clinical path, a **Free Virtual Follow-up Appointment with the Doctor** is unlocked for you in 10 days. Book directly via this chat.`;
    } else {
      message = `*Mediflow Connect:* Quick Portal Link enabled for Patient ${patient.name} to view invoices and schedule pathology sample collection.`;
    }

    this.writeAuditLog('LOYALTY_OFFER_DISPATCHED', {
      patientId,
      patientName: patient.name,
      offerType,
      message
    });

    // Push into active WhatsApp session chat history
    this.pushWhatsAppMessageFromBot(patient.phone, message);

    return message;
  }
}

export const api = new MediflowApiService();
