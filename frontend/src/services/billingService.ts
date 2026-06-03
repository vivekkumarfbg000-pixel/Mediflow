import { supabase } from '../lib/supabaseClient';
import { load, save, writeAuditLog, notify } from './apiHelper';
import { PatientService } from './patientService';
import { LabService, MASTER_TEST_CATALOG } from './labService';
import { PharmacyService } from './pharmacyService';
import type { UnifiedInvoice, FinancialLedgerEntry, Invoice, Appointment, Prescription, ClinicSop } from '../types';

export class BillingService {
  static getUnifiedInvoices(): UnifiedInvoice[] {
    return load<UnifiedInvoice[]>('unified_invoices', []);
  }

  static clearInvoice(invoiceId: string): void {
    const invoices = this.getUnifiedInvoices();
    const idx = invoices.findIndex(i => i.id === invoiceId);
    if (idx !== -1) {
      invoices[idx].paymentStatus = 'cleared';
      save('unified_invoices', invoices);

      const sessions = load<any[]>('whatsapp_sessions', []);
      const session = sessions.find(s => s.patientPhone === invoices[idx].patientPhone);
      if (session?.sessionData?.referral) {
        const ref = session.sessionData.referral;
        const ledgerEntries = load<FinancialLedgerEntry[]>('financial_ledgers', []);
        
        const platformAmt = Math.max(10.00, parseFloat((500 * 0.03).toFixed(2)));
        
        const referralLedger: FinancialLedgerEntry = {
          id: `tx-ref-${crypto.randomUUID().substring(0, 8)}`,
          invoiceId: invoiceId,
          sourceEntityId: 'clinic-admin-entity',
          destinationEntityId: 'clinic-admin-entity',
          transactionType: 'appointment_fee',
          grossAmount: 500,
          commissionRate: 0.10,
          netPayout: ref.referralCommissionAmt || 50.00,
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
          grossAmount: 500,
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

        const dbRefLedger = {
          invoice_id: invoiceId,
          source_entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
          destination_entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
          transaction_type: 'appointment_fee',
          gross_amount: 500,
          commission_rate: 10,
          net_payout: 50.00,
          payment_status: 'cleared',
          settled_at: new Date().toISOString()
        };
        const dbPlatLedger = {
          invoice_id: invoiceId,
          source_entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
          destination_entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
          transaction_type: 'platform_fee',
          gross_amount: 500,
          commission_rate: 3,
          net_payout: platformAmt,
          payment_status: 'cleared',
          settled_at: new Date().toISOString()
        };

        supabase.from('financial_ledgers').insert([dbRefLedger, dbPlatLedger]).then(({ error }) => {
          if (error) console.error('Error inserting referral ledger splits in Supabase:', error);
        });
      }

      supabase.from('unified_invoices').update({
        payment_status: 'cleared',
        paid_at: new Date().toISOString()
      }).eq('id', invoiceId).then(({ error }) => {
        if (error) console.error('Error clearing invoice payment in Supabase:', error);
        else writeAuditLog('invoice_payment_cleared', { invoiceId }, invoiceId);
      });
    }
  }

  static getFinancialLedgers(invoiceId?: string): FinancialLedgerEntry[] {
    const ledgers = load<FinancialLedgerEntry[]>('financial_ledgers', []);
    if (invoiceId) {
      return ledgers.filter(l => l.invoiceId === invoiceId);
    }
    return ledgers;
  }

  static getAppointments(): Appointment[] {
    return load<Appointment[]>('saas_appointments', []);
  }

  static saveAppointment(appt: Appointment): void {
    const appts = this.getAppointments();
    const idx = appts.findIndex(a => a.id === appt.id);
    if (idx >= 0) appts[idx] = appt;
    else appts.push(appt);
    save('saas_appointments', appts);
    notify();
  }

  static getInvoices(): Invoice[] {
    return load<Invoice[]>('saas_invoices', []);
  }

  static saveInvoice(invoice: Invoice): void {
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
    const prescriptions = this.getPrescriptions();
    const idx = prescriptions.findIndex(p => p.id === rx.id);
    if (idx >= 0) prescriptions[idx] = rx;
    else prescriptions.push(rx);
    save('saas_prescriptions', prescriptions);
    notify();
  }

  static createGate1Consult(patientId: string): void {
    const apptId = crypto.randomUUID();
    const newAppt: Appointment = {
      id: apptId,
      patientId,
      doctorId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101',
      status: 'pending_payment',
      createdAt: new Date().toISOString()
    };
    this.saveAppointment(newAppt);

    const newInvoice: Invoice = {
      id: crypto.randomUUID(),
      appointmentId: apptId,
      type: 'consult',
      amount: 450,
      status: 'unpaid',
      createdAt: new Date().toISOString()
    };
    this.saveInvoice(newInvoice);
    
    const patient = PatientService.getPatients().find(p => p.id === patientId);
    if (patient) {
      // Direct push WhatsApp message bot history logic
      const sessions = load<any[]>('whatsapp_sessions', []);
      const existing = sessions.find(s => s.patientPhone === patient.phone);
      if (existing) {
        const text = `🟢 *Welcome to Mediflow Connected Clinic!* \n\nYour Consultation booking is pending. Please pay the consultation fee of *₹450* to proceed.\n\n_Payment Gateway Link: upi://pay?pa=mediflow@icici&pn=Mediflow&am=450.00_`;
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

  static settleSaaSInvoice(invoiceId: string): void {
    this.recordInvoicePayment(invoiceId);
    notify();
  }

  static createLedgerSplitsForInvoiceFields(invoiceId: string, appointmentId: string, type: 'consult' | 'lab' | 'pharmacy', amount: number): void {
    const ledgerEntries = load<FinancialLedgerEntry[]>('financial_ledgers', []);
    
    // Check if splits already exist for this invoiceId
    const exists = ledgerEntries.some(l => l.invoiceId === invoiceId);
    if (exists) return;

    // Fetch active SOP or use defaults
    const activeSop = this.getActiveSop();
    const splitDoc = activeSop?.extractedConfig?.splits?.doctor ?? 40;
    const splitPlat = activeSop?.extractedConfig?.splits?.platform ?? 3;
    const splitLab = activeSop?.extractedConfig?.splits?.lab ?? 57;

    const platformAmt = parseFloat((amount * (splitPlat / 100)).toFixed(2));
    const listToSave: FinancialLedgerEntry[] = [];

    if (type === 'consult') {
      const docAmt = parseFloat((amount * (1 - splitPlat / 100)).toFixed(2));
      const platformLedger: FinancialLedgerEntry = {
        id: `tx-plat-${crypto.randomUUID().substring(0, 8)}`,
        invoiceId: invoiceId,
        sourceEntityId: 'clinic-admin-entity',
        destinationEntityId: 'platform-admin-entity',
        transactionType: 'platform_fee',
        grossAmount: amount,
        commissionRate: splitPlat / 105, // matches commissionRate type bounds
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
        commissionRate: 1 - splitPlat / 100,
        netPayout: docAmt,
        paymentStatus: 'cleared',
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      listToSave.push(platformLedger, docLedger);
    } else if (type === 'lab') {
      const docAmt = parseFloat((amount * (splitDoc / 100)).toFixed(2));
      const labAmt = parseFloat((amount * (splitLab / 100)).toFixed(2));

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
      const pharmaAmt = parseFloat((amount * (1 - splitPlat / 100)).toFixed(2));
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

      const pharmacyLedger: FinancialLedgerEntry = {
        id: `tx-pharma-${crypto.randomUUID().substring(0, 8)}`,
        invoiceId: invoiceId,
        sourceEntityId: 'clinic-admin-entity',
        destinationEntityId: 'pharmacy-partner-entity',
        transactionType: 'medicine_commission',
        grossAmount: amount,
        commissionRate: 1 - splitPlat / 100,
        netPayout: pharmaAmt,
        paymentStatus: 'cleared',
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      listToSave.push(platformLedger, pharmacyLedger);
    }

    if (listToSave.length > 0) {
      ledgerEntries.unshift(...listToSave);
      save('financial_ledgers', ledgerEntries);

      // Sync splits to Supabase
      const dbEntries = listToSave.map(s => ({
        invoice_id: s.invoiceId.length === 36 ? s.invoiceId : null,
        source_entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002', // clinic
        destination_entity_id: s.destinationEntityId === 'platform-admin-entity' ? 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002' : (s.destinationEntityId === 'lab-partner-entity' ? 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003' : 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317004'), // lab or pharmacy
        transaction_type: s.transactionType,
        gross_amount: s.grossAmount,
        commission_rate: s.commissionRate * 100,
        net_payout: s.netPayout,
        payment_status: 'cleared',
        settled_at: new Date().toISOString()
      }));

      supabase.from('financial_ledgers').insert(dbEntries).then(({ error }) => {
        if (error) console.error('Error inserting cash ledger splits in Supabase:', error);
      });
    }
  }

  static recordInvoicePayment(invoiceId: string): void {
    const saasInvoices = this.getInvoices();
    const saasInv = saasInvoices.find(i => i.id === invoiceId);
    
    const uInvoices = this.getUnifiedInvoices();
    const uInv = uInvoices.find(i => i.id === invoiceId || (saasInv && i.encounterId === saasInv.appointmentId));

    let resolvedInvoice: any = null;
    let amount = 0;
    let type: 'consult' | 'lab' | 'pharmacy' = 'consult';
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
              const text = `✅ *Consultation Fee Received!* \n\nPatient has been added to Doctor Vivek's active queue. Please enter the consultation chamber when called.`;
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
      this.createLedgerSplitsForInvoiceFields(invoiceId, apptId, type, amount);
    }
  }

  static async markInvoicePaid(invoiceId: string, sendWhatsApp = true): Promise<void> {
    const { error } = await supabase.from('unified_invoices')
      .update({ payment_status: 'paid' })
      .eq('id', invoiceId);
    if (error) {
      console.error('[Mediflow API] markInvoicePaid error:', error);
      throw error;
    }
    writeAuditLog('INVOICE_PAID', { invoiceId }, invoiceId);
    
    // Process local status transitions and create ledger splits
    this.recordInvoicePayment(invoiceId);

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
    
    const labInvoice: Invoice = {
      id: crypto.randomUUID(),
      appointmentId,
      type: 'lab',
      amount: 600,
      status: 'unpaid',
      createdAt: new Date().toISOString()
    };
    this.saveInvoice(labInvoice);

    const pharmaInvoice: Invoice = {
      id: crypto.randomUUID(),
      appointmentId,
      type: 'pharmacy',
      amount: 150,
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
    const { data, error } = await supabase.from('appointments').insert({
      patient_id: appointment.patient_id,
      doctor_id: appointment.doctor_id,
      status: appointment.status ?? 'pending_payment',
      created_at: new Date().toISOString(),
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
    const { data, error } = await supabase.from('unified_invoices').insert({
      encounter_id: appointmentId,
      patient_id: patientData.patient_id,
      doctor_fee: type === 'consult' ? amount : 0,
      lab_fee: type === 'lab' ? amount : 0,
      pharmacy_fee: type === 'pharmacy' ? amount : 0,
      platform_fee: 0,
      total_amount: amount,
      payment_status: 'unpaid',
      created_at: new Date().toISOString(),
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
      entityId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
      sopFileName: 'Kankarbagh_Clinic_Standard_SOP.txt',
      sopText: 'Doctor consultation fee: INR 450. HbA1c test price: INR 350. Splits: 40% Referring Doctor, 3% Platform, 57% Lab.',
      extractedConfig: {
        doctor_fee: 450,
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
    return load<ClinicSop[]>('clinic_sops', [defaultSop]);
  }

  static saveClinicSops(sops: ClinicSop[]) {
    save('clinic_sops', sops);
    notify();
  }

  static getActiveSop(): ClinicSop | null {
    const sops = this.getClinicSops();
    return sops.find(s => s.isActive) || null;
  }
}
