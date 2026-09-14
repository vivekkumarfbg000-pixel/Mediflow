import { supabase } from '../lib/supabaseClient';
import { load, save, clearStorageCache, notify, broadcastStorageMutation } from './apiHelper';
import { getIstDateString } from '../utils/dateUtils';
import { getPodContext, FALLBACK_POD_ID, resolveSovereignPodId } from './podContext';
import { cloudStore, type CollectionName } from './cloudStore';

export interface RealtimeSubscriptionHandlers {
  onAppointmentChange?: (payload: any) => void;
  onMedicineBillChange?: (payload: any) => void;
  onLabRequisitionChange?: (payload: any) => void;
  onPatientChange?: (payload: any) => void;
  onWhatsAppSessionChange?: (payload: any) => void;
  onFinancialLedgerChange?: (payload: any) => void;
  onUnifiedInvoiceChange?: (payload: any) => void;
  onInventoryHoldChange?: (payload: any) => void;
  onPathologyReportChange?: (payload: any) => void;
  onSaaSInvoiceChange?: (payload: any) => void;
  onSaaSPrescriptionChange?: (payload: any) => void;
  onEncounterChange?: (payload: any) => void;
  onPoolSettlementChange?: (payload: any) => void;
  onClinicSopChange?: (payload: any) => void;
  onChronicCohortChange?: (payload: any) => void;
  onPharmacyInventoryChange?: (payload: any) => void;
  onReagentInventoryChange?: (payload: any) => void;
  onWabaConnectionChange?: (payload: any) => void;
  onReferralRewardChange?: (payload: any) => void;
  onLabTestBillChange?: (payload: any) => void;
  onStatusChange?: (status: 'connected' | 'reconnecting' | 'disconnected') => void;
}

export class RealtimeSyncService {
  private static subscribers = new Set<RealtimeSubscriptionHandlers>();
  private static activeChannel: any = null;
  private static heartbeatTimer: any = null;
  private static reconnectTimer: any = null;
  private static channelDisconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private static lastPingSuccess = Date.now();
  private static currentStatus: 'connected' | 'reconnecting' | 'disconnected' = 'disconnected';
  
  // CDC Event Batching Buffer (250ms debounce per Rule 1)
  private static cdcBuffer: Map<string, any[]> = new Map();
  private static flushTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly CDC_DEBOUNCE_MS = 250;

