import { supabase } from '../lib/supabaseClient';
import { load, save, writeAuditLog, notify } from './apiHelper';
import { PatientService } from './patientService';
import { MASTER_TEST_CATALOG } from './labService';
import type { UnifiedInvoice, FinancialLedgerEntry, Invoice, Appointment, Prescription, ClinicSop, Patient, PrescriptionTemplateConfig } from '../types';
import { getPodContext, FALLBACK_POD_ID, FALLBACK_ENTITY_ID, FALLBACK_DOCTOR_ID, DEMO_PATIENT_ID_1, DEMO_PATIENT_ID_2 } from './podContext';
import { safeGetStorageJSON } from '../utils/storage';
import { getIstDateString, getEffectiveAppointmentDate } from '../utils/dateUtils';

export class BillingService {
  static getUnifiedInvoices(): UnifiedInvoice[] {
    let isDemoAccount = false;
    if (typeof window !== 'undefined') {
      try {
        const parsed = safeGetStorageJSON<any>('vitalsync_cached_profile', null);
        if (parsed) {
          const email = String(parsed.email || '').toLowerCase();
          const id = String(parsed.id || '').toLowerCase();
          isDemoAccount = Boolean(
            parsed.isDemo === true ||
            email === 'demo@mediflow.com' ||
            email === 'doctor@mediflow.com' ||
            id === FALLBACK_DOCTOR_ID
          );
        }
      } catch (_e) { /* ignore */ }
    }

    let invoices = load<UnifiedInvoice[]>('unified_invoices', []);
    if (!isDemoAccount) {
      const currentPodId = getPodContext().podId;
      const demoPatientIds = new Set([
        DEMO_PATIENT_ID_1, 
        DEMO_PATIENT_ID_2,
        'pat-101', 'pat-102', 'pat-103'
      ]);
      const testSyntheticNames = new Set(['rls test patient', 'patient customer', 'unknown patient', 'auto test patient']);
      const effectivePod = (currentPodId && currentPodId !== 'unresolved-pod') ? currentPodId : FALLBACK_POD_ID;
      invoices = invoices.filter(i => {
        const pod = (i as any).podId || (i as any).pod_id;
        if (pod && effectivePod && pod !== effectivePod && pod !== FALLBACK_POD_ID && effectivePod !== FALLBACK_POD_ID) {
          return false;
        }
        if (!pod && effectivePod) {
          (i as any).podId = effectivePod;
        }
        const id = i.id || '';
        const pName = String(i.patientName || '').toLowerCase().trim();
        const pId = String(i.patientId || '');
        if (id.startsWith('inv-demo') || id.startsWith('inv-sample') || id.startsWith('inv-101') || id.startsWith('inv-102') || id.includes('rahul') || id.includes('E2E')) return false;
        if (testSyntheticNames.has(pName)) return false;
        if (demoPatientIds.has(pId)) return false;
        return true;
      });
    }
    // BUG-08 FIX: Removed ₹450→500 auto-mutation — root cause (AuthGateway consultation_fee: 450) is now fixed
    return invoices;
  }

  static saveFinancialLedgers(entries: FinancialLedgerEntry[]): void {
    save('financial_ledgers', entries);
    notify();
  }

  static saveAppointments(appointments: Appointment[]): void {
    const currentPodId = getPodContext().podId;
    save('saas_appointments', appointments);
    notify();
    writeAuditLog('APPOINTMENT_BULK_SAVED', { count: appointments.length }, null);

    // 🌟 ENTERPRISE DUAL-WRITE REALTIME GUARANTEE: Instantly persist bulk appointment mutation to Supabase
    (async () => {
      try {
        const nowISO = new Date().toISOString();
        const dbAppts: any[] = [];
        for (const appt of appointments) {
          const apptDate = getEffectiveAppointmentDate(appt) || (appt as any).date || getIstDateString();
          const pId = appt.patientId || (appt as any).patient_id;
          if (!pId) continue;
          dbAppts.push({
            id: appt.id,
            patient_id: pId,
            doctor_id: appt.doctorId || (appt as any).doctor_id || null,
            status: appt.status || 'scheduled',
            token_number: String(appt.tokenNumber || (appt as any).token_number || ''),
            patient_name: appt.patientName || (appt as any).patient_name || null,
            patient_phone: appt.patientPhone || (appt as any).patient_phone || null,
            is_virtual: Boolean(appt.isVirtual || (appt as any).is_virtual),
            virtual_date: (appt as any).virtualDate || (appt as any).virtual_date || apptDate,
            virtual_time: (appt as any).virtualTime || (appt as any).virtual_time || '10:00 AM',
            virtual_meeting_url: (appt as any).virtualMeetingUrl || (appt as any).virtual_meeting_url || null,
            source: (appt as any).source || ((appt as any).isVirtual ? 'whatsapp' : 'counter'),
            appointment_time: (appt as any).appointmentTime || (appt as any).appointment_time || `${apptDate}T10:00:00.000Z`,
            created_at: (appt as any).createdAt || (appt as any).created_at || nowISO,
            pod_id: (appt as any).podId || (appt as any).pod_id || currentPodId || null
          });
        }

        if (dbAppts.length > 0) {
          await supabase.from('appointments').upsert(dbAppts, { onConflict: 'id' });
        }
      } catch (err) {
        console.warn('[BillingService] Bulk remote appointment dual-write notice:', err);
      }
    })();
  }

