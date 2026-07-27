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
  onStatusChange?: (status: 'connected' | 'reconnecting' | 'disconnected') => void;
}

export class RealtimeSyncService {
  private static subscribers = new Set<RealtimeSubscriptionHandlers>();
  private static activeChannel: any = null;
  private static heartbeatTimer: any = null;
  private static reconnectTimer: any = null;
  private static lastPingSuccess = Date.now();
  private static currentStatus: 'connected' | 'reconnecting' | 'disconnected' = 'disconnected';

  private static normalizeRecord(record: any): any {
    if (!record || typeof record !== 'object') return record;
    const normalized: any = { ...record };

    // Map Postgres CDC snake_case fields to camelCase expected by frontend models
    if (record.patient_id !== undefined) normalized.patientId = record.patient_id;
    if (record.doctor_id !== undefined) normalized.doctorId = record.doctor_id;
    if (record.encounter_id !== undefined) normalized.encounterId = record.encounter_id;
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

    return normalized;
  }

  // Synchronously auto-ingest incoming Postgres CDC payloads into apiHelper load/save storage
  private static autoIngestPayload(tableName: string, payload: any) {
    try {
      const rawRecord = payload.new || payload.old;
      if (!rawRecord) return;
      const record = this.normalizeRecord(rawRecord);

      const storageMap: Record<string, string[]> = {
        'appointments': ['appointments'],
        'financial_ledgers': ['financial_ledgers'],
        'unified_invoices': ['unified_invoices'],
        'patient_registry': ['patients', 'patient_registry'],
        'whatsapp_sessions': ['whatsapp_sessions'],
        'medicine_bills': ['medicine_bills'],
        'lab_requisitions': ['lab_requisitions'],
        'inventory_holds': ['inventory_holds'],
        'pathology_reports': ['pathology_reports'],
        'vitalsync_pool_settlements': ['vitalsync_pool_settlements'],
        'clinic_sops': ['clinic_sops']
      };

      const storageKeys = storageMap[tableName];
      if (storageKeys) {
        for (const storageKey of storageKeys) {
          clearStorageCache(storageKey);
          const currentData = load<any[]>(storageKey, []);
          if (Array.isArray(currentData)) {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const idx = currentData.findIndex((item: any) => item.id === record.id || (record.invoiceId && item.invoiceId === record.invoiceId));
              if (idx >= 0) {
                currentData[idx] = { ...currentData[idx], ...record };
              } else {
                currentData.push(record);
              }
            } else if (payload.eventType === 'DELETE') {
              const filtered = currentData.filter((item: any) => item.id !== record.id);
              save(storageKey, filtered);
              continue;
            }
            save(storageKey, currentData);
          }
        }
      }
      window.dispatchEvent(new CustomEvent('mediflow-state-change'));
      if (['financial_ledgers', 'unified_invoices', 'appointments', 'medicine_bills', 'lab_requisitions', 'vitalsync_pool_settlements'].includes(tableName)) {
        window.dispatchEvent(new CustomEvent('mediflow-financial-update'));
      }
    } catch (e) {
      console.warn('[RealtimeSync] Auto-ingest payload warning:', e);
    }
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
      const elapsedSincePing = Date.now() - this.lastPingSuccess;

      if (elapsedSincePing > 25000 || !navigator.onLine) {
        console.warn(`[RealtimeSync Watchdog] ⚠️ WebSocket heartbeat timed out (${Math.round(elapsedSincePing / 1000)}s). Forcing clean auto-reconnect...`);
        this.updateStatus('reconnecting');
        this.scheduleAutoReconnect();
      } else {
        this.lastPingSuccess = Date.now();
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
}