  private static normalizeRecord(record: any): any {
    if (!record || typeof record !== 'object') return record;
    const normalized: any = { ...record };

    // Map Postgres CDC snake_case fields to camelCase expected by frontend models
    if (record.patient_id !== undefined) { normalized.patientId = record.patient_id; normalized.patient_id = record.patient_id; }
    if (record.patientId !== undefined) { normalized.patient_id = record.patientId; normalized.patientId = record.patientId; }
    if (record.doctor_id !== undefined) { normalized.doctorId = record.doctor_id; normalized.doctor_id = record.doctor_id; }
    if (record.doctorId !== undefined) { normalized.doctor_id = record.doctorId; normalized.doctorId = record.doctorId; }
    const sovereignPod = record.pod_id || record.podId || record.clinic_id || record.clinicId || record.entity_id || record.entityId;
    if (sovereignPod !== undefined) {
      normalized.podId = sovereignPod;
      normalized.pod_id = sovereignPod;
      normalized.clinicId = sovereignPod;
      normalized.clinic_id = sovereignPod;
    }
    if (record.encounter_id !== undefined) { normalized.encounterId = record.encounter_id; normalized.encounter_id = record.encounter_id; }
    if (record.encounterId !== undefined) { normalized.encounter_id = record.encounterId; normalized.encounterId = record.encounterId; }
    if (record.patient_code !== undefined) { normalized.patientCode = record.patient_code; normalized.patient_code = record.patient_code; }
    if (record.patientCode !== undefined) { normalized.patient_code = record.patientCode; normalized.patientCode = record.patientCode; }
    if (record.token_number !== undefined) { normalized.tokenNumber = record.token_number; normalized.token_number = record.token_number; }
    if (record.tokenNumber !== undefined) { normalized.token_number = record.tokenNumber; normalized.tokenNumber = record.tokenNumber; }
    if (record.queue_status !== undefined) { normalized.queueStatus = record.queue_status; normalized.queue_status = record.queue_status; }
    if (record.queueStatus !== undefined) { normalized.queue_status = record.queueStatus; normalized.queueStatus = record.queueStatus; }
    if (record.patient_name !== undefined) { normalized.patientName = record.patient_name; normalized.patient_name = record.patient_name; }
    if (record.patientName !== undefined) { normalized.patient_name = record.patientName; normalized.patientName = record.patientName; }
    if (record.name !== undefined) { normalized.name = record.name; if (!normalized.patientName) normalized.patientName = record.name; }
    if (record.abha_id !== undefined) normalized.abhaId = record.abha_id;
    if (record.created_at !== undefined) normalized.createdAt = record.created_at;
    if (record.updated_at !== undefined) normalized.updatedAt = record.updated_at;
    if (record.total_amount !== undefined) normalized.totalAmount = typeof record.total_amount === 'string' ? parseFloat(record.total_amount) : record.total_amount;
    if (record.doctor_fee !== undefined) normalized.doctorFee = typeof record.doctor_fee === 'string' ? parseFloat(record.doctor_fee) : record.doctor_fee;
    if (record.lab_fee !== undefined) normalized.labFee = typeof record.lab_fee === 'string' ? parseFloat(record.lab_fee) : record.lab_fee;
    if (record.pharmacy_fee !== undefined) normalized.pharmacyFee = typeof record.pharmacy_fee === 'string' ? parseFloat(record.pharmacy_fee) : record.pharmacy_fee;
    if (record.platform_fee !== undefined) normalized.platformFee = typeof record.platform_fee === 'string' ? parseFloat(record.platform_fee) : record.platform_fee;
    if (record.payment_status !== undefined || record.paymentStatus !== undefined) {
      const ps = record.payment_status || record.paymentStatus;
      normalized.paymentStatus = ps;
      normalized.payment_status = ps;
    }
    if (record.payment_method !== undefined || record.paymentMethod !== undefined) {
      const pm = record.payment_method || record.paymentMethod;
      normalized.paymentMethod = pm;
      normalized.payment_method = pm;
    }
    if (record.is_virtual !== undefined || record.isVirtual !== undefined) {
      const isV = record.is_virtual === true || record.isVirtual === true;
      normalized.isVirtual = isV;
      normalized.is_virtual = isV;
    }
    if (record.virtual_date !== undefined || record.virtualDate !== undefined) {
      const vd = record.virtual_date || record.virtualDate;
      normalized.virtualDate = vd;
      normalized.virtual_date = vd;
    }
    if (record.virtual_time !== undefined || record.virtualTime !== undefined) {
      const vt = record.virtual_time || record.virtualTime;
      normalized.virtualTime = vt;
      normalized.virtual_time = vt;
    }
    if (record.virtual_meeting_url !== undefined || record.virtualMeetingUrl !== undefined) {
      const vmu = record.virtual_meeting_url || record.virtualMeetingUrl;
      normalized.virtualMeetingUrl = vmu;
      normalized.virtual_meeting_url = vmu;
    }
    if (record.appointment_time !== undefined || record.appointmentTime !== undefined) {
      const at = record.appointment_time || record.appointmentTime;
      normalized.appointmentTime = at;
      normalized.appointment_time = at;
    }
    if (record.date !== undefined) {
      normalized.date = record.date;
    } else if (record.appointment_time || record.appointmentTime) {
      normalized.date = getIstDateString(record.appointment_time || record.appointmentTime);
    } else if (record.virtual_date || record.virtualDate) {
      normalized.date = record.virtual_date || record.virtualDate;
    }
    if (record.time !== undefined) {
      normalized.time = record.time;
    } else if (record.virtual_time || record.virtualTime) {
      normalized.time = record.virtual_time || record.virtualTime;
    }
    if (record.patient_phone !== undefined || record.patientPhone !== undefined) {
      const pp = record.patient_phone || record.patientPhone;
      normalized.patientPhone = pp;
      normalized.patient_phone = pp;
    }
    if (record.biomarker_json !== undefined) normalized.biomarkerJson = record.biomarker_json;
    if (record.report_file_url !== undefined) normalized.reportFileUrl = record.report_file_url;
    if (record.test_code !== undefined) normalized.testCode = record.test_code;
    if (record.test_name !== undefined) normalized.testName = record.test_name;
    if (record.invoice_id !== undefined) normalized.invoiceId = record.invoice_id;
    if (record.requisition_id !== undefined) normalized.requisitionId = record.requisition_id;
    if (record.loinc_code !== undefined) normalized.loincCode = record.loinc_code;
    if (record.prescription_file_url !== undefined) normalized.prescriptionFileUrl = record.prescription_file_url;
    if (record.approved_by !== undefined) normalized.approvedBy = record.approved_by;
    if (record.approved_at !== undefined) normalized.approvedAt = record.approved_at;
    if (record.batch_number !== undefined) normalized.batchNumber = record.batch_number;
    if (record.expiry_date !== undefined) normalized.expiryDate = record.expiry_date;
    if (record.hold_status !== undefined) normalized.holdStatus = record.hold_status;
    if (record.reagent_deductions !== undefined) normalized.reagentDeductions = record.reagent_deductions;
    if (record.rejection_reason !== undefined) normalized.rejectionReason = record.rejection_reason;
    if (record.revisit_scheduled_at !== undefined) normalized.revisitScheduledAt = record.revisit_scheduled_at;
    if (record.revisit_note !== undefined) normalized.revisitNote = record.revisit_note;
    if (record.is_emergency !== undefined || record.isEmergency !== undefined) {
      const isEm = record.is_emergency === true || record.isEmergency === true;
      normalized.isEmergency = isEm;
      normalized.is_emergency = isEm;
    }
    if (record.is_vip !== undefined || record.isVip !== undefined) {
      const isV = record.is_vip === true || record.isVip === true;
      normalized.isVip = isV;
      normalized.is_vip = isV;
    }
    if (record.source !== undefined) {
      normalized.source = record.source;
    }
    if (record.medicine_name !== undefined) {
      normalized.medicineName = record.medicine_name;
      if (!normalized.name) normalized.name = record.medicine_name;
    }
    if (record.quantity_in_stock !== undefined && normalized.stock === undefined) {
      normalized.stock = typeof record.quantity_in_stock === 'string' ? parseInt(record.quantity_in_stock, 10) : record.quantity_in_stock;
    }
    if (record.reagent_name !== undefined) {
      normalized.reagentName = record.reagent_name;
      if (!normalized.name) normalized.name = record.reagent_name;
    }
    if (record.stock_volume !== undefined) {
      normalized.stockVolume = typeof record.stock_volume === 'string' ? parseFloat(record.stock_volume) : record.stock_volume;
    }
    if (record.threshold_volume !== undefined) {
      normalized.thresholdVolume = typeof record.threshold_volume === 'string' ? parseFloat(record.threshold_volume) : record.threshold_volume;
      normalized.threshold = normalized.thresholdVolume;
    }
    if (record.low_stock_threshold !== undefined) {
      normalized.thresholdVolume = typeof record.low_stock_threshold === 'string' ? parseFloat(record.low_stock_threshold) : record.low_stock_threshold;
      normalized.threshold = normalized.thresholdVolume;
    }
    if (record.unit_price !== undefined) {
      normalized.price = typeof record.unit_price === 'string' ? parseFloat(record.unit_price) : record.unit_price;
      normalized.unitPrice = normalized.price;
    }
    if (record.generic_name !== undefined) {
      normalized.genericName = record.generic_name;
    }
    if (record.threshold !== undefined && normalized.threshold === undefined) {
      normalized.threshold = typeof record.threshold === 'string' ? parseInt(record.threshold, 10) : record.threshold;
    }
    if (record.source !== undefined) normalized.source = record.source;
    if (record.vitals !== undefined) normalized.vitals = record.vitals;
    if (record.chronic_conditions !== undefined) normalized.chronicConditions = record.chronic_conditions;
    if (record.subtotal !== undefined) normalized.subtotal = typeof record.subtotal === 'string' ? parseFloat(record.subtotal) : record.subtotal;
    if (record.gst_amount !== undefined) normalized.gstAmount = typeof record.gst_amount === 'string' ? parseFloat(record.gst_amount) : record.gst_amount;
    if (record.payment_mode !== undefined) normalized.paymentMode = record.payment_mode;
    if (record.loyalty_discount_percent !== undefined) normalized.loyaltyDiscountPercent = record.loyalty_discount_percent;
    if (record.loyalty_discount_amount !== undefined) normalized.loyaltyDiscountAmount = record.loyalty_discount_amount;
    if (record.item_discount_amount !== undefined) normalized.itemDiscountAmount = record.item_discount_amount;
    if (record.condition !== undefined) normalized.condition = record.condition;
    if (record.tags !== undefined) normalized.tags = record.tags;
    if (record.medical_history !== undefined) normalized.medicalHistory = record.medical_history;
    if (record.eye_dilation_status !== undefined) normalized.eyeDilationStatus = record.eye_dilation_status;
    if (record.dilation_timestamp !== undefined) normalized.dilationTimestamp = record.dilation_timestamp;
    if (record.registered_at !== undefined) normalized.registeredAt = record.registered_at;
    if (record.past_reports_summary !== undefined) normalized.pastReportsSummary = record.past_reports_summary;
    if (record.referral_code !== undefined) normalized.referralCode = record.referral_code;

    // WhatsApp Sessions CDC Normalization (Rule 1 & Rule 21)
    if (record.session_data !== undefined) normalized.sessionData = record.session_data;
    if (record.chat_history !== undefined) normalized.chatHistory = record.chat_history;
    if (record.current_state !== undefined) normalized.currentState = record.current_state;
    if (record.last_active !== undefined) normalized.lastActive = record.last_active;
    if (record.unread_count !== undefined) normalized.unreadCount = record.unread_count;
    if (record.is_online !== undefined) normalized.isOnline = record.is_online;

    // Chronic Care Cohorts CDC Normalization (Rule 1 & Rule 57)
    if (record.condition_code !== undefined) normalized.conditionCode = record.condition_code;
    if (record.condition_name !== undefined) normalized.conditionName = record.condition_name;
    if (record.days_supply !== undefined) normalized.daysSupply = record.days_supply;
    if (record.dispensed_at !== undefined) normalized.dispensedAt = record.dispensed_at;
    if (record.next_refill_date !== undefined) normalized.nextRefillDate = record.next_refill_date;
    if (record.next_retest_date !== undefined) normalized.nextRetestDate = record.next_retest_date;
    if (record.retest_test_code !== undefined) normalized.retestTestCode = record.retest_test_code;
    if (record.retest_test_name !== undefined) normalized.retestTestName = record.retest_test_name;
    if (record.adherence_score !== undefined) normalized.adherenceScore = typeof record.adherence_score === 'string' ? parseFloat(record.adherence_score) : record.adherence_score;
    if (record.monthly_medicine_spend !== undefined) normalized.monthlyMedicineSpend = typeof record.monthly_medicine_spend === 'string' ? parseFloat(record.monthly_medicine_spend) : record.monthly_medicine_spend;

    // Financial Ledgers CDC Normalization (Rule 1 & Rule 34)
    if (record.gross_amount !== undefined) normalized.grossAmount = typeof record.gross_amount === 'string' ? parseFloat(record.gross_amount) : record.gross_amount;
    if (record.net_payout !== undefined) normalized.netPayout = typeof record.net_payout === 'string' ? parseFloat(record.net_payout) : record.net_payout;
    if (record.commission_rate !== undefined) normalized.commissionRate = typeof record.commission_rate === 'string' ? parseFloat(record.commission_rate) : record.commission_rate;
    if (record.transaction_type !== undefined) normalized.transactionType = record.transaction_type;
    if (record.source_entity_id !== undefined) normalized.sourceEntityId = record.source_entity_id;
    if (record.destination_entity_id !== undefined) normalized.destinationEntityId = record.destination_entity_id;
    if (record.settled_at !== undefined) normalized.settledAt = record.settled_at;

    // Clinic SOPs CDC Normalization (Rule 1 & Rule 16)
    if (record.entity_id !== undefined) normalized.entityId = record.entity_id;
    if (record.sop_document_url !== undefined) normalized.sopDocumentUrl = record.sop_document_url;
    if (record.extracted_config !== undefined) normalized.extractedConfig = record.extracted_config;
    if (record.is_active !== undefined) normalized.isActive = record.is_active === true;

    // Commission Pool Settlements CDC Normalization (Rule 1 & Rule 14)
    if (record.pool_balance !== undefined) normalized.poolBalance = typeof record.pool_balance === 'string' ? parseFloat(record.pool_balance) : record.pool_balance;
    if (record.safety_buffer !== undefined) normalized.safetyBuffer = typeof record.safety_buffer === 'string' ? parseFloat(record.safety_buffer) : record.safety_buffer;
    if (record.total_refilled !== undefined) normalized.totalRefilled = typeof record.total_refilled === 'string' ? parseFloat(record.total_refilled) : record.total_refilled;
    if (record.last_refilled_at !== undefined) normalized.lastRefilledAt = record.last_refilled_at;

    // SaaS Invoices CDC Normalization (Rule 1 & Rule 33)
    if (record.appointment_id !== undefined) normalized.appointmentId = record.appointment_id;

    // Encounters & Digital Prescriptions CDC Normalization (Rule 1)
    if (record.medications !== undefined) {
      normalized.medications = record.medications;
      if (!normalized.extractedMedicines) normalized.extractedMedicines = record.medications;
    }
    if (record.extracted_medicines !== undefined || record.extractedMedicines !== undefined) {
      const em = record.extracted_medicines || record.extractedMedicines;
      normalized.extractedMedicines = em;
      normalized.extracted_medicines = em;
      if (!normalized.medications) normalized.medications = em;
    }
    if (record.diagnostic_tests !== undefined || record.diagnosticTests !== undefined) {
      const dt = record.diagnostic_tests || record.diagnosticTests;
      normalized.diagnosticTests = dt;
      normalized.diagnostic_tests = dt;
    }
    if (record.clinical_notes !== undefined || record.clinicalNotes !== undefined) {
      const cn = record.clinical_notes || record.clinicalNotes;
      normalized.clinicalNotes = cn;
      normalized.clinical_notes = cn;
    }
    if (record.extracted_tests !== undefined || record.extractedTests !== undefined) {
      const et = record.extracted_tests || record.extractedTests;
      normalized.extractedTests = et;
      normalized.extracted_tests = et;
    }

    return normalized;
  }

