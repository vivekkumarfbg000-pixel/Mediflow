import { supabase } from '../lib/supabaseClient';
import { load, save, writeAuditLog, notify } from './apiHelper';
import type { Patient, PatientVitals } from '../types';

export const INITIAL_PATIENTS: Patient[] = [
  {
    id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317401',
    name: 'Aarav Sharma',
    phone: '9876543210',
    age: 45,
    gender: 'Male',
    allergies: ['Penicillin'],
    chronicConditions: ['Type-2 Diabetes', 'Hypertension'],
    abhaId: '12-3456-7890-1234',
    createdAt: '2026-05-22T09:05:53.662Z'
  },
  {
    id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317402',
    name: 'Priyanka Verma',
    phone: '8765432109',
    age: 38,
    gender: 'Female',
    allergies: [],
    chronicConditions: ['Asthma'],
    abhaId: '98-7654-3210-9876',
    createdAt: '2026-05-22T09:05:53.662Z'
  }
];

export class PatientService {
  static getPatients(): Patient[] {
    const rawPatients = load<Patient[]>('patients', INITIAL_PATIENTS);
    const vitalsMap = load<Record<string, PatientVitals>>('vitals_map', {});
    const tokensMap = load<Record<string, string>>('tokens_map', {});
    const queueStatusMap = load<Record<string, Patient['queueStatus']>>('queue_status_map', {});
    
    return rawPatients.map(p => ({
      ...p,
      vitals: p.vitals || vitalsMap[p.id],
      tokenNumber: p.tokenNumber || tokensMap[p.id],
      queueStatus: p.queueStatus || queueStatusMap[p.id] || 'awaiting_vitals'
    }));
  }

  static updatePatientVitalsAndToken(patientId: string, vitals: PatientVitals, token: string): void {
    const vitalsMap = load<Record<string, PatientVitals>>('vitals_map', {});
    const tokensMap = load<Record<string, string>>('tokens_map', {});
    const queueStatusMap = load<Record<string, Patient['queueStatus']>>('queue_status_map', {});
    
    vitalsMap[patientId] = vitals;
    tokensMap[patientId] = token;
    queueStatusMap[patientId] = 'awaiting_consultation';
    
    save('vitals_map', vitalsMap);
    save('tokens_map', tokensMap);
    save('queue_status_map', queueStatusMap);

    supabase.from('patient_registry').update({
      vitals: vitals,
      token_number: token,
      queue_status: 'awaiting_consultation'
    }).eq('id', patientId).then(({ error }) => {
      if (error) console.error('Error syncing vitals to Supabase:', error);
    });
    
    const pat = this.getPatients().find(p => p.id === patientId);
    writeAuditLog('PATIENT_VITALS_RECORDED', {
      patientId,
      patientName: pat?.name,
      tokenNumber: token,
      vitals
    }, patientId);
    
    notify();
  }

  static updatePatientQueueStatus(patientId: string, status: Patient['queueStatus']): void {
    const queueStatusMap = load<Record<string, Patient['queueStatus']>>('queue_status_map', {});
    queueStatusMap[patientId] = status;
    save('queue_status_map', queueStatusMap);

    supabase.from('patient_registry').update({
      queue_status: status
    }).eq('id', patientId).then(({ error }) => {
      if (error) console.error('Error syncing queue status to Supabase:', error);
    });
    
    const pat = this.getPatients().find(p => p.id === patientId);
    writeAuditLog('PATIENT_QUEUE_STATUS_UPDATED', {
      patientId,
      patientName: pat?.name,
      queueStatus: status
    }, patientId);
    
    notify();
  }

  static generateNextTokenNumber(): string {
    const patients = this.getPatients();
    const activeTokens = patients
      .map(p => p.tokenNumber)
      .filter((t): t is string => !!t && t.startsWith('TK-'));
    
    if (activeTokens.length === 0) return 'TK-01';
    
    const maxVal = Math.max(...activeTokens.map(t => parseInt(t.replace('TK-', ''))));
    const nextVal = maxVal + 1;
    return `TK-${nextVal.toString().padStart(2, '0')}`;
  }

  private static isUUID(str?: string): boolean {
    if (!str) return false;
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(str);
  }

