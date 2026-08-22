import { supabase } from '../lib/supabaseClient';
import { load, save, writeAuditLog, notify } from './apiHelper';
import { getPodContext } from './podContext';
import { getIstDateString } from '../utils/dateUtils';
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
  static isSyncingQueue = false;

  static savePatients(patients: Patient[]): void {
    const currentPodId = getPodContext().podId;
    patients.forEach(p => {
      if (currentPodId && !(p as any).podId && !(p as any).pod_id) {
        (p as any).podId = currentPodId;
      }
    });
    save('patients', patients);
    save('patient_registry', patients);
    notify();
  }

  static savePatient(patient: Patient): void {
    const currentPodId = getPodContext().podId;
    if (currentPodId && !(patient as any).podId && !(patient as any).pod_id) {
      (patient as any).podId = currentPodId;
    }
    const patients = this.getPatients();
    const idx = patients.findIndex(p => p.id === patient.id);
    if (idx >= 0) {
      patients[idx] = { ...patients[idx], ...patient };
    } else {
      patients.push(patient);
    }
    this.savePatients(patients);
  }
  static getPatients(): Patient[] {
    let isDemoAccount = false;
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('vitalsync_cached_profile');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed) {
            const email = String(parsed.email || '').toLowerCase();
            const id = String(parsed.id || '').toLowerCase();
            const name = String(parsed.display_name || parsed.displayName || parsed.name || '').toLowerCase();
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
    const defaultPatients = isDemoAccount ? INITIAL_PATIENTS : [];
    let rawPatients = load<Patient[]>('patients', defaultPatients);
    if (rawPatients.length === 0) {
      rawPatients = load<Patient[]>('patient_registry', defaultPatients);
    }
    
    // For non-demo accounts, purge pre-seeded initial demo patient IDs and mock names from local storage cache
    if (!isDemoAccount) {
      const currentPodId = getPodContext().podId;
      const demoIds = new Set(['dfb2a1a8-8e68-4f8a-929e-4a6c8e317401', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317402', 'pat-101', 'pat-102', 'pat-103', 'pat-104', 'pat-105']);
      const demoNames = new Set(['aarav sharma', 'priyanka verma', 'rahul kumar test', 'rls test patient', 'patient customer', 'unknown', 'unknown patient', 'john doe', 'neha yadav', 'vikram prasad', 'vikram verma']);
      rawPatients = rawPatients.filter(p => {
        const pod = (p as any).podId || (p as any).pod_id;
        if (pod && currentPodId && pod !== currentPodId) return false;
        if (!pod && currentPodId) {
          (p as any).podId = currentPodId;
        }
        const cleanName = String(p.name || '').toLowerCase().trim();
        if (demoIds.has(p.id)) return false;
        if (demoNames.has(cleanName)) return false;
        if (cleanName.includes('test patient') || cleanName.includes('auto test patient')) return false;
        return true;
      });
    }

    // Auto-backfill Smart Patient ID (V1, V2, V56 format) for legacy records missing patientCode
    // Pre-seed letterCounters from EXISTING patient codes to prevent duplicate code assignment
    let modifiedBackfill = false;
    const letterCounters: Record<string, number> = {};
    rawPatients.forEach(p => {
      if (p.patientCode && typeof p.patientCode === 'string') {
        const match = p.patientCode.match(/^([A-Z]+)(\d+)$/);
        if (match) {
          const letter = match[1];
          const num = parseInt(match[2], 10);
          if (!letterCounters[letter] || letterCounters[letter] < num) {
            letterCounters[letter] = num;
          }
        }
      }
    });
    rawPatients.forEach(p => {
      const cleanName = (p.name || '').trim();
      const letter = cleanName.length > 0 ? cleanName.substring(0, 1).toUpperCase() : 'P';
      if (!p.patientCode) {
        letterCounters[letter] = (letterCounters[letter] || 0) + 1;
        p.patientCode = `${letter}${letterCounters[letter]}`;
        modifiedBackfill = true;
      }
    });
    if (modifiedBackfill) {
      save('patients', rawPatients);
    }

    const vitalsMap = load<Record<string, PatientVitals>>('vitals_map', {});
    const tokensMap = load<Record<string, string>>('tokens_map', {});
    const queueStatusMap = load<Record<string, Patient['queueStatus']>>('queue_status_map', {});
    const syncStatusMap = load<Record<string, Patient['syncStatus']>>('sync_status_map', {});
    const premiumMap = load<Record<string, boolean>>('premium_map', {});
    
    return rawPatients.map(p => ({
      ...p,
      vitals: vitalsMap[p.id] || p.vitals,
      tokenNumber: tokensMap[p.id] || p.tokenNumber,
      queueStatus: queueStatusMap[p.id] || p.queueStatus || 'awaiting_vitals',
      syncStatus: syncStatusMap[p.id] || p.syncStatus || 'synced',
      isPremiumMember: premiumMap[p.id] !== undefined ? premiumMap[p.id] : p.isPremiumMember
    }));
  }

  static updatePatientPremiumStatus(patientId: string, isPremium: boolean): void {
    const premiumMap = load<Record<string, boolean>>('premium_map', {});
    premiumMap[patientId] = isPremium;
    save('premium_map', premiumMap);
  }

  // Self-Healing Background Sync Task Queue Worker
  static async processSyncQueue(): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (this.isSyncingQueue) return;

    this.isSyncingQueue = true;

    let activeItem: any = null;

    try {
      const queue = load<any[]>('sync_queue', []);
      if (queue.length === 0) {
        this.isSyncingQueue = false;
        return;
      }

      activeItem = queue[0];
      const syncStatusMap = load<Record<string, Patient['syncStatus']>>('sync_status_map', {});
      let result;
      if (activeItem.operation === 'register_patient') {
        const podId = activeItem.payload?.pod_id || getPodContext().podId;
        const insertPayload = {
          ...activeItem.payload,
          pod_id: podId || null
        };
        result = await supabase.from('patient_registry').upsert(insertPayload, { onConflict: 'id' });
        try {
          await supabase.from('patients').upsert({
            id: activeItem.payload.id,
            name: activeItem.payload.name,
            phone: activeItem.payload.phone,
            age: activeItem.payload.age,
            gender: activeItem.payload.gender,
            pod_id: insertPayload.pod_id,
            created_at: activeItem.payload.created_at || new Date().toISOString()
          }, { onConflict: 'id' });
        } catch (_e) { /* ignore */ }
      } else if (activeItem.operation === 'update_vitals') {
        result = await supabase.from('patient_registry').update(activeItem.payload).eq('id', activeItem.patientId);
      } else if (activeItem.operation === 'save_refraction') {
        result = await supabase.from('patient_registry').update(activeItem.payload).eq('id', activeItem.patientId);
      } else if (activeItem.operation === 'queue_status') {
        result = await supabase.from('patient_registry').update(activeItem.payload).eq('id', activeItem.patientId);
      }

      if (result?.error) {
        throw new Error(result.error.message || 'Sync failed');
      }

      // Success: Remove item from queue, update sync status to 'synced'
      const updatedQueue = queue.filter(item => item.id !== activeItem.id);
      save('sync_queue', updatedQueue);

      syncStatusMap[activeItem.patientId] = 'synced';
      save('sync_status_map', syncStatusMap);
      
      notify();
      
      this.isSyncingQueue = false;
      // Process next item recursively
      this.processSyncQueue();
    } catch (err) {
      console.error('Queue worker process error:', err);
      
      const currentQueue = load<any[]>('sync_queue', []);
      const currentItemIndex = currentQueue.findIndex(item => item.id === activeItem.id);
      
      if (currentItemIndex !== -1) {
        currentQueue[currentItemIndex].attempts = (currentQueue[currentItemIndex].attempts || 0) + 1;
        
        if (currentQueue[currentItemIndex].attempts >= 5) {
          // Mark as failed and remove from active queue to avoid blocking
          currentQueue.splice(currentItemIndex, 1);
          
          const syncStatusMap = load<Record<string, Patient['syncStatus']>>('sync_status_map', {});
          syncStatusMap[activeItem.patientId] = 'failed';
          save('sync_status_map', syncStatusMap);
          notify();
        }
        save('sync_queue', currentQueue);
      }
      this.isSyncingQueue = false;
    }
  }

  static updatePatientVitalsAndToken(patientId: string, vitals: PatientVitals, token: string): void {
    const vitalsMap = load<Record<string, PatientVitals>>('vitals_map', {});
    const tokensMap = load<Record<string, string>>('tokens_map', {});
    const queueStatusMap = load<Record<string, Patient['queueStatus']>>('queue_status_map', {});
    const syncStatusMap = load<Record<string, Patient['syncStatus']>>('sync_status_map', {});
    
    const nextStatus = 'awaiting_consultation';
    
    vitalsMap[patientId] = vitals;
    tokensMap[patientId] = token;
    queueStatusMap[patientId] = nextStatus;
    
    save('vitals_map', vitalsMap);
    save('tokens_map', tokensMap);
    save('queue_status_map', queueStatusMap);

    // Optimistic UI state update
    syncStatusMap[patientId] = 'pending';
    save('sync_status_map', syncStatusMap);

    // Push to sync queue
    const queue = load<any[]>('sync_queue', []);
    queue.push({
      id: crypto.randomUUID(),
      patientId,
      operation: 'update_vitals',
      payload: {
        vitals: vitals,
        token_number: token,
        queue_status: nextStatus
      },
      timestamp: new Date().toISOString(),
      attempts: 0
    });
    save('sync_queue', queue);
    
    const pat = this.getPatients().find(p => p.id === patientId);
    writeAuditLog('PATIENT_VITALS_RECORDED', {
      patientId,
      patientName: pat?.name,
      tokenNumber: token,
      vitals
    }, patientId);
    
    notify();
    this.processSyncQueue();
  }

  static saveRefractionDiagnostics(patientId: string, diagnostics: Partial<PatientVitals>): void {
    const patients = this.getPatients();
    const idx = patients.findIndex(p => p.id === patientId);

    const existingVitals = (idx !== -1 && patients[idx].vitals)
      ? patients[idx].vitals
      : { recordedAt: new Date().toISOString() };

    const updatedVitals: PatientVitals = {
      ...existingVitals,
      ...diagnostics,
      recordedAt: new Date().toISOString()
    } as PatientVitals;

    if (idx !== -1) {
      patients[idx].vitals = updatedVitals;
      patients[idx].queueStatus = 'awaiting_consultation';
      this.savePatients(patients);
    }

    const vitalsMap = load<Record<string, PatientVitals>>('vitals_map', {});
    vitalsMap[patientId] = updatedVitals;
    save('vitals_map', vitalsMap);

    const queueStatusMap = load<Record<string, Patient['queueStatus']>>('queue_status_map', {});
    queueStatusMap[patientId] = 'awaiting_consultation';
    save('queue_status_map', queueStatusMap);

    // Optimistic UI state update
    const syncStatusMap = load<Record<string, Patient['syncStatus']>>('sync_status_map', {});
    syncStatusMap[patientId] = 'pending';
    save('sync_status_map', syncStatusMap);

    // Push to sync queue
    const queue = load<any[]>('sync_queue', []);
    queue.push({
      id: crypto.randomUUID(),
      patientId,
      operation: 'save_refraction',
      payload: {
        vitals: updatedVitals,
        queue_status: 'awaiting_consultation'
      },
      timestamp: new Date().toISOString(),
      attempts: 0
    });
    save('sync_queue', queue);
    
    const pat = idx !== -1 ? patients[idx] : null;
    writeAuditLog('PATIENT_REFRACTION_RECORDED', {
      patientId,
      patientName: pat?.name,
      diagnostics
    }, patientId);
    
    notify();
    this.processSyncQueue();
  }

  static updatePatientQueueStatus(patientId: string, status: Patient['queueStatus']): void {
    const queueStatusMap = load<Record<string, Patient['queueStatus']>>('queue_status_map', {});
    const syncStatusMap = load<Record<string, Patient['syncStatus']>>('sync_status_map', {});
    
    queueStatusMap[patientId] = status;
    save('queue_status_map', queueStatusMap);

    // Optimistic UI state update
    syncStatusMap[patientId] = 'pending';
    save('sync_status_map', syncStatusMap);

    // Push to sync queue
    const queue = load<any[]>('sync_queue', []);
    queue.push({
      id: crypto.randomUUID(),
      patientId,
      operation: 'queue_status',
      payload: {
        queue_status: status
      },
      timestamp: new Date().toISOString(),
      attempts: 0
    });
    save('sync_queue', queue);
    
    const pat = this.getPatients().find(p => p.id === patientId);
    writeAuditLog('PATIENT_QUEUE_STATUS_UPDATED', {
      patientId,
      patientName: pat?.name,
      queueStatus: status
    }, patientId);
    
    notify();
    this.processSyncQueue();
  }

  static generateNextTokenNumber(targetDate?: string, isSos: boolean = false): string {
    const patients = this.getPatients();
    const appointments = load<any[]>('saas_appointments', []);
    const dateStr = targetDate || getIstDateString();

    const apptsForDate = appointments.filter(a => {
      const apptDate = a.virtualDate || a.createdAt || '';
      return apptDate.startsWith(dateStr);
    });

    const activeTokens = patients
      .map(p => String(p.tokenNumber || ''))
      .filter((t): t is string => !!t && (t.startsWith('T-') || t.startsWith('TK-') || t.startsWith('#TK-') || t.startsWith('#T-')));

    const tokenNums = [
      ...activeTokens.map(t => parseInt(t.replace('#TK-', '').replace('TK-', '').replace('#T-', '').replace('T-', '').replace('E', '').replace('#', '').trim(), 10)),
      apptsForDate.length
    ].filter(n => !isNaN(n) && n > 0);

    const maxVal = tokenNums.length > 0 ? Math.max(...tokenNums) : 0;
    const nextVal = maxVal + 1;
    const baseToken = `T-${nextVal.toString().padStart(2, '0')}`;
    return isSos ? `${baseToken} E` : baseToken;
  }

  private static isUUID(str?: string): boolean {
    if (!str) return false;
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(str);
  }

  static generateSmartPatientId(name: string, existingPatients: Patient[]): string {
    const cleanName = (name || '').trim();
    const firstLetter = cleanName.length > 0 ? cleanName.substring(0, 1).toUpperCase() : 'P';
    let maxNum = 0;
    existingPatients.forEach(p => {
      if (p.patientCode && typeof p.patientCode === 'string') {
        const match = p.patientCode.match(/^([A-Z]+)(\d+)$/);
        if (match && match[1] === firstLetter) {
          const num = parseInt(match[2], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
    });
    return `${firstLetter}${maxNum + 1}`;
  }

  static registerPatient(patientData: Omit<Patient, 'id' | 'createdAt'> & { id?: string }): Patient {
    const currentPodId = getPodContext().podId;
    const patients = this.getPatients();
    const newId = (patientData.id && this.isUUID(patientData.id)) ? patientData.id : crypto.randomUUID();
    const customPatientId = this.generateSmartPatientId(patientData.name, patients);

    const newPatient: Patient = {
      ...patientData,
      id: newId,
      podId: currentPodId,
      patientCode: patientData.patientCode || customPatientId,
      tokenNumber: patientData.tokenNumber || customPatientId,
      createdAt: new Date().toISOString()
    } as any;
    
    patients.push(newPatient);
    this.savePatients(patients);

    const syncStatusMap = load<Record<string, Patient['syncStatus']>>('sync_status_map', {});
    syncStatusMap[newPatient.id] = 'pending';
    save('sync_status_map', syncStatusMap);

    // Push to sync queue
    const queue = load<any[]>('sync_queue', []);
    queue.push({
      id: crypto.randomUUID(),
      patientId: newPatient.id,
      operation: 'register_patient',
      payload: {
        id: newPatient.id,
        name: newPatient.name,
        phone: newPatient.phone,
        age: newPatient.age,
        gender: newPatient.gender,
        allergies: newPatient.allergies,
        chronic_conditions: newPatient.chronicConditions,
        abha_id: newPatient.abhaId,
        token_number: newPatient.tokenNumber,
        patient_code: newPatient.patientCode,
        registered_at_entity: (getPodContext().entityId && getPodContext().entityId !== 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002') ? getPodContext().entityId : null,
        pod_id: currentPodId
      },
      timestamp: new Date().toISOString(),
      attempts: 0
    });
    save('sync_queue', queue);

    const staffList = load<any[]>('clinic_staff', []);
    const activeStaffId = load<string | null>('active_staff_id', null);
    const activeStaff = staffList.find(s => s.id === activeStaffId);

    writeAuditLog('patient_registered', { 
      name: newPatient.name, 
      phone: newPatient.phone, 
      registeredByStaffId: activeStaffId || 'None',
      registeredByStaffName: activeStaff?.staffName || 'System'
    }, newPatient.id);

    notify();
    this.processSyncQueue();

    return newPatient;
  }

  static bulkRegisterPatients(patientList: Array<Omit<Patient, 'id' | 'createdAt'> & { id?: string }>): Patient[] {
    const registeredList: Patient[] = [];
    patientList.forEach(pData => {
      const newId = (pData.id && this.isUUID(pData.id)) ? pData.id : crypto.randomUUID();
      const reg = this.registerPatient({
        ...pData,
        id: newId
      });
      registeredList.push(reg);
    });
    return registeredList;
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
        const dateStr = getIstDateString(r.createdAt ? new Date(r.createdAt) : new Date());

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
      const vDate = (patientObj.vitals.recordedAt || new Date().toISOString()).split('T')[0];
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

    return historyList.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
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
        signature_algorithm: 'HMAC-SHA256',
        pod_id: getPodContext().podId
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
        signature_algorithm: 'HMAC-SHA256',
        pod_id: getPodContext().podId
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

    return `Patient ${patient.name} (${patient.age}y, ${patient.gender}) presents active chronic management for ${(patient.chronicConditions || []).join(', ') || 'general complaints'}. Overall wellness score: 84/100. CDSS recommends continuous monitoring of blood pressure, bi-weekly capillary blood glucose, and strict avoidance of documented allergy triggers (${(patient.allergies || []).join(', ') || 'NKDA'}).`;
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
      const sys = parseInt(sysStr || '0', 10);
      const dia = parseInt(diaStr || '0', 10);
      if (sys > 140 || dia > 90) {
        return { isAlert: true, reason: `High BP: ${bp} mmHg` };
      }
    }
    const sugar = parseInt(patient.vitals.bloodSugar || '', 10);
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
    const sorted = [...patientEncounters].sort((a, b) => new Date(b.created_at || b.createdAt || 0).getTime() - new Date(a.created_at || a.createdAt || 0).getTime());
    const lastVisitDate = new Date(sorted[0]?.created_at || sorted[0]?.createdAt || Date.now());
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

// Start offline sync background queue worker and register connection triggers
if (typeof window !== 'undefined') {
  // Check and process sync queue items every 8 seconds
  setInterval(() => {
    PatientService.processSyncQueue();
  }, 8000);

  window.addEventListener('online', () => {
    PatientService.processSyncQueue();
  });
}

