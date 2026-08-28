import { supabase } from '../lib/supabaseClient';
import { load, save, clearStorageCache } from './apiHelper';

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
  onPoolSettlementChange?: (payload: any) => void;
  onClinicSopChange?: (payload: any) => void;
  onChronicCohortChange?: (payload: any) => void;
  onStatusChange?: (status: 'connected' | 'reconnecting' | 'disconnected') => void;
}

export class RealtimeSyncService {
  private static subscribers = new Set<RealtimeSubscriptionHandlers>();
  private static activeChannel: any = null;
  private static heartbeatTimer: any = null;
  private static reconnectTimer: any = null;
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
    if (record.patient_id !== undefined) normalized.patientId = record.patient_id;
    if (record.doctor_id !== undefined) normalized.doctorId = record.doctor_id;
    if (record.pod_id !== undefined) normalized.podId = record.pod_id;
    if (record.encounter_id !== undefined) normalized.encounterId = record.encounter_id;
    if (record.patient_code !== undefined) normalized.patientCode = record.patient_code;
    if (record.token_number !== undefined) normalized.tokenNumber = record.token_number;
    if (record.queue_status !== undefined) normalized.queueStatus = record.queue_status;
    if (record.abha_id !== undefined) normalized.abhaId = record.abha_id;
    if (record.created_at !== undefined) normalized.createdAt = record.created_at;
    if (record.updated_at !== undefined) normalized.updatedAt = record.updated_at;
    if (record.total_amount !== undefined) normalized.totalAmount = typeof record.total_amount === 'string' ? parseFloat(record.total_amount) : record.total_amount;
    if (record.doctor_fee !== undefined) normalized.doctorFee = typeof record.doctor_fee === 'string' ? parseFloat(record.doctor_fee) : record.doctor_fee;
    if (record.lab_fee !== undefined) normalized.labFee = typeof record.lab_fee === 'string' ? parseFloat(record.lab_fee) : record.lab_fee;
    if (record.pharmacy_fee !== undefined) normalized.pharmacyFee = typeof record.pharmacy_fee === 'string' ? parseFloat(record.pharmacy_fee) : record.pharmacy_fee;
    if (record.platform_fee !== undefined) normalized.platformFee = typeof record.platform_fee === 'string' ? parseFloat(record.platform_fee) : record.platform_fee;
    if (record.payment_status !== undefined) normalized.paymentStatus = record.payment_status;
    if (record.payment_method !== undefined) normalized.paymentMethod = record.payment_method;
    if (record.is_virtual !== undefined) {
      normalized.isVirtual = record.is_virtual === true;
      normalized.is_virtual = record.is_virtual === true;
    }
    if (record.virtual_date !== undefined) normalized.virtualDate = record.virtual_date;
    if (record.virtual_time !== undefined) normalized.virtualTime = record.virtual_time;
    if (record.virtual_meeting_url !== undefined) normalized.virtualMeetingUrl = record.virtual_meeting_url;
    if (record.token_number !== undefined) normalized.tokenNumber = record.token_number;
    if (record.patient_name !== undefined) normalized.patientName = record.patient_name;
    if (record.patient_phone !== undefined) normalized.patientPhone = record.patient_phone;
    if (record.queue_status !== undefined) normalized.queueStatus = record.queue_status;
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
    if (record.is_emergency !== undefined) normalized.isEmergency = record.is_emergency === true;
    if (record.medicine_name !== undefined) normalized.medicineName = record.medicine_name;
    if (record.source !== undefined) normalized.source = record.source;
    if (record.vitals !== undefined) normalized.vitals = record.vitals;
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

    return normalized;
  }

  // Synchronously auto-ingest incoming Postgres CDC payloads into apiHelper load/save storage
  // Uses 250ms debounced batching to prevent UI thrashing during bulk operations
  private static autoIngestPayload(tableName: string, payload: any) {
    try {
      // Update heartbeat — this CDC event proves the WebSocket is alive
      this.lastPingSuccess = Date.now();

      // Buffer the event for debounced batch processing
      const existing = this.cdcBuffer.get(tableName) || [];
      existing.push(payload);
      this.cdcBuffer.set(tableName, existing);

      // Debounced flush
      if (this.flushTimer) clearTimeout(this.flushTimer);
      this.flushTimer = setTimeout(() => this.flushBuffer(), this.CDC_DEBOUNCE_MS);
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
          'inventory_holds': ['inventory_holds'],
          'pathology_reports': ['pathology_reports', 'full_lab_reports'],
          'lab_reports': ['full_lab_reports', 'pathology_reports'],
          'saas_invoices': ['saas_invoices', 'unified_invoices'],
          'saas_prescriptions': ['saas_prescriptions', 'prescriptions'],
          'vitalsync_pool_settlements': ['vitalsync_pool_settlements'],
          'clinic_sops': ['clinic_sops'],
          'chronic_care_cohorts': ['chronic_care_cohorts']
        };

        const storageKeys = storageMap[tableName];
        if (!storageKeys) return;

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
        window.dispatchEvent(new CustomEvent('mediflow-state-change', { detail: { table: tableName } }));
        if (['financial_ledgers', 'unified_invoices', 'appointments', 'medicine_bills', 'lab_requisitions', 'vitalsync_pool_settlements'].includes(tableName)) {
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

  static subscribeToLiveClinicUpdates(handlers: RealtimeSubscriptionHandlers) {
    this.subscribers.add(handlers);
    
    // Notify immediate current status
    handlers.onStatusChange?.(this.currentStatus);

    if (!this.activeChannel) {
      this.initGlobalChannel();
    }

    return () => {
      this.subscribers.delete(handlers);
      if (this.subscribers.size === 0 && this.activeChannel) {
        try {
          supabase.removeChannel(this.activeChannel);
          this.activeChannel = null;
        } catch (_e) {
          /* ignore removeChannel error */
        }
        this.updateStatus('disconnected');
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
      .subscribe((status, err) => {
        console.log(`[RealtimeSync] Channel Status: ${status}`, err || '');

        if (status === 'SUBSCRIBED') {
          this.lastPingSuccess = Date.now();
          this.reconnectAttempts = 0;
          this.updateStatus('connected');
          this.startHeartbeatWatchdog();
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
