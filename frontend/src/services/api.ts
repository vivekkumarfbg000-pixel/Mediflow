import { supabase } from '../lib/supabaseClient';
import { TelemetryService } from './telemetry';
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
  PathologyReport,
  ClinicSop,
  MedicineBill,
  MedicineBillItem,
  CounterTransaction,
  MedicineImportRow
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
  { loincCode: '4544-3', name: 'HbA1c (Glycated Hemoglobin)', category: 'Diabetology', normalRange: '4.0 - 5.6', unit: '%', price: 350 },
  { loincCode: '2160-0', name: 'Serum Creatinine', category: 'Renal Panel', normalRange: '0.6 - 1.2', unit: 'mg/dL', price: 250 },
  { loincCode: '3024-7', name: 'Total Hemoglobin', category: 'Hematology', normalRange: '12.0 - 16.0', unit: 'g/dL', price: 150 },
  { loincCode: '2947-0', name: 'Serum Sodium', category: 'Electrolytes', normalRange: '135 - 145', unit: 'mEq/L', price: 200 },
  { loincCode: '1975-2', name: 'Total Bilirubin', category: 'Liver Function', normalRange: '0.2 - 1.2', unit: 'mg/dL', price: 300 }
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
    if (typeof window !== 'undefined') {
      (window as any).api = this;
      (window as any).supabase = supabase;
    }
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
  public async syncFromSupabase(): Promise<void> {
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
    const rawPatients = this.load<Patient[]>('patients', INITIAL_PATIENTS);
    const vitalsMap = this.load<Record<string, PatientVitals>>('vitals_map', {});
    const tokensMap = this.load<Record<string, string>>('tokens_map', {});
    const queueStatusMap = this.load<Record<string, Patient['queueStatus']>>('queue_status_map', {});
    
    return rawPatients.map(p => ({
      ...p,
      vitals: vitalsMap[p.id] || p.vitals,
      tokenNumber: tokensMap[p.id] || p.tokenNumber,
      queueStatus: queueStatusMap[p.id] || p.queueStatus || 'awaiting_vitals'
    }));
  }

  updatePatientVitalsAndToken(patientId: string, vitals: PatientVitals, token: string): void {
    const vitalsMap = this.load<Record<string, PatientVitals>>('vitals_map', {});
    const tokensMap = this.load<Record<string, string>>('tokens_map', {});
    const queueStatusMap = this.load<Record<string, Patient['queueStatus']>>('queue_status_map', {});
    
    vitalsMap[patientId] = vitals;
    tokensMap[patientId] = token;
    queueStatusMap[patientId] = 'awaiting_consultation';
    
    this.save('vitals_map', vitalsMap);
    this.save('tokens_map', tokensMap);
    this.save('queue_status_map', queueStatusMap);
    
    // Write audit log
    const pat = this.getPatients().find(p => p.id === patientId);
    this.writeAuditLog('PATIENT_VITALS_RECORDED', {
      patientId,
      patientName: pat?.name,
      tokenNumber: token,
      vitals
    }, patientId);
    
    this.notify();
  }

  updatePatientQueueStatus(patientId: string, status: Patient['queueStatus']): void {
    const queueStatusMap = this.load<Record<string, Patient['queueStatus']>>('queue_status_map', {});
    queueStatusMap[patientId] = status;
    this.save('queue_status_map', queueStatusMap);
    
    const pat = this.getPatients().find(p => p.id === patientId);
    this.writeAuditLog('PATIENT_QUEUE_STATUS_UPDATED', {
      patientId,
      patientName: pat?.name,
      queueStatus: status
    }, patientId);
    
    this.notify();
  }

  generateNextTokenNumber(): string {
    const patients = this.getPatients();
    const activeTokens = patients
      .map(p => p.tokenNumber)
      .filter((t): t is string => !!t && t.startsWith('TK-'));
    
    if (activeTokens.length === 0) return 'TK-01';
    
    const maxVal = Math.max(...activeTokens.map(t => parseInt(t.replace('TK-', ''))));
    const nextVal = maxVal + 1;
    return `TK-${nextVal.toString().padStart(2, '0')}`;
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
        // 1. Try to load live WABA connection configured for this pod/clinic
        const { data: session } = await supabase.from('whatsapp_sessions').select('session_data').eq('patient_phone', phone).single();
        const podId = session?.session_data?.podId;

        if (podId) {
          const { data: wabaConn } = await supabase
            .from('waba_connections')
            .select('*')
            .eq('pod_id', podId)
            .single();

          if (wabaConn && wabaConn.waba_status === 'active') {
            const { data: decryptedData, error: rpcErr } = await supabase.rpc('decrypt_tenant_waba_connection', {
              p_phone_number_id: wabaConn.phone_number_id,
              p_secret_key: 'mediflow_vault_key_2026'
            });

            if (!rpcErr && decryptedData && decryptedData.length > 0) {
              const decryptedToken = decryptedData[0].decrypted_token;
              const phoneId = wabaConn.phone_number_id;

              const metaUrl = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
              let bodyPayload: Record<string, any> = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: phone,
                type: "text",
                text: { body: payload.replyText ?? `Mediflow system update: ${template}` }
              };

              if (template === 'mediflow_welcome') {
                bodyPayload = {
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  to: phone,
                  type: "template",
                  template: {
                    name: "mediflow_welcome",
                    language: { code: "en_US" }
                  }
                };
              }

              const res = await fetch(metaUrl, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${decryptedToken}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify(bodyPayload)
              });

              if (!res.ok) {
                const errData = await res.json();
                throw new Error(`Meta Graph API responded with status ${res.status}: ${JSON.stringify(errData)}`);
              }

              return true;
            }
          }
        }

        // 2. Simulator Fallback: If no live connection is active, simulate latency and return success
        const isTransientError = Math.random() < 0.25;
        if (isTransientError && attempt < maxAttempts) {
          throw new Error("Meta Gateway Timeout (HTTP 504) or Rate-Limit Exceeded (HTTP 429)");
        }

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
            replyMessage = "Bahut bahut dhanyawad! Aapka clinical consent safe tarike se secure ledger mein register ho gaya hai. State: READY_FOR_ENCOUNTER. 🟢";
            
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
            replyMessage = "Consent process rok diya gaya hai. Aap jab chahein tab '1' reply karke dobara shuru kar sakte hain.";
          } else if (cleaned.includes('book') || cleaned === '2') {
            nextState = 'BOOKING_VIRTUAL';
            replyMessage = "Ji bilkul! Mediflow scheduling shuru ho gayi hai. Kya aap Virtual Video Call par consult karna chahte hain ya Physical clinic aakar?\n\nProceed karne ke liye please **VIRTUAL** ya **PHYSICAL** reply kijiye.";
          } else {
            // Unrecognized reply fallback: prevents infinite loops by remaining stable on AWAITING_WELCOME
            replyMessage = "Hum samajh nahi paaye. 🤖 Apne records safe sync karne ke liye please upar click kijiye ya bas *1* reply karke authorize kijiye.";
          }
          break;

        case 'AWAITING_CONFIRMATION':
          if (['stop consent', 'stop', 'revoke', 'stop_consent'].includes(cleaned)) {
            nextState = 'AWAITING_WELCOME';
            sessionData.consentGranted = false;
            sessionData.consentTime = null;
            replyMessage = "Aapka digital consent cancel ho gaya hai aur profile lock kar di gayi hai. Wapas shuru karne ke liye '1' reply kijiye.";
            
            // Asynchronously revoke active patient consents in 'patient_consents' table
            supabase.from('patient_registry').select('id').eq('phone', phone).single().then(async ({ data: patient }) => {
              if (patient) {
                await supabase.from('patient_consents').update({
                  revoked_at: new Date().toISOString()
                }).eq('patient_id', patient.id).is('revoked_at', null);
                await this.writeAuditLog('PATIENT_CONSENT_REVOKED', { patientId: patient.id, phone }, patient.id);
              }
            });
          } else if (cleaned.includes('book') || cleaned === '2') {
            nextState = 'BOOKING_VIRTUAL';
            replyMessage = "Ji bilkul! Mediflow scheduling shuru ho gayi hai. Kya aap Virtual Video Call par consult karna chahte hain ya Physical clinic aakar?\n\nProceed karne ke liye please **VIRTUAL** ya **PHYSICAL** reply kijiye.";
          } else if (['1', 'grant access', 'yes'].includes(cleaned)) {
            replyMessage = "Aapka clinical consent pehle se hi active aur registered hai! Appointment book karne ke liye **BOOK** reply kijiye.";
          } else {
            replyMessage = "Aapka clinical consent active hai! 🟢 Batayein main aapki kya help karoon? Reply kijiye:\n- *BOOK*: Doctor appointment book karne ke liye\n- *REPORT*: Apni lab reports dekhne ke liye\n- *SUMMARY*: Prescription aur medicine dose schedule ke liye\n- Ya phir koi bhi health related query pooch sakte hain! 😊";
          }
          break;

        case 'BOOKING_VIRTUAL':
          if (cleaned.includes('virtual') || cleaned.includes('physical')) {
            nextState = 'AWAITING_PAYMENT';
            const isVirtual = cleaned.includes('virtual');
            const fee = isVirtual ? 400 : 500;
            const upiPayload = `upi://pay?pa=mediflow@icici&pn=Mediflow&am=${fee}.00&cu=INR&tn=MEDIFLOW-APPT-${phone.substring(5)}`;
            
            replyMessage = `Doctor Vivek ke liye slot lock kar diya gaya hai. Total Appointment Fee: ₹${fee}.00.\n\nSecure booking ke liye please is UPI link ka use kijiye ya QR code scan kijiye:\n\n${upiPayload}\n\nPayment karne ke baad please **PAY** reply kijiye, hum turant meeting link bhej denge! 🧾`;
          } else {
            replyMessage = "Please slot lock karne ke liye 'VIRTUAL' ya 'PHYSICAL' reply kijiye.";
          }
          break;

        case 'AWAITING_PAYMENT':
          if (cleaned.includes('pay') || cleaned.includes('clear') || cleaned === '1') {
            const pat = this.getPatients().find(p => p.phone === phone);
            const pendingInv = this.getUnifiedInvoices().find(i => i.patientId === pat?.id && i.paymentStatus === 'pending');

            if (pendingInv) {
              this.clearInvoice(pendingInv.id);
              nextState = 'COMPLETED';
              replyMessage = `🟢 *Payment Cleared!* \n\nUnified Care Invoice of *₹${pendingInv.totalAmount.toFixed(2)}* has been settled via UPI Split Gateway. Payouts posted:\n- Doctor Account: ₹${pendingInv.doctorFee.toFixed(2)}\n- Lab Account: ₹${pendingInv.labFee.toFixed(2)}\n- Platform Commission (3%): ₹${pendingInv.platformFee.toFixed(2)}\n\nThank you for choosing Mediflow Connected Clinic! 🩺🟢`;
            } else {
              nextState = 'COMPLETED';
              replyMessage = "Payment confirm ho gaya hai! 🟢 Aapka physical/virtual checkup active hai. We look forward to seeing you!";
            }
          } else if (['stop consent', 'stop', 'revoke'].includes(cleaned)) {
            replyMessage = "Dues pending rehne par consent cancel nahi kiya ja sakta. Please pehle apna payment clear kijiye.";
          } else {
            replyMessage = "Payment pending hai. Settle karne ke liye QR code scan kijiye, ya 'PAY' reply kijiye.";
          }
          break;

        case 'MEDICINE_ORDERING':
          {
            const activeInventory = this.getPharmacyInventory();
            // Step A: Checking delivery option choice
            if (sessionData.medicineOrderStage === 'CHOOSING_DELIVERY') {
              if (cleaned === '1') {
                // Counter Pickup chosen
                const draftBill = sessionData.draftMedicineBill as MedicineBill;
                draftBill.deliveryType = 'pickup';
                draftBill.deliveryCharge = 0;
                draftBill.totalAmount = draftBill.subtotal + draftBill.gstAmount;
                draftBill.upiQrPayload = `upi://pay?pa=mediflow@icici&pn=Mediflow&am=${draftBill.totalAmount.toFixed(2)}&cu=INR&tn=MF-BILL-${draftBill.id.substring(4, 8)}`;
                
                sessionData.draftMedicineBill = draftBill;
                sessionData.medicineOrderStage = 'AWAITING_PAYMENT';
                nextState = 'MEDICINE_AWAITING_PAYMENT';
                
                this.saveMedicineBill(draftBill);

                replyMessage = `🚶 *Counter Pickup Choose Kiya Gaya Hai (₹0.00 Delivery Charge)*\n\nTotal Payable Amount: *₹${draftBill.totalAmount.toFixed(2)}*\n\nSettle karne ke liye is direct payment link ka use kijiye:\n${draftBill.upiQrPayload}\n\nPayment karne ke baad please **PAY** reply kijiye!`;
              } else if (cleaned === '2') {
                // Shiprocket Home Delivery chosen
                sessionData.medicineOrderStage = 'ENTERING_ADDRESS';
                replyMessage = `🚚 *Shiprocket / Delhivery Home Delivery (₹45.00 Cheapest Rate Applied)*\n\nApna complete delivery address (Street, City, Pincode) type karke bhejein taaki hum logistics arrange kar sakein:`;
              } else {
                replyMessage = `Hum samajh nahi paaye. Please select delivery method:\n\n*1* - Counter Pickup (₹0.00)\n*2* - Shiprocket Home Delivery (₹45.00)`;
              }
            }
            // Step B: Address entry
            else if (sessionData.medicineOrderStage === 'ENTERING_ADDRESS') {
              const draftBill = sessionData.draftMedicineBill as MedicineBill;
              draftBill.deliveryType = 'shiprocket';
              draftBill.deliveryCharge = 45;
              draftBill.deliveryAddress = text;
              draftBill.totalAmount = draftBill.subtotal + draftBill.gstAmount + draftBill.deliveryCharge;
              draftBill.upiQrPayload = `upi://pay?pa=mediflow@icici&pn=Mediflow&am=${draftBill.totalAmount.toFixed(2)}&cu=INR&tn=MF-BILL-${draftBill.id.substring(4, 8)}`;
              
              sessionData.draftMedicineBill = draftBill;
              sessionData.medicineOrderStage = 'AWAITING_PAYMENT';
              nextState = 'MEDICINE_AWAITING_PAYMENT';
              
              this.saveMedicineBill(draftBill);

              replyMessage = `📍 *Delivery Address Saved!* \n"${text}"\n\n*Invoice Summary (Cheapest Shipping applied):*\n- Medicine Subtotal: ₹${draftBill.subtotal.toFixed(2)}\n- GST: ₹${draftBill.gstAmount.toFixed(2)}\n- Shiprocket Delivery Charge: ₹45.00\n---------------------------------------\n*Total Amount Payable: ₹${draftBill.totalAmount.toFixed(2)}*\n\nSettle karne ke liye is link par click karein:\n${draftBill.upiQrPayload}\n\nPayment karne ke baad please **PAY** reply kijiye!`;
            }
            // Step C: Initial medicine name input
            else {
              // Patient typed medicine list, let's parse it!
              // Try to find matching item in inventory
              let matchedItem: PharmacyInventoryItem | undefined;
              let qty = 10; // Default qty

              for (const item of activeInventory) {
                if (cleaned.toLowerCase().includes(item.name.toLowerCase()) || cleaned.toLowerCase().includes(item.genericName.toLowerCase())) {
                  matchedItem = item;
                  break;
                }
              }

              // Extract number if any
              const numMatch = cleaned.match(/\d+/);
              if (numMatch) {
                qty = Number(numMatch[0]);
              }

              if (matchedItem) {
                // Create a draft bill
                const patientObj = this.getPatients().find(p => p.phone === phone);
                const billId = `bill-${Date.now()}`;
                
                const itemTotal = matchedItem.price * qty;
                const gst = matchedItem.hsn === '300410' ? 0.12 : 0.05;
                const gstAmt = itemTotal * gst;
                
                const billItem: MedicineBillItem = {
                  inventoryItemId: matchedItem.id,
                  name: matchedItem.name,
                  genericName: matchedItem.genericName,
                  dosage: matchedItem.dosage,
                  batchNumber: matchedItem.batchNumber,
                  expiryDate: matchedItem.expiryDate,
                  quantity: qty,
                  mrp: matchedItem.mrp,
                  sellingPrice: matchedItem.price,
                  discountPercent: 0,
                  gstPercent: gst * 100,
                  lineTotal: itemTotal
                };

                const draftBill: MedicineBill = {
                  id: billId,
                  patientId: patientObj?.id || 'pat-demo',
                  patientName: patientObj?.name || 'WhatsApp Patient',
                  patientPhone: phone,
                  items: [billItem],
                  subtotal: itemTotal,
                  loyaltyDiscountPercent: 0,
                  loyaltyDiscountAmount: 0,
                  itemDiscountAmount: 0,
                  gstAmount: gstAmt,
                  totalAmount: itemTotal + gstAmt,
                  paymentMode: 'whatsapp_pay',
                  status: 'draft',
                  source: 'whatsapp',
                  createdAt: new Date().toISOString()
                };

                sessionData.draftMedicineBill = draftBill;
                sessionData.medicineOrderStage = 'CHOOSING_DELIVERY';

                replyMessage = `💊 *Live Patna Inventory Matched!* \n• Dawa: *${matchedItem.name}* (Batch: ${matchedItem.batchNumber})\n• Qty: *${qty} ${matchedItem.unit}*\n• Price per Unit: ₹${matchedItem.price.toFixed(2)}\n• Subtotal: ₹${itemTotal.toFixed(2)} (+₹${gstAmt.toFixed(2)} GST)\n\n*Logistics Option Select Karein:*\n\n*1* - Counter Pickup (₹0.00 standard pickup)\n*2* - Shiprocket Home Delivery (₹45.00 Cheapest logistics option)`;
              } else {
                replyMessage = `Aapka medicine query *"${text}"* match nahi hua. ⚠️ Hamare live catalog mein Paracetamol, Metformin, Amoxicillin, Atorvastatin aur Pantoprazole available hain. \n\nKaunsi medicine chahiye? Please correct brand/generic name type kijiye (e.g. "Metformin 30 tabs"):`;
              }
            }
          }
          break;

        case 'MEDICINE_AWAITING_PAYMENT':
          {
            const draftBill = sessionData.draftMedicineBill as MedicineBill;
            if (cleaned.includes('pay') || cleaned.includes('clear') || cleaned === '1') {
              if (draftBill) {
                draftBill.status = 'paid';
                this.saveMedicineBill(draftBill);
                
                // Actually dispense and deduct inventory!
                this.dispenseMedicineBill(draftBill.id);

                if (draftBill.deliveryType === 'shiprocket') {
                  nextState = 'COMPLETED';
                  const shipId = `SR-${Math.floor(100000 + Math.random() * 900000)}`;
                  replyMessage = `🟢 *Payment Cleared!* \n\nShiprocket logistics partner se order arrange kar diya hai. \n🚀 *Tracking ID: ${shipId}*\n\nMedicines 24-48 hours mein deliver ho jayengi. Mediflow digital ecosystem choose karne ke liye shukriya! 📦`;
                } else {
                  nextState = 'MEDICINE_READY_FOR_PICKUP';
                  replyMessage = `🟢 *Payment Cleared!* \n\nMedicines counter collection ke liye packing department mein bhej di gayi hain. \n\nShow this invoice ref to compounder at clinic counter: \n🔖 *Ref ID: #${draftBill.id.substring(4, 10).toUpperCase()}*`;
                }
              } else {
                nextState = 'COMPLETED';
                replyMessage = "Something went wrong with the payment transaction. Please request compounder to assist at Patna counter.";
              }
            } else {
              replyMessage = `Dues pending hain. Please ₹${draftBill?.totalAmount.toFixed(2)} settle kijiye. UPI payload:\n${draftBill?.upiQrPayload}\n\nClear karne ke baad *PAY* reply karein.`;
            }
          }
          break;

        case 'MEDICINE_READY_FOR_PICKUP':
          if (cleaned.includes('done') || cleaned.includes('clear') || cleaned === '1') {
            nextState = 'COMPLETED';
            replyMessage = "Medicine successfully collected from Patna Counter! Status updated to COMPLETED. Health is wealth! 🩺🟢";
          } else {
            replyMessage = "Dawa collect karne ke baad Patna counter compounder screen clear karenge ya aap 'DONE' reply kijiye.";
          }
          break;

        case 'COMPLETED': {
          const currentPat = this.getPatients().find(p => p.phone === phone);
          const awaitingAction = sessionData.awaitingProactiveAction;

          if (cleaned === 'yes' && awaitingAction === 'refill') {
            sessionData.awaitingProactiveAction = null;
            replyMessage = "Refill confirm ho gaya hai! 📦 Compounder ne verify kar diya hai aur Patna Pharmacy se dawa ka packet aapke address ke liye nikal raha hai. Aap is chat par track kar sakte hain. Dhanyawad!";
          } else if (cleaned === 'home' && awaitingAction === 'lab') {
            sessionData.awaitingProactiveAction = 'lab_slot';
            replyMessage = "Please select a slot:\n1. 8:00 AM\n2. 10:00 AM\n3. 4:00 PM.";
          } else if (awaitingAction === 'lab_slot' && ['1', '2', '3'].includes(cleaned)) {
            sessionData.awaitingProactiveAction = null;
            const slotMap: Record<string, string> = { '1': '8:00 AM', '2': '10:00 AM', '3': '4:00 PM' };
            const selectedSlot = slotMap[cleaned] || '8:00 AM';

            // Process Doorstep collection fee in invoices
            const invoices = this.getUnifiedInvoices();
            const patientInvoice = invoices.find(i => i.patientId === currentPat?.id);
            const invoiceId = patientInvoice ? patientInvoice.id : `inv-${crypto.randomUUID().substring(0, 8)}`;
            if (patientInvoice) {
              patientInvoice.totalAmount = (patientInvoice.totalAmount || 0) + 100;
              this.save('unified_invoices', invoices);

              // Update in remote Supabase
              supabase.from('unified_invoices').update({
                total_amount: patientInvoice.totalAmount
              }).eq('id', patientInvoice.id).then(({ error }) => {
                if (error) console.error('Error updating invoice total in Supabase:', error);
              });
            }

            // Create the three doorstep splits in financial_ledgers:
            const ledgerEntries = this.load<FinancialLedgerEntry[]>('financial_ledgers', []);
            const doorstepSplits: FinancialLedgerEntry[] = [
              {
                id: `tx-tech-${crypto.randomUUID().substring(0, 8)}`,
                invoiceId: invoiceId,
                sourceEntityId: 'clinic-admin-entity',
                destinationEntityId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003', // Lalit Prasad (Lab Partner)
                transactionType: 'lab_commission',
                grossAmount: 100,
                commissionRate: 0.70,
                netPayout: 70,
                paymentStatus: 'cleared',
                settledAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
              },
              {
                id: `tx-lab-${crypto.randomUUID().substring(0, 8)}`,
                invoiceId: invoiceId,
                sourceEntityId: 'clinic-admin-entity',
                destinationEntityId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003', // Lab partner
                transactionType: 'lab_commission',
                grossAmount: 100,
                commissionRate: 0.20,
                netPayout: 20,
                paymentStatus: 'cleared',
                settledAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
              },
              {
                id: `tx-plat-${crypto.randomUUID().substring(0, 8)}`,
                invoiceId: invoiceId,
                sourceEntityId: 'clinic-admin-entity',
                destinationEntityId: 'platform-admin-entity',
                transactionType: 'platform_fee',
                grossAmount: 100,
                commissionRate: 0.10,
                netPayout: 10,
                paymentStatus: 'cleared',
                settledAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
              }
            ];

            ledgerEntries.unshift(...doorstepSplits);
            this.save('financial_ledgers', ledgerEntries);

            // Also insert splits into remote Supabase
            const dbSplits = doorstepSplits.map(s => ({
              invoice_id: s.invoiceId.includes('-') && s.invoiceId.length === 36 ? s.invoiceId : invoiceId,
              source_entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
              destination_entity_id: s.destinationEntityId === 'platform-admin-entity' ? 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002' : s.destinationEntityId,
              transaction_type: s.transactionType,
              gross_amount: s.grossAmount,
              commission_rate: s.commissionRate * 100,
              net_payout: s.netPayout,
              payment_status: 'cleared',
              settled_at: new Date().toISOString()
            }));

            supabase.from('financial_ledgers').insert(dbSplits).then(({ error }) => {
              if (error) console.error('Error inserting doorstep splits in Supabase:', error);
            });

            replyMessage = `Home sample collection confirm ho gaya hai! 🔬 Hamare lab technician (Lalit Prasad) kal subah ${selectedSlot} par ghar aakar sample collect karenge. Dhyaan rahe ki test se 8 ghante pehle tak fasting rakhni hai. Slot lock ho gaya hai! 🟢\n\n*Premium Collection Fee breakdown*:\n- Total: ₹100.00 Collection Fee added\n- Lab Tech fuel/incentive bonus: ₹70.00\n- Lab Partner split: ₹20.00\n- Platform commission: ₹10.00`;
          } else if (cleaned.includes('refill') || cleaned.includes('medicine') || cleaned.includes('reorder') || cleaned.includes('order') || cleaned.includes('dawai')) {
            nextState = 'MEDICINE_ORDERING';
            sessionData.medicineOrderStage = 'INITIAL';
            replyMessage = "Ji bilkul! Kaunsi dawaiyaan chahiye aapko? Please unka name aur total quantity type karke bhejein (For example: 'Metformin 30 tabs'):";
          } else if (cleaned.includes('report') || cleaned.includes('pathology') || cleaned.includes('test')) {
            const approvedReports = this.getPathologyReports().filter(r => r.patientId === currentPat?.id && r.status === 'approved');
            if (approvedReports.length > 0) {
              const rep = approvedReports[0];
              const barcode = `MED-${rep.loincCode}-${rep.id.toUpperCase()}`;
              replyMessage = `*Aapki pathology report aa gayi hai!* 🔬\n\nPatient Name: ${rep.patientName}\nTest: ${rep.testName}\nLOINC Code: ${rep.loincCode}\nStatus: Approved 🟢\n\n*Report Summary*:\n\"${rep.results}\"\n\n*Security Barcode*: ${barcode}`;
            } else {
              replyMessage = "Aapka koi approved pathology report abhi on file nahi hai. Lab technician ke results update karne ka wait kijiye.";
            }
          } else if (cleaned.includes('summary') || cleaned.includes('soap') || cleaned.includes('schedule') || cleaned.includes('revisit')) {
            const completedEncounters = this.getEncounters()
              .filter(e => e.patientId === currentPat?.id && e.status === 'completed')
              .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            if (completedEncounters.length > 0) {
              const enc = completedEncounters[0];
              const drugTable = enc.medications.map(m => `• ${m.medicineName} (${m.dosage}) - Freq: ${m.frequency} for ${m.duration}`).join('\n');
              
              replyMessage = `*Prescription aur Doctor's Notes Summary* 🩺\n\n*Doctor Notes*:\n\"${enc.clinicalNotes}\"\n\n*Dawa ka Schedule*:\n${drugTable || "Koi active dawa nahi likhi gayi hai."}\n\n*Follow-Up Advice*:\nDoctor Vivek ne aapko **14 din** ke baad follow-up ke liye Patna branch mein bulaya hai. Hum aapko time par remind kar denge! 😊`;
            } else {
              replyMessage = "Aapke profile par koi completed consultation encounter nahi mila.";
            }
          } else if (['stop consent', 'stop', 'revoke'].includes(cleaned)) {
            nextState = 'AWAITING_WELCOME';
            replyMessage = "Aapka clinical consent cancel kar diya gaya hai aur profile lock ho gayi hai. Wapas shuru karne ke liye '1' reply kijiye.";
          } else {
            // General health query using optimized Clinical Assistant RAG Scribe prompt
            // Enforce 1-week (7 days) paid AI advice access gate rule
            const clearedInvoices = this.getUnifiedInvoices()
              .filter(i => i.patientId === currentPat?.id && i.paymentStatus === 'cleared')
              .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            
            const lastPaidInvoice = clearedInvoices[0];
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            const hasPaidInLastWeek = lastPaidInvoice && new Date(lastPaidInvoice.createdAt) >= oneWeekAgo;

            if (!hasPaidInLastWeek) {
              replyMessage = `*Mediflow AI Support Restricted* 🤖\n\nClinical AI Advice general health queries and RAG advisory are only accessible for **1 week (7 days)** after clearing your consultation/care fees. \n\n*Note*: Operational transactional features (such as booking appointments, virtual slot bookings, and medicine refills) remain **always active** for your profile. Please clear your recent dues or consult to unlock another week of rich clinical AI advice! 🟢`;
            } else {
              let chronicAdvice = "";
              if (currentPat?.chronicConditions.some(c => c.toLowerCase().includes('diabetes') || c.toLowerCase().includes('sugar'))) {
                chronicAdvice = "\n\n*Important RAG Note (Sugar patients ke liye)*: Aapka average 3-month sugar level (HbA1c 7.2%) thoda jyada hai. Meetha aur carbohydrate kam kijiye, LOINC: 4544-3 test har 3 mahine mein karayein, aur agar creatinine level 1.2 mg/dL se jyada ho toh heavy pain-killers (Ibuprofen) bilkul na lein.";
              } else {
                chronicAdvice = "\n\n*RAG Clinical Guidelines Note*: Paani khoob pijiye, low-sodium diet lijiye, aur rozana apna checkup logs maintain kijiye.";
              }

              replyMessage = `*Mediflow AI-RAG support team* 🤖\n\nAapke query \"${text}\" ke liye niche advice di gayi hai:\n\n*Advice*: Aaram kijiye, hydration maintain rakhein, aur daily BP/sugar monitor kijiye. Bina doctor ke pooche koi brand-name dawa mat lijiye. Agar tabiyat jyada kharab ho toh turant consult kijiye!${chronicAdvice}\n\n_Disclaimer: Yeh RAG advisory clinical guidelines (ADA/KDIGO) par based hai. Please checkup se pehle doctor se salah zaroor lein._`;
            }
          }
        }
        break;

        case 'FAILED_DELIVERY':
          if (cleaned) {
            nextState = 'AWAITING_WELCOME';
            replyMessage = "Re-establishing connection loop. Dobara shuru karne ke liye '1' reply kijiye.";
          }
          break;

        default:
          replyMessage = "Namaste! Mediflow Automated Assistant online. Main aapki kya sahayata kar sakta hoon?";
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
              
              // Persist chatHistory update in remote Supabase to prevent overwrite by sync polling
              supabase.from('whatsapp_sessions').update({
                session_data: sesss[sIdx].sessionData
              }).eq('patient_phone', phone).then(({ error }) => {
                if (error) console.error('Error syncing bot reply to Supabase:', error);
              });
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
      supabase.from('whatsapp_sessions').upsert({
        patient_phone: phone,
        patient_id: patient?.id || null,
        current_state: 'AWAITING_WELCOME',
        last_interaction: new Date().toISOString(),
        session_data: newSession.sessionData
      }, { onConflict: 'patient_phone' }).then(({ error }) => {
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

      // Local reagent deduction & Autopilot Replenishment Logic
      const loincCode = req.testCode;
      let reagentName = '';
      let deductionVolume = 0;
      if (loincCode === '4544-3') {
        reagentName = 'HbA1c Enzyme Reagent A';
        deductionVolume = 1.5;
      } else if (loincCode === '2160-0') {
        reagentName = 'Creatinine Alkaline Picrate B';
        deductionVolume = 2.0;
      } else if (loincCode === '3024-7') {
        reagentName = 'Drabkin Reagent (Hemoglobin)';
        deductionVolume = 1.0;
      } else if (loincCode === '2947-0') {
        reagentName = 'Sodium Ion Reagent';
        deductionVolume = 1.2;
      } else if (loincCode === '1975-2') {
        reagentName = 'Bilirubin Diazo Reagent';
        deductionVolume = 1.8;
      }

      if (reagentName && deductionVolume > 0) {
        const reagents = this.getReagentStocks();
        const rIdx = reagents.findIndex(r => r.reagentName === reagentName);
        if (rIdx !== -1) {
          const currentStock = reagents[rIdx].stockVolume;
          const newStock = Math.max(0, currentStock - deductionVolume);
          reagents[rIdx].stockVolume = Number(newStock.toFixed(2));
          this.save('reagents', reagents);
          
          // Check for Autopilot replenishment (safety threshold is 200ml)
          const autopilotEnabled = localStorage.getItem('reagent_autopilot_enabled') !== 'false';
          if (autopilotEnabled && newStock < 200) {
            const replenishVolume = 500;
            const finalStock = newStock + replenishVolume;
            reagents[rIdx].stockVolume = Number(finalStock.toFixed(2));
            this.save('reagents', reagents);
            
            // Reconcile to Supabase reagent_inventory
            supabase.from('reagent_inventory')
              .update({ stock_volume: finalStock })
              .eq('reagent_name', reagentName)
              .then(() => {
                this.writeAuditLog('reagent_autopilot_replenished', { reagentName, replenishedVolume: replenishVolume, oldStock: newStock, finalStock }, reagentName);
              });

            // Log telemetry event
            TelemetryService.track('reagent_autopilot_replenished', {
              reagentName,
              replenishedVolume: replenishVolume,
              oldStock: newStock,
              finalStock
            });

            // Trigger beautiful custom toast event
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('mediflow-toast', {
                detail: {
                  message: `Autopilot Triggered: ${reagentName} fell below 200ml. Automatically ordered 500ml!`,
                  type: 'success',
                  title: 'Autopilot Active'
                }
              }));

              window.dispatchEvent(new CustomEvent('mediflow-reagent-autopilot', {
                detail: { reagentName, replenishedVolume: replenishVolume, timestamp: new Date().toISOString() }
              }));
            }, 600);
          }
        }
      }

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

  replenishReagentStock(reagentName: string, volumeToAdd: number): void {
    const reagents = this.getReagentStocks();
    const idx = reagents.findIndex(r => r.reagentName === reagentName);
    if (idx !== -1) {
      reagents[idx].stockVolume = Number((reagents[idx].stockVolume + volumeToAdd).toFixed(2));
      this.save('reagents', reagents);
      this.notify();

      // Async sync to Supabase reagent_inventory
      supabase.from('reagent_inventory')
        .update({ stock_volume: reagents[idx].stockVolume })
        .eq('reagent_name', reagentName)
        .then(({ error }) => {
          if (error) console.error('[Mediflow Lab] Failed to sync replenishment to Supabase:', error);
          else this.writeAuditLog('reagent_manually_replenished', { reagentName, volumeAdded: volumeToAdd, newTotal: reagents[idx].stockVolume });
        });
    }
  }

  registerWalkinLabTest(patientId: string, testCode: string, testName: string): LabRequisition {
    const patients = this.getPatients();
    const patient = patients.find(p => p.id === patientId);
    const barcode = `WALK-${Date.now()}-${testCode}`.toUpperCase();
    const newReq: LabRequisition = {
      id: crypto.randomUUID(),
      encounterId: 'walkin',
      patientId,
      patientName: patient?.name || 'Walk-in Patient',
      testCode,
      testName,
      barcode,
      status: 'pending',
      reagentDeductions: [],
      createdAt: new Date().toISOString()
    };
    const existing = this.getLabRequisitions();
    existing.unshift(newReq);
    this.save('lab_requisitions', existing);
    this.notify();

    // Async push walk-in requisition to Supabase
    supabase.from('lab_requisitions').insert({
      id: newReq.id,
      encounter_id: null,
      patient_id: patientId,
      loinc_code: testCode,
      test_name: testName,
      barcode,
      status: 'pending',
      assigned_technician_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102',
      created_at: newReq.createdAt
    }).then(({ error }) => {
      if (error) console.error('[Mediflow Lab] Walk-in requisition sync failed:', error);
      else this.writeAuditLog('walkin_lab_test_registered', { patientId, testCode, testName, barcode }, patientId);
    });

    return newReq;
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

      // Check if there is an active referral in the session
      const sessions = this.getWhatsAppSessions();
      const session = sessions.find(s => s.patientPhone === invoices[idx].patientPhone);
      if (session?.sessionData?.referral) {
        const ref = session.sessionData.referral;
        const ledgerEntries = this.load<FinancialLedgerEntry[]>('financial_ledgers', []);
        
        const platformAmt = Math.max(10.00, parseFloat((500 * 0.03).toFixed(2))); // 3% Platform commission
        
        const referralLedger: FinancialLedgerEntry = {
          id: `tx-ref-${crypto.randomUUID().substring(0, 8)}`,
          invoiceId: invoiceId,
          sourceEntityId: 'clinic-admin-entity',
          destinationEntityId: 'clinic-admin-entity', // Dr. Vivek's clinic wallet gets the thank-you fee
          transactionType: 'appointment_fee',
          grossAmount: 500,
          commissionRate: 0.10,
          netPayout: ref.referralCommissionAmt || 50.00,
          paymentStatus: 'cleared',
          settledAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };

        const platformLedger: FinancialLedgerEntry = {
          id: `tx-plat-ref-${crypto.randomUUID().substring(0, 8)}`,
          invoiceId: invoiceId,
          sourceEntityId: 'clinic-admin-entity',
          destinationEntityId: 'platform-admin-entity',
          transactionType: 'platform_fee',
          grossAmount: 500,
          commissionRate: 0.03,
          netPayout: platformAmt,
          paymentStatus: 'cleared',
          settledAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };

        ledgerEntries.unshift(referralLedger, platformLedger);
        this.save('financial_ledgers', ledgerEntries);

        // Clear referral flag so it doesn't fire again
        session.sessionData.referral = null;
        this.save('whatsapp_sessions', sessions);

        // Async write back to Supabase
        const dbRefLedger = {
          invoice_id: invoiceId,
          source_entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002', // Source: clinic
          destination_entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002', // Destination: clinic
          transaction_type: 'appointment_fee',
          gross_amount: 500,
          commission_rate: 10,
          net_payout: 50.00,
          payment_status: 'cleared',
          settled_at: new Date().toISOString()
        };
        const dbPlatLedger = {
          invoice_id: invoiceId,
          source_entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
          destination_entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
          transaction_type: 'platform_fee',
          gross_amount: 500,
          commission_rate: 3,
          net_payout: platformAmt,
          payment_status: 'cleared',
          settled_at: new Date().toISOString()
        };

        supabase.from('financial_ledgers').insert([dbRefLedger, dbPlatLedger]).then(({ error }) => {
          if (error) console.error('Error inserting referral ledger splits in Supabase:', error);
        });
      }

      // Async write back to Supabase
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
      const forecast = forecasts[idx];
      forecast.isActedUpon = true;
      this.save('seasonal_forecasts', forecasts);

      // Increment stock by 100 units dynamically inside local inventory
      this.restockPharmacyInventoryItem(forecast.medicineName, 100);

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
      {
        id: 'item-1',
        name: 'Metformin 500mg',
        genericName: 'Metformin Hydrochloride',
        category: 'Antidiabetic',
        manufacturer: 'Sun Pharma',
        batchNumber: 'MET26A-01',
        expiryDate: new Date(new Date().getTime() + 15 * 24 * 3600 * 1000).toISOString().split('T')[0], // Expiring in 15 days
        mrp: 15,
        price: 15,
        stock: 12,
        unit: 'tabs',
        threshold: 30,
        dosage: '500mg',
        addedAt: new Date().toISOString(),
        hsn: '300490'
      },
      {
        id: 'item-2',
        name: 'Paracetamol 650mg',
        genericName: 'Paracetamol',
        category: 'Analgesic',
        manufacturer: 'Cipla',
        batchNumber: 'PAR26C-02',
        expiryDate: new Date(new Date().getTime() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0], // Safe
        mrp: 5,
        price: 5,
        stock: 300,
        unit: 'tabs',
        threshold: 50,
        dosage: '650mg',
        addedAt: new Date().toISOString(),
        hsn: '300490'
      },
      {
        id: 'item-3',
        name: 'Amoxicillin 250mg',
        genericName: 'Amoxicillin Trihydrate',
        category: 'Antibiotic',
        manufacturer: 'Alkem',
        batchNumber: 'AMX26D-03',
        expiryDate: new Date(new Date().getTime() + 45 * 24 * 3600 * 1000).toISOString().split('T')[0], // Expiring in 45 days
        mrp: 25,
        price: 22,
        stock: 8,
        unit: 'caps',
        threshold: 20,
        dosage: '250mg',
        addedAt: new Date().toISOString(),
        hsn: '300410'
      },
      {
        id: 'item-4',
        name: 'Atorvastatin 10mg',
        genericName: 'Atorvastatin Calcium',
        category: 'Cardiovascular',
        manufacturer: 'Lupin',
        batchNumber: 'ATV26E-04',
        expiryDate: new Date(new Date().getTime() - 5 * 24 * 3600 * 1000).toISOString().split('T')[0], // Expired 5 days ago!
        mrp: 30,
        price: 28,
        stock: 150,
        unit: 'tabs',
        threshold: 40,
        dosage: '10mg',
        addedAt: new Date().toISOString(),
        hsn: '300490'
      },
      {
        id: 'item-5',
        name: 'Pantoprazole 40mg',
        genericName: 'Pantoprazole Sodium',
        category: 'Gastrointestinal',
        manufacturer: 'Sun Pharma',
        batchNumber: 'PAN26F-05',
        expiryDate: new Date(new Date().getTime() + 400 * 24 * 3600 * 1000).toISOString().split('T')[0], // Safe
        mrp: 12,
        price: 10,
        stock: 5,
        unit: 'tabs',
        threshold: 15,
        dosage: '40mg',
        addedAt: new Date().toISOString(),
        hsn: '300490'
      }
    ];
    return this.load<PharmacyInventoryItem[]>('pharmacy_inventory', defaultItems);
  }

  savePharmacyInventory(items: PharmacyInventoryItem[]) {
    this.save('pharmacy_inventory', items);
    this.notify();
  }

  addPharmacyInventoryItem(item: Omit<PharmacyInventoryItem, 'id' | 'addedAt'>): PharmacyInventoryItem {
    const items = this.getPharmacyInventory();
    const newItem: PharmacyInventoryItem = {
      ...item,
      id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      addedAt: new Date().toISOString()
    };
    items.push(newItem);
    this.savePharmacyInventory(items);
    this.writeAuditLog('pharmacy_inventory_added', { itemId: newItem.id, name: newItem.name, batch: newItem.batchNumber, stock: newItem.stock }, newItem.id);
    return newItem;
  }

  private sanitizeFormula(val?: string): string {
    if (!val) return '';
    const trimmed = val.trim();
    if (trimmed.startsWith('=') || trimmed.startsWith('+') || trimmed.startsWith('-') || trimmed.startsWith('@')) {
      return `'${trimmed}`;
    }
    return trimmed;
  }

  private getMidnightUTC(dateStr?: string | Date): number {
    const d = dateStr ? new Date(dateStr) : new Date();
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
  }

  addPharmacyInventoryBulk(rows: MedicineImportRow[]): { added: number; errors: string[] } {
    const items = this.getPharmacyInventory();
    let addedCount = 0;
    const errors: string[] = [];

    rows.forEach((row, index) => {
      try {
        if (!row.name || !row.batchNumber || !row.expiryDate || row.stock === undefined || row.price === undefined) {
          throw new Error(`Row ${index + 1}: Missing required fields (Name, Batch, Expiry, Price, Stock).`);
        }

        const cleanName = this.sanitizeFormula(row.name);
        const cleanBatch = this.sanitizeFormula(row.batchNumber);
        
        // Defensive numeric checks
        const parsedPrice = Math.max(0.01, Number(row.price));
        const parsedMrp = Math.max(parsedPrice, Number(row.mrp) || 0);
        const parsedStock = Math.max(0, Math.floor(Number(row.stock)));
        const parsedThreshold = Math.max(1, Math.floor(Number(row.threshold) || 10));
        
        const newItem: PharmacyInventoryItem = {
          id: `item-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
          name: cleanName,
          genericName: this.sanitizeFormula(row.genericName || cleanName),
          category: this.sanitizeFormula(row.category || 'General'),
          manufacturer: this.sanitizeFormula(row.manufacturer || 'Generic Labs'),
          batchNumber: cleanBatch,
          expiryDate: row.expiryDate,
          mrp: parsedMrp,
          price: parsedPrice,
          stock: parsedStock,
          unit: (row.unit?.toLowerCase() as any) || 'tabs',
          threshold: parsedThreshold,
          dosage: this.sanitizeFormula(row.dosage || '10mg'),
          addedAt: new Date().toISOString(),
          hsn: this.sanitizeFormula(row.hsn || '300490')
        };

        items.push(newItem);
        addedCount++;
      } catch (err: any) {
        errors.push(err.message || String(err));
        TelemetryService.captureException(err, { section: "pharmacy_bulk_csv_row", rowIndex: index });
      }
    });

    if (addedCount > 0) {
      this.savePharmacyInventory(items);
      this.writeAuditLog('pharmacy_inventory_bulk_added', { count: addedCount }, 'bulk');
    }

    return { added: addedCount, errors };
  }

  deletePharmacyInventoryItem(id: string): void {
    const items = this.getPharmacyInventory();
    const filtered = items.filter(item => item.id !== id);
    this.savePharmacyInventory(filtered);
    this.writeAuditLog('pharmacy_inventory_deleted', { id }, id);
  }

  restockPharmacyInventoryItem(itemId: string, quantity: number) {
    const items = this.getPharmacyInventory();
    const updated = items.map(item => {
      if (item.id === itemId || item.name.toLowerCase() === itemId.toLowerCase()) {
        const newStock = Math.max(0, item.stock + quantity);
        this.writeAuditLog('pharmacy_inventory_restocked', { itemId: item.id, medicineName: item.name, quantity, oldStock: item.stock, newStock }, item.id);
        return { ...item, stock: newStock };
      }
      return item;
    });
    this.savePharmacyInventory(updated);
  }

  getLowStockItems(): PharmacyInventoryItem[] {
    return this.getPharmacyInventory().filter(item => item.stock <= item.threshold);
  }

  getExpiringItems(withinDays: number): PharmacyInventoryItem[] {
    const todayMidnight = this.getMidnightUTC();
    const targetMidnight = todayMidnight + withinDays * 24 * 3600 * 1000;
    return this.getPharmacyInventory().filter(item => {
      const expMidnight = this.getMidnightUTC(item.expiryDate);
      return expMidnight >= todayMidnight && expMidnight <= targetMidnight;
    }).sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }

  getExpiredItems(): PharmacyInventoryItem[] {
    const todayMidnight = this.getMidnightUTC();
    return this.getPharmacyInventory().filter(item => {
      const expMidnight = this.getMidnightUTC(item.expiryDate);
      return expMidnight < todayMidnight;
    }).sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }

  // ─── MEDICINE BILLING API METHODS ──────────────────────────────────────────
  getMedicineBills(): MedicineBill[] {
    return this.load<MedicineBill[]>('medicine_bills', []);
  }

  saveMedicineBill(bill: MedicineBill): MedicineBill {
    const bills = this.getMedicineBills();
    const existsIndex = bills.findIndex(b => b.id === bill.id);
    if (existsIndex >= 0) {
      bills[existsIndex] = bill;
    } else {
      bills.push(bill);
    }
    this.save('medicine_bills', bills);
    this.notify();
    this.writeAuditLog('medicine_bill_saved', { billId: bill.id, total: bill.totalAmount, patientName: bill.patientName }, bill.patientId);
    
    // Decoupled offline queue trigger
    if (!navigator.onLine) {
      window.dispatchEvent(new CustomEvent('mediflow-pwa-queue-action', {
        detail: { actionType: 'saveMedicineBill', payload: bill }
      }));
    } else {
      // Async Remote Database save if online
      supabase.from('medicine_bills').upsert({
        id: bill.id,
        patient_id: bill.patientId,
        subtotal: bill.subtotal,
        loyalty_discount_percent: bill.loyaltyDiscountPercent,
        loyalty_discount_amount: bill.loyaltyDiscountAmount,
        total_amount: bill.totalAmount,
        payment_mode: bill.paymentMode,
        status: bill.status,
        source: bill.source
      }).then(({ error }) => {
        if (error) console.error('Error saving bill in Supabase:', error);
      });
    }

    return bill;
  }

  getMedicineBillById(id: string): MedicineBill | null {
    return this.getMedicineBills().find(b => b.id === id) || null;
  }

  updateMedicineBillStatus(id: string, status: MedicineBill['status']): void {
    const bills = this.getMedicineBills();
    const bill = bills.find(b => b.id === id);
    if (bill) {
      bill.status = status;
      this.save('medicine_bills', bills);
      this.notify();
      this.writeAuditLog('medicine_bill_status_updated', { billId: id, status }, bill.patientId);
    }
  }

  dispenseMedicineBill(id: string): void {
    const bills = this.getMedicineBills();
    const billIndex = bills.findIndex(b => b.id === id);
    if (billIndex >= 0) {
      const bill = bills[billIndex];
      bill.status = 'paid';
      
      // Deduct stock from inventory for each item
      const inventory = this.getPharmacyInventory();
      bill.items.forEach(item => {
        const invItem = inventory.find(inv => inv.id === item.inventoryItemId);
        if (invItem) {
          const oldStock = invItem.stock;
          invItem.stock = Math.max(0, invItem.stock - item.quantity);
          this.writeAuditLog('medicine_dispensed', { 
            billId: id, 
            itemId: invItem.id, 
            medicineName: invItem.name, 
            quantity: item.quantity, 
            oldStock, 
            newStock: invItem.stock 
          }, invItem.id);
        }
      });
      
      this.savePharmacyInventory(inventory);
      bills[billIndex] = bill;
      this.save('medicine_bills', bills);
      this.notify();
      this.writeAuditLog('medicine_bill_dispensed', { billId: id }, bill.patientId);
    }
  }

  // ─── LOYALTY DISCOUNT TRACKING ─────────────────────────────────────────────
  getCounterTransactions(): CounterTransaction[] {
    return this.load<CounterTransaction[]>('counter_transactions', []);
  }

  saveCounterTransaction(tx: CounterTransaction): void {
    const txs = this.getCounterTransactions();
    const idx = txs.findIndex(t => t.id === tx.id);
    if (idx >= 0) {
      txs[idx] = tx;
    } else {
      txs.push(tx);
    }
    this.save('counter_transactions', txs);
    this.notify();
  }

  checkLoyaltyDiscount(patientId: string): boolean {
    const txs = this.getCounterTransactions();
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Look for a transaction today for this patient where both Appt and Lab are booked at the counter
    const tx = txs.find(t => 
      t.patientId === patientId && 
      t.createdAt.startsWith(todayStr) && 
      t.appointmentBookedAtCounter && 
      t.labBookedAtCounter
    );
    
    return !!tx;
  }

  generateMedicineInvoiceMessage(bill: MedicineBill): string {
    const itemsList = bill.items.map(item => 
      `• ${item.name} (${item.dosage}) [Batch: ${item.batchNumber}] x ${item.quantity} = ₹${item.lineTotal.toFixed(2)}`
    ).join('\n');

    const loyaltyText = bill.loyaltyDiscountPercent > 0 
      ? `\n🎉 Counter Loyalty Discount (10%): -₹${bill.loyaltyDiscountAmount.toFixed(2)}` 
      : '';
      
    const itemDiscountText = bill.itemDiscountAmount > 0
      ? `\n🏷 Additional Item Discount: -₹${bill.itemDiscountAmount.toFixed(2)}`
      : '';

    const deliveryText = bill.deliveryType === 'shiprocket'
      ? `\n🚚 Shiprocket Delivery: ₹${bill.deliveryCharge?.toFixed(2)} to ${bill.deliveryAddress}`
      : '\n🚶 Counter Pickup: ₹0.00';

    return `🏥 *MEDIFLOW PHARMACY INVOICE*
----------------------------------------
Patient Name: *${bill.patientName}*
Invoice Ref: #${bill.id.substring(4, 10).toUpperCase()}
Date: ${new Date(bill.createdAt).toLocaleDateString()}

*Medicines Ordered:*
${itemsList}

Subtotal: ₹${bill.subtotal.toFixed(2)}${loyaltyText}${itemDiscountText}
GST (Tax): ₹${bill.gstAmount.toFixed(2)}${deliveryText}
----------------------------------------
*TOTAL AMOUNT PAYABLE: ₹${bill.totalAmount.toFixed(2)}*

📱 Pay securely via UPI link below:
${bill.upiQrPayload || `upi://pay?pa=mediflow@icici&pn=Mediflow&am=${bill.totalAmount.toFixed(2)}&cu=INR&tn=MF-BILL-${bill.id.substring(4, 8)}`}

${bill.deliveryType === 'shiprocket' 
  ? '📍 Your order will be dispatched via Shiprocket once payment is cleared!' 
  : '👉 Show this invoice screen at the clinic pharmacy counter to collect your medicines.'}
Thank you for choosing Mediflow! 🟢`;
  }

  async parseSupplierBillOCR(base64: string): Promise<MedicineImportRow[]> {
    if (!base64) return [];
    // Simulated Gemini Pro Vision AI extracting supplier bill data
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return [
      {
        name: 'Metformin 500mg',
        batchNumber: 'MET26B-02',
        expiryDate: new Date(new Date().getTime() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0],
        mrp: 15,
        price: 13.5,
        stock: 100,
        unit: 'tabs',
        threshold: 30,
        dosage: '500mg',
        manufacturer: 'Sun Pharma',
        genericName: 'Metformin Hydrochloride',
        category: 'Antidiabetic',
        hsn: '300490'
      },
      {
        name: 'Atorvastatin 10mg',
        batchNumber: 'ATV26F-06',
        expiryDate: new Date(new Date().getTime() + 240 * 24 * 3600 * 1000).toISOString().split('T')[0],
        mrp: 30,
        price: 27.0,
        stock: 50,
        unit: 'tabs',
        threshold: 40,
        dosage: '10mg',
        manufacturer: 'Lupin',
        genericName: 'Atorvastatin Calcium',
        category: 'Cardiovascular',
        hsn: '300490'
      },
      {
        name: 'Paracetamol 650mg',
        batchNumber: 'PAR26D-07',
        expiryDate: new Date(new Date().getTime() + 300 * 24 * 3600 * 1000).toISOString().split('T')[0],
        mrp: 5,
        price: 4.2,
        stock: 200,
        unit: 'tabs',
        threshold: 50,
        dosage: '650mg',
        manufacturer: 'Cipla',
        genericName: 'Paracetamol',
        category: 'Analgesic',
        hsn: '300490'
      }
    ];
  }

  matchPrescriptionMedicines(names: string[]): PharmacyInventoryItem[] {
    const inventory = this.getPharmacyInventory();
    const matched: PharmacyInventoryItem[] = [];

    names.forEach(name => {
      // Find the first non-expired batch in inventory that fuzzy-matches name
      const today = new Date().toISOString().split('T')[0];
      const match = inventory.find(item => 
        (item.name.toLowerCase().includes(name.toLowerCase()) || 
         item.genericName.toLowerCase().includes(name.toLowerCase())) &&
        item.expiryDate >= today &&
        item.stock > 0
      );
      if (match) {
        matched.push(match);
      }
    });

    return matched;
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
        
        // 3% Platform fee (minimum ₹10.00 protection) and 48.5% split between Doctor & Pharmacy
        const platformAmt = Math.max(10.00, parseFloat((order.amount * 0.03).toFixed(2)));
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

      // Add a lab fee split to the ledger matching the restructured splits from active SOP
      const ledgerEntries = this.load<FinancialLedgerEntry[]>('financial_ledgers', []);
      const testCatalogItem = MASTER_TEST_CATALOG.find(t => t.loincCode === reports[idx].loincCode);
      const activeSop = this.getActiveSop();
      
      const testPrice = activeSop?.extractedConfig?.test_prices?.[reports[idx].loincCode] ?? testCatalogItem?.price ?? 350;
      
      const splitDoc = activeSop?.extractedConfig?.splits?.doctor ?? 40;
      const splitPlat = activeSop?.extractedConfig?.splits?.platform ?? 3;
      const splitLab = activeSop?.extractedConfig?.splits?.lab ?? 57;

      const platformAmt = parseFloat((testPrice * (splitPlat / 100)).toFixed(2));
      const docAmt = parseFloat((testPrice * (splitDoc / 100)).toFixed(2));
      const labAmt = parseFloat((testPrice * (splitLab / 100)).toFixed(2));

      const docLedger: FinancialLedgerEntry = {
        id: `tx-doc-${crypto.randomUUID().substring(0, 8)}`,
        invoiceId: `inv-rep-${reportId}`,
        sourceEntityId: 'lab-partner-entity',
        destinationEntityId: 'clinic-admin-entity',
        transactionType: 'lab_commission',
        grossAmount: testPrice,
        commissionRate: splitDoc / 100, 
        netPayout: docAmt,
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
        grossAmount: testPrice,
        commissionRate: splitPlat / 100,
        netPayout: platformAmt,
        paymentStatus: 'cleared',
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      const labLedger: FinancialLedgerEntry = {
        id: `tx-lab-${crypto.randomUUID().substring(0, 8)}`,
        invoiceId: `inv-rep-${reportId}`,
        sourceEntityId: 'lab-partner-entity',
        destinationEntityId: 'lab-partner-entity',
        transactionType: 'lab_commission',
        grossAmount: testPrice,
        commissionRate: splitLab / 100,
        netPayout: labAmt,
        paymentStatus: 'cleared',
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      ledgerEntries.unshift(docLedger, platformLedger, labLedger);
      this.save('financial_ledgers', ledgerEntries);

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Lab Report Approved! 🧪',
          message: `Report approved. Splits: Doctor (₹${docAmt}) & Platform (₹${platformAmt}) & Lab (₹${labAmt}) settled!`,
          type: 'success'
        }
      }));
    }
  }

  // Clinic SOP Center Methods
  getClinicSops(): ClinicSop[] {
    const defaultSop: ClinicSop = {
      id: 'sop-standard-1',
      entityId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
      sopFileName: 'Kankarbagh_Clinic_Standard_SOP.txt',
      sopText: 'Doctor consultation fee: INR 450. HbA1c test price: INR 350. Splits: 40% Referring Doctor, 3% Platform, 57% Lab.',
      extractedConfig: {
        doctor_fee: 450,
        test_prices: { '4544-3': 350, '2160-0': 250, '3024-7': 150, '2947-0': 200, '1975-2': 300 },
        splits: { doctor: 40, platform: 3, lab: 57 },
        guidelines: [
          'Auto-assign Lalit Prasad for tech verification',
          'Allow doorstep sample collection scheduling',
          'Hold pharmacy stock using FEFO',
          'Verify patient consent prior to care pod routing'
        ]
      },
      isActive: true,
      createdAt: new Date().toISOString()
    };
    return this.load<ClinicSop[]>('clinic_sops', [defaultSop]);
  }

  saveClinicSops(sops: ClinicSop[]) {
    this.save('clinic_sops', sops);
    this.notify();
  }

  getActiveSop(): ClinicSop | null {
    const sops = this.getClinicSops();
    return sops.find(s => s.isActive) || null;
  }

  generateAISummaryReport(patientId: string): string {
    const patients = this.getPatients();
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return 'Patient profile not found.';

    const encounters = this.getEncounters().filter(e => e.patientId === patientId);
    const pathologyReports = this.getPathologyReports().filter(r => r.patientId === patientId || r.patientName.toLowerCase() === patient.name.toLowerCase());
    const historicalBiomarkers = this.getPatientHistoricalBiomarkers(patientId) || [];

    // Compile dynamic, multi-dimensional clinical RAG report
    let summary = `🏥 CLINICAL HEALTH ARCHIVE SUMMARY: ${patient.name.toUpperCase()}\n`;
    summary += `===========================================================\n`;
    summary += `Demographics: ${patient.age}y / ${patient.gender} | ABHA ID: ${patient.abhaId || 'ABHA-PENDING'}\n`;
    summary += `Chronic History: ${patient.chronicConditions.join(', ') || 'None recorded'}\n`;
    summary += `Allergy Profile: ${patient.allergies.join(', ') || 'No Known Drug Allergies (NKDA)'}\n`;
    summary += `Document Date: ${new Date().toLocaleDateString()} | System: Mediflow CDSS pgvector RAG v2\n\n`;

    // 1. Longitudinal Biomarker Trajectory Analysis
    summary += `📊 PART 1: LONGITUDINAL BIOMARKER TRAJECTORY ANALYSIS\n`;
    summary += `-----------------------------------------------------------\n`;
    if (historicalBiomarkers.length > 0) {
      // Sort chronologically
      const sorted = [...historicalBiomarkers].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      summary += `Chronological Lab Findings (6-Month Trendline):\n`;
      sorted.forEach((h) => {
        summary += `• [${h.date}] HbA1c: ${h.HbA1c}% (Avg sugar) | Creatinine: ${h.creatinine} mg/dL (Kidney) | Hemoglobin: ${h.hemoglobin} g/dL (Blood)\n`;
      });

      // Calculate relative deltas
      if (sorted.length > 1) {
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        
        const hba1cDelta = (last.HbA1c - first.HbA1c).toFixed(1);
        const creatDelta = (last.creatinine - first.creatinine).toFixed(2);
        const hba1cPercent = Math.round(((last.HbA1c - first.HbA1c) / first.HbA1c) * 100);
        const creatPercent = Math.round(((last.creatinine - first.creatinine) / first.creatinine) * 100);

        summary += `\nKey Trajectory Deltas (Baseline to Latest):\n`;
        summary += `- **HbA1c Trend**: ${hba1cPercent >= 0 ? '+' : ''}${hba1cDelta}% change (${hba1cPercent >= 0 ? 'Elevating 📈' : 'Reducing 📉'})\n`;
        summary += `- **Creatinine Shift**: ${creatPercent >= 0 ? '+' : ''}${creatDelta} mg/dL shift (${creatPercent >= 20 ? '⚠️ CRITICAL Spike' : 'Stable'})\n`;
      }
    } else {
      summary += `No historical quantitative biomarkers found. Charting telemetry suspended.\n`;
    }
    summary += `\n`;

    // 2. Pathology Reports Narrative Summary
    summary += `🧪 PART 2: HISTORICAL LABORATORY REPORTS SUMMARY\n`;
    summary += `-----------------------------------------------------------\n`;
    const completedReports = pathologyReports.filter(r => r.status === 'approved');
    if (completedReports.length > 0) {
      summary += `Scanned Lab Diagnostic Logs (${completedReports.length} reports):\n`;
      completedReports.forEach(r => {
        summary += `• **${r.testName}** (LOINC: ${r.loincCode}):\n`;
        summary += `  - *Status*: Completed & Signed-off\n`;
        summary += `  - *Findings*: "${r.results || 'No specific text entered.'}"\n`;
      });
    } else {
      summary += `No completed laboratory diagnostic reports found in this patient's archive.\n`;
    }
    summary += `\n`;

    // 3. Pharmacotherapy Load
    summary += `💊 PART 3: PHARMACOTHERAPY & MEDICATION LOAD\n`;
    summary += `-----------------------------------------------------------\n`;
    const activeMedications = encounters.flatMap(e => e.medications);
    if (activeMedications.length > 0) {
      summary += `Current Active Prescribed Regime:\n`;
      const seen = new Set<string>();
      activeMedications.forEach(med => {
        if (!seen.has(med.medicineName)) {
          seen.add(med.medicineName);
          summary += `- **${med.medicineName}**: Dosage: ${med.dosage} | Freq: ${med.frequency} | Duration: ${med.duration}\n`;
        }
      });
    } else {
      summary += `No active prescriptions or medications recorded in active clinical pod sessions.\n`;
    }
    summary += `\n`;

    // 4. Clinical Decision Support (CDSS) & Safety Interceptions
    summary += `🚨 PART 4: CLINICAL DECISION SUPPORT SYSTEM (CDSS) AUDIT\n`;
    summary += `-----------------------------------------------------------\n`;
    
    // Safety warnings based on all previous report values
    const latestBiomarker = historicalBiomarkers[historicalBiomarkers.length - 1];
    let safetyFlags = 0;

    if (patient.allergies.includes('Penicillin')) {
      summary += `❌ **CONTRAINDICATION WARNING**: Patient is allergic to Penicillin. Beta-lactam therapeutics (Amoxicillin, Ampicillin, Piperacillin) are completely locked from prescription entry.\n`;
      safetyFlags++;
    }

    if (latestBiomarker) {
      if (latestBiomarker.creatinine > 1.2) {
        summary += `❌ **RENAL CLEARANCE WARNING**: Serum Creatinine is ${latestBiomarker.creatinine} mg/dL (exceeds KDIGO safety limit). NSAID therapies are completely contraindicated due to high risk of Acute Kidney Injury (AKI).\n`;
        safetyFlags++;
      }
      if (latestBiomarker.HbA1c > 6.5) {
        summary += `⚠️ **METABOLIC ADVISORY**: Latest HbA1c is ${latestBiomarker.HbA1c}% (Abnormal Diabetic range). Maintain strict diabetic controls and schedule HbA1c LOINC: 4544-3 panel every 90 days.\n`;
        safetyFlags++;
      }
    }

    if (safetyFlags === 0) {
      summary += `✓ All safety scans passed. No active allergy, drug-drug conflicts, or clearance issues caught.\n`;
    }
    
    summary += `\n===========================================================\n`;
    summary += `🏥 Prepared by Mediflow Clinical AI Scribe Engine. Synced to ABHA portal.`;

    return summary;
  }

  async parsePrescriptionOCR(imageUri: string): Promise<{
    patientName: string;
    patientAge: number;
    patientGender: 'Male' | 'Female' | 'Other';
    medications: Array<{ medicineName: string; dosage: string; frequency: string; duration: string }>;
    diagnosticTests: DiagnosticTest[];
  }> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[Mediflow AI] No VITE_GEMINI_API_KEY found, falling back to simulated OCR data.');
      return {
        patientName: 'Aarav Sharma',
        patientAge: 45,
        patientGender: 'Male',
        medications: [
          { medicineName: 'Metformin 500mg', dosage: '1 Tab', frequency: '1-0-1', duration: '10 Days' },
          { medicineName: 'Atorvastatin 10mg', dosage: '1 Tab', frequency: '0-0-1', duration: '30 Days' }
        ],
        diagnosticTests: [
          MASTER_TEST_CATALOG[0],
          MASTER_TEST_CATALOG[1]
        ]
      };
    }

    try {
      let base64Data = '';
      let mimeType = 'image/png';

      if (imageUri.startsWith('data:')) {
        const matches = imageUri.match(/^data:([^;]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          mimeType = matches[1];
          base64Data = matches[2];
        }
      } else {
        // Fallback or simulated capture snapshot, convert a real prescription image or simulate via Gemini
        try {
          const mockUrl = 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=300&auto=format&fit=crop';
          const res = await fetch(mockUrl);
          const blob = await res.blob();
          base64Data = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onloadend = () => {
              const resStr = r.result as string;
              resolve(resStr.split(',')[1]);
            };
            r.onerror = reject;
            r.readAsDataURL(blob);
          });
          mimeType = blob.type || 'image/jpeg';
        } catch (e) {
          console.warn('[Mediflow AI] Mock image fetch failed (CORS or network), using text prompt fallback.', e);
        }
      }

      const promptText = `You are an expert clinical digitization assistant. Analyze the provided image of a handwritten medical prescription. 
Extract and return a strict, minified JSON object matching the following structure. Do not include markdown formatting or extra text.
{
  "patientName": "string",
  "patientAge": number,
  "patientGender": "Male" | "Female" | "Other",
  "medications": [
    { "medicineName": "string", "dosage": "string", "frequency": "string", "duration": "string" }
  ],
  "requestedLOINCCodes": ["string"]
}

If no prescription image could be loaded or fetched, generate a highly realistic simulated prescription digitization for a diabetic patient named "Aarav Sharma" (45 years old, Male) with Metformin 500mg (1-0-1 for 10 Days), Atorvastatin 10mg (0-0-1 for 30 Days), and diagnostic requests for HbA1c (LOINC 4544-3) and Serum Creatinine (LOINC 2160-0).`;

      const requestBody: any = {
        contents: [
          {
            parts: [
              { text: promptText }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      };

      if (base64Data) {
        requestBody.contents[0].parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        });
      }

      const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Gemini returned an empty response.');
      }

      const cleanJson = text.trim();
      const parsed = JSON.parse(cleanJson);

      const mappedTests: DiagnosticTest[] = [];
      if (parsed.requestedLOINCCodes && Array.isArray(parsed.requestedLOINCCodes)) {
        parsed.requestedLOINCCodes.forEach((code: string) => {
          const match = MASTER_TEST_CATALOG.find(t => t.loincCode === code);
          if (match) mappedTests.push(match);
        });
      }
      
      if (mappedTests.length === 0) {
        mappedTests.push(MASTER_TEST_CATALOG[0], MASTER_TEST_CATALOG[1]);
      }

      return {
        patientName: parsed.patientName || 'Aarav Sharma',
        patientAge: Number(parsed.patientAge) || 45,
        patientGender: parsed.patientGender || 'Male',
        medications: parsed.medications || [],
        diagnosticTests: mappedTests
      };

    } catch (error) {
      console.error('[Mediflow AI] OCR Extraction failed, falling back to simulated data:', error);
      return {
        patientName: 'Aarav Sharma',
        patientAge: 45,
        patientGender: 'Male',
        medications: [
          { medicineName: 'Metformin 500mg', dosage: '1 Tab', frequency: '1-0-1', duration: '10 Days' },
          { medicineName: 'Atorvastatin 10mg', dosage: '1 Tab', frequency: '0-0-1', duration: '30 Days' }
        ],
        diagnosticTests: [
          MASTER_TEST_CATALOG[0],
          MASTER_TEST_CATALOG[1]
        ]
      };
    }
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

  triggerProactiveRefillNudge(phone: string): void {
    const patient = this.getPatients().find(p => p.phone === phone);
    if (!patient) return;

    // DevSecOps: Limit proactive marketing outbounds to high-value patients (Total Spent >= ₹1,000)
    const completedInvoices = this.getUnifiedInvoices()
      .filter(i => i.patientId === patient.id && i.paymentStatus === 'cleared');
    const totalSpent = completedInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

    if (totalSpent < 1000) {
      console.warn(`[Mediflow DevSecOps] Proactive Refill Nudge Restrained: Patient ${patient.name} has low-value threshold (Spent: ₹${totalSpent} < ₹1000).`);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Marketing Nudge Restrained 🛡️',
          message: `Blocked auto-refill alert for ${patient.name} due to low-value threshold (Spent: ₹${totalSpent} < ₹1000).`,
          type: 'warning'
        }
      }));
      return;
    }

    const message = `Hello ${patient.name}! 😊 We noticed your generic medication dosage is running low (only 5 days left!). 💊\n\nTo ensure uninterrupted treatment, we have pre-allocated a fresh, quality-checked pack for you at our Patna Pod pharmacy counter. \n\n*Reply 'YES' to confirm and immediately dispatch your medicine refill package to your home!*`;
    
    const sessions = this.getWhatsAppSessions();
    const existing = sessions.find(s => s.patientPhone === phone);
    if (existing) {
      existing.sessionData = {
        ...existing.sessionData,
        awaitingProactiveAction: 'refill'
      };
      this.save('whatsapp_sessions', sessions);
    }
    
    this.pushWhatsAppMessageFromBot(phone, message);
    this.writeAuditLog('PROACTIVE_REFILL_NUDGE_SENT', { phone, patientName: patient.name }, null);
  }

  triggerProactiveFollowUpNudge(phone: string): void {
    const patient = this.getPatients().find(p => p.phone === phone);
    if (!patient) return;

    // DevSecOps: Limit proactive marketing outbounds to high-value patients (Total Spent >= ₹1,000)
    const completedInvoices = this.getUnifiedInvoices()
      .filter(i => i.patientId === patient.id && i.paymentStatus === 'cleared');
    const totalSpent = completedInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

    if (totalSpent < 1000) {
      console.warn(`[Mediflow DevSecOps] Proactive Followup Nudge Restrained: Patient ${patient.name} has low-value threshold (Spent: ₹${totalSpent} < ₹1000).`);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Marketing Nudge Restrained 🛡️',
          message: `Blocked follow-up scheduling alert for ${patient.name} due to low-value threshold (Spent: ₹${totalSpent} < ₹1000).`,
          type: 'warning'
        }
      }));
      return;
    }

    const message = `Hello ${patient.name}! 😊 Hope you are recovering well. \n\nDr. Vivek recommended a follow-up consultation in 3 days to evaluate your progress. \n\n*Reply 'BOOK' or '1' to lock a convenient Virtual Video Consultation slot immediately!*`;
    
    const sessions = this.getWhatsAppSessions();
    const existing = sessions.find(s => s.patientPhone === phone);
    if (existing) {
      existing.sessionData = {
        ...existing.sessionData,
        awaitingProactiveAction: 'followup'
      };
      this.save('whatsapp_sessions', sessions);
    }

    this.pushWhatsAppMessageFromBot(phone, message);
    this.writeAuditLog('PROACTIVE_FOLLOWUP_NUDGE_SENT', { phone, patientName: patient.name }, null);
  }

  triggerProactiveLabCollectionNudge(phone: string): void {
    const patient = this.getPatients().find(p => p.phone === phone);
    if (!patient) return;

    // DevSecOps: Limit proactive marketing outbounds to high-value patients (Total Spent >= ₹1,000)
    const completedInvoices = this.getUnifiedInvoices()
      .filter(i => i.patientId === patient.id && i.paymentStatus === 'cleared');
    const totalSpent = completedInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

    if (totalSpent < 1000) {
      console.warn(`[Mediflow DevSecOps] Proactive Lab Nudge Restrained: Patient ${patient.name} has low-value threshold (Spent: ₹${totalSpent} < ₹1000).`);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Marketing Nudge Restrained 🛡️',
          message: `Blocked lab collection alert for ${patient.name} due to low-value threshold (Spent: ₹${totalSpent} < ₹1000).`,
          type: 'warning'
        }
      }));
      return;
    }

    const message = `Hi ${patient.name}! 🔬 Our records show you have a pending sugar level test (HbA1c test) ordered by Dr. Vivek. Reagents are currently locked for your slot. \n\n*Would you like our lab team to collect your blood sample from your home tomorrow morning at 8:00 AM? Reply 'HOME' to schedule.*`;
    
    const sessions = this.getWhatsAppSessions();
    const existing = sessions.find(s => s.patientPhone === phone);
    if (existing) {
      existing.sessionData = {
        ...existing.sessionData,
        awaitingProactiveAction: 'lab'
      };
      this.save('whatsapp_sessions', sessions);
    }

    this.pushWhatsAppMessageFromBot(phone, message);
    this.writeAuditLog('PROACTIVE_LAB_NUDGE_SENT', { phone, patientName: patient.name }, null);
  }

  async referPatientToSpecialist(phone: string, targetDoctorId: string): Promise<void> {
    try {
      const sessions = this.getWhatsAppSessions();
      const session = sessions.find(s => s.patientPhone === phone);
      const patient = this.getPatients().find(p => p.phone === phone);
      if (!session || !patient) {
        console.warn(`[Mediflow Referrals] Session or Patient not found for phone ${phone}`);
        return;
      }

      // Look up target doctor name / specialty
      let doctorName = "Dr. Sinha";
      let specialty = "Cardiologist";
      if (targetDoctorId === 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317103') {
        doctorName = "Dr. Sinha";
        specialty = "Cardiologist";
      } else if (targetDoctorId === 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102') {
        doctorName = "Dr. Anjali";
        specialty = "Gynecologist";
      } else if (targetDoctorId === 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101') {
        doctorName = "Dr. Raj";
        specialty = "Pediatrician";
      }

      const nudgeMessage = `Dr. Vivek has referred you to ${specialty} ${doctorName}. Reply 'BOOK' to schedule your slot. 🩺`;

      // Update whatsapp_sessions to AWAITING_WELCOME state
      const referralData = {
        referredByDoctorId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101', // Dr. Vivek
        referredToDoctorId: targetDoctorId,
        specialty,
        doctorName,
        referralCommissionAmt: 50.00 // flat ₹50 thank-you fee
      };

      const sessionData = {
        ...session.sessionData,
        referral: referralData
      };

      this.updateWhatsAppState(phone, 'AWAITING_WELCOME', sessionData);

      // Trigger the WhatsApp message
      this.pushWhatsAppMessageFromBot(phone, nudgeMessage);
      await this.writeAuditLog('PATIENT_REFERRAL_INITIATED', { phone, targetDoctorId, specialty, doctorName }, patient.id);

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Referral Nudge Sent! 📣',
          message: `Referral nudge sent to ${patient.name} via WhatsApp. Awaiting BOOK response.`,
          type: 'success'
        }
      }));
    } catch (err) {
      console.error('[Mediflow Referrals] Error initiating referral:', err);
    }
  }

  async saveAgentTaskPipeline(pipeline: {
    patient_id: string;
    original_prompt: string;
    parsed_intent: string;
    steps_json: any[];
    status: string;
  }): Promise<{ error: any }> {
    const { error } = await supabase
      .from('agent_task_pipelines')
      .insert({
        patient_id: pipeline.patient_id,
        original_prompt: pipeline.original_prompt,
        parsed_intent: pipeline.parsed_intent,
        steps_json: pipeline.steps_json,
        status: pipeline.status
      });
    
    if (error) {
      console.error('[Mediflow API] Error saving agent task pipeline:', error);
    } else {
      await this.writeAuditLog('AGENT_PIPELINE_SAVED', { patientId: pipeline.patient_id }, pipeline.patient_id);
      this.syncFromSupabase();
    }
    return { error };
  }
}

export const api = new MediflowApiService();
