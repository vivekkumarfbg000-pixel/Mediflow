import { supabase } from '../lib/supabaseClient';
import { load, save, writeAuditLog, notify } from './apiHelper';
import { PatientService } from './patientService';
import { MASTER_TEST_CATALOG } from './labService';
import type { UnifiedInvoice, FinancialLedgerEntry, Invoice, Appointment, Prescription, ClinicSop, Patient } from '../types';
import { getPodContext } from './podContext';

export class BillingService {
  static getUnifiedInvoices(): UnifiedInvoice[] {
    let isDemoAccount = false;
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('vitalsync_cached_profile');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed) {
            const email = String(parsed.email || '').toLowerCase();
            const id = String(parsed.id || '').toLowerCase();
            isDemoAccount = Boolean(
              parsed.isDemo === true ||
              email === 'demo@mediflow.com' ||
              email === 'doctor@mediflow.com' ||
              id === 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101'
            );
          }
        }
      } catch (_e) { /* ignore */ }
    }

    let invoices = load<UnifiedInvoice[]>('unified_invoices', []);
    if (!isDemoAccount) {
      const currentPodId = getPodContext().podId;
      const demoPatientIds = new Set([
        'dfb2a1a8-8e68-4f8a-929e-4a6c8e317401', 
        'dfb2a1a8-8e68-4f8a-929e-4a6c8e317402',
        'pat-101', 'pat-102', 'pat-103'
      ]);
      const demoNames = new Set(['aarav sharma', 'priyanka verma', 'rahul kumar test', 'rls test patient', 'patient customer', 'unknown']);
      invoices = invoices.filter(i => {
        const pod = (i as any).podId || (i as any).pod_id;
        if (pod && currentPodId && pod !== currentPodId) return false;
        if (!pod && currentPodId) return false;
        const id = i.id || '';
        const pName = String(i.patientName || '').toLowerCase();
        const pId = String(i.patientId || '');
        if (id.startsWith('inv-demo') || id.startsWith('inv-sample') || id.startsWith('inv-101') || id.startsWith('inv-102')) return false;
        if (demoNames.has(pName)) return false;
        if (demoPatientIds.has(pId)) return false;
        return true;
      });
    }
    let modified = false;
    invoices.forEach(i => {
      if (i.doctorFee === 450) {
        i.doctorFee = 500;
        i.totalAmount = (i.doctorFee || 500) + (i.labFee || 0) + (i.pharmacyFee || 0);
        modified = true;
      }
    });
    if (modified) {
      save('unified_invoices', invoices);
    }
    return invoices;
  }

  static saveFinancialLedgers(entries: FinancialLedgerEntry[]): void {
    save('financial_ledgers', entries);
    notify();
  }

  static saveAppointments(appointments: Appointment[]): void {
    save('saas_appointments', appointments);
    notify();
  }

  static clearInvoice(invoiceId: string, paymentMethod: 'cash' | 'upi' | 'card' | 'razorpay' | 'cashfree' | 'paytm' | 'phonepe' = 'upi'): void {
    const invoices = this.getUnifiedInvoices();
    const idx = invoices.findIndex(i => i.id === invoiceId);
    if (idx !== -1) {
      invoices[idx].paymentStatus = 'cleared';
      invoices[idx].paymentMethod = paymentMethod;
      save('unified_invoices', invoices);
    } else {
      const saasInvoices = this.getInvoices();
      const saasIdx = saasInvoices.findIndex(i => i.id === invoiceId);
      if (saasIdx !== -1) {
        saasInvoices[saasIdx].status = 'paid';
        saasInvoices[saasIdx].paymentMethod = paymentMethod;
        save('saas_invoices', saasInvoices);
        
        const appts = this.getAppointments();
        const targetAppt = appts.find(a => a.id === saasInvoices[saasIdx].appointmentId);
        if (targetAppt) {
          targetAppt.status = 'confirmed';
          save('saas_appointments', appts);
        }
      }
    }
    
    if (idx !== -1) {

      const inv = invoices[idx];
      const invoiceAmount = inv.totalAmount || 500;

      // STEP 1: First split / deduct 3% platform fee into VitalSync
      const platformAmt = parseFloat((invoiceAmount * 0.03).toFixed(2));
      const netRemainingForPool = Math.max(0, parseFloat((invoiceAmount - platformAmt).toFixed(2)));

      // Core Invoice Settlement & Financial Ledger Splits (Local IndexedDB)
      this.recordInvoicePayment(invoiceId, paymentMethod);

      const sessions = load<any[]>('whatsapp_sessions', []);
      const session = sessions.find(s => s.patientPhone === inv.patientPhone);
      if (session?.sessionData?.referral) {
        const ref = session.sessionData.referral;
        const ledgerEntries = load<FinancialLedgerEntry[]>('financial_ledgers', []);
        
        const platformAmt = parseFloat((invoiceAmount * 0.03).toFixed(2));
        
        const referralLedger: FinancialLedgerEntry = {
          id: `tx-ref-${crypto.randomUUID().substring(0, 8)}`,
          invoiceId: invoiceId,
          sourceEntityId: 'clinic-admin-entity',
          destinationEntityId: 'clinic-admin-entity',
          transactionType: 'appointment_fee',
          grossAmount: invoiceAmount,
          commissionRate: 0.10,
          netPayout: ref.referralCommissionAmt || parseFloat((invoiceAmount * 0.10).toFixed(2)),
          paymentStatus: 'cleared',
          settledAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };

        const platformLedger: FinancialLedgerEntry = {
          id: `tx-plat-ref-${crypto.randomUUID().substring(0, 8)}`,
          invoiceId: invoiceId,
          sourceEntityId: 'clinic-admin-entity',
          destinationEntityId: 'platform-admin-entity',
          transactionType: 'platform_fee',
          grossAmount: invoiceAmount,
          commissionRate: 0.03,
          netPayout: platformAmt,
          paymentStatus: 'cleared',
          settledAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };

        ledgerEntries.unshift(referralLedger, platformLedger);
        save('financial_ledgers', ledgerEntries);

        session.sessionData.referral = null;
        save('whatsapp_sessions', sessions);
      }

      // Clear patient inventory holds (Local IndexedDB)
      if (inv.pharmacyFee > 0) {
        const holds = load<any[]>('inventory_holds', []);
        let holdsUpdated = false;
        holds.forEach(h => {
          if (h.patientId === inv.patientId && h.holdStatus === 'held') {
            h.holdStatus = 'dispensed';
            holdsUpdated = true;
          }
        });
        if (holdsUpdated) {
          save('inventory_holds', holds);
        }
      }

      // Atomic Backend Settlement via Postgres RPC
      supabase.rpc('process_invoice_settlement', {
        p_invoice_id: invoiceId,
        p_payment_method: paymentMethod,
        p_amount_paid: invoiceAmount
      }).then(({ error }) => {
        if (error) console.error('[BillingService] RPC process_invoice_settlement failed:', error);
        else writeAuditLog('invoice_payment_cleared', { invoiceId, paymentMethod }, invoiceId);
      });

    }
  }


  static getFinancialLedgers(invoiceId?: string): FinancialLedgerEntry[] {
    let isDemoAccount = false;
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('vitalsync_cached_profile');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed) {
            const email = String(parsed.email || '').toLowerCase();
            const id = String(parsed.id || '').toLowerCase();
            isDemoAccount = Boolean(
              parsed.isDemo === true ||
              email === 'demo@mediflow.com' ||
              email === 'doctor@mediflow.com' ||
              id === 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101'
            );
          }
        }
      } catch (_e) { /* ignore */ }
    }

    let ledgers = load<FinancialLedgerEntry[]>('financial_ledgers', []);
    if (!isDemoAccount) {
      const currentPodId = getPodContext().podId;
      const demoPatientIds = new Set([
        'dfb2a1a8-8e68-4f8a-929e-4a6c8e317401', 
        'dfb2a1a8-8e68-4f8a-929e-4a6c8e317402',
        'pat-101', 'pat-102', 'pat-103'
      ]);
      const demoNames = new Set(['aarav sharma', 'priyanka verma', 'rahul kumar test', 'rls test patient', 'patient customer', 'unknown']);
      ledgers = ledgers.filter(l => {
        const pod = (l as any).podId || (l as any).pod_id;
        if (pod && currentPodId && pod !== currentPodId) return false;
        if (!pod && currentPodId) return false;
        const id = l.id || '';
        const pName = String(l.patientName || '').toLowerCase();
        const pId = String((l as any).patientId || '');
        if (id.startsWith('tx-demo') || id.startsWith('tx-sample')) return false;
        if (demoNames.has(pName)) return false;
        if (demoPatientIds.has(pId)) return false;
        return true;
      });
    }

    let modified = false;

    // Filter out any platform_fee entries generated for consultation appointments
    const filteredLedgers = ledgers.filter(l => {
      if (l.transactionType === 'platform_fee' && (l.grossAmount === 500 || l.grossAmount === 450 || l.netPayout < 50)) {
        modified = true;
        return false;
      }
      return true;
    });

    filteredLedgers.forEach((l) => {
      if (l.transactionType === 'appointment_fee') {
        if (l.grossAmount === 450 || l.netPayout === 450) {
          l.grossAmount = 500;
          l.netPayout = 500;
          modified = true;
        }
        if (l.commissionRate !== 0) {
          l.commissionRate = 0;
          modified = true;
        }
      }
      if (!l.patientName && isDemoAccount) {
        l.patientName = 'Patient Customer';
        modified = true;
      }
    });

    // Ensure all paid invoices have corresponding financial ledger entries
    const paidInvoices = this.getInvoices().filter(i => i.status === 'paid');
    const existingInvoiceIds = new Set(filteredLedgers.map(l => l.invoiceId));

    paidInvoices.forEach(inv => {
      if (!existingInvoiceIds.has(inv.id)) {
        const appts = this.getAppointments();
        const appt = appts.find(a => a.id === inv.appointmentId);
        const patId = inv.patientId || appt?.patientId;
        const patients = PatientService.getPatients();
        const patient = patients.find(p => p.id === patId);
        const patientName = patient?.name || (inv as any).patientName || (appt as any)?.patient_name || 'Patient Customer';

        const grossAmount = inv.amount || 0;
        let transactionType: FinancialLedgerEntry['transactionType'] = 'appointment_fee';
        let commissionRate = 0;
        let netPayout = grossAmount;

        const activeSop = this.getActiveSop();
        const labDoctorSplit = activeSop?.extractedConfig?.splits?.doctor ?? 50;
        const medDoctorSplit = (activeSop?.extractedConfig?.splits as any)?.pharmacyDoctor ?? 20;

        if (inv.type === 'lab' || (inv as any).type === 'pathology') {
          transactionType = 'lab_commission';
          commissionRate = labDoctorSplit / 100;
          netPayout = Math.round(grossAmount * commissionRate);
        } else if (inv.type === 'pharmacy' || (inv as any).type === 'medicine') {
          transactionType = 'medicine_commission';
          commissionRate = medDoctorSplit / 100;
          netPayout = Math.round(grossAmount * commissionRate);
        }

        const newLedger: FinancialLedgerEntry = {
          id: `tx-auto-${(inv.id || 'N/A').substring(0, 8)}`,
          invoiceId: inv.id,
          sourceEntityId: 'clinic-admin-entity',
          destinationEntityId: 'clinic-admin-entity',
          transactionType,
          grossAmount,
          commissionRate,
          netPayout,
          paymentStatus: 'cleared',
          settledAt: inv.createdAt || new Date().toISOString(),
          createdAt: inv.createdAt || new Date().toISOString(),
          patientName,
          paymentMethod: (inv as any).paymentMethod || 'cash'
        };

        filteredLedgers.unshift(newLedger);
        modified = true;
      }
    });

    if (modified) {
      save('financial_ledgers', filteredLedgers);
    }
    if (invoiceId) {
      return filteredLedgers.filter(l => l.invoiceId === invoiceId);
    }
    return filteredLedgers;
  }

  static getAppointments(): Appointment[] {
    let isDemoAccount = false;
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('vitalsync_cached_profile');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed) {
            const email = String(parsed.email || '').toLowerCase();
            const id = String(parsed.id || '').toLowerCase();
            isDemoAccount = Boolean(
              parsed.isDemo === true ||
              email === 'demo@mediflow.com' ||
              email === 'doctor@mediflow.com' ||
              id === 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101'
            );
          }
        }
      } catch (_e) { /* ignore */ }
    }

    let appts = load<Appointment[]>('saas_appointments', []);
    if (!isDemoAccount) {
      const currentPodId = getPodContext().podId;
      const demoPatientIds = new Set([
        'dfb2a1a8-8e68-4f8a-929e-4a6c8e317401', 
        'dfb2a1a8-8e68-4f8a-929e-4a6c8e317402',
        'pat-101', 'pat-102', 'pat-103', 'pat-104', 'pat-105'
      ]);
      const demoNames = new Set([
        'aarav sharma', 'priyanka verma', 'rahul kumar test', 'rls test patient', 
        'patient customer', 'unknown', 'unknown patient', 'john doe', 'neha yadav', 
        'vikram prasad', 'vikram verma'
      ]);
      appts = appts.filter(a => {
        const pod = (a as any).podId || (a as any).pod_id;
        if (pod && currentPodId && pod !== currentPodId) return false;
        if (!pod && currentPodId) {
          (a as any).podId = currentPodId;
        }
        const id = a.id || '';
        const pName = String((a as any).patient_name || (a as any).patientName || '').toLowerCase().trim();
        const pId = String(a.patientId || (a as any).patient_id || '');
        const isExplicitDemoId = id.startsWith('appt-demo') || id.startsWith('appt-sample') || id.startsWith('appt-101') || id.startsWith('appt-102');
        if (isExplicitDemoId) return false;
        if (demoPatientIds.has(pId)) return false;
        if (pName.includes('test patient') || pName.includes('auto test')) return false;
        if (demoNames.has(pName) && (id.startsWith('appt-1') || id.startsWith('appt-2') || id.startsWith('demo-'))) return false;
        return true;
      });
    }
    return appts;
  }

  static saveAppointment(appt: Appointment): void {
    const currentPodId = getPodContext().podId;
    if (currentPodId && !(appt as any).podId && !(appt as any).pod_id) {
      (appt as any).podId = currentPodId;
    }
    const appts = this.getAppointments();
    const idx = appts.findIndex(a => a.id === appt.id);
    if (idx >= 0) appts[idx] = appt;
    else appts.push(appt);
    save('saas_appointments', appts);
    notify();
  }

  static getPatients(): Patient[] {
    return PatientService.getPatients();
  }

  static getInvoices(): Invoice[] {
    let isDemoAccount = false;
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('vitalsync_cached_profile');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed) {
            const email = String(parsed.email || '').toLowerCase();
            const id = String(parsed.id || '').toLowerCase();
            isDemoAccount = Boolean(
              parsed.isDemo === true ||
              email === 'demo@mediflow.com' ||
              email === 'doctor@mediflow.com' ||
              id === 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101'
            );
          }
        }
      } catch (_e) { /* ignore */ }
    }

    let invoices = load<Invoice[]>('saas_invoices', []);
    if (!isDemoAccount) {
      const currentPodId = getPodContext().podId;
      const demoPatientIds = new Set([
        'dfb2a1a8-8e68-4f8a-929e-4a6c8e317401', 
        'dfb2a1a8-8e68-4f8a-929e-4a6c8e317402',
        'pat-101', 'pat-102', 'pat-103'
      ]);
      const demoNames = new Set(['aarav sharma', 'priyanka verma', 'rahul kumar test', 'rls test patient', 'patient customer', 'unknown']);
      invoices = invoices.filter(i => {
        const pod = (i as any).podId || (i as any).pod_id;
        if (pod && currentPodId && pod !== currentPodId) return false;
        if (!pod && currentPodId) {
          (i as any).podId = currentPodId;
        }
        const id = i.id || '';
        const pName = String((i as any).patientName || '').toLowerCase();
        const pId = String(i.patientId || '');
        if (id.startsWith('inv-demo') || id.startsWith('inv-sample') || id.startsWith('inv-101') || id.startsWith('inv-102')) return false;
        if (demoNames.has(pName)) return false;
        if (demoPatientIds.has(pId)) return false;
        return true;
      });
    }
    return invoices;
  }

  static saveInvoice(invoice: Invoice): void {
    const currentPodId = getPodContext().podId;
    if (currentPodId && !(invoice as any).podId && !(invoice as any).pod_id) {
      (invoice as any).podId = currentPodId;
    }
    const invoices = this.getInvoices();
    const idx = invoices.findIndex(i => i.id === invoice.id);
    if (idx >= 0) invoices[idx] = invoice;
    else invoices.push(invoice);
    save('saas_invoices', invoices);
    notify();
  }

  static getPrescriptions(): Prescription[] {
    return load<Prescription[]>('saas_prescriptions', []);
  }

  static savePrescription(rx: Prescription): void {
    const currentPodId = getPodContext().podId;
    if (currentPodId && !(rx as any).podId && !(rx as any).pod_id) {
      (rx as any).podId = currentPodId;
    }
    const prescriptions = this.getPrescriptions();
    const idx = prescriptions.findIndex(p => p.id === rx.id);
    if (idx >= 0) prescriptions[idx] = rx;
    else prescriptions.push(rx);
    save('saas_prescriptions', prescriptions);
    notify();
  }

  static createGate1Consult(patientId: string, source: 'counter' | 'whatsapp' = 'counter'): Invoice {
    const apptId = crypto.randomUUID();
    const ctx = getPodContext();
 
    // Fetch dynamic consultation fee from active SOP config (default: 500)
    const activeSop = this.getActiveSop();
    const baseFee = activeSop?.extractedConfig?.doctor_fee ?? 500;
 
    // Calculate dynamic fee type based on patient visit history (First Visit vs. Follow-up vs. Free Review)
    const dynamicFeeResult = PatientService.calculateDynamicOPDFee(patientId);
    let consultFee = dynamicFeeResult.amount;
    if (dynamicFeeResult.type === 'First Visit') {
      consultFee = baseFee;
    } else if (dynamicFeeResult.type === 'Follow-up') {
      consultFee = Math.round(baseFee * 0.4); // 40% of base fee (e.g. ₹200 for ₹500 base)
    }
 
    const newInvoice: Invoice = {
      id: crypto.randomUUID(),
      podId: ctx.podId,
      appointmentId: apptId,
      type: 'consult',
      amount: consultFee,
      status: 'unpaid',
      createdAt: new Date().toISOString(),
      patientId // store patientId for ease of access
    } as any;
    this.saveInvoice(newInvoice);
    
    // SYNCHRONOUSLY save initial appointment so recordInvoicePayment never race-conditions with undefined appt
    const newAppt: Appointment = {
      id: apptId,
      podId: ctx.podId,
      patientId,
      doctorId: ctx.doctorId || 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101',
      status: 'pending_payment',
      createdAt: new Date().toISOString(),
      source
    } as any;
    this.saveAppointment(newAppt);

    const runInit = async () => {
      let resolvedDoctorId = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101'; // fallback
      try {
        const { data: doctorProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('pod_id', ctx.podId)
          .eq('role', 'doctor')
          .limit(1)
          .maybeSingle();
        if (doctorProfile?.id) {
          resolvedDoctorId = doctorProfile.id;
          // Update Doctor ID if dynamically resolved
          const appts = this.getAppointments();
          const targetAppt = appts.find(a => a.id === apptId);
          if (targetAppt) {
            targetAppt.doctorId = resolvedDoctorId;
            this.saveAppointment(targetAppt);
          }
        }
      } catch (err) {
        console.warn('[BillingService] Failed to dynamically look up doctor for consult:', err);
      }

      const patient = PatientService.getPatients().find(p => p.id === patientId);
      if (patient) {
        // Direct push WhatsApp message bot history logic
        const sessions = load<any[]>('whatsapp_sessions', []);
        const existing = sessions.find(s => s.patientPhone === patient.phone);
        if (existing) {
          const text = `🟢 *Welcome to VitalSync Connected Clinic!* \n\nYour Consultation booking is pending. Please pay the consultation fee of *₹${consultFee}* to proceed.\n\n_Payment Gateway Link: upi://pay?pa=vitalsync@axl&pn=VitalSync&am=${consultFee}.00_`;
          const currentHistory = existing.sessionData.chatHistory || [];
          currentHistory.push({ sender: 'bot', text, time: new Date().toISOString() });
          existing.sessionData = { ...existing.sessionData, chatHistory: currentHistory };
          save('whatsapp_sessions', sessions);
          
          try {
            await supabase.from('whatsapp_sessions').update({
              session_data: existing.sessionData,
              last_interaction: new Date().toISOString()
            }).eq('patient_phone', patient.phone);
          } catch (dbErr) {
            console.error('[BillingService] Failed to sync session to DB:', dbErr);
          }
        }
      }
      notify();
    };
    runInit();
    return newInvoice;
  }

  static createOTPackageInvoice(patientId: string, details: { procedure: string; eye: string; lensType: string; packageTier: string; totalAmount: number }): void {
    const apptId = crypto.randomUUID();
    const newInvoice: Invoice = {
      id: crypto.randomUUID(),
      appointmentId: apptId,
      patientId,
      type: 'ot' as any,
      amount: details.totalAmount,
      status: 'unpaid',
      createdAt: new Date().toISOString(),
      metadata: {
        procedure: details.procedure,
        eye: details.eye,
        lensType: details.lensType,
        packageTier: details.packageTier,
        advancePaid: 0,
        balanceDue: details.totalAmount
      } as any
    };
    this.saveInvoice(newInvoice);
    notify();
  }

  static recordOTAdvancePayment(invoiceId: string, advanceAmount: number): void {
    const invoices = this.getInvoices();
    const idx = invoices.findIndex(i => i.id === invoiceId);
    if (idx >= 0) {
      const inv = invoices[idx];
      const meta = inv.metadata || {};
      const newAdvance = (meta.advancePaid || 0) + advanceAmount;
      const newBalance = Math.max(0, inv.amount - newAdvance);
      
      invoices[idx] = {
        ...inv,
        metadata: {
          ...meta,
          advancePaid: newAdvance,
          balanceDue: newBalance
        } as any,
        status: newBalance === 0 ? 'paid' : 'unpaid'
      };
      
      this.saveInvoice(invoices[idx]);
      notify();
      
      const appt = this.getAppointments().find(a => a.id === inv.appointmentId);
      const patientId = appt?.patientId || inv.patientId;
      if (patientId) {
        const patient = PatientService.getPatients().find(p => p.id === patientId);
        if (patient && patient.vitals && (patient.vitals as any).surgeryBooking) {
          const booking = (patient.vitals as any).surgeryBooking;
          const updatedVitals = {
            ...patient.vitals,
            surgeryBooking: {
              ...booking,
              advancePaid: newAdvance,
              status: newBalance === 0 ? 'paid' : 'advance_paid'
            }
          };
          PatientService.saveRefractionDiagnostics(patientId, updatedVitals);
        }
      }
    }
  }

  static createGPProcedureInvoice(patientId: string, details: { procedure: string; room: string; totalAmount: number }): void {
    const apptId = crypto.randomUUID();
    const newInvoice: Invoice = {
      id: crypto.randomUUID(),
      appointmentId: apptId,
      patientId,
      type: 'gp_procedure' as any,
      amount: details.totalAmount,
      status: 'unpaid',
      createdAt: new Date().toISOString(),
      metadata: {
        procedure: details.procedure,
        room: details.room,
        advancePaid: 0,
        balanceDue: details.totalAmount
      } as any
    };
    this.saveInvoice(newInvoice);
    notify();
  }

  static recordGPProcedurePayment(invoiceId: string, paidAmount: number): void {
    const invoices = this.getInvoices();
    const idx = invoices.findIndex(i => i.id === invoiceId);
    if (idx >= 0) {
      const inv = invoices[idx];
      const meta = inv.metadata || {};
      const newAdvance = (meta.advancePaid || 0) + paidAmount;
      const newBalance = Math.max(0, inv.amount - newAdvance);
      
      invoices[idx] = {
        ...inv,
        metadata: {
          ...meta,
          advancePaid: newAdvance,
          balanceDue: newBalance
        } as any,
        status: newBalance === 0 ? 'paid' : 'unpaid'
      };
      
      this.saveInvoice(invoices[idx]);
      notify();
      
      const appt = this.getAppointments().find(a => a.id === inv.appointmentId);
      const patientId = appt?.patientId || inv.patientId;
      if (patientId) {
        const patient = PatientService.getPatients().find(p => p.id === patientId);
        if (patient && patient.vitals) {
          const booking = (patient.vitals as any).gpProcedureBooking || {};
          const updatedVitals = {
            ...patient.vitals,
            gpProcedureBooking: {
              ...booking,
              advancePaid: newAdvance,
              status: newBalance === 0 ? 'paid' : 'advance_paid'
            }
          };
          PatientService.saveRefractionDiagnostics(patientId, updatedVitals);
        }
      }
    }
  }

  static async settleSaaSInvoice(invoiceId: string): Promise<void> {
    await this.recordInvoicePayment(invoiceId);
    notify();
  }

  static async createLedgerSplitsForInvoiceFields(invoiceId: string, appointmentId: string, type: Invoice['type'], amount: number, paymentMethod: 'cash' | 'upi' | 'card' | 'razorpay' | 'cashfree' | 'paytm' | 'phonepe' = 'upi'): Promise<void> {
    const ledgerEntries = load<FinancialLedgerEntry[]>('financial_ledgers', []);
    
    // Check if splits already exist for this invoiceId
    const exists = ledgerEntries.some(l => l.invoiceId === invoiceId);
    if (exists) return;

    // Fetch platform_fee_percent for this pod from Supabase
    let platformFeePercent = 2.50; // Default fallback
    const ctx = getPodContext();
    const podId = ctx.podId;
    try {
      const { data: podData } = await supabase
        .from('pods')
        .select('platform_fee_percent')
        .eq('id', podId)
        .single();
      if (podData && podData.platform_fee_percent !== null && podData.platform_fee_percent !== undefined) {
        platformFeePercent = parseFloat(podData.platform_fee_percent.toString());
      }
    } catch (e) {
      console.warn('[BillingService] Failed to load pod fee, using 2.5% default fallback:', e);
    }

    // Fetch active SOP or use defaults for doctor/lab splits
    const activeSop = this.getActiveSop();
    const splitDoc = activeSop?.extractedConfig?.splits?.doctor ?? 40;
    const splitLab = activeSop?.extractedConfig?.splits?.lab ?? 57;

    // Resolve patient name for this invoice/appointment
    const invoices = this.getInvoices();
    const appts = this.getAppointments();
    const patients = PatientService.getPatients();
    const inv = invoices.find(i => i.id === invoiceId);
    const appt = appts.find(a => a.id === appointmentId || a.id === inv?.appointmentId);
    const patId = inv?.patientId || appt?.patientId;
    const resolvedPatient = patients.find(p => p.id === patId);
    const resolvedPatientName = resolvedPatient?.name || (inv as any)?.patientName || (appt as any)?.patient_name || 'Patient Customer';

    const listToSave: FinancialLedgerEntry[] = [];
    let platformAmt = 0;
    const isCash = paymentMethod === 'cash';

    if (type === 'consult') {
      const docAmt = amount;

      const docLedger: FinancialLedgerEntry = {
        id: `tx-doc-${crypto.randomUUID().substring(0, 8)}`,
        invoiceId: invoiceId,
        sourceEntityId: 'clinic-admin-entity',
        destinationEntityId: 'clinic-admin-entity',
        transactionType: 'appointment_fee',
        grossAmount: amount,
        commissionRate: 0,
        netPayout: docAmt,
        paymentStatus: 'cleared',
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        patientName: resolvedPatientName,
        paymentMethod
      };
      listToSave.push(docLedger);
    } else if (type === 'lab') {
      const splitPlat = paymentMethod === 'card' ? platformFeePercent + 2.00 : platformFeePercent;
      platformAmt = parseFloat((amount * (splitPlat / 100)).toFixed(2));
      
      const remainingAmt = amount - platformAmt;
      const docAmt = parseFloat((remainingAmt * (splitDoc / (splitDoc + splitLab))).toFixed(2));
      const labAmt = parseFloat((remainingAmt - docAmt).toFixed(2));

      const platformLedger: FinancialLedgerEntry = {
        id: `tx-plat-${crypto.randomUUID().substring(0, 8)}`,
        invoiceId: invoiceId,
        sourceEntityId: 'clinic-admin-entity',
        destinationEntityId: 'platform-admin-entity',
        transactionType: 'platform_fee',
        grossAmount: amount,
        commissionRate: splitPlat / 100,
        netPayout: platformAmt,
        paymentStatus: 'cleared',
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      const docLedger: FinancialLedgerEntry = {
        id: `tx-doc-${crypto.randomUUID().substring(0, 8)}`,
        invoiceId: invoiceId,
        sourceEntityId: 'clinic-admin-entity',
        destinationEntityId: 'clinic-admin-entity',
        transactionType: 'appointment_fee',
        grossAmount: amount,
        commissionRate: splitDoc / 100,
        netPayout: docAmt,
        paymentStatus: 'cleared',
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      const labLedger: FinancialLedgerEntry = {
        id: `tx-lab-${crypto.randomUUID().substring(0, 8)}`,
        invoiceId: invoiceId,
        sourceEntityId: 'clinic-admin-entity',
        destinationEntityId: 'lab-partner-entity',
        transactionType: 'lab_commission',
        grossAmount: amount,
        commissionRate: splitLab / 100,
        netPayout: labAmt,
        paymentStatus: 'cleared',
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      listToSave.push(platformLedger, docLedger, labLedger);
    } else if (type === 'pharmacy') {
      const medDoctorSplit = (activeSop?.extractedConfig?.splits as any)?.pharmacyDoctor ?? 20; // 20% SOP Doctor Referral Share
      const splitPlat = paymentMethod === 'card' ? platformFeePercent + 2.00 : platformFeePercent;
      platformAmt = parseFloat((amount * (splitPlat / 100)).toFixed(2));

      const remainingAmt = amount - platformAmt;
      const docMedAmt = parseFloat((remainingAmt * (medDoctorSplit / 100)).toFixed(2));
      const pharmaAmt = parseFloat((remainingAmt - docMedAmt).toFixed(2));

      const platformLedger: FinancialLedgerEntry = {
        id: `tx-plat-${crypto.randomUUID().substring(0, 8)}`,
        invoiceId: invoiceId,
        sourceEntityId: 'clinic-admin-entity',
        destinationEntityId: 'platform-admin-entity',
        transactionType: 'platform_fee',
        grossAmount: amount,
        commissionRate: splitPlat / 100,
        netPayout: platformAmt,
        paymentStatus: 'cleared',
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      const docMedLedger: FinancialLedgerEntry = {
        id: `tx-doc-med-${crypto.randomUUID().substring(0, 8)}`,
        invoiceId: invoiceId,
        sourceEntityId: 'clinic-admin-entity',
        destinationEntityId: 'clinic-admin-entity',
        transactionType: 'medicine_commission',
        grossAmount: amount,
        commissionRate: medDoctorSplit / 100,
        netPayout: docMedAmt,
        paymentStatus: 'cleared',
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      const pharmacyLedger: FinancialLedgerEntry = {
        id: `tx-pharma-${crypto.randomUUID().substring(0, 8)}`,
        invoiceId: invoiceId,
        sourceEntityId: 'clinic-admin-entity',
        destinationEntityId: 'pharmacy-partner-entity',
        transactionType: 'medicine_commission',
        grossAmount: amount,
        commissionRate: (100 - splitPlat - medDoctorSplit) / 100,
        netPayout: pharmaAmt,
        paymentStatus: 'cleared',
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      listToSave.push(platformLedger, docMedLedger, pharmacyLedger);
    }

    if (listToSave.length > 0) {
      ledgerEntries.unshift(...listToSave);
      save('financial_ledgers', ledgerEntries);

      // Sync splits to Supabase with the new database columns
      const dbEntries = listToSave.map(s => ({
        invoice_id: s.invoiceId,
        source_entity_id: getPodContext().entityId || 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
        destination_entity_id: s.destinationEntityId === 'platform-admin-entity' 
          ? getPodContext().entityId || 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002' 
          : (s.destinationEntityId === 'lab-partner-entity' ? (getPodContext().labEntityId || 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003') : (getPodContext().pharmacyEntityId || 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317004')),
        transaction_type: s.transactionType,
        gross_amount: s.grossAmount,
        commission_rate: Math.round(s.commissionRate * 100),
        net_payout: s.netPayout,
        payment_status: 'cleared',
        settled_at: new Date().toISOString(),
        platform_fee_deducted: platformAmt,
        gateway_disbursed_net: isCash ? 0.00 : s.netPayout,
        payment_method: paymentMethod,
        pod_id: getPodContext().podId
      }));

      supabase.from('financial_ledgers').insert(dbEntries).then(({ error }) => {
        if (error) console.error('Error inserting cash ledger splits in Supabase:', error);
      });

      // Update platform fee and payment method in unified_invoices in Supabase
      supabase.from('unified_invoices').update({
        platform_fee: platformAmt,
        payment_method: paymentMethod
      }).eq('id', invoiceId).then(({ error }) => {
        if (error) console.error('Error updating platform_fee in unified_invoices:', error);
      });

      // Update lifetime revenue for this pod in Supabase
      supabase.rpc('accumulate_platform_revenue', { p_pod_id: podId, p_amount: platformAmt, p_is_cash: isCash }).then(({ error }) => {
        if (error) console.error('Error updating pod platform revenue in Supabase:', error);
      });
    }
  }

  static async recordInvoicePayment(invoiceId: string, paymentMethod: 'cash' | 'upi' | 'card' | 'razorpay' | 'cashfree' | 'paytm' | 'phonepe' = 'upi'): Promise<void> {
    const saasInvoices = this.getInvoices();
    const saasInv = saasInvoices.find(i => i.id === invoiceId);
    
    const uInvoices = this.getUnifiedInvoices();
    const uInv = uInvoices.find(i => i.id === invoiceId || (saasInv && i.encounterId === saasInv.appointmentId));

    let resolvedInvoice: any = null;
    let amount = 0;
    let type: Invoice['type'] = 'consult';
    let apptId = '';

    if (saasInv) {
      saasInv.status = 'paid';
      save('saas_invoices', saasInvoices);
      resolvedInvoice = saasInv;
      amount = saasInv.amount;
      type = saasInv.type;
      apptId = saasInv.appointmentId;

      const appt = this.getAppointments().find(a => a.id === saasInv.appointmentId);
      if (appt) {
        if (saasInv.type === 'consult') {
          appt.status = 'ready_for_consult';
          this.saveAppointment(appt);
          
          PatientService.updatePatientQueueStatus(appt.patientId, 'awaiting_consultation');
          
          const patient = PatientService.getPatients().find(p => p.id === appt.patientId);
          if (patient) {
            const sessions = load<any[]>('whatsapp_sessions', []);
            const existing = sessions.find(s => s.patientPhone === patient.phone);
            if (existing) {
              const podRaw = typeof window !== 'undefined' ? localStorage.getItem('mediflow_active_pod') : null;
              const podParsed = podRaw ? (() => { try { return JSON.parse(podRaw); } catch { return null; } })() : null;
              const doctorLabel = podParsed?.doctorName || 'Doctor';
              const text = `✅ *Consultation Fee Received!* \n\nPatient has been added to ${doctorLabel}'s active queue. Please enter the consultation chamber when called.`;
              const currentHistory = existing.sessionData.chatHistory || [];
              currentHistory.push({ sender: 'bot', text, time: new Date().toISOString() });
              existing.sessionData = { ...existing.sessionData, chatHistory: currentHistory };
              save('whatsapp_sessions', sessions);
              supabase.from('whatsapp_sessions').update({
                session_data: existing.sessionData,
                last_interaction: new Date().toISOString()
              }).eq('patient_phone', patient.phone);
            }
          }
        } else if (saasInv.type === 'lab') {
          const rx = this.getPrescriptions().find(r => r.appointmentId === appt.id);
          if (rx && rx.extractedTests) {
            rx.extractedTests.forEach(testName => {
              const loinc = MASTER_TEST_CATALOG.find(t => t.name.toLowerCase() === testName.toLowerCase())?.loincCode || 'unknown';
              const reqId = crypto.randomUUID();
              const requisitions = load<any[]>('lab_requisitions', []);
              requisitions.push({
                id: reqId,
                encounterId: appt.id,
                patientId: appt.patientId,
                patientName: PatientService.getPatients().find(p => p.id === appt.patientId)?.name || 'Unknown',
                testCode: loinc,
                testName: testName,
                barcode: `BAR-${appt.id.substring(0, 8).toUpperCase()}-${loinc}`,
                status: 'pending',
                prescriptionFileUrl: rx?.prescriptionFileUrl,
                createdAt: new Date().toISOString()
              });
              save('lab_requisitions', requisitions);
            });
          }
          const patient = PatientService.getPatients().find(p => p.id === appt.patientId);
          if (patient) {
            const sessions = load<any[]>('whatsapp_sessions', []);
            const existing = sessions.find(s => s.patientPhone === patient.phone);
            if (existing) {
              const text = `✅ *Pathology Lab Fees Settled!* \n\nLab requests have been dispatched to Lab Tech Lalit Prasad. Please proceed to the lab collection counter.`;
              const currentHistory = existing.sessionData.chatHistory || [];
              currentHistory.push({ sender: 'bot', text, time: new Date().toISOString() });
              existing.sessionData = { ...existing.sessionData, chatHistory: currentHistory };
              save('whatsapp_sessions', sessions);
              supabase.from('whatsapp_sessions').update({
                session_data: existing.sessionData,
                last_interaction: new Date().toISOString()
              }).eq('patient_phone', patient.phone);
            }
          }
        } else if (saasInv.type === 'pharmacy') {
          appt.status = 'completed';
          this.saveAppointment(appt);
          
          const rx = this.getPrescriptions().find(r => r.appointmentId === appt.id);
          if (rx && rx.extractedMedicines) {
            rx.extractedMedicines.forEach(med => {
              const holds = load<any[]>('inventory_holds', []);
              holds.push({
                id: crypto.randomUUID(),
                patientId: appt.patientId,
                medicineName: med.name,
                dosage: med.dosage,
                quantity: 10,
                holdStatus: 'dispensed',
                expiryDate: '2027-12-31',
                batchNumber: 'BATCH-2026-X1',
                createdAt: new Date().toISOString()
              });
              save('inventory_holds', holds);
            });
          }

          const patient = PatientService.getPatients().find(p => p.id === appt.patientId);
          if (patient) {
            const sessions = load<any[]>('whatsapp_sessions', []);
            const existing = sessions.find(s => s.patientPhone === patient.phone);
            if (existing) {
              const text = `✅ *Pharmacy Invoice Paid!* \n\nYour digital invoice has been sent to your WhatsApp. Please show this receipt at the medicine counter to collect your medicines.`;
              const currentHistory = existing.sessionData.chatHistory || [];
              currentHistory.push({ sender: 'bot', text, time: new Date().toISOString() });
              existing.sessionData = { ...existing.sessionData, chatHistory: currentHistory };
              save('whatsapp_sessions', sessions);
              supabase.from('whatsapp_sessions').update({
                session_data: existing.sessionData,
                last_interaction: new Date().toISOString()
              }).eq('patient_phone', patient.phone);
            }
          }
        }
      }
    }

    if (uInv) {
      uInv.paymentStatus = 'cleared';
      save('unified_invoices', uInvoices);
      if (!resolvedInvoice) {
        resolvedInvoice = uInv;
        amount = uInv.totalAmount;
        apptId = uInv.encounterId;
        if (uInv.doctorFee > 0) type = 'consult';
        else if (uInv.labFee > 0) type = 'lab';
        else if (uInv.pharmacyFee > 0) type = 'pharmacy';
      }
    }

    if (resolvedInvoice) {
      await this.createLedgerSplitsForInvoiceFields(invoiceId, apptId, type, amount, paymentMethod);
    }
  }

  static async markInvoicePaid(invoiceId: string, sendWhatsApp = true, paymentMethod: 'cash' | 'upi' | 'card' | 'razorpay' | 'cashfree' | 'paytm' | 'phonepe' = 'upi'): Promise<void> {
    const { error } = await supabase.from('unified_invoices')
      .update({ payment_status: 'cleared', payment_method: paymentMethod })
      .eq('id', invoiceId);
    if (error) {
      console.error('[Mediflow API] markInvoicePaid error:', error);
      throw error;
    }
    writeAuditLog('INVOICE_PAID', { invoiceId, paymentMethod }, invoiceId);
    
    // Process local status transitions and create ledger splits
    await this.recordInvoicePayment(invoiceId, paymentMethod);

    if (sendWhatsApp) {
      const { data: inv } = await supabase.from('unified_invoices')
        .select('patient_id')
        .eq('id', invoiceId)
        .single();
      if (inv?.patient_id) {
        const { data: patient } = await supabase.from('patient_registry')
          .select('phone')
          .eq('id', inv.patient_id)
          .single();
        if (patient?.phone) {
          // Trigger mock whatsapp message send payload
          const sessions = load<any[]>('whatsapp_sessions', []);
          const existing = sessions.find(s => s.patientPhone === patient.phone);
          if (existing) {
            const currentHistory = existing.sessionData.chatHistory || [];
            currentHistory.push({ sender: 'bot', text: `Invoice MF-INV-${invoiceId.substring(0,4)} is marked PAID.`, time: new Date().toISOString() });
            existing.sessionData = { ...existing.sessionData, chatHistory: currentHistory };
            save('whatsapp_sessions', sessions);
            await supabase.from('whatsapp_sessions').update({
              session_data: existing.sessionData,
              last_interaction: new Date().toISOString()
            }).eq('patient_phone', patient.phone);
          }
        }
      }
    }
  }

  static async runSaaSPrescriptionOCR(appointmentId: string, file: File | string): Promise<Prescription> {
    await new Promise(resolve => setTimeout(resolve, 1500));
    const fileUrl = typeof file === 'string' ? file : undefined;

    const rx: Prescription = {
      id: crypto.randomUUID(),
      appointmentId,
      extractedMedicines: [
        { name: 'Calpol 650', dosage: '1 tab', frequency: '1-0-1' },
        { name: 'Metformin 500mg', dosage: '1 tab', frequency: '1-0-0' }
      ],
      extractedTests: ['HbA1c (Glycated Hemoglobin)', 'Serum Creatinine'],
      prescriptionFileUrl: fileUrl,
      createdAt: new Date().toISOString()
    };
    this.savePrescription(rx);
    
    // Sum prices of extracted tests dynamically from the doctor's active SOP config
    const activeSop = this.getActiveSop();
    const testPrices = activeSop?.extractedConfig?.test_prices || {};
    let labTotal = 0;
    
    if (rx.extractedTests) {
      rx.extractedTests.forEach(testName => {
        const loinc = MASTER_TEST_CATALOG.find(t => t.name.toLowerCase() === testName.toLowerCase())?.loincCode || 'unknown';
        const price = testPrices[loinc] ?? testPrices[testName] ?? 300; // default to 300 if not specified
        labTotal += Number(price);
      });
    }
    if (labTotal === 0) labTotal = 600; // fallback default if no tests
    
    const labInvoice: Invoice = {
      id: crypto.randomUUID(),
      appointmentId,
      type: 'lab',
      amount: labTotal,
      status: 'unpaid',
      createdAt: new Date().toISOString()
    };
    this.saveInvoice(labInvoice);

    // Compute pharmacy invoice total from extracted medicines against active SOP test prices / inventory
    let pharmaTotal = 0;
    const pharmacyInventory = await import('./pharmacyService').then(m => m.PharmacyService.getPharmacyInventory());
    if (rx.extractedMedicines && rx.extractedMedicines.length > 0) {
      rx.extractedMedicines.forEach(med => {
        const invItem = pharmacyInventory.find(i =>
          i.name.toLowerCase().includes(med.name.toLowerCase()) ||
          i.genericName.toLowerCase().includes(med.name.toLowerCase())
        );
        if (invItem) {
          // Default qty = 10, use selling price
          pharmaTotal += invItem.price * 10;
        } else {
          pharmaTotal += 50; // flat ₹50 fallback per unknown medicine
        }
      });
    }
    if (pharmaTotal === 0) pharmaTotal = 150; // absolute fallback

    const pharmaInvoice: Invoice = {
      id: crypto.randomUUID(),
      appointmentId,
      type: 'pharmacy',
      amount: Math.round(pharmaTotal),
      status: 'unpaid',
      createdAt: new Date().toISOString()
    };
    this.saveInvoice(pharmaInvoice);

    return rx;
  }

  static async createAppointment(appointment: {
    patient_id: string;
    doctor_id: string;
    status?: string;
  }): Promise<string> {
    const podId = getPodContext().podId;
    const { data, error } = await supabase.from('appointments').insert({
      patient_id: appointment.patient_id,
      doctor_id: appointment.doctor_id,
      status: appointment.status ?? 'pending_payment',
      created_at: new Date().toISOString(),
      pod_id: podId
    }).select('id').single();
    if (error) {
      console.error('[Mediflow API] createAppointment error:', error);
      throw error;
    }
    writeAuditLog('APPOINTMENT_CREATED', { appointmentId: data.id }, data.id);
    return data.id;
  }

  static async generateInvoice(appointmentId: string, type: 'consult' | 'lab' | 'pharmacy', amount: number): Promise<string> {
    const { data: patientData, error: patientErr } = await supabase.from('appointments').select('patient_id').eq('id', appointmentId).single();
    if (patientErr) {
      console.error('[Mediflow API] fetch patient for invoice error:', patientErr);
      throw patientErr;
    }
    const podId = getPodContext().podId;
    const { data, error } = await supabase.from('unified_invoices').insert({
      encounter_id: appointmentId,
      patient_id: patientData.patient_id,
      doctor_fee: type === 'consult' ? amount : 0,
      lab_fee: type === 'lab' ? amount : 0,
      pharmacy_fee: type === 'pharmacy' ? amount : 0,
      platform_fee: 0,
      total_amount: amount,
      payment_status: 'pending',  // DB constraint: only 'pending' | 'cleared' allowed
      created_at: new Date().toISOString(),
      pod_id: podId
    }).select('id').single();
    if (error) {
      console.error('[Mediflow API] generateInvoice error:', error);
      throw error;
    }
    writeAuditLog('INVOICE_CREATED', { invoiceId: data.id, type, amount }, data.id);
    return data.id;
  }

  static getClinicSops(): ClinicSop[] {
    const defaultSop: ClinicSop = {
      id: 'sop-standard-1',
      entityId: getPodContext().entityId || 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
      sopFileName: 'Kankarbagh_Clinic_Standard_SOP.txt',
      sopText: 'Doctor consultation fee: INR 500. HbA1c test price: INR 350. Splits: 40% Referring Doctor, 3% Platform, 57% Lab.',
      extractedConfig: {
        doctor_fee: 500,
        test_prices: { '4544-3': 350, '2160-0': 250, '3024-7': 150, '2947-0': 200, '1975-2': 300 },
        splits: { doctor: 40, platform: 3, lab: 57 },
        guidelines: [
          'Auto-assign Lalit Prasad for tech verification',
          'Allow doorstep sample collection scheduling',
          'Hold pharmacy stock using FEFO',
          'Verify patient consent prior to care pod routing'
        ]
      },
      isActive: true,
      createdAt: new Date().toISOString()
    };
    const sops = load<ClinicSop[]>('clinic_sops', [defaultSop]);
    let modified = false;
    sops.forEach(s => {
      if (s.extractedConfig && s.extractedConfig.doctor_fee === 450) {
        s.extractedConfig.doctor_fee = 500;
        s.sopText = s.sopText?.replace(/450/g, '500');
        modified = true;
      }
    });
    if (modified) {
      save('clinic_sops', sops);
    }
    return sops;
  }

  static saveClinicSops(sops: ClinicSop[]) {
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    
    const dbSops = sops.map(sop => {
      const validId = isUUID(sop.id) ? sop.id : crypto.randomUUID();
      if (validId !== sop.id) {
        sop.id = validId;
      }
      return {
        id: validId,
        entity_id: sop.entityId || 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
        sop_file_name: sop.sopFileName,
        sop_text: sop.sopText,
        extracted_config: sop.extractedConfig,
        is_active: sop.isActive,
        created_at: sop.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        pod_id: getPodContext().podId
      };
    });

    save('clinic_sops', sops);
    notify();

    supabase.from('clinic_sops').upsert(dbSops, { onConflict: 'id' }).then(({ error }) => {
      if (error) {
        console.error('[Mediflow API] Error syncing clinic SOPs to Supabase:', error);
      }
    });
  }

  static getActiveSop(): ClinicSop | null {
    const sops = this.getClinicSops();
    return sops.find(s => s.isActive) || null;
  }

  static calculateCommissionPoolBalance() {
    const invoices = this.getInvoices();
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');

    let totalCashCommissionOwed = 0;   // 3% cash sales commission accrued debt (-)
    let totalOnlineOffsetReceived = 0; // Online receipts (+)
    let doctorConsultsEarned = 0;      // 100% doctor consult fee
    let doctorLabReferralsEarned = 0;   // 50% lab test referral (SOP)
    let doctorMedicineReferralsEarned = 0; // 20% medicine referral (SOP)

    const activeSop = this.getActiveSop();
    const labDoctorSplit = activeSop?.extractedConfig?.splits?.doctor ?? 50; // 50% SOP
    const medDoctorSplit = (activeSop?.extractedConfig?.splits as any)?.pharmacyDoctor ?? 20; // 20% SOP

    const allAppointments = this.getAppointments();

    paidInvoices.forEach(inv => {
      const amt = inv.amount || 0;
      const appt = allAppointments.find(a => a.id === inv.appointmentId);
      const isWhatsAppBooking = (inv as any).source === 'whatsapp' || (inv as any).channel === 'whatsapp' || appt?.source === 'whatsapp' || (appt as any)?.is_virtual === true;

      if (inv.type === 'consult') {
        doctorConsultsEarned += amt; // ALWAYS added to Total Doctor Net Earnings!
        
        // ONLY WhatsApp bookings add to Commission Pool Balance (Online Receipts)!
        if (isWhatsAppBooking) {
          totalOnlineOffsetReceived += amt;
        }
        // Compounder / Counter appointments add ₹0 debt and ₹0 to Commission Pool balance!
      } else if (inv.type === 'lab' || (inv as any).type === 'pathology') {
        const docFee = Math.round(amt * (labDoctorSplit / 100));
        doctorLabReferralsEarned += docFee;
        const platFee = Math.round(amt * 0.03); // 3% VitalSync platform fee deducted on lab sales
        totalCashCommissionOwed += platFee;
      } else if (inv.type === 'pharmacy' || (inv as any).type === 'medicine') {
        const docFee = Math.round(amt * (medDoctorSplit / 100));
        doctorMedicineReferralsEarned += docFee;
        const platFee = Math.round(amt * 0.03); // 3% VitalSync platform fee deducted on medicine sales
        totalCashCommissionOwed += platFee;
      }
    });

    // Also process cleared Unified Invoices to ensure real-time consistency
    const uInvoices = this.getUnifiedInvoices();
    uInvoices.forEach(uInv => {
      if (uInv.paymentStatus === 'cleared') {
        const appt = allAppointments.find(a => a.id === uInv.encounterId);
        const isWhatsAppBooking = (uInv as any).source === 'whatsapp' || appt?.source === 'whatsapp' || (appt as any)?.is_virtual === true;

        if (uInv.doctorFee > 0 && paidInvoices.every(i => i.appointmentId !== uInv.encounterId)) {
          doctorConsultsEarned += uInv.doctorFee;
          if (isWhatsAppBooking) {
            totalOnlineOffsetReceived += uInv.doctorFee;
          }
        }
        if (uInv.labFee > 0) {
          const platFee = Math.round(uInv.labFee * 0.03);
          totalCashCommissionOwed += platFee;
        }
        if (uInv.pharmacyFee > 0) {
          const platFee = Math.round(uInv.pharmacyFee * 0.03);
          totalCashCommissionOwed += platFee;
        }
      }
    });

    // If there are no lab or pharmacy sales recorded, accrued cash debt must be 0 (preventing legacy OPD debt leakage)
    if (doctorLabReferralsEarned === 0 && doctorMedicineReferralsEarned === 0) {
      totalCashCommissionOwed = 0;
    }

    // Check manual settlement adjustments & auto-heal legacy seed entries (> 5000 or < -5000)
    let settlements = load<any[]>('vitalsync_pool_settlements', []);
    if (settlements.some(s => Math.abs(s.amount) > 5000)) {
      settlements = settlements.filter(s => Math.abs(s.amount) <= 5000);
      save('vitalsync_pool_settlements', settlements);
    }
    let manualSettledTotal = 0;
    settlements.forEach(s => {
      manualSettledTotal += (s.amount || 0);
    });

    const netPoolBalance = (totalOnlineOffsetReceived + manualSettledTotal) - totalCashCommissionOwed;
    const poolBufferThreshold = 1000;
    const transferableDoctorPayout = Math.max(0, netPoolBalance - poolBufferThreshold);

    return {
      netPoolBalance,
      poolBufferThreshold,
      transferableDoctorPayout,
      totalCashCommissionOwed,
      totalOnlineOffsetReceived,
      manualSettledTotal,
      doctorConsultsEarned,
      doctorLabReferralsEarned,
      doctorMedicineReferralsEarned,
      totalDoctorEarned: doctorConsultsEarned + doctorLabReferralsEarned + doctorMedicineReferralsEarned
    };
  }

  static recordPoolSettlement(amount: number, referenceNumber: string, notes?: string): void {
    const settlements = load<any[]>('vitalsync_pool_settlements', []);
    const newEntry = {
      id: `set-${Date.now()}`,
      amount,
      referenceNumber,
      notes: notes || 'Manual Bank Settlement',
      createdAt: new Date().toISOString()
    };
    settlements.push(newEntry);
    save('vitalsync_pool_settlements', settlements);
    notify();
  }

  static saveUnifiedInvoice(invoice: UnifiedInvoice): void {
    const invoices = this.getUnifiedInvoices();
    const idx = invoices.findIndex(i => i.id === invoice.id);
    if (idx >= 0) invoices[idx] = invoice;
    else invoices.push(invoice);
    save('unified_invoices', invoices);
    notify();

    // Sync to Supabase
    supabase.from('unified_invoices').upsert({
      id: invoice.id,
      encounter_id: invoice.encounterId === 'walkin' ? null : (invoice.encounterId || null),
      patient_id: invoice.patientId,
      doctor_fee: invoice.doctorFee,
      lab_fee: invoice.labFee,
      pharmacy_fee: invoice.pharmacyFee,
      platform_fee: invoice.platformFee,
      total_amount: invoice.totalAmount,
      upi_qr_payload: invoice.upiQrPayload,
      payment_status: invoice.paymentStatus === 'cleared' ? 'paid' : (invoice.paymentStatus as any),
      payment_method: invoice.paymentMethod || null,
      created_at: invoice.createdAt,
      pod_id: getPodContext().podId
    }).then(({ error }) => {
      if (error) console.error('[BillingService] Unified invoice sync failed:', error);
    });
  }
}
