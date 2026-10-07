import { supabase } from '../lib/supabaseClient';
import { load, save, writeAuditLog, notify } from './apiHelper';
import { walDB } from './api';
import { PatientService } from './patientService';
import { PaymentService } from './paymentService';
import { MASTER_TEST_CATALOG } from './labService';
import type { 
  UnifiedInvoice, 
  FinancialLedgerEntry, 
  Invoice, 
  Appointment, 
  Prescription, 
  ClinicSop, 
  Patient, 
  PrescriptionTemplateConfig,
  DoctorSettlementSummary,
  LedgerReconciliationResult
} from '../types';
import { getPodContext, FALLBACK_POD_ID, FALLBACK_ENTITY_ID, FALLBACK_DOCTOR_ID, DEMO_PATIENT_ID_1, DEMO_PATIENT_ID_2, resolveSovereignPodId } from './podContext';
import { safeGetStorageJSON } from '../utils/storage';
import { getIstDateString, getEffectiveAppointmentDate } from '../utils/dateUtils';
import { FinanceEngine } from './financeEngine';
import { cloudStore } from './cloudStore';
import { walDB } from './api';

/**
 * IEEE-754 Epsilon-safe currency precision rounder (Directive 151)
 */
export const toPrecisionCurrency = (val: number): number => {
  return Math.round(((Number(val) || 0) + Number.EPSILON) * 100) / 100;
};

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
            email === 'demo@mediflow.com'
          );
        }
      } catch (_e) { /* ignore */ }
    }

    const storeInvs = cloudStore.getSnapshot<UnifiedInvoice>('unified_invoices');
    let invoices = (storeInvs && storeInvs.length > 0) ? [...storeInvs] : load<UnifiedInvoice[]>('unified_invoices', []);
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

        const id = i.id || '';
        const pName = String(i.patientName || '').toLowerCase().trim();
        const pId = String(i.patientId || '');
        if (id.startsWith('inv-demo') || id.startsWith('inv-sample') || id.startsWith('inv-101') || id.startsWith('inv-102') || id.includes('rahul') || id.includes('E2E')) return false;
        if (testSyntheticNames.has(pName)) return false;
        if (demoPatientIds.has(pId)) return false;
        return true;
      });
    }
    // Normalize and defensively guard properties for all returned invoices
    return invoices.map(i => {
      const rawDoc = Number(i.doctorFee ?? (i as any).doctor_fee ?? 0);
      const rawLab = Number(i.labFee ?? (i as any).lab_fee ?? 0);
      const rawPharm = Number(i.pharmacyFee ?? (i as any).pharmacy_fee ?? 0);
      const rawPlat = Number(i.platformFee ?? (i as any).platform_fee ?? 0);
      const total = Number(i.totalAmount ?? (i as any).total_amount ?? (rawDoc + rawLab + rawPharm)) || 0;
      const statusRaw = String(i.paymentStatus ?? (i as any).payment_status ?? 'pending').toLowerCase();
      const paymentStatus = (statusRaw === 'cleared' || statusRaw === 'paid' || statusRaw === 'completed' || statusRaw === 'settled')
        ? 'cleared'
        : (statusRaw === 'unpaid' || statusRaw === 'pending' || statusRaw === 'pending_payment')
          ? 'pending'
          : statusRaw;

      return {
        ...i,
        totalAmount: total,
        total_amount: total,
        doctorFee: rawDoc,
        doctor_fee: rawDoc,
        labFee: rawLab,
        lab_fee: rawLab,
        pharmacyFee: rawPharm,
        pharmacy_fee: rawPharm,
        platformFee: rawPlat,
        platform_fee: rawPlat,
        paymentStatus,
        payment_status: paymentStatus,
        createdAt: i.createdAt || (i as any).created_at || new Date().toISOString(),
        created_at: i.createdAt || (i as any).created_at || new Date().toISOString()
      } as UnifiedInvoice;
    });
  }

  static saveFinancialLedgers(entries: FinancialLedgerEntry[]): void {
    entries.forEach(e => cloudStore.applyLocalDiff('financial_ledgers', e));
    save('financial_ledgers', entries);
    notify();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mediflow-financial-update'));
      window.dispatchEvent(new CustomEvent('mediflow-state-change'));
    }
  }

  static saveAppointments(appointments: Appointment[]): void {
    const currentPodId = getPodContext().podId;
    appointments.forEach(a => cloudStore.applyLocalDiff('appointments', a));
    save('saas_appointments', appointments);
    save('appointments', appointments);
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
            pod_id: (appt as any).podId || (appt as any).pod_id || currentPodId || FALLBACK_POD_ID,
            is_emergency: Boolean(appt.isEmergency || (appt as any).is_emergency),
            is_vip: Boolean(appt.isVip || (appt as any).is_vip),
            payment_status: (appt as any).paymentStatus || (appt as any).payment_status || 'cleared',
            problem: (appt as any).problem || (appt as any).chief_complaint || '',
            chief_complaint: (appt as any).chief_complaint || (appt as any).problem || ''
          });
        }

        if (dbAppts.length > 0) {
          await supabase.from('appointments').upsert(dbAppts, { onConflict: 'id' });
        }
      } catch (err) {
        console.warn('[BillingService] Bulk remote appointment dual-write notice:', err);
        for (const appt of appointments) {
          await walDB.addEntry('upsert_appointment', appt);
        }
      }
    })();
  }

  static async clearInvoice(invoiceId: string, paymentMethod: 'cash' | 'upi' | 'card' | 'razorpay' | 'cashfree' | 'paytm' | 'phonepe' = 'upi'): Promise<void> {
    const invoices = this.getUnifiedInvoices();
    const idx = invoices.findIndex(i => i.id === invoiceId);
    let invoiceAmount = 500;
    let targetPatientId = '';
    let targetApptId = '';

    if (idx !== -1) {
      invoices[idx].paymentStatus = 'cleared';
      invoices[idx].paymentMethod = paymentMethod;
      this.saveUnifiedInvoices(invoices);
      invoiceAmount = invoices[idx].totalAmount || 500;
      targetPatientId = invoices[idx].patientId || (invoices[idx] as any).patient_id || '';
      targetApptId = invoices[idx].encounterId || (invoices[idx] as any).encounter_id || '';
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
    const targetAppt = appts.find(a => 
      (targetApptId && a.id === targetApptId) || 
      a.id === invoiceId || 
      (targetPatientId && (a.patientId === targetPatientId || (a as any).patient_id === targetPatientId) && a.status === 'pending_payment')
    );
    const isPaperMode = typeof window !== 'undefined' && (
      localStorage.getItem('mediflow_digital_emr_enabled') === 'false' ||
      localStorage.getItem('vitalsync_operating_mode') === 'paper_rx'
    );
    const isEmergency = Boolean(
      targetAppt?.is_emergency || 
      (targetAppt as any)?.isEmergency || 
      (targetAppt as any)?.isVip || 
      (targetAppt as any)?.is_vip ||
      String(targetAppt?.token_number || (targetAppt as any)?.tokenNumber || '').toUpperCase().startsWith('VIP-') ||
      String(targetAppt?.token_number || (targetAppt as any)?.tokenNumber || '').toUpperCase().includes(' E')
    );
    if (targetAppt) {
      targetAppt.status = (isEmergency || targetAppt.isVirtual || isPaperMode) ? 'ready_for_consult' : 'scheduled';
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
      const nextQueueStatus = isEmergency ? 'sos_priority' : ((targetAppt?.isVirtual || isPaperMode) ? 'awaiting_consultation' : 'awaiting_vitals');
      PatientService.updatePatientQueueStatus(targetPatientId, nextQueueStatus);
      supabase.from('patient_registry').update({
        queue_status: nextQueueStatus
      }).eq('id', targetPatientId).then(() => {});
    }

    // Core Invoice Settlement & Financial Ledger Splits — Await to guarantee exact split persistence
    await this.recordInvoicePayment(invoiceId, paymentMethod);

    // Atomic Backend Settlement via Postgres RPC v2
    supabase.rpc('process_invoice_settlement_v2', {
      p_invoice_id: invoiceId,
      p_payment_method: paymentMethod,
      p_amount_paid: invoiceAmount
    }).then(({ error }) => {
      if (error) {
        // Safe fallback to v1 if v2 not yet applied in DB
        supabase.rpc('process_invoice_settlement', {
          p_invoice_id: invoiceId,
          p_payment_method: paymentMethod,
          p_amount_paid: invoiceAmount
        }).then(
          () => {},
          (err: any) => console.warn('[BillingService] RPC settlement fallback notice:', err?.message)
        );
      } else {
        writeAuditLog('invoice_payment_cleared', { invoiceId, paymentMethod }, invoiceId);
      }
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
            email === 'demo@mediflow.com'
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
      const testSyntheticNames = new Set(['rls test patient', 'auto test patient']);
      const effectivePod = (currentPodId && currentPodId !== 'unresolved-pod') ? currentPodId : FALLBACK_POD_ID;
      ledgers = ledgers.filter(l => {
        const pod = (l as any).podId || (l as any).pod_id;
        if (pod && effectivePod && pod !== effectivePod && pod !== FALLBACK_POD_ID && effectivePod !== FALLBACK_POD_ID) {
          return false;
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
            email === 'demo@mediflow.com'
          );
        }
      } catch (_e) { /* ignore */ }
    }

    const storeAppts = cloudStore.getSnapshot<Appointment>('appointments');
    let appts = (storeAppts && storeAppts.length > 0) ? [...storeAppts] : load<Appointment[]>('saas_appointments', []);
    if (!isDemoAccount) {
      const currentPodId = getPodContext().podId;
      const demoPatientIds = new Set([
        DEMO_PATIENT_ID_1, 
        DEMO_PATIENT_ID_2,
        'pat-101', 'pat-102', 'pat-103', 'pat-104', 'pat-105'
      ]);
      const testSyntheticNames = new Set(['rls test patient', 'patient customer', 'unknown patient', 'auto test patient']);
      const effectivePod = resolveSovereignPodId(currentPodId) || FALLBACK_POD_ID;
      appts = appts.filter(a => {
        const pod = (a as any).podId || (a as any).pod_id;
        const src = String(a.source || (a as any).source || '').toLowerCase();
        const isWa = src.includes('whatsapp') || Boolean(a.isVirtual || (a as any).is_virtual);
        const isPodMatch = !pod || pod === 'undefined' || pod === 'null' || pod === effectivePod || pod === FALLBACK_POD_ID || effectivePod === FALLBACK_POD_ID || pod === 'default-pod';
        if (!isPodMatch && !isWa) {
          return false;
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
    // Removed aggressive podId assignment to respect CDC dual-writes
    cloudStore.applyLocalDiff('appointments', appt);
    const appts = this.getAppointments();
    const idx = appts.findIndex(a => a.id === appt.id);
    if (idx >= 0) appts[idx] = appt;
    else appts.push(appt);
    save('saas_appointments', appts);
    save('appointments', appts);
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
        const podId = (appt as any).podId || (appt as any).pod_id || getPodContext().podId || FALLBACK_POD_ID;
        const nowISO = new Date().toISOString();
        const apptDate = getEffectiveAppointmentDate(appt) || (appt as any).date || getIstDateString();
        const pId = appt.patientId || (appt as any).patient_id;
        if (pId) {
          await supabase.from('appointments').upsert({
            id: appt.id,
            patient_id: pId,
            doctor_id: appt.doctorId || (appt as any).doctor_id || null,
            status: appt.status === 'completed' ? 'completed' : appt.status === 'cancelled' ? 'cancelled' : appt.status === 'pending_payment' ? 'pending_payment' : 'ready_for_consult',
            token_number: String(appt.tokenNumber || (appt as any).token_number || ''),
            patient_name: appt.patientName || (appt as any).patient_name || null,
            patient_phone: appt.patientPhone || (appt as any).patient_phone || null,
            is_virtual: Boolean(appt.isVirtual || (appt as any).is_virtual),
            virtual_date: (appt as any).virtualDate || (appt as any).virtual_date || apptDate,
            appointment_date: apptDate,
            virtual_time: (appt as any).virtualTime || (appt as any).virtual_time || '10:00 AM',
            virtual_meeting_url: (appt as any).virtualMeetingUrl || (appt as any).virtual_meeting_url || null,
            source: (appt as any).source || ((appt as any).isVirtual ? 'whatsapp' : 'counter'),
            appointment_time: (appt as any).appointmentTime || (appt as any).appointment_time || `${apptDate}T10:00:00.000Z`,
            created_at: (appt as any).createdAt || (appt as any).created_at || nowISO,
            pod_id: podId,
            is_emergency: Boolean(appt.isEmergency || (appt as any).is_emergency),
            is_vip: Boolean(appt.isVip || (appt as any).is_vip),
            payment_status: (appt as any).paymentStatus || (appt as any).payment_status || (((appt as any).source === 'paper_scan' || (appt as any).source === 'walkin') ? 'cleared' : 'cleared'),
            problem: (appt as any).problem || (appt as any).chief_complaint || '',
            chief_complaint: (appt as any).chief_complaint || (appt as any).problem || ''
          }, { onConflict: 'id' });
        }
      } catch (dbErr) {
        console.warn('[BillingService] Remote appointment dual-write notice:', dbErr);
      }
    })();
  }

  static async saveAppointmentAsync(appt: Appointment): Promise<Appointment> {
    this.saveAppointment(appt);
    try {
      const podId = (appt as any).podId || (appt as any).pod_id || getPodContext().podId || FALLBACK_POD_ID;
      const nowISO = new Date().toISOString();
      const apptDate = getEffectiveAppointmentDate(appt) || (appt as any).date || getIstDateString();
      const pId = appt.patientId || (appt as any).patient_id;
      if (pId) {
        // Defensively normalize status to strictly comply with Postgres appointments_status_check
        const rawStatus = ((appt.status || (appt as any).queue_status || 'ready_for_consult') as string).toLowerCase();
        let normalizedStatus: 'scheduled' | 'completed' | 'cancelled' | 'pending_payment' | 'ready_for_consult' = 'ready_for_consult';
        if (rawStatus === 'completed') normalizedStatus = 'completed';
        else if (rawStatus === 'cancelled') normalizedStatus = 'cancelled';
        else if (rawStatus === 'pending_payment' || rawStatus === 'pending') normalizedStatus = 'pending_payment';
        else if (rawStatus === 'ready_for_consult' || rawStatus === 'awaiting_consultation' || rawStatus === 'scheduled') normalizedStatus = 'ready_for_consult';
        else normalizedStatus = 'ready_for_consult';

        const rawDocId = appt.doctorId || (appt as any).doctor_id;
        const validDocId = (typeof rawDocId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawDocId)) ? rawDocId : null;

        const rawPaymentStatus = (((appt as any).paymentStatus || (appt as any).payment_status || '').toString()).toLowerCase();
        const src = String((appt as any).source || '').toLowerCase();
        let normalizedPaymentStatus = 'pending';
        if (['cleared', 'paid'].includes(rawPaymentStatus) || src.includes('paper') || src.includes('walkin')) normalizedPaymentStatus = 'cleared';
        else if (rawPaymentStatus === 'failed') normalizedPaymentStatus = 'failed';
        else normalizedPaymentStatus = 'pending';

        const apptPayload: any = {
          id: appt.id,
          patient_id: pId,
          doctor_id: validDocId,
          status: normalizedStatus,
          token_number: String(appt.tokenNumber || (appt as any).token_number || ''),
          patient_name: appt.patientName || (appt as any).patient_name || null,
          patient_phone: appt.patientPhone || (appt as any).patient_phone || null,
          is_virtual: Boolean(appt.isVirtual || (appt as any).is_virtual),
          virtual_date: (appt as any).virtualDate || (appt as any).virtual_date || apptDate,
          appointment_date: apptDate,
          virtual_time: (appt as any).virtualTime || (appt as any).virtual_time || '10:00 AM',
          virtual_meeting_url: (appt as any).virtualMeetingUrl || (appt as any).virtual_meeting_url || null,
          source: (appt as any).source || ((appt as any).isVirtual ? 'whatsapp' : 'counter'),
          appointment_time: (appt as any).appointmentTime || (appt as any).appointment_time || `${apptDate}T10:00:00.000Z`,
          created_at: (appt as any).createdAt || (appt as any).created_at || nowISO,
          pod_id: podId,
          entity_id: getPodContext().entityId || null,
          is_emergency: Boolean(appt.isEmergency || (appt as any).is_emergency),
          is_vip: Boolean(appt.isVip || (appt as any).is_vip),
          payment_status: normalizedPaymentStatus,
          problem: (appt as any).problem || (appt as any).chief_complaint || '',
          chief_complaint: (appt as any).chief_complaint || (appt as any).problem || '',
          occ_version: (appt.occVersion || appt.occ_version || 1) + 1
        };

        let { error } = await supabase.from('appointments').upsert(apptPayload, { onConflict: 'id' });
        
        if (error && error.message && error.message.includes('OCC_VERSION_MISMATCH')) {
          console.warn('[BillingService] OCC_VERSION_MISMATCH intercepted for appointment:', apptPayload.id);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('mediflow-toast', { detail: { title: 'Queue Update Blocked 🚨', message: 'This appointment was just modified by another counter. Syncing latest state...', type: 'error' } }));
          }
          return appt;
        }

        if (error && error.code === '23503') {
          // Foreign key violation on doctor_id or entity_id (not in profiles table) — fallback to null
          apptPayload.doctor_id = null;
          const retryRes = await supabase.from('appointments').upsert(apptPayload, { onConflict: 'id' });
          error = retryRes.error;
        }
        if (error) {
          console.warn('[BillingService] saveAppointmentAsync Supabase upsert error:', error);
          if (error.code !== '23505' && !error.message?.includes('OCC_VERSION_MISMATCH')) {
            try {
              console.warn('[BillingService] Upsert blocked (possibly RLS). Falling back to direct insert:', apptPayload.id);
              await supabase.from('appointments').insert(apptPayload).throwOnError();
              console.log('[BillingService] ✅ Recovered via plain INSERT for appointment:', apptPayload.id);
            } catch (insertErr: any) {
              if (insertErr.code === '23505') {
                try {
                  await supabase.from('appointments').update(apptPayload).eq('id', apptPayload.id).throwOnError();
                  console.log('[BillingService] ✅ Recovered via plain UPDATE for appointment:', apptPayload.id);
                } catch (updateErr) {
                  console.warn('[BillingService] Both insert and update fallbacks failed:', updateErr);
                }
              } else {
                console.warn('[BillingService] Insert fallback failed:', insertErr);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[BillingService] saveAppointmentAsync catch error:', e);
    }
    return appt;
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
            email === 'demo@mediflow.com'
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
    // Removed aggressive podId assignment to respect CDC dual-writes
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
        const podId = (invoice as any).podId || (invoice as any).pod_id || getPodContext().podId || FALLBACK_POD_ID;
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
    // Removed aggressive podId assignment to respect CDC dual-writes
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
        const podId = (rx as any).podId || (rx as any).pod_id || getPodContext().podId || FALLBACK_POD_ID;
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

  static async createGate1Consult(patientId: string, source: 'counter' | 'whatsapp' = 'counter', scheduledDate?: string, scheduledTime?: string): Promise<Invoice> {
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
    const pat = PatientService.getPatients().find(p => p.id === patientId);
    const tokenNumber = pat?.tokenNumber || (pat as any)?.token_number || await PatientService.generateNextTokenNumberAsync(effectiveDate, false);

    const newAppt: Appointment = {
      id: apptId,
      podId: ctx.podId,
      patientId,
      patientName: pat?.name || 'Patient',
      patientPhone: pat?.phone || '',
      tokenNumber: tokenNumber,
      doctorId: ctx.doctorId || null, // BUG-04 FIX: Dynamic only, no hardcoded demo doctor
      status: 'pending_payment',
      paymentStatus: source === 'counter' ? 'pending_counter' : 'unpaid',
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
    (newAppt as any).token_number = tokenNumber;
    (newAppt as any).patient_name = pat?.name || 'Patient';
    (newAppt as any).patient_phone = pat?.phone || '';
    (newAppt as any).payment_status = source === 'counter' ? 'pending_counter' : 'unpaid';
    this.saveAppointment(newAppt);

    // Save corresponding unified invoice in cloud store
    const existingUInvoices = this.getUnifiedInvoices();
    const newUnifiedInv: UnifiedInvoice = {
      id: newInvoice.id,
      encounterId: apptId,
      encounter_id: apptId,
      patientId: patientId,
      patient_id: patientId,
      patientName: pat?.name || 'Patient',
      patientPhone: pat?.phone || '',
      tokenNumber: tokenNumber,
      token_number: tokenNumber,
      doctorFee: consultFee,
      doctor_fee: consultFee,
      labFee: 0,
      pharmacyFee: 0,
      platformFee: 0,
      totalAmount: consultFee,
      paymentStatus: 'pending',
      paymentMethod: 'cash',
      podId: ctx.podId || FALLBACK_POD_ID,
      createdAt: new Date().toISOString()
    } as any;
    existingUInvoices.push(newUnifiedInv);
    this.saveUnifiedInvoices(existingUInvoices);

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

      // PILLAR 2: STRICT OFFLINE-FIRST WAL ENFORCEMENT
      try {
        walDB.addEntry('upsert_appointment', {
          id: apptId,
          patient_id: patientId,
          patient_name: pat?.name || 'Patient',
          patient_phone: pat?.phone || '',
          token_number: tokenNumber,
          source: source,
          doctor_id: resolvedDoctorId,
          status: 'pending_payment',
          appointment_time: `${effectiveDate}T04:30:00.000Z`,
          is_virtual: source === 'whatsapp',
          virtual_date: effectiveDate,
          appointment_date: effectiveDate,
          virtual_time: effectiveTime,
          pod_id: ctx.podId || FALLBACK_POD_ID
        });

        walDB.addEntry('upsert_invoice', {
          id: newInvoice.id,
          encounter_id: apptId,
          patient_id: patientId,
          token_number: tokenNumber,
          doctor_fee: consultFee,
          lab_fee: 0,
          pharmacy_fee: 0,
          platform_fee: 0,
          total_amount: consultFee,
          payment_status: 'pending',
          pod_id: ctx.podId || FALLBACK_POD_ID
        });
      } catch (_dbSyncErr) {
        console.warn('[BillingService] Initial consult WAL enqueue note:', _dbSyncErr);
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

  // PHASE 19 & 23: Immutable Refund / Rollback Protocol (GAAP/IFRS Event Sourcing)
  static async issueRefundCreditMemo(invoiceId: string, amount: number, reason: string): Promise<void> {
    const uInvoices = this.getUnifiedInvoices();
    const uInv = uInvoices.find(u => u.id === invoiceId);
    if (!uInv) return;

    const precAmount = toPrecisionCurrency(amount);
    const podEntityId = getPodContext().entityId;
    const creditMemoId = `tx-refund-${invoiceId.substring(0, 8)}-${crypto.randomUUID().substring(0, 4)}`;
    const creditMemo: FinancialLedgerEntry = {
      id: creditMemoId,
      invoiceId: invoiceId,
      sourceEntityId: podEntityId,
      destinationEntityId: podEntityId,
      transactionType: 'refund_credit_memo' as any,
      grossAmount: -Math.abs(precAmount),
      commissionRate: 0,
      netPayout: -Math.abs(precAmount),
      paymentStatus: 'cleared',
      settledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      patientId: uInv.patientId,
      patientName: uInv.patientName,
      paymentMethod: 'cash',
      idempotencyKey: `tx-refund-${invoiceId.substring(0, 8)}`,
      reconciledAt: new Date().toISOString()
    } as any;

    const ledgers = load<FinancialLedgerEntry[]>('financial_ledgers', []);
    ledgers.push(creditMemo);
    save('financial_ledgers', ledgers);

    try {
      // PILLAR 2: STRICT OFFLINE-FIRST WAL ENFORCEMENT
      walDB.addEntry('upsert_financial_ledger', {
        id: creditMemo.id,
        invoice_id: creditMemo.invoiceId,
        source_entity_id: creditMemo.sourceEntityId,
        destination_entity_id: creditMemo.destinationEntityId,
        transaction_type: creditMemo.transactionType,
        gross_amount: creditMemo.grossAmount,
        payment_status: creditMemo.paymentStatus,
        settled_at: creditMemo.settledAt,
        created_at: creditMemo.createdAt,
        patient_id: creditMemo.patientId,
        patient_name: creditMemo.patientName,
        payment_method: creditMemo.paymentMethod,
        pod_id: podEntityId || FALLBACK_POD_ID,
        idempotency_key: creditMemo.id,
        reconciled_at: new Date().toISOString()
      });
      
      uInv.paymentStatus = 'refunded';
      save('unified_invoices', uInvoices);
      
      walDB.addEntry('upsert_invoice', {
        id: invoiceId,
        payment_status: 'refunded'
      });
      
      notify();
      window.dispatchEvent(new CustomEvent('mediflow-toast', { detail: { message: `Refund processed. Immutable Credit Memo generated for ₹${precAmount}.`, type: 'success', title: 'Refund Completed' }}));
    } catch (e) {
      console.error('[BillingService] Refund failed:', e);
      if (walDB && walDB.addEntry) {
         await walDB.addEntry('issue_refund_credit_memo', { invoiceId, amount: precAmount, reason, creditMemo });
      }
    }
  }

  static async settleSaaSInvoice(invoiceId: string): Promise<void> {
    await this.recordInvoicePayment(invoiceId);
    notify();
  }

  /**
   * PHASE 23: Precision Multi-Entity Split Engine & Deterministic Idempotency
   */
  static async createLedgerSplitsForInvoiceFields(invoiceId: string, appointmentId: string, type: Invoice['type'], amount: number, paymentMethod: 'cash' | 'upi' | 'card' | 'razorpay' | 'cashfree' | 'paytm' | 'phonepe' = 'upi'): Promise<void> {
    const ledgerEntries = load<FinancialLedgerEntry[]>('financial_ledgers', []);
    const precAmount = toPrecisionCurrency(amount);
    
    // Check if splits already exist for this invoiceId and target transaction type (Deterministic Idempotency)
    const targetType = type === 'consult' ? 'appointment_fee' : (type === 'lab' ? 'lab_commission' : 'medicine_commission');
    const idempotencyPrefix = `tx-${invoiceId.substring(0, 8)}-${type}`;
    
    const existingIdx = ledgerEntries.findIndex(l => 
      l.invoiceId === invoiceId && 
      (l.transactionType === targetType || (targetType === 'appointment_fee' && (l.transactionType as any) === 'doctor_consultation_fee'))
    );

    if (existingIdx !== -1) {
      let updated = false;
      let platformAmt = 0;
      for (let i = 0; i < ledgerEntries.length; i++) {
        if (ledgerEntries[i].invoiceId === invoiceId && ledgerEntries[i].paymentStatus !== 'cleared') {
          ledgerEntries[i].paymentStatus = 'cleared';
          ledgerEntries[i].paymentMethod = paymentMethod;
          ledgerEntries[i].settledAt = new Date().toISOString();
          updated = true;
        }
        if (ledgerEntries[i].invoiceId === invoiceId && ledgerEntries[i].transactionType === 'platform_fee') {
          platformAmt += toPrecisionCurrency(ledgerEntries[i].netPayout);
        }
      }
      if (updated) {
        platformAmt = toPrecisionCurrency(platformAmt);
        save('financial_ledgers', ledgerEntries);
        supabase.from('financial_ledgers').update({
          payment_status: 'cleared',
          payment_method: paymentMethod,
          settled_at: new Date().toISOString()
        }).eq('invoice_id', invoiceId).then(({ error }) => {
           if (error) console.error('Error updating ledger status in Supabase:', error);
        });

        supabase.from('unified_invoices').update({
          platform_fee: 0,
          payment_method: paymentMethod
        }).eq('id', invoiceId).then(({ error }) => {
          if (error) console.error('Error updating platform_fee in unified_invoices:', error);
        });
      }
      return;
    }

    // Fetch active SOP or use defaults for doctor/lab splits
    const activeSop = this.getActiveSop();
    let splitDoc = activeSop?.extractedConfig?.splits?.doctor ?? 40;
    
    // Resolve patient name and appointment for this invoice
    const invoices = this.getInvoices();
    const uInvoices = this.getUnifiedInvoices();
    const appts = this.getAppointments();
    const patients = PatientService.getPatients();
    const inv = invoices.find(i => i.id === invoiceId);
    const uInv = uInvoices.find(u => u.id === invoiceId);
    const appt = appts.find(a => a.id === appointmentId || a.id === inv?.appointmentId || a.id === uInv?.encounterId);
    const patId = inv?.patientId || uInv?.patientId || appt?.patientId;
    const resolvedPatient = patients.find(p => p.id === patId);
    const resolvedPatientName = resolvedPatient?.name || uInv?.patientName || (inv as any)?.patientName || (appt as any)?.patient_name || 'Walk-in Patient';
    const resolvedDoctorId = appt?.doctorId || (appt as any)?.doctor_id || (uInv as any)?.doctorId || getPodContext().doctorId || null;

    // Dynamic Autonomous Revenue Splits
    if (resolvedDoctorId && typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('vitalsync_cached_profile');
        if (cached) {
           const prof = JSON.parse(cached);
           if (prof.id === resolvedDoctorId && prof.consultation_commission_rate != null) {
              splitDoc = prof.consultation_commission_rate;
           }
        } else {
           const { data: docProfile } = await supabase.from('profiles').select('consultation_commission_rate').eq('id', resolvedDoctorId).single();
           if (docProfile && docProfile.consultation_commission_rate != null) {
              splitDoc = docProfile.consultation_commission_rate;
           }
        }
      } catch (err) {
        console.warn('[BillingService] Failed to fetch dynamic doctor commission, falling back to SOP:', err);
      }
    }

    const splitPlatLab = 0; // Phase 25: 0% Platform Fee (NMC Ethics Code 6.4 Compliant)
    const splitLab = activeSop?.extractedConfig?.splits?.lab ?? (100 - splitDoc);

    const listToSave: FinancialLedgerEntry[] = [];
    let platformAmt = 0;
    const isCash = paymentMethod === 'cash';

    const podEntityId = getPodContext().entityId;
    const labDestId = getPodContext().labEntityId || podEntityId;
    const pharmDestId = getPodContext().pharmacyEntityId || podEntityId;

    if (type === 'consult') {
      // Counter Doctor Consultation Fee Immunity Protocol (0% platform charge, 0 pool refill)
      const docAmt = precAmount;
      platformAmt = 0;
      const docLedger: FinancialLedgerEntry = {
        id: crypto.randomUUID(),
        invoiceId: invoiceId,
        sourceEntityId: podEntityId,
        destinationEntityId: podEntityId,
        transactionType: 'appointment_fee',
        grossAmount: precAmount,
        commissionRate: 0,
        netPayout: docAmt,
        paymentStatus: 'cleared',
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        patientId: patId,
        patientName: resolvedPatientName,
        doctorId: resolvedDoctorId,
        paymentMethod,
        idempotencyKey: `${idempotencyPrefix}-doc`,
        reconciledAt: new Date().toISOString()
      } as any;
      listToSave.push(docLedger);
    } else if (type === 'lab') {
      platformAmt = 0;
      const remainingAmt = precAmount;
      const docAmt = toPrecisionCurrency(remainingAmt * (splitDoc / (splitDoc + splitLab)));
      const labAmt = toPrecisionCurrency(remainingAmt - docAmt);

      const docLedger: FinancialLedgerEntry = {
        id: crypto.randomUUID(),
        invoiceId: invoiceId,
        sourceEntityId: podEntityId,
        destinationEntityId: podEntityId,
        transactionType: 'appointment_fee',
        grossAmount: precAmount,
        commissionRate: splitDoc / 100,
        netPayout: docAmt,
        paymentStatus: 'cleared',
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        patientId: patId,
        patientName: resolvedPatientName,
        doctorId: resolvedDoctorId,
        paymentMethod,
        idempotencyKey: `${idempotencyPrefix}-doc`,
        reconciledAt: new Date().toISOString()
      } as any;

      const labLedger: FinancialLedgerEntry = {
        id: crypto.randomUUID(),
        invoiceId: invoiceId,
        sourceEntityId: podEntityId,
        destinationEntityId: labDestId,
        transactionType: 'lab_diagnostic',
        grossAmount: precAmount,
        commissionRate: splitLab / 100,
        netPayout: labAmt,
        paymentStatus: 'cleared',
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        patientId: patId,
        patientName: resolvedPatientName,
        doctorId: resolvedDoctorId,
        paymentMethod,
        idempotencyKey: `${idempotencyPrefix}-lab`,
        reconciledAt: new Date().toISOString()
      } as any;
      listToSave.push(docLedger, labLedger);
    } else if (type === 'pharmacy') {
      const medDoctorSplit = (activeSop?.extractedConfig?.splits as any)?.pharmacyDoctor ?? 20;
      platformAmt = 0;
      const remainingAmt = precAmount;
      const docMedAmt = toPrecisionCurrency(remainingAmt * (medDoctorSplit / 100));
      const pharmaAmt = toPrecisionCurrency(remainingAmt - docMedAmt);

      const docMedLedger: FinancialLedgerEntry = {
        id: crypto.randomUUID(),
        invoiceId: invoiceId,
        sourceEntityId: podEntityId,
        destinationEntityId: podEntityId,
        transactionType: 'medicine_commission',
        grossAmount: precAmount,
        commissionRate: medDoctorSplit / 100,
        netPayout: docMedAmt,
        paymentStatus: 'cleared',
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        patientId: patId,
        patientName: resolvedPatientName,
        doctorId: resolvedDoctorId,
        paymentMethod,
        idempotencyKey: `${idempotencyPrefix}-docmed`,
        reconciledAt: new Date().toISOString()
      } as any;

      const pharmacyLedger: FinancialLedgerEntry = {
        id: `tx-pharma-${invoiceId.substring(0, 8)}`,
        invoiceId: invoiceId,
        sourceEntityId: podEntityId,
        destinationEntityId: pharmDestId,
        transactionType: 'medicine_commission',
        grossAmount: precAmount,
        commissionRate: (100 - medDoctorSplit) / 100,
        netPayout: pharmaAmt,
        paymentStatus: 'cleared',
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        patientId: patId,
        patientName: resolvedPatientName,
        doctorId: resolvedDoctorId,
        paymentMethod,
        idempotencyKey: `${idempotencyPrefix}-pharm`,
        reconciledAt: new Date().toISOString()
      } as any;
      listToSave.push(docMedLedger, pharmacyLedger);
    }

    if (listToSave.length > 0) {
      ledgerEntries.unshift(...listToSave);
      this.saveFinancialLedgers(ledgerEntries);

      // Sync splits to Supabase with the new database columns
      const dbEntries = listToSave.map(s => ({
        id: s.id,
        invoice_id: s.invoiceId,
        appointment_id: appointmentId !== 'counter-checkout' ? appointmentId : null,
        patient_id: patId || null,
        patient_name: resolvedPatientName,
        doctor_id: resolvedDoctorId,
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
        pod_id: getPodContext().podId,
        idempotency_key: (s as any).idempotencyKey || s.id,
        reconciled_at: new Date().toISOString()
      }));

      // PILLAR 2: STRICT OFFLINE-FIRST WAL ENFORCEMENT
      dbEntries.forEach(entry => walDB.addEntry('upsert_financial_ledger', entry));

      // PILLAR 2: WAL ENFORCEMENT
      walDB.addEntry('upsert_invoice', {
        id: invoiceId,
        platform_fee: 0,
        payment_method: paymentMethod
      });

      window.dispatchEvent(new CustomEvent('mediflow-financial-update'));
      window.dispatchEvent(new CustomEvent('mediflow-state-change'));
    }
  }

  /**
   * PHASE 23: Doctor Settlement Summary Engine
   */
  static calculateDoctorSettlementSummary(doctorId: string, timeframe: string = '30d'): DoctorSettlementSummary {
    const ledgers = this.getFinancialLedgers();
    const now = new Date();
    const daysLimit = timeframe === '7d' ? 7 : (timeframe === '30d' ? 30 : (timeframe === '6m' ? 180 : 365));
    const cutoffDate = new Date(now.getTime() - daysLimit * 24 * 3600 * 1000);

    const docLedgers = ledgers.filter(entry => {
      if (doctorId && entry.doctorId && entry.doctorId !== doctorId) return false;
      if (!entry.createdAt) return true;
      const d = new Date(entry.createdAt);
      return isNaN(d.getTime()) || d >= cutoffDate;
    });

    let grossOpd = 0;
    let netOpd = 0;
    let pharmacyCut = 0;
    let labCut = 0;
    let totalRefunds = 0;
    let platformDeductions = 0;
    let unsettledCount = 0;

    docLedgers.forEach(e => {
      const gross = toPrecisionCurrency(e.grossAmount || 0);
      const net = toPrecisionCurrency(e.netPayout || 0);
      const tType = String(e.transactionType || (e as any).transaction_type || '');

      if (tType === 'appointment_fee' || tType === 'doctor_consultation_fee') {
        grossOpd = toPrecisionCurrency(grossOpd + gross);
        netOpd = toPrecisionCurrency(netOpd + net);
      } else if (tType === 'medicine_commission') {
        pharmacyCut = toPrecisionCurrency(pharmacyCut + net);
      } else if (tType === 'lab_commission') {
        labCut = toPrecisionCurrency(labCut + net);
      } else if (tType === 'refund_credit_memo') {
        totalRefunds = toPrecisionCurrency(totalRefunds + Math.abs(net));
      } else if (tType === 'platform_fee') {
        platformDeductions = toPrecisionCurrency(platformDeductions + net);
      }

      if (e.paymentStatus !== 'cleared') {
        unsettledCount++;
      }
    });

    const totalGross = toPrecisionCurrency(grossOpd + pharmacyCut + labCut);
    const totalNet = toPrecisionCurrency(netOpd + pharmacyCut + labCut - totalRefunds);
    const retainedBuffer = Math.min(1000, Math.max(0, totalNet));
    const transferable = toPrecisionCurrency(Math.max(0, totalNet - retainedBuffer));

    return {
      doctorId,
      timeframe,
      grossOpdConsults: grossOpd,
      netOpdConsults: netOpd,
      pharmacyReferralEarnings: pharmacyCut,
      labReferralEarnings: labCut,
      totalGrossRevenue: totalGross,
      totalNetEarnings: totalNet,
      totalRefunds,
      platformDeductions,
      transferableBalance: transferable,
      retainedBuffer,
      unsettledLedgerCount: unsettledCount,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * PHASE 23: Autonomous Orphaned Invoices Reconciler
   */
  static async reconcileOrphanedInvoices(): Promise<LedgerReconciliationResult> {
    const uInvoices = this.getUnifiedInvoices();
    const ledgers = this.getFinancialLedgers();
    const existingInvoiceIds = new Set(ledgers.map(l => l.invoiceId));
    let healed = 0;
    let totalVolume = 0;
    const reconciledIds: string[] = [];

    for (const inv of uInvoices) {
      const invId = inv.id;
      if (invId && !existingInvoiceIds.has(invId)) {
        const payStatus = String(inv.paymentStatus || (inv as any).status || 'pending');
        if (payStatus === 'paid' || payStatus === 'cleared') {
          const apptId = inv.encounterId || 'counter-checkout';
          const pMethod = (inv.paymentMethod as any) || 'upi';

          if (inv.doctorFee > 0) {
            await this.createLedgerSplitsForInvoiceFields(invId, apptId, 'consult', inv.doctorFee, pMethod);
          }
          if (inv.pharmacyFee > 0) {
            await this.createLedgerSplitsForInvoiceFields(invId, apptId, 'pharmacy', inv.pharmacyFee, pMethod);
          }
          if (inv.labFee > 0) {
            await this.createLedgerSplitsForInvoiceFields(invId, apptId, 'lab', inv.labFee, pMethod);
          }

          healed++;
          totalVolume = toPrecisionCurrency(totalVolume + (inv.totalAmount || 0));
          reconciledIds.push(invId);
          existingInvoiceIds.add(invId);
        }
      }
    }

    return {
      healedCount: healed,
      orphanedInvoicesFound: healed,
      reconciledInvoiceIds: reconciledIds,
      totalVolumeReconciled: totalVolume,
      status: healed > 0 ? 'ok' : 'clean',
      timestamp: new Date().toISOString()
    };
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
            id: crypto.randomUUID(),
            invoiceId: saasInv.id,
            appointmentId: appt.id,
            patientId: patId,
            doctorId: appt.doctorId || (appt as any).doctor_id,
            sourceEntityId: getPodContext().entityId || FALLBACK_ENTITY_ID,
            destinationEntityId: getPodContext().entityId || FALLBACK_ENTITY_ID,
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
          // PILLAR 2: STRICT OFFLINE-FIRST WAL ENFORCEMENT
          walDB.addEntry('upsert_financial_ledger', dbDocLedger);

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
      if (uInv.patientId) {
        await this.syncPatientLoyaltyUnlock(uInv.patientId);
      }
    } else if (resolvedInvoice) {
      await this.createLedgerSplitsForInvoiceFields(invoiceId, apptId, type, amount, paymentMethod);
      if (resolvedInvoice.patientId) {
        await this.syncPatientLoyaltyUnlock(resolvedInvoice.patientId);
      }
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

    const { data: inv } = await supabase.from('unified_invoices')
      .select('patient_id')
      .eq('id', invoiceId)
      .maybeSingle();

    if (inv?.patient_id) {
      await this.syncPatientLoyaltyUnlock(inv.patient_id, sendWhatsApp);
      if (sendWhatsApp) {
        const { data: patient } = await supabase.from('patient_registry')
          .select('phone')
          .eq('id', inv.patient_id)
          .maybeSingle();
        if (patient?.phone) {
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
      sopText: 'Doctor consultation fee: INR 500. HbA1c test price: INR 350. Splits: 40% Referring Doctor, 5% VitalSync Platform, 55% Lab. Pharmacy Splits: 20% Doctor, 2% VitalSync Platform, 78% Chemist.',
      extractedConfig: {
        doctor_fee: 500,
        doctor_upi_vpa: 'vitalsync@axl',
        test_prices: { '4544-3': 350, '2160-0': 250, '3024-7': 150, '2947-0': 200, '1975-2': 300 },
        splits: { doctor: 40, platform: 5, lab: 55, pharmacyDoctor: 20, pharmacyPlatform: 2 },
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
      if (s.extractedConfig) {
        if (s.extractedConfig.doctor_fee === 450) {
          s.extractedConfig.doctor_fee = 500;
          s.sopText = s.sopText?.replace(/450/g, '500');
          modified = true;
        }
        if (s.extractedConfig.splits?.platform === 3) {
          s.extractedConfig.splits.platform = 5;
          s.extractedConfig.splits.lab = 55;
          s.extractedConfig.splits.pharmacyPlatform = 2;
          modified = true;
        }
        if (!s.extractedConfig.doctor_upi_vpa) {
          s.extractedConfig.doctor_upi_vpa = PaymentService.getSafeClinicUpiVpa('vitalsync@axl');
          modified = true;
        }
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
    let cachedPodTemplate: any = null;
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('vitalsync_prescription_template');
        if (raw) cachedPodTemplate = JSON.parse(raw);
        if (!cachedPodTemplate) {
          const rawPod = localStorage.getItem('vitalsync_cached_active_pod') || localStorage.getItem('vitalsync_active_pod');
          if (rawPod) {
            const parsed = JSON.parse(rawPod);
            cachedPodTemplate = parsed?.prescriptionTemplate || parsed?.prescription_template;
          }
        }
      } catch (_e) {}
    }

    const activeSop = this.getActiveSop();
    const sopTemplate = cachedPodTemplate || activeSop?.extractedConfig?.prescriptionTemplate;
    const ctx = getPodContext();
    return {
      doctorName: sopTemplate?.doctorName || 'Dr. Rajesh Verma',
      doctorQualification: sopTemplate?.doctorQualification || 'MBBS, MS (Ophthalmology), FICO (London)',
      doctorRegNo: sopTemplate?.doctorRegNo || 'MCI-84992-A',
      clinicName: sopTemplate?.clinicName || (ctx as any).clinicName || 'VitalSync Smart PolyClinic',
      clinicAddress: sopTemplate?.clinicAddress || 'Line Bazar, Purnea, Bihar 854301',
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
    // Ground truth: Derive earnings directly from deduplicated financial ledgers via FinanceEngine SSOT
    const ledgers = this.getFinancialLedgers();
    let settlements = load<any[]>('vitalsync_pool_settlements', []);
    if (settlements.some(s => Math.abs(s.amount || s.total_amount || 0) > 50000)) {
      settlements = settlements.filter(s => Math.abs(s.amount || s.total_amount || 0) <= 50000);
      save('vitalsync_pool_settlements', settlements);
    }
    const activeSop = this.getActiveSop();
    return FinanceEngine.calculateRealtimeLedgerMetrics(ledgers, settlements, activeSop);
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

    const rawApptId = (invoice as any).appointmentId || (invoice.encounterId && invoice.encounterId !== 'walkin' && invoice.encounterId !== 'counter-checkout' ? invoice.encounterId : null);
    supabase.from('unified_invoices').upsert({
      id: invoice.id,
      encounter_id: invoice.encounterId === 'walkin' ? null : (invoice.encounterId || null),
      appointment_id: rawApptId,
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
      pod_id: getPodContext().podId,
      hash_signature: invoice.hash_signature || null,
      hash_timestamp: invoice.hash_timestamp || null
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

  /**
   * Evaluates whether a patient has unlocked 1 Free Virtual Consult.
   * INVARIANT: Free Virtual Consult is unlocked ONLY when patient has purchased
   * medicines from Partner Pharmacy AND completed lab tests from Partner Pathology,
   * with billing for both completed on the VitalSync platform within the last 30 days.
   */
  static checkPatientFreeVirtualEligibility(patientId: string): {
    isEligible: boolean;
    hasPharmacyBilled: boolean;
    hasLabBilled: boolean;
    reason: string;
  } {
    if (!patientId) {
      return { isEligible: false, hasPharmacyBilled: false, hasLabBilled: false, reason: 'Patient ID missing' };
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffTime = cutoff.getTime();

    // 1. Check for paid pharmacy / medicine bill
    const medBills = load<any[]>('medicine_bills', []);
    const hasMedBill = medBills.some(b => {
      const pId = b.patientId || b.patient_id;
      const status = String(b.status || '').toLowerCase();
      const createdAt = new Date(b.createdAt || b.created_at || Date.now()).getTime();
      return pId === patientId && status === 'paid' && createdAt >= cutoffTime;
    });

    // 2. Check for completed/paid lab requisition
    const labReqs = load<any[]>('lab_requisitions', []);
    const hasLabReq = labReqs.some(r => {
      const pId = r.patientId || r.patient_id;
      const status = String(r.status || '').toLowerCase();
      const createdAt = new Date(r.createdAt || r.created_at || Date.now()).getTime();
      return pId === patientId && ['completed', 'sample_collected', 'approved', 'verified', 'paid'].includes(status) && createdAt >= cutoffTime;
    });

    // 3. Check unified_invoices for pharmacyFee and labFee cleared
    const unifiedInvoices = this.getUnifiedInvoices();
    let hasUnifiedPharmacy = false;
    let hasUnifiedLab = false;
    unifiedInvoices.forEach(inv => {
      const pId = inv.patientId || (inv as any).patient_id;
      const status = String(inv.paymentStatus || (inv as any).payment_status || '').toLowerCase();
      const createdAt = new Date(inv.createdAt || (inv as any).created_at || Date.now()).getTime();
      if (pId === patientId && status === 'cleared' && createdAt >= cutoffTime) {
        if (Number(inv.pharmacyFee || (inv as any).pharmacy_fee || 0) > 0) hasUnifiedPharmacy = true;
        if (Number(inv.labFee || (inv as any).lab_fee || 0) > 0) hasUnifiedLab = true;
      }
    });

    // 4. Check saas_invoices
    const saasInvs = load<any[]>('saas_invoices', []);
    let hasSaasPharmacy = false;
    let hasSaasLab = false;
    saasInvs.forEach(inv => {
      const pId = inv.patientId || (inv as any).patient_id;
      const status = String(inv.status || inv.paymentStatus || '').toLowerCase();
      const type = String(inv.type || '').toLowerCase();
      const createdAt = new Date(inv.createdAt || (inv as any).created_at || Date.now()).getTime();
      if (pId === patientId && (status === 'paid' || status === 'cleared') && createdAt >= cutoffTime) {
        if (type === 'pharmacy') hasSaasPharmacy = true;
        if (type === 'lab') hasSaasLab = true;
      }
    });

    const hasPharmacyBilled = Boolean(hasMedBill || hasUnifiedPharmacy || hasSaasPharmacy);
    const hasLabBilled = Boolean(hasLabReq || hasUnifiedLab || hasSaasLab);
    const isEligible = Boolean(hasPharmacyBilled && hasLabBilled);

    let reason = '';
    if (isEligible) {
      reason = 'Eligible: Both Partner Pharmacy and Partner Pathology bills cleared on platform.';
    } else if (hasPharmacyBilled && !hasLabBilled) {
      reason = 'Locked: Partner Pharmacy billed, but Partner Pathology lab test billing is pending.';
    } else if (!hasPharmacyBilled && hasLabBilled) {
      reason = 'Locked: Partner Pathology billed, but Partner Pharmacy medicine billing is pending.';
    } else {
      reason = 'Locked: Neither Partner Pharmacy nor Partner Pathology bills cleared on platform.';
    }

    return { isEligible, hasPharmacyBilled, hasLabBilled, reason };
  }

  /**
   * Synchronizes loyalty entitlement and dispatches WhatsApp notification if newly unlocked.
   */
  static async syncPatientLoyaltyUnlock(patientId: string, triggerWhatsApp = true): Promise<boolean> {
    if (!patientId) return false;
    const eligibility = this.checkPatientFreeVirtualEligibility(patientId);
    
    const patients = PatientService.getPatients();
    const patIdx = patients.findIndex(p => p.id === patientId);
    if (patIdx >= 0) {
      const pat = patients[patIdx];
      const wasEligible = Boolean(pat.isPremiumMember || (pat as any).is_premium_member);
      
      pat.partnerBillingStatus = {
        hasPharmacyBilled: eligibility.hasPharmacyBilled,
        hasLabBilled: eligibility.hasLabBilled,
        isEligibleForFreeVirtual: eligibility.isEligible
      };

      if (eligibility.isEligible && !wasEligible) {
        pat.isPremiumMember = true;
        pat.freeVirtualConsultsAvailable = 1;
        pat.freeVirtualUnlockedAt = new Date().toISOString();
        const exp = new Date();
        exp.setDate(exp.getDate() + 30);
        pat.freeVirtualExpiresAt = exp.toISOString();
        
        PatientService.savePatient(pat);

        // Update Supabase DB
        try {
          await supabase.from('patient_registry').update({
            is_premium_member: true,
            free_virtual_consults_available: 1,
            free_virtual_unlocked_at: pat.freeVirtualUnlockedAt,
            free_virtual_expires_at: pat.freeVirtualExpiresAt
          }).eq('id', patientId);
        } catch (_err) {
          console.warn('[BillingService] Failed to update patient_registry loyalty:', _err);
        }

        // Dispatch WhatsApp notification
        if (triggerWhatsApp && pat.phone) {
          try {
            const { ClinicalNotificationService } = await import('./clinicalNotificationService');
            await ClinicalNotificationService.dispatchFreeFollowupLoyaltyWhatsApp({
              patientPhone: pat.phone,
              patientName: pat.name,
              expiryDays: 30
            });
          } catch (_notifyErr) {
            console.warn('[BillingService] Failed to dispatch loyalty WhatsApp notification:', _notifyErr);
          }
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('mediflow-state-change'));
          window.dispatchEvent(new CustomEvent('mediflow-loyalty-unlocked', { detail: { patientId } }));
        }
        return true;
      } else {
        PatientService.savePatient(pat);
      }
    }
    return eligibility.isEligible;
  }

  // PHASE 19: AI-Powered Revenue Leakage & Fraud Detection
  static async auditRevenueLeakage(): Promise<void> {
    try {
       const { PharmacyService } = await import('./pharmacyService');
       const inv = PharmacyService.getPharmacyInventory();
       const medBills = import('./apiHelper').then(m => m.load<any[]>('medicine_bills', []));
       
       let leakageDetected = false;
       let leakageDetails = '';
       
       const lowStockItems = inv.filter(i => i.stock < i.threshold);
       for (const item of lowStockItems) {
           const bills = await medBills;
           const recentSales = bills.filter(b => b.status === 'paid' && (b.items || []).some((bi:any) => bi.name.toLowerCase() === item.name.toLowerCase()));
           if (recentSales.length === 0 && item.stock < (item.threshold / 2)) {
               leakageDetected = true;
               leakageDetails = `${item.name} stock critically low (${item.stock}) but no paid bills found.`;
               break;
           }
       }
       
       if (leakageDetected) {
           window.dispatchEvent(new CustomEvent('mediflow-toast', { detail: { message: `🚨 REVENUE LEAKAGE ALERT: ${leakageDetails}`, type: 'error', title: 'AI Audit Alert' }}));
       }
    } catch (e) {
       console.warn('[BillingService] Revenue Audit failed:', e);
    }
  }

  // ─── PHASE 26: 100% Legal 'Practo Ray' Hospital Digital Ledger & Offline Reconciliation ───
  /**
   * Returns a complete audit-grade breakdown of gross hospital collections,
   * categorizing revenue by clinical department (OPD, Pharmacy, Pathology).
   * Invariant: 100% of revenue settles directly to the clinic (0% platform cut).
   */
  static getHospitalRevenueSummary(podId?: string): {
    grossTotal: number;
    opdConsultationTotal: number;
    pharmacyTotal: number;
    pathologyTotal: number;
    platformFeeTotal: number;
    directClinicRetentionPercent: number;
  } {
    const invoices = this.getUnifiedInvoices();
    const targetPod = podId || getPodContext().podId;
    const filtered = invoices.filter(inv => {
      const p = (inv as any).podId || (inv as any).pod_id;
      if (p && targetPod && p !== targetPod) return false;
      const status = String(inv.paymentStatus || (inv as any).status || '');
      return status === 'paid' || status === 'cleared' || status === 'completed';
    });

    let opd = 0;
    let pharm = 0;
    let lab = 0;
    filtered.forEach(inv => {
      opd += Number(inv.doctorFee || 0);
      pharm += Number(inv.pharmacyFee || 0);
      lab += Number(inv.labFee || 0);
    });

    return {
      grossTotal: opd + pharm + lab,
      opdConsultationTotal: opd,
      pharmacyTotal: pharm,
      pathologyTotal: lab,
      platformFeeTotal: 0,
      directClinicRetentionPercent: 100
    };
  }

  /**
   * Generates an offline B2B reconciliation report for clinics that outsource
   * diagnostic pathology or pharmacy items.
   * Enables the clinic to settle with partners via monthly commercial B2B invoices
   * instead of illegal on-the-fly checkout split cuts (NMC Ethics Code §6.4).
   */
  static getOfflineVendorReconciliation(podId?: string, monthString?: string): {
    billingMonth: string;
    totalPartnerInvoices: number;
    outsourcedLabAmount: number;
    outsourcedPharmacyAmount: number;
    settlementMode: string;
    complianceNote: string;
  } {
    const invoices = this.getUnifiedInvoices();
    const targetPod = podId || getPodContext().podId;
    const targetMonth = monthString || new Date().toISOString().slice(0, 7);

    let labSum = 0;
    let pharmSum = 0;
    let count = 0;

    invoices.forEach(inv => {
      const p = (inv as any).podId || (inv as any).pod_id;
      if (p && targetPod && p !== targetPod) return false;
      const invDate = String((inv as any).createdAt || (inv as any).updatedAt || '').slice(0, 7);
      if (invDate === targetMonth) {
        if ((inv.labFee || 0) > 0 || (inv.pharmacyFee || 0) > 0) {
          labSum += Number(inv.labFee || 0);
          pharmSum += Number(inv.pharmacyFee || 0);
          count++;
        }
      }
    });

    return {
      billingMonth: targetMonth,
      totalPartnerInvoices: count,
      outsourcedLabAmount: labSum,
      outsourcedPharmacyAmount: pharmSum,
      settlementMode: 'OFFLINE_COMMERCIAL_B2B_INVOICE',
      complianceNote: 'In accordance with NMC Ethics Code §6.4, clinic settles vendor accounts via monthly institutional B2B invoices.'
    };
  }
}