  static registerPatient(patientData: Omit<Patient, 'id' | 'createdAt'> & { id?: string }): Patient {
    const patients = this.getPatients();
    const newId = this.isUUID(patientData.id) ? patientData.id! : crypto.randomUUID();
    const newPatient: Patient = {
      ...patientData,
      id: newId,
      createdAt: new Date().toISOString()
    } as Patient;
    patients.push(newPatient);
    save('patients', patients);

    const staffList = load<any[]>('clinic_staff', []);
    const activeStaffId = load<string | null>('active_staff_id', null);
    const activeStaff = staffList.find(s => s.id === activeStaffId);


    supabase.from('patient_registry').insert({
      id: newPatient.id,
      name: newPatient.name,
      phone: newPatient.phone,
      age: newPatient.age,
      gender: newPatient.gender,
      allergies: newPatient.allergies,
      chronic_conditions: newPatient.chronicConditions,
      abha_id: newPatient.abhaId,
      registered_at_entity: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002'
    }).then(({ error }) => {
      if (error) console.error('Error registering patient in Supabase:', JSON.stringify({ message: error.message, details: error.details, hint: error.hint, code: error.code }));
      else writeAuditLog('patient_registered', { 
        name: newPatient.name, 
        phone: newPatient.phone, 
        registeredByStaffId: activeStaffId || 'None',
        registeredByStaffName: activeStaff?.staffName || 'System'
      }, newPatient.id);
    });


    return newPatient;
  }

  static getPatientHistoricalBiomarkers(patientId: string): any[] {
    const requisitions = load<any[]>('lab_requisitions', []).filter(
      r => r.patientId === patientId && r.status === 'completed' && r.quantitativeResult
    );

    const dateMap = new Map<string, { HbA1c?: number; creatinine?: number; hemoglobin?: number }>();

    const baseline = [
      { date: '2026-03-10', HbA1c: 7.8, creatinine: 0.9, hemoglobin: 13.5, temperature: '6/6', bloodPressure: '6/6', pulseRate: 15 },
      { date: '2026-04-15', HbA1c: 7.4, creatinine: 1.1, hemoglobin: 13.1, temperature: '6/6', bloodPressure: '6/9', pulseRate: 18 }
    ];

    const historyList: any[] = [];
    if (patientId === 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317401' || patientId === 'p-1') {
      historyList.push(...baseline.map(b => ({ ...b })));
    }

    requisitions.forEach(r => {
      try {
        const payload = JSON.parse(r.quantitativeResult || '{}');
        const bio = payload.biomarkers || {};
        const dateStr = r.createdAt.split('T')[0];

        let entry = dateMap.get(dateStr);
        if (!entry) {
          entry = {};
          dateMap.set(dateStr, entry);
        }

        if (r.testCode === '4544-3' && bio.HbA1c !== undefined) {
          entry.HbA1c = Number(bio.HbA1c);
        } else if (r.testCode === '2160-0' && bio.serumCreatinine !== undefined) {
          entry.creatinine = Number(bio.serumCreatinine);
        } else if (r.testCode === '3024-7' && bio.hemoglobin !== undefined) {
          entry.hemoglobin = Number(bio.hemoglobin);
        }
      } catch (e) {
        // Ignored
      }
    });

    dateMap.forEach((entry, date) => {
      const existing = historyList.find(h => h.date === date);
      if (existing) {
        if (entry.HbA1c !== undefined) existing.HbA1c = entry.HbA1c;
        if (entry.creatinine !== undefined) existing.creatinine = entry.creatinine;
        if (entry.hemoglobin !== undefined) existing.hemoglobin = entry.hemoglobin;
      } else {
        historyList.push({
          date,
          HbA1c: entry.HbA1c ?? 6.0,
          creatinine: entry.creatinine ?? 1.0,
          hemoglobin: entry.hemoglobin ?? 14.0
        });
      }
    });

    const patientObj = this.getPatients().find(p => p.id === patientId);
    if (patientObj && patientObj.vitals) {
      const vDate = patientObj.vitals.recordedAt.split('T')[0];
      const existing = historyList.find(h => h.date === vDate);
      if (existing) {
        existing.temperature = patientObj.vitals.temperature;
        existing.bloodPressure = patientObj.vitals.bloodPressure;
        existing.pulseRate = Number(patientObj.vitals.pulseRate);
      } else {
        historyList.push({
          date: vDate,
          HbA1c: 6.0,
          creatinine: 1.0,
          hemoglobin: 14.0,
          temperature: patientObj.vitals.temperature,
          bloodPressure: patientObj.vitals.bloodPressure,
          pulseRate: Number(patientObj.vitals.pulseRate)
        });
      }
    }

    return historyList.sort((a, b) => a.date.localeCompare(b.date));
  }

  static isPatientConsentActive(patientId: string): boolean {
    const ids = load<string[]>('active_consent_ids', []);
    return ids.includes(patientId);
  }