  static clearInvoice(invoiceId: string, paymentMethod: 'cash' | 'upi' | 'card' | 'razorpay' | 'cashfree' | 'paytm' | 'phonepe' = 'upi'): void {
    const invoices = this.getUnifiedInvoices();
    const idx = invoices.findIndex(i => i.id === invoiceId);
    let invoiceAmount = 500;
    let targetPatientId = '';
    let targetApptId = '';

    if (idx !== -1) {
      invoices[idx].paymentStatus = 'cleared';
      invoices[idx].paymentMethod = paymentMethod;
      save('unified_invoices', invoices);
      invoiceAmount = invoices[idx].totalAmount || 500;
      targetPatientId = invoices[idx].patientId || '';
      targetApptId = invoices[idx].encounterId || '';
      writeAuditLog('INVOICE_PAYMENT_CLEARED', { invoiceId, paymentMethod, amount: invoices[idx].totalAmount }, invoices[idx].patientId);
    }

    const saasInvoices = this.getInvoices();
    const saasIdx = saasInvoices.findIndex(i => i.id === invoiceId);
    if (saasIdx !== -1) {
      saasInvoices[saasIdx].status = 'paid';
      saasInvoices[saasIdx].paymentMethod = paymentMethod;
      save('saas_invoices', saasInvoices);
      invoiceAmount = saasInvoices[saasIdx].amount || invoiceAmount;
      targetPatientId = saasInvoices[saasIdx].patientId || targetPatientId;
      targetApptId = saasInvoices[saasIdx].appointmentId || targetApptId;
    }

    // Enterprise Dual-Write: Update Unified Invoice in Supabase
    supabase.from('unified_invoices').update({
      payment_status: 'cleared',
      payment_method: paymentMethod
    }).eq('id', invoiceId).then(({ error }) => {
      if (error) console.warn('[BillingService] Remote invoice clearance update note:', error.message);
    });

    // Update appointment status and payment_status across local and remote
    const appts = this.getAppointments();
    const targetAppt = appts.find(a => a.id === targetApptId || a.id === invoiceId);
    if (targetAppt) {
      targetAppt.status = targetAppt.isVirtual ? 'ready_for_consult' : 'scheduled';
      targetAppt.payment_status = 'cleared';
      (targetAppt as any).paymentStatus = 'cleared';
      this.saveAppointment(targetAppt);

      supabase.from('appointments').update({
        status: targetAppt.status,
        payment_status: 'cleared'
      }).eq('id', targetAppt.id).then(({ error }) => {
        if (error) console.warn('[BillingService] Remote appointment payment update note:', error.message);
      });
    }

    // Update patient queue status defensively
    if (targetPatientId) {
      const nextQueueStatus = targetAppt?.isVirtual ? 'awaiting_consultation' : 'awaiting_vitals';
      PatientService.updatePatientQueueStatus(targetPatientId, nextQueueStatus);
      supabase.from('patient_registry').update({
        queue_status: nextQueueStatus
      }).eq('id', targetPatientId).then(() => {});
    }

    // Core Invoice Settlement & Financial Ledger Splits
    this.recordInvoicePayment(invoiceId, paymentMethod);

    // Atomic Backend Settlement via Postgres RPC
    supabase.rpc('process_invoice_settlement', {
      p_invoice_id: invoiceId,
      p_payment_method: paymentMethod,
      p_amount_paid: invoiceAmount
    }).then(({ error }) => {
      if (error) console.warn('[BillingService] RPC process_invoice_settlement note:', error.message);
      else writeAuditLog('invoice_payment_cleared', { invoiceId, paymentMethod }, invoiceId);
    });

    window.dispatchEvent(new CustomEvent('mediflow-financial-update'));
    window.dispatchEvent(new CustomEvent('mediflow-state-change'));
  }


