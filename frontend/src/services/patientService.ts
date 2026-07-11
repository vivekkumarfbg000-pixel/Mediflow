import { supabase } from '../lib/supabaseClient';
import { load, save, writeAuditLog, notify } from './apiHelper';
import type { Patient, PatientVitals } from '../types';

export interface PhysicalConsent {
  id: string;
  patient_id: string;
  recorded_by_user_id: string;
  consent_purpose: string;
  recorded_at: string;
  expires_at: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  revoked_by_user_id?: string | null;
  revoked_at?: string | null;
  details?: string;
}

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
    
    // In production, use the clinic's specialization from user profile
    const nextStatus = 'awaiting_consultation';
    
    vitalsMap[patientId] = vitals;
    tokensMap[patientId] = token;
    queueStatusMap[patientId] = nextStatus;
    
    save('vitals_map', vitalsMap);
    save('tokens_map', tokensMap);
    save('queue_status_map', queueStatusMap);

    supabase.from('patient_registry').update({
      vitals: vitals,
      token_number: token,
      queue_status: nextStatus
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

  static saveRefractionDiagnostics(patientId: string, diagnostics: Partial<PatientVitals>): void {
    const vitalsMap = load<Record<string, PatientVitals>>('vitals_map', {});
    const queueStatusMap = load<Record<string, Patient['queueStatus']>>('queue_status_map', {});
    
    const existingVitals = vitalsMap[patientId] || { recordedAt: new Date().toISOString() };
    const updatedVitals = {
      ...existingVitals,
      ...diagnostics,
      recordedAt: new Date().toISOString()
    };
    
    vitalsMap[patientId] = updatedVitals as PatientVitals;
    queueStatusMap[patientId] = 'awaiting_consultation';
    
    save('vitals_map', vitalsMap);
    save('queue_status_map', queueStatusMap);
    
    supabase.from('patient_registry').update({
      vitals: updatedVitals,
      queue_status: 'awaiting_consultation'
    }).eq('id', patientId).then(({ error }) => {
      if (error) console.error('Error syncing refraction to Supabase:', error);
    });
    
    const pat = this.getPatients().find(p => p.id === patientId);
    writeAuditLog('PATIENT_REFRACTION_RECORDED', {
      patientId,
      patientName: pat?.name,
      diagnostics
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
    
    // Generate custom patient ID: first letter of name + count of same-letter patients
    const firstLetter = (patientData.name && patientData.name.trim().length > 0)
      ? patientData.name.trim().substring(0, 1).toUpperCase()
      : 'P';
    
    const countSameLetter = patients.filter(p => 
      p.name && p.name.trim().length > 0 && p.name.trim().substring(0, 1).toUpperCase() === firstLetter
    ).length;

    const customPatientId = `${firstLetter}${countSameLetter + 1}`;

    const newPatient: Patient = {
      ...patientData,
      id: newId,
      tokenNumber: patientData.tokenNumber || customPatientId,
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
      token_number: newPatient.tokenNumber,
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

    const dateMap = new Map<string, Record<string, number>>();

    const baseline = [
      { date: '2026-03-10', HbA1c: 7.8, creatinine: 0.9, hemoglobin: 13.5, alt: 35, ast: 30, ldl: 95, tsh: 2.1, temperature: '6/6', bloodPressure: '6/6', pulseRate: 15 },
      { date: '2026-04-15', HbA1c: 7.4, creatinine: 1.1, hemoglobin: 13.1, alt: 42, ast: 38, ldl: 110, tsh: 5.2, temperature: '6/6', bloodPressure: '6/9', pulseRate: 18 }
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

        if (bio.alt !== undefined) entry.alt = Number(bio.alt);
        if (bio.sgpt !== undefined) entry.alt = Number(bio.sgpt);
        if (bio.ast !== undefined) entry.ast = Number(bio.ast);
        if (bio.sgot !== undefined) entry.ast = Number(bio.sgot);
        if (bio.ldl !== undefined) entry.ldl = Number(bio.ldl);
        if (bio.tsh !== undefined) entry.tsh = Number(bio.tsh);
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
        if (entry.alt !== undefined) existing.alt = entry.alt;
        if (entry.ast !== undefined) existing.ast = entry.ast;
        if (entry.ldl !== undefined) existing.ldl = entry.ldl;
        if (entry.tsh !== undefined) existing.tsh = entry.tsh;
      } else {
        historyList.push({
          date,
          HbA1c: entry.HbA1c ?? 6.0,
          creatinine: entry.creatinine ?? 1.0,
          hemoglobin: entry.hemoglobin ?? 14.0,
          alt: entry.alt,
          ast: entry.ast,
          ldl: entry.ldl,
          tsh: entry.tsh
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
    // 1. Run automatic expiration sweep first
    this.checkAndExpirePhysicalConsents();

    // 2. Check digital consents
    const ids = load<string[]>('active_consent_ids', []);
    if (ids.includes(patientId)) return true;

    // 3. Check active physical consents
    const physicalConsents = load<PhysicalConsent[]>('physical_consents', []);
    const now = Date.now();
    return physicalConsents.some(c => 
      c.patient_id === patientId && 
      c.status === 'ACTIVE' && 
      new Date(c.expires_at).getTime() > now
    );
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
    const patientObj = this.getPatients().find(p => p.id === patientId);
    if (hasActiveEncounter || (patientObj && patientObj.queueStatus === 'awaiting_consultation')) {
      return 'diagnosing';
    }
    return 'registered';
  }

  static async grantInPersonConsent(patientId: string): Promise<void> {
    const consentTimestamp = new Date().toISOString();

    // ── Cryptographic Consent Signature ──────────────────────────────────────
    let consentSignature: string | null = null;
    try {
      const hmacSecret = import.meta.env.VITE_CONSENT_HMAC_KEY ?? 'mediflow-dev-only-key-change-in-production';
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(hmacSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const payload = encoder.encode(`${patientId}::${consentTimestamp}`);
      const signatureBuffer = await crypto.subtle.sign('HMAC', keyMaterial, payload);
      consentSignature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (sigErr) {
      console.error('[Mediflow] Consent HMAC signature generation failed:', sigErr);
    }

    // Instantly update local cache and notify subscribers for immediate UI state transition
    const activeConsents = load<string[]>('active_consent_ids', []);
    if (!activeConsents.includes(patientId)) {
      activeConsents.push(patientId);
      save('active_consent_ids', activeConsents);
    }
    
    // Save to local consent timestamps cache to prevent immediate sync revokes
    const localConsentTimestamps = load<Record<string, string>>('local_consent_timestamps', {});
    localConsentTimestamps[patientId] = consentTimestamp;
    save('local_consent_timestamps', localConsentTimestamps);
    
    notify();

    try {
      const { error } = await supabase.from('patient_consents').insert({
        patient_id: patientId,
        data_sharing_consent: true,
        consented_at: consentTimestamp,
        consent_signature: consentSignature,
        signature_algorithm: 'HMAC-SHA256'
      });
      if (error) throw error;
      await writeAuditLog('IN_PERSON_CONSENT_GRANTED', { patientId, signaturePresent: !!consentSignature }, patientId);
    } catch (err) {
      console.error('[Mediflow] Failed to grant in person consent database record:', err);
    }
  }

  static getPhysicalConsents(patientId: string): PhysicalConsent[] {
    const consents = load<PhysicalConsent[]>('physical_consents', []);
    return consents.filter(c => c.patient_id === patientId);
  }

  static async recordPhysicalConsent(params: {
    patientId: string;
    purpose: string;
    details?: string;
  }): Promise<void> {
    const { patientId, purpose, details } = params;
    const nowStr = new Date().toISOString();
    const expiresAtStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    let currentUserId = 'demo-doctor-uuid';
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) currentUserId = user.id;
    } catch (e) {
      console.warn('[PatientService] Could not resolve current user:', e);
    }

    const newConsent: PhysicalConsent = {
      id: crypto.randomUUID(),
      patient_id: patientId,
      recorded_by_user_id: currentUserId,
      consent_purpose: purpose,
      recorded_at: nowStr,
      expires_at: expiresAtStr,
      status: 'ACTIVE',
      details: details || ''
    };

    const physicalConsents = load<PhysicalConsent[]>('physical_consents', []);
    physicalConsents.push(newConsent);
    save('physical_consents', physicalConsents);

    const localConsentTimestamps = load<Record<string, string>>('local_consent_timestamps', {});
    localConsentTimestamps[patientId] = nowStr;
    save('local_consent_timestamps', localConsentTimestamps);

    notify();

    try {
      const { error } = await supabase.from('patient_consents').insert({
        patient_id: patientId,
        data_sharing_consent: true,
        consented_at: nowStr,
        consent_signature: `PHYSICAL_BYPASS_${newConsent.id}`,
        signature_algorithm: 'HMAC-SHA256'
      });
      if (error) throw error;
      await writeAuditLog('PHYSICAL_CONSENT_GRANTED', { 
        patientId, 
        purpose, 
        expiresAt: expiresAtStr,
        consentId: newConsent.id 
      }, patientId);
    } catch (dbErr) {
      console.error('[Mediflow] Failed to write physical consent database record:', dbErr);
    }
  }

  static async revokePhysicalConsent(consentId: string): Promise<void> {
    const physicalConsents = load<PhysicalConsent[]>('physical_consents', []);
    const idx = physicalConsents.findIndex(c => c.id === consentId);
    if (idx === -1) return;

    let currentUserId = 'demo-doctor-uuid';
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) currentUserId = user.id;
    } catch (e) {
      console.warn('[PatientService] Could not resolve current user for revocation:', e);
    }

    const consent = physicalConsents[idx];
    consent.status = 'REVOKED';
    consent.revoked_by_user_id = currentUserId;
    consent.revoked_at = new Date().toISOString();

    save('physical_consents', physicalConsents);

    const activeConsents = load<string[]>('active_consent_ids', []);
    save('active_consent_ids', activeConsents.filter(id => id !== consent.patient_id));

    const localConsentTimestamps = load<Record<string, string>>('local_consent_timestamps', {});
    delete localConsentTimestamps[consent.patient_id];
    save('local_consent_timestamps', localConsentTimestamps);

    notify();

    try {
      const { error } = await supabase
        .from('patient_consents')
        .update({ data_sharing_consent: false })
        .eq('patient_id', consent.patient_id);
      if (error) throw error;
      await writeAuditLog('PHYSICAL_CONSENT_REVOKED', { consentId, patientId: consent.patient_id }, consent.patient_id);
    } catch (dbErr) {
      console.error('[Mediflow] Failed to revoke physical consent database record:', dbErr);
    }
  }

  static checkAndExpirePhysicalConsents(): void {
    const physicalConsents = load<PhysicalConsent[]>('physical_consents', []);
    const now = Date.now();
    let changed = false;

    const updated = physicalConsents.map(c => {
      if (c.status === 'ACTIVE' && new Date(c.expires_at).getTime() <= now) {
        c.status = 'EXPIRED';
        changed = true;
        writeAuditLog('PHYSICAL_CONSENT_EXPIRED', { consentId: c.id, patientId: c.patient_id }, c.patient_id);
      }
      return c;
    });

    if (changed) {
      save('physical_consents', updated);
      
      const activeConsents = load<string[]>('active_consent_ids', []);
      const activePhysicals = updated.filter(c => c.status === 'ACTIVE').map(c => c.patient_id);
      const filteredConsents = activeConsents.filter(id => {
        const hasPhysical = updated.some(pc => pc.patient_id === id);
        if (hasPhysical) {
          return activePhysicals.includes(id);
        }
        return true;
      });
      save('active_consent_ids', filteredConsents);
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

  static getSyntheticProfiles(): any[] {
    return load<any[]>('synthetic_profiles', []);
  }

  static generateSyntheticProfiles(count: number): any[] {
    const isMockMode = import.meta.env.VITE_USE_MOCK === 'true';
    if (!isMockMode) {
      throw new Error('Access Denied: Synthetic profile generation is disabled in production environments.');
    }

    const firstNames = ['Aarav', 'Priyanka', 'Rohan', 'Sneha', 'Kabir', 'Aditi', 'Amit', 'Neha', 'Vikram', 'Anjali', 'Deepak', 'Meera', 'Rahul', 'Kiran', 'Sanjay', 'Pooja'];
    const lastNames = ['Sharma', 'Verma', 'Kumar', 'Singh', 'Gupta', 'Patel', 'Yadav', 'Joshi', 'Mehta', 'Roy', 'Sen', 'Das', 'Nair', 'Pillai', 'Rao', 'Reddy'];
    const roles = ['doctor', 'compounder', 'patient', 'admin'] as const;

    const currentProfiles = this.getSyntheticProfiles();
    const newProfiles: any[] = [];

    for (let i = 0; i < count; i++) {
      const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const role = roles[Math.floor(Math.random() * roles.length)];
      
      newProfiles.push({
        id: crypto.randomUUID(),
        name: `${fName} ${lName}`,
        role: role,
        isSynthetic: true,
        associatedActivityMetric: {
          lastActive: new Date().toISOString(),
          interactionsCount: Math.floor(Math.random() * 50) + 1
        }
      });
    }

    const updated = [...currentProfiles, ...newProfiles];
    save('synthetic_profiles', updated);
    notify();
    return newProfiles;
  }

  static deleteSyntheticProfile(id: string): void {
    const current = this.getSyntheticProfiles();
    const filtered = current.filter((p: any) => p.id !== id);
    save('synthetic_profiles', filtered);
    notify();
  }

  static clearAllSyntheticProfiles(): void {
    save('synthetic_profiles', []);
    notify();
  }

  static checkTriageAlert(patient: Patient): { isAlert: boolean; reason: string } {
    if (!patient.vitals) return { isAlert: false, reason: '' };
    const bp = patient.vitals.bloodPressure || '';
    if (bp.includes('/')) {
      const [sysStr, diaStr] = bp.split('/');
      const sys = parseInt(sysStr);
      const dia = parseInt(diaStr);
      if (sys > 140 || dia > 90) {
        return { isAlert: true, reason: `High BP: ${bp} mmHg` };
      }
    }
    const sugar = parseInt(patient.vitals.bloodSugar || '');
    if (!isNaN(sugar) && sugar > 200) {
      return { isAlert: true, reason: `High Sugar: ${sugar} mg/dL` };
    }
    return { isAlert: false, reason: '' };
  }

  static calculateDynamicOPDFee(patientId: string): { amount: number; type: 'First Visit' | 'Follow-up' | 'Free Review'; baseAmount: number } {
    const encounters = load<any[]>('encounters', []);
    const patientEncounters = encounters.filter(e => e.patient_id === patientId || e.patientId === patientId);
    
    // Load active SOP configuration to determine dynamic base fee
    const sops = load<any[]>('clinic_sops', []);
    const activeSop = sops.find(s => s.isActive || s.is_active);
    const baseFee = activeSop?.extractedConfig?.doctor_fee ?? activeSop?.extracted_config?.doctor_fee ?? 500;

    if (patientEncounters.length === 0) {
      return { amount: baseFee, type: 'First Visit', baseAmount: baseFee };
    }
    const sorted = [...patientEncounters].sort((a, b) => new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime());
    const lastVisitDate = new Date(sorted[0].created_at || sorted[0].createdAt);
    const diffDays = Math.floor((Date.now() - lastVisitDate.getTime()) / (24 * 3600 * 1000));
    if (diffDays <= 3) {
      return { amount: 0, type: 'Free Review', baseAmount: baseFee };
    } else if (diffDays <= 10) {
      return { amount: Math.round(baseFee * 0.4), type: 'Follow-up', baseAmount: baseFee };
    } else {
      return { amount: baseFee, type: 'First Visit', baseAmount: baseFee };
    }
  }
}