  // Synchronously auto-ingest incoming Postgres CDC payloads into apiHelper load/save storage
  // Uses 250ms debounced batching for telemetry while immediately flushing clinical workflows (<10ms)
  private static autoIngestPayload(tableName: string, payload: any) {
    try {
      // Update heartbeat — this CDC event proves the WebSocket is alive
      this.lastPingSuccess = Date.now();

      // Buffer the event for debounced batch processing
      const existing = this.cdcBuffer.get(tableName) || [];
      existing.push(payload);
      this.cdcBuffer.set(tableName, existing);

      // Rule 1: Immediate clinical workflow tables flush synchronously for instant 0ms cross-console triage
      const IMMEDIATE_FLUSH_TABLES = new Set([
        'appointments',
        'patient_registry',
        'encounters',
        'saas_prescriptions',
        'prescriptions',
        'medicine_bills',
        'lab_requisitions',
        'inventory_holds',
        'unified_invoices'
      ]);

      if (IMMEDIATE_FLUSH_TABLES.has(tableName)) {
        if (this.flushTimer) clearTimeout(this.flushTimer);
        this.flushBuffer();
      } else {
        // Debounced flush for high-frequency telemetry / ledgers
        if (this.flushTimer) clearTimeout(this.flushTimer);
        this.flushTimer = setTimeout(() => this.flushBuffer(), this.CDC_DEBOUNCE_MS);
      }
    } catch (e) {
      console.warn('[RealtimeSync] Auto-ingest payload warning:', e);
    }
  }

