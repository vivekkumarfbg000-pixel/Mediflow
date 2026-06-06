import { supabase } from '../lib/supabaseClient';
import { load, save, writeAuditLog, notify } from './apiHelper';
import { PatientService, INITIAL_PATIENTS } from './patientService';
import { EncounterService } from './encounterService';
import { PharmacyService } from './pharmacyService';
import { LabService, MASTER_TEST_CATALOG, OPHTHALMIC_TEST_CATALOG } from './labService';
import { BillingService } from './billingService';
import { WhatsAppService } from './whatsappService';
import { ForecastService } from './forecastService';
import { StaffService } from './staffService';
// Circuit breakers — safe to import now that autoHealerAgent uses dynamic import() for api
import { supabaseCircuit, backendApiCircuit } from './autoHealerAgent';

import type { 
  Patient, 
  PatientVitals,
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
  MedicineImportRow,
  Invoice,
  Prescription,
  Appointment,
  EveningSlot,
  LabReport,
  ReagentStock
} from '../types';

export { MASTER_TEST_CATALOG, OPHTHALMIC_TEST_CATALOG };
export type { ReagentStock };

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

export interface WALEntry {
  id: string; // client UUID (idempotency key)
  action: 'CREATE_ENCOUNTER' | 'UPDATE_VITALS' | 'REGISTER_PATIENT' | 'REGISTER_WALKIN_LAB' | 'CREATE_LAB_REQ_FROM_RX' | 'UPDATE_QUEUE_STATUS';
  payload: any;
  timestamp: string;
  synced: boolean;
}

class WALIndexedDB {
  private dbName = 'mediflow_wal_db';
  private storeName = 'wal_outbox';
  private version = 1;

  private getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available'));
        return;
      }
      const request = indexedDB.open(this.dbName, this.version);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addEntry(action: WALEntry['action'], payload: any): Promise<WALEntry> {
    const entry: WALEntry = {
      id: payload.id || crypto.randomUUID(),
      action,
      payload,
      timestamp: new Date().toISOString(),
      synced: false,
    };
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.add(entry);
        request.onsuccess = () => resolve(entry);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn('[WAL IndexedDB] Fallback to memory outbox:', e);
      const memOutbox = JSON.parse(localStorage.getItem('wal_mem_outbox') || '[]');
      memOutbox.push(entry);
      localStorage.setItem('wal_mem_outbox', JSON.stringify(memOutbox));
      return entry;
    }
  }

  async getUnsyncedEntries(): Promise<WALEntry[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();
        request.onsuccess = () => {
          const all = request.result as WALEntry[];
          resolve(all.filter(e => !e.synced).sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
        };
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      const memOutbox = JSON.parse(localStorage.getItem('wal_mem_outbox') || '[]');
      return memOutbox.filter((e: any) => !e.synced);
    }
  }

  async markSynced(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(id);
        request.onsuccess = () => {
          const entry = request.result as WALEntry;
          if (entry) {
            entry.synced = true;
            const updateReq = store.put(entry);
            updateReq.onsuccess = () => resolve();
            updateReq.onerror = () => reject(updateReq.error);
          } else {
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      const memOutbox = JSON.parse(localStorage.getItem('wal_mem_outbox') || '[]');
      const entry = memOutbox.find((x: any) => x.id === id);
      if (entry) {
        entry.synced = true;
        localStorage.setItem('wal_mem_outbox', JSON.stringify(memOutbox));
      }
    }
  }

  async deleteEntry(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      const memOutbox = JSON.parse(localStorage.getItem('wal_mem_outbox') || '[]');
      const filtered = memOutbox.filter((x: any) => x.id !== id);
      localStorage.setItem('wal_mem_outbox', JSON.stringify(filtered));
    }
  }
}

export const walDB = new WALIndexedDB();

class MediflowApiService {
  private listeners: Set<() => void> = new Set();
  public isSyncing = false;
  public isVoiceScribing = false;
  public isOcrScanning = false;
  public isLabTrending = false;
  public simulatedRole = 'compounder';

  constructor() {
    if (typeof window !== 'undefined') {
      (window as any).api = this;
      (window as any).supabase = supabase;
    }

    // Dynamic sync on auth events
    supabase.auth.onAuthStateChange((event) => {
      console.log('[Mediflow API] Auth state changed event in API:', event);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        this.syncFromSupabase();
      }
    });

    this.syncFromSupabase();

    const activeChannel = supabase.channel('mediflow-pod-realtime');
    supabase.removeChannel(activeChannel);

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

