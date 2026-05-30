import { supabase } from '../lib/supabaseClient';
import { TelemetryService } from './telemetry';
import { load, save, writeAuditLog, notify } from './apiHelper';
import { PatientService, INITIAL_PATIENTS } from './patientService';
import { EncounterService } from './encounterService';
import { PharmacyService } from './pharmacyService';
import { LabService, MASTER_TEST_CATALOG, OPHTHALMIC_TEST_CATALOG } from './labService';
import { BillingService } from './billingService';
import { WhatsAppService } from './whatsappService';
import { ForecastService } from './forecastService';
import { StaffService } from './staffService';

import type { 
  Patient, 
  PatientVitals,
  Encounter, 
  LabRequisition, 
  InventoryHold, 
  UnifiedInvoice, 
  WhatsAppSession, 
  SeasonalForecast,
  DiagnosticTest,
  HistoricalBiomarker,
  ChatMessage,
  ClinicStaff,
  FinancialLedgerEntry,
  PharmacyInventoryItem,
  WhatsAppDrugOrder,
  PathologyReport,
  ClinicSop,
  MedicineBill,
  MedicineBillItem,
  CounterTransaction,
  MedicineImportRow,
  Invoice,
  Prescription,
  Appointment,
  LabReport,
  ReagentStock
} from '../types';

export { MASTER_TEST_CATALOG, OPHTHALMIC_TEST_CATALOG };
export type { ReagentStock };

export interface DBEncounterMedication {
  id: string;
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface DBEncounterDiagnostic {
  loinc_code: string;
  test_name: string;
}

export interface DBEncounter {
  id: string;
  patient_id: string;
  doctor_id: string;
  clinical_notes: string | null;
  status: string;
  created_at: string;
  patient: { name: string } | null;
  encounter_medications: DBEncounterMedication[] | null;
  encounter_diagnostics: DBEncounterDiagnostic[] | null;
}

export interface DBLabRequisition {
  id: string;
  encounter_id: string;
  patient_id: string;
  loinc_code: string;
  test_name: string;
  barcode: string;
  status: string;
  lab_reports?: { result_value: string }[] | null;
  created_at: string;
  assigned_technician_id: string | null;
  patient: { name: string } | null;
}

export interface DBInvoice {
  id: string;
  encounter_id: string;
  patient_id: string;
  doctor_fee: string | number;
  lab_fee: string | number;
  pharmacy_fee: string | number;
  platform_fee: string | number;
  total_amount: string | number;
  upi_qr_payload: string | null;
  payment_status: string;
  created_at: string;
  patient: { name: string; phone: string } | null;
}

class MediflowApiService {
  private listeners: Set<() => void> = new Set();
  public isSyncing = false;
  public isVoiceScribing = false;
  public isOcrScanning = false;
  public isLabTrending = false;
  public simulatedRole = 'compounder';

  constructor() {
    if (typeof window !== 'undefined') {
      (window as any).api = this;
      (window as any).supabase = supabase;
    }
    this.syncFromSupabase();

    supabase
      .channel('mediflow-pod-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          console.log('[Mediflow Realtime] Event received:', payload.table, payload.eventType);
          this.syncFromSupabase();
        }
      )
      .subscribe((status) => {
        console.log('[Mediflow Realtime] Channel status changed:', status);
      });

    setInterval(() => this.syncFromSupabase(), 15000);
  }

  setSimulatedRole(role: string) {
    this.simulatedRole = role;
    this.syncFromSupabase();
  }