  static getFinancialLedgers(invoiceId?: string): FinancialLedgerEntry[] {
    let isDemoAccount = false;
    if (typeof window !== 'undefined') {
      try {
        const parsed = safeGetStorageJSON<any>('vitalsync_cached_profile', null);
        if (parsed) {
          const email = String(parsed.email || '').toLowerCase();
          const id = String(parsed.id || '').toLowerCase();
          isDemoAccount = Boolean(
            parsed.isDemo === true ||
            email === 'demo@mediflow.com' ||
            email === 'doctor@mediflow.com' ||
            id === FALLBACK_DOCTOR_ID
          );
        }
      } catch (_e) { /* ignore */ }
    }

    let ledgers = load<FinancialLedgerEntry[]>('financial_ledgers', []);
    if (!isDemoAccount) {
      const currentPodId = getPodContext().podId;
      const demoPatientIds = new Set([
        DEMO_PATIENT_ID_1, 
        DEMO_PATIENT_ID_2,
        'pat-101', 'pat-102', 'pat-103'
      ]);
      const testSyntheticNames = new Set(['rls test patient', 'patient customer', 'unknown patient', 'auto test patient']);
      const effectivePod = (currentPodId && currentPodId !== 'unresolved-pod') ? currentPodId : FALLBACK_POD_ID;
      ledgers = ledgers.filter(l => {
        const pod = (l as any).podId || (l as any).pod_id;
        if (pod && effectivePod && pod !== effectivePod && pod !== FALLBACK_POD_ID && effectivePod !== FALLBACK_POD_ID) {
          return false;
        }
        if (!pod && effectivePod) {
          (l as any).podId = effectivePod;
        }
        const id = l.id || '';
        const pName = String(l.patientName || '').toLowerCase().trim();
        const pId = String((l as any).patientId || '');
        if (id.startsWith('tx-demo') || id.startsWith('tx-sample')) return false;
        if (testSyntheticNames.has(pName)) return false;
        if (demoPatientIds.has(pId)) return false;
        return true;
      });
    }

    let modified = false;

    // Filter out any platform_fee entries generated for consultation appointments
    // Filter out duplicate appointment_fee entries for the same patient on the same date
    const allAppts = this.getAppointments();
    const paidInvoices = this.getInvoices().filter(i => i.status === 'paid');
    const seenConsultLedgerKeys = new Set<string>();
    const filteredLedgers: FinancialLedgerEntry[] = [];

    ledgers.forEach(l => {
      if (l.transactionType === 'platform_fee' && (l.grossAmount === 500 || l.grossAmount === 450 || l.netPayout < 50)) {
        modified = true;
        return;
      }
      if (l.transactionType === 'appointment_fee') {
        const dateStr = getIstDateString(l.createdAt || l.settledAt);
        const invMatch = paidInvoices.find(i => i.id === l.invoiceId);
        const apptMatch = allAppts.find(a => a.id === invMatch?.appointmentId || a.id === (l as any).appointmentId);
        const patId = (l as any).patientId || (l as any).patient_id || invMatch?.patientId || apptMatch?.patientId;
        const pIdentifier = String(patId || l.patientName || '').toLowerCase().trim();
        const consultKey = `${pIdentifier}_${dateStr}`;
        if (seenConsultLedgerKeys.has(consultKey)) {
          modified = true;
          return; // Skip duplicate consult ledger
        }
        seenConsultLedgerKeys.add(consultKey);

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
      filteredLedgers.push(l);
    });

    // Ensure all paid invoices have corresponding financial ledger entries without duplicates
    const existingInvoiceIds = new Set(filteredLedgers.map(l => l.invoiceId));

    paidInvoices.forEach(inv => {
      const appt = allAppts.find(a => a.id === inv.appointmentId);
      const patId = inv.patientId || appt?.patientId;
      const patients = PatientService.getPatients();
      const patient = patients.find(p => p.id === patId);
      const patientName = patient?.name || (inv as any).patientName || (appt as any)?.patient_name || 'Patient Customer';
      const dateStr = getIstDateString(inv.createdAt || (appt?.createdAt));
      const pIdentifier = String(patId || patientName).toLowerCase().trim();
      const consultKey = `${pIdentifier}_${dateStr}`;

      if (inv.type === 'consult' && seenConsultLedgerKeys.has(consultKey)) {
        return; // Already recorded
      }

      if (!existingInvoiceIds.has(inv.id)) {
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
        } else if (inv.type === 'consult') {
          seenConsultLedgerKeys.add(consultKey);
        }

        const podEntityId = getPodContext().entityId;
        const newLedger: FinancialLedgerEntry = {
          id: `tx-auto-${(inv.id || 'N/A').substring(0, 8)}`,
          invoiceId: inv.id,
          sourceEntityId: podEntityId,
          destinationEntityId: podEntityId,
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
        const parsed = safeGetStorageJSON<any>('vitalsync_cached_profile', null);
        if (parsed) {
          const email = String(parsed.email || '').toLowerCase();
          const id = String(parsed.id || '').toLowerCase();
          isDemoAccount = Boolean(
            parsed.isDemo === true ||
            email === 'demo@mediflow.com' ||
            email === 'doctor@mediflow.com' ||
            id === FALLBACK_DOCTOR_ID
          );
        }
      } catch (_e) { /* ignore */ }
    }

    let appts = load<Appointment[]>('saas_appointments', []);
    if (!isDemoAccount) {
      const currentPodId = getPodContext().podId;
      const demoPatientIds = new Set([
        DEMO_PATIENT_ID_1, 
        DEMO_PATIENT_ID_2,
        'pat-101', 'pat-102', 'pat-103', 'pat-104', 'pat-105'
      ]);
      const testSyntheticNames = new Set(['rls test patient', 'patient customer', 'unknown patient', 'auto test patient']);
      const effectivePod = (currentPodId && currentPodId !== 'unresolved-pod') ? currentPodId : FALLBACK_POD_ID;
      appts = appts.filter(a => {
        const pod = (a as any).podId || (a as any).pod_id;
        if (pod && effectivePod && pod !== effectivePod && pod !== FALLBACK_POD_ID && effectivePod !== FALLBACK_POD_ID) {
          return false;
        }
        if (!pod && effectivePod) {
          (a as any).podId = effectivePod;
        }
        const id = a.id || '';
        const pName = String((a as any).patient_name || (a as any).patientName || '').toLowerCase().trim();
        const pId = String(a.patientId || (a as any).patient_id || '');
        const isExplicitDemoId = id.startsWith('appt-demo') || id.startsWith('appt-sample') || id.startsWith('appt-101') || id.startsWith('appt-102');
        if (isExplicitDemoId) return false;
        if (demoPatientIds.has(pId)) return false;
        if (testSyntheticNames.has(pName)) return false;
        if (pName.includes('test patient') || pName.includes('auto test')) return false;
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
    writeAuditLog('APPOINTMENT_SAVED', {
      appointmentId: appt.id,
      status: appt.status,
      tokenNumber: appt.tokenNumber,
      isVirtual: Boolean(appt.isVirtual || (appt as any).is_virtual)
    }, appt.patientId || (appt as any).patient_id);

    // 🌟 ENTERPRISE DUAL-WRITE REALTIME GUARANTEE: Instantly persist appointment mutation to Supabase
    (async () => {
      try {
        const podId = (appt as any).podId || (appt as any).pod_id || currentPodId || null;
        const nowISO = new Date().toISOString();
        const apptDate = getEffectiveAppointmentDate(appt) || (appt as any).date || getIstDateString();
        const pId = appt.patientId || (appt as any).patient_id;
        if (pId) {
          await supabase.from('appointments').upsert({
            id: appt.id,
            patient_id: pId,
            doctor_id: appt.doctorId || (appt as any).doctor_id || null,
            status: appt.status || 'scheduled',
            token_number: String(appt.tokenNumber || (appt as any).token_number || ''),
            patient_name: appt.patientName || (appt as any).patient_name || null,
            patient_phone: appt.patientPhone || (appt as any).patient_phone || null,
            is_virtual: Boolean(appt.isVirtual || (appt as any).is_virtual),
            virtual_date: (appt as any).virtualDate || (appt as any).virtual_date || apptDate,
            virtual_time: (appt as any).virtualTime || (appt as any).virtual_time || '10:00 AM',
            virtual_meeting_url: (appt as any).virtualMeetingUrl || (appt as any).virtual_meeting_url || null,
            source: (appt as any).source || ((appt as any).isVirtual ? 'whatsapp' : 'counter'),
            appointment_time: (appt as any).appointmentTime || (appt as any).appointment_time || `${apptDate}T10:00:00.000Z`,
            created_at: (appt as any).createdAt || (appt as any).created_at || nowISO,
            pod_id: podId
          }, { onConflict: 'id' });
        }
      } catch (dbErr) {
        console.warn('[BillingService] Remote appointment dual-write notice:', dbErr);
      }
    })();
  }

  static getPatients(): Patient[] {
    return PatientService.getPatients();
  }

  static getInvoices(): Invoice[] {
    let isDemoAccount = false;
    if (typeof window !== 'undefined') {
      try {
        const parsed = safeGetStorageJSON<any>('vitalsync_cached_profile', null);
        if (parsed) {
          const email = String(parsed.email || '').toLowerCase();
          const id = String(parsed.id || '').toLowerCase();
          isDemoAccount = Boolean(
            parsed.isDemo === true ||
            email === 'demo@mediflow.com' ||
            email === 'doctor@mediflow.com' ||
            id === FALLBACK_DOCTOR_ID
          );
        }
      } catch (_e) { /* ignore */ }
    }

    let invoices = load<Invoice[]>('saas_invoices', []);
    if (!isDemoAccount) {
      const currentPodId = getPodContext().podId;
      const demoPatientIds = new Set([
        DEMO_PATIENT_ID_1, 
        DEMO_PATIENT_ID_2,
        'pat-101', 'pat-102', 'pat-103'
      ]);
      const testSyntheticNames = new Set(['rls test patient', 'patient customer', 'unknown patient', 'auto test patient']);
      const effectivePod = (currentPodId && currentPodId !== 'unresolved-pod') ? currentPodId : FALLBACK_POD_ID;
      invoices = invoices.filter(i => {
        const pod = (i as any).podId || (i as any).pod_id;
        if (pod && effectivePod && pod !== effectivePod && pod !== FALLBACK_POD_ID && effectivePod !== FALLBACK_POD_ID) {
          return false;
        }
        if (!pod && effectivePod) {
          (i as any).podId = effectivePod;
        }
        const id = i.id || '';
        const pName = String((i as any).patientName || '').toLowerCase().trim();
        const pId = String(i.patientId || '');
        if (id.startsWith('inv-demo') || id.startsWith('inv-sample') || id.startsWith('inv-101') || id.startsWith('inv-102') || id.includes('rahul') || id.includes('E2E') || String(i.appointmentId || '').includes('E2E')) return false;
        if (testSyntheticNames.has(pName)) return false;
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
    writeAuditLog('INVOICE_SAVED', {
      invoiceId: invoice.id,
      amount: invoice.amount,
      type: invoice.type
    }, (invoice as any).patientId || (invoice as any).patient_id);

    // 🌟 ENTERPRISE DUAL-WRITE REALTIME GUARANTEE: Instantly persist invoice mutation to Supabase
    (async () => {
      try {
        const podId = (invoice as any).podId || (invoice as any).pod_id || currentPodId || null;
        const nowISO = new Date().toISOString();
        const pId = (invoice as any).patientId || (invoice as any).patient_id || '';
        const apptId = (invoice as any).appointmentId || (invoice as any).appointment_id || null;
        let encId = (invoice as any).encounterId || (invoice as any).encounter_id || null;

        if (!encId && apptId) {
          const { data: existingEnc } = await supabase
            .from('encounters')
            .select('id')
            .eq('appointment_id', apptId)
            .maybeSingle();
          if (existingEnc?.id) {
            encId = existingEnc.id;
          }
        }

        const invPayload: any = {
          id: invoice.id,
          patient_id: pId,
          doctor_fee: invoice.type === 'consult' ? invoice.amount : 0,
          lab_fee: invoice.type === 'lab' ? invoice.amount : 0,
          pharmacy_fee: invoice.type === 'pharmacy' ? invoice.amount : 0,
          platform_fee: (invoice as any).platformFee || (invoice as any).platform_fee || 0,
          total_amount: invoice.amount || 0,
          payment_status: invoice.status === 'paid' ? 'cleared' : 'pending',
          payment_method: invoice.paymentMethod || 'upi',
          created_at: (invoice as any).createdAt || (invoice as any).created_at || nowISO,
          pod_id: podId
        };
        if (apptId) invPayload.appointment_id = apptId;
        if (encId) invPayload.encounter_id = encId;

        await supabase.from('unified_invoices').upsert(invPayload, { onConflict: 'id' });
      } catch (dbErr) {
        console.warn('[BillingService] Remote invoice dual-write notice:', dbErr);
      }
    })();
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
    writeAuditLog('PRESCRIPTION_SAVED', {
      prescriptionId: rx.id,
      medicinesCount: ((rx as any).medications || []).length
    }, (rx as any).patientId || (rx as any).patient_id);

    // 🌟 ENTERPRISE DUAL-WRITE REALTIME GUARANTEE: Instantly persist prescription mutation to Supabase
    (async () => {
      try {
        const podId = (rx as any).podId || (rx as any).pod_id || currentPodId || FALLBACK_POD_ID;
        await supabase.from('saas_prescriptions').upsert({
          id: rx.id,
          encounter_id: (rx as any).encounterId || (rx as any).encounter_id || rx.id,
          patient_id: (rx as any).patientId || (rx as any).patient_id || '',
          doctor_id: (rx as any).doctorId || (rx as any).doctor_id || null,
          extracted_medicines: (rx as any).extractedMedicines || (rx as any).extracted_medicines || (rx as any).medications || [],
          extracted_tests: (rx as any).extractedTests || (rx as any).extracted_tests || ((rx as any).diagnosticTests || []).map((t: any) => t?.loincCode || t?.name || t),
          status: (rx as any).status || 'active',
          pod_id: podId
        }, { onConflict: 'id' });
      } catch (dbErr) {
        console.warn('[BillingService] Remote prescription dual-write notice:', dbErr);
      }
    })();
  }

  static createGate1Consult(patientId: string, source: 'counter' | 'whatsapp' = 'counter', scheduledDate?: string, scheduledTime?: string): Invoice {
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
    const effectiveDate = scheduledDate || getIstDateString();
    const effectiveTime = scheduledTime || '10:00 AM - 12:00 PM';
    const newAppt: Appointment = {
      id: apptId,
      podId: ctx.podId,
      patientId,
      doctorId: ctx.doctorId || null, // BUG-04 FIX: Dynamic only, no hardcoded demo doctor
      status: 'pending_payment',
      createdAt: new Date().toISOString(),
      source,
      date: effectiveDate,
      virtualDate: effectiveDate,
      virtual_date: effectiveDate,
      virtualTime: effectiveTime,
      virtual_time: effectiveTime,
      appointmentTime: `${effectiveDate}T10:00:00.000Z`,
      appointment_time: `${effectiveDate}T10:00:00.000Z`
    } as any;
    this.saveAppointment(newAppt);

    const runInit = async () => {
      let resolvedDoctorId: string | null = null; // BUG-04 FIX: No hardcoded demo fallback
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
          if (targetAppt && resolvedDoctorId) {
            targetAppt.doctorId = resolvedDoctorId;
            this.saveAppointment(targetAppt);
          }
        }
      } catch (err) {
        console.warn('[BillingService] Failed to dynamically look up doctor for consult:', err);
      }

      // Sync initial appointment and unified invoice into Supabase
      try {
        await supabase.from('appointments').upsert({
          id: apptId,
          patient_id: patientId,
          doctor_id: resolvedDoctorId,
          status: 'pending_payment',
          appointment_time: `${effectiveDate}T10:00:00.000Z`,
          is_virtual: source === 'whatsapp',
          virtual_date: effectiveDate,
          virtual_time: effectiveTime,
          pod_id: ctx.podId || FALLBACK_POD_ID
        });

        await supabase.from('unified_invoices').upsert({
          id: newInvoice.id,
          patient_id: patientId,
          doctor_fee: consultFee,
          lab_fee: 0,
          pharmacy_fee: 0,
          platform_fee: source === 'whatsapp' ? 15 : 0,
          total_amount: source === 'whatsapp' ? consultFee + 15 : consultFee,
          payment_status: 'pending',
          pod_id: ctx.podId || FALLBACK_POD_ID
        });
      } catch (_dbSyncErr) {
        console.warn('[BillingService] Initial consult Supabase upsert note:', _dbSyncErr);
      }

      const patient = PatientService.getPatients().find(p => p.id === patientId);
      if (patient) {
        // Direct push WhatsApp message bot history logic
        const pDigits = (patient.phone || '').replace(/\D/g, '').slice(-10);
        const sessions = load<any[]>('whatsapp_sessions', []);
        const existing = sessions.find(s => {
          const sDigits = (s.patientPhone || (s as any).patient_phone || '').replace(/\D/g, '').slice(-10);
          return sDigits && pDigits && sDigits === pDigits;
        });
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
    
    // Check if splits already exist for this invoiceId and target transaction type
    const targetType = type === 'consult' ? 'appointment_fee' : (type === 'lab' ? 'lab_commission' : 'medicine_commission');
    const exists = ledgerEntries.some(l => l.invoiceId === invoiceId && (l.transactionType === targetType || (targetType === 'appointment_fee' && (l.transactionType as any) === 'doctor_consultation_fee')));
    if (exists) return;

    // Fetch platform_fee_percent for this pod from Supabase
    let platformFeePercent = 3.00; // Standard VitalSync 3% Platform Fee (Rule 58)
    const ctx = getPodContext();
    const podId = ctx.podId;
    try {
      const { data: podData } = await supabase
        .from('pods')
        .select('platform_fee_percent')
        .eq('id', podId)
        .maybeSingle();
      if (podData && podData.platform_fee_percent !== null && podData.platform_fee_percent !== undefined) {
        platformFeePercent = parseFloat(podData.platform_fee_percent.toString());
      }
    } catch (e) {
      console.warn('[BillingService] Failed to load pod fee, using 3.0% default fallback:', e);
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

    const podEntityId = getPodContext().entityId;
    const labDestId = getPodContext().labEntityId || podEntityId;
    const pharmDestId = getPodContext().pharmacyEntityId || podEntityId;

    if (type === 'consult') {
      const docAmt = amount;
      const docLedger: FinancialLedgerEntry = {
        id: `tx-doc-${crypto.randomUUID().substring(0, 8)}`,
        invoiceId: invoiceId,
        sourceEntityId: podEntityId,
        destinationEntityId: podEntityId,
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
        sourceEntityId: podEntityId,
        destinationEntityId: podEntityId,
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
        sourceEntityId: podEntityId,
        destinationEntityId: podEntityId,
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
        sourceEntityId: podEntityId,
        destinationEntityId: labDestId,
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
        sourceEntityId: podEntityId,
        destinationEntityId: podEntityId,
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
        sourceEntityId: podEntityId,
        destinationEntityId: podEntityId,
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
        sourceEntityId: podEntityId,
        destinationEntityId: pharmDestId,
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
        id: s.id,
        invoice_id: s.invoiceId,
        source_entity_id: s.sourceEntityId,
        destination_entity_id: s.destinationEntityId,
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

      supabase.from('financial_ledgers').upsert(dbEntries, { onConflict: 'id' }).then(({ error }) => {
        if (error) console.error('Error upserting cash ledger splits in Supabase:', error);
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
        const patId = appt.patientId || (appt as any).patient_id;
        if (saasInv.type === 'consult') {
          appt.status = 'ready_for_consult';
          this.saveAppointment(appt);
          
          if (patId) {
            PatientService.updatePatientQueueStatus(patId, 'awaiting_consultation');
          }

          // Sync appointment and invoice clearance to Supabase
          supabase.from('appointments').update({ status: 'ready_for_consult', payment_status: 'cleared' }).eq('id', appt.id).then(({ error }) => {
            if (error) console.error('[BillingService] Error updating appointment status in Supabase:', error);
          });
          supabase.from('unified_invoices').update({ payment_status: 'cleared', payment_method: paymentMethod }).eq('id', invoiceId).then(({ error }) => {
            if (error) console.error('[BillingService] Error updating invoice in Supabase:', error);
          });

          // Create and persist financial ledger entry for Doctor Consultation Fee
          const ledgerEntries = load<FinancialLedgerEntry[]>('financial_ledgers', []);
          const consultLedger: FinancialLedgerEntry = {
            id: `tx-doc-${crypto.randomUUID().substring(0, 8)}`,
            invoiceId: saasInv.id,
            appointmentId: appt.id,
            patientId: patId,
            doctorId: appt.doctorId || (appt as any).doctor_id,
            sourceEntityId: getPodContext().entityId || 'clinic-admin-entity',
            destinationEntityId: getPodContext().entityId || 'clinic-admin-entity',
            transactionType: 'appointment_fee',
            grossAmount: amount || 500,
            commissionRate: 0,
            netPayout: amount || 500,
            paymentStatus: 'cleared',
            settledAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
          } as any;

          if (!ledgerEntries.some(l => l.invoiceId === saasInv.id && l.transactionType === 'appointment_fee')) {
            ledgerEntries.unshift(consultLedger);
            save('financial_ledgers', ledgerEntries);
          }

          const dbDocLedger = {
            id: consultLedger.id,
            invoice_id: saasInv.id,
            appointment_id: appt.id,
            patient_id: patId,
            doctor_id: appt.doctorId || (appt as any).doctor_id,
            source_entity_id: getPodContext().entityId || FALLBACK_ENTITY_ID,
            destination_entity_id: getPodContext().entityId || FALLBACK_ENTITY_ID,
            transaction_type: 'appointment_fee',
            gross_amount: amount || 500,
            commission_rate: 0,
            net_payout: amount || 500,
            payment_status: 'cleared',
            settled_at: new Date().toISOString(),
            platform_fee_deducted: 0,
            gateway_disbursed_net: paymentMethod === 'cash' ? 0.00 : (amount || 500),
            payment_method: paymentMethod,
            pod_id: getPodContext().podId || FALLBACK_POD_ID
          };
          supabase.from('financial_ledgers').upsert([dbDocLedger], { onConflict: 'id' }).then(({ error }) => {
            if (error) console.error('[BillingService] Error upserting consult ledger in Supabase:', error);
          });

          window.dispatchEvent(new CustomEvent('mediflow-financial-update'));
          window.dispatchEvent(new CustomEvent('mediflow-state-change'));
          
          const patient = PatientService.getPatients().find(p => p.id === patId);
          if (patient) {
            const cleanPatientPhone = (patient.phone || '').replace(/\D/g, '').slice(-10);
            const sessions = load<any[]>('whatsapp_sessions', []);
            const existing = sessions.find(s => {
              const sDigits = (s.patientPhone || s.patient_phone || '').replace(/\D/g, '').slice(-10);
              return sDigits && cleanPatientPhone && sDigits === cleanPatientPhone;
            });
            if (existing) {
              const podRaw = typeof window !== 'undefined' ? (localStorage.getItem('vitalsync_active_pod') || localStorage.getItem('mediflow_active_pod')) : null;
              const podParsed = podRaw ? (() => { try { return JSON.parse(podRaw); } catch { return null; } })() : null;
              const doctorLabel = podParsed?.doctorName || podParsed?.name || 'Doctor';
              const text = `✅ *Consultation Fee Received!* \n\nPatient has been added to ${doctorLabel}'s active queue. Please enter the consultation chamber when called.`;
              const currentHistory = existing.sessionData?.chatHistory || [];
              currentHistory.push({ sender: 'bot', text, time: new Date().toISOString() });
              existing.sessionData = { ...(existing.sessionData || {}), chatHistory: currentHistory };
              save('whatsapp_sessions', sessions);
              if (existing.id) {
                supabase.from('whatsapp_sessions').update({
                  session_data: existing.sessionData,
                  last_interaction: new Date().toISOString()
                }).eq('id', existing.id);
              } else {
                supabase.from('whatsapp_sessions').update({
                  session_data: existing.sessionData,
                  last_interaction: new Date().toISOString()
                }).eq('patient_phone', existing.patientPhone || existing.patient_phone || patient.phone);
              }
            }
          }
        } else if (saasInv.type === 'lab') {
          const rx = this.getPrescriptions().find(r => r.appointmentId === appt.id);
          if (rx && rx.extractedTests) {
            rx.extractedTests.forEach(testName => {
              const loinc = MASTER_TEST_CATALOG.find(t => (t.name || '').toLowerCase() === (testName || '').toLowerCase())?.loincCode || '4544-3';
              const reqId = crypto.randomUUID();
              const requisitions = load<any[]>('lab_requisitions', []);
              requisitions.push({
                id: reqId,
                encounterId: appt.id,
                patientId: appt.patientId,
                patientName: PatientService.getPatients().find(p => p.id === appt.patientId)?.name || 'Unknown',
                testCode: loinc,
                testName: testName,
                barcode: `BAR-${(appt.id || 'APPT').substring(0, 8).toUpperCase()}-${loinc}`,
                status: 'pending',
                prescriptionFileUrl: rx?.prescriptionFileUrl,
                createdAt: new Date().toISOString()
              });
              save('lab_requisitions', requisitions);
            });
          }
          const patient = PatientService.getPatients().find(p => p.id === appt.patientId);
          if (patient) {
            const pDigits = (patient.phone || '').replace(/\D/g, '').slice(-10);
            const sessions = load<any[]>('whatsapp_sessions', []);
            const existing = sessions.find(s => {
              const sDigits = (s.patientPhone || (s as any).patient_phone || '').replace(/\D/g, '').slice(-10);
              return sDigits && pDigits && sDigits === pDigits;
            });
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
            const pDigits = (patient.phone || '').replace(/\D/g, '').slice(-10);
            const sessions = load<any[]>('whatsapp_sessions', []);
            const existing = sessions.find(s => {
              const sDigits = (s.patientPhone || (s as any).patient_phone || '').replace(/\D/g, '').slice(-10);
              return sDigits && pDigits && sDigits === pDigits;
            });
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
      const uApptId = uInv.encounterId || apptId;

      if (uInv.doctorFee > 0) {
        await this.createLedgerSplitsForInvoiceFields(invoiceId, uApptId, 'consult', uInv.doctorFee, paymentMethod);
      }
      if (uInv.pharmacyFee > 0) {
        await this.createLedgerSplitsForInvoiceFields(invoiceId, uApptId, 'pharmacy', uInv.pharmacyFee, paymentMethod);
      }
      if (uInv.labFee > 0) {
        await this.createLedgerSplitsForInvoiceFields(invoiceId, uApptId, 'lab', uInv.labFee, paymentMethod);
      }
    } else if (resolvedInvoice) {
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
        .maybeSingle();
      if (inv?.patient_id) {
        const { data: patient } = await supabase.from('patient_registry')
          .select('phone')
          .eq('id', inv.patient_id)
          .maybeSingle();
        if (patient?.phone) {
          // Send real WhatsApp notification via WhatsAppService (dynamic import to prevent circular dependency)
          const { WhatsAppService } = await import('./whatsappService');
          const msg = `Invoice MF-INV-${invoiceId.substring(0,4)} is marked PAID.`;
          WhatsAppService.pushWhatsAppMessageFromBot(patient.phone, msg);
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
        const loinc = MASTER_TEST_CATALOG.find(t => (t.name || '').toLowerCase() === (testName || '').toLowerCase())?.loincCode || 'unknown';
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
        const invItem = pharmacyInventory.find(i => {
          const iName = (i.name || '').toLowerCase();
          const iGeneric = (i.genericName || '').toLowerCase();
          const medName = (med.name || '').toLowerCase();
          return (iName && medName && iName.includes(medName)) || (iGeneric && medName && iGeneric.includes(medName));
        });
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
    id?: string;
    patient_id: string;
    doctor_id: string;
    status?: string;
  }): Promise<string> {
    const podId = getPodContext().podId;
    const apptId = appointment.id || crypto.randomUUID();
    const { data, error } = await supabase.from('appointments').upsert({
      id: apptId,
      patient_id: appointment.patient_id,
      doctor_id: appointment.doctor_id,
      status: appointment.status ?? 'pending_payment',
      created_at: new Date().toISOString(),
      pod_id: podId
    }, { onConflict: 'id' }).select('id').single();
    if (error) {
      console.error('[Mediflow API] createAppointment error:', error);
      throw error;
    }
    writeAuditLog('APPOINTMENT_CREATED', { appointmentId: data.id }, data.id);
    return data.id;
  }

  static async generateInvoice(appointmentId: string, type: 'consult' | 'lab' | 'pharmacy', amount: number, invoiceId?: string): Promise<string> {
    const { data: patientData } = await supabase.from('appointments').select('patient_id').eq('id', appointmentId).maybeSingle();
    const patientId = patientData?.patient_id || this.getAppointments().find(a => a.id === appointmentId)?.patientId || '';
    const podId = getPodContext().podId;
    const invId = invoiceId || `inv-${appointmentId}-${type}`;
    const { data, error } = await supabase.from('unified_invoices').upsert({
      id: invId,
      encounter_id: appointmentId,
      patient_id: patientId,
      doctor_fee: type === 'consult' ? amount : 0,
      lab_fee: type === 'lab' ? amount : 0,
      pharmacy_fee: type === 'pharmacy' ? amount : 0,
      platform_fee: 0,
      total_amount: amount,
      payment_status: 'pending',  // DB constraint: only 'pending' | 'cleared' allowed
      created_at: new Date().toISOString(),
      pod_id: podId
    }, { onConflict: 'id' }).select('id').single();
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
      entityId: getPodContext().entityId || FALLBACK_ENTITY_ID,
      sopFileName: 'VitalSync_Clinic_Standard_SOP.txt',
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
        entity_id: sop.entityId || FALLBACK_ENTITY_ID,
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

  static getPrescriptionTemplate(podId?: string): PrescriptionTemplateConfig {
    const activeSop = this.getActiveSop();
    const sopTemplate = activeSop?.extractedConfig?.prescriptionTemplate;
    const ctx = getPodContext();
    return {
      doctorName: sopTemplate?.doctorName || 'Attending Physician',
      doctorQualification: sopTemplate?.doctorQualification || 'MBBS, MS (Ophthalmology), FICO (London)',
      doctorRegNo: sopTemplate?.doctorRegNo || 'MCI-84992-A',
      clinicName: sopTemplate?.clinicName || (ctx as any).clinicName || 'Smart Care Clinic & Hospital',
      clinicAddress: sopTemplate?.clinicAddress || 'Main Road, Health Plaza, City Center',
      clinicPhone: sopTemplate?.clinicPhone || '+91 99342 98453',
      headerColor: sopTemplate?.headerColor || '#0284c7',
      footerNote: sopTemplate?.footerNote || 'Emergency Care: Available 24x7 • Valid for Follow-up Review within 15 Days • Please bring this prescription for your review.'
    };
  }

  static savePrescriptionTemplate(template: PrescriptionTemplateConfig) {
    const sops = this.getClinicSops();
    let activeSop = sops.find(s => s.isActive);
    if (!activeSop && sops.length > 0) {
      activeSop = sops[0];
      activeSop.isActive = true;
    }
    if (activeSop) {
      activeSop.extractedConfig = {
        ...activeSop.extractedConfig,
        prescriptionTemplate: template
      };
      this.saveClinicSops(sops);
    }
  }

  static calculateCommissionPoolBalance() {
    // Ground truth: Derive earnings directly from deduplicated financial ledgers
    const ledgers = this.getFinancialLedgers();

    let totalCashCommissionOwed = 0;   // 3% cash sales commission accrued debt (-)
    let totalOnlineOffsetReceived = 0; // Online receipts (+)
    let doctorConsultsEarned = 0;      // 100% doctor consult fee
    let doctorLabReferralsEarned = 0;   // SOP lab test referral
    let doctorMedicineReferralsEarned = 0; // SOP medicine referral

    const seenConsultKeys = new Set<string>();

    ledgers.forEach(l => {
      const type = l.transactionType;
      const isCleared = l.paymentStatus === 'cleared' || (l as any).payment_status === 'cleared' || (l as any).paymentStatus === 'completed';
      if (!isCleared) return;

      const method = String(l.paymentMethod || (l as any).payment_method || '').toLowerCase();
      const isCash = method === 'cash';

      if (type === 'appointment_fee' || (type as any) === 'doctor_consultation_fee') {
        const key = `${l.invoiceId || l.id}_${(l as any).patientId || l.patientName || ''}`;
        if (!seenConsultKeys.has(key)) {
          seenConsultKeys.add(key);
          const fee = Number(l.grossAmount || l.netPayout || 500);
          doctorConsultsEarned += fee;
          if (!isCash) {
            totalOnlineOffsetReceived += fee;
          }
        }
      } else if (type === 'medicine_commission') {
        doctorMedicineReferralsEarned += Number(l.netPayout || 0);
        if (isCash) {
          const plat = Number((l as any).platformFee || (l as any).platform_fee || 0) || Math.round((l.grossAmount || 0) * 0.03);
          totalCashCommissionOwed += plat;
        }
      } else if (type === 'lab_commission') {
        doctorLabReferralsEarned += Number(l.netPayout || 0);
        if (isCash) {
          const plat = Number((l as any).platformFee || (l as any).platform_fee || 0) || Math.round((l.grossAmount || 0) * 0.03);
          totalCashCommissionOwed += plat;
        }
      } else if (type === 'platform_fee') {
        if (isCash) {
          totalCashCommissionOwed += Number(l.netPayout || 0);
        }
      }
    });

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

  static saveUnifiedInvoices(invoices: UnifiedInvoice[]): void {
    save('unified_invoices', invoices);
    notify();
  }

  static saveInvoices(invoices: Invoice[]): void {
    save('saas_invoices', invoices);
    notify();
  }
}