    setInterval(() => this.syncFromSupabase(), 15000);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[Mediflow API] Network back online. Triggering WAL replay...');
        this.replayWALOutbox();
      });

      window.addEventListener('mediflow-circuit-open', (e: Event) => {
        const detail = (e as CustomEvent).detail || {};
        if (detail.name === 'supabase-db') {
          console.warn('[Mediflow API] Database Circuit OPEN! Activating offline standby fallback...');
        }
      });

      window.addEventListener('mediflow-circuit-closed', (e: Event) => {
        const detail = (e as CustomEvent).detail || {};
        if (detail.name === 'supabase-db') {
          console.log('[Mediflow API] Database Circuit CLOSED. Triggering WAL replay...');
          this.replayWALOutbox();
        }
      });

      // Probe WAL replay initially
      setTimeout(() => this.replayWALOutbox(), 1000);
    }
  }

  setSimulatedRole(role: string) {
    this.simulatedRole = role;
    this.syncFromSupabase();
  }

  async writeAuditLog(actionType: string, details: Record<string, any> = {}, entityId: string | null = null): Promise<void> {
    await writeAuditLog(actionType, { ...details, simulated_role: this.simulatedRole }, entityId);
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

  private load<T>(key: string, defaultValue: T): T {
    return load<T>(key, defaultValue);
  }

  private save<T>(key: string, value: T): void {
    save(key, value);
  }

  public async replayWALOutbox(): Promise<void> {
    if (this.isSyncing) return;
    let entries;
    try {
      entries = await walDB.getUnsyncedEntries();
    } catch (e) {
      console.warn('[Mediflow WAL] Failed to fetch WAL outbox entries:', e);
      return;
    }
    if (!entries || entries.length === 0) return;

    console.log(`[Mediflow WAL] Replaying ${entries.length} offline operations...`);
    for (const entry of entries) {
      try {
        console.log(`[Mediflow WAL] Syncing entry ${entry.id} (${entry.action})...`);
        
        switch (entry.action) {
          case 'CREATE_ENCOUNTER': {
            const { payload } = entry;
            // Execute Supabase insert sequentially
            const { error: encError } = await supabase
              .from('encounters')
              .insert({
                id: entry.id, // client UUID (idempotency key)
                patient_id: payload.patientId,
                doctor_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101',
                entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
                clinical_notes: payload.clinicalNotes,
                status: 'active'
              });
            if (encError) throw encError;

            if (payload.medications && payload.medications.length > 0) {
              const medsPayload = payload.medications.map((med: any) => ({
                encounter_id: entry.id,
                medicine_name: med.medicineName,
                dosage: med.dosage,
                frequency: med.frequency,
                duration: med.duration
              }));
              const { error: medsError } = await supabase.from('encounter_medications').insert(medsPayload);
              if (medsError) throw medsError;
            }

            if (payload.diagnosticTests && payload.diagnosticTests.length > 0) {
              const diagsPayload = payload.diagnosticTests.map((test: any) => ({
                encounter_id: entry.id,
                loinc_code: test.loincCode,
                test_name: test.name,
                status: 'ordered'
              }));
              const { error: diagsError } = await supabase.from('encounter_diagnostics').insert(diagsPayload);
              if (diagsError) throw diagsError;
            }

            const { error: updateError } = await supabase
              .from('encounters')
              .update({ status: 'completed' })
              .eq('id', entry.id);
            if (updateError) throw updateError;
            break;
          }
          case 'UPDATE_VITALS': {
            const { payload } = entry;
            const { error } = await supabase.from('patient_registry').update({
              vitals: payload.vitals,
              token_number: payload.token,
              queue_status: 'awaiting_consultation'
            }).eq('id', payload.patientId);
            if (error) throw error;
            break;
          }
          case 'UPDATE_QUEUE_STATUS': {
            const { payload } = entry;
            const { error } = await supabase.from('patient_registry').update({
              queue_status: payload.status
            }).eq('id', payload.patientId);
            if (error) throw error;
            break;
          }
          case 'REGISTER_PATIENT': {
            const { payload } = entry;
            const { error } = await supabase.from('patient_registry').insert({
              id: entry.id,
              name: payload.name,
              phone: payload.phone,
              age: payload.age,
              gender: payload.gender,
              allergies: payload.allergies,
              chronic_conditions: payload.chronicConditions,
              abha_id: payload.abhaId,
              registered_at_entity: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002'
            });
            if (error) throw error;
            break;
          }

          case 'REGISTER_WALKIN_LAB': {
            const { payload } = entry;
            const { error } = await supabase.from('lab_requisitions').insert({
              id: entry.id,
              encounter_id: null,
              patient_id: payload.patientId,
              loinc_code: payload.testCode,
              test_name: payload.testName,
              barcode: payload.barcode || `WALK-${Date.now()}-${payload.testCode}`,
              status: 'pending',
              assigned_technician_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102',
              created_at: entry.timestamp
            });
            if (error) throw error;
            break;
          }
          case 'CREATE_LAB_REQ_FROM_RX': {
            const { payload } = entry;
            const { error } = await supabase.from('lab_requisitions').insert({
              id: entry.id,
              encounter_id: null,
              patient_id: payload.patientId,
              loinc_code: payload.testCode,
              test_name: payload.testName,
              barcode: payload.barcode || `RX-${Date.now()}-${payload.testCode}`,
              status: 'pending',
              prescription_file_url: payload.prescriptionFileUrl,
              assigned_technician_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102',
              created_at: entry.timestamp
            });
            if (error) throw error;
            break;
          }
          default:
            console.warn(`[Mediflow WAL] Unrecognized WAL entry action: ${entry.action}`);
        }

        await walDB.markSynced(entry.id);
        console.log(`[Mediflow WAL] Entry ${entry.id} synced successfully ✅`);
      } catch (err) {
        console.error(`[Mediflow WAL] Replay failed for entry ${entry.id}:`, err);
        const errString = String(err);
        if (errString.includes('23505') || errString.includes('already exists') || errString.includes('duplicate key')) {
          await walDB.markSynced(entry.id);
          console.log(`[Mediflow WAL] Duplicate entry resolved. Marked as synced ✅`);
        } else {
          break;
        }
      }
    }

    await this.syncFromSupabase();
  }

  public async syncFromSupabase(): Promise<void> {
    // Prevent syncing if not authenticated (no active session keys in local storage)
    const hasSession = typeof window !== 'undefined' && Object.keys(localStorage).some(k => k.includes('-auth-token'));
    if (!hasSession) {
      console.log('[Mediflow API] Sync skipped: No active session token found.');
      return;
    }

    this.isSyncing = true;
    this.notify();
    try {
      const dbConsents = await supabaseCircuit.execute(async () => {
        const { data, error } = await supabase
          .from('patient_consents')
          .select('*')
          .is('revoked_at', null);
        if (error) throw error;
        return data;
      }, () => {
        const cachedConsentIds = this.load<string[]>('active_consent_ids', []);
        return cachedConsentIds.map(id => ({ patient_id: id, granted_at: new Date().toISOString() }));
      });

      const activePatientIds = new Set<string>();
      if (dbConsents) {
        dbConsents.forEach(c => {
          const grantedDate = new Date(c.granted_at);
          const diffDays = (new Date().getTime() - grantedDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays <= 30) {
            activePatientIds.add(c.patient_id);
          }
        });
      }
      this.save('active_consent_ids', Array.from(activePatientIds));

      const dbPatients = await supabaseCircuit.execute(async () => {
        const { data, error } = await supabase.from('patient_registry').select('*');
        if (error) throw error;
        return data;
      }, () => {
        return this.load<any[]>('patients', []).map(p => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
          age: p.age,
          gender: p.gender,
          allergies: p.allergies,
          chronic_conditions: p.chronicConditions,
          abha_id: p.abhaId,
          vitals: p.vitals,
          token_number: p.tokenNumber,
          queue_status: p.queueStatus,
          past_reports_summary: p.pastReportsSummary,
          created_at: p.createdAt
        }));
      });

      if (dbPatients) {
        const isClinicalRole = ['doctor', 'compounder', 'receptionist', 'admin', 'platform_admin'].includes(this.simulatedRole);
        const filteredPatients = dbPatients.filter(p => isClinicalRole || activePatientIds.has(p.id));

        const patients = filteredPatients.map(p => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
          age: p.age,
          gender: p.gender as Patient['gender'],
          allergies: p.allergies || [],
          chronicConditions: p.chronicConditions || p.chronic_conditions || [],
          abhaId: p.abhaId || p.abha_id || undefined,
          vitals: p.vitals || undefined,
          tokenNumber: p.tokenNumber || p.token_number || undefined,
          queueStatus: (p.queueStatus as Patient['queueStatus']) || (p.queue_status as Patient['queueStatus']) || undefined,
          pastReportsSummary: p.pastReportsSummary || p.past_reports_summary || undefined,
          createdAt: p.createdAt || p.created_at
        }));
        this.save('patients', patients);
      }

      const dbSessions = await supabaseCircuit.execute(async () => {
        const { data, error } = await supabase.from('whatsapp_sessions').select('*');
        if (error) throw error;
        return data;
      }, () => {
        return this.load<any[]>('whatsapp_sessions', []).map(s => ({
          id: s.id,
          patient_phone: s.patientPhone || s.patient_phone,
          current_state: s.currentState || s.current_state,
          last_interaction: s.lastInteraction || s.last_interaction,
          session_data: s.sessionData || s.session_data
        }));
      });

      if (dbSessions) {
        const sessions = dbSessions.map(s => {
          const sessionData = s.session_data || s.sessionData || {};
          return {
            id: s.id,
            patientPhone: s.patient_phone || s.patientPhone,
            currentState: (sessionData.currentState || s.current_state || s.currentState) as WhatsAppSession['currentState'],
            lastInteraction: s.last_interaction || s.lastInteraction,
            sessionData
          };
        });
        this.save('whatsapp_sessions', sessions);
      }

      // Sync clinic SOPs from Supabase
      const { data: dbSops } = await supabase.from('clinic_sops').select('*');
      if (dbSops) {
        const sops: ClinicSop[] = dbSops.map(s => ({
          id: s.id,
          entityId: s.entity_id,
          sopFileName: s.sop_file_name || '',
          sopText: s.sop_text || '',
          extractedConfig: s.extracted_config || {},
          isActive: s.is_active,
          createdAt: s.created_at || new Date().toISOString()
        }));
        this.save('clinic_sops', sops);
      }

      // Sync medicine bills with line items from Supabase
      const { data: dbBills } = await supabase.from('medicine_bills').select(`
        id,
        patient_id,
        encounter_id,
        subtotal,
        loyalty_discount_percent,
        loyalty_discount_amount,
        item_discount_amount,
        gst_amount,
        total_amount,
        payment_mode,
        upi_qr_payload,
        status,
        source,
        delivery_type,
        delivery_address,
        delivery_charge,
        shiprocket_order_id,
        created_at,
        patient:patient_registry(name, phone),
        medicine_bill_items(
          inventory_item_id,
          name,
          batch_number,
          expiry_date,
          quantity,
          mrp,
          selling_price,
          discount_percent,
          gst_percent,
          line_total
        )
      `);
      if (dbBills) {
        const bills = dbBills.map(b => ({
          id: b.id,
          patientId: b.patient_id,
          patientName: (Array.isArray(b.patient) ? (b.patient[0] as any)?.name : (b.patient as any)?.name) || 'WhatsApp Patient',
          patientPhone: (Array.isArray(b.patient) ? (b.patient[0] as any)?.phone : (b.patient as any)?.phone) || '',
          encounterId: b.encounter_id || undefined,
          subtotal: Number(b.subtotal),
          loyaltyDiscountPercent: Number(b.loyalty_discount_percent),
          loyaltyDiscountAmount: Number(b.loyalty_discount_amount),
          itemDiscountAmount: Number(b.item_discount_amount),
          gstAmount: Number(b.gst_amount),
          totalAmount: Number(b.total_amount),
          paymentMode: b.payment_mode,
          upiQrPayload: b.upi_qr_payload || undefined,
          status: b.status,
          source: b.source,
          deliveryType: b.delivery_type || undefined,
          deliveryAddress: b.delivery_address || undefined,
          deliveryCharge: b.delivery_charge ? Number(b.delivery_charge) : undefined,
          shiprocketOrderId: b.shiprocket_order_id || undefined,
          createdAt: b.created_at,
          items: (b.medicine_bill_items || []).map(item => ({
            inventoryItemId: item.inventory_item_id,
            name: item.name,
            batchNumber: item.batch_number,
            expiryDate: item.expiry_date,
            quantity: Number(item.quantity),
            mrp: Number(item.mrp),
            sellingPrice: Number(item.selling_price),
            discountPercent: Number(item.discount_percent),
            gstPercent: Number(item.gst_percent),
            lineTotal: Number(item.line_total)
          }))
        }));
        this.save('medicine_bills', bills);
      }

      if (this.simulatedRole === 'pharmacist') {
        console.warn('[Mediflow DevSecOps] Security Block: Pharmacist role is strictly blocked from querying clinical encounter notes.');
        this.save('encounters', []);
      } else {
        const dbEncounters = await supabaseCircuit.execute<any>(async () => {
          const { data, error } = await supabase.from('encounters').select(`
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
          if (error) throw error;
          return data;
        }, () => {
          return this.load<any[]>('encounters', []).map(e => ({
            id: e.id,
            patient_id: e.patientId || e.patient_id,
            doctor_id: e.doctorId || e.doctor_id,
            clinical_notes: e.clinicalNotes || e.clinical_notes,
            status: e.status,
            created_at: e.createdAt || e.created_at,
            patient: { name: e.patientName },
            encounter_medications: (e.medications || e.encounter_medications || []).map((m: any) => ({
              id: m.id,
              medicine_name: m.medicineName || m.medicine_name,
              dosage: m.dosage,
              frequency: m.frequency,
              duration: m.duration
            })),
            encounter_diagnostics: (e.diagnosticTests || e.encounter_diagnostics || []).map((d: any) => ({
              loinc_code: d.loincCode || d.loinc_code,
              test_name: d.name || d.test_name
            }))
          }));
        });
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

          const rx = this.getPrescriptions().find(p => p.appointmentId === r.encounter_id || p.appointmentId === r.id);

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
            prescriptionFileUrl: rx?.prescriptionFileUrl || undefined,
            createdAt: r.created_at
          };
        });
        this.save('lab_requisitions', requisitions);
      }

      const { data: dbReagents } = await supabase.from('reagent_inventory').select('*');
      if (dbReagents) {
        const reagents = dbReagents.map(r => ({
          reagentName: r.reagent_name,
          stockVolume: Number(r.stock_volume),
          unit: r.unit
        }));
        this.save('reagents', reagents);
      }

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
          paymentStatus: (i.payment_status === 'unpaid' || i.payment_status === 'refunded' || i.payment_status === 'pending') 
            ? 'pending' 
            : ((i.payment_status === 'paid' || i.payment_status === 'cleared') ? 'cleared' : i.payment_status as any),
          createdAt: i.created_at
        }));
        this.save('unified_invoices', invoices);
      }

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

  // Patient Registry & Queue tracking Delegators
  getPatients(): Patient[] {
    return PatientService.getPatients();
  }

  updatePatientVitalsAndToken(patientId: string, vitals: PatientVitals, token: string): void {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const isCircuitOpen = supabaseCircuit.isBlocking();

    if (isOffline || isCircuitOpen) {
      console.warn('[Mediflow WAL] Network offline or DB circuit open. Enqueuing UPDATE_VITALS in local outbox...');
      
      // Perform optimistic local update
      PatientService.updatePatientVitalsAndToken(patientId, vitals, token);
      
      walDB.addEntry('UPDATE_VITALS', {
        id: crypto.randomUUID(),
        patientId,
        vitals,
        token
      }).then(() => {
        this.notify();
      });
      return;
    }

    PatientService.updatePatientVitalsAndToken(patientId, vitals, token);
    this.notify();
  }

  updatePatientQueueStatus(patientId: string, status: Patient['queueStatus']): void {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const isCircuitOpen = supabaseCircuit.isBlocking();

    if (isOffline || isCircuitOpen) {
      console.warn('[Mediflow WAL] Network offline or DB circuit open. Enqueuing UPDATE_QUEUE_STATUS in local outbox...');
      
      // Perform optimistic local update
      PatientService.updatePatientQueueStatus(patientId, status);
      
      walDB.addEntry('UPDATE_QUEUE_STATUS', {
        id: crypto.randomUUID(),
        patientId,
        status
      }).then(() => {
        this.notify();
      });
      return;
    }

    PatientService.updatePatientQueueStatus(patientId, status);
    this.notify();
  }

  generateNextTokenNumber(): string {
    return PatientService.generateNextTokenNumber();
  }

  registerPatient(patientData: Omit<Patient, 'id' | 'createdAt'> & { id?: string }): Patient {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const isCircuitOpen = supabaseCircuit.isBlocking();

    if (isOffline || isCircuitOpen) {
      console.warn('[Mediflow WAL] Network offline or DB circuit open. Enqueuing REGISTER_PATIENT in local outbox...');
      
      // Perform optimistic local update
      const res = PatientService.registerPatient(patientData);
      
      walDB.addEntry('REGISTER_PATIENT', {
        id: res.id,
        ...patientData
      }).then(() => {
        this.notify();
      });
      return res;
    }

    const res = PatientService.registerPatient(patientData);
    this.notify();
    return res;
  }

  getPatientHistoricalBiomarkers(patientId: string): HistoricalBiomarker[] {
    return PatientService.getPatientHistoricalBiomarkers(patientId);
  }

  isPatientConsentActive(patientId: string): boolean {
    return PatientService.isPatientConsentActive(patientId);
  }

  getActivePatient(): Patient | null {
    return PatientService.getActivePatient();
  }

  setActivePatient(patient: Patient | null): void {
    PatientService.setActivePatient(patient);
    this.notify();
  }

  getActivePatientCareStage(patientId: string): 'registered' | 'diagnosing' | 'lab' | 'pharmacy' | 'settled' {
    return PatientService.getActivePatientCareStage(patientId);
  }

  async grantInPersonConsent(patientId: string): Promise<void> {
    await PatientService.grantInPersonConsent(patientId);
    this.notify();
  }

  async updatePatientPastReportsSummary(patientId: string, summary: string): Promise<void> {
    await PatientService.updatePatientPastReportsSummary(patientId, summary);
    this.notify();
  }

  generateAIPatientSummary(patientId: string): string {
    return PatientService.generateAIPatientSummary(patientId);
  }

  // WhatsApp conversational state machine Delegators
  getWhatsAppSessions(): WhatsAppSession[] {
    return WhatsAppService.getWhatsAppSessions();
  }

  async sendWhatsAppMessagePayload(phone: string, template: string, payload: Record<string, any>): Promise<boolean> {
    return WhatsAppService.sendWhatsAppMessagePayload(phone, template, payload);
  }

  async processIncomingWhatsAppMessage(phone: string, text: string): Promise<void> {
    await WhatsAppService.processIncomingWhatsAppMessage(phone, text);
    await this.syncFromSupabase();
  }

  initiateWhatsAppSession(phone: string): WhatsAppSession {
    const res = WhatsAppService.initiateWhatsAppSession(phone);
    this.syncFromSupabase();
    return res;
  }

  updateWhatsAppState(phone: string, state: WhatsAppSession['currentState'], data: Record<string, any> = {}): void {
    WhatsAppService.updateWhatsAppState(phone, state, data);
    this.notify();
  }

  dispatchWhatsAppLoyaltyOffer(patientId: string, offerType: string): string {
    return WhatsAppService.dispatchWhatsAppLoyaltyOffer(patientId, offerType);
  }

  pushWhatsAppMessageFromBot(phone: string, text: string): void {
    WhatsAppService.pushWhatsAppMessageFromBot(phone, text);
    this.notify();
  }

  triggerProactiveRefillNudge(phone: string): void {
    WhatsAppService.triggerProactiveRefillNudge(phone);
    this.notify();
  }

  triggerProactiveFollowUpNudge(phone: string): void {
    WhatsAppService.triggerProactiveFollowUpNudge(phone);
    this.notify();
  }

  triggerProactiveLabCollectionNudge(phone: string): void {
    WhatsAppService.triggerProactiveLabCollectionNudge(phone);
    this.notify();
  }

  async referPatientToSpecialist(phone: string, targetDoctorId: string): Promise<void> {
    await WhatsAppService.referPatientToSpecialist(phone, targetDoctorId);
    this.notify();
  }

  // Encounters/Clinical diagnostics scribe Delegators
  getEncounters(): Encounter[] {
    return EncounterService.getEncounters();
  }

  createEncounter(encounterData: Omit<Encounter, 'id' | 'createdAt' | 'status'>): Encounter {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const isCircuitOpen = supabaseCircuit.isBlocking();

    if (isOffline || isCircuitOpen) {
      console.warn('[Mediflow WAL] Network offline or DB circuit open. Enqueuing CREATE_ENCOUNTER in local outbox...');
      const encounterId = crypto.randomUUID();
      const newEncounter: Encounter = {
        ...encounterData,
        id: encounterId,
        status: 'completed',
        createdAt: new Date().toISOString()
      };
      
      const encounters = load<Encounter[]>('encounters', []);
      encounters.push(newEncounter);
      save('encounters', encounters);

      walDB.addEntry('CREATE_ENCOUNTER', {
        id: encounterId,
        ...encounterData
      }).then(() => {
        this.notify();
      });
      return newEncounter;
    }

    const res = EncounterService.createEncounter(encounterData);
    this.notify();
    return res;
  }

  // Lab diagnostics/requisitions and report approve/reject Delegators
  getLabRequisitions(): LabRequisition[] {
    return LabService.getLabRequisitions();
  }

  saveLabRequisitions(reqs: LabRequisition[]): void {
    LabService.saveLabRequisitions(reqs);
    this.notify();
  }

  collectLabSample(reqId: string): void {
    LabService.collectLabSample(reqId);
    this.notify();
  }

  getReagentStocks(): ReagentStock[] {
    return LabService.getReagentStocks();
  }

  submitLabResult(reqId: string, resultValue: string): void {
    LabService.submitLabResult(reqId, resultValue);
    this.notify();
  }

  replenishReagentStock(reagentName: string, volumeToAdd: number): void {
    LabService.replenishReagentStock(reagentName, volumeToAdd);
    this.notify();
  }

  registerWalkinLabTest(patientId: string, testCode: string, testName: string, prescriptionFileUrl?: string): LabRequisition {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const isCircuitOpen = supabaseCircuit.isBlocking();

    if (isOffline || isCircuitOpen) {
      console.warn('[Mediflow WAL] Network offline or DB circuit open. Enqueuing REGISTER_WALKIN_LAB in local outbox...');
      const reqId = crypto.randomUUID();
      const barcode = `WALK-${Date.now()}-${testCode}`.toUpperCase();
      const patients = this.getPatients();
      const patient = patients.find(p => p.id === patientId);

      const newReq: LabRequisition = {
        id: reqId,
        encounterId: 'walkin',
        patientId,
        patientName: patient?.name || 'Walk-in Patient',
        testCode,
        testName,
        barcode,
        status: 'pending',
        reagentDeductions: [],
        prescriptionFileUrl,
        createdAt: new Date().toISOString()
      };

      const existing = load<LabRequisition[]>('lab_requisitions', []);
      existing.unshift(newReq);
      save('lab_requisitions', existing);

      walDB.addEntry('REGISTER_WALKIN_LAB', {
        id: reqId,
        patientId,
        testCode,
        testName,
        barcode,
        prescriptionFileUrl
      }).then(() => {
        this.notify();
      });

      return newReq;
    }

    const res = LabService.registerWalkinLabTest(patientId, testCode, testName, prescriptionFileUrl);
    this.notify();
    return res;
  }

  getPathologyReports(): PathologyReport[] {
    return LabService.getPathologyReports();
  }

  savePathologyReports(reports: PathologyReport[]): void {
    LabService.savePathologyReports(reports);
    this.notify();
  }

  processPathologyReport(reportId: string, results: string): void {
    LabService.processPathologyReport(reportId, results);
    this.notify();
  }

  async uploadPrescriptionToStorage(file: File): Promise<string> {
    return LabService.uploadPrescriptionToStorage(file);
  }

  createLabRequisitionFromPrescription(patientId: string, testCode: string, testName: string, prescriptionFileUrl: string): LabRequisition {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const isCircuitOpen = supabaseCircuit.isBlocking();

    if (isOffline || isCircuitOpen) {
      console.warn('[Mediflow WAL] Network offline or DB circuit open. Enqueuing CREATE_LAB_REQ_FROM_RX in local outbox...');
      const reqId = crypto.randomUUID();
      const barcode = `RX-${Date.now()}-${testCode}`.toUpperCase();
      const patients = this.getPatients();
      const patient = patients.find(p => p.id === patientId);

      const newReq: LabRequisition = {
        id: reqId,
        encounterId: `rx-dispatch-${reqId.substring(0, 8)}`,
        patientId,
        patientName: patient?.name || 'Unknown Patient',
        testCode,
        testName,
        barcode,
        status: 'pending',
        reagentDeductions: [],
        prescriptionFileUrl,
        createdAt: new Date().toISOString()
      };

      const existing = load<LabRequisition[]>('lab_requisitions', []);
      existing.unshift(newReq);
      save('lab_requisitions', existing);

      walDB.addEntry('CREATE_LAB_REQ_FROM_RX', {
        id: reqId,
        patientId,
        testCode,
        testName,
        barcode,
        prescriptionFileUrl
      }).then(() => {
        this.notify();
      });

      return newReq;
    }

    const res = LabService.createLabRequisitionFromPrescription(patientId, testCode, testName, prescriptionFileUrl);
    this.notify();
    return res;
  }

  async uploadLabReportToStorage(file: File, requisitionId: string): Promise<string> {
    return LabService.uploadLabReportToStorage(file, requisitionId);
  }

  getFullLabReports(): LabReport[] {
    return LabService.getFullLabReports();
  }

  saveFullLabReport(report: LabReport): void {
    LabService.saveFullLabReport(report);
    this.notify();
  }

  async approveLabReport(reportId: string, revisitDate: string, revisitTime: string, revisitNote: string): Promise<void> {
    await LabService.approveLabReport(reportId, revisitDate, revisitTime, revisitNote);
    this.notify();
  }

  async rejectLabReport(reportId: string, reason: string): Promise<void> {
    await LabService.rejectLabReport(reportId, reason);
    this.notify();
  }

  // Pharmacy Stock / FEFO holds Delegators
  getPharmacyInventory(): PharmacyInventoryItem[] {
    return PharmacyService.getPharmacyInventory();
  }

  savePharmacyInventory(items: PharmacyInventoryItem[]) {
    PharmacyService.savePharmacyInventory(items);
    this.notify();
  }

  addPharmacyInventoryItem(item: Omit<PharmacyInventoryItem, 'id' | 'addedAt'>): PharmacyInventoryItem {
    const res = PharmacyService.addPharmacyInventoryItem(item);
    this.notify();
    return res;
  }

  addPharmacyInventoryBulk(rows: MedicineImportRow[]): { added: number; errors: string[] } {
    const res = PharmacyService.addPharmacyInventoryBulk(rows);
    this.notify();
    return res;
  }

  deletePharmacyInventoryItem(id: string): void {
    PharmacyService.deletePharmacyInventoryItem(id);
    this.notify();
  }

  restockPharmacyInventoryItem(itemId: string, quantity: number) {
    PharmacyService.restockPharmacyInventoryItem(itemId, quantity);
    this.notify();
  }

  getLowStockItems(): PharmacyInventoryItem[] {
    return PharmacyService.getLowStockItems();
  }

  getExpiringItems(withinDays: number): PharmacyInventoryItem[] {
    return PharmacyService.getExpiringItems(withinDays);
  }

  getExpiredItems(): PharmacyInventoryItem[] {
    return PharmacyService.getExpiredItems();
  }

  getInventoryHolds(): InventoryHold[] {
    return PharmacyService.getInventoryHolds();
  }

  dispenseInventoryHold(holdId: string): void {
    PharmacyService.dispenseInventoryHold(holdId);
    this.notify();
  }

  cancelInventoryHold(holdId: string): void {
    PharmacyService.cancelInventoryHold(holdId);
    this.notify();
  }

  getMedicineBills(): MedicineBill[] {
    return PharmacyService.getMedicineBills();
  }

  saveMedicineBill(bill: MedicineBill): MedicineBill {
    const res = PharmacyService.saveMedicineBill(bill);
    this.notify();
    return res;
  }

  getMedicineBillById(id: string): MedicineBill | null {
    return PharmacyService.getMedicineBillById(id);
  }

  updateMedicineBillStatus(id: string, status: MedicineBill['status']): void {
    PharmacyService.updateMedicineBillStatus(id, status);
    this.notify();
  }

  dispenseMedicineBill(id: string): void {
    PharmacyService.dispenseMedicineBill(id);
    this.notify();
  }

  getCounterTransactions(): CounterTransaction[] {
    return PharmacyService.getCounterTransactions();
  }

  saveCounterTransaction(tx: CounterTransaction): void {
    PharmacyService.saveCounterTransaction(tx);
    this.notify();
  }

  checkLoyaltyDiscount(patientId: string): boolean {
    return PharmacyService.checkLoyaltyDiscount(patientId);
  }

  generateMedicineInvoiceMessage(bill: MedicineBill): string {
    return PharmacyService.generateMedicineInvoiceMessage(bill);
  }

  async parseSupplierBillOCR(base64: string): Promise<MedicineImportRow[]> {
    return PharmacyService.parseSupplierBillOCR(base64);
  }

  matchPrescriptionMedicines(names: string[]): PharmacyInventoryItem[] {
    return PharmacyService.matchPrescriptionMedicines(names);
  }

  getWhatsAppDrugOrders(): WhatsAppDrugOrder[] {
    return PharmacyService.getWhatsAppDrugOrders();
  }

  saveWhatsAppDrugOrders(orders: WhatsAppDrugOrder[]) {
    PharmacyService.saveWhatsAppDrugOrders(orders);
    this.notify();
  }

  simulateIncomingWhatsAppOrder() {
    PharmacyService.simulateIncomingWhatsAppOrder();
    this.notify();
  }

  // Unified Invoices & UPI splits ledger Delegators
  getUnifiedInvoices(): UnifiedInvoice[] {
    return BillingService.getUnifiedInvoices();
  }

  clearInvoice(invoiceId: string): void {
    BillingService.clearInvoice(invoiceId);
    this.notify();
  }

  getFinancialLedgers(invoiceId?: string): FinancialLedgerEntry[] {
    return BillingService.getFinancialLedgers(invoiceId);
  }

  getAppointments(): Appointment[] {
    return BillingService.getAppointments();
  }

  saveAppointment(appt: Appointment): void {
    BillingService.saveAppointment(appt);
    this.notify();
  }

  getInvoices(): Invoice[] {
    return BillingService.getInvoices();
  }

  saveInvoice(invoice: Invoice): void {
    BillingService.saveInvoice(invoice);
    this.notify();
  }

  getPrescriptions(): Prescription[] {
    return BillingService.getPrescriptions();
  }

  savePrescription(rx: Prescription): void {
    BillingService.savePrescription(rx);
    this.notify();
  }

  createGate1Consult(patientId: string): void {
    BillingService.createGate1Consult(patientId);
    this.notify();
  }

  settleSaaSInvoice(invoiceId: string): void {
    BillingService.settleSaaSInvoice(invoiceId);
    this.notify();
  }

  async runSaaSPrescriptionOCR(appointmentId: string, file: File | string): Promise<Prescription> {
    const res = await BillingService.runSaaSPrescriptionOCR(appointmentId, file);
    this.notify();
    return res;
  }

  async createAppointment(appointment: {
    patient_id: string;
    doctor_id: string;
    status?: string;
  }): Promise<string> {
    return BillingService.createAppointment(appointment);
  }

  async generateInvoice(appointmentId: string, type: 'consult' | 'lab' | 'pharmacy', amount: number): Promise<string> {
    return BillingService.generateInvoice(appointmentId, type, amount);
  }

  async markInvoicePaid(invoiceId: string, sendWhatsApp = true): Promise<void> {
    await BillingService.markInvoicePaid(invoiceId, sendWhatsApp);
    this.notify();
  }

  getClinicSops(): ClinicSop[] {
    return BillingService.getClinicSops();
  }

  saveClinicSops(sops: ClinicSop[]): void {
    BillingService.saveClinicSops(sops);
    this.notify();
  }

  getActiveSop(): ClinicSop | null {
    return BillingService.getActiveSop();
  }

  // Forecast AI Scribe & RAG Delegators
  getSeasonalForecasts(): SeasonalForecast[] {
    return ForecastService.getSeasonalForecasts();
  }

  actOnSeasonalForecast(forecastId: string): void {
    ForecastService.actOnSeasonalForecast(forecastId);
    this.notify();
  }

  async generateSeasonalForecast(req: {
    pharmacy_entity_id: string;
    pod_id: string;
    current_month: string;
    regional_weather: string;
  }): Promise<SeasonalForecast[]> {
    const res = await ForecastService.generateSeasonalForecast(req);
    this.notify();
    return res;
  }

  async generateConsultRoom(appointmentId: string, patientPhone: string, doctorName = 'Dr. Sharma'): Promise<{ roomUrl: string }> {
    return ForecastService.generateConsultRoom(appointmentId, patientPhone, doctorName);
  }

  async voiceScribe(audioBlob: Blob, filename = 'recording.webm'): Promise<{ summary: string; language: string }> {
    this.isVoiceScribing = true;
    this.notify();
    try {
      return await ForecastService.voiceScribe(audioBlob, filename);
    } finally {
      this.isVoiceScribing = false;
      this.notify();
    }
  }

  async ocrScan(file: File): Promise<{ extracted_text: string; structured_data: Record<string, string> }> {
    this.isOcrScanning = true;
    this.notify();
    try {
      return await ForecastService.ocrScan(file);
    } finally {
      this.isOcrScanning = false;
      this.notify();
    }
  }

  async labTrend(labData: Record<string, any>): Promise<{
    analysis: string;
    recommendations: string[];
    trajectory?: string;
    risk_flags?: string[];
    follow_up_days?: number;
    citations?: Array<{ pmid: string; title: string; journal: string; year: string; link: string; abstract?: string }>;
    suggested_compositions?: Array<{ medicine_name: string; composition: string; suggested_dosage: string; justification: string }>;
    gfr?: number;
  }> {
    this.isLabTrending = true;
    this.notify();
    try {
      return await ForecastService.labTrend(labData);
    } finally {
      this.isLabTrending = false;
      this.notify();
    }
  }

  async generateConsultHinglishSummary(patientId: string, suggestionsText: string): Promise<string> {
    return ForecastService.generateConsultHinglishSummary(patientId, suggestionsText);
  }

  async generateComparativeLabTrend(
    patientId: string,
    baselineDate: string | null,
    comparisonDate: string | null
  ): Promise<{
    summaryText: string;
    citations: Array<{ pmid: string; title: string; journal: string; year: string; link: string; abstract?: string }>;
    suggestedCompositions: Array<{ medicine_name: string; composition: string; suggested_dosage: string; justification: string }>;
    gfr?: number;
  }> {
    return ForecastService.generateComparativeLabTrend(patientId, baselineDate, comparisonDate);
  }

  async saveAgentTaskPipeline(pipeline: {
    patient_id: string;
    original_prompt: string;
    parsed_intent: string;
    steps_json: any[];
    status: string;
  }): Promise<{ error: any }> {
    return ForecastService.saveAgentTaskPipeline(pipeline);
  }

  async parsePrescriptionOCR(imageUri: string): Promise<{
    patientName: string;
    patientPhone?: string;
    patientAge: number;
    patientGender: 'Male' | 'Female' | 'Other';
    medications: Array<{ medicineName: string; dosage: string; frequency: string; duration: string }>;
    diagnosticTests: DiagnosticTest[];
  }> {
    return ForecastService.parsePrescriptionOCR(imageUri);
  }

  async processOCR(imageBase64: string): Promise<{ extractedMedicines?: any[]; extractedTests?: any[] }> {
    return ForecastService.processOCR(imageBase64);
  }

  // Clinic Staff Operations Delegators
  getClinicStaff(): ClinicStaff[] {
    return StaffService.getClinicStaff();
  }

  registerClinicStaff(name: string, role: 'compounder' | 'receptionist' | 'admin'): void {
    StaffService.registerClinicStaff(name, role);
    this.notify();
  }

  toggleStaffActive(staffId: string, isActive: boolean): void {
    StaffService.toggleStaffActive(staffId, isActive);
    this.notify();
  }

  getActiveStaffId(): string | null {
    return StaffService.getActiveStaffId();
  }

  setActiveStaffId(staffId: string | null): void {
    StaffService.setActiveStaffId(staffId);
    this.notify();
  }

  // ── Evening Scheduling Methods ───────────────────────────────────────────────

  /**
   * Computes the next available 30-minute evening slot (17:00–20:00 IST)
   * for a patient/doctor pair, persists it locally and to Supabase.
   */
  async createEveningSlot(patientId: string, doctorId: string): Promise<EveningSlot | null> {
    try {
      // Evening window: 17:00 – 20:00 in 30-minute increments
      const SLOT_DURATION_MIN = 30;
      const EVENING_START_HOUR = 17;
      const EVENING_END_HOUR = 20;

      const now = new Date();
      const todayDateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

      // Load existing scheduled slots for today
      const existing: EveningSlot[] = this.load<EveningSlot[]>('evening_slots', []).filter(s => {
        return s.startISO.startsWith(todayDateStr);
      });
      const bookedMinutes = existing.map(s => new Date(s.startISO).getHours() * 60 + new Date(s.startISO).getMinutes());

      // Find first free slot
      let slotStart: Date | null = null;
      for (let hr = EVENING_START_HOUR; hr < EVENING_END_HOUR; hr++) {
        for (let min = 0; min < 60; min += SLOT_DURATION_MIN) {
          const candidate = hr * 60 + min;
          if (!bookedMinutes.includes(candidate)) {
            slotStart = new Date(now);
            slotStart.setHours(hr, min, 0, 0);
            break;
          }
        }
        if (slotStart) break;
      }

      if (!slotStart) {
        console.warn('[EveningSlot] No free slots available today between 5 PM – 8 PM.');
        return null;
      }

      const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION_MIN * 60_000);

      const formatTime12h = (d: Date) =>
        d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

      const slot: EveningSlot = {
        appointmentId: crypto.randomUUID(),
        patientId,
        doctorId,
        startTime: formatTime12h(slotStart),
        endTime: formatTime12h(slotEnd),
        startISO: slotStart.toISOString(),
        endISO: slotEnd.toISOString()
      };

      // Persist locally
      const allSlots = this.load<EveningSlot[]>('evening_slots', []);
      allSlots.push(slot);
      this.save('evening_slots', allSlots);

      // Persist to Supabase appointments table (best-effort)
      try {
        await supabase.from('appointments').upsert({
          id: slot.appointmentId,
          patient_id: patientId,
          doctor_id: doctorId === 'doc-1' ? 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101' : doctorId,
          status: 'scheduled',
          appointment_time: slot.startISO,
          end_time: slot.endISO,
          created_at: new Date().toISOString()
        });
      } catch (dbErr) {
        console.warn('[EveningSlot] Supabase upsert failed (offline?), slot saved locally:', dbErr);
      }

      this.notify();
      return slot;
    } catch (err) {
      console.error('[EveningSlot] createEveningSlot error:', err);
      return null;
    }
  }

  /**
   * Saves a pre-computed EveningSlot (e.g., allocated by compounder) to local store + Supabase.
   */
  async scheduleAppointment(slot: EveningSlot): Promise<void> {
    const allSlots = this.load<EveningSlot[]>('evening_slots', []);
    const idx = allSlots.findIndex(s => s.appointmentId === slot.appointmentId);
    if (idx >= 0) allSlots[idx] = slot; else allSlots.push(slot);
    this.save('evening_slots', allSlots);

    try {
      await supabase.from('appointments').upsert({
        id: slot.appointmentId,
        patient_id: slot.patientId,
        doctor_id: slot.doctorId === 'doc-1' ? 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101' : slot.doctorId,
        status: 'scheduled',
        appointment_time: slot.startISO,
        end_time: slot.endISO
      });
    } catch (dbErr) {
      console.warn('[EveningSlot] scheduleAppointment Supabase upsert failed:', dbErr);
    }

    this.notify();
  }

  /**
   * Returns today's evening slot for a patient, or null if none exists.
   */
  getAppointmentByPatient(patientId: string): EveningSlot | null {
    const todayStr = new Date().toISOString().split('T')[0];
    const allSlots = this.load<EveningSlot[]>('evening_slots', []);
    return allSlots.find(s => s.patientId === patientId && s.startISO.startsWith(todayStr)) ?? null;
  }
}


export const api = new MediflowApiService();
if (typeof window !== 'undefined') {
  (window as any).api = api;
}
export type { MediflowApiService };