  private static deduplicateEvents(events: any[]): any[] {
    // Deduplicate by primary key (id) keeping the last event
    const seen = new Map<string, any>();
    for (const event of events) {
      const rawRecord = event.new || event.old;
      if (!rawRecord) continue;
      const id = rawRecord.id || rawRecord.invoice_id || rawRecord.requisition_id;
      if (id) seen.set(id, event);
    }
    return Array.from(seen.values());
  }

  private static flushBuffer() {
    try {
      this.cdcBuffer.forEach((events, tableName) => {
        // Deduplicate by primary key
        const deduped = this.deduplicateEvents(events);
        
        const storageMap: Record<string, string[]> = {
          'appointments': ['saas_appointments', 'appointments'],
          'financial_ledgers': ['financial_ledgers'],
          'unified_invoices': ['unified_invoices'],
          'patient_registry': ['patients', 'patient_registry'],
          'whatsapp_sessions': ['whatsapp_sessions'],
          'medicine_bills': ['medicine_bills'],
          'lab_requisitions': ['lab_requisitions'],
          'lab_test_bills': ['lab_test_bills'],
          'inventory_holds': ['inventory_holds'],
          'pathology_reports': ['pathology_reports', 'full_lab_reports'],
          'lab_reports': ['full_lab_reports', 'pathology_reports'],
          'saas_invoices': ['saas_invoices', 'unified_invoices'],
          'saas_prescriptions': ['saas_prescriptions', 'prescriptions'],
          'encounters': ['encounters'],
          'vitalsync_pool_settlements': ['vitalsync_pool_settlements'],
          'clinic_sops': ['clinic_sops'],
          'chronic_care_cohorts': ['chronic_care_cohorts'],
          'pharmacy_inventory': ['pharmacy_inventory', 'mediflow_inventory'],
          'reagent_inventory': ['reagents', 'reagent_inventory'],
          'waba_connections': ['waba_connections'],
          'patient_referral_rewards': ['patient_referral_rewards']
        };

        const storageKeys = storageMap[tableName];
        if (!storageKeys) return;

        // Synchronize patient sub-maps (tokens_map, vitals_map, queue_status_map) directly on patient_registry CDC
        if (tableName === 'patient_registry') {
          try {
            const tokensMap = load<Record<string, string>>('tokens_map', {});
            const vitalsMap = load<Record<string, any>>('vitals_map', {});
            const queueStatusMap = load<Record<string, string>>('queue_status_map', {});
            let mapsUpdated = false;

            for (const payload of deduped) {
              const rawRecord = payload.new;
              if (!rawRecord || !rawRecord.id) continue;
              if (rawRecord.token_number || rawRecord.tokenNumber) {
                tokensMap[rawRecord.id] = String(rawRecord.token_number || rawRecord.tokenNumber);
                mapsUpdated = true;
              }
              if (rawRecord.vitals) {
                vitalsMap[rawRecord.id] = rawRecord.vitals;
                mapsUpdated = true;
              }
              if (rawRecord.queue_status || rawRecord.queueStatus) {
                queueStatusMap[rawRecord.id] = rawRecord.queue_status || rawRecord.queueStatus;
                mapsUpdated = true;
              }
            }
            if (mapsUpdated) {
              save('tokens_map', tokensMap);
              save('vitals_map', vitalsMap);
              save('queue_status_map', queueStatusMap);
            }
          } catch (_e) {}
        // 🌟 SOVEREIGN CLOUD STORE INGESTION: Apply live CDC diff in <5ms
        const colName = (tableName === 'patient_registry' ? 'patients' : tableName) as CollectionName;
        for (const payload of deduped) {
          const rawRecord = payload.new || payload.old;
          if (!rawRecord) continue;
          const record = this.normalizeRecord(rawRecord);
          cloudStore.ingestCdcFrame(colName, payload.eventType, record);
        }

        // Single read-modify-write per table
        for (const storageKey of storageKeys) {
          clearStorageCache(storageKey);
          let currentData = load<any[]>(storageKey, []);
          if (!Array.isArray(currentData)) continue;

          for (const payload of deduped) {
            const rawRecord = payload.new || payload.old;
            if (!rawRecord) continue;
            const record = this.normalizeRecord(rawRecord);

            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const idx = currentData.findIndex((item: any) => item.id === record.id);
              if (idx >= 0) {
                currentData[idx] = { ...currentData[idx], ...record };
              } else {
                currentData.push(record);
              }
            } else if (payload.eventType === 'DELETE') {
              currentData = currentData.filter((item: any) => item.id !== record.id);
            }
          }
          save(storageKey, currentData);
        }

        // Single event dispatch per table
        notify();
        window.dispatchEvent(new CustomEvent('mediflow-state-change', { detail: { table: tableName } }));
        if (['financial_ledgers', 'unified_invoices', 'appointments', 'medicine_bills', 'lab_requisitions', 'lab_test_bills', 'vitalsync_pool_settlements'].includes(tableName)) {
          window.dispatchEvent(new CustomEvent('mediflow-financial-update', { detail: { table: tableName } }));
        }
      });
    } catch (e) {
      console.warn('[RealtimeSync] Flush buffer warning:', e);
    } finally {
      this.cdcBuffer.clear();
      this.flushTimer = null;
    }
  }

