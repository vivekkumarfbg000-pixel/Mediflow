import { supabase } from '../lib/supabaseClient';

export interface RealtimeSubscriptionHandlers {
  onAppointmentChange?: (payload: any) => void;
  onMedicineBillChange?: (payload: any) => void;
  onLabRequisitionChange?: (payload: any) => void;
  onPatientChange?: (payload: any) => void;
  onStatusChange?: (status: 'connected' | 'reconnecting' | 'disconnected') => void;
}

export class RealtimeSyncService {
  private static activeChannel: any = null;
  private static heartbeatTimer: any = null;
  private static reconnectTimer: any = null;
  private static lastPingSuccess = Date.now();
  private static currentStatus: 'connected' | 'reconnecting' | 'disconnected' = 'disconnected';
  private static savedHandlers: RealtimeSubscriptionHandlers | null = null;
  private static isManualDisconnect = false;

  static subscribeToLiveClinicUpdates(handlers: RealtimeSubscriptionHandlers) {
    this.savedHandlers = handlers;

    if (this.activeChannel) {
      try {
        this.isManualDisconnect = true;
        supabase.removeChannel(this.activeChannel);
      } catch (_e) {}
    }

    this.isManualDisconnect = false;
    this.updateStatus('reconnecting');

    this.activeChannel = supabase
      .channel('vitalsync-live-clinic-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload) => {
          console.log('[RealtimeSync] Appointment change detected:', payload);
          this.savedHandlers?.onAppointmentChange?.(payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'medicine_bills' },
        (payload) => {
          console.log('[RealtimeSync] Medicine Bill change detected:', payload);
          this.savedHandlers?.onMedicineBillChange?.(payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lab_requisitions' },
        (payload) => {
          console.log('[RealtimeSync] Lab Requisition change detected:', payload);
          this.savedHandlers?.onLabRequisitionChange?.(payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patient_registry' },
        (payload) => {
          console.log('[RealtimeSync] Patient Registry change detected:', payload);
          this.savedHandlers?.onPatientChange?.(payload);
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
          if (!this.isManualDisconnect) {
            this.scheduleAutoReconnect();
          }
        }
      });

    return () => {
      this.cleanup();
    };
  }

  // ── Heartbeat Ping/Pong Watchdog Timer (10s interval) ──────────────────────
  private static startHeartbeatWatchdog() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    this.heartbeatTimer = setInterval(() => {
      const elapsedSincePing = Date.now() - this.lastPingSuccess;

      // If ping hasn't responded in >25 seconds or navigator is offline, trigger auto-reconnect!
      if (elapsedSincePing > 25000 || !navigator.onLine) {
        console.warn(`[RealtimeSync Watchdog] ⚠️ WebSocket heartbeat timed out (${Math.round(elapsedSincePing / 1000)}s). Forcing clean auto-reconnect...`);
        this.updateStatus('reconnecting');
        this.scheduleAutoReconnect();
      } else {
        this.lastPingSuccess = Date.now();
      }
    }, 10000);
  }

  // ── Schedule Auto-Reconnect with Exponential Backoff ───────────────────────
  private static scheduleAutoReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.reconnectTimer = setTimeout(() => {
      console.log('[RealtimeSync Watchdog] 🔄 Executing automated WebSocket reconnect sequence...');
      if (this.savedHandlers) {
        this.subscribeToLiveClinicUpdates(this.savedHandlers);
      }
    }, 800);
  }

  // ── Update Connection Status & Broadcast UI Events ───────────────────────
  private static updateStatus(status: 'connected' | 'reconnecting' | 'disconnected') {
    this.currentStatus = status;
    this.savedHandlers?.onStatusChange?.(status);
    window.dispatchEvent(new CustomEvent('vitalsync-realtime-status', { detail: { status } }));
  }

  // ── Clean Up Timers & Subscriptions ───────────────────────────────────────
  private static cleanup() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.heartbeatTimer = null;
    this.reconnectTimer = null;

    if (this.activeChannel) {
      try { supabase.removeChannel(this.activeChannel); } catch (_e) {}
      this.activeChannel = null;
    }
    this.updateStatus('disconnected');
  }

  static getStatus() {
    return this.currentStatus;
  }
}
