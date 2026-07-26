import { supabase } from '../lib/supabaseClient';

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

  // Synchronously auto-ingest incoming Postgres CDC payloads into localStorage cache
  private static autoIngestPayload(tableName: string, payload: any) {
    try {
      const record = payload.new || payload.old;
      if (!record) return;

      const storageMap: Record<string, string> = {
        'appointments': 'saas_appointments',
        'financial_ledgers': 'financial_ledgers',
        'unified_invoices': 'unified_invoices',
        'patient_registry': 'saas_patients',
        'whatsapp_sessions': 'whatsapp_sessions',
        'medicine_bills': 'saas_medicine_bills',
        'lab_requisitions': 'saas_lab_requisitions',
        'inventory_holds': 'saas_inventory_holds',
        'pathology_reports': 'saas_pathology_reports',
        'saas_invoices': 'saas_invoices',
        'saas_prescriptions': 'saas_prescriptions',
        'vitalsync_pool_settlements': 'vitalsync_pool_settlements',
        'clinic_sops': 'clinic_sops'
      };

      const storageKey = storageMap[tableName];
      if (storageKey) {
        const currentData = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (Array.isArray(currentData)) {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const idx = currentData.findIndex((item: any) => item.id === record.id || item.invoiceId === record.invoice_id);
            if (idx >= 0) {
              currentData[idx] = { ...currentData[idx], ...record };
            } else {
              currentData.push(record);
            }
          } else if (payload.eventType === 'DELETE') {
            const filtered = currentData.filter((item: any) => item.id !== record.id);
            localStorage.setItem(storageKey, JSON.stringify(filtered));
            window.dispatchEvent(new CustomEvent('mediflow-state-change'));
            return;
          }
          localStorage.setItem(storageKey, JSON.stringify(currentData));
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