  // Synchronously auto-ingest incoming Postgres CDC payloads into apiHelper load/save storage (legacy sync path)
  // @deprecated Use buffered autoIngestPayload instead
  private static autoIngestPayloadLegacy(tableName: string, payload: any): void {
    // Legacy implementation kept for reference
  }

  // Cloud Hydration Deduplication & Throttling (Prevents egress spikes on component mounts / HMR)
  private static lastHydrationTime = 0;
  private static inFlightHydration: Promise<void> | null = null;
  private static readonly HYDRATION_THROTTLE_MS = 2_000;

  // ── 360° Realtime Cloud-First Boot & Data Hydration Engine ────────────────
  static async fetchInitialCloudData(forcedPodId?: string, bypassThrottle = false): Promise<void> {
    const now = Date.now();
    if (!bypassThrottle && (now - this.lastHydrationTime < this.HYDRATION_THROTTLE_MS)) {
      return;
    }
    if (this.inFlightHydration) {
      return this.inFlightHydration;
    }

    this.inFlightHydration = (async () => {
      try {
        const currentPodId = resolveSovereignPodId(forcedPodId);
        const isFiltered = Boolean(currentPodId);

        const buildQuery = (tableName: string) => {
          let q = supabase.from(tableName).select('*').limit(60);
          if (tableName === 'whatsapp_sessions') {
            q = q.order('last_interaction', { ascending: false });
          } else if (tableName === 'pharmacy_inventory' || tableName === 'reagent_inventory') {
            q = q.order('updated_at', { ascending: false });
          } else {
            q = q.order('created_at', { ascending: false });
          }
          if (isFiltered && currentPodId !== FALLBACK_POD_ID) {
            q = q.or(`pod_id.eq.${currentPodId},pod_id.eq.${FALLBACK_POD_ID},pod_id.is.null`);
          }
          return q;
        };

        const [
          apptsRes,
          patsRes,
          invoicesRes,
          ledgersRes,
          sessionsRes,
          medBillsRes,
          labReqsRes,
          labBillsRes,
          reportsRes,
          poolRes,
          sopsRes,
          chronicRes,
          encountersRes,
          rxRes,
          holdsRes,
          pharmacyRes,
          reagentsRes
        ] = await Promise.allSettled([
          buildQuery('appointments'),
          buildQuery('patient_registry'),
          buildQuery('unified_invoices'),
          buildQuery('financial_ledgers'),
          buildQuery('whatsapp_sessions'),
          buildQuery('medicine_bills'),
          buildQuery('lab_requisitions'),
          buildQuery('lab_test_bills'),
          buildQuery('pathology_reports'),
          buildQuery('vitalsync_pool_settlements'),
          buildQuery('clinic_sops'),
          buildQuery('chronic_care_cohorts'),
          buildQuery('encounters'),
          buildQuery('saas_prescriptions'),
          buildQuery('inventory_holds'),
          buildQuery('pharmacy_inventory'),
          buildQuery('reagent_inventory')
        ]);

        const handleTableSync = (res: PromiseSettledResult<any>, tableName: string, storageKeys: string[], colName: CollectionName) => {
          if (res.status === 'fulfilled' && res.value && Array.isArray(res.value.data)) {
            const normalized = res.value.data.map((r: any) => this.normalizeRecord(r));

            // 🌟 AUTHORITATIVE CLOUD SSOT: Replaces obsolete records; prevents zombie resurrection
            cloudStore.setAuthoritativeCloudCollection(colName, normalized);

            for (const key of storageKeys) {
              clearStorageCache(key);
              save(key, normalized, false);
            }
          }
        };

        handleTableSync(apptsRes, 'appointments', ['saas_appointments', 'appointments'], 'appointments');
        handleTableSync(patsRes, 'patient_registry', ['patients', 'patient_registry'], 'patients');
        handleTableSync(invoicesRes, 'unified_invoices', ['unified_invoices', 'saas_invoices'], 'unified_invoices');
        handleTableSync(ledgersRes, 'financial_ledgers', ['financial_ledgers'], 'financial_ledgers');
        handleTableSync(sessionsRes, 'whatsapp_sessions', ['whatsapp_sessions'], 'whatsapp_sessions');
        handleTableSync(medBillsRes, 'medicine_bills', ['medicine_bills'], 'medicine_bills');
        handleTableSync(labReqsRes, 'lab_requisitions', ['lab_requisitions'], 'lab_requisitions');
        handleTableSync(labBillsRes, 'lab_test_bills', ['lab_test_bills'], 'lab_test_bills');
        handleTableSync(reportsRes, 'pathology_reports', ['pathology_reports', 'full_lab_reports'], 'pathology_reports');
        handleTableSync(poolRes, 'vitalsync_pool_settlements', ['vitalsync_pool_settlements'], 'clinic_sops');
        handleTableSync(sopsRes, 'clinic_sops', ['clinic_sops'], 'clinic_sops');
        handleTableSync(chronicRes, 'chronic_care_cohorts', ['chronic_care_cohorts'], 'chronic_care_cohorts');
        handleTableSync(encountersRes, 'encounters', ['encounters'], 'encounters');
        handleTableSync(rxRes, 'saas_prescriptions', ['saas_prescriptions', 'prescriptions'], 'saas_prescriptions');
        handleTableSync(holdsRes, 'inventory_holds', ['inventory_holds'], 'inventory_holds');
        handleTableSync(pharmacyRes, 'pharmacy_inventory', ['pharmacy_inventory', 'mediflow_inventory'], 'pharmacy_inventory');
        handleTableSync(reagentsRes, 'reagent_inventory', ['reagents', 'reagent_inventory'], 'reagent_inventory');

        this.lastHydrationTime = Date.now();
        broadcastStorageMutation();
        notify();
        window.dispatchEvent(new CustomEvent('mediflow-state-change', { detail: { source: 'cloud_hydration' } }));
        window.dispatchEvent(new CustomEvent('mediflow-financial-update', { detail: { source: 'cloud_hydration' } }));
      } catch (err) {
        console.warn('[RealtimeSync] Cloud hydration non-blocking warning:', err);
      } finally {
        this.inFlightHydration = null;
      }
    })();

    return this.inFlightHydration;
  }

