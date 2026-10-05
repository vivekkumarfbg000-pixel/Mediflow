import { BillingService } from '../services/billingService';
import { PatientService } from '../services/patientService';
import { api } from '../services/api';

/**
 * Single source of truth for payment verification used by all consoles.
 * Returns true if the appointment is paid, or if an invoice associated with the patient is paid.
 * In accordance with Rule Zero & Directive 1: Paper scan OCR prescriptions and walk-in clinical intakes
 * are automatically granted payment clearance.
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

  // Rule Zero: Autonomous OCR prescriptions and walk-ins are sovereign cleared
  const hasPaperOrWalkinAppt = appointments.some(a =>
    (a.patientId === patientId || (a as any).patient_id === patientId) &&
    (String(a.source || (a as any).source || '').toLowerCase().includes('paper') ||
     String(a.source || (a as any).source || '').toLowerCase().includes('walkin') ||
     a.status === 'ready_for_consult')
  );

  // Check patient registry for paper_scan active queue intake
  const patients = PatientService.getPatients();
  const isRegisteredPatientActive = patients.some(p =>
    p.id === patientId &&
    ((p as any).source === 'paper_scan' || p.queueStatus === 'awaiting_consultation' || p.queueStatus === 'in_consultation')
  );
  
  return isPaidInvoice || hasPaidAppt || hasPaperOrWalkinAppt || isRegisteredPatientActive;
}