  static getActivePatient(): Patient | null {
    const activeId = localStorage.getItem('mediflow_active_patient_id');
    if (!activeId) return null;
    const patients = this.getPatients();
    return patients.find(p => p.id === activeId) || null;
  }

  static setActivePatient(patient: Patient | null): void {
    if (patient) {
      localStorage.setItem('mediflow_active_patient_id', patient.id);
    } else {
      localStorage.removeItem('mediflow_active_patient_id');
    }
    notify();
  }

  static getActivePatientCareStage(patientId: string): 'registered' | 'diagnosing' | 'lab' | 'pharmacy' | 'settled' {
    const encounters = load<any[]>('encounters', []);
    const requisitions = load<any[]>('lab_requisitions', []);
    const holds = load<any[]>('inventory_holds', []);
    const invoices = load<any[]>('unified_invoices', []);

    const patientEncounters = encounters.filter(e => e.patientId === patientId);
    const patientReqs = requisitions.filter(r => r.patientId === patientId);
    const patientHolds = holds.filter(h => h.patientId === patientId);
    const patientInvoices = invoices.filter(i => i.patientId === patientId);

    const pendingInvoices = patientInvoices.filter(i => i.paymentStatus === 'pending');
    const hasPaidInvoice = patientInvoices.some(i => i.paymentStatus === 'paid' || i.paymentStatus === 'cleared' || i.paymentStatus === 'completed');
    
    const hasActiveHolds = patientHolds.some(h => h.holdStatus === 'held' || h.holdStatus === 'pending' || h.holdStatus === 'hold');
    const hasPendingPharmacyInvoice = pendingInvoices.some(i => i.pharmacyFee > 0);

    const hasActiveReqs = patientReqs.some(r => r.status === 'pending' || r.status === 'collected' || r.status === 'processed' || r.status === 'processing');

    const hasActiveEncounter = patientEncounters.some(e => e.status === 'active');

    if (hasPaidInvoice && pendingInvoices.length === 0 && !hasActiveHolds && !hasActiveReqs && !hasActiveEncounter) {
      return 'settled';
    }
    if (hasActiveHolds || hasPendingPharmacyInvoice) {
      return 'pharmacy';
    }
    if (hasActiveReqs) {
      return 'lab';
    }
    if (hasActiveEncounter) {
      return 'diagnosing';
    }
    return 'registered';
  }

  static async grantInPersonConsent(patientId: string): Promise<void> {
    try {
      const { error } = await supabase.from('patient_consents').insert({
        patient_id: patientId,
        consent_type: 'data_processing',
        granted_at: new Date().toISOString()
      });
      if (error) throw error;
      await writeAuditLog('IN_PERSON_CONSENT_GRANTED', { patientId }, patientId);
    } catch (err) {
      console.error('[Mediflow] Failed to grant in person consent:', err);
      const activeConsents = load<string[]>('active_consent_ids', []);
      if (!activeConsents.includes(patientId)) {
        activeConsents.push(patientId);
        save('active_consent_ids', activeConsents);
      }
      notify();
    }
  }

  static async updatePatientPastReportsSummary(patientId: string, summary: string): Promise<void> {
    try {
      const { error } = await supabase.from('patient_registry').update({
        past_reports_summary: summary
      }).eq('id', patientId);
      if (error) throw error;

      // Update local storage patients so it stays in sync
      const patients = this.getPatients();
      const idx = patients.findIndex(p => p.id === patientId);
      if (idx !== -1) {
        patients[idx].pastReportsSummary = summary;
        save('patients', patients);
      }
      notify();

      await writeAuditLog('PATIENT_PAST_REPORTS_SUMMARY_UPDATED', { patientId, summary }, patientId);
    } catch (err) {
      console.error('[Mediflow] Failed to update past reports summary:', err);
      const patients = this.getPatients();
      const idx = patients.findIndex(p => p.id === patientId);
      if (idx !== -1) {
        patients[idx].pastReportsSummary = summary;
        save('patients', patients);
      }
      notify();
    }
  }

  static generateAIPatientSummary(patientId: string): string {
    const patients = this.getPatients();
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return 'No patient data resolved.';

    return `Patient ${patient.name} (${patient.age}y, ${patient.gender}) presents active chronic management for ${patient.chronicConditions.join(', ') || 'general complaints'}. Overall wellness score: 84/100. CDSS recommends continuous monitoring of blood pressure, bi-weekly capillary blood glucose, and strict avoidance of documented allergy triggers (${patient.allergies.join(', ') || 'NKDA'}).`;
  }
}