  static subscribeToLiveClinicUpdates(handlers: RealtimeSubscriptionHandlers) {
    this.subscribers.add(handlers);
    
    // Clear pending graceful disconnect timer if a new subscriber mounted
    if (this.channelDisconnectTimer) {
      clearTimeout(this.channelDisconnectTimer);
      this.channelDisconnectTimer = null;
    }

    // Notify immediate current status
    handlers.onStatusChange?.(this.currentStatus);

    // Initial non-blocking cloud hydration
    this.fetchInitialCloudData().catch(() => {});

    if (!this.activeChannel) {
      this.initGlobalChannel();
    }

    return () => {
      this.subscribers.delete(handlers);
      // Enterprise Singleton Invariant: Keep connection alive across transient React unmounts
      if (this.subscribers.size === 0 && this.activeChannel) {
        if (this.channelDisconnectTimer) clearTimeout(this.channelDisconnectTimer);
        this.channelDisconnectTimer = setTimeout(() => {
          if (this.subscribers.size === 0 && this.activeChannel) {
            try {
              supabase.removeChannel(this.activeChannel);
              this.activeChannel = null;
            } catch (_e) {
              /* ignore removeChannel error */
            }
            this.updateStatus('disconnected');
          }
        }, 30_000); // 30-second graceful buffer for seamless tab transitions
      }
    };
  }

