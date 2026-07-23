import { supabase } from '../lib/supabaseClient';

export interface RealtimeSubscriptionHandlers {
  onAppointmentChange?: (payload: any) => void;
  onMedicineBillChange?: (payload: any) => void;
  onLabRequisitionChange?: (payload: any) => void;
  onPatientChange?: (payload: any) => void;
  onWhatsAppSessionChange?: (payload: any) => void;
  onStatusChange?: (status: 'connected' | 'reconnecting' | 'disconnected') => void;
}

export class RealtimeSyncService {
  private static subscribers = new Set<RealtimeSubscriptionHandlers>();
  private static activeChannel: any = null;
  private static heartbeatTimer: any = null;
  private static reconnectTimer: any = null;
  private static lastPingSuccess = Date.now();
  private static currentStatus: 'connected' | 'reconnecting' | 'disconnected' = 'disconnected';

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
        } catch (_e) {}
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
          this.subscribers.forEach(s => s.onAppointmentChange?.(payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'medicine_bills' },
        (payload) => {
          console.log('[RealtimeSync] Medicine Bill change detected:', payload);
          this.subscribers.forEach(s => s.onMedicineBillChange?.(payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lab_requisitions' },
        (payload) => {
          console.log('[RealtimeSync] Lab Requisition change detected:', payload);
          this.subscribers.forEach(s => s.onLabRequisitionChange?.(payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patient_registry' },
        (payload) => {
          console.log('[RealtimeSync] Patient Registry change detected:', payload);
          this.subscribers.forEach(s => s.onPatientChange?.(payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_sessions' },
        (payload) => {
          console.log('[RealtimeSync] WhatsApp Session change detected:', payload);
          this.subscribers.forEach(s => s.onWhatsAppSessionChange?.(payload));
        }
      )
      .subscribe((status, err) => {
        console.log(`[RealtimeSync] Channel Status: ${status}`, err || '');

        if (status === 'SUBSCRIBED') {
          this.lastPingSuccess = Date.now();
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

  // ── Schedule Auto-Reconnect ────────────────────────────────────────────────
  private static scheduleAutoReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.reconnectTimer = setTimeout(() => {
      console.log('[RealtimeSync Watchdog] 🔄 Executing automated WebSocket reconnect sequence...');
      if (this.subscribers.size > 0) {
        if (this.activeChannel) {
          try { supabase.removeChannel(this.activeChannel); } catch (_e) {}
          this.activeChannel = null;
        }
        this.initGlobalChannel();
      }
    }, 800);
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