  async writeAuditLog(actionType: string, details: Record<string, any> = {}, entityId: string | null = null): Promise<void> {
    await writeAuditLog(actionType, { ...details, simulated_role: this.simulatedRole }, entityId);
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  private load<T>(key: string, defaultValue: T): T {
    return load<T>(key, defaultValue);
  }

  private save<T>(key: string, value: T): void {
    save(key, value);
  }

  public async syncFromSupabase(): Promise<void> {
    this.isSyncing = true;
    this.notify();
    try {
      const { data: dbConsents } = await supabase
        .from('patient_consents')
        .select('*')
        .is('revoked_at', null);

      const activePatientIds = new Set<string>();
      if (dbConsents) {
        dbConsents.forEach(c => {
          const grantedDate = new Date(c.granted_at);
          const diffDays = (new Date().getTime() - grantedDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays <= 30) {
            activePatientIds.add(c.patient_id);
          }
        });
      }
      this.save('active_consent_ids', Array.from(activePatientIds));

      const { data: dbPatients } = await supabase.from('patient_registry').select('*');
      if (dbPatients) {
        const isClinicalRole = ['doctor', 'compounder', 'receptionist', 'admin', 'platform_admin'].includes(this.simulatedRole);
        const filteredPatients = dbPatients.filter(p => isClinicalRole || activePatientIds.has(p.id));

        const patients = filteredPatients.map(p => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
          age: p.age,
          gender: p.gender as Patient['gender'],
          allergies: p.allergies || [],
          chronicConditions: p.chronic_conditions || [],
          abhaId: p.abha_id || undefined,
          pastReportsSummary: p.past_reports_summary || undefined,
          createdAt: p.created_at
        }));
        this.save('patients', patients);
      }

      const { data: dbSessions } = await supabase.from('whatsapp_sessions').select('*');
      if (dbSessions) {
        const sessions = dbSessions.map(s => ({
          id: s.id,
          patientPhone: s.patient_phone,
          currentState: s.current_state as WhatsAppSession['currentState'],
          lastInteraction: s.last_interaction,
          sessionData: s.session_data || {}
        }));
        this.save('whatsapp_sessions', sessions);
      }

      if (this.simulatedRole === 'pharmacist') {
        console.warn('[Mediflow DevSecOps] Security Block: Pharmacist role is strictly blocked from querying clinical encounter notes.');
        this.save('encounters', []);
      } else {
        const { data: dbEncounters } = await supabase.from('encounters').select(`
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
        if (dbEncounters) {
          const encounters = (dbEncounters as unknown as DBEncounter[]).map((e: DBEncounter) => ({
            id: e.id,
            patientId: e.patient_id,
            patientName: e.patient?.name || 'Unknown',
            doctorId: e.doctor_id,
            clinicalNotes: e.clinical_notes || '',
            medications: (e.encounter_medications || []).map((m: DBEncounterMedication) => ({
              id: m.id,
              medicineName: m.medicine_name,
              dosage: m.dosage,
              frequency: m.frequency,
              duration: m.duration
            })),
            diagnosticTests: (e.encounter_diagnostics || []).map((d: DBEncounterDiagnostic) => {
              const master = MASTER_TEST_CATALOG.find(t => t.loincCode === d.loinc_code);
              return {
                loincCode: d.loinc_code,
                name: d.test_name,
                category: master?.category || 'General',
                normalRange: master?.normalRange || '',
                unit: master?.unit || ''
              };
            }),
            status: e.status === 'completed' ? 'completed' as const : 'active' as const,
            createdAt: e.created_at
          }));
          this.save('encounters', encounters);
        }
      }

      let reqQuery = supabase.from('lab_requisitions').select(`
        id,
        encounter_id,
        patient_id,
        loinc_code,
        test_name,
        barcode,
        status,
        created_at,
        assigned_technician_id,
        patient:patient_registry(name),
        lab_reports(result_value)
      `);

      if (this.simulatedRole === 'lab_technician') {
        reqQuery = reqQuery.eq('assigned_technician_id', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102');
      }

      const { data: dbReqs } = await reqQuery;
      if (dbReqs) {
        const requisitions = (dbReqs as unknown as DBLabRequisition[]).map((r: DBLabRequisition) => {
          const getReagents = (loinc: string) => {
            switch(loinc) {
              case '4544-3': return [{ reagentName: 'HbA1c Enzyme Reagent A', volumeDeducted: 1.5, unit: 'ml' }];
              case '2160-0': return [{ reagentName: 'Creatinine Alkaline Picrate B', volumeDeducted: 2.0, unit: 'ml' }];
              case '3024-7': return [{ reagentName: 'Drabkin Reagent (Hemoglobin)', volumeDeducted: 1.0, unit: 'ml' }];
              case '2947-0': return [{ reagentName: 'Sodium Ion Reagent', volumeDeducted: 1.2, unit: 'ml' }];
              case '1975-2': return [{ reagentName: 'Bilirubin Diazo Reagent', volumeDeducted: 1.8, unit: 'ml' }];
              default: return [];
            }
          };

          const rx = this.getPrescriptions().find(p => p.appointmentId === r.encounter_id || p.appointmentId === r.id);

          return {
            id: r.id,
            encounterId: r.encounter_id,
            patientId: r.patient_id,
            patientName: r.patient?.name || 'Unknown',
            testCode: r.loinc_code,
            testName: r.test_name,
            barcode: r.barcode,
            status: r.status === 'processing' ? 'collected' : (r.status === 'completed' ? 'completed' : r.status),
            quantitativeResult: r.lab_reports?.[0]?.result_value || undefined,
            reagentDeductions: r.status === 'completed' ? getReagents(r.loinc_code) : [],
            prescriptionFileUrl: rx?.prescriptionFileUrl || undefined,
            createdAt: r.created_at
          };
        });
        this.save('lab_requisitions', requisitions);
      }

      const { data: dbReagents } = await supabase.from('reagent_inventory').select('*');
      if (dbReagents) {
        const reagents = dbReagents.map(r => ({
          reagentName: r.reagent_name,
          stockVolume: Number(r.stock_volume),
          unit: r.unit
        }));
        this.save('reagents', reagents);
      }

      const { data: dbHolds } = await supabase.from('inventory_holds').select('*');
      if (dbHolds) {
        const holds = dbHolds.map(h => ({
          id: h.id,
          pharmacyId: h.pharmacy_entity_id,
          patientId: h.patient_id,
          medicineName: h.medicine_name,
          dosage: h.dosage || '',
          quantity: h.quantity,
          holdStatus: h.hold_status as InventoryHold['holdStatus'],
          expiryDate: h.expiry_date || '',
          batchNumber: h.batch_number || '',
          createdAt: h.created_at
        }));
        this.save('inventory_holds', holds);
      }

      const { data: dbInvoices } = await supabase.from('unified_invoices').select(`
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
      if (dbInvoices) {
        const invoices = (dbInvoices as unknown as DBInvoice[]).map((i: DBInvoice) => ({
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
          paymentStatus: i.payment_status === 'refunded' ? 'pending' : i.payment_status,
          createdAt: i.created_at
        }));
        this.save('unified_invoices', invoices);
      }

      const { data: dbForecasts } = await supabase.from('seasonal_demand_forecasts').select('*');
      if (dbForecasts) {
        const forecasts = dbForecasts.map(f => ({
          id: f.id,
          pharmacyId: f.pharmacy_entity_id,
          medicineName: f.medicine_name,
          suggestedIncreasePercentage: f.suggested_increase_percentage,
          reason: f.reason,
          forecastConfidence: Number(f.forecast_confidence),
          isActedUpon: f.is_acted_upon,
          createdAt: f.created_at
        }));
        this.save('seasonal_forecasts', forecasts);
      }

      const { data: dbStaff } = await supabase.from('clinic_staff').select('*');
      if (dbStaff) {
        const staff = dbStaff.map(s => ({
          id: s.id,
          entityId: s.entity_id,
          userId: s.user_id || undefined,
          staffName: s.staff_name,
          role: s.role as ClinicStaff['role'],
          isActive: s.is_active,
          createdAt: s.created_at
        }));
        this.save('clinic_staff', staff);
      }

      const { data: dbLedgers } = await supabase.from('financial_ledgers').select('*');
      if (dbLedgers) {
        const ledgers = dbLedgers.map(l => ({
          id: l.id,
          invoiceId: l.invoice_id,
          sourceEntityId: l.source_entity_id,
          destinationEntityId: l.destination_entity_id,
          transactionType: l.transaction_type as FinancialLedgerEntry['transactionType'],
          grossAmount: Number(l.gross_amount),
          commissionRate: Number(l.commission_rate),
          netPayout: Number(l.net_payout),
          paymentStatus: l.payment_status as FinancialLedgerEntry['paymentStatus'],
          settledAt: l.settled_at,
          createdAt: l.created_at
        }));
        this.save('financial_ledgers', ledgers);
      }

    } catch (e) {
      console.error('Error synchronizing with Supabase', e);
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  // Patient Registry & Queue tracking Delegators
  getPatients(): Patient[] {
    return PatientService.getPatients();
  }

  updatePatientVitalsAndToken(patientId: string, vitals: PatientVitals, token: string): void {
    PatientService.updatePatientVitalsAndToken(patientId, vitals, token);
    this.notify();
  }

  updatePatientQueueStatus(patientId: string, status: Patient['queueStatus']): void {
    PatientService.updatePatientQueueStatus(patientId, status);
    this.notify();
  }

  generateNextTokenNumber(): string {
    return PatientService.generateNextTokenNumber();
  }

  registerPatient(patientData: Omit<Patient, 'id' | 'createdAt'>): Patient {
    const res = PatientService.registerPatient(patientData);
    this.notify();
    return res;
  }

  getPatientHistoricalBiomarkers(patientId: string): HistoricalBiomarker[] {
    return PatientService.getPatientHistoricalBiomarkers(patientId);
  }

  isPatientConsentActive(patientId: string): boolean {
    return PatientService.isPatientConsentActive(patientId);
  }

  getActivePatient(): Patient | null {
    return PatientService.getActivePatient();
  }

  setActivePatient(patient: Patient | null): void {
    PatientService.setActivePatient(patient);
    this.notify();
  }

  getActivePatientCareStage(patientId: string): 'registered' | 'diagnosing' | 'lab' | 'pharmacy' | 'settled' {
    return PatientService.getActivePatientCareStage(patientId);
  }

  async grantInPersonConsent(patientId: string): Promise<void> {
    await PatientService.grantInPersonConsent(patientId);
    this.notify();
  }

  async updatePatientPastReportsSummary(patientId: string, summary: string): Promise<void> {
    await PatientService.updatePatientPastReportsSummary(patientId, summary);
    this.notify();
  }

  generateAIPatientSummary(patientId: string): string {
    return PatientService.generateAIPatientSummary(patientId);
  }

  // WhatsApp conversational state machine Delegators
  getWhatsAppSessions(): WhatsAppSession[] {
    return WhatsAppService.getWhatsAppSessions();
  }

  async sendWhatsAppMessagePayload(phone: string, template: string, payload: Record<string, any>): Promise<boolean> {
    return WhatsAppService.sendWhatsAppMessagePayload(phone, template, payload);
  }

  async processIncomingWhatsAppMessage(phone: string, text: string): Promise<void> {
    await WhatsAppService.processIncomingWhatsAppMessage(phone, text);
    this.notify();
  }

  initiateWhatsAppSession(phone: string): WhatsAppSession {
    const res = WhatsAppService.initiateWhatsAppSession(phone);
    this.notify();
    return res;
  }

  updateWhatsAppState(phone: string, state: WhatsAppSession['currentState'], data: Record<string, any> = {}): void {
    WhatsAppService.updateWhatsAppState(phone, state, data);
    this.notify();
  }

  dispatchWhatsAppLoyaltyOffer(patientId: string, offerType: string): string {
    return WhatsAppService.dispatchWhatsAppLoyaltyOffer(patientId, offerType);
  }

  pushWhatsAppMessageFromBot(phone: string, text: string): void {
    WhatsAppService.pushWhatsAppMessageFromBot(phone, text);
    this.notify();
  }

  triggerProactiveRefillNudge(phone: string): void {
    WhatsAppService.triggerProactiveRefillNudge(phone);
    this.notify();
  }

  triggerProactiveFollowUpNudge(phone: string): void {
    WhatsAppService.triggerProactiveFollowUpNudge(phone);
    this.notify();
  }

  triggerProactiveLabCollectionNudge(phone: string): void {
    WhatsAppService.triggerProactiveLabCollectionNudge(phone);
    this.notify();
  }

  async referPatientToSpecialist(phone: string, targetDoctorId: string): Promise<void> {
    await WhatsAppService.referPatientToSpecialist(phone, targetDoctorId);
    this.notify();
  }

  // Encounters/Clinical diagnostics scribe Delegators
  getEncounters(): Encounter[] {
    return EncounterService.getEncounters();
  }

  createEncounter(encounterData: Omit<Encounter, 'id' | 'createdAt' | 'status'>): Encounter {
    const res = EncounterService.createEncounter(encounterData);
    this.notify();
    return res;
  }

  // Lab diagnostics/requisitions and report approve/reject Delegators
  getLabRequisitions(): LabRequisition[] {
    return LabService.getLabRequisitions();
  }

  saveLabRequisitions(reqs: LabRequisition[]): void {
    LabService.saveLabRequisitions(reqs);
    this.notify();
  }

  collectLabSample(reqId: string): void {
    LabService.collectLabSample(reqId);
    this.notify();
  }

  getReagentStocks(): ReagentStock[] {
    return LabService.getReagentStocks();
  }

  submitLabResult(reqId: string, resultValue: string): void {
    LabService.submitLabResult(reqId, resultValue);
    this.notify();
  }

  replenishReagentStock(reagentName: string, volumeToAdd: number): void {
    LabService.replenishReagentStock(reagentName, volumeToAdd);
    this.notify();
  }

  registerWalkinLabTest(patientId: string, testCode: string, testName: string, prescriptionFileUrl?: string): LabRequisition {
    const res = LabService.registerWalkinLabTest(patientId, testCode, testName, prescriptionFileUrl);
    this.notify();
    return res;
  }

  getPathologyReports(): PathologyReport[] {
    return LabService.getPathologyReports();
  }

  savePathologyReports(reports: PathologyReport[]): void {
    LabService.savePathologyReports(reports);
    this.notify();
  }

  processPathologyReport(reportId: string, results: string): void {
    LabService.processPathologyReport(reportId, results);
    this.notify();
  }

  async uploadPrescriptionToStorage(file: File): Promise<string> {
    return LabService.uploadPrescriptionToStorage(file);
  }

  createLabRequisitionFromPrescription(patientId: string, testCode: string, testName: string, prescriptionFileUrl: string): LabRequisition {
    const res = LabService.createLabRequisitionFromPrescription(patientId, testCode, testName, prescriptionFileUrl);
    this.notify();
    return res;
  }

  async uploadLabReportToStorage(file: File, requisitionId: string): Promise<string> {
    return LabService.uploadLabReportToStorage(file, requisitionId);
  }

  getFullLabReports(): LabReport[] {
    return LabService.getFullLabReports();
  }

  saveFullLabReport(report: LabReport): void {
    LabService.saveFullLabReport(report);
    this.notify();
  }

  async approveLabReport(reportId: string, revisitDate: string, revisitTime: string, revisitNote: string): Promise<void> {
    await LabService.approveLabReport(reportId, revisitDate, revisitTime, revisitNote);
    this.notify();
  }

  async rejectLabReport(reportId: string, reason: string): Promise<void> {
    await LabService.rejectLabReport(reportId, reason);
    this.notify();
  }

  // Pharmacy Stock / FEFO holds Delegators
  getPharmacyInventory(): PharmacyInventoryItem[] {
    return PharmacyService.getPharmacyInventory();
  }

  savePharmacyInventory(items: PharmacyInventoryItem[]) {
    PharmacyService.savePharmacyInventory(items);
    this.notify();
  }

  addPharmacyInventoryItem(item: Omit<PharmacyInventoryItem, 'id' | 'addedAt'>): PharmacyInventoryItem {
    const res = PharmacyService.addPharmacyInventoryItem(item);
    this.notify();
    return res;
  }

  addPharmacyInventoryBulk(rows: MedicineImportRow[]): { added: number; errors: string[] } {
    const res = PharmacyService.addPharmacyInventoryBulk(rows);
    this.notify();
    return res;
  }

  deletePharmacyInventoryItem(id: string): void {
    PharmacyService.deletePharmacyInventoryItem(id);
    this.notify();
  }

  restockPharmacyInventoryItem(itemId: string, quantity: number) {
    PharmacyService.restockPharmacyInventoryItem(itemId, quantity);
    this.notify();
  }

  getLowStockItems(): PharmacyInventoryItem[] {
    return PharmacyService.getLowStockItems();
  }

  getExpiringItems(withinDays: number): PharmacyInventoryItem[] {
    return PharmacyService.getExpiringItems(withinDays);
  }

  getExpiredItems(): PharmacyInventoryItem[] {
    return PharmacyService.getExpiredItems();
  }

  getInventoryHolds(): InventoryHold[] {
    return PharmacyService.getInventoryHolds();
  }

  dispenseInventoryHold(holdId: string): void {
    PharmacyService.dispenseInventoryHold(holdId);
    this.notify();
  }

  cancelInventoryHold(holdId: string): void {
    PharmacyService.cancelInventoryHold(holdId);
    this.notify();
  }

  getMedicineBills(): MedicineBill[] {
    return PharmacyService.getMedicineBills();
  }

  saveMedicineBill(bill: MedicineBill): MedicineBill {
    const res = PharmacyService.saveMedicineBill(bill);
    this.notify();
    return res;
  }

  getMedicineBillById(id: string): MedicineBill | null {
    return PharmacyService.getMedicineBillById(id);
  }

  updateMedicineBillStatus(id: string, status: MedicineBill['status']): void {
    PharmacyService.updateMedicineBillStatus(id, status);
    this.notify();
  }

  dispenseMedicineBill(id: string): void {
    PharmacyService.dispenseMedicineBill(id);
    this.notify();
  }

  getCounterTransactions(): CounterTransaction[] {
    return PharmacyService.getCounterTransactions();
  }

  saveCounterTransaction(tx: CounterTransaction): void {
    PharmacyService.saveCounterTransaction(tx);
    this.notify();
  }

  checkLoyaltyDiscount(patientId: string): boolean {
    return PharmacyService.checkLoyaltyDiscount(patientId);
  }

  generateMedicineInvoiceMessage(bill: MedicineBill): string {
    return PharmacyService.generateMedicineInvoiceMessage(bill);
  }

  async parseSupplierBillOCR(base64: string): Promise<MedicineImportRow[]> {
    return PharmacyService.parseSupplierBillOCR(base64);
  }

  matchPrescriptionMedicines(names: string[]): PharmacyInventoryItem[] {
    return PharmacyService.matchPrescriptionMedicines(names);
  }

  getWhatsAppDrugOrders(): WhatsAppDrugOrder[] {
    return PharmacyService.getWhatsAppDrugOrders();
  }

  saveWhatsAppDrugOrders(orders: WhatsAppDrugOrder[]) {
    PharmacyService.saveWhatsAppDrugOrders(orders);
    this.notify();
  }

  simulateIncomingWhatsAppOrder() {
    PharmacyService.simulateIncomingWhatsAppOrder();
    this.notify();
  }

  // Unified Invoices & UPI splits ledger Delegators
  getUnifiedInvoices(): UnifiedInvoice[] {
    return BillingService.getUnifiedInvoices();
  }

  clearInvoice(invoiceId: string): void {
    BillingService.clearInvoice(invoiceId);
    this.notify();
  }

  getFinancialLedgers(invoiceId?: string): FinancialLedgerEntry[] {
    return BillingService.getFinancialLedgers(invoiceId);
  }

  getAppointments(): Appointment[] {
    return BillingService.getAppointments();
  }

  saveAppointment(appt: Appointment): void {
    BillingService.saveAppointment(appt);
    this.notify();
  }

  getInvoices(): Invoice[] {
    return BillingService.getInvoices();
  }

  saveInvoice(invoice: Invoice): void {
    BillingService.saveInvoice(invoice);
    this.notify();
  }

  getPrescriptions(): Prescription[] {
    return BillingService.getPrescriptions();
  }

  savePrescription(rx: Prescription): void {
    BillingService.savePrescription(rx);
    this.notify();
  }

  createGate1Consult(patientId: string): void {
    BillingService.createGate1Consult(patientId);
    this.notify();
  }

  settleSaaSInvoice(invoiceId: string): void {
    BillingService.settleSaaSInvoice(invoiceId);
    this.notify();
  }

  async runSaaSPrescriptionOCR(appointmentId: string, file: File | string): Promise<Prescription> {
    const res = await BillingService.runSaaSPrescriptionOCR(appointmentId, file);
    this.notify();
    return res;
  }

  async createAppointment(appointment: {
    patient_id: string;
    doctor_id: string;
    status?: string;
  }): Promise<string> {
    return BillingService.createAppointment(appointment);
  }

  async generateInvoice(appointmentId: string, type: 'consult' | 'lab' | 'pharmacy', amount: number): Promise<string> {
    return BillingService.generateInvoice(appointmentId, type, amount);
  }

  async markInvoicePaid(invoiceId: string, sendWhatsApp = true): Promise<void> {
    await BillingService.markInvoicePaid(invoiceId, sendWhatsApp);
    this.notify();
  }

  getClinicSops(): ClinicSop[] {
    return BillingService.getClinicSops();
  }

  saveClinicSops(sops: ClinicSop[]): void {
    BillingService.saveClinicSops(sops);
    this.notify();
  }

  getActiveSop(): ClinicSop | null {
    return BillingService.getActiveSop();
  }

  // Forecast AI Scribe & RAG Delegators
  getSeasonalForecasts(): SeasonalForecast[] {
    return ForecastService.getSeasonalForecasts();
  }

  actOnSeasonalForecast(forecastId: string): void {
    ForecastService.actOnSeasonalForecast(forecastId);
    this.notify();
  }

  async generateSeasonalForecast(req: {
    pharmacy_entity_id: string;
    pod_id: string;
    current_month: string;
    regional_weather: string;
  }): Promise<SeasonalForecast[]> {
    const res = await ForecastService.generateSeasonalForecast(req);
    this.notify();
    return res;
  }

  async generateConsultRoom(appointmentId: string, patientPhone: string, doctorName = 'Dr. Sharma'): Promise<{ roomUrl: string }> {
    return ForecastService.generateConsultRoom(appointmentId, patientPhone, doctorName);
  }

  async voiceScribe(audioBlob: Blob, filename = 'recording.webm'): Promise<{ summary: string; language: string }> {
    this.isVoiceScribing = true;
    this.notify();
    try {
      return await ForecastService.voiceScribe(audioBlob, filename);
    } finally {
      this.isVoiceScribing = false;
      this.notify();
    }
  }

  async ocrScan(file: File): Promise<{ extracted_text: string; structured_data: Record<string, string> }> {
    this.isOcrScanning = true;
    this.notify();
    try {
      return await ForecastService.ocrScan(file);
    } finally {
      this.isOcrScanning = false;
      this.notify();
    }
  }

  async labTrend(labData: Record<string, string>): Promise<{ analysis: string; recommendations: string[] }> {
    this.isLabTrending = true;
    this.notify();
    try {
      return await ForecastService.labTrend(labData);
    } finally {
      this.isLabTrending = false;
      this.notify();
    }
  }

  async generateConsultHinglishSummary(patientId: string, suggestionsText: string): Promise<string> {
    return ForecastService.generateConsultHinglishSummary(patientId, suggestionsText);
  }

  async generateComparativeLabTrend(patientId: string, newReportTest: string, newReportVal: number): Promise<string> {
    return ForecastService.generateComparativeLabTrend(patientId, newReportTest, newReportVal);
  }

  async saveAgentTaskPipeline(pipeline: {
    patient_id: string;
    original_prompt: string;
    parsed_intent: string;
    steps_json: any[];
    status: string;
  }): Promise<{ error: any }> {
    return ForecastService.saveAgentTaskPipeline(pipeline);
  }

  async parsePrescriptionOCR(imageUri: string): Promise<{
    patientName: string;
    patientPhone?: string;
    patientAge: number;
    patientGender: 'Male' | 'Female' | 'Other';
    medications: Array<{ medicineName: string; dosage: string; frequency: string; duration: string }>;
    diagnosticTests: DiagnosticTest[];
  }> {
    return ForecastService.parsePrescriptionOCR(imageUri);
  }

  async processOCR(imageBase64: string): Promise<{ extractedMedicines?: any[]; extractedTests?: any[] }> {
    return ForecastService.processOCR(imageBase64);
  }

  // Clinic Staff Operations Delegators
  getClinicStaff(): ClinicStaff[] {
    return StaffService.getClinicStaff();
  }

  registerClinicStaff(name: string, role: 'compounder' | 'receptionist' | 'admin'): void {
    StaffService.registerClinicStaff(name, role);
    this.notify();
  }

  toggleStaffActive(staffId: string, isActive: boolean): void {
    StaffService.toggleStaffActive(staffId, isActive);
    this.notify();
  }

  getActiveStaffId(): string | null {
    return StaffService.getActiveStaffId();
  }

  setActiveStaffId(staffId: string | null): void {
    StaffService.setActiveStaffId(staffId);
    this.notify();
  }
}

export const api = new MediflowApiService();
export type { MediflowApiService };