  private static initGlobalChannel() {
    this.updateStatus('reconnecting');

    this.activeChannel = supabase
      .channel('vitalsync-live-clinic-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload) => {
          console.log('[RealtimeSync] Appointment change detected:', payload);
          this.autoIngestPayload('appointments', payload);
          this.subscribers.forEach(s => s.onAppointmentChange?.(payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'medicine_bills' },
        (payload) => {
          console.log('[RealtimeSync] Medicine Bill change detected:', payload);
          this.autoIngestPayload('medicine_bills', payload);
          this.subscribers.forEach(s => s.onMedicineBillChange?.(payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lab_requisitions' },
        (payload) => {
          console.log('[RealtimeSync] Lab Requisition change detected:', payload);
          this.autoIngestPayload('lab_requisitions', payload);
          this.subscribers.forEach(s => s.onLabRequisitionChange?.(payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lab_test_bills' },
        (payload) => {
          console.log('[RealtimeSync] Lab Test Bill change detected:', payload);
          this.autoIngestPayload('lab_test_bills', payload);
          this.subscribers.forEach(s => (s as any).onLabTestBillChange?.(payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patient_registry' },
        (payload) => {
          console.log('[RealtimeSync] Patient Registry change detected:', payload);
          this.autoIngestPayload('patient_registry', payload);
          this.subscribers.forEach(s => s.onPatientChange?.(payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_sessions' },
        (payload) => {
          console.log('[RealtimeSync] WhatsApp Session change detected:', payload);
          this.autoIngestPayload('whatsapp_sessions', payload);
          this.subscribers.forEach(s => s.onWhatsAppSessionChange?.(payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'financial_ledgers' },
        (payload) => {
          console.log('[RealtimeSync] Financial Ledger change detected:', payload);
          this.autoIngestPayload('financial_ledgers', payload);
          this.subscribers.forEach(s => s.onFinancialLedgerChange?.(payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'unified_invoices' },
        (payload) => {
          console.log('[RealtimeSync] Unified Invoice change detected:', payload);
          this.autoIngestPayload('unified_invoices', payload);
          this.subscribers.forEach(s => s.onUnifiedInvoiceChange?.(payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_holds' },
        (payload) => {
          console.log('[RealtimeSync] Inventory Hold change detected:', payload);
          this.autoIngestPayload('inventory_holds', payload);
          this.subscribers.forEach(s => s.onInventoryHoldChange?.(payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pathology_reports' },
        (payload) => {
          console.log('[RealtimeSync] Pathology Report change detected:', payload);
          this.autoIngestPayload('pathology_reports', payload);
          this.subscribers.forEach(s => s.onPathologyReportChange?.(payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lab_reports' },
        (payload) => {
          console.log('[RealtimeSync] Lab Report change detected:', payload);
          this.autoIngestPayload('lab_reports', payload);
          this.subscribers.forEach(s => s.onPathologyReportChange?.(payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'saas_invoices' },
        (payload) => {
          console.log('[RealtimeSync] SaaS Invoice change detected:', payload);
          this.autoIngestPayload('saas_invoices', payload);
          this.subscribers.forEach(s => s.onSaaSInvoiceChange?.(payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'saas_prescriptions' },
        (payload) => {
          console.log('[RealtimeSync] SaaS Prescription change detected:', payload);
          this.autoIngestPayload('saas_prescriptions', payload);
          this.subscribers.forEach(s => s.onSaaSPrescriptionChange?.(payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'encounters' },
        (payload) => {
          console.log('[RealtimeSync] Encounter change detected:', payload);
          this.autoIngestPayload('encounters', payload);
          this.subscribers.forEach(s => s.onEncounterChange?.(payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vitalsync_pool_settlements' },
        (payload) => {
          console.log('[RealtimeSync] Pool Settlement change detected:', payload);
          this.autoIngestPayload('vitalsync_pool_settlements', payload);
          this.subscribers.forEach(s => s.onPoolSettlementChange?.(payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clinic_sops' },
        (payload) => {
          console.log('[RealtimeSync] Clinic SOP change detected:', payload);
          this.autoIngestPayload('clinic_sops', payload);
          this.subscribers.forEach(s => s.onClinicSopChange?.(payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chronic_care_cohorts' },
        (payload) => {
          console.log('[RealtimeSync] Chronic Care Cohort change detected:', payload);
          this.autoIngestPayload('chronic_care_cohorts', payload);
          this.subscribers.forEach(s => s.onChronicCohortChange?.(payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pharmacy_inventory' },
        (payload) => {
          console.log('[RealtimeSync] Pharmacy Inventory change detected:', payload);
          this.autoIngestPayload('pharmacy_inventory', payload);
          this.subscribers.forEach(s => s.onPharmacyInventoryChange?.(payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reagent_inventory' },
        (payload) => {
          console.log('[RealtimeSync] Reagent Inventory change detected:', payload);
          this.autoIngestPayload('reagent_inventory', payload);
          this.subscribers.forEach(s => s.onReagentInventoryChange?.(payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waba_connections' },
        (payload) => {
          console.log('[RealtimeSync] WABA Connection change detected:', payload);
          this.autoIngestPayload('waba_connections', payload);
          this.subscribers.forEach(s => s.onWabaConnectionChange?.(payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patient_referral_rewards' },
        (payload) => {
          console.log('[RealtimeSync] Referral Reward change detected:', payload);
          this.autoIngestPayload('patient_referral_rewards', payload);
          this.subscribers.forEach(s => s.onReferralRewardChange?.(payload));
        }
      )
      .subscribe((status, err) => {
        console.log(`[RealtimeSync] Channel Status: ${status}`, err || '');

        if (status === 'SUBSCRIBED') {
          this.lastPingSuccess = Date.now();
          this.reconnectAttempts = 0;
          this.updateStatus('connected');
          this.startHeartbeatWatchdog();
          this.fetchInitialCloudData().catch(() => {});
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.updateStatus('reconnecting');
          this.scheduleAutoReconnect();
        }
      });
  }

  // ── Heartbeat Ping/Pong Watchdog Timer (10s interval) ──────────────────────
  private static startHeartbeatWatchdog() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    this.heartbeatTimer = setInterval(() => {
      // Refresh heartbeat timestamp if channel is joined and browser is online
      const isJoined = this.activeChannel && (this.activeChannel as any).state === 'joined';
      if (isJoined && navigator.onLine) {
        this.lastPingSuccess = Date.now();
        return;
      }

      const elapsedSincePing = Date.now() - this.lastPingSuccess;

      if (elapsedSincePing > 25000 || !navigator.onLine) {
        console.warn(`[RealtimeSync Watchdog] ⚠️ WebSocket heartbeat timed out (${Math.round(elapsedSincePing / 1000)}s). Forcing clean auto-reconnect...`);
        if (this.currentStatus !== 'reconnecting') {
          this.updateStatus('reconnecting');
          this.scheduleAutoReconnect();
        }
      }
    }, 10000);
  }

  private static reconnectAttempts = 0;

  // ── Schedule Auto-Reconnect ────────────────────────────────────────────────
  private static scheduleAutoReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.reconnectAttempts++;
    const backoffMs = Math.min(800 * Math.pow(2, Math.min(this.reconnectAttempts - 1, 4)), 10000); // 800ms, 1.6s, 3.2s, 6.4s, max 10s

    this.reconnectTimer = setTimeout(() => {
      console.log(`[RealtimeSync Watchdog] 🔄 Executing automated WebSocket reconnect sequence (attempt ${this.reconnectAttempts}, backoff: ${backoffMs}ms)...`);
      if (this.subscribers.size > 0) {
        if (this.activeChannel) {
          try { supabase.removeChannel(this.activeChannel); } catch (_e) { /* ignore error */ }
          this.activeChannel = null;
        }
        this.initGlobalChannel();
      }
    }, backoffMs);
  }

  // ── Update Connection Status & Broadcast UI Events ───────────────────────
  private static updateStatus(status: 'connected' | 'reconnecting' | 'disconnected') {
    this.currentStatus = status;
    this.subscribers.forEach(s => s.onStatusChange?.(status));
    window.dispatchEvent(new CustomEvent('vitalsync-realtime-status', { detail: { status } }));
  }

  static getStatus() {
    return this.currentStatus;
  }

  // ── Complete Teardown & Unsubscribe on Logout ───────────────────────────
  static teardown() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.activeChannel) {
      try {
        supabase.removeChannel(this.activeChannel);
      } catch (_e) { /* ignore */ }
      this.activeChannel = null;
    }
    this.subscribers.clear();
    this.updateStatus('disconnected');
  }
}

// Auto-Rehydration & Channel Reconnection on Network Online Restoration
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[RealtimeSync] Network online detected — re-hydrating cloud tables and validating channel status...');
    RealtimeSyncService.fetchInitialCloudData().catch(() => {});
  });
}
