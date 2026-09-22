import { BillingService } from '../services/billingService';
import { api } from '../services/api';

/**
 * Single source of truth for payment verification used by all consoles.
 * Returns true if the appointment is paid, or if an invoice associated with the patient is paid.
 */
export function isAppointmentPaid(patientId: string): boolean {
  if (!patientId) return false;
  
  const unifiedInvoices = BillingService.getUnifiedInvoices();
  const saasInvoices = BillingService.getInvoices();
  const allInvoices = [...unifiedInvoices, ...saasInvoices];
  
  const isPaidInvoice = allInvoices.some(i => 
    (i.patientId === patientId || (i as any).patient_id === patientId) && 
    ((i as any).paymentStatus === 'cleared' || 
     (i as any).paymentStatus === 'paid' || 
     (i as any).status === 'paid' || 
     (i as any).status === 'cleared')
  );
  
  const appointments = api.getAppointments();
  const hasPaidAppt = appointments.some(a => 
    (a.patientId === patientId || (a as any).patient_id === patientId) && 
    a.status !== 'pending_payment' &&
    a.status !== 'cancelled'
  );
  
  return isPaidInvoice || hasPaidAppt;
}
