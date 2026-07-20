import { supabase } from '../lib/supabaseClient';

export interface RealtimeSubscriptionHandlers {
  onAppointmentChange?: (payload: any) => void;
  onMedicineBillChange?: (payload: any) => void;
  onLabRequisitionChange?: (payload: any) => void;
  onPatientChange?: (payload: any) => void;
}

export class RealtimeSyncService {
  private static activeChannel: any = null;

  static subscribeToLiveClinicUpdates(handlers: RealtimeSubscriptionHandlers) {
    if (this.activeChannel) {
      supabase.removeChannel(this.activeChannel);
    }

    this.activeChannel = supabase
      .channel('vitalsync-live-clinic-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload) => {
          console.log('[RealtimeSync] Appointment change detected:', payload);
          handlers.onAppointmentChange?.(payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'medicine_bills' },
        (payload) => {
          console.log('[RealtimeSync] Medicine Bill change detected:', payload);
          handlers.onMedicineBillChange?.(payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lab_requisitions' },
        (payload) => {
          console.log('[RealtimeSync] Lab Requisition change detected:', payload);
          handlers.onLabRequisitionChange?.(payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patient_registry' },
        (payload) => {
          console.log('[RealtimeSync] Patient Registry change detected:', payload);
          handlers.onPatientChange?.(payload);
        }
      )
      .subscribe((status) => {
        console.log(`[RealtimeSync] Subscribed to Live Clinic Channel. Status: ${status}`);
      });

    return () => {
      if (this.activeChannel) {
        supabase.removeChannel(this.activeChannel);
        this.activeChannel = null;
      }
    };
  }
}
