import { supabase } from '../lib/supabaseClient';
import type { 
  Patient, 
  Encounter, 
  LabRequisition, 
  InventoryHold, 
  UnifiedInvoice, 
  WhatsAppSession, 
  FinancialLedgerEntry,
  PharmacyInventoryItem,
  ClinicSop
} from '../types';

class SupabaseDataService {
  // Realtime subscriptions
  subscribeToTable(table: string, callback: (payload: any) => void) {
    return supabase
      .channel(`realtime-${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => callback(payload)
      )
      .subscribe();
  }

  // Patients
  async getPatients(): Promise<Patient[]> {
    const { data, error } = await supabase
      .from('patient_registry')
      .select('*');

    if (error) throw error;
    return (data || []).map(p => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      age: p.age,
      gender: p.gender,
      allergies: p.allergies || [],
      chronicConditions: p.chronic_conditions || [],
      abhaId: p.abha_id || undefined,
      pastReportsSummary: p.past_reports_summary || undefined,
      createdAt: p.created_at
    }));
  }

  async registerPatient(patient: Omit<Patient, 'id' | 'createdAt'>): Promise<Patient> {
    const newId = crypto.randomUUID();
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('patient_registry')
      .insert({
        id: newId,
        name: patient.name,
        phone: patient.phone,
        age: patient.age,
        gender: patient.gender,
        allergies: patient.allergies,
        chronic_conditions: patient.chronicConditions,
        abha_id: patient.abhaId,
        registered_by: user?.id || null
      })
      .select()
      .single();

    if (error) throw error;
    
    return {
      id: data.id,
      name: data.name,
      phone: data.phone,
      age: data.age,
      gender: data.gender,
      allergies: data.allergies || [],
      chronicConditions: data.chronic_conditions || [],
      abhaId: data.abha_id || undefined,
      createdAt: data.created_at
    };
  }

  // Encounters
  async getEncounters(): Promise<Encounter[]> {
    const { data, error } = await supabase
      .from('encounters')
      .select(`
        id,
        patient_id,
        doctor_id,
        clinical_notes,
        status,
        created_at,
        patient:patient_registry(name),
        encounter_medications(id, medicine_name, dosage, frequency, duration),
        encounter_diagnostics(loinc_code, test_name)
      `);

    if (error) throw error;
    return (data || []).map((e: any) => ({
      id: e.id,
      patientId: e.patient_id,
      patientName: e.patient?.name || 'Unknown',
      doctorId: e.doctor_id,
      clinicalNotes: e.clinical_notes || '',
      medications: (e.encounter_medications || []).map((m: any) => ({
        id: m.id,
        medicineName: m.medicine_name,
        dosage: m.dosage,
        frequency: m.frequency,
        duration: m.duration
      })),
      diagnosticTests: (e.encounter_diagnostics || []).map((d: any) => ({
        loincCode: d.loinc_code,
        name: d.test_name,
        category: 'General',
        normalRange: '',
        unit: ''
      })),
      status: e.status === 'completed' ? 'completed' : 'active',
      createdAt: e.created_at
    }));
  }

  async createEncounter(encounter: Omit<Encounter, 'id' | 'createdAt' | 'status'>): Promise<Encounter> {
    const newId = crypto.randomUUID();
    
    // Insert encounter in active status
    const { error: encError } = await supabase
      .from('encounters')
      .insert({
        id: newId,
        patient_id: encounter.patientId,
        doctor_id: encounter.doctorId,
        clinical_notes: encounter.clinicalNotes,
        status: 'active'
      });

    if (encError) throw encError;

    // Insert meds
    if (encounter.medications.length > 0) {
      const { error: medsError } = await supabase
        .from('encounter_medications')
        .insert(encounter.medications.map(m => ({
          encounter_id: newId,
          medicine_name: m.medicineName,
          dosage: m.dosage,
          frequency: m.frequency,
          duration: m.duration
        })));
      if (medsError) throw medsError;
    }

    // Insert tests
    if (encounter.diagnosticTests.length > 0) {
      const { error: diagsError } = await supabase
        .from('encounter_diagnostics')
        .insert(encounter.diagnosticTests.map(t => ({
          encounter_id: newId,
          loinc_code: t.loincCode,
          test_name: t.name
        })));
      if (diagsError) throw diagsError;
    }

    // Complete encounter
    const { error: completeError } = await supabase
      .from('encounters')
      .update({ status: 'completed' })
      .eq('id', newId);

    if (completeError) throw completeError;

    return {
      ...encounter,
      id: newId,
      status: 'completed',
      createdAt: new Date().toISOString()
    };
  }

  // Lab Requisitions
  async getLabRequisitions(): Promise<LabRequisition[]> {
    const { data, error } = await supabase
      .from('lab_requisitions')
      .select(`
        id,
        encounter_id,
        patient_id,
        loinc_code,
        test_name,
        barcode,
        status,
        created_at,
        patient:patient_registry(name),
        lab_reports(result_value)
      `);

    if (error) throw error;
    return (data || []).map((r: any) => ({
      id: r.id,
      encounterId: r.encounter_id,
      patientId: r.patient_id,
      patientName: r.patient?.name || 'Unknown',
      testCode: r.loinc_code,
      testName: r.test_name,
      barcode: r.barcode,
      status: r.status === 'processing' ? 'collected' : (r.status === 'completed' ? 'completed' : r.status),
      quantitativeResult: r.lab_reports?.[0]?.result_value || undefined,
      reagentDeductions: [],
      createdAt: r.created_at
    }));
  }

  async updateLabRequisition(id: string, update: Partial<LabRequisition>): Promise<void> {
    const mappedUpdate: Record<string, any> = {};
    if (update.status) {
      mappedUpdate.status = update.status === 'collected' ? 'processing' : update.status;
    }

    const { error } = await supabase
      .from('lab_requisitions')
      .update(mappedUpdate)
      .eq('id', id);

    if (error) throw error;
  }

  // Inventory Holds
  async getInventoryHolds(): Promise<InventoryHold[]> {
    const { data, error } = await supabase
      .from('inventory_holds')
      .select('*');

    if (error) throw error;
    return (data || []).map(h => ({
      id: h.id,
      pharmacyId: h.pharmacy_entity_id,
      patientId: h.patient_id,
      medicineName: h.medicine_name,
      dosage: h.dosage || '',
      quantity: h.quantity,
      holdStatus: h.hold_status,
      expiryDate: h.expiry_date || '',
      batchNumber: h.batch_number || '',
      createdAt: h.created_at
    }));
  }

  // Financial Ledgers
  async getFinancialLedgers(): Promise<FinancialLedgerEntry[]> {
    const { data, error } = await supabase
      .from('financial_ledgers')
      .select('*');

    if (error) throw error;
    return (data || []).map(l => ({
      id: l.id,
      invoiceId: l.invoice_id,
      sourceEntityId: l.source_entity_id,
      destinationEntityId: l.destination_entity_id,
      transactionType: l.transaction_type,
      grossAmount: Number(l.gross_amount),
      commissionRate: Number(l.commission_rate),
      netPayout: Number(l.net_payout),
      paymentStatus: l.payment_status,
      settledAt: l.settled_at,
      createdAt: l.created_at
    }));
  }

  // Invoices
  async getUnifiedInvoices(): Promise<UnifiedInvoice[]> {
    const { data, error } = await supabase
      .from('unified_invoices')
      .select(`
        id,
        encounter_id,
        patient_id,
        doctor_fee,
        lab_fee,
        pharmacy_fee,
        platform_fee,
        total_amount,
        upi_qr_payload,
        payment_status,
        created_at,
        patient:patient_registry(name, phone)
      `);

    if (error) throw error;
    return (data || []).map((i: any) => ({
      id: i.id,
      encounterId: i.encounter_id,
      patientId: i.patient_id,
      patientName: i.patient?.name || 'Unknown',
      patientPhone: i.patient?.phone || '',
      doctorFee: Number(i.doctor_fee),
      labFee: Number(i.lab_fee),
      pharmacyFee: Number(i.pharmacy_fee),
      platformFee: Number(i.platform_fee),
      totalAmount: Number(i.total_amount),
      upiQrPayload: i.upi_qr_payload || '',
      paymentStatus: i.payment_status,
      createdAt: i.created_at
    }));
  }

  // WhatsApp Sessions
  async getWhatsAppSessions(): Promise<WhatsAppSession[]> {
    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .select('*');

    if (error) throw error;
    return (data || []).map(s => ({
      id: s.id,
      patientPhone: s.patient_phone,
      currentState: s.current_state,
      lastInteraction: s.last_interaction,
      sessionData: s.session_data || {}
    }));
  }

  // Cashfree Vendors
  async getCashfreeVendors(entityId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('cashfree_vendors')
      .select('*')
      .eq('entity_id', entityId);

    if (error) throw error;
    return data || [];
  }
}

export const supabaseDataService = new SupabaseDataService();
